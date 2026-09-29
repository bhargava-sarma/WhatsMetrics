import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { subscribeTip, tip, tipSnapshot } from './tip';

export function Tooltip() {
  const s = useSyncExternalStore(subscribeTip, tipSnapshot, tipSnapshot);
  const ref = useRef<HTMLDivElement>(null);
  const content = s.content;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pad = 14;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let x = s.x + pad;
    let y = s.y - h - pad;
    if (x + w > window.innerWidth - 8) x = s.x - w - pad;
    if (x < 8) x = 8;
    if (y < 8) y = s.y + pad + 6;
    el.style.setProperty('--tx', `${Math.round(x)}px`);
    el.style.setProperty('--ty', `${Math.round(y)}px`);
  }, [s]);

  useLayoutEffect(() => {
    const hide = () => tip.hide();
    window.addEventListener('scroll', hide, { passive: true });
    return () => window.removeEventListener('scroll', hide);
  }, []);

  return (
    <div ref={ref} className={`tooltip${s.visible ? ' is-visible' : ''}`} role="tooltip" aria-hidden={!s.visible}>
      {content?.title && <div className="tooltip__title">{content.title}</div>}
      {content?.rows?.map((r, i) => (
        <div className="tooltip__row" key={i}>
          <span className="tooltip__key">
            {r.color && (
              <span
                className={`swatch ${r.mark === 'line' ? 'swatch--line' : r.mark === 'dot' ? 'swatch--dot' : ''}`}
                style={{ ['--sw' as string]: r.color }}
              />
            )}
            <span>{r.label}</span>
          </span>
          <span className="tooltip__value">{r.value}</span>
        </div>
      ))}
      {content?.note && <div className="tooltip__note">{content.note}</div>}
    </div>
  );
}
