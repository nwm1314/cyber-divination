import type {
  LiuyaoChart,
  LiuyaoChartMeta,
  LiuyaoMethod,
  LiuyaoQuestionCategory,
  YaoValue,
} from "@/lib/types/liuyao";
import type { UserId } from "@/lib/types/user";
import {
  isChanging,
  toBianValues,
  toBinary,
  toLines,
} from "./yao";
import { resolveGuaRef } from "./resolve-gua";
import { enrichChart } from "../analyze";
import {
  castingSchoolOf,
  DEFAULT_CAST_TIMEZONE,
  methodNoteOf,
} from "./method";
import { LIUYAO_DATA_SOURCES } from "../data/sources";
import { computeInputFingerprint } from "@/lib/engine-envelope/fingerprint";

export const LIUYAO_ENGINE_VERSION = "0.6.0";

/**
 * 数据结构版本（统一引擎信封 · GAP-4）
 *
 * 1.1.0（GAP-3）：DongBianItem 增加 jintui/chongHe/空破 字段。
 */
export const LIUYAO_SCHEMA_VERSION = "liuyao-schema-1.1.0";

export type BuildChartParams = {
  question: string;
  method: LiuyaoMethod;
  values: readonly YaoValue[];
  userId?: UserId | null;
  id?: string;
  /** 占时：用于日辰/月建/空亡/应期（T180） */
  castAt?: string;
  /** T280 meta 片段 */
  meta?: Partial<LiuyaoChartMeta>;
  /** T281 问事类别 / 用神确认 */
  questionCategory?: LiuyaoQuestionCategory;
  yongShenConfirm?: string;
};

function newId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `ly_${t}_${r}`;
}

/** 组装默认 meta（可被 params.meta 覆盖非强制字段） */
export function buildDefaultMeta(
  method: LiuyaoMethod,
  extra?: Partial<LiuyaoChartMeta>,
): LiuyaoChartMeta {
  return {
    engineVersion: LIUYAO_ENGINE_VERSION,
    castingSchool: castingSchoolOf(method),
    randomSource: extra?.randomSource ?? "none",
    timezone: extra?.timezone ?? DEFAULT_CAST_TIMEZONE,
    methodNote: methodNoteOf(method),
    dataVersion: LIUYAO_DATA_SOURCES.dataVersion,
    // 统一引擎信封（GAP-4）：与八字/紫微对齐，
    // 使 TrustPanel 能拿到版本与规则集信息。
    schemaVersion: LIUYAO_SCHEMA_VERSION,
    ruleSetVersion: LIUYAO_DATA_SOURCES.ruleSetVersion,
    ...(extra?.replaySeed != null ? { replaySeed: extra.replaySeed } : {}),
    ...(extra?.inputFingerprint
      ? { inputFingerprint: extra.inputFingerprint }
      : {}),
  };
}

/**
 * 方法来源边界警告（GAP-4）
 *
 * 时间起卦是**混合方法**：梅花易数先天数定上下卦与动爻，再进入京房纳甲
 * 六爻分析。两者本非同一体系，混用必须对用户明示，否则会让用户
 * 误以为得到的是单一流派的结论。
 */
export function buildCastingWarnings(
  method: LiuyaoMethod,
  opts: { castAt?: string; shichenUnknown?: boolean } = {},
): string[] {
  const warnings: string[] = [];

  if (method === "time") {
    warnings.push(
      "本卦采用梅花易数先天数起卦，再入纳甲六爻分析，属混合方法（非单一师承）；结论宜作参考而非定论。",
    );
  }
  if (method === "manual") {
    warnings.push(
      "六爻由手工指定，未经过随机起卦过程；请自行确认输入是否与所求之事对应。",
    );
  }
  if (method === "coins") {
    warnings.push(
      "铜钱起卦依赖随机数；请以起卦当时的诚心与所问事项为准，同一问题不宜反复重起。",
    );
  }

  if (!opts.castAt) {
    warnings.push(
      "缺占时：无法计算日辰、月建、旬空与月破，应期提示与旺衰判断不完整。",
    );
  }

  return warnings;
}

/** 由六爻值组装 LiuyaoChart（含世应/用神，T112 + T280/T281） */
export function buildChart(params: BuildChartParams): LiuyaoChart {
  const lines = toLines(params.values);
  const benGua = resolveGuaRef(toBinary(params.values));

  const hasChanging = params.values.some(isChanging);
  let bianGua: LiuyaoChart["bianGua"];
  if (hasChanging) {
    bianGua = resolveGuaRef(toBinary(toBianValues(params.values)));
  }

  // 输入指纹（GAP-5）：只哈希输入——所问事项、起卦方法、六个爻值、占时、
  // 问事类别与用神确认。爻值数组保序（爻位顺序是语义）。
  const inputFingerprint = computeInputFingerprint("liuyao", {
    question: params.question,
    method: params.method,
    values: [...params.values],
    castAt: params.castAt ?? null,
    questionCategory: params.questionCategory ?? null,
    yongShenConfirm: params.yongShenConfirm ?? null,
  });

  const meta = buildDefaultMeta(params.method, {
    ...params.meta,
    inputFingerprint,
  });
  const warnings = buildCastingWarnings(params.method, {
    castAt: params.castAt,
  });

  const raw: LiuyaoChart = {
    id: params.id ?? newId(),
    userId: params.userId ?? null,
    question: params.question,
    method: params.method,
    lines,
    benGua,
    ...(bianGua ? { bianGua } : {}),
    ...(params.castAt ? { castAt: params.castAt } : {}),
    ...(params.questionCategory
      ? { questionCategory: params.questionCategory }
      : {}),
    ...(params.yongShenConfirm
      ? { yongShenConfirm: params.yongShenConfirm }
      : {}),
    shiYao: 0,
    yingYao: 0,
    warnings,
    meta,
  };
  return enrichChart(raw);
}
