import {
  STEM_HE,
  BRANCH_CHONG,
  BRANCH_LIUHE,
  BRANCH_SANHE,
  BRANCH_SANHUI,
  BRANCH_XING,
  BRANCH_HAI,
  HIDDEN_STEMS,
  BRANCH_WUXING,
} from "../wuxing/tables";
import type { ChartRelations, HehuaDetail } from "@/lib/types";

export type StemRelation = ChartRelations["stemHe"][number];
export type BranchRelation = ChartRelations["branchChong"][number];

type WxKey = "wood" | "fire" | "earth" | "metal" | "water";

/** 化神五行中文 → 表内英文 key */
const WX_CN_TO_KEY: Record<string, WxKey> = {
  木: "wood",
  火: "fire",
  土: "earth",
  金: "metal",
  水: "water",
};

/**
 * 合化得令/得时：月令地支所主旺气（表驱动）
 * 木旺寅卯、火旺巳午、金旺申酉、水旺亥子、土旺辰戌丑未
 */
export const HEHUA_DE_LING: Readonly<Record<string, readonly string[]>> = {
  木: ["寅", "卯"],
  火: ["巳", "午"],
  土: ["辰", "戌", "丑", "未"],
  金: ["申", "酉"],
  水: ["亥", "子"],
};

/** 化神对应天干（得地查藏干用） */
export const HEHUA_RESULT_STEMS: Readonly<Record<string, readonly string[]>> = {
  木: ["甲", "乙"],
  火: ["丙", "丁"],
  土: ["戊", "己"],
  金: ["庚", "辛"],
  水: ["壬", "癸"],
};

export type ComputeRelationsOptions = {
  /** 月支，用于得令；缺省则不得令 */
  monthBranch?: string;
  /**
   * 四柱天干顺序（年→月→日→时），用于「相邻」判定；
   * 缺省则用 stems 顺序
   */
  orderedStems?: string[];
};

/** 月令是否助化神（得令/得时） */
export function isHehuaDeLing(result: string, monthBranch?: string): boolean {
  if (!monthBranch) return false;
  const list = HEHUA_DE_LING[result];
  if (list?.includes(monthBranch)) return true;
  const key = WX_CN_TO_KEY[result];
  if (!key) return false;
  return BRANCH_WUXING[monthBranch as keyof typeof BRANCH_WUXING] === key;
}

/** 地支藏干是否见化神之根（得地） */
export function isHehuaDeDi(result: string, branches: string[]): boolean {
  const roots = HEHUA_RESULT_STEMS[result];
  if (!roots) return false;
  const rootSet = new Set(roots);
  for (const br of branches.filter(Boolean)) {
    for (const hs of HIDDEN_STEMS[br] ?? []) {
      if (rootSet.has(hs)) return true;
    }
    const key = WX_CN_TO_KEY[result];
    if (key && BRANCH_WUXING[br as keyof typeof BRANCH_WUXING] === key) {
      return true;
    }
  }
  return false;
}

/** 两干是否在相邻柱上 */
export function areStemsAdjacent(
  orderedStems: string[] | undefined,
  a: string,
  b: string,
): boolean {
  if (!orderedStems || orderedStems.length < 2) return false;
  for (let i = 0; i < orderedStems.length - 1; i++) {
    const x = orderedStems[i];
    const y = orderedStems[i + 1];
    if ((x === a && y === b) || (x === b && y === a)) return true;
  }
  return false;
}

function buildHehuaDetail(
  result: string,
  branches: string[],
  monthBranch: string | undefined,
  adjacent: boolean,
): HehuaDetail {
  const deLing = isHehuaDeLing(result, monthBranch);
  const deDi = isHehuaDeDi(result, branches);
  const transformed = deLing && deDi && adjacent;
  return {
    transformed,
    tag: transformed ? "合化" : "合绊",
    deLing,
    deDi,
    adjacent,
  };
}

function heLabel(
  a: string,
  b: string,
  result: string,
  hehua: HehuaDetail,
): string {
  return hehua.transformed ? `${a}${b}合化${result}` : `${a}${b}合绊`;
}

/** 天干五合（合见 vs 合化） */
export function findStemHe(
  stems: string[],
  branches: string[] = [],
  opts?: ComputeRelationsOptions,
): ChartRelations["stemHe"] {
  const unique = [...new Set(stems.filter(Boolean))];
  const ordered = opts?.orderedStems ?? stems;
  const out: ChartRelations["stemHe"] = [];
  for (const [a, b, result] of STEM_HE) {
    if (unique.includes(a) && unique.includes(b)) {
      const adjacent = areStemsAdjacent(ordered, a, b);
      const hehua = buildHehuaDetail(
        result,
        branches,
        opts?.monthBranch,
        adjacent,
      );
      out.push({
        kind: "he",
        a,
        b,
        result,
        hehua,
        label: heLabel(a, b, result, hehua),
      });
    }
  }
  return out;
}

