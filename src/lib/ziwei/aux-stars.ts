/**
 * 常用辅星：安星并写入宫位（T160）
 */

import type { ZiweiStar } from "@/lib/types/ziwei";
import {
  auxStarsAtYin,
  placeAuxStars,
  type AuxStarPlacement,
} from "./tables/aux-stars";

export {
  placeAuxStars,
  auxStarsAtYin,
  AUX_STAR_ORDER,
  AUX_STAR_CATEGORY,
  LUCUN_BY_YEAR_STEM,
  KUI_YUE_BY_YEAR_STEM,
  fireBellStartsByYearBranch,
  zuoYouByLunarMonth,
  changQuByHourBranch,
  kongJieByHourBranch,
} from "./tables/aux-stars";
export type {
  AuxStarName,
  AuxStarCategory,
  AuxStarPlacement,
} from "./tables/aux-stars";

/** 生成某宫应追加的辅星 ZiweiStar[] */
export function auxStarsAsZiwei(
  placement: AuxStarPlacement,
  yinIndex: number,
): ZiweiStar[] {
  return auxStarsAtYin(placement, yinIndex).map((s) => ({
    name: s.name,
    category: s.category,
  }));
}
