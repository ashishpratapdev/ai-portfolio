import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import Markdown from "@/components/Markdown";
import { Container, ExternalLink, Tag } from "@/components/ui";
import { getPublic, mediaUrl } from "@/lib/api";
import { absoluteUrl, jsonLd } from "@/lib/seo";

const load = (slug) => getPublic(`/blog/${encodeURIComponent(slug)}`, { revalidate: 60 });

async function followRedirect(slug) {
  const r = await getPublic(`/redirect?path=${encodeURIComponent(`/blog/${slug}`)}`);
  if (r) (r.status_code === 301 || r.status_code === 308 ? permanentRedirect : redirect)(r.to_path);
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) return { title: "Article not found", robots: { index: false } };
  const title = p.seo_title || p.title;
  const description = p.seo_description || p.excerpt;
  const image = p.cover_media_id ? mediaUrl(p.cover_media_id) : undefined;
  return {
    title, description,
    alternates: { canonical: p.canonical_url || absoluteUrl(`/blog/${p.slug}`) },
    robots: p.noindex ? { index: false, follow: true } : undefined,
    openGraph: { type: "article", title, description, url: absoluteUrl(`/blog/${p.slug}`), publishedTime: p.published_at, modifiedTime: p.updated_at, authors: [p.author_name], images: image ? [{ url: image, alt: p.cover_alt || "" }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function Post({ params }) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) {
    await followRedirect(slug);
    notFound();
  }
  const cover = p.cover_media_id ? mediaUrl(p.cover_media_id) : null;
  const ld = {
    "@context": "https://schema.org", "@type": "BlogPosting", headline: p.title, description: p.seo_description || p.excerpt,
    datePublished: p.published_at, dateModified: p.updated_at, author: { "@type": "Person", name: p.author_name },
    mainEntityOfPage: absoluteUrl(`/blog/${p.slug}`), ...(cover ? { image: cover } : {}),
  };
  return (
    <Container>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <article className="pt-12 sm:pt-16">
        <header className="border-b border-line pb-8">
          <h1 className="text-4xl font-bold sm:text-5xl">{p.title}</h1>
          <p className="mt-4 text-sm text-muted"><time dateTime={p.published_at}>{new Date(p.published_at).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "UTC" })}</time> · {p.author_name}</p>
        </header>
        {cover && <img src={cover} alt={p.cover_alt || ""} className="mt-8 max-h-96 w-full border border-line object-cover" />}
        <div className="mt-8"><Markdown source={p.body} /></div>
        {p.tags.length > 0 && <ul className="mt-8 flex flex-wrap gap-2" aria-label="Tags">{p.tags.map((t) => <li key={t}><Tag>{t}</Tag></li>)}</ul>}
        {p.source_refs.length > 0 && (
          <section className="mt-10 border-t border-line pt-6" aria-labelledby="sources">
            <h2 id="sources" className="text-xl font-semibold">Sources</h2>
            <ul className="mt-3 list-disc space-y-1 pl-6">{p.source_refs.map((s) => <li key={s.url}><ExternalLink href={s.url}>{s.title}</ExternalLink></li>)}</ul>
          </section>
        )}
      </article>
      {p.related.length > 0 && (
        <section className="mt-12 border-t border-ink pt-6" aria-labelledby="related">
          <h2 id="related" className="text-xl font-semibold">Related articles</h2>
          <ul className="mt-3 space-y-2">{p.related.map((r) => <li key={r.slug}><Link className="underline decoration-teal decoration-2 underline-offset-4 hover:bg-mark" href={`/blog/${r.slug}`}>{r.title}</Link></li>)}</ul>
        </section>
      )}
    </Container>
  );
}
