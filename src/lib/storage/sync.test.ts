import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLastSyncState,
  beginSync,
  finishSync,
  formatSyncState,
  deleteArchive,
  pushLocalChartsToCloud,
  pullCloudChartsToLocal,
} from "./sync";
import { saveProfile, saveChart, getChart, listCharts } from "./index";
import {
  fetchCloudChart,
  fetchCloudChartList,
  upsertCloudChartApi,
} from "./cloud-client";
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

/**
 * B5：拉取路径此前是「1 次列表 + N 次详情」顺序 await（N+1 串行）。
 * 现改为受控并发，且**落盘顺序仍等于列表顺序**（并发完成顺序不得影响本机写入次序）。
 */
describe("pullCloudChartsToLocal 详情并发（B5）", () => {
  const restoreDefaults = () => {
    vi.mocked(fetchCloudChartList).mockImplementation(async () => ({
      ok: true,
      data: { items: [] },
    }));
    vi.mocked(fetchCloudChart).mockImplementation(async () => ({
      ok: true,
      data: { record: {} },
    }));
  };

  beforeEach(() => {
    vi.stubGlobal("localStorage", mockStorage());
    vi.stubGlobal("sessionStorage", mockStorage());
    localStorage.setItem("bd_account_mode", "1");
    restoreDefaults();
  });

  afterEach(() => vi.unstubAllGlobals());

  const recordFor = (id: string) => ({
    id,
    userId: "u1",
    profile: { ...profile, id },
    chart: { ...chart, profileId: id },
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
  });

  const itemFor = (id: string) => ({
    profileId: id,
    name: id,
    date: "1990-01-01",
    updatedAt: "2026-08-12T00:00:00.000Z",
  });

  it("详情并发发出，并按列表顺序落盘", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `sync-c${i}`);
    vi.mocked(fetchCloudChartList).mockImplementationOnce(async () => ({
      ok: true,
      data: { items: ids.map(itemFor) },
    }));

    let inFlight = 0;
    let maxInFlight = 0;
    vi.mocked(fetchCloudChart).mockImplementation(async (id: string) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      // 靠后的 id 先返回：若按完成顺序落盘，本机列表会倒序
      await new Promise((r) => setTimeout(r, (ids.length - ids.indexOf(id)) * 3));
      inFlight -= 1;
      return { ok: true, data: { record: recordFor(id) } };
    });

    const result = await pullCloudChartsToLocal();

    expect(result.pulled).toBe(12);
    expect(result.failed).toEqual([]);
    // 并发被真正用上，且不超过上限（浏览器同域本身也只 6 条）
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(6);
    expect(listCharts().map((e) => e.profileId)).toEqual(ids);
  });

  it("单条详情失败只记该条，其余仍落库", async () => {
    const ids = ["sync-f1", "sync-f2", "sync-f3"];
    vi.mocked(fetchCloudChartList).mockImplementationOnce(async () => ({
      ok: true,
      data: { items: ids.map(itemFor) },
    }));
    vi.mocked(fetchCloudChart).mockImplementation(async (id: string) =>
      id === "sync-f2"
        ? { ok: false, error: { message: "boom", code: "NETWORK" } }
        : { ok: true, data: { record: recordFor(id) } },
    );

    const result = await pullCloudChartsToLocal();

    expect(result.pulled).toBe(2);
    expect(result.failed).toEqual([{ profileId: "sync-f2", message: "boom" }]);
    expect(getChart("sync-f1")).not.toBeNull();
    expect(getChart("sync-f2")).toBeNull();
    expect(getChart("sync-f3")).not.toBeNull();
  });

  it("列表请求失败时不发任何详情请求", async () => {
    vi.mocked(fetchCloudChartList).mockImplementationOnce(async () => ({
      ok: false,
      error: { message: "unauthorized", code: "AUTH_REQUIRED" },
    }));
    const spy = vi.mocked(fetchCloudChart);
    spy.mockClear();

    const result = await pullCloudChartsToLocal();

    expect(result.pulled).toBe(0);
    expect(result.failed).toEqual([
      { profileId: "*", message: "unauthorized" },
    ]);
    expect(spy).not.toHaveBeenCalled();
  });
});
