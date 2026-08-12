/**
 * iztro 对照流水线（T183 / T271）
 *
 * - 自研盘快照始终可测
 * - 有 iztro：比较全部自研回归 case 的命身宫、五行局、十四主星、前两步大限
 * - 无 iztro：
 *   - 默认 `it.skip` 并写明原因（本地 vitest 可见）
 *   - `IZTRO_REQUIRE=1` 时 **fail**（CI 强制对照 job）
 *
 * 原则：运行时不依赖 iztro；独立 gate 要求精确的 iztro@2.5.8。
 * `IZTRO_REQUIRE=1` 由 scripts/compare-iztro.mjs 设置；普通 npm test 保留
 * 缺依赖 skip，避免把内部回归套件和独立 oracle gate 混在一起。
 */

import { describe, expect, it } from "vitest";
import { computeZiweiChart } from "../compute";
import { ziweiGoldenCases } from "./golden-cases";
import type { ZiweiChart } from "@/lib/types/ziwei";

export const IZTRO_COMPARE_CONTRACT = {
  schemaVersion: "task-004.ziwei-iztro.v1",
  dependency: {
    name: "iztro",
    version: "2.5.8",
    license: "MIT",
    repository: "https://github.com/SylarLong/iztro",
  },
  school: {
    ours: "sanhe",
    oracle: "iztro v2.5.8 default configuration",
    note: "仅对下列可比字段作差分；不宣称跨流派或全功能等价。",
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
  allowedDifferences: [] as const,
} as const;

const MAJOR_NAMES = [
  "紫微",
  "天机",
  "太阳",
  "武曲",
  "天同",
  "廉贞",
  "天府",
  "太阴",
  "贪狼",
  "巨门",
  "天相",
  "天梁",
  "七杀",
  "破军",
] as const;

type Snapshot = {
  id: string;
  mingBranch: string;
  shenBranch: string;
  wuxingJu?: string;
  majorByBranch: Record<string, string>;
  daxian: {
    index: number;
    startAge: number;
    endAge: number;
    palace: string;
    branch?: string;
  }[];
};

export type IztroDiffItem = {
  category: "ming" | "shen" | "wuxingJu" | "major" | "daxian";
  field: string;
  ours: string | number | null;
  theirs: string | number | null;
};

export type IztroDiff = {
  match: boolean;
  count: number;
  byCategory: Record<string, number>;
  items: IztroDiffItem[];
};

function majorSnapshot(chart: ZiweiChart): Snapshot {
  const ming = chart.palaces.find((p) => p.name === "命宫");
  const shen = chart.palaces.find((p) => p.isShenGong);
  const majorByBranch: Record<string, string> = {};
  for (const p of chart.palaces) {
    for (const s of p.stars) {
      if (MAJOR_NAMES.includes(s.name as (typeof MAJOR_NAMES)[number])) {
        majorByBranch[s.name] = p.branch;
      }
    }
  }
  return {
    id: chart.id,
    mingBranch: ming?.branch ?? "",
    shenBranch: shen?.branch ?? "",
    wuxingJu: chart.wuxingJu,
    majorByBranch,
    daxian: chart.daxian.slice(0, 2).map((d, i) => ({
      index: i,
      startAge: d.startAge,
      endAge: d.endAge,
      palace: String(d.palace),
      branch: d.branch,
    })),
  };
}

function tryLoadIztro():
  | {
      astro: {
        bySolar: (
          date: string,
          timeIndex: number,
          gender: string,
          isLeap?: boolean,
        ) => {
          palace: (
            name: string,
          ) =>
            | {
                earthlyBranch: string;
                majorStars: { name: string }[];
                isBodyPalace?: boolean;
              }
            | undefined;
          earthlyBranchOfPalace?: (name: string) => string;
          fiveElementsClass?: string;
          palaces?: {
            name?: string;
            earthlyBranch?: string;
            branch?: string;
            majorStars?: { name: string }[] | string[];
            isBodyPalace?: boolean;
          }[];
          decadal?: {
            startAge?: number;
            endAge?: number;
            name?: string;
            earthlyBranch?: string;
          }[];
        };
      };
    }
  | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("iztro") as {
      astro: {
        bySolar: (
          date: string,
          timeIndex: number,
          gender: string,
          isLeap?: boolean,
        ) => {
          palace: (
            name: string,
          ) =>
            | {
                earthlyBranch: string;
                majorStars: { name: string }[];
                isBodyPalace?: boolean;
              }
            | undefined;
          earthlyBranchOfPalace?: (name: string) => string;
          fiveElementsClass?: string;
          palaces?: {
            name?: string;
            earthlyBranch?: string;
            branch?: string;
            majorStars?: { name: string }[] | string[];
            isBodyPalace?: boolean;
          }[];
          decadal?: {
            startAge?: number;
            endAge?: number;
            name?: string;
            earthlyBranch?: string;
          }[];
        };
      };
    };
  } catch {
    return null;
  }
}

