/**
 * T153 第一切片：六亲安爻 + 用神落爻
 * ≥5 组固定装卦断言
 */
import { describe, expect, it } from "vitest";
import { castLiuyao } from "../cast";
import {
  assignLiuqin,
  liuqinFromWuxing,
  pickLiuqinYao,
  resolveYongShenDetail,
  analyzeLiuyao,
  enrichChart,
  PALACE_WUXING,
} from "./index";

describe("六亲生克表", () => {
  it("宫金：同→兄弟 生→子孙 被生→父母 克→妻财 被克→官鬼", () => {
    expect(liuqinFromWuxing("金", "金")).toBe("兄弟");
    expect(liuqinFromWuxing("金", "水")).toBe("子孙");
    expect(liuqinFromWuxing("金", "土")).toBe("父母");
    expect(liuqinFromWuxing("金", "木")).toBe("妻财");
    expect(liuqinFromWuxing("金", "火")).toBe("官鬼");
  });
});

describe("本卦六亲安爻（纳甲）", () => {
  it("1 乾为天 · 宫金 · 子寅辰午申戌", () => {
    // 乾内子寅辰、外午申戌；金宫：水=子孙 木=妻财 土=父母 火=官鬼 金=兄弟
    const rows = assignLiuqin([1, 1, 1, 1, 1, 1]);
    expect(PALACE_WUXING.乾).toBe("金");
    expect(rows.map((r) => r.branch)).toEqual([
      "子",
      "寅",
      "辰",
      "午",
      "申",
      "戌",
    ]);
    expect(rows.map((r) => r.liuqin)).toEqual([
      "子孙", // 子水
      "妻财", // 寅木
      "父母", // 辰土
      "官鬼", // 午火
      "兄弟", // 申金
      "父母", // 戌土
    ]);
  });

  it("2 坤为地 · 宫土 · 未巳卯丑亥酉", () => {
    const rows = assignLiuqin([0, 0, 0, 0, 0, 0]);
    expect(rows.map((r) => r.branch)).toEqual([
      "未",
      "巳",
      "卯",
      "丑",
      "亥",
      "酉",
    ]);
    // 土宫：土兄弟 火父母 木官鬼 水妻财 金子孙
    expect(rows.map((r) => r.liuqin)).toEqual([
      "兄弟", // 未土
      "父母", // 巳火
      "官鬼", // 卯木
      "兄弟", // 丑土
      "妻财", // 亥水
      "子孙", // 酉金
    ]);
  });

  it("3 天风姤 · 乾宫一世 · 下巽上乾", () => {
    // binary 011111：初阴 二至上阳 → 下巽上乾
    const rows = assignLiuqin([0, 1, 1, 1, 1, 1]);
    expect(rows.map((r) => r.branch)).toEqual([
      "丑", // 巽内
      "亥",
      "酉",
      "午", // 乾外
      "申",
      "戌",
    ]);
    // 仍乾宫金
    expect(rows.map((r) => r.liuqin)).toEqual([
      "父母", // 丑土
      "子孙", // 亥水
      "兄弟", // 酉金
      "官鬼", // 午火
      "兄弟", // 申金
      "父母", // 戌土
    ]);
  });
});

describe("用神落爻", () => {
  it("4 乾静卦求财 → 妻财在二爻（寅）", () => {
    const chart = castLiuyao({
      question: "今年求财运如何",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      id: "t153-qian-cai",
    });
    expect(chart.yongShen).toBe("妻财");
    expect(chart.yongShenYao).toBe(2);
    expect(chart.lines[1]!.liuqin).toBe("妻财");
    expect(chart.lines[1]!.branch).toBe("寅");
  });

  it("5 乾静卦升职 → 官鬼在四爻（午）", () => {
    const chart = castLiuyao({
      question: "工作升迁如何",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      id: "t153-qian-guan",
    });
    expect(chart.yongShen).toBe("官鬼");
    expect(chart.yongShenYao).toBe(4);
    expect(chart.lines.find((l) => l.yao === 4)?.liuqin).toBe("官鬼");
  });

  it("6 未命中关键词 → 用神「世」且 yongShenYao=世爻", () => {
    const chart = castLiuyao({
      question: "今日事宜",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      id: "t153-default",
    });
    expect(chart.yongShen).toBe("世");
    expect(chart.yongShenYao).toBe(chart.shiYao);
    expect(chart.shiYao).toBe(6);
    const a = analyzeLiuyao(chart);
    expect(a.yongShenFallbackShi).toBe(true);
  });

  it("7 用神多现优先动爻（乾官鬼仅一现；坤兄弟二现）", () => {
    // 坤：兄弟在 1(未)、4(丑)；动四爻 → 用神兄弟取 4
    const chart = castLiuyao({
      question: "与兄弟合伙",
      method: "manual",
      lines: [8, 8, 8, 6, 8, 8], // 坤静改四爻老阴
      id: "t153-multi",
    });
    expect(chart.benGua.name).toBe("坤为地");
    expect(chart.yongShen).toBe("兄弟");
    expect(chart.yongShenYao).toBe(4);
    const detail = resolveYongShenDetail("合伙竞争", {
      binary: [0, 0, 0, 0, 0, 0],
      shiYao: 6,
      dongYao: [4],
    });
    expect(detail.yao).toBe(4);
    expect(detail.fallbackShi).toBe(false);
  });

  it("8 enrich 写入 lines.liuqin 且幂等", () => {
    const chart = castLiuyao({
      question: "父母房屋",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      id: "t153-enrich",
    });
    expect(chart.lines.every((l) => l.liuqin && l.branch && l.wuxing)).toBe(
      true,
    );
    // 乾父母：辰(3)戌(6) → 自下优先初现=3
    expect(chart.yongShen).toBe("父母");
    expect(chart.yongShenYao).toBe(3);
    const e2 = enrichChart(chart);
    expect(e2.lines.map((l) => l.liuqin)).toEqual(
      chart.lines.map((l) => l.liuqin),
    );
    expect(e2.yongShenYao).toBe(chart.yongShenYao);
  });
});

describe("pickLiuqinYao", () => {
  it("无现返回 undefined", () => {
    const rows = assignLiuqin([1, 1, 1, 1, 1, 1]);
    // 乾有全部六亲类型，用假类型测 pick 空
    expect(pickLiuqinYao(rows.filter((r) => r.yao === 5), "妻财")).toBe(
      undefined,
    );
  });
});
