import { getSessionUser } from "./auth";
import { AuthScreen } from "./auth-screen";
import { ForainApp } from "./forain-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();

  if (!user) return <AuthScreen />;

  return <ForainApp user={{ name: user.displayName, loginId: user.loginId }} />;
}
