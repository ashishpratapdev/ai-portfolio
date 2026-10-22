import { Container, EmptyState, PageHeader, Tag } from "@/components/ui";
import { getPublic } from "@/lib/api";
import { groupBy } from "@/lib/format";

export const metadata = { title: "About" };

export default async function About() {
  const [profile, skills] = await Promise.all([getPublic("/profile"), getPublic("/skills")]);
  const groups = groupBy(skills || [], "category");
  return (
    <Container>
      <PageHeader title="About" />
      {profile ? (
        <div className="mt-8 max-w-prose whitespace-pre-line text-lg leading-relaxed">{profile.bio}</div>
      ) : (
        <EmptyState title="Profile not published yet" />
      )}
      <section aria-labelledby="skills" className="mt-14">
        <h2 id="skills" className="border-b border-ink pb-3 text-2xl font-semibold">Skills</h2>
        {Object.keys(groups).length ? (
          <dl className="mt-6 space-y-5">
            {Object.entries(groups).map(([cat, items]) => (
              <div key={cat} className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                <dt className="font-semibold">{cat}</dt>
                <dd><ul className="flex flex-wrap gap-2">{items.map((s) => <li key={s.id}><Tag>{s.name}</Tag></li>)}</ul></dd>
              </div>
            ))}
          </dl>
        ) : (
          <EmptyState title="No skills published yet" />
        )}
      </section>
    </Container>
  );
}
