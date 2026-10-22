"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

const LINKS = [
  ["/admin", "Dashboard"],
  ["/admin/profile", "Profile"],
  ["/admin/skills", "Skills"],
  ["/admin/experience", "Experience"],
  ["/admin/projects", "Projects"],
  ["/admin/services", "Services"],
  ["/admin/blog", "Blog"],
  ["/admin/inquiries", "Inquiries"],
  ["/admin/ai", "AI"],
  ["/admin/media", "Media"],
  ["/admin/settings", "Settings"],
];

export default function AdminShell({ title, children }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }
  return (
    <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
      <nav aria-label="Admin" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-ink pb-3 text-sm font-medium">
        {LINKS.map(([href, label]) => <Link key={href} href={href} className="hover:underline hover:decoration-teal hover:decoration-2 hover:underline-offset-4">{label}</Link>)}
        <Link href="/" className="ml-auto text-muted hover:underline">View site</Link>
        <button onClick={logout} className="btn !py-1">Sign out</button>
      </nav>
      <h1 className="mt-8 text-3xl font-bold">{title}</h1>
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function Notice({ kind, children }) {
  if (!children) return null;
  const style = kind === "error" ? "border-red-700 bg-red-50 text-red-900" : "border-teal bg-emerald-50 text-ink";
  return <p role={kind === "error" ? "alert" : "status"} className={`mb-4 border-l-4 px-3 py-2 text-sm ${style}`}>{children}</p>;
}
