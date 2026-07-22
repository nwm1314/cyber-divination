/**
 * 本地 → 云端迁移与合并（T83）
 *
 * ## 冲突策略（文档化）
 * 1. **同 id**：比较 `updatedAt`（ISO 8601），保留较新者；
 *    - 本地无时间戳 → **云端优先**（不覆盖云端，并建议拉取）；
 *    - 云端无时间戳（异常）→ 本地优先上传；
 *    - 时间相等 → 云端优先（不覆盖）。
 * 2. **仅本地有**：上传到云端。
 * 3. **仅云端有**：默认拉取到本地（`pullCloudOnly: true` 可关）。
 * 4. **永不删除**：合并只增改，不删任一侧档案。
 * 5. **可跳过**：客户端 `skipMigratePrompt` / sessionStorage，本次不弹引导。
 */

import type { BirthProfile, BaziChart, ReadingReport } from "@/lib/types";
import type { CalibrationData } from "@/lib/reading/calibrate";
import {
  getCalibration,
  getChart,
  getProfile,
  getReport,
  listCharts,
  saveCalibration,
  saveChart,
  saveProfile,
  saveReport,
} from "./index";
import type {
  CloudChartRecord,
  CloudChartUpsertBody,
} from "./cloud-types";

/** 迁移请求中的单条本地档案（可带本地时间戳） */
export type LocalChartBundle = CloudChartUpsertBody & {
  profileId: string;
  /** 本机侧更新时间；缺省则同 id 冲突时云端优先 */
  localUpdatedAt?: string | null;
};

/** 合并决策种类 */
export type MergeDecisionKind =
  | "upload"
  | "pull"
  | "keep_local"
  | "keep_cloud"
  | "equal_cloud";

export type MergeDecision = {
  profileId: string;
  kind: MergeDecisionKind;
  reason: string;
  localUpdatedAt?: string | null;
  cloudUpdatedAt?: string | null;
};

export type MergePlanOptions = {
  /** 是否把仅云端有的档案列入拉取（默认 true） */
  pullCloudOnly?: boolean;
};

export type MergePlan = {
  decisions: MergeDecision[];
  toUpload: string[];
  toPull: string[];
};

export type MigrateRequestBody = {
  charts: LocalChartBundle[];
  options?: MergePlanOptions;
};

export type MigrateResponseBody = {
  summary: {
    uploaded: number;
    pulled: number;
    keptLocal: number;
    keptCloud: number;
    equal: number;
  };
  decisions: MergeDecision[];
  /** 需写入本机的云端档案（仅云端 / 云端胜出） */
  pullRecords: CloudChartRecord[];
  /** 最终云端列表摘要 id */
  cloudProfileIds: string[];
};

export type MigrateClientResult = {
  ok: boolean;
  status: number;
  message: string;
  summary?: MigrateResponseBody["summary"];
  decisions?: MergeDecision[];
  pullCount?: number;
};

const SKIP_KEY = "bd_migrate_skip";
const DONE_KEY = "bd_migrate_done";

/**
 * 收集本机全部可迁移档案（供合并 UI / 批量推送）
 * 跳过缺少 profile 或 chart 的条目。
 */
export function collectLocalChartsForMigrate(): LocalChartBundle[] {
  const out: LocalChartBundle[] = [];
  for (const entry of listCharts()) {
    const profile = getProfile(entry.profileId);
    const chart = getChart(entry.profileId);
    if (!profile || !chart) continue;
    const report: ReadingReport | null = getReport(entry.profileId);
    const calibration: CalibrationData | null = getCalibration(
      entry.profileId,
    );
    const localUpdatedAt = readLocalUpdatedAt(entry.profileId);
    out.push({
      profileId: entry.profileId,
      profile: profile as BirthProfile,
      chart: chart as BaziChart,
      report,
      calibration,
      localUpdatedAt,
    });
  }
  return out;
}

/** 简单冲突键：同 profileId 视为同一档案 */
export function sameProfileId(a: string, b: string): boolean {
  return a === b;
}

/**
 * 比较两侧 updatedAt，决定胜者。
 * - 两侧皆有效：较新者胜；相等 → cloud
 * - 仅一侧有效：该侧胜
 * - 皆无效：cloud（云端优先）
 */
export function pickConflictWinner(
  localUpdatedAt?: string | null,
  cloudUpdatedAt?: string | null,
): "local" | "cloud" {
  const l = parseIsoMs(localUpdatedAt);
  const c = parseIsoMs(cloudUpdatedAt);
  if (l == null && c == null) return "cloud";
  if (l == null) return "cloud";
  if (c == null) return "local";
  if (l > c) return "local";
  return "cloud";
}

