import { useState } from 'react';
import { CalendarClock, CalendarRange, Clock3, Flame, Moon, Sofa, Sunrise, Zap } from 'lucide-react';
import { Card, KeyGroup, Section, Stat, Stats } from '../ui/primitives';
import { Calendar, PunchCard, RadialClock, Ridgeline } from '../charts/TimeCharts';
import { Columns } from '../charts/Svg';
import { ScaleLegend } from '../charts/Html';
import { castPeople, eligible, seriesDefs, useReport } from '../report-context';
import { MONTHS, MONTHS_LONG, WEEKDAYS, WEEKDAYS_SHORT, fmtDate, fmtDays, fmtHour, fmtHourRange, fmtInt, fmtMonth, fmtPct, fmtTime } from '../../lib/format';

export function Time() {
  const { report: r } = useReport();
  const [seasonView, setSeasonView] = useState<'month' | 'year'>(r.time.yearly.length > 1 ? 'year' : 'month');
  const t = r.totals;
  const tm = r.time;
  const cast = castPeople(r);
  const series = seriesDefs(r).filter((_, i) => r.series[i] >= 0);
  const peakDow = tm.peakWeekday;
  const peakCell = tm.weekdayHour.flatMap((row, d) => row.map((v, h) => ({ d, h, v }))).reduce((a, b) => (b.v > a.v ? b : a));
  const people = eligible(r);
  // Only call someone a night owl / early bird when it's actually notable.
  const owl = [...people].sort((a, b) => b.stats.nightShare - a.stats.nightShare).find((p) => p.stats.nightShare >= 0.05);
  const bird = [...people].sort((a, b) => b.stats.morningShare - a.stats.morningShare).find((p) => p.stats.morningShare >= 0.05);
  const yearly = tm.yearly;
  const biggestYear = yearly.reduce((a, b) => (b.count > a.count ? b : a), yearly[0]);
  const moy = tm.monthOfYear;
  const peakMonth = moy.indexOf(Math.max(...moy));

  return (
    <Section
      id="time"
      num="04"
      label="Time"
      title="When the chat comes alive"
      intro="Days, hours and seasons — the rhythm of the conversation, and everyone's personal clock."
    >
      <div className="grid">
        <Card
          span={12}
          index="04.1 — CALENDAR"
          title="Every single day"
          sub="Darker = quieter, brighter = busier. Colours are split into equal groups of days, so both quiet and wild days stand out."
          insight={
            <>
              Active on <em>{fmtInt(t.activeDays)}</em> of {fmtInt(t.days)} days ({fmtPct(t.activeDays / t.days)})
              {t.longestStreak && t.longestStreak.days > 1 ? `, including a ${fmtDays(t.longestStreak.days)} streak.` : '.'}
            </>
          }
          foot={
            <>
              <ScaleLegend low="quiet" high="busy" />
              {t.longestSilence && (
                <span>
                  longest silence: {fmtDays(t.longestSilence.days)} ({fmtDate(t.longestSilence.start)} → {fmtDate(t.longestSilence.end)}), broken by{' '}
                  {r.people[t.longestSilence.brokenBy]?.short}
                </span>
              )}
            </>
          }
        >
          <Calendar dayStart={tm.dayStart} counts={tm.dayCounts} />
        </Card>

        <Card
          span={7}
          index="04.2 — WEEKLY RHYTHM"
          title="Day × hour"
          sub="When during the week messages are sent."
          insight={
            <>
              Peak time: <em>{WEEKDAYS[peakCell.d]}s around {fmtHour(peakCell.h)}</em>.
            </>
          }
          foot={<ScaleLegend low="few" high="many" />}
          table={{
            columns: [
              { key: 'd', label: 'Day', render: (row: { d: number; hours: number[] }) => WEEKDAYS_SHORT[row.d], sort: (row) => row.d },
              ...Array.from({ length: 24 }, (_, h) => ({
                key: `h${h}`,
                label: fmtHour(h, true),
                render: (row: { d: number; hours: number[] }) => fmtInt(row.hours[h]),
                sort: (row: { d: number; hours: number[] }) => row.hours[h],
              })),
            ],
            rows: tm.weekdayHour.map((hours, d) => ({ d, hours })),
          }}
        >
          <PunchCard grid={tm.weekdayHour} />
        </Card>

        <Card
          span={5}
          index="04.3 — 24H CLOCK"
          title="The chat's body clock"
          sub="Messages per hour of the day."
          insight={
            <>
              <em>{fmtPct(tm.nightShare)}</em> of messages are sent between midnight and 5 AM.
            </>
          }
          table={{
            columns: [
              { key: 'h', label: 'Hour', render: (x: { h: number; v: number }) => fmtHourRange(x.h), sort: (x) => x.h },
              { key: 'v', label: 'Messages', render: (x) => fmtInt(x.v), sort: (x) => x.v },
            ],
            rows: tm.hourly.map((v, h) => ({ h, v })),
          }}
        >
          <RadialClock hourly={tm.hourly} />
        </Card>

        {cast.length > 1 && (
          <Card
            span={12}
            index="04.4 — CHRONOTYPES"
            title="Everyone's personal clock"
            sub="Each person's messages across the day, as a share of their own total — so quiet members count as much as loud ones."
            insight={
              owl && bird && owl.person.id !== bird.person.id ? (
                <>
                  <em>{owl.person.short}</em> is the night owl ({fmtPct(owl.stats.nightShare)} after midnight);{' '}
                  <em>{bird.person.short}</em> is the early bird ({fmtPct(bird.stats.morningShare)} before 9 AM).
                </>
              ) : owl ? (
                <>
                  <em>{owl.person.short}</em> is the night owl ({fmtPct(owl.stats.nightShare)} after midnight).
                </>
              ) : bird ? (
                <>
                  <em>{bird.person.short}</em> is the early bird ({fmtPct(bird.stats.morningShare)} before 9 AM).
                </>
              ) : undefined
            }
            table={{
              columns: [
                { key: 'p', label: 'Person', render: (x: (typeof cast)[number]) => x.person.short, sort: (x) => x.person.short },
                { key: 'peak', label: 'Peak hour', render: (x) => fmtHourRange(x.stats.peakHour), sort: (x) => x.stats.peakHour },
                { key: 'night', label: 'After midnight', render: (x) => fmtPct(x.stats.nightShare), sort: (x) => x.stats.nightShare },
                { key: 'morning', label: 'Before 9 AM', render: (x) => fmtPct(x.stats.morningShare), sort: (x) => x.stats.morningShare },
                { key: 'weekend', label: 'Weekends', render: (x) => fmtPct(x.stats.weekendShare), sort: (x) => x.stats.weekendShare },
              ],
              rows: cast,
            }}
          >
            <Ridgeline rows={cast.map((c) => c.stats.hourly)} series={series} />
          </Card>
        )}

        <Card
          span={6}
          index="04.5 — WEEKDAYS"
          title="Busiest day of the week"
          insight={
            <>
              <em>{WEEKDAYS[peakDow]}</em> is the busiest day; weekends carry {fmtPct(tm.weekendShare)} of messages.
            </>
          }
        >
          <Columns
            ariaLabel="Messages per weekday"
            data={tm.weekday.map((v, i) => ({ label: WEEKDAYS_SHORT[i], tipLabel: WEEKDAYS[i], values: [v] }))}
            highlight={peakDow}
            color="#ff6a14"
            mutedColor="rgba(255,106,20,0.42)"
          />
        </Card>

        <Card
          span={6}
          index="04.6 — SEASONS"
          title={seasonView === 'year' ? 'Year by year' : 'Month of the year'}
          insight={
            seasonView === 'year' && biggestYear ? (
              <>
                <em>{biggestYear.year}</em> was the biggest year with {fmtInt(biggestYear.count)} messages.
              </>
            ) : (
              <>
                <em>{MONTHS_LONG[peakMonth]}</em> is the chattiest month of the year.
              </>
            )
          }
          tools={
            yearly.length > 1 ? (
              <KeyGroup
                label="Season view"
                value={seasonView}
                onChange={setSeasonView}
                options={[
                  { value: 'year', label: 'Years' },
                  { value: 'month', label: 'Months' },
                ]}
              />
            ) : undefined
          }
        >
          {seasonView === 'year' ? (
            <Columns
              ariaLabel="Messages per year by person"
              data={yearly.map((y) => ({ label: String(y.year), values: y.bySeries }))}
              series={seriesDefs(r)}
            />
          ) : (
            <Columns
              ariaLabel="Messages per calendar month"
              data={moy.map((v, i) => ({ label: MONTHS[i], tipLabel: MONTHS_LONG[i], values: [v] }))}
              highlight={peakMonth}
              color="#ff6a14"
              mutedColor="rgba(255,106,20,0.42)"
            />
          )}
        </Card>

        <Card span={12} index="04.7 — RECORDS" title="Time records">
          <Stats cols={4}>
            <Stat
              icon={<CalendarClock />}
              label="Busiest day"
              value={tm.busiestDay ? fmtInt(tm.busiestDay.count) : '–'}
              unit="msgs"
              note={tm.busiestDay ? fmtDate(tm.busiestDay.ts, { weekday: true }) : undefined}
            />
            <Stat
              icon={<Zap />}
              label="Busiest hour ever"
              value={tm.busiestHour ? fmtInt(tm.busiestHour.count) : '–'}
              unit="msgs"
              note={tm.busiestHour ? `${fmtDate(tm.busiestHour.ts)}, ${fmtTime(tm.busiestHour.ts)}` : undefined}
            />
            <Stat
              icon={<CalendarRange />}
              label="Busiest month"
              value={tm.busiestMonth ? fmtInt(tm.busiestMonth.count) : '–'}
              unit="msgs"
              note={tm.busiestMonth ? fmtMonth(tm.busiestMonth.ts, true) : undefined}
            />
            <Stat
              icon={<Sofa />}
              label="Quietest month"
              value={tm.quietestActiveMonth ? fmtInt(tm.quietestActiveMonth.count) : '–'}
              unit="msgs"
              note={tm.quietestActiveMonth ? fmtMonth(tm.quietestActiveMonth.ts, true) : undefined}
            />
            <Stat icon={<Clock3 />} label="Peak hour" value={fmtHour(tm.peakHour)} note={`${fmtPct(tm.hourly[tm.peakHour] / t.messages)} of messages`} />
            <Stat icon={<Moon />} label="After midnight" value={fmtPct(tm.nightShare)} note="sent 12–5 AM" />
            <Stat icon={<Sunrise />} label="Before 9 AM" value={fmtPct(tm.hourly.slice(5, 9).reduce((a, b) => a + b, 0) / t.messages)} note="sent 5–9 AM" />
            <Stat
              icon={<Flame />}
              label="Longest streak"
              value={t.longestStreak ? fmtDays(t.longestStreak.days) : '–'}
              note={t.longestStreak ? `${fmtDate(t.longestStreak.start)} → ${fmtDate(t.longestStreak.end)}` : undefined}
            />
          </Stats>
        </Card>
      </div>
    </Section>
  );
}
