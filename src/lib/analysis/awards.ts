import { emojiDisplay } from './features';
import { fmtDate, fmtDays, fmtDuration, fmtInt, fmtNum, fmtPct, plural } from '../format';
import type { Award, PersonStats, Report } from './types';

interface AwardDef {
  id: string;
  title: string;
  icon: string;
  group: Award['group'];
  /** Metric to rank by; return null to exclude the person. */
  metric: (p: PersonStats, r: Report) => number | null;
  /** Lowest value wins instead of highest. */
  lowest?: boolean;
  /** Rate-based awards need enough messages to be fair. */
  rate?: boolean;
  /** Minimum number of eligible people (e.g. group-only awards). */
  minPeople?: number;
  /** The winner must reach this value for the award to mean anything. */
  minValue?: number;
  value: (p: PersonStats, r: Report) => string;
  blurb: (p: PersonStats, r: Report) => string;
}

const share = (x: number, total: number) => (total > 0 ? x / total : 0);

const DEFS: AwardDef[] = [
  // ── volume ─────────────────────────────────────────────
  {
    id: 'yapper',
    title: 'The Yapper',
    icon: 'Megaphone',
    group: 'volume',
    metric: (p) => p.messages,
    value: (p) => plural(p.messages, 'message'),
    blurb: (p, r) => `Sent ${fmtPct(share(p.messages, r.totals.messages))} of every message in the chat.`,
  },
  {
    id: 'novelist',
    title: 'The Novelist',
    icon: 'BookOpen',
    group: 'volume',
    rate: true,
    minValue: 6,
    metric: (p) => (p.textMessages >= 20 ? p.avgWords : null),
    value: (p) => `${fmtNum(p.avgWords)} words / msg`,
    blurb: () => 'Writes the longest messages on average. Paragraphs, not texts.',
  },
  {
    id: 'dry-texter',
    title: 'Dry Texter',
    icon: 'Minus',
    group: 'volume',
    rate: true,
    minValue: 0.08,
    metric: (p) => (p.textMessages >= 20 ? p.oneWord / p.textMessages : null),
    value: (p) => `${fmtPct(p.oneWord / Math.max(1, p.textMessages))} one-worders`,
    blurb: () => '"k". "ok". "fr". Keeps replies to a single word more than anyone.',
  },
  {
    id: 'paparazzi',
    title: 'Paparazzi',
    icon: 'Camera',
    group: 'volume',
    metric: (p) => p.media,
    value: (p) => plural(p.media, 'media file'),
    blurb: () => 'Shared the most photos, videos, stickers and voice notes.',
  },
  {
    id: 'link-dealer',
    title: 'Link Dealer',
    icon: 'Link',
    group: 'volume',
    metric: (p) => p.links,
    value: (p) => plural(p.links, 'link'),
    blurb: (p) => (p.topDomains[0] ? `Mostly from ${p.topDomains[0][0]}.` : 'Always sharing something to check out.'),
  },
  {
    id: 'essayist',
    title: 'The Essayist',
    icon: 'ScrollText',
    group: 'volume',
    metric: (p) => p.longestMessage?.words ?? 0,
    value: (p) => `${fmtInt(p.longestMessage?.words ?? 0)} words`,
    blurb: (p) => `Wrote the chat's longest single message${p.longestMessage ? ` on ${fmtDate(p.longestMessage.ts)}` : ''}.`,
  },
  {
    id: 'thesaurus',
    title: 'Walking Thesaurus',
    icon: 'Brain',
    group: 'volume',
    rate: true,
    minValue: 0.3,
    metric: (p) => p.richness,
    value: (p) => `${Math.round((p.richness ?? 0) * 100)}/100 variety`,
    blurb: () => 'Most varied vocabulary — repeats themselves the least.',
  },
  // ── style ──────────────────────────────────────────────
  {
    id: 'emoji-addict',
    title: 'Emoji Addict',
    icon: 'Smile',
    group: 'style',
    rate: true,
    minValue: 0.08,
    metric: (p) => p.emojis / Math.max(1, p.messages),
    value: (p) => `${fmtNum(p.emojis / Math.max(1, p.messages), 2)} per msg`,
    blurb: (p) =>
      p.topEmojis[0] ? `Favourite: ${emojiDisplay(p.topEmojis[0][0])} (${fmtInt(p.topEmojis[0][1])}×).` : 'Speaks fluent emoji.',
  },
  {
    id: 'caps',
    title: 'CAPS LOCK CHAMP',
    icon: 'Type',
    group: 'style',
    rate: true,
    minValue: 0.01,
    metric: (p) => p.caps / Math.max(1, p.textMessages),
    value: (p) => `${fmtPct(p.caps / Math.max(1, p.textMessages), 1)} shouted`,
    blurb: () => 'WHY IS EVERYTHING IN CAPITALS.',
  },
  {
    id: 'curious',
    title: 'Curious Cat',
    icon: 'CircleHelp',
    group: 'style',
    rate: true,
    minValue: 0.03,
    metric: (p) => p.questions / Math.max(1, p.textMessages),
    value: (p) => `${fmtPct(p.questions / Math.max(1, p.textMessages))} questions`,
    blurb: (p) => `Asked ${plural(p.questions, 'question')} — the chat's investigator.`,
  },
  {
    id: 'hype',
    title: 'Hype Machine',
    icon: 'Zap',
    group: 'style',
    rate: true,
    minValue: 0.03,
    metric: (p) => p.exclaims / Math.max(1, p.textMessages),
    value: (p) => `${fmtPct(p.exclaims / Math.max(1, p.textMessages))} with “!”`,
    blurb: () => 'Brings the energy!!! Most exclamation marks per message.',
  },
  {
    id: 'deleter',
    title: 'Evidence Destroyer',
    icon: 'Trash2',
    group: 'style',
    metric: (p) => p.deleted,
    value: (p) => plural(p.deleted, 'deleted message'),
    blurb: () => 'Deleted the most messages. What were they hiding?',
  },
  {
    id: 'editor',
    title: 'The Perfectionist',
    icon: 'Pencil',
    group: 'style',
    metric: (p) => p.edited,
    value: (p) => plural(p.edited, 'edit'),
    blurb: () => 'Edits messages after sending more than anyone.',
  },
  {
    id: 'double-texter',
    title: 'Double Texter',
    icon: 'Repeat',
    group: 'style',
    metric: (p) => p.doubleTexts,
    value: (p) => plural(p.doubleTexts, 'follow-up'),
    blurb: () => 'Texts again after 20+ minutes of no reply. Persistent.',
  },
  {
    id: 'machine-gun',
    title: 'Machine Gunner',
    icon: 'Layers',
    group: 'style',
    rate: true,
    minValue: 1.3,
    metric: (p) => p.avgBurst,
    value: (p) => `${fmtNum(p.avgBurst, 2)} msgs / turn`,
    blurb: (p) => `Sends messages in bursts — record: ${plural(p.maxBurst?.count ?? 0, 'message')} in a row.`,
  },
  // ── time ───────────────────────────────────────────────
  {
    id: 'night-owl',
    title: 'Night Owl',
    icon: 'Moon',
    group: 'time',
    rate: true,
    minValue: 0.03,
    metric: (p) => p.nightShare,
    value: (p) => `${fmtPct(p.nightShare)} after midnight`,
    blurb: () => 'Most active between midnight and 5 AM. Sleep is optional.',
  },
  {
    id: 'early-bird',
    title: 'Early Bird',
    icon: 'Sunrise',
    group: 'time',
    rate: true,
    minValue: 0.03,
    metric: (p) => p.morningShare,
    value: (p) => `${fmtPct(p.morningShare)} before 9 AM`,
    blurb: () => 'First to text in the morning (5–9 AM).',
  },
  {
    id: 'streak',
    title: 'Streak Master',
    icon: 'Flame',
    group: 'time',
    metric: (p) => p.longestStreak?.days ?? 0,
    value: (p) => `${fmtDays(p.longestStreak?.days ?? 0)} straight`,
    blurb: (p) => (p.longestStreak ? `Texted every single day from ${fmtDate(p.longestStreak.start)}.` : ''),
  },
  {
    id: 'ghost',
    title: 'The Ghost',
    icon: 'Ghost',
    group: 'time',
    metric: (p) => (p.messages >= 5 ? (p.longestAbsence?.days ?? 0) : null),
    value: (p) => `${fmtDays(p.longestAbsence?.days ?? 0)} silent`,
    blurb: (p) =>
      p.longestAbsence
        ? `Vanished from ${fmtDate(p.longestAbsence.start)} to ${fmtDate(p.longestAbsence.end)}.`
        : 'Here one moment, gone the next.',
  },
  {
    id: 'weekend',
    title: 'Weekend Warrior',
    icon: 'PartyPopper',
    group: 'time',
    rate: true,
    minValue: 0.2,
    metric: (p) => p.weekendShare,
    value: (p) => `${fmtPct(p.weekendShare)} on weekends`,
    blurb: () => 'Comes alive on Saturdays and Sundays.',
  },
  {
    id: 'speed-demon',
    title: 'Speed Demon',
    icon: 'Gauge',
    group: 'time',
    lowest: true,
    metric: (p) => (p.replyCount >= 20 ? p.replyMeanMs : null),
    value: (p) => `avg ${fmtDuration(p.replyMeanMs)}`,
    blurb: (p) => `Replies within a minute ${fmtPct(p.replyQuickShare)} of the time. Phone permanently in hand.`,
  },
  {
    id: 'slowpoke',
    title: 'Slowpoke',
    icon: 'Snail',
    group: 'time',
    metric: (p) => (p.replyCount >= 20 ? p.replyMeanMs : null),
    value: (p) => `avg ${fmtDuration(p.replyMeanMs)}`,
    blurb: () => 'Slowest average reply. Messages arrive… eventually.',
  },
  // ── social ─────────────────────────────────────────────
  {
    id: 'ice-breaker',
    title: 'Ice Breaker',
    icon: 'Flag',
    group: 'social',
    metric: (p) => p.conversationsStarted,
    value: (p, r) => `${fmtPct(share(p.conversationsStarted, r.conversations.count))} of chats`,
    blurb: (p) => `Kicked off ${plural(p.conversationsStarted, 'conversation')} after a lull.`,
  },
  {
    id: 'left-on-read',
    title: 'Left on Read',
    icon: 'EyeOff',
    group: 'social',
    rate: true,
    minValue: 0.03,
    metric: (p) => (p.turns >= 20 ? p.conversationsEnded / p.turns : null),
    value: (p) => `${fmtPct(p.conversationsEnded / Math.max(1, p.turns))} unanswered`,
    blurb: () => 'Most likely to send a message that nobody replies to.',
  },
  {
    id: 'class-clown',
    title: 'Class Clown',
    icon: 'Laugh',
    group: 'social',
    rate: true,
    minValue: 0.01,
    metric: (p) => p.laughsReceived / Math.max(1, p.messages),
    value: (p) => `${fmtPct(p.laughsReceived / Math.max(1, p.messages))} got laughs`,
    blurb: (p) => `Made someone laugh ${plural(p.laughsReceived, 'time')}. The funniest one here.`,
  },
  {
    id: 'easy-audience',
    title: 'Easy Audience',
    icon: 'SmilePlus',
    group: 'social',
    rate: true,
    minValue: 0.02,
    metric: (p) => p.laughs / Math.max(1, p.messages),
    value: (p) => `${fmtPct(p.laughs / Math.max(1, p.messages))} laughing`,
    blurb: () => 'Laughs at everything — lol, haha, 😂 on repeat.',
  },
  {
    id: 'tagger',
    title: 'The Tagger',
    icon: 'AtSign',
    group: 'social',
    minPeople: 3,
    metric: (p) => p.mentionsSent,
    value: (p) => plural(p.mentionsSent, 'tag'),
    blurb: () => 'Summons people with @mentions the most.',
  },
  {
    id: 'main-character',
    title: 'Main Character',
    icon: 'Star',
    group: 'social',
    minPeople: 3,
    metric: (p) => p.mentionsReceived,
    value: (p) => `tagged ${plural(p.mentionsReceived, 'time')}`,
    blurb: () => 'The most @mentioned person. Everyone needs them.',
  },
  {
    id: 'pollster',
    title: 'The Pollster',
    icon: 'Vote',
    group: 'social',
    metric: (p) => p.polls,
    value: (p) => plural(p.polls, 'poll'),
    blurb: () => 'Democracy enjoyer. Created the most polls.',
  },
  // ── vibe ───────────────────────────────────────────────
  {
    id: 'toxic',
    title: 'Most Toxic',
    icon: 'Skull',
    group: 'vibe',
    rate: true,
    minValue: 0.5,
    metric: (p) => p.toxicity.per100,
    value: (p) => `${fmtNum(p.toxicity.per100)} per 100 msgs`,
    blurb: (p) => `Spicy words in ${fmtPct(p.toxicity.share)} of their messages.`,
  },
  {
    id: 'kindest',
    title: 'Kindest Soul',
    icon: 'HeartHandshake',
    group: 'vibe',
    rate: true,
    minValue: 0.5,
    metric: (p) => p.kindness.per100,
    value: (p) => `${fmtNum(p.kindness.per100)} per 100 msgs`,
    blurb: () => 'Most thank-yous, sorrys, hearts and encouragement.',
  },
  {
    id: 'sunshine',
    title: 'Ray of Sunshine',
    icon: 'Sun',
    group: 'vibe',
    rate: true,
    metric: (p) => p.sentiment.net,
    value: (p) => `${p.sentiment.net >= 0 ? '+' : ''}${fmtNum(p.sentiment.net)} mood`,
    blurb: () => 'The most positive messages on balance.',
  },
  {
    id: 'storm-cloud',
    title: 'Storm Cloud',
    icon: 'CloudRain',
    group: 'vibe',
    rate: true,
    lowest: true,
    metric: (p) => p.sentiment.net,
    value: (p) => `${p.sentiment.net >= 0 ? '+' : ''}${fmtNum(p.sentiment.net)} mood`,
    blurb: () => 'The most negative messages on balance. Grumpy, but honest.',
  },
  {
    id: 'romantic',
    title: 'Hopeless Romantic',
    icon: 'Heart',
    group: 'vibe',
    rate: true,
    minValue: 0.3,
    metric: (p) => p.emotions.love,
    value: (p) => `${fmtNum(p.emotions.love)} per 100 msgs`,
    blurb: () => 'Most love-coded words and hearts.',
  },
  {
    id: 'grateful',
    title: 'Most Grateful',
    icon: 'HandHeart',
    group: 'vibe',
    metric: (p) => p.kindness.breakdown.gratitude,
    value: (p) => plural(p.kindness.breakdown.gratitude, 'thank-you'),
    blurb: () => 'Says thank you the most.',
  },
  {
    id: 'apologizer',
    title: 'Sorry Not Sorry',
    icon: 'Hand',
    group: 'vibe',
    metric: (p) => p.kindness.breakdown.apology,
    value: (p) => plural(p.kindness.breakdown.apology, 'apology', 'apologies'),
    blurb: () => 'Apologises the most. Probably for a reason.',
  },
  {
    id: 'drama',
    title: 'Drama Royalty',
    icon: 'Drama',
    group: 'vibe',
    rate: true,
    minValue: 1,
    metric: (p) => p.emotions.anger + p.emotions.sadness + p.emotions.surprise + p.emotions.fear,
    value: (p) =>
      `${fmtNum(p.emotions.anger + p.emotions.sadness + p.emotions.surprise + p.emotions.fear)} per 100 msgs`,
    blurb: () => 'Most emotionally intense — shock, anger, tears and panic.',
  },
];

