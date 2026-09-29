/**
 * Deterministic synthetic group chat for the demo — five fictional friends with
 * distinct habits, so every chart and award has something to show. Output is a
 * genuine Android-style export (with U+202F before AM/PM) that goes through the
 * real parser.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Topic = 'plans' | 'food' | 'gaming' | 'shows' | 'work' | 'life';

interface Member {
  name: string;
  /** Relative activity. */
  weight: number;
  /** Hour-of-day preference (24 weights). */
  hours: number[];
  /** Typical reply delay range in minutes. */
  delay: [number, number];
  burst: number;
  emoji: string[];
  emojiRate: number;
  mediaRate: number;
  lines: string[];
  deleteRate: number;
  editRate: number;
}

const hoursFrom = (peaks: [number, number][]) => {
  const w = new Array(24).fill(0.15);
  for (const [h, weight] of peaks) {
    for (let d = -2; d <= 2; d++) w[(h + d + 24) % 24] += weight * (1 - Math.abs(d) * 0.3);
  }
  return w;
};

const MEMBERS: Member[] = [
  {
    name: 'Maya Chen',
    weight: 1.45,
    hours: hoursFrom([
      [22, 3],
      [1, 2.2],
      [15, 1],
    ]),
    delay: [0, 3],
    burst: 0.42,
    emoji: ['😂', '😭', '✨', '🥹', '💀', '😂', '🫶'],
    emojiRate: 0.45,
    mediaRate: 0.06,
    deleteRate: 0.004,
    editRate: 0.004,
    lines: [
      'hahaha no way 😂',
      'omg stop',
      'I love this so much',
      'wait what',
      'screaming',
      'lmaooo',
      'not me crying at this',
      'okay but hear me out',
      'this is so us',
      'the way I just laughed',
      'yesss',
      'we HAVE to',
      'bestie no',
      "I'm dead",
      "okay I can't sleep again",
      'who is still awake',
      'this song is literally my whole personality right now',
      'ok storytime',
      'I just saw the funniest thing on the metro',
      'NO WAY',
    ],
  },
  {
    name: 'Leo Park',
    weight: 1.05,
    hours: hoursFrom([
      [23, 2.6],
      [20, 1.4],
    ]),
    delay: [0, 1],
    burst: 0.18,
    emoji: ['💀', '🔥'],
    emojiRate: 0.06,
    mediaRate: 0.03,
    deleteRate: 0.002,
    editRate: 0.001,
    lines: [
      'k',
      'ok',
      'fr',
      'lol',
      'yeah',
      'gg',
      'same',
      'bet',
      'nah',
      'true',
      'damn',
      'wtf',
      'omw',
      'sure',
      'idk',
      'lmao',
      'valorant?',
      'pass',
      'one more game',
      'my aim is trash today',
    ],
  },
  {
    name: 'Priya Nair',
    weight: 1.2,
    hours: hoursFrom([
      [7, 2.4],
      [19, 1.8],
      [13, 0.8],
    ]),
    delay: [1, 8],
    burst: 0.3,
    emoji: ['❤\ufe0f', '🥰', '🙏', '☀\ufe0f', '🎉'],
    emojiRate: 0.3,
    mediaRate: 0.04,
    deleteRate: 0.002,
    editRate: 0.006,
    lines: [
      'thank you so much!',
      "you're the best, seriously",
      'proud of you!!',
      'take care okay?',
      "don't worry, it'll be fine",
      'good luck tomorrow',
      'love you guys',
      "that's amazing, congrats!",
      'please let me know when you reach home',
      'sorry I was busy! what did I miss?',
      "I'll book the table for 7",
      'can we plan this properly this time',
      'sharing the itinerary now',
      'good morning everyone',
      'thanks for today, it was so much fun',
      'drink water and sleep early please',
      'happy birthday!! have the best day',
    ],
  },
  {
    name: 'Sam Rivera',
    weight: 1.0,
    hours: hoursFrom([
      [17, 2],
      [21, 1.6],
    ]),
    delay: [0, 4],
    burst: 0.35,
    emoji: ['😂', '🤡', '💀', '😈'],
    emojiRate: 0.2,
    mediaRate: 0.16,
    deleteRate: 0.003,
    editRate: 0.002,
    lines: [
      'shut up 😂',
      "you're an idiot",
      'wtf is this',
      'bro you suck at this',
      'stfu',
      "that's so dumb",
      'lmao loser',
      'damn',
      'not you again',
      'classic',
      'who asked',
      'this is peak comedy',
      'brace yourselves, memes incoming',
      'ok this one is actually funny',
      "I'm not even joking",
      'what a clown',
    ],
  },
  {
    name: 'Kenji Watanabe',
    weight: 0.62,
    hours: hoursFrom([
      [14, 1.6],
      [11, 1],
      [18, 1],
    ]),
    delay: [4, 35],
    burst: 0.22,
    emoji: ['☕', '👀', '🤔'],
    emojiRate: 0.14,
    mediaRate: 0.05,
    deleteRate: 0.02,
    editRate: 0.02,
    lines: [
      'wait what happened?',
      "who's coming?",
      'what time?',
      'does anyone know a good coffee place?',
      'how was it?',
      'is it tomorrow or friday?',
      'sorry just saw this',
      'where?',
      'can someone explain',
      'what did I miss?',
      'should I bring anything?',
      'ooh nice',
      'hmm interesting',
      'is this a joke?',
    ],
  },
];

