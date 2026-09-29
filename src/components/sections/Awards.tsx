import { useState } from 'react';
import { Section, KeyGroup } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { useReport } from '../report-context';
import { AWARD_GROUPS } from '../../lib/analysis/awards';
import type { Award } from '../../lib/analysis/types';

type Filter = 'all' | Award['group'];

export function Awards() {
  const { report: r } = useReport();
  const [filter, setFilter] = useState<Filter>('all');
  const shown = r.awards.filter((a) => filter === 'all' || a.group === filter);
  const groups = AWARD_GROUPS.filter((g) => r.awards.some((a) => a.group === g.id));
  return (
    <Section
      id="awards"
      num="02"
      label="Hall of fame"
      title="The awards"
      intro="Superlatives for everyone — who yaps, who ghosts, who roasts, who's secretly the sweetest. Runners-up are listed underneath."
    >
      <div className="awards-toolbar">
        <KeyGroup<Filter>
          label="Award category"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All ${r.awards.length}` },
            ...groups.map((g) => ({ value: g.id as Filter, label: g.label })),
          ]}
        />
      </div>
      {shown.length === 0 ? (
        <div className="card glass empty">Not enough activity in this period for awards.</div>
      ) : (
        <div className="awards-grid">
          {shown.map((a, i) => {
            const winner = r.people[a.winner];
            const runner = a.runnerUp ? r.people[a.runnerUp.id] : null;
            return (
              <article key={a.id} className="award glass" style={{ ['--pc' as string]: winner.color, animationDelay: `${i * 30}ms` }}>
                <header className="award__head">
                  <span className="award__badge">
                    <Icon name={a.icon} size={18} />
                  </span>
                  <span className="award__title">{a.title}</span>
                  <span className="award__no">{String(r.awards.indexOf(a) + 1).padStart(2, '0')}</span>
                </header>
                <div className="award__winner">
                  <span className="swatch swatch--dot" style={{ ['--sw' as string]: winner.color }} />
                  <span title={winner.name}>{winner.short}</span>
                </div>
                <div className="award__value">{a.value}</div>
                <p className="award__blurb">{a.blurb}</p>
                {runner && a.runnerUp && (
                  <footer className="award__runner">
                    <span className="label">Runner-up</span>
                    <span className="award__runner-name" title={runner.name}>
                      <span className="swatch swatch--dot" style={{ ['--sw' as string]: runner.color }} />
                      <span>{runner.short}</span>
                    </span>
                    <span className="award__runner-value">{a.runnerUp.value}</span>
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      )}
    </Section>
  );
}
