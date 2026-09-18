import { analyzeActivities, database, jsonError, nowIso, requireApiUser } from "@/lib/forain-server";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const db = database();
    const diary = await db.prepare("SELECT id, body, status FROM diaries WHERE id = ? AND user_id = ?").bind(id, user.userId).first<{ id: string; body: string; status: string }>();
    if (!diary) return Response.json({ error: "편린을 찾을 수 없습니다." }, { status: 404 });
    if (diary.status === "confirmed") {
      const existing = await db.prepare("SELECT id, diary_id AS diaryId, name, category, confidence, evidence, status, raw_growth AS rawGrowth FROM activity_mentions WHERE diary_id = ? AND user_id = ?").bind(id, user.userId).all();
      return Response.json({ mentions: existing.results || [], idempotent: true });
    }
    const activities = await analyzeActivities(diary.body);
    const timestamp = nowIso();
    const statements: D1PreparedStatement[] = [
      db.prepare("DELETE FROM activity_mentions WHERE diary_id = ? AND user_id = ?").bind(id, user.userId),
      db.prepare("UPDATE diaries SET status = 'analyzed', updated_at = ? WHERE id = ? AND user_id = ?").bind(timestamp, id, user.userId),
    ];
    const mentions = activities.map((activity) => ({ ...activity, id: crypto.randomUUID(), diaryId: id, status: "pending", createdAt: timestamp }));
    for (const mention of mentions) statements.push(db.prepare("INSERT INTO activity_mentions (id, diary_id, user_id, name, category, confidence, evidence, status, raw_growth, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(mention.id, id, user.userId, mention.name, mention.category, mention.confidence, mention.evidence, mention.status, mention.rawGrowth, timestamp));
    await db.batch(statements);
    return Response.json({ mentions });
  } catch (error) { return jsonError(error); }
}
