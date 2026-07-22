import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { BirthProfile, BaziChart } from "@/lib/types";
import {
  collectLocalChartsForMigrate,
  pickConflictWinner,
  planMerge,
  parseIsoMs,
  applyCloudRecordToLocal,
  formatMigrateSummary,
  skipMigratePrompt,
  isMigrateSkipped,
  markMigrateDone,
  isMigrateDone,
  clearMigrateFlags,
  shouldShowMigratePrompt,
  touchLocalUpdatedAt,
  readLocalUpdatedAt,
} from "./migrate";
import {
  saveProfile,
  saveChart,
  getProfile,
  getChart,
  listCharts,
} from "./index";
import type { CloudChartRecord } from "./cloud-types";

function mockProfile(overrides?: Partial<BirthProfile>): BirthProfile {
  return {
    id: "p-local",
    name: "本地人",
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
    profileId: "p-local",
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

beforeEach(() => {
  const store = new Map<string, string>();
  const session = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => store.clear()),
    get length() {
      return store.size;
    },
    key: vi.fn(() => null),
  });
  vi.stubGlobal("sessionStorage", {
    getItem: vi.fn((key: string) => session.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      session.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      session.delete(key);
    }),
    clear: vi.fn(() => session.clear()),
    get length() {
      return session.size;
    },
    key: vi.fn(() => null),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseIsoMs / pickConflictWinner", () => {
  it("解析无效时间返回 null", () => {
    expect(parseIsoMs(null)).toBeNull();
    expect(parseIsoMs("")).toBeNull();
    expect(parseIsoMs("not-a-date")).toBeNull();
  });

  it("两侧皆无时间戳 → 云端优先", () => {
    expect(pickConflictWinner(null, null)).toBe("cloud");
    expect(pickConflictWinner(undefined, undefined)).toBe("cloud");
  });

  it("仅本地有时间戳 → 本地胜", () => {
    expect(pickConflictWinner("2026-07-21T10:00:00.000Z", null)).toBe("local");
  });

  it("仅云端有时间戳 → 云端胜", () => {
    expect(pickConflictWinner(null, "2026-07-21T10:00:00.000Z")).toBe("cloud");
  });

  it("较新者胜；相等 → 云端", () => {
    const older = "2026-07-20T00:00:00.000Z";
    const newer = "2026-07-21T00:00:00.000Z";
    expect(pickConflictWinner(newer, older)).toBe("local");
    expect(pickConflictWinner(older, newer)).toBe("cloud");
    expect(pickConflictWinner(newer, newer)).toBe("cloud");
  });
});

describe("planMerge 冲突策略", () => {
  it("仅本地有 → upload", () => {
    const plan = planMerge(
      { a: { updatedAt: "2026-07-21T00:00:00.000Z" } },
      {},
    );
    expect(plan.toUpload).toEqual(["a"]);
    expect(plan.toPull).toEqual([]);
    expect(plan.decisions[0]?.kind).toBe("upload");
  });

  it("仅云端有 → 默认 pull", () => {
    const plan = planMerge(
      {},
      { b: { updatedAt: "2026-07-21T00:00:00.000Z" } },
    );
    expect(plan.toPull).toEqual(["b"]);
    expect(plan.decisions[0]?.kind).toBe("pull");
  });

  it("仅云端有且关闭拉取 → keep_cloud 不 pull", () => {
    const plan = planMerge(
      {},
      { b: { updatedAt: "2026-07-21T00:00:00.000Z" } },
      { pullCloudOnly: false },
    );
    expect(plan.toPull).toEqual([]);
    expect(plan.decisions[0]?.kind).toBe("keep_cloud");
  });

  it("同 id 本地较新 → keep_local + upload", () => {
    const plan = planMerge(
      { x: { updatedAt: "2026-07-22T00:00:00.000Z" } },
      { x: { updatedAt: "2026-07-20T00:00:00.000Z" } },
    );
    expect(plan.toUpload).toEqual(["x"]);
    expect(plan.decisions[0]?.kind).toBe("keep_local");
  });

  it("同 id 云端较新 → keep_cloud + pull", () => {
    const plan = planMerge(
      { x: { updatedAt: "2026-07-20T00:00:00.000Z" } },
      { x: { updatedAt: "2026-07-22T00:00:00.000Z" } },
    );
    expect(plan.toPull).toEqual(["x"]);
    expect(plan.decisions[0]?.kind).toBe("keep_cloud");
  });

  it("同 id 本地无时间戳 → 云端优先 pull", () => {
    const plan = planMerge(
      { x: { updatedAt: null } },
      { x: { updatedAt: "2026-07-21T00:00:00.000Z" } },
    );
    expect(plan.toPull).toEqual(["x"]);
    expect(plan.decisions[0]?.kind).toBe("keep_cloud");
  });

  it("同 id 时间相等 → equal_cloud 不覆盖", () => {
    const t = "2026-07-21T12:00:00.000Z";
    const plan = planMerge({ x: { updatedAt: t } }, { x: { updatedAt: t } });
    expect(plan.toUpload).toEqual([]);
    expect(plan.toPull).toEqual([]);
    expect(plan.decisions[0]?.kind).toBe("equal_cloud");
  });

  it("混合场景不丢盘：本地独有上传、云端独有拉取、冲突按时间", () => {
    const plan = planMerge(
      {
        onlyLocal: { updatedAt: "2026-07-21T00:00:00.000Z" },
        both: { updatedAt: "2026-07-22T00:00:00.000Z" },
      },
      {
        onlyCloud: { updatedAt: "2026-07-21T00:00:00.000Z" },
        both: { updatedAt: "2026-07-20T00:00:00.000Z" },
      },
    );
    expect(plan.toUpload.sort()).toEqual(["both", "onlyLocal"]);
    expect(plan.toPull).toEqual(["onlyCloud"]);
    expect(plan.decisions).toHaveLength(3);
  });
});

