import type { ParsedChat } from '../parser/types';
import { EMOTIONS, KIND_CATEGORIES } from './types';
import { STOPWORDS, HINGLISH_MARKERS } from './lexicons/stopwords';
import { TOXIC_WORDS, HINGLISH_ONLY_TOXIC, TOXIC_PHRASES } from './lexicons/toxicity';
import { KIND_WORDS, KIND_PHRASES, KIND_EMOJI } from './lexicons/kindness';
import { EMOTION_WORDS, EMOTION_EMOJI } from './lexicons/emotions';
import { TOPIC_WORDS } from './lexicons/topics';
import { WORD_VALENCE, EMOJI_VALENCE, NEGATORS, POST_NEGATORS } from './lexicons/sentiment';

/** Per-message text features, computed once per chat and reused for every filter. */
export interface MsgFeatures {
  words: number;
  chars: number;
  /** Lower-cased word tokens (elongations like "sooo" collapsed). */
  tokens: string[];
  emojis: string[];
  domains: string[];
  mentions: string[];
  laughs: string[];
  question: boolean;
  exclaim: boolean;
  caps: boolean;
  sentiment: number;
  tox: number;
  toxWords: string[];
  /** Toxicity only counted when the chat is Hinglish ("bc", "mc"). */
  toxH: number;
  toxHWords: string[];
  kind: number;
  kindWords: string[];
  kindCats: number;
  emotions: number;
  topics: number;
}

export interface ChatFeatures {
  features: (MsgFeatures | null)[];
  /** Enough romanised Hindi that "bc"/"mc" are almost certainly swears. */
  hinglish: boolean;
  /** Share of text messages containing Hindi function words. */
  hinglishShare: number;
}

