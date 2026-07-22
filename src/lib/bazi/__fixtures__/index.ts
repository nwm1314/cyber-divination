import type { BirthProfile } from "@/lib/types";

/** fixture 元数据（T262） */
export type GoldenMeta = {
  source: "engine-regression" | "external";
  ruleSetVersion: string;
  school: string;
  notes?: string;
};

export const FIXTURE_META: GoldenMeta = {
  source: "engine-regression",
  ruleSetVersion: "2026.07-w24",
  school: "ziping-default",
  notes: "内部回归金标准；外部门户集见 docs/research/bazi-sources.md",
};

export type GoldenCase = {
  label: string;
  input: Partial<BirthProfile>;
  expect: {
    year: string;
    month: string;
    day: string;
    hour: string | null;
    dayMaster: string;
    extra?: Record<string, unknown>;
  };
  meta?: GoldenMeta;
};

export const goldenCases: GoldenCase[] = [
  {
    label: "立春分年·立春前（己巳年/丁丑月）",
    input: { id: "golden-L01", name: "立春前", solarDate: "1990-02-04", birthTime: "10:00" },
    expect: {
      year: "己巳",
      month: "丁丑",
      day: "庚子",
      hour: "辛巳",
      dayMaster: "庚",
      extra: {
        tenGod_year: "正印",
        tenGod_hour: "劫财",
        hiddenStems_month: ["己", "癸", "辛"],
        dayunDir: "reverse",
        dayunFirst: "丙子",
        dayunStartAge: 10,
      },
    },
  },
  {
    label: "立春分年·立春后（庚午年/戊寅月）",
    input: { id: "golden-L02", name: "立春后", solarDate: "1990-02-04", birthTime: "10:15" },
    expect: {
      year: "庚午",
      month: "戊寅",
      day: "庚子",
      hour: "辛巳",
      dayMaster: "庚",
      extra: {
        tenGod_year: "比肩",
        tenGod_hour: "劫财",
        yearHidden: ["丁", "己"],
        dayunDir: "forward",
        dayunFirst: "己卯",
        dayunStartAge: 10,
      },
    },
  },
  {
    label: "夜子时（23:30→次日日柱）",
    input: { id: "golden-L03", name: "夜子时", solarDate: "2000-01-01", birthTime: "23:30" },
    expect: {
      year: "己卯",
      month: "丙子",
      day: "己未",
      hour: "甲子",
      dayMaster: "己",
      extra: {
        flags: ["night_zi"],
        dayunFirst: "乙亥",
        dayunStartAge: 8,
      },
    },
  },
  {
    label: "未知时辰（六字盘）",
    input: { id: "golden-L04", name: "未知时辰", solarDate: "1990-05-15", shichenUnknown: true, birthTime: undefined },
    expect: {
      year: "庚午",
      month: "辛巳",
      day: "庚辰",
      hour: null,
      dayMaster: "庚",
      extra: {
        flags: ["shichen_unknown"],
        // 六字：庚午/辛巳/庚辰 — 权重 0.6/0.3/0.1
        wuxingScores: { wood: 0.3, fire: 1.2, earth: 1.0, metal: 3.3, water: 0.1 },
      },
    },
  },
  {
    label: "节气交界·立夏前夜（jieqi_boundary）",
    // 1990 立夏约 05-06 02:35，05-05 20:00 距交节约 6.5h < 12h
    input: { id: "golden-L05", name: "立夏交界", solarDate: "1990-05-05", birthTime: "20:00" },
    expect: {
      year: "庚午",
      month: "庚辰",
      day: "庚午",
      hour: "丙戌",
      dayMaster: "庚",
      extra: {
        flags: ["jieqi_boundary"],
        tenGod_year: "比肩",
        tenGod_month: "比肩",
        dayunFirst: "辛巳",
      },
    },
  },
  {
    label: "阴年男（逆排大运）",
    input: { id: "golden-L06", name: "阴男", solarDate: "2000-01-01", birthTime: "10:00" },
    expect: {
      year: "己卯",
      month: "丙子",
      day: "戊午",
      hour: "丁巳",
      dayMaster: "戊",
      extra: {
        gender: "male",
        tenGod_hour: "正印",
        dayunDir: "reverse",
        dayunFirst: "乙亥",
        dayunStartAge: 8,
        currentDayunIndex: 1,
      },
    },
  },
  {
    label: "阴年女（顺排大运）",
    input: { id: "golden-L07", name: "阴女", solarDate: "2000-01-01", birthTime: "10:00", gender: "female" },
    expect: {
      year: "己卯",
      month: "丙子",
      day: "戊午",
      hour: "丁巳",
      dayMaster: "戊",
      extra: {
        gender: "female",
        tenGod_hour: "正印",
        dayunDir: "forward",
        dayunFirst: "丁丑",
        dayunStartAge: 2,
        currentDayunIndex: 2,
      },
    },
  },
  {
    label: "已故截断（liunian 止于 deathYear）",
    input: { id: "golden-L08", name: "已故", solarDate: "1990-05-15", birthTime: "10:30", alive: false, deathYear: 1995 },
    expect: {
      year: "庚午",
      month: "辛巳",
      day: "庚辰",
      hour: "辛巳",
      dayMaster: "庚",
      extra: {
        liunianYears: [1993, 1994, 1995],
        currentDayunIndex: -1,
      },
    },
  },
  {
    label: "真太阳时（经度偏移→时柱变化）",
    input: {
      id: "golden-L09", name: "真太阳时", solarDate: "1990-05-15", birthTime: "10:30",
      useTrueSolarTime: true, birthPlace: { province: "新疆", city: "乌鲁木齐", lng: 87.6, lat: 43.8 },
    },
    expect: {
      year: "庚午",
      month: "辛巳",
      day: "庚辰",
      hour: "庚辰",
      dayMaster: "庚",
      extra: {
        baselineHour: "辛巳",
        // 真太阳时后时柱庚辰：权重 0.6/0.3/0.1
        wuxingScores: { wood: 0.6, fire: 1.2, earth: 1.6, metal: 4.3, water: 0.2 },
      },
    },
  },
];

export function makeProfile(overrides?: Partial<BirthProfile>): BirthProfile {
  return {
    id: "test-001",
    name: "测试",
    solarDate: "1990-05-15",
    birthTime: "10:30",
    gender: "male",
    birthPlace: { province: "北京", city: "北京", lng: 116.4, lat: 39.9 },
    alive: true,
    analysisBaseDate: "2026-07-20",
    useTrueSolarTime: false,
    ...overrides,
  };
}
