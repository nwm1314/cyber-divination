/**
 * 浏览器侧云端档案 API 客户端（T82）
 * 未登录时请勿调用；调用方应先查 /api/auth/session。
 */

import type { BirthProfile, BaziChart, ReadingReport, AppError } from "@/lib/types";
import type { CalibrationData } from "@/lib/reading/calibrate";
import type { ZiweiChart } from "@/lib/types/ziwei";
import type { LiuyaoChart } from "@/lib/types/liuyao";
import type {
  CloudChartListItem,
  CloudChartRecord,
  CloudChartUpsertBody,
} from "./cloud-types";
import type {
  CloudZiweiListItem,
  CloudZiweiRecord,
  CloudZiweiUpsertBody,
} from "./cloud-ziwei-types";
import type {
  CloudLiuyaoListItem,
  CloudLiuyaoRecord,
  CloudLiuyaoUpsertBody,
} from "./cloud-liuyao-types";

export type CloudApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: AppError };

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function asError(body: unknown, fallback: string): AppError {
  const e = (body as { error?: AppError })?.error;
  if (e?.code && e?.message) return e;
  return { code: "NOT_FOUND" as AppError["code"], message: fallback };
}

/** GET /api/charts — 列表 */
export async function fetchCloudChartList(): Promise<
  CloudApiResult<{ items: CloudChartListItem[] }>
> {
  const res = await fetch("/api/charts", {
    method: "GET",
    credentials: "same-origin",
  });
  const body = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: asError(body, "获取云端列表失败"),
    };
  }
  const items = (body as { items?: CloudChartListItem[] })?.items ?? [];
  return { ok: true, data: { items } };
}

/** GET /api/charts/[id] — 详情 */
export async function fetchCloudChart(
  profileId: string,
): Promise<CloudApiResult<{ record: CloudChartRecord }>> {
  const res = await fetch(`/api/charts/${encodeURIComponent(profileId)}`, {
    method: "GET",
    credentials: "same-origin",
  });
  const body = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: asError(body, "获取云端档案失败"),
    };
  }
  const record = (body as { record?: CloudChartRecord })?.record;
  if (!record) {
    return {
      ok: false,
      status: 500,
      error: { code: "NOT_FOUND", message: "响应缺少 record" },
    };
  }
  return { ok: true, data: { record } };
}

/** POST /api/charts — 保存/覆盖 */
export async function upsertCloudChartApi(
  body: CloudChartUpsertBody,
): Promise<CloudApiResult<{ record: CloudChartRecord }>> {
  const res = await fetch("/api/charts", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: asError(parsed, "保存云端档案失败"),
    };
  }
  const record = (parsed as { record?: CloudChartRecord })?.record;
  if (!record) {
    return {
      ok: false,
      status: 500,
      error: { code: "NOT_FOUND", message: "响应缺少 record" },
    };
  }
  return { ok: true, data: { record } };
}