describe("collectLocalChartsForMigrate + 本地时间戳", () => {
  it("收集完整档案并附带 localUpdatedAt", () => {
    saveProfile(mockProfile({ id: "p1", name: "甲" }));
    saveChart(mockChart({ profileId: "p1" }));
    touchLocalUpdatedAt("p1", "2026-07-21T08:00:00.000Z");

    const bundles = collectLocalChartsForMigrate();
    expect(bundles).toHaveLength(1);
    expect(bundles[0]?.profileId).toBe("p1");
    expect(bundles[0]?.profile.name).toBe("甲");
    expect(bundles[0]?.localUpdatedAt).toBe("2026-07-21T08:00:00.000Z");
  });

  it("缺 chart 的条目跳过", () => {
    saveProfile(mockProfile({ id: "orphan" }));
    expect(collectLocalChartsForMigrate()).toEqual([]);
  });
});

describe("applyCloudRecordToLocal 不丢盘", () => {
  it("拉取云端写入本地后可见", () => {
    const rec: CloudChartRecord = {
      id: "cloud-1",
      userId: "u1",
      profile: mockProfile({ id: "cloud-1", name: "云端人" }),
      chart: mockChart({ profileId: "cloud-1" }),
      report: null,
      calibration: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-21T00:00:00.000Z",
    };
    applyCloudRecordToLocal(rec);
    expect(getProfile("cloud-1")?.name).toBe("云端人");
    expect(getChart("cloud-1")?.profileId).toBe("cloud-1");
    expect(listCharts().some((e) => e.profileId === "cloud-1")).toBe(true);
    expect(readLocalUpdatedAt("cloud-1")).toBe("2026-07-21T00:00:00.000Z");
  });
});

describe("跳过 / 完成标记", () => {
  it("skip 后 isMigrateSkipped；done 后 isMigrateDone", () => {
    expect(isMigrateSkipped("user-a")).toBe(false);
    skipMigratePrompt("user-a");
    expect(isMigrateSkipped("user-a")).toBe(true);
    expect(isMigrateSkipped("user-b")).toBe(false);

    markMigrateDone("user-a");
    expect(isMigrateDone("user-a")).toBe(true);

    clearMigrateFlags();
    expect(isMigrateSkipped("user-a")).toBe(false);
    expect(isMigrateDone("user-a")).toBe(false);
  });

  it("有本地盘且未跳过/完成 → 应展示引导", () => {
    saveProfile(mockProfile({ id: "p-show" }));
    saveChart(mockChart({ profileId: "p-show" }));
    expect(shouldShowMigratePrompt("u1")).toBe(true);
    skipMigratePrompt("u1");
    expect(shouldShowMigratePrompt("u1")).toBe(false);
  });
});

describe("formatMigrateSummary", () => {
  it("生成中文摘要", () => {
    const s = formatMigrateSummary(
      { uploaded: 2, pulled: 1, keptLocal: 1, keptCloud: 0, equal: 0 },
      1,
    );
    expect(s).toContain("上传 2");
    expect(s).toContain("拉取 1");
  });
});
