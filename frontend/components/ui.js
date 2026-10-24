import Link from "next/link";

export function Container({ children, className = "" }) {
  return <div className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>{children}</div>;
}

export function PageHeader({ title, intro, eyebrow }) {
  return (
    <header className="relative overflow-hidden border-b border-line">
      <div className="hero-glow absolute inset-0" aria-hidden="true" />
      <Container className="relative pb-10 pt-14 sm:pb-14 sm:pt-20">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="text-4xl font-extrabold leading-tight sm:text-6xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{intro}</p>}
      </Container>
    </header>
  );
}

export function Section({ id, eyebrow, title, action, children, className = "" }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className={`py-14 sm:py-20 ${className}`}>
      <Container>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
            <h2 id={id ? `${id}-h` : undefined} className="text-3xl font-bold sm:text-4xl">{title}</h2>
          </div>
          {action}
        </div>
        {children}
      </Container>
    </section>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="my-6 rounded-2xl border border-dashed border-line p-8" role="status">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <p className="mt-2 max-w-xl text-muted">{children}</p>}
    </div>
  );
}

export function Tag({ children }) {
  return <span className="chip">{children}</span>;
}

export function ExternalLink({ href, children, className = "" }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`font-medium text-teal underline decoration-teal/40 decoration-2 underline-offset-4 hover:decoration-teal ${className}`}>
      {children}
    </a>
  );
}

export function TextLink({ href, children, className = "" }) {
  return (
    <Link href={href} className={`font-medium text-teal underline decoration-teal/40 decoration-2 underline-offset-4 hover:decoration-teal ${className}`}>
      {children}
    </Link>
  );
}

export function ButtonLink({ href, children, variant = "ghost", external = false, ...rest }) {
  const cls = `btn ${variant === "primary" ? "btn-primary" : ""}`;
  return external ? <a href={href} className={cls} {...rest}>{children}</a> : <Link href={href} className={cls} {...rest}>{children}</Link>;
}
