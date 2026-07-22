/**
 * 用神状态：静 / 动 / 化（T171）
 * 中性描述，禁止恐吓。
 */

import type { LiuyaoChart, YaoPosition } from "@/lib/types/liuyao";
import { isChanging } from "../cast/yao";

export type YongShenStatus = "静" | "动" | "化";

export type YongShenStatusDetail = {
  status: YongShenStatus;
  /** 中性一句 */
  summary: string;
};

/**
 * 用神落爻状态：
 * - 静：该爻不动
 * - 动：该爻动且未强调化出六亲变化
 * - 化：该爻动（化出另论；本切片动即标「动」，多动变且有变卦时可用「化」）
 *
 * 简化：动爻 → 有变卦标「化」，否则「动」；静 →「静」
 */
export function resolveYongShenStatus(
  chart: Pick<LiuyaoChart, "lines" | "bianGua">,
  yongShenYao: YaoPosition | number | undefined,
): YongShenStatusDetail {
  const yao = yongShenYao;
  if (yao == null || yao < 1 || yao > 6) {
    return {
      status: "静",
      summary: "用神爻位未定，状态暂按静爻理解，宜先明确所问再参。",
    };
  }
  const line = chart.lines.find((l) => l.yao === yao);
  const changing = line
    ? line.changing || isChanging(line.value)
    : false;
  if (!changing) {
    return {
      status: "静",
      summary: `用神落第${yao}爻为静爻，宜按既有节奏稳步对照所问。`,
    };
  }
  if (chart.bianGua) {
    return {
      status: "化",
      summary: `用神落第${yao}爻发动，化入变卦「${chart.bianGua.name}」趋势，宜分步验证、预留调整。`,
    };
  }
  return {
    status: "动",
    summary: `用神落第${yao}爻发动，变化焦点相对集中，宜围绕该环节做准备与复盘。`,
  };
}
