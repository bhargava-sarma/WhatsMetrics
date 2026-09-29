import { describe, expect, it } from 'vitest';
import { domainLabel, extractEmojis, messageFeatures, tokenize, isContentWord } from './features';

describe('extractEmojis', () => {
  it('finds emoji, merges skin tones and variation selectors, keeps ZWJ sequences and flags', () => {
    expect(extractEmojis('lol 😂😂 👍🏽 ❤\ufe0f 🇮🇳 👨\u200d👩\u200d👧 1\ufe0f\u20e3 ok')).toEqual(['😂', '😂', '👍', '❤', '🇮🇳', '👨\u200d👩\u200d👧', '1\u20e3']);
  });

  it('ignores plain digits and trademark symbols', () => {
    expect(extractEmojis('call me at 5 ™ ©')).toEqual([]);
  });
});

describe('tokenize', () => {
  it('strips links and mentions, collecting domains and names', () => {
    const out = tokenize('@\u2068Ben Ortiz\u2069 see https://youtu.be/abc and www.instagram.com/p/x NOW');
    expect(out.tokens).toEqual(['see', 'and', 'now']);
    expect(out.domains).toEqual(['YouTube', 'Instagram']);
    expect(out.mentions).toEqual(['Ben Ortiz']);
  });

  it('collapses stretched endings, keeps stretched middles readable, normalises apostrophes', () => {
    expect(tokenize('Noooo I don’t wanna goooo').tokens).toEqual(['no', 'i', "don't", 'wanna', 'go']);
    expect(tokenize('goood cooool brooo').tokens).toEqual(['good', 'cool', 'bro']);
  });
});

describe('domainLabel', () => {
  it.each([
    ['https://maps.google.com/?q=1,2', 'Google Maps'],
    ['https://open.spotify.com/track/1', 'Spotify'],
    ['https://www.bbc.co.uk/news', 'bbc.co.uk'],
    ['https://sub.example.com/x', 'example.com'],
  ])('%s → %s', (url, label) => expect(domainLabel(url)).toBe(label));
});

describe('messageFeatures', () => {
  it('detects laughs by word and emoji', () => {
    expect(messageFeatures('hahaha lmaooo 💀').laughs.sort()).toEqual(['haha', 'lmao', '💀'].sort());
    expect(messageFeatures('Huehue that was great').laughs).toEqual(['huehue']);
  });

  it('scores toxicity with severity and canonical words', () => {
    const f = messageFeatures('shut up you idiot, fuckkk off');
    expect(f.toxWords).toContain('fuck');
    expect(f.toxWords).toContain('idiot');
    expect(f.toxWords).toContain('shut up');
    expect(f.tox).toBeGreaterThanOrEqual(1 + 2 + 3 + 1);
  });

  it('keeps Hinglish-only abbreviations separate', () => {
    const f = messageFeatures('bc kya kar raha hai');
    expect(f.tox).toBe(0);
    expect(f.toxH).toBe(2);
  });

  it('does not flag "chod" (= leave it) as a swear', () => {
    expect(messageFeatures('chod de yaar').tox).toBe(0);
  });

  it('scores kindness categories', () => {
    const f = messageFeatures('thank you so much, love you ❤\ufe0f take care');
    expect(f.kind).toBeGreaterThan(0);
    expect(f.kindWords).toContain('thank');
  });

  it('handles English and Hindi negation in sentiment', () => {
    expect(messageFeatures('this is good').sentiment).toBeGreaterThan(0);
    expect(messageFeatures('this is not good').sentiment).toBeLessThan(0);
    expect(messageFeatures('accha hai').sentiment).toBeGreaterThan(0);
    expect(messageFeatures('accha nahi hai').sentiment).toBeLessThan(0);
  });

  it('flags questions, exclamations and caps', () => {
    const f = messageFeatures('WHERE ARE YOU?!');
    expect(f).toMatchObject({ question: true, exclaim: true, caps: true });
    expect(messageFeatures('ok').caps).toBe(false);
  });

  it('marks topics', () => {
    expect(messageFeatures('lets order pizza').topics).not.toBe(0);
  });
});

describe('isContentWord', () => {
  it('drops stopwords, numbers and laughs', () => {
    expect(['the', 'hai', '123', 'haha', 'a'].some(isContentWord)).toBe(false);
    expect(isContentWord('biryani')).toBe(true);
  });
});
