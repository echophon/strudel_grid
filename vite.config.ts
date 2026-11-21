import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5173 },
  test: {
    include: ['test/**/*.test.ts'],
    // Strudel ships ESM via the "module" field only; inline so Vite resolves it (plain Node loads the IIFE).
    server: { deps: { inline: [/@strudel\//, /@kabelsalat\//, /superdough/] } },
  },
});
