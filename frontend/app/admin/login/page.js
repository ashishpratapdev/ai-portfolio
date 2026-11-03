"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/AdminShell";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
    }).catch(() => null);
    if (res?.ok) return router.push("/admin");
    const data = await res?.json().catch(() => ({}));
    setError(data?.detail || "Could not sign in. Try again. If the server was idle it can take about a minute to wake up.");
    setBusy(false);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5">
      <div className="hero-glow absolute inset-0" aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-[2rem] bg-panel p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,.8)]">
        <p className="eyebrow">Admin</p>
        <h1 className="mt-2 text-3xl font-extrabold">Sign in</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Notice kind="error">{error}</Notice>
          <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="username" className="field" /></div>
          <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" className="field" /></div>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    </main>
  );
}
