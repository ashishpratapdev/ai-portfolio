import { Container, EmptyState, TextLink } from "@/components/ui";
import ProjectRow from "@/components/ProjectRow";
import { getPublic, mediaUrl } from "@/lib/api";

export default async function Home() {
  const [profile, projects] = await Promise.all([getPublic("/profile"), getPublic("/projects")]);
  const photo = profile?.photo_media_id ? mediaUrl(profile.photo_media_id) : null;
  return (
    <Container>
      <section className="grid items-center gap-8 pb-10 pt-14 sm:grid-cols-[1fr_auto] sm:pt-20">
        {profile ? (
          <>
            <div>
              <h1 className="text-5xl font-bold leading-[1.05] sm:text-6xl">{profile.full_name}</h1>
              <p className="mt-5 max-w-2xl text-xl leading-relaxed text-muted">{profile.headline}</p>
              <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-lg">
                <TextLink href="/projects">See my work</TextLink>
                <TextLink href="/contact">Hire me</TextLink>
              </p>
            </div>
            {photo && <img src={photo} alt={`Portrait of ${profile.full_name}`} className="h-44 w-44 border border-line object-cover sm:h-56 sm:w-56" />}
          </>
        ) : (
          <EmptyState title="Profile not published yet">
            Sign in to the admin area, fill in your profile, and publish it to see it here.
          </EmptyState>
        )}
      </section>
      <section aria-labelledby="work">
        <h2 id="work" className="border-b border-ink pb-3 text-2xl font-semibold">Selected projects</h2>
        {projects?.length ? (
          <ul>{projects.slice(0, 3).map((p) => <ProjectRow key={p.id} p={p} />)}</ul>
        ) : (
          <EmptyState title="No projects published yet" />
        )}
        {projects?.length > 3 && <p className="mt-6"><TextLink href="/projects">All projects</TextLink></p>}
      </section>
    </Container>
  );
}
