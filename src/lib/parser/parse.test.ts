import { describe, expect, it } from 'vitest';
import { chatNameFromFileName, parseChat } from './parse';
import { ChatParseError } from './types';

const NNBSP = '\u202f';
const LRM = '\u200e';

const utc = (ts: number) => new Date(ts).toISOString().slice(0, 16);

describe('parseChat — Android, 12h with narrow no-break space', () => {
  const chat = [
    `11/12/23, 12:45${NNBSP}PM - Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them. *Learn more*`,
    `11/12/23, 3:41${NNBSP}PM - Ana Silva: @\u2068Ben Ortiz\u2069`,
    `11/12/23, 3:41${NNBSP}PM - Ben Ortiz: Kk`,
    `11/14/23, 10:52${NNBSP}PM - Chloe Park: Guess what happened today`,
    `the bus was late again`,
    ``,
    `and more`,
    `11/14/23, 11:37${NNBSP}PM - Ana Silva: `,
    `11/14/23, 11:38${NNBSP}PM - Ana Silva: <Media omitted>`,
    `11/15/23, 12:07${NNBSP}AM - Chloe Park: This message was deleted`,
    `11/15/23, 12:08${NNBSP}AM - Ben Ortiz: You deleted this message`,
    `11/25/23, 7:08${NNBSP}PM - Chloe Park: See you at the cafe <This message was edited>`,
    `1/27/24, 4:50${NNBSP}PM - Chloe Park changed the group description`,
    `7/1/24, 5:09${NNBSP}PM - Ana Silva: POLL:`,
    `Movie tomorrow?`,
    `OPTION: Yes (1 vote)`,
    `OPTION: Not Coming (0 votes)`,
    ``,
    `9/28/24, 12:53${NNBSP}PM - Ana Silva: location: https://maps.google.com/?q=48.85,2.35`,
    `11/11/24, 7:17${NNBSP}PM - Ana Silva: EVENT: Saturday picnic`,
    `Event Start time: 1731414600524`,
    `Event Cancelled: false`,
    `11/11/24, 7:17${NNBSP}PM - You pinned a message`,
    `6/29/26, 4:40${NNBSP}PM - Chloe Park: Plumber.vcf (file attached)`,
    `8/10/24, 10:00${NNBSP}AM - Dan (Work) removed Eli (Old Number)`,
    `8/13/24, 5:52${NNBSP}PM - Meta AI: There are no messages to summarize.`,
  ].join('\n');

  const parsed = parseChat(chat);

  it('detects platform, date order and clock', () => {
    expect(parsed.meta.platform).toBe('android');
    expect(parsed.meta.dateOrder).toBe('MDY');
    expect(parsed.meta.clock).toBe('12h');
  });

  it('collects participants in order of first message', () => {
    expect(parsed.participants).toEqual(['Ana Silva', 'Ben Ortiz', 'Chloe Park', 'Meta AI']);
  });

  it('converts 12h times, including 12 AM / 12 PM', () => {
    expect(utc(parsed.messages[0].ts)).toBe('2023-11-12T15:41');
    const deleted = parsed.messages.find((m) => m.kind === 'deleted')!;
    expect(utc(deleted.ts)).toBe('2023-11-15T00:07');
    expect(utc(parsed.system[0].ts)).toBe('2023-11-12T12:45');
  });

  it('joins continuation lines into multi-line messages', () => {
    const multi = parsed.messages.find((m) => m.text.startsWith('Guess what'))!;
    expect(multi.text).toBe('Guess what happened today\nthe bus was late again\n\nand more');
  });

  it('classifies media, deleted, edited, poll, event, location and contacts', () => {
    const kinds = parsed.messages.map((m) => m.kind);
    expect(kinds.filter((k) => k === 'media')).toHaveLength(2); // empty body + <Media omitted>
    expect(kinds.filter((k) => k === 'deleted')).toHaveLength(2);
    const edited = parsed.messages.find((m) => m.edited)!;
    expect(edited.text).toBe('See you at the cafe');
    const poll = parsed.messages.find((m) => m.kind === 'poll')!;
    expect(poll.poll).toEqual({
      question: 'Movie tomorrow?',
      options: [
        { label: 'Yes', votes: 1 },
        { label: 'Not Coming', votes: 0 },
      ],
    });
    expect(parsed.messages.find((m) => m.kind === 'event')!.text).toBe('Saturday picnic');
    expect(kinds).toContain('location');
    expect(kinds).toContain('contact');
  });

  it('keeps mention markers in text for later analysis', () => {
    expect(parsed.messages[0].text).toBe('@\u2068Ben Ortiz\u2069');
  });

  it('records system events with kinds', () => {
    const kinds = parsed.system.map((s) => s.kind);
    expect(kinds).toEqual(['encryption', 'description', 'removed', 'pinned']);
  });
});

