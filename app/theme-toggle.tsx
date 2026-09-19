"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/use-theme";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  return (
    <button
      type="button"
      className={`theme-toggle ${className || ""}`}
      onClick={toggleTheme}
      aria-label={isLight ? "다크 모드로 전환" : "라이트 모드로 전환"}
      title={isLight ? "다크 모드로 전환" : "라이트 모드로 전환"}
    >
      {isLight ? <Sun /> : <Moon />}
    </button>
  );
}
