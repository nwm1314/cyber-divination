import { z } from "zod";

/** 非空字符串 id */
export const idSchema = z.string().min(1).max(128);

/** 分页（可选） */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  cursor: z.string().max(256).optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/** ISO 8601 时间字符串（宽松） */
export const isoDateTimeSchema = z
  .string()
  .min(4)
  .max(40)
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "无效时间戳" });

/** 可选 JSON 对象（不递归深校验） */
export const looseObjectSchema = z.record(z.string(), z.unknown());
