"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Avatar from "./Avatar";

export const NAV = [
  ["/about", "About"], ["/experience", "Experience"], ["/projects", "Projects"], ["/services", "Services"],
  ["/blog", "Blog"], ["/resume", "Resume"],
];

export default function SiteHeader({ title, name, photo }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const active = (href) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur-md">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-teal focus:px-3 focus:py-2 focus:text-onaccent">Skip to content</a>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label={`${title}, home`}>
          <Avatar src={photo} name={name} size={40} className="ring-2 ring-teal/70" />
          <span className="font-display text-lg font-bold">{title}</span>
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1 text-sm font-medium">
            {NAV.map(([href, label]) => (
              <li key={href}>
                <Link href={href} aria-current={active(href) ? "page" : undefined} className={`rounded-full px-3 py-2 transition-colors hover:text-teal ${active(href) ? "bg-surface text-teal" : "text-muted"}`}>{label}</Link>
              </li>
            ))}
            <li><Link href="/contact" className="btn btn-primary ml-2 !py-2">Contact</Link></li>
          </ul>
        </nav>
        <button type="button" className="btn !py-2 md:hidden" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}>{open ? "Close" : "Menu"}</button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-paper md:hidden">
          <ul className="mx-auto flex max-w-6xl flex-col px-5 py-3 text-base font-medium">
            {[...NAV, ["/contact", "Contact"]].map(([href, label]) => (
              <li key={href}><Link href={href} aria-current={active(href) ? "page" : undefined} className={`block rounded-lg px-3 py-3 ${active(href) ? "bg-surface text-teal" : ""}`}>{label}</Link></li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
