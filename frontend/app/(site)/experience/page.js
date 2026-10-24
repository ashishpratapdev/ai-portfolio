import Timeline from "@/components/Timeline";
import { Container, EmptyState, PageHeader } from "@/components/ui";
import { getPublic } from "@/lib/api";

export const metadata = { title: "Experience", alternates: { canonical: "/experience" } };

export default async function Experience() {
  const items = (await getPublic("/experience")) || [];
  return (
    <>
      <PageHeader eyebrow="Experience" title="Where I've worked" intro="Full-time roles, an internship, and years of freelance work." />
      <Container className="py-14 sm:py-20">{items.length ? <Timeline items={items} /> : <EmptyState title="No experience published yet" />}</Container>
    </>
  );
}
