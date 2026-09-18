import { database, jsonError, nowIso, recalculateDay, requireApiUser } from "@/lib/forain-server";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const db = database();
    const diary = await db.prepare("SELECT id, local_date AS localDate FROM diaries WHERE id = ? AND user_id = ?").bind(id, user.userId).first<{ id: string; localDate: string }>();
    if (!diary) return Response.json({ error: "편린을 찾을 수 없습니다." }, { status: 404 });
    const mentions = await db.prepare("SELECT id, category, raw_growth AS rawGrowth FROM activity_mentions WHERE diary_id = ? AND user_id = ?").bind(id, user.userId).all<{ id: string; category: string; rawGrowth: number }>();
    const timestamp = nowIso();
    const statements: D1PreparedStatement[] = [];
    for (const mention of mentions.results || []) statements.push(db.prepare("INSERT OR IGNORE INTO activity_growth_events (id, user_id, diary_id, activity_mention_id, category, raw_growth, applied_growth, local_date, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)").bind(crypto.randomUUID(), user.userId, id, mention.id, mention.category, mention.rawGrowth, diary.localDate, timestamp));
    statements.push(db.prepare("UPDATE activity_mentions SET status = 'confirmed' WHERE diary_id = ? AND user_id = ?").bind(id, user.userId));
    statements.push(db.prepare("UPDATE diaries SET status = 'confirmed', updated_at = ? WHERE id = ? AND user_id = ?").bind(timestamp, id, user.userId));
    await db.batch(statements);
    await recalculateDay(user.userId, diary.localDate);
    return Response.json({ confirmed: true, idempotent: true });
  } catch (error) { return jsonError(error); }
}
