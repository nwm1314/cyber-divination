import { z } from "zod";
import { idSchema } from "./common";

const stemBranchSchema = z.object({
  stem: z.string().min(1).max(8),
  branch: z.string().min(1).max(8),
});

/** 八字盘最小必填字段（服务端权威校验） */
export const baziChartMinSchema = z.object({
  profileId: idSchema,
  pillars: z.object({
    year: stemBranchSchema.passthrough(),
    month: stemBranchSchema.passthrough(),
    day: stemBranchSchema.passthrough(),
    hour: stemBranchSchema.passthrough().nullable().optional(),
  }),
  dayMaster: z.string().min(1).max(8),
  wuxingScores: z.record(z.string(), z.number()),
  dayun: z.array(z.unknown()).max(20),
  liunian: z.array(z.unknown()).max(20),
});

export type BaziChartMin = z.infer<typeof baziChartMinSchema>;

/** BirthProfile 最小字段 */
export const birthProfileMinSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(64),
  gender: z.enum(["male", "female"]),
  analysisBaseDate: z.string().min(4).max(32),
  useTrueSolarTime: z.boolean(),
  userId: z.string().max(128).nullable().optional(),
  personId: z.string().max(128).optional(),
});

export type BirthProfileMin = z.infer<typeof birthProfileMinSchema>;

/** POST /api/charts */
export const cloudChartUpsertSchema = z.object({
  profile: birthProfileMinSchema.passthrough(),
  chart: baziChartMinSchema.passthrough(),
  report: z.unknown().optional().nullable(),
  calibration: z.unknown().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.chart.profileId !== data.profile.id) {
    ctx.addIssue({
      code: "custom",
      message: "profile.id 与 chart.profileId 不一致",
      path: ["chart", "profileId"],
    });
  }
});

export type CloudChartUpsertInput = z.infer<typeof cloudChartUpsertSchema>;

/** 紫微盘最小字段 */
export const ziweiChartMinSchema = z.object({
  id: idSchema,
  mingGong: z.string().min(1).max(16),
  shenGong: z.string().min(1).max(16),
  palaces: z.array(z.unknown()).min(1).max(12),
  majorStars: z.record(z.string(), z.unknown()),
  daxian: z.array(z.unknown()).max(20),
  liunian: z.array(z.unknown()).max(30).optional(),
  meta: z.record(z.string(), z.unknown()),
  userId: z.string().max(128).nullable().optional(),
  personId: z.string().max(128).optional(),
});

export const cloudZiweiUpsertSchema = z.object({
  chart: ziweiChartMinSchema.passthrough(),
  solarDate: z.string().max(32).optional(),
});

/** 六爻盘最小字段 */
export const liuyaoChartMinSchema = z.object({
  id: idSchema,
  question: z.string().trim().min(1).max(500),
  method: z.enum(["coins", "time", "manual"]),
  lines: z.array(z.unknown()).length(6),
  benGua: z.object({
    name: z.string().min(1),
    upper: z.string().min(1),
    lower: z.string().min(1),
  }).passthrough(),
  bianGua: z
    .object({
      name: z.string().min(1),
      upper: z.string().min(1),
      lower: z.string().min(1),
    })
    .passthrough()
    .nullable()
    .optional(),
  shiYao: z.number(),
  yingYao: z.number(),
  meta: z.record(z.string(), z.unknown()),
  userId: z.string().max(128).nullable().optional(),
});

export const cloudLiuyaoUpsertSchema = z.object({
  chart: liuyaoChartMinSchema.passthrough(),
});

/** POST /api/charts/migrate */
export const migrateBodySchema = z.object({
  charts: z.array(
    z.object({
      profileId: z.string().max(128).optional(),
      profile: birthProfileMinSchema.passthrough(),
      chart: baziChartMinSchema.passthrough(),
      report: z.unknown().optional().nullable(),
      calibration: z.unknown().optional().nullable(),
      localUpdatedAt: z.string().max(40).nullable().optional(),
    }).passthrough(),
  ),
  options: z
    .object({
      pullCloudOnly: z.boolean().optional(),
    })
    .optional(),
});

/** POST /api/people */
export const personInputSchema = z.object({
  id: z.string().max(128).optional(),
  name: z.string().trim().min(1).max(64),
  userId: z.string().max(128).nullable().optional(),
  gender: z.enum(["male", "female"]).optional(),
  solarDate: z.string().max(32).optional(),
  lunarDate: z.string().max(32).optional(),
  isLeapMonth: z.boolean().optional(),
  birthTime: z.string().max(16).optional(),
  shichenUnknown: z.boolean().optional(),
  birthPlace: z
    .object({
      province: z.string().max(64),
      city: z.string().max(64),
      lng: z.number().optional(),
      lat: z.number().optional(),
    })
    .optional(),
  chartIds: z.array(z.string().max(128)).max(100).optional(),
  ziweiIds: z.array(z.string().max(128)).max(100).optional(),
});

/**
 * 校验 chart.profileId 与 profile.id 一致；拒绝客户端伪造的 userId 语义。
 * 返回清洗后的 upsert body（profile.userId 由调用方强制覆盖为 session）。
 */
export function assertChartProfileConsistency(input: {
  profile: { id: string; userId?: string | null };
  chart: { profileId: string };
}): string | null {
  if (input.profile.id !== input.chart.profileId) {
    return "profile.id 与 chart.profileId 不一致";
  }
  return null;
}
