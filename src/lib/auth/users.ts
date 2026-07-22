/**
 * 用户表（T81 / T221）
 * - 有 DATABASE_URL + postgres 驱动：Postgres
 * - 否则：内存 + data/users.json
 */

import "server-only";
import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { User, UserId } from "@/lib/types/user";
import { getCloudStoreDriver } from "@/lib/storage/driver";
import {
  pgDeleteUserById,
  pgFindOrCreateUserByEmail,
  pgGetUserById,
} from "./pg-users";

function isPostgresDriver(): boolean {
  return getCloudStoreDriver() === "postgres";
}

type UserRecord = User;

const memory = new Map<UserId, UserRecord>();
let emailIndex = new Map<string, UserId>();
let loaded = false;

function dataFile(): string {
  return path.join(process.cwd(), "data", "users.json");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  // 开发登录宽松校验
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function userIdFromEmail(email: string): UserId {
  const h = createHash("sha256")
    .update(normalizeEmail(email))
    .digest("hex")
    .slice(0, 16);
  return `usr_${h}`;
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fs.readFile(dataFile(), "utf-8");
    const list = JSON.parse(raw) as UserRecord[];
    if (!Array.isArray(list)) return;
    for (const u of list) {
      if (!u?.id) continue;
      memory.set(u.id, u);
      if (u.email) emailIndex.set(normalizeEmail(u.email), u.id);
    }
  } catch {
    // 文件不存在等：空表
  }
}

async function persist(): Promise<void> {
  const dir = path.dirname(dataFile());
  await fs.mkdir(dir, { recursive: true });
  const list = Array.from(memory.values());
  await fs.writeFile(dataFile(), JSON.stringify(list, null, 2), "utf-8");
}

/** 测试/热重载用：清空内存表 */
export function resetUserStoreForTests(): void {
  memory.clear();
  emailIndex = new Map();
  loaded = false;
}

export function validateLoginEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const t = email.trim();
  if (!t || !isValidEmail(t)) return null;
  return normalizeEmail(t);
}

export function sanitizeDisplayName(
  name: unknown,
  fallbackFromEmail: string,
): string {
  if (typeof name === "string" && name.trim()) {
    return name.trim().slice(0, 64);
  }
  const local = fallbackFromEmail.split("@")[0] ?? "用户";
  return local.slice(0, 64) || "用户";
}

/**
 * 按邮箱查找或创建用户（Credentials 开发登录）
 */
export async function findOrCreateUserByEmail(input: {
  email: string;
  displayName?: string;
}): Promise<User> {
  if (isPostgresDriver()) return pgFindOrCreateUserByEmail(input);
  await ensureLoaded();
  const email = normalizeEmail(input.email);
  const existingId = emailIndex.get(email);
  if (existingId) {
    const existing = memory.get(existingId);
    if (existing) {
      const displayName = sanitizeDisplayName(
        input.displayName,
        existing.displayName ?? email,
      );
      if (
        input.displayName?.trim() &&
        displayName !== existing.displayName
      ) {
        const updated: User = {
          ...existing,
          displayName,
          updatedAt: new Date().toISOString(),
        };
        memory.set(existing.id, updated);
        await persist().catch(() => undefined);
        return updated;
      }
      return existing;
    }
  }

  const now = new Date().toISOString();
  const id = userIdFromEmail(email);
  // 极端碰撞兜底
  const finalId = memory.has(id) ? `usr_${randomUUID().replace(/-/g, "")}` : id;
  const user: User = {
    id: finalId,
    email,
    displayName: sanitizeDisplayName(input.displayName, email),
    createdAt: now,
    updatedAt: now,
  };
  memory.set(user.id, user);
  emailIndex.set(email, user.id);
  await persist().catch(() => undefined);
  return user;
}

export async function getUserById(id: UserId): Promise<User | null> {
  if (isPostgresDriver()) return pgGetUserById(id);
  await ensureLoaded();
  return memory.get(id) ?? null;
}

/**
 * 删除用户账号（T84）
 * 成功返回被删用户；不存在返回 null
 */
export async function deleteUserById(id: UserId): Promise<User | null> {
  if (isPostgresDriver()) return pgDeleteUserById(id);
  await ensureLoaded();
  const existing = memory.get(id);
  if (!existing) return null;
  memory.delete(id);
  if (existing.email) {
    emailIndex.delete(normalizeEmail(existing.email));
  }
  await persist().catch(() => undefined);
  return existing;
}
