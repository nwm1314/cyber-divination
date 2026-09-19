/**
 * 变卦穷举覆盖测试（GAP-3 · E-3 B-23）
 *
 * 背景：`REVIEW_ENG_ENGINE.md` B-23 指出**变卦覆盖度 0%** —— 既有测试
 * 只覆盖少数手写样本，从未系统性验证动变路径。
 *
 * 本文件穷举完整状态空间：
 *   64 本卦 × 64 种动爻模式（6 爻各自静/动，2^6 = 64）= **4096 组合**
 *
 * 断言（覆盖度 + 稳定性，不含规则判断）：
 * 1. 全部 4096 组合均可装卦且不抛错
 * 2. 每组都有 6 爻、世应 1-6、本卦可解析
 * 3. 动爻数量与动爻模式一致；有动爻则必有变卦，无动爻则无变卦
 * 4. 金标准卦序：64 本卦全部被覆盖到（不遗漏卦）
 * 5. 变卦集合 = 64 卦（满射，不产生越界卦）
 */

import { describe, expect, it } from "vitest";
import { castLiuyao } from "@/lib/liuyao/cast";
import { analyzeDongBian } from "@/lib/liuyao/analyze/dongbian";
import { HEXAGRAMS } from "@/lib/liuyao/data/hexagrams";
import type { YaoValue } from "@/lib/types/liuyao";

/**
 * 由本卦 6 爻阴阳 + 动爻掩码构造 6 个爻值。
 * 静爻：阳=7(少阳)、阴=8(少阴)
 * 动爻：阳=9(老阳)、阴=6(老阴)
 */
function valuesFor(binary: number[], changingMask: number): YaoValue[] {
  return binary.map((bit, i) => {
    const changing = ((changingMask >> i) & 1) === 1;
    if (bit === 1) return changing ? 9 : 7;
    return changing ? 6 : 8;
  }) as YaoValue[];
}

/**
 * 取卦的阴阳位（自下而上，1=阳）。
 *
 * 直接使用数据层的 `binary` 字段（hexagrams.ts:34 由 upper/lower 推导），
 * 而非测试内自建经卦表——避免"测试自己算一套、数据层另一套"的假验证。
 */
function binaryOf(hex: (typeof HEXAGRAMS)[number]): number[] {
  return [...hex.binary];
}

const CAST_AT = "2026-07-20T12:00";

/**
 * 穷举 4096 组合需数秒，且在全量测试并行负载下会超过 vitest 默认
 * 的 5s 单测超时。这里显式放大超时，避免成为"负载敏感"的假失败。
 */
const EXHAUSTIVE_TIMEOUT_MS = 60_000;

