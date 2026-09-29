import { useState, type CSSProperties, type ReactNode } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import type { Person } from '../../lib/analysis/types';
import { DataTable, type Column } from './DataTable';
import { useInView } from './hooks';

/* ----------------------------------------------------------------------------
   Section — numbered like an instrument module
   -------------------------------------------------------------------------- */
export function Section({
  id,
  num,
  label,
  title,
  intro,
  children,
}: {
  id: string;
  num: string;
  label: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="section" aria-labelledby={`${id}-title`}>
      <header className="section-head">
        <div className="section-head__meta">
          <span className="section-num">{num}</span>
          <span className="label">{label}</span>
          <span className="ruler" aria-hidden="true" />
        </div>
        <h2 id={`${id}-title`}>{title}</h2>
        {intro && <p>{intro}</p>}
      </header>
      {children}
    </section>
  );
}

/* ----------------------------------------------------------------------------
   Card — every chart card leads with a plain-language answer and can flip to
   a table view (the accessible twin of the chart).
   -------------------------------------------------------------------------- */
export interface CardTable<T> {
  columns: Column<T>[];
  rows: T[];
}

export function Card<T>({
  index,
  title,
  sub,
  insight,
  foot,
  tools,
  table,
  className = '',
  span = 12,
  children,
  lazyHeight,
  style,
}: {
  index?: string;
  title: string;
  sub?: ReactNode;
  insight?: ReactNode;
  foot?: ReactNode;
  tools?: ReactNode;
  table?: CardTable<T>;
  className?: string;
  span?: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;
  children?: ReactNode;
  /** Defer rendering the body until near the viewport (heavy charts). */
  lazyHeight?: number;
  style?: CSSProperties;
}) {
  const [asTable, setAsTable] = useState(false);
  const [ref, inView] = useInView<HTMLDivElement>();
  const showBody = lazyHeight === undefined || inView;
  return (
    <article className={`card glass span-${span} ${className}`} style={style}>
      <div className="card__head">
        <div className="card__heading">
          {index && (
            <div className="card__index">
              <span className="label">{index}</span>
            </div>
          )}
          <h3 className="card__title">{title}</h3>
          {sub && <p className="card__sub">{sub}</p>}
        </div>
        {(tools || table) && (
          <div className="card__tools">
            {tools}
            {table && (
              <button
                type="button"
                className="key key--sm key--icon"
                aria-pressed={asTable}
                title={asTable ? 'Show chart' : 'Show as table'}
                aria-label={asTable ? 'Show chart' : 'Show as table'}
                onClick={() => setAsTable((v) => !v)}
              >
                {asTable ? <BarChart3 size={14} /> : <Table2 size={14} />}
              </button>
            )}
          </div>
        )}
      </div>
      {insight && <p className="card__insight">{insight}</p>}
      <div className="card__body" ref={ref} style={!showBody ? { minHeight: lazyHeight } : undefined}>
        {asTable && table ? <DataTable columns={table.columns} rows={table.rows} /> : showBody ? children : null}
      </div>
      {foot && <div className="card__foot">{foot}</div>}
    </article>
  );
}

/* ----------------------------------------------------------------------------
   Stat tile
   -------------------------------------------------------------------------- */
/** Grid of stat tiles with at most `cols` columns (fewer on narrow screens). */
export function Stats({ cols = 4, children }: { cols?: number; children: ReactNode }) {
  return (
    <div className="stats" style={{ ['--cols' as string]: cols }}>
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  note,
  icon,
  text = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  icon?: ReactNode;
  /** Word values (dates, names) use a smaller size that may wrap. */
  text?: boolean;
}) {
  return (
    <div className="stat">
      <div className="stat__label">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`stat__value${text ? ' stat__value--text' : ''}`}>
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {note && <div className="stat__note">{note}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Keys
   -------------------------------------------------------------------------- */
export function Key({
  on,
  led,
  children,
  size,
  onClick,
  title,
  className = '',
}: {
  on?: boolean;
  led?: boolean;
  size?: 'sm' | 'lg';
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`key ${size ? `key--${size}` : ''} ${className}`}
      aria-pressed={on}
      onClick={onClick}
      title={title}
    >
      {led && <span className="led" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function KeyGroup<V extends string | number>({
  value,
  options,
  onChange,
  size = 'sm',
  label,
}: {
  value: V;
  options: { value: V; label: ReactNode; title?: string }[];
  onChange: (v: V) => void;
  size?: 'sm' | 'lg';
  label: string;
}) {
  return (
    <div className="key-group" role="group" aria-label={label}>
      {options.map((o) => (
        <Key key={String(o.value)} size={size === 'lg' ? 'lg' : 'sm'} on={o.value === value} led onClick={() => onChange(o.value)} title={o.title}>
          {o.label}
        </Key>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   People
   -------------------------------------------------------------------------- */
export function PersonChip({ person, full = false }: { person: Person; full?: boolean }) {
  return (
    <span className="cell-person" title={person.name}>
      <span className="swatch swatch--dot" style={{ ['--sw' as string]: person.color }} />
      <span>{full ? person.name : person.short}</span>
    </span>
  );
}

export function Legend({ items }: { items: { label: string; color: string; mark?: 'box' | 'line' | 'dot' }[] }) {
  return (
    <ul className="legend" aria-label="Legend">
      {items.map((it) => (
        <li key={it.label}>
          <span
            className={`swatch ${it.mark === 'line' ? 'swatch--line' : it.mark === 'dot' ? 'swatch--dot' : ''}`}
            style={{ ['--sw' as string]: it.color }}
          />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export function Meter({ value, max = 1, color }: { value: number; max?: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0)) * 100;
  return (
    <div className="meter" role="presentation">
      <span style={{ width: `${pct}%`, ['--meter' as string]: color }} />
    </div>
  );
}

export function CornerMarks() {
  return (
    <>
      <span className="cm cm--tl" aria-hidden="true" />
      <span className="cm cm--tr" aria-hidden="true" />
      <span className="cm cm--bl" aria-hidden="true" />
      <span className="cm cm--br" aria-hidden="true" />
    </>
  );
}
