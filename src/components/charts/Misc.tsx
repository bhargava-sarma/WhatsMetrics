import { useSize } from '../ui/hooks';
import { tipProps } from '../ui/tip';
import { emojiDisplay } from '../../lib/analysis/features';
import { fmtInt, fmtMonth, fmtNum } from '../../lib/format';
import { NEG, POS, niceAxis } from './scales';

/* ----------------------------------------------------------------------------
   Diverging columns — a signed value per month around a zero line.
   -------------------------------------------------------------------------- */
export function DivergingColumns({
  data,
  height = 200,
  format = (v: number) => (v >= 0 ? '+' : '') + fmtNum(v),
  label,
  posColor = POS,
  negColor = NEG,
}: {
  data: { ts: number; value: number; count: number }[];
  height?: number;
  format?: (v: number) => string;
  label: string;
  posColor?: string;
  negColor?: string;
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const left = 34;
  const top = 10;
  const bottom = 22;
  const innerH = height - top - bottom;
  // Only reserve room below zero if something actually dips below it.
  const axis = niceAxis(Math.max(0, ...data.map((d) => d.value)), 4, Math.min(0, ...data.map((d) => d.value)));
  const span = axis.max - axis.min || 1;
  const y = (v: number) => top + ((axis.max - v) / span) * innerH;
  const zero = y(0);
  const band = data.length ? (width - left) / data.length : 0;
  const bw = Math.max(2, Math.min(18, band * 0.7));
  const labelCount = Math.min(data.length, Math.max(2, Math.floor((width - left) / 90)));
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          {axis.ticks
            .filter((t) => t !== 0)
            .map((t) => (
              <g key={t}>
                <line className="grid-line" x1={left} x2={width} y1={y(t)} y2={y(t)} />
                <text className="ax-text" x={left - 6} y={y(t) + 3} textAnchor="end">
                  {format(t)}
                </text>
              </g>
            ))}
          <text className="ax-text" x={left - 6} y={zero + 3} textAnchor="end">
            0
          </text>
          <g className="marks">
            {data.map((d, i) => {
              const x = left + i * band + (band - bw) / 2;
              const yv = y(d.value);
              const h = Math.abs(yv - zero);
              const up = d.value >= 0;
              const r = Math.min(4, h, bw / 2);
              const path = up
                ? `M${x},${zero}V${yv + r}Q${x},${yv} ${x + r},${yv}H${x + bw - r}Q${x + bw},${yv} ${x + bw},${yv + r}V${zero}Z`
                : `M${x},${zero}V${yv - r}Q${x},${yv} ${x + r},${yv}H${x + bw - r}Q${x + bw},${yv} ${x + bw},${yv - r}V${zero}Z`;
              return (
                <g key={i} className="mark" tabIndex={0} {...tipProps({ title: fmtMonth(d.ts), rows: [{ label, value: format(d.value), color: up ? posColor : negColor, mark: 'box' }, { label: 'Messages', value: fmtInt(d.count) }] })}>
                  <rect className="hit" x={left + i * band} y={top} width={band} height={innerH} />
                  {d.count > 0 && h > 0.5 && <path d={path} fill={up ? posColor : negColor} />}
                </g>
              );
            })}
          </g>
          <line className="ax-line" x1={left} x2={width} y1={zero} y2={zero} />
          {Array.from({ length: labelCount }, (_, k) => {
            const i = Math.round(((data.length - 1) * k) / Math.max(1, labelCount - 1));
            return (
              <text
                key={k}
                className="ax-text"
                x={left + i * band + band / 2}
                y={height - 5}
                textAnchor={k === 0 ? 'start' : k === labelCount - 1 ? 'end' : 'middle'}
              >
                {fmtMonth(data[i].ts)}
              </text>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Mood dial — a Teenage-Engineering-style meter for net mood (−50…+50).
   -------------------------------------------------------------------------- */
export function MoodDial({ value, size = 240 }: { value: number; size?: number }) {
  const clamp = Math.max(-50, Math.min(50, value));
  const w = size + 44;
  const h = size * 0.62;
  const cx = w / 2;
  const cy = h - 12;
  const r = size * 0.42;
  const angle = (v: number) => Math.PI + ((v + 50) / 100) * Math.PI;
  const p = (v: number, rr: number) => [cx + Math.cos(angle(v)) * rr, cy + Math.sin(angle(v)) * rr];
  const arcPath = (from: number, to: number, rr: number) => {
    const [x1, y1] = p(from, rr);
    const [x2, y2] = p(to, rr);
    return `M${x1},${y1}A${rr},${rr} 0 0 1 ${x2},${y2}`;
  };
  const [nx, ny] = p(clamp, r - 18);
  return (
    <svg width={w} height={h} role="img" aria-label={`Net mood ${fmtNum(value)}`}>
      <path d={arcPath(-50, -0.5, r)} stroke={NEG} strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.85} />
      <path d={arcPath(0.5, 50, r)} stroke={POS} strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.85} />
      {Array.from({ length: 21 }, (_, i) => {
        const v = -50 + i * 5;
        const [x1, y1] = p(v, r - 12);
        const [x2, y2] = p(v, r - (i % 5 === 0 ? 22 : 17));
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 5 === 0 ? 'var(--ink-3)' : 'var(--ink-4)'} strokeWidth={1} />;
      })}
      {[-50, -25, 0, 25, 50].map((v) => {
        const [x, y] = p(v, r + 14);
        return (
          <text key={v} className="ax-text" x={x} y={y + 3} textAnchor="middle">
            {v > 0 ? `+${v}` : v}
          </text>
        );
      })}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#ff6a14" strokeWidth={3} strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px rgba(255,106,20,.8))' }} />
      <circle cx={cx} cy={cy} r={9} fill="#1c1c20" stroke="rgba(255,255,255,.2)" />
      <circle cx={cx} cy={cy} r={3} fill="#ff6a14" />
    </svg>
  );
}

/* ----------------------------------------------------------------------------
   Sparkline
   -------------------------------------------------------------------------- */
export function Sparkline({ values, color = '#ff6a14', height = 44 }: { values: number[]; color?: string; height?: number }) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const max = Math.max(1, ...values);
  const n = values.length;
  const pts = values.map((v, i) => [n > 1 ? (i / (n - 1)) * (width - 4) + 2 : width / 2, height - 3 - (v / max) * (height - 8)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return (
    <div ref={ref} style={{ height }} aria-hidden="true">
      {width > 0 && n > 1 && (
        <svg width={width} height={height}>
          <path d={`${d}L${last[0]},${height}L${pts[0][0]},${height}Z`} fill={color} fillOpacity={0.12} />
          <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={last[0]} cy={last[1]} r={3.5} fill={color} stroke="#111" strokeWidth={2} />
        </svg>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Emoji keypad
   -------------------------------------------------------------------------- */
export function EmojiKeypad({ items, total, heroCount = 1 }: { items: [string, number][]; total: number; heroCount?: number }) {
  return (
    <div className="keypad">
      {items.map(([e, c], i) => (
        <div
          key={e}
          className={`keypad__key${i < heroCount ? ' keypad__key--hero' : ''}`}
          tabIndex={0}
          style={i < heroCount ? { gridColumn: 'span 2', gridRow: 'span 2' } : undefined}
          {...tipProps({ title: `#${i + 1}`, rows: [{ label: 'Used', value: `${fmtInt(c)}×` }, { label: 'Share of emoji', value: `${fmtNum((c / Math.max(1, total)) * 100)}%` }] })}
        >
          <span className="keypad__rank">{String(i + 1).padStart(2, '0')}</span>
          <span className="emoji">{emojiDisplay(e)}</span>
          <span className="keypad__count">{fmtInt(c)}</span>
        </div>
      ))}
    </div>
  );
}
