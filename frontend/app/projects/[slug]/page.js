import { notFound } from "next/navigation";
import { Container, ExternalLink, PageHeader, Tag, TextLink } from "@/components/ui";
import { getPublic, mediaUrl } from "@/lib/api";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = await getPublic(`/projects/${encodeURIComponent(slug)}`);
  return p ? { title: p.title, description: p.summary } : { title: "Project not found" };
}

export default async function ProjectDetail({ params }) {
  const { slug } = await params;
  const p = await getPublic(`/projects/${encodeURIComponent(slug)}`);
  if (!p) notFound();
  const cover = mediaUrl(p.cover_media_id);
  return (
    <Container>
      <PageHeader title={p.title} intro={p.summary} />
      {cover && <img src={cover} alt="" className="mt-8 max-h-96 w-full border border-line object-cover" />}
      <div className="mt-8 max-w-prose whitespace-pre-line text-lg leading-relaxed">{p.description}</div>
      {p.tech?.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-2" aria-label="Technologies">{p.tech.map((t) => <li key={t}><Tag>{t}</Tag></li>)}</ul>
      )}
      <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-lg">
        {p.live_url && <ExternalLink href={p.live_url}>Live site</ExternalLink>}
        {p.repo_url && <ExternalLink href={p.repo_url}>Source code</ExternalLink>}
        <TextLink href="/projects">All projects</TextLink>
      </p>
    </Container>
  );
}
