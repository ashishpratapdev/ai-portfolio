import { ButtonLink, Container, EmptyState, PageHeader } from "@/components/ui";
import { getPublic } from "@/lib/api";

export const metadata = { title: "Services", alternates: { canonical: "/services" } };

export default async function Services() {
  const items = (await getPublic("/services")) || [];
  return (
    <>
      <PageHeader eyebrow="Services" title="How I can help" intro="What I can build or fix for you." />
      <Container className="py-14 sm:py-20">
        {items.length ? (
          <ul className="grid gap-6 md:grid-cols-3">
            {items.map((s, i) => (
              <li key={s.id} className="card flex flex-col">
                <p className="font-mono text-sm text-teal">{String(i + 1).padStart(2, "0")}</p>
                <h2 className="mt-3 text-2xl font-bold">{s.title}</h2>
                <p className="mt-3 flex-1 whitespace-pre-line leading-relaxed text-muted">{s.description}</p>
                {s.price_note && <p className="mt-4 font-mono text-xs text-teal">{s.price_note}</p>}
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No services published yet" />}
        <div className="mt-10"><ButtonLink href="/contact" variant="primary">Discuss your project</ButtonLink></div>
      </Container>
    </>
  );
}
