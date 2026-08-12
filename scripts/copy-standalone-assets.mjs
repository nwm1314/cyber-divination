import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const standaloneRoot = resolve(root, ".next/standalone");

if (!existsSync(standaloneRoot)) {
  console.error("[build:standalone] .next/standalone is missing");
  process.exit(1);
}

for (const directory of [".next/static", "public"]) {
  const source = resolve(root, directory);
  if (existsSync(source)) {
    cpSync(source, resolve(standaloneRoot, directory), { recursive: true });
  }
}
