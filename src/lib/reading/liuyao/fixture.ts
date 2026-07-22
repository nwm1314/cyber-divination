import type { LiuyaoChart } from "@/lib/types";
import { castLiuyao } from "@/lib/liuyao/cast";

/**
 * T112 analyze 未就绪时的可读 fixture 盘（仅测模板/LLM 回落）
 * 默认：乾为天，初爻老阳动 → 变天风姤（表中名「天风」）
 */
export function createLiuyaoFixtureChart(
  overrides?: Partial<LiuyaoChart>,
): LiuyaoChart {
  const base = castLiuyao({
    question: "近期工作推进是否顺畅？",
    method: "manual",
    lines: [9, 7, 7, 7, 7, 7],
    id: "ly_fixture_t114",
  });
  return { ...base, ...overrides };
}
