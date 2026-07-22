import type { BirthProfile, BaziChart, ReadingReport } from "@/lib/types";
import type { ZiweiChart } from "@/lib/types/ziwei";
import type { CalibrationData } from "@/lib/reading/calibrate";
import { idbDel, idbSet } from "./idb";
import { isAccountPersistMode } from "./mode";
import { kvGet, kvGetJson, kvRemove, kvSet, kvSetJson } from "./kv";

const PREFIX_PROFILE = "bd_profile_";
const PREFIX_CHART = "bd_chart_";
const PREFIX_REPORT = "bd_report_";
const PREFIX_CALIBRATE = "bd_calibrate_";
const PREFIX_ZIWEI = "bd_ziwei_";
const KEY_LIST = "bd_list_";
const KEY_ZIWEI_LIST = "bd_ziwei_list_";

/** Reserved for future multi-user sync — MVP uses fixed ID */
export const USER_ID = "default-user";

export type ListEntry = {
  profileId: string;
  name: string;
  date: string;
};

function getList(): ListEntry[] {
  return kvGetJson<ListEntry[]>(KEY_LIST) ?? [];
}

function setList(list: ListEntry[]): void {
  kvSetJson(KEY_LIST, list);
}

/** 账号模式才写 IndexedDB（长期）；游客仅 sessionStorage */
function persistIdb(key: string, value: unknown): void {
  if (isAccountPersistMode()) {
    void idbSet(key, value);
  }
}

function removeIdb(key: string): void {
  if (isAccountPersistMode()) {
    void idbDel(key);
  }
}

export function saveProfile(profile: BirthProfile): void {
  kvSet(PREFIX_PROFILE + profile.id, JSON.stringify(profile));
  persistIdb(PREFIX_PROFILE + profile.id, profile);
}

export function getProfile(id: string): BirthProfile | null {
  return kvGetJson<BirthProfile>(PREFIX_PROFILE + id);
}

export function saveChart(chart: BaziChart): void {
  kvSet(PREFIX_CHART + chart.profileId, JSON.stringify(chart));
  persistIdb(PREFIX_CHART + chart.profileId, chart);

  const profile = getProfile(chart.profileId);
  if (profile) {
    const list = getList();
    const idx = list.findIndex((e) => e.profileId === chart.profileId);
    const entry: ListEntry = {
      profileId: chart.profileId,
      name: profile.name,
      date: profile.analysisBaseDate,
    };
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.push(entry);
    }
    setList(list);
  }
}

export function getChart(profileId: string): BaziChart | null {
  return kvGetJson<BaziChart>(PREFIX_CHART + profileId);
}

export function saveReport(report: ReadingReport): void {
  kvSet(PREFIX_REPORT + report.chartId, JSON.stringify(report));
  persistIdb(PREFIX_REPORT + report.chartId, report);
}

export function getReport(chartId: string): ReadingReport | null {
  return kvGetJson<ReadingReport>(PREFIX_REPORT + chartId);
}

export function listCharts(): ListEntry[] {
  return getList();
}

export function deleteChart(profileId: string): void {
  kvRemove(PREFIX_PROFILE + profileId);
  kvRemove(PREFIX_CHART + profileId);
  kvRemove(PREFIX_REPORT + profileId);
  kvRemove(PREFIX_CALIBRATE + profileId);
  removeIdb(PREFIX_PROFILE + profileId);
  removeIdb(PREFIX_CHART + profileId);
  removeIdb(PREFIX_REPORT + profileId);
  removeIdb(PREFIX_CALIBRATE + profileId);

  setList(getList().filter((e) => e.profileId !== profileId));
}

export function deleteReport(chartId: string): void {
  kvRemove(PREFIX_REPORT + chartId);
}

export function saveCalibration(data: CalibrationData): void {
  kvSet(PREFIX_CALIBRATE + data.chartId, JSON.stringify(data));
}

export function getCalibration(chartId: string): CalibrationData | null {
  return kvGetJson<CalibrationData>(PREFIX_CALIBRATE + chartId);
}

/** 紫微盘列表项 */
export type ZiweiListEntry = {
  chartId: string;
  name: string;
  date: string;
};

function getZiweiList(): ZiweiListEntry[] {
  return kvGetJson<ZiweiListEntry[]>(KEY_ZIWEI_LIST) ?? [];
}

function setZiweiList(list: ZiweiListEntry[]): void {
  kvSetJson(KEY_ZIWEI_LIST, list);
}

export function saveZiweiChart(
  chart: ZiweiChart,
  meta?: { solarDate?: string },
): void {
  kvSet(PREFIX_ZIWEI + chart.id, JSON.stringify(chart));
  persistIdb(PREFIX_ZIWEI + chart.id, chart);

  const list = getZiweiList();
  const idx = list.findIndex((e) => e.chartId === chart.id);
  const entry: ZiweiListEntry = {
    chartId: chart.id,
    name: chart.name?.trim() || "未命名",
    date: meta?.solarDate || new Date().toISOString().slice(0, 10),
  };
  if (idx >= 0) list[idx] = entry;
  else list.unshift(entry);
  setZiweiList(list);
}

export function getZiweiChart(id: string): ZiweiChart | null {
  return kvGetJson<ZiweiChart>(PREFIX_ZIWEI + id);
}

export function listZiweiCharts(): ZiweiListEntry[] {
  return getZiweiList();
}

export function deleteZiweiChart(id: string): void {
  kvRemove(PREFIX_ZIWEI + id);
  removeIdb(PREFIX_ZIWEI + id);
  setZiweiList(getZiweiList().filter((e) => e.chartId !== id));
}

export {
  saveLiuyaoChart,
  getLiuyaoChart,
  listLiuyaoCharts,
  deleteLiuyaoChart,
} from "./liuyao";
export type { LiuyaoListEntry } from "./liuyao";

export {
  createPerson,
  savePerson,
  getPerson,
  listPersons,
  listPersonEntries,
  toPersonListEntry,
  deletePerson,
  updatePerson,
  linkChartId,
  unlinkChartId,
  linkZiweiId,
  unlinkZiweiId,
} from "./person";

export {
  getPersistMode,
  isAccountPersistMode,
  setAccountPersistMode,
  canUseCloudAndShare,
  promoteGuestSessionToAccount,
  enterAccountPersistMode,
} from "./mode";

// 避免 unused import 告警（kvGet 供调试/扩展）
void kvGet;
