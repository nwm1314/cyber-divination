import { describe, expect, it, beforeEach } from "vitest";
import type { BirthProfile, BaziChart, ReadingReport } from "@/lib/types";
import type { CalibrationData } from "@/lib/reading/calibrate";
import {
  deleteAllCloudChartsForUser,
  deleteCloudChart,
  getAllCloudChartsForUser,
  getCloudChart,
  listCloudCharts,
  resetCloudStoreForTests,
  upsertCloudChart,
} from "./cloud-store";
import {
  deleteCloudDataForUser,
  exportCloudDataForUser,
} from "./cloud-hooks";

function mockProfile(overrides?: Partial<BirthProfile>): BirthProfile {
  return {
    id: "p-001",
    name: "张三",
    gender: "male",
    solarDate: "1990-01-01",
    alive: true,
    analysisBaseDate: "2026-07-20",
    useTrueSolarTime: false,
    ...overrides,
  };
}

function mockChart(overrides?: Partial<BaziChart>): BaziChart {
  return {
    profileId: "p-001",
    pillars: {
      year: { stem: "庚", branch: "午" },
      month: { stem: "壬", branch: "子" },
      day: { stem: "甲", branch: "辰" },
      hour: { stem: "甲", branch: "子" },
    },
    dayMaster: "甲",
    tenGods: {},
    hiddenStems: {},
    wuxingScores: { wood: 20, fire: 15, earth: 10, metal: 25, water: 30 },
    relations: {
      stemHe: [],
      branchChong: [],
      branchLiuhe: [],
      branchSanhe: [],
      branchSanhui: [],
      branchXing: [],
      branchHai: [],
    },
    dayun: [],
    currentDayunIndex: -1,
    liunian: [],
    flags: [],
    meta: { engineVersion: "1.0.0", skillRef: "bazi-skill" },
    ...overrides,
  };
}

function mockReport(overrides?: Partial<ReadingReport>): ReadingReport {
  return {
    chartId: "p-001",
    mode: "template",
    viewMode: "plain",
    sections: [],
    calibratePrompts: [],
    disclaimer: "仅供娱乐参考",
    ...overrides,
  };
}

function mockCalib(overrides?: Partial<CalibrationData>): CalibrationData {
  return {
    chartId: "p-001",
    answers: [],
    ...overrides,
  };
}

beforeEach(() => {
  resetCloudStoreForTests();
});

describe("cloud-store CRUD（T82）", () => {
  it("upsert 后 list/get 可见，且强制写入 userId", async () => {
    const rec = await upsertCloudChart("user-a", {
      profile: mockProfile({ userId: "forged-other" }),
      chart: mockChart(),
      report: mockReport(),
      calibration: mockCalib(),
    });

    expect(rec.userId).toBe("user-a");
    expect(rec.profile.userId).toBe("user-a");
    expect(rec.id).toBe("p-001");
    expect(rec.report?.chartId).toBe("p-001");
    expect(rec.calibration?.chartId).toBe("p-001");

    const list = await listCloudCharts("user-a");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      profileId: "p-001",
      name: "张三",
      date: "2026-07-20",
    });

    const got = await getCloudChart("user-a", "p-001");
    expect(got?.profile.name).toBe("张三");
  });

  it("用户隔离：user-b 看不到 user-a 的档案", async () => {
    await upsertCloudChart("user-a", {
      profile: mockProfile(),
      chart: mockChart(),
    });

    expect(await listCloudCharts("user-b")).toEqual([]);
    expect(await getCloudChart("user-b", "p-001")).toBeNull();
  });

  it("同账号多档案 + 按 updatedAt 倒序", async () => {
    await upsertCloudChart("user-a", {
      profile: mockProfile({ id: "p1", name: "甲" }),
      chart: mockChart({ profileId: "p1" }),
    });
    await upsertCloudChart("user-a", {
      profile: mockProfile({ id: "p2", name: "乙" }),
      chart: mockChart({ profileId: "p2" }),
    });

    const list = await listCloudCharts("user-a");
    expect(list).toHaveLength(2);
    expect(list[0].profileId).toBe("p2");
    expect(list[1].profileId).toBe("p1");
  });

  it("upsert 覆盖同 id，保留 createdAt，更新 report", async () => {
    const first = await upsertCloudChart("user-a", {
      profile: mockProfile({ name: "旧名" }),
      chart: mockChart(),
    });
    const second = await upsertCloudChart("user-a", {
      profile: mockProfile({ name: "新名" }),
      chart: mockChart(),
      report: mockReport(),
    });

    expect(second.createdAt).toBe(first.createdAt);
    expect(second.profile.name).toBe("新名");
    expect(second.report?.disclaimer).toBe("仅供娱乐参考");
    expect(await listCloudCharts("user-a")).toHaveLength(1);
  });

  it("delete 单条与 deleteAll", async () => {
    await upsertCloudChart("user-a", {
      profile: mockProfile({ id: "p1" }),
      chart: mockChart({ profileId: "p1" }),
    });
    await upsertCloudChart("user-a", {
      profile: mockProfile({ id: "p2" }),
      chart: mockChart({ profileId: "p2" }),
    });

    expect(await deleteCloudChart("user-a", "p1")).toBe(true);
    expect(await deleteCloudChart("user-a", "p1")).toBe(false);
    expect(await listCloudCharts("user-a")).toHaveLength(1);

    const n = await deleteAllCloudChartsForUser("user-a");
    expect(n).toBe(1);
    expect(await listCloudCharts("user-a")).toEqual([]);
  });

  it("profile.id 与 chart.profileId 不一致时抛错", async () => {
    await expect(
      upsertCloudChart("user-a", {
        profile: mockProfile({ id: "p1" }),
        chart: mockChart({ profileId: "p2" }),
      }),
    ).rejects.toThrow(/不一致/);
  });
});

describe("cloud-hooks（T84 对接）", () => {
  it("export / delete 真实读写", async () => {
    await upsertCloudChart("user-x", {
      profile: mockProfile(),
      chart: mockChart(),
      report: mockReport(),
      calibration: mockCalib(),
    });

    const exported = await exportCloudDataForUser("user-x");
    expect(exported.profiles).toHaveLength(1);
    expect(exported.charts).toHaveLength(1);
    expect(exported.reports).toHaveLength(1);
    expect(exported.calibrations).toHaveLength(1);

    const all = await getAllCloudChartsForUser("user-x");
    expect(all).toHaveLength(1);

    const deleted = await deleteCloudDataForUser("user-x");
    expect(deleted).toBe(1);
    expect(await exportCloudDataForUser("user-x")).toEqual({
      profiles: [],
      charts: [],
      reports: [],
      calibrations: [],
      ziweiCharts: [],
      people: [],
      liuyaoCharts: [],
    });
  });
});
