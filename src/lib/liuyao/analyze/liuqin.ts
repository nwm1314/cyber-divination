/**
 * 本卦六亲安爻（T153 第一切片）
 *
 * 规则（学习向·表驱动 v1）：
 * 1. 内外卦纳甲地支（京房纳甲通行表）→ 爻支五行
 * 2. 本卦所属八宫五行 = 「我」（兄弟参照）
 * 3. 六亲由「我」与爻支五行生克定：
 *    同我→兄弟；我生→子孙；生我→父母；我克→妻财；克我→官鬼
 *
 * 来源锚点：
 * - 京房纳甲 / 八宫：与 palaces.ts 一致
 * - 六亲生克：通行六爻（增删卜易类教材整理，非某一孤本逐字）
 * - 调研备忘：docs/research/liuyao-sources.md §2.2 / §4 P0
 */

import type { TrigramName, YaoPosition } from "@/lib/types/liuyao";
import { getPalaceMember, type Binary6 } from "./palaces";
import { TRIGRAM_BY_BINARY } from "../data/trigrams";

/** 六亲名（与用神规则表一致） */
export type Liuqin =
  | "父母"
  | "兄弟"
  | "子孙"
  | "妻财"
  | "官鬼";

export type Wuxing = "木" | "火" | "土" | "金" | "水";

export type Dizhi =
  | "子"
  | "丑"
  | "寅"
  | "卯"
  | "辰"
  | "巳"
  | "午"
  | "未"
  | "申"
  | "酉"
  | "戌"
  | "亥";

/** 八宫本气（宫五行 = 兄弟） */
export const PALACE_WUXING: Readonly<Record<TrigramName, Wuxing>> = {
  乾: "金",
  兑: "金",
  离: "火",
  震: "木",
  巽: "木",
  坎: "水",
  艮: "土",
  坤: "土",
} as const;

/**
 * 经卦纳甲：内卦（初二三）/ 外卦（四五上）三支
 * 顺序自下而上
 */
export const TRIGRAM_NAJIA: Readonly<
  Record<TrigramName, { inner: readonly [Dizhi, Dizhi, Dizhi]; outer: readonly [Dizhi, Dizhi, Dizhi] }>
> = {
  乾: { inner: ["子", "寅", "辰"], outer: ["午", "申", "戌"] },
  坤: { inner: ["未", "巳", "卯"], outer: ["丑", "亥", "酉"] },
  震: { inner: ["子", "寅", "辰"], outer: ["午", "申", "戌"] },
  巽: { inner: ["丑", "亥", "酉"], outer: ["未", "巳", "卯"] },
  坎: { inner: ["寅", "辰", "午"], outer: ["申", "戌", "子"] },
  离: { inner: ["卯", "丑", "亥"], outer: ["酉", "未", "巳"] },
  艮: { inner: ["辰", "午", "申"], outer: ["戌", "子", "寅"] },
  兑: { inner: ["巳", "卯", "丑"], outer: ["亥", "酉", "未"] },
} as const;

export const DIZHI_WUXING: Readonly<Record<Dizhi, Wuxing>> = {
  子: "水",
  丑: "土",
  寅: "木",
  卯: "木",
  辰: "土",
  巳: "火",
  午: "火",
  未: "土",
  申: "金",
  酉: "金",
  戌: "土",
  亥: "水",
} as const;

/** 我生 */
const SHENG: Readonly<Record<Wuxing, Wuxing>> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};

/** 我克 */
const KE: Readonly<Record<Wuxing, Wuxing>> = {
  木: "土",
  火: "金",
  土: "水",
  金: "木",
  水: "火",
};

/** 由宫五行与爻支五行定六亲 */
export function liuqinFromWuxing(palaceWx: Wuxing, lineWx: Wuxing): Liuqin {
  if (palaceWx === lineWx) return "兄弟";
  if (SHENG[palaceWx] === lineWx) return "子孙";
  if (SHENG[lineWx] === palaceWx) return "父母";
  if (KE[palaceWx] === lineWx) return "妻财";
  if (KE[lineWx] === palaceWx) return "官鬼";
  // 五行完备下不应到达
  return "兄弟";
}

export type YaoLiuqin = {
  yao: YaoPosition;
  branch: Dizhi;
  wuxing: Wuxing;
  liuqin: Liuqin;
};

function trigramFromBits(
  b0: 0 | 1,
  b1: 0 | 1,
  b2: 0 | 1,
): TrigramName {
  const t = TRIGRAM_BY_BINARY[`${b0}${b1}${b2}`];
  if (!t) {
    throw new Error(`无法识别经卦 binary=${b0}${b1}${b2}`);
  }
  return t.name;
}

/**
 * 为本卦六爻装六亲（纳甲 + 八宫五行）
 * binary：自下而上 1=阳 0=阴
 */
export function assignLiuqin(binary: Binary6 | string): YaoLiuqin[] {
  const bits: Binary6 =
    typeof binary === "string"
      ? ([
          Number(binary[0]) as 0 | 1,
          Number(binary[1]) as 0 | 1,
          Number(binary[2]) as 0 | 1,
          Number(binary[3]) as 0 | 1,
          Number(binary[4]) as 0 | 1,
          Number(binary[5]) as 0 | 1,
        ] as Binary6)
      : binary;

  const member = getPalaceMember(bits);
  if (!member) {
    throw new Error(
      `无法归属八宫 binary=${typeof binary === "string" ? binary : binary.join("")}`,
    );
  }

  const palaceWx = PALACE_WUXING[member.palace];
  const lower = trigramFromBits(bits[0]!, bits[1]!, bits[2]!);
  const upper = trigramFromBits(bits[3]!, bits[4]!, bits[5]!);
  const inner = TRIGRAM_NAJIA[lower].inner;
  const outer = TRIGRAM_NAJIA[upper].outer;
  const branches: readonly Dizhi[] = [
    inner[0],
    inner[1],
    inner[2],
    outer[0],
    outer[1],
    outer[2],
  ];

  return branches.map((branch, i) => {
    const wuxing = DIZHI_WUXING[branch];
    return {
      yao: (i + 1) as YaoPosition,
      branch,
      wuxing,
      liuqin: liuqinFromWuxing(palaceWx, wuxing),
    };
  });
}

/** 仅六亲名数组（下标 0=初爻） */
export function liuqinNames(binary: Binary6 | string): Liuqin[] {
  return assignLiuqin(binary).map((x) => x.liuqin);
}

/**
 * 在装好六亲的爻中选取用神爻位
 * - 优先动爻中的用神
 * - 其次自下而上第一现
 * - 无现则 undefined（调用方回落世）
 */
export function pickLiuqinYao(
  rows: readonly YaoLiuqin[],
  target: Liuqin,
  changingYaos?: ReadonlySet<YaoPosition> | readonly YaoPosition[],
): YaoPosition | undefined {
  const matches = rows.filter((r) => r.liuqin === target);
  if (matches.length === 0) return undefined;

  const chSet =
    changingYaos == null
      ? null
      : changingYaos instanceof Set
        ? changingYaos
        : new Set(changingYaos);

  if (chSet && chSet.size > 0) {
    const moving = matches.find((r) => chSet.has(r.yao));
    if (moving) return moving.yao;
  }
  return matches[0]!.yao;
}
