/**
 * T113 + T282 六爻金标准用例（≥8）
 * 覆盖：manual 可复现、世应、动变、用神
 * fixture 含来源/流派/版本元数据，便于规则 diff 定位
 */

import type { CastLiuyaoInput } from "../cast";
import type { GuaRef, YaoPosition, YaoValue } from "@/lib/types/liuyao";
import { LIUYAO_DATA_SOURCES } from "../data/sources";

/** fixture 集元数据（T282） */
export const LIUYAO_GOLDEN_META = {
  source: "project-internal",
  school: "jingfang-najia-learning-v1",
  dataVersion: LIUYAO_DATA_SOURCES.dataVersion,
  ruleSetVersion: LIUYAO_DATA_SOURCES.ruleSetVersion,
  engineMinVersion: "0.5.0",
  notes:
    "手工六爻金标准；世应/八宫/用神关键词表驱动；非外部商业软件逐盘抄录",
  references: [
    "docs/research/liuyao-sources.md",
    "src/lib/liuyao/analyze/palaces.ts",
    "src/lib/liuyao/analyze/liuqin.ts",
  ],
} as const;

export type LiuyaoGoldenCase = {
  id: string;
  label: string;
  /** 覆盖场景标签 */
  tags: readonly (
    | "manual"
    | "static"
    | "changing"
    | "multi-changing"
    | "shi-ying"
    | "yongshen"
  )[];
  /** 可选：单条用例来源说明 */
  sourceNote?: string;
  input: CastLiuyaoInput & {
    method: "manual";
    lines: readonly YaoValue[];
  };
  expect: {
    benGua: GuaRef;
    bianGua?: GuaRef;
    shiYao: YaoPosition;
    yingYao: YaoPosition;
    yongShen: string;
    dongYao: readonly YaoPosition[];
    palace: string;
    palacePos: number;
  };
};

