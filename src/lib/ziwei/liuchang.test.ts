import { describe, expect, it } from "vitest";
import {
  JIEKONG_BY_YEAR_STEM,
  jiekongYinIndices,
  liuChangQuByYearBranch,
  placeLiuChangJiekong,
  liuChangJiekongAsZiwei,
} from "./liuchang";
import { yinIndexFromBranch, ENGINE_VERSION } from "./tables/constants";
import { changQuByHourBranch } from "./tables/aux-stars";
import { computeZiweiChart } from "./compute";

describe("流昌流曲（T191）", () => {
  it("与本命昌曲公式一致（年支当子时）", () => {
    const branch = "午" as const;
    const liu = liuChangQuByYearBranch(branch);
    const ben = changQuByHourBranch(branch);
    expect(liu.liuChang).toBe(ben.chang);
    expect(liu.liuQu).toBe(ben.qu);
  });

  it("入盘恰一颗流昌、一颗流曲", () => {
    const chart = computeZiweiChart({
      solarDate: "1990-05-15",
      birthTime: "10:00",
      gender: "male",
      analysisBaseDate: "2024-01-01",
    });
    const names = chart.palaces.flatMap((p) => p.stars.map((s) => s.name));
    expect(names.filter((n) => n === "流昌")).toHaveLength(1);
    expect(names.filter((n) => n === "流曲")).toHaveLength(1);
    expect(chart.meta.engineVersion).toBe(ENGINE_VERSION);
  });
});

describe("截空（T192）", () => {
  it("年干表完整", () => {
    expect(Object.keys(JIEKONG_BY_YEAR_STEM)).toHaveLength(10);
    expect(JIEKONG_BY_YEAR_STEM.甲).toEqual(["申", "酉"]);
    expect(JIEKONG_BY_YEAR_STEM.戊).toEqual(["子", "丑"]);
  });

  it("截空两宫", () => {
    const [a, b] = jiekongYinIndices("甲");
    expect(a).toBe(yinIndexFromBranch("申"));
    expect(b).toBe(yinIndexFromBranch("酉"));
  });

  it("入盘两颗截空", () => {
    const chart = computeZiweiChart({
      solarDate: "1994-08-15",
      birthTime: "12:00",
      gender: "male",
      analysisBaseDate: "2020-01-01",
    });
    const jk = chart.palaces.flatMap((p) =>
      p.stars.filter((s) => s.name === "截空"),
    );
    expect(jk).toHaveLength(2);
    expect(jk.every((s) => s.category === "harsh")).toBe(true);
  });

  it("placeLiuChangJiekong 可测", () => {
    const p = placeLiuChangJiekong({
      yearStem: "甲",
      flowBranch: "子",
    });
    const stars0 = liuChangJiekongAsZiwei(p, 0);
    // 不要求 0 宫必有星，但 placement 结构完整
    expect(p.starYinIndex.流昌).toBeTypeOf("number");
    expect(p.starYinIndex.流曲).toBeTypeOf("number");
    expect(Array.isArray(p.starYinIndex.截空)).toBe(true);
    expect(stars0.every((s) => s.name)).toBe(true);
  });
});
