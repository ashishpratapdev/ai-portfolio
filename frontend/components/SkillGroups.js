import { groupBy } from "@/lib/format";
import { Tag } from "./ui";

export default function SkillGroups({ skills }) {
  const groups = groupBy(skills, "category");
  return (
    <dl className="grid gap-5 sm:grid-cols-2">
      {Object.entries(groups).map(([cat, items]) => (
        <div key={cat} className="card">
          <dt className="eyebrow mb-3">{cat}</dt>
          <dd><ul className="flex flex-wrap gap-2">{items.map((s) => <li key={s.id}><Tag>{s.name}</Tag></li>)}</ul></dd>
        </div>
      ))}
    </dl>
  );
}
