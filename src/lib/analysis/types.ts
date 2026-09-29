import type { Poll, SystemEventKind } from '../parser/types';

export type Emotion = 'joy' | 'humor' | 'love' | 'surprise' | 'fear' | 'sadness' | 'anger';
export const EMOTIONS: Emotion[] = ['joy', 'humor', 'love', 'surprise', 'fear', 'sadness', 'anger'];

export type KindCategory = 'gratitude' | 'apology' | 'affection' | 'praise' | 'support' | 'politeness';
export const KIND_CATEGORIES: KindCategory[] = ['gratitude', 'apology', 'affection', 'praise', 'support', 'politeness'];

export interface AnalyzeOptions {
  /** Inclusive lower bound (UTC-encoded wall clock ms). */
  from?: number;
  /** Exclusive upper bound. */
  to?: number;
  /** Silence (minutes) that separates two conversations. */
  gapMinutes: number;
  /** Human label for the selected period, e.g. "All time" or "2025". */
  periodLabel: string;
}

export interface Person {
  id: number;
  name: string;
  /** Short display name (first word, disambiguated). */
  short: string;
  color: string;
  /** Palette slot, or -1 when folded into "Others". */
  slot: number;
  isBot: boolean;
  /** Part of the main cast drawn as separate series in charts. */
  inCast: boolean;
}

export interface Span {
  start: number;
  end: number;
  days: number;
}

export interface MessageRef {
  ts: number;
  author: number;
  text: string;
  words?: number;
}

export interface Persona {
  title: string;
  blurb: string;
  traits: string[];
}

export interface PersonStats {
  id: number;
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
  avgWords: number;
  avgChars: number;
  longestMessage: MessageRef | null;
  activeDays: number;
  longestStreak: Span | null;
  longestAbsence: Span | null;
  first: MessageRef | null;
  last: MessageRef | null;
  hourly: number[];
  weekday: number[];
  nightShare: number;
  morningShare: number;
  weekendShare: number;
  peakHour: number;
  peakWeekday: number;
  replyMedianMs: number | null;
  /** Mean reply time with each reply capped at one hour (robust to minute-level timestamps). */
  replyMeanMs: number | null;
  /** Share of replies sent within about a minute. */
  replyQuickShare: number;
  replyCount: number;
  replyBuckets: number[];
  conversationsStarted: number;
  conversationsEnded: number;
  turns: number;
  avgBurst: number;
  maxBurst: { count: number; ts: number } | null;
  doubleTexts: number;
  unansweredTurns: number;
  sentiment: { avg: number; pos: number; neg: number; neu: number; net: number };
  toxicity: { weight: number; per100: number; messages: number; share: number; top: [string, number][] };
  kindness: { weight: number; per100: number; messages: number; share: number; breakdown: Record<KindCategory, number> };
  emotions: Record<Emotion, number>;
  richness: number | null;
  uniqueWords: number;
  topWords: [string, number][];
  signatureWords: [string, number][];
  topEmojis: [string, number][];
  signatureEmojis: [string, number][];
  topDomains: [string, number][];
  topics: number[];
  bestBuddy: { id: number; count: number } | null;
  repliesTo: number[];
  persona: Persona;
  awards: string[];
}

export interface Totals {
  messages: number;
  textMessages: number;
  words: number;
  chars: number;
  media: number;
  mediaKinds: Record<string, number>;
  links: number;
  emojis: number;
  uniqueEmojis: number;
  uniqueWords: number;
  deleted: number;
  edited: number;
  polls: number;
  events: number;
  locations: number;
  contacts: number;
  calls: number;
  mentions: number;
  questions: number;
  laughs: number;
  systemEvents: number;
  participants: number;
  activeParticipants: number;
  days: number;
  activeDays: number;
  avgPerDay: number;
  avgPerActiveDay: number;
  longestStreak: Span | null;
  longestSilence: (Span & { brokenBy: number }) | null;
  balance: number;
  conversationHours: number;
}

export interface MonthPoint {
  /** First day of month (UTC-encoded). */
  ts: number;
  total: number;
  /** Counts aligned with `Report.series`. */
  bySeries: number[];
}

