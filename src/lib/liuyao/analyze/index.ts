/**
 * 六爻解卦结构化（T112 + T153 + T171 + T180 + W26 T281）
 * 本卦/变卦校验、世应、动爻、六亲、用神、六神、伏神、月破日冲、应期
 */

import type {
  LiushenName,
  LiuyaoChart,
  LiuyaoQuestionCategory,
  YaoPosition,
} from "@/lib/types/liuyao";
import type { RuleEvidence } from "@/lib/types";
import { toBinary, toBianValues, isChanging } from "../cast/yao";
import { resolveGuaRef } from "../cast/resolve-gua";
import type { YaoValue } from "@/lib/types/liuyao";
import { shiYingFromBinary } from "./shi-ying";
import {
  resolveYongShenDetail,
  type YongShenResolved,
} from "./yongshen";
import {
  resolveYongShenStatus,
  type YongShenStatus,
} from "./yongshen-status";
import { assignLiuqin, type YaoLiuqin } from "./liuqin";
import {
  resolveCastTimeContext,
  resolveYingQi,
  type CastTimeContext,
} from "./yingqi";
import { assignLiushen } from "./liushen";
import { resolveFushen } from "./fushen";
import { resolveBranchFlags } from "./yuepo";
import type { Liuqin } from "./liuqin";
export {
  LIUYAO_RULE_SCOPE_NOTE,
  LIUYAO_UNSUPPORTED_RULES,
} from "./scope";

export {
  PALACE_ROOTS,
  PALACE_BY_BINARY,
  SHI_BY_PALACE_POS,
  getPalaceMember,
  buildPalaceMembers,
  type Binary6,
  type PalaceMember,
} from "./palaces";
export { shiYingFromBinary, yingFromShi, type ShiYing } from "./shi-ying";
export {
  YONGSHEN_RULES,
  DEFAULT_YONGSHEN,
  CATEGORY_YONGSHEN,
  CATEGORY_LABEL,
  resolveYongShen,
  resolveYongShenKind,
  resolveYongShenDetail,
  inferQuestionCategory,
  type YongShenRule,
  type YongShenResolved,
  type YongShenKind,
  type ResolveYongShenContext,
} from "./yongshen";
export {
  assignLiuqin,
  liuqinNames,
  pickLiuqinYao,
  liuqinFromWuxing,
  PALACE_WUXING,
  TRIGRAM_NAJIA,
  DIZHI_WUXING,
  type Liuqin,
  type YaoLiuqin,
  type Wuxing,
  type Dizhi,
} from "./liuqin";
export {
  analyzeDongBian,
  dongBianSectionBody,
  wuxingRelation,
  staticDongBianHint,
  huitouOf,
  type DongBianItem,
  type WuxingRelation,
  type HuitouKind,
} from "./dongbian";
export {
  resolveYongShenStatus,
  type YongShenStatus,
  type YongShenStatusDetail,
} from "./yongshen-status";
export type { YongShenGender } from "./yongshen";
export {
  xunKongOfDay,
  xunShouOfDay,
  isBranchKong,
  XUNKONG_BY_XUN_SHOU,
} from "./kongwang";
export {
  resolveCastTimeContext,
  resolveYingQi,
  parseCastAt,
  isBranchChong,
  type CastTimeContext,
  type YingQiResult,
} from "./yingqi";
export {
  assignLiushen,
  assignLiushenRows,
  LIUSHEN_ORDER,
  STEM_LIUSHEN_START,
  type YaoLiushen,
  type DayStem,
} from "./liushen";
export {
  resolveFushen,
  attachFushenToRows,
  type FushenItem,
} from "./fushen";
export {
  branchYuePo,
  branchRiChong,
  resolveBranchFlags,
  type BranchFlags,
} from "./yuepo";