export function parseIsoMs(iso?: string | null): number | null {
  if (!iso || typeof iso !== "string") return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * 纯函数：根据本地/云端 id 与时间戳生成合并计划（不 I/O）。
 * localMeta / cloudMeta 的 key 均为 profileId。
 */
export function planMerge(
  localMeta: Record<string, { updatedAt?: string | null }>,
  cloudMeta: Record<string, { updatedAt?: string | null }>,
  options?: MergePlanOptions,
): MergePlan {
  const pullCloudOnly = options?.pullCloudOnly !== false;
  const localIds = new Set(Object.keys(localMeta));
  const cloudIds = new Set(Object.keys(cloudMeta));
  const all = new Set([...localIds, ...cloudIds]);
  const decisions: MergeDecision[] = [];
  const toUpload: string[] = [];
  const toPull: string[] = [];

  for (const id of all) {
    const hasL = localIds.has(id);
    const hasC = cloudIds.has(id);
    const lu = localMeta[id]?.updatedAt ?? null;
    const cu = cloudMeta[id]?.updatedAt ?? null;

    if (hasL && !hasC) {
      decisions.push({
        profileId: id,
        kind: "upload",
        reason: "仅本地有，上传云端",
        localUpdatedAt: lu,
        cloudUpdatedAt: null,
      });
      toUpload.push(id);
      continue;
    }

    if (!hasL && hasC) {
      if (pullCloudOnly) {
        decisions.push({
          profileId: id,
          kind: "pull",
          reason: "仅云端有，拉取到本地",
          localUpdatedAt: null,
          cloudUpdatedAt: cu,
        });
        toPull.push(id);
      } else {
        decisions.push({
          profileId: id,
          kind: "keep_cloud",
          reason: "仅云端有，已关闭拉取",
          localUpdatedAt: null,
          cloudUpdatedAt: cu,
        });
      }
      continue;
    }

    // 同 id
    const lMs = parseIsoMs(lu);
    const cMs = parseIsoMs(cu);
    if (lMs != null && cMs != null && lMs === cMs) {
      decisions.push({
        profileId: id,
        kind: "equal_cloud",
        reason: "时间戳相同，云端优先不覆盖",
        localUpdatedAt: lu,
        cloudUpdatedAt: cu,
      });
      continue;
    }

    const winner = pickConflictWinner(lu, cu);
    if (winner === "local") {
      decisions.push({
        profileId: id,
        kind: "keep_local",
        reason:
          lMs != null && cMs != null
            ? "本地 updatedAt 较新，上传覆盖云端"
            : "云端无时间戳，本地优先上传",
        localUpdatedAt: lu,
        cloudUpdatedAt: cu,
      });
      toUpload.push(id);
    } else {
      decisions.push({
        profileId: id,
        kind: "keep_cloud",
        reason:
          lMs == null
            ? "本地无时间戳，云端优先并拉取"
            : "云端 updatedAt 较新或相等，拉取覆盖本地",
        localUpdatedAt: lu,
        cloudUpdatedAt: cu,
      });
      toPull.push(id);
    }
  }

  decisions.sort((a, b) => a.profileId.localeCompare(b.profileId));
  return { decisions, toUpload, toPull };
}

/** 将云端记录写入本机（不丢盘：只覆盖同 id） */
export function applyCloudRecordToLocal(rec: CloudChartRecord): void {
  saveProfile(rec.profile);
  saveChart(rec.chart);
  if (rec.report) saveReport(rec.report);
  if (rec.calibration) saveCalibration(rec.calibration);
  touchLocalUpdatedAt(rec.id, rec.updatedAt);
}

/**
 * 浏览器侧：调用 POST /api/charts/migrate 并应用 pullRecords。
 */
export async function runMigrateFromLocal(
  options?: MergePlanOptions,
): Promise<MigrateClientResult> {
  const charts = collectLocalChartsForMigrate();
  const res = await fetch("/api/charts/migrate", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      charts,
      options: { pullCloudOnly: options?.pullCloudOnly !== false },
    } satisfies MigrateRequestBody),
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const err = (body as { error?: { message?: string } })?.error;
    return {
      ok: false,
      status: res.status,
      message: err?.message ?? "迁移失败",
    };
  }

  const data = body as MigrateResponseBody;
  const pullRecords = data.pullRecords ?? [];
  for (const rec of pullRecords) {
    applyCloudRecordToLocal(rec);
  }

  return {
    ok: true,
    status: res.status,
    message: formatMigrateSummary(data.summary, pullRecords.length),
    summary: data.summary,
    decisions: data.decisions,
    pullCount: pullRecords.length,
  };
}

export function formatMigrateSummary(
  summary: MigrateResponseBody["summary"],
  pullApplied: number,
): string {
  return `合并完成：上传 ${summary.uploaded}，拉取 ${pullApplied}，本地胜 ${summary.keptLocal}，云端胜 ${summary.keptCloud}，相等保留云端 ${summary.equal}`;
}

/** 是否应展示首次合并引导（已登录且本机有盘且未跳过/未完成） */
export function shouldShowMigratePrompt(userId: string): boolean {
  if (isMigrateSkipped(userId) || isMigrateDone(userId)) return false;
  try {
    return collectLocalChartsForMigrate().length > 0;
  } catch {
    return false;
  }
}

export function skipMigratePrompt(userId: string): void {
  try {
    sessionStorage.setItem(SKIP_KEY, userId);
  } catch {
    /* ignore */
  }
}

export function isMigrateSkipped(userId: string): boolean {
  try {
    return sessionStorage.getItem(SKIP_KEY) === userId;
  } catch {
    return false;
  }
}

export function markMigrateDone(userId: string): void {
  try {
    localStorage.setItem(DONE_KEY, userId);
  } catch {
    /* ignore */
  }
}

export function isMigrateDone(userId: string): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === userId;
  } catch {
    return false;
  }
}

export function clearMigrateFlags(): void {
  try {
    sessionStorage.removeItem(SKIP_KEY);
    localStorage.removeItem(DONE_KEY);
  } catch {
    /* ignore */
  }
}

const LOCAL_META_PREFIX = "bd_meta_";

export function touchLocalUpdatedAt(
  profileId: string,
  iso?: string | null,
): void {
  try {
    const at = iso && parseIsoMs(iso) != null ? iso : new Date().toISOString();
    localStorage.setItem(
      LOCAL_META_PREFIX + profileId,
      JSON.stringify({ updatedAt: at }),
    );
  } catch {
    /* ignore */
  }
}

export function readLocalUpdatedAt(profileId: string): string | null {
  try {
    const raw = localStorage.getItem(LOCAL_META_PREFIX + profileId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { updatedAt?: string };
    return parsed.updatedAt ?? null;
  } catch {
    return null;
  }
}
