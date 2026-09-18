import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forain | 기록이 자라는 결숲",
  description: "일기 속 활동을 발견해 나만의 결숲으로 키우는 개인 기록 서비스",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
