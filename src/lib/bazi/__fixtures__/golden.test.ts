import { describe, expect, it } from "vitest";
import { computeChart } from "@/lib/bazi";
import { goldenCases, makeProfile } from "./index";

describe("golden test suite — 排盘金标准", () => {
  for (const c of goldenCases) {
    it(c.label, () => {
      const chart = computeChart(makeProfile(c.input));

      // 四柱 + 日主
      expect(chart.pillars.year.stem + chart.pillars.year.branch).toBe(c.expect.year);
      expect(chart.pillars.month.stem + chart.pillars.month.branch).toBe(c.expect.month);
      expect(chart.pillars.day.stem + chart.pillars.day.branch).toBe(c.expect.day);
      expect(chart.dayMaster).toBe(c.expect.dayMaster);

      if (c.expect.hour === null) {
        expect(chart.pillars.hour).toBeNull();
      } else {
        expect(chart.pillars.hour).not.toBeNull();
        expect(chart.pillars.hour!.stem + chart.pillars.hour!.branch).toBe(c.expect.hour);
      }

      // 标志性字段
      const { extra } = c.expect;
      if (!extra) return;

      if (extra.flags) {
        for (const f of extra.flags as string[]) {
          expect(chart.flags).toContain(f);
        }
      }

      if (extra.tenGod_year) {
        expect(chart.pillars.year.tenGod).toBe(extra.tenGod_year);
      }
      if (extra.tenGod_month) {
        expect(chart.pillars.month.tenGod).toBe(extra.tenGod_month);
      }
      if (extra.tenGod_hour && chart.pillars.hour) {
        expect(chart.pillars.hour.tenGod).toBe(extra.tenGod_hour);
      }

      if (extra.hiddenStems_month) {
        expect(chart.pillars.month.hiddenStems).toEqual(extra.hiddenStems_month);
      }
      if (extra.yearHidden) {
        expect(chart.pillars.year.hiddenStems).toEqual(extra.yearHidden);
      }

      // 大运（正式步 index>=0，跳过起运前小运）
      const formal = chart.dayun.filter((d) => !d.isPreDayun && d.index >= 0);
      if (extra.dayunFirst) {
        expect(formal[0].stem + formal[0].branch).toBe(extra.dayunFirst);
      }
      if (extra.dayunStartAge !== undefined) {
        expect(formal[0].startAge).toBe(extra.dayunStartAge);
      }
      if (extra.currentDayunIndex !== undefined) {
        expect(chart.currentDayunIndex).toBe(extra.currentDayunIndex);
      }

      // 流年截断
      if (extra.liunianYears) {
        const years = chart.liunian.map((l) => l.year);
        expect(years).toEqual(extra.liunianYears);
      }

      // 五行计分
      if (extra.wuxingScores) {
        const ws = extra.wuxingScores as Record<string, number>;
        for (const [wx, score] of Object.entries(ws)) {
          expect(chart.wuxingScores[wx as keyof typeof chart.wuxingScores]).toBeCloseTo(score, 5);
        }
      }

      // 标志性断言（按 label 追加；藏干权重 0.6/0.3/0.1）
      if (c.label.startsWith("立春分年·立春前")) {
        // 己巳/丁丑/庚子/辛巳
        expect(chart.wuxingScores.fire).toBeCloseTo(2.2, 5);
        expect(chart.wuxingScores.metal).toBeCloseTo(2.7, 5);
      }

      if (c.label.startsWith("立春分年·立春后")) {
        // 庚午/戊寅/庚子/辛巳
        expect(chart.wuxingScores.metal).toBeCloseTo(3.3, 5);
      }
    });
  }
});
