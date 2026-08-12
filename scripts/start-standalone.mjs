import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const standaloneRoot = resolve(root, ".next/standalone");
const serverPath = resolve(standaloneRoot, "server.js");

if (!existsSync(serverPath)) {
  console.error("[start:standalone] .next/standalone/server.js is missing; run npm run build first");
  process.exit(1);
}

// Next's standalone output intentionally leaves these browser assets outside
// the traced server directory. Docker copies them in its runner stage; the
// local E2E launcher performs the same safe, generated-output-only step.
for (const directory of [".next/static", "public"]) {
  const source = resolve(root, directory);
  if (existsSync(source)) cpSync(source, resolve(standaloneRoot, directory), { recursive: true });
}

const child = spawn(process.execPath, [serverPath], {
  cwd: standaloneRoot,
  env: process.env,
  stdio: "inherit",
});

const forwardSignal = (signal) => child.kill(signal);
process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
