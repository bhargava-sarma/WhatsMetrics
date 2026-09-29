import { Clock, MessagesSquare, Timer, TrendingUp, Users, Hourglass } from 'lucide-react';
import { Card, Section, Stat, Stats } from '../ui/primitives';
import { BarList, Matrix } from '../charts/Html';
import { Columns } from '../charts/Svg';
import { Chord, Network } from '../charts/Relations';
import { castPeople, eligible, seriesDefs, useReport } from '../report-context';
import { REPLY_BUCKET_LABELS } from '../../lib/analysis/analyze';
import { fmtDate, fmtDuration, fmtHour, fmtHourRange, fmtInt, fmtNum, fmtPct, fmtTime, plural } from '../../lib/format';
import { BLUE } from '../charts/scales';

export function Conversations() {
  const { report: r } = useReport();
  const c = r.conversations;
  const cast = castPeople(r);
  const series = seriesDefs(r);
  const castSeries = series.filter((_, i) => r.series[i] >= 0);
  const people = eligible(r);
  const isGroup = cast.length >= 3;

  const starters = [...people].sort((a, b) => b.stats.conversationsStarted - a.stats.conversationsStarted);
  const leftOnRead = people
    .filter((p) => p.stats.turns >= 10)
    .map((p) => ({ ...p, rate: p.stats.conversationsEnded / p.stats.turns }))
    .sort((a, b) => b.rate - a.rate);
  const speed = people
    .filter((p) => p.stats.replyCount >= 10 && p.stats.replyMeanMs !== null)
    .sort((a, b) => (a.stats.replyMeanMs ?? 0) - (b.stats.replyMeanMs ?? 0));
  const quickTotal = c.replyBuckets.reduce((a, b) => a + b, 0) || 1;
  const castIds = cast.map((x) => x.person.id);
  const castMatrix = castIds.map((a) => castIds.map((b) => (a === b ? 0 : c.replyMatrix[a][b])));
  const mentionMatrix = castIds.map((a) => castIds.map((b) => (a === b ? 0 : c.mentionMatrix[a][b])));
  const mentionTotal = mentionMatrix.flat().reduce((a, b) => a + b, 0);
  const topPair = c.pairs[0];
  const bursts = [...people].sort((a, b) => b.stats.avgBurst - a.stats.avgBurst);
  const recordHolder = [...people].sort((a, b) => (b.stats.maxBurst?.count ?? 0) - (a.stats.maxBurst?.count ?? 0))[0];
  const doubles = [...people].sort((a, b) => b.stats.doubleTexts - a.stats.doubleTexts);
  const tagged = [...people].sort((a, b) => b.stats.mentionsReceived - a.stats.mentionsReceived);
  const startsPeak = c.startsByHour.indexOf(Math.max(...c.startsByHour));
  const replyByHour = r.time.replyAvgByHour;
  const fastestHour = replyByHour.reduce<number>((best, v, h) => (v !== null && (best < 0 || v < (replyByHour[best] ?? Infinity)) ? h : best), -1);
  const lc = c.longestByMessages;

  return (
    <Section
      id="conversations"
      num="05"
      label="Dynamics"
      title="How you talk to each other"
      intro={`A new conversation starts after ${fmtDuration(r.meta.gapMinutes * 60_000)} of silence (change it with the knob above). Replies, starters, duos and the ones left on read.`}
    >
      <div className="grid">
        <Card span={12} index="05.1 — CONVERSATIONS" title="Conversation stats">
          <Stats cols={6}>
            <Stat icon={<MessagesSquare />} label="Conversations" value={fmtInt(c.count)} note={`${fmtNum(c.count / Math.max(1, r.totals.activeDays), 1)} per active day`} />
            <Stat icon={<TrendingUp />} label="Avg length" value={fmtNum(c.avgMessages, 0)} unit="msgs" note={`median ${fmtInt(c.medianMessages)}`} />
            <Stat icon={<Clock />} label="Avg duration" value={fmtDuration(c.avgDurationMs)} note="first to last message" />
            <Stat icon={<Users />} label="Avg people" value={fmtNum(c.avgParticipants, 1)} note="taking part in each" />
            <Stat icon={<Timer />} label="Typical reply" value={fmtDuration(c.replyMeanMs)} note={`${fmtPct(c.replyQuickShare)} within a minute`} />
            <Stat
              icon={<Hourglass />}
              label="Longest convo"
              value={lc ? fmtInt(lc.messages) : '–'}
              unit="msgs"
              note={lc ? `${fmtDate(lc.start)}, ${fmtDuration(lc.end - lc.start)}` : undefined}
            />
          </Stats>
        </Card>

        <Card
          span={6}
          index="05.2 — ICE BREAKERS"
          title="Who starts conversations"
          sub="Share of conversations each person opened after a silence."
          insight={
            starters[0] && (
              <>
                <em>{starters[0].person.short}</em> starts {fmtPct(starters[0].stats.conversationsStarted / Math.max(1, c.count))} of all conversations.
              </>
            )
          }
        >
          <BarList
            items={starters.map(({ person, stats }) => ({
              key: person.id,
              label: person.short,
              value: stats.conversationsStarted,
              display: fmtPct(stats.conversationsStarted / Math.max(1, c.count)),
              sub: plural(stats.conversationsStarted, 'convo'),
              color: person.color,
            }))}
          />
        </Card>

        <Card
          span={6}
          index="05.3 — LEFT ON READ"
          title="Whose messages go unanswered"
          sub="Share of each person's turns that ended the conversation — nobody replied."
          insight={
            leftOnRead[0] && (
              <>
                <em>{leftOnRead[0].person.short}</em> gets left on read the most: {fmtPct(leftOnRead[0].rate)} of the time.
              </>
            )
          }
        >
          <BarList
            items={leftOnRead.map(({ person, stats, rate }) => ({
              key: person.id,
              label: person.short,
              value: rate,
              display: fmtPct(rate),
              sub: `${fmtInt(stats.conversationsEnded)} of ${fmtInt(stats.turns)} turns`,
              color: person.color,
            }))}
          />
        </Card>

        <Card
          span={7}
          index="05.4 — REPLY SPEED"
          title="Who replies fastest"
          sub="Average time to answer someone else (each reply capped at 1 hour), and how often it's within a minute."
          insight={
            speed.length >= 2 ? (
              <>
                <em>{speed[0].person.short}</em> is fastest (avg {fmtDuration(speed[0].stats.replyMeanMs)}); {speed[speed.length - 1].person.short} takes{' '}
                {fmtDuration(speed[speed.length - 1].stats.replyMeanMs)}.
              </>
            ) : undefined
          }
          table={{
            columns: [
              { key: 'p', label: 'Person', render: (x: (typeof speed)[number]) => x.person.short, sort: (x) => x.person.short },
              { key: 'avg', label: 'Average', render: (x) => fmtDuration(x.stats.replyMeanMs), sort: (x) => x.stats.replyMeanMs ?? 0 },
              { key: 'med', label: 'Median', render: (x) => fmtDuration(x.stats.replyMedianMs), sort: (x) => x.stats.replyMedianMs ?? 0 },
              { key: 'q', label: '< 1 min', render: (x) => fmtPct(x.stats.replyQuickShare), sort: (x) => x.stats.replyQuickShare },
              { key: 'n', label: 'Replies', render: (x) => fmtInt(x.stats.replyCount), sort: (x) => x.stats.replyCount },
            ],
            rows: speed,
          }}
        >
          <BarList
            items={speed.map(({ person, stats }) => ({
              key: person.id,
              label: person.short,
              value: stats.replyMeanMs ?? 0,
              display: fmtDuration(stats.replyMeanMs),
              sub: `${fmtPct(stats.replyQuickShare)} < 1 min`,
              color: person.color,
              tip: {
                title: person.name,
                rows: [
                  { label: 'Average reply', value: fmtDuration(stats.replyMeanMs), color: person.color, mark: 'box' },
                  { label: 'Median reply', value: fmtDuration(stats.replyMedianMs) },
                  { label: 'Within a minute', value: fmtPct(stats.replyQuickShare) },
                ],
              },
            }))}
          />
        </Card>

        <Card
          span={5}
          index="05.5 — WAIT TIMES"
          title="How long replies take"
          sub="All replies, grouped by wait."
          insight={
            <>
              <em>{fmtPct(c.replyBuckets[0] / quickTotal)}</em> of replies arrive in under a minute.
            </>
          }
        >
          <Columns
            ariaLabel="Distribution of reply times"
            data={c.replyBuckets.map((v, i) => ({ label: REPLY_BUCKET_LABELS[i], values: [v] }))}
            color="#3d7efc"
          />
        </Card>

        {isGroup && (
          <Card
            span={6}
            index="05.6 — REPLY WEB"
            title="Who replies to whom"
            sub="Ribbons connect people who answer each other; thicker = more replies. Hover a name to isolate them."
            insight={
              topPair && (
                <>
                  Strongest duo: <em>{r.people[topPair.a].short} & {r.people[topPair.b].short}</em> — {fmtInt(topPair.count)} back-and-forths.
                </>
              )
            }
            lazyHeight={420}
          >
            <Chord matrix={castMatrix} series={castSeries} />
          </Card>
        )}

        {isGroup && (
          <Card
            span={6}
            index="05.7 — FRIENDSHIP NETWORK"
            title="The inner circle"
            sub="Bigger dots send more messages; closer, thicker links talk more."
            lazyHeight={340}
          >
            <Network
              nodes={cast.map((x, i) => ({ i, value: x.stats.messages }))}
              links={c.pairs
                .filter((p) => castIds.includes(p.a) && castIds.includes(p.b))
                .map((p) => ({ a: castIds.indexOf(p.a), b: castIds.indexOf(p.b), value: p.count }))}
              series={castSeries}
            />
          </Card>
        )}

        <Card
          span={isGroup ? 7 : 12}
          index="05.8 — REPLY MATRIX"
          title="Replies, person to person"
          sub="Row = who replied, column = who they replied to."
          insight={
            cast[0] && cast[0].stats.bestBuddy ? (
              <>
                <em>{cast[0].person.short}</em> replies to {r.people[cast[0].stats.bestBuddy.id].short} more than anyone else.
              </>
            ) : undefined
          }
        >
          <Matrix
            rows={cast.map((x) => ({ label: x.person.short, name: x.person.name, color: x.person.color }))}
            cols={cast.map((x) => ({ label: x.person.short.slice(0, 7), name: x.person.name }))}
            values={castMatrix}
            colHeader="→ to"
            tipTitle={(ri, ci) => `${cast[ri].person.short} → ${cast[ci].person.short}`}
          />
        </Card>

        {isGroup && (
          <Card span={5} index="05.9 — DUOS" title="Top duos" sub="Pairs with the most back-and-forth replies.">
            <BarList
              labelWidth="46%"
              showSwatch={false}
              items={c.pairs.slice(0, 8).map((p) => ({
                key: `${p.a}-${p.b}`,
                label: (
                  <span className="duo">
                    <span className="swatch swatch--dot" style={{ ['--sw' as string]: r.people[p.a].color }} />
                    <span className="swatch swatch--dot" style={{ ['--sw' as string]: r.people[p.b].color, marginLeft: -5 }} />
                    {r.people[p.a].short} & {r.people[p.b].short}
                  </span>
                ),
                value: p.count,
                color: '#8b8b95',
                tip: {
                  title: `${r.people[p.a].name} & ${r.people[p.b].name}`,
                  rows: [
                    { label: `${r.people[p.a].short} → ${r.people[p.b].short}`, value: fmtInt(c.replyMatrix[p.a][p.b]) },
                    { label: `${r.people[p.b].short} → ${r.people[p.a].short}`, value: fmtInt(c.replyMatrix[p.b][p.a]) },
                  ],
                },
              }))}
            />
          </Card>
        )}

        {isGroup && mentionTotal > 0 && (
          <Card
            span={7}
            index="05.10 — @MENTIONS"
            title="Who tags whom"
            sub="Row = who tagged, column = who got tagged."
            insight={
              tagged[0] && tagged[0].stats.mentionsReceived > 0 ? (
                <>
                  <em>{tagged[0].person.short}</em> gets tagged the most ({fmtInt(tagged[0].stats.mentionsReceived)} times).
                </>
              ) : undefined
            }
          >
            <Matrix
              rows={cast.map((x) => ({ label: x.person.short, name: x.person.name, color: x.person.color }))}
              cols={cast.map((x) => ({ label: x.person.short.slice(0, 7), name: x.person.name }))}
              values={mentionMatrix}
              colHeader="@ →"
              ramp={BLUE}
              tipTitle={(ri, ci) => `${cast[ri].person.short} tagged ${cast[ci].person.short}`}
            />
          </Card>
        )}

        <Card
          span={isGroup && mentionTotal > 0 ? 5 : 6}
          index="05.11 — BURSTS"
          title="Machine-gun texting"
          sub="Average messages sent in a row before someone else speaks."
          insight={
            bursts[0] && recordHolder?.stats.maxBurst ? (
              <>
                <em>{bursts[0].person.short}</em> averages {fmtNum(bursts[0].stats.avgBurst, 1)} messages per turn; the record is{' '}
                {fmtInt(recordHolder.stats.maxBurst.count)} in a row by {recordHolder.person.short}.
              </>
            ) : undefined
          }
        >
          <BarList
            items={bursts.map(({ person, stats }) => ({
              key: person.id,
              label: person.short,
              value: stats.avgBurst,
              display: fmtNum(stats.avgBurst, 2),
              sub: `record ${fmtInt(stats.maxBurst?.count ?? 0)}`,
              color: person.color,
            }))}
          />
        </Card>

        <Card
          span={6}
          index="05.12 — DOUBLE TEXTS"
          title="Double texters"
          sub="Times someone texted again after 20+ minutes without a reply."
          insight={
            doubles[0] && doubles[0].stats.doubleTexts > 0 ? (
              <>
                <em>{doubles[0].person.short}</em> double-texted {plural(doubles[0].stats.doubleTexts, 'time')}.
              </>
            ) : (
              'Nobody double-texts here.'
            )
          }
        >
          <BarList
            items={doubles.map(({ person, stats }) => ({
              key: person.id,
              label: person.short,
              value: stats.doubleTexts,
              color: person.color,
            }))}
          />
        </Card>

        <Card
          span={6}
          index="05.13 — CONVERSATION SIZE"
          title="How long conversations run"
          sub="Number of conversations by message count."
          insight={
            <>
              Half of all conversations are <em>{fmtInt(c.medianMessages)} messages or fewer</em>.
            </>
          }
        >
          <Columns ariaLabel="Conversation length distribution" data={c.sizeBuckets.map((b) => ({ label: b.label, values: [b.count] }))} color="#df4e92" />
        </Card>

        <Card
          span={6}
          index="05.14 — KICK-OFF TIME"
          title="When conversations start"
          insight={
            <>
              Most conversations kick off around <em>{fmtHour(startsPeak)}</em>.
            </>
          }
        >
          <Columns
            ariaLabel="Conversation starts by hour"
            data={c.startsByHour.map((v, h) => ({ label: h % 3 === 0 ? fmtHour(h, true) : '', tipLabel: fmtHourRange(h), values: [v] }))}
            highlight={startsPeak}
            color="#04a3be"
            mutedColor="rgba(4,163,190,0.45)"
          />
        </Card>

        <Card
          span={6}
          index="05.15 — REPLY SPEED BY HOUR"
          title="When replies are quickest"
          sub="Average reply time (each capped at 1 hour) by hour of the day."
          insight={
            fastestHour >= 0 ? (
              <>
                Replies are fastest around <em>{fmtHour(fastestHour)}</em>.
              </>
            ) : undefined
          }
        >
          <Columns
            ariaLabel="Average reply time by hour"
            data={replyByHour.map((v, h) => ({ label: h % 3 === 0 ? fmtHour(h, true) : '', tipLabel: fmtHourRange(h), values: [(v ?? 0) / 60_000] }))}
            format={(v) => fmtDuration(v * 60_000)}
            color="#8b61e3"
          />
        </Card>

        {lc && (
          <Card span={12} index="05.16 — MARATHON" title="The longest conversation" sub={`${fmtDate(lc.start, { weekday: true })}, ${fmtTime(lc.start)} → ${fmtTime(lc.end)}`}>
            <Stats cols={5}>
              <Stat label="Messages" value={fmtInt(lc.messages)} />
              <Stat label="Duration" value={fmtDuration(lc.end - lc.start)} />
              <Stat label="Started by" value={r.people[lc.starter].short} text />
              <Stat label="People involved" value={fmtInt(lc.participants.length)} note={lc.participants.map((id) => r.people[id].short).join(', ')} />
              {c.longestByDuration && c.longestByDuration !== lc && (
                <Stat
                  label="Longest by time"
                  value={fmtDuration(c.longestByDuration.end - c.longestByDuration.start)}
                  note={`${fmtDate(c.longestByDuration.start)} · ${fmtInt(c.longestByDuration.messages)} msgs`}
                />
              )}
            </Stats>
          </Card>
        )}
      </div>
    </Section>
  );
}
