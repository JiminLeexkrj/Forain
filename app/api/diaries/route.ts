import { database, jsonError, nowIso, requireApiUser } from "@/lib/forain-server";

export async function GET() {
  try {
    const user = await requireApiUser();
    const result = await database().prepare("SELECT id, title, body, status, local_date AS localDate, created_at AS createdAt FROM diaries WHERE user_id = ? ORDER BY created_at DESC").bind(user.userId).all();
    return Response.json({ diaries: result.results || [] });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = await request.json() as { title?: string; body?: string; localDate?: string; timezone?: string };
    const body = payload.body?.trim() || "";
    if (!body) return Response.json({ error: "편린 내용이 필요합니다." }, { status: 400 });
    if (body.length > 12000) return Response.json({ error: "편린은 12,000자까지 저장할 수 있습니다." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.localDate || "")) return Response.json({ error: "현지 날짜가 올바르지 않습니다." }, { status: 400 });
    const db = database();
    const timestamp = nowIso();
    const diary = { id: crypto.randomUUID(), title: payload.title?.trim().slice(0, 120) || "", body, status: "saved", localDate: payload.localDate!, createdAt: timestamp };
    await db.batch([
      db.prepare("INSERT INTO diaries (id, user_id, title, body, status, local_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(diary.id, user.userId, diary.title, diary.body, diary.status, diary.localDate, timestamp, timestamp),
      db.prepare("INSERT OR IGNORE INTO user_preferences (user_id, timezone, forest_seed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(user.userId, payload.timezone || "Asia/Seoul", Math.abs(hashCode(user.userId)), timestamp, timestamp),
    ]);
    return Response.json({ diary }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

function hashCode(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return hash;
}