function tryLoadIztroVersion(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return String(require("iztro/package.json").version ?? "");
  } catch {
    return null;
  }
}

/** 时辰 HH:mm → iztro timeIndex 0–12（子时 0） */
function hourToIztroIndex(birthTime?: string): number {
  if (!birthTime) return 0;
  const h = Number(birthTime.split(":")[0]);
  if (Number.isNaN(h)) return 0;
  if (h === 23 || h === 0) return 0;
  return Math.floor((h + 1) / 2);
}

function snapshotFromIztro(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theirs: any,
): Omit<Snapshot, "id"> {
  const majorByBranch: Record<string, string> = {};
  const palaces = theirs.palaces ?? [];
  for (const p of palaces) {
    const branch = p.earthlyBranch ?? p.branch;
    for (const s of p.majorStars ?? []) {
      const name = typeof s === "string" ? s : s.name;
      if (name && branch) majorByBranch[name] = branch;
    }
  }

  const mingBranch =
    theirs.palace?.("命宫")?.earthlyBranch ??
    theirs.earthlyBranchOfPalace?.("命宫") ??
    palaces.find((p: { name?: string }) => p.name === "命宫")?.earthlyBranch ??
    "";

  let shenBranch = "";
  for (const p of palaces) {
    if (p.isBodyPalace) {
      shenBranch = p.earthlyBranch ?? p.branch ?? "";
      break;
    }
  }

  const daxian: Snapshot["daxian"] = [];
  // iztro v2.5.8 stores each decade on its palace as
  // `{ decadal: { range, earthlyBranch } }`, not as a root array.
  const decadals: Array<{
    startAge?: number;
    endAge?: number;
    name?: string;
    earthlyBranch?: string;
  }> = Array.isArray(theirs.decadal)
    ? theirs.decadal
    : palaces
        .filter((p: { decadal?: { range?: number[] } }) => p.decadal?.range)
        .map(
          (p: {
            name?: string;
            earthlyBranch?: string;
            decadal?: {
              range?: number[];
              earthlyBranch?: string;
            };
          }) => ({
            startAge: p.decadal?.range?.[0],
            endAge: p.decadal?.range?.[1],
            name: p.name,
            earthlyBranch: p.decadal?.earthlyBranch ?? p.earthlyBranch,
          }),
        )
        .sort(
          (
            a: { startAge?: number },
            b: { startAge?: number },
          ) =>
            (a.startAge ?? Number.MAX_SAFE_INTEGER) -
            (b.startAge ?? Number.MAX_SAFE_INTEGER),
        );
  if (Array.isArray(decadals)) {
    for (let i = 0; i < Math.min(2, decadals.length); i++) {
      const d = decadals[i];
      daxian.push({
        index: i,
        startAge: d?.startAge ?? -1,
        endAge: d?.endAge ?? -1,
        palace: d?.name ?? "",
        branch: d?.earthlyBranch,
      });
    }
  }

  return {
    mingBranch,
    shenBranch,
    wuxingJu: theirs.fiveElementsClass,
    majorByBranch,
    daxian,
  };
}

export function buildIztroDiff(
  ours: Snapshot,
  theirs: Omit<Snapshot, "id">,
): IztroDiff {
  const items: IztroDiffItem[] = [];

  if (ours.mingBranch !== theirs.mingBranch) {
    items.push({
      category: "ming",
      field: "mingBranch",
      ours: ours.mingBranch,
      theirs: theirs.mingBranch,
    });
  }
  if (theirs.shenBranch && ours.shenBranch !== theirs.shenBranch) {
    items.push({
      category: "shen",
      field: "shenBranch",
      ours: ours.shenBranch,
      theirs: theirs.shenBranch,
    });
  }
  if (
    ours.wuxingJu &&
    theirs.wuxingJu &&
    ours.wuxingJu !== theirs.wuxingJu
  ) {
    items.push({
      category: "wuxingJu",
      field: "wuxingJu",
      ours: ours.wuxingJu,
      theirs: theirs.wuxingJu,
    });
  }

  const stars = new Set([
    ...Object.keys(ours.majorByBranch),
    ...Object.keys(theirs.majorByBranch),
  ]);
  for (const star of stars) {
    const o = ours.majorByBranch[star] ?? null;
    const t = theirs.majorByBranch[star] ?? null;
    if (o !== t) {
      items.push({ category: "major", field: star, ours: o, theirs: t });
    }
  }

  for (let i = 0; i < 2; i++) {
    const o = ours.daxian[i];
    const t = theirs.daxian[i];
    if (!o || !t) continue;
    for (const field of ["startAge", "endAge", "palace", "branch"] as const) {
      if (
        o[field] !== -1 &&
        t[field] !== -1 &&
        t[field] !== "" &&
        o[field] !== t[field]
      ) {
        items.push({
          category: "daxian",
          field: `daxian[${i}].${field}`,
          ours: o[field] ?? null,
          theirs: t[field] ?? null,
        });
      }
    }
  }

  const byCategory: Record<string, number> = {};
  for (const d of items) {
    byCategory[d.category] = (byCategory[d.category] ?? 0) + 1;
  }

  return {
    match: items.length === 0,
    count: items.length,
    byCategory,
    items,
  };
}

