import Link from "next/link";

export function Container({ children, className = "" }) {
  return <div className={`mx-auto w-full max-w-5xl px-5 sm:px-8 ${className}`}>{children}</div>;
}

export function PageHeader({ title, intro }) {
  return (
    <header className="border-b border-line pb-8 pt-12 sm:pt-16">
      <h1 className="text-4xl font-bold sm:text-5xl">{title}</h1>
      {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{intro}</p>}
    </header>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="my-10 border border-dashed border-ink/30 p-8" role="status">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <p className="mt-2 max-w-xl text-muted">{children}</p>}
    </div>
  );
}

export function Tag({ children }) {
  return <span className="inline-block border border-line bg-white px-2 py-0.5 text-sm">{children}</span>;
}

export function ExternalLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-teal decoration-2 underline-offset-4 hover:bg-mark">
      {children}
    </a>
  );
}

export function TextLink({ href, children }) {
  return (
    <Link href={href} className="underline decoration-teal decoration-2 underline-offset-4 hover:bg-mark">
      {children}
    </Link>
  );
}
