/**
 * T271 · 与 iztro 对照脚本
 *
 * 用法：
 *   npm i -D iztro
 *   node scripts/compare-iztro.mjs
 *   node scripts/compare-iztro.mjs --solar=1990-05-15 --time=10:30 --gender=male
 *
 * 运行时应用不依赖 iztro；本脚本仅 dev/对照。
 * 依赖缺失时 **exit 1**（不再静默 skip 通过）。
 *
 * 环境变量：
 *   IZTRO_OPTIONAL=1  — 缺失 iztro 时 exit 0 并打印 skip（CI optional job 用）
 */

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const IZTRO_PINNED_HINT = "iztro@^2.5.0（建议固定 devDependency）";

function parseArgs(argv) {
  const out = {
    solar: "1990-05-15",
    time: "10:30",
    gender: "male",
  };
  for (const a of argv) {
    if (a.startsWith("--solar=")) out.solar = a.slice(8);
    if (a.startsWith("--time=")) out.time = a.slice(7);
    if (a.startsWith("--gender=")) out.gender = a.slice(9);
  }
  return out;
}

function hourToIztroIndex(birthTime) {
  const h = Number(String(birthTime).split(":")[0]);
  if (Number.isNaN(h)) return 0;
  if (h === 23 || h === 0) return 0;
  return Math.floor((h + 1) / 2);
}

function tryIztro() {
  try {
    return require("iztro");
  } catch {
    return null;
  }
}

function extractIztroSnapshot(astrolabe) {
  const majorByBranch = {};
  const palaces = astrolabe.palaces ?? [];
  for (const p of palaces) {
    const branch = p.earthlyBranch ?? p.branch;
    for (const s of p.majorStars ?? []) {
      const name = typeof s === "string" ? s : s.name;
      if (name) majorByBranch[name] = branch;
    }
  }

  const ming =
    palaces.find((p) => p.name === "命宫" || p.palaceName === "命宫") ??
    null;
  const shen =
    palaces.find(
      (p) =>
        p.isBodyPalace === true ||
        p.isShenGong === true ||
        p.name === "身宫",
    ) ?? null;

  let shenBranch = shen?.earthlyBranch ?? shen?.branch ?? null;
  // iztro 身宫常落在某十二宫 isBodyPalace
  if (!shenBranch) {
    const body = palaces.find((p) => p.isBodyPalace || p.isOriginalPalace === false && p.bodyPalace);
    shenBranch = body?.earthlyBranch ?? body?.branch ?? null;
  }
  for (const p of palaces) {
    if (p.isBodyPalace) {
      shenBranch = p.earthlyBranch ?? p.branch;
      break;
    }
  }

  const daxian = [];
  // iztro 大限可能在 decadal / rawDates
  const decadals = astrolabe.decadal ?? astrolabe.daxian ?? [];
  if (Array.isArray(decadals)) {
    for (let i = 0; i < Math.min(12, decadals.length); i++) {
      const d = decadals[i];
      daxian.push({
        index: i,
        startAge: d?.startAge ?? d?.range?.[0] ?? null,
        endAge: d?.endAge ?? d?.range?.[1] ?? null,
        palace: d?.name ?? d?.palace ?? d?.palaceName ?? null,
        branch: d?.earthlyBranch ?? d?.branch ?? null,
      });
    }
  }

  return {
    mingBranch: ming?.earthlyBranch ?? ming?.branch ?? null,
    shenBranch,
    wuxingJu: astrolabe.fiveElementsClass ?? astrolabe.wuxingJu ?? null,
    majorByBranch,
    daxian,
  };
}

/**
 * 结构化 diff（T271）
 * categories: ming | shen | wuxingJu | major | daxian
 */
