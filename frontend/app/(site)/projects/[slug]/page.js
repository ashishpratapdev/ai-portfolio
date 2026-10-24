import { notFound } from "next/navigation";
import { ButtonLink, Container, PageHeader, Tag } from "@/components/ui";
import { getPublic, mediaUrl } from "@/lib/api";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = await getPublic(`/projects/${encodeURIComponent(slug)}`);
  return p ? { title: p.title, description: p.summary, alternates: { canonical: `/projects/${p.slug}` } } : { title: "Project not found" };
}

export default async function ProjectDetail({ params }) {
  const { slug } = await params;
  const p = await getPublic(`/projects/${encodeURIComponent(slug)}`);
  if (!p) notFound();
  const cover = mediaUrl(p.cover_media_id);
  return (
    <>
      <PageHeader eyebrow="Project" title={p.title} intro={p.summary} />
      <Container className="py-14 sm:py-20">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="mb-10 max-h-[28rem] w-full rounded-2xl border border-line object-cover" />
        )}
        <div className="max-w-prose whitespace-pre-line text-lg leading-relaxed">{p.description}</div>
        {p.tech?.length > 0 && <ul className="mt-8 flex flex-wrap gap-2" aria-label="Technologies">{p.tech.map((t) => <li key={t}><Tag>{t}</Tag></li>)}</ul>}
        <div className="mt-10 flex flex-wrap gap-3">
          {p.live_url && <ButtonLink href={p.live_url} external variant="primary" target="_blank" rel="noopener noreferrer">View live site</ButtonLink>}
          {p.repo_url && <ButtonLink href={p.repo_url} external target="_blank" rel="noopener noreferrer">Source code</ButtonLink>}
          <ButtonLink href="/projects">All projects</ButtonLink>
        </div>
      </Container>
    </>
  );
}