const iztroMod = tryLoadIztro();
const iztroVersion = tryLoadIztroVersion();
const requireIztro = process.env.IZTRO_REQUIRE === "1";
const requestedCase = process.env.IZTRO_COMPARE_CASE;

describe("iztro 对照流水线（T271）", () => {
  it("自研盘可导出对照快照（无需 iztro）", () => {
    const c = ziweiGoldenCases[0]!;
    const chart = computeZiweiChart({
      ...c.input,
      analysisBaseDate: "2026-07-20",
    });
    const snap = majorSnapshot(chart);
    expect(Object.keys(snap.majorByBranch).length).toBe(14);
    expect(snap.mingBranch).toBeTruthy();
    expect(snap.daxian.length).toBe(2);
    expect(chart.meta.agePolicy).toBe("xusui");
    for (const [star, branch] of Object.entries(c.majorByBranch)) {
      expect(snap.majorByBranch[star]).toBe(branch);
    }
  });

  it("golden fixture 含来源/版本元数据", () => {
    const c = ziweiGoldenCases[0]!;
    expect(c.source).toBeTruthy();
    expect(c.engineVersionAtCapture).toBeTruthy();
    expect(c.agePolicy).toBe("xusui");
  });

  if (!iztroMod) {
    if (requireIztro) {
      it("IZTRO_REQUIRE=1：依赖缺失必须失败", () => {
        throw new Error(
          "iztro not installed but IZTRO_REQUIRE=1. Run: npm i -D iztro@2.5.8",
        );
      });
    } else {
      it.skip(
        "skip：未安装 iztro（独立 gate 请运行 node scripts/compare-iztro.mjs）",
        () => {
          // skipped
        },
      );
    }
  } else {
    it("有 iztro：全部自研 case 对照命身宫、五行局、十四主星、大限（结构化 diff）", () => {
      expect(iztroVersion).toBe(IZTRO_COMPARE_CONTRACT.dependency.version);
      const cases = requestedCase
        ? ziweiGoldenCases.filter((c) => c.id === requestedCase)
        : ziweiGoldenCases;
      if (requestedCase && cases.length === 0) {
        throw new Error(
          JSON.stringify(
            {
              schemaVersion: IZTRO_COMPARE_CONTRACT.schemaVersion,
              reason: "unknown_case",
              requestedCase,
              availableCases: ziweiGoldenCases.map((c) => c.id),
            },
            null,
            2,
          ),
        );
      }
      const diffs: Array<{ id: string; diff: IztroDiff }> = [];
      for (const c of cases) {
        const solar = c.input.solarDate!;
        const gender = c.input.gender === "male" ? "男" : "女";
        const timeIndex = hourToIztroIndex(c.input.birthTime);
        const ours = majorSnapshot(
          computeZiweiChart({
            ...c.input,
            analysisBaseDate: "2026-07-20",
          }),
        );
        const theirsRaw = iztroMod.astro.bySolar(solar, timeIndex, gender, false);
        const theirs = snapshotFromIztro(theirsRaw);
        const diff = buildIztroDiff(ours, theirs);

        // 每条 diff 都保留 category/field/ours/theirs，失败时由 gate 原样输出。
        expect(diff).toMatchObject({
          count: expect.any(Number),
          byCategory: expect.any(Object),
          items: expect.any(Array),
        });
        if (!diff.match) {
          diffs.push({ id: c.id, diff });
        }
        expect(ours.mingBranch).toBeTruthy();
        expect(Object.keys(ours.majorByBranch).length).toBe(14);
      }
      if (diffs.length > 0) {
        throw new Error(
          JSON.stringify(
            {
              schemaVersion: IZTRO_COMPARE_CONTRACT.schemaVersion,
              contract: IZTRO_COMPARE_CONTRACT,
              diffs,
            },
            null,
            2,
          ),
        );
      }
    });
  }
});
