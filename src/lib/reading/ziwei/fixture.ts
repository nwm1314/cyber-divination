import type { ZiweiChart, ZiweiPalace, ZiweiPalaceName } from "@/lib/types";
import {
  ZIWEI_ENGINE_VERSION_PLACEHOLDER,
  ZIWEI_SKILL_REF,
} from "@/lib/types";

const PALACE_ORDER: ZiweiPalaceName[] = [
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
];

const BRANCHES = [
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
  "子",
  "丑",
] as const;

/** T101 未就绪时的可读 fixture 盘（仅测模板/LLM 回落） */
export function createZiweiFixtureChart(
  overrides?: Partial<ZiweiChart>,
): ZiweiChart {
  const majorByPalace: Record<string, string[]> = {
    命宫: ["紫微", "天府"],
    兄弟: ["天机"],
    夫妻: ["太阳"],
    子女: [],
    财帛: ["武曲", "贪狼"],
    疾厄: [],
    迁移: ["天同"],
    交友: [],
    官禄: ["天相"],
    田宅: ["七杀"],
    福德: ["天梁"],
    父母: ["破军"],
  };

  const softByPalace: Record<string, string[]> = {
    命宫: ["左辅", "右弼"],
    夫妻: ["文昌"],
    财帛: ["禄存"],
    官禄: ["天魁"],
  };

  const palaces: ZiweiPalace[] = PALACE_ORDER.map((name, i) => {
    const majors = (majorByPalace[name] ?? []).map((n) => ({
      name: n,
      category: "major" as const,
    }));
    const softs = (softByPalace[name] ?? []).map((n) => ({
      name: n,
      category: "soft" as const,
    }));
    return {
      name,
      branch: BRANCHES[i]!,
      stars: [...majors, ...softs],
      isShenGong: name === "命宫",
    };
  });

  const base: ZiweiChart = {
    id: "zw_fixture_t104",
    profileId: "profile_zw_fixture",
    name: "示例",
    palaces,
    mingGong: "命宫",
    shenGong: "命宫",
    majorStars: majorByPalace,
    daxian: [
      { index: 0, startAge: 5, endAge: 14, palace: "命宫", branch: "寅" },
      { index: 1, startAge: 15, endAge: 24, palace: "父母", branch: "丑" },
      { index: 2, startAge: 25, endAge: 34, palace: "福德", branch: "子" },
      { index: 3, startAge: 35, endAge: 44, palace: "田宅", branch: "亥" },
    ],
    currentDaxianIndex: 3,
    liunian: [
      { year: 2025, age: 36, palace: "官禄", branch: "巳" },
      { year: 2026, age: 37, palace: "交友", branch: "午" },
    ],
    wuxingJu: "土五局",
    mingZhu: "廉贞",
    shenZhu: "天相",
    flags: [],
    meta: {
      engineVersion: ZIWEI_ENGINE_VERSION_PLACEHOLDER,
      skillRef: ZIWEI_SKILL_REF,
      school: "sanhe",
    },
  };

  return { ...base, ...overrides };
}