describe("变卦穷举 · 4096 组合全量覆盖", () => {
  it("64 本卦数据齐全且阴阳位可解析", () => {
    expect(HEXAGRAMS).toHaveLength(64);
    for (const hex of HEXAGRAMS) {
      expect(binaryOf(hex)).toHaveLength(6);
      expect(binaryOf(hex).every((b) => b === 0 || b === 1)).toBe(true);
    }
  });

  it(
    "4096 组合全部可装卦，无异常、无缺失",
    () => {
    let total = 0;
    let withChanging = 0;
    let withoutChanging = 0;
    const benGuaNames = new Set<string>();
    const bianGuaNames = new Set<string>();

    for (const ben of HEXAGRAMS) {
      const binary = binaryOf(ben);
      for (let mask = 0; mask < 64; mask++) {
        const values = valuesFor(binary, mask);
        const changingCount = values.filter((v) => v === 6 || v === 9).length;

        const chart = castLiuyao({
          question: "穷举",
          method: "manual",
          lines: values,
          castAt: CAST_AT,
        });

        // 结构完整性
        expect(chart.lines).toHaveLength(6);
        expect(chart.shiYao).toBeGreaterThanOrEqual(1);
        expect(chart.shiYao).toBeLessThanOrEqual(6);
        expect(chart.yingYao).toBeGreaterThanOrEqual(1);
        expect(chart.yingYao).toBeLessThanOrEqual(6);
        expect(chart.benGua.name).toBeTruthy();

        // 动爻数一致
        expect(chart.lines.filter((l) => l.value === 6 || l.value === 9)).toHaveLength(
          changingCount,
        );

        // 有动爻 ⇔ 有变卦
        if (changingCount > 0) {
          expect(chart.bianGua, `mask=${mask} ${ben.name}`).toBeDefined();
          withChanging++;
          bianGuaNames.add(chart.bianGua!.name);
        } else {
          expect(chart.bianGua).toBeUndefined();
          withoutChanging++;
        }

        // 动变分析不抛错
        const items = analyzeDongBian(chart);
        expect(items).toHaveLength(changingCount);

        benGuaNames.add(chart.benGua.name);
        total++;
      }
    }

    // 覆盖度断言
    expect(total).toBe(4096);
    expect(benGuaNames.size).toBe(64); // 64 本卦全部覆盖
    expect(bianGuaNames.size).toBe(64); // 变卦映射满射到 64 卦
    expect(withChanging).toBe(64 * 63); // 除 mask=0 外都有动爻
    expect(withoutChanging).toBe(64); // 每本卦恰有 1 个静卦
    },
    EXHAUSTIVE_TIMEOUT_MS,
  );

  it("全零掩码（静卦）不产生变卦与动变条目", () => {
    for (const ben of HEXAGRAMS) {
      const chart = castLiuyao({
        question: "静卦",
        method: "manual",
        lines: valuesFor(binaryOf(ben), 0),
        castAt: CAST_AT,
      });
      expect(chart.bianGua).toBeUndefined();
      expect(analyzeDongBian(chart)).toHaveLength(0);
    }
  });

  it("全动掩码（六爻皆动）产生的变卦为「错卦」（阴阳全反）", () => {
    for (const ben of HEXAGRAMS) {
      const binary = binaryOf(ben);
      const chart = castLiuyao({
        question: "六爻皆动",
        method: "manual",
        lines: valuesFor(binary, 0b111111),
        castAt: CAST_AT,
      });
      expect(chart.bianGua).toBeDefined();
      expect(analyzeDongBian(chart)).toHaveLength(6);

      // 错卦：六爻阴阳全反，与任何本卦都不同（除非矛盾）
      const flipped = binary.map((b) => (b === 1 ? 0 : 1));
      const flippedHex = HEXAGRAMS.find((h) => {
        const hb = binaryOf(h);
        return hb.every((v, i) => v === flipped[i]);
      });
      expect(flippedHex, `${ben.name} 的错卦应存在于 64 卦中`).toBeDefined();
      expect(chart.bianGua!.name).toBe(flippedHex!.name);
    }
  });

  it("单爻动穷举：6 个爻位 × 64 本卦 = 384 组合各自产生不同变卦", () => {
    for (const ben of HEXAGRAMS) {
      const binary = binaryOf(ben);
      const seen = new Set<string>();
      for (let i = 0; i < 6; i++) {
        const chart = castLiuyao({
          question: "单爻动",
          method: "manual",
          lines: valuesFor(binary, 1 << i),
          castAt: CAST_AT,
        });
        expect(analyzeDongBian(chart)).toHaveLength(1);
        expect(analyzeDongBian(chart)[0].yao).toBe(i + 1);
        seen.add(chart.bianGua!.name);
      }
      // 6 个不同爻位动，变卦互不相同
      expect(seen.size).toBe(6);
    }
  });

  it(
    "动变分析对全部 4096 组均产出结构合法的条目",
    () => {
      const validRelations = new Set([
        "比和",
        "动生化",
        "动克化",
        "化生动",
        "化克动",
      ]);
      const validHuitou = new Set(["回头生", "回头克", "无"]);
      const validJintui = new Set(["进神", "退神", "无"]);
      const validChongHe = new Set(["化冲", "化合", "无"]);

      for (const ben of HEXAGRAMS) {
        const binary = binaryOf(ben);
        for (let mask = 0; mask < 64; mask++) {
          const chart = castLiuyao({
            question: "结构",
            method: "manual",
            lines: valuesFor(binary, mask),
            castAt: CAST_AT,
          });
          for (const item of analyzeDongBian(chart)) {
            expect(validRelations.has(item.relation)).toBe(true);
            expect(validHuitou.has(item.huitou)).toBe(true);
            // GAP-3 新增字段也必须落在枚举内
            expect(validJintui.has(item.jintui)).toBe(true);
            expect(validChongHe.has(item.chongHe)).toBe(true);
            expect(item.fromBranch).toBeTruthy();
            expect(item.toBranch).toBeTruthy();
            // 有占时 → 空破已计算（布尔）
            expect(typeof item.benKong).toBe("boolean");
            expect(typeof item.huaKong).toBe("boolean");
            expect(typeof item.benPo).toBe("boolean");
            expect(typeof item.huaPo).toBe("boolean");
            expect(item.fromLiuqin).toBeTruthy();
            expect(item.toLiuqin).toBeTruthy();
            expect(item.fromWuxing).toBeTruthy();
            expect(item.toWuxing).toBeTruthy();
            expect(item.summary).toBeTruthy();
            expect(item.yao).toBeGreaterThanOrEqual(1);
            expect(item.yao).toBeLessThanOrEqual(6);
          }
        }
      }
    },
    EXHAUSTIVE_TIMEOUT_MS,
  );
});