export const liuyaoGoldenCases: LiuyaoGoldenCase[] = [
  {
    id: "ly-g1",
    label: "乾静卦 · 世六应三 · 用神世",
    tags: ["manual", "static", "shi-ying"],
    input: {
      id: "ly-g1",
      question: "今日事宜",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
    },
    expect: {
      benGua: { name: "乾为天", upper: "乾", lower: "乾" },
      shiYao: 6,
      yingYao: 3,
      yongShen: "世",
      dongYao: [],
      palace: "乾",
      palacePos: 0,
    },
  },
  {
    id: "ly-g2",
    label: "乾初爻老阳 → 变天风 · 动爻[1]",
    tags: ["manual", "changing", "shi-ying"],
    input: {
      id: "ly-g2",
      question: "测变卦初爻",
      method: "manual",
      lines: [9, 7, 7, 7, 7, 7],
    },
    expect: {
      benGua: { name: "乾为天", upper: "乾", lower: "乾" },
      bianGua: { name: "天风姤", upper: "乾", lower: "巽" },
      shiYao: 6,
      yingYao: 3,
      yongShen: "世",
      dongYao: [1],
      palace: "乾",
      palacePos: 0,
    },
  },
  {
    id: "ly-g3",
    label: "坤初爻老阴 → 变地雷 · 动爻[1]",
    tags: ["manual", "changing"],
    input: {
      id: "ly-g3",
      question: "坤变初爻",
      method: "manual",
      lines: [6, 8, 8, 8, 8, 8],
    },
    expect: {
      benGua: { name: "坤为地", upper: "坤", lower: "坤" },
      bianGua: { name: "地雷复", upper: "坤", lower: "震" },
      shiYao: 6,
      yingYao: 3,
      yongShen: "世",
      dongYao: [1],
      palace: "坤",
      palacePos: 0,
    },
  },
  {
    id: "ly-g4",
    label: "兑多动 · 动爻[1,3,5] → 变雷风",
    tags: ["manual", "multi-changing"],
    input: {
      id: "ly-g4",
      question: "多动爻",
      method: "manual",
      lines: [9, 7, 6, 7, 9, 8],
    },
    expect: {
      benGua: { name: "兑为泽", upper: "兑", lower: "兑" },
      bianGua: { name: "雷风恒", upper: "震", lower: "巽" },
      shiYao: 6,
      yingYao: 3,
      yongShen: "世",
      dongYao: [1, 3, 5],
      palace: "兑",
      palacePos: 0,
    },
  },
  {
    id: "ly-g5",
    label: "乾静 · 升迁用神官鬼",
    tags: ["manual", "static", "yongshen"],
    input: {
      id: "ly-g5",
      question: "工作升迁如何",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
    },
    expect: {
      benGua: { name: "乾为天", upper: "乾", lower: "乾" },
      shiYao: 6,
      yingYao: 3,
      yongShen: "官鬼",
      dongYao: [],
      palace: "乾",
      palacePos: 0,
    },
  },
  {
    id: "ly-g6",
    label: "火水 · 求财用神妻财 · 世三应六",
    tags: ["manual", "static", "shi-ying", "yongshen"],
    input: {
      id: "ly-g6",
      question: "今年求财运如何",
      method: "manual",
      lines: [8, 7, 8, 7, 8, 7],
    },
    expect: {
      benGua: { name: "火水未济", upper: "离", lower: "坎" },
      shiYao: 3,
      yingYao: 6,
      yongShen: "妻财",
      dongYao: [],
      palace: "离",
      palacePos: 3,
    },
  },
  {
    id: "ly-g7",
    label: "风火上爻老阳 → 变水火 · 感情妻财",
    tags: ["manual", "changing", "yongshen"],
    input: {
      id: "ly-g7",
      question: "感情复合",
      method: "manual",
      lines: [7, 8, 7, 8, 7, 9],
    },
    expect: {
      benGua: { name: "风火家人", upper: "巽", lower: "离" },
      bianGua: { name: "水火既济", upper: "坎", lower: "离" },
      shiYao: 2,
      yingYao: 5,
      yongShen: "妻财",
      dongYao: [6],
      palace: "巽",
      palacePos: 2,
    },
  },
  {
    id: "ly-g8",
    label: "泽水双动 · 病情官鬼 · 世初应四",
    tags: ["manual", "multi-changing", "shi-ying", "yongshen"],
    input: {
      id: "ly-g8",
      question: "病情如何",
      method: "manual",
      lines: [6, 7, 8, 9, 7, 8],
    },
    expect: {
      benGua: { name: "泽水困", upper: "兑", lower: "坎" },
      bianGua: { name: "水泽节", upper: "坎", lower: "兑" },
      shiYao: 1,
      yingYao: 4,
      yongShen: "官鬼",
      dongYao: [1, 4],
      palace: "兑",
      palacePos: 1,
    },
  },
  {
    id: "ly-g9",
    label: "水风双动 · 面试官鬼 · 世五应二",
    tags: ["manual", "multi-changing", "yongshen"],
    input: {
      id: "ly-g9",
      question: "面试结果",
      method: "manual",
      lines: [8, 7, 9, 8, 7, 6],
    },
    expect: {
      benGua: { name: "水风井", upper: "坎", lower: "巽" },
      bianGua: { name: "风水涣", upper: "巽", lower: "坎" },
      shiYao: 5,
      yingYao: 2,
      yongShen: "官鬼",
      dongYao: [3, 6],
      palace: "震",
      palacePos: 5,
    },
  },
  {
    id: "ly-g10",
    label: "天风姤一世 · 世初应四 · 静卦",
    tags: ["manual", "static", "shi-ying"],
    input: {
      id: "ly-g10",
      question: "随便问问",
      method: "manual",
      lines: [8, 7, 7, 7, 7, 7],
    },
    expect: {
      benGua: { name: "天风姤", upper: "乾", lower: "巽" },
      shiYao: 1,
      yingYao: 4,
      yongShen: "世",
      dongYao: [],
      palace: "乾",
      palacePos: 1,
    },
  },
];
