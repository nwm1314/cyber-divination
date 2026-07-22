/**
 * 博士十二神 → ZiweiStar（category=misc）（T182）
 */

import type { Dizhi, ZiweiStar } from "@/lib/types/ziwei";
import type { Tiangan } from "./tables/constants";
import {
  BOSHI_TWELVE,
  boshiAtYin,
  placeBoshiTwelve,
  type BoshiStarName,
} from "./tables/boshi";

export {
  BOSHI_TWELVE,
  placeBoshiTwelve,
  boshiAtYin,
  type BoshiStarName,
} from "./tables/boshi";

export function boshiStarsAsZiwei(
  placement: Record<BoshiStarName, number>,
  yinIndex: number,
): ZiweiStar[] {
  return boshiAtYin(placement, yinIndex).map((name) => ({
    name,
    category: "misc" as const,
  }));
}

export function placeBoshiForChart(params: {
  yearStem: Tiangan;
  yearBranch: Dizhi;
  gender: "male" | "female";
}): Record<BoshiStarName, number> {
  return placeBoshiTwelve(params);
}
