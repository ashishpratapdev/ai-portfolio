import Avatar from "@/components/Avatar";
import PrintButton from "@/components/PrintButton";
import SkillGroups from "@/components/SkillGroups";
import Timeline from "@/components/Timeline";
import { ButtonLink, Container, EmptyState, ExternalLink, Section } from "@/components/ui";
import { getPublic, photoSrc, resumeAvailable, resumeUrl } from "@/lib/api";

export const metadata = { title: "Resume", alternates: { canonical: "/resume" } };

export default async function Resume() {
  const [profile, available, exp, skills, settings] = await Promise.all([
    getPublic("/profile"), resumeAvailable(), getPublic("/experience"), getPublic("/skills"), getPublic("/settings"),
  ]);
  const links = profile?.social_links || [];
  return (
    <>
      <header className="relative overflow-hidden border-b border-line">
        <div className="hero-glow absolute inset-0" aria-hidden="true" />
        <Container className="relative flex flex-col gap-8 pb-10 pt-14 sm:flex-row sm:items-center sm:pb-14 sm:pt-20">
          {profile && <Avatar src={photoSrc(profile)} name={profile.full_name} size={150} rounded="rounded-3xl" className="border border-line" priority />}
          <div className="flex-1">
            <p className="eyebrow mb-2">Resume</p>
            <h1 className="text-4xl font-extrabold sm:text-5xl">{profile?.full_name || "Resume"}</h1>
            {profile?.headline && <p className="mt-3 max-w-2xl text-lg text-muted">{profile.headline}</p>}
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {profile?.location && <li className="text-muted">{profile.location}</li>}
              {profile?.contact_email && <li><a className="text-teal underline underline-offset-4" href={`mailto:${profile.contact_email}`}>{profile.contact_email}</a></li>}
              {links.map((l) => <li key={l.url}><ExternalLink href={l.url}>{l.label}</ExternalLink></li>)}
            </ul>
            <div className="no-print mt-6 flex flex-wrap gap-3">
              {available ? <ButtonLink href={resumeUrl()} external download variant="primary">Download PDF</ButtonLink> : <PrintButton />}
              {available && <PrintButton />}
              <ButtonLink href="/contact">Contact me</ButtonLink>
            </div>
          </div>
        </Container>
      </header>
      {profile?.bio && (
        <Section id="summary" eyebrow="Summary" title="Professional summary">
          <p className="max-w-3xl text-lg leading-relaxed">{profile.bio.split("\n\n")[0]}</p>
        </Section>
      )}
      <Section id="work" eyebrow="Experience" title="Work history" className="border-t border-line">
        {exp?.length ? <Timeline items={exp} /> : <EmptyState title="No experience published yet" />}
      </Section>
      {skills?.length > 0 && <Section id="skills" eyebrow="Skills" title="Technical skills" className="border-t border-line"><SkillGroups skills={skills} /></Section>}
      {settings?.education && (
        <Section id="education" eyebrow="Education" title="Education" className="border-t border-line"><p className="text-lg">{settings.education}</p></Section>
      )}
    </>
  );
}
