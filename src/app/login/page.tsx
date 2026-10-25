"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Step = "email" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setMessage("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(data.error ?? "发送失败，请稍后再试");
        return;
      }

      setStep("code");
      setNotice(`验证码已发到 ${email}，10 分钟内有效`);
    } catch {
      setMessage("网络异常，请稍后再试");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(data.error ?? "验证码无效或已过期");
        return;
      }

      router.replace("/me");
      router.refresh();
    } catch {
      setMessage("网络异常，请稍后再试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">登录剧荒处方</h1>
        <p className="text-sm text-neutral-500">用邮箱收一个 6 位验证码，不用记密码。</p>
      </header>

      {step === "email" ? (
        <form onSubmit={handleSend} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">邮箱</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="h-12 w-full rounded-lg border border-neutral-300 px-3 text-base outline-none focus:border-neutral-900"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="min-h-[44px] w-full rounded-lg bg-neutral-900 px-4 text-base font-medium text-white disabled:opacity-50"
          >
            {busy ? "发送中…" : "发送验证码"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">验证码</span>
            <input
              type="text"
              name="code"
              required
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              placeholder="6 位数字"
              className="h-12 w-full rounded-lg border border-neutral-300 px-3 text-center text-2xl tracking-[0.4em] outline-none focus:border-neutral-900"
            />
          </label>
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="min-h-[44px] w-full rounded-lg bg-neutral-900 px-4 text-base font-medium text-white disabled:opacity-50"
          >
            {busy ? "登录中…" : "登录"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setMessage("");
              setNotice("");
            }}
            className="min-h-[44px] w-full rounded-lg border border-neutral-300 px-4 text-sm"
          >
            换个邮箱
          </button>
        </form>
      )}

      {notice ? <p className="text-sm text-neutral-500">{notice}</p> : null}
      {message ? (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      ) : null}
    </main>
  );
}