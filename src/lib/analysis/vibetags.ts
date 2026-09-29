import { fmtDuration, fmtNum, fmtPct } from '../format';
import type { Report } from './types';

/** A handful of plain-language labels that sum up the whole chat's personality. */
export function computeVibeTags(r: Report): { label: string; detail: string }[] {
  const t = r.totals;
  const tags: { label: string; detail: string; weight: number }[] = [];
  const add = (label: string, detail: string, weight: number) => tags.push({ label, detail, weight });

  const humans = r.perPerson.filter((p) => !r.people[p.id].isBot && p.messages > 0);
  const top = humans.reduce((a, b) => (b.messages > a.messages ? b : a), humans[0]);

  if (r.time.nightShare >= 0.1) add('Night owls', `${fmtPct(r.time.nightShare)} of messages after midnight`, r.time.nightShare * 4);
  const morning = r.time.hourly.slice(5, 9).reduce((a, b) => a + b, 0) / t.messages;
  if (morning >= 0.18) add('Early risers', `${fmtPct(morning)} of messages before 9 AM`, morning * 3);
  if (r.time.weekendShare >= 0.36) add('Weekend crew', `${fmtPct(r.time.weekendShare)} of messages on weekends`, r.time.weekendShare);
  if (t.media / t.messages >= 0.08) add('Meme factory', `${fmtPct(t.media / t.messages)} of messages are media`, (t.media / t.messages) * 4);
  if (r.emoji.perMessage >= 0.4) add('Emoji fluent', `${fmtNum(r.emoji.perMessage, 2)} emoji per message`, r.emoji.perMessage);
  if (r.vibes.kindPer100 >= 6) add('Wholesome', `${fmtNum(r.vibes.kindPer100)} kind words per 100 messages`, r.vibes.kindPer100 / 8);
  if (r.vibes.toxicPer100 >= 4) add('Roast zone', `${fmtNum(r.vibes.toxicPer100)} spicy words per 100 messages`, r.vibes.toxicPer100 / 6);
  const reply = r.conversations.replyMeanMs;
  if (reply !== null && reply <= 4 * 60_000) {
    add('Rapid-fire', `${fmtPct(r.conversations.replyQuickShare)} of replies within a minute`, 1.2);
  }
  if (reply !== null && reply >= 25 * 60_000) add('Slow burn', `average reply takes ${fmtDuration(reply)}`, 1);
  if (t.activeDays / t.days >= 0.75 && t.days >= 30) add('Always on', `active on ${fmtPct(t.activeDays / t.days)} of days`, 1.1);
  if (t.laughs / t.messages >= 0.1) add('Laugh riot', `${fmtPct(t.laughs / t.messages)} of messages are laughs`, (t.laughs / t.messages) * 5);
  const avgWords = r.words.avgWordsPerMessage;
  if (avgWords >= 11) add('Deep talkers', `${fmtNum(avgWords)} words per message`, 1);
  if (avgWords <= 4.5) add('Short & snappy', `just ${fmtNum(avgWords)} words per message`, 0.8);
  if (r.meta.hinglishShare >= 0.12) add('Hinglish spoken', 'English + Hindi, mixed freely', 0.7);
  if (r.meta.isGroup && humans.length >= 3) {
    if (t.balance >= 0.9) add('Everyone talks', 'messages are spread evenly', 0.9);
    const topShare = top.messages / t.messages;
    if (topShare >= 0.5) add('One-person show', `${r.people[top.id].short} sends ${fmtPct(topShare)} of messages`, topShare * 2);
  }
  if (r.vibes.sentiment.net >= 12) add('Good vibes', 'far more positive than negative messages', 0.9);
  if (r.vibes.sentiment.net <= -2) add('Rant central', 'more negative than positive messages', 0.9);

  return tags
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
    .map(({ label, detail }) => ({ label, detail }));
}
