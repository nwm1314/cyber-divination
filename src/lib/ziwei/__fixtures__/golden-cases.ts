/**
 * T103 / T271 紫微金标准用例（≥8）
 * 对照：引擎确定性快照（命身宫、主星、大限起步）
 * 防回归：改算法须先更新本文件并说明
 *
 * 元数据（T271）：
 * - source：用例来源
 * - engineVersionAtCapture：捕获时引擎版本
 * - agePolicy：大限计岁口径
 */

import type { ZiweiChartInput, ZiweiDaxianStep } from "@/lib/types/ziwei";

export type ZiweiGoldenCase = {
  id: string;
  label: string;
  input: ZiweiChartInput;
  mingBranch: string;
  shenGong: string;
  shenBranch: string;
  wuxingJu: string;
  /** 主星名 → 地支 */
  majorByBranch: Record<string, string>;
  /** 大限首步 / 次步（T102 防回归） */
  daxian0: Pick<ZiweiDaxianStep, "startAge" | "endAge" | "palace" | "branch">;
  daxian1: Pick<ZiweiDaxianStep, "startAge" | "endAge" | "palace" | "branch">;
  /** 用例来源（T271） */
  source?: string;
  /** 捕获时引擎版本 */
  engineVersionAtCapture?: string;
  /** 年龄口径 */
  agePolicy?: "xusui" | "zhousui" | string;
  /** 对照库版本提示（若有） */
  compareLib?: string;
};

const GOLDEN_META = {
  source: "self-engine-snapshot",
  engineVersionAtCapture: "0.8.0",
  agePolicy: "xusui" as const,
  compareLib: "iztro@2.5.8 (independent test oracle; not runtime)",
};

