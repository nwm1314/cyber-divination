/**
 * 宫干自化标记表（T181 · 三合主线扩展）
 *
 * 说明：
 * - 生年四化仍用 SIHUA_BY_YEAR_STEM（年干）。
 * - 本表用 **宫干** 查同一套四化星名；若该星落在本宫，则标记为「自化X」。
 * - 非完整飞星派（不改 school；仍 sanhe）；飞星全套另 school/version。
 * - 标记写入 star.sihua，与生年四化可叠（如 ["禄","自化忌"]）。
 */

import type { Tiangan } from "./constants";
import { SIHUA_BY_YEAR_STEM, type SihuaKind } from "./sihua";

/** 自化标记前缀 */
export const ZIHUA_PREFIX = "自化" as const;

export type ZihuaMark =
  | "自化禄"
  | "自化权"
  | "自化科"
  | "自化忌";

export const ZIHUA_KINDS: readonly SihuaKind[] = [
  "禄",
  "权",
  "科",
  "忌",
] as const;

/** 宫干 → 四化目标（与生年表同源，避免双表漂移） */
export function sihuaTargetsByPalaceStem(
  palaceStem: Tiangan,
): Record<SihuaKind, string> {
  return SIHUA_BY_YEAR_STEM[palaceStem];
}

export function zihuaMarkOf(kind: SihuaKind): ZihuaMark {
  return `${ZIHUA_PREFIX}${kind}` as ZihuaMark;
}
