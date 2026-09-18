/**
 * 账号数据导出 / 删除（T84）
 * 与 T82 并行：云端 charts 经 cloud-hooks 可选调用
 */

import "server-only";
import type { User, UserId } from "@/lib/types/user";
import { deleteUserById, getUserById } from "./users";
import {
  deleteCloudDataForUser,
  exportCloudDataForUser,
  type CloudExportPayload,
} from "@/lib/storage/cloud-hooks";

export type AccountExportBundle = {
  exportedAt: string;
  version: 1;
  user: Pick<User, "id" | "email" | "displayName" | "createdAt" | "updatedAt">;
  cloud: CloudExportPayload;
  notes: {
    localData: string;
  };
  /**
   * 云端数据导出失败时的说明。
   *
   * 修复（P2）：此前 `exportCloudDataForUser` 的异常被空 catch 吞掉，
   * 失败时直接返回 `cloud: []`，用户会误以为「云端没有数据」。
   * 删除路径已明确禁止伪成功（见下方 DeleteAccountResult 注释），
   * 导出路径此前标准不一致，现补齐：失败时透出该字段而非静默为空。
   */
  cloudExportError?: string;
};

const LOCAL_DATA_NOTE =
  "本地浏览器中的命盘/报告（localStorage / IndexedDB）不会随本接口导出。请在「账号」页使用「导出本机数据」，或在「我的档案」中自行备份。";

/**
 * 组装登录用户可导出的 JSON（账号 + 云端钩子数据）
 */
export async function buildAccountExport(
  userId: UserId,
): Promise<AccountExportBundle | null> {
  const user = await getUserById(userId);
  if (!user) return null;

  let cloud: CloudExportPayload = {
    profiles: [],
    charts: [],
    reports: [],
    calibrations: [],
  };
  let cloudExportError: string | undefined;
  try {
    cloud = await exportCloudDataForUser(userId);
  } catch (err) {
    // 不阻断账号字段导出，但必须让调用方/用户知道云端部分缺失，
    // 否则会呈现为「导出成功且云端为空」的伪成功。
    cloudExportError =
      "云端数据导出失败，本次结果仅含账号字段。请稍后重试，或联系支持。";
    // 原始错误只进服务端日志
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        event: "account.export.cloud_failed",
        userId,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    cloud,
    notes: {
      localData: LOCAL_DATA_NOTE,
    },
    ...(cloudExportError ? { cloudExportError } : {}),
  };
}

export type DeleteAccountResult = {
  ok: true;
  userId: UserId;
  cloudDeleted: number;
};

/**
 * 删除账号及云端数据；用户不存在返回 null
 * 云端删除失败时抛错，禁止伪成功
 */
export async function deleteAccount(
  userId: UserId,
): Promise<DeleteAccountResult | null> {
  const existing = await getUserById(userId);
  if (!existing) return null;

  const cloudDeleted = await deleteCloudDataForUser(userId);

  const deleted = await deleteUserById(userId);
  if (!deleted) return null;

  return {
    ok: true,
    userId,
    cloudDeleted,
  };
}
