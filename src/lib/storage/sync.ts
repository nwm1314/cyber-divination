/**
 * 客户端同步策略（T82 / T224）
 *
 * ## 策略摘要
 * 1. **未登录**：仅 localStorage / IndexedDB，不请求云端。
 * 2. **已登录**：本地仍为主路径；云端可推拉。
 * 3. **推送（push）**：本机 upsert 到云端（按 id 覆盖云端）。
 * 4. **拉取（pull）**：云端写入本机；同 id 用云端覆盖（显式或登录自动）。
 * 5. **登录自动同步（T224）**：`autoSyncAfterLogin` = 先 push 本地 → 再 pull 云端
 *    - 冲突：后写的 pull 以云端为准覆盖同 id；仅本地的已在 push 上传
 *    - 失败可重试，不丢本地
 * 6. **迁移合并（T83）**：`POST /api/charts/migrate` 按 updatedAt 较新者胜
 *
 * 覆盖：八字 + 紫微 + 六爻（Person 随档案 id 关联，本卡不单独 push 实体列表）。
 */

import type { BirthProfile, BaziChart, ReadingReport } from "@/lib/types";
import type { CalibrationData } from "@/lib/reading/calibrate";
import {
  saveProfile,
  getProfile,
  saveChart,
  getChart,
  saveReport,
  getReport,
  saveCalibration,
  getCalibration,
  listCharts,
  type ListEntry,
} from "./index";
import {
  fetchCloudChartList,
  fetchCloudChart,
  upsertCloudChartApi,
  deleteCloudChartApi,
  fetchCloudZiweiList,
  fetchCloudZiwei,
  upsertCloudZiweiApi,
  deleteCloudZiweiApi,
  fetchCloudLiuyaoList,
  fetchCloudLiuyao,
  upsertCloudLiuyaoApi,
  type CloudApiResult,
} from "./cloud-client";
import type { CloudChartListItem, CloudChartRecord } from "./cloud-types";
import type { ZiweiChart } from "@/lib/types/ziwei";
import {
  saveZiweiChart,
  getZiweiChart,
  listZiweiCharts,
  saveLiuyaoChart,
  getLiuyaoChart,
  listLiuyaoCharts,
} from "./index";

export type SyncPushResult = {
  pushed: number;
  failed: { profileId: string; message: string }[];
};

export type SyncPullResult = {
  pulled: number;
  failed: { profileId: string; message: string }[];
  items: CloudChartListItem[];
};

function applyRecordToLocal(rec: CloudChartRecord): void {
  saveProfile(rec.profile);
  saveChart(rec.chart);
  if (rec.report) saveReport(rec.report);
  if (rec.calibration) saveCalibration(rec.calibration);
}

/**
 * 将本机全部档案推送到云端（需已登录 cookie）。
 * 单条失败不中断其余。
 */
export async function pushLocalChartsToCloud(): Promise<SyncPushResult> {
  const list = listCharts();
  const failed: SyncPushResult["failed"] = [];
  let pushed = 0;

  for (const entry of list) {
    const profile = getProfile(entry.profileId);
    const chart = getChart(entry.profileId);
    if (!profile || !chart) {
      failed.push({
        profileId: entry.profileId,
        message: "本地缺少 profile 或 chart",
      });
      continue;
    }
    const report = getReport(entry.profileId);
    const calibration = getCalibration(entry.profileId);
    const res = await upsertCloudChartApi({
      profile,
      chart,
      report,
      calibration,
    });
    if (!res.ok) {
      failed.push({
        profileId: entry.profileId,
        message: res.error.message,
      });
      continue;
    }
    pushed += 1;
  }

  return { pushed, failed };
}

/**
 * 从云端拉取全部档案写入本机（显式覆盖同 id 本地数据）。
 */
export async function pullCloudChartsToLocal(): Promise<SyncPullResult> {
  const listRes = await fetchCloudChartList();
  if (!listRes.ok) {
    return {
      pulled: 0,
      failed: [{ profileId: "*", message: listRes.error.message }],
      items: [],
    };
  }

  const failed: SyncPullResult["failed"] = [];
  let pulled = 0;
  const items = listRes.data.items;

  for (const item of items) {
    const detail = await fetchCloudChart(item.profileId);
    if (!detail.ok) {
      failed.push({
        profileId: item.profileId,
        message: detail.error.message,
      });
      continue;
    }
    applyRecordToLocal(detail.data.record);
    pulled += 1;
  }

  return { pulled, failed, items };
}

/** 推送单条（排盘完成后可选） */
export async function pushOneChart(input: {
  profile: BirthProfile;
  chart: BaziChart;
  report?: ReadingReport | null;
  calibration?: CalibrationData | null;
}): Promise<CloudApiResult<{ record: CloudChartRecord }>> {
  return upsertCloudChartApi({
    profile: input.profile,
    chart: input.chart,
    report: input.report,
    calibration: input.calibration,
  });
}

/** 删除云端单条（不删本地） */
export async function deleteOneCloudChart(
  profileId: string,
): Promise<CloudApiResult<{ deleted: boolean }>> {
  return deleteCloudChartApi(profileId);
}

