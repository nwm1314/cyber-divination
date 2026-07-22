/** 会话 Cookie 与默认 TTL（T81） */

/** HTTP-only 会话 Cookie 名 */
export const SESSION_COOKIE_NAME = "cyber_session" as const;

/** 会话有效期（秒）：7 天 */
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

/**
 * 敏感操作（账号删除等）要求近期认证：session.iat 距今不超过此秒数
 */
export const SESSION_REAUTH_MAX_AGE_SEC = 15 * 60;

/** 开发环境未配置 AUTH_SECRET 时的占位（仅 dev；生产必须配置） */
export const DEV_AUTH_SECRET_FALLBACK = "cyber-divination-dev-secret-change-me";
