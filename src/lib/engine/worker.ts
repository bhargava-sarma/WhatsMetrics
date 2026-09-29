import { EngineCore, type Stage } from './core';
import type { EngineRequest, EngineResponse } from './protocol';

const core = new EngineCore();
// Typed narrowly so this file can share the DOM lib with the rest of the app.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<EngineRequest>) => void) | null;
  postMessage: (message: EngineResponse) => void;
};

scope.onmessage = (event) => {
  const req = event.data;
  const onStage = (stage: Stage) => scope.postMessage({ type: 'stage', id: req.id, stage });
  try {
    if (req.type === 'load') core.load(req.text, req.fileName, onStage);
    const report = core.analyze(req.options, onStage);
    scope.postMessage({ type: 'report', id: req.id, report });
  } catch (err) {
    scope.postMessage({
      type: 'error',
      id: req.id,
      message: err instanceof Error ? err.message : String(err),
      name: err instanceof Error ? err.name : 'Error',
    });
  }
};
