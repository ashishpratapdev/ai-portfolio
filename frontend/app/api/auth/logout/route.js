import { NextResponse } from "next/server";
import { COOKIE, sameOrigin } from "@/lib/server-auth";

export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
