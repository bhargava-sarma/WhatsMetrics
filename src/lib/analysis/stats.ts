export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = Float64Array.from(values).sort();
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function topN<K>(map: Map<K, number>, n: number): [K, number][] {
  const out: [K, number][] = [];
  for (const entry of map) {
    if (out.length < n) {
      out.push(entry);
      if (out.length === n) out.sort((a, b) => b[1] - a[1]);
    } else if (entry[1] > out[n - 1][1]) {
      out[n - 1] = entry;
      for (let i = n - 1; i > 0 && out[i][1] > out[i - 1][1]; i--) [out[i], out[i - 1]] = [out[i - 1], out[i]];
    }
  }
  return out.length < n ? out.sort((a, b) => b[1] - a[1]) : out;
}

export function bump<K>(map: Map<K, number>, key: K, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

export function argmax(values: number[]): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return best;
}

/**
 * Moving-average type-token ratio: vocabulary variety that doesn't punish people
 * for writing more. Returns 0–1, or null when there's too little text to judge.
 */
export function mattr(tokens: string[], window = 200): number | null {
  if (tokens.length < 60) return null;
  if (tokens.length < window) return new Set(tokens).size / tokens.length;
  const counts = new Map<string, number>();
  let unique = 0;
  const add = (t: string) => {
    const c = counts.get(t) ?? 0;
    if (c === 0) unique++;
    counts.set(t, c + 1);
  };
  const remove = (t: string) => {
    const c = counts.get(t)!;
    if (c === 1) {
      unique--;
      counts.delete(t);
    } else counts.set(t, c - 1);
  };
  for (let i = 0; i < window; i++) add(tokens[i]);
  let sum = unique / window;
  for (let i = window; i < tokens.length; i++) {
    remove(tokens[i - window]);
    add(tokens[i]);
    sum += unique / window;
  }
  return sum / (tokens.length - window + 1);
}

/**
 * Words (or emoji) a person uses distinctively more than everyone else: weighted
 * log-odds with an informative Dirichlet prior (Monroe, Colaresi & Quinn 2008).
 * Returns [item, z-score] pairs, strongest first.
 */
export function distinctive<K>(
  mine: Map<K, number>,
  mineTotal: number,
  all: Map<K, number>,
  allTotal: number,
  { minCount = 3, limit = 8, alpha0 = 2000 } = {},
): [K, number][] {
  const restTotal = allTotal - mineTotal;
  if (mineTotal === 0 || restTotal <= 0) return [];
  const a0 = Math.min(alpha0, allTotal);
  const scored: [K, number][] = [];
  for (const [item, yi] of mine) {
    if (yi < minCount) continue;
    const yAll = all.get(item) ?? yi;
    const yj = yAll - yi;
    const aw = (a0 * yAll) / allTotal;
    const delta =
      Math.log((yi + aw) / (mineTotal + a0 - yi - aw)) - Math.log((yj + aw) / (restTotal + a0 - yj - aw));
    const z = delta / Math.sqrt(1 / (yi + aw) + 1 / (yj + aw));
    if (z > 1.96) scored.push([item, z]);
  }
  return scored.sort((a, b) => b[1] - a[1]).slice(0, limit);
}

/** Longest run of consecutive integers (day numbers) in a sorted list. */
export function longestRun(sortedDays: number[]): { start: number; end: number; length: number } | null {
  if (sortedDays.length === 0) return null;
  let best = { start: sortedDays[0], end: sortedDays[0], length: 1 };
  let start = sortedDays[0];
  for (let i = 1; i < sortedDays.length; i++) {
    if (sortedDays[i] !== sortedDays[i - 1] + 1) start = sortedDays[i];
    const length = sortedDays[i] - start + 1;
    if (length > best.length) best = { start, end: sortedDays[i], length };
  }
  return best;
}

/** Normalised Shannon entropy of a distribution (1 = perfectly even). */
export function evenness(counts: number[]): number {
  const nonZero = counts.filter((c) => c > 0);
  if (nonZero.length <= 1) return nonZero.length === 1 ? 0 : 1;
  const total = nonZero.reduce((a, b) => a + b, 0);
  let h = 0;
  for (const c of nonZero) {
    const p = c / total;
    h -= p * Math.log(p);
  }
  return h / Math.log(nonZero.length);
}

export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.round(p * (sortedValues.length - 1))));
  return sortedValues[idx];
}
