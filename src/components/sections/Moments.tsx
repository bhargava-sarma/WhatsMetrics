import type { ReactNode } from 'react';
import { CalendarHeart, Flag, Hourglass, MessageCircle, Milestone, Pin, Sparkles, UserMinus, UserPlus, Vote, Zap, PenLine } from 'lucide-react';
import { Card, Section } from '../ui/primitives';
import { censorText, useReport } from '../report-context';
import { fmtDate, fmtDays, fmtDuration, fmtInt, fmtTime, plural } from '../../lib/format';
import type { SystemEventKind } from '../../lib/parser/types';

interface Moment {
  ts: number;
  icon: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  color?: string;
}

const SYSTEM_ICON: Partial<Record<SystemEventKind, ReactNode>> = {
  created: <Sparkles size={15} />,
  added: <UserPlus size={15} />,
  joined: <UserPlus size={15} />,
  removed: <UserMinus size={15} />,
  left: <UserMinus size={15} />,
  subject: <PenLine size={15} />,
  description: <PenLine size={15} />,
  icon: <PenLine size={15} />,
  pinned: <Pin size={15} />,
};

export function Moments() {
  const { report: r, censor } = useReport();
  const h = r.meta.hinglish;
  const m = r.moments;
  const items: Moment[] = [];
  const name = (id: number) => r.people[id]?.short ?? '?';
  const color = (id: number) => r.people[id]?.color;

  for (const ms of m.milestones) {
    items.push({
      ts: ms.ts,
      icon: ms.n === 1 ? <Flag size={15} /> : <Milestone size={15} />,
      title: ms.n === 1 ? `${name(ms.author)} sent the first message` : `Message #${fmtInt(ms.n)} — by ${name(ms.author)}`,
      body: <q>{censorText(ms.text, censor, h)}</q>,
      color: color(ms.author),
    });
  }
  const bd = r.time.busiestDay;
  if (bd) {
    items.push({
      ts: bd.ts,
      icon: <Zap size={15} />,
      title: `The busiest day: ${plural(bd.count, 'message')}`,
      body: `${name(bd.topAuthor)} led the charge${bd.topWords.length ? `; the talk was about “${bd.topWords.slice(0, 4).map((w) => censorText(w, censor, h)).join('”, “')}”` : ''}.`,
      color: color(bd.topAuthor),
    });
  }
  const lc = r.conversations.longestByMessages;
  if (lc) {
    items.push({
      ts: lc.start,
      icon: <MessageCircle size={15} />,
      title: `The marathon: ${plural(lc.messages, 'message')} in ${fmtDuration(lc.end - lc.start)}`,
      body: `Started by ${name(lc.starter)} at ${fmtTime(lc.start)}, with ${lc.participants.length} people.`,
      color: color(lc.starter),
    });
  }
  const sil = r.totals.longestSilence;
  if (sil && sil.days >= 1) {
    items.push({
      ts: sil.end,
      icon: <Hourglass size={15} />,
      title: `${name(sil.brokenBy)} broke a ${fmtDays(sil.days)} silence`,
      body: `Nothing was said from ${fmtDate(sil.start)} until ${fmtDate(sil.end)}.`,
      color: color(sil.brokenBy),
    });
  }
  for (const e of m.system) {
    if (!SYSTEM_ICON[e.kind]) continue;
    items.push({ ts: e.ts, icon: SYSTEM_ICON[e.kind], title: e.text });
  }
  for (const ev of m.events) {
    items.push({ ts: ev.ts, icon: <CalendarHeart size={15} />, title: `${name(ev.author)} created an event: “${ev.title}”`, color: color(ev.author) });
  }
  for (const p of m.polls.slice(0, 20)) {
    items.push({ ts: p.ts, icon: <Vote size={15} />, title: `${name(p.author)} asked: “${p.poll.question}”`, color: color(p.author) });
  }
  items.sort((a, b) => a.ts - b.ts);

  return (
    <Section id="moments" num="10" label="Story" title="Moments that mattered" intro="The chat's timeline: firsts, milestones, record days, long silences and group history.">
      <div className="grid">
        <Card span={m.polls.length ? 7 : 12} index="10.1 — TIMELINE" title="The story so far">
          <ol className="timeline">
            {items.map((it, i) => (
              <li key={i} className="timeline__item" style={{ ['--pc' as string]: it.color ?? 'var(--ink-3)' }}>
                <span className="timeline__dot">{it.icon}</span>
                <div className="timeline__content">
                  <time className="label">{fmtDate(it.ts, { weekday: true })}</time>
                  <p className="timeline__title">{it.title}</p>
                  {it.body && <p className="timeline__body">{it.body}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Card>
        {m.polls.length > 0 && (
          <Card span={5} index="10.2 — POLLS" title="Polls" sub={`${plural(m.polls.length, 'poll')} — democracy in action.`}>
            <div className="polls">
              {m.polls.slice(-12).reverse().map((p, i) => {
                const total = p.poll.options.reduce((s, o) => s + o.votes, 0);
                const max = Math.max(1, ...p.poll.options.map((o) => o.votes));
                return (
                  <div className="poll" key={i}>
                    <div className="poll__q">{p.poll.question}</div>
                    <div className="poll__meta label">
                      {name(p.author)} · {fmtDate(p.ts)} · {plural(total, 'vote')}
                    </div>
                    {p.poll.options.map((o) => (
                      <div className="poll__opt" key={o.label}>
                        <span className="poll__label">{o.label}</span>
                        <span className="poll__bar">
                          <span style={{ width: `${(o.votes / max) * 100}%`, background: o.votes === max && total > 0 ? 'var(--accent)' : 'rgba(255,255,255,0.18)' }} />
                        </span>
                        <span className="poll__votes">{o.votes}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </Section>
  );
}
