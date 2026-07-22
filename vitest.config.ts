import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next.js server-only：单元测试中放行
      "server-only": path.resolve(__dirname, "./src/test/empty-module.ts"),
    },
  },
});
