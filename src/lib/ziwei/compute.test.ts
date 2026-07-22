import { describe, expect, it } from "vitest";
import {
  computeZiweiChart,
  ENGINE_VERSION,
  SKILL_REF,
  fiveElementsClass,
  locateZiweiTianfu,
  placeMingShen,
  placeMajorStars,
} from "./index";
import type { ZiweiChartInput } from "@/lib/types/ziwei";
import { branchFromYinIndex } from "./tables/constants";

function baseInput(
  partial: Partial<ZiweiChartInput> & { solarDate: string },
): ZiweiChartInput {
  return {
    gender: "male",
    birthTime: "12:00",
    ...partial,
  };
}

describe("locateZiweiTianfu · 经典口诀例", () => {
  it("27 日木三局 → 戌", () => {
    const { ziweiYinIndex } = locateZiweiTianfu(27, 3);
    expect(branchFromYinIndex(ziweiYinIndex)).toBe("戌");
  });

  it("13 日火六局 → 亥", () => {
    const { ziweiYinIndex } = locateZiweiTianfu(13, 6);
    expect(branchFromYinIndex(ziweiYinIndex)).toBe("亥");
  });

  it("6 日土五局 → 未", () => {
    const { ziweiYinIndex } = locateZiweiTianfu(6, 5);
    expect(branchFromYinIndex(ziweiYinIndex)).toBe("未");
  });

  it("天府为紫微对宫", () => {
    for (const day of [1, 8, 15, 22, 30]) {
      for (const ju of [2, 3, 4, 5, 6]) {
        const { ziweiYinIndex, tianfuYinIndex } = locateZiweiTianfu(day, ju);
        expect((ziweiYinIndex + tianfuYinIndex) % 12).toBe(0);
      }
    }
  });
});

describe("fiveElementsClass · 纳音局", () => {
  it("丙子 → 水二局", () => {
    expect(fiveElementsClass("丙", "子")).toBe("水二局");
  });
  it("辛未 → 土五局", () => {
    expect(fiveElementsClass("辛", "未")).toBe("土五局");
  });
  it("庚申 → 木三局", () => {
    expect(fiveElementsClass("庚", "申")).toBe("木三局");
  });
});

describe("placeMingShen", () => {
  it("正月子时 → 命寅身寅", () => {
    const r = placeMingShen(1, "子", "甲");
    expect(r.mingBranch).toBe("寅");
    expect(r.shenBranch).toBe("寅");
    expect(r.shenGong).toBe("命宫");
  });

  it("四月巳时 → 命子身戌", () => {
    // monthIndex=3, hour=5 → ming=3-5=-2→10→子, shen=8→戌
    const r = placeMingShen(4, "巳", "庚");
    expect(r.mingBranch).toBe("子");
    expect(r.shenBranch).toBe("戌");
  });
});

describe("placeMajorStars · 紫微星系逆 / 天府顺", () => {
  it("紫微在戌时天机在酉", () => {
    // 27 日木三 → 紫微戌；天府为寅申轴镜像 → 午
    const p = placeMajorStars(27, 3);
    expect(p.starBranch["紫微"]).toBe("戌");
    expect(p.starBranch["天机"]).toBe("酉");
    expect(p.starBranch["太阳"]).toBe("未");
    expect(p.starBranch["武曲"]).toBe("午");
    expect(p.starBranch["天同"]).toBe("巳");
    expect(p.starBranch["廉贞"]).toBe("寅");
    expect(p.starBranch["天府"]).toBe("午");
    expect(p.starBranch["太阴"]).toBe("未");
    // 天府午 +10 宫 → 破军辰
    expect(p.starBranch["破军"]).toBe("辰");
  });
});

