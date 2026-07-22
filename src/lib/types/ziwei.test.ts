import { describe, expect, it } from "vitest";
import type {
  ZiweiChart,
  ZiweiChartInput,
  ZiweiPalace,
} from "@/lib/types";
import {
  ZIWEI_ENGINE_VERSION_PLACEHOLDER,
  ZIWEI_SKILL_REF,
} from "@/lib/types";
import {
  ENGINE_VERSION,
  SKILL_REF,
  type ZiweiChart as ZiweiChartFromEngine,
} from "@/lib/ziwei";

describe("紫微类型契约（T100）", () => {
  it("常量与 skillRef 对齐", () => {
    expect(ZIWEI_SKILL_REF).toBe("ziwei-tables");
    expect(SKILL_REF).toBe(ZIWEI_SKILL_REF);
    expect(ENGINE_VERSION).toBe(ZIWEI_ENGINE_VERSION_PLACEHOLDER);
  });

  it("§6.4 ZiweiChart 最小结构可赋值", () => {
    const palace: ZiweiPalace = {
      name: "命宫",
      branch: "子",
      stars: [{ name: "紫微", category: "major" }],
      isShenGong: true,
    };

    const chart: ZiweiChart = {
      id: "zw_smoke_1",
      personId: "person_1",
      profileId: "profile_1",
      palaces: [palace],
      mingGong: "命宫",
      shenGong: "命宫",
      majorStars: { 命宫: ["紫微"] },
      daxian: [{ startAge: 5, endAge: 14, palace: "命宫" }],
      flags: [],
      meta: {
        engineVersion: ZIWEI_ENGINE_VERSION_PLACEHOLDER,
        skillRef: ZIWEI_SKILL_REF,
        school: "sanhe",
        agePolicy: "xusui",
        schools: { core: "sanhe", feixing: "feixing" },
      },
    };

    const fromEngine: ZiweiChartFromEngine = chart;
    expect(fromEngine.mingGong).toBe("命宫");
    expect(fromEngine.meta.skillRef).toBe("ziwei-tables");
    expect(fromEngine.majorStars["命宫"]).toEqual(["紫微"]);
  });

  it("ZiweiChartInput 可挂 person / profile", () => {
    const input: ZiweiChartInput = {
      solarDate: "1990-01-15",
      birthTime: "10:30",
      gender: "female",
      personId: "person_1",
      profileId: "profile_1",
      useTrueSolarTime: false,
    };
    expect(input.gender).toBe("female");
    expect(input.personId).toBe("person_1");
  });
});
