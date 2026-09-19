/**
 * Postgres 八字档案（T223）
 */

import "server-only";
import type { UserId } from "@/lib/types/user";
import type { BirthProfile, BaziChart, ReadingReport } from "@/lib/types";
import type { CalibrationData } from "@/lib/reading/calibrate";
import { ensureSchema, getSql } from "@/lib/db";
import {
  assertVersionWritable,
  normalizeVersion,
  VersionConflictError,
} from "./version-guard";
import type {
  CloudChartListItem,
  CloudChartRecord,
  CloudChartUpsertBody,
} from "./cloud-types";
import { toListItem } from "./cloud-types";

function rowToRecord(row: {
  id: string;
  user_id: string;
  profile_json: unknown;
  chart_json: unknown;
  report_json: unknown | null;
  calibrate_json: unknown | null;
  version?: number;
  created_at: string | Date;
  updated_at: string | Date;
}): CloudChartRecord {
  return {
    id: row.id,
    userId: row.user_id,
    profile: row.profile_json as BirthProfile,
    chart: row.chart_json as BaziChart,
    report: (row.report_json as ReadingReport | null) ?? null,
    calibration: (row.calibrate_json as CalibrationData | null) ?? null,
    // 版本来自列（唯一真相），旧库缺列时按 0
    version: normalizeVersion(row.version),
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

export async function pgListCloudCharts(
  userId: UserId,
): Promise<CloudChartListItem[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM bazi_charts WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;
  return rows.map((r) => toListItem(rowToRecord(r as never)));
}

export async function pgGetCloudChart(
  userId: UserId,
  profileId: string,
): Promise<CloudChartRecord | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM bazi_charts WHERE user_id = ${userId} AND id = ${profileId}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return rowToRecord(rows[0] as never);
}

export async function pgUpsertCloudChart(
  userId: UserId,
  body: CloudChartUpsertBody,
  options?: { expectedVersion?: number },
): Promise<CloudChartRecord> {
  await ensureSchema();
  const profileId = body.profile?.id ?? body.chart?.profileId;
  if (!profileId || typeof profileId !== "string") {
    throw new Error("缺少 profile.id / chart.profileId");
  }
  if (body.chart.profileId !== profileId) {
    throw new Error("profile.id 与 chart.profileId 不一致");
  }

  const existing = await pgGetCloudChart(userId, profileId);
  const now = new Date().toISOString();
  const expected = options?.expectedVersion;
  const version = assertVersionWritable({
    resource: "chart",
    resourceId: profileId,
    storedVersion: existing?.version,
    expectedVersion: expected,
  });
  const profile = { ...body.profile, id: profileId, userId };
  const chart = { ...body.chart, profileId };

  let report = body.report ?? existing?.report ?? null;
  let calibration = body.calibration ?? existing?.calibration ?? null;
  if (body.report === null) report = null;
  if (body.calibration === null) calibration = null;
  if (body.report !== undefined && body.report !== null) report = body.report;
  if (body.calibration !== undefined && body.calibration !== null) {
    calibration = body.calibration;
  }

  const createdAt = existing?.createdAt ?? now;
  const sql = getSql();

  // 带 expectedVersion 时加 WHERE，让「比较 + 覆盖」在一条语句内原子完成；
  // 不带时保持旧的后写覆盖行为。两条分支都 RETURNING，供调用方判断是否真的写入。
  const written = await sql`
    INSERT INTO bazi_charts (
      id, user_id, profile_json, chart_json, report_json, calibrate_json, version, created_at, updated_at
    ) VALUES (
      ${profileId},
      ${userId},
      ${sql.json(profile as never)},
      ${sql.json(chart as never)},
      ${report == null ? null : sql.json(report as never)},
      ${calibration == null ? null : sql.json(calibration as never)},
      ${version},
      ${createdAt},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      profile_json = EXCLUDED.profile_json,
      chart_json = EXCLUDED.chart_json,
      report_json = EXCLUDED.report_json,
      calibrate_json = EXCLUDED.calibrate_json,
      version = bazi_charts.version + 1,
      updated_at = EXCLUDED.updated_at
    ${
      expected === undefined
        ? sql``
        : sql`WHERE bazi_charts.version = ${expected}`
    }
    RETURNING id
  `;
  if (expected !== undefined && written.length === 0) {
    const current = await pgGetCloudChart(userId, profileId);
    throw new VersionConflictError(
      "chart",
      profileId,
      expected,
      normalizeVersion(current?.version),
    );
  }

  return {
    id: profileId,
    userId,
    profile,
    chart,
    report,
    calibration,
    version,
    createdAt,
    updatedAt: now,
  };
}

export async function pgDeleteCloudChart(
  userId: UserId,
  profileId: string,
): Promise<boolean> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM bazi_charts WHERE user_id = ${userId} AND id = ${profileId}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function pgGetAllCloudChartsForUser(
  userId: UserId,
): Promise<CloudChartRecord[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM bazi_charts WHERE user_id = ${userId}
  `;
  return rows.map((r) => rowToRecord(r as never));
}

export async function pgDeleteAllCloudChartsForUser(
  userId: UserId,
): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM bazi_charts WHERE user_id = ${userId}
    RETURNING id
  `;
  return rows.length;
}
