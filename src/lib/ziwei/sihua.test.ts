import { describe, expect, it } from "vitest";
import { computeZiweiChart } from "./compute";
import {
  applyBirthYearSihua,
  getBirthYearSihua,
  sihuaMarksByStar,
} from "./sihua";
import { SIHUA_BY_YEAR_STEM } from "./tables/sihua";
import type { Tiangan } from "./tables/constants";
import type { ZiweiStar } from "@/lib/types/ziwei";

describe("生年四化表 · 年干→目标星", () => {
  const cases: [Tiangan, string, string, string, string][] = [
    ["甲", "廉贞", "破军", "武曲", "太阳"],
    ["乙", "天机", "天梁", "紫微", "太阴"],
    ["丙", "天同", "天机", "文昌", "廉贞"],
    ["丁", "太阴", "天同", "天机", "巨门"],
    ["戊", "贪狼", "太阴", "右弼", "天机"],
    ["己", "武曲", "贪狼", "天梁", "文曲"],
    ["庚", "太阳", "武曲", "太阴", "天同"],
    ["辛", "巨门", "太阳", "文曲", "文昌"],
    ["壬", "天梁", "紫微", "左辅", "武曲"],
    ["癸", "破军", "巨门", "太阴", "贪狼"],
  ];

  it.each(cases)(
    "%s → 禄%s 权%s 科%s 忌%s",
    (stem, lu, quan, ke, ji) => {
      expect(getBirthYearSihua(stem)).toEqual({
        禄: lu,
        权: quan,
        科: ke,
        忌: ji,
      });
      expect(SIHUA_BY_YEAR_STEM[stem]).toEqual({
        禄: lu,
        权: quan,
        科: ke,
        忌: ji,
      });
    },
  );

  it("十干表齐全", () => {
    expect(Object.keys(SIHUA_BY_YEAR_STEM)).toHaveLength(10);
  });
});

describe("applyBirthYearSihua", () => {
  it("甲干标记廉贞禄破军权武曲科太阳忌", () => {
    const stars: ZiweiStar[] = [
      { name: "廉贞", category: "major" },
      { name: "破军", category: "major" },
      { name: "武曲", category: "major" },
      { name: "太阳", category: "major" },
      { name: "天机", category: "major" },
    ];
    applyBirthYearSihua(stars, "甲");
    expect(stars.find((s) => s.name === "廉贞")?.sihua).toEqual(["禄"]);
    expect(stars.find((s) => s.name === "破军")?.sihua).toEqual(["权"]);
    expect(stars.find((s) => s.name === "武曲")?.sihua).toEqual(["科"]);
    expect(stars.find((s) => s.name === "太阳")?.sihua).toEqual(["忌"]);
    expect(stars.find((s) => s.name === "天机")?.sihua).toBeUndefined();
  });

  it("sihuaMarksByStar 映射稳定", () => {
    const m = sihuaMarksByStar("庚");
    expect(m.get("太阳")).toEqual(["禄"]);
    expect(m.get("武曲")).toEqual(["权"]);
    expect(m.get("太阴")).toEqual(["科"]);
    expect(m.get("天同")).toEqual(["忌"]);
  });
});

describe("computeZiweiChart · 生年四化集成", () => {
  it("盘中主星带 sihua（甲年廉贞禄）", () => {
    // 1994 甲戌
    const chart = computeZiweiChart({
      solarDate: "1994-08-15",
      birthTime: "12:00",
      gender: "male",
      analysisBaseDate: "2020-01-01",
    });
    const marked = chart.palaces
      .flatMap((p) => p.stars)
      .filter((s) => s.sihua?.length);
    const byName = Object.fromEntries(
      marked.map((s) => [s.name, s.sihua]),
    );
    // 生年四化必在；T181 后可叠「自化X」
    expect(byName["廉贞"]).toContain("禄");
    expect(byName["破军"]).toContain("权");
    expect(byName["武曲"]).toContain("科");
    expect(byName["太阳"]).toContain("忌");
  });

  it("同输入确定性", () => {
    const input = {
      solarDate: "1990-05-15",
      birthTime: "10:00",
      gender: "female" as const,
      analysisBaseDate: "2020-01-01",
    };
    expect(computeZiweiChart(input)).toEqual(computeZiweiChart(input));
  });
});
