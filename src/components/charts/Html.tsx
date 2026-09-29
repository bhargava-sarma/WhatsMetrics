import type { CSSProperties, ReactNode } from 'react';
import { tipProps, type TipContent } from '../ui/tip';
import { fmtInt, fmtPct } from '../../lib/format';
import { HEAT, HEAT_EMPTY, inkOn, rampColor } from './scales';

/* ----------------------------------------------------------------------------
   BarList — horizontal bars sharing one baseline; value at the tip.
   -------------------------------------------------------------------------- */
export interface BarItem {
  key: string | number;
  label: ReactNode;
  value: number;
  display?: string;
  sub?: string;
  color?: string;
  tip?: TipContent;
  labelTitle?: string;
}

export function BarList({
  items,
  max,
  labelWidth = '32%',
  barHeight = 14,
  showSwatch = true,
}: {
  items: BarItem[];
  max?: number;
  labelWidth?: string;
  barHeight?: number;
  showSwatch?: boolean;
}) {
  const top = max ?? Math.max(1e-9, ...items.map((i) => i.value));
  return (
    <ul className="barlist" style={{ ['--label-w' as string]: labelWidth, ['--bar-h' as string]: `${barHeight}px` }}>
      {items.map((it, i) => (
        <li
          key={it.key}
          className="barlist__row"
          tabIndex={0}
          {...tipProps(
            it.tip ?? {
              title: typeof it.label === 'string' ? it.label : undefined,
              rows: [{ label: 'Value', value: it.display ?? fmtInt(it.value), color: it.color, mark: 'box' }],
            },
          )}
        >
          <span className="barlist__label" title={it.labelTitle}>
            {showSwatch && it.color && <span className="swatch" style={{ ['--sw' as string]: it.color }} />}
            <span>{it.label}</span>
          </span>
          <span className="barlist__track">
            <span className="barlist__ghost" />
            <span
              className="barlist__fill"
              style={{
                width: `${Math.max(0.6, (it.value / top) * 100)}%`,
                ['--fill' as string]: it.color ?? 'var(--c1)',
                animationDelay: `${i * 45}ms`,
              }}
            />
          </span>
          <span className="barlist__value">
            {it.display ?? fmtInt(it.value)}
            {it.sub && <small>{it.sub}</small>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------------------------------
   Waffle — 100 squares, each ≈ 1% of messages.
   -------------------------------------------------------------------------- */
export function Waffle({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  // Largest-remainder rounding so the squares always add up to 100.
  const exact = parts.map((p) => (p.value / total) * 100);
  const counts = exact.map(Math.floor);
  let left = 100 - counts.reduce((a, b) => a + b, 0);
  exact
    .map((v, i) => ({ i, r: v - Math.floor(v) }))
    .sort((a, b) => b.r - a.r)
    .forEach(({ i }) => {
      if (left > 0) {
        counts[i]++;
        left--;
      }
    });
  const squares: { part: (typeof parts)[number]; n: number }[] = [];
  parts.forEach((p, i) => {
    for (let k = 0; k < counts[i]; k++) squares.push({ part: p, n: counts[i] });
  });
  return (
    <div className="waffle" role="img" aria-label={parts.map((p) => `${p.label} ${fmtPct(p.value / total)}`).join(', ')}>
      {squares.map((s, i) => (
        <span
          key={i}
          style={{ ['--sq' as string]: s.part.color, animationDelay: `${i * 6}ms` }}
          {...tipProps({
            title: s.part.label,
            rows: [
              { label: 'Messages', value: fmtInt(s.part.value), color: s.part.color, mark: 'box' },
              { label: 'Share', value: fmtPct(s.part.value / total, 1) },
            ],
          })}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   ShareBars — one 100% bar per metric: who owns which dimension.
   -------------------------------------------------------------------------- */
export function ShareBars({
  rows,
  series,
}: {
  rows: { label: string; values: number[]; format?: (v: number) => string }[];
  series: { name: string; color: string }[];
}) {
  return (
    <div className="sharebars">
      {rows.map((row) => {
        const total = row.values.reduce((a, b) => a + b, 0);
        return (
          <div className="sharebars__row" key={row.label}>
            <span className="sharebars__label">{row.label}</span>
            <div className="sharebars__bar" role="img" aria-label={`${row.label} by person`}>
              {total === 0 ? (
                <span className="sharebars__seg" style={{ flex: 1, ['--fill' as string]: 'rgba(255,255,255,0.06)' }} />
              ) : (
                row.values.map((v, i) =>
                  v > 0 ? (
                    <span
                      key={i}
                      className="sharebars__seg"
                      tabIndex={0}
                      style={{ flex: v, ['--fill' as string]: series[i].color }}
                      {...tipProps({
                        title: row.label,
                        rows: [
                          { label: series[i].name, value: fmtPct(v / total, 1), color: series[i].color, mark: 'box' },
                          { label: 'Count', value: row.format ? row.format(v) : fmtInt(v) },
                        ],
                      })}
                    />
                  ) : null,
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Matrix — heat table (who replies to whom, who talks about what).
   -------------------------------------------------------------------------- */
export function Matrix({
  rows,
  cols,
  values,
  format = fmtInt,
  rowNormalize = false,
  tipTitle,
  ramp = HEAT,
  colHeader,
}: {
  rows: { label: ReactNode; color?: string; name: string }[];
  cols: { label: ReactNode; name: string }[];
  values: number[][];
  format?: (v: number) => string;
  rowNormalize?: boolean;
  tipTitle: (r: number, c: number) => string;
  ramp?: string[];
  colHeader?: ReactNode;
}) {
  const max = Math.max(1e-9, ...values.flat());
  const style: CSSProperties = { gridTemplateColumns: `minmax(84px, 130px) repeat(${cols.length}, minmax(34px, 1fr))` };
  return (
    <div className="table-wrap">
      <div className="matrix" style={style} role="table">
        <div className="matrix__head matrix__head--col" role="columnheader">
          {colHeader}
        </div>
        {cols.map((c) => (
          <div className="matrix__head matrix__head--col" key={c.name} role="columnheader" title={c.name}>
            {c.label}
          </div>
        ))}
        {rows.map((r, ri) => {
          const rowMax = Math.max(1e-9, ...values[ri]);
          return [
            <div className="matrix__head" key={`h${ri}`} role="rowheader" title={r.name}>
              {r.color && <span className="swatch swatch--dot" style={{ ['--sw' as string]: r.color }} />}
              {r.label}
            </div>,
            ...cols.map((_, ci) => {
              const v = values[ri][ci];
              const t = v / (rowNormalize ? rowMax : max);
              const bg = v > 0 ? rampColor(Math.min(0.999, t), ramp) : HEAT_EMPTY;
              return (
                <div
                  key={`${ri}-${ci}`}
                  className="matrix__cell"
                  role="cell"
                  tabIndex={0}
                  style={{ background: bg, color: v > 0 ? inkOn(bg) : 'var(--ink-4)' }}
                  {...tipProps({ title: tipTitle(ri, ci), rows: [{ label: 'Count', value: format(v) }] })}
                >
                  {v > 0 ? format(v) : '·'}
                </div>
              );
            }),
          ];
        })}
      </div>
    </div>
  );
}

export function ScaleLegend({ low, high, ramp = HEAT }: { low: string; high: string; ramp?: string[] }) {
  return (
    <div className="scale-legend" aria-hidden="true">
      <span>{low}</span>
      <span className="scale-legend__ramp">
        {ramp.map((c) => (
          <span key={c} style={{ background: c }} />
        ))}
      </span>
      <span>{high}</span>
    </div>
  );
}
