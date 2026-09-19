import { database, jsonError, nowIso, requireApiUser } from "@/lib/forain-server";

const categories = new Set(["LEARNING","WORK","CREATIVE","MUSIC","EXERCISE","SOCIAL","CULTURE","DAILY_LIFE","REST","TRAVEL","CARE","OTHER"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const payload = await request.json() as { name?: string; category?: string; evidence?: string };
    const name = payload.name?.trim() || "";
    if (!name || !payload.category || !categories.has(payload.category)) return Response.json({ error: "활동 이름과 카테고리가 필요합니다." }, { status: 400 });
    const db = database();
    const diary = await db.prepare("SELECT id FROM diaries WHERE id = ? AND user_id = ?").bind(id, user.userId).first();
    if (!diary) return Response.json({ error: "편린을 찾을 수 없습니다." }, { status: 404 });
    const mention = { id: crypto.randomUUID(), diaryId: id, name, normalizedName: name, category: payload.category, confidence: 1, evidence: payload.evidence?.trim() || "사용자가 직접 추가한 활동", status: "pending", rawGrowth: 1, createdAt: nowIso() };
    await db.prepare("INSERT INTO activity_mentions (id, diary_id, user_id, name, normalized_name, category, confidence, evidence, status, raw_growth, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(mention.id, id, user.userId, mention.name, mention.normalizedName, mention.category, mention.confidence, mention.evidence, mention.status, mention.rawGrowth, mention.createdAt).run();
    return Response.json({ mention }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
