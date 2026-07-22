/**
 * 云端紫微档案存储（T107 / T223）
 * data/cloud-ziwei.json 或 Postgres
 */

import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { UserId } from "@/lib/types/user";
import type {
  CloudZiweiFile,
  CloudZiweiListItem,
  CloudZiweiRecord,
  CloudZiweiUpsertBody,
} from "./cloud-ziwei-types";
import { toZiweiListItem } from "./cloud-ziwei-types";
import { getCloudStoreDriver } from "./driver";
import {
  pgDeleteAllCloudZiweiForUser,
  pgDeleteCloudZiwei,
  pgGetAllCloudZiweiForUser,
  pgGetCloudZiwei,
  pgListCloudZiwei,
  pgUpsertCloudZiwei,
} from "./pg-ziwei-store";

function isPostgresDriver(): boolean {
  return getCloudStoreDriver() === "postgres";
}

const EMPTY: CloudZiweiFile = { version: 1, users: {} };

let memory: CloudZiweiFile | null = null;
let loaded = false;

function dataFile(): string {
  return path.join(process.cwd(), "data", "cloud-ziwei.json");
}

async function ensureLoaded(): Promise<void> {
  if (loaded && memory) return;
  loaded = true;
  try {
    const raw = await fs.readFile(dataFile(), "utf-8");
    const parsed = JSON.parse(raw) as CloudZiweiFile;
    if (parsed?.version === 1 && parsed.users && typeof parsed.users === "object") {
      memory = parsed;
      return;
    }
  } catch {
    // 文件不存在等
  }
  memory = { ...EMPTY, users: {} };
}

async function persist(): Promise<void> {
  if (!memory) return;
  const dir = path.dirname(dataFile());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(dataFile(), JSON.stringify(memory, null, 2), "utf-8");
}

export function resetCloudZiweiStoreForTests(): void {
  memory = { version: 1, users: {} };
  loaded = true;
}

export function unloadCloudZiweiStoreForTests(): void {
  memory = null;
  loaded = false;
}

export async function listCloudZiwei(
  userId: UserId,
): Promise<CloudZiweiListItem[]> {
  if (isPostgresDriver()) return pgListCloudZiwei(userId);
  await ensureLoaded();
  const bag = memory!.users[userId] ?? {};
  return Object.values(bag)
    .map(toZiweiListItem)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getCloudZiwei(
  userId: UserId,
  chartId: string,
): Promise<CloudZiweiRecord | null> {
  if (isPostgresDriver()) return pgGetCloudZiwei(userId, chartId);
  await ensureLoaded();
  return memory!.users[userId]?.[chartId] ?? null;
}

export async function upsertCloudZiwei(
  userId: UserId,
  body: CloudZiweiUpsertBody,
): Promise<CloudZiweiRecord> {
  if (isPostgresDriver()) return pgUpsertCloudZiwei(userId, body);
  await ensureLoaded();
  const chartId = body.chart?.id;
  if (!chartId || typeof chartId !== "string") {
    throw new Error("缺少 chart.id");
  }

  const now = new Date().toISOString();
  const existing = memory!.users[userId]?.[chartId];
  const chart = { ...body.chart, id: chartId };

  const rec: CloudZiweiRecord = {
    id: chartId,
    userId,
    chart,
    solarDate: body.solarDate ?? existing?.solarDate,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (!memory!.users[userId]) memory!.users[userId] = {};
  memory!.users[userId][chartId] = rec;
  await persist().catch(() => undefined);
  return rec;
}

export async function deleteCloudZiwei(
  userId: UserId,
  chartId: string,
): Promise<boolean> {
  if (isPostgresDriver()) return pgDeleteCloudZiwei(userId, chartId);
  await ensureLoaded();
  const bag = memory!.users[userId];
  if (!bag || !(chartId in bag)) return false;
  delete bag[chartId];
  await persist().catch(() => undefined);
  return true;
}

export async function getAllCloudZiweiForUser(
  userId: UserId,
): Promise<CloudZiweiRecord[]> {
  if (isPostgresDriver()) return pgGetAllCloudZiweiForUser(userId);
  await ensureLoaded();
  return Object.values(memory!.users[userId] ?? {});
}

export async function deleteAllCloudZiweiForUser(
  userId: UserId,
): Promise<number> {
  if (isPostgresDriver()) return pgDeleteAllCloudZiweiForUser(userId);
  await ensureLoaded();
  const bag = memory!.users[userId];
  if (!bag) return 0;
  const n = Object.keys(bag).length;
  delete memory!.users[userId];
  await persist().catch(() => undefined);
  return n;
}
