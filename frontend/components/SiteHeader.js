import Link from "next/link";
import { Container } from "./ui";

const NAV = [
  ["/about", "About"],
  ["/experience", "Experience"],
  ["/projects", "Projects"],
  ["/services", "Services"],
  ["/blog", "Blog"],
  ["/resume", "Resume"],
  ["/contact", "Contact"],
];

export default function SiteHeader({ title }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:bg-mark focus:p-2">
        Skip to content
      </a>
      <Container className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
        <Link href="/" className="font-display text-lg font-bold">{title}</Link>
        <nav aria-label="Main">
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium">
            {NAV.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="py-1 hover:underline hover:decoration-teal hover:decoration-2 hover:underline-offset-4">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </header>
  );
}
