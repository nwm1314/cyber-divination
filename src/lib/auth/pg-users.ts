/**
 * Postgres 用户表（T221 / T222）
 */

import { createHash, randomUUID } from "crypto";
import type { User, UserId } from "@/lib/types/user";
import { ensureSchema, getSql } from "@/lib/db";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function userIdFromEmail(email: string): UserId {
  const h = createHash("sha256")
    .update(normalizeEmail(email))
    .digest("hex")
    .slice(0, 16);
  return `usr_${h}`;
}

function rowToUser(row: {
  id: string;
  email: string;
  display_name: string | null;
  image: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name ?? undefined,
    image: row.image,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : row.created_at.toISOString(),
    updatedAt:
      typeof row.updated_at === "string"
        ? row.updated_at
        : row.updated_at.toISOString(),
  };
}

export async function pgFindOrCreateUserByEmail(input: {
  email: string;
  displayName?: string;
}): Promise<User> {
  await ensureSchema();
  const sql = getSql();
  const email = normalizeEmail(input.email);
  const existing = await sql`
    SELECT * FROM users WHERE email = ${email} LIMIT 1
  `;
  if (existing[0]) {
    const u = rowToUser(existing[0] as never);
    if (input.displayName?.trim() && input.displayName.trim() !== u.displayName) {
      const name = input.displayName.trim().slice(0, 64);
      const now = new Date().toISOString();
      await sql`
        UPDATE users SET display_name = ${name}, updated_at = ${now}
        WHERE id = ${u.id}
      `;
      return { ...u, displayName: name, updatedAt: now };
    }
    return u;
  }

  const now = new Date().toISOString();
  let id = userIdFromEmail(email);
  const clash = await sql`SELECT id FROM users WHERE id = ${id} LIMIT 1`;
  if (clash[0]) id = `usr_${randomUUID().replace(/-/g, "")}`;
  const displayName =
    input.displayName?.trim().slice(0, 64) ||
    email.split("@")[0]?.slice(0, 64) ||
    "用户";

  await sql`
    INSERT INTO users (id, email, display_name, image, created_at, updated_at)
    VALUES (${id}, ${email}, ${displayName}, NULL, ${now}, ${now})
  `;
  return {
    id,
    email,
    displayName,
    image: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function pgGetUserById(id: UserId): Promise<User | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return null;
  return rowToUser(rows[0] as never);
}

export async function pgDeleteUserById(id: UserId): Promise<User | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM users WHERE id = ${id} RETURNING *
  `;
  if (!rows[0]) return null;
  return rowToUser(rows[0] as never);
}
