import type { ZiweiReadingSectionKey } from "@/lib/types";
import { DISCLAIMER } from "@/lib/reading/sections";

/** 紫微固定八章 key（T104 · 稳定，UI/API/测试均依赖） */
export const ZIWEI_SECTION_KEYS: readonly ZiweiReadingSectionKey[] = [
  "overview",
  "ming_gong",
  "career",
  "wealth",
  "relationship",
  "luck",
  "advice",
  "disclaimer",
] as const;

export const ZIWEI_SECTION_TITLES: Record<ZiweiReadingSectionKey, string> = {
  overview: "命盘总览",
  ming_gong: "命宫解读",
  career: "事业宫（官禄）",
  wealth: "财帛宫",
  relationship: "感情宫（夫妻）",
  luck: "大限与运限",
  advice: "综合建议",
  disclaimer: "免责声明",
};

/** 复用全局免责（与八字一致） */
export { DISCLAIMER };