const OPENERS: Record<Topic, string[]> = {
  plans: [
    'anyone free this weekend?',
    'we should do something saturday',
    "who's in for friday night?",
    "let's meet at 7",
    'booking the tickets now',
    'can someone pick me up tomorrow',
    'where are we meeting',
    'running 10 min late sorry',
    'trip planning time. beach or mountains?',
  ],
  food: [
    "I'm starving",
    'pizza tonight?',
    'that ramen place was amazing',
    'coffee run anyone ☕',
    'ordering tacos, want anything?',
    'brunch sunday?',
    'I made pasta today and it was so good',
    'we need to try the new sushi place',
  ],
  gaming: ['valorant tonight?', 'gg that was insane', "who's online", 'ranked?', 'that clutch though', 'lobby is up'],
  shows: [
    'did you watch the new episode??',
    'no spoilers pls',
    'this song is stuck in my head',
    'movie night friday?',
    'the trailer looks so good',
    'adding this to the playlist',
  ],
  work: [
    'exam tomorrow and I know nothing',
    'deadline is killing me',
    'meeting ran over again',
    'finally submitted the assignment',
    'interview went well I think!',
    'office is so boring today',
  ],
  life: [
    'guess what happened today',
    "I can't sleep",
    'good morning people',
    'good night guys',
    "I'm so tired",
    'this week has been crazy',
    'okay who ate my fries',
  ],
};

