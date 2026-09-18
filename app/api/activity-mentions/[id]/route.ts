import { database, jsonError, recalculateDay, requireApiUser } from "@/lib/forain-server";

const categories = new Set(["LEARNING","WORK","CREATIVE","MUSIC","EXERCISE","SOCIAL","CULTURE","DAILY_LIFE","REST","TRAVEL","CARE","OTHER"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const payload = await request.json() as { name?: string; category?: string };
    if (payload.category && !categories.has(payload.category)) return Response.json({ error: "카테고리가 올바르지 않습니다." }, { status: 400 });
    const db = database();
    const mention = await db.prepare("SELECT name, category FROM activity_mentions WHERE id = ? AND user_id = ?").bind(id, user.userId).first<{ name: string; category: string }>();
    if (!mention) return Response.json({ error: "활동을 찾을 수 없습니다." }, { status: 404 });
    await db.batch([
      db.prepare("UPDATE activity_mentions SET name = ?, category = ? WHERE id = ? AND user_id = ?").bind(payload.name?.trim() || mention.name, payload.category || mention.category, id, user.userId),
      db.prepare("UPDATE activity_growth_events SET category = ? WHERE activity_mention_id = ? AND user_id = ?").bind(payload.category || mention.category, id, user.userId),
    ]);
    const dates = await db.prepare("SELECT DISTINCT local_date AS localDate FROM activity_growth_events WHERE activity_mention_id = ? AND user_id = ?").bind(id, user.userId).all<{ localDate: string }>();
    for (const row of dates.results || []) await recalculateDay(user.userId, row.localDate);
    return Response.json({ updated: true });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const db = database();
    const dates = await db.prepare("SELECT DISTINCT local_date AS localDate FROM activity_growth_events WHERE activity_mention_id = ? AND user_id = ?").bind(id, user.userId).all<{ localDate: string }>();
    await db.batch([
      db.prepare("DELETE FROM activity_growth_events WHERE activity_mention_id = ? AND user_id = ?").bind(id, user.userId),
      db.prepare("DELETE FROM activity_mentions WHERE id = ? AND user_id = ?").bind(id, user.userId),
    ]);
    for (const row of dates.results || []) await recalculateDay(user.userId, row.localDate);
    return new Response(null, { status: 204 });
  } catch (error) { return jsonError(error); }
}
