/**
 * 动变进退神 / 空破 / 冲合 规则测试（GAP-3 · 波次 3）
 *
 * 口径声明：docs/ENGINE_RULE_LIUYAO_DONGBIAN.md
 *
 * 本文件只验证**结构化标注**的判定正确性，不下吉凶结论
 * （符合 data/sources.ts 的 excluded 约定：不采用恐吓、绝对化断语）。
 */

import { describe, expect, it } from "vitest";
import {
  analyzeDongBian,
  chongHeOf,
  dongBianSectionBody,
  jintuiOf,
  wuxingRelation,
} from "./dongbian";
import { castLiuyao } from "../cast";
import type { YaoValue } from "@/lib/types/liuyao";

/** 搜索型用例需遍历候选卦，显式放宽超时以适配并行负载 */
const SEARCH_TIMEOUT_MS = 30_000;

/** 由五行判定用的直接调用（绕过装卦，单测纯函数） */
describe("jintuiOf · 进退神判定", () => {
  it("同五行顺行相邻 → 进神", () => {
    // 寅(木)→卯(木)、巳(火)→午(火)、申(金)→酉(金)、亥(水)→子(水)
    expect(jintuiOf("寅", "卯", "木", "木")).toBe("进神");
    expect(jintuiOf("巳", "午", "火", "火")).toBe("进神");
    expect(jintuiOf("申", "酉", "金", "金")).toBe("进神");
    expect(jintuiOf("亥", "子", "水", "水")).toBe("进神");
  });

  it("同五行逆行相邻 → 退神", () => {
    expect(jintuiOf("卯", "寅", "木", "木")).toBe("退神");
    expect(jintuiOf("午", "巳", "火", "火")).toBe("退神");
    expect(jintuiOf("酉", "申", "金", "金")).toBe("退神");
    expect(jintuiOf("子", "亥", "水", "水")).toBe("退神");
  });

  it("异五行一律不判进退（属生克，不叠加）", () => {
    // 寅(木)→午(火) 是动生化，不是进神
    expect(jintuiOf("寅", "午", "木", "火")).toBe("无");
    expect(jintuiOf("午", "寅", "火", "木")).toBe("无");
    expect(jintuiOf("子", "午", "水", "火")).toBe("无");
    expect(jintuiOf("寅", "巳", "木", "火")).toBe("无");
  });

  it("同支不判进退", () => {
    expect(jintuiOf("寅", "寅", "木", "木")).toBe("无");
    expect(jintuiOf("子", "子", "水", "水")).toBe("无");
  });

  it("土支跨支保守不判（流派无共识）", () => {
    // 辰→未、未→戌、戌→丑、丑→辰 等同五行土但跨支
    expect(jintuiOf("辰", "未", "土", "土")).toBe("无");
    expect(jintuiOf("未", "戌", "土", "土")).toBe("无");
    expect(jintuiOf("戌", "丑", "土", "土")).toBe("无");
    expect(jintuiOf("丑", "辰", "土", "土")).toBe("无");
    // 反向亦不判
    expect(jintuiOf("未", "辰", "土", "土")).toBe("无");
  });

  it("土支相邻也不判（凡是土支均不判，避免与流派冲突）", () => {
    // 辰丑、未戌 在十二支序列上不相邻；此处显式确认土支判定恒为无
    expect(jintuiOf("丑", "寅", "土", "土")).toBe("无");
    expect(jintuiOf("辰", "巳", "土", "土")).toBe("无");
  });

  it("五行参数与地支不一致时不误判", () => {
    // 声称同五行但实际地支非同五行支：仍按传入五行判定
    // （函数契约：五行由调用方保证与地支一致）
    expect(jintuiOf("寅", "卯", "木", "木")).toBe("进神");
    // 传入矛盾五行时应保守
    expect(jintuiOf("寅", "卯", "木", "火")).toBe("无");
  });
});

describe("chongHeOf · 化冲化合判定", () => {
  it("六冲配对 → 化冲", () => {
    const pairs: [string, string][] = [
      ["子", "午"],
      ["丑", "未"],
      ["寅", "申"],
      ["卯", "酉"],
      ["辰", "戌"],
      ["巳", "亥"],
    ];
    for (const [a, b] of pairs) {
      expect(chongHeOf(a, b)).toBe("化冲");
      expect(chongHeOf(b, a)).toBe("化冲");
    }
  });

  it("六合配对 → 化合", () => {
    const pairs: [string, string][] = [
      ["子", "丑"],
      ["寅", "亥"],
      ["卯", "戌"],
      ["辰", "酉"],
      ["巳", "申"],
      ["午", "未"],
    ];
    for (const [a, b] of pairs) {
      expect(chongHeOf(a, b)).toBe("化合");
      expect(chongHeOf(b, a)).toBe("化合");
    }
  });

  it("同支既非冲也非合", () => {
    for (const b of ["子", "午", "寅", "卯", "辰", "戌"]) {
      expect(chongHeOf(b, b)).toBe("无");
    }
  });

  it("无关系支 → 无", () => {
    expect(chongHeOf("子", "寅")).toBe("无");
    expect(chongHeOf("卯", "午")).toBe("无");
  });

  it("空输入 → 无（不抛错）", () => {
    expect(chongHeOf("", "")).toBe("无");
    expect(chongHeOf("子", "")).toBe("无");
  });

  it("冲与合不重叠：无支同时既冲又合", () => {
    const DIZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
    for (const a of DIZHI) {
      for (const b of DIZHI) {
        if (a === b) continue;
        const r = chongHeOf(a, b);
        const alt = chongHeOf(b, a);
        expect(r).toBe(alt); // 对称
        expect(["化冲", "化合", "无"]).toContain(r);
      }
    }
  });
});

