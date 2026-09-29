import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Engine, type Stage } from './lib/engine/client';
import { readChatFile } from './lib/parser/file';
import type { AnalyzeOptions, Report } from './lib/analysis/types';
import { DEMO_FILE_NAME, generateDemoChat } from './lib/demo/demoChat';
import { Landing } from './components/Landing';
import { Loading } from './components/Loading';
import { Dashboard, type Period } from './components/Dashboard';
import { Tooltip } from './components/ui/Tooltip';
import { useGlassPointer } from './components/ui/hooks';

type Phase = { kind: 'landing' } | { kind: 'loading'; fileName: string } | { kind: 'ready' } | { kind: 'error'; message: string };

/** Builds made for previews open straight into the demo; `#demo` does the same anywhere. */
const AUTO_DEMO = import.meta.env.VITE_AUTO_DEMO === '1';

function optionsFor(period: Period, gapMinutes: number, fullEnd: number | null): AnalyzeOptions {
  if (period === 'all') return { gapMinutes, periodLabel: 'All time' };
  if (period === 'last12' && fullEnd !== null) {
    const end = new Date(fullEnd);
    return {
      gapMinutes,
      periodLabel: 'Last 12 months',
      from: Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate() + 1),
    };
  }
  const y = period as number;
  return { gapMinutes, periodLabel: String(y), from: Date.UTC(y, 0, 1), to: Date.UTC(y + 1, 0, 1) };
}

function readCensorPref(): boolean {
  try {
    return localStorage.getItem('wm-censor') !== '0';
  } catch {
    return true;
  }
}

export default function App() {
  useGlassPointer();
  const engineRef = useRef<Engine | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'landing' });
  const [stage, setStage] = useState<Stage>('reading');
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState<Period>('all');
  const [gap, setGap] = useState(60);
  const [censor, setCensor] = useState(readCensorPref);
  const requestId = useRef(0);

  const engine = () => (engineRef.current ??= new Engine());
  useEffect(() => () => engineRef.current?.dispose(), []);

  const start = useCallback(async (getText: () => Promise<{ text: string; fileName: string }>, fileName: string) => {
    const id = ++requestId.current;
    setPhase({ kind: 'loading', fileName });
    setStage('reading');
    setPeriod('all');
    try {
      const src = await getText();
      const r = await engine().load(src.text, src.fileName, optionsFor('all', gap, null), (s) => id === requestId.current && setStage(s));
      if (id !== requestId.current) return;
      setStage('rendering');
      await new Promise((res) => setTimeout(res, 30));
      setReport(r);
      setPhase({ kind: 'ready' });
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (id !== requestId.current) return;
      setPhase({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
    // gap is read at load time; later changes go through reanalyze()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFile = (file: File) => start(() => readChatFile(file), file.name);
  const onDemo = () => start(async () => ({ text: generateDemoChat(), fileName: DEMO_FILE_NAME }), DEMO_FILE_NAME);

  useEffect(() => {
    if (!AUTO_DEMO && window.location.hash !== '#demo') return;
    queueMicrotask(() => void start(async () => ({ text: generateDemoChat(), fileName: DEMO_FILE_NAME }), DEMO_FILE_NAME));
  }, [start]);

  const reanalyze = async (p: Period, g: number) => {
    if (!report) return;
    const id = ++requestId.current;
    setBusy(true);
    try {
      const r = await engine().analyze(optionsFor(p, g, report.meta.fullRange.end));
      if (id === requestId.current) setReport(r);
    } catch (err) {
      if (id === requestId.current) setPhase({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  };

  const toggleCensor = () =>
    setCensor((c) => {
      try {
        localStorage.setItem('wm-censor', c ? '0' : '1');
      } catch {
        /* storage unavailable — preference just won't persist */
      }
      return !c;
    });

  const reset = () => {
    requestId.current++;
    setReport(null);
    setPhase({ kind: 'landing' });
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <div className="ambient" aria-hidden="true">
        <div className="ambient__orb ambient__orb--a" />
        <div className="ambient__orb ambient__orb--b" />
        <div className="ambient__orb ambient__orb--c" />
        <div className="ambient__grid" />
        <div className="ambient__grain" />
      </div>

      {phase.kind === 'landing' && <Landing onFile={onFile} onDemo={onDemo} />}
      {phase.kind === 'loading' && <Loading stage={stage} fileName={phase.fileName} />}
      {phase.kind === 'error' && (
        <div className="error-screen container">
          <div className="glass card error-card">
            <AlertTriangle size={28} color="#fab219" />
            <h2>That didn&apos;t work</h2>
            <p>{phase.message}</p>
            <button type="button" className="key key--lg key--accent" onClick={reset}>
              <RotateCcw size={16} /> Try another file
            </button>
          </div>
        </div>
      )}
      {phase.kind === 'ready' && report && (
        <Dashboard
          report={report}
          busy={busy}
          period={period}
          gap={gap}
          censor={censor}
          onPeriod={(p) => {
            setPeriod(p);
            void reanalyze(p, gap);
          }}
          onGap={(g) => {
            setGap(g);
            void reanalyze(period, g);
          }}
          onCensor={toggleCensor}
          onReset={reset}
        />
      )}
      <Tooltip />
    </>
  );
}
