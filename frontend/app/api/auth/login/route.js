import { NextResponse } from "next/server";
import { API } from "@/lib/api";
import { COOKIE, sameOrigin } from "@/lib/server-auth";

export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request" }, { status: 400 });
  }
  const upstream = await fetch(`${API}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-IP": (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown",
      "X-Internal-Key": process.env.INTERNAL_API_KEY || "",
    },
    body: JSON.stringify({ email: body.email, password: body.password }),
  }).catch(() => null);
  if (!upstream) return NextResponse.json({ detail: "The server is unreachable. Try again shortly." }, { status: 502 });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const detail = typeof data.detail === "string" ? data.detail : "Sign-in failed. Check your email and password.";
    return NextResponse.json({ detail }, { status: upstream.status });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60,
  });
  return res;
}
