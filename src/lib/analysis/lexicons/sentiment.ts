import { afinn165 } from 'afinn-165';
import { emojiEmotion } from 'emoji-emotion';

/**
 * Word valence from AFINN-165 (−5…+5), tuned for chat slang: filler words are
 * neutralised, slang positives ("fire", "sick", "dead" as in "I'm dead 😂") stop
 * reading as negative, and swearing is softened because toxicity is scored
 * separately. Romanised Hindi words are added on top.
 */
const overrides: Record<string, number> = {
  like: 0,
  likes: 0,
  no: 0,
  yes: 0,
  god: 0,
  please: 0,
  pretty: 0,
  kind: 0,
  fire: 1,
  lit: 2,
  sick: 0,
  insane: 1,
  crazy: 0,
  dead: 0,
  dying: 0,
  killing: 0,
  kill: -1,
  hell: -1,
  damn: -1,
  fuck: -1,
  fucking: -1,
  fucked: -2,
  shit: -1,
  bitch: -2,
  ass: -1,
  mad: -1,
  joke: 0,
  jk: 0,
  lol: 1,
  haha: 1,
  lmao: 1,
  rofl: 1,
  lmfao: 1,
  block: 0,
  cut: 0,
  cool: 2,
  goat: 3,
};

const hinglish: Record<string, number> = {
  accha: 1,
  acha: 1,
  achha: 1,
  badhiya: 3,
  badiya: 3,
  mast: 3,
  sahi: 2,
  zabardast: 3,
  shandaar: 3,
  kamaal: 3,
  jhakaas: 3,
  bindaas: 2,
  khatarnak: 2,
  khush: 3,
  khushi: 3,
  pyaar: 3,
  pyar: 3,
  maza: 3,
  mazaa: 3,
  mazza: 3,
  sukoon: 2,
  shukriya: 2,
  dhanyavad: 2,
  badhai: 3,
  mubarak: 3,
  bekaar: -2,
  bekar: -2,
  bakwas: -2,
  bakwaas: -2,
  ganda: -2,
  gandi: -2,
  ghatiya: -3,
  bura: -2,
  buri: -2,
  dukh: -2,
  dukhi: -3,
  udaas: -2,
  gussa: -3,
  pareshan: -2,
  faltu: -2,
  thik: 1,
  theek: 1,
  bhayanak: -2,
  nautanki: -1,
  jhooth: -2,
  jhoota: -2,
  // Kannada
  chennagide: 3,
  sakkath: 3,
  super: 3,
};

export const WORD_VALENCE: ReadonlyMap<string, number> = new Map<string, number>([
  ...Object.entries(afinn165),
  ...Object.entries(overrides),
  ...Object.entries(hinglish),
]);

const emojiOverrides: Record<string, number> = {
  '💀': 2,
  '😭': 0,
  '🥲': 0,
  '🤡': -1,
  '🔥': 3,
  '🙏': 2,
  '🥺': 1,
  '🤬': -4,
  '🦖': 0,
};

/** Emoji valence (−5…+5), keyed without variation selectors. */
export const EMOJI_VALENCE: ReadonlyMap<string, number> = new Map<string, number>([
  ...emojiEmotion.map((e) => [e.emoji.replace(/\ufe0f/g, ''), e.polarity] as [string, number]),
  ...Object.entries(emojiOverrides),
]);

/** English negators flip the valence of the next two tokens ("not good"). */
export const NEGATORS: ReadonlySet<string> = new Set([
  'not',
  'no',
  'never',
  "don't",
  'dont',
  "doesn't",
  'doesnt',
  "didn't",
  'didnt',
  "isn't",
  'isnt',
  "wasn't",
  'wasnt',
  "aren't",
  "won't",
  'wont',
  "can't",
  'cant',
  'cannot',
  "couldn't",
  "shouldn't",
  'nothing',
]);

/** Hindi negators follow the word they negate ("accha nahi" = "not good"). */
export const POST_NEGATORS: ReadonlySet<string> = new Set(['nahi', 'nhi', 'nahin', 'nai', 'mat']);
