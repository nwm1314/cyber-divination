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
  deleteCloudLiuyaoApi,
  type CloudApiResult,
} from "./cloud-client";
import type { CloudChartListItem, CloudChartRecord } from "./cloud-types";
import type { ZiweiChart } from "@/lib/types/ziwei";
import {
  deleteLocalArchive,
  type LocalArchiveKind,
} from "./index";
import { getLifecycleStore } from "./mode";
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

export type SyncOperation = "push" | "pull" | "merge" | "delete" | "auto";
export type SyncStatus = "running" | "success" | "partial" | "failure";
export type DeleteScope = "local" | "cloud" | "local-and-cloud";

export type SyncState = {
  operation: SyncOperation;
  status: SyncStatus;
  startedAt: string;
  completedAt?: string;
  successCount: number;
  failureCount: number;
  conflictCount: number;
  failures: { profileId: string; message: string }[];
  message?: string;
  archiveKind?: LocalArchiveKind;
  archiveId?: string;
  scope?: DeleteScope;
};

export type ArchiveDeleteResult = {
  ok: boolean;
  kind: LocalArchiveKind;
  id: string;
  scope: DeleteScope;
  localDeleted: boolean;
  cloudDeleted: boolean;
  message: string;
};

const SYNC_STATE_KEY = "bd_sync_state";
let volatileSyncState: SyncState | null = null;

function writeSyncState(state: SyncState): void {
  volatileSyncState = state;
  try {
    getLifecycleStore()?.setItem(SYNC_STATE_KEY, JSON.stringify(state));
  } catch {
    // The UI can still read the in-memory state for this page lifetime.
  }
}

export function getLastSyncState(): SyncState | null {
  try {
    const raw = getLifecycleStore()?.getItem(SYNC_STATE_KEY);
    if (raw) return JSON.parse(raw) as SyncState;
  } catch {
    // Fall back to the volatile state below.
  }
  return volatileSyncState;
}

export function beginSync(
  operation: SyncOperation,
  extra?: Pick<SyncState, "archiveKind" | "archiveId" | "scope">,
): SyncState {
  const state: SyncState = {
    operation,
    status: "running",
    startedAt: new Date().toISOString(),
    successCount: 0,
    failureCount: 0,
    conflictCount: 0,
    failures: [],
    ...extra,
  };
  writeSyncState(state);
  return state;
}

export function finishSync(input: {
  operation: SyncOperation;
  startedAt: string;
  successCount: number;
  failures?: { profileId: string; message: string }[];
  conflictCount?: number;
  message?: string;
  extra?: Pick<SyncState, "archiveKind" | "archiveId" | "scope">;
}): SyncState {
  const failures = input.failures ?? [];
  const status: SyncStatus =
    failures.length === 0
      ? "success"
      : input.successCount > 0
        ? "partial"
        : "failure";
  const state: SyncState = {
    operation: input.operation,
    status,
    startedAt: input.startedAt,
    completedAt: new Date().toISOString(),
    successCount: input.successCount,
    failureCount: failures.length,
    conflictCount: input.conflictCount ?? 0,
    failures,
    message: input.message,
    ...input.extra,
  };
  writeSyncState(state);
  return state;
}

function syncOperationLabel(operation: SyncOperation): string {
  return {
    push: "推送",
    pull: "拉取",
    merge: "合并",
    delete: "删除",
    auto: "自动同步",
  }[operation];
}

export function formatSyncState(state: SyncState | null): string | null {
  if (!state) return null;
  const operation = syncOperationLabel(state.operation);
  if (state.status === "running") return `${operation}进行中…`;
  const status =
    state.status === "success"
      ? "成功"
      : state.status === "partial"
        ? "部分完成"
        : "失败";
  const counts = `成功 ${state.successCount}，失败 ${state.failureCount}`;
  const conflicts = state.conflictCount > 0 ? `，冲突 ${state.conflictCount}` : "";
  const failures = state.failures.length
    ? `；失败项：${state.failures
        .slice(0, 3)
        .map((item) => `${item.profileId}: ${item.message}`)
        .join("；")}`
    : "";
  return `最近${operation}${status}（${counts}${conflicts}）${
    state.message ? `：${state.message}` : ""
  }${failures}`;
}

