import { useState } from 'react';
import { Card, KeyGroup, Legend, Section } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { BarList, Matrix } from '../charts/Html';
import { Columns } from '../charts/Svg';
import { WordCloud } from '../charts/Relations';
import { castPeople, censorText, censorWord, eligible, seriesDefs, useReport } from '../report-context';
import { emojiDisplay } from '../../lib/analysis/features';
import { TOPICS } from '../../lib/analysis/lexicons/topics';
import { fmtDate, fmtInt, fmtNum, fmtPct, plural } from '../../lib/format';

const LAUGH_LABELS: Record<string, string> = {
  haha: 'haha',
  hehe: 'hehe',
  huehue: 'huehue',
  hihi: 'hihi',
  lol: 'lol',
  lmao: 'lmao',
  rofl: 'rofl',
  xd: 'xD',
  jaja: 'jaja',
};

export function Words() {
  const { report: r, censor } = useReport();
  const [phraseView, setPhraseView] = useState<'2' | '3'>('2');
  const h = r.meta.hinglish;
  const w = r.words;
  const series = seriesDefs(r);
  const cast = castPeople(r);
  const people = eligible(r);
  const topWord = w.top[0];
  const cloudWords = w.top.slice(0, 140).map(([text, count], i) => {
    const owner = w.topOwners[i];
    const p = owner >= 0 ? r.people[owner] : null;
    return {
      text: censorWord(text, censor, h),
      count,
      color: p?.color ?? '#8b8b95',
      owner: p?.short ?? '—',
    };
  });
  const phrases = phraseView === '2' ? w.bigrams : w.trigrams;
  const topicsShown = w.topics.filter((t) => t.count > 0);
  const topicIndex = new Map(TOPICS.map((t, i) => [t.id, i]));
  // Topic intensity per person: messages on topic per 100 of their messages.
  const topicMatrix = cast.map((c) => topicsShown.map((t) => (c.stats.topics[topicIndex.get(t.id)!] / Math.max(1, c.stats.messages)) * 100));
  let topicLeader: { name: string; topic: string; ratio: number } | null = null;
  topicsShown.forEach((t, ti) => {
    const avg = topicMatrix.reduce((s, row) => s + row[ti], 0) / Math.max(1, topicMatrix.length);
    topicMatrix.forEach((row, pi) => {
      const ratio = avg > 0 ? row[ti] / avg : 0;
      if (cast[pi].stats.messages >= 50 && t.count >= 20 && (!topicLeader || ratio > topicLeader.ratio)) {
        topicLeader = { name: cast[pi].person.short, topic: t.label.toLowerCase(), ratio };
      }
    });
  });
  const tl = topicLeader as { name: string; topic: string; ratio: number } | null;
  const lengthPeak = w.lengthBuckets.reduce((a, b) => (b.count > a.count ? b : a), w.lengthBuckets[0]);
  const laughsTotal = r.totals.laughs;
  const rich = people.filter((p) => p.stats.richness !== null).sort((a, b) => (b.stats.richness ?? 0) - (a.stats.richness ?? 0));

  return (
    <Section
      id="words"
      num="06"
      label="Language"
      title="What you talk about"
      intro="Favourite words, catchphrases, topics and everyone's verbal fingerprint. Common filler words (the, hai, ok…) are left out."
    >
      <div className="grid">
        <Card
          span={8}
          index="06.1 — WORD CLOUD"
          title="The chat in words"
          sub="Size = how often it's used. Colour = who uses it most."
          insight={
            topWord && (
              <>
                The chat's favourite word is <em>“{censorWord(topWord[0], censor, h)}”</em> — used {fmtInt(topWord[1])} times.
              </>
            )
          }
          lazyHeight={380}
        >
          <Legend items={series.filter((_, i) => r.series[i] >= 0).map((s) => ({ label: s.name, color: s.color, mark: 'dot' }))} />
          <WordCloud words={cloudWords} height={380} />
        </Card>

        <Card span={4} index="06.2 — TOP WORDS" title="Most used words" sub="Bar colour = who says it most.">
          <BarList
            labelWidth="40%"
            barHeight={10}
            showSwatch={false}
            items={w.top.slice(0, 15).map(([word, count], i) => ({
              key: word,
              label: censorWord(word, censor, h),
              value: count,
              color: w.topOwners[i] >= 0 ? r.people[w.topOwners[i]].color : '#8b8b95',
              tip: {
                title: censorWord(word, censor, h),
                rows: [
                  { label: 'Used', value: `${fmtInt(count)}×` },
                  ...(w.topOwners[i] >= 0
                    ? [{ label: 'Most by', value: r.people[w.topOwners[i]].short, color: r.people[w.topOwners[i]].color, mark: 'dot' as const }]
                    : []),
                ],
              },
            }))}
          />
        </Card>

        <Card
          span={12}
          index="06.3 — SIGNATURE WORDS"
          title="Words that give each person away"
          sub="Words each person uses far more than everyone else — their verbal fingerprint. Number = times they used it."
        >
          <div className="signature-grid">
            {people.slice(0, 12).map(({ person, stats }) => (
              <div className="signature" key={person.id} style={{ ['--pc' as string]: person.color }}>
                <div className="signature__name">
                  <span className="swatch swatch--dot" style={{ ['--sw' as string]: person.color }} />
                  {person.short}
                </div>
                <div className="signature__words">
                  {(stats.signatureWords.length ? stats.signatureWords : stats.topWords.slice(0, 6)).slice(0, 8).map(([word, count]) => (
                    <span className="chip" key={word}>
                      {censorWord(word, censor, h)} <b>{fmtInt(count)}</b>
                    </span>
                  ))}
                  {stats.signatureEmojis.slice(0, 3).map(([e]) => (
                    <span className="chip emoji-chip" key={e}>
                      <span className="emoji">{emojiDisplay(e)}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          span={6}
          index="06.4 — CATCHPHRASES"
          title="Most repeated phrases"
          sub="Word pairs and triples that keep coming back."
          tools={
            <KeyGroup
              label="Phrase length"
              value={phraseView}
              onChange={setPhraseView}
              options={[
                { value: '2', label: '2 words' },
                { value: '3', label: '3 words' },
              ]}
            />
          }
          insight={
            phrases[0] ? (
              <>
                <em>“{censorText(phrases[0][0], censor, h)}”</em> came up {plural(phrases[0][1], 'time')}.
              </>
            ) : undefined
          }
        >
          {phrases.length ? (
            <BarList
              labelWidth="48%"
              barHeight={10}
              showSwatch={false}
              items={phrases.slice(0, 12).map(([p, c]) => ({ key: p, label: censorText(p, censor, h), value: c, color: '#3d7efc' }))}
            />
          ) : (
            <div className="empty">Not enough repeated phrases yet.</div>
          )}
        </Card>

        <Card
          span={6}
          index="06.5 — TOPICS"
          title="What you talk about"
          sub="Messages mentioning each topic's keywords."
          insight={
            topicsShown[0] ? (
              <>
                The top topic is <em>{topicsShown[0].label.toLowerCase()}</em> — in {fmtInt(topicsShown[0].count)} messages.
              </>
            ) : undefined
          }
        >
          <BarList
            labelWidth="42%"
            showSwatch={false}
            items={topicsShown.map((t) => ({
              key: t.id,
              label: (
                <span className="topic-label">
                  <Icon name={TOPICS[topicIndex.get(t.id)!].icon} size={14} /> {t.label}
                </span>
              ),
              labelTitle: t.label,
              value: t.count,
              display: fmtInt(t.count),
              sub: fmtPct(t.count / r.totals.messages, 1),
              color: '#ff6a14',
              tip: {
                title: t.label,
                rows: [
                  { label: 'Messages', value: fmtInt(t.count) },
                  ...series.map((s, i) => ({ label: s.name, value: fmtInt(t.bySeries[i] ?? 0), color: s.color, mark: 'box' as const })),
                ],
              },
            }))}
          />
        </Card>

        {cast.length > 1 && topicsShown.length > 1 && (
          <Card
            span={12}
            index="06.6 — WHO TALKS ABOUT WHAT"
            title="Topic fingerprints"
            sub="Topic messages per 100 of each person's messages. Brighter = more obsessed."
            insight={
              tl && tl.ratio > 1.3 ? (
                <>
                  <em>{tl.name}</em> brings up {tl.topic} {fmtNum(tl.ratio, 1)}× more than the group average.
                </>
              ) : undefined
            }
          >
            <Matrix
              rows={cast.map((c) => ({ label: c.person.short, name: c.person.name, color: c.person.color }))}
              cols={topicsShown.map((t) => ({
                label: (
                  <span className="matrix__topic">
                    <Icon name={TOPICS[topicIndex.get(t.id)!].icon} size={14} />
                    <span>{t.label.split(/[ &]/)[0]}</span>
                  </span>
                ),
                name: t.label,
              }))}
              values={topicMatrix}
              format={(v) => fmtNum(v, 1)}
              tipTitle={(ri, ci) => `${cast[ri].person.short} · ${topicsShown[ci].label}`}
            />
          </Card>
        )}

        <Card
          span={6}
          index="06.7 — MESSAGE LENGTH"
          title="How long messages are"
          sub="Text messages by number of words."
          insight={
            lengthPeak && (
              <>
                Most messages are <em>{lengthPeak.label} {lengthPeak.label === '1' ? 'word' : 'words'}</em> long.
              </>
            )
          }
        >
          <Columns ariaLabel="Message length distribution" data={w.lengthBuckets.map((b) => ({ label: b.label, values: b.bySeries }))} series={series} />
        </Card>

        <Card
          span={6}
          index="06.8 — LAUGH-O-METER"
          title="How the chat laughs"
          sub="Every haha, lol, lmao, 😂 and 💀."
          insight={
            w.laughTypes[0] ? (
              <>
                {fmtInt(laughsTotal)} laughs — favourite style: <em>{LAUGH_LABELS[w.laughTypes[0][0]] ?? emojiDisplay(w.laughTypes[0][0])}</em>.
              </>
            ) : (
              'A serious chat — barely any laughs.'
            )
          }
        >
          <BarList
            labelWidth="30%"
            showSwatch={false}
            items={w.laughTypes.slice(0, 9).map(([type, count]) => ({
              key: type,
              label: LAUGH_LABELS[type] ? <span className="mono">{LAUGH_LABELS[type]}</span> : <span className="emoji">{emojiDisplay(type)}</span>,
              labelTitle: LAUGH_LABELS[type] ?? type,
              value: count,
              color: '#bf8b00',
            }))}
          />
        </Card>

        <Card
          span={6}
          index="06.9 — VOCABULARY"
          title="Vocabulary variety"
          sub="How rarely someone repeats themselves (100 = every word new). Fair across chatty and quiet people."
          insight={
            rich.length >= 2 ? (
              <>
                <em>{rich[0].person.short}</em> has the richest vocabulary ({Math.round((rich[0].stats.richness ?? 0) * 100)}/100).
              </>
            ) : undefined
          }
        >
          <BarList
            items={rich.map(({ person, stats }) => ({
              key: person.id,
              label: person.short,
              value: stats.richness ?? 0,
              display: `${Math.round((stats.richness ?? 0) * 100)}`,
              sub: `${fmtInt(stats.uniqueWords)} unique words`,
              color: person.color,
            }))}
          />
        </Card>

        <Card
          span={6}
          index="06.10 — LINKS"
          title="Where the links go"
          insight={
            w.domains[0] ? (
              <>
                {plural(r.totals.links, 'link')} shared — mostly <em>{w.domains[0][0]}</em>.
              </>
            ) : (
              'No links shared in this period.'
            )
          }
        >
          {w.domains.length ? (
            <BarList labelWidth="42%" showSwatch={false} items={w.domains.map(([d, c]) => ({ key: d, label: d, value: c, color: '#04a3be' }))} />
          ) : (
            <div className="empty">—</div>
          )}
        </Card>

        {w.longestMessages.length > 0 && (
          <Card span={12} index="06.11 — ESSAYS" title="The longest messages" sub="The walls of text, in full glory (trimmed).">
            <div className="quotes">
              {w.longestMessages.slice(0, 3).map((m, i) => {
                const p = r.people[m.author];
                return (
                  <figure className="quote" key={i} style={{ ['--pc' as string]: p.color }}>
                    <blockquote>{censorText(m.text, censor, h)}</blockquote>
                    <figcaption>
                      <span className="swatch swatch--dot" style={{ ['--sw' as string]: p.color }} />
                      {p.short} · {fmtDate(m.ts)} · {fmtInt(m.words ?? 0)} words
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </Section>
  );
}
