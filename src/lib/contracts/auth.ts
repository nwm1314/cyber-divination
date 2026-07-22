import { z } from "zod";

/** 登录/Magic Link 邮箱 */
export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email({ message: "请输入有效邮箱" })
  .transform((s) => s.toLowerCase());

export const displayNameSchema = z
  .string()
  .trim()
  .max(64)
  .optional();

/** POST /api/auth/login */
export const loginBodySchema = z.object({
  email: emailSchema,
  displayName: displayNameSchema,
});

export type LoginBody = z.infer<typeof loginBodySchema>;

/** 仅允许站内相对路径，防 open redirect */
export const callbackUrlSchema = z
  .string()
  .max(512)
  .optional()
  .transform((v) => {
    if (typeof v !== "string") return "/";
    if (v.startsWith("/") && !v.startsWith("//")) return v;
    return "/";
  });

/** POST /api/auth/magic-link */
export const magicLinkBodySchema = z.object({
  email: emailSchema,
  displayName: displayNameSchema,
  callbackUrl: callbackUrlSchema,
});

export type MagicLinkBody = z.infer<typeof magicLinkBodySchema>;

/** POST /api/account/delete — 必须 confirm: "DELETE" */
export const deleteConfirmSchema = z.object({
  confirm: z.literal("DELETE", {
    error: '请传入 confirm: "DELETE" 以确认删除',
  }),
});

export type DeleteConfirmBody = z.infer<typeof deleteConfirmSchema>;
