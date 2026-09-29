import type { FocusEvent, PointerEvent } from 'react';

export interface TipRow {
  label: string;
  value: string;
  color?: string;
  mark?: 'line' | 'box' | 'dot';
}

export interface TipContent {
  title?: string;
  rows?: TipRow[];
  note?: string;
}

interface TipState {
  /** Kept after hiding so the tooltip can fade out with its last content. */
  content: TipContent | null;
  visible: boolean;
  x: number;
  y: number;
}

let state: TipState = { content: null, visible: false, x: 0, y: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const tip = {
  show(content: TipContent, x: number, y: number) {
    state = { content, visible: true, x, y };
    emit();
  },
  hide() {
    if (!state.visible) return;
    state = { ...state, visible: false };
    emit();
  },
};

export const subscribeTip = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const tipSnapshot = () => state;

/** Spread onto any SVG/HTML mark to give it a hover + keyboard-focus tooltip. */
export function tipProps(content: TipContent | (() => TipContent)) {
  const get = () => (typeof content === 'function' ? content() : content);
  return {
    onPointerEnter: (e: PointerEvent) => tip.show(get(), e.clientX, e.clientY),
    onPointerMove: (e: PointerEvent) => tip.show(get(), e.clientX, e.clientY),
    onPointerLeave: () => tip.hide(),
    onFocus: (e: FocusEvent) => {
      const r = (e.currentTarget as Element).getBoundingClientRect();
      tip.show(get(), r.left + r.width / 2, r.top);
    },
    onBlur: () => tip.hide(),
  };
}

