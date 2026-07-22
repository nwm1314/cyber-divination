/** T11 scaffold：对齐 bazi-skill wuxing-tables.md */

export const STEM_WUXING = {
  甲: "wood",
  乙: "wood",
  丙: "fire",
  丁: "fire",
  戊: "earth",
  己: "earth",
  庚: "metal",
  辛: "metal",
  壬: "water",
  癸: "water",
} as const;

export const STEM_YIN_YANG = {
  甲: "yang",
  乙: "yin",
  丙: "yang",
  丁: "yin",
  戊: "yang",
  己: "yin",
  庚: "yang",
  辛: "yin",
  壬: "yang",
  癸: "yin",
} as const;

export const BRANCH_WUXING = {
  子: "water",
  丑: "earth",
  寅: "wood",
  卯: "wood",
  辰: "earth",
  巳: "fire",
  午: "fire",
  未: "earth",
  申: "metal",
  酉: "metal",
  戌: "earth",
  亥: "water",
} as const;

/** 本气 / 中气 / 余气 */
export const HIDDEN_STEMS: Record<string, string[]> = {
  子: ["癸"],
  丑: ["己", "癸", "辛"],
  寅: ["甲", "丙", "戊"],
  卯: ["乙"],
  辰: ["戊", "乙", "癸"],
  巳: ["丙", "庚", "戊"],
  午: ["丁", "己"],
  未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"],
  酉: ["辛"],
  戌: ["戊", "辛", "丁"],
  亥: ["壬", "甲"],
};

export const STEM_HE = [
  ["甲", "己", "土"],
  ["乙", "庚", "金"],
  ["丙", "辛", "水"],
  ["丁", "壬", "木"],
  ["戊", "癸", "火"],
] as const;

export const BRANCH_CHONG: ReadonlyArray<readonly [string, string]> = [
  ["子", "午"],
  ["丑", "未"],
  ["寅", "申"],
  ["卯", "酉"],
  ["辰", "戌"],
  ["巳", "亥"],
];

/** 六合：子丑合土、寅亥合木… */
export const BRANCH_LIUHE: ReadonlyArray<readonly [string, string, string]> = [
  ["子", "丑", "土"],
  ["寅", "亥", "木"],
  ["卯", "戌", "火"],
  ["辰", "酉", "金"],
  ["巳", "申", "水"],
  ["午", "未", "火"],
];

/** 三合局 */
export const BRANCH_SANHE: ReadonlyArray<readonly [string, string, string, string]> = [
  ["申", "子", "辰", "水"],
  ["亥", "卯", "未", "木"],
  ["寅", "午", "戌", "火"],
  ["巳", "酉", "丑", "金"],
];

/** 三会局 */
export const BRANCH_SANHUI: ReadonlyArray<readonly [string, string, string, string]> = [
  ["寅", "卯", "辰", "木"],
  ["巳", "午", "未", "火"],
  ["申", "酉", "戌", "金"],
  ["亥", "子", "丑", "水"],
];

/** 三刑 / 相刑 / 自刑 */
export const BRANCH_XING: ReadonlyArray<{
  members: readonly string[];
  label: string;
  kind: "sanxing" | "xiangxing" | "zixing";
}> = [
  { members: ["寅", "巳", "申"], label: "寅巳申三刑", kind: "sanxing" },
  { members: ["丑", "戌", "未"], label: "丑戌未三刑", kind: "sanxing" },
  { members: ["子", "卯"], label: "子卯相刑", kind: "xiangxing" },
  { members: ["辰"], label: "辰辰自刑", kind: "zixing" },
  { members: ["午"], label: "午午自刑", kind: "zixing" },
  { members: ["酉"], label: "酉酉自刑", kind: "zixing" },
  { members: ["亥"], label: "亥亥自刑", kind: "zixing" },
];

/** 相害 */
export const BRANCH_HAI: ReadonlyArray<readonly [string, string]> = [
  ["子", "未"],
  ["丑", "午"],
  ["寅", "巳"],
  ["卯", "辰"],
  ["申", "亥"],
  ["酉", "戌"],
];

/** 藏干权重：本气≈60% / 中气≈30% / 余气≈10%（对齐 skill wuxing-tables） */
export const HIDDEN_STEM_WEIGHTS = [0.6, 0.3, 0.1] as const;

/**
 * 十二长生：天干 → 十二地支顺序（从长生起）
 * 阳干顺行，阴干逆行（表已按 skill 排好）
 */
export const CHANG_SHENG_STAGES = [
  "长生",
  "沐浴",
  "冠带",
  "临官",
  "帝旺",
  "衰",
  "病",
  "死",
  "墓",
  "绝",
  "胎",
  "养",
] as const;

/** 日干 → 十二长生对应地支（按 CHANG_SHENG_STAGES 顺序） */
export const CHANG_SHENG: Record<string, readonly string[]> = {
  甲: ["亥", "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌"],
  乙: ["午", "巳", "辰", "卯", "寅", "丑", "子", "亥", "戌", "酉", "申", "未"],
  丙: ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"],
  丁: ["酉", "申", "未", "午", "巳", "辰", "卯", "寅", "丑", "子", "亥", "戌"],
  戊: ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"],
  己: ["酉", "申", "未", "午", "巳", "辰", "卯", "寅", "丑", "子", "亥", "戌"],
  庚: ["巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰"],
  辛: ["子", "亥", "戌", "酉", "申", "未", "午", "巳", "辰", "卯", "寅", "丑"],
  壬: ["申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰", "巳", "午", "未"],
  癸: ["卯", "寅", "丑", "子", "亥", "戌", "酉", "申", "未", "午", "巳", "辰"],
};

export function changShengOf(stem: string, branch: string): string | undefined {
  const row = CHANG_SHENG[stem];
  if (!row) return undefined;
  const i = row.indexOf(branch);
  if (i < 0) return undefined;
  return CHANG_SHENG_STAGES[i];
}
