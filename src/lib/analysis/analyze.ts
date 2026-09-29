import type { ChatMessage, ParsedChat } from '../parser/types';
import { chatFeatures, collapseTrailing, isContentWord, isLaughToken, type MsgFeatures } from './features';
import { STOPWORDS } from './lexicons/stopwords';
import { TOPICS } from './lexicons/topics';
import { buildPeople, OTHERS_COLOR } from './people';
import { computeAwards } from './awards';
import { computePersonas } from './persona';
import { computeVibeTags } from './vibetags';
import {
  DAY,
  HOUR,
  MINUTE,
  argmax,
  bump,
  distinctive,
  evenness,
  longestRun,
  mattr,
  median,
  percentile,
  topN,
} from './stats';
import {
  EMOTIONS,
  KIND_CATEGORIES,
  type AnalyzeOptions,
  type Conversation,
  type DayScore,
  type Emotion,
  type KindCategory,
  type MessageRef,
  type MonthPoint,
  type PersonStats,
  type Report,
  type Span,
} from './types';

/** Replies slower than this aren't really replies — the chat just moved on. */
const REPLY_CAP = 12 * HOUR;
export const REPLY_BUCKET_LIMITS = [MINUTE, 5 * MINUTE, 15 * MINUTE, HOUR, 3 * HOUR, REPLY_CAP];
export const REPLY_BUCKET_LABELS = ['< 1 min', '1–5 min', '5–15 min', '15–60 min', '1–3 h', '3–12 h'];
const DOUBLE_TEXT_GAP = 20 * MINUTE;
const LAUGH_LOOKBACK = 5 * MINUTE;
const MILESTONES = [1, 100, 1000, 5000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];
const LENGTH_BUCKETS: [number, string][] = [
  [1, '1'],
  [3, '2–3'],
  [6, '4–6'],
  [10, '7–10'],
  [20, '11–20'],
  [50, '21–50'],
  [Infinity, '51+'],
];
const SIZE_BUCKETS: [number, string][] = [
  [1, '1'],
  [5, '2–5'],
  [20, '6–20'],
  [50, '21–50'],
  [100, '51–100'],
  [250, '101–250'],
  [Infinity, '250+'],
];
const MAX_STREAM_TOKENS = 40_000;

const preview = (text: string, max = 280) => (text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text);
const clean = (text: string) => text.replace(/[\u2068\u2069\u200e\u200f]/g, '');

