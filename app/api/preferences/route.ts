import { database, jsonError, requireApiUser } from "@/lib/forain-server";

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = await request.json() as { tutorialSeen?: boolean };
    if (typeof payload.tutorialSeen !== "boolean") return Response.json({ error: "tutorialSeen 값이 필요합니다." }, { status: 400 });
    await database().prepare("UPDATE user_preferences SET has_seen_tutorial = ? WHERE user_id = ?").bind(payload.tutorialSeen ? 1 : 0, user.userId).run();
    return Response.json({ updated: true });
  } catch (error) { return jsonError(error); }
}
