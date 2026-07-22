/**
 * 邮箱 Magic Link（T222）
 * - 生产：需 AUTH_EMAIL_FROM + SMTP/Resend；无邮件服务时仅返回 devLink（NODE_ENV=development）
 * - 有 DATABASE_URL 时 token 落 PG；否则内存 + data/magic-links.json
 */

import "server-only";
import { createHash, randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { ensureSchema, getSql, isDatabaseConfigured } from "@/lib/db";
import { getCloudStoreDriver } from "@/lib/storage/driver";

const MAGIC_TTL_MS = 15 * 60 * 1000;

export type MagicLinkCreateResult = {
  email: string;
  expiresAt: string;
  /** 仅开发或未配置邮件时返回，便于本地验收 */
  devLink?: string;
  emailed: boolean;
};

type MemoryRow = {
  tokenHash: string;
  email: string;
  displayName: string | null;
  callbackUrl: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

const memory = new Map<string, MemoryRow>();
let fileLoaded = false;
/** 内存路径消费互斥（同进程内防重复消费） */
let memoryConsumeBusy = false;

function dataFile(): string {
  return path.join(process.cwd(), "data", "magic-links.json");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isPostgresDriver(): boolean {
  return getCloudStoreDriver() === "postgres" && isDatabaseConfigured();
}

async function ensureFile(): Promise<void> {
  if (fileLoaded) return;
  fileLoaded = true;
  try {
    const raw = await fs.readFile(dataFile(), "utf-8");
    const list = JSON.parse(raw) as MemoryRow[];
    if (Array.isArray(list)) {
      for (const r of list) memory.set(r.tokenHash, r);
    }
  } catch {
    // miss
  }
}

async function persistFile(): Promise<void> {
  await fs.mkdir(path.dirname(dataFile()), { recursive: true });
  await fs.writeFile(
    dataFile(),
    JSON.stringify(Array.from(memory.values()), null, 2),
    "utf-8",
  );
}

function appBaseUrl(): string {
  const raw =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.AUTH_EMAIL_FROM?.trim() || process.env.EMAIL_FROM?.trim();
  if (resendKey && from) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
      }),
    });
    return res.ok;
  }
  // SMTP 未内置；无密钥时不发送
  return false;
}

/**
 * 创建 magic link 并尝试发信
 */
export async function createMagicLink(input: {
  email: string;
  displayName?: string;
  callbackUrl?: string;
}): Promise<MagicLinkCreateResult> {
  const email = input.email.trim().toLowerCase();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MAGIC_TTL_MS).toISOString();
  const createdAt = now.toISOString();
  const displayName = input.displayName?.trim() || null;
  const callbackUrl = input.callbackUrl?.trim() || "/";

  if (isPostgresDriver()) {
    await ensureSchema();
    const sql = getSql();
    await sql`
      INSERT INTO magic_links (token_hash, email, display_name, callback_url, expires_at, used_at, created_at)
      VALUES (
        ${tokenHash},
        ${email},
        ${displayName},
        ${callbackUrl},
        ${expiresAt},
        NULL,
        ${createdAt}
      )
    `;
  } else {
    await ensureFile();
    memory.set(tokenHash, {
      tokenHash,
      email,
      displayName,
      callbackUrl,
      expiresAt,
      usedAt: null,
      createdAt,
    });
    await persistFile().catch(() => undefined);
  }

  const link = `${appBaseUrl()}/auth/callback?token=${encodeURIComponent(token)}`;
  const text = [
    "赛博命理登录链接（15 分钟内有效）：",
    link,
    "",
    "若非本人操作请忽略本邮件。",
  ].join("\n");

  let emailed = false;
  try {
    emailed = await sendEmail({
      to: email,
      subject: "赛博命理 · 登录链接",
      text,
    });
  } catch {
    emailed = false;
  }

  return {
    email,
    expiresAt,
    emailed,
    ...(process.env.NODE_ENV !== "production" ? { devLink: link } : {}),
  };
}

/**
 * 消费 token → 返回邮箱与显示名；失败返回 null
 */
export async function consumeMagicLink(token: string): Promise<{
  email: string;
  displayName?: string;
  callbackUrl: string;
} | null> {
  if (!token?.trim()) return null;
  const tokenHash = hashToken(token.trim());
  const now = Date.now();

  if (isPostgresDriver()) {
    await ensureSchema();
    const sql = getSql();
    const usedAt = new Date().toISOString();
    const rows = await sql`
      UPDATE magic_links
      SET used_at = ${usedAt}
      WHERE token_hash = ${tokenHash}
        AND used_at IS NULL
        AND expires_at > ${new Date(now).toISOString()}
      RETURNING email, display_name, callback_url
    `;
    const row = rows[0] as
      | {
          email: string;
          display_name: string | null;
          callback_url: string | null;
        }
      | undefined;
    if (!row) return null;
    return {
      email: row.email,
      displayName: row.display_name ?? undefined,
      callbackUrl: row.callback_url || "/",
    };
  }

  await ensureFile();
  while (memoryConsumeBusy) {
    await new Promise((r) => setTimeout(r, 1));
  }
  memoryConsumeBusy = true;
  try {
    const row = memory.get(tokenHash);
    if (!row || row.usedAt) return null;
    if (Date.parse(row.expiresAt) < now) return null;
    row.usedAt = new Date().toISOString();
    memory.set(tokenHash, row);
    await persistFile().catch(() => undefined);
    return {
      email: row.email,
      displayName: row.displayName ?? undefined,
      callbackUrl: row.callbackUrl || "/",
    };
  } finally {
    memoryConsumeBusy = false;
  }
}

export function resetMagicLinkStoreForTests(): void {
  memory.clear();
  fileLoaded = false;
  memoryConsumeBusy = false;
}

/** 生产是否允许开发假登录 */
export function allowDevCredentialsLogin(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.AUTH_ALLOW_DEV_LOGIN === "1";
}

/** 是否启用 magic link 主路径（生产默认 true） */
export function preferMagicLink(): boolean {
  if (process.env.AUTH_METHOD?.trim().toLowerCase() === "credentials") {
    return false;
  }
  if (process.env.NODE_ENV === "production") return true;
  return process.env.AUTH_METHOD?.trim().toLowerCase() === "magic";
}
