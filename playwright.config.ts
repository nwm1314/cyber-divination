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
            // CI 下 command 为 `node .next/standalone/server.js`，NODE_ENV
            // 默认 production → instrumentation 会执行 validateProductionConfig()
            // 并 fail-fast。占位值必须满足全部生产规则，否则服务准备阶段就抛错、
            // /api/health 返回 500，webServer 超时导致 24 例全部失败。
            AUTH_SECRET: "Zx9pQ2mVt7Lk4Rw8Bn3Hy6Jd1Fg5Cs0Ae2Uo9Pi4Xz7Vb3Nq8Mt5Ky",
            AUTH_ALLOW_DEV_LOGIN: "0",
            NEXT_TELEMETRY_DISABLED: "1",
            PORT: String(port),
            HOSTNAME: "127.0.0.1",
            // Production checks use disposable placeholders in the isolated E2E server.
            DATABASE_URL: "postgres://e2e:e2e@127.0.0.1:5432/e2e",
            CLOUD_STORE_DRIVER: "postgres",
            // 等价于「部署前预跑 DDL」：e2e 无真实库，禁止请求路径执行建表
            DB_SKIP_ENSURE_SCHEMA: "1",
            SHARE_STORE_DRIVER: "upstash",
            RATE_LIMIT_DRIVER: "redis",
            RATE_LIMIT_TRUSTED_PROXY: "0",
            // 指向保留 .invalid TLD，验证依赖不可用时的降级路径
            UPSTASH_REDIS_REST_URL: "https://e2e.invalid",
            UPSTASH_REDIS_REST_TOKEN: "e2e-only-token",
          },
        },
      }),
});
