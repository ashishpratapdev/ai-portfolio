import Link from "next/link";
import AdminShell from "@/components/AdminShell";

const CARDS = [
  ["/admin/profile", "Profile", "Name, headline, bio and links"],
  ["/admin/skills", "Skills", "Grouped by category"],
  ["/admin/experience", "Experience", "Roles and dates"],
  ["/admin/projects", "Projects", "Case studies with links"],
  ["/admin/services", "Services", "What you offer"],
  ["/admin/blog", "Blog", "Write, review, approve, schedule and publish articles"],
  ["/admin/inquiries", "Inquiries", "Messages from the contact form"],
  ["/admin/ai", "AI drafts", "Topics, jobs, review queue and budgets"],
  ["/admin/media", "Media", "Images and your resume PDF"],
  ["/admin/settings", "Settings", "Site title, tagline, resume"],
];

export default function Dashboard() {
  return (
    <AdminShell title="Dashboard">
      <p className="mb-6 max-w-prose text-muted">New items start as drafts. Only published items appear on the public site.</p>
      <ul className="divide-y divide-line border-y border-line">
        {CARDS.map(([href, t, d]) => (
          <li key={href}><Link href={href} className="flex flex-wrap justify-between gap-2 py-4 hover:bg-white"><span className="font-semibold">{t}</span><span className="text-muted">{d}</span></Link></li>
        ))}
      </ul>
    </AdminShell>
  );
}
