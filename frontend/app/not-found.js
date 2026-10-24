import Link from "next/link";

export default function NotFound() {
  return (
    <div className="theme-site flex min-h-screen items-center bg-paper text-ink">
      <div className="mx-auto max-w-xl px-6 py-20">
        <p className="eyebrow">404</p>
        <h1 className="mt-3 text-5xl font-extrabold">Page not found</h1>
        <p className="mt-4 text-lg text-muted">The page may have been moved, unpublished, or never existed.</p>
        <ul className="mt-6 flex flex-wrap gap-3">
          <li><Link className="btn btn-primary" href="/">Home</Link></li>
          <li><Link className="btn" href="/projects">Projects</Link></li>
          <li><Link className="btn" href="/contact">Contact</Link></li>
        </ul>
      </div>
    </div>
  );
}
