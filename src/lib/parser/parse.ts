import {
  ChatParseError,
  type ChatMessage,
  type DateOrder,
  type MediaKind,
  type ParsedChat,
  type Poll,
  type SystemEvent,
  type SystemEventKind,
} from './types';

/*
 * WhatsApp exports come in two families:
 *
 *   Android  12/11/23, 3:41 PM - Name: message        (U+202F often sits before AM/PM)
 *            12/11/2023, 15:41 - Name: message
 *   iOS      [12/11/23, 3:41:22 PM] Name: message      (markers prefixed with U+200E)
 *
 * Dates may be D/M/Y, M/D/Y or Y-M-D with `/`, `.` or `-` separators. Lines that
 * don't start with a header continue the previous message.
 */

const DATE = String.raw`(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})`;
const TIME = String.raw`(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?`;
const AMPM = String.raw`(?:[\s\u202f\u00a0]*([AaPp])\.?\s?[Mm]\.?)?`;

const ANDROID_HEADER = new RegExp(String.raw`^[\u200e\u200f]?${DATE},?\s+${TIME}${AMPM}\s+[-–]\s+`);
const IOS_HEADER = new RegExp(String.raw`^[\u200e\u200f]?\[${DATE},?\s+${TIME}${AMPM}\]\s+`);

/** "Name: " at the start of a message (never crossing a newline). */
const SENDER = /^(.{1,160}?):(?: |$)/;

/** Phrases that only ever appear in system notices — a "sender" containing one is bogus. */
const SYSTEM_IN_SENDER =
  /\b(changed the subject|changed the group|changed this group|created group|created the group|added|removed|joined using|security code|end-to-end|messages and calls|pinned a message|changed their phone|deleted this group)\b/i;

const LRM_RE = /[\u200e\u200f]/g;
const BIDI_RE = /[\u202a-\u202e\u2066-\u2069]/g;

const EDITED_RE =
  /[\s\u200e\u200f]*<(?:This message was edited|Se editó este mensaje\.?|Diese Nachricht wurde bearbeitet\.?|Mensagem editada|Ce message a été modifié|Messaggio modificato|Dit bericht is bewerkt)>[\s\u200e\u200f]*$/i;

const DELETED_RE =
  /^(?:This message was deleted|You deleted this message|Se eliminó este mensaje|Eliminaste este mensaje|Diese Nachricht wurde gelöscht|Du hast diese Nachricht gelöscht|Mensagem apagada|Esta mensagem foi apagada|Você apagou esta mensagem|Ce message a été supprimé|Vous avez supprimé ce message|Questo messaggio è stato eliminato|Hai eliminato questo messaggio|Dit bericht is verwijderd|Je hebt dit bericht verwijderd)\.?$/i;

const IOS_OMITTED_RE = /(?:^|\s)(image|video|audio|sticker|GIF|document|Contact card) omitted$/i;
const ANDROID_ATTACHED_RE = /^(.+?) \(file attached\)$/;
const IOS_ATTACHED_RE = /^<attached: (.+?)>$/;
const MEDIA_PLACEHOLDER_RE = /^<[^<>\n]{2,48}>$/;
const LOCATION_RE = /^(?:location: https?:\/\/\S+|live location shared|Location: https?:\/\/\S+)/i;
const CALL_RE = /^(?:Missed )?(?:group )?(?:voice|video) call\b/i;
const POLL_OPTION_RE = /^OPTION: (.*) \((\d+) votes?\)$/;

