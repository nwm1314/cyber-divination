/**
 * 云端档案清理/导出钩子（T84 + T107 紫微 + T121 Person + T225/T226 六爻）
 */

import type { UserId } from "@/lib/types/user";
import {
  deleteAllCloudChartsForUser,
  getAllCloudChartsForUser,
} from "./cloud-store";
import {
  deleteAllCloudZiweiForUser,
  getAllCloudZiweiForUser,
} from "./cloud-ziwei-store";
import {
  deleteAllCloudPeopleForUser,
  listCloudPeople,
} from "./cloud-person-store";
import {
  deleteAllCloudLiuyaoForUser,
  getAllCloudLiuyaoForUser,
} from "./cloud-liuyao-store";

export type CloudExportPayload = {
  profiles: unknown[];
  charts: unknown[];
  reports: unknown[];
  calibrations: unknown[];
  ziweiCharts?: unknown[];
  people?: unknown[];
  liuyaoCharts?: unknown[];
};

/** 删除某用户全部云端档案（八字 + 紫微 + Person + 六爻） */
export async function deleteCloudDataForUser(
  userId: UserId,
): Promise<number> {
  const bazi = await deleteAllCloudChartsForUser(userId);
  const ziwei = await deleteAllCloudZiweiForUser(userId);
  const people = await deleteAllCloudPeopleForUser(userId);
  const liuyao = await deleteAllCloudLiuyaoForUser(userId);
  return bazi + ziwei + people + liuyao;
}

/** 导出某用户云端档案（三术 + Person） */
export async function exportCloudDataForUser(
  userId: UserId,
): Promise<CloudExportPayload> {
  const records = await getAllCloudChartsForUser(userId);
  const profiles: unknown[] = [];
  const charts: unknown[] = [];
  const reports: unknown[] = [];
  const calibrations: unknown[] = [];

  for (const rec of records) {
    profiles.push(rec.profile);
    charts.push(rec.chart);
    if (rec.report) reports.push(rec.report);
    if (rec.calibration) calibrations.push(rec.calibration);
  }

  const ziweiRecs = await getAllCloudZiweiForUser(userId);
  const ziweiCharts = ziweiRecs.map((r) => r.chart);
  const people = await listCloudPeople(userId);
  const liuyaoRecs = await getAllCloudLiuyaoForUser(userId);
  const liuyaoCharts = liuyaoRecs.map((r) => r.chart);

  return {
    profiles,
    charts,
    reports,
    calibrations,
    ziweiCharts,
    people,
    liuyaoCharts,
  };
}
