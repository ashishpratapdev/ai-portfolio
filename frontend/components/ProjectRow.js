import Link from "next/link";
import { Tag } from "./ui";

export default function ProjectRow({ p }) {
  return (
    <li className="border-b border-line py-6">
      <h3 className="text-2xl font-semibold">
        <Link href={`/projects/${p.slug}`} className="hover:underline hover:decoration-teal hover:decoration-2 hover:underline-offset-4">
          {p.title}
        </Link>
      </h3>
      <p className="mt-2 max-w-2xl text-muted">{p.summary}</p>
      {p.tech?.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Technologies">
          {p.tech.map((t) => <li key={t}><Tag>{t}</Tag></li>)}
        </ul>
      )}
    </li>
  );
}
