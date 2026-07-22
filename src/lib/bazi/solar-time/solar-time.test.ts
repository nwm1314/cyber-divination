import { describe, expect, it } from "vitest";
import { calcSolarTimeOffset, calcTrueSolarTime } from "./index";

describe("calcSolarTimeOffset", () => {
  it("120°E 经度偏移 0（均时差在 6 月中近似 0）", () => {
    const r = calcSolarTimeOffset(120, "2024-06-15", "10:30");
    // 6 月 15 日 eot 很小，应接近 10:30
    expect(r).toMatch(/^\d{2}:\d{2}$/);
    const [h, m] = r.split(":").map(Number);
    expect(h * 60 + m).toBeGreaterThanOrEqual(10 * 60 + 25);
    expect(h * 60 + m).toBeLessThanOrEqual(10 * 60 + 35);
  });

  it("东经 105°E（云南）偏西 15°→ 减约 60 分", () => {
    const r = calcSolarTimeOffset(105, "2024-06-15", "12:00");
    const [h] = r.split(":").map(Number);
    expect(h).toBeLessThan(12);
  });

  it("东经 90°E（西藏）偏西 30°→ 减约 120 分", () => {
    const r = calcSolarTimeOffset(90, "2024-06-15", "12:00");
    expect(r).toBe("10:00");
  });

  it("东经 135°E（东北东部）偏东 15°→ 加约 51 分（含均时差）", () => {
    const r = calcSolarTimeOffset(135, "2024-01-15", "10:00");
    expect(r).toBe("10:51");
  });

  it("跨日边界：23:30 经度加 60 分 → 00:30", () => {
    const r = calcSolarTimeOffset(135, "2024-06-15", "23:30");
    expect(r).toBe("00:30");
  });

  it("输出格式 HH:mm 稳定", () => {
    const r = calcSolarTimeOffset(116, "2024-03-20", "08:00");
    expect(r).toMatch(/^\d{2}:\d{2}$/);
  });

  it("北京 116°E 示例", () => {
    const r = calcSolarTimeOffset(116, "2024-06-15", "10:30");
    expect(r).not.toBe("10:30");
  });
});

describe("calcTrueSolarTime 跨日", () => {
  it("23:30 + 东经 135° → 次日 00:30，dayDelta=1", () => {
    const r = calcTrueSolarTime(135, "2024-06-15", "23:30");
    expect(r.birthTime).toBe("00:30");
    expect(r.dayDelta).toBe(1);
    expect(r.solarDate).toBe("2024-06-16");
  });

  it("00:30 + 西经度偏移可能回到前一日", () => {
    const r = calcTrueSolarTime(90, "2024-06-15", "00:30");
    expect(r.dayDelta).toBeLessThanOrEqual(0);
    expect(r.solarDate <= "2024-06-15").toBe(true);
  });
});
