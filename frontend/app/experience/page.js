import { Container, EmptyState, PageHeader } from "@/components/ui";
import { getPublic } from "@/lib/api";
import { formatDateRange } from "@/lib/format";

export const metadata = { title: "Experience" };

export default async function Experience() {
  const items = (await getPublic("/experience")) || [];
  return (
    <Container>
      <PageHeader title="Experience" />
      {items.length ? (
        <ol className="mt-4">
          {items.map((e) => (
            <li key={e.id} className="grid gap-2 border-b border-line py-8 sm:grid-cols-[11rem_1fr]">
              <p className="text-sm text-muted">{formatDateRange(e.start_date, e.end_date)}</p>
              <div>
                <h2 className="text-xl font-semibold">{e.role}, {e.company}</h2>
                {e.location && <p className="text-sm text-muted">{e.location}</p>}
                <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed">{e.description}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="No experience published yet" />
      )}
    </Container>
  );
}