/** 地支六冲 */
export function findBranchChong(branches: string[]): ChartRelations["branchChong"] {
  const unique = [...new Set(branches.filter(Boolean))];
  const out: ChartRelations["branchChong"] = [];
  for (const [a, b] of BRANCH_CHONG) {
    if (unique.includes(a) && unique.includes(b)) {
      out.push({ kind: "chong", a, b, label: `${a}${b}冲` });
    }
  }
  return out;
}

/** 地支六合（合见 vs 合化；六合无「相邻」要求，adjacent 固定 true） */
export function findBranchLiuhe(
  branches: string[],
  opts?: ComputeRelationsOptions,
): ChartRelations["branchLiuhe"] {
  const unique = [...new Set(branches.filter(Boolean))];
  const out: ChartRelations["branchLiuhe"] = [];
  for (const [a, b, result] of BRANCH_LIUHE) {
    if (unique.includes(a) && unique.includes(b)) {
      const hehua = buildHehuaDetail(
        result,
        branches,
        opts?.monthBranch,
        true,
      );
      out.push({
        kind: "liuhe",
        a,
        b,
        result,
        hehua,
        label: heLabel(a, b, result, hehua),
      });
    }
  }
  return out;
}

/** 三合 / 半合 */
export function findBranchSanhe(branches: string[]): ChartRelations["branchSanhe"] {
  const set = new Set(branches.filter(Boolean));
  const out: ChartRelations["branchSanhe"] = [];
  for (const [a, b, c, result] of BRANCH_SANHE) {
    const present = [a, b, c].filter((x) => set.has(x));
    if (present.length === 3) {
      out.push({
        kind: "sanhe",
        members: [a, b, c],
        result,
        label: `${a}${b}${c}三合${result}局`,
        partial: false,
      });
    } else if (present.length === 2) {
      out.push({
        kind: "sanhe",
        members: present as [string, string],
        result,
        label: `${present.join("")}半合${result}`,
        partial: true,
      });
    }
  }
  return out;
}

/** 三会局 */
export function findBranchSanhui(branches: string[]): ChartRelations["branchSanhui"] {
  const set = new Set(branches.filter(Boolean));
  const out: ChartRelations["branchSanhui"] = [];
  for (const [a, b, c, result] of BRANCH_SANHUI) {
    if (set.has(a) && set.has(b) && set.has(c)) {
      out.push({
        kind: "sanhui",
        members: [a, b, c],
        result,
        label: `${a}${b}${c}三会${result}局`,
      });
    }
  }
  return out;
}

/** 刑 */
export function findBranchXing(branches: string[]): ChartRelations["branchXing"] {
  const counts = new Map<string, number>();
  for (const b of branches.filter(Boolean)) {
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  const set = new Set(counts.keys());
  const out: ChartRelations["branchXing"] = [];

  for (const rule of BRANCH_XING) {
    if (rule.kind === "zixing") {
      const b = rule.members[0];
      if ((counts.get(b) ?? 0) >= 2) {
        out.push({ kind: "xing", members: [b, b], label: rule.label });
      }
      continue;
    }
    if (rule.kind === "xiangxing") {
      const [a, b] = rule.members;
      if (set.has(a) && set.has(b)) {
        out.push({ kind: "xing", members: [a, b], label: rule.label });
      }
      continue;
    }
    const present = rule.members.filter((m) => set.has(m));
    if (present.length >= 2) {
      out.push({
        kind: "xing",
        members: present,
        label:
          present.length === 3
            ? rule.label
            : `${present.join("")}刑（${rule.label}）`,
      });
    }
  }
  return out;
}

/** 害 */
export function findBranchHai(branches: string[]): ChartRelations["branchHai"] {
  const unique = [...new Set(branches.filter(Boolean))];
  const out: ChartRelations["branchHai"] = [];
  for (const [a, b] of BRANCH_HAI) {
    if (unique.includes(a) && unique.includes(b)) {
      out.push({ kind: "hai", a, b, label: `${a}${b}害` });
    }
  }
  return out;
}

export function computeRelations(
  stems: string[],
  branches: string[],
  opts?: ComputeRelationsOptions,
): ChartRelations {
  return {
    stemHe: findStemHe(stems, branches, opts),
    branchChong: findBranchChong(branches),
    branchLiuhe: findBranchLiuhe(branches, opts),
    branchSanhe: findBranchSanhe(branches),
    branchSanhui: findBranchSanhui(branches),
    branchXing: findBranchXing(branches),
    branchHai: findBranchHai(branches),
  };
}
