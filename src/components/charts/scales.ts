import { scaleLinear } from 'd3-scale';

/** Sequential "heat" ramp (dark → vivid amber) — mirrors --heat-* tokens. */
export const HEAT = ['#451406', '#702101', '#993700', '#c14f02', '#e47001', '#fb9a09', '#ffcc5f'];
export const HEAT_EMPTY = '#1b1b1f';

/** Blue single-hue ramp for a second sequential context (e.g. reply speed). */
export const BLUE = ['#1a2d51', '#2a4371', '#3c5a94', '#4e73b8', '#618ddd', '#78a7ff', '#a5c5fe'];

export const POS = '#2389e2';
export const NEG = '#db4241';
export const NEUTRAL = '#4a4a50';
export const ACCENT = '#ff6a14';

/** Map t ∈ [0,1] onto a discrete ramp (0 → empty handled by caller). */
export function rampColor(t: number, ramp: string[] = HEAT): string {
  const i = Math.min(ramp.length - 1, Math.max(0, Math.floor(t * ramp.length)));
  return ramp[i];
}

/**
 * Quantile thresholds for skewed counts (calendar days): each ramp step holds
 * roughly the same number of non-zero values, so quiet and busy days both read.
 */
export function quantileScale(values: number[], steps = HEAT.length): (v: number) => number {
  const nz = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (nz.length === 0) return () => -1;
  const cuts: number[] = [];
  for (let i = 1; i < steps; i++) cuts.push(nz[Math.floor((i / steps) * (nz.length - 1))]);
  return (v: number) => {
    if (v <= 0) return -1;
    let i = 0;
    while (i < cuts.length && v > cuts[i]) i++;
    return i;
  };
}

/** Round an axis maximum up to a clean value (1, 2, 2.5, 5 × 10^n). */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * exp) return m * exp;
  return 10 * exp;
}

export function ticks(max: number, count = 4): number[] {
  const step = max / count;
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

/** White or ink text on top of a fill, by luminance. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? '#111' : '#fff';
}

/** Clean axis: d3's "nice" domain and round tick values (0, 500, 1,000 …). */
export function niceAxis(max: number, count = 4, min = 0): { min: number; max: number; ticks: number[] } {
  const s = scaleLinear()
    .domain([Math.min(0, min), Math.max(max, min + 1e-9, 1)])
    .nice(count);
  const [lo, hi] = s.domain();
  return { min: lo, max: hi, ticks: s.ticks(count) };
}
