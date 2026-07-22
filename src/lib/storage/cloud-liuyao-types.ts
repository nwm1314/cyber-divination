/**
 * 云端六爻问卦类型（T225）
 */

import type { LiuyaoChart } from "@/lib/types/liuyao";
import type { UserId } from "@/lib/types/user";

export type CloudLiuyaoRecord = {
  id: string;
  userId: UserId;
  question: string;
  chart: LiuyaoChart;
  createdAt: string;
  updatedAt: string;
};

export type CloudLiuyaoListItem = {
  chartId: string;
  question: string;
  method: string;
  benGuaName: string;
  updatedAt: string;
};

export type CloudLiuyaoUpsertBody = {
  chart: LiuyaoChart;
};

export function toLiuyaoListItem(rec: CloudLiuyaoRecord): CloudLiuyaoListItem {
  return {
    chartId: rec.id,
    question: rec.question || rec.chart.question,
    method: rec.chart.method,
    benGuaName: rec.chart.benGua?.name ?? "—",
    updatedAt: rec.updatedAt,
  };
}
