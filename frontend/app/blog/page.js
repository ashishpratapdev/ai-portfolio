import Link from "next/link";
import { Container, EmptyState, PageHeader, Tag, TextLink } from "@/components/ui";
import { getPublic, mediaUrl } from "@/lib/api";
import { queryString } from "@/lib/seo";

export async function generateMetadata({ searchParams }) {
  const sp = await searchParams;
  const filtered = Boolean(sp.q || sp.category || sp.tag || (sp.page && sp.page !== "1"));
  return {
    title: "Blog",
    description: "Articles and notes.",
    alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/rss.xml" } },
    robots: filtered ? { index: false, follow: true } : undefined, // filtered/search/page-N views are not indexed
  };
}

export default async function Blog({ searchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const params = { q: sp.q, category: sp.category, tag: sp.tag };
  const [data, filters] = await Promise.all([
    getPublic(`/blog${queryString({ ...params, page, page_size: 10 })}`, { revalidate: 60 }),
    getPublic("/blog-filters", { revalidate: 60 }),
  ]);
  const link = (over) => `/blog${queryString({ ...params, ...over })}`;
  return (
    <Container>
      <PageHeader title="Blog" intro="Notes on things I build and learn." />
      <form action="/blog" method="get" role="search" className="mt-6 flex max-w-md gap-2">
        <label htmlFor="q" className="sr-only">Search articles</label>
        <input id="q" name="q" defaultValue={sp.q || ""} placeholder="Search articles" maxLength={100} className="field" />
        <button className="btn">Search</button>
      </form>
      {(filters?.categories?.length > 0 || filters?.tags?.length > 0) && (
        <nav aria-label="Filter articles" className="mt-4 flex flex-wrap gap-2 text-sm">
          {filters.categories.map((c) => <Link key={c.slug} href={link({ category: c.slug, page: undefined })} className="border border-ink px-2 py-0.5 hover:bg-mark">{c.name}</Link>)}
          {filters.tags.map((t) => <Link key={t.slug} href={link({ tag: t.slug, page: undefined })} className="border border-line bg-white px-2 py-0.5 hover:bg-mark">#{t.name}</Link>)}
          {(sp.q || sp.category || sp.tag) && <Link href="/blog" className="underline">Clear filters</Link>}
        </nav>
      )}
      {data?.items?.length ? (
        <ul className="mt-6">
          {data.items.map((p) => (
            <li key={p.slug} className="border-b border-line py-7">
              <h2 className="text-2xl font-semibold"><Link href={`/blog/${p.slug}`} className="hover:underline hover:decoration-teal hover:decoration-2 hover:underline-offset-4">{p.title}</Link></h2>
              <p className="mt-1 text-sm text-muted"><time dateTime={p.published_at}>{new Date(p.published_at).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "UTC" })}</time> · {p.author_name}</p>
              <p className="mt-3 max-w-prose">{p.excerpt}</p>
              {p.tags.length > 0 && <ul className="mt-3 flex flex-wrap gap-2" aria-label="Tags">{p.tags.map((t) => <li key={t}><Tag>{t}</Tag></li>)}</ul>}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={sp.q || sp.category || sp.tag ? "No articles match" : "No articles published yet"}>
          {sp.q || sp.category || sp.tag ? "Try a different search or clear the filters." : "Check back soon."}
        </EmptyState>
      )}
      {data?.pages > 1 && (
        <nav aria-label="Pagination" className="mt-8 flex items-center gap-6 text-lg">
          {page > 1 && <TextLink href={link({ page: page - 1 })}>← Newer</TextLink>}
          <span className="text-sm text-muted">Page {data.page} of {data.pages}</span>
          {page < data.pages && <TextLink href={link({ page: page + 1 })}>Older →</TextLink>}
        </nav>
      )}
      <p className="mt-10 text-sm"><a href="/blog/rss.xml" className="underline">RSS feed</a></p>
    </Container>
  );
}