function lowerBound(messages: ChatMessage[], ts: number): number {
  let lo = 0;
  let hi = messages.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (messages[mid].ts < ts) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function emptyRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

interface Acc {
  messages: number;
  textMessages: number;
  words: number;
  chars: number;
  media: number;
  mediaKinds: Record<string, number>;
  links: number;
  emojis: number;
  deleted: number;
  edited: number;
  polls: number;
  mentionsSent: number;
  mentionsReceived: number;
  questions: number;
  exclaims: number;
  caps: number;
  laughs: number;
  laughsReceived: number;
  oneWord: number;
  longest: MessageRef | null;
  days: Set<number>;
  first: MessageRef | null;
  last: MessageRef | null;
  lastTs: number;
  absence: Span | null;
  hourly: number[];
  weekday: number[];
  replyTimes: number[];
  replyBuckets: number[];
  started: number;
  ended: number;
  turns: number;
  turnMessages: number;
  maxBurst: { count: number; ts: number } | null;
  doubleTexts: number;
  sentSum: number;
  sentCount: number;
  pos: number;
  neg: number;
  toxWeight: number;
  toxMessages: number;
  swears: Map<string, number>;
  kindWeight: number;
  kindMessages: number;
  kindCats: Record<KindCategory, number>;
  emotions: Record<Emotion, number>;
  wordCounts: Map<string, number>;
  contentTotal: number;
  stream: string[];
  emojiCounts: Map<string, number>;
  domains: Map<string, number>;
  topics: number[];
  repliesTo: number[];
}

function newAcc(people: number): Acc {
  return {
    messages: 0,
    textMessages: 0,
    words: 0,
    chars: 0,
    media: 0,
    mediaKinds: {},
    links: 0,
    emojis: 0,
    deleted: 0,
    edited: 0,
    polls: 0,
    mentionsSent: 0,
    mentionsReceived: 0,
    questions: 0,
    exclaims: 0,
    caps: 0,
    laughs: 0,
    laughsReceived: 0,
    oneWord: 0,
    longest: null,
    days: new Set(),
    first: null,
    last: null,
    lastTs: -1,
    absence: null,
    hourly: new Array(24).fill(0),
    weekday: new Array(7).fill(0),
    replyTimes: [],
    replyBuckets: new Array(REPLY_BUCKET_LIMITS.length).fill(0),
    started: 0,
    ended: 0,
    turns: 0,
    turnMessages: 0,
    maxBurst: null,
    doubleTexts: 0,
    sentSum: 0,
    sentCount: 0,
    pos: 0,
    neg: 0,
    toxWeight: 0,
    toxMessages: 0,
    swears: new Map(),
    kindWeight: 0,
    kindMessages: 0,
    kindCats: emptyRecord(KIND_CATEGORIES),
    emotions: emptyRecord(EMOTIONS),
    wordCounts: new Map(),
    contentTotal: 0,
    stream: [],
    emojiCounts: new Map(),
    domains: new Map(),
    topics: new Array(TOPICS.length).fill(0),
    repliesTo: new Array(people).fill(0),
  };
}

function replyBucket(dt: number): number {
  for (let b = 0; b < REPLY_BUCKET_LIMITS.length; b++) if (dt < REPLY_BUCKET_LIMITS[b]) return b;
  return REPLY_BUCKET_LIMITS.length - 1;
}

function mentionResolver(participants: string[]) {
  const byName = new Map<string, number>();
  const byDigits = new Map<string, number>();
  participants.forEach((name, id) => {
    byName.set(name.toLowerCase(), id);
    const digits = name.replace(/\D/g, '');
    if (digits.length >= 7) byDigits.set(digits.slice(-10), id);
  });
  return (mention: string): number => {
    const direct = byName.get(mention.toLowerCase());
    if (direct !== undefined) return direct;
    const digits = mention.replace(/\D/g, '');
    return digits.length >= 7 ? (byDigits.get(digits.slice(-10)) ?? -1) : -1;
  };
}

export function analyze(chat: ParsedChat, fileName: string, chatName: string, opts: AnalyzeOptions): Report {
  const t0 = performance.now();
  const { features: allFeatures, hinglish, hinglishShare } = chatFeatures(chat);
  const people = buildPeople(chat);
  const P = people.length;
  const gapMs = opts.gapMinutes * MINUTE;

  const i0 = opts.from === undefined ? 0 : lowerBound(chat.messages, opts.from);
  const i1 = opts.to === undefined ? chat.messages.length : lowerBound(chat.messages, opts.to);
  const msgs = chat.messages.slice(i0, i1);
  const feats = allFeatures.slice(i0, i1);
  const n = msgs.length;
  if (n === 0) throw new Error('No messages in the selected period.');

  // ---- series (cast + optional "Others") -------------------------------------------
  const inRange = new Array<number>(P).fill(0);
  for (const m of msgs) inRange[m.author]++;
  const cast = people.filter((p) => p.inCast).sort((a, b) => a.slot - b.slot);
  const othersCount = people.filter((p) => !p.inCast).reduce((s, p) => s + inRange[p.id], 0);
  const series = cast.map((p) => p.id);
  if (othersCount / n >= 0.01) series.push(-1);
  const seriesOf = new Array<number>(P).fill(-1);
  cast.forEach((p, i) => (seriesOf[p.id] = i));
  const othersIdx = series.indexOf(-1);
  if (othersIdx >= 0) people.forEach((p) => !p.inCast && (seriesOf[p.id] = othersIdx));
  const S = series.length;

  // ---- accumulators -------------------------------------------------------------------
  const acc = people.map(() => newAcc(P));
  const day0 = Math.floor(msgs[0].ts / DAY);
  const dayN = Math.floor(msgs[n - 1].ts / DAY);
  const nDays = dayN - day0 + 1;
  const dayCounts = new Array<number>(nDays).fill(0);
  const dayNet = new Float64Array(nDays);
  const dayTox = new Float64Array(nDays);
  const dayKind = new Float64Array(nDays);
  const dayCast = new Uint32Array(nDays);
  const hourly = new Array<number>(24).fill(0);
  const weekday = new Array<number>(7).fill(0);
  const weekdayHour = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const monthOfYear = new Array<number>(12).fill(0);
  const monthly = new Map<number, MonthPoint & { sent: number; pos: number; neg: number; tox: number; kind: number; emoji: number }>();
  const yearly = new Map<number, { count: number; bySeries: number[] }>();
  const hourSlots = new Map<number, number>();
  const replyByHour: number[][] = Array.from({ length: 24 }, () => []);
  const replyMatrix = Array.from({ length: P }, () => new Array<number>(P).fill(0));
  const mentionMatrix = Array.from({ length: P }, () => new Array<number>(P).fill(0));
  const wordCounts = new Map<string, number>();
  let contentTotal = 0;
  const bigrams = new Map<string, number>();
  const trigrams = new Map<string, number>();
  const emojiCounts = new Map<string, number>();
  const domains = new Map<string, number>();
  const laughTypes = new Map<string, number>();
  const swears = new Map<string, number>();
  const kindWords = new Map<string, number>();
  const topicCounts = TOPICS.map(() => new Array<number>(S).fill(0));
  const lengthBuckets = LENGTH_BUCKETS.map(() => new Array<number>(S).fill(0));
  const longestMessages: MessageRef[] = [];
  const milestones: Report['moments']['milestones'] = [];
  const polls: Report['moments']['polls'] = [];
  const events: Report['moments']['events'] = [];
  const conversations: Conversation[] = [];
  const startsByHour = new Array<number>(24).fill(0);
  const resolveMention = mentionResolver(chat.participants);
  const mediaKinds: Record<string, number> = {};
  const totals = {
    textMessages: 0,
    words: 0,
    chars: 0,
    media: 0,
    links: 0,
    emojis: 0,
    deleted: 0,
    edited: 0,
    polls: 0,
    events: 0,
    locations: 0,
    contacts: 0,
    calls: 0,
    mentions: 0,
    questions: 0,
    laughs: 0,
    emojiMessages: 0,
  };
  let silence: (Span & { brokenBy: number }) | null = null;

  let convo: Conversation | null = null;
  let turnAuthor = -1;
  let turnCount = 0;
  let turnStartTs = 0;
  let curDay = -1;
  let curMonthKey = 0;
  let curYear = 0;
  let curMonth = 0;

  const closeTurn = () => {
    if (turnAuthor < 0) return;
    const a = acc[turnAuthor];
    a.turns++;
    a.turnMessages += turnCount;
    if (!a.maxBurst || turnCount > a.maxBurst.count) a.maxBurst = { count: turnCount, ts: turnStartTs };
  };
  const closeConvo = (lastAuthor: number) => {
    if (!convo) return;
    acc[lastAuthor].ended++;
    conversations.push(convo);
  };

  for (let i = 0; i < n; i++) {
    const m = msgs[i];
    const f: MsgFeatures | null = feats[i];
    const a = m.author;
    const pa = acc[a];
    const s = seriesOf[a];
    const ts = m.ts;
    const day = Math.floor(ts / DAY);
    const hour = Math.floor((ts % DAY) / HOUR);
    const wd = (day + 3) % 7; // Monday = 0
    if (day !== curDay) {
      curDay = day;
      const d = new Date(ts);
      curYear = d.getUTCFullYear();
      curMonth = d.getUTCMonth();
      curMonthKey = Date.UTC(curYear, curMonth, 1);
    }
    const prev = i > 0 ? msgs[i - 1] : null;
    const dt = prev ? ts - prev.ts : Infinity;

    // -- volume & kinds
    pa.messages++;
    if (MILESTONES.includes(i + 1)) {
      milestones.push({ n: i + 1, ts, author: a, text: preview(clean(m.text) || `[${m.kind}]`, 140) });
    }
    switch (m.kind) {
      case 'text':
        pa.textMessages++;
        totals.textMessages++;
        break;
      case 'media': {
        pa.media++;
        totals.media++;
        const k = m.media ?? 'other';
        pa.mediaKinds[k] = (pa.mediaKinds[k] ?? 0) + 1;
        mediaKinds[k] = (mediaKinds[k] ?? 0) + 1;
        break;
      }
      case 'deleted':
        pa.deleted++;
        totals.deleted++;
        break;
      case 'poll':
        pa.polls++;
        totals.polls++;
        if (m.poll) polls.push({ ts, author: a, poll: m.poll });
        break;
      case 'event':
        totals.events++;
        events.push({ ts, author: a, title: m.text });
        break;
      case 'location':
        totals.locations++;
        break;
      case 'contact':
        totals.contacts++;
        break;
      case 'call':
        totals.calls++;
        break;
    }
    if (m.edited) {
      pa.edited++;
      totals.edited++;
    }

    // -- time
    dayCounts[day - day0]++;
    if (people[a].inCast) dayCast[day - day0] |= 1 << people[a].slot;
    hourly[hour]++;
    weekday[wd]++;
    weekdayHour[wd][hour]++;
    monthOfYear[curMonth]++;
    let mp = monthly.get(curMonthKey);
    if (!mp) {
      mp = { ts: curMonthKey, total: 0, bySeries: new Array(S).fill(0), sent: 0, pos: 0, neg: 0, tox: 0, kind: 0, emoji: 0 };
      monthly.set(curMonthKey, mp);
    }
    mp.total++;
    let yp = yearly.get(curYear);
    if (!yp) {
      yp = { count: 0, bySeries: new Array(S).fill(0) };
      yearly.set(curYear, yp);
    }
    yp.count++;
    if (s >= 0) {
      mp.bySeries[s]++;
      yp.bySeries[s]++;
    }
    bump(hourSlots, day * 24 + hour);
    pa.hourly[hour]++;
    pa.weekday[wd]++;
    pa.days.add(day);
    if (pa.lastTs >= 0) {
      const gap = ts - pa.lastTs;
      if (!pa.absence || gap > pa.absence.end - pa.absence.start) {
        pa.absence = { start: pa.lastTs, end: ts, days: gap / DAY };
      }
    }
    pa.lastTs = ts;
    const ref = () => ({ ts, author: a, text: preview(clean(m.text)), words: f?.words ?? 0 });
    if (!pa.first) pa.first = ref();
    pa.last = null; // resolved after the loop (cheaper than building refs per message)
    if (prev && dt > (silence ? silence.end - silence.start : 0)) {
      silence = { start: prev.ts, end: ts, days: dt / DAY, brokenBy: a };
    }

    // -- conversations, turns & replies
    const newConvo = !prev || dt > gapMs;
    if (newConvo) {
      if (prev) closeConvo(prev.author);
      convo = { start: ts, end: ts, messages: 0, participants: [], starter: a };
      pa.started++;
      startsByHour[hour]++;
    }
    const c = convo!;
    c.end = ts;
    c.messages++;
    if (!c.participants.includes(a)) c.participants.push(a);

    if (prev && prev.author !== a) {
      if (dt <= REPLY_CAP) {
        pa.replyTimes.push(dt);
        pa.replyBuckets[replyBucket(dt)]++;
        replyByHour[hour].push(dt);
      }
      if (!newConvo) {
        replyMatrix[a][prev.author]++;
        pa.repliesTo[prev.author]++;
      }
    }
    if (a !== turnAuthor || newConvo) {
      closeTurn();
      turnAuthor = a;
      turnCount = 1;
      turnStartTs = ts;
    } else {
      turnCount++;
      if (dt >= DOUBLE_TEXT_GAP) pa.doubleTexts++;
    }

    // -- text features
    if (!f) continue;
    const textual = m.kind === 'text' || m.kind === 'media' || m.kind === 'poll';
    if (textual) {
      pa.words += f.words;
      pa.chars += f.chars;
      totals.words += f.words;
      totals.chars += f.chars;
      if (m.kind === 'text') {
        if (f.words === 1) pa.oneWord++;
        let b = 0;
        while (f.words > LENGTH_BUCKETS[b][0]) b++;
        if (s >= 0 && f.words > 0) lengthBuckets[b][s]++;
      }
      if (!pa.longest || f.words > (pa.longest.words ?? 0)) pa.longest = ref();
      if (f.words >= 40) {
        longestMessages.push(ref());
        if (longestMessages.length > 40) {
          longestMessages.sort((x, y) => (y.words ?? 0) - (x.words ?? 0));
          longestMessages.length = 10;
        }
      }
    }
    if (f.emojis.length) {
      pa.emojis += f.emojis.length;
      totals.emojis += f.emojis.length;
      totals.emojiMessages++;
      mp.emoji += f.emojis.length;
      for (const e of f.emojis) {
        bump(emojiCounts, e);
        bump(pa.emojiCounts, e);
      }
    }
    if (f.domains.length) {
      pa.links += f.domains.length;
      totals.links += f.domains.length;
      for (const d of f.domains) {
        bump(domains, d);
        bump(pa.domains, d);
      }
    }
    for (const name of f.mentions) {
      const target = resolveMention(name);
      pa.mentionsSent++;
      totals.mentions++;
      if (target >= 0 && target !== a) {
        acc[target].mentionsReceived++;
        mentionMatrix[a][target]++;
      }
    }
    if (m.kind === 'text') {
      if (f.question) {
        pa.questions++;
        totals.questions++;
      }
      if (f.exclaim) pa.exclaims++;
      if (f.caps) pa.caps++;
    }
    if (f.laughs.length) {
      pa.laughs++;
      totals.laughs++;
      for (const l of f.laughs) bump(laughTypes, l);
      // Credit the most recent message from someone else as the joke.
      for (let j = i - 1; j >= 0 && ts - msgs[j].ts <= LAUGH_LOOKBACK; j--) {
        if (msgs[j].author !== a) {
          acc[msgs[j].author].laughsReceived++;
          break;
        }
      }
    }

    // sentiment
    if (f.tokens.length || f.emojis.length) {
      pa.sentSum += f.sentiment;
      pa.sentCount++;
      mp.sent++;
      if (f.sentiment > 0) {
        pa.pos++;
        mp.pos++;
        dayNet[day - day0]++;
      } else if (f.sentiment < 0) {
        pa.neg++;
        mp.neg++;
        dayNet[day - day0]--;
      }
    }
    const tox = f.tox + (hinglish ? f.toxH : 0);
    if (tox > 0) {
      pa.toxWeight += tox;
      pa.toxMessages++;
      mp.tox++;
      dayTox[day - day0]++;
      for (const w of f.toxWords) {
        bump(swears, w);
        bump(pa.swears, w);
      }
      if (hinglish) {
        for (const w of f.toxHWords) {
          bump(swears, w);
          bump(pa.swears, w);
        }
      }
    }
    if (f.kind > 0) {
      pa.kindWeight += f.kind;
      pa.kindMessages++;
      mp.kind++;
      dayKind[day - day0]++;
      KIND_CATEGORIES.forEach((k, bit) => {
        if (f.kindCats & (1 << bit)) pa.kindCats[k]++;
      });
      for (const w of f.kindWords) bump(kindWords, w);
    }
    if (f.emotions) {
      EMOTIONS.forEach((e, bit) => {
        if (f.emotions & (1 << bit)) pa.emotions[e]++;
      });
    }
    if (f.topics) {
      for (let t = 0; t < TOPICS.length; t++) {
        if (f.topics & (1 << t)) {
          pa.topics[t]++;
          if (s >= 0) topicCounts[t][s]++;
        }
      }
    }

    // words & phrases
    if (f.tokens.length && textual) {
      const toks = f.tokens;
      const seen2 = new Set<string>();
      const seen3 = new Set<string>();
      for (let k = 0; k < toks.length; k++) {
        const t = toks[k];
        if (isContentWord(t)) {
          bump(wordCounts, t);
          bump(pa.wordCounts, t);
          contentTotal++;
          pa.contentTotal++;
        }
        if (pa.stream.length < MAX_STREAM_TOKENS && !isLaughToken(t) && !/^\d+$/.test(t)) pa.stream.push(t);
        if (k + 1 < toks.length) {
          const u = toks[k + 1];
          if (usablePhraseToken(t) && usablePhraseToken(u) && (!STOPWORDS.has(t) || !STOPWORDS.has(u)) && t !== u) {
            seen2.add(t + ' ' + u);
          }
          if (k + 2 < toks.length) {
            const v = toks[k + 2];
            if (
              usablePhraseToken(t) &&
              usablePhraseToken(u) &&
              usablePhraseToken(v) &&
              (!STOPWORDS.has(t) || !STOPWORDS.has(u) || !STOPWORDS.has(v)) &&
              !(t === u && u === v)
            ) {
              seen3.add(t + ' ' + u + ' ' + v);
            }
          }
        }
      }
      for (const g of seen2) bump(bigrams, g);
      for (const g of seen3) bump(trigrams, g);
      if (bigrams.size > 400_000) prune(bigrams);
      if (trigrams.size > 400_000) prune(trigrams);
    }
  }
  closeTurn();
  if (msgs.length) closeConvo(msgs[n - 1].author);

  // last message per person (walk backwards once)
  const needLast = new Set(people.map((p) => p.id).filter((id) => acc[id].messages > 0));
  for (let i = n - 1; i >= 0 && needLast.size; i--) {
    const m = msgs[i];
    if (needLast.has(m.author)) {
      acc[m.author].last = { ts: m.ts, author: m.author, text: preview(clean(m.text)) };
      needLast.delete(m.author);
    }
  }

  // "broo" → "bro": fold doubled-ending variants into the more common spelling.
  const variants = new Map<string, string>();
  for (const [w, c] of wordCounts) {
    const base = collapseTrailing(w);
    if (base !== w && (wordCounts.get(base) ?? 0) >= c) variants.set(w, base);
  }
  const foldVariants = (map: Map<string, number>) => {
    for (const [w, base] of variants) {
      const c = map.get(w);
      if (c === undefined) continue;
      map.delete(w);
      bump(map, base, c);
    }
  };
  foldVariants(wordCounts);
  for (const a of acc) foldVariants(a.wordCounts);

  // ---- per person ---------------------------------------------------------------------------
  const allReplies: number[] = [];
  const cappedMean = (times: number[]) =>
    times.length ? times.reduce((t, x) => t + Math.min(x, HOUR), 0) / times.length : null;
  const quickShare = (times: number[]) =>
    times.length ? times.filter((x) => x <= MINUTE).length / times.length : 0;
  const perPerson: PersonStats[] = people.map((p) => {
    const a = acc[p.id];
    const sortedDays = [...a.days].sort((x, y) => x - y);
    const run = longestRun(sortedDays);
    for (const r of a.replyTimes) allReplies.push(r);
    const nightMsgs = a.hourly.slice(0, 5).reduce((x, y) => x + y, 0);
    const morningMsgs = a.hourly.slice(5, 9).reduce((x, y) => x + y, 0);
    const weekendMsgs = a.weekday[5] + a.weekday[6];
    const sentN = Math.max(1, a.sentCount);
    const msgN = Math.max(1, a.messages);
    const textN = Math.max(1, a.textMessages);
    let buddy = -1;
    for (let b = 0; b < P; b++) if (b !== p.id && (buddy < 0 || a.repliesTo[b] > a.repliesTo[buddy])) buddy = b;
    const topSwears = topN(a.swears, 6);
    return {
      id: p.id,
      messages: a.messages,
      textMessages: a.textMessages,
      words: a.words,
      chars: a.chars,
      media: a.media,
      mediaKinds: a.mediaKinds,
      links: a.links,
      emojis: a.emojis,
      deleted: a.deleted,
      edited: a.edited,
      polls: a.polls,
      mentionsSent: a.mentionsSent,
      mentionsReceived: a.mentionsReceived,
      questions: a.questions,
      exclaims: a.exclaims,
      caps: a.caps,
      laughs: a.laughs,
      laughsReceived: a.laughsReceived,
      oneWord: a.oneWord,
      avgWords: a.words / textN,
      avgChars: a.chars / textN,
      longestMessage: a.longest,
      activeDays: a.days.size,
      longestStreak: run ? { start: run.start * DAY, end: run.end * DAY, days: run.length } : null,
      longestAbsence: a.absence,
      first: a.first,
      last: a.last,
      hourly: a.hourly,
      weekday: a.weekday,
      nightShare: nightMsgs / msgN,
      morningShare: morningMsgs / msgN,
      weekendShare: weekendMsgs / msgN,
      peakHour: argmax(a.hourly),
      peakWeekday: argmax(a.weekday),
      replyMedianMs: median(a.replyTimes),
      replyMeanMs: cappedMean(a.replyTimes),
      replyQuickShare: quickShare(a.replyTimes),
      replyCount: a.replyTimes.length,
      replyBuckets: a.replyBuckets,
      conversationsStarted: a.started,
      conversationsEnded: a.ended,
      turns: a.turns,
      avgBurst: a.turns ? a.turnMessages / a.turns : 0,
      maxBurst: a.maxBurst,
      doubleTexts: a.doubleTexts,
      unansweredTurns: a.ended,
      sentiment: {
        avg: a.sentSum / sentN,
        pos: a.pos / sentN,
        neg: a.neg / sentN,
        neu: (a.sentCount - a.pos - a.neg) / sentN,
        net: ((a.pos - a.neg) / sentN) * 100,
      },
      toxicity: {
        weight: a.toxWeight,
        per100: (a.toxWeight / msgN) * 100,
        messages: a.toxMessages,
        share: a.toxMessages / msgN,
        top: topSwears,
      },
      kindness: {
        weight: a.kindWeight,
        per100: (a.kindWeight / msgN) * 100,
        messages: a.kindMessages,
        share: a.kindMessages / msgN,
        breakdown: a.kindCats,
      },
      emotions: Object.fromEntries(EMOTIONS.map((e) => [e, (a.emotions[e] / msgN) * 100])) as Record<Emotion, number>,
      richness: mattr(a.stream),
      uniqueWords: a.wordCounts.size,
      topWords: topN(a.wordCounts, 12),
      signatureWords: distinctive(a.wordCounts, a.contentTotal, wordCounts, contentTotal, { minCount: 4, limit: 10 }).map(
        ([w]) => [w, a.wordCounts.get(w)!] as [string, number],
      ),
      topEmojis: topN(a.emojiCounts, 8),
      signatureEmojis: distinctive(a.emojiCounts, a.emojis, emojiCounts, totals.emojis, {
        minCount: 3,
        limit: 5,
        alpha0: 500,
      }).map(([e]) => [e, a.emojiCounts.get(e)!] as [string, number]),
      topDomains: topN(a.domains, 5),
      topics: a.topics,
      bestBuddy: buddy >= 0 && a.repliesTo[buddy] > 0 ? { id: buddy, count: a.repliesTo[buddy] } : null,
      repliesTo: a.repliesTo,
      persona: { title: '', blurb: '', traits: [] },
      awards: [],
    };
  });

  // ---- time ----------------------------------------------------------------------------------
  const monthlyList = [...monthly.values()].sort((a, b) => a.ts - b.ts);
  // Fill empty months so timelines don't skip gaps.
  const filledMonths: typeof monthlyList = [];
  if (monthlyList.length) {
    const d = new Date(monthlyList[0].ts);
    let y = d.getUTCFullYear();
    let mo = d.getUTCMonth();
    const last = monthlyList[monthlyList.length - 1].ts;
    for (let ts = Date.UTC(y, mo, 1); ts <= last; ts = Date.UTC(y, mo, 1)) {
      filledMonths.push(
        monthly.get(ts) ?? { ts, total: 0, bySeries: new Array(S).fill(0), sent: 0, pos: 0, neg: 0, tox: 0, kind: 0, emoji: 0 },
      );
      mo++;
      if (mo === 12) {
        mo = 0;
        y++;
      }
    }
  }
  const bd = argmax(dayCounts);
  let busiestDay: Report['time']['busiestDay'] = null;
  if (dayCounts[bd] > 0) {
    const dayStartTs = (day0 + bd) * DAY;
    const lo = lowerBound(msgs, dayStartTs);
    const hi = lowerBound(msgs, dayStartTs + DAY);
    const who = new Array<number>(P).fill(0);
    const words = new Map<string, number>();
    for (let i = lo; i < hi; i++) {
      who[msgs[i].author]++;
      for (const t of feats[i]?.tokens ?? []) if (isContentWord(t)) bump(words, t);
    }
    busiestDay = {
      ts: dayStartTs,
      count: dayCounts[bd],
      topAuthor: argmax(who),
      topWords: topN(words, 6).map(([w]) => w),
    };
  }
  const monthsForExtremes = filledMonths.length >= 4 ? filledMonths.slice(1, -1) : filledMonths;
  const activeMonths = monthsForExtremes.filter((m) => m.total > 0);
  const busiestMonth = monthlyList.length ? monthlyList.reduce((x, y) => (y.total > x.total ? y : x)) : null;
  const quietest = activeMonths.length ? activeMonths.reduce((x, y) => (y.total < x.total ? y : x)) : null;
  let busiestHour: { ts: number; count: number } | null = null;
  for (const [slot, count] of hourSlots) {
    if (!busiestHour || count > busiestHour.count) busiestHour = { ts: slot * HOUR, count };
  }
  const castIdxs = series.map((id, i) => (id >= 0 ? i : -1)).filter((i) => i >= 0);
  const rankByMonth = filledMonths
    .filter((m) => m.total > 0)
    .map((m) => {
      const order = [...castIdxs].sort((x, y) => m.bySeries[y] - m.bySeries[x] || x - y);
      const ranks = new Array<number>(S).fill(0);
      order.forEach((si, r) => (ranks[si] = r + 1));
      return { ts: m.ts, ranks };
    });

  // ---- conversations ------------------------------------------------------------------------
  const convoCount = conversations.length;
  const sizes = conversations.map((c) => c.messages);
  const sizeBuckets = SIZE_BUCKETS.map(([, label]) => ({ label, count: 0 }));
  let longestByMessages: Conversation | null = null;
  let longestByDuration: Conversation | null = null;
  let durationSum = 0;
  let participantSum = 0;
  for (const c of conversations) {
    let b = 0;
    while (c.messages > SIZE_BUCKETS[b][0]) b++;
    sizeBuckets[b].count++;
    durationSum += c.end - c.start;
    participantSum += c.participants.length;
    if (!longestByMessages || c.messages > longestByMessages.messages) longestByMessages = c;
    if (!longestByDuration || c.end - c.start > longestByDuration.end - longestByDuration.start) longestByDuration = c;
  }
  const pairs: { a: number; b: number; count: number }[] = [];
  for (let x = 0; x < P; x++) {
    for (let y = x + 1; y < P; y++) {
      const count = replyMatrix[x][y] + replyMatrix[y][x];
      if (count > 0) pairs.push({ a: x, b: y, count });
    }
  }
  pairs.sort((p, q) => q.count - p.count);

  // ---- vibes -----------------------------------------------------------------------------
  const sentTotals = acc.reduce(
    (t, a) => ({ sum: t.sum + a.sentSum, n: t.n + a.sentCount, pos: t.pos + a.pos, neg: t.neg + a.neg }),
    { sum: 0, n: 0, pos: 0, neg: 0 },
  );
  const sentN = Math.max(1, sentTotals.n);
  const activeDayCounts = dayCounts.filter((c) => c > 0).sort((x, y) => x - y);
  const minDay = Math.max(10, percentile(activeDayCounts, 0.5));
  const pickDay = (values: Float64Array, better: (x: number, y: number) => boolean): DayScore | null => {
    let best: DayScore | null = null;
    for (let d = 0; d < nDays; d++) {
      const count = dayCounts[d];
      if (count < minDay) continue;
      const value = (values[d] / count) * 100;
      if (!best || better(value, best.value)) best = { ts: (day0 + d) * DAY, value, count };
    }
    return best;
  };
  const toxTotal = acc.reduce((t, a) => t + a.toxWeight, 0);
  const kindTotal = acc.reduce((t, a) => t + a.kindWeight, 0);
  const emotionTotals = emptyRecord(EMOTIONS);
  const kindBreakdown = emptyRecord(KIND_CATEGORIES);
  for (const a of acc) {
    for (const e of EMOTIONS) emotionTotals[e] += a.emotions[e];
    for (const k of KIND_CATEGORIES) kindBreakdown[k] += a.kindCats[k];
  }

  // ---- totals -------------------------------------------------------------------------------
  const activeDays = activeDayCounts.length;
  const chatRun = longestRun(dayCounts.map((c, d) => (c > 0 ? day0 + d : -1)).filter((d) => d >= 0));
  let allHandsDays = 0;
  const castMask = cast.length >= 3 ? (1 << cast.length) - 1 : 0;
  if (castMask) for (const mask of dayCast) if (mask === castMask) allHandsDays++;
  const activeParticipants = inRange.filter((c) => c > 0).length;

  const fullStart = chat.messages[0].ts;
  const fullEnd = chat.messages[chat.messages.length - 1].ts;
  const years: number[] = [];
  for (let y = new Date(fullStart).getUTCFullYear(); y <= new Date(fullEnd).getUTCFullYear(); y++) years.push(y);

  longestMessages.sort((x, y) => (y.words ?? 0) - (x.words ?? 0));
  const topWords = topN(wordCounts, 150);
  const topOwners = topWords.map(([w]) => {
    let best = -1;
    let bestCount = 0;
    acc.forEach((a, id) => {
      const c = a.wordCounts.get(w) ?? 0;
      if (c > bestCount) {
        best = id;
        bestCount = c;
      }
    });
    return best;
  });

  const report: Report = {
    meta: {
      chatName,
      fileName,
      isGroup: people.filter((p) => !p.isBot).length > 2 || chat.system.some((e) => e.kind === 'created' || e.kind === 'added'),
      platform: chat.meta.platform,
      dateOrder: chat.meta.dateOrder,
      periodLabel: opts.periodLabel,
      gapMinutes: opts.gapMinutes,
      range: { start: msgs[0].ts, end: msgs[n - 1].ts },
      fullRange: { start: fullStart, end: fullEnd },
      years,
      computeMs: 0,
      hinglish,
      hinglishShare,
    },
    people,
    series,
    seriesColors: series.map((id) => (id >= 0 ? people[id].color : OTHERS_COLOR)),
    seriesNames: series.map((id) => (id >= 0 ? people[id].short : 'Others')),
    totals: {
      messages: n,
      ...totals,
      mediaKinds,
      uniqueEmojis: emojiCounts.size,
      uniqueWords: wordCounts.size,
      systemEvents: chat.system.filter((e) => e.ts >= msgs[0].ts && e.ts <= msgs[n - 1].ts).length,
      participants: P,
      activeParticipants,
      days: nDays,
      activeDays,
      avgPerDay: n / nDays,
      avgPerActiveDay: n / Math.max(1, activeDays),
      longestStreak: chatRun ? { start: chatRun.start * DAY, end: chatRun.end * DAY, days: chatRun.length } : null,
      longestSilence: silence,
      balance: evenness(inRange.filter((_, id) => !people[id].isBot)),
      conversationHours: durationSum / HOUR + convoCount / 60,
    },
    perPerson,
    time: {
      dayStart: day0 * DAY,
      dayCounts,
      monthly: filledMonths.map(({ ts, total, bySeries }) => ({ ts, total, bySeries })),
      hourly,
      weekday,
      weekdayHour,
      monthOfYear,
      yearly: [...yearly.entries()].sort((a, b) => a[0] - b[0]).map(([year, v]) => ({ year, ...v })),
      busiestDay,
      quietestActiveMonth: quietest ? { ts: quietest.ts, count: quietest.total } : null,
      busiestMonth: busiestMonth ? { ts: busiestMonth.ts, count: busiestMonth.total } : null,
      busiestHour,
      peakHour: argmax(hourly),
      peakWeekday: argmax(weekday),
      weekendShare: (weekday[5] + weekday[6]) / n,
      nightShare: hourly.slice(0, 5).reduce((x, y) => x + y, 0) / n,
      replyAvgByHour: replyByHour.map((r) => (r.length >= 5 ? r.reduce((t, x) => t + Math.min(x, HOUR), 0) / r.length : null)),
      rankByMonth,
    },
    conversations: {
      count: convoCount,
      avgMessages: n / Math.max(1, convoCount),
      medianMessages: median(sizes) ?? 0,
      avgDurationMs: durationSum / Math.max(1, convoCount),
      avgParticipants: participantSum / Math.max(1, convoCount),
      longestByMessages,
      longestByDuration,
      starters: acc.map((a) => a.started),
      enders: acc.map((a) => a.ended),
      startsByHour,
      sizeBuckets,
      replyMatrix,
      mentionMatrix,
      replyBuckets: REPLY_BUCKET_LIMITS.map((_, b) => acc.reduce((t, a) => t + a.replyBuckets[b], 0)),
      replyMedianMs: median(allReplies),
      replyMeanMs: cappedMean(allReplies),
      replyQuickShare: quickShare(allReplies),
      pairs: pairs.slice(0, 12),
    },
    words: {
      top: topWords,
      topOwners,
      bigrams: topN(bigrams, 20).filter(([, c]) => c >= 3),
      trigrams: topN(trigrams, 20).filter(([, c]) => c >= 3),
      lengthBuckets: LENGTH_BUCKETS.map(([, label], b) => ({
        label,
        count: lengthBuckets[b].reduce((x, y) => x + y, 0),
        bySeries: lengthBuckets[b],
      })),
      // Forwarded / copy-pasted texts repeat; show each distinct essay once.
      longestMessages: longestMessages.filter((m, i, all) => all.findIndex((x) => x.text === m.text) === i).slice(0, 5),
      domains: topN(domains, 12),
      laughTypes: topN(laughTypes, 12),
      topics: TOPICS.map((t, i) => ({
        id: t.id,
        label: t.label,
        count: acc.reduce((sum, a) => sum + a.topics[i], 0),
        bySeries: topicCounts[i],
      })).sort((x, y) => y.count - x.count),
      hinglish,
      avgWordsPerMessage: totals.words / Math.max(1, totals.textMessages),
    },
    emoji: {
      total: totals.emojis,
      unique: emojiCounts.size,
      perMessage: totals.emojis / n,
      messagesWithEmoji: totals.emojiMessages,
      top: topN(emojiCounts, 40),
      monthly: filledMonths.map((m) => ({ ts: m.ts, count: m.emoji })),
    },
    vibes: {
      sentiment: {
        avg: sentTotals.sum / sentN,
        pos: sentTotals.pos / sentN,
        neg: sentTotals.neg / sentN,
        neu: (sentTotals.n - sentTotals.pos - sentTotals.neg) / sentN,
        net: ((sentTotals.pos - sentTotals.neg) / sentN) * 100,
      },
      toxicPer100: (toxTotal / n) * 100,
      kindPer100: (kindTotal / n) * 100,
      toxicMessages: acc.reduce((t, a) => t + a.toxMessages, 0),
      kindMessages: acc.reduce((t, a) => t + a.kindMessages, 0),
      monthly: filledMonths.map((m) => ({
        ts: m.ts,
        net: m.sent ? ((m.pos - m.neg) / m.sent) * 100 : 0,
        toxic: m.total ? (m.tox / m.total) * 100 : 0,
        kind: m.total ? (m.kind / m.total) * 100 : 0,
        count: m.total,
      })),
      topSwears: topN(swears, 15),
      topKind: topN(kindWords, 15),
      kindBreakdown,
      emotions: Object.fromEntries(EMOTIONS.map((e) => [e, (emotionTotals[e] / n) * 100])) as Record<Emotion, number>,
      happiestDay: pickDay(dayNet, (x, y) => x > y),
      gloomiestDay: pickDay(dayNet, (x, y) => x < y),
      spiciestDay: pickDay(dayTox, (x, y) => x > y),
      sweetestDay: pickDay(dayKind, (x, y) => x > y),
    },
    awards: [],
    moments: {
      first: n ? { ts: msgs[0].ts, author: msgs[0].author, text: preview(clean(msgs[0].text) || `[${msgs[0].kind}]`) } : null,
      last: n
        ? { ts: msgs[n - 1].ts, author: msgs[n - 1].author, text: preview(clean(msgs[n - 1].text) || `[${msgs[n - 1].kind}]`) }
        : null,
      milestones,
      allHandsDays,
      system: chat.system
        .filter((e) => e.ts >= msgs[0].ts && e.ts <= msgs[n - 1].ts && !['encryption', 'security'].includes(e.kind))
        .slice(0, 200),
      polls,
      events,
    },
    vibeTags: [],
  };

  report.awards = computeAwards(report);
  computePersonas(report);
  report.vibeTags = computeVibeTags(report);
  report.meta.computeMs = Math.round(performance.now() - t0);
  return report;
}

function usablePhraseToken(t: string) {
  return t.length > 1 && !/^\d+$/.test(t) && !isLaughToken(t);
}

function prune(map: Map<string, number>) {
  for (const [k, v] of map) if (v <= 1) map.delete(k);
}