function finishListResult(
  operation: "push" | "pull",
  startedAt: string,
  successCount: number,
  failed: { profileId: string; message: string }[],
): void {
  finishSync({ operation, startedAt, successCount, failures: failed });
}

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
  const startedAt = beginSync("push").startedAt;
  const list = listCharts();
  const failed: SyncPushResult["failed"] = [];
  let pushed = 0;
  try {
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
  } catch (error) {
    failed.push({
      profileId: "*",
      message: error instanceof Error ? error.message : "push failed",
    });
    return { pushed, failed };
  } finally {
    finishListResult("push", startedAt, pushed, failed);
  }
}

/**
 * 从云端拉取全部档案写入本机（显式覆盖同 id 本地数据）。
 */
export async function pullCloudChartsToLocal(): Promise<SyncPullResult> {
  const startedAt = beginSync("pull").startedAt;
  let pulled = 0;
  const failed: SyncPullResult["failed"] = [];
  try {
    const listRes = await fetchCloudChartList();
    if (!listRes.ok) {
      failed.push({ profileId: "*", message: listRes.error.message });
      return { pulled, failed, items: [] };
  }

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
  } catch (error) {
    failed.push({
      profileId: "*",
      message: error instanceof Error ? error.message : "pull failed",
    });
    return { pulled, failed, items: [] };
  } finally {
    finishListResult("pull", startedAt, pulled, failed);
  }
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
  const startedAt = beginSync("push").startedAt;
  const list = listZiweiCharts();
  const failed: SyncPushResult["failed"] = [];
  let pushed = 0;
  try {
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
  } catch (error) {
    failed.push({
      profileId: "*",
      message: error instanceof Error ? error.message : "push failed",
    });
    return { pushed, failed };
  } finally {
    finishListResult("push", startedAt, pushed, failed);
  }
}

/** 云端紫微 → 本机 */
export async function pullCloudZiweiToLocal(): Promise<SyncPullResult> {
  const startedAt = beginSync("pull").startedAt;
  let pulled = 0;
  const failed: SyncPullResult["failed"] = [];
  try {
    const listRes = await fetchCloudZiweiList();
    if (!listRes.ok) {
      failed.push({ profileId: "*", message: listRes.error.message });
      return { pulled, failed, items: [] };
  }

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
  } catch (error) {
    failed.push({
      profileId: "*",
      message: error instanceof Error ? error.message : "pull failed",
    });
    return { pulled, failed, items: [] };
  } finally {
    finishListResult("pull", startedAt, pulled, failed);
  }
}

/** 删除云端紫微（不删本地） */
export async function deleteOneCloudZiwei(
  chartId: string,
): Promise<CloudApiResult<{ deleted: boolean }>> {
  return deleteCloudZiweiApi(chartId);
}

/** 本机六爻 → 云端 */
export async function pushLocalLiuyaoToCloud(): Promise<SyncPushResult> {
  const startedAt = beginSync("push").startedAt;
  const list = listLiuyaoCharts();
  const failed: SyncPushResult["failed"] = [];
  let pushed = 0;
  try {
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
  } catch (error) {
    failed.push({
      profileId: "*",
      message: error instanceof Error ? error.message : "push failed",
    });
    return { pushed, failed };
  } finally {
    finishListResult("push", startedAt, pushed, failed);
  }
}

