import { describe, expect, it } from 'vitest';
import { parseChat } from '../parser/parse';
import { analyze } from './analyze';
import { generateDemoChat } from '../demo/demoChat';

const opts = { gapMinutes: 60, periodLabel: 'All time' };

describe('analyze — demo group chat', () => {
  const chat = parseChat(generateDemoChat());
  const report = analyze(chat, 'demo.txt', 'Weekend Crew', opts);

  it('parses the synthetic export with its five members', () => {
    expect(chat.participants).toHaveLength(5);
    expect(report.meta.isGroup).toBe(true);
    expect(report.totals.messages).toBeGreaterThan(3000);
    expect(report.series).toHaveLength(5);
  });

  it('keeps totals consistent', () => {
    const sum = report.perPerson.reduce((s, p) => s + p.messages, 0);
    expect(sum).toBe(report.totals.messages);
    expect(report.time.dayCounts.reduce((a, b) => a + b, 0)).toBe(report.totals.messages);
    expect(report.time.hourly.reduce((a, b) => a + b, 0)).toBe(report.totals.messages);
    const monthly = report.time.monthly.reduce((a, m) => a + m.total, 0);
    expect(monthly).toBe(report.totals.messages);
    expect(report.conversations.starters.reduce((a, b) => a + b, 0)).toBe(report.conversations.count);
  });

  it('reflects the personalities baked into the demo', () => {
    const byName = (n: string) => report.perPerson[chat.participants.indexOf(n)];
    const win = (id: string) => report.people[report.awards.find((a) => a.id === id)!.winner].name;
    expect(win('yapper')).toBe('Maya Chen');
    expect(win('toxic')).toBe('Sam Rivera');
    expect(win('kindest')).toBe('Priya Nair');
    expect(win('slowpoke')).toBe('Kenji Watanabe');
    expect(byName('Leo Park').avgWords).toBeLessThan(byName('Priya Nair').avgWords);
    expect(report.totals.longestSilence!.days).toBeGreaterThan(13);
  });

  it('gives everyone a persona', () => {
    for (const p of report.perPerson) expect(p.persona.title).not.toBe('');
  });

  it('filters by period without changing colours', () => {
    const y2025 = analyze(chat, 'demo.txt', 'Weekend Crew', {
      ...opts,
      periodLabel: '2025',
      from: Date.UTC(2025, 0, 1),
      to: Date.UTC(2026, 0, 1),
    });
    expect(y2025.totals.messages).toBeLessThan(report.totals.messages);
    expect(new Date(y2025.meta.range.start).getUTCFullYear()).toBe(2025);
    expect(y2025.people.map((p) => p.color)).toEqual(report.people.map((p) => p.color));
  });

  it('throws on an empty period', () => {
    expect(() => analyze(chat, 'demo.txt', 'x', { ...opts, from: Date.UTC(2030, 0, 1) })).toThrow();
  });
});

describe('analyze — small and 1:1 chats', () => {
  it('handles a one-to-one chat', () => {
    const lines: string[] = [];
    for (let d = 1; d <= 20; d++) {
      lines.push(`1/${d}/24, 9:0${d % 10} AM - Ana: good morning! how are you?`);
      lines.push(`1/${d}/24, 9:1${d % 10} AM - Ben: good thanks, you? 😂`);
      lines.push(`1/${d}/24, 11:00 PM - Ana: good night ❤\ufe0f`);
    }
    const r = analyze(parseChat(lines.join('\n')), 'chat.txt', 'Ana & Ben', opts);
    expect(r.meta.isGroup).toBe(false);
    expect(r.series).toHaveLength(2);
    expect(r.totals.longestStreak!.days).toBe(20);
    expect(r.awards.find((a) => a.id === 'yapper')).toBeDefined();
  });

  it('survives a two-message chat', () => {
    const r = analyze(parseChat('1/1/24, 9:00 AM - Ana: hi\n1/1/24, 9:05 AM - Ben: hey'), 'c.txt', 'c', opts);
    expect(r.totals.messages).toBe(2);
    expect(r.conversations.count).toBe(1);
    expect(r.conversations.replyMedianMs).toBe(5 * 60_000);
  });
});