describe("computeZiweiChart", () => {
  it("DoD：十二宫、命身、主星、meta、确定性", () => {
    const chart = computeZiweiChart(
      baseInput({ solarDate: "1990-05-15", birthTime: "10:00", name: "测" }),
    );

    expect(chart.palaces).toHaveLength(12);
    expect(chart.mingGong).toBe("命宫");
    expect(chart.palaces[0].name).toBe("命宫");
    expect(chart.palaces[0].branch).toBe("子");
    expect(chart.wuxingJu).toBe("火六局");
    expect(chart.meta.engineVersion).toBe(ENGINE_VERSION);
    expect(chart.meta.skillRef).toBe(SKILL_REF);
    expect(chart.meta.school).toBe("sanhe");
    expect(chart.meta.agePolicy).toBe("xusui");
    expect(chart.meta.schools?.core).toBe("sanhe");
    expect(chart.meta.schools?.feixing).toBe("feixing");
    expect(chart.meta.rulePriority?.length).toBeGreaterThan(0);
    // T102：大限 12 步（火六起 6 岁）；无 analysisBaseDate 时用运行日计当前限
    expect(chart.daxian).toHaveLength(12);
    expect(chart.daxian[0]).toMatchObject({
      startAge: 6,
      endAge: 15,
      palace: "命宫",
    });
    expect(chart.liunian?.length).toBe(3);

    // 身宫标记恰一宫
    const shenMarked = chart.palaces.filter((p) => p.isShenGong);
    expect(shenMarked).toHaveLength(1);
    expect(shenMarked[0].name).toBe(chart.shenGong);
    expect(chart.shenGong).toBe("夫妻");
    expect(shenMarked[0].branch).toBe("戌");

    // 十四主星各出现一次
    const allMajor = chart.palaces.flatMap((p) =>
      p.stars.filter((s) => s.category === "major").map((s) => s.name),
    );
    expect(allMajor).toHaveLength(14);
    expect(new Set(allMajor).size).toBe(14);

    // majorStars 与 palaces 对齐
    for (const [pname, stars] of Object.entries(chart.majorStars)) {
      const palace = chart.palaces.find((p) => p.name === pname)!;
      const fromPalace = palace.stars
        .filter((s) => s.category === "major")
        .map((s) => s.name)
        .sort();
      expect([...stars].sort()).toEqual(fromPalace);
    }

    // 紫微在寅
    const ziweiPalace = chart.palaces.find((p) =>
      p.stars.some((s) => s.name === "紫微"),
    );
    expect(ziweiPalace?.branch).toBe("寅");
    // 天府同寅
    expect(ziweiPalace?.stars.some((s) => s.name === "天府")).toBe(true);

    // 宫干存在
    for (const p of chart.palaces) {
      expect(p.stem).toBeTruthy();
    }
  });

  it("同输入 deep equal", () => {
    const input = baseInput({
      solarDate: "1990-05-15",
      birthTime: "10:00",
      profileId: "p1",
    });
    const a = computeZiweiChart(input);
    const b = computeZiweiChart(input);
    expect(a).toEqual(b);
  });

  it("时辰未知 → flag + 默认午参考盘 + 多盘候选（T270）", () => {
    const chart = computeZiweiChart({
      solarDate: "1990-05-15",
      gender: "male",
      shichenUnknown: true,
      analysisBaseDate: "2026-07-20",
    });
    expect(chart.flags).toContain("shichen_unknown");
    expect(chart.flags).toContain("default_noon_hour");
    expect(chart.flags).toContain("shichen_multi_candidate");
    // 午时 hourIndex=6, month=4 → ming=3-6=-3→9→亥
    expect(chart.palaces[0].branch).toBe("亥");
    expect(chart.warnings?.some((w) => w.includes("时辰未知"))).toBe(true);
    expect(chart.hourCandidates).toHaveLength(12);
    expect(chart.hourCandidates?.find((c) => c.hourBranch === "午")?.isDefaultNoon).toBe(
      true,
    );
    // 不同时辰命宫应有差异
    const mingSet = new Set(chart.hourCandidates?.map((c) => c.mingBranch));
    expect(mingSet.size).toBeGreaterThan(1);
    expect(chart.meta.timePolicy).toBe("unknown_multi_candidate");
    expect(chart.meta.agePolicy).toBe("xusui");
  });

  it("夜子时 flag", () => {
    const chart = computeZiweiChart(
      baseInput({ solarDate: "1990-05-15", birthTime: "23:30" }),
    );
    expect(chart.flags).toContain("night_zi");
  });

  it("农历输入可排盘", () => {
    const chart = computeZiweiChart({
      lunarDate: "1990-4-21",
      birthTime: "10:00",
      gender: "male",
    });
    expect(chart.palaces).toHaveLength(12);
    expect(chart.palaces[0].branch).toBe("子");
    expect(chart.wuxingJu).toBe("火六局");
  });

  it("例·2000-08-08 16:00 男 · 结构完整", () => {
    const chart = computeZiweiChart(
      baseInput({ solarDate: "2000-08-08", birthTime: "16:00" }),
    );
    expect(chart.palaces).toHaveLength(12);
    expect(chart.mingGong).toBe("命宫");
    expect(chart.shenGong).toBeTruthy();
    expect(chart.wuxingJu).toMatch(/局$/);
    const majors = chart.palaces.flatMap((p) =>
      p.stars.filter((s) => s.category === "major"),
    );
    expect(majors).toHaveLength(14);
    expect(chart.mingZhu).toBeTruthy();
    expect(chart.shenZhu).toBeTruthy();
  });

  it("例·1985-03-12 06:00 女", () => {
    const chart = computeZiweiChart(
      baseInput({
        solarDate: "1985-03-12",
        birthTime: "06:00",
        gender: "female",
      }),
    );
    expect(chart.palaces).toHaveLength(12);
    expect(
      chart.palaces.flatMap((p) => p.stars.filter((s) => s.category === "major")),
    ).toHaveLength(14);
    // 十二宫名齐全且顺序固定
    expect(chart.palaces.map((p) => p.name)).toEqual([
      "命宫",
      "兄弟",
      "夫妻",
      "子女",
      "财帛",
      "疾厄",
      "迁移",
      "交友",
      "官禄",
      "田宅",
      "福德",
      "父母",
    ]);
  });

  it("例·2010-12-25 22:00 · 主星落宫自洽", () => {
    const chart = computeZiweiChart(
      baseInput({ solarDate: "2010-12-25", birthTime: "22:00" }),
    );
    // 每颗主星只落一宫
    const map = new Map<string, string>();
    for (const p of chart.palaces) {
      for (const s of p.stars) {
        if (s.category !== "major") continue;
        expect(map.has(s.name)).toBe(false);
        map.set(s.name, p.branch);
      }
    }
    expect(map.size).toBe(14);
    // 天府对紫微
    const zw = map.get("紫微")!;
    const tf = map.get("天府")!;
    // 寅起索引互为 12-x（寅/申同宫）
    const yinOf = (b: string) =>
      (["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"].indexOf(
        b,
      ) -
        2 +
        12) %
      12;
    expect((yinOf(zw) + yinOf(tf)) % 12).toBe(0);
  });

  it("例·1975-07-01 08:00 · 宫干五虎遁", () => {
    const chart = computeZiweiChart(
      baseInput({ solarDate: "1975-07-01", birthTime: "08:00" }),
    );
    // 寅宫干应为五虎遁首
    const yinPalace = chart.palaces.find((p) => p.branch === "寅")!;
    expect(yinPalace.stem).toBeTruthy();
    // 顺布：卯干 = 寅干+1
    const mao = chart.palaces.find((p) => p.branch === "卯")!;
    const stems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
    const next =
      stems[(stems.indexOf(yinPalace.stem!) + 1) % 10];
    expect(mao.stem).toBe(next);
  });
});