function buildDiff(ours, theirs) {
  const diffs = [];

  if (ours.mingBranch !== theirs.mingBranch) {
    diffs.push({
      category: "ming",
      field: "mingBranch",
      ours: ours.mingBranch,
      theirs: theirs.mingBranch,
    });
  }
  if (ours.shenBranch && theirs.shenBranch && ours.shenBranch !== theirs.shenBranch) {
    diffs.push({
      category: "shen",
      field: "shenBranch",
      ours: ours.shenBranch,
      theirs: theirs.shenBranch,
    });
  }
  if (ours.wuxingJu && theirs.wuxingJu && ours.wuxingJu !== theirs.wuxingJu) {
    diffs.push({
      category: "wuxingJu",
      field: "wuxingJu",
      ours: ours.wuxingJu,
      theirs: theirs.wuxingJu,
    });
  }

  const allStars = new Set([
    ...Object.keys(ours.majorByBranch ?? {}),
    ...Object.keys(theirs.majorByBranch ?? {}),
  ]);
  for (const star of allStars) {
    const o = ours.majorByBranch?.[star];
    const t = theirs.majorByBranch?.[star];
    if (o !== t) {
      diffs.push({
        category: "major",
        field: star,
        ours: o ?? null,
        theirs: t ?? null,
      });
    }
  }

  const maxDx = Math.max(
    ours.daxian?.length ?? 0,
    theirs.daxian?.length ?? 0,
    2,
  );
  for (let i = 0; i < Math.min(maxDx, 2); i++) {
    const o = ours.daxian?.[i];
    const t = theirs.daxian?.[i];
    if (!o || !t) continue;
    for (const field of ["startAge", "endAge", "palace", "branch"]) {
      if (o[field] != null && t[field] != null && o[field] !== t[field]) {
        diffs.push({
          category: "daxian",
          field: `daxian[${i}].${field}`,
          ours: o[field],
          theirs: t[field],
        });
      }
    }
  }

  const byCategory = {};
  for (const d of diffs) {
    byCategory[d.category] = (byCategory[d.category] ?? 0) + 1;
  }

  return {
    match: diffs.length === 0,
    count: diffs.length,
    byCategory,
    items: diffs,
  };
}

async function tryLoadOursChart(args) {
  try {
    // 需要 tsx 或已编译；优先动态 import .ts（Node 原生通常失败）
    const mod = await import(
      pathToFileURL(path.join(root, "src/lib/ziwei/compute.ts")).href
    );
    const chart = mod.computeZiweiChart({
      solarDate: args.solar,
      birthTime: args.time,
      gender: args.gender,
      analysisBaseDate: "2026-07-20",
    });
    const ming = chart.palaces.find((p) => p.name === "命宫");
    const shen = chart.palaces.find((p) => p.isShenGong);
    const majorByBranch = {};
    for (const p of chart.palaces) {
      for (const s of p.stars) {
        if (s.category === "major") majorByBranch[s.name] = p.branch;
      }
    }
    return {
      mingBranch: ming?.branch ?? null,
      shenBranch: shen?.branch ?? null,
      wuxingJu: chart.wuxingJu ?? null,
      majorByBranch,
      daxian: (chart.daxian ?? []).slice(0, 2).map((d, i) => ({
        index: i,
        startAge: d.startAge,
        endAge: d.endAge,
        palace: d.palace,
        branch: d.branch ?? null,
      })),
      meta: chart.meta,
    };
  } catch {
    return null;
  }
}

const args = parseArgs(process.argv.slice(2));
const iztro = tryIztro();
const optional = process.env.IZTRO_OPTIONAL === "1";

if (!iztro) {
  const payload = {
    ok: false,
    reason: "iztro not installed",
    hint: `npm i -D iztro  # ${IZTRO_PINNED_HINT}`,
    policy: optional
      ? "IZTRO_OPTIONAL=1 → exit 0 (CI optional)"
      : "missing dependency → exit 1 (T271)",
  };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(optional ? 0 : 1);
}

const genderZh = args.gender === "female" ? "女" : "男";
const timeIndex = hourToIztroIndex(args.time);
const astrolabe = iztro.astro.bySolar(args.solar, timeIndex, genderZh, false);
const theirs = extractIztroSnapshot(astrolabe);
const ours = await tryLoadOursChart(args);

let diff = null;
if (ours) {
  diff = buildDiff(ours, theirs);
}

const out = {
  ok: true,
  source: {
    iztro: "iztro",
    ours: ours ? "computeZiweiChart" : null,
  },
  versions: {
    iztroHint: IZTRO_PINNED_HINT,
    oursEngine: ours?.meta?.engineVersion ?? null,
    agePolicy: ours?.meta?.agePolicy ?? null,
  },
  input: args,
  theirs,
  ours: ours
    ? {
        mingBranch: ours.mingBranch,
        shenBranch: ours.shenBranch,
        wuxingJu: ours.wuxingJu,
        majorByBranch: ours.majorByBranch,
        daxian: ours.daxian,
      }
    : null,
  diff,
  note: ours
    ? "双方均已运行；diff 含命身宫/五行局/十四主星/大限前两步"
    : "未能加载自研盘（需 tsx/Node 可 import TS）；仅输出 iztro 侧。对照请 vitest run src/lib/ziwei/__fixtures__/iztro-compare.test.ts",
};

console.log(JSON.stringify(out, null, 2));
if (diff && !diff.match) {
  // 差异记录到 stdout；脚本仍 exit 0（对照非强制一致），结构已完整
  process.exit(0);
}
process.exit(0);
