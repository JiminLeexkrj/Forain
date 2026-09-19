import { cookies } from "next/headers";
import { database, nowIso } from "@/lib/database";

const SESSION_COOKIE = "forain_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
// Cloudflare Workers currently caps Web Crypto PBKDF2 at 100,000 iterations.
// The per-user value is persisted, so a future runtime can raise this safely.
const PASSWORD_ITERATIONS = 100_000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export type AppUser = {
  userId: string;
  loginId: string;
  displayName: string;
};

export type RegistrationInput = {
  loginId: string;
  password: string;
  displayName: string;
};

export function normalizeLoginId(value: string) {
  return value.trim().toLowerCase();
}

export function validateRegistration(input: RegistrationInput) {
  const loginId = normalizeLoginId(input.loginId);
  const displayName = input.displayName.trim();
  if (!/^[a-z0-9][a-z0-9_-]{3,23}$/.test(loginId)) return "아이디는 영문 소문자와 숫자, 밑줄, 하이픈을 사용해 4~24자로 입력해 주세요.";
  if (displayName.length < 1 || displayName.length > 30) return "사용자 이름은 1~30자로 입력해 주세요.";
  if (input.password.length < 8 || input.password.length > 72) return "비밀번호는 8~72자로 입력해 주세요.";
  return null;
}

export async function registerUser(input: RegistrationInput): Promise<AppUser> {
  const error = validateRegistration(input);
  if (error) throw new Error(`VALIDATION:${error}`);
  const db = database();
  const loginId = normalizeLoginId(input.loginId);
  const existing = await db.prepare("SELECT id FROM users WHERE login_id = ?").bind(loginId).first();
  if (existing) throw new Error("LOGIN_ID_TAKEN");

  const id = crypto.randomUUID();
  const timestamp = nowIso();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await derivePassword(input.password, salt, PASSWORD_ITERATIONS);
  try {
    await db.batch([
      db.prepare("INSERT INTO users (id, login_id, display_name, password_hash, password_salt, password_iterations, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, loginId, input.displayName.trim(), encodeBytes(passwordHash), encodeBytes(salt), PASSWORD_ITERATIONS, timestamp, timestamp),
      db.prepare("INSERT INTO user_preferences (user_id, timezone, forest_seed, has_seen_tutorial, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(id, "Asia/Seoul", randomForestSeed(), 0, timestamp, timestamp),
    ]);
  } catch (cause) {
    if (cause instanceof Error && /unique/i.test(cause.message)) throw new Error("LOGIN_ID_TAKEN");
    throw cause;
  }
  return { userId: id, loginId, displayName: input.displayName.trim() };
}

export type AuthResult =
  | { status: "ok"; user: AppUser }
  | { status: "locked"; retryAfterSeconds: number }
  | { status: "invalid" };

export async function authenticateUser(loginIdInput: string, password: string): Promise<AuthResult> {
  const loginId = normalizeLoginId(loginIdInput);
  const db = database();
  const row = await db.prepare(
    "SELECT id AS userId, login_id AS loginId, display_name AS displayName, password_hash AS passwordHash, password_salt AS passwordSalt, password_iterations AS passwordIterations, failed_login_attempts AS failedLoginAttempts, lockout_until AS lockoutUntil FROM users WHERE login_id = ?"
  ).bind(loginId).first<AppUser & { passwordHash: string; passwordSalt: string; passwordIterations: number; failedLoginAttempts: number; lockoutUntil: string | null }>();
  if (!row) {
    await derivePassword(password || "invalid-password", crypto.getRandomValues(new Uint8Array(16)), PASSWORD_ITERATIONS);
    return { status: "invalid" };
  }

  const now = Date.now();
  const lockoutUntil = row.lockoutUntil ? new Date(row.lockoutUntil).getTime() : null;
  if (lockoutUntil !== null && lockoutUntil > now) {
    return { status: "locked", retryAfterSeconds: Math.ceil((lockoutUntil - now) / 1000) };
  }

  const actual = await derivePassword(password, decodeBytes(row.passwordSalt), row.passwordIterations);
  const passwordMatches = constantTimeEqual(actual, decodeBytes(row.passwordHash));

  if (!passwordMatches) {
    // A lockout that has already expired doesn't carry its attempt count forward.
    const baseline = lockoutUntil !== null ? 0 : row.failedLoginAttempts;
    const attempts = baseline + 1;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const nextLockout = new Date(now + LOCKOUT_MINUTES * 60 * 1000).toISOString();
      await db.prepare("UPDATE users SET failed_login_attempts = ?, lockout_until = ? WHERE id = ?").bind(attempts, nextLockout, row.userId).run();
    } else {
      await db.prepare("UPDATE users SET failed_login_attempts = ?, lockout_until = NULL WHERE id = ?").bind(attempts, row.userId).run();
    }
    return { status: "invalid" };
  }

  await db.prepare("UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ?").bind(row.userId).run();
  return { status: "ok", user: { userId: row.userId, loginId: row.loginId, displayName: row.displayName } };
}

export async function createSession(userId: string) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = encodeBytes(tokenBytes);
  const tokenHash = encodeBytes(new Uint8Array(await crypto.subtle.digest("SHA-256", tokenBytes)));
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_SECONDS * 1000);
  await database().prepare("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, tokenHash, expiresAt.toISOString(), createdAt.toISOString()).run();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getSessionUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let tokenBytes: Uint8Array<ArrayBuffer>;
  try { tokenBytes = decodeBytes(token); } catch { return null; }
  const tokenHash = encodeBytes(new Uint8Array(await crypto.subtle.digest("SHA-256", tokenBytes)));
  const user = await database().prepare(`
    SELECT u.id AS userId, u.login_id AS loginId, u.display_name AS displayName
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).bind(tokenHash, nowIso()).first<AppUser>();
  return user || null;
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const tokenBytes = decodeBytes(token);
      const tokenHash = encodeBytes(new Uint8Array(await crypto.subtle.digest("SHA-256", tokenBytes)));
      await database().prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(tokenHash).run();
    } catch { /* Invalid cookies are cleared below. */ }
  }
  cookieStore.delete(SESSION_COOKIE);
}

async function derivePassword(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

function encodeBytes(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomForestSeed() {
  return new DataView(crypto.getRandomValues(new Uint8Array(4)).buffer).getUint32(0) & 0x7fffffff;
}