const SYSTEM_KINDS: [SystemEventKind, RegExp][] = [
  ['encryption', /end-to-end encrypted|can be read by Meta|messages that mention/i],
  ['security', /security code/i],
  ['created', /created (?:the )?group/i],
  ['subject', /changed the (?:subject|group name)/i],
  ['icon', /group(?:'s)? icon/i],
  ['description', /group description/i],
  ['pinned', /pinned a message/i],
  ['number', /changed (?:their|your) phone number|changed to \+?\d/i],
  ['admin', /\badmin\b/i],
  ['disappearing', /disappearing messages/i],
  ['removed', /\bremoved\b/i],
  ['added', /\badded\b/i],
  ['left', /\bleft$/i],
  ['joined', /\bjoined\b/i],
  ['call', /\bcall\b/i],
];

interface RawEntry {
  a: number;
  b: number;
  c: number;
  yearDigits: number;
  aDigits: number;
  h: number;
  mi: number;
  s: number;
  ampm: string | undefined;
  rest: string;
}

function detectPlatform(lines: string[]): 'android' | 'ios' {
  let android = 0;
  let ios = 0;
  const sample = Math.min(lines.length, 400);
  for (let i = 0; i < sample; i++) {
    const line = lines[i];
    if (IOS_HEADER.test(line)) ios++;
    else if (ANDROID_HEADER.test(line)) android++;
  }
  if (!android && !ios) {
    // Fall back to scanning the whole file — some exports start with long preambles.
    for (const line of lines) {
      if (IOS_HEADER.test(line)) return 'ios';
      if (ANDROID_HEADER.test(line)) return 'android';
    }
    throw new ChatParseError(
      "This doesn't look like a WhatsApp chat export. Export the chat from WhatsApp (Chat → More → Export chat) and upload the .txt or .zip file.",
    );
  }
  return ios > android ? 'ios' : 'android';
}

function collectEntries(lines: string[], header: RegExp) {
  const entries: RawEntry[] = [];
  let skipped = 0;
  let current: RawEntry | null = null;
  for (const line of lines) {
    const m = header.exec(line);
    if (m) {
      current = {
        a: +m[1],
        b: +m[2],
        c: +m[3],
        aDigits: m[1].length,
        yearDigits: m[3].length,
        h: +m[4],
        mi: +m[5],
        s: m[6] ? +m[6] : 0,
        ampm: m[7],
        rest: line.slice(m[0].length),
      };
      entries.push(current);
    } else if (current) {
      current.rest += '\n' + line;
    } else if (line.trim()) {
      skipped++;
    }
  }
  return { entries, skipped };
}

function dayNumber(order: DateOrder, e: RawEntry): number {
  const [y, mo, d] = ymd(order, e);
  return y * 372 + mo * 31 + d;
}

function ymd(order: DateOrder, e: RawEntry): [number, number, number] {
  let y: number;
  let mo: number;
  let d: number;
  if (order === 'YMD') {
    y = e.a;
    mo = e.b;
    d = e.c;
  } else if (order === 'DMY') {
    d = e.a;
    mo = e.b;
    y = e.c;
  } else {
    mo = e.a;
    d = e.b;
    y = e.c;
  }
  if (y < 100) y += 2000;
  return [y, mo, d];
}

function inferDateOrder(entries: RawEntry[]): DateOrder {
  let aOver12 = false;
  let bOver12 = false;
  for (const e of entries) {
    if (e.aDigits === 4) return 'YMD';
    if (e.a > 12) aOver12 = true;
    if (e.b > 12) bOver12 = true;
    if (aOver12 && bOver12) break;
  }
  if (aOver12 && !bOver12) return 'DMY';
  if (bOver12 && !aOver12) return 'MDY';
  // Ambiguous (e.g. every day so far was ≤ 12): exports are chronological, so pick the
  // reading under which dates go backwards least often.
  const inversions = (order: DateOrder) => {
    let count = 0;
    let prev = -1;
    for (const e of entries) {
      const n = dayNumber(order, e);
      if (n < prev) count++;
      prev = n;
    }
    return count;
  };
  const dmy = inversions('DMY');
  const mdy = inversions('MDY');
  if (dmy !== mdy) return dmy < mdy ? 'DMY' : 'MDY';
  return entries.some((e) => e.ampm) ? 'MDY' : 'DMY';
}

export function cleanName(name: string): string {
  return name.replace(BIDI_RE, '').replace(LRM_RE, '').replace(/^~\s*/, '').trim();
}

function mediaKindFromFilename(file: string): MediaKind {
  const f = file.toLowerCase();
  if (/-sticker-|^stk-/.test(f) || f.endsWith('.webp')) return 'sticker';
  if (/-gif-|\.gif$/.test(f)) return 'gif';
  if (/^ptt-|-audio-|\.opus$/.test(f)) return 'voice';
  if (/\.(jpe?g|png|heic|heif|bmp|tiff?)$/.test(f) || /-photo-|^img-/.test(f)) return 'image';
  if (/\.(mp4|mov|3gp|mkv|avi|webm)$/.test(f) || /-video-|^vid-/.test(f)) return 'video';
  if (/\.(mp3|m4a|aac|wav|ogg|amr|flac)$/.test(f) || /^aud-/.test(f)) return 'audio';
  return 'document';
}

const OMITTED_KIND: Record<string, MediaKind> = {
  image: 'image',
  video: 'video',
  audio: 'voice',
  sticker: 'sticker',
  gif: 'gif',
  document: 'document',
};

function parsePoll(body: string): Poll | null {
  const lines = body.split('\n');
  if (!/^POLL:\s*$/.test(lines[0])) return null;
  const question = (lines[1] ?? '').trim();
  const options = [];
  for (const line of lines.slice(2)) {
    const m = POLL_OPTION_RE.exec(line.trim());
    if (m) options.push({ label: m[1].trim(), votes: +m[2] });
  }
  return { question, options };
}

function systemKind(text: string): SystemEventKind {
  for (const [kind, re] of SYSTEM_KINDS) if (re.test(text)) return kind;
  return 'other';
}

function chatNameFromSystem(text: string): string | null {
  const created = /created (?:the )?group [“"](.+)[”"]/i.exec(text);
  if (created) return created[1];
  const subject = /changed the (?:subject|group name) (?:from [“"].*[”"] )?to [“"](.+)[”"]/i.exec(text);
  if (subject) return subject[1];
  return null;
}

type Classified =
  | { system: true; text: string }
  | { system: false; msg: Omit<ChatMessage, 'ts' | 'author'> };

/** Classify a message body (everything after "Name: "). */
function classifyBody(rawBody: string): Classified {
  const startsWithMarker = /^[\u200e\u200f]/.test(rawBody);
  let body = rawBody.replace(/^[\u200e\u200f]+/, '');

  let edited = false;
  if (EDITED_RE.test(body)) {
    edited = true;
    body = body.replace(EDITED_RE, '');
  }
  body = body.replace(/\s+$/, '');
  const firstLine = body.split('\n', 1)[0].replace(LRM_RE, '').trim();
  const caption = body.includes('\n') ? body.slice(body.indexOf('\n') + 1).trim() : '';

  if (DELETED_RE.test(firstLine) && !caption) {
    return { system: false, msg: { kind: 'deleted', text: '', edited } };
  }

  if (/^POLL:/.test(firstLine)) {
    const poll = parsePoll(body.replace(LRM_RE, ''));
    if (poll) return { system: false, msg: { kind: 'poll', text: poll.question, edited, poll } };
  }

  if (/^EVENT:/.test(firstLine)) {
    return { system: false, msg: { kind: 'event', text: firstLine.replace(/^EVENT:\s*/, ''), edited } };
  }

  if (LOCATION_RE.test(firstLine)) {
    return { system: false, msg: { kind: 'location', text: '', edited } };
  }

  const attached = ANDROID_ATTACHED_RE.exec(firstLine) ?? IOS_ATTACHED_RE.exec(firstLine);
  if (attached) {
    const file = attached[1].trim();
    if (/\.vcf$/i.test(file)) return { system: false, msg: { kind: 'contact', text: '', edited } };
    return {
      system: false,
      msg: { kind: 'media', media: mediaKindFromFilename(file), text: caption, edited },
    };
  }

  const omitted = IOS_OMITTED_RE.exec(firstLine);
  if (omitted) {
    const key = omitted[1].toLowerCase();
    if (key === 'contact card') return { system: false, msg: { kind: 'contact', text: '', edited } };
    return {
      system: false,
      msg: { kind: 'media', media: OMITTED_KIND[key] ?? 'other', text: caption, edited },
    };
  }

  if (MEDIA_PLACEHOLDER_RE.test(firstLine)) {
    return { system: false, msg: { kind: 'media', media: 'other', text: caption, edited } };
  }

  // Android writes view-once media as "null"; some media types export as an empty body.
  if (firstLine === 'null' || (firstLine === '' && !caption)) {
    return { system: false, msg: { kind: 'media', media: 'other', text: '', edited } };
  }

  if (CALL_RE.test(firstLine)) {
    return { system: false, msg: { kind: 'call', text: '', edited } };
  }

  // iOS prefixes notices with U+200E ("Group: \u200eAlice added Bob"); anything left that
  // starts with the marker is a system notice attributed to the group name.
  if (startsWithMarker) return { system: true, text: firstLine };

  return { system: false, msg: { kind: 'text', text: body, edited } };
}

export function parseChat(input: string): ParsedChat {
  const text = input.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const platform = detectPlatform(lines);
  const header = platform === 'ios' ? IOS_HEADER : ANDROID_HEADER;
  const { entries, skipped } = collectEntries(lines, header);
  if (entries.length === 0) {
    throw new ChatParseError('No messages were found in this file.');
  }
  const dateOrder = inferDateOrder(entries);

  const participants: string[] = [];
  const participantIndex = new Map<string, number>();
  const messages: ChatMessage[] = [];
  const system: SystemEvent[] = [];
  let chatName: string | null = null;
  let hasAmPm = false;
  const iosSystemSenders = new Map<string, number>();

  for (const e of entries) {
    const [y, mo, d] = ymd(dateOrder, e);
    let h = e.h;
    if (e.ampm) {
      hasAmPm = true;
      h = h % 12;
      if (e.ampm === 'p' || e.ampm === 'P') h += 12;
    }
    const ts = Date.UTC(y, mo - 1, d, h, e.mi, e.s);
    if (Number.isNaN(ts)) continue;

    const rest = e.rest.replace(/^[\u200e\u200f]+/, '');
    const firstLine = rest.split('\n', 1)[0];
    const sender = SENDER.exec(firstLine);
    const name = sender ? cleanName(sender[1]) : '';

    if (!sender || !name || SYSTEM_IN_SENDER.test(sender[1])) {
      const note = rest.replace(LRM_RE, '').trim();
      system.push({ ts, kind: systemKind(note), text: note });
      chatName = chatNameFromSystem(note) ?? chatName;
      continue;
    }

    const classified = classifyBody(rest.slice(sender[0].length));
    if (classified.system) {
      system.push({ ts, kind: systemKind(classified.text), text: classified.text });
      chatName = chatNameFromSystem(classified.text) ?? chatName;
      iosSystemSenders.set(name, (iosSystemSenders.get(name) ?? 0) + 1);
      continue;
    }

    let author = participantIndex.get(name);
    if (author === undefined) {
      author = participants.length;
      participants.push(name);
      participantIndex.set(name, author);
    }
    messages.push({ ts, author, ...classified.msg });
  }

  if (messages.length === 0) {
    throw new ChatParseError('The file was recognised, but it contains no messages from people.');
  }

  // On iOS, group notices are attributed to the group itself.
  if (!chatName && iosSystemSenders.size) {
    const [top] = [...iosSystemSenders.entries()].sort((x, z) => z[1] - x[1]);
    if (!participantIndex.has(top[0])) chatName = top[0];
  }

  // Exports are chronological, but clock changes can leave a few stragglers.
  sortByTime(messages);
  sortByTime(system);

  return {
    messages,
    participants,
    system,
    meta: {
      platform,
      dateOrder,
      clock: hasAmPm ? '12h' : '24h',
      chatName,
      lineCount: lines.length,
      skippedLines: skipped,
    },
  };
}

function sortByTime(items: { ts: number }[]) {
  for (let i = 1; i < items.length; i++) {
    if (items[i].ts < items[i - 1].ts) {
      items.sort((x, z) => x.ts - z.ts);
      return;
    }
  }
}

/** Derive a chat title from an export file name like "WhatsApp Chat with Book Club.txt". */
export function chatNameFromFileName(fileName: string): string | null {
  // Uploads are often renamed ("1d4145ec-WhatsApp_Chat_with_Friends.txt"), so search anywhere.
  const base = fileName
    .replace(/^.*[\\/]/, '')
    .replace(/\.(txt|zip)$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s*\(\d+\)$/, '')
    .trim();
  const patterns = [
    /WhatsApp[\s-]*Chat\s*(?:with|mit|met|con|avec|-)\s*(.+)$/i,
    /Chat\s+de\s+WhatsApp\s+con\s+(.+)$/i,
    /Conversa\s+do\s+WhatsApp\s+com\s+(.+)$/i,
    /Discussion\s+WhatsApp\s+avec\s+(.+)$/i,
    /Chat\s+WhatsApp\s+con\s+(.+)$/i,
  ];
  for (const re of patterns) {
    const m = re.exec(base);
    if (m && m[1].trim()) return m[1].trim();
  }
  if (!base || /^_?chat$/i.test(base.replace(/\s/g, ''))) return null;
  return base;
}
