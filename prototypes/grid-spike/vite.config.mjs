// PROTOTYPE — @strudel/web bundles its own core; alias so gridTag.mjs shares that one instance.
import { defineConfig } from 'vite';
export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  resolve: { alias: [{ find: /^@strudel\/core$/, replacement: '@strudel/web' }] },
  server: { port: 5199 },
});