export type LiuyaoAnalysis = {
  shiYao: YaoPosition;
  yingYao: YaoPosition;
  /** 动爻位（自下而上 1–6），升序 */
  dongYao: YaoPosition[];
  yongShen: string;
  /** 用神落爻 */
  yongShenYao: YaoPosition;
  /** 用神是否回落世 */
  yongShenFallbackShi: boolean;
  /** 用神静/动/化（T171；依赖本变卦） */
  yongShenStatus: YongShenStatus;
  /** 用神状态中性摘要 */
  yongShenStatusSummary: string;
  palace: string;
  palacePos: number;
  /** 本卦六亲（自下而上） */
  liuqin: YaoLiuqin[];
  /** T180 */
  castCtx?: CastTimeContext | null;
  yongShenKong?: boolean;
  yingQiHint?: string;
  /** T281 */
  questionCategory?: LiuyaoQuestionCategory;
  fushenCount?: number;
};

function valuesFromLines(chart: LiuyaoChart): YaoValue[] {
  return chart.lines.map((l) => l.value);
}

/** 动爻位列表 */
export function listDongYao(chart: LiuyaoChart): YaoPosition[] {
  return chart.lines
    .filter((l) => l.changing || isChanging(l.value))
    .map((l) => l.yao)
    .sort((a, b) => a - b);
}

/**
 * 校验/补全本卦变卦（与 lines 一致）
 * 无动爻则无变卦
 */
export function ensureBenBian(chart: LiuyaoChart): Pick<
  LiuyaoChart,
  "benGua" | "bianGua"
> {
  const values = valuesFromLines(chart);
  const benGua = resolveGuaRef(toBinary(values));
  const hasChanging = values.some(isChanging);
  if (!hasChanging) {
    return { benGua };
  }
  const bianGua = resolveGuaRef(toBinary(toBianValues(values)));
  return { benGua, bianGua };
}

/** 从盘推算世应/动爻/六亲/用神/应期（不写盘） */
export function analyzeLiuyao(chart: LiuyaoChart): LiuyaoAnalysis {
  const values = valuesFromLines(chart);
  const binary = toBinary(values);
  const sy = shiYingFromBinary(binary);
  const dongYao = listDongYao(chart);
  const liuqin = assignLiuqin(binary);
  const { bianGua } = ensureBenBian(chart);
  const ys: YongShenResolved = resolveYongShenDetail(chart.question, {
    binary,
    shiYao: sy.shiYao,
    dongYao,
    liuqinRows: liuqin,
    questionCategory: chart.questionCategory,
    yongShenConfirm: chart.yongShenConfirm,
  });
  const st = resolveYongShenStatus(
    { lines: chart.lines, bianGua: bianGua ?? chart.bianGua },
    ys.yao,
  );
  let castCtx: CastTimeContext | null = null;
  if (chart.castAt?.trim()) {
    try {
      castCtx = resolveCastTimeContext(chart.castAt.trim());
    } catch {
      castCtx = null;
    }
  }
  // 应期对照需带 branch 的 lines
  const linesForYing = chart.lines.map((line) => {
    const row = liuqin.find((r) => r.yao === line.yao);
    if (!row) return line;
    return {
      ...line,
      liuqin: row.liuqin,
      branch: row.branch,
      wuxing: row.wuxing,
    };
  });
  const yq = resolveYingQi(
    {
      lines: linesForYing,
      yongShenYao: ys.yao,
      yongShen: ys.yongShen,
      castAt: chart.castAt,
    },
    castCtx,
  );

  const targetFu =
    ys.yongShen !== "世" && ys.fallbackShi
      ? (ys.yongShen as Liuqin)
      : undefined;
  const fushen = resolveFushen(binary, targetFu);

  return {
    shiYao: sy.shiYao,
    yingYao: sy.yingYao,
    dongYao,
    yongShen: ys.yongShen,
    yongShenYao: ys.yao,
    yongShenFallbackShi: ys.fallbackShi,
    yongShenStatus: st.status,
    yongShenStatusSummary: st.summary,
    palace: sy.palace,
    palacePos: sy.palacePos,
    liuqin,
    castCtx,
    yongShenKong: yq.yongShenKong,
    yingQiHint: yq.yingQiHint,
    questionCategory: ys.category ?? chart.questionCategory,
    fushenCount: fushen.length,
  };
}

