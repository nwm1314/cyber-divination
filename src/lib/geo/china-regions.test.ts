import { describe, expect, it } from "vitest";
import {
  CHINA_REGIONS,
  listCities,
  listProvinces,
  lookupLng,
} from "./china-regions";

describe("china-regions", () => {
  it("覆盖全部省级行政区（含港澳台）", () => {
    const names = listProvinces();
    expect(names.length).toBeGreaterThanOrEqual(34);
    expect(names).toContain("北京市");
    expect(names).toContain("新疆维吾尔自治区");
    expect(names).toContain("香港特别行政区");
    expect(names).toContain("台湾省");
  });

  it("各省至少 1 个城市且有经度", () => {
    for (const p of CHINA_REGIONS) {
      expect(p.cities.length).toBeGreaterThan(0);
      for (const c of p.cities) {
        expect(c.lng).toBeGreaterThan(70);
        expect(c.lng).toBeLessThan(140);
      }
    }
  });

  it("lookupLng 北京/乌鲁木齐", () => {
    expect(lookupLng("北京市", "北京市")).toBeCloseTo(116.41, 1);
    expect(lookupLng("新疆维吾尔自治区", "乌鲁木齐市")).toBeCloseTo(87.62, 1);
  });

  it("广东省含主要地级市", () => {
    const cities = listCities("广东省").map((c) => c.name);
    expect(cities).toContain("广州市");
    expect(cities).toContain("深圳市");
    expect(cities).toContain("东莞市");
  });
});
