"use client";

import * as React from "react";
import { LogIn, LogOut, UserRound, X } from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import type { ProfileResponse } from "@/lib/profile-client";

type Mode = "login" | "register";

type AccountPanelProps = {
  data?: ProfileResponse;
  loading: boolean;
  onChanged: () => void;
  compact?: boolean;
};

export function AccountPanel({ data, loading, onChanged, compact = false }: AccountPanelProps) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const authenticated = Boolean(data?.authenticated);
  const demo = Boolean(data?.demo);
  const displayName = data?.displayName || (authenticated ? "已登录" : demo ? "演示沙盒" : "登录");
  const initial = displayName.slice(0, 1) || "你";

  const resetForm = () => {
    setPassword("");
    setError(null);
  };

  const closeDialog = React.useCallback(() => {
    setOpen(false);
    setPassword("");
    setError(null);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, closeDialog]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);

    if (mode === "register") {
      if (!name.trim()) {
        setError("请填写一个称呼。");
        return;
      }
      if (password.length < 8) {
        setError("密码至少 8 位。");
        return;
      }
    }

    setPending(true);
    try {
      if (mode === "register") {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
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

      setOpen(false);
      setPassword("");
      setError(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请稍后重试。");
    } finally {
      setPending(false);
    }
  }

  async function handleSignOut() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await signOut({ redirect: false });
      closeDialog();
      onChanged();
    } catch {
      setError("退出失败，请稍后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`account-trigger${compact ? " is-compact" : ""}${authenticated ? " is-authenticated" : ""}`}
        onClick={() => { setOpen(true); resetForm(); }}
        aria-haspopup="dialog"
        aria-label={authenticated ? `账户 ${data?.account?.email ?? displayName}` : demo ? "演示沙盒，登录以保存数据" : "登录或注册"}
      >
        <span className="account-avatar">{authenticated ? initial : demo ? "演" : <UserRound size={15} aria-hidden="true" />}</span>
        {!compact && (
          <span className="account-copy">
            <strong>{loading ? "读取账户…" : authenticated ? displayName : demo ? "登录 / 注册" : "登录"}</strong>
            <small>{authenticated ? data?.account?.email ?? "" : demo ? "演示沙盒" : "保存你的记录"}</small>
          </span>
        )}
      </button>

      {open && (
        <div className="account-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <div className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
            <button type="button" className="account-close" onClick={closeDialog} aria-label="关闭账户面板">
              <X size={16} />
            </button>

            {authenticated ? (
              <div className="account-signed">
                <span className="account-badge"><UserRound size={16} aria-hidden="true" />已登录</span>
                <h2 id="account-title">{displayName}</h2>
                <p className="account-email">{data?.account?.email}</p>
                <p className="account-hint">资料与餐食保存在账户下。</p>
                {error && <p className="account-error" role="alert">{error}</p>}
                <button type="button" className="account-submit is-ghost" disabled={pending} onClick={() => void handleSignOut()}>
                  <LogOut size={15} aria-hidden="true" />{pending ? "正在退出…" : "退出登录"}
                </button>
              </div>
            ) : (
              <form className="account-form" onSubmit={(event) => void submit(event)}>
                <span className="account-badge"><LogIn size={15} aria-hidden="true" />{demo ? "登录后保存你的数据" : "登录智养 AI"}</span>
                <h2 id="account-title">{mode === "login" ? "欢迎回来" : "创建账户"}</h2>
                <p className="account-hint">
                  {demo
                    ? "数据只保存在当前浏览器；登录后切到你的账户。"
                    : "记录与计划归到你的账户。"}
                </p>

                <div className="account-tabs" role="tablist" aria-label="登录或注册">
                  <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(null); }}>登录</button>
                  <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(null); }}>注册</button>
                </div>

                {mode === "register" && (
                  <label className="account-field">
                    <span>称呼</span>
                    <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} autoComplete="nickname" placeholder="例如：小林" />
                  </label>
                )}
                <label className="account-field">
                  <span>邮箱</span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="you@example.com" />
                </label>
                <label className="account-field">
                  <span>密码</span>
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === "register" ? 8 : 1} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder={mode === "register" ? "至少 8 位" : "输入密码"} />
                </label>

                {error && <p className="account-error" role="alert">{error}</p>}

                <button type="submit" className="account-submit" disabled={pending || !email.trim() || !password}>
                  {pending ? "请稍候…" : mode === "register" ? "注册并登录" : "登录"}
                </button>
                <p className="account-fineprint">密码仅保存加密哈希。</p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
