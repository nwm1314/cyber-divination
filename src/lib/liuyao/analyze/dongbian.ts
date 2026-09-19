/**
 * 动变生克与进退/空破/冲合（表驱动 · T161 + GAP-3）
 * 中性表述，禁止恐吓断语。
 *
 * 口径见 docs/ENGINE_RULE_LIUYAO_DONGBIAN.md：
 * - 五行生克：本爻 ↔ 化爻（原有，未改动）
 * - 进退神：**仅同五行且十二支相邻位移**时判定；土支跨支保守不判
 * - 空破：化爻/本爻落旬空、被月建冲破（需占时）
 * - 冲合：本爻支 ↔ 化爻支 六冲/六合
 */

import type { LiuyaoChart, YaoPosition } from "@/lib/types/liuyao";
import { toBinary, toBianValues, isChanging } from "../cast/yao";
import { assignLiuqin, type Liuqin, type Wuxing } from "./liuqin";
import { isBranchKong } from "./kongwang";

export type WuxingRelation =
  | "比和"
  | "动生化"
  | "动克化"
  | "化生动"
  | "化克动";

/** 回头生克标签（T281）：化生动=回头生，化克动=回头克 */
export type HuitouKind = "回头生" | "回头克" | "无";

/** 进退神标签（GAP-3）：仅同五行相邻位移时判定 */
export type JintuiKind = "进神" | "退神" | "无";

/** 化爻与本爻的地支关系（GAP-3） */
export type ChongHeKind = "化冲" | "化合" | "无";

export type DongBianItem = {
  yao: YaoPosition;
  fromBranch: string;
  toBranch: string;
  fromLiuqin: Liuqin;
  fromWuxing: Wuxing;
  toLiuqin: Liuqin;
  toWuxing: Wuxing;
  relation: WuxingRelation;
  /** 回头生 / 回头克 / 无 */
  huitou: HuitouKind;
  /** 进神 / 退神 / 无 */
  jintui: JintuiKind;
  /** 化冲 / 化合 / 无 */
  chongHe: ChongHeKind;
  /** 本爻是否落旬空（无占时则 undefined，不臆断） */
  benKong?: boolean;
  /** 本爻是否被月建冲破 */
  benPo?: boolean;
  /** 化爻是否落旬空 */
  huaKong?: boolean;
  /** 化爻是否被月建冲破 */
  huaPo?: boolean;
  /** 中性一句摘要 */
  summary: string;
};

export function huitouOf(relation: WuxingRelation): HuitouKind {
  if (relation === "化生动") return "回头生";
  if (relation === "化克动") return "回头克";
  return "无";
}

const SHENG: Record<Wuxing, Wuxing> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};

const KE: Record<Wuxing, Wuxing> = {
  木: "土",
  火: "金",
  土: "水",
  金: "木",
  水: "火",
};

export function wuxingRelation(from: Wuxing, to: Wuxing): WuxingRelation {
  if (from === to) return "比和";
  if (SHENG[from] === to) return "动生化";
  if (KE[from] === to) return "动克化";
  if (SHENG[to] === from) return "化生动";
  if (KE[to] === from) return "化克动";
  // 五行环上总有生克链；兜底比和
  return "比和";
}

const DIZHI_ORDER = [
  "子",
  "丑",
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
] as const;

/**
 * 进退神判定（GAP-3）。
 *
 * 规则（docs/ENGINE_RULE_LIUYAO_DONGBIAN.md §2.2）：
 * - **仅当化爻与本爻同五行**时才判进退（异五行属生克，不叠加）
 * - 化爻地支在本爻地支**顺行相邻** → 进神（寅→卯）
 * - 化爻地支在本爻地支**逆行相邻** → 退神（卯→寅）
 * - 土支（辰戌丑未）互为同五行但跨支，流派无共识 ⇒ **保守不判**
 *
 * @param fromBranch 本爻地支
 * @param toBranch 化爻地支
 * @param fromWuxing 本爻五行
 * @param toWuxing 化爻五行
 */
