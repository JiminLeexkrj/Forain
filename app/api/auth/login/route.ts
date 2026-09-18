import { authenticateUser, createSession } from "@/app/auth";
import { jsonError } from "@/lib/forain-server";

export async function POST(request: Request) {
  try {
    const input = await request.json() as { loginId?: string; password?: string };
    if (!input.loginId || !input.password) return Response.json({ error: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 });
    const user = await authenticateUser(input.loginId, input.password);
    if (!user) return Response.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    await createSession(user.userId);
    return Response.json({ user: { loginId: user.loginId, displayName: user.displayName } });
  } catch (error) { return jsonError(error); }
}
