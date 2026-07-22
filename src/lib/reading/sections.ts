import type { ReadingSectionKey } from "@/lib/types";

/** 对齐 bazi-skill 第三阶段 1–8 章 */
export const SECTION_KEYS: readonly ReadingSectionKey[] = [
  "day_master",
  "ten_gods",
  "wuxing",
  "pattern",
  "dayun",
  "liunian",
  "calibrate",
  "advice",
] as const;

export const SECTION_TITLES: Record<ReadingSectionKey, string> = {
  day_master: "日主强弱与性格倾向",
  ten_gods: "十神与六亲要点",
  wuxing: "五行平衡与喜用",
  pattern: "格局判定",
  dayun: "大运分析",
  liunian: "流年分析",
  calibrate: "历史事件校准",
  advice: "综合建议",
};

export const DISCLAIMER =
  "本产品仅供传统文化学习与娱乐参考，不构成医疗、投资、法律或人生决策依据。健康问题请就医，财务请理性决策。命理分析仅供参考，人生在于自身的努力和选择。排盘由本地确定性引擎计算；解读（模板/LLM）只组织语言，不保证现实预测准确率。信息不完整或边界情况会给出警告，通俗模式亦不隐藏关键限制。";