export const AWARD_GROUPS: { id: Award['group']; label: string }[] = [
  { id: 'volume', label: 'Output' },
  { id: 'style', label: 'Style' },
  { id: 'time', label: 'Timing' },
  { id: 'social', label: 'Social' },
  { id: 'vibe', label: 'Vibes' },
];

export function computeAwards(r: Report): Award[] {
  const humans = r.perPerson.filter((p) => !r.people[p.id].isBot && p.messages > 0);
  const rateMin = Math.max(20, Math.round(r.totals.messages * 0.01));
  const awards: Award[] = [];
  for (const def of DEFS) {
    const pool = def.rate ? humans.filter((p) => p.messages >= rateMin) : humans;
    if (pool.length < Math.max(2, def.minPeople ?? 2)) continue;
    const scored = pool
      .map((p) => ({ p, v: def.metric(p, r) }))
      .filter((x): x is { p: PersonStats; v: number } => x.v !== null && Number.isFinite(x.v));
    if (scored.length < 2) continue;
    scored.sort((a, b) => (def.lowest ? a.v - b.v : b.v - a.v) || b.p.messages - a.p.messages);
    const [win, second] = scored;
    // An award for "most deletions" with zero deletions is no award at all.
    if (!def.lowest && win.v <= 0) continue;
    if (def.minValue !== undefined && win.v < def.minValue) continue;
    if (win.v === second.v && !['yapper'].includes(def.id)) {
      // Exact ties on rare counts (e.g. 1 poll each) aren't worth crowning.
      if (win.v < 3) continue;
    }
    awards.push({
      id: def.id,
      title: def.title,
      icon: def.icon,
      group: def.group,
      winner: win.p.id,
      value: def.value(win.p, r),
      blurb: def.blurb(win.p, r),
      runnerUp: { id: second.p.id, value: def.value(second.p, r) },
    });
    r.perPerson[win.p.id].awards.push(def.id);
  }
  return awards;
}
