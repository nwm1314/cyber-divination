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

export const LIUYAO_ENGINE_VERSION = "0.5.0";

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
    ...(extra?.replaySeed != null ? { replaySeed: extra.replaySeed } : {}),
  };
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

  const meta = buildDefaultMeta(params.method, params.meta);

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
    meta,
  };
  return enrichChart(raw);
}
