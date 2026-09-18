import { database, jsonError, nowIso, recalculateDay, requireApiUser } from "@/lib/forain-server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const diary = await database().prepare("SELECT id, title, body, status, local_date AS localDate, created_at AS createdAt FROM diaries WHERE id = ? AND user_id = ?").bind(id, user.userId).first();
    return diary ? Response.json({ diary }) : Response.json({ error: "편린을 찾을 수 없습니다." }, { status: 404 });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const payload = await request.json() as { title?: string; body?: string };
    const body = payload.body?.trim() || "";
    if (!body) return Response.json({ error: "편린 내용이 필요합니다." }, { status: 400 });
    const db = database();
    const existing = await db.prepare("SELECT status, local_date AS localDate FROM diaries WHERE id = ? AND user_id = ?").bind(id, user.userId).first<{ status: string; localDate: string }>();
    if (!existing) return Response.json({ error: "편린을 찾을 수 없습니다." }, { status: 404 });
    if (existing.status === "confirmed") {
      await db.batch([
        db.prepare("DELETE FROM activity_growth_events WHERE diary_id = ? AND user_id = ?").bind(id, user.userId),
        db.prepare("DELETE FROM activity_mentions WHERE diary_id = ? AND user_id = ?").bind(id, user.userId),
      ]);
      await recalculateDay(user.userId, existing.localDate);
    }
    const result = await db.prepare("UPDATE diaries SET title = ?, body = ?, status = 'saved', updated_at = ? WHERE id = ? AND user_id = ? RETURNING id, title, body, status, local_date AS localDate, created_at AS createdAt").bind(payload.title?.trim().slice(0, 120) || "", body, nowIso(), id, user.userId).first();
    return result ? Response.json({ diary: result }) : Response.json({ error: "편린을 찾을 수 없습니다." }, { status: 404 });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const db = database();
    const dates = await db.prepare("SELECT DISTINCT local_date AS localDate FROM activity_growth_events WHERE diary_id = ? AND user_id = ?").bind(id, user.userId).all<{ localDate: string }>();
    await db.batch([
      db.prepare("DELETE FROM activity_growth_events WHERE diary_id = ? AND user_id = ?").bind(id, user.userId),
      db.prepare("DELETE FROM activity_mentions WHERE diary_id = ? AND user_id = ?").bind(id, user.userId),
      db.prepare("DELETE FROM diaries WHERE id = ? AND user_id = ?").bind(id, user.userId),
    ]);
    for (const row of dates.results || []) await recalculateDay(user.userId, row.localDate);
    return new Response(null, { status: 204 });
  } catch (error) { return jsonError(error); }
}
