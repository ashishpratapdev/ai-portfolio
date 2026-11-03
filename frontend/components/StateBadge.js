const STYLE = {
  draft: "bg-surface border-ink/40", in_review: "bg-amber-500/15 border-amber-500/70", approved: "bg-sky-500/15 border-sky-500/70",
  scheduled: "bg-violet-500/15 border-violet-500/70", published: "bg-emerald-500/15 border-teal", rejected: "bg-red-500/15 border-red-500/70",
};
export default function StateBadge({ state }) {
  return <span className={`inline-block border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${STYLE[state] || ""}`}>{state.replace("_", " ")}</span>;
}
