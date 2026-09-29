import type { ParsedChat } from '../parser/types';
import type { Person } from './types';

/**
 * Categorical palette for people, derived from Teenage Engineering OP-1 hues and
 * validated (OKLCH band, chroma, colour-blind separation, contrast) against the
 * dark chart surface. Order matters: it maximises separation between neighbours.
 */
export const PALETTE = ['#ed6300', '#3d7efc', '#df4e92', '#bf8b00', '#04a3be', '#d73337', '#8b61e3', '#06ae64'];
export const OTHERS_COLOR = '#6e6e78';
export const MAX_CAST = 7;

const BOT_RE = /^(meta ai|chatgpt|.*\bbot)$/i;

export function shortName(name: string, all: string[]): string {
  if (/^[+\d]/.test(name)) return name;
  let short = name.replace(/\s*[([{].*?[)\]}]\s*/g, ' ').trim() || name;
  if (short.length > 14) short = short.split(/\s+/)[0];
  const clash = all.some((other) => other !== name && other.startsWith(short + ' '));
  return clash ? name : short;
}

/**
 * Colours follow the person, never the filter: slots are assigned by all-time
 * message count so a person keeps their colour when the period changes.
 */
export function buildPeople(chat: ParsedChat): Person[] {
  const counts = new Array<number>(chat.participants.length).fill(0);
  for (const m of chat.messages) counts[m.author]++;
  const total = counts.reduce((a, b) => a + b, 0);
  const order = counts.map((_, i) => i).sort((a, b) => counts[b] - counts[a] || a - b);
  const isBot = chat.participants.map((n) => BOT_RE.test(n));

  const cast: number[] = [];
  for (const id of order) {
    if (cast.length >= MAX_CAST) break;
    if (isBot[id]) continue;
    // Near-silent members (< 1% of messages) fold into grey "Others" to keep legends readable.
    if (cast.length < 2 || counts[id] / total >= 0.01) cast.push(id);
  }

  return chat.participants.map((name, id) => {
    const slot = cast.indexOf(id);
    return {
      id,
      name,
      short: shortName(name, chat.participants),
      color: slot >= 0 ? PALETTE[slot] : OTHERS_COLOR,
      slot,
      isBot: isBot[id],
      inCast: slot >= 0,
    };
  });
}
