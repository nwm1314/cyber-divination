/**
 * 云端档案存储（T82 / T223）
 * 默认：data/cloud-charts.json；有 DATABASE_URL 时走 Postgres。
 */

import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { UserId } from "@/lib/types/user";
import type {
  CloudChartRecord,
  CloudChartUpsertBody,
  CloudChartsFile,
  CloudChartListItem,
} from "./cloud-types";
import { toListItem } from "./cloud-types";
import { getCloudStoreDriver } from "./driver";
import {
  pgDeleteAllCloudChartsForUser,
  pgDeleteCloudChart,
  pgGetAllCloudChartsForUser,
  pgGetCloudChart,
  pgListCloudCharts,
  pgUpsertCloudChart,
} from "./pg-bazi-store";

function isPostgresDriver(): boolean {
  return getCloudStoreDriver() === "postgres";
}

const EMPTY: CloudChartsFile = { version: 1, users: {} };

let memory: CloudChartsFile | null = null;
let loaded = false;

function dataFile(): string {
  return path.join(process.cwd(), "data", "cloud-charts.json");
}

async function ensureLoaded(): Promise<void> {
  if (loaded && memory) return;
  loaded = true;
  try {
    const raw = await fs.readFile(dataFile(), "utf-8");
    const parsed = JSON.parse(raw) as CloudChartsFile;
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

/** 测试用：重置内存表 */
export function resetCloudStoreForTests(): void {
  memory = { version: 1, users: {} };
  loaded = true;
}

/** 测试用：强制从文件重载 */
export function unloadCloudStoreForTests(): void {
  memory = null;
  loaded = false;
}

export async function listCloudCharts(
  userId: UserId,
): Promise<CloudChartListItem[]> {
  if (isPostgresDriver()) return pgListCloudCharts(userId);
  await ensureLoaded();
  const bag = memory!.users[userId] ?? {};
  return Object.values(bag)
    .map(toListItem)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getCloudChart(
  userId: UserId,
  profileId: string,
): Promise<CloudChartRecord | null> {
  if (isPostgresDriver()) return pgGetCloudChart(userId, profileId);
  await ensureLoaded();
  return memory!.users[userId]?.[profileId] ?? null;
}

/**
 * 保存/覆盖本人档案；强制写入 userId，忽略 body 内 profile.userId 伪造
 */
export async function upsertCloudChart(
  userId: UserId,
  body: CloudChartUpsertBody,
): Promise<CloudChartRecord> {
  if (isPostgresDriver()) return pgUpsertCloudChart(userId, body);
  await ensureLoaded();
  const profileId = body.profile?.id ?? body.chart?.profileId;
  if (!profileId || typeof profileId !== "string") {
    throw new Error("缺少 profile.id / chart.profileId");
  }
  if (body.chart.profileId !== profileId) {
    throw new Error("profile.id 与 chart.profileId 不一致");
  }

  const now = new Date().toISOString();
  const existing = memory!.users[userId]?.[profileId];
  const profile = {
    ...body.profile,
    id: profileId,
    userId,
  };
  const chart = { ...body.chart, profileId };

  const rec: CloudChartRecord = {
    id: profileId,
    userId,
    profile,
    chart,
    report: body.report ?? existing?.report ?? null,
    calibration: body.calibration ?? existing?.calibration ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  // 显式 null 表示清除
  if (body.report === null) rec.report = null;
  if (body.calibration === null) rec.calibration = null;
  if (body.report !== undefined && body.report !== null) rec.report = body.report;
  if (body.calibration !== undefined && body.calibration !== null) {
    rec.calibration = body.calibration;
  }

  if (!memory!.users[userId]) memory!.users[userId] = {};
  memory!.users[userId][profileId] = rec;
  await persist().catch(() => undefined);
  return rec;
}

export async function deleteCloudChart(
  userId: UserId,
  profileId: string,
): Promise<boolean> {
  if (isPostgresDriver()) return pgDeleteCloudChart(userId, profileId);
  await ensureLoaded();
  const bag = memory!.users[userId];
  if (!bag || !(profileId in bag)) return false;
  delete bag[profileId];
  await persist().catch(() => undefined);
  return true;
}

/** 某用户全部云端档案（T84 导出 / 内部） */
export async function getAllCloudChartsForUser(
  userId: UserId,
): Promise<CloudChartRecord[]> {
  if (isPostgresDriver()) return pgGetAllCloudChartsForUser(userId);
  await ensureLoaded();
  return Object.values(memory!.users[userId] ?? {});
}

/** 删除某用户全部云端档案（T84 删账号） */
export async function deleteAllCloudChartsForUser(
  userId: UserId,
): Promise<number> {
  if (isPostgresDriver()) return pgDeleteAllCloudChartsForUser(userId);
  await ensureLoaded();
  const bag = memory!.users[userId];
  if (!bag) return 0;
  const n = Object.keys(bag).length;
  delete memory!.users[userId];
  await persist().catch(() => undefined);
  return n;
}
