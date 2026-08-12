/**
 * 流昌流曲 + 截空入盘（T191 / T192）
 */

import type { Dizhi, ZiweiStar } from "@/lib/types/ziwei";
import type { Tiangan } from "./tables/constants";
import {
  jiekongYinIndices,
  liuChangQuByYearBranch,
  MISC_AUX_CATEGORY,
  type MiscAuxName,
} from "./tables/liuchang";

export {
  JIEKONG_BY_YEAR_STEM,
  liuChangQuByYearBranch,
  jiekongYinIndices,
} from "./tables/liuchang";

export type LiuChangJiekongPlacement = {
  /** 星名 → 寅起索引；截空可两宫 */
  starYinIndex: Partial<Record<MiscAuxName, number | number[]>>;
};

export function placeLiuChangJiekong(params: {
  yearStem: Tiangan;
  /** 用于流昌流曲的地支：生年支=年流；流年支=流年流昌曲 */
  flowBranch: Dizhi;
}): LiuChangJiekongPlacement {
  const cq = liuChangQuByYearBranch(params.flowBranch);
  const jk = jiekongYinIndices(params.yearStem);
  return {
    starYinIndex: {
      流昌: cq.liuChang,
      流曲: cq.liuQu,
      截空: jk,
    },
  };
}

export function liuChangJiekongAsZiwei(
  placement: LiuChangJiekongPlacement,
  yinIndex: number,
): ZiweiStar[] {
  const out: ZiweiStar[] = [];
  const names: MiscAuxName[] = ["流昌", "流曲", "截空"];
  for (const name of names) {
    const yi = placement.starYinIndex[name];
    if (yi === undefined) continue;
    const hit = Array.isArray(yi) ? yi.includes(yinIndex) : yi === yinIndex;
    if (hit) {
      out.push({
        name,
        category: MISC_AUX_CATEGORY[name],
      });
    }
  }
  return out;
}
