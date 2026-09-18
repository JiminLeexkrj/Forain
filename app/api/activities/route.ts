import { database, jsonError, requireApiUser } from "@/lib/forain-server";

export async function GET() {
  try {
    const user = await requireApiUser();
    const result = await database().prepare(`
      SELECT m.name, m.category, COUNT(*) AS occurrences, COALESCE(SUM(g.applied_growth), 0) AS lifetimeGrowth,
             MAX(m.created_at) AS lastActivityAt
      FROM activity_mentions m
      LEFT JOIN activity_growth_events g ON g.activity_mention_id = m.id
      WHERE m.user_id = ? AND m.status = 'confirmed'
      GROUP BY m.name, m.category
      ORDER BY lifetimeGrowth DESC, lastActivityAt DESC
    `).bind(user.userId).all();
    return Response.json({ activities: result.results || [] });
  } catch (error) { return jsonError(error); }
}
