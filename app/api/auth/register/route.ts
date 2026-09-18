import { createSession, registerUser } from "@/app/auth";
import { jsonError } from "@/lib/forain-server";

export async function POST(request: Request) {
  try {
    const input = await request.json() as { loginId?: string; password?: string; displayName?: string };
    const user = await registerUser({ loginId: input.loginId || "", password: input.password || "", displayName: input.displayName || "" });
    await createSession(user.userId);
    return Response.json({ user: { loginId: user.loginId, displayName: user.displayName } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("VALIDATION:")) return Response.json({ error: error.message.slice(11) }, { status: 400 });
    if (error instanceof Error && error.message === "LOGIN_ID_TAKEN") return Response.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    return jsonError(error);
  }
}
