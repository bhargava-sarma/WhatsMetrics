import type { AnalyzeOptions, Report } from '../analysis/types';
import type { Stage } from './core';

export type EngineRequest =
  | { type: 'load'; id: number; text: string; fileName: string; options: AnalyzeOptions }
  | { type: 'analyze'; id: number; options: AnalyzeOptions };

export type EngineResponse =
  | { type: 'stage'; id: number; stage: Stage }
  | { type: 'report'; id: number; report: Report }
  | { type: 'error'; id: number; message: string; name: string };
