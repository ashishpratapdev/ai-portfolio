import ProjectCard from "@/components/ProjectCard";
import { Container, EmptyState, PageHeader } from "@/components/ui";
import { getPublic } from "@/lib/api";

export const metadata = { title: "Projects", alternates: { canonical: "/projects" } };

export default async function Projects() {
  const projects = (await getPublic("/projects")) || [];
  return (
    <>
      <PageHeader eyebrow="Projects" title="Things I've built" />
      <Container className="py-14 sm:py-20">
        {projects.length ? <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{projects.map((p, i) => <ProjectCard key={p.id} p={p} index={i} />)}</ul> : <EmptyState title="No projects published yet" />}
      </Container>
    </>
  );
}