export function jintuiOf(
  fromBranch: string,
  toBranch: string,
  fromWuxing: Wuxing,
  toWuxing: Wuxing,
): JintuiKind {
  // 必须先同五行：异五行是生克关系，不是进退
  if (fromWuxing !== toWuxing) return "无";
  if (fromBranch === toBranch) return "无";

  const fi = DIZHI_ORDER.indexOf(fromBranch as (typeof DIZHI_ORDER)[number]);
  const ti = DIZHI_ORDER.indexOf(toBranch as (typeof DIZHI_ORDER)[number]);
  if (fi < 0 || ti < 0) return "无";

  // 土居四维（辰戌丑未），跨支位移各流派无共识 → 保守不判
  if (fromWuxing === "土") return "无";

  const diff = (ti - fi + 12) % 12;
  if (diff === 1) return "进神";
  if (diff === 11) return "退神";
  // 同五行的非相邻位移（如寅→卯以外的木支）在十二支中不存在，
  // 兜底不判，避免臆断
  return "无";
}

/** 六冲配对（与 yingqi.ts:157-164 同表；此处不引入跨模块依赖循环） */
const CHONG_PAIRS: readonly (readonly [string, string])[] = [
  ["子", "午"],
  ["丑", "未"],
  ["寅", "申"],
  ["卯", "酉"],
  ["辰", "戌"],
  ["巳", "亥"],
];

/** 六合配对（通行：子丑、寅亥、卯戌、辰酉、巳申、午未） */
const LIUHE_PAIRS: readonly (readonly [string, string])[] = [
  ["子", "丑"],
  ["寅", "亥"],
  ["卯", "戌"],
  ["辰", "酉"],
  ["巳", "申"],
  ["午", "未"],
];