const _rawGoldenCases: ZiweiGoldenCase[] = [
  {
    id: "g1",
    label: "1990-05-15 10:00 男 · 火六 · 紫微寅",
    input: {
      solarDate: "1990-05-15",
      birthTime: "10:00",
      gender: "male",
    },
    mingBranch: "子",
    shenGong: "夫妻",
    shenBranch: "戌",
    wuxingJu: "火六局",
    majorByBranch: {
      紫微: "寅",
      天机: "丑",
      太阳: "亥",
      武曲: "戌",
      天同: "酉",
      廉贞: "午",
      天府: "寅",
      太阴: "卯",
      贪狼: "辰",
      巨门: "巳",
      天相: "午",
      天梁: "未",
      七杀: "申",
      破军: "子",
    },
    daxian0: { startAge: 6, endAge: 15, palace: "命宫", branch: "子" },
    daxian1: { startAge: 16, endAge: 25, palace: "父母", branch: "丑" },
  },
  {
    id: "g2",
    label: "2000-08-08 16:00 男 · 火六",
    input: {
      solarDate: "2000-08-08",
      birthTime: "16:00",
      gender: "male",
    },
    mingBranch: "子",
    shenGong: "官禄",
    shenBranch: "辰",
    wuxingJu: "火六局",
    majorByBranch: {
      紫微: "子",
      天机: "亥",
      太阳: "酉",
      武曲: "申",
      天同: "未",
      廉贞: "辰",
      天府: "辰",
      太阴: "巳",
      贪狼: "午",
      巨门: "未",
      天相: "申",
      天梁: "酉",
      七杀: "戌",
      破军: "寅",
    },
    daxian0: { startAge: 6, endAge: 15, palace: "命宫", branch: "子" },
    daxian1: { startAge: 16, endAge: 25, palace: "父母", branch: "丑" },
  },
  {
    id: "g3",
    label: "1985-03-12 06:00 女 · 土五",
    input: {
      solarDate: "1985-03-12",
      birthTime: "06:00",
      gender: "female",
    },
    mingBranch: "亥",
    shenGong: "迁移",
    shenBranch: "巳",
    wuxingJu: "土五局",
    majorByBranch: {
      紫微: "戌",
      天机: "酉",
      太阳: "未",
      武曲: "午",
      天同: "巳",
      廉贞: "寅",
      天府: "午",
      太阴: "未",
      贪狼: "申",
      巨门: "酉",
      天相: "戌",
      天梁: "亥",
      七杀: "子",
      破军: "辰",
    },
    daxian0: { startAge: 5, endAge: 14, palace: "命宫", branch: "亥" },
    daxian1: { startAge: 15, endAge: 24, palace: "父母", branch: "子" },
  },
  {
    id: "g4",
    label: "2010-12-25 22:00 男 · 火六",
    input: {
      solarDate: "2010-12-25",
      birthTime: "22:00",
      gender: "male",
    },
    mingBranch: "丑",
    shenGong: "夫妻",
    shenBranch: "亥",
    wuxingJu: "火六局",
    majorByBranch: {
      紫微: "酉",
      天机: "申",
      太阳: "午",
      武曲: "巳",
      天同: "辰",
      廉贞: "丑",
      天府: "未",
      太阴: "申",
      贪狼: "酉",
      巨门: "戌",
      天相: "亥",
      天梁: "子",
      七杀: "丑",
      破军: "巳",
    },
    daxian0: { startAge: 6, endAge: 15, palace: "命宫", branch: "丑" },
    daxian1: { startAge: 16, endAge: 25, palace: "父母", branch: "寅" },
  },
  {
    id: "g5",
    label: "1975-07-01 08:00 男 · 土五 · 大限逆",
    input: {
      solarDate: "1975-07-01",
      birthTime: "08:00",
      gender: "male",
    },
    mingBranch: "寅",
    shenGong: "财帛",
    shenBranch: "戌",
    wuxingJu: "土五局",
    majorByBranch: {
      紫微: "卯",
      天机: "寅",
      太阳: "子",
      武曲: "亥",
      天同: "戌",
      廉贞: "未",
      天府: "丑",
      太阴: "寅",
      贪狼: "卯",
      巨门: "辰",
      天相: "巳",
      天梁: "午",
      七杀: "未",
      破军: "亥",
    },
    daxian0: { startAge: 5, endAge: 14, palace: "命宫", branch: "寅" },
    daxian1: { startAge: 15, endAge: 24, palace: "兄弟", branch: "丑" },
  },
  {
    id: "g6",
    label: "1995-01-20 00:30 女 · 水二 · 命身同宫",
    input: {
      solarDate: "1995-01-20",
      birthTime: "00:30",
      gender: "female",
    },
    mingBranch: "丑",
    shenGong: "命宫",
    shenBranch: "丑",
    wuxingJu: "水二局",
    majorByBranch: {
      紫微: "亥",
      天机: "戌",
      太阳: "申",
      武曲: "未",
      天同: "午",
      廉贞: "卯",
      天府: "巳",
      太阴: "午",
      贪狼: "未",
      巨门: "申",
      天相: "酉",
      天梁: "戌",
      七杀: "亥",
      破军: "卯",
    },
    daxian0: { startAge: 2, endAge: 11, palace: "命宫", branch: "丑" },
    daxian1: { startAge: 12, endAge: 21, palace: "兄弟", branch: "子" },
  },
  {
    id: "g7",
    label: "1988-11-03 14:00 男 · 水二",
    input: {
      solarDate: "1988-11-03",
      birthTime: "14:00",
      gender: "male",
    },
    mingBranch: "卯",
    shenGong: "福德",
    shenBranch: "巳",
    wuxingJu: "水二局",
    majorByBranch: {
      紫微: "丑",
      天机: "子",
      太阳: "戌",
      武曲: "酉",
      天同: "申",
      廉贞: "巳",
      天府: "卯",
      太阴: "辰",
      贪狼: "巳",
      巨门: "午",
      天相: "未",
      天梁: "申",
      七杀: "酉",
      破军: "丑",
    },
    daxian0: { startAge: 2, endAge: 11, palace: "命宫", branch: "卯" },
    daxian1: { startAge: 12, endAge: 21, palace: "父母", branch: "辰" },
  },
  {
    id: "g8",
    label: "2005-06-18 20:00 女 · 水二 · 命申",
    input: {
      solarDate: "2005-06-18",
      birthTime: "20:00",
      gender: "female",
    },
    mingBranch: "申",
    shenGong: "财帛",
    shenBranch: "辰",
    wuxingJu: "水二局",
    majorByBranch: {
      紫微: "未",
      天机: "午",
      太阳: "辰",
      武曲: "卯",
      天同: "寅",
      廉贞: "亥",
      天府: "酉",
      太阴: "戌",
      贪狼: "亥",
      巨门: "子",
      天相: "丑",
      天梁: "寅",
      七杀: "卯",
      破军: "未",
    },
    daxian0: { startAge: 2, endAge: 11, palace: "命宫", branch: "申" },
    daxian1: { startAge: 12, endAge: 21, palace: "父母", branch: "酉" },
  },
];

/** 统一注入 T271 元数据 */
export const ziweiGoldenCases: ZiweiGoldenCase[] = _rawGoldenCases.map((c) => ({
  ...GOLDEN_META,
  ...c,
}));
