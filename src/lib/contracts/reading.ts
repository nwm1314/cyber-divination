import { z } from "zod";

/** 八字解读章节 key */
export const baziSectionKeySchema = z.enum([
  "day_master",
  "ten_gods",
  "wuxing",
  "pattern",
  "dayun",
  "liunian",
  "calibrate",
  "advice",
]);

/** 紫微解读章节 key */
export const ziweiSectionKeySchema = z.enum([
  "overview",
  "ming_gong",
  "career",
  "wealth",
  "relationship",
  "luck",
  "advice",
  "disclaimer",
]);

/** 六爻解读章节 key */
export const liuyaoSectionKeySchema = z.enum([
  "question",
  "ben_gua",
  "changing",
  "shi_ying",
  "judgment",
  "advice",
  "disclaimer",
]);

const sectionBodySchema = z.object({
  key: z.string().min(1).max(32),
  body: z.string().min(1).max(8000),
  /** 允许模型标注「风格出处」，不作为可核验引用 */
  styleCitations: z.array(z.string().max(64)).max(8).optional(),
});

/**
 * LLM 结构化解读输出（T290）
 * - sections 必须覆盖约定章节
 * - 禁止模型自造 ruleId / evidence（由引擎透传）
 */
export const structuredReadingSchema = z.object({
  sections: z.array(sectionBodySchema).min(1).max(16),
});

export type StructuredReading = z.infer<typeof structuredReadingSchema>;

export const BAZI_SECTION_KEYS = baziSectionKeySchema.options;
export const ZIWEI_SECTION_KEYS = ziweiSectionKeySchema.options;
export const LIUYAO_SECTION_KEYS = liuyaoSectionKeySchema.options;
