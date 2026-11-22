import { defineConfig } from '@playwright/test';

// Browser smoke tests. Runs its own Vite server on a spare port so it never touches a running
// dev server. Samples load from GitHub, so the first run needs network.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5199',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: false,
  },
});
