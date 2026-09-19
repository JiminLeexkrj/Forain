import { currentLocalDate, database, jsonError, requireApiUser } from "@/lib/forain-server";

export async function GET() {
  try {
    const user = await requireApiUser();
    const db = database();
    const [diariesResult, mentionsResult, growthResult, preferencesResult] = await Promise.all([
      db.prepare("SELECT id, title, body, status, local_date AS localDate, created_at AS createdAt FROM diaries WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").bind(user.userId).all(),
      db.prepare(`
        SELECT m.id, m.diary_id AS diaryId, m.name, m.normalized_name AS normalizedName, m.category, m.confidence, m.evidence,
               m.status, COALESCE(SUM(g.applied_growth), 0) AS growth, m.created_at AS createdAt
        FROM activity_mentions m
        LEFT JOIN activity_growth_events g ON g.activity_mention_id = m.id
        WHERE m.user_id = ?
        GROUP BY m.id
        ORDER BY m.created_at DESC
      `).bind(user.userId).all(),
      db.prepare("SELECT category, SUM(applied_growth) AS appliedGrowth FROM activity_growth_events WHERE user_id = ? GROUP BY category").bind(user.userId).all(),
      db.prepare("SELECT has_seen_tutorial AS hasSeenTutorial FROM user_preferences WHERE user_id = ?").bind(user.userId).first<{ hasSeenTutorial: number }>(),
    ]);
    const today = currentLocalDate();
    const todayResult = await db.prepare("SELECT COALESCE(SUM(applied_growth), 0) AS total FROM daily_growth_ledgers WHERE user_id = ? AND local_date = ?").bind(user.userId, today).first<{ total: number }>();
    return Response.json({
      diaries: diariesResult.results || [],
      mentions: mentionsResult.results || [],
      growth: growthResult.results || [],
      todayGrowth: Number(todayResult?.total || 0),
      tutorialSeen: Boolean(preferencesResult?.hasSeenTutorial ?? true),
    });
  } catch (error) { return jsonError(error); }
}