// —— 紫微同步（T107）——

/** 推送单条紫微（排盘后可选；登录失败静默） */
export async function pushOneZiwei(input: {
  chart: ZiweiChart;
  solarDate?: string;
}): Promise<CloudApiResult<{ record: unknown }>> {
  return upsertCloudZiweiApi({
    chart: input.chart,
    solarDate: input.solarDate,
  });
}

/** 本机全部紫微 → 云端 */
export async function pushLocalZiweiToCloud(): Promise<SyncPushResult> {
  const list = listZiweiCharts();
  const failed: SyncPushResult["failed"] = [];
  let pushed = 0;

  for (const entry of list) {
    const chart = getZiweiChart(entry.chartId);
    if (!chart) {
      failed.push({
        profileId: entry.chartId,
        message: "本地缺少紫微盘",
      });
      continue;
    }
    const res = await upsertCloudZiweiApi({
      chart,
      solarDate: entry.date,
    });
    if (!res.ok) {
      failed.push({
        profileId: entry.chartId,
        message: res.error.message,
      });
      continue;
    }
    pushed += 1;
  }

  return { pushed, failed };
}

/** 云端紫微 → 本机 */
export async function pullCloudZiweiToLocal(): Promise<SyncPullResult> {
  const listRes = await fetchCloudZiweiList();
  if (!listRes.ok) {
    return {
      pulled: 0,
      failed: [{ profileId: "*", message: listRes.error.message }],
      items: [],
    };
  }

  const failed: SyncPullResult["failed"] = [];
  let pulled = 0;
  const items = listRes.data.items;

  for (const item of items) {
    const detail = await fetchCloudZiwei(item.chartId);
    if (!detail.ok) {
      failed.push({
        profileId: item.chartId,
        message: detail.error.message,
      });
      continue;
    }
    const rec = detail.data.record;
    saveZiweiChart(rec.chart, { solarDate: rec.solarDate ?? item.date });
    pulled += 1;
  }

  return {
    pulled,
    failed,
    items: items.map((i) => ({
      profileId: i.chartId,
      name: i.name,
      date: i.date,
      updatedAt: i.updatedAt,
    })),
  };
}

/** 删除云端紫微（不删本地） */
export async function deleteOneCloudZiwei(
  chartId: string,
): Promise<CloudApiResult<{ deleted: boolean }>> {
  return deleteCloudZiweiApi(chartId);
}

/** 本机六爻 → 云端 */
export async function pushLocalLiuyaoToCloud(): Promise<SyncPushResult> {
  const list = listLiuyaoCharts();
  const failed: SyncPushResult["failed"] = [];
  let pushed = 0;
  for (const entry of list) {
    const chart = getLiuyaoChart(entry.id);
    if (!chart) {
      failed.push({ profileId: entry.id, message: "本地无卦盘" });
      continue;
    }
    const res = await upsertCloudLiuyaoApi({ chart });
    if (!res.ok) {
      failed.push({ profileId: entry.id, message: res.error.message });
      continue;
    }
    pushed += 1;
  }
  return { pushed, failed };
}

/** 云端六爻 → 本机 */
export async function pullCloudLiuyaoToLocal(): Promise<SyncPullResult> {
  const listRes = await fetchCloudLiuyaoList();
  if (!listRes.ok) {
    return {
      pulled: 0,
      failed: [{ profileId: "*", message: listRes.error.message }],
      items: [],
    };
  }
  const failed: SyncPullResult["failed"] = [];
  let pulled = 0;
  for (const item of listRes.data.items) {
    const detail = await fetchCloudLiuyao(item.chartId);
    if (!detail.ok) {
      failed.push({
        profileId: item.chartId,
        message: detail.error.message,
      });
      continue;
    }
    saveLiuyaoChart(detail.data.record.chart);
    pulled += 1;
  }
  return {
    pulled,
    failed,
    items: listRes.data.items.map((i) => ({
      profileId: i.chartId,
      name: i.question,
      date: i.updatedAt.slice(0, 10),
      updatedAt: i.updatedAt,
    })),
  };
}

export type AutoSyncResult = {
  baziPush: SyncPushResult;
  ziweiPush: SyncPushResult;
  liuyaoPush: SyncPushResult;
  baziPull: SyncPullResult;
  ziweiPull: SyncPullResult;
  liuyaoPull: SyncPullResult;
};

/**
 * 登录后自动同步（T224）
 * 先推本地，再拉云端；失败不抛、可重试。
 */
export async function autoSyncAfterLogin(): Promise<AutoSyncResult> {
  const baziPush = await pushLocalChartsToCloud();
  const ziweiPush = await pushLocalZiweiToCloud();
  const liuyaoPush = await pushLocalLiuyaoToCloud();
  const baziPull = await pullCloudChartsToLocal();
  const ziweiPull = await pullCloudZiweiToLocal();
  const liuyaoPull = await pullCloudLiuyaoToLocal();
  return {
    baziPush,
    ziweiPush,
    liuyaoPush,
    baziPull,
    ziweiPull,
    liuyaoPull,
  };
}

export type { ListEntry, CloudChartListItem, CloudChartRecord };
