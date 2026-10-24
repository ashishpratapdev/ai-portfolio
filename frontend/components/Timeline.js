import { formatDateRange, splitBullets } from "@/lib/format";

export default function Timeline({ items }) {
  return (
    <ol className="relative ml-2 border-l border-line">
      {items.map((e) => {
        const { intro, bullets } = splitBullets(e.description);
        const current = !e.end_date;
        return (
          <li key={e.id} className="relative pb-10 pl-8 last:pb-0">
            <span aria-hidden="true" className={`absolute -left-[7px] top-2 h-3.5 w-3.5 rounded-full border-2 border-paper ${current ? "bg-teal ring-4 ring-teal/25" : "bg-muted"}`} />
            <p className="font-mono text-xs uppercase tracking-widest text-teal">{formatDateRange(e.start_date, e.end_date)}</p>
            <h3 className="mt-1 text-xl font-bold sm:text-2xl">{e.role}</h3>
            <p className="text-muted">{e.company}{e.location ? ` · ${e.location}` : ""}</p>
            {intro && <p className="mt-3 max-w-prose leading-relaxed">{intro}</p>}
            {bullets.length > 0 && (
              <ul className="mt-3 max-w-prose list-disc space-y-1.5 pl-5 leading-relaxed marker:text-teal">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
