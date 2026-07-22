/**
 * Auth 契约与会话模型（T80）
 *
 * ## 方案
 * - 预留 **Auth.js (NextAuth v5)** 会话形状；本卡不引入 `next-auth` 运行时依赖
 * - T81 再实现登录页 / 回调 / 登出与 Credentials、Magic Link 或 OAuth
 *
 * ## 匿名 userId 规则
 * 1. **未登录本地模式**：`userId` 为 `null`，或使用带 `anon_` 前缀的本地 ID
 *    （推荐 `anon_` + UUID，无连字符亦可：`anon_a1b2c3...`）
 * 2. **判定**：`userId == null` 或 `userId.startsWith(ANON_USER_ID_PREFIX)` → 匿名
 * 3. **Person.userId / BirthProfile.userId**：可为 `null`，表示仅本地、未归属登录用户
 * 4. **MVP 占位**：`src/lib/storage` 的 `USER_ID = "default-user"` 视为历史匿名会话键；
 *    迁移合并时按匿名处理（T83），勿当作已登录 User.id
 * 5. **登录后**：真实 `User.id` **不得** 使用 `anon_` 前缀；合并时把匿名数据挂到 `User.id`
 *
 * ## 与 BirthProfile
 * - `BirthProfile.userId`：档案归属用户（可选）
 * - `BirthProfile.personId`：统一人物主体（T121，可选）
 * - 排盘引擎仍只依赖生辰字段，不读 auth
 */

import type { AppSession, User, UserId } from "@/lib/types/user";

/** 匿名 userId 前缀（本地未登录） */
export const ANON_USER_ID_PREFIX = "anon_" as const;

/** Auth 提供商标识（T81 选型用；本卡仅类型） */
export type AuthProviderId =
  | "credentials"
  | "email" // Magic Link
  | "github"
  | "google"
  | "wechat";

/**
 * Auth.js Session.user 预留形状
 * @see https://authjs.dev — Session 接口（v5）
 */
export type AuthJsSessionUser = {
  id: UserId;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

/**
 * Auth.js Session 预留契约（Cookie/JWT 由 T81 配置）
 * 不在此文件 import next-auth，避免未配置密钥时构建失败
 */
export type AuthJsSession = {
  user: AuthJsSessionUser;
  expires: string;
};

/** JWT / token 载荷预留（T81 扩展） */
export type AuthJsJwtPayload = {
  sub: UserId;
  email?: string | null;
  name?: string | null;
  /** Auth.js 默认字段 */
  iat?: number;
  exp?: number;
};

/**
 * 将 Auth.js Session 映射为应用会话；无 session → 匿名
 */
export function toAppSession(
  session: AuthJsSession | null | undefined,
): AppSession {
  if (!session?.user?.id) {
    return {
      userId: null,
      authenticated: false,
      expires: null,
    };
  }
  const id = session.user.id;
  const anonymous = isAnonymousUserId(id);
  return {
    userId: id,
    email: session.user.email ?? null,
    displayName: session.user.name ?? null,
    image: session.user.image ?? null,
    authenticated: !anonymous,
    expires: session.expires,
  };
}

/** 是否匿名 userId（null 或 anon_ 前缀） */
export function isAnonymousUserId(
  userId: UserId | null | undefined,
): boolean {
  if (userId == null || userId === "") return true;
  return userId.startsWith(ANON_USER_ID_PREFIX);
}

/** 生成本地匿名 userId（浏览器侧可用；非加密安全要求场景） */
export function createAnonymousUserId(randomPart?: string): UserId {
  const part =
    randomPart ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);
  return `${ANON_USER_ID_PREFIX}${part}`;
}

/** User 实体 → 会话用户摘要 */
export function userToSessionUser(user: User): AuthJsSessionUser {
  return {
    id: user.id,
    name: user.displayName ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
  };
}
