/**
 * 云端八字档案类型（T82）
 *
 * ## 未来 Postgres 示意（本卡用 JSON 文件模拟，形状对齐）
 *
 * ```sql
 * -- users 见 auth
 * CREATE TABLE bazi_charts (
 *   id           TEXT PRIMARY KEY,          -- = profile.id
 *   user_id      TEXT NOT NULL REFERENCES users(id),
 *   profile_json JSONB NOT NULL,
 *   chart_json   JSONB NOT NULL,
 *   report_json  JSONB,
 *   calibrate_json JSONB,
 *   created_at   TIMESTAMPTZ NOT NULL,
 *   updated_at   TIMESTAMPTZ NOT NULL
 * );
 * CREATE INDEX bazi_charts_user_id_idx ON bazi_charts(user_id);
 * ```
 *
 * 权限：仅 `user_id = session.userId` 可读写。
 */

import type { BirthProfile, BaziChart, ReadingReport } from "@/lib/types";
import type { UserId } from "@/lib/types/user";
import type { CalibrationData } from "@/lib/reading/calibrate";

/** 云端单条档案（profile + chart + 可选 report/校准） */
export type CloudChartRecord = {
  /** 与 BirthProfile.id / chart.profileId 一致 */
  id: string;
  userId: UserId;
  profile: BirthProfile;
  chart: BaziChart;
  report?: ReadingReport | null;
  calibration?: CalibrationData | null;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
};

/** 列表摘要（与本地 ListEntry 兼容并扩展） */
export type CloudChartListItem = {
  profileId: string;
  name: string;
  date: string;
  updatedAt: string;
};

/** POST /api/charts 请求体 */
export type CloudChartUpsertBody = {
  profile: BirthProfile;
  chart: BaziChart;
  report?: ReadingReport | null;
  calibration?: CalibrationData | null;
};

/** 文件后端全量结构：按 userId 分区 */
export type CloudChartsFile = {
  /** schema 版本，便于迁移 */
  version: 1;
  users: Record<UserId, Record<string, CloudChartRecord>>;
};

export function toListItem(rec: CloudChartRecord): CloudChartListItem {
  return {
    profileId: rec.id,
    name: rec.profile.name,
    date: rec.profile.analysisBaseDate,
    updatedAt: rec.updatedAt,
  };
}
