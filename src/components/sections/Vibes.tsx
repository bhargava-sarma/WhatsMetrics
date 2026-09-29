import { CloudRain, Flame, HeartHandshake, PartyPopper } from 'lucide-react';
import { Card, Key, Legend, Section, Stat, Stats } from '../ui/primitives';
import { BarList, ShareBars } from '../charts/Html';
import { DivergingColumns, MoodDial } from '../charts/Misc';
import { MoodBars, Quadrant, Radar } from '../charts/Relations';
import { TimeArea } from '../charts/Svg';
import { castPeople, censorWord, eligible, seriesDefs, useReport } from '../report-context';
import { EMOTIONS, KIND_CATEGORIES } from '../../lib/analysis/types';
import { EMOTION_LABELS } from '../../lib/analysis/lexicons/emotions';
import { KIND_LABELS } from '../../lib/analysis/lexicons/kindness';
import { emojiDisplay } from '../../lib/analysis/features';
import { fmtDate, fmtInt, fmtMonth, fmtNum, fmtPct } from '../../lib/format';

export function Vibes({ onToggleCensor }: { onToggleCensor: () => void }) {
  const { report: r, censor } = useReport();
  const v = r.vibes;
  const h = r.meta.hinglish;
  const people = eligible(r);
  const cast = castPeople(r).filter((c) => c.stats.messages >= Math.max(20, r.totals.messages * 0.01));
  const series = seriesDefs(r);
  const toxic = [...people].sort((a, b) => b.stats.toxicity.per100 - a.stats.toxicity.per100);
  const kind = [...people].sort((a, b) => b.stats.kindness.per100 - a.stats.kindness.per100);
  const moods = [...people].sort((a, b) => b.stats.sentiment.net - a.stats.sentiment.net);
  const active = v.monthly.filter((m) => m.count >= 30);
  const happiestMonth = active.length ? active.reduce((a, b) => (b.net > a.net ? b : a)) : null;
  const gloomiestMonth = active.length ? active.reduce((a, b) => (b.net < a.net ? b : a)) : null;
  const emotionMax = EMOTIONS.map((e) => Math.max(0.01, ...cast.map((c) => c.stats.emotions[e])));
  const topEmotion = EMOTIONS.filter((e) => e !== 'humor').reduce((a, b) => (v.emotions[b] > v.emotions[a] ? b : a));
  const kindRows = KIND_CATEGORIES.map((k) => ({
    label: KIND_LABELS[k],
    values: r.series.map((id) =>
      id >= 0
        ? r.perPerson[id].kindness.breakdown[k]
        : r.perPerson.filter((p) => !r.people[p.id].inCast).reduce((s, p) => s + p.kindness.breakdown[k], 0),
    ),
  })).filter((row) => row.values.some((x) => x > 0));
  const quadrantPts = people.slice(0, 8).map(({ person, stats }) => ({ name: person.short, color: person.color, x: stats.kindness.per100, y: stats.toxicity.per100 }));

  const dayStat = (d: typeof v.happiestDay, fmt: (x: number) => string) =>
    d ? { value: fmtDate(d.ts), note: `${fmt(d.value)} · ${fmtInt(d.count)} msgs` } : { value: '–', note: undefined };

  return (
    <Section
      id="vibes"
      num="08"
      label="Vibes"
      title="Mood & manners"
      intro="Positivity, spice and sweetness. Scored with word lists (English + Hinglish + emoji), so treat it as a fun read, not a verdict — banter between friends often reads as “toxic”."
    >
      <div className="grid">
        <Card
          span={4}
          className="md-half"
          index="08.1 — MOOD METER"
          title="Overall mood"
          sub="Positive minus negative messages, per 100."
          insight={
            <>
              Leaning{' '}
              <em>{v.sentiment.net >= 5 ? 'positive' : v.sentiment.net <= -5 ? 'negative' : 'neutral'}</em>: {fmtPct(v.sentiment.pos)} positive,{' '}
              {fmtPct(v.sentiment.neg)} negative.
            </>
          }
        >
          <div className="dial-wrap">
            <MoodDial value={v.sentiment.net} />
            <div className="dial-readout">
              <span className="dial-readout__value">
                {v.sentiment.net >= 0 ? '+' : '−'}
                {fmtNum(Math.abs(v.sentiment.net))}
              </span>
              <span className="label">net mood</span>
            </div>
          </div>
        </Card>

        <Card
          span={8}
          className="md-half"
          index="08.2 — MOOD BY PERSON"
          title="Sunshine vs storm clouds"
          sub="Share of each person's messages that read negative, neutral or positive."
          insight={
            moods.length >= 2 ? (
              <>
                <em>{moods[0].person.short}</em> is the most positive; {moods[moods.length - 1].person.short} the least.
              </>
            ) : undefined
          }
        >
          <MoodBars
            rows={moods.map(({ person, stats }) => ({ name: person.short, color: person.color, pos: stats.sentiment.pos, neu: stats.sentiment.neu, neg: stats.sentiment.neg }))}
          />
        </Card>

        <Card
          span={12}
          index="08.3 — MOOD OVER TIME"
          title="How the mood changed"
          sub="Monthly net mood. Blue above the line = more positive than negative."
          insight={
            happiestMonth && gloomiestMonth && happiestMonth !== gloomiestMonth ? (
              <>
                Happiest month: <em>{fmtMonth(happiestMonth.ts, true)}</em>; gloomiest: {fmtMonth(gloomiestMonth.ts, true)}.
              </>
            ) : undefined
          }
        >
          <DivergingColumns label="Net mood" data={v.monthly.map((m) => ({ ts: m.ts, value: m.net, count: m.count }))} />
        </Card>

        <Card
          span={6}
          index="08.4 — SPICE LEVEL"
          title="Most toxic"
          sub="Swear words & insults per 100 messages, weighted by severity."
          insight={
            toxic[0] && toxic[0].stats.toxicity.per100 > 0 ? (
              <>
                <em>{toxic[0].person.short}</em> is the most toxic — {fmtNum(toxic[0].stats.toxicity.per100)} per 100 messages.
              </>
            ) : (
              'Squeaky clean — no swearing detected.'
            )
          }
        >
          <BarList
            items={toxic.map(({ person, stats }) => ({
              key: person.id,
              label: person.short,
              value: stats.toxicity.per100,
              display: fmtNum(stats.toxicity.per100),
              sub: `${fmtPct(stats.toxicity.share)} of msgs`,
              color: person.color,
              tip: {
                title: person.name,
                rows: [
                  { label: 'Spice / 100 msgs', value: fmtNum(stats.toxicity.per100), color: person.color, mark: 'box' },
                  { label: 'Spicy messages', value: fmtInt(stats.toxicity.messages) },
                  ...stats.toxicity.top.slice(0, 3).map(([w, c]) => ({ label: `“${censorWord(w, censor, h)}”`, value: `${fmtInt(c)}×` })),
                ],
              },
            }))}
          />
        </Card>

        <Card
          span={6}
          index="08.5 — SWEAR JAR"
          title="Most used swear words"
          tools={
            <Key size="sm" led on={!censor} onClick={onToggleCensor} title="Show or hide swear words">
              {censor ? 'Uncensor' : 'Censor'}
            </Key>
          }
          insight={
            v.topSwears[0] ? (
              <>
                Favourite: <em>“{censorWord(v.topSwears[0][0], censor, h)}”</em>, {fmtInt(v.topSwears[0][1])} times.
              </>
            ) : (
              'The swear jar is empty.'
            )
          }
        >
          <BarList
            labelWidth="40%"
            barHeight={10}
            showSwatch={false}
            items={v.topSwears.slice(0, 12).map(([w, c]) => ({ key: w, label: censorWord(w, censor, h), value: c, color: '#d73337' }))}
          />
        </Card>

        <Card
          span={6}
          index="08.6 — KINDNESS"
          title="Kindest"
          sub="Thank-yous, sorrys, pleases, hearts, praise and support per 100 messages."
          insight={
            kind[0] && kind[0].stats.kindness.per100 > 0 ? (
              <>
                <em>{kind[0].person.short}</em> is the kindest — {fmtNum(kind[0].stats.kindness.per100)} warm words per 100 messages.
              </>
            ) : undefined
          }
        >
          <BarList
            items={kind.map(({ person, stats }) => ({
              key: person.id,
              label: person.short,
              value: stats.kindness.per100,
              display: fmtNum(stats.kindness.per100),
              sub: `${fmtPct(stats.kindness.share)} of msgs`,
              color: person.color,
            }))}
          />
        </Card>

        <Card
          span={6}
          index="08.7 — KINDNESS BREAKDOWN"
          title="Who says thanks, sorry & love"
          sub="Each bar splits one kind of kindness between people."
          insight={
            v.topKind[0] ? (
              <>
                Most used kind word: <em>“{v.topKind[0][0].length <= 2 && /\p{Extended_Pictographic}/u.test(v.topKind[0][0]) ? emojiDisplay(v.topKind[0][0]) : v.topKind[0][0]}”</em> ({fmtInt(v.topKind[0][1])}×).
              </>
            ) : undefined
          }
        >
          <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} />
          <ShareBars rows={kindRows} series={series} />
        </Card>

        {quadrantPts.length >= 2 && (
          <Card
            span={6}
            index="08.8 — ANGELS & SAVAGES"
            title="Kind vs toxic"
            sub="Right = kinder, up = spicier. Lines mark the group average."
          >
            <Quadrant points={quadrantPts} xLabel="Kindness / 100" yLabel="Spice / 100" quadrants={['SAVAGE', 'TOUGH LOVE', 'CHILL', 'ANGEL']} />
          </Card>
        )}

        <Card
          span={6}
          index="08.9 — EMOTIONS"
          title="The emotional mix"
          sub="Messages carrying each emotion, per 100 messages."
          insight={
            <>
              Besides laughing, the strongest emotion is <em>{EMOTION_LABELS[topEmotion].toLowerCase()}</em>.
            </>
          }
        >
          <BarList
            labelWidth="30%"
            showSwatch={false}
            items={EMOTIONS.map((e) => ({ key: e, label: EMOTION_LABELS[e], value: v.emotions[e], display: fmtNum(v.emotions[e]), color: e === 'anger' || e === 'sadness' || e === 'fear' ? '#db4241' : '#2389e2' }))}
          />
        </Card>

        {cast.length > 0 && (
          <Card span={12} index="08.10 — EMOTIONAL FINGERPRINTS" title="Everyone's emotional shape" sub="Scaled to the most emotional person on each axis.">
            <div className="radar-grid">
              {cast.slice(0, 8).map(({ person, stats }) => (
                <div className="radar-cell" key={person.id}>
                  <Radar
                    name={person.short}
                    color={person.color}
                    axes={EMOTIONS.map((e) => EMOTION_LABELS[e])}
                    values={EMOTIONS.map((e) => stats.emotions[e])}
                    maxes={emotionMax}
                  />
                  <div className="radar-cell__name">
                    <span className="swatch swatch--dot" style={{ ['--sw' as string]: person.color }} />
                    {person.short}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card span={6} index="08.11 — SPICE OVER TIME" title="Toxicity per month" sub="Spicy messages per 100 messages.">
          <TimeArea
            points={v.monthly.map((m) => ({ t: m.ts, v: m.toxic }))}
            formatT={(t) => fmtMonth(t)}
            formatV={(x) => fmtNum(x, 1)}
            valueLabel="Spicy / 100"
            color="#d73337"
            ariaLabel="Toxicity per month"
            height={200}
          />
        </Card>
        <Card span={6} index="08.12 — KINDNESS OVER TIME" title="Kindness per month" sub="Kind messages per 100 messages.">
          <TimeArea
            points={v.monthly.map((m) => ({ t: m.ts, v: m.kind }))}
            formatT={(t) => fmtMonth(t)}
            formatV={(x) => fmtNum(x, 1)}
            valueLabel="Kind / 100"
            color="#06ae64"
            ariaLabel="Kindness per month"
            height={200}
          />
        </Card>

        <Card span={12} index="08.13 — NOTABLE DAYS" title="Days to remember" sub="Among days with enough messages to count.">
          <Stats cols={4}>
            <Stat text icon={<PartyPopper />} label="Happiest day" {...dayStat(v.happiestDay, (x) => `${x >= 0 ? '+' : ''}${fmtNum(x)} mood`)} />
            <Stat text icon={<CloudRain />} label="Gloomiest day" {...dayStat(v.gloomiestDay, (x) => `${x >= 0 ? '+' : ''}${fmtNum(x)} mood`)} />
            <Stat text icon={<Flame />} label="Spiciest day" {...dayStat(v.spiciestDay, (x) => `${fmtNum(x)}% spicy`)} />
            <Stat text icon={<HeartHandshake />} label="Sweetest day" {...dayStat(v.sweetestDay, (x) => `${fmtNum(x)}% kind`)} />
          </Stats>
        </Card>
      </div>
    </Section>
  );
}
