import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API } from "@/lib/api";
import { COOKIE, sameOrigin } from "@/lib/server-auth";

const SEGMENT = /^[A-Za-z0-9_-]+$/;

async function handler(req, { params }) {
  const { path } = await params;
  if (!path.every((s) => SEGMENT.test(s))) return NextResponse.json({ detail: "Bad path" }, { status: 400 });
  if (!sameOrigin(req)) return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const url = `${API}/api/v1/admin/${path.join("/")}${new URL(req.url).search}`;
  const headers = { Authorization: `Bearer ${token}` };
  const ct = req.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;
  const hasBody = !["GET", "HEAD"].includes(req.method);
  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    cache: "no-store",
  }).catch(() => null);
  if (!upstream) return NextResponse.json({ detail: "The server is unreachable." }, { status: 502 });

  const out = new Headers();
  for (const h of ["content-type", "content-disposition"]) {
    if (upstream.headers.get(h)) out.set(h, upstream.headers.get(h));
  }
  out.set("Cache-Control", "no-store");
  return new NextResponse(upstream.status === 204 ? null : await upstream.arrayBuffer(), { status: upstream.status, headers: out });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
