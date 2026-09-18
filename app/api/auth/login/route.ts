import { authenticateUser, createSession } from "@/app/auth";
import { jsonError } from "@/lib/forain-server";

export async function POST(request: Request) {
  try {
    const input = await request.json() as { loginId?: string; password?: string };
    if (!input.loginId || !input.password) return Response.json({ error: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 });
    const result = await authenticateUser(input.loginId, input.password);
    if (result.status === "locked") {
      const minutes = Math.ceil(result.retryAfterSeconds / 60);
      return Response.json({ error: `로그인 시도가 너무 많습니다. ${minutes}분 후 다시 시도해 주세요.` }, { status: 429 });
    }
    if (result.status === "invalid") return Response.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    await createSession(result.user.userId);
    return Response.json({ user: { loginId: result.user.loginId, displayName: result.user.displayName } });
  } catch (error) { return jsonError(error); }
}
