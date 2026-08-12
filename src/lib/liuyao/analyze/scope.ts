/**
 * Explicit v1 boundary for deterministic Liuyao analysis.
 * These are scope disclosures, not claims that omitted schools are invalid.
 */
export const LIUYAO_RULE_SCOPE_NOTE =
  "规则范围提示：当前为学习向 v1，覆盖世应、六亲、用神、六神、伏神、月破/日冲、动变与基础旬空应期；不覆盖旺相休囚完整表、墓绝、三合、进退神、反伏吟、暗动及多流派切换。相关判断应以已显示的盘面证据为限。";

export const LIUYAO_UNSUPPORTED_RULES = [
  "旺相休囚完整表、墓绝",
  "三合、进退神、反伏吟全量状态机",
  "暗动与飞神细断文案",
  "多流派可切换规则包",
] as const;