describe('parseChat — Android, 24h, day-first', () => {
  it('infers D/M/Y when a day exceeds 12', () => {
    const parsed = parseChat(
      ['03/11/2023, 09:05 - Ana: hola', '13/11/2023, 21:30 - Ben: hi', '14/11/2023, 00:01 - Ana: late'].join('\n'),
    );
    expect(parsed.meta.dateOrder).toBe('DMY');
    expect(parsed.meta.clock).toBe('24h');
    expect(utc(parsed.messages[0].ts)).toBe('2023-11-03T09:05');
    expect(utc(parsed.messages[2].ts)).toBe('2023-11-14T00:01');
  });

  it('uses chronology to resolve ambiguous dates', () => {
    // As D/M: 1 Feb → 5 Feb → 2 Mar → 9 Mar (monotonic).
    // As M/D: 2 Jan → 2 May → 3 Feb → 3 Sep (goes backwards once).
    const parsed = parseChat(
      ['01/02/2024, 10:00 - Ana: a', '05/02/2024, 10:00 - Ben: b', '02/03/2024, 10:00 - Ana: c', '09/03/2024, 10:00 - Ben: d'].join(
        '\n',
      ),
    );
    expect(parsed.meta.dateOrder).toBe('DMY');
    expect(utc(parsed.messages[1].ts)).toBe('2024-02-05T10:00');
  });

  it('supports dotted German dates', () => {
    const parsed = parseChat(['24.12.23, 18:00 - Oma: Frohe Weihnachten', '24.12.23, 18:02 - Max: Danke!'].join('\n'));
    expect(parsed.meta.dateOrder).toBe('DMY');
    expect(parsed.messages).toHaveLength(2);
    expect(utc(parsed.messages[1].ts)).toBe('2023-12-24T18:02');
  });

  it('supports ISO dates', () => {
    const parsed = parseChat(['2024-05-01, 08:15 - A: x', '2024-05-02, 23:59 - B: y'].join('\n'));
    expect(parsed.meta.dateOrder).toBe('YMD');
    expect(utc(parsed.messages[1].ts)).toBe('2024-05-02T23:59');
  });

  it('classifies attached files from exports that include media', () => {
    const parsed = parseChat(
      [
        '01/02/2024, 10:00 - A: IMG-20240201-WA0001.jpg (file attached)',
        'look at this',
        '01/02/2024, 10:01 - B: PTT-20240201-WA0002.opus (file attached)',
        '01/02/2024, 10:02 - A: STK-20240201-WA0003.webp (file attached)',
        '01/02/2024, 10:03 - B: VID-20240201-WA0004.mp4 (file attached)',
      ].join('\n'),
    );
    expect(parsed.messages.map((m) => m.media)).toEqual(['image', 'voice', 'sticker', 'video']);
    expect(parsed.messages[0].text).toBe('look at this');
  });

  it('does not mistake a colon inside a group subject for a sender', () => {
    const parsed = parseChat(
      ['01/02/2024, 10:00 - Ana changed the subject from "Trip: Goa" to "Trip: Gokarna"', '01/02/2024, 10:01 - Ben: nice'].join(
        '\n',
      ),
    );
    expect(parsed.participants).toEqual(['Ben']);
    expect(parsed.system[0].kind).toBe('subject');
    expect(parsed.meta.chatName).toBe('Trip: Gokarna');
  });
});

