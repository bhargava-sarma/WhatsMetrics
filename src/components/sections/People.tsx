import { useState } from 'react';
import { Card, KeyGroup, Legend, PersonChip, Section } from '../ui/primitives';
import { BarList, ShareBars, Waffle } from '../charts/Html';
import { Bump, Stream, type StreamMode } from '../charts/Svg';
import { DataTable } from '../ui/DataTable';
import { activePeople, eligible, seriesDefs, useReport } from '../report-context';
import { fmtDuration, fmtInt, fmtNum, fmtPct } from '../../lib/format';
import type { PersonStats } from '../../lib/analysis/types';

type View = StreamMode | 'rank';

export function People() {
  const { report: r } = useReport();
  const [view, setView] = useState<View>('stack');
  const series = seriesDefs(r);
  const people = activePeople(r);
  const top = people[0];
  const total = r.totals.messages;
  const oneIn = top ? Math.max(1, Math.round(total / top.stats.messages)) : 0;

  // Series totals for share-of-everything rows (Others summed).
  const bySeries = (get: (p: PersonStats) => number) =>
    r.series.map((id) =>
      id >= 0 ? get(r.perPerson[id]) : r.perPerson.filter((p) => !r.people[p.id].inCast).reduce((s, p) => s + get(p), 0),
    );
  const shareRows = [
    { label: 'Messages', values: bySeries((p) => p.messages) },
    { label: 'Words', values: bySeries((p) => p.words) },
    { label: 'Media', values: bySeries((p) => p.media) },
    { label: 'Emoji', values: bySeries((p) => p.emojis) },
    { label: 'Links', values: bySeries((p) => p.links) },
    { label: 'Questions', values: bySeries((p) => p.questions) },
    { label: 'Laughs', values: bySeries((p) => p.laughs) },
    { label: 'Tags (@)', values: bySeries((p) => p.mentionsSent) },
    { label: 'Swears', values: bySeries((p) => p.toxicity.messages) },
    { label: 'Kind words', values: bySeries((p) => p.kindness.messages) },
    { label: 'Deleted', values: bySeries((p) => p.deleted) },
  ].filter((row) => row.values.some((v) => v > 0));

  // The most lopsided dimension: someone's share of X vs. their share of messages.
  let lopsided: { name: string; metric: string; share: number; msgShare: number } | null = null;
  const msgRow = shareRows[0].values;
  const msgTotal = msgRow.reduce((a, b) => a + b, 0) || 1;
  for (const row of shareRows.slice(1)) {
    const rowTotal = row.values.reduce((a, b) => a + b, 0);
    if (rowTotal < 20) continue;
    row.values.forEach((v, i) => {
      const share = v / rowTotal;
      const msgShare = msgRow[i] / msgTotal;
      if (share >= 0.2 && msgShare > 0 && (!lopsided || share / msgShare > lopsided.share / lopsided.msgShare)) {
        lopsided = { name: series[i].name, metric: row.label.toLowerCase(), share, msgShare };
      }
    });
  }
  const lop = lopsided as { name: string; metric: string; share: number; msgShare: number } | null;

  const rankChanges = r.time.rankByMonth.reduce((n, m, i, arr) => {
    if (i === 0) return n;
    const leader = m.ranks.indexOf(1);
    return leader !== arr[i - 1].ranks.indexOf(1) ? n + 1 : n;
  }, 0);

  const verbose = eligible(r).sort((a, b) => b.stats.avgWords - a.stats.avgWords);

  return (
    <Section
      id="people"
      num="03"
      label="People"
      title="Who talks the most"
      intro="How the conversation is split between everyone — and who dominates which kind of message."
    >
      <div className="grid">
        <Card
          span={5}
          className="md-half"
          index="03.1 — SHARE OF VOICE"
          title="Who sends the messages"
          sub="Each square is 1% of all messages."
          insight={
            top && (
              <>
                <em>{top.person.short}</em> sends {fmtPct(top.stats.messages / total)} of all messages — about 1 in {oneIn}.
              </>
            )
          }
          table={{
            columns: [
              { key: 'p', label: 'Person', render: (x: (typeof people)[number]) => <PersonChip person={x.person} />, sort: (x) => x.person.name },
              { key: 'm', label: 'Messages', render: (x) => fmtInt(x.stats.messages), sort: (x) => x.stats.messages },
              { key: 's', label: 'Share', render: (x) => fmtPct(x.stats.messages / total, 1), sort: (x) => x.stats.messages },
            ],
            rows: people,
          }}
        >
          <div className="waffle-layout">
            <Waffle
              parts={r.series.map((id, i) => ({
                label: series[i].name,
                value: id >= 0 ? r.perPerson[id].messages : bySeries((p) => p.messages)[i],
                color: series[i].color,
              }))}
            />
            <ul className="waffle-legend">
              {r.series.map((id, i) => {
                const v = id >= 0 ? r.perPerson[id].messages : bySeries((p) => p.messages)[i];
                return (
                  <li key={i}>
                    <span className="swatch" style={{ ['--sw' as string]: series[i].color }} />
                    <span className="waffle-legend__name">{series[i].name}</span>
                    <span className="waffle-legend__pct">{fmtPct(v / total)}</span>
                    <span className="waffle-legend__n">{fmtInt(v)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>

        <Card
          span={7}
          className="md-half"
          index="03.2 — SHARE OF EVERYTHING"
          title="Who owns what"
          sub="Each bar splits one kind of activity between people."
          insight={
            lop ? (
              <>
                <em>{lop.name}</em> sends {fmtPct(lop.msgShare)} of messages but {fmtPct(lop.share)} of the {lop.metric}.
              </>
            ) : undefined
          }
        >
          <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} />
          <ShareBars rows={shareRows} series={series} />
        </Card>

        <Card
          span={12}
          index="03.3 — OVER TIME"
          title="Who was loudest, when"
          sub="Monthly messages per person. Switch views to see volume, share, or the ranking race."
          insight={
            r.time.rankByMonth.length > 2 ? (
              rankChanges > 0 ? (
                <>
                  The top spot changed hands <em>{rankChanges} times</em> across {r.time.rankByMonth.length} months.
                </>
              ) : (
                <>
                  <em>{top?.person.short}</em> held the top spot every single month.
                </>
              )
            ) : undefined
          }
          tools={
            <KeyGroup<View>
              label="Chart view"
              value={view}
              onChange={setView}
              options={[
                { value: 'stack', label: 'Volume' },
                { value: 'stream', label: 'Stream' },
                { value: 'share', label: 'Share' },
                { value: 'rank', label: 'Rank' },
              ]}
            />
          }
          table={{
            columns: [
              { key: 'm', label: 'Month', render: (m: (typeof r.time.monthly)[number]) => new Date(m.ts).toISOString().slice(0, 7), sort: (m) => m.ts },
              ...series.map((s, i) => ({
                key: `s${i}`,
                label: s.name,
                render: (m: (typeof r.time.monthly)[number]) => fmtInt(m.bySeries[i]),
                sort: (m: (typeof r.time.monthly)[number]) => m.bySeries[i],
              })),
            ],
            rows: r.time.monthly,
          }}
        >
          <Legend items={series.map((s) => ({ label: s.name, color: s.color, mark: view === 'rank' ? 'line' : 'box' }))} />
          {view === 'rank' ? (
            <Bump months={r.time.rankByMonth} series={series} ariaLabel="Monthly ranking by messages sent" height={Math.max(200, 44 * series.length)} />
          ) : (
            <Stream months={r.time.monthly} series={series} mode={view} ariaLabel="Messages per month by person" />
          )}
        </Card>

        <Card
          span={6}
          index="03.4 — MESSAGE LENGTH"
          title="Paragraphs vs one-liners"
          sub="Average words per text message."
          insight={
            verbose.length >= 2 ? (
              <>
                <em>{verbose[0].person.short}</em> writes {fmtNum(verbose[0].stats.avgWords)} words per message;{' '}
                {verbose[verbose.length - 1].person.short} just {fmtNum(verbose[verbose.length - 1].stats.avgWords)}.
              </>
            ) : undefined
          }
        >
          <BarList
            items={verbose.map(({ person, stats }) => ({
              key: person.id,
              label: person.short,
              value: stats.avgWords,
              display: fmtNum(stats.avgWords),
              sub: `${fmtPct(stats.oneWord / Math.max(1, stats.textMessages))} one-word`,
              color: person.color,
              tip: {
                title: person.name,
                rows: [
                  { label: 'Words / message', value: fmtNum(stats.avgWords), color: person.color, mark: 'box' },
                  { label: 'One-word replies', value: fmtPct(stats.oneWord / Math.max(1, stats.textMessages)) },
                  { label: 'Characters / message', value: fmtNum(stats.avgChars, 0) },
                ],
              },
            }))}
          />
        </Card>

        <Card
          span={6}
          index="03.5 — ACTIVITY"
          title="Showing up"
          sub="Days each person sent at least one message."
          insight={
            people.length ? (
              <>
                <em>{[...people].sort((a, b) => b.stats.activeDays - a.stats.activeDays)[0].person.short}</em> showed up on the most days (
                {fmtInt(Math.max(...people.map((p) => p.stats.activeDays)))} of {fmtInt(r.totals.days)}).
              </>
            ) : undefined
          }
        >
          <BarList
            items={[...people]
              .sort((a, b) => b.stats.activeDays - a.stats.activeDays)
              .slice(0, 10)
              .map(({ person, stats }) => ({
                key: person.id,
                label: person.short,
                value: stats.activeDays,
                display: fmtInt(stats.activeDays),
                sub: `${fmtPct(stats.activeDays / r.totals.days)} of days`,
                color: person.color,
              }))}
          />
        </Card>

        <Card span={12} index="03.6 — LEADERBOARD" title="The full leaderboard" sub="Every stat, every person. Click a column to sort.">
          <DataTable
            initialSort={{ key: 'messages', dir: 'desc' }}
            rows={people}
            columns={[
              { key: 'name', label: 'Person', render: (x) => <PersonChip person={x.person} />, sort: (x) => x.person.name },
              { key: 'messages', label: 'Msgs', render: (x) => fmtInt(x.stats.messages), sort: (x) => x.stats.messages },
              { key: 'share', label: 'Share', render: (x) => fmtPct(x.stats.messages / total, 1), sort: (x) => x.stats.messages },
              { key: 'words', label: 'Words', render: (x) => fmtInt(x.stats.words), sort: (x) => x.stats.words },
              { key: 'wpm', label: 'Words/msg', render: (x) => fmtNum(x.stats.avgWords), sort: (x) => x.stats.avgWords },
              { key: 'media', label: 'Media', render: (x) => fmtInt(x.stats.media), sort: (x) => x.stats.media },
              { key: 'emoji', label: 'Emoji', render: (x) => fmtInt(x.stats.emojis), sort: (x) => x.stats.emojis },
              { key: 'links', label: 'Links', render: (x) => fmtInt(x.stats.links), sort: (x) => x.stats.links },
              { key: 'q', label: 'Questions', render: (x) => fmtInt(x.stats.questions), sort: (x) => x.stats.questions },
              { key: 'del', label: 'Deleted', render: (x) => fmtInt(x.stats.deleted), sort: (x) => x.stats.deleted },
              { key: 'edit', label: 'Edited', render: (x) => fmtInt(x.stats.edited), sort: (x) => x.stats.edited },
              { key: 'reply', label: 'Avg reply', render: (x) => fmtDuration(x.stats.replyMeanMs), sort: (x) => x.stats.replyMeanMs ?? Infinity },
              { key: 'night', label: 'Night %', render: (x) => fmtPct(x.stats.nightShare), sort: (x) => x.stats.nightShare },
              { key: 'tox', label: 'Spice /100', render: (x) => fmtNum(x.stats.toxicity.per100), sort: (x) => x.stats.toxicity.per100 },
              { key: 'kind', label: 'Kind /100', render: (x) => fmtNum(x.stats.kindness.per100), sort: (x) => x.stats.kindness.per100 },
              { key: 'mood', label: 'Mood', render: (x) => `${x.stats.sentiment.net >= 0 ? '+' : ''}${fmtNum(x.stats.sentiment.net)}`, sort: (x) => x.stats.sentiment.net },
              { key: 'streak', label: 'Streak', render: (x) => fmtInt(x.stats.longestStreak?.days ?? 0), sort: (x) => x.stats.longestStreak?.days ?? 0 },
            ]}
          />
        </Card>
      </div>
    </Section>
  );
}
