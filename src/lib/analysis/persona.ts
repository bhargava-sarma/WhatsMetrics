import { fmtDuration, fmtInt, fmtNum, fmtPct } from '../format';
import type { PersonStats, Report } from './types';

interface Trait {
  id: string;
  noun: string;
  adj: string;
  /** Traits that shouldn't be paired in one title. */
  clashes?: string[];
  /** Absolute floor: below this the trait isn't notable, however it compares. */
  min?: number;
  value: (p: PersonStats, r: Report) => number | null;
  phrase: (p: PersonStats, r: Report) => string;
}

const TRAITS: Trait[] = [
  {
    id: 'yapper',
    noun: 'Yapper',
    adj: 'Chatty',
    value: (p, r) => p.messages / r.totals.messages,
    phrase: (p, r) => `sends ${fmtPct(p.messages / r.totals.messages)} of all messages`,
  },
  {
    id: 'novelist',
    noun: 'Storyteller',
    adj: 'Long-winded',
    clashes: ['terse'],
    min: 7,
    value: (p) => p.avgWords,
    phrase: (p) => `writes ${fmtNum(p.avgWords)} words per message`,
  },
  {
    id: 'terse',
    noun: 'Minimalist',
    adj: 'Concise',
    clashes: ['novelist'],
    min: 0.25,
    value: (p) => (p.avgWords > 0 ? 1 / p.avgWords : null),
    phrase: (p) => `keeps it to ${fmtNum(p.avgWords)} words a message`,
  },
  {
    id: 'night',
    noun: 'Night Owl',
    adj: 'Nocturnal',
    clashes: ['early'],
    min: 0.06,
    value: (p) => p.nightShare,
    phrase: (p) => `sends ${fmtPct(p.nightShare)} of messages after midnight`,
  },
  {
    id: 'early',
    noun: 'Early Bird',
    adj: 'Early-rising',
    clashes: ['night'],
    min: 0.06,
    value: (p) => p.morningShare,
    phrase: (p) => `is texting before 9 AM (${fmtPct(p.morningShare)} of messages)`,
  },
  {
    id: 'fast',
    noun: 'Speedster',
    adj: 'Lightning-fast',
    clashes: ['slow'],
    value: (p) => (p.replyCount >= 10 && p.replyMeanMs !== null ? 1 / (p.replyMeanMs / 60_000 + 0.5) : null),
    phrase: (p) => `replies within a minute ${fmtPct(p.replyQuickShare)} of the time`,
  },
  {
    id: 'slow',
    noun: 'Slow Burner',
    adj: 'Laid-back',
    clashes: ['fast'],
    min: 5,
    value: (p) => (p.replyCount >= 10 && p.replyMeanMs !== null ? p.replyMeanMs / 60_000 : null),
    phrase: (p) => `takes ${fmtDuration(p.replyMeanMs)} to reply on average`,
  },
  {
    id: 'toxic',
    noun: 'Roaster',
    adj: 'Savage',
    clashes: ['kind'],
    min: 3,
    value: (p) => p.toxicity.per100,
    phrase: (p) => `swears ${fmtNum(p.toxicity.per100)}× per 100 messages`,
  },
  {
    id: 'kind',
    noun: 'Sweetheart',
    adj: 'Wholesome',
    clashes: ['toxic'],
    min: 2,
    value: (p) => p.kindness.per100,
    phrase: (p) => `drops ${fmtNum(p.kindness.per100)} kind words per 100 messages`,
  },
  {
    id: 'funny',
    noun: 'Comedian',
    adj: 'Hilarious',
    min: 0.04,
    value: (p) => p.laughsReceived / Math.max(1, p.messages),
    phrase: (p) => `gets a laugh from ${fmtPct(p.laughsReceived / Math.max(1, p.messages))} of messages`,
  },
  {
    id: 'giggly',
    noun: 'Giggler',
    adj: 'Giggly',
    min: 0.06,
    value: (p) => p.laughs / Math.max(1, p.messages),
    phrase: (p) => `laughs in ${fmtPct(p.laughs / Math.max(1, p.messages))} of messages`,
  },
  {
    id: 'emoji',
    noun: 'Emoji Artist',
    adj: 'Expressive',
    min: 0.15,
    value: (p) => p.emojis / Math.max(1, p.messages),
    phrase: (p) => `uses ${fmtNum(p.emojis / Math.max(1, p.messages), 2)} emoji per message`,
  },
  {
    id: 'media',
    noun: 'Meme Lord',
    adj: 'Meme-slinging',
    min: 0.05,
    value: (p) => p.media / Math.max(1, p.messages),
    phrase: (p) => `shared ${fmtInt(p.media)} photos, videos & stickers`,
  },
  {
    id: 'curious',
    noun: 'Interviewer',
    adj: 'Curious',
    min: 0.05,
    value: (p) => p.questions / Math.max(1, p.textMessages),
    phrase: (p) => `asks questions in ${fmtPct(p.questions / Math.max(1, p.textMessages))} of messages`,
  },
  {
    id: 'starter',
    noun: 'Ice Breaker',
    adj: 'Chat-starting',
    value: (p, r) => p.conversationsStarted / Math.max(1, r.conversations.count),
    phrase: (p, r) => `starts ${fmtPct(p.conversationsStarted / Math.max(1, r.conversations.count))} of conversations`,
  },
  {
    id: 'positive',
    noun: 'Optimist',
    adj: 'Sunny',
    clashes: ['negative'],
    min: 110,
    value: (p) => p.sentiment.net + 100,
    phrase: () => 'keeps the mood positive',
  },
  {
    id: 'negative',
    noun: 'Cynic',
    adj: 'Moody',
    clashes: ['positive'],
    min: 100,
    value: (p) => 100 - p.sentiment.net,
    phrase: () => `isn't afraid to complain`,
  },
  {
    id: 'hype',
    noun: 'Hype Man',
    adj: 'Hyped',
    min: 0.04,
    value: (p) => p.exclaims / Math.max(1, p.textMessages),
    phrase: (p) => `uses “!” in ${fmtPct(p.exclaims / Math.max(1, p.textMessages))} of messages`,
  },
  {
    id: 'links',
    noun: 'Curator',
    adj: 'Well-read',
    min: 0.01,
    value: (p) => p.links / Math.max(1, p.messages),
    phrase: (p) => `has shared ${fmtInt(p.links)} links`,
  },
];

