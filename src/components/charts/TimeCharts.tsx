import { useState, type PointerEvent } from 'react';
import { arc, area, curveMonotoneX, line } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { useSize } from '../ui/hooks';
import { tip, tipProps } from '../ui/tip';
import { MONTHS, WEEKDAYS, WEEKDAYS_SHORT, fmtDate, fmtHour, fmtHourRange, fmtInt, fmtPct } from '../../lib/format';
import { HEAT, HEAT_EMPTY, quantileScale, rampColor } from './scales';
import type { SeriesDef } from './Svg';

const DAY = 86_400_000;

/* ----------------------------------------------------------------------------
   Calendar heatmap — every day of the chat, one row per year.
   -------------------------------------------------------------------------- */
export function Calendar({ dayStart, counts }: { dayStart: number; counts: number[] }) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const scale = quantileScale(counts);
  const firstDay = Math.floor(dayStart / DAY);
  const lastDay = firstDay + counts.length - 1;
  const y0 = new Date(firstDay * DAY).getUTCFullYear();
  const y1 = new Date(lastDay * DAY).getUTCFullYear();
  const years: number[] = [];
  for (let y = y0; y <= y1; y++) years.push(y);
  const labelW = 34;
  const gap = 2;
  const cell = Math.max(9, Math.min(19, Math.floor((Math.max(width, 560) - labelW) / 54) - gap));
  const step = cell + gap;
  const yearH = 7 * step + 20;
  const svgW = labelW + 54 * step;
  return (
    <div className="chart" ref={ref} style={{ overflowX: 'auto', overflowY: 'hidden' }}>
      {width > 0 && (
        <svg width={svgW} height={years.length * yearH} role="img" aria-label="Messages per day, calendar view">
          {years.map((year, yi) => {
            const jan1 = Date.UTC(year, 0, 1) / DAY;
            const offset = (jan1 + 3) % 7; // Monday-first weekday of Jan 1
            const daysInYear = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY;
            const top = yi * yearH + 16;
            const cells = [];
            for (let d = 0; d < daysInYear; d++) {
              const dayNum = jan1 + d;
              const idx = dayNum - firstDay;
              if (idx < 0 || idx >= counts.length) continue;
              const v = counts[idx];
              const col = Math.floor((d + offset) / 7);
              const row = (d + offset) % 7;
              const q = scale(v);
              cells.push(
                <rect
                  key={d}
                  className="mark"
                  x={labelW + col * step}
                  y={top + row * step}
                  width={cell}
                  height={cell}
                  rx={2.5}
                  fill={q < 0 ? HEAT_EMPTY : HEAT[q]}
                  {...tipProps({
                    title: fmtDate(dayNum * DAY, { weekday: true }),
                    rows: [{ label: 'Messages', value: fmtInt(v) }],
                  })}
                />,
              );
            }
            const monthLabels = MONTHS.map((m, mi) => {
              const d = (Date.UTC(year, mi, 1) / DAY - jan1 + offset) / 7;
              return (
                <text key={m} className="ax-text" x={labelW + Math.floor(d) * step} y={top - 5}>
                  {m}
                </text>
              );
            });
            return (
              <g key={year}>
                <text className="ax-text ax-text--strong" x={0} y={top + 3 * step + cell / 2 + 3}>
                  {year}
                </text>
                {monthLabels}
                <g className="marks">{cells}</g>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Punch card — weekday × hour.
   -------------------------------------------------------------------------- */
export function PunchCard({ grid }: { grid: number[][] }) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const labelW = 34;
  const cellW = Math.max(8, (width - labelW) / 24);
  const cellH = Math.min(38, Math.max(22, cellW * 1.3));
  const max = Math.max(1, ...grid.flat());
  const height = 7 * cellH + 20;
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Messages by weekday and hour">
          <g className="marks">
            {grid.map((row, d) =>
              row.map((v, h) => {
                const t = Math.sqrt(v / max);
                return (
                  <rect
                    key={`${d}-${h}`}
                    className="mark"
                    x={labelW + h * cellW + 1}
                    y={d * cellH + 1}
                    width={cellW - 2}
                    height={cellH - 2}
                    rx={3}
                    fill={v === 0 ? HEAT_EMPTY : rampColor(Math.min(0.999, t))}
                    {...tipProps({
                      title: `${WEEKDAYS[d]} · ${fmtHourRange(h)}`,
                      rows: [{ label: 'Messages', value: fmtInt(v) }],
                    })}
                  />
                );
              }),
            )}
          </g>
          {WEEKDAYS_SHORT.map((w, d) => (
            <text key={w} className="ax-text" x={0} y={d * cellH + cellH / 2 + 3}>
              {w}
            </text>
          ))}
          {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
            <text key={h} className="ax-text" x={labelW + h * cellW + cellW / 2} y={height - 4} textAnchor="middle">
              {fmtHour(h, true)}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Radial clock — the 24-hour day as a dial.
   -------------------------------------------------------------------------- */
export function RadialClock({
  hourly,
  color = '#ff6a14',
  size: forced,
  label = 'Messages',
}: {
  hourly: number[];
  color?: string;
  size?: number;
  label?: string;
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const size = forced ?? Math.min(width, 340);
  const cx = size / 2;
  const cy = size / 2;
  const r1 = size / 2 - 34;
  const r0 = r1 * 0.44;
  const max = Math.max(1, ...hourly);
  const total = hourly.reduce((a, b) => a + b, 0) || 1;
  const peak = hourly.indexOf(Math.max(...hourly));
  const wedge = arc<{ i: number; v: number }>()
    .innerRadius(r0)
    .outerRadius((d) => r0 + Math.max(2, ((r1 - r0) * d.v) / max))
    .startAngle((d) => (d.i / 24) * 2 * Math.PI + 0.02)
    .endAngle((d) => ((d.i + 1) / 24) * 2 * Math.PI - 0.02)
    .cornerRadius(3);
  return (
    <div className="chart" ref={ref} style={{ height: size || 260, display: 'grid', placeItems: 'center' }}>
      {size > 0 && (
        <svg width={size} height={size} role="img" aria-label={`${label} by hour of day; peak at ${fmtHour(peak)}`}>
          <g transform={`translate(${cx},${cy})`}>
            {[0.33, 0.66, 1].map((k) => (
              <circle key={k} r={r0 + (r1 - r0) * k} fill="none" stroke="var(--grid)" />
            ))}
            {Array.from({ length: 24 }, (_, i) => {
              const a = (i / 24) * 2 * Math.PI - Math.PI / 2;
              const long = i % 6 === 0;
              return (
                <line
                  key={i}
                  x1={Math.cos(a) * (r1 + 4)}
                  y1={Math.sin(a) * (r1 + 4)}
                  x2={Math.cos(a) * (r1 + (long ? 10 : 7))}
                  y2={Math.sin(a) * (r1 + (long ? 10 : 7))}
                  stroke={long ? 'var(--ink-3)' : 'var(--ink-4)'}
                />
              );
            })}
            <g className="marks">
              {hourly.map((v, i) => (
                <path
                  key={i}
                  className="mark"
                  tabIndex={0}
                  d={wedge({ i, v }) ?? ''}
                  fill={color}
                  fillOpacity={i === peak ? 1 : 0.35 + 0.55 * (v / max)}
                  {...tipProps({
                    title: fmtHourRange(i),
                    rows: [
                      { label, value: fmtInt(v), color, mark: 'box' },
                      { label: 'Share', value: fmtPct(v / total, 1) },
                    ],
                  })}
                />
              ))}
            </g>
            {[
              [0, '12 AM'],
              [6, '6 AM'],
              [12, '12 PM'],
              [18, '6 PM'],
            ].map(([h, text]) => {
              const a = ((h as number) / 24) * 2 * Math.PI - Math.PI / 2;
              const r = r1 + 20;
              return (
                <text
                  key={h}
                  className="ax-text"
                  x={Math.cos(a) * r}
                  y={Math.sin(a) * r + 3}
                  textAnchor={h === 6 ? 'start' : h === 18 ? 'end' : 'middle'}
                >
                  {text}
                </text>
              );
            })}
            <text textAnchor="middle" y={-4} className="chart-value" style={{ fontSize: size * 0.075 }}>
              {fmtHour(peak)}
            </text>
            <text textAnchor="middle" y={size * 0.06} className="ax-text">
              PEAK HOUR
            </text>
          </g>
        </svg>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Ridgeline — each person's daily rhythm (share of their messages by hour).
   -------------------------------------------------------------------------- */
export function Ridgeline({
  rows,
  series,
}: {
  rows: number[][];
  series: SeriesDef[];
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const labelW = 96;
  const rowH = 40;
  const overlap = 1.5;
  const top = rowH * (overlap - 1) + 6;
  const height = top + rows.length * rowH + 22;
  const shares = rows.map((r) => {
    const t = r.reduce((a, b) => a + b, 0) || 1;
    return r.map((v) => v / t);
  });
  const maxShare = Math.max(0.01, ...shares.flat());
  const x = scaleLinear()
    .domain([0, 23])
    .range([labelW, Math.max(labelW + 1, width - 8)]);
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const h = Math.max(0, Math.min(23, Math.round(x.invert(e.clientX - rect.left + labelW))));
    setHover(h);
    tip.show(
      {
        title: fmtHourRange(h),
        rows: series.map((s, i) => ({ label: s.name, value: fmtPct(shares[i][h], 1), color: s.color, mark: 'line' as const })),
        note: 'Share of each person’s own messages',
      },
      e.clientX,
      e.clientY,
    );
  };
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Each person's activity by hour of day">
          {[0, 6, 12, 18, 23].map((h) => (
            <line key={h} className="grid-line" x1={x(h)} x2={x(h)} y1={0} y2={height - 20} />
          ))}
          {shares.map((sh, i) => {
            const base = top + (i + 1) * rowH;
            const yv = (v: number) => base - (v / maxShare) * rowH * overlap;
            const pts = sh.map((v, h) => ({ h, v }));
            const a = area<{ h: number; v: number }>()
              .x((p) => x(p.h))
              .y0(base)
              .y1((p) => yv(p.v))
              .curve(curveMonotoneX)(pts);
            const l = line<{ h: number; v: number }>()
              .x((p) => x(p.h))
              .y((p) => yv(p.v))
              .curve(curveMonotoneX)(pts);
            const peak = sh.indexOf(Math.max(...sh));
            return (
              <g key={i}>
                <path d={a ?? ''} fill={series[i].color} fillOpacity={0.2} />
                <path d={l ?? ''} fill="none" stroke={series[i].color} strokeWidth={2} strokeLinejoin="round" />
                <line className="ax-line" x1={labelW} x2={width - 8} y1={base} y2={base} />
                <circle cx={x(peak)} cy={yv(sh[peak])} r={3.5} fill={series[i].color} stroke="#111" strokeWidth={2} />
                <text className="chart-label" x={0} y={base - 4}>
                  {series[i].name.length > 13 ? series[i].name.slice(0, 12) + '…' : series[i].name}
                </text>
              </g>
            );
          })}
          {hover !== null && <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={0} y2={height - 20} />}
          {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
            <text key={h} className="ax-text" x={x(h)} y={height - 4} textAnchor="middle">
              {fmtHour(h, true)}
            </text>
          ))}
          <rect
            x={labelW}
            y={0}
            width={Math.max(0, width - labelW)}
            height={height - 20}
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
