import { defineConfig } from "@playwright/test";

const port = 5174;

// End-to-end tests against the real dev server and the local D1 (`bun run test:e2e`).
// Unit/integration tests stay on `bun test` (tests/); these live in e2e/ as *.e2e.ts so bun skips them.
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 90_000,
  // The specs share the local database and dev fixture users.
  workers: 1,
  use: {
    baseURL: `http://localhost:${port}`,
    // The installed Chrome: no browser download needed.
    channel: "chrome",
    viewport: { width: 402, height: 880 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `bun run dev --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
