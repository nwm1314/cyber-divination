/**
 * TASK-004 independent Ziwei validation gate.
 *
 * This is a test-side oracle check only. It never becomes a runtime dependency
 * of the application and it never treats the project's own golden snapshots
 * as external evidence. The fixture inputs are project-selected vectors; the
 * compared outputs come from the independently maintained iztro package.
 *
 * Usage:
 *   node scripts/compare-iztro.mjs
 *   node scripts/compare-iztro.mjs --case=g1
 *
 * The gate intentionally fails when the exact oracle dependency is missing or
 * has drifted. CI must install the pinned package before invoking this script.
 */

import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CONTRACT = {
  schemaVersion: "task-004.ziwei-iztro.v1",
  gate: "independent-ziwei-iztro",
  dependency: {
    name: "iztro",
    version: "2.5.8",
    license: "MIT",
    repository: "https://github.com/SylarLong/iztro",
  },
  fixture: {
    path: "src/lib/ziwei/__fixtures__/golden-cases.ts",
    role: "project-selected input vectors; not external evidence",
    sourceKind: "self-engine-snapshot",
    expectedCaseCount: 8,
  },
  school: {
    ours: "sanhe",
    oracle: "iztro v2.5.8 default configuration",
    scope:
      "Only compared fields are evidence; this does not establish cross-school equivalence.",
  },
  comparedFields: [
    "mingBranch",
    "shenBranch",
    "wuxingJu",
    "majorByBranch[*]",
    "daxian[0..1].{startAge,endAge,palace,branch}",
  ],
  excludedFields: [
    "minorStars",
    "adjectiveStars",
    "brightness",
    "mutagen",
    "horoscope",
    "daxian[2..11]",
  ],
  allowedDifferences: [],
};

function emit(payload, exitCode) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/compare-iztro.mjs [--case=g1]");
      process.exit(0);
    }
    if (arg.startsWith("--case=")) {
      out.caseId = arg.slice("--case=".length);
      continue;
    }
    emit(
      {
        ...CONTRACT,
        ok: false,
        status: "invalid_arguments",
        argument: arg,
      },
      1,
    );
  }
  return out;
}

function loadIztroMetadata() {
  try {
    // package.json is read only for gate provenance/version enforcement.
    const packageJson = require("iztro/package.json");
    return {
      version: String(packageJson.version ?? ""),
      license: packageJson.license ?? null,
      repository:
        typeof packageJson.repository === "string"
          ? packageJson.repository
          : packageJson.repository?.url ?? null,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const args = parseArgs(process.argv.slice(2));
const iztro = loadIztroMetadata();
if (iztro.error) {
  emit(
    {
      ...CONTRACT,
      ok: false,
      status: "blocked",
      reason: "required_dependency_missing",
      observed: { iztro },
      remediation: "Install the exact dev dependency: npm install --save-dev iztro@2.5.8",
    },
    1,
  );
}

const versionMatches = iztro.version === CONTRACT.dependency.version;
const licenseMatches = iztro.license === CONTRACT.dependency.license;
if (!versionMatches || !licenseMatches) {
  emit(
    {
      ...CONTRACT,
      ok: false,
      status: "blocked",
      reason: "dependency_drift",
      expected: CONTRACT.dependency,
      observed: iztro,
      remediation:
        "Use the pinned iztro version and review license/source changes before updating this gate.",
    },
    1,
  );
}

const vitestEntry = path.join(root, "node_modules", "vitest", "vitest.mjs");
const compareTest = path.join(
  root,
  "src",
  "lib",
  "ziwei",
  "__fixtures__",
  "iztro-compare.test.ts",
);
if (!fs.existsSync(vitestEntry) || !fs.existsSync(compareTest)) {
  emit(
    {
      ...CONTRACT,
      ok: false,
      status: "blocked",
      reason: "gate_runner_missing",
      expected: { vitestEntry, compareTest },
    },
    1,
  );
}

console.log(
  JSON.stringify(
    {
      ...CONTRACT,
      ok: true,
      status: "running",
      observed: iztro,
      selectedCase: args.caseId ?? null,
    },
    null,
    2,
  ),
);

const env = {
  ...process.env,
  IZTRO_REQUIRE: "1",
};
if (args.caseId) env.IZTRO_COMPARE_CASE = args.caseId;

const result = spawnSync(
  process.execPath,
  [
    vitestEntry,
    "run",
    compareTest,
    "--reporter=verbose",
    "--pool=threads",
    "--maxWorkers=1",
    "--minWorkers=1",
  ],
  {
    cwd: root,
    env,
    stdio: "inherit",
  },
);

const exitCode =
  typeof result.status === "number" ? result.status : result.error ? 1 : 1;
emit(
  {
    ...CONTRACT,
    ok: exitCode === 0,
    status: exitCode === 0 ? "passed" : "failed",
    observed: iztro,
    selectedCase: args.caseId ?? null,
    child: {
      exitCode,
      signal: result.signal ?? null,
      error: result.error?.message ?? null,
    },
  },
  exitCode,
);
