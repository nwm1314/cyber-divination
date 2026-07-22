import { NextRequest, NextResponse } from "next/server";
import { ErrorCode } from "@/lib/types";
import { SESSION_COOKIE_NAME, sessionFromToken } from "@/lib/auth/session";
import {
  getAllCloudChartsForUser,
  getCloudChart,
  upsertCloudChart,
} from "@/lib/storage/cloud-store";
import {
  planMerge,
  type LocalChartBundle,
  type MergeDecision,
  type MigrateResponseBody,
} from "@/lib/storage/migrate";
import type { CloudChartRecord } from "@/lib/storage/cloud-types";
import { parseJsonBody, assertSameOrigin } from "@/lib/api";
import { migrateBodySchema } from "@/lib/contracts";

/**
 * POST /api/charts/migrate — 本地→云端合并（T83）
 *
 * 冲突策略见 `src/lib/storage/migrate.ts` 文件头。
 * 请求体：{ charts: LocalChartBundle[], options?: { pullCloudOnly?: boolean } }
 * 响应：decisions + 需客户端写入的 pullRecords；永不删除任一侧档案。
 * userId 仅来自 session；忽略客户端伪造的 profile.userId。
 */
export async function POST(request: NextRequest) {
  const originErr = assertSameOrigin(request);
  if (originErr) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.AUTH_FORBIDDEN,
          message: originErr,
        },
      },
      { status: 403 },
    );
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionFromToken(token);
  if (!session.authenticated || !session.userId) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.AUTH_REQUIRED,
          message: "请先登录后再迁移档案",
        },
      },
      { status: 401 },
    );
  }

  const parsed = await parseJsonBody(request, migrateBodySchema);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.INVALID_PROFILE,
          message: parsed.message,
        },
      },
      { status: parsed.status },
    );
  }

  const charts = parsed.data.charts;
  const userId = session.userId;
  const cloudList = await getAllCloudChartsForUser(userId);

  const localMeta: Record<string, { updatedAt?: string | null }> = {};
  const localById = new Map<string, LocalChartBundle>();

  for (const item of charts) {
    if (!item?.profile || !item?.chart) continue;
    const id =
      item.profileId ||
      item.profile.id ||
      item.chart.profileId;
    if (!id || typeof id !== "string") continue;

    // 服务端权威：强制 userId + profileId 一致
    const bundle: LocalChartBundle = {
      profileId: id,
      profile: {
        ...item.profile,
        id,
        userId,
      } as LocalChartBundle["profile"],
      chart: {
        ...item.chart,
        profileId: id,
      } as LocalChartBundle["chart"],
      report: item.report as LocalChartBundle["report"],
      calibration: item.calibration as LocalChartBundle["calibration"],
      localUpdatedAt: item.localUpdatedAt ?? null,
    };
    localById.set(id, bundle);
    localMeta[id] = { updatedAt: item.localUpdatedAt ?? null };
  }

  const cloudMeta: Record<string, { updatedAt?: string | null }> = {};
  const cloudById = new Map<string, CloudChartRecord>();
  for (const rec of cloudList) {
    cloudById.set(rec.id, rec);
    cloudMeta[rec.id] = { updatedAt: rec.updatedAt };
  }

  const plan = planMerge(localMeta, cloudMeta, parsed.data.options);
  const outDecisions: MergeDecision[] = [];
  const pullRecords: CloudChartRecord[] = [];
  let uploaded = 0;
  let keptLocal = 0;
  let keptCloud = 0;
  let equal = 0;

  for (const d of plan.decisions) {
    if (d.kind === "upload" || d.kind === "keep_local") {
      const local = localById.get(d.profileId);
      if (!local) {
        outDecisions.push({
          ...d,
          kind: "keep_cloud",
          reason: "本地条目缺失，跳过上传",
        });
        continue;
      }
      try {
        await upsertCloudChart(userId, {
          profile: local.profile,
          chart: local.chart,
          report: local.report,
          calibration: local.calibration,
        });
        uploaded += 1;
        if (d.kind === "keep_local") keptLocal += 1;
        outDecisions.push(d);
      } catch {
        outDecisions.push({
          profileId: d.profileId,
          kind: "keep_cloud",
          reason: "上传失败，保留云端现有数据",
          localUpdatedAt: d.localUpdatedAt,
          cloudUpdatedAt: d.cloudUpdatedAt,
        });
      }
      continue;
    }

    if (d.kind === "pull" || d.kind === "keep_cloud") {
      if (d.kind === "keep_cloud") keptCloud += 1;
      const rec =
        cloudById.get(d.profileId) ??
        (await getCloudChart(userId, d.profileId));
      if (rec) pullRecords.push(rec);
      outDecisions.push(d);
      continue;
    }

    if (d.kind === "equal_cloud") {
      equal += 1;
      outDecisions.push(d);
    }
  }

  const after = await getAllCloudChartsForUser(userId);
  const response: MigrateResponseBody = {
    summary: {
      uploaded,
      pulled: pullRecords.length,
      keptLocal,
      keptCloud,
      equal,
    },
    decisions: outDecisions,
    pullRecords,
    cloudProfileIds: after.map((r) => r.id),
  };

  return NextResponse.json(response);
}
