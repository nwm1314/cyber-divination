import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLastSyncState,
  beginSync,
  finishSync,
  formatSyncState,
  deleteArchive,
  pushLocalChartsToCloud,
} from "./sync";
import { saveProfile, saveChart, getChart } from "./index";
import { upsertCloudChartApi } from "./cloud-client";
import type { BirthProfile, BaziChart } from "@/lib/types";

vi.mock("./cloud-client", () => {
  const ok = { ok: true, data: { record: {} } };
  return {
    fetchCloudChartList: vi.fn(async () => ({ ok: true, data: { items: [] } })),
    fetchCloudChart: vi.fn(async () => ok),
    upsertCloudChartApi: vi.fn(async () => ok),
    deleteCloudChartApi: vi.fn(async () => ({ ok: true, data: { deleted: true } })),
    fetchCloudZiweiList: vi.fn(async () => ({ ok: true, data: { items: [] } })),
    fetchCloudZiwei: vi.fn(async () => ok),
    upsertCloudZiweiApi: vi.fn(async () => ok),
    deleteCloudZiweiApi: vi.fn(async () => ({ ok: true, data: { deleted: true } })),
    fetchCloudLiuyaoList: vi.fn(async () => ({ ok: true, data: { items: [] } })),
    fetchCloudLiuyao: vi.fn(async () => ok),
    upsertCloudLiuyaoApi: vi.fn(async () => ok),
    deleteCloudLiuyaoApi: vi.fn(async () => ({ ok: true, data: { deleted: true } })),
  };
});

function mockStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
}

const profile: BirthProfile = {
  id: "sync-p1",
  name: "sync",
  gender: "male",
  solarDate: "1990-01-01",
  analysisBaseDate: "2026-08-12",
  alive: true,
  useTrueSolarTime: false,
};

const chart: BaziChart = {
  profileId: profile.id,
  pillars: {
    year: { stem: "甲", branch: "子" },
    month: { stem: "乙", branch: "丑" },
    day: { stem: "丙", branch: "寅" },
    hour: null,
  },
  dayMaster: "丙",
  tenGods: {},
  hiddenStems: {},
  wuxingScores: { wood: 1, fire: 1, earth: 1, metal: 1, water: 1 },
  relations: {
    stemHe: [], branchChong: [], branchLiuhe: [], branchSanhe: [],
    branchSanhui: [], branchXing: [], branchHai: [],
  },
  dayun: [], currentDayunIndex: -1, liunian: [], flags: [],
  meta: { engineVersion: "test", skillRef: "bazi-skill" },
};

describe("sync lifecycle", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockStorage());
    vi.stubGlobal("sessionStorage", mockStorage());
    localStorage.setItem("bd_account_mode", "1");
  });

  afterEach(() => vi.unstubAllGlobals());

  it("records the last operation and formats failures", () => {
    const started = beginSync("pull").startedAt;
    const state = finishSync({
      operation: "pull",
      startedAt: started,
      successCount: 1,
      failures: [{ profileId: "p2", message: "network" }],
      conflictCount: 1,
    });
    expect(getLastSyncState()).toEqual(state);
    expect(state.status).toBe("partial");
    expect(formatSyncState(state)).toMatch(/失败|冲突|p2/);
  });

  it("local deletion does not request cloud deletion", async () => {
    saveProfile(profile);
    saveChart(chart);
    const result = await deleteArchive({ kind: "bazi", id: profile.id, scope: "local" });
    expect(result).toMatchObject({ ok: true, localDeleted: true, cloudDeleted: false });
    expect(getChart(profile.id)).toBeNull();
    expect(getLastSyncState()?.scope).toBe("local");
  });

  it("pushes every local Bazi archive instead of returning after the first", async () => {
    const secondProfile = { ...profile, id: "sync-p2" };
    const secondChart = { ...chart, profileId: secondProfile.id };
    saveProfile(profile);
    saveChart(chart);
    saveProfile(secondProfile);
    saveChart(secondChart);

    vi.mocked(upsertCloudChartApi).mockClear();
    const result = await pushLocalChartsToCloud();

    expect(result).toEqual({ pushed: 2, failed: [] });
    expect(upsertCloudChartApi).toHaveBeenCalledTimes(2);
    expect(getLastSyncState()).toMatchObject({ status: "success", successCount: 2 });
  });
});
