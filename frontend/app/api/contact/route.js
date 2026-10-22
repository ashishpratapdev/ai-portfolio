import { NextResponse } from "next/server";
import { API } from "@/lib/api";
import { sameOrigin } from "@/lib/server-auth";

export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request" }, { status: 400 });
  }
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const upstream = await fetch(`${API}/api/v1/public/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Client-IP": ip, "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
    body: JSON.stringify({
      name: body.name, email: body.email, subject: body.subject || null, message: body.message, website: body.website || null,
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!upstream) return NextResponse.json({ detail: "The server is unreachable. Please try again shortly." }, { status: 502 });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(upstream.ok ? { ok: true } : { detail: data.detail || "Could not send your message." }, { status: upstream.status });
}
