import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Activity, Award, CalendarClock, Clapperboard, LayoutDashboard, MessagesSquare, Smile, Type, UserRound, Users } from 'lucide-react';

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'awards', label: 'Awards', icon: Award },
  { id: 'people', label: 'People', icon: Users },
  { id: 'time', label: 'Time', icon: CalendarClock },
  { id: 'conversations', label: 'Dynamics', icon: MessagesSquare },
  { id: 'words', label: 'Words', icon: Type },
  { id: 'emoji', label: 'Emoji', icon: Smile },
  { id: 'vibes', label: 'Vibes', icon: Activity },
  { id: 'profiles', label: 'Profiles', icon: UserRound },
  { id: 'moments', label: 'Story', icon: Clapperboard },
];

/** Floating liquid-glass capsule; a glass lens slides to the section in view. */
export function Nav() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const barRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const onScroll = () => {
      const probe = window.innerHeight * 0.3;
      let current = els[0]?.id ?? SECTIONS[0].id;
      for (const el of els) if (el.getBoundingClientRect().top <= probe) current = el.id;
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  useLayoutEffect(() => {
    const bar = barRef.current;
    const lens = lensRef.current;
    if (!bar || !lens) return;
    const place = () => {
      const item = bar.querySelector<HTMLElement>(`[data-id="${active}"]`);
      if (!item) return;
      lens.style.width = `${item.offsetWidth}px`;
      lens.style.transform = `translateX(${item.offsetLeft}px)`;
      const left = item.offsetLeft - bar.clientWidth / 2 + item.offsetWidth / 2;
      if (bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left, behavior: 'smooth' });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(bar);
    return () => ro.disconnect();
  }, [active]);

  return (
    <nav className="nav" aria-label="Sections">
      <div className="nav__bar glass glass--strong" ref={barRef}>
        <span className="nav__lens" ref={lensRef} aria-hidden="true" />
        {SECTIONS.map((s, i) => {
          const I = s.icon;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              data-id={s.id}
              className={`nav__item${active === s.id ? ' is-active' : ''}`}
              aria-current={active === s.id ? 'true' : undefined}
              title={s.label}
            >
              <span className="nav__num">{String(i + 1).padStart(2, '0')}</span>
              <I size={15} strokeWidth={1.8} aria-hidden="true" />
              <span className="nav__text">{s.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
