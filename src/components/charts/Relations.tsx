import { useEffect, useMemo, useState } from 'react';
import { chord as d3chord, ribbon as d3ribbon } from 'd3-chord';
import { arc } from 'd3-shape';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationNodeDatum } from 'd3-force';
import cloud from 'd3-cloud';
import { useSize } from '../ui/hooks';
import { tipProps } from '../ui/tip';
import { fmtInt, fmtPct } from '../../lib/format';
import type { SeriesDef } from './Svg';

/* ----------------------------------------------------------------------------
   Chord — who replies to whom. Ribbon width = replies in each direction.
   -------------------------------------------------------------------------- */
export function Chord({ matrix, series }: { matrix: number[][]; series: SeriesDef[] }) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [focus, setFocus] = useState<number | null>(null);
  const size = Math.min(width, 460);
  // Leave room around the ring for horizontal name labels.
  const outer = Math.max(60, size / 2 - 78);
  const inner = outer - 12;
  const chords = useMemo(() => d3chord().padAngle(0.05).sortSubgroups((a, b) => b - a)(matrix), [matrix]);
  const groupArc = arc<{ startAngle: number; endAngle: number }>().innerRadius(inner).outerRadius(outer).cornerRadius(3);
  const ribbon = d3ribbon<unknown, { startAngle: number; endAngle: number; radius?: number }>().radius(inner - 2);
  const totals = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  return (
    <div className="chart" ref={ref} style={{ height: size || 300, display: 'grid', placeItems: 'center' }}>
      {size > 0 && (
        <svg width={size} height={size} role="img" aria-label="Chord diagram of who replies to whom">
          <g transform={`translate(${size / 2},${size / 2})`}>
            <g>
              {chords.map((c, i) => {
                const active = focus === null || focus === c.source.index || focus === c.target.index;
                const s = c.source.index;
                const t = c.target.index;
                return (
                  <path
                    key={i}
                    d={(ribbon(c as never) as unknown as string) ?? ''}
                    fill={series[s].color}
                    fillOpacity={active ? 0.62 : 0.06}
                    stroke="rgba(10,10,12,0.8)"
                    strokeWidth={0.8}
                    style={{ transition: 'fill-opacity .2s' }}
                    {...tipProps({
                      title: `${series[s].name} ⇄ ${series[t].name}`,
                      rows: [
                        { label: `${series[s].name} → ${series[t].name}`, value: fmtInt(matrix[s][t]), color: series[s].color, mark: 'box' },
                        { label: `${series[t].name} → ${series[s].name}`, value: fmtInt(matrix[t][s]), color: series[t].color, mark: 'box' },
                      ],
                    })}
                  />
                );
              })}
            </g>
            {chords.groups.map((g) => {
              const mid = (g.startAngle + g.endAngle) / 2;
              const lx = Math.sin(mid) * (outer + 12);
              const ly = -Math.cos(mid) * (outer + 12);
              const anchor = lx > 8 ? 'start' : lx < -8 ? 'end' : 'middle';
              const t = tipProps({
                title: series[g.index].name,
                rows: [{ label: 'Replies sent', value: fmtInt(totals[g.index]), color: series[g.index].color, mark: 'box' }],
              });
              return (
                <g
                  key={g.index}
                  onPointerEnter={(e) => {
                    setFocus(g.index);
                    t.onPointerEnter(e);
                  }}
                  onPointerMove={t.onPointerMove}
                  onPointerLeave={() => {
                    setFocus(null);
                    t.onPointerLeave();
                  }}
                >
                  <path d={groupArc(g) ?? ''} fill={series[g.index].color} />
                  <text
                    className="chart-label"
                    x={lx}
                    y={ly}
                    textAnchor={anchor}
                    dy={ly > outer * 0.6 ? '0.9em' : ly < -outer * 0.6 ? '-0.25em' : '0.35em'}
                    style={{ fill: 'var(--ink)' }}
                  >
                    {series[g.index].name.length > 12 ? series[g.index].name.slice(0, 11) + '…' : series[g.index].name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Network — people as nodes, conversations as links.
   -------------------------------------------------------------------------- */
interface NetNode extends SimulationNodeDatum {
  i: number;
  r: number;
}

export function Network({
  nodes,
  links,
  series,
}: {
  nodes: { i: number; value: number }[];
  links: { a: number; b: number; value: number }[];
  series: SeriesDef[];
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const height = 340;
  const layout = useMemo(() => {
    if (width === 0) return null;
    const maxV = Math.max(1, ...nodes.map((n) => n.value));
    const maxL = Math.max(1, ...links.map((l) => l.value));
    const simNodes: NetNode[] = nodes.map((n) => ({ i: n.i, r: 12 + 26 * Math.sqrt(n.value / maxV) }));
    const byI = new Map(simNodes.map((n) => [n.i, n]));
    const simLinks = links
      .filter((l) => byI.has(l.a) && byI.has(l.b))
      .map((l) => ({ source: byI.get(l.a)!, target: byI.get(l.b)!, w: l.value / maxL, value: l.value }));
    const sim = forceSimulation(simNodes)
      .force('charge', forceManyBody().strength(-520))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<NetNode>((n) => n.r + 18))
      .force(
        'link',
        forceLink(simLinks)
          .distance((l) => 190 - 110 * (l as { w: number }).w)
          .strength((l) => 0.25 + 0.6 * (l as { w: number }).w),
      )
      .stop();
    for (let k = 0; k < 320; k++) sim.tick();
    // Scale the settled layout to fill the card (labels need room below each node).
    const pad = 20;
    const x0 = Math.min(...simNodes.map((n) => (n.x ?? 0) - n.r));
    const x1 = Math.max(...simNodes.map((n) => (n.x ?? 0) + n.r));
    const y0 = Math.min(...simNodes.map((n) => (n.y ?? 0) - n.r));
    const y1 = Math.max(...simNodes.map((n) => (n.y ?? 0) + n.r + 18));
    const k = Math.min((width - 2 * pad) / Math.max(1, x1 - x0), (height - 2 * pad) / Math.max(1, y1 - y0), 2.2);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    for (const n of simNodes) {
      n.x = width / 2 + ((n.x ?? 0) - cx) * k;
      n.y = height / 2 + ((n.y ?? 0) - cy) * k;
    }
    return { simNodes, simLinks };
  }, [width, nodes, links]);
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {layout && (
        <svg width={width} height={height} role="img" aria-label="Network of who talks with whom">
          {layout.simLinks.map((l, k) => (
            <line
              key={k}
              x1={l.source.x}
              y1={l.source.y}
              x2={l.target.x}
              y2={l.target.y}
              stroke="rgba(255,255,255,0.5)"
              strokeOpacity={0.1 + 0.55 * l.w}
              strokeWidth={1 + 9 * l.w}
              strokeLinecap="round"
              {...tipProps({
                title: `${series[l.source.i].name} ⇄ ${series[l.target.i].name}`,
                rows: [{ label: 'Back-and-forths', value: fmtInt(l.value) }],
              })}
            />
          ))}
          {layout.simNodes.map((n) => (
            <g key={n.i} transform={`translate(${n.x},${n.y})`} {...tipProps({ title: series[n.i].name, rows: [{ label: 'Messages', value: fmtInt(nodes.find((x) => x.i === n.i)?.value ?? 0) }] })}>
              <circle r={n.r + 5} fill={series[n.i].color} fillOpacity={0.14} />
              <circle r={n.r} fill={series[n.i].color} stroke="rgba(0,0,0,0.6)" strokeWidth={2} />
              <circle r={n.r} fill="url(#net-shine)" />
              <text className="chart-label" y={n.r + 16} textAnchor="middle" style={{ fill: 'var(--ink)' }}>
                {series[n.i].name.length > 14 ? series[n.i].name.slice(0, 13) + '…' : series[n.i].name}
              </text>
            </g>
          ))}
          <defs>
            <radialGradient id="net-shine" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fff" stopOpacity={0.45} />
              <stop offset="45%" stopColor="#fff" stopOpacity={0.06} />
              <stop offset="100%" stopColor="#000" stopOpacity={0.25} />
            </radialGradient>
          </defs>
        </svg>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Word cloud — size = frequency, colour = who says it most.
   -------------------------------------------------------------------------- */
interface CloudWord {
  text: string;
  size: number;
  count: number;
  color: string;
  owner: string;
  x?: number;
  y?: number;
  rotate?: number;
}

export function WordCloud({
  words,
  height = 360,
}: {
  words: { text: string; count: number; color: string; owner: string }[];
  height?: number;
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [placed, setPlaced] = useState<{ key: string; words: CloudWord[] } | null>(null);
  const key = `${width}:${words.length}:${words[0]?.text ?? ''}:${words[0]?.count ?? 0}`;
  useEffect(() => {
    if (width === 0 || words.length === 0) return;
    const max = words[0].count;
    const min = words[words.length - 1].count;
    // Scale type to the card so the cloud fills it on any screen.
    const big = Math.max(34, Math.min(104, width * 0.095));
    const small = Math.max(11, Math.min(15, width * 0.016));
    const scale = (c: number) => small + (big - small) * Math.sqrt((c - min) / Math.max(1, max - min));
    const layout = cloud<CloudWord>()
      .size([width, height])
      .words(words.map((w) => ({ ...w, size: scale(w.count) })))
      .padding(3)
      .rotate(() => 0)
      .font('Inter Variable, Inter, system-ui, sans-serif')
      .fontWeight(650)
      .fontSize((d) => d.size)
      .spiral('rectangular')
      .random(() => 0.5)
      .on('end', (out) => setPlaced({ key, words: out }));
    layout.start();
    return () => {
      layout.stop();
    };
  }, [key, width, height, words]);
  const shown = placed?.key === key ? placed.words : [];
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="cloud" role="img" aria-label="Word cloud of the most used words">
          <g transform={`translate(${width / 2},${height / 2})`}>
            {shown.map((w) => (
              <text
                key={w.text}
                textAnchor="middle"
                transform={`translate(${w.x ?? 0},${w.y ?? 0})`}
                fontSize={w.size}
                fill={w.color}
                tabIndex={0}
                className="anim-fade"
                {...tipProps({
                  title: w.text,
                  rows: [
                    { label: 'Used', value: `${fmtInt(w.count)}×` },
                    { label: 'Most by', value: w.owner, color: w.color, mark: 'dot' },
                  ],
                })}
              >
                {w.text}
              </text>
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Radar — one person's emotional fingerprint, scaled against the group max.
   -------------------------------------------------------------------------- */
export function Radar({
  axes,
  values,
  maxes,
  color,
  size = 250,
  name,
}: {
  axes: string[];
  values: number[];
  maxes: number[];
  color: string;
  size?: number;
  name: string;
}) {
  const r = size / 2 - 62;
  const n = axes.length;
  const pt = (i: number, t: number) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    return [Math.cos(a) * r * t, Math.sin(a) * r * t];
  };
  const poly = values.map((v, i) => pt(i, Math.min(1, v / Math.max(1e-9, maxes[i])))).map((p) => p.join(',')).join(' ');
  return (
    <svg width={size} height={size} role="img" aria-label={`Emotion profile for ${name}`}>
      <g transform={`translate(${size / 2},${size / 2})`}>
        {[0.25, 0.5, 0.75, 1].map((k) => (
          <polygon
            key={k}
            points={axes.map((_, i) => pt(i, k).join(',')).join(' ')}
            fill="none"
            stroke="var(--grid)"
          />
        ))}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 1);
          const [lx, ly] = pt(i, 1 + 12 / r);
          return (
            <g key={a}>
              <line x1={0} y1={0} x2={x} y2={y} stroke="var(--grid)" />
              <text
                className="ax-text"
                x={lx}
                y={ly + 3}
                textAnchor={Math.abs(lx) < 4 ? 'middle' : lx > 0 ? 'start' : 'end'}
              >
                {a}
              </text>
            </g>
          );
        })}
        <polygon points={poly} fill={color} fillOpacity={0.22} stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {values.map((v, i) => {
          const [x, y] = pt(i, Math.min(1, v / Math.max(1e-9, maxes[i])));
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={4}
              fill={color}
              stroke="#111"
              strokeWidth={2}
              {...tipProps({ title: `${name} · ${axes[i]}`, rows: [{ label: 'Per 100 messages', value: v.toFixed(1) }] })}
            />
          );
        })}
      </g>
    </svg>
  );
}

/* ----------------------------------------------------------------------------
   Quadrant scatter — kindness vs spice, one labelled dot per person.
   -------------------------------------------------------------------------- */
export function Quadrant({
  points,
  xLabel,
  yLabel,
  quadrants,
  format = (v: number) => v.toFixed(1),
}: {
  points: { name: string; color: string; x: number; y: number }[];
  xLabel: string;
  yLabel: string;
  /** [top-left, top-right, bottom-left, bottom-right] */
  quadrants: [string, string, string, string];
  format?: (v: number) => string;
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const height = 320;
  const pad = { l: 36, r: 16, t: 16, b: 34 };
  const xMax = Math.max(1, ...points.map((p) => p.x)) * 1.15;
  const yMax = Math.max(1, ...points.map((p) => p.y)) * 1.15;
  const mx = points.reduce((s, p) => s + p.x, 0) / Math.max(1, points.length);
  const my = points.reduce((s, p) => s + p.y, 0) / Math.max(1, points.length);
  const x = (v: number) => pad.l + (v / xMax) * (width - pad.l - pad.r);
  const y = (v: number) => height - pad.b - (v / yMax) * (height - pad.t - pad.b);
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`${yLabel} versus ${xLabel} per person`}>
          <rect x={x(mx)} y={pad.t} width={Math.max(0, width - pad.r - x(mx))} height={Math.max(0, y(my) - pad.t)} fill="rgba(255,106,20,0.05)" />
          <line className="grid-line" x1={x(mx)} x2={x(mx)} y1={pad.t} y2={height - pad.b} />
          <line className="grid-line" x1={pad.l} x2={width - pad.r} y1={y(my)} y2={y(my)} />
          <line className="ax-line" x1={pad.l} x2={width - pad.r} y1={height - pad.b} y2={height - pad.b} />
          <line className="ax-line" x1={pad.l} x2={pad.l} y1={pad.t} y2={height - pad.b} />
          <text className="label" x={pad.l + 8} y={pad.t + 12} style={{ fill: 'var(--ink-3)' }}>
            {quadrants[0]}
          </text>
          <text className="label" x={width - pad.r - 8} y={pad.t + 12} textAnchor="end" style={{ fill: 'var(--ink-3)' }}>
            {quadrants[1]}
          </text>
          <text className="label" x={pad.l + 8} y={height - pad.b - 10} style={{ fill: 'var(--ink-3)' }}>
            {quadrants[2]}
          </text>
          <text className="label" x={width - pad.r - 8} y={height - pad.b - 10} textAnchor="end" style={{ fill: 'var(--ink-3)' }}>
            {quadrants[3]}
          </text>
          <text className="ax-text" x={width - pad.r} y={height - 8} textAnchor="end">
            {xLabel} →
          </text>
          <text className="ax-text" x={-pad.t} y={12} transform="rotate(-90)" textAnchor="end">
            {yLabel} →
          </text>
          {points.map((p) => (
            <g key={p.name} tabIndex={0} {...tipProps({ title: p.name, rows: [{ label: xLabel, value: format(p.x) }, { label: yLabel, value: format(p.y) }] })}>
              <circle cx={x(p.x)} cy={y(p.y)} r={16} fill="transparent" />
              <circle cx={x(p.x)} cy={y(p.y)} r={7} fill={p.color} stroke="#111" strokeWidth={2} />
              <text className="chart-label" x={x(p.x) + 11} y={y(p.y) + 4} style={{ fill: 'var(--ink)' }}>
                {p.name}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Mood bars — negative ← neutral → positive, centred on neutral.
   -------------------------------------------------------------------------- */
export function MoodBars({
  rows,
}: {
  rows: { name: string; color: string; pos: number; neu: number; neg: number }[];
}) {
  const maxSide = Math.max(0.01, ...rows.map((r) => Math.max(r.neg + r.neu / 2, r.pos + r.neu / 2)));
  const pct = (v: number) => `${(v / maxSide) * 50}%`;
  return (
    <div className="moodbars">
      <div className="moodbars__axis">
        <span>more negative</span>
        <span>neutral</span>
        <span>more positive</span>
      </div>
      {rows.map((r) => (
        <div className="moodbars__row" key={r.name}>
          <span className="moodbars__name">
            <span className="swatch swatch--dot" style={{ ['--sw' as string]: r.color }} />
            {r.name}
          </span>
          <div className="moodbars__track">
            <span className="moodbars__center" />
            <span
              className="moodbars__seg moodbars__seg--neg"
              style={{ right: `calc(50% + ${pct(r.neu / 2)})`, width: pct(r.neg) }}
              {...tipProps({ title: r.name, rows: [{ label: 'Negative', value: fmtPct(r.neg), color: 'var(--neg)', mark: 'box' }] })}
            />
            <span
              className="moodbars__seg moodbars__seg--neu"
              style={{ left: `calc(50% - ${pct(r.neu / 2)})`, width: pct(r.neu) }}
              {...tipProps({ title: r.name, rows: [{ label: 'Neutral', value: fmtPct(r.neu), color: 'var(--neutral)', mark: 'box' }] })}
            />
            <span
              className="moodbars__seg moodbars__seg--pos"
              style={{ left: `calc(50% + ${pct(r.neu / 2)})`, width: pct(r.pos) }}
              {...tipProps({ title: r.name, rows: [{ label: 'Positive', value: fmtPct(r.pos), color: 'var(--pos)', mark: 'box' }] })}
            />
          </div>
          <span className="moodbars__net">
            {r.pos - r.neg >= 0 ? '+' : '−'}
            {Math.abs(Math.round((r.pos - r.neg) * 100))}
          </span>
        </div>
      ))}
    </div>
  );
}
