import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const externalBaseUrl = process.env.E2E_BASE_URL?.trim();
const localChromePath =
  process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : undefined;
const browserArgs = [
  "--disable-gpu",
];

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "line" : "list",
  outputDir: "output/playwright/e2e",
  use: {
    baseURL: externalBaseUrl ?? `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_BROWSER === "system" && localChromePath
      ? { executablePath: localChromePath, args: browserArgs }
      : undefined,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "iphone-13", use: { ...devices["iPhone 13"] } },
    { name: "pixel-5", use: { ...devices["Pixel 5"] } },
  ],
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command:
            process.env.E2E_SERVER_COMMAND ??
            (process.env.CI
              ? "node .next/standalone/server.js"
              : `npm run dev -- --hostname 127.0.0.1 --port ${port}`),
          url: `http://127.0.0.1:${port}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            AUTH_SECRET: "e2e-only-secret",
            AUTH_ALLOW_DEV_LOGIN: "0",
            NEXT_TELEMETRY_DISABLED: "1",
            PORT: String(port),
            HOSTNAME: "127.0.0.1",
            // Production checks use disposable placeholders in the isolated E2E server.
            DATABASE_URL: "postgres://e2e:e2e@127.0.0.1:5432/e2e",
            CLOUD_STORE_DRIVER: "postgres",
            RATE_LIMIT_DRIVER: "redis",
            RATE_LIMIT_TRUSTED_PROXY: "0",
            UPSTASH_REDIS_REST_URL: "https://e2e.invalid",
            UPSTASH_REDIS_REST_TOKEN: "e2e-only-token",
          },
        },
      }),
});
