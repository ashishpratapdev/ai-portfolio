import ContactForm from "@/components/ContactForm";
import { Container, ExternalLink, PageHeader } from "@/components/ui";
import { getPublic } from "@/lib/api";

export const metadata = { title: "Contact", alternates: { canonical: "/contact" } };

export default async function Contact() {
  const profile = await getPublic("/profile");
  const links = profile?.social_links || [];
  return (
    <Container>
      <PageHeader title="Contact" intro="Tell me what you need built. I reply to every genuine inquiry." />
      {(profile?.contact_email || links.length > 0) && (
        <ul className="mt-8 space-y-3 text-lg">
          {profile.contact_email && <li>Email: <a className="underline decoration-teal decoration-2 underline-offset-4 hover:bg-mark" href={`mailto:${profile.contact_email}`}>{profile.contact_email}</a></li>}
          {links.map((l) => <li key={l.url}><ExternalLink href={l.url}>{l.label}</ExternalLink></li>)}
        </ul>
      )}
      <ContactForm />
    </Container>
  );
}
