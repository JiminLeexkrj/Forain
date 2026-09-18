import { database, jsonError, requireApiUser } from "@/lib/forain-server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const result = await database().prepare("SELECT id, diary_id AS diaryId, name, category, confidence, evidence, status, raw_growth AS rawGrowth FROM activity_mentions WHERE diary_id = ? AND user_id = ? ORDER BY created_at").bind(id, user.userId).all();
    return Response.json({ mentions: result.results || [] });
  } catch (error) { return jsonError(error); }
}
