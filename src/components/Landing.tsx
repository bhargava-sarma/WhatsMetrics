import { useRef, useState, type DragEvent } from 'react';
import {
  Activity,
  Award,
  CalendarClock,
  FileUp,
  Fingerprint,
  Lock,
  Network,
  Play,
  ShieldCheck,
  Smartphone,
  Smile,
  Timer,
  Type,
} from 'lucide-react';
import { CornerMarks, KeyGroup } from './ui/primitives';

const FEATURES = [
  { icon: Award, title: '37 awards', body: 'The Yapper, Night Owl, Most Toxic, Kindest Soul, The Ghost, Class Clown and more.' },
  { icon: CalendarClock, title: 'Heatmaps', body: 'Every day of the chat, every hour of the week, and everyone’s personal body clock.' },
  { icon: Timer, title: 'Reply speed', body: 'Who answers in seconds, who leaves you on read, who double-texts.' },
  { icon: Activity, title: 'Mood & spice', body: 'Positivity, toxicity, kindness and emotions — in English and Hinglish.' },
  { icon: Network, title: 'Friendship map', body: 'Who replies to whom, the strongest duos and the inner circle.' },
  { icon: Type, title: 'Words & topics', body: 'Word cloud, catchphrases, signature words and what you talk about most.' },
  { icon: Smile, title: 'Emoji DNA', body: 'Favourite emoji overall and everyone’s emoji fingerprint.' },
  { icon: Fingerprint, title: 'Personas', body: 'A two-word persona and full profile for every person in the chat.' },
];

const STEPS = {
  android: [
    'Open the chat in WhatsApp and tap ⋮ (top-right) → More → Export chat.',
    'Choose “Without media” — it’s faster and all you need.',
    'Save the .txt (or .zip) file, then drop it here.',
  ],
  ios: [
    'Open the chat and tap the contact or group name at the top.',
    'Scroll down and tap Export Chat → Without Media.',
    'Save to Files, then drop the .zip here (no need to unzip).',
  ],
};

export function Landing({ onFile, onDemo }: { onFile: (f: File) => void; onDemo: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [os, setOs] = useState<'android' | 'ios'>(() =>
    typeof navigator !== 'undefined' && /iPhone|iPad|Mac/i.test(navigator.userAgent) ? 'ios' : 'android',
  );
  const [over, setOver] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      className="landing"
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setOver(false);
      }}
      onDrop={onDrop}
    >
      <header className="topbar container">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="brand__name">whatsmetric</span>
          <span className="brand__model">WM–1</span>
        </div>
        <span className="pill">
          <span className="led led--green is-on" /> 100% on-device
        </span>
      </header>

      <section className="hero container">
        <div className="hero__copy">
          <span className="label">WM–1 · pocket chat analyzer</span>
          <h1>
            Your group chat,
            <br />
            <span className="hero__accent">measured.</span>
          </h1>
          <p className="hero__lede">
            Drop in a WhatsApp export and get 150+ stats, awards and charts — who yaps the most, who ghosts, who&apos;s the most toxic and who&apos;s
            secretly the kindest. It all runs in your browser. <strong>Nothing is uploaded.</strong>
          </p>
          <div className="hero__cta">
            <button type="button" className="key key--lg key--accent" onClick={() => input.current?.click()}>
              <FileUp size={17} /> Choose chat file
            </button>
            <button type="button" className="key key--lg" onClick={onDemo}>
              <Play size={15} /> Try the demo
            </button>
          </div>
          <p className="hero__fine label">Accepts .txt or .zip · Android &amp; iPhone exports · Any size</p>
        </div>

        <div
          className={`device glass glass--strong corner-marks${over ? ' is-over' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Drop a WhatsApp chat export here, or press Enter to choose a file"
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        >
          <CornerMarks />
          <div className="device__screen">
            <div className="device__row">
              <span className="device__tag">WM–1</span>
              <span className="device__rec">
                <span className="led is-on" /> READY
              </span>
            </div>
            <div className="device__dot">{over ? 'RELEASE' : 'DROP CHAT'}</div>
            <div className="eq" aria-hidden="true">
              {Array.from({ length: 24 }, (_, i) => (
                <span key={i} style={{ animationDelay: `${(i * 137) % 900}ms` }} />
              ))}
            </div>
          </div>
          <div className="device__panel">
            <div className="device__knobs" aria-hidden="true">
              <span className="dknob dknob--orange" />
              <span className="dknob dknob--blue" />
              <span className="dknob dknob--white" />
              <span className="dknob dknob--green" />
            </div>
            <div className="device__drop">
              <FileUp size={20} />
              <span>
                Drag &amp; drop your <b>.txt</b> or <b>.zip</b>
                <br />
                or click to browse
              </span>
            </div>
          </div>
        </div>
        <input
          ref={input}
          id="chat-file"
          type="file"
          accept=".txt,.zip,text/plain,application/zip"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
      </section>

      <section className="container howto">
        <div className="howto__head">
          <div>
            <span className="label">01 · Export</span>
            <h2>Get your chat out of WhatsApp</h2>
          </div>
          <KeyGroup
            label="Phone"
            value={os}
            onChange={setOs}
            options={[
              { value: 'android', label: 'Android' },
              { value: 'ios', label: 'iPhone' },
            ]}
          />
        </div>
        <ol className="steps">
          {STEPS[os].map((s, i) => (
            <li key={i} className="step glass">
              <span className="step__n">{String(i + 1).padStart(2, '0')}</span>
              <Smartphone size={18} className="step__icon" />
              <p>{s}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container features">
        <span className="label">02 · What you get</span>
        <h2>Unreasonably detailed. Easy to read.</h2>
        <div className="features__grid">
          {FEATURES.map((f) => (
            <article className="feature glass" key={f.title}>
              <f.icon size={20} strokeWidth={1.7} />
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container privacy">
        <div className="privacy__card glass">
          <ShieldCheck size={26} color="#2bd46f" />
          <div>
            <h3>Private by design</h3>
            <p>
              Your chat is read by your own browser and never leaves your device — no accounts, no servers, no tracking. Close the tab and it&apos;s
              gone.
            </p>
          </div>
          <Lock size={18} className="privacy__lock" />
        </div>
      </section>

      <footer className="container site-foot label">whatsmetric · built for the group chat · analysis runs locally</footer>

      {over && <div className="drop-overlay" aria-hidden="true">Drop to analyze</div>}
    </div>
  );
}
