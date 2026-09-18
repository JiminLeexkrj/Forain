import { currentLocalDate, database, jsonError, requireApiUser } from "@/lib/forain-server";

export async function GET() {
  try {
    const user = await requireApiUser();
    const db = database();
    const [plants, today] = await Promise.all([
      db.prepare(`
        SELECT m.name, m.category, COUNT(*) AS occurrences,
               COALESCE(SUM(g.applied_growth), 0) AS lifetimeGrowth,
               MAX(m.created_at) AS lastActivityAt
        FROM activity_mentions m
        LEFT JOIN activity_growth_events g ON g.activity_mention_id = m.id
        WHERE m.user_id = ? AND m.status = 'confirmed'
        GROUP BY m.name, m.category
        ORDER BY lifetimeGrowth DESC
      `).bind(user.userId).all(),
      db.prepare("SELECT category, applied_growth AS appliedGrowth FROM daily_growth_ledgers WHERE user_id = ? AND local_date = ? ORDER BY category").bind(user.userId, currentLocalDate()).all(),
    ]);
    return Response.json({ plants: plants.results || [], today: today.results || [], categoryCap: 3, totalCap: 10 });
  } catch (error) { return jsonError(error); }
}
