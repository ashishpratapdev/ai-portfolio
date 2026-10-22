import { getPublic } from "@/lib/api";
import { SITE_URL, absoluteUrl, xmlEscape } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function GET() {
  const [data, settings] = await Promise.all([getPublic("/blog?page_size=50", { revalidate: 300 }).catch(() => null), getPublic("/settings").catch(() => null)]);
  const title = settings?.site_title || "Blog";
  const items = (data?.items || []).map((p) => `
    <item>
      <title>${xmlEscape(p.title)}</title>
      <link>${xmlEscape(absoluteUrl(`/blog/${p.slug}`))}</link>
      <guid isPermaLink="true">${xmlEscape(absoluteUrl(`/blog/${p.slug}`))}</guid>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
      <description>${xmlEscape(p.excerpt)}</description>
    </item>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${xmlEscape(title)}</title>
  <link>${xmlEscape(absoluteUrl("/blog"))}</link>
  <description>${xmlEscape(settings?.tagline || `Articles from ${SITE_URL}`)}</description>${items}
</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