/**
 * 填充 chart 的世应/用神/六亲/六神/月破日冲/伏神，并校验本变卦
 * 返回新对象（不 mutate）
 */
export function enrichChart(chart: LiuyaoChart): LiuyaoChart {
  const { benGua, bianGua } = ensureBenBian(chart);
  const a = analyzeLiuyao({
    ...chart,
    benGua,
    ...(bianGua ? { bianGua } : {}),
  });
  const values = valuesFromLines(chart);
  const binary = toBinary(values);

  const targetFu =
    a.yongShen !== "世" && a.yongShenFallbackShi
      ? (a.yongShen as Liuqin)
      : undefined;
  // 仅用神六亲不现时挂伏神，避免静盘堆满飞伏
  const fushenItems = targetFu ? resolveFushen(binary, targetFu) : [];
  const fushenByYao = new Map(fushenItems.map((f) => [f.yao, f]));

  let liushenList: string[] | null = null;
  if (a.castCtx?.dayStem) {
    try {
      liushenList = assignLiushen(a.castCtx.dayStem);
    } catch {
      liushenList = null;
    }
  }

  const lines = chart.lines.map((line, idx) => {
    const row = a.liuqin.find((r) => r.yao === line.yao);
    if (!row) return line;
    const flags = resolveBranchFlags(row.branch, a.castCtx);
    const fu = fushenByYao.get(line.yao);
    return {
      ...line,
      liuqin: row.liuqin,
      branch: row.branch,
      wuxing: row.wuxing,
      ...(liushenList
        ? { liushen: liushenList[idx] as LiushenName }
        : {}),
      ...(fu
        ? { fushen: fu.fuLiuqin, fushenBranch: fu.fuBranch }
        : {}),
      ...(a.castCtx
        ? { yuePo: flags.yuePo, riChong: flags.riChong }
        : {}),
    };
  });

  const st = resolveYongShenStatus(
    { lines, bianGua },
    a.yongShenYao,
  );
  const next: LiuyaoChart = {
    ...chart,
    lines,
    benGua,
    shiYao: a.shiYao,
    yingYao: a.yingYao,
    yongShen: a.yongShen,
    yongShenYao: a.yongShenYao,
    yongShenStatus: st.status,
    yingQiHint: a.yingQiHint,
    yongShenKong: a.yongShenKong,
  };
  if (a.questionCategory) {
    next.questionCategory = a.questionCategory;
  }
  if (a.castCtx) {
    next.castAt = a.castCtx.castAt;
    next.dayGanZhi = a.castCtx.dayGanZhi;
    next.yueJian = a.castCtx.yueJian;
    next.xunKong = [a.castCtx.xunKong[0], a.castCtx.xunKong[1]];
  }
  if (bianGua) {
    next.bianGua = bianGua;
  } else {
    delete next.bianGua;
  }
  next.evidence = buildLiuyaoEvidence(next, a);
  return next;
}

/**
 * 六爻规则证据链（GAP-4）
 *
 * 与八字/紫微对齐，使 TrustPanel 能在六爻页面展示「这条结论由哪条规则得出、
 * 来源是什么」。只描述**已实际应用**的规则，不虚构未实现的规则
 * （未覆盖项见 analyze/scope.ts 的 LIUYAO_UNSUPPORTED_RULES）。
 */
