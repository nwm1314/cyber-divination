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

/**
 * POST /api/share 请求体外壳（B1）
 *
 * 只约束「外壳」：chart / report 的术数结构由服务端既有
 * `validateChartPayload` / `validateZiweiChartPayload` /
 * `validateLiuyaoChartPayload` 逐字段核验（需要按 kind 分支，
 * 且错误文案面向用户），此处不重复实现，避免两套校验漂移。
 */
export const shareRequestBodySchema = z.object({
  kind: z.string().max(16).optional(),
  chart: z.unknown().optional(),
  report: z.unknown().optional(),
  chartName: z.string().max(200).optional(),
  maskName: z.boolean().optional(),
});

export type ShareRequestBody = z.infer<typeof shareRequestBodySchema>;
