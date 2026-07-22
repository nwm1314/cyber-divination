/**
 * 云端六爻问卦（T225）
 * - postgres：liuyao_charts 表
 * - file：data/cloud-liuyao.json
 */

import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { UserId } from "@/lib/types/user";
import type { LiuyaoChart } from "@/lib/types/liuyao";
import { ensureSchema, getSql, isDatabaseConfigured } from "@/lib/db";
import { getCloudStoreDriver } from "./driver";
import type {
  CloudLiuyaoListItem,
  CloudLiuyaoRecord,
  CloudLiuyaoUpsertBody,
} from "./cloud-liuyao-types";
import { toLiuyaoListItem } from "./cloud-liuyao-types";

type FileShape = {
  version: 1;
  users: Record<UserId, Record<string, CloudLiuyaoRecord>>;
};

const EMPTY: FileShape = { version: 1, users: {} };
let memory: FileShape | null = null;
let loaded = false;

function dataFile(): string {
  return path.join(process.cwd(), "data", "cloud-liuyao.json");
}

async function ensureFile(): Promise<void> {
  if (loaded && memory) return;
  loaded = true;
  try {
    const raw = await fs.readFile(dataFile(), "utf-8");
    const parsed = JSON.parse(raw) as FileShape;
    if (parsed?.version === 1 && parsed.users) {
      memory = parsed;
      return;
    }
  } catch {
    // miss
  }
  memory = { ...EMPTY, users: {} };
}

async function persistFile(): Promise<void> {
  if (!memory) return;
  await fs.mkdir(path.dirname(dataFile()), { recursive: true });
  await fs.writeFile(dataFile(), JSON.stringify(memory, null, 2), "utf-8");
}

function isPostgresDriver(): boolean {
  return getCloudStoreDriver() === "postgres" && isDatabaseConfigured();
}

function rowToRecord(row: {
  id: string;
  user_id: string;
  question: string;
  chart_json: unknown;
  created_at: string | Date;
  updated_at: string | Date;
}): CloudLiuyaoRecord {
  return {
    id: row.id,
    userId: row.user_id,
    question: row.question,
    chart: row.chart_json as LiuyaoChart,
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

export function resetCloudLiuyaoStoreForTests(): void {
  memory = { version: 1, users: {} };
  loaded = true;
}

export async function listCloudLiuyao(
  userId: UserId,
): Promise<CloudLiuyaoListItem[]> {
  if (isPostgresDriver()) {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM liuyao_charts WHERE user_id = ${userId}
      ORDER BY updated_at DESC
    `;
    return rows.map((r) => toLiuyaoListItem(rowToRecord(r as never)));
  }
  await ensureFile();
  return Object.values(memory!.users[userId] ?? {})
    .map(toLiuyaoListItem)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getCloudLiuyao(
  userId: UserId,
  chartId: string,
): Promise<CloudLiuyaoRecord | null> {
  if (isPostgresDriver()) {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM liuyao_charts WHERE user_id = ${userId} AND id = ${chartId}
      LIMIT 1
    `;
    if (!rows[0]) return null;
    return rowToRecord(rows[0] as never);
  }
  await ensureFile();
  return memory!.users[userId]?.[chartId] ?? null;
}

export async function upsertCloudLiuyao(
  userId: UserId,
  body: CloudLiuyaoUpsertBody,
): Promise<CloudLiuyaoRecord> {
  const chart = body.chart;
  if (!chart?.id) throw new Error("缺少 chart.id");
  if (!chart.question?.trim()) throw new Error("六爻 question 必填");

  const now = new Date().toISOString();
  const existing = await getCloudLiuyao(userId, chart.id);
  const rec: CloudLiuyaoRecord = {
    id: chart.id,
    userId,
    question: chart.question.trim(),
    chart: { ...chart, userId },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (isPostgresDriver()) {
    await ensureSchema();
    const sql = getSql();
    await sql`
      INSERT INTO liuyao_charts (id, user_id, question, chart_json, created_at, updated_at)
      VALUES (
        ${rec.id},
        ${userId},
        ${rec.question},
        ${sql.json(rec.chart as never)},
        ${rec.createdAt},
        ${rec.updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        question = EXCLUDED.question,
        chart_json = EXCLUDED.chart_json,
        updated_at = EXCLUDED.updated_at
    `;
    return rec;
  }

  await ensureFile();
  if (!memory!.users[userId]) memory!.users[userId] = {};
  memory!.users[userId][rec.id] = rec;
  await persistFile().catch(() => undefined);
  return rec;
}

export async function deleteCloudLiuyao(
  userId: UserId,
  chartId: string,
): Promise<boolean> {
  if (isPostgresDriver()) {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`
      DELETE FROM liuyao_charts WHERE user_id = ${userId} AND id = ${chartId}
      RETURNING id
    `;
    return rows.length > 0;
  }
  await ensureFile();
  const bag = memory!.users[userId];
  if (!bag || !(chartId in bag)) return false;
  delete bag[chartId];
  await persistFile().catch(() => undefined);
  return true;
}

export async function getAllCloudLiuyaoForUser(
  userId: UserId,
): Promise<CloudLiuyaoRecord[]> {
  if (isPostgresDriver()) {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM liuyao_charts WHERE user_id = ${userId}
    `;
    return rows.map((r) => rowToRecord(r as never));
  }
  await ensureFile();
  return Object.values(memory!.users[userId] ?? {});
}

export async function deleteAllCloudLiuyaoForUser(
  userId: UserId,
): Promise<number> {
  if (isPostgresDriver()) {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`
      DELETE FROM liuyao_charts WHERE user_id = ${userId} RETURNING id
    `;
    return rows.length;
  }
  await ensureFile();
  const bag = memory!.users[userId];
  if (!bag) return 0;
  const n = Object.keys(bag).length;
  delete memory!.users[userId];
  await persistFile().catch(() => undefined);
  return n;
}