// Emoji: flags, keycaps, and pictographs with optional modifiers / ZWJ sequences.
export const EMOJI_RE =
  /\p{RI}\p{RI}|(?:\p{Extended_Pictographic}|[#*0-9]\ufe0f?\u20e3)(?:\ufe0f|\p{EMod})?(?:\u200d\p{Extended_Pictographic}(?:\ufe0f|\p{EMod})?)*/gu;
const SKIN_AND_VS_RE = /\ufe0f|\p{EMod}/gu;
const NOT_EMOJI = new Set(['©', '®', '™']);

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const MENTION_RE = /@\u2068([^\u2069]{1,80})\u2069|@(\+?\d[\d -]{6,18}\d)\b/g;
const WORD_RE = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu;
const ELONGATED_RE = /(\p{L})\1{2,}/gu;
const CENSORED: [RegExp, string][] = [
  [/\bf[*#@]+c?k/g, 'fuck'],
  [/\bsh[*#@]+t/g, 'shit'],
  [/\bb[*#@]+tch/g, 'bitch'],
];

const LAUGH_TOKENS: [string, RegExp][] = [
  ['haha', /^(?:a*h+a+){2,}h*$/],
  ['hehe', /^(?:h+e+){2,}h*$/],
  ['huehue', /^(?:h+u+e+){2,}$/],
  ['hihi', /^(?:h+i+){2,}$/],
  ['lol', /^l+o+l+(?:o+l+)*$/],
  ['lmao', /^l+m+f*a+o+$/],
  ['rofl', /^rofl+(?:mao)?$/],
  ['xd', /^x+d+$/],
  ['jaja', /^(?:j+a+){2,}j*$/],
];
export const LAUGH_EMOJI = new Set(['😂', '🤣', '💀', '😹', '😆', '😭']);

const EMOTION_BIT = Object.fromEntries(EMOTIONS.map((e, i) => [e, 1 << i])) as Record<string, number>;
const KIND_BIT = Object.fromEntries(KIND_CATEGORIES.map((k, i) => [k, 1 << i])) as Record<string, number>;

/** Normalise an emoji for counting: drop skin tones and variation selectors. */
export function emojiKey(e: string): string {
  return e.replace(SKIN_AND_VS_RE, '');
}

/** Render a counted emoji: single BMP symbols need VS16 to show in colour. */
export function emojiDisplay(key: string): string {
  return key.length === 1 ? key + '\ufe0f' : key;
}

export function extractEmojis(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(EMOJI_RE)) {
    const key = emojiKey(m[0]);
    if (key && !NOT_EMOJI.has(key)) out.push(key);
  }
  return out;
}

const DOMAIN_NAMES: [RegExp, string][] = [
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(spotify\.com|spotify\.link)$/, 'Spotify'],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, 'X / Twitter'],
  [/(^|\.)(reddit\.com|redd\.it)$/, 'Reddit'],
  [/^maps\.google\.|^maps\.app\.goo\.gl$|^goo\.gl$/, 'Google Maps'],
  [/(^|\.)(docs|drive|forms)\.google\.com$/, 'Google Drive'],
  [/(^|\.)google\.[a-z.]+$/, 'Google'],
  [/(^|\.)(amazon\.[a-z.]+|amzn\.[a-z]+|a\.co)$/, 'Amazon'],
  [/(^|\.)(flipkart\.com|fkrt\.it|dl\.flipkart\.com)$/, 'Flipkart'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'WhatsApp'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'LinkedIn'],
  [/(^|\.)github\.com$/, 'GitHub'],
  [/(^|\.)(facebook\.com|fb\.watch|fb\.me|fb\.com)$/, 'Facebook'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)netflix\.com$/, 'Netflix'],
  [/(^|\.)(primevideo\.com)$/, 'Prime Video'],
  [/(^|\.)(hotstar\.com|jiohotstar\.com)$/, 'Hotstar'],
  [/(^|\.)(t\.me|telegram\.org|telegram\.me)$/, 'Telegram'],
  [/(^|\.)(discord\.gg|discord\.com)$/, 'Discord'],
  [/(^|\.)(zomato\.com)$/, 'Zomato'],
  [/(^|\.)(swiggy\.com)$/, 'Swiggy'],
  [/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/, 'Pinterest'],
  [/(^|\.)snapchat\.com$/, 'Snapchat'],
  [/(^|\.)wikipedia\.org$/, 'Wikipedia'],
  [/(^|\.)(chatgpt\.com|openai\.com)$/, 'ChatGPT'],
  [/(^|\.)(claude\.ai)$/, 'Claude'],
  [/(^|\.)(music\.apple\.com|apple\.com)$/, 'Apple'],
  [/(^|\.)(twitch\.tv)$/, 'Twitch'],
];

export function domainLabel(url: string): string | null {
  const m = /^(?:https?:\/\/)?([^/?#:]+)/i.exec(url);
  if (!m) return null;
  const host = m[1].toLowerCase().replace(/^www\.|^m\./, '');
  for (const [re, label] of DOMAIN_NAMES) if (re.test(host)) return label;
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const tail2 = parts.slice(-2).join('.');
  // Keep three labels for country second-levels such as co.in / co.uk / com.au.
  return /^(co|com|org|net|gov|ac|edu)\.[a-z]{2}$/.test(tail2) ? parts.slice(-3).join('.') : tail2;
}

const TRAILING_REPEAT_RE = /(\p{L})\1+$/u;

/**
 * Find the lexicon key for a token. Tokens arrive with long runs already cut to two
 * letters ("fuckkk" → "fuckk"), so a trailing repeat is also tried collapsed ("fuck").
 */
function resolve(map: ReadonlyMap<string, unknown>, token: string): string | undefined {
  if (map.has(token)) return token;
  if (!TRAILING_REPEAT_RE.test(token)) return undefined;
  const collapsed = token.replace(TRAILING_REPEAT_RE, '$1');
  return map.has(collapsed) ? collapsed : undefined;
}

function lookup<T>(map: ReadonlyMap<string, T>, token: string): T | undefined {
  const key = resolve(map, token);
  return key === undefined ? undefined : map.get(key);
}

function isNumeric(token: string) {
  return /^\p{N}+$/u.test(token);
}

const TRAILING_ELONGATION_RE = /(\p{L})\1{2,}$/u;

/**
 * "brooo" → "bro", "yesss" → "yes" (stretched endings collapse fully), while
 * stretched middles keep two letters so "goood" → "good" and "cooool" → "cool".
 */
export function normalizeElongation(token: string): string {
  return token.replace(TRAILING_ELONGATION_RE, '$1').replace(ELONGATED_RE, '$1$1');
}

export function tokenize(text: string): { tokens: string[]; domains: string[]; mentions: string[] } {
  const domains: string[] = [];
  const mentions: string[] = [];
  let clean = text.replace(URL_RE, (url) => {
    const d = domainLabel(url);
    if (d) domains.push(d);
    return ' ';
  });
  clean = clean.replace(MENTION_RE, (_m, name?: string, phone?: string) => {
    mentions.push((name ?? phone ?? '').trim());
    return ' ';
  });
  let lower = clean.toLowerCase().replace(/’/g, "'");
  for (const [re, word] of CENSORED) lower = lower.replace(re, word);
  const tokens: string[] = [];
  for (const m of lower.matchAll(WORD_RE)) tokens.push(normalizeElongation(m[0]));
  return { tokens, domains, mentions };
}

function laughType(token: string): string | null {
  if (token.length < 2 || token.length > 24) return null;
  for (const [name, re] of LAUGH_TOKENS) if (re.test(token)) return name;
  return null;
}

export function isLaughToken(token: string): boolean {
  return laughType(token) !== null;
}

/** Words whose doubled ending is real spelling, not a stretched stopword. */
const REAL_DOUBLES = new Set(['ass', 'inn', 'odd', 'add', 'egg', 'wee', 'mess', 'boss', 'kiss', 'pass', 'less']);

/** "yeahh" / "okk" read as their stopword forms. */
export function collapseTrailing(token: string): string {
  return REAL_DOUBLES.has(token) ? token : token.replace(TRAILING_REPEAT_RE, '$1');
}

export function isContentWord(token: string): boolean {
  return (
    token.length > 1 &&
    !STOPWORDS.has(token) &&
    !STOPWORDS.has(collapseTrailing(token)) &&
    !isNumeric(token) &&
    laughType(token) === null
  );
}

function scoreSentiment(tokens: string[], emojis: string[]): number {
  let score = 0;
  let negateUntil = -1;
  let lastIdx = -10;
  let lastVal = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (NEGATORS.has(t)) {
      negateUntil = i + 2;
      continue;
    }
    if (POST_NEGATORS.has(t)) {
      if (i - lastIdx <= 2 && lastVal !== 0) {
        score -= 2 * lastVal;
        lastVal = 0;
      }
      continue;
    }
    let v = lookup(WORD_VALENCE, t) ?? 0;
    if (v !== 0) {
      if (i <= negateUntil) v = -v;
      score += v;
      lastIdx = i;
      lastVal = v;
    }
  }
  for (const e of new Set(emojis)) score += EMOJI_VALENCE.get(e) ?? 0;
  return score;
}

export function messageFeatures(text: string): MsgFeatures {
  const { tokens, domains, mentions } = tokenize(text);
  const emojis = extractEmojis(text);
  const lower = tokens.join(' ');

  const laughs = new Set<string>();
  let emotions = 0;
  let topics = 0;
  let tox = 0;
  let toxH = 0;
  const toxWords: string[] = [];
  const toxHWords: string[] = [];
  let kind = 0;
  let kindCats = 0;
  const kindWords: string[] = [];

  for (const t of tokens) {
    const lt = laughType(t);
    if (lt) laughs.add(lt);
    const toxKey = resolve(TOXIC_WORDS, t);
    if (toxKey) {
      tox += TOXIC_WORDS.get(toxKey)!;
      toxWords.push(toxKey);
    } else {
      const th = HINGLISH_ONLY_TOXIC.get(t);
      if (th) {
        toxH += th;
        toxHWords.push(t);
      }
    }
    const kindKey = resolve(KIND_WORDS, t);
    if (kindKey) {
      kind++;
      kindCats |= KIND_BIT[KIND_WORDS.get(kindKey)!];
      kindWords.push(kindKey);
    }
    const em = lookup(EMOTION_WORDS, t);
    if (em) for (const e of em) emotions |= EMOTION_BIT[e];
    const topic = TOPIC_WORDS.get(t);
    if (topic !== undefined) topics |= 1 << topic;
  }

  if (lower) {
    for (const [re, w, label] of TOXIC_PHRASES) {
      if (re.test(lower)) {
        tox += w;
        toxWords.push(label);
      }
    }
    for (const [re, cat] of KIND_PHRASES) {
      if (re.test(lower)) {
        kind++;
        kindCats |= KIND_BIT[cat];
      }
    }
  }

  for (const e of new Set(emojis)) {
    if (LAUGH_EMOJI.has(e)) laughs.add(e);
    const kc = KIND_EMOJI.get(e);
    if (kc) {
      kind++;
      kindCats |= KIND_BIT[kc];
      kindWords.push(e);
    }
    const em = EMOTION_EMOJI.get(e);
    if (em) for (const x of em) emotions |= EMOTION_BIT[x];
  }
  if (laughs.size) emotions |= EMOTION_BIT.humor;

  const letters = text.replace(URL_RE, '').replace(/[^A-Za-z]/g, '');
  const caps = letters.length >= 4 && letters === letters.toUpperCase() && /[A-Z]/.test(letters);
  const bare = text.replace(URL_RE, '');

  return {
    words: tokens.length,
    chars: [...text].length,
    tokens,
    emojis,
    domains,
    mentions,
    laughs: [...laughs],
    question: bare.includes('?'),
    exclaim: bare.includes('!'),
    caps,
    sentiment: scoreSentiment(tokens, emojis),
    tox,
    toxWords,
    toxH,
    toxHWords,
    kind: Math.min(kind, 3),
    kindWords,
    kindCats,
    emotions,
    topics,
  };
}

const cache = new WeakMap<ParsedChat, ChatFeatures>();

/** Compute (and memoise) features for every message of a chat. */
export function chatFeatures(chat: ParsedChat): ChatFeatures {
  const hit = cache.get(chat);
  if (hit) return hit;
  let textMessages = 0;
  let hinglishMessages = 0;
  const features = chat.messages.map((m) => {
    if (!m.text) return null;
    const f = messageFeatures(m.text);
    if (m.kind === 'text' && f.tokens.length) {
      textMessages++;
      if (f.tokens.some((t) => HINGLISH_MARKERS.has(t))) hinglishMessages++;
    }
    return f;
  });
  const hinglishShare = textMessages > 0 ? hinglishMessages / textMessages : 0;
  const result = { features, hinglish: hinglishShare >= 0.015, hinglishShare };
  cache.set(chat, result);
  return result;
}
