"use client";

import { type ComponentProps, type FormEvent, useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AuthScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>, mode: "login" | "register") {
    event.preventDefault();
    setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "요청을 처리하지 못했습니다.");
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.");
      setBusy(false);
    }
  }

  return <main className="auth-shell"><section className="auth-card" aria-labelledby="auth-title">
    <header className="auth-brand"><img src="/forain-logo.png" alt="Forain" className="welcome-mark" /><p className="eyebrow">기록이 자라는 곳</p><h1 id="auth-title">Forain</h1><p>오늘의 편린을 남기면 나만의 결숲이 자랍니다.</p></header>
    <Tabs defaultValue="login" onValueChange={() => setError("")}>
      <TabsList className="auth-tabs"><TabsTrigger value="login">로그인</TabsTrigger><TabsTrigger value="register">회원가입</TabsTrigger></TabsList>
      <TabsContent value="login"><form className="auth-form" onSubmit={(event) => void submit(event, "login")}>
        <AuthField id="login-id" name="loginId" label="아이디" autoComplete="username" />
        <AuthField id="login-password" name="password" label="비밀번호" type="password" autoComplete="current-password" />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>{busy && <LoaderCircle className="spin" />}{busy ? "확인 중" : "로그인"}</Button>
      </form></TabsContent>
      <TabsContent value="register"><form className="auth-form" onSubmit={(event) => void submit(event, "register")}>
        <AuthField id="register-name" name="displayName" label="사용자 이름" autoComplete="name" maxLength={30} />
        <AuthField id="register-id" name="loginId" label="아이디" description="영문 소문자, 숫자, 밑줄, 하이픈으로 4~24자" autoComplete="username" pattern="[A-Za-z0-9_-]{4,24}" />
        <AuthField id="register-password" name="password" label="비밀번호" description="8자 이상 입력해 주세요" type="password" autoComplete="new-password" minLength={8} maxLength={72} />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>{busy && <LoaderCircle className="spin" />}{busy ? "계정 만드는 중" : "계정 만들기"}</Button>
      </form></TabsContent>
    </Tabs>
  </section></main>;
}

function AuthField({ id, label, description, type, ...props }: ComponentProps<typeof Input> & { id: string; label: string; description?: string }) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return <div className="auth-field">
    <Label htmlFor={id}>{label}</Label>
    <div className="auth-field-control">
      <Input id={id} required type={isPassword && visible ? "text" : type} {...props} />
      {isPassword && <button type="button" className="auth-field-toggle" onClick={() => setVisible((value) => !value)} aria-label={visible ? "비밀번호 숨기기" : "비밀번호 표시"}>{visible ? <EyeOff /> : <Eye />}</button>}
    </div>
    {description && <small>{description}</small>}
  </div>;
}
