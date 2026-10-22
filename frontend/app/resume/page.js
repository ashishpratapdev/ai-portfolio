import { Container, EmptyState, PageHeader, TextLink } from "@/components/ui";
import { getPublic, resumeAvailable, resumeUrl } from "@/lib/api";
import { formatDateRange } from "@/lib/format";

export const metadata = { title: "Resume" };

export default async function Resume() {
  const [available, exp, skills] = await Promise.all([resumeAvailable(), getPublic("/experience"), getPublic("/skills")]);
  return (
    <Container>
      <PageHeader title="Resume" />
      <p className="mt-8 text-lg">
        {available ? <a className="btn btn-primary" href={resumeUrl()} download>Download PDF</a> : "A downloadable resume is not available right now."}
      </p>
      {exp?.length ? (
        <section className="mt-12" aria-labelledby="summary">
          <h2 id="summary" className="border-b border-ink pb-3 text-2xl font-semibold">Work history</h2>
          <ul className="mt-4 space-y-3">
            {exp.map((e) => (
              <li key={e.id}><span className="font-semibold">{e.role}, {e.company}</span> <span className="text-muted">({formatDateRange(e.start_date, e.end_date)})</span></li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState title="No experience published yet" />
      )}
      {skills?.length > 0 && <p className="mt-8 text-muted">Skills: {skills.map((s) => s.name).join(", ")}</p>}
      <p className="mt-8"><TextLink href="/contact">Contact me</TextLink></p>
    </Container>
  );
}
