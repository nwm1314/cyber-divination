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
  return next;
}
