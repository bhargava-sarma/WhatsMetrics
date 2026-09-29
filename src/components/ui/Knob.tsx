import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

/**
 * Teenage-Engineering-style rotary knob over a list of discrete steps.
 * Drag up/down, scroll, click, or use the arrow keys.
 */
export function Knob<V>({
  value,
  options,
  onChange,
  label,
  format,
}: {
  value: V;
  options: V[];
  onChange: (v: V) => void;
  label: string;
  format: (v: V) => string;
}) {
  const idx = Math.max(0, options.indexOf(value));
  const drag = useRef<{ y: number; idx: number } | null>(null);
  const angle = -135 + (270 * idx) / Math.max(1, options.length - 1);

  const set = (i: number) => {
    const next = Math.max(0, Math.min(options.length - 1, i));
    if (next !== idx) onChange(options[next]);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, idx };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const steps = Math.round((drag.current.y - e.clientY) / 18);
    set(drag.current.idx + steps);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current && Math.abs(drag.current.y - e.clientY) < 3) set(idx + 1 >= options.length ? 0 : idx + 1);
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(idx + 1);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(idx - 1);
    else if (e.key === 'Home') set(0);
    else if (e.key === 'End') set(options.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div className="knob-control">
      <div className="knob-wrap">
        <span className="knob-ring" aria-hidden="true" />
        <div
          className="knob"
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={options.length - 1}
          aria-valuenow={idx}
          aria-valuetext={format(value)}
          style={{ ['--angle' as string]: `${angle}deg` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={onKeyDown}
          onWheel={(e) => set(idx + (e.deltaY < 0 ? 1 : -1))}
        />
      </div>
      <div className="knob-readout">
        <span className="label">{label}</span>
        <span className="knob-value">{format(value)}</span>
      </div>
    </div>
  );
}