/** DELETE /api/charts/[id] */
export async function deleteCloudChartApi(
  profileId: string,
): Promise<CloudApiResult<{ deleted: boolean }>> {
  const res = await fetch(`/api/charts/${encodeURIComponent(profileId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  const body = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: asError(body, "删除云端档案失败"),
    };
  }
  return {
    ok: true,
    data: { deleted: (body as { deleted?: boolean })?.deleted !== false },
  };
}

/** 构造 upsert body 的便捷方法 */
export function buildUpsertBody(input: {
  profile: BirthProfile;
  chart: BaziChart;
  report?: ReadingReport | null;
  calibration?: CalibrationData | null;
}): CloudChartUpsertBody {
  return {
    profile: input.profile,
    chart: input.chart,
    report: input.report,
    calibration: input.calibration,
  };
}

/** POST /api/charts/migrate 原始响应（T83）；业务封装见 migrate.runMigrateFromLocal */
export async function migrateCloudChartsApi(
  body: unknown,
): Promise<CloudApiResult<unknown>> {
  const res = await fetch("/api/charts/migrate", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: asError(parsed, "迁移合并失败"),
    };
  }
  return { ok: true, data: parsed };
}

// —— 紫微云端（T107）——

export async function fetchCloudZiweiList(): Promise<
  CloudApiResult<{ items: CloudZiweiListItem[] }>
> {
  const res = await fetch("/api/ziwei-charts", {
    method: "GET",
    credentials: "same-origin",
  });
  const body = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: asError(body, "获取云端紫微列表失败"),
    };
  }
  const items = (body as { items?: CloudZiweiListItem[] })?.items ?? [];
  return { ok: true, data: { items } };
}

export async function fetchCloudZiwei(
  chartId: string,
): Promise<CloudApiResult<{ record: CloudZiweiRecord }>> {
  const res = await fetch(`/api/ziwei-charts/${encodeURIComponent(chartId)}`, {
    method: "GET",
    credentials: "same-origin",
  });
  const body = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: asError(body, "获取云端紫微档案失败"),
    };
  }
  const record = (body as { record?: CloudZiweiRecord })?.record;
  if (!record) {
    return {
      ok: false,
      status: 500,
      error: { code: "NOT_FOUND", message: "响应缺少 record" },
    };
  }
  return { ok: true, data: { record } };
}

export async function upsertCloudZiweiApi(
  body: CloudZiweiUpsertBody,
): Promise<CloudApiResult<{ record: CloudZiweiRecord }>> {
  const res = await fetch("/api/ziwei-charts", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: asError(parsed, "保存云端紫微失败"),
    };
  }
  const record = (parsed as { record?: CloudZiweiRecord })?.record;
  if (!record) {
    return {
      ok: false,
      status: 500,
      error: { code: "NOT_FOUND", message: "响应缺少 record" },
    };
  }
  return { ok: true, data: { record } };
}

export async function deleteCloudZiweiApi(
  chartId: string,
): Promise<CloudApiResult<{ deleted: boolean }>> {
  const res = await fetch(`/api/ziwei-charts/${encodeURIComponent(chartId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  const body = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: asError(body, "删除云端紫微失败"),
    };
  }
  return {
    ok: true,
    data: { deleted: (body as { deleted?: boolean })?.deleted !== false },
  };
}

export function buildZiweiUpsertBody(input: {
  chart: ZiweiChart;
  solarDate?: string;
}): CloudZiweiUpsertBody {
  return {
    chart: input.chart,
    solarDate: input.solarDate,
  };
}

/** —— 六爻云端（T225）—— */

export async function fetchCloudLiuyaoList(): Promise<
  CloudApiResult<{ items: CloudLiuyaoListItem[] }>
> {
  const res = await fetch("/api/liuyao-charts", {
    method: "GET",
    credentials: "same-origin",
  });
  const body = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: asError(body, "获取云端六爻列表失败"),
    };
  }
  const items = (body as { items?: CloudLiuyaoListItem[] })?.items ?? [];
  return { ok: true, data: { items } };
}

export async function fetchCloudLiuyao(
  chartId: string,
): Promise<CloudApiResult<{ record: CloudLiuyaoRecord }>> {
  const res = await fetch(`/api/liuyao-charts/${encodeURIComponent(chartId)}`, {
    method: "GET",
    credentials: "same-origin",
  });
  const body = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: asError(body, "获取云端六爻失败"),
    };
  }
  const record = (body as { record?: CloudLiuyaoRecord })?.record;
  if (!record) {
    return {
      ok: false,
      status: 500,
      error: { code: "NOT_FOUND", message: "响应缺少 record" },
    };
  }
  return { ok: true, data: { record } };
}

export async function upsertCloudLiuyaoApi(
  body: CloudLiuyaoUpsertBody,
): Promise<CloudApiResult<{ record: CloudLiuyaoRecord }>> {
  const res = await fetch("/api/liuyao-charts", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: asError(parsed, "保存云端六爻失败"),
    };
  }
  const record = (parsed as { record?: CloudLiuyaoRecord })?.record;
  if (!record) {
    return {
      ok: false,
      status: 500,
      error: { code: "NOT_FOUND", message: "响应缺少 record" },
    };
  }
  return { ok: true, data: { record } };
}

export async function deleteCloudLiuyaoApi(
  chartId: string,
): Promise<CloudApiResult<{ deleted: boolean }>> {
  const res = await fetch(`/api/liuyao-charts/${encodeURIComponent(chartId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  const body = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: asError(body, "删除云端六爻失败"),
    };
  }
  return {
    ok: true,
    data: { deleted: (body as { deleted?: boolean })?.deleted !== false },
  };
}

export function buildLiuyaoUpsertBody(chart: LiuyaoChart): CloudLiuyaoUpsertBody {
  return { chart };
}
