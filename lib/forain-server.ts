import { env } from "cloudflare:workers";
import { getSessionUser } from "@/app/auth";
import { database, nowIso } from "@/lib/database";

export { database, nowIso } from "@/lib/database";

export type ExtractedActivity = {
  name: string;
  category: string;
  confidence: number;
  evidence: string;
  rawGrowth: number;
};

export async function requireApiUser() {
  const user = await getSessionUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}

export function currentLocalDate(timeZone = "Asia/Seoul") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

const rules = [
  { category: "MUSIC", name: "기타 연습", words: ["기타를 연습", "기타 연습"] },
  { category: "MUSIC", name: "피아노 연습", words: ["피아노를 연습", "피아노 연습"] },
  { category: "LEARNING", name: "독서", words: ["책을 읽", "독서", "읽었다", "읽었"] },
  { category: "LEARNING", name: "강의 시청", words: ["강의를 봤", "강의를 보", "수업을 들", "공부했", "공부를"] },
  { category: "WORK", name: "과제", words: ["과제를 했", "과제를 하", "업무를", "일을 했"] },
  { category: "EXERCISE", name: "운동", words: ["운동했", "운동을 했", "달렸", "산책했", "걸었다", "축구를 했"] },
  { category: "SOCIAL", name: "함께한 식사", words: ["친구와 식사", "함께 식사", "친구를 만", "대화했"] },
  { category: "CULTURE", name: "영화 감상", words: ["영화를 봤", "영화를 보았다", "전시를 봤", "공연을 봤"] },
  { category: "REST", name: "휴식", words: ["쉬었다", "휴식했", "잠을 잤", "낮잠"] },
  { category: "DAILY_LIFE", name: "집안일", words: ["청소했", "요리했", "정리했"] },
  { category: "CARE", name: "돌봄", words: ["돌봤", "간호했", "챙겨드"] },
  { category: "TRAVEL", name: "여행", words: ["여행했", "다녀왔다", "방문했다"] },
  { category: "CREATIVE", name: "창작", words: ["그림을 그", "글을 썼", "만들었다", "작곡"] },
];

export function mockAnalyze(body: string): ExtractedActivity[] {
  const sentences = body.split(/(?<=[.!?。]|다\s)/).map((value) => value.trim()).filter(Boolean);
  const found: ExtractedActivity[] = [];
  for (const sentence of sentences) {
    if (/내일|예정|해야겠다|하려고|할 것이다|계획/.test(sentence)) continue;
    if (/예전에|과거에|어릴 때/.test(sentence)) continue;
    const clauses = sentence.split(/(?:지만|그리고|했고|하며|하면서|,)/).map((value) => value.trim()).filter(Boolean);
    for (let clause of clauses) {
      if (/친구가|동생이|그가|그녀가/.test(clause) && !/나는|내가/.test(clause)) continue;
      if (/나는|내가/.test(clause)) clause = clause.replace(/^.*?(?:나는|내가)/, "");
      if (/못했다|하지 않았다|안 했다/.test(clause) && !/쉬었다|휴식/.test(clause)) continue;
      for (const rule of rules) {
        if (!rule.words.some((word) => clause.includes(word))) continue;
        const key = `${rule.category}:${rule.name}`;
        if (found.some((activity) => `${activity.category}:${activity.name}` === key)) continue;
        found.push({
          name: rule.name,
          category: rule.category,
          confidence: 0.88,
          evidence: sentence.replace(/[.!?。]+$/, ""),
          rawGrowth: 1,
        });
      }
    }
  }
  return found.slice(0, 12);
}

export async function analyzeActivities(body: string): Promise<ExtractedActivity[]> {
  const runtime = env as unknown as {
    AI_MOCK_MODE?: string;
    OPENAI_API_KEY?: string;
    OPENAI_ACTIVITY_MODEL?: string;
  };
  if (runtime.AI_MOCK_MODE !== "false" || !runtime.OPENAI_API_KEY) return mockAnalyze(body);

  const categories = [
    "LEARNING", "WORK", "CREATIVE", "MUSIC", "EXERCISE", "SOCIAL",
    "CULTURE", "DAILY_LIFE", "REST", "TRAVEL", "CARE", "OTHER",
  ];
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtime.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: runtime.OPENAI_ACTIVITY_MODEL || "gpt-5.6-luna",
      input: [
        { role: "system", content: "사용자의 일기에서 사용자가 실제로 수행한 활동만 추출한다. 계획, 실패한 시도, 타인의 활동, 오래된 회상은 제외한다. 감정이나 성격을 추론하지 않는다." },
        { role: "user", content: body },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "forain_activities",
          strict: true,
          schema: {
            type: "object",
            properties: {
              activities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    category: { type: "string", enum: categories },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    evidence: { type: "string" },
                    rawGrowth: { type: "number", minimum: 0.1, maximum: 2 },
                  },
                  required: ["name", "category", "confidence", "evidence", "rawGrowth"],
                  additionalProperties: false,
                },
              },
            },
            required: ["activities"],
            additionalProperties: false,
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error("AI_ANALYSIS_FAILED");
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const outputText = payload.output_text || payload.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("");
  if (!outputText) throw new Error("AI_ANALYSIS_EMPTY");
  return (JSON.parse(outputText) as { activities: ExtractedActivity[] }).activities;
}

export async function recalculateDay(userId: string, localDate: string) {
  const db = database();
  const events = await db.prepare(
    "SELECT id, category, raw_growth AS rawGrowth FROM activity_growth_events WHERE user_id = ? AND local_date = ? ORDER BY created_at, id"
  ).bind(userId, localDate).all<{ id: string; category: string; rawGrowth: number }>();
  const rows = events.results || [];
  const rawByCategory = new Map<string, number>();
  for (const row of rows) rawByCategory.set(row.category, (rawByCategory.get(row.category) || 0) + row.rawGrowth);
  const statements: D1PreparedStatement[] = [];
  for (const row of rows) {
    statements.push(db.prepare("UPDATE activity_growth_events SET applied_growth = ? WHERE id = ? AND user_id = ?").bind(row.rawGrowth, row.id, userId));
  }
  statements.push(db.prepare("DELETE FROM daily_growth_ledgers WHERE user_id = ? AND local_date = ?").bind(userId, localDate));
  const timestamp = nowIso();
  for (const [category, raw] of rawByCategory) {
    statements.push(db.prepare(
      "INSERT INTO daily_growth_ledgers (id, user_id, local_date, category, raw_growth, applied_growth, category_cap, total_cap, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), userId, localDate, category, raw, raw, 0, 0, timestamp));
  }
  if (statements.length) await db.batch(statements);
}

export function jsonError(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  console.error("[Forain]", message);
  return Response.json({ error: message === "DB_UNAVAILABLE" ? "저장 공간에 연결할 수 없습니다." : "요청을 처리하지 못했습니다." }, { status: 500 });
}
