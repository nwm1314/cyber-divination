/**
 * 宫干自化：本宫星命中宫干四化则叠「自化X」（T181）
 * 在生年四化之后调用；不覆盖生年标记。
 */

import type { ZiweiPalace, ZiweiStar } from "@/lib/types/ziwei";
import type { Tiangan } from "./tables/constants";
import { TIANGAN_LIST } from "./tables/constants";
import {
  ZIHUA_KINDS,
  sihuaTargetsByPalaceStem,
  zihuaMarkOf,
} from "./tables/zihua";

function isTiangan(s: string | undefined): s is Tiangan {
  return !!s && (TIANGAN_LIST as readonly string[]).includes(s);
}

/** 单宫：按宫干为命中星追加自化标记 */
export function applyPalaceZihua(palace: ZiweiPalace): void {
  if (!isTiangan(palace.stem)) return;
  const targets = sihuaTargetsByPalaceStem(palace.stem);
  const starToKinds = new Map<string, string[]>();
  for (const kind of ZIHUA_KINDS) {
    const starName = targets[kind];
    const mark = zihuaMarkOf(kind);
    const prev = starToKinds.get(starName) ?? [];
    prev.push(mark);
    starToKinds.set(starName, prev);
  }
  for (const star of palace.stars) {
    const marks = starToKinds.get(star.name);
    if (!marks?.length) continue;
    const existing = star.sihua ?? [];
    const merged = [...existing];
    for (const m of marks) {
      if (!merged.includes(m)) merged.push(m);
    }
    star.sihua = merged;
  }
}

/** 十二宫批量自化 */
export function applyChartZihua(palaces: ZiweiPalace[]): void {
  for (const p of palaces) applyPalaceZihua(p);
}

/** 测试用：星是否带某自化 */
export function hasZihua(star: ZiweiStar, kind?: string): boolean {
  if (!star.sihua?.length) return false;
  if (!kind) return star.sihua.some((s) => s.startsWith("自化"));
  return star.sihua.includes(`自化${kind}`) || star.sihua.includes(kind);
}