/** 云端六爻 → 本机 */
export async function pullCloudLiuyaoToLocal(): Promise<SyncPullResult> {
  const startedAt = beginSync("pull").startedAt;
  let pulled = 0;
  const failed: SyncPullResult["failed"] = [];
  try {
    const listRes = await fetchCloudLiuyaoList();
    if (!listRes.ok) {
      failed.push({ profileId: "*", message: listRes.error.message });
      return { pulled, failed, items: [] };
  }
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
  } catch (error) {
    failed.push({
      profileId: "*",
      message: error instanceof Error ? error.message : "pull failed",
    });
    return { pulled, failed, items: [] };
  } finally {
    finishListResult("pull", startedAt, pulled, failed);
  }
}

/** Delete one archive with an explicit local/cloud scope. */
export async function deleteArchive(input: {
  kind: LocalArchiveKind;
  id: string;
  scope: DeleteScope;
}): Promise<ArchiveDeleteResult> {
  const startedAt = beginSync("delete", {
    archiveKind: input.kind,
    archiveId: input.id,
    scope: input.scope,
  }).startedAt;
  let localDeleted = false;
  let cloudDeleted = false;
  const failures: { profileId: string; message: string }[] = [];

  try {
    if (input.scope === "local") {
      deleteLocalArchive(input.kind, input.id);
      localDeleted = true;
    } else {
      const result =
        input.kind === "bazi"
          ? await deleteOneCloudChart(input.id)
          : input.kind === "ziwei"
            ? await deleteOneCloudZiwei(input.id)
            : await deleteCloudLiuyaoApi(input.id);
      if (!result.ok) {
        failures.push({ profileId: input.id, message: result.error.message });
      } else {
        cloudDeleted = true;
        if (input.scope === "local-and-cloud") {
          deleteLocalArchive(input.kind, input.id);
          localDeleted = true;
        }
      }
    }

    const ok = failures.length === 0;
    const message = ok
      ? input.scope === "local"
        ? "已删除本机档案；云端档案未改变"
        : input.scope === "cloud"
          ? "已删除云端档案；本机档案未改变"
          : "已删除本机与云端档案"
      : "云端删除失败，本机档案已保留";
    return {
      ok,
      kind: input.kind,
      id: input.id,
      scope: input.scope,
      localDeleted,
      cloudDeleted,
      message,
    };
  } finally {
    finishSync({
      operation: "delete",
      startedAt,
      successCount: localDeleted || cloudDeleted ? 1 : 0,
      failures,
      extra: {
        archiveKind: input.kind,
        archiveId: input.id,
        scope: input.scope,
      },
    });
  }
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
  const startedAt = beginSync("auto").startedAt;
  let result: AutoSyncResult | null = null;
  let unexpectedFailure: { profileId: string; message: string }[] = [];
  try {
    const baziPush = await pushLocalChartsToCloud();
    const ziweiPush = await pushLocalZiweiToCloud();
    const liuyaoPush = await pushLocalLiuyaoToCloud();
    const baziPull = await pullCloudChartsToLocal();
    const ziweiPull = await pullCloudZiweiToLocal();
    const liuyaoPull = await pullCloudLiuyaoToLocal();
    result = {
      baziPush,
      ziweiPush,
      liuyaoPush,
      baziPull,
      ziweiPull,
      liuyaoPull,
    };
    return result;
  } catch (error) {
    unexpectedFailure = [
      {
        profileId: "*",
        message: error instanceof Error ? error.message : "auto sync failed",
      },
    ];
    throw error;
  } finally {
    const groups = result
      ? [
          result.baziPush,
          result.ziweiPush,
          result.liuyaoPush,
          result.baziPull,
          result.ziweiPull,
          result.liuyaoPull,
        ]
      : [];
    finishSync({
      operation: "auto",
      startedAt,
      successCount: groups.reduce(
        (total, item) => total + ("pushed" in item ? item.pushed : item.pulled),
        0,
      ),
      failures: [
        ...groups.flatMap((item) => item.failed),
        ...unexpectedFailure,
      ],
    });
  }
}

export type { ListEntry, CloudChartListItem, CloudChartRecord };
