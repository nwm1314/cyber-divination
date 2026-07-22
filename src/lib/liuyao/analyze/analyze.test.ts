import { describe, expect, it } from "vitest";
import { castLiuyao } from "../cast";
import {
  analyzeLiuyao,
  enrichChart,
  listDongYao,
  ensureBenBian,
  resolveYongShen,
  shiYingFromBinary,
  PALACE_BY_BINARY,
  SHI_BY_PALACE_POS,
  yingFromShi,
  buildPalaceMembers,
} from "./index";
import { HEXAGRAMS } from "../data/hexagrams";
import type { YaoPosition } from "@/lib/types/liuyao";

describe("八宫表", () => {
  it("覆盖 64 卦且无重复", () => {
    expect(Object.keys(PALACE_BY_BINARY)).toHaveLength(64);
    for (const h of HEXAGRAMS) {
      const key = h.binary.join("");
      expect(PALACE_BY_BINARY[key], h.name).toBeDefined();
    }
  });

  it("乾宫：本宫/一世/归魂", () => {
    const members = buildPalaceMembers("乾");
    expect(members[0]!.binaryKey).toBe("111111");
    expect(members[1]!.binaryKey).toBe("011111"); // 姤
    expect(members[7]!.binaryKey).toBe("111101"); // 大有
  });
});

describe("世应", () => {
  it("口诀：本宫世六、一世初…游魂四、归魂三", () => {
    expect(SHI_BY_PALACE_POS).toEqual([6, 1, 2, 3, 4, 5, 4, 3]);
  });

  it("应爻与世隔两位", () => {
    const pairs: [YaoPosition, YaoPosition][] = [
      [1, 4],
      [2, 5],
      [3, 6],
      [4, 1],
      [5, 2],
      [6, 3],
    ];
    for (const [shi, ying] of pairs) {
      expect(yingFromShi(shi)).toBe(ying);
    }
  });

  it("乾为天 · 世六应三", () => {
    const sy = shiYingFromBinary([1, 1, 1, 1, 1, 1]);
    expect(sy).toMatchObject({
      palace: "乾",
      palacePos: 0,
      shiYao: 6,
      yingYao: 3,
    });
  });

  it("天风姤 · 一世世初应四", () => {
    const sy = shiYingFromBinary([0, 1, 1, 1, 1, 1]);
    expect(sy).toMatchObject({
      palace: "乾",
      palacePos: 1,
      shiYao: 1,
      yingYao: 4,
    });
  });

  it("坤为地 · 世六应三", () => {
    const sy = shiYingFromBinary([0, 0, 0, 0, 0, 0]);
    expect(sy.shiYao).toBe(6);
    expect(sy.yingYao).toBe(3);
    expect(sy.palace).toBe("坤");
  });
});

describe("动爻 / 本变卦", () => {
  it("无动爻：dongYao 空，无变卦", () => {
    const chart = castLiuyao({
      question: "静卦",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
    });
    expect(listDongYao(chart)).toEqual([]);
    expect(chart.bianGua).toBeUndefined();
    const bb = ensureBenBian(chart);
    expect(bb.benGua.name).toBe("乾为天");
    expect(bb.bianGua).toBeUndefined();
  });

  it("初爻老阳：动爻 [1]，变姤", () => {
    const chart = castLiuyao({
      question: "测变卦",
      method: "manual",
      lines: [9, 7, 7, 7, 7, 7],
    });
    expect(listDongYao(chart)).toEqual([1]);
    expect(chart.benGua).toEqual({ name: "乾为天", upper: "乾", lower: "乾" });
    expect(chart.bianGua?.upper).toBe("乾");
    expect(chart.bianGua?.lower).toBe("巽");
  });

  it("多动爻升序", () => {
    const chart = castLiuyao({
      question: "多动",
      method: "manual",
      lines: [9, 7, 6, 7, 9, 8],
    });
    expect(listDongYao(chart)).toEqual([1, 3, 5]);
  });
});

describe("用神规则表", () => {
  it("求财 → 妻财", () => {
    expect(resolveYongShen("今年求财运如何")).toBe("妻财");
  });
  it("升职 → 官鬼", () => {
    expect(resolveYongShen("能否升职")).toBe("官鬼");
  });
  it("婚恋 → 妻财", () => {
    expect(resolveYongShen("感情复合")).toBe("妻财");
  });
  it("疾病 → 官鬼", () => {
    expect(resolveYongShen("病情如何")).toBe("官鬼");
  });
  it("未命中 → 世", () => {
    expect(resolveYongShen("随便问问")).toBe("世");
  });
});

describe("analyzeLiuyao / enrichChart / cast 集成", () => {
  it("乾静卦：世应 + 用神落爻", () => {
    const chart = castLiuyao({
      question: "工作升迁如何",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      id: "t112-qian",
    });
    expect(chart.shiYao).toBe(6);
    expect(chart.yingYao).toBe(3);
    expect(chart.yongShen).toBe("官鬼");
    expect(chart.yongShenYao).toBe(4);
    expect(chart.lines.map((l) => l.liuqin)).toEqual([
      "子孙",
      "妻财",
      "父母",
      "官鬼",
      "兄弟",
      "父母",
    ]);
    const a = analyzeLiuyao(chart);
    expect(a.dongYao).toEqual([]);
    expect(a.palace).toBe("乾");
    expect(a.yongShenYao).toBe(4);
  });

  it("enrich 幂等且可复现", () => {
    const chart = castLiuyao({
      question: "求财",
      method: "manual",
      lines: [9, 7, 7, 7, 7, 7],
      id: "t112-idem",
    });
    const e1 = enrichChart(chart);
    const e2 = enrichChart(e1);
    expect(e1).toEqual(e2);
    expect(e1.shiYao).toBe(6);
    expect(e1.yongShen).toBe("妻财");
    expect(listDongYao(e1)).toEqual([1]);
  });

  it("cast 两次 deep equal", () => {
    const input = {
      question: "面试结果",
      method: "manual" as const,
      lines: [8, 7, 9, 8, 7, 6] as const,
      id: "t112-det",
    };
    expect(castLiuyao(input)).toEqual(castLiuyao(input));
  });
});
