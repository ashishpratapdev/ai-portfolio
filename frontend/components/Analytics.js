/** Optional, privacy-conscious analytics boundary. Renders nothing unless explicitly configured.
 *  Supports Plausible (cookie-less). Set NEXT_PUBLIC_PLAUSIBLE_DOMAIN (and NEXT_PUBLIC_PLAUSIBLE_SRC if self-hosting).
 *  No data is fabricated here: real numbers only ever come from the provider's own dashboard. */
export default function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;
  const src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || "https://plausible.io/js/script.js";
  return <script defer data-domain={domain} src={src} />;
}
