import { Hash, Percent, Smile, Sparkles } from 'lucide-react';
import { Card, Section, Stat, Stats } from '../ui/primitives';
import { BarList } from '../charts/Html';
import { EmojiKeypad } from '../charts/Misc';
import { TimeArea } from '../charts/Svg';
import { activePeople, eligible, useReport } from '../report-context';
import { emojiDisplay } from '../../lib/analysis/features';
import { fmtCompact, fmtInt, fmtMonth, fmtNum, fmtPct } from '../../lib/format';

export function Emoji() {
  const { report: r } = useReport();
  const e = r.emoji;
  const people = activePeople(r).filter((p) => p.stats.emojis > 0);
  const rates = eligible(r).sort((a, b) => b.stats.emojis / b.stats.messages - a.stats.emojis / a.stats.messages);
  const peakMonth = e.monthly.reduce((a, b) => (b.count > a.count ? b : a), e.monthly[0]);
  if (e.total === 0) {
    return (
      <Section id="emoji" num="07" label="Emoji" title="Emoji DNA" intro="No emoji in this period — a strictly text-only crowd.">
        <div className="card glass empty">No emoji found.</div>
      </Section>
    );
  }
  return (
    <Section id="emoji" num="07" label="Emoji" title="Emoji DNA" intro="The little pictures that say more than words — overall favourites and everyone's personal emoji fingerprint.">
      <div className="grid">
        <Card span={12} index="07.1 — EMOJI STATS" title="Emoji by the numbers">
          <Stats cols={4}>
            <Stat icon={<Smile />} label="Emoji sent" value={fmtCompact(e.total)} note={`${fmtNum(e.perMessage, 2)} per message`} />
            <Stat icon={<Sparkles />} label="Different emoji" value={fmtInt(e.unique)} note="unique ones used" />
            <Stat icon={<Percent />} label="Messages with emoji" value={fmtPct(e.messagesWithEmoji / r.totals.messages)} note={`${fmtInt(e.messagesWithEmoji)} messages`} />
            <Stat
              icon={<Hash />}
              label="Top emoji share"
              value={fmtPct((e.top[0]?.[1] ?? 0) / e.total)}
              note={e.top[0] ? `${emojiDisplay(e.top[0][0])} alone` : undefined}
            />
          </Stats>
        </Card>

        <Card
          span={7}
          index="07.2 — TOP EMOJI"
          title="The favourites"
          insight={
            e.top[0] && (
              <>
                <span className="emoji">{emojiDisplay(e.top[0][0])}</span> is the chat's favourite — used <em>{fmtInt(e.top[0][1])} times</em>.
              </>
            )
          }
        >
          <EmojiKeypad items={e.top.slice(0, 21)} total={e.total} />
        </Card>

        <Card
          span={5}
          index="07.3 — OVER TIME"
          title="Emoji per month"
          insight={
            peakMonth && peakMonth.count > 0 ? (
              <>
                Peak emoji month: <em>{fmtMonth(peakMonth.ts)}</em> ({fmtInt(peakMonth.count)}).
              </>
            ) : undefined
          }
        >
          <TimeArea
            points={e.monthly.map((m) => ({ t: m.ts, v: m.count }))}
            formatT={(t) => fmtMonth(t)}
            valueLabel="Emoji"
            color="#df4e92"
            ariaLabel="Emoji per month"
            height={250}
          />
        </Card>

        <Card span={12} index="07.4 — FINGERPRINTS" title="Everyone's emoji fingerprint" sub="Top emoji per person — and the ones that are uniquely theirs.">
          <div className="emoji-prints">
            {people.slice(0, 12).map(({ person, stats }) => (
              <div className="emoji-print" key={person.id}>
                <div className="emoji-print__who">
                  <span className="swatch swatch--dot" style={{ ['--sw' as string]: person.color }} />
                  <span className="emoji-print__name">{person.short}</span>
                  <span className="label">{fmtNum(stats.emojis / Math.max(1, stats.messages), 2)}/msg</span>
                </div>
                <div className="emoji-print__top">
                  {stats.topEmojis.slice(0, 6).map(([em, c]) => (
                    <span key={em} className="emoji-print__item" title={`${fmtInt(c)}×`}>
                      <span className="emoji">{emojiDisplay(em)}</span>
                      <small>{fmtInt(c)}</small>
                    </span>
                  ))}
                </div>
                {stats.signatureEmojis.length > 0 && (
                  <div className="emoji-print__sig">
                    <span className="label">Signature</span>
                    {stats.signatureEmojis.slice(0, 4).map(([em]) => (
                      <span key={em} className="emoji">
                        {emojiDisplay(em)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card
          span={12}
          index="07.5 — EMOJI RATE"
          title="Who speaks fluent emoji"
          sub="Emoji per message."
          insight={
            rates[0] && (
              <>
                <em>{rates[0].person.short}</em> uses {fmtNum(rates[0].stats.emojis / rates[0].stats.messages, 2)} emoji per message.
              </>
            )
          }
        >
          <BarList
            items={rates.map(({ person, stats }) => ({
              key: person.id,
              label: person.short,
              value: stats.emojis / stats.messages,
              display: fmtNum(stats.emojis / stats.messages, 2),
              sub: `${fmtInt(stats.emojis)} total`,
              color: person.color,
            }))}
          />
        </Card>
      </div>
    </Section>
  );
}
