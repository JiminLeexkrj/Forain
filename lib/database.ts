import { env } from "cloudflare:workers";

export function database() {
  if (!env.DB) throw new Error("DB_UNAVAILABLE");
  return env.DB;
}

export function nowIso() {
  return new Date().toISOString();
}
