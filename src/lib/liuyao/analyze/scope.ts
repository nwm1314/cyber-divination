/**
 * Explicit v1 boundary for deterministic Liuyao analysis.
 * These are scope disclosures, not claims that omitted schools are invalid.
 *
 * 更新（GAP-3 / w26-0.6.0）：进退神与空破冲合**已实现**，故从下方
 * UNSUPPORTED 列表移除；仍未实现项保持列出。
 * 口径声明见 docs/ENGINE_RULE_LIUYAO_DONGBIAN.md。
 */
export const LIUYAO_RULE_SCOPE_NOTE =
  "规则范围提示：当前为学习向 v1，覆盖世应、六亲、用神、六神、伏神、月破/日冲、动变（含进退神、化冲化合、化空化破）与基础旬空应期；不覆盖旺相休囚完整表、墓绝、三合、反伏吟、暗动及多流派切换。相关判断应以已显示的盘面证据为限。";

export const LIUYAO_UNSUPPORTED_RULES = [
  "旺相休囚完整表、墓绝",
  "三合局、反伏吟全量状态机",
  "暗动与飞神细断文案",
  "多流派可切换规则包",
] as const;
