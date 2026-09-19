import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forain | 기록이 자라는 결숲",
  description: "일기 속 활동을 발견해 나만의 결숲으로 키우는 개인 기록 서비스",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

const themeInitScript = `
try {
  var theme = window.localStorage.getItem("forain-theme");
  if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
} catch (e) {}
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head><body>{children}</body></html>;
}
