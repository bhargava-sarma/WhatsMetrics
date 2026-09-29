import type { Stage } from '../lib/engine/client';
import { CornerMarks } from './ui/primitives';

const STAGES: { id: Stage; label: string }[] = [
  { id: 'reading', label: 'Read file' },
  { id: 'parsing', label: 'Parse messages' },
  { id: 'analyzing', label: 'Crunch numbers' },
  { id: 'rendering', label: 'Draw charts' },
];

export function Loading({ stage, fileName }: { stage: Stage; fileName: string }) {
  const idx = STAGES.findIndex((s) => s.id === stage);
  return (
    <div className="loading container" role="status" aria-live="polite">
      <div className="loading__device glass glass--strong corner-marks">
        <CornerMarks />
        <div className="device__screen">
          <div className="device__row">
            <span className="device__tag">WM–1</span>
            <span className="device__rec">
              <span className="led is-on" /> PROCESSING
            </span>
          </div>
          <div className="device__dot device__dot--sm">{STAGES[Math.max(0, idx)].label.toUpperCase()}</div>
          <div className="loading__bar">
            <span style={{ width: `${((idx + 1) / STAGES.length) * 100}%` }} />
          </div>
        </div>
        <ol className="loading__steps">
          {STAGES.map((s, i) => (
            <li key={s.id} className={i < idx ? 'is-done' : i === idx ? 'is-active' : ''}>
              <span className={`led${i <= idx ? ' is-on' : ''}`} />
              <span>{s.label}</span>
            </li>
          ))}
        </ol>
        <p className="loading__file label">{fileName}</p>
      </div>
    </div>
  );
}
