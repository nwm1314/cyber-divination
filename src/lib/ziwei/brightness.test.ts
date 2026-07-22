import { describe, expect, it } from "vitest";
import { computeZiweiChart } from "./compute";
import {
  applyMajorBrightness,
  lookupMajorBrightness,
  MAJOR_BRIGHTNESS,
} from "./brightness";
import { ENGINE_VERSION } from "./tables/constants";
import type { ZiweiStar } from "@/lib/types/ziwei";

describe("T170 主星庙旺表", () => {
  it("十四主星均有表", () => {
    expect(Object.keys(MAJOR_BRIGHTNESS)).toHaveLength(14);
  });

  it("紫微午庙、酉陷", () => {
    expect(lookupMajorBrightness("紫微", "午")).toBe("庙");
    expect(lookupMajorBrightness("紫微", "酉")).toBe("陷");
  });

  it("太阳卯庙、子陷", () => {
    expect(lookupMajorBrightness("太阳", "卯")).toBe("庙");
    expect(lookupMajorBrightness("太阳", "子")).toBe("陷");
  });

  it("非主星返回 undefined", () => {
    expect(lookupMajorBrightness("文昌", "子")).toBeUndefined();
  });

  it("applyMajorBrightness 只改 major", () => {
    const stars: ZiweiStar[] = [
      { name: "紫微", category: "major" },
      { name: "左辅", category: "soft" },
    ];
    applyMajorBrightness(stars, "午");
    expect(stars[0]!.brightness).toBe("庙");
    expect(stars[1]!.brightness).toBeUndefined();
  });
});

describe("T170 compute 集成", () => {
  it("排盘主星带 brightness，engine 0.3.0", () => {
    const chart = computeZiweiChart({
      solarDate: "1990-05-15",
      birthTime: "12:00",
      gender: "male",
      analysisBaseDate: "2026-01-01",
    });
    expect(chart.meta.engineVersion).toBe(ENGINE_VERSION);
    const majors = chart.palaces.flatMap((p) =>
      p.stars.filter((s) => s.category === "major"),
    );
    expect(majors.length).toBe(14);
    expect(majors.every((s) => s.brightness)).toBe(true);
  });

  it("同输入确定性", () => {
    const input = {
      solarDate: "1988-03-20",
      birthTime: "10:00",
      gender: "female" as const,
      analysisBaseDate: "2026-01-01",
    };
    const a = computeZiweiChart(input);
    const b = computeZiweiChart(input);
    expect(
      a.palaces.map((p) => p.stars.map((s) => [s.name, s.brightness])),
    ).toEqual(
      b.palaces.map((p) => p.stars.map((s) => [s.name, s.brightness])),
    );
  });
});
