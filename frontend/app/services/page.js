import { Container, EmptyState, PageHeader, TextLink } from "@/components/ui";
import { getPublic } from "@/lib/api";

export const metadata = { title: "Services" };

export default async function Services() {
  const items = (await getPublic("/services")) || [];
  return (
    <Container>
      <PageHeader title="Services" intro="What I can build or fix for you." />
      {items.length ? (
        <ul className="mt-4">
          {items.map((s) => (
            <li key={s.id} className="border-b border-line py-8">
              <h2 className="text-2xl font-semibold">{s.title}</h2>
              <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed">{s.description}</p>
              {s.price_note && <p className="mt-2 text-sm text-muted">{s.price_note}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No services published yet" />
      )}
      <p className="mt-8 text-lg"><TextLink href="/contact">Discuss your project</TextLink></p>
    </Container>
  );
}
