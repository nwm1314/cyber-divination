/**
 * 主星亮度：查表写入 ZiweiStar.brightness（T170）
 */

import type { Dizhi, StarBrightness, ZiweiStar } from "@/lib/types/ziwei";
import {
  lookupMajorBrightness,
  MAJOR_BRIGHTNESS,
} from "./tables/brightness";

export { lookupMajorBrightness, MAJOR_BRIGHTNESS };

/** 就地为主星填 brightness；辅星不动 */
export function applyMajorBrightness(
  stars: ZiweiStar[],
  branch: Dizhi,
): void {
  for (const star of stars) {
    if (star.category && star.category !== "major") continue;
    const b = lookupMajorBrightness(star.name, branch);
    if (b) star.brightness = b;
  }
}

/** 亮度中性措辞（模板用） */
export function brightnessHint(b: StarBrightness | undefined): string {
  if (!b) return "";
  switch (b) {
    case "庙":
    case "旺":
      return "得地偏显";
    case "得":
    case "利":
      return "力量尚可";
    case "陷":
    case "不":
      return "力量偏弱（中性参考）";
    default:
      return "力量平常";
  }
}
