import { BookOpen, CalendarDays, Clock, Flame, Hourglass, Image, Keyboard, Link2, MessagesSquare, MoonStar, Smile, Timer, Type } from 'lucide-react';
import { Card, Section, Stat, Stats } from '../ui/primitives';
import { Sparkline } from '../charts/Misc';
import { TimeArea } from '../charts/Svg';
import { useReport } from '../report-context';
import { fmtCompact, fmtDate, fmtDays, fmtDuration, fmtInt, fmtMonth, fmtNum, fmtPct, plural } from '../../lib/format';

const WEEK = 7 * 86_400_000;

export function Overview() {
  const { report: r } = useReport();
  const t = r.totals;
  const minutesPerMessage = ((r.meta.range.end - r.meta.range.start) / 60_000 / Math.max(1, t.messages)) | 0;

  // Weekly totals read cleaner than a jagged daily line.
  const weekly: { t: number; v: number }[] = [];
  const counts = r.time.dayCounts;
  const weekStart = Math.floor(r.time.dayStart / WEEK) * WEEK;
  for (let d = 0; d < counts.length; d++) {
    const ts = r.time.dayStart + d * 86_400_000;
    const w = Math.floor((ts - weekStart) / WEEK);
    if (!weekly[w]) weekly[w] = { t: weekStart + w * WEEK, v: 0 };
    weekly[w].v += counts[d];
  }
  const series = weekly.filter(Boolean);
  const useDaily = counts.length <= 120;
  const points = useDaily ? counts.map((v, d) => ({ t: r.time.dayStart + d * 86_400_000, v })) : series;
  const bd = r.time.busiestDay;

  const novels = t.words / 80_000;
  const typingHours = t.chars / 200 / 60;
  const readingHours = t.words / 238 / 60;

  return (
    <Section
      id="overview"
      num="01"
      label="Overview"
      title="The big picture"
      intro={`Everything that happened in ${r.meta.chatName}${r.meta.periodLabel === 'All time' ? '' : ` in ${r.meta.periodLabel}`}, at a glance.`}
    >
      <div className="grid">
        <Card span={5} index="01.1 — VOLUME" title="Messages sent" className="hero-card">
          <div className="hero-figure">{fmtInt(t.messages)}</div>
          <p className="hero-caption">
            about <strong>{fmtNum(t.avgPerDay)}</strong> a day — one every <strong>{fmtDuration(minutesPerMessage * 60_000)}</strong>
          </p>
          <div style={{ marginTop: 18 }}>
            <Sparkline values={r.time.monthly.map((m) => m.total)} height={56} />
          </div>
          <div className="hero-range">
            <span>{fmtMonth(r.meta.range.start)}</span>
            <span className="label">monthly</span>
            <span>{fmtMonth(r.meta.range.end)}</span>
          </div>
        </Card>
        <Card span={7} index="01.2 — COUNTS" title="By the numbers">
          <Stats cols={4}>
            <Stat icon={<Type />} label="Words" value={fmtCompact(t.words)} note={`${fmtNum(r.words.avgWordsPerMessage)} per message`} />
            <Stat icon={<Image />} label="Media" value={fmtCompact(t.media)} note="photos, videos, stickers, voice" />
            <Stat icon={<Smile />} label="Emoji" value={fmtCompact(t.emojis)} note={`${fmtInt(t.uniqueEmojis)} different ones`} />
            <Stat icon={<Link2 />} label="Links" value={fmtCompact(t.links)} note={r.words.domains[0] ? `mostly ${r.words.domains[0][0]}` : 'none shared'} />
            <Stat icon={<CalendarDays />} label="Active days" value={fmtInt(t.activeDays)} note={`${fmtPct(t.activeDays / t.days)} of ${fmtInt(t.days)} days`} />
            <Stat
              icon={<Flame />}
              label="Longest streak"
              value={t.longestStreak ? fmtDays(t.longestStreak.days) : '–'}
              note={t.longestStreak ? `from ${fmtDate(t.longestStreak.start)}` : undefined}
            />
            <Stat
              icon={<MoonStar />}
              label="Longest silence"
              value={t.longestSilence ? fmtDays(t.longestSilence.days) : '–'}
              note={t.longestSilence ? `until ${fmtDate(t.longestSilence.end)}` : undefined}
            />
            <Stat icon={<MessagesSquare />} label="Conversations" value={fmtInt(r.conversations.count)} note={`gap > ${fmtDuration(r.meta.gapMinutes * 60_000)} = new one`} />
          </Stats>
        </Card>

        <Card
          span={12}
          index="01.3 — TIMELINE"
          title={useDaily ? 'Messages per day' : 'Messages per week'}
          sub="Every spike is a story. Hover to see exact numbers."
          insight={
            bd ? (
              <>
                The busiest day was <em>{fmtDate(bd.ts, { weekday: true })}</em> with {plural(bd.count, 'message')}
                {bd.topWords.length ? ` — lots of “${bd.topWords.slice(0, 3).join('”, “')}”.` : '.'}
              </>
            ) : undefined
          }
          table={{
            columns: [
              { key: 't', label: useDaily ? 'Day' : 'Week of', render: (p: { t: number; v: number }) => fmtDate(p.t), sort: (p) => p.t },
              { key: 'v', label: 'Messages', render: (p) => fmtInt(p.v), sort: (p) => p.v },
            ],
            rows: points,
          }}
          foot={
            <>
              <span>n = {fmtInt(t.messages)} msgs</span>
              <span>busiest month: {r.time.busiestMonth ? `${fmtMonth(r.time.busiestMonth.ts)} (${fmtInt(r.time.busiestMonth.count)})` : '–'}</span>
              {r.time.busiestHour && <span>busiest single hour: {fmtInt(r.time.busiestHour.count)} msgs</span>}
            </>
          }
        >
          <TimeArea
            points={points}
            formatT={(ts) => (useDaily ? fmtDate(ts, { year: false }) : fmtDate(ts))}
            ariaLabel="Messages over time"
            height={240}
          />
        </Card>

        <Card span={12} index="01.4 — IN OTHER WORDS" title="What all that adds up to" sub="Rough equivalents, just for fun.">
          <Stats cols={6}>
            <Stat icon={<BookOpen />} label="Novels" value={fmtNum(novels, novels < 10 ? 1 : 0)} note="worth of text (80k words each)" />
            <Stat icon={<Keyboard />} label="Typing time" value={`${fmtNum(typingHours, typingHours < 10 ? 1 : 0)} h`} note="at 40 words per minute" />
            <Stat icon={<Clock />} label="Reading time" value={`${fmtNum(readingHours, readingHours < 10 ? 1 : 0)} h`} note="to read the whole chat" />
            <Stat icon={<Timer />} label="In conversation" value={`${fmtCompact(Math.round(t.conversationHours))} h`} note="of back-and-forth chatting" />
            <Stat icon={<Hourglass />} label="Chat age" value={fmtDays((r.meta.range.end - r.meta.range.start) / 86_400_000)} note={`since ${fmtDate(r.meta.range.start)}`} />
            <Stat icon={<MessagesSquare />} label="Per active day" value={fmtNum(t.avgPerActiveDay, 0)} note="messages when the chat is awake" />
          </Stats>
        </Card>
      </div>
    </Section>
  );
}
