import { getPublic } from "@/lib/api";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

// The API only returns eligible URLs (published, indexable). Nothing is added here.
export default async function sitemap() {
  const entries = (await getPublic("/sitemap").catch(() => [])) || [];
  return entries.map((e) => ({ url: absoluteUrl(e.path), lastModified: e.lastmod ? new Date(e.lastmod) : undefined }));
}
