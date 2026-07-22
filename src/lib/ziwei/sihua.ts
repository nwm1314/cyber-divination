/**
 * 生年四化：查表并标记星曜（T152）
 */

import type { ZiweiStar } from "@/lib/types/ziwei";
import type { Tiangan } from "./tables/constants";
import {
  SIHUA_BY_YEAR_STEM,
  SIHUA_KINDS,
  type SihuaKind,
  type SihuaTargets,
} from "./tables/sihua";

export function getBirthYearSihua(yearStem: Tiangan): SihuaTargets {
  const t = SIHUA_BY_YEAR_STEM[yearStem];
  if (!t) throw new Error(`invalid yearStem for sihua: ${yearStem}`);
  return t;
}

/** 星名 → 该星所带生年四化标记 */
export function sihuaMarksByStar(
  yearStem: Tiangan,
): Map<string, SihuaKind[]> {
  const targets = getBirthYearSihua(yearStem);
  const map = new Map<string, SihuaKind[]>();
  for (const kind of SIHUA_KINDS) {
    const star = targets[kind];
    const prev = map.get(star) ?? [];
    prev.push(kind);
    map.set(star, prev);
  }
  return map;
}

/** 就地为已落宫星曜填 sihua（仅命中表内星名） */
export function applyBirthYearSihua(
  stars: ZiweiStar[],
  yearStem: Tiangan,
): void {
  const marks = sihuaMarksByStar(yearStem);
  for (const star of stars) {
    const kinds = marks.get(star.name);
    if (kinds?.length) {
      star.sihua = [...kinds];
    }
  }
}
