/**
 * 六爻问卦存储
 * 游客 → sessionStorage；账号 → localStorage
 */

import type { LiuyaoChart, LiuyaoMethod } from "@/lib/types/liuyao";
import { kvGetJson, kvRemove, kvSet, kvSetJson } from "./kv";

const PREFIX_CHART = "bd_liuyao_";
const KEY_LIST = "bd_liuyao_list_";

export type LiuyaoListEntry = {
  id: string;
  question: string;
  method: LiuyaoMethod;
  benGuaName: string;
  createdAt: string;
};

function getList(): LiuyaoListEntry[] {
  return kvGetJson<LiuyaoListEntry[]>(KEY_LIST) ?? [];
}

function setList(list: LiuyaoListEntry[]): void {
  kvSetJson(KEY_LIST, list);
}

export function saveLiuyaoChart(chart: LiuyaoChart): void {
  kvSet(PREFIX_CHART + chart.id, JSON.stringify(chart));

  const list = getList();
  const idx = list.findIndex((e) => e.id === chart.id);
  const entry: LiuyaoListEntry = {
    id: chart.id,
    question: chart.question,
    method: chart.method,
    benGuaName: chart.benGua.name,
    createdAt: idx >= 0 ? list[idx]!.createdAt : new Date().toISOString(),
  };
  if (idx >= 0) {
    list[idx] = entry;
  } else {
    list.unshift(entry);
  }
  setList(list);
}

export function getLiuyaoChart(id: string): LiuyaoChart | null {
  return kvGetJson<LiuyaoChart>(PREFIX_CHART + id);
}

export function listLiuyaoCharts(): LiuyaoListEntry[] {
  return getList();
}

export function deleteLiuyaoChart(id: string): void {
  kvRemove(PREFIX_CHART + id);
  setList(getList().filter((e) => e.id !== id));
}
