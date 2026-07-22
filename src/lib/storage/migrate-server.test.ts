/**
 * T83 服务端合并路径：planMerge + cloud-store（预置本地→云端可见）
 */
import { describe, expect, it, beforeEach } from "vitest";
import type { BirthProfile, BaziChart } from "@/lib/types";
import {
  getCloudChart,
  listCloudCharts,
  resetCloudStoreForTests,
  upsertCloudChart,
} from "./cloud-store";
import { planMerge, type LocalChartBundle } from "./migrate";

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

async function applyMigrateLikeApi(
  userId: string,
  charts: LocalChartBundle[],
) {
  const cloudList = await listCloudCharts(userId);
  // list only has summaries — fetch via upsert state; use get after list ids
  const cloudMeta: Record<string, { updatedAt?: string | null }> = {};
  for (const item of cloudList) {
    cloudMeta[item.profileId] = { updatedAt: item.updatedAt };
  }
  const localMeta: Record<string, { updatedAt?: string | null }> = {};
  const localById = new Map(charts.map((c) => [c.profileId, c]));
  for (const c of charts) {
    localMeta[c.profileId] = { updatedAt: c.localUpdatedAt ?? null };
  }

  const plan = planMerge(localMeta, cloudMeta);
  let uploaded = 0;
  for (const id of plan.toUpload) {
    const local = localById.get(id);
    if (!local) continue;
    await upsertCloudChart(userId, {
      profile: local.profile,
      chart: local.chart,
      report: local.report,
      calibration: local.calibration,
    });
    uploaded += 1;
  }
  return { plan, uploaded };
}

beforeEach(() => {
  resetCloudStoreForTests();
});

describe("T83 预置本地→云端可见", () => {
  it("仅本地档案合并后云端 list 可见", async () => {
    const local: LocalChartBundle = {
      profileId: "p-001",
      profile: mockProfile({ name: "本机盘" }),
      chart: mockChart(),
      localUpdatedAt: "2026-07-21T10:00:00.000Z",
    };

    const { uploaded, plan } = await applyMigrateLikeApi("user-mig", [local]);
    expect(plan.toUpload).toEqual(["p-001"]);
    expect(uploaded).toBe(1);

    const items = await listCloudCharts("user-mig");
    expect(items).toHaveLength(1);
    expect(items[0]?.profileId).toBe("p-001");
    expect(items[0]?.name).toBe("本机盘");

    const rec = await getCloudChart("user-mig", "p-001");
    expect(rec?.profile.name).toBe("本机盘");
  });

  it("同 id 本地较新则覆盖云端旧数据", async () => {
    await upsertCloudChart("user-mig", {
      profile: mockProfile({ name: "云端旧" }),
      chart: mockChart(),
    });
    // 等一下确保时间不同；用 plan 强制本地较新
    const local: LocalChartBundle = {
      profileId: "p-001",
      profile: mockProfile({ name: "本地新" }),
      chart: mockChart(),
      localUpdatedAt: "2099-01-01T00:00:00.000Z",
    };

    await applyMigrateLikeApi("user-mig", [local]);
    const rec = await getCloudChart("user-mig", "p-001");
    expect(rec?.profile.name).toBe("本地新");
  });

  it("同 id 本地无时间戳则不覆盖云端", async () => {
    await upsertCloudChart("user-mig", {
      profile: mockProfile({ name: "云端优先" }),
      chart: mockChart(),
    });
    const cloud = await getCloudChart("user-mig", "p-001");
    const local: LocalChartBundle = {
      profileId: "p-001",
      profile: mockProfile({ name: "本地无戳" }),
      chart: mockChart(),
      localUpdatedAt: null,
    };

    const { plan, uploaded } = await applyMigrateLikeApi("user-mig", [local]);
    expect(plan.toUpload).toEqual([]);
    expect(plan.toPull).toEqual(["p-001"]);
    expect(uploaded).toBe(0);
    expect((await getCloudChart("user-mig", "p-001"))?.profile.name).toBe(
      "云端优先",
    );
    expect(cloud?.profile.name).toBe("云端优先");
  });

  it("云端独有 + 本地独有：上传后两侧 id 均在云端", async () => {
    await upsertCloudChart("user-mig", {
      profile: mockProfile({ id: "cloud-only", name: "仅云" }),
      chart: mockChart({ profileId: "cloud-only" }),
    });
    const local: LocalChartBundle = {
      profileId: "local-only",
      profile: mockProfile({ id: "local-only", name: "仅本" }),
      chart: mockChart({ profileId: "local-only" }),
      localUpdatedAt: "2026-07-21T00:00:00.000Z",
    };

    const { plan } = await applyMigrateLikeApi("user-mig", [local]);
    expect(plan.toUpload).toEqual(["local-only"]);
    expect(plan.toPull).toEqual(["cloud-only"]);

    const items = await listCloudCharts("user-mig");
    const ids = items.map((i) => i.profileId).sort();
    expect(ids).toEqual(["cloud-only", "local-only"]);
  });
});
