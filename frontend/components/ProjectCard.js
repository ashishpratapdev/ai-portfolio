import Link from "next/link";
import { mediaUrl } from "@/lib/api";
import { Tag } from "./ui";

export default function ProjectCard({ p, index = 0 }) {
  const cover = mediaUrl(p.cover_media_id);
  return (
    <li className="group">
      <Link href={`/projects/${p.slug}`} className="card flex h-full flex-col !p-0 overflow-hidden hover:-translate-y-0.5">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-44 w-full object-cover" />
        ) : (
          <div className="hero-glow relative flex h-44 items-end border-b border-line p-5" aria-hidden="true">
            <span className="font-mono text-5xl font-bold text-teal/80">{String(index + 1).padStart(2, "0")}</span>
          </div>
        )}
        <div className="flex flex-1 flex-col p-6">
          <h3 className="text-2xl font-bold group-hover:text-teal">{p.title}</h3>
          <p className="mt-2 flex-1 text-muted">{p.summary}</p>
          {p.tech?.length > 0 && <ul className="mt-4 flex flex-wrap gap-2" aria-label="Technologies">{p.tech.map((t) => <li key={t}><Tag>{t}</Tag></li>)}</ul>}
        </div>
      </Link>
    </li>
  );
}
