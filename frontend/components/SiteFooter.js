import Link from "next/link";
import Avatar from "./Avatar";
import { Container, ExternalLink } from "./ui";

const LINKS = [["/about", "About"], ["/experience", "Experience"], ["/projects", "Projects"], ["/services", "Services"], ["/blog", "Blog"], ["/resume", "Resume"], ["/contact", "Contact"]];

export default function SiteFooter({ name, photo, profile, footerText }) {
  const links = profile?.social_links || [];
  return (
    <footer className="no-print mt-10 border-t border-line">
      <section className="relative overflow-hidden border-b border-line" aria-labelledby="cta-h">
        <div className="hero-glow absolute inset-0" aria-hidden="true" />
        <Container className="relative flex flex-col items-start gap-8 py-14 sm:flex-row sm:items-center sm:justify-between sm:py-20">
          <div className="flex items-center gap-5">
            <Avatar src={photo} name={name} size={84} className="ring-4 ring-teal/60" />
            <div>
              <h2 id="cta-h" className="text-3xl font-extrabold sm:text-4xl">Have a project in mind?</h2>
              <p className="mt-2 max-w-md text-muted">Tell me what you need built and I will get back to you.</p>
            </div>
          </div>
          <Link href="/contact" className="btn btn-primary !px-7 !py-3 text-base">Start a conversation</Link>
        </Container>
      </section>
      <Container className="grid gap-8 py-10 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="font-display text-lg font-bold">{name}</p>
          {profile?.location && <p className="mt-1 text-sm text-muted">{profile.location}</p>}
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {profile?.contact_email && <li><a className="text-teal underline decoration-teal/40 underline-offset-4 hover:decoration-teal" href={`mailto:${profile.contact_email}`}>{profile.contact_email}</a></li>}
            {links.map((l) => <li key={l.url}><ExternalLink href={l.url}>{l.label}</ExternalLink></li>)}
          </ul>
        </div>
        <nav aria-label="Footer"><ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted sm:max-w-xs sm:justify-end">
          {LINKS.map(([href, label]) => <li key={href}><Link href={href} className="hover:text-teal">{label}</Link></li>)}
        </ul></nav>
        {footerText && <p className="text-xs text-muted sm:col-span-2">{footerText}</p>}
      </Container>
    </footer>
  );
}
