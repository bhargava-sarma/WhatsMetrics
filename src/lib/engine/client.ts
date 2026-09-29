import AnalysisWorker from './worker?worker&inline';
import { EngineCore, type Stage } from './core';
import type { EngineRequest, EngineResponse } from './protocol';
import type { AnalyzeOptions, Report } from '../analysis/types';

export type { Stage };

export class EngineError extends Error {
  constructor(message: string, name: string) {
    super(message);
    this.name = name;
  }
}

interface Pending {
  resolve: (r: Report) => void;
  reject: (e: Error) => void;
  onStage?: (s: Stage) => void;
  request: EngineRequest;
}

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 16));

/**
 * Runs parsing + analysis in a Web Worker so the UI stays responsive on big chats.
 * If workers are unavailable (strict CSP, file://, old browsers) it transparently
 * falls back to the main thread.
 */
export class Engine {
  private worker: Worker | null = null;
  private fallback: EngineCore | null = null;
  private pending = new Map<number, Pending>();
  private seq = 0;
  /** Last load request — replayed if we have to switch to the fallback mid-flight. */
  private lastLoad: Extract<EngineRequest, { type: 'load' }> | null = null;
  private fallbackLoaded = false;

  constructor() {
    try {
      this.worker = new AnalysisWorker();
      this.worker.onmessage = (e: MessageEvent<EngineResponse>) => this.handle(e.data);
      this.worker.onerror = (e) => {
        e.preventDefault();
        this.switchToFallback();
      };
    } catch {
      this.worker = null;
      this.fallback = new EngineCore();
    }
  }

  load(text: string, fileName: string, options: AnalyzeOptions, onStage?: (s: Stage) => void): Promise<Report> {
    const req = { type: 'load' as const, id: ++this.seq, text, fileName, options };
    this.lastLoad = req;
    return this.send(req, onStage);
  }

  analyze(options: AnalyzeOptions, onStage?: (s: Stage) => void): Promise<Report> {
    return this.send({ type: 'analyze', id: ++this.seq, options }, onStage);
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }

  private send(request: EngineRequest, onStage?: (s: Stage) => void): Promise<Report> {
    return new Promise<Report>((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject, onStage, request });
      if (this.worker) this.worker.postMessage(request);
      else void this.runLocally(request.id);
    });
  }

  private handle(res: EngineResponse) {
    const p = this.pending.get(res.id);
    if (!p) return;
    if (res.type === 'stage') {
      p.onStage?.(res.stage);
      return;
    }
    this.pending.delete(res.id);
    if (res.type === 'report') p.resolve(res.report);
    else p.reject(new EngineError(res.message, res.name));
  }

  private switchToFallback() {
    this.worker?.terminate();
    this.worker = null;
    this.fallback = new EngineCore();
    const replay = [...this.pending.keys()].sort((a, b) => a - b);
    for (const id of replay) void this.runLocally(id);
  }

  private async runLocally(id: number) {
    const p = this.pending.get(id);
    if (!p) return;
    const core = (this.fallback ??= new EngineCore());
    const onStage = (s: Stage) => p.onStage?.(s);
    try {
      await nextFrame(); // let the loading state paint first
      const req = p.request;
      if (req.type === 'load') core.load(req.text, req.fileName, onStage);
      else if (this.lastLoad && !this.fallbackLoaded) core.load(this.lastLoad.text, this.lastLoad.fileName, onStage);
      this.fallbackLoaded = true;
      await nextFrame();
      const report = core.analyze(req.options, onStage);
      this.pending.delete(id);
      p.resolve(report);
    } catch (err) {
      this.pending.delete(id);
      p.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
