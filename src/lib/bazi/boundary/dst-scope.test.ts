import { describe, expect, it } from "vitest";
import { computeChart } from "../index";
import type { BirthProfile } from "@/lib/types";

describe("historical DST scope", () => {
  it("makes the unsupported historical DST policy visible", () => {
    const profile: BirthProfile = {
      id: "dst-scope",
      name: "scope",
      solarDate: "1990-05-15",
      birthTime: "10:30",
      gender: "male",
      birthPlace: { province: "北京", city: "北京", lng: 116.4, lat: 39.9 },
      alive: true,
      analysisBaseDate: "2026-08-12",
      useTrueSolarTime: true,
    };
    const chart = computeChart(profile);
    expect(chart.flags).toContain("dst_not_modeled");
    expect(chart.warnings?.some((warning) => warning.includes("夏令时"))).toBe(
      true,
    );
  });
});
