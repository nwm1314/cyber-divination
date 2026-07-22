/**
 * Postgres 紫微档案（T223）
 */

import type { UserId } from "@/lib/types/user";
import type { ZiweiChart } from "@/lib/types/ziwei";
import { ensureSchema, getSql } from "@/lib/db";
import type {
  CloudZiweiListItem,
  CloudZiweiRecord,
  CloudZiweiUpsertBody,
} from "./cloud-ziwei-types";
import { toZiweiListItem } from "./cloud-ziwei-types";

function rowToRecord(row: {
  id: string;
  user_id: string;
  chart_json: unknown;
  solar_date: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}): CloudZiweiRecord {
  return {
    id: row.id,
    userId: row.user_id,
    chart: row.chart_json as ZiweiChart,
    solarDate: row.solar_date ?? undefined,
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

export async function pgListCloudZiwei(
  userId: UserId,
): Promise<CloudZiweiListItem[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM ziwei_charts WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;
  return rows.map((r) => toZiweiListItem(rowToRecord(r as never)));
}

export async function pgGetCloudZiwei(
  userId: UserId,
  chartId: string,
): Promise<CloudZiweiRecord | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM ziwei_charts WHERE user_id = ${userId} AND id = ${chartId}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return rowToRecord(rows[0] as never);
}

export async function pgUpsertCloudZiwei(
  userId: UserId,
  body: CloudZiweiUpsertBody,
): Promise<CloudZiweiRecord> {
  await ensureSchema();
  const chartId = body.chart?.id;
  if (!chartId || typeof chartId !== "string") {
    throw new Error("缺少 chart.id");
  }
  const existing = await pgGetCloudZiwei(userId, chartId);
  const now = new Date().toISOString();
  const chart = { ...body.chart, id: chartId, userId };
  const solarDate = body.solarDate ?? existing?.solarDate ?? null;
  const createdAt = existing?.createdAt ?? now;
  const sql = getSql();
  await sql`
    INSERT INTO ziwei_charts (id, user_id, chart_json, solar_date, created_at, updated_at)
    VALUES (
      ${chartId},
      ${userId},
      ${sql.json(chart as never)},
      ${solarDate},
      ${createdAt},
      ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      chart_json = EXCLUDED.chart_json,
      solar_date = EXCLUDED.solar_date,
      updated_at = EXCLUDED.updated_at
  `;
  return {
    id: chartId,
    userId,
    chart,
    solarDate: solarDate ?? undefined,
    createdAt,
    updatedAt: now,
  };
}

export async function pgDeleteCloudZiwei(
  userId: UserId,
  chartId: string,
): Promise<boolean> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM ziwei_charts WHERE user_id = ${userId} AND id = ${chartId}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function pgGetAllCloudZiweiForUser(
  userId: UserId,
): Promise<CloudZiweiRecord[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`SELECT * FROM ziwei_charts WHERE user_id = ${userId}`;
  return rows.map((r) => rowToRecord(r as never));
}

export async function pgDeleteAllCloudZiweiForUser(
  userId: UserId,
): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM ziwei_charts WHERE user_id = ${userId} RETURNING id
  `;
  return rows.length;
}
