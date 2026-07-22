import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { BirthProfile, BaziChart, ReadingReport } from "@/lib/types";
import type { ZiweiChart } from "@/lib/types/ziwei";
import {
  saveProfile,
  getProfile,
  saveChart,
  getChart,
  saveReport,
  getReport,
  listCharts,
  deleteChart,
  deleteReport,
  saveZiweiChart,
  getZiweiChart,
  listZiweiCharts,
  deleteZiweiChart,
  USER_ID,
} from "./index";

function createMockProfile(overrides?: Partial<BirthProfile>): BirthProfile {
  return {
    id: "test-001",
    name: "张三",
    gender: "male",
    solarDate: "1990-01-01",
    alive: true,
    analysisBaseDate: "2026-07-20",
    useTrueSolarTime: false,
    ...overrides,
  };
}

function createMockChart(overrides?: Partial<BaziChart>): BaziChart {
  return {
    profileId: "test-001",
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

function createMockReport(overrides?: Partial<ReadingReport>): ReadingReport {
  return {
    chartId: "test-001",
    mode: "template",
    viewMode: "plain",
    sections: [],
    calibratePrompts: [],
    disclaimer: "仅供娱乐参考",
    ...overrides,
  };
}

function mockStorage() {
  const store = new Map<string, string>();
  return {
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
  };
}

beforeEach(() => {
  const local = mockStorage();
  const session = mockStorage();
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", session);
  // 账号模式：单测沿用 localStorage 语义
  local.setItem("bd_account_mode", "1");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("storage CRUD", () => {
  it("should export USER_ID", () => {
    expect(USER_ID).toBe("default-user");
  });

  describe("saveProfile / getProfile", () => {
    it("should save and retrieve a profile", () => {
      const profile = createMockProfile();
      saveProfile(profile);
      const retrieved = getProfile("test-001");
      expect(retrieved).toEqual(profile);
    });

    it("should return null for non-existent profile", () => {
      expect(getProfile("nonexistent")).toBeNull();
    });

    it("should overwrite existing profile on re-save", () => {
      saveProfile(createMockProfile({ name: "李四" }));
      saveProfile(createMockProfile({ name: "王五" }));
      expect(getProfile("test-001")?.name).toBe("王五");
    });
  });

  describe("saveChart / getChart", () => {
    it("should save and retrieve a chart", () => {
      const profile = createMockProfile();
      saveProfile(profile);
      const chart = createMockChart();
      saveChart(chart);
      expect(getChart("test-001")).toEqual(chart);
    });

    it("should return null for non-existent chart", () => {
      expect(getChart("nonexistent")).toBeNull();
    });

    it("should update listCharts when chart is saved", () => {
      saveProfile(createMockProfile());
      saveChart(createMockChart());
      const list = listCharts();
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        profileId: "test-001",
        name: "张三",
        date: "2026-07-20",
      });
    });
  });

  describe("saveReport / getReport", () => {
    it("should save and retrieve a report", () => {
      const report = createMockReport();
      saveReport(report);
      expect(getReport("test-001")).toEqual(report);
    });

    it("should return null for non-existent report", () => {
      expect(getReport("nonexistent")).toBeNull();
    });
  });

  describe("listCharts", () => {
    it("should return empty array when no charts exist", () => {
      expect(listCharts()).toEqual([]);
    });

    it("should list multiple charts", () => {
      saveProfile(createMockProfile({ id: "p1", name: "甲" }));
      saveChart(createMockChart({ profileId: "p1" }));
      saveProfile(createMockProfile({ id: "p2", name: "乙" }));
      saveChart(createMockChart({ profileId: "p2" }));

      const list = listCharts();
      expect(list).toHaveLength(2);
      expect(list.map((e) => e.profileId)).toEqual(["p1", "p2"]);
    });

    it("should not duplicate entries when chart is re-saved", () => {
      saveProfile(createMockProfile());
      saveChart(createMockChart());
      saveChart(createMockChart());
      expect(listCharts()).toHaveLength(1);
    });
  });

  describe("deleteChart", () => {
    it("should remove profile, chart, and list entry", () => {
      saveProfile(createMockProfile());
      saveChart(createMockChart());
      deleteChart("test-001");

      expect(getProfile("test-001")).toBeNull();
      expect(getChart("test-001")).toBeNull();
      expect(listCharts()).toHaveLength(0);
    });

    it("should not throw when deleting non-existent chart", () => {
      expect(() => deleteChart("nonexistent")).not.toThrow();
    });
  });

  describe("deleteReport", () => {
    it("should remove report", () => {
      saveReport(createMockReport());
      deleteReport("test-001");
      expect(getReport("test-001")).toBeNull();
    });

    it("should not throw when deleting non-existent report", () => {
      expect(() => deleteReport("nonexistent")).not.toThrow();
    });
  });

  describe("data persistence across refreshes (simulated)", () => {
    it("should retain data after localStorage clear+re-init is avoided", () => {
      saveProfile(createMockProfile());
      saveChart(createMockChart());
      saveReport(createMockReport());

      expect(getProfile("test-001")).not.toBeNull();
      expect(getChart("test-001")).not.toBeNull();
      expect(getReport("test-001")).not.toBeNull();
    });
  });

  describe("ziwei local storage (T107)", () => {
    function mockZiwei(overrides?: Partial<ZiweiChart>): ZiweiChart {
      return {
        id: "zw_test_1",
        name: "紫微测试",
        palaces: [],
        mingGong: "命宫",
        shenGong: "迁移",
        majorStars: {},
        daxian: [],
        flags: [],
        meta: { engineVersion: "0.1.0", skillRef: "ziwei-tables" },
        ...overrides,
      };
    }

    it("save / get / list / delete", () => {
      const chart = mockZiwei();
      saveZiweiChart(chart, { solarDate: "1990-05-01" });
      expect(getZiweiChart("zw_test_1")).toEqual(chart);
      const list = listZiweiCharts();
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        chartId: "zw_test_1",
        name: "紫微测试",
        date: "1990-05-01",
      });
      deleteZiweiChart("zw_test_1");
      expect(getZiweiChart("zw_test_1")).toBeNull();
      expect(listZiweiCharts()).toHaveLength(0);
    });

    it("upsert updates list entry without duplicating", () => {
      saveZiweiChart(mockZiwei());
      saveZiweiChart(mockZiwei({ name: "改名" }), { solarDate: "2000-01-01" });
      expect(listZiweiCharts()).toHaveLength(1);
      expect(listZiweiCharts()[0]?.name).toBe("改名");
      expect(listZiweiCharts()[0]?.date).toBe("2000-01-01");
    });

    it("persists across re-read (refresh)", () => {
      saveZiweiChart(mockZiwei({ id: "zw_persist" }), {
        solarDate: "1988-12-12",
      });
      expect(getZiweiChart("zw_persist")?.id).toBe("zw_persist");
      expect(listZiweiCharts().some((e) => e.chartId === "zw_persist")).toBe(
        true,
      );
    });
  });
});