function inPairs(
  pairs: readonly (readonly [string, string])[],
  a: string,
  b: string,
): boolean {
  return pairs.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

/**
 * 化爻与本爻的地支关系（GAP-3）。
 * 同支时既非冲也非合（不构成"化冲/化合"）。
 */
export function chongHeOf(fromBranch: string, toBranch: string): ChongHeKind {
  if (!fromBranch || !toBranch || fromBranch === toBranch) return "无";
  if (inPairs(CHONG_PAIRS, fromBranch, toBranch)) return "化冲";
  if (inPairs(LIUHE_PAIRS, fromBranch, toBranch)) return "化合";
  return "无";
}

const RELATION_HINT: Record<WuxingRelation, string> = {
  比和: "动化五行同类，力量延续，宜保持既有节奏并复盘。",
  动生化: "动爻生变爻，趋势向外延伸，可分步推进并预留调整空间。",
  动克化: "动爻克变爻，转化中有阻力，宜拆解目标、避免一次到位。",
  化生动: "变爻回头生，外力或后续条件对主体有助，宜借势协作。",
  化克动: "变爻回头克，后续条件偏紧，宜控风险、加强沟通与边界。",
};

const JINTUI_HINT: Record<JintuiKind, string> = {
  进神: "同五行顺行化进，力量同向推进，宜顺势而为。",
  退神: "同五行逆行化退，力量趋向回撤，宜收敛预期、稳步退守。",
  无: "",
};

const CHONGHE_HINT: Record<ChongHeKind, string> = {
  化冲: "本爻与化爻相冲，前后状态易反复，宜留缓冲、避免硬碰。",
  化合: "本爻与化爻相合，前后状态趋合，宜借沟通与协作促成。",
  无: "",
};

function yaoLabel(yao: YaoPosition): string {
  const labels = ["", "初", "二", "三", "四", "五", "上"];
  return `${labels[yao] ?? yao}爻`;
}

/**
 * 分析各动爻「本爻 → 化爻」：五行生克 + 进退神 + 冲合 + 空破
 */
export function analyzeDongBian(chart: LiuyaoChart): DongBianItem[] {
  const values = chart.lines.map((l) => l.value);
  const benBinary = toBinary(values);
  const bianBinary = toBinary(toBianValues(values));
  const benRows = assignLiuqin(benBinary);
  const bianRows = assignLiuqin(bianBinary);

  // 占时派生的空破依据；缺占时则相关字段为 undefined（不臆断）
  const xunKong = chart.xunKong;
  const yueJian = chart.yueJian;
  const hasCastTime = Boolean(xunKong || yueJian);

  const isPo = (branch: string): boolean =>
    Boolean(yueJian) && inPairs(CHONG_PAIRS, branch, yueJian!);

  const items: DongBianItem[] = [];
  for (const line of chart.lines) {
    if (!(line.changing || isChanging(line.value))) continue;
    const from = benRows.find((r) => r.yao === line.yao);
    const to = bianRows.find((r) => r.yao === line.yao);
    if (!from || !to) continue;

    const relation = wuxingRelation(from.wuxing, to.wuxing);
    const huitou = huitouOf(relation);
    const jintui = jintuiOf(from.branch, to.branch, from.wuxing, to.wuxing);
    const chongHe = chongHeOf(from.branch, to.branch);

    const benKong = hasCastTime ? isBranchKong(from.branch, xunKong) : undefined;
    const huaKong = hasCastTime ? isBranchKong(to.branch, xunKong) : undefined;
    const benPo = hasCastTime ? isPo(from.branch) : undefined;
    const huaPo = hasCastTime ? isPo(to.branch) : undefined;

    // 标签拼接：全部为中性描述，不含吉凶断语
    const tags: string[] = [];
    if (huitou !== "无") tags.push(huitou);
    if (jintui !== "无") tags.push(jintui);
    if (chongHe !== "无") tags.push(chongHe);
    if (huaKong) tags.push("化空");
    if (huaPo) tags.push("化破");
    if (benKong) tags.push("本爻空");
    if (benPo) tags.push("本爻破");
    const tagText = tags.length ? `【${tags.join("·")}】` : "";

    const hintParts = [RELATION_HINT[relation]];
    const jtHint = JINTUI_HINT[jintui];
    if (jtHint) hintParts.push(jtHint);
    const chHint = CHONGHE_HINT[chongHe];
    if (chHint) hintParts.push(chHint);
    if (huaKong) {
      hintParts.push("化爻落旬空，后续条件暂未落实，宜先观察再定。");
    }
    if (huaPo) {
      hintParts.push("化爻被月建冲破，后续条件易受扰动，宜预留变通。");
    }

    const summary = [
      `${yaoLabel(line.yao)}动：${from.liuqin}${from.branch}${from.wuxing}`,
      `化${to.liuqin}${to.branch}${to.wuxing}（${relation}${tagText}）。`,
      hintParts.join(""),
    ].join("");

    items.push({
      yao: line.yao,
      fromBranch: from.branch,
      toBranch: to.branch,
      fromLiuqin: from.liuqin,
      fromWuxing: from.wuxing,
      toLiuqin: to.liuqin,
      toWuxing: to.wuxing,
      relation,
      huitou,
      jintui,
      chongHe,
      ...(benKong !== undefined ? { benKong } : {}),
      ...(benPo !== undefined ? { benPo } : {}),
      ...(huaKong !== undefined ? { huaKong } : {}),
      ...(huaPo !== undefined ? { huaPo } : {}),
      summary,
    });
  }
  return items.sort((a, b) => a.yao - b.yao);
}

/** 静卦时的中性说明 */
export function staticDongBianHint(): string {
  return "本卦无动爻，暂无动变生克；宜守中、按步骤推进，情况有变可另起一卦。";
}

export function dongBianSectionBody(chart: LiuyaoChart): string {
  const items = analyzeDongBian(chart);
  if (items.length === 0) return staticDongBianHint();
  return [
    `动变生克（学习向简表，共 ${items.length} 处动爻）：`,
    ...items.map((it) => it.summary),
    "生克、进退、冲合、空破仅描述结构与五行关系倾向，不作吉凶恐吓，不替代现实决策。",
  ].join("\n");
}


