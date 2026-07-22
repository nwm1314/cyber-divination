import { describe, expect, it } from "vitest";
import { castLiuyao } from "../cast";
import {
  assignLiushen,
  LIUSHEN_ORDER,
  STEM_LIUSHEN_START,
} from "./liushen";
import { branchYuePo, branchRiChong } from "./yuepo";
import { resolveFushen } from "./fushen";
import { analyzeDongBian, huitouOf } from "./dongbian";
import { isBranchChong } from "./yingqi";

describe("T281 六神", () => {
  it("甲日初爻青龙顺排六神", () => {
    expect(assignLiushen("甲")).toEqual([...LIUSHEN_ORDER]);
  });

  it("丙日初爻朱雀", () => {
    expect(assignLiushen("丙")[0]).toBe("朱雀");
    expect(assignLiushen("丁")[0]).toBe("朱雀");
  });

  it("日干起点表完整", () => {
    expect(Object.keys(STEM_LIUSHEN_START)).toHaveLength(10);
  });

  it("有 castAt 时 lines 写入 liushen", () => {
    const chart = castLiuyao({
      question: "求财",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      castAt: "2024-06-15T10:00",
      id: "t281-liushen",
    });
    expect(chart.dayGanZhi).toBeTruthy();
    expect(chart.lines.every((l) => l.liushen)).toBe(true);
    expect(chart.lines).toHaveLength(6);
    const stem = chart.dayGanZhi![0]!;
    expect(chart.lines[0]!.liushen).toBe(assignLiushen(stem)[0]);
  });
});

describe("T281 月破日冲", () => {
  it("子午冲", () => {
    expect(isBranchChong("子", "午")).toBe(true);
    expect(branchYuePo("子", "午")).toBe(true);
    expect(branchRiChong("卯", "酉")).toBe(true);
    expect(branchYuePo("子", "丑")).toBe(false);
  });

  it("有占时写入 yuePo/riChong 标志", () => {
    const chart = castLiuyao({
      question: "测月破",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      castAt: "2024-06-15T10:00",
      id: "t281-yuepo",
    });
    expect(chart.yueJian).toBeTruthy();
    expect(chart.dayGanZhi).toBeTruthy();
    const dayBr = chart.dayGanZhi!.slice(1);
    for (const line of chart.lines) {
      expect(typeof line.yuePo).toBe("boolean");
      expect(typeof line.riChong).toBe("boolean");
      expect(line.yuePo).toBe(branchYuePo(line.branch, chart.yueJian));
      expect(line.riChong).toBe(branchRiChong(line.branch, dayBr));
    }
  });
});

describe("T281 回头生克", () => {
  it("动变项含 huitou 字段", () => {
    const chart = castLiuyao({
      question: "求合作",
      method: "manual",
      lines: [9, 7, 7, 7, 7, 7],
      id: "t281-huitou",
    });
    const items = analyzeDongBian(chart);
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const it of items) {
      expect(["回头生", "回头克", "无"]).toContain(it.huitou);
      expect(it.huitou).toBe(huitouOf(it.relation));
    }
  });
});

describe("T281 伏神", () => {
  it("用神不现时可解析伏神列表", () => {
    // 乾为天：六亲可能不全覆盖五亲；伏神来自本宫对照
    const fushen = resolveFushen([1, 1, 1, 1, 1, 1]);
    expect(Array.isArray(fushen)).toBe(true);
    // 每项结构完整
    for (const f of fushen) {
      expect(f.yao).toBeGreaterThanOrEqual(1);
      expect(f.yao).toBeLessThanOrEqual(6);
      expect(f.fuLiuqin).toBeTruthy();
      expect(f.feiLiuqin).toBeTruthy();
    }
  });

  it("用神类别确认 + 不现时 enrich 可挂 fushen", () => {
    // 乾宫妻财为土爻；若某卦缺某六亲则可能挂伏
    const chart = castLiuyao({
      question: "随便问问",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      questionCategory: "wealth",
      id: "t281-fu-chart",
    });
    // 乾为天纳甲有土爻，妻财应现；至少 yongShen 为妻财
    expect(chart.yongShen).toBe("妻财");
  });
});
