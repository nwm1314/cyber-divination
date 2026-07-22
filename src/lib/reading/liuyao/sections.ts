import type { LiuyaoReadingSectionKey } from "@/lib/types";
import { DISCLAIMER } from "@/lib/reading/sections";

/** 六爻固定七章 key（T114 · 稳定，UI/API/测试均依赖） */
export const LIUYAO_SECTION_KEYS: readonly LiuyaoReadingSectionKey[] = [
  "question",
  "ben_gua",
  "changing",
  "shi_ying",
  "judgment",
  "advice",
  "disclaimer",
] as const;

export const LIUYAO_SECTION_TITLES: Record<LiuyaoReadingSectionKey, string> = {
  question: "所问事项",
  ben_gua: "本卦概览",
  changing: "动爻与变卦",
  shi_ying: "世应要点",
  judgment: "易理判断",
  advice: "行动建议",
  disclaimer: "免责声明",
};

/** 复用全局免责（与八字/紫微一致） */
export { DISCLAIMER };
