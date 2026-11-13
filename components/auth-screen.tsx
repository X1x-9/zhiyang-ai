"use client";

import * as React from "react";
import { ArrowLeft, CircleAlert, Loader2, LockKeyhole, Mail } from "lucide-react";
import { signIn } from "next-auth/react";

type Mode = "login" | "register";

type AuthScreenProps = {
  onAuthenticated: () => void;
  onHome: () => void;
};

export function AuthScreen({ onAuthenticated, onHome }: AuthScreenProps) {
  const [mode, setMode] = React.useState<Mode>("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);

    if (mode === "register" && password.length < 8) {
      setError("密码至少 8 位。");
      return;
    }

    setPending(true);
    try {
      if (mode === "register") {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        if (!response.ok) throw new Error(result?.message ?? "注册失败，请稍后重试。");
      }

      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (result?.error) {
        throw new Error(mode === "register" ? "账户已创建，但自动登录失败，请手动登录。" : "邮箱或密码不正确。");
      }

      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请稍后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-decor" aria-hidden="true" />
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true" />
          <span className="auth-brand-name">智养 AI<small>WELLNESS, IN SYNC</small></span>
        </div>

        <header className="auth-head">
          <span className="auth-eyebrow">{mode === "login" ? "你的空间 · 登录" : "你的空间 · 注册"}</span>
          <h1 id="auth-title">{mode === "login" ? "欢迎回来" : "创建账户"}</h1>
          <p>{mode === "login" ? "登录后继续今天的记录。" : "用邮箱注册，记录与计划归到你的账户。"}</p>
        </header>

        <div className="auth-switch" role="tablist" aria-label="登录或注册" data-mode={mode}>
          <span className="auth-switch-thumb" aria-hidden="true" />
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "is-active" : ""} onClick={() => switchMode("login")}>登录</button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "is-active" : ""} onClick={() => switchMode("register")}>注册</button>
        </div>

        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label className="auth-field">
            <span>邮箱</span>
            <span className="auth-input">
              <Mail size={16} aria-hidden="true" />
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="you@example.com" />
            </span>
          </label>
          <label className="auth-field">
            <span>密码</span>
            <span className="auth-input">
              <LockKeyhole size={16} aria-hidden="true" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={mode === "register" ? 8 : 1}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                placeholder={mode === "register" ? "至少 8 位" : "输入密码"}
              />
            </span>
          </label>

          {error && <p className="auth-error" role="alert"><CircleAlert size={14} aria-hidden="true" />{error}</p>}

          <button type="submit" className="auth-submit" disabled={pending || !email.trim() || !password}>
            {pending ? <><Loader2 size={16} className="auth-spin" aria-hidden="true" />{mode === "register" ? "正在注册…" : "正在登录…"}</> : mode === "register" ? "注册并登录" : "登录"}
          </button>
        </form>

        <div className="auth-foot">
          <button type="button" className="auth-home" onClick={onHome}><ArrowLeft size={13} aria-hidden="true" />返回首页</button>
        </div>
      </section>
    </main>
  );
}

export function AuthCheckingScreen() {
  return (
    <main className="auth-screen is-checking" aria-busy="true">
      <div className="auth-decor" aria-hidden="true" />
      <div className="auth-checking">
        <span className="auth-brand-mark" aria-hidden="true" />
        <span>正在确认登录状态…</span>
      </div>
    </main>
  );
}
