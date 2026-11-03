"use client";
import { donutArcs, niceMax, smoothPath } from "@/lib/dashboard";

const LIME = "rgb(var(--c-accent))";
const TEAL = "#2DD4BF";
const GRID = "rgb(var(--c-line))";
const TEXT = "rgb(var(--c-muted))";

export function Legend({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => <li key={i.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} aria-hidden="true" />{i.label}</li>)}
    </ul>
  );
}

/** Two-tone stacked bars per month. rows: [{label, a, b}] */
export function BarChart({ rows, aLabel, bLabel, ariaLabel }) {
  const W = 320, H = 200, L = 30, B = 26, T = 10, R = 8;
  const max = niceMax(Math.max(0, ...rows.map((r) => r.a + r.b)));
  const ih = H - T - B, step = (W - L - R) / rows.length, bw = Math.min(20, step * 0.45);
  const y = (v) => T + ih - (v / max) * ih;
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max].map((v) => Math.round(v * 10) / 10);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-auto w-full">
        <title>{ariaLabel}</title>
        {ticks.map((t) => (
          <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={GRID} strokeDasharray="3 4" /><text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill={TEXT}>{t}</text></g>
        ))}
        {rows.map((r, i) => {
          const cx = L + step * i + step / 2, hb = (r.b / max) * ih, ha = (r.a / max) * ih;
          return (
            <g key={r.label}>
              {r.b > 0 && <rect x={cx - bw / 2} y={y(r.b)} width={bw} height={hb} rx="3" fill={TEAL} />}
              {r.a > 0 && <rect x={cx - bw / 2} y={y(r.a + r.b)} width={bw} height={ha} rx="3" fill={LIME} />}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="9" fill={TEXT}>{r.label}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2"><Legend items={[{ label: aLabel, color: LIME }, { label: bLabel, color: TEAL }]} /></figcaption>
    </figure>
  );
}

/** Donut with centre label. segments: [{label, value, color}] */
export function DonutChart({ segments, center, ariaLabel }) {
  const r = 52, c = 2 * Math.PI * r;
  const arcs = donutArcs(segments, c);
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <figure className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 140 140" role="img" aria-label={ariaLabel} className="h-44 w-44">
        <title>{ariaLabel}</title>
        <circle cx="70" cy="70" r={r} fill="none" stroke={GRID} strokeWidth="18" />
        {total > 0 && arcs.map((a) => a.dash > 0 && (
          <circle key={a.label} cx="70" cy="70" r={r} fill="none" stroke={a.color} strokeWidth="18" strokeDasharray={`${a.dash} ${c - a.dash}`} strokeDashoffset={a.offset} transform="rotate(-90 70 70)" />
        ))}
        <text x="70" y="68" textAnchor="middle" fontSize="20" fontWeight="700" fill="rgb(var(--c-ink))">{total}</text>
        <text x="70" y="84" textAnchor="middle" fontSize="9" fill={TEXT}>{center}</text>
      </svg>
      <figcaption><ul className="space-y-1 text-sm">
        {arcs.map((a) => <li key={a.label} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} aria-hidden="true" /><span className="text-muted">{a.label}</span><span className="ml-auto pl-4 font-mono text-xs">{a.value} · {a.pct}%</span></li>)}
      </ul></figcaption>
    </figure>
  );
}

/** Smooth two-series line chart with a bubble on the first series' peak. series: [{name,color,values}] */
export function LineChart({ labels, series, unit, ariaLabel }) {
  const W = 520, H = 220, L = 30, B = 26, T = 18, R = 12;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const ih = H - T - B, iw = W - L - R;
  const x = (i) => L + (labels.length === 1 ? iw / 2 : (iw * i) / (labels.length - 1));
  const y = (v) => T + ih - (v / max) * ih;
  const pts = (s) => s.values.map((v, i) => ({ x: x(i), y: y(v) }));
  const first = series[0];
  const peak = first.values.reduce((bi, v, i, a) => (v > a[bi] ? i : bi), 0);
  const base = T + ih;
  const area = `${smoothPath(pts(first), T, base)} L${x(labels.length - 1)},${base} L${x(0)},${base} Z`;
  const bubble = first.values[peak] > 0;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-auto w-full">
        <title>{ariaLabel}</title>
        <defs><linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={LIME} stopOpacity="0.28" /><stop offset="1" stopColor={LIME} stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2, 3, 4].map((k) => { const v = (max * k) / 4; return <g key={k}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={GRID} strokeDasharray="3 4" /><text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill={TEXT}>{Math.round(v * 10) / 10}</text></g>; })}
        {labels.map((l, i) => <text key={l + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill={TEXT}>{l}</text>)}
        <path d={area} fill="url(#area-fill)" />
        {series.map((s) => <path key={s.name} d={smoothPath(pts(s), T, base)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" />)}
        {bubble && (
          <g>
            <line x1={x(peak)} x2={x(peak)} y1={y(first.values[peak])} y2={base} stroke={first.color} strokeDasharray="3 3" opacity="0.6" />
            <circle cx={x(peak)} cy={y(first.values[peak])} r="5" fill="rgb(var(--c-paper))" stroke={first.color} strokeWidth="2.5" />
            <g transform={`translate(${Math.min(Math.max(x(peak), L + 36), W - R - 36)} ${Math.max(y(first.values[peak]) - 34, 2)})`}>
              <rect x="-36" width="72" height="24" rx="8" fill="rgb(var(--c-ink))" />
              <text y="11" textAnchor="middle" fontSize="10" fontWeight="700" fill="rgb(var(--c-paper))">{first.values[peak]}</text>
              <text y="20" textAnchor="middle" fontSize="7" fill="rgb(var(--c-paper))">{unit}</text>
            </g>
          </g>
        )}
      </svg>
      <figcaption className="mt-2"><Legend items={series.map((s) => ({ label: s.name, color: s.color }))} /></figcaption>
    </figure>
  );
}
