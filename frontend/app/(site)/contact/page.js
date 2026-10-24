import Avatar from "@/components/Avatar";
import ContactForm from "@/components/ContactForm";
import { Container, ExternalLink, PageHeader } from "@/components/ui";
import { getPublic, photoSrc } from "@/lib/api";

export const metadata = { title: "Contact", alternates: { canonical: "/contact" } };

export default async function Contact() {
  const profile = await getPublic("/profile");
  const links = profile?.social_links || [];
  return (
    <>
      <PageHeader eyebrow="Contact" title="Let's talk" intro="Tell me what you need built. I reply to every genuine inquiry." />
      <Container className="grid gap-12 py-14 sm:py-20 md:grid-cols-[1fr_1.2fr]">
        <aside className="space-y-6">
          {profile && (
            <div className="flex items-center gap-5">
              <Avatar src={photoSrc(profile)} name={profile.full_name} size={110} rounded="rounded-3xl" className="border border-line" />
              <div><p className="font-display text-2xl font-bold">{profile.full_name}</p>{profile.location && <p className="text-muted">{profile.location}</p>}</div>
            </div>
          )}
          <ul className="space-y-3 text-lg">
            {profile?.contact_email && <li><span className="eyebrow mr-3">Email</span><a className="text-teal underline decoration-teal/40 underline-offset-4 hover:decoration-teal" href={`mailto:${profile.contact_email}`}>{profile.contact_email}</a></li>}
            {links.map((l) => <li key={l.url}><span className="eyebrow mr-3">Web</span><ExternalLink href={l.url}>{l.label}</ExternalLink></li>)}
          </ul>
        </aside>
        <ContactForm />
      </Container>
    </>
  );
}