describe("五行生克未被改动（回归守护）", () => {
  it("五分类保持原语义", () => {
    expect(wuxingRelation("木", "木")).toBe("比和");
    expect(wuxingRelation("木", "火")).toBe("动生化");
    expect(wuxingRelation("木", "土")).toBe("动克化");
    expect(wuxingRelation("水", "木")).toBe("动生化");
    expect(wuxingRelation("火", "木")).toBe("化生动");
    expect(wuxingRelation("土", "木")).toBe("化克动");
  });
});

describe("analyzeDongBian · 集成：装卦后带出进退冲合", () => {
  function cast(lines: YaoValue[], castAt?: string) {
    return castLiuyao({
      question: "动变测试",
      method: "manual",
      lines,
      ...(castAt ? { castAt } : {}),
    });
  }

  it("有占时 → 空破字段为布尔值（已计算）", () => {
    const chart = cast([9, 8, 7, 8, 7, 8], "2026-07-20T12:00");
    const items = analyzeDongBian(chart);
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(typeof it.benKong).toBe("boolean");
      expect(typeof it.huaKong).toBe("boolean");
      expect(typeof it.benPo).toBe("boolean");
      expect(typeof it.huaPo).toBe("boolean");
    }
  });

  it("无占时 → 空破字段为 undefined（不臆断）", () => {
    const chart = cast([9, 8, 7, 8, 7, 8]);
    const items = analyzeDongBian(chart);
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(it.benKong).toBeUndefined();
      expect(it.huaKong).toBeUndefined();
      expect(it.benPo).toBeUndefined();
      expect(it.huaPo).toBeUndefined();
    }
  });

  it("每条动变都带 jintui / chongHe 字段（枚举内取值）", () => {
    const chart = cast([9, 9, 9, 9, 9, 9], "2026-07-20T12:00");
    for (const it of analyzeDongBian(chart)) {
      expect(["进神", "退神", "无"]).toContain(it.jintui);
      expect(["化冲", "化合", "无"]).toContain(it.chongHe);
      expect(it.fromBranch).toBeTruthy();
      expect(it.toBranch).toBeTruthy();
    }
  });

  it("summary 包含标签且保持中性（不含吉凶恐吓词）", () => {
    const chart = cast([9, 9, 9, 9, 9, 9], "2026-07-20T12:00");
    const body = dongBianSectionBody(chart);
    const BANNED = ["大凶", "必败", "破财", "血光", "灾", "死", "报应", "注定"];
    for (const w of BANNED) {
      expect(body).not.toContain(w);
    }
    expect(body).toContain("动变生克");
  });

  it(
    "进神样本：构造木动化木进（寅→卯）",
    () => {
      // 需要找出满足特定地支动变的卦。用穷举搜索一个真实存在的组合，
      // 避免手工臆造卦象。
      const found = findYaoPair("寅", "卯", "进神");
      expect(found, "应至少存在一个寅→卯的进神样本").toBeTruthy();
      expect(found!.jintui).toBe("进神");
    },
    SEARCH_TIMEOUT_MS,
  );

  it(
    "退神样本：构造木动化木退（卯→寅）",
    () => {
      const found = findYaoPair("卯", "寅", "退神");
      expect(found, "应至少存在一个卯→寅的退神样本").toBeTruthy();
      expect(found!.jintui).toBe("退神");
    },
    SEARCH_TIMEOUT_MS,
  );

  /**
   * 在 4096 组合中搜索一个「动爻本支/化支」匹配指定配对的样本。
   * 用搜索而非硬编码，避免手写错误。
   */
  function findYaoPair(from: string, to: string, expectJintui: string) {
    const DIZHI_PATTERN = [
      0b111, 0b110, 0b101, 0b100, 0b011, 0b010, 0b001, 0b000,
    ];
    for (const lower of DIZHI_PATTERN) {
      for (const upper of DIZHI_PATTERN) {
        const bits = [
          (lower >> 2) & 1,
          (lower >> 1) & 1,
          lower & 1,
          (upper >> 2) & 1,
          (upper >> 1) & 1,
          upper & 1,
        ];
        for (let mask = 1; mask < 64; mask++) {
          const values = bits.map((bit, i) => {
            const changing = ((mask >> i) & 1) === 1;
            if (bit === 1) return changing ? 9 : 7;
            return changing ? 6 : 8;
          }) as YaoValue[];
          const chart = castLiuyao({
            question: "搜索",
            method: "manual",
            lines: values,
            castAt: "2026-07-20T12:00",
          });
          for (const it of analyzeDongBian(chart)) {
            if (it.fromBranch === from && it.toBranch === to) {
              if (expectJintui === "进神" && it.jintui !== "进神") continue;
              if (expectJintui === "退神" && it.jintui !== "退神") continue;
              return it;
            }
          }
        }
      }
    }
    return null;
  }
});