export interface TimeStats {
  dayStart: number;
  dayCounts: number[];
  monthly: MonthPoint[];
  hourly: number[];
  weekday: number[];
  weekdayHour: number[][];
  monthOfYear: number[];
  yearly: { year: number; count: number; bySeries: number[] }[];
  busiestDay: { ts: number; count: number; topAuthor: number; topWords: string[] } | null;
  quietestActiveMonth: { ts: number; count: number } | null;
  busiestMonth: { ts: number; count: number } | null;
  busiestHour: { ts: number; count: number } | null;
  peakHour: number;
  peakWeekday: number;
  weekendShare: number;
  nightShare: number;
  /** Average reply time (each capped at 1 h) per hour of day; null when too few replies. */
  replyAvgByHour: (number | null)[];
  rankByMonth: { ts: number; ranks: number[] }[];
}

export interface Conversation {
  start: number;
  end: number;
  messages: number;
  participants: number[];
  starter: number;
}

export interface ConversationStats {
  count: number;
  avgMessages: number;
  medianMessages: number;
  avgDurationMs: number;
  avgParticipants: number;
  longestByMessages: Conversation | null;
  longestByDuration: Conversation | null;
  starters: number[];
  enders: number[];
  startsByHour: number[];
  sizeBuckets: { label: string; count: number }[];
  replyMatrix: number[][];
  mentionMatrix: number[][];
  replyBuckets: number[];
  replyMedianMs: number | null;
  replyMeanMs: number | null;
  replyQuickShare: number;
  pairs: { a: number; b: number; count: number }[];
}

export interface WordStats {
  top: [string, number][];
  /** For each entry of `top`, the person who uses that word most. */
  topOwners: number[];
  bigrams: [string, number][];
  trigrams: [string, number][];
  lengthBuckets: { label: string; count: number; bySeries: number[] }[];
  longestMessages: MessageRef[];
  domains: [string, number][];
  laughTypes: [string, number][];
  topics: { id: string; label: string; count: number; bySeries: number[] }[];
  hinglish: boolean;
  avgWordsPerMessage: number;
}

export interface EmojiStats {
  total: number;
  unique: number;
  perMessage: number;
  messagesWithEmoji: number;
  top: [string, number][];
  monthly: { ts: number; count: number }[];
}

export interface DayScore {
  ts: number;
  value: number;
  count: number;
}

export interface VibeStats {
  sentiment: { avg: number; pos: number; neg: number; neu: number; net: number };
  toxicPer100: number;
  kindPer100: number;
  toxicMessages: number;
  kindMessages: number;
  monthly: { ts: number; net: number; toxic: number; kind: number; count: number }[];
  topSwears: [string, number][];
  topKind: [string, number][];
  kindBreakdown: Record<KindCategory, number>;
  emotions: Record<Emotion, number>;
  happiestDay: DayScore | null;
  gloomiestDay: DayScore | null;
  spiciestDay: DayScore | null;
  sweetestDay: DayScore | null;
}

export interface Award {
  id: string;
  title: string;
  icon: string;
  group: 'volume' | 'style' | 'time' | 'social' | 'vibe';
  winner: number;
  value: string;
  blurb: string;
  runnerUp: { id: number; value: string } | null;
}

export interface Milestone {
  n: number;
  ts: number;
  author: number;
  text: string;
}

export interface Moments {
  first: MessageRef | null;
  last: MessageRef | null;
  milestones: Milestone[];
  allHandsDays: number;
  system: { ts: number; kind: SystemEventKind; text: string }[];
  polls: { ts: number; author: number; poll: Poll }[];
  events: { ts: number; author: number; title: string }[];
}

export interface Report {
  meta: {
    chatName: string;
    fileName: string;
    isGroup: boolean;
    platform: string;
    dateOrder: string;
    periodLabel: string;
    gapMinutes: number;
    range: { start: number; end: number };
    fullRange: { start: number; end: number };
    years: number[];
    computeMs: number;
    hinglish: boolean;
    hinglishShare: number;
  };
  people: Person[];
  /** Series drawn in per-person charts: cast ids, plus -1 for "Others" when significant. */
  series: number[];
  seriesColors: string[];
  seriesNames: string[];
  totals: Totals;
  perPerson: PersonStats[];
  time: TimeStats;
  conversations: ConversationStats;
  words: WordStats;
  emoji: EmojiStats;
  vibes: VibeStats;
  awards: Award[];
  moments: Moments;
  vibeTags: { label: string; detail: string }[];
}