const LAUGHS = ['😂😂', 'hahaha', 'lmao', 'LMAO', '💀', 'lol', 'hahaha stop', '😭😭'];
const LINKS = [
  'https://youtu.be/dQw4w9WgXcQ',
  'https://www.instagram.com/reel/C0ffee123/',
  'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
  'https://www.reddit.com/r/funny/comments/abc123/',
  'https://maps.google.com/?q=cafe+central',
];
const LONG_LINES = [
  'okay so here is the plan: we meet at the station at 8, grab breakfast near the platform, take the 9:15 train and should reach by noon. check-in is at 2 so we can drop bags and go straight to the beach. dinner reservation is at 8, I already booked it. please please please be on time this time!',
  "honestly I've been thinking about this all week and I just want to say you guys are the best part of my year. it's been a lot with work and everything but these chats keep me sane. anyway, enough being soft, who is getting pizza",
  'so the story is: I went to the wrong building, waited 20 minutes, realised the meeting was online, joined with my camera on while still walking in the rain, and my boss thought I was on a beach holiday. worst morning ever but also kind of iconic',
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function stamp(ts: number): string {
  const d = new Date(ts);
  const h = d.getUTCHours();
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${String(d.getUTCFullYear()).slice(2)}, ${h % 12 || 12}:${pad(
    d.getUTCMinutes(),
  )}\u202f${h < 12 ? 'AM' : 'PM'}`;
}

export const DEMO_FILE_NAME = 'WhatsApp Chat with Weekend Crew.txt';

export function generateDemoChat(seed = 7): string {
  const rand = mulberry32(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const weighted = (weights: number[]) => {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  };
  const lines: string[] = [];
  const say = (ts: number, who: number, text: string) => lines.push(`${stamp(ts)} - ${MEMBERS[who].name}: ${text}`);
  const system = (ts: number, text: string) => lines.push(`${stamp(ts)} - ${text}`);

  const start = Date.UTC(2024, 2, 1, 18, 0);
  const end = Date.UTC(2025, 8, 28, 23, 0);
  system(start - 60_000, 'Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.');
  system(start, 'Maya Chen created group "Weekend Crew"');
  for (let i = 1; i < MEMBERS.length; i++) system(start + i * 60_000, `Maya Chen added ${MEMBERS[i].name}`);
  const t = start + 10 * 60_000;
  say(t, 0, 'welcome to the chaos ✨');
  const topics: Topic[] = ['plans', 'food', 'gaming', 'shows', 'work', 'life'];
  const topicWeights = [1.4, 1.1, 0.9, 0.8, 0.9, 1.2];
  const reply = [
    [0, 0.8, 1.6, 1.1, 0.5],
    [0.8, 0, 0.5, 1.7, 0.4],
    [1.7, 0.5, 0, 0.7, 0.9],
    [1.1, 1.8, 0.6, 0, 0.5],
    [0.8, 0.4, 1.2, 0.6, 0],
  ];
  let polls = 0;
  let pinned = 0;
  let lastTs = t;
  const DAY = 86_400_000;
  for (let day = Math.floor(start / DAY) + 1; day * DAY < end; day++) {
    const dow = (day + 4) % 7; // 0 = Sunday
    const weekend = dow === 0 || dow === 6;
    const month = new Date(day * DAY).getUTCMonth();
    // Quieter mid-year, a lull in February, livelier weekends & December.
    let intensity = weekend ? 1.35 : 1;
    if (month === 11) intensity *= 1.5;
    if (month === 1) intensity *= 0.55;
    if (month >= 5 && month <= 7) intensity *= 0.85;
    // A two-week silence (everyone travelling) — shows up as the longest gap.
    const dayDate = new Date(day * DAY);
    if (dayDate.getUTCFullYear() === 2024 && month === 7 && dayDate.getUTCDate() >= 8 && dayDate.getUTCDate() <= 21) continue;
    const convos = Math.max(0, Math.round(intensity * (0.4 + rand() * 2.4)));
    let clock = Math.max(lastTs, day * DAY + 6 * 3_600_000);
    for (let c = 0; c < convos; c++) {
      const starter = weighted(MEMBERS.map((m, i) => m.weight * (i === 0 || i === 2 ? 1.3 : 1)));
      const hourWeights = MEMBERS[starter].hours.map((w, h) => (h < 6 ? w * 0.5 : w));
      const hour = weighted(hourWeights);
      let ts = Math.max(clock + 30 * 60_000, day * DAY + hour * 3_600_000 + Math.floor(rand() * 60) * 60_000);
      if (ts >= (day + 1) * DAY + 3 * 3_600_000) break;
      const topic = topics[weighted(topicWeights)];
      const special = rand() < 0.035;
      let length = special ? 80 + Math.floor(rand() * 220) : 3 + Math.floor(-Math.log(1 - rand()) * 14);
      let who = starter;
      say(ts, who, pick(OPENERS[topic]));
      let lastWasJoke = who === 3 || (who === 0 && rand() < 0.3);
      while (--length > 0) {
        const m = MEMBERS[who];
        let next = who;
        if (rand() > m.burst) next = weighted(reply[who].map((w, i) => w * MEMBERS[i].weight));
        const nm = MEMBERS[next];
        const delayMin = next === who ? rand() * 1.2 : nm.delay[0] + rand() ** 2 * (nm.delay[1] - nm.delay[0]);
        ts += Math.round(delayMin) * 60_000;
        who = next;
        let text: string;
        const r = rand();
        if (lastWasJoke && next !== 3 && r < 0.55) text = pick(LAUGHS);
        else if (r < nm.mediaRate) text = '<Media omitted>';
        else if (next === 3 && r < 0.22) text = pick(LINKS);
        else if (next === 2 && r > 0.985) text = LONG_LINES[Math.floor(rand() * 2)];
        else if (next === 0 && r > 0.992) text = LONG_LINES[2];
        else if (r < 0.3) text = pick(OPENERS[topic]);
        else text = pick(nm.lines);
        if (text !== '<Media omitted>' && !text.startsWith('http') && rand() < nm.emojiRate) {
          text += ' ' + pick(nm.emoji) + (rand() < 0.3 ? pick(nm.emoji) : '');
        }
        if (rand() < 0.03 && next !== 1) {
          const target = weighted(MEMBERS.map((_, i) => (i === next ? 0 : i === 1 ? 2 : 1)));
          text = `@\u2068${MEMBERS[target].name}\u2069 ${pick(['you coming?', 'look at this', 'your turn', 'reply pls'])}`;
        }
        if (rand() < nm.deleteRate) text = 'This message was deleted';
        else if (rand() < nm.editRate) text += ' <This message was edited>';
        say(ts, who, text);
        lastWasJoke = (who === 3 || who === 0) && rand() < 0.45;
      }
      if (topic === 'plans' && polls < 9 && rand() < 0.12) {
        ts += 60_000;
        polls++;
        const [q, a, b, cOpt] = pick([
          ['Dinner on Friday?', 'Sushi', 'Pizza', 'Tacos'],
          ['Beach or mountains?', 'Beach', 'Mountains', 'Stay home'],
          ['Movie night pick', 'Horror', 'Comedy', 'Anime'],
        ]);
        const votes = [1 + Math.floor(rand() * 3), Math.floor(rand() * 3), Math.floor(rand() * 2)];
        lines.push(
          `${stamp(ts)} - Priya Nair: POLL:\n${q}\nOPTION: ${a} (${votes[0]} ${votes[0] === 1 ? 'vote' : 'votes'})\nOPTION: ${b} (${votes[1]} ${
            votes[1] === 1 ? 'vote' : 'votes'
          })\nOPTION: ${cOpt} (${votes[2]} ${votes[2] === 1 ? 'vote' : 'votes'})\n`,
        );
      }
      if (special && pinned < 3) {
        pinned++;
        system(ts + 60_000, `${MEMBERS[starter].name} pinned a message`);
      }
      clock = ts;
      lastTs = ts;
    }
    if (day === Math.floor(Date.UTC(2024, 9, 12) / DAY)) {
      system(day * DAY + 15 * 3_600_000, 'Priya Nair changed the subject from "Weekend Crew" to "Weekend Crew 🌊"');
    }
  }
  return lines.join('\n') + '\n';
}