function buildLiuyaoEvidence(
  chart: LiuyaoChart,
  a: LiuyaoAnalysis,
): RuleEvidence[] {
  const items: RuleEvidence[] = [];

  // 世应定位
  items.push({
    ruleId: "liuyao.shi_ying.v1",
    source: "京房八宫世应表（analyze/palaces.ts + shi-ying.ts）",
    conclusion: `世爻在第 ${chart.shiYao} 爻，应爻在第 ${chart.yingYao} 爻`,
    confidence: 1,
    condition: "按本卦所属八宫与卦位定世应",
  });

  // 六亲（京房纳甲）
  if (chart.lines.some((l) => l.liuqin)) {
    items.push({
      ruleId: "liuyao.liuqin.najia.v1",
      source:
        "京房纳甲六亲：内外卦纳支 → 爻支五行，与宫五行生克定六亲（analyze/liuqin.ts）",
      conclusion: "六亲按京房纳甲由爻支五行与宫五行生克定出",
      confidence: 1,
    });
  }

  // 六神（需日干）
  if (a.castCtx?.dayStem && chart.lines.some((l) => l.liushen)) {
    items.push({
      ruleId: "liuyao.liushen.v1",
      source: "按日干起六神：甲乙起青龙…壬癸起玄武，初爻顺排（analyze/liushen.ts）",
      conclusion: `六神依日干「${a.castCtx.dayStem}」自初爻起顺排`,
      confidence: 1,
      condition: "需已知占时以确定日干",
    });
  }

  // 用神
  if (chart.yongShen) {
    items.push({
      ruleId: "liuyao.yongshen.v1",
      source: "问事关键词 + 类别映射表（analyze/yongshen.ts / yongshen-category.ts）",
      conclusion: `用神取「${chart.yongShen}」，落第 ${chart.yongShenYao ?? "-"} 爻`,
      confidence: a.yongShenFallbackShi ? 0.5 : 0.8,
      condition: a.yongShenFallbackShi
        ? "关键词未命中六亲，回落世爻（置信降低）"
        : a.questionCategory
          ? `问事类别 ${a.questionCategory}`
          : "关键词命中",
    });
  }

  // 旬空 / 月建 / 日辰（需占时）
  if (a.castCtx) {
    items.push({
      ruleId: "liuyao.kongwang.v1",
      source: "日辰六十甲子旬空表（analyze/kongwang.ts）",
      conclusion: `日辰 ${a.castCtx.dayGanZhi}，旬空 ${a.castCtx.xunKong[0]}${a.castCtx.xunKong[1]}`,
      confidence: 1,
      condition: "需已知占时",
    });
    items.push({
      ruleId: "liuyao.yuejian.v1",
      source: "占时所属节气月建（analyze/yingqi.ts）",
      conclusion: `月建为 ${a.castCtx.yueJian}`,
      confidence: 1,
    });
  }

  // 月破 / 日冲
  if (chart.lines.some((l) => l.yuePo || l.riChong)) {
    const yuePo = chart.lines.filter((l) => l.yuePo).map((l) => l.yao);
    const riChong = chart.lines.filter((l) => l.riChong).map((l) => l.yao);
    const parts: string[] = [];
    if (yuePo.length) parts.push(`第 ${yuePo.join("、")} 爻月破`);
    if (riChong.length) parts.push(`第 ${riChong.join("、")} 爻日冲`);
    items.push({
      ruleId: "liuyao.yuepo.v1",
      source: "爻支冲月建为月破、冲日支为日冲（analyze/yuepo.ts）",
      conclusion: parts.join("；"),
      confidence: 1,
      condition: "需已知占时",
    });
  }

  // 伏神
  if (chart.lines.some((l) => l.fushen)) {
    items.push({
      ruleId: "liuyao.fushen.v1",
      source: "用神六亲不现时求本宫首卦同位取伏神（analyze/fushen.ts）",
      conclusion: "用神六亲不现于本卦，按本宫首卦同位挂伏神",
      confidence: 0.8,
    });
  }

  // 动变
  const changing = chart.lines.filter((l) => isChanging(l.value)).length;
  if (changing > 0) {
    items.push({
      ruleId: "liuyao.dongbian.v1",
      source:
        "动爻与变爻五行生克（analyze/dongbian.ts）；进退神/反伏吟未覆盖，见 analyze/scope.ts",
      conclusion: `本卦有 ${changing} 个动爻，化出${chart.bianGua?.name ?? "变卦"}`,
      confidence: 0.8,
      condition: "仅五行层回头生克；不含进退神、空破冲合转换",
    });
  }

  return items;
}
