"use client";

/** Page frame inside the shared admin layout: heading, optional right-hand actions, then content. */
export default function AdminShell({ title, subtitle, actions, children }) {
  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}

export function Notice({ kind, children }) {
  if (!children) return null;
  const style = kind === "error" ? "border-red-400/60 bg-red-500/10 text-red-200" : "border-teal/60 bg-teal/10 text-teal";
  return <p role={kind === "error" ? "alert" : "status"} className={`mb-4 rounded-lg border px-3 py-2 text-sm ${style}`}>{children}</p>;
}
