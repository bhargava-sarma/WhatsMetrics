import { useId, useMemo, useState, type PointerEvent } from 'react';
import { area, curveBasis, curveMonotoneX, line, stack, stackOffsetExpand, stackOffsetNone, stackOffsetWiggle, stackOrderInsideOut, stackOrderNone } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { useSize } from '../ui/hooks';
import { tip, tipProps, type TipRow } from '../ui/tip';
import { fmtCompact, fmtInt, fmtMonth, fmtPct } from '../../lib/format';
import { niceAxis } from './scales';

export interface SeriesDef {
  name: string;
  color: string;
}

const GAP = 2;

function roundedTop(x: number, yTop: number, w: number, yBottom: number, r: number) {
  const h = yBottom - yTop;
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${yBottom}V${yTop + rr}Q${x},${yTop} ${x + rr},${yTop}H${x + w - rr}Q${x + w},${yTop} ${x + w},${yTop + rr}V${yBottom}Z`;
}

/* ----------------------------------------------------------------------------
   Columns — vertical bars, optionally stacked by series.
   -------------------------------------------------------------------------- */
export function Columns({
  data,
  series,
  height = 190,
  format = fmtInt,
  labelEvery = 1,
  highlight,
  color = 'var(--c1)',
  mutedColor,
  ariaLabel,
}: {
  data: { label: string; tipLabel?: string; values: number[] }[];
  series?: SeriesDef[];
  height?: number;
  format?: (v: number) => string;
  labelEvery?: number;
  highlight?: number;
  color?: string;
  /** When set, non-highlighted single-series bars use this colour (emphasis form). */
  mutedColor?: string;
  ariaLabel: string;
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const left = 38;
  const bottom = 22;
  const top = 8;
  const innerW = Math.max(0, width - left);
  const innerH = height - bottom - top;
  const totals = data.map((d) => d.values.reduce((a, b) => a + b, 0));
  const axis = niceAxis(Math.max(...totals, 0), 4);
  const y = scaleLinear().domain([0, axis.max]).range([top + innerH, top]);
  const band = data.length ? innerW / data.length : 0;
  const bw = Math.max(2, Math.min(24, band * 0.7));
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          {axis.ticks.map((t) => (
            <g key={t}>
              <line className="grid-line" x1={left} x2={width} y1={y(t)} y2={y(t)} />
              <text className="ax-text" x={left - 8} y={y(t) + 3} textAnchor="end">
                {t === 0 ? '0' : format === fmtInt ? fmtCompact(t) : format(t)}
              </text>
            </g>
          ))}
          <g className="marks">
            {data.map((d, i) => {
              const x = left + i * band + (band - bw) / 2;
              let acc = 0;
              const segs = d.values.map((v, s) => {
                const y0 = y(acc);
                acc += v;
                const y1 = y(acc);
                return { s, v, y0, y1 };
              });
              const lastNonZero = segs.reduce((k, sg, idx) => (sg.v > 0 ? idx : k), -1);
              const rows: TipRow[] = series
                ? [
                    ...series
                      .map((s, k) => ({ label: s.name, value: format(d.values[k] ?? 0), color: s.color, mark: 'box' as const }))
                      .filter((_, k) => (d.values[k] ?? 0) > 0),
                    ...(series.length > 1 ? [{ label: 'Total', value: format(totals[i]) }] : []),
                  ]
                : [{ label: 'Messages', value: format(totals[i]) }];
              return (
                <g key={i} className="mark" tabIndex={0} {...tipProps({ title: d.tipLabel ?? d.label, rows })}>
                  <rect className="hit" x={left + i * band} y={top} width={band} height={innerH} />
                  {segs.map(({ s, v, y0, y1 }, idx) => {
                    if (v <= 0) return null;
                    const bottomY = idx > 0 && segs.slice(0, idx).some((p) => p.v > 0) ? y0 - GAP : y0;
                    const fill = series
                      ? series[s].color
                      : mutedColor && highlight !== undefined && highlight !== i
                        ? mutedColor
                        : color;
                    return idx === lastNonZero ? (
                      <path key={s} d={roundedTop(x, y1, bw, bottomY, 4)} fill={fill} />
                    ) : (
                      <rect key={s} x={x} y={y1} width={bw} height={Math.max(0, bottomY - y1)} fill={fill} />
                    );
                  })}
                </g>
              );
            })}
          </g>
          <line className="ax-line" x1={left} x2={width} y1={top + innerH} y2={top + innerH} />
          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <text
                key={i}
                className={`ax-text${highlight === i ? ' ax-text--strong' : ''}`}
                x={left + i * band + band / 2}
                y={height - 6}
                textAnchor="middle"
              >
                {d.label}
              </text>
            ) : null,
          )}
        </svg>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Crosshair helper — snaps to the nearest X.
   -------------------------------------------------------------------------- */
function nearestIndex(xs: number[], px: number) {
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < px) lo = mid;
    else hi = mid;
  }
  return Math.abs(xs[lo] - px) <= Math.abs(xs[hi] - px) ? lo : hi;
}

/* ----------------------------------------------------------------------------
   TimeArea — single series over time with a crosshair and a peak annotation.
   -------------------------------------------------------------------------- */
export function TimeArea({
  points,
  height = 220,
  color = '#ff6a14',
  formatT,
  formatV = fmtInt,
  valueLabel = 'Messages',
  annotateMax = true,
  ariaLabel,
}: {
  points: { t: number; v: number }[];
  height?: number;
  color?: string;
  formatT: (t: number) => string;
  formatV?: (v: number) => string;
  valueLabel?: string;
  annotateMax?: boolean;
  ariaLabel: string;
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const left = 40;
  const bottom = 22;
  const top = 18;
  const innerH = height - top - bottom;
  const n = points.length;
  const tMin = points[0]?.t ?? 0;
  const tMax = points[n - 1]?.t ?? 1;
  const x = scaleLinear()
    .domain([tMin, tMax === tMin ? tMin + 1 : tMax])
    .range([left, Math.max(left + 1, width - 8)]);
  const axis = niceAxis(Math.max(0, ...points.map((p) => p.v)), 4);
  const y = scaleLinear().domain([0, axis.max]).range([top + innerH, top]);
  const xs = points.map((p) => x(p.t));
  const areaPath = area<{ t: number; v: number }>()
    .x((p) => x(p.t))
    .y0(y(0))
    .y1((p) => y(p.v))
    .curve(curveMonotoneX)(points);
  const linePath = line<{ t: number; v: number }>()
    .x((p) => x(p.t))
    .y((p) => y(p.v))
    .curve(curveMonotoneX)(points);
  const maxIdx = points.reduce((b, p, i) => (p.v > points[b].v ? i : b), 0);
  const labelTicks = 6;
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const i = nearestIndex(xs, e.clientX - rect.left + left);
    setHover(i);
    const p = points[i];
    tip.show({ title: formatT(p.t), rows: [{ label: valueLabel, value: formatV(p.v), color, mark: 'line' }] }, e.clientX, e.clientY);
  };
  const gradientId = `ta${useId().replace(/:/g, '')}`;
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && n > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {axis.ticks.map((t) => (
            <g key={t}>
              <line className="grid-line" x1={left} x2={width} y1={y(t)} y2={y(t)} />
              <text className="ax-text" x={left - 8} y={y(t) + 3} textAnchor="end">
                {formatV === fmtInt ? fmtCompact(t) : formatV(t)}
              </text>
            </g>
          ))}
          <path d={areaPath ?? ''} fill={`url(#${gradientId})`} className="anim-fade" />
          <path d={linePath ?? ''} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <line className="ax-line" x1={left} x2={width} y1={top + innerH} y2={top + innerH} />
          {Array.from({ length: labelTicks }, (_, k) => {
            const t = tMin + ((tMax - tMin) * k) / (labelTicks - 1);
            return (
              <text key={k} className="ax-text" x={x(t)} y={height - 6} textAnchor={k === 0 ? 'start' : k === labelTicks - 1 ? 'end' : 'middle'}>
                {formatT(t)}
              </text>
            );
          })}
          {annotateMax && n > 1 && (
            <g pointerEvents="none">
              <circle cx={x(points[maxIdx].t)} cy={y(points[maxIdx].v)} r={4} fill={color} stroke="#111" strokeWidth={2} />
              <text
                className="chart-value"
                x={Math.min(width - 4, Math.max(left + 4, x(points[maxIdx].t)))}
                y={y(points[maxIdx].v) - 9}
                textAnchor={x(points[maxIdx].t) > width - 80 ? 'end' : x(points[maxIdx].t) < left + 60 ? 'start' : 'middle'}
              >
                {formatV(points[maxIdx].v)}
              </text>
            </g>
          )}
          {hover !== null && (
            <g pointerEvents="none">
              <line className="crosshair" x1={xs[hover]} x2={xs[hover]} y1={top} y2={top + innerH} />
              <circle cx={xs[hover]} cy={y(points[hover].v)} r={4.5} fill={color} stroke="#111" strokeWidth={2} />
            </g>
          )}
          <rect
            x={left}
            y={top}
            width={Math.max(0, width - left)}
            height={innerH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => {
              setHover(null);
              tip.hide();
            }}
          />
        </svg>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Stream — monthly volume by person: streamgraph, stacked, or 100% share.
   -------------------------------------------------------------------------- */
export type StreamMode = 'stream' | 'stack' | 'share';

export function Stream({
  months,
  series,
  mode,
  height = 280,
  ariaLabel,
}: {
  months: { ts: number; bySeries: number[] }[];
  series: SeriesDef[];
  mode: StreamMode;
  height?: number;
  ariaLabel: string;
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const left = mode === 'stream' ? 8 : 40;
  const bottom = 22;
  const top = 8;
  const innerH = height - top - bottom;
  const seriesCount = series.length;
  const layers = useMemo(() => {
    const s = stack<{ ts: number; bySeries: number[] }, number>()
      .keys(Array.from({ length: seriesCount }, (_, i) => i))
      .value((d, k) => d.bySeries[k] ?? 0)
      .order(mode === 'stream' ? stackOrderInsideOut : stackOrderNone)
      .offset(mode === 'stream' ? stackOffsetWiggle : mode === 'share' ? stackOffsetExpand : stackOffsetNone);
    return s(months);
  }, [months, seriesCount, mode]);
  const lo = Math.min(0, ...layers.flatMap((l) => l.map((p) => p[0])));
  const hi = Math.max(1e-9, ...layers.flatMap((l) => l.map((p) => p[1])));
  const axis = niceAxis(hi, 4);
  const yMax = mode === 'stack' ? axis.max : hi;
  const x = scaleLinear()
    .domain([0, Math.max(1, months.length - 1)])
    .range([left, Math.max(left + 1, width - 8)]);
  const y = scaleLinear().domain([lo, yMax]).range([top + innerH, top]);
  const areaGen = area<[number, number]>()
    .x((_, i) => x(i))
    .y0((p) => y(p[0]))
    .y1((p) => y(p[1]))
    .curve(mode === 'stream' ? curveBasis : curveMonotoneX);
  const xs = months.map((_, i) => x(i));
  const labelCount = Math.min(months.length, Math.max(2, Math.floor(width / 90)));
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const i = nearestIndex(xs, e.clientX - rect.left + left);
    setHover(i);
    const m = months[i];
    const total = m.bySeries.reduce((a, b) => a + b, 0);
    tip.show(
      {
        title: fmtMonth(m.ts),
        rows: [
          ...series
            .map((s, k) => ({
              label: s.name,
              value: mode === 'share' ? fmtPct(total ? m.bySeries[k] / total : 0) : fmtInt(m.bySeries[k] ?? 0),
              color: s.color,
              mark: 'box' as const,
            }))
            .filter((_, k) => (m.bySeries[k] ?? 0) > 0),
          { label: 'Total', value: fmtInt(total) },
        ],
      },
      e.clientX,
      e.clientY,
    );
  };
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && months.length > 1 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          {mode !== 'stream' &&
            (mode === 'share' ? [0, 0.25, 0.5, 0.75, 1] : axis.ticks).map((t) => (
              <g key={t}>
                <line className="grid-line" x1={left} x2={width} y1={y(t)} y2={y(t)} />
                <text className="ax-text" x={left - 8} y={y(t) + 3} textAnchor="end">
                  {mode === 'share' ? fmtPct(t) : fmtCompact(t)}
                </text>
              </g>
            ))}
          <g className="anim-fade">
            {layers.map((layer, k) => (
              <path
                key={k}
                d={areaGen(layer as unknown as [number, number][]) ?? ''}
                fill={series[k].color}
                fillOpacity={mode === 'stream' ? 0.9 : 0.85}
                stroke="rgba(8,8,10,0.85)"
                strokeWidth={1.5}
              />
            ))}
          </g>
          {Array.from({ length: labelCount }, (_, k) => {
            const i = Math.round(((months.length - 1) * k) / Math.max(1, labelCount - 1));
            return (
              <text
                key={k}
                className="ax-text"
                x={x(i)}
                y={height - 6}
                textAnchor={k === 0 ? 'start' : k === labelCount - 1 ? 'end' : 'middle'}
              >
                {fmtMonth(months[i].ts).replace(/ (\d{2})(\d{2})$/, " '$2")}
              </text>
            );
          })}
          {hover !== null && <line className="crosshair" x1={xs[hover]} x2={xs[hover]} y1={top} y2={top + innerH} />}
          <rect
            x={left}
            y={top}
            width={Math.max(0, width - left)}
            height={innerH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => {
              setHover(null);
              tip.hide();
            }}
          />
        </svg>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Bump — who ranked where, month by month.
   -------------------------------------------------------------------------- */
export function Bump({
  months,
  series,
  height = 260,
  ariaLabel,
}: {
  months: { ts: number; ranks: number[] }[];
  series: SeriesDef[];
  height?: number;
  ariaLabel: string;
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [focus, setFocus] = useState<number | null>(null);
  const idxs = series.map((_, i) => i).filter((i) => months.some((m) => m.ranks[i] > 0));
  const nRanks = Math.max(1, idxs.length);
  const left = 26;
  const right = 96;
  const top = 12;
  const bottom = 22;
  const x = scaleLinear()
    .domain([0, Math.max(1, months.length - 1)])
    .range([left, Math.max(left + 1, width - right)]);
  const y = scaleLinear()
    .domain([1, nRanks])
    .range([top, height - bottom]);
  const showDots = months.length <= 40;
  const labelCount = Math.min(months.length, Math.max(2, Math.floor((width - right) / 90)));
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && months.length > 1 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          {Array.from({ length: nRanks }, (_, r) => (
            <text key={r} className="ax-text" x={0} y={y(r + 1) + 3}>
              #{r + 1}
            </text>
          ))}
          {idxs.map((k) => {
            const pts = months.map((m, i) => ({ i, r: m.ranks[k] })).filter((p) => p.r > 0);
            const d = line<{ i: number; r: number }>()
              .x((p) => x(p.i))
              .y((p) => y(p.r))
              .curve(curveMonotoneX)(pts);
            const faded = focus !== null && focus !== k;
            const last = pts[pts.length - 1];
            return (
              <g
                key={k}
                opacity={faded ? 0.18 : 1}
                style={{ transition: 'opacity .2s' }}
                onPointerEnter={() => setFocus(k)}
                onPointerLeave={() => setFocus(null)}
              >
                <path d={d ?? ''} fill="none" stroke={series[k].color} strokeWidth={focus === k ? 3 : 2} strokeLinecap="round" />
                <path d={d ?? ''} fill="none" stroke="transparent" strokeWidth={14} />
                {showDots &&
                  pts.map((p) => (
                    <circle
                      key={p.i}
                      cx={x(p.i)}
                      cy={y(p.r)}
                      r={4}
                      fill={series[k].color}
                      stroke="#111"
                      strokeWidth={2}
                      {...tipProps({
                        title: fmtMonth(months[p.i].ts),
                        rows: [{ label: series[k].name, value: `#${p.r}`, color: series[k].color, mark: 'dot' }],
                      })}
                    />
                  ))}
                {last && (
                  <text className="chart-label" x={x(last.i) + 10} y={y(last.r) + 4}>
                    {series[k].name}
                  </text>
                )}
              </g>
            );
          })}
          {Array.from({ length: labelCount }, (_, k) => {
            const i = Math.round(((months.length - 1) * k) / Math.max(1, labelCount - 1));
            return (
              <text
                key={k}
                className="ax-text"
                x={x(i)}
                y={height - 4}
                textAnchor={k === 0 ? 'start' : k === labelCount - 1 ? 'end' : 'middle'}
              >
                {fmtMonth(months[i].ts)}
              </text>
            );
          })}
        </svg>
      )}
    </div>
  );
}
