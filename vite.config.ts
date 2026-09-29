import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` produces a normal static site in dist/.
// `npm run build:single` produces one self-contained HTML file in dist-single/
// (fonts, styles, scripts and the analysis worker are all inlined), which can be
// opened straight from disk or hosted anywhere.
export default defineConfig(({ mode }) => {
  const single = mode === 'singlefile';
  return {
    base: './',
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    worker: { format: 'es' },
    build: {
      outDir: single ? 'dist-single' : 'dist',
      assetsInlineLimit: single ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 1500,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'dev/**/*.test.ts'],
    },
  };
});
