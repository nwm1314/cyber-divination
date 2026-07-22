/**
 * 六爻装卦引擎（T111 + T280）
 * 铜钱 / 时间 / 手动 → LiuyaoChart；确定性、零 LLM。
 * 时间法 = 梅花先天数 → 纳甲分析（castingSchool: meihua-time-to-najia）。
 */

import type {
  LiuyaoChart,
  LiuyaoChartMeta,
  LiuyaoMethod,
  LiuyaoQuestionCategory,
  YaoValue,
} from "@/lib/types/liuyao";
import type { UserId } from "@/lib/types/user";
import { buildChart } from "./build";
import { castCoinsLines, freshCoinSeed } from "./coins";
import {
  castTimeLines,
  parseDateTime,
  type TimeCastParts,
} from "./time";
import { assertYaoValue } from "./yao";
import {
  DEFAULT_CAST_TIMEZONE,
  randomSourceOf,
} from "./method";

export { LIUYAO_ENGINE_VERSION, buildDefaultMeta } from "./build";
export { createSeededRng, hashSeed } from "./rng";
export { castCoinsLines, castOneYao, freshCoinSeed } from "./coins";
export {
  castTimeLines,
  parseDateTime,
  hourToShichen,
  yearBranchNum,
} from "./time";
export type { TimeCastParts } from "./time";
export {
  isChanging,
  yaoToBit,
  changeYao,
  toLines,
  toBinary,
  toBianValues,
  assertYaoValue,
} from "./yao";
export { resolveGuaRef, setHexagramLookup } from "./resolve-gua";
export { buildChart } from "./build";
export {
  CASTING_SCHOOL_BY_METHOD,
  METHOD_NOTE,
  SCHOOL_LABEL,
  castingSchoolOf,
  methodNoteOf,
  randomSourceOf,
  DEFAULT_CAST_TIMEZONE,
} from "./method";

export type CastLiuyaoInput = {
  question: string;
  method: LiuyaoMethod;
  userId?: UserId | null;
  /** 可指定盘 id（测试用） */
  id?: string;
  /**
   * 铜钱法种子；缺省则 freshCoinSeed()。
   * 相同 seed → 相同六爻。
   */
  seed?: string | number;
  /** 时间法：ISO 或 YYYY-MM-DD[THH:mm] */
  datetime?: string;
  /** 时间法：拆分字段（优先于 datetime 中的对应部分时可整包传入） */
  time?: TimeCastParts;
  /** 手动：自下而上 6 个爻值 6|7|8|9 */
  lines?: readonly YaoValue[] | readonly number[];
  /**
   * 占时（T180）：日辰/月建/空亡/应期用
   * 时间法若未单独传，可用 datetime 兼作 castAt
   */
  castAt?: string;
  /** IANA 时区；默认 Asia/Shanghai */
  timezone?: string;
  /** 问事类别（T281） */
  questionCategory?: LiuyaoQuestionCategory;
  /** 用户确认用神 */
  yongShenConfirm?: string;
};

function resolveValues(input: CastLiuyaoInput): {
  values: YaoValue[];
  replaySeed?: string | number;
  seedProvided: boolean;
} {
  switch (input.method) {
    case "manual": {
      if (!input.lines || input.lines.length !== 6) {
        throw new Error("手动起卦需提供 lines 长度 6");
      }
      return {
        values: input.lines.map((v) => assertYaoValue(Number(v))),
        seedProvided: false,
      };
    }
    case "coins": {
      const seedProvided = input.seed != null && input.seed !== "";
      const seed = seedProvided ? input.seed! : freshCoinSeed();
      return {
        values: castCoinsLines(seed),
        replaySeed: seed,
        seedProvided,
      };
    }
    case "time": {
      const parts: TimeCastParts =
        input.time ??
        (input.datetime
          ? parseDateTime(input.datetime)
          : (() => {
              throw new Error("时间起卦需提供 datetime 或 time");
            })());
      return { values: castTimeLines(parts), seedProvided: false };
    }
    default: {
      const m: never = input.method;
      throw new Error(`未知起卦方式: ${String(m)}`);
    }
  }
}

/** 装卦主入口 */
export function castLiuyao(input: CastLiuyaoInput): LiuyaoChart {
  if (!input.question?.trim()) {
    throw new Error("所问事项 question 不能为空");
  }
  const { values, replaySeed, seedProvided } = resolveValues(input);
  const castAt =
    input.castAt?.trim() ||
    (input.method === "time"
      ? input.datetime?.trim() ||
        (input.time
          ? `${input.time.year}-${String(input.time.month).padStart(2, "0")}-${String(input.time.day).padStart(2, "0")}T${String(input.time.hour).padStart(2, "0")}:00`
          : undefined)
      : undefined);

  const meta: Partial<LiuyaoChartMeta> = {
    randomSource: randomSourceOf(input.method, { seedProvided }),
    timezone: input.timezone?.trim() || DEFAULT_CAST_TIMEZONE,
    ...(replaySeed != null ? { replaySeed } : {}),
  };

  return buildChart({
    question: input.question.trim(),
    method: input.method,
    values,
    userId: input.userId,
    id: input.id,
    castAt,
    meta,
    questionCategory: input.questionCategory,
    yongShenConfirm: input.yongShenConfirm,
  });
}
