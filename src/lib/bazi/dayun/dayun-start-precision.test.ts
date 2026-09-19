/**
 * 起运精确到月：自洽性守护测试（GAP-2 / 波次 3）
 *
 * 背景：改动前 `startAge` 用 `Math.round(diffDays/3)`（整岁四舍五入），
 * 而 `startAt` 用 `(years*12+months)` 个月——同一份 chart 内部自相矛盾。
 * 本文件把「四者自洽」固化为不变量，防止回退：
 *
 *   startAge 去整岁  ←→  startAt（交运日）  ←→  currentDayunIndex
 *
 * 未通过领域审校的声明见 docs/ENGINE_RULE_DAYUN_START.md：
 * 本测试**只验证工程自洽性**，不声称这是某部典籍的唯一算法。
 */

import { describe, expect, it } from "vitest";
import { computeDayun } from "./index";
import type { Pillar } from "@/lib/types";

function p(stem: string, branch: string): Pillar {
  return { stem, branch };
}

/** 出生日 + N 个月（与实现同口径的独立复算，避免用被测代码验证自己） */
function addMonths(birthDate: string, months: number): string {
  const [y, m, d] = birthDate.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const dt = new Date(base);
  dt.setUTCMonth(dt.getUTCMonth() + months);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

type Case = {
  label: string;
  monthPillar: Pillar;
  yearStem: string;
  gender: "male" | "female";
  birthDate: string;
  hour: number;
  minute: number;
};

const CASES: Case[] = [
  { label: "庚午男 1990-05-15", monthPillar: p("辛", "巳"), yearStem: "庚", gender: "male", birthDate: "1990-05-15", hour: 10, minute: 30 },
  { label: "庚午女 1990-05-15", monthPillar: p("辛", "巳"), yearStem: "庚", gender: "female", birthDate: "1990-05-15", hour: 10, minute: 30 },
  { label: "乙丑男 1985-03-20", monthPillar: p("己", "卯"), yearStem: "乙", gender: "male", birthDate: "1985-03-20", hour: 6, minute: 0 },
  { label: "丙子男 1996-12-25", monthPillar: p("庚", "子"), yearStem: "丙", gender: "male", birthDate: "1996-12-25", hour: 8, minute: 0 },
  { label: "癸卯女 2023-06-15", monthPillar: p("戊", "午"), yearStem: "癸", gender: "female", birthDate: "2023-06-15", hour: 12, minute: 0 },
  { label: "己巳男 1990-02-04 立春前", monthPillar: p("丁", "丑"), yearStem: "己", gender: "male", birthDate: "1990-02-04", hour: 10, minute: 0 },
  { label: "庚午年女 2000-01-01", monthPillar: p("丙", "子"), yearStem: "己", gender: "female", birthDate: "2000-01-01", hour: 10, minute: 0 },
];

function run(c: Case) {
  return computeDayun("x", c.monthPillar, c.yearStem, c.gender, c.birthDate, c.hour, c.minute, undefined, 2026);
}

describe("起运精确到月 · 不变量", () => {
  it.each(CASES)("$label：startAge 与 startAgeDetail 月级自洽", (c) => {
    const r = run(c);
    const d = r.startAgeDetail;
    const formal = r.dayun.filter((s) => !s.isPreDayun);

    // 月级总折算应与 diffDays 一致：totalMonths ≈ round(diffDays/3*12)
    const expectedTotal = Math.round((d.diffDays / 3) * 12);
    expect(d.years * 12 + d.months).toBe(expectedTotal);

    // 首步 startAge 必须是总月数的整岁部分，而非四舍五入的整岁
    expect(formal[0].startAge).toBe(Math.floor(expectedTotal / 12));
    expect(formal[0].startAgeMonths).toBe(expectedTotal % 12);
  });

  it.each(CASES)("$label：startAt 等于出生日 + 总月数", (c) => {
    const r = run(c);
    const d = r.startAgeDetail;
    const total = d.years * 12 + d.months;
    expect(d.startAt).toBe(addMonths(c.birthDate, total));

    // 第一步正式大运的 startAt 与 startAgeDetail.startAt 必须一致
    const formal = r.dayun.filter((s) => !s.isPreDayun);
    expect(formal[0].startAt).toBe(d.startAt);
  });

  it.each(CASES)("$label：startAge/endAge/startYear 结构一致", (c) => {
    const r = run(c);
    for (const step of r.dayun.filter((s) => !s.isPreDayun)) {
      expect(step.endAge - step.startAge).toBe(9);
      expect(step.endYear - step.startYear).toBe(9);
      expect(step.startYear).toBe(Number(c.birthDate.slice(0, 4)) + step.startAge);
    }
  });

  it("每步的起运月数一致（10 年为整周期，余月继承首步）", (c) => {
    const r = run(CASES[0]);
    const formal = r.dayun.filter((s) => !s.isPreDayun);
    const firstMonths = formal[0].startAgeMonths ?? 0;
    for (let i = 1; i < formal.length; i++) {
      // 第 i 步的精确月数 = 首步月数 + i*120，去整岁后余月应与首步相同
      const total = (formal[0].startAge ?? 0) * 12 + firstMonths + i * 120;
      expect(formal[i].startAge).toBe(Math.floor(total / 12));
      expect(total % 12).toBe(firstMonths);
    }
  });

  it("startAt 每步递增 10 年", () => {
    const r = run(CASES[0]);
    const formal = r.dayun.filter((s) => !s.isPreDayun);
    for (let i = 1; i < formal.length; i++) {
      const prev = formal[i - 1].startAt!;
      const expected = (() => {
        const [y, m, d] = prev.split("-").map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        dt.setUTCMonth(dt.getUTCMonth() + 120);
        return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
      })();
      expect(formal[i].startAt).toBe(expected);
    }
  });
});

describe("起运精确到月 · currentDayunIndex 按实际月数判定", () => {
  it("交运当月即切到新运（不再等到整岁）", () => {
    // 丙子男 1996-12-25：3 岁 9 个月起运 → startAt=2000-09-25。
    // 旧整岁判定在 currentYear=2000 时 age=4 已 >= startAge(旧值 4) 命中；
    // 新口径以 ageMonths 判定，2000 年 ageMonths=48，
    // 首步起点为 45 个月 → 命中第 0 步。
    const r = computeDayun("庚", p("庚", "子"), "丙", "male", "1996-12-25", 8, 0, undefined, 2000);
    expect(r.currentDayunIndex).toBe(0);
  });

  it("起运前返回 -1", () => {
    const r = computeDayun("庚", p("庚", "子"), "丙", "male", "1996-12-25", 8, 0, undefined, 1998);
    // 1998 年 age=2 → 24 个月 < 45 个月起运
    expect(r.currentDayunIndex).toBe(-1);
  });

  it("随年份推进索引单调不减", () => {
    let prev = -1;
    for (let y = 2000; y <= 2035; y++) {
      const r = computeDayun("庚", p("庚", "子"), "丙", "male", "1996-12-25", 8, 0, undefined, y);
      expect(r.currentDayunIndex).toBeGreaterThanOrEqual(prev);
      prev = r.currentDayunIndex;
    }
    expect(prev).toBeGreaterThan(0);
  });

  it("长跨度下每个正式步都会被命中（无空洞）", () => {
    const hits = new Set<number>();
    for (let y = 1990; y <= 2080; y++) {
      const r = computeDayun("庚", p("辛", "巳"), "庚", "male", "1990-05-15", 10, 30, undefined, y);
      if (r.currentDayunIndex >= 0) hits.add(r.currentDayunIndex);
    }
    // 8 个正式步应全部被覆盖
    expect([...hits].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("deathYear 截断生效", () => {
    const r = computeDayun("庚", p("辛", "巳"), "庚", "male", "1990-05-15", 10, 30, 1995, 2026);
    expect(r.currentDayunIndex).toBe(-1); // 1995 年 age=5 < 起运 7 岁 3 个月
  });
});

describe("起运精确到月 · 与旧整岁口径的差异被显式记录", () => {
  // 这些样本的余月 ≥6，旧口径 round 会进位，新口径不进位。
  // 断言"新值 = 旧值 - 1"，把差异固化下来而不是静默变化。
  const DIVERGENT: [string, Case][] = [
    ["乙丑男 1985-03-20", CASES[2]],
    ["丙子男 1996-12-25", CASES[3]],
  ];

  it.each(DIVERGENT)("%s：新口径比旧整岁口径小 1 岁", (_label, c) => {
    const r = run(c);
    const d = r.startAgeDetail;
    const formal = r.dayun.filter((s) => !s.isPreDayun);

    const oldAge = Math.round(d.diffDays / 3); // 旧口径
    const newAge = formal[0].startAge; // 新口径

    expect(newAge).toBe(oldAge - 1);
    // 且新口径必须与 startAt 自洽（这正是旧口径的缺陷所在）
    expect(d.startAt).toBe(
      addMonths(c.birthDate, newAge * 12 + (formal[0].startAgeMonths ?? 0)),
    );
  });

  it("余月 <6 的样本口径未变（避免过度改动）", () => {
    const r = run(CASES[0]); // 庚午男：7 岁 3 个月
    const d = r.startAgeDetail;
    expect(Math.round(d.diffDays / 3)).toBe(7);
    expect(r.dayun.filter((s) => !s.isPreDayun)[0].startAge).toBe(7);
    expect(d.months).toBe(3);
  });
});
