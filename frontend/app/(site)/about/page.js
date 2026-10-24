import Avatar from "@/components/Avatar";
import SkillGroups from "@/components/SkillGroups";
import { Container, EmptyState, PageHeader, Section } from "@/components/ui";
import { getPublic, photoSrc } from "@/lib/api";

export const metadata = { title: "About", alternates: { canonical: "/about" } };

export default async function About() {
  const [profile, skills, settings] = await Promise.all([getPublic("/profile"), getPublic("/skills"), getPublic("/settings")]);
  return (
    <>
      <PageHeader eyebrow="About" title={profile ? `Hi, I'm ${profile.full_name.split(" ")[0]}.` : "About"} intro={profile?.headline} />
      <Container className="py-14 sm:py-20">
        {profile ? (
          <div className="grid gap-12 md:grid-cols-[320px_1fr]">
            <aside className="space-y-6">
              <Avatar src={photoSrc(profile)} name={profile.full_name} size={320} fluid rounded="rounded-[2rem]" className="border border-line" />
              <dl className="card space-y-4 text-sm">
                {profile.location && <div><dt className="eyebrow mb-1">Based in</dt><dd>{profile.location}</dd></div>}
                {settings?.education && <div><dt className="eyebrow mb-1">Education</dt><dd>{settings.education}</dd></div>}
                {profile.contact_email && <div><dt className="eyebrow mb-1">Email</dt><dd><a className="text-teal underline underline-offset-4" href={`mailto:${profile.contact_email}`}>{profile.contact_email}</a></dd></div>}
              </dl>
            </aside>
            <div className="max-w-prose space-y-5 whitespace-pre-line text-lg leading-relaxed">{profile.bio}</div>
          </div>
        ) : (
          <EmptyState title="Profile not published yet" />
        )}
      </Container>
      <Section id="skills" eyebrow="Skills" title="What I work with" className="border-t border-line">
        {skills?.length ? <SkillGroups skills={skills} /> : <EmptyState title="No skills published yet" />}
      </Section>
    </>
  );
}
