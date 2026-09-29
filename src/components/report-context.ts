import { createContext, useContext } from 'react';
import type { Person, PersonStats, Report } from '../lib/analysis/types';
import { HINGLISH_ONLY_TOXIC, TOXIC_WORDS, maskWord } from '../lib/analysis/lexicons/toxicity';
import type { SeriesDef } from './charts/Svg';

export interface ReportCtx {
  report: Report;
  censor: boolean;
}

export const ReportContext = createContext<ReportCtx | null>(null);

export function useReport(): ReportCtx {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error('ReportContext missing');
  return ctx;
}

export function seriesDefs(r: Report): SeriesDef[] {
  return r.series.map((_, i) => ({ name: r.seriesNames[i], color: r.seriesColors[i] }));
}

/** Humans with at least one message in the period, most active first. */
export function activePeople(r: Report, min = 1): { person: Person; stats: PersonStats }[] {
  return r.perPerson
    .filter((p) => p.messages >= min && !r.people[p.id].isBot)
    .sort((a, b) => b.messages - a.messages)
    .map((stats) => ({ person: r.people[stats.id], stats }));
}

/** Cast members (colour-coded people) in palette order. */
export function castPeople(r: Report): { person: Person; stats: PersonStats }[] {
  return r.series.filter((id) => id >= 0).map((id) => ({ person: r.people[id], stats: r.perPerson[id] }));
}

/** Enough activity for rate-based comparisons to be fair. */
export function eligible(r: Report) {
  const min = Math.max(20, Math.round(r.totals.messages * 0.01));
  return activePeople(r, min);
}

const WORD_RE = /[\p{L}\p{M}\p{N}]+/gu;

export function censorWord(word: string, on: boolean, hinglish: boolean): string {
  if (!on) return word;
  const w = word.toLowerCase();
  // Mild insults ("trash", "clown") stay readable; profanity and slurs are masked.
  if ((TOXIC_WORDS.get(w) ?? 0) >= 2 || (hinglish && HINGLISH_ONLY_TOXIC.has(w))) return maskWord(word);
  return word;
}

/** Mask swear words inside free text when censoring is on. */
export function censorText(text: string, on: boolean, hinglish: boolean): string {
  if (!on) return text;
  return text.replace(WORD_RE, (w) => censorWord(w, true, hinglish));
}

export function personColor(r: Report, id: number): string {
  return r.people[id]?.color ?? '#6e6e78';
}
