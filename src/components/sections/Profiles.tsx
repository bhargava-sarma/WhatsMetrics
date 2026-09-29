import { useState } from 'react';
import { Section, Meter } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { RadialClock } from '../charts/TimeCharts';
import { Columns } from '../charts/Svg';
import { activePeople, censorText, censorWord, useReport } from '../report-context';
import { emojiDisplay } from '../../lib/analysis/features';
import { WEEKDAYS, WEEKDAYS_SHORT, fmtDate, fmtDays, fmtDuration, fmtHour, fmtInt, fmtNum, fmtPct } from '../../lib/format';

export function Profiles() {
  const { report: r, censor } = useReport();
  const people = activePeople(r).filter((p) => p.stats.messages >= 3);
  const [selected, setSelected] = useState<number | null>(null);
  const current = people.find((p) => p.person.id === selected) ?? people[0];
  if (!current) return null;
  const { person, stats } = current;
  const h = r.meta.hinglish;
  const total = r.totals.messages;
  const humans = activePeople(r, Math.max(20, total * 0.01));
  const avg = (get: (s: typeof stats) => number) =>
    humans.length ? humans.reduce((s, p) => s + get(p.stats), 0) / humans.length : 0;
  const awardsWon = r.awards.filter((a) => a.winner === person.id);
  const buddy = stats.bestBuddy ? r.people[stats.bestBuddy.id] : null;

  const meters = [
    { label: 'Positivity', value: Math.max(0, stats.sentiment.net + 50), max: 100, avg: avg((s) => s.sentiment.net) + 50, display: `${stats.sentiment.net >= 0 ? '+' : ''}${fmtNum(stats.sentiment.net)}`, color: '#2389e2' },
    { label: 'Spice', value: stats.toxicity.per100, max: Math.max(1, ...humans.map((p) => p.stats.toxicity.per100)), avg: avg((s) => s.toxicity.per100), display: fmtNum(stats.toxicity.per100), color: '#d73337' },
    { label: 'Kindness', value: stats.kindness.per100, max: Math.max(1, ...humans.map((p) => p.stats.kindness.per100)), avg: avg((s) => s.kindness.per100), display: fmtNum(stats.kindness.per100), color: '#06ae64' },
    { label: 'Humor', value: stats.emotions.humor, max: Math.max(1, ...humans.map((p) => p.stats.emotions.humor)), avg: avg((s) => s.emotions.humor), display: fmtNum(stats.emotions.humor), color: '#bf8b00' },
  ];

  return (
    <Section id="profiles" num="09" label="Profiles" title="Meet the cast" intro="Pick anyone for their full profile: persona, habits, favourite words and emoji, best buddy and trophies.">
      <div className="profile-picker" role="tablist" aria-label="Choose a person">
        {people.slice(0, 24).map(({ person: p }) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === person.id}
            className="key key--sm"
            onClick={() => setSelected(p.id)}
          >
            <span className="swatch swatch--dot" style={{ ['--sw' as string]: p.color }} />
            {p.short}
          </button>
        ))}
      </div>

      <article className="profile glass" style={{ ['--pc' as string]: person.color }} role="tabpanel">
        <div className="profile__main">
          <header className="profile__head">
            <span className="label">Profile · {String(people.indexOf(current) + 1).padStart(2, '0')}/{String(people.length).padStart(2, '0')}</span>
            <h3 className="profile__name">{person.name}</h3>
            {stats.persona.title && <p className="profile__persona">{stats.persona.title}</p>}
            {stats.persona.blurb && <p className="profile__blurb">{stats.persona.blurb}</p>}
          </header>
          <div className="profile__kpis">
            <div>
              <span className="label">Messages</span>
              <strong>{fmtInt(stats.messages)}</strong>
              <small>{fmtPct(stats.messages / total)} of chat</small>
            </div>
            <div>
              <span className="label">Words / msg</span>
              <strong>{fmtNum(stats.avgWords)}</strong>
              <small>{fmtInt(stats.words)} words</small>
            </div>
            <div>
              <span className="label">Avg reply</span>
              <strong>{fmtDuration(stats.replyMeanMs)}</strong>
              <small>{fmtPct(stats.replyQuickShare)} within 1 min</small>
            </div>
            <div>
              <span className="label">Active days</span>
              <strong>{fmtInt(stats.activeDays)}</strong>
              <small>streak {fmtDays(stats.longestStreak?.days ?? 0)}</small>
            </div>
            <div>
              <span className="label">Media</span>
              <strong>{fmtInt(stats.media)}</strong>
              <small>{fmtInt(stats.links)} links</small>
            </div>
            <div>
              <span className="label">Started</span>
              <strong>{fmtInt(stats.conversationsStarted)}</strong>
              <small>conversations</small>
            </div>
          </div>

          <div className="profile__meters">
            {meters.map((m) => (
              <div className="profile__meter" key={m.label}>
                <div className="row">
                  <span className="label">{m.label}</span>
                  <span className="spacer" />
                  <span className="profile__meter-value">{m.display}</span>
                </div>
                <div className="profile__meter-track">
                  <Meter value={m.value} max={m.max} color={m.color} />
                  <span className="profile__meter-avg" style={{ left: `${Math.min(100, (m.avg / Math.max(1e-9, m.max)) * 100)}%` }} title="Group average" />
                </div>
              </div>
            ))}
            <p className="profile__meter-note">Tick = group average</p>
          </div>

          {awardsWon.length > 0 && (
            <div className="profile__awards">
              <span className="label">Trophies · {awardsWon.length}</span>
              <div className="row wrap">
                {awardsWon.map((a) => (
                  <span className="chip" key={a.id} title={a.blurb}>
                    <Icon name={a.icon} size={13} /> {a.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="profile__side">
          <div className="profile__panel">
            <span className="label">Daily rhythm · peak {fmtHour(stats.peakHour)}</span>
            <RadialClock hourly={stats.hourly} color={person.color} size={220} />
          </div>
          <div className="profile__panel">
            <span className="label">Week · busiest on {WEEKDAYS[stats.peakWeekday]}</span>
            <Columns
              ariaLabel={`${person.short}'s messages per weekday`}
              data={stats.weekday.map((v, i) => ({ label: WEEKDAYS_SHORT[i].slice(0, 2), tipLabel: WEEKDAYS[i], values: [v] }))}
              highlight={stats.peakWeekday}
              color={person.color}
              height={150}
            />
          </div>
        </div>

        <div className="profile__facts">
          <div className="profile__panel">
            <span className="label">Favourite emoji</span>
            <div className="profile__emoji">
              {stats.topEmojis.slice(0, 6).map(([e, c]) => (
                <span key={e} title={`${fmtInt(c)}×`}>
                  <span className="emoji">{emojiDisplay(e)}</span>
                  <small>{fmtInt(c)}</small>
                </span>
              ))}
              {stats.topEmojis.length === 0 && <span className="muted">No emoji</span>}
            </div>
          </div>
          <div className="profile__panel">
            <span className="label">Signature words</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {(stats.signatureWords.length ? stats.signatureWords : stats.topWords).slice(0, 10).map(([w, c]) => (
                <span className="chip" key={w}>
                  {censorWord(w, censor, h)} <b>{fmtInt(c)}</b>
                </span>
              ))}
            </div>
          </div>
          {buddy && stats.bestBuddy && (
            <div className="profile__panel">
              <span className="label">Replies to most</span>
              <div className="profile__buddy">
                <span className="swatch swatch--dot" style={{ ['--sw' as string]: buddy.color }} />
                <strong>{buddy.short}</strong>
                <span className="muted">{fmtInt(stats.bestBuddy.count)} replies</span>
              </div>
            </div>
          )}
          {stats.first && (
            <div className="profile__panel">
              <span className="label">First message · {fmtDate(stats.first.ts)}</span>
              <blockquote className="profile__quote">{censorText(stats.first.text, censor, h) || '[media]'}</blockquote>
            </div>
          )}
          {stats.longestAbsence && stats.longestAbsence.days >= 1 && (
            <div className="profile__panel">
              <span className="label">Longest disappearance</span>
              <p className="profile__fact">
                <strong>{fmtDays(stats.longestAbsence.days)}</strong> — {fmtDate(stats.longestAbsence.start)} → {fmtDate(stats.longestAbsence.end)}
              </p>
            </div>
          )}
        </div>
      </article>
    </Section>
  );
}
