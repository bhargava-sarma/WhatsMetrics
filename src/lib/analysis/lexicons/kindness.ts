import type { KindCategory } from '../types';

/** Single words that signal warmth, grouped by the kind of kindness they express. */
const words: Record<KindCategory, string> = {
  gratitude: `thanks thank thanku thankyou thankss thanx thnx thnks thx tq ty tysm tyvm grateful gratitude appreciate
    appreciated appreciation dhanyavad dhanyawad dhanyavaad shukriya shukria thanq`,
  apology: `sorry sry sorri sowwy soz srry apologies apologize apologise apology maaf maafi forgive`,
  affection: `love loved lovely loving luv lub ily ilu ilysm hug hugs xoxo adore dear darling sweetheart sweetie
    jaan pyaar pyar cutie bestie`,
  praise: `awesome amazing brilliant genius legend legendary proud congrats congratulations congratz congo
    badhai mubarak bravo wonderful fantastic superb beautiful handsome gorgeous talented impressive incredible goat
    kudos respect salute mast badhiya zabardast shandaar kamaal`,
  support: `careful recover blessed bless blessings wishes hbd birthday gn gm goodnight goodmorning`,
  politeness: `please pls plz plss plzz pleasee kindly welcome`,
};

export const KIND_WORDS: ReadonlyMap<string, KindCategory> = new Map(
  (Object.entries(words) as [KindCategory, string][]).flatMap(([cat, list]) =>
    list
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => [w, cat] as [string, KindCategory]),
  ),
);

/** Phrases worth more than their words (checked on lower-cased text). */
export const KIND_PHRASES: [RegExp, KindCategory][] = [
  [/\b(love|luv) (you|u|ya)\b/, 'affection'],
  [/\bmiss (you|u|ya)\b/, 'affection'],
  [/\bproud of (you|u)\b/, 'praise'],
  [/\b(well|nicely) done\b|\b(good|great|nice) (job|work)\b/, 'praise'],
  [/\btake care\b|\bget well( soon)?\b|\bfeel better\b|\bstay safe\b|\bsweet dreams\b/, 'support'],
  [/\b(you|u) got this\b|\ball the best\b|\bbest of luck\b|\bgood luck\b|\bdon'?t worry\b|\bno worries\b/, 'support'],
  [/\bhere for (you|u)\b|\bhappy birthday\b|\bhappy (new year|diwali|holi|eid|christmas)\b/, 'support'],
  [/\bkoi (baat )?nahi\b|\bchinta mat\b|\bfikar mat\b|\btension mat\b/, 'support'],
  [/\bmy bad\b/, 'apology'],
  [/\bthank (you|u)\b/, 'gratitude'],
];

/** Emoji that read as warm gestures. */
export const KIND_EMOJI: ReadonlyMap<string, KindCategory> = new Map([
  ['❤', 'affection'],
  ['🧡', 'affection'],
  ['💛', 'affection'],
  ['💚', 'affection'],
  ['💙', 'affection'],
  ['💜', 'affection'],
  ['🤍', 'affection'],
  ['💕', 'affection'],
  ['💖', 'affection'],
  ['💗', 'affection'],
  ['💓', 'affection'],
  ['💞', 'affection'],
  ['💘', 'affection'],
  ['♥', 'affection'],
  ['🥰', 'affection'],
  ['😘', 'affection'],
  ['😍', 'affection'],
  ['🤗', 'affection'],
  ['🫶', 'affection'],
  ['🙏', 'gratitude'],
  ['👏', 'praise'],
  ['🎉', 'support'],
  ['🥳', 'support'],
  ['🎂', 'support'],
  ['💐', 'support'],
]);

export const KIND_LABELS: Record<KindCategory, string> = {
  gratitude: 'Gratitude',
  apology: 'Apologies',
  affection: 'Affection',
  praise: 'Praise',
  support: 'Support',
  politeness: 'Politeness',
};
