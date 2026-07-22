import { describe, expect, it } from "vitest";
import {
  BOSHI_TWELVE,
  placeBoshiTwelve,
  boshiAtYin,
} from "./boshi";
import { LUCUN_BY_YEAR_STEM } from "./tables/aux-stars";
import { yinIndexFromBranch } from "./tables/constants";
import { computeZiweiChart } from "./compute";

describe("博士十二神（T182）", () => {
  it("十二神齐全", () => {
    expect(BOSHI_TWELVE).toHaveLength(12);
    expect(BOSHI_TWELVE[0]).toBe("博士");
    expect(BOSHI_TWELVE[11]).toBe("官府");
  });

  it("禄存起博士；阳男顺", () => {
    const place = placeBoshiTwelve({
      yearStem: "甲",
      yearBranch: "午",
      gender: "male",
    });
    const lucunYi = yinIndexFromBranch(LUCUN_BY_YEAR_STEM.甲);
    expect(place.博士).toBe(lucunYi);
    // 顺行：力士 = 博士+1
    expect(place.力士).toBe((lucunYi + 1) % 12);
  });

  it("阴男逆行", () => {
    const place = placeBoshiTwelve({
      yearStem: "乙",
      yearBranch: "丑",
      gender: "male",
    });
    const lucunYi = yinIndexFromBranch(LUCUN_BY_YEAR_STEM.乙);
    expect(place.博士).toBe(lucunYi);
    expect(place.力士).toBe((lucunYi - 1 + 12) % 12);
  });

  it("每宫至多一神；十二宫覆盖", () => {
    const place = placeBoshiTwelve({
      yearStem: "庚",
      yearBranch: "申",
      gender: "female",
    });
    const seen = new Set<number>();
    for (const name of BOSHI_TWELVE) {
      seen.add(place[name]);
    }
    expect(seen.size).toBe(12);
    for (let yi = 0; yi < 12; yi++) {
      expect(boshiAtYin(place, yi)).toHaveLength(1);
    }
  });

  it("入盘 category=misc", () => {
    const chart = computeZiweiChart({
      solarDate: "1988-08-08",
      birthTime: "08:00",
      gender: "female",
      analysisBaseDate: "2024-01-01",
    });
    const misc = chart.palaces.flatMap((p) =>
      p.stars.filter((s) => s.category === "misc"),
    );
    expect(misc).toHaveLength(12);
    expect(misc.map((s) => s.name).sort()).toEqual(
      [...BOSHI_TWELVE].sort(),
    );
  });
});
