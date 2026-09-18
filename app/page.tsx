import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";
import { ForainApp } from "./forain-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();

  if (!user) {
    return (
      <main className="welcome-shell">
        <section className="welcome-card" aria-labelledby="welcome-title">
          <div className="welcome-mark" aria-hidden="true">F</div>
          <p className="eyebrow">기록이 자라는 곳</p>
          <h1 id="welcome-title">Forain</h1>
          <p>오늘의 편린을 남기면, 반복되는 활동이 나만의 결숲으로 자랍니다.</p>
          <a className="primary-link" href={chatGPTSignInPath("/")} target="_top">로그인하고 시작하기</a>
          <p className="welcome-note">처음 방문했다면 로그인 과정에서 계정이 만들어집니다.</p>
        </section>
      </main>
    );
  }

  return (
    <ForainApp
      user={{ name: user.displayName, email: user.email }}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
