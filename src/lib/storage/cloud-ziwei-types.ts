/**
 * 云端紫微档案类型（T107）
 * 与八字 cloud-types 并列；文件后端 data/cloud-ziwei.json
 */

import type { ZiweiChart } from "@/lib/types/ziwei";
import type { UserId } from "@/lib/types/user";

export type CloudZiweiRecord = {
  id: string;
  userId: UserId;
  chart: ZiweiChart;
  /** 列表用阳历摘要 */
  solarDate?: string;
  createdAt: string;
  updatedAt: string;
};

export type CloudZiweiListItem = {
  chartId: string;
  name: string;
  date: string;
  updatedAt: string;
};

export type CloudZiweiUpsertBody = {
  chart: ZiweiChart;
  solarDate?: string;
};

export type CloudZiweiFile = {
  version: 1;
  users: Record<UserId, Record<string, CloudZiweiRecord>>;
};

export function toZiweiListItem(rec: CloudZiweiRecord): CloudZiweiListItem {
  return {
    chartId: rec.id,
    name: rec.chart.name?.trim() || "未命名",
    date: rec.solarDate || new Date(rec.updatedAt).toISOString().slice(0, 10),
    updatedAt: rec.updatedAt,
  };
}
