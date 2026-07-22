/**
 * 云端存储驱动选择（T221 / T223）
 * - DATABASE_URL 有值 → postgres
 * - 否则 → file（data/*.json，开发默认）
 */

import { isDatabaseConfigured } from "@/lib/db";

export type CloudStoreDriver = "file" | "postgres";

export function getCloudStoreDriver(): CloudStoreDriver {
  const raw = (process.env.CLOUD_STORE_DRIVER ?? "").trim().toLowerCase();
  if (raw === "postgres") {
    if (!isDatabaseConfigured()) {
      throw new Error(
        "CLOUD_STORE_DRIVER=postgres 时必须配置 DATABASE_URL，禁止静默回落文件",
      );
    }
    return "postgres";
  }
  if (raw === "file") return "file";
  // 自动：有 DATABASE_URL 则 pg，否则 file
  return isDatabaseConfigured() ? "postgres" : "file";
}
