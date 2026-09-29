import { useEffect, useMemo, type ReactNode } from 'react';
import { FilePlus2, ShieldCheck } from 'lucide-react';
import type { Report } from '../lib/analysis/types';
import { ReportContext } from './report-context';
import { KeyGroup, Key, CornerMarks } from './ui/primitives';
import { Knob } from './ui/Knob';
import { Nav } from './Nav';
import { Overview } from './sections/Overview';
import { Awards } from './sections/Awards';
import { People } from './sections/People';
import { Time } from './sections/Time';
import { Conversations } from './sections/Conversations';
import { Words } from './sections/Words';
import { Emoji } from './sections/Emoji';
import { Vibes } from './sections/Vibes';
import { Profiles } from './sections/Profiles';
import { Moments } from './sections/Moments';
import { fmtDate, fmtDuration, fmtInt, plural } from '../lib/format';
import { DEMO_FILE_NAME } from '../lib/demo/demoChat';

export type Period = 'all' | 'last12' | number;
const GAP_OPTIONS = [15, 30, 60, 120, 180, 360, 720];

export function Dashboard({
  report,
  busy,
  period,
  gap,
  censor,
  onPeriod,
  onGap,
  onCensor,
  onReset,
}: {
  report: Report;
  busy: boolean;
  period: Period;
  gap: number;
  censor: boolean;
  onPeriod: (p: Period) => void;
  onGap: (g: number) => void;
  onCensor: () => void;
  onReset: () => void;
}) {
  const ctx = useMemo(() => ({ report, censor }), [report, censor]);
  const r = report;
  useEffect(() => {
    document.title = `${r.meta.chatName} · WhatsMetric`;
    return () => {
      document.title = 'WhatsMetric Chat Analyzer';
    };
  }, [r.meta.chatName]);
  const humans = r.people.filter((p) => !p.isBot);
  const spanDays = Math.round((r.meta.fullRange.end - r.meta.fullRange.start) / 86_400_000);
  const periodOptions: { value: Period; label: ReactNode }[] = [
    { value: 'all', label: 'All time' },
    ...(spanDays > 400 ? [{ value: 'last12' as Period, label: 'Last 12 mo' }] : []),
    ...(r.meta.years.length > 1 ? r.meta.years.map((y) => ({ value: y as Period, label: String(y) })) : []),
  ];

  return (
    <ReportContext.Provider value={ctx}>
      <header className="dash-hero container">
        <div className="dash-hero__device glass corner-marks">
          <CornerMarks />
          <div className="lcd">
            <span className="lcd__brand">WM–1</span>
            <span className="lcd__text">{r.meta.chatName.toUpperCase().slice(0, 28)}</span>
            <span className="lcd__status">
              <span className="led led--green is-on" /> ON-DEVICE · {fmtInt(r.meta.computeMs)} MS
            </span>
          </div>
          <div className="dash-hero__body">
            <div className="dash-hero__title">
              <div className="row wrap" style={{ gap: 10 }}>
                <span className="label">{r.meta.isGroup ? 'Group chat' : 'One-to-one chat'} · {plural(humans.length, 'person', 'people')}</span>
                {r.meta.fileName === DEMO_FILE_NAME && (
                  <button type="button" className="demo-badge" onClick={onReset} title="Analyze your own chat instead">
                    Demo · fictional chat — use your own →
                  </button>
                )}
              </div>
              <h1>{r.meta.chatName}</h1>
              <p className="dash-hero__range">
                {fmtDate(r.meta.range.start)} <span aria-hidden="true">→</span> {fmtDate(r.meta.range.end)}
                <span className="dash-hero__sep">·</span>
                {fmtInt(r.totals.messages)} messages
                {r.meta.periodLabel !== 'All time' && (
                  <>
                    <span className="dash-hero__sep">·</span>
                    <span className="accent-text">{r.meta.periodLabel}</span>
                  </>
                )}
              </p>
              {r.vibeTags.length > 0 && (
                <ul className="vibe-tags" aria-label="Chat personality">
                  {r.vibeTags.map((t) => (
                    <li className="pill" key={t.label} title={t.detail}>
                      <span className="led is-on" aria-hidden="true" />
                      {t.label}
                      <small>{t.detail}</small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="controls" role="group" aria-label="Filters">
            <div className="controls__group">
              <span className="label">Period</span>
              <KeyGroup<Period> label="Period" value={period} onChange={onPeriod} options={periodOptions} />
            </div>
            <div className="controls__group">
              <Knob<number>
                label="New chat after"
                value={gap}
                options={GAP_OPTIONS}
                onChange={onGap}
                format={(m) => fmtDuration(m * 60_000).replace(' min', 'm')}
              />
            </div>
            <div className="controls__group controls__group--end">
              <Key size="sm" led on={censor} onClick={onCensor} title="Mask swear words everywhere">
                Censor
              </Key>
              <Key size="sm" onClick={onReset} title="Analyze another chat">
                <FilePlus2 size={14} /> New chat
              </Key>
            </div>
          </div>
        </div>
      </header>

      <Nav />

      <main className={`container dash-main${busy ? ' is-busy' : ''}`} aria-busy={busy}>
        <Overview />
        <Awards />
        <People />
        <Time />
        <Conversations />
        <Words />
        <Emoji />
        <Vibes onToggleCensor={onCensor} />
        <Profiles />
        <Moments />
        <Methodology report={r} />
      </main>
    </ReportContext.Provider>
  );
}

function Methodology({ report: r }: { report: Report }) {
  return (
    <footer className="methodology">
      <div className="glass card">
        <div className="row" style={{ gap: 10, marginBottom: 10 }}>
          <ShieldCheck size={18} color="#2bd46f" />
          <strong>Analyzed entirely on your device in {fmtInt(r.meta.computeMs)} ms. Nothing was uploaded.</strong>
        </div>
        <details>
          <summary>How are these numbers calculated?</summary>
          <ul>
            <li>
              <b>Conversations</b> start after {fmtDuration(r.meta.gapMinutes * 60_000)} of silence (adjust with the knob). The first person to speak
              "starts" it; the last one "ends" it — if their message got no reply, it was left on read.
            </li>
            <li>
              <b>Reply time</b> is the gap between someone's message and the next message from a different person, ignoring gaps over 12 hours.
              Averages cap each reply at 1 hour, because WhatsApp exports only record minutes.
            </li>
            <li>
              <b>Mood</b> uses the AFINN-165 word list plus emoji and romanised-Hindi additions, with simple negation handling ("not good",
              "accha nahi"). Net mood = % positive minus % negative messages.
            </li>
            <li>
              <b>Toxicity</b> counts swear words, slurs and insults (English, Hindi/Hinglish and some Kannada) weighted by severity
              {r.meta.hinglish ? '; "bc"/"mc" count as swears because this chat mixes in Hindi' : ''}. <b>Kindness</b> counts thanks, apologies,
              pleases, affection, praise and support. Word lists can't read sarcasm — friendly banter often scores as "toxic".
            </li>
            <li>
              <b>Signature words</b> use weighted log-odds (Monroe et al., 2008): words a person uses significantly more than everyone else.
              <b> Vocabulary variety</b> is a moving-average type-token ratio, so chatty people aren't penalised.
            </li>
            <li>
              People with under 1% of messages are grouped as "Others" in charts; rate-based awards need at least{' '}
              {fmtInt(Math.max(20, Math.round(r.totals.messages * 0.01)))} messages.
            </li>
          </ul>
        </details>
        <p className="methodology__meta label">
          WhatsMetric · {r.meta.platform} export · {r.meta.dateOrder} dates · {r.meta.fileName}
        </p>
      </div>
    </footer>
  );
}
