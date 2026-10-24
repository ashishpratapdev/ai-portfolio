import Avatar from "@/components/Avatar";
import ProjectCard from "@/components/ProjectCard";
import SkillGroups from "@/components/SkillGroups";
import Timeline from "@/components/Timeline";
import { ButtonLink, Container, EmptyState, Section, Tag, TextLink } from "@/components/ui";
import { getPublic, photoSrc, resumeAvailable, resumeUrl } from "@/lib/api";
import { splitTagline } from "@/lib/format";

export default async function Home() {
  const [profile, projects, skills, experience, services, settings, hasResume] = await Promise.all([
    getPublic("/profile"), getPublic("/projects"), getPublic("/skills"), getPublic("/experience"), getPublic("/services"),
    getPublic("/settings"), resumeAvailable(),
  ]);
  const { role, tech } = splitTagline(settings?.tagline);
  const firstPara = profile?.bio?.split("\n\n")[0];

  return (
    <>
      <section className="relative overflow-hidden border-b border-line" aria-labelledby="hero-h">
        <div className="hero-glow absolute inset-0" aria-hidden="true" />
        <div className="grid-bg absolute inset-0" aria-hidden="true" />
        <Container className="relative grid items-center gap-12 py-16 md:grid-cols-[1.25fr_0.75fr] md:py-28">
          {profile ? (
            <>
              <div>
                {(role || profile.location) && <p className="eyebrow mb-5">{[role, profile.location].filter(Boolean).join(" · ")}</p>}
                <h1 id="hero-h" className="text-5xl font-extrabold leading-[1.02] sm:text-7xl">{profile.full_name}<span className="text-teal">.</span></h1>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">{profile.headline}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <ButtonLink href="/projects" variant="primary">View my work</ButtonLink>
                  <ButtonLink href="/contact">Contact me</ButtonLink>
                  {hasResume && <ButtonLink href={resumeUrl()} external download>Download resume</ButtonLink>}
                </div>
                {tech.length > 0 && <ul className="mt-8 flex max-w-xl flex-wrap gap-2" aria-label="Core technologies">{tech.map((t) => <li key={t}><Tag>{t}</Tag></li>)}</ul>}
              </div>
              <div className="relative mx-auto w-full max-w-xs md:max-w-none">
                <div className="absolute -right-3 -top-3 h-full w-full rounded-[2rem] border-2 border-teal/70" aria-hidden="true" />
                <Avatar src={photoSrc(profile)} name={profile.full_name} size={420} fluid rounded="rounded-[2rem]" priority className="relative border border-line" />
              </div>
            </>
          ) : (
            <div className="md:col-span-2"><EmptyState title="Profile not published yet">Sign in to the admin area, complete your profile, and publish it.</EmptyState></div>
          )}
        </Container>
      </section>

      {firstPara && (
        <Section id="about" eyebrow="01 · About" title="A little about me" action={<TextLink href="/about">Read more</TextLink>}>
          <p className="max-w-3xl text-lg leading-relaxed sm:text-xl">{firstPara}</p>
        </Section>
      )}

      {skills?.length > 0 && (
        <Section id="skills" eyebrow="02 · Skills" title="Tools I work with" className="border-t border-line"><SkillGroups skills={skills} /></Section>
      )}

      {experience?.length > 0 && (
        <Section id="experience" eyebrow="03 · Experience" title="Where I've worked" action={<TextLink href="/experience">Full history</TextLink>} className="border-t border-line">
          <Timeline items={experience.slice(0, 3)} />
        </Section>
      )}

      <Section id="projects" eyebrow="04 · Projects" title="Selected work" action={projects?.length > 3 ? <TextLink href="/projects">All projects</TextLink> : null} className="border-t border-line">
        {projects?.length ? <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{projects.slice(0, 3).map((p, i) => <ProjectCard key={p.id} p={p} index={i} />)}</ul> : <EmptyState title="No projects published yet" />}
      </Section>

      {services?.length > 0 && (
        <Section id="services" eyebrow="05 · Services" title="How I can help" action={<TextLink href="/services">Details</TextLink>} className="border-t border-line">
          <ul className="grid gap-6 md:grid-cols-3">
            {services.map((s, i) => (
              <li key={s.id} className="card">
                <p className="font-mono text-sm text-teal">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-3 text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-muted">{s.description}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