/**
 * Give everyone a two-word persona from their most standout traits, measured
 * against the rest of the group (scaled so it also works for 1:1 chats).
 */
export function computePersonas(r: Report) {
  const people = r.perPerson.filter((p) => !r.people[p.id].isBot && p.messages >= Math.max(10, r.totals.messages * 0.005));
  if (people.length === 0) return;
  const scores = new Map<number, { trait: Trait; score: number }[]>();
  for (const trait of TRAITS) {
    const vals = people.map((p) => trait.value(p, r));
    const valid = vals.filter((v): v is number => v !== null && Number.isFinite(v));
    if (valid.length < 2) continue;
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    const sd = Math.sqrt(valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length);
    const scale = sd + 0.25 * Math.abs(mean) + 1e-9;
    // "Starts conversations" only counts when clearly above a fair share.
    const floor = trait.id === 'starter' ? 1.3 / people.length : trait.id === 'yapper' ? 1.15 / people.length : trait.min;
    people.forEach((p, i) => {
      const v = vals[i];
      if (v === null || !Number.isFinite(v) || (floor !== undefined && v < floor)) return;
      const list = scores.get(p.id) ?? [];
      list.push({ trait, score: (v - mean) / scale });
      scores.set(p.id, list);
    });
  }
  for (const p of people) {
    const ranked = (scores.get(p.id) ?? []).sort((a, b) => b.score - a.score);
    const first = ranked[0];
    if (!first) continue;
    const second = ranked.find(
      (x) => x.trait.id !== first.trait.id && !(first.trait.clashes ?? []).includes(x.trait.id) && x.score > 0,
    );
    const title = second ? `${second.trait.adj} ${first.trait.noun}` : `The ${first.trait.noun}`;
    const phrases = [first, second].filter(Boolean).map((x) => x!.trait.phrase(p, r));
    const blurb = phrases.length ? phrases.join(' and ') : '';
    r.perPerson[p.id].persona = {
      title,
      blurb: blurb ? blurb[0].toUpperCase() + blurb.slice(1) + '.' : '',
      traits: ranked.filter((x) => x.score > 0.2).map((x) => x.trait.noun).slice(0, 4),
    };
  }
}