describe('parseChat — iOS', () => {
  const chat = [
    `[12/11/23, 3:41:22 PM] Weekend Crew: ${LRM}Messages and calls are end-to-end encrypted.`,
    `[12/11/23, 3:41:22 PM] Weekend Crew: ${LRM}Ana created group "Weekend Crew"`,
    `[12/11/23, 3:42:05 PM] Ana: Hi all`,
    `[12/11/23, 3:42:40 PM] Ben: ${LRM}image omitted`,
    `[12/11/23, 3:43:00 PM] Ben: ${LRM}<attached: 00000012-PHOTO-2023-11-12-15-43-00.jpg>`,
    `[12/11/23, 3:44:00 PM] Ana: ${LRM}This message was deleted.`,
    `[12/11/23, 3:45:00 PM] Ben: ${LRM}Missed voice call`,
    `[12/11/23, 3:46:00 PM] Ana: fixed it ${LRM}<This message was edited>`,
    `[12/11/23, 3:47:00 PM] Ana: ${LRM}sticker omitted`,
    `[12/11/23, 3:48:00 PM] Weekend Crew: ${LRM}Ana added Chloé`,
    `[13/11/23, 9:00:00 AM] Chloé: Morning!`,
  ].join('\n');

  const parsed = parseChat(chat);

  it('detects the iOS format and day-first dates', () => {
    expect(parsed.meta.platform).toBe('ios');
    expect(parsed.meta.dateOrder).toBe('DMY');
    expect(utc(parsed.messages.at(-1)!.ts)).toBe('2023-11-13T09:00');
  });

  it('treats group-attributed notices as system events and recovers the group name', () => {
    expect(parsed.participants).toEqual(['Ana', 'Ben', 'Chloé']);
    expect(parsed.system.map((s) => s.kind)).toEqual(['encryption', 'created', 'added']);
    expect(parsed.meta.chatName).toBe('Weekend Crew');
  });

  it('classifies iOS markers', () => {
    expect(parsed.messages.map((m) => m.kind)).toEqual([
      'text',
      'media',
      'media',
      'deleted',
      'call',
      'text',
      'media',
      'text',
    ]);
    expect(parsed.messages[1].media).toBe('image');
    expect(parsed.messages[6].media).toBe('sticker');
    expect(parsed.messages[5]).toMatchObject({ text: 'fixed it', edited: true });
  });
});

describe('parseChat — errors', () => {
  it('rejects files that are not chat exports', () => {
    expect(() => parseChat('hello world\nthis is not a chat')).toThrow(ChatParseError);
  });

  it('rejects exports with only system notices', () => {
    expect(() => parseChat('11/12/23, 12:45 PM - Messages and calls are end-to-end encrypted.')).toThrow(
      ChatParseError,
    );
  });
});

describe('chatNameFromFileName', () => {
  it.each([
    ['WhatsApp Chat with Book Club.txt', 'Book Club'],
    ['WhatsApp Chat - Weekend Crew.zip', 'Weekend Crew'],
    ['WhatsApp Chat with Mom (1).txt', 'Mom'],
    ['_chat.txt', null],
    ['Chat de WhatsApp con Ana.txt', 'Ana'],
    ['1d4145ec-WhatsApp_Chat_with_Book_Club.txt', 'Book Club'],
    ['WhatsApp-Chat mit Oma.txt', 'Oma'],
  ])('%s → %s', (input, expected) => {
    expect(chatNameFromFileName(input)).toBe(expected);
  });
});
