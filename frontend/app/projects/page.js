import { Container, EmptyState, PageHeader } from "@/components/ui";
import ProjectRow from "@/components/ProjectRow";
import { getPublic } from "@/lib/api";

export const metadata = { title: "Projects" };

export default async function Projects() {
  const projects = (await getPublic("/projects")) || [];
  return (
    <Container>
      <PageHeader title="Projects" />
      {projects.length ? <ul>{projects.map((p) => <ProjectRow key={p.id} p={p} />)}</ul> : <EmptyState title="No projects published yet" />}
    </Container>
  );
}
