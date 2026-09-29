/** Formatting helpers shared by the analysis engine and the UI. All dates are UTC-encoded wall clock. */

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const intFmt = new Intl.NumberFormat('en-US');

export function fmtInt(n: number): string {
  return intFmt.format(Math.round(n));
}

/** 1,284 · 12.9K · 4.2M — compact for big standalone figures. */
export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs < 10_000) return fmtInt(n);
  if (abs < 1_000_000) return `${(n / 1000).toFixed(abs < 100_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

export function fmtNum(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '–';
  return n.toFixed(digits).replace(/\.0+$/, '');
}

export function fmtPct(fraction: number, digits = 0): string {
  if (!Number.isFinite(fraction)) return '–';
  const v = fraction * 100;
  if (v > 0 && v < 1 && digits === 0) return '<1%';
  return `${v.toFixed(digits)}%`;
}

/** Durations: "same min", "45s", "3 min", "1h 20m", "2.5 days". */
export function fmtDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '–';
  const s = ms / 1000;
  if (s < 1) return '< 1 min';
  if (s < 60) return `${Math.round(s)}s`;
  const min = s / 60;
  if (min < 60) return `${fmtNum(min, min < 10 ? 1 : 0)} min`;
  const h = min / 60;
  if (h < 24) {
    const whole = Math.floor(h);
    const rest = Math.round(min - whole * 60);
    return rest ? `${whole}h ${rest}m` : `${whole}h`;
  }
  const d = h / 24;
  return `${fmtNum(d, d < 10 ? 1 : 0)} days`;
}

export function fmtDays(days: number): string {
  const d = Math.round(days);
  return `${fmtInt(d)} ${d === 1 ? 'day' : 'days'}`;
}

export function fmtDate(ts: number, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = new Date(ts);
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  const withYear = opts.year === false ? base : `${base} ${d.getUTCFullYear()}`;
  return opts.weekday ? `${WEEKDAYS_SHORT[(d.getUTCDay() + 6) % 7]}, ${withYear}` : withYear;
}

export function fmtMonth(ts: number, long = false): string {
  const d = new Date(ts);
  return `${(long ? MONTHS_LONG : MONTHS)[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function fmtHour(h: number, compact = false): string {
  const suffix = h < 12 ? (compact ? 'a' : ' AM') : compact ? 'p' : ' PM';
  return `${h % 12 || 12}${suffix}`;
}

export function fmtHourRange(h: number): string {
  return `${fmtHour(h)}–${fmtHour((h + 1) % 24)}`;
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${fmtInt(n)} ${Math.round(n) === 1 ? one : many}`;
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
