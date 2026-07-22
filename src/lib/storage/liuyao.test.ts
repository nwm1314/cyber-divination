import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { LiuyaoChart } from "@/lib/types/liuyao";
import {
  saveLiuyaoChart,
  getLiuyaoChart,
  listLiuyaoCharts,
  deleteLiuyaoChart,
} from "./liuyao";

function mockChart(overrides?: Partial<LiuyaoChart>): LiuyaoChart {
  return {
    id: "ly_test_1",
    userId: null,
    question: "此次合作是否宜推进",
    method: "manual",
    lines: [
      { yao: 1, value: 7, changing: false },
      { yao: 2, value: 8, changing: false },
      { yao: 3, value: 9, changing: true },
      { yao: 4, value: 7, changing: false },
      { yao: 5, value: 6, changing: true },
      { yao: 6, value: 8, changing: false },
    ],
    benGua: { name: "水雷屯", upper: "坎", lower: "震" },
    bianGua: { name: "地水师", upper: "坤", lower: "坎" },
    shiYao: 0,
    yingYao: 0,
    meta: { engineVersion: "0.1.0" },
    ...overrides,
  };
}

function mockStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
}

describe("liuyao storage", () => {
  beforeEach(() => {
    const local = mockStorage();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", mockStorage());
    local.setItem("bd_account_mode", "1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("save / get / list / delete", () => {
    const chart = mockChart();
    saveLiuyaoChart(chart);
    expect(getLiuyaoChart("ly_test_1")).toEqual(chart);
    const list = listLiuyaoCharts();
    expect(list).toHaveLength(1);
    expect(list[0]?.question).toBe(chart.question);
    expect(list[0]?.benGuaName).toBe("水雷屯");
    deleteLiuyaoChart("ly_test_1");
    expect(getLiuyaoChart("ly_test_1")).toBeNull();
    expect(listLiuyaoCharts()).toHaveLength(0);
  });

  it("upsert keeps createdAt", () => {
    saveLiuyaoChart(mockChart());
    const first = listLiuyaoCharts()[0]!.createdAt;
    saveLiuyaoChart(mockChart({ question: "改问" }));
    expect(listLiuyaoCharts()[0]?.createdAt).toBe(first);
    expect(getLiuyaoChart("ly_test_1")?.question).toBe("改问");
  });
});
