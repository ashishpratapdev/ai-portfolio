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
    setError(data?.detail || "Could not sign in. Try again.");
    setBusy(false);
  }

  return (
    <main className="mx-auto mt-24 max-w-sm px-5">
      <h1 className="text-3xl font-bold">Admin sign in</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Notice kind="error">{error}</Notice>
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="username" className="field" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" className="field" /></div>
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
