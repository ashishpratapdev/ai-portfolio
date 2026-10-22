const STYLE = {
  draft: "bg-white border-ink/40", in_review: "bg-amber-100 border-amber-700", approved: "bg-sky-100 border-sky-700",
  scheduled: "bg-violet-100 border-violet-700", published: "bg-emerald-100 border-teal", rejected: "bg-red-100 border-red-700",
};
export default function StateBadge({ state }) {
  return <span className={`inline-block border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${STYLE[state] || ""}`}>{state.replace("_", " ")}</span>;
}
