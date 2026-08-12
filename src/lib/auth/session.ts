/**
 * 轻量签名会话（T81）
 * Cookie 载荷：base64url(JSON).base64url(HMAC-SHA256)
 * 不引入 next-auth；生产可换 OAuth，会话形状对齐 AuthJsJwtPayload
 */

import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import type { AuthJsJwtPayload, AuthJsSession } from "./types";
import { toAppSession } from "./types";
import type { AppSession, User, UserId } from "@/lib/types/user";
import {
  DEV_AUTH_SECRET_FALLBACK,
  SESSION_MAX_AGE_SEC,
} from "./constants";

export type SessionTokenPayload = AuthJsJwtPayload & {
  email?: string | null;
  name?: string | null;
};

export type CookieSerializeOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
};

function b64urlEncode(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

/** 解析 AUTH_SECRET；生产缺省抛错，开发回落占位 */
export function getAuthSecret(): string {
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production");
  }
  return DEV_AUTH_SECRET_FALLBACK;
}

function sign(data: string, secret: string): string {
  return b64urlEncode(
    createHmac("sha256", secret).update(data).digest(),
  );
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** 签发会话 token（sub 为真实 User.id，禁止 anon_） */
export function createSessionToken(
  user: Pick<User, "id" | "email" | "displayName">,
  options?: { maxAgeSec?: number; now?: number },
): string {
  const now = options?.now ?? Math.floor(Date.now() / 1000);
  const maxAge = options?.maxAgeSec ?? SESSION_MAX_AGE_SEC;
  const payload: SessionTokenPayload = {
    sub: user.id,
    email: user.email ?? null,
    name: user.displayName ?? null,
    iat: now,
    exp: now + maxAge,
  };
  const body = b64urlEncode(JSON.stringify(payload));
  const secret = getAuthSecret();
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

/** 校验并解析 token；失败返回 null */
export function verifySessionToken(
  token: string | null | undefined,
  options?: { now?: number; secret?: string },
): SessionTokenPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  let secret: string;
  try {
    secret = options?.secret ?? getAuthSecret();
  } catch {
    return null;
  }

  const expected = sign(body, secret);
  if (!safeEqual(sig, expected)) return null;

  try {
    const raw = b64urlDecode(body).toString("utf8");
    const payload = JSON.parse(raw) as SessionTokenPayload;
    if (!payload.sub || typeof payload.sub !== "string") return null;
    if (payload.sub.startsWith("anon_")) return null;
    const now = options?.now ?? Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      return null;
    }
    if (payload.exp < now) return null;
    if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat)) {
      return null;
    }
    // iat 不可在未来（允许 60s 时钟偏差）
    if (payload.iat > now + 60) return null;
    if (payload.iat > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function payloadToAuthJsSession(
  payload: SessionTokenPayload,
): AuthJsSession {
  const expIso =
    typeof payload.exp === "number"
      ? new Date(payload.exp * 1000).toISOString()
      : new Date(Date.now() + SESSION_MAX_AGE_SEC * 1000).toISOString();
  return {
    user: {
      id: payload.sub as UserId,
      email: payload.email ?? null,
      name: payload.name ?? null,
      image: null,
    },
    expires: expIso,
  };
}

export function sessionFromToken(
  token: string | null | undefined,
): AppSession {
  const payload = verifySessionToken(token);
  if (!payload) return toAppSession(null);
  return toAppSession(payloadToAuthJsSession(payload));
}

/** Cookie 安全选项 */
export function sessionCookieOptions(
  maxAgeSec: number = SESSION_MAX_AGE_SEC,
): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSec,
  };
}

export function clearSessionCookieOptions(): CookieSerializeOptions {
  return {
    ...sessionCookieOptions(0),
    maxAge: 0,
  };
}

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SEC, SESSION_REAUTH_MAX_AGE_SEC } from "./constants";
