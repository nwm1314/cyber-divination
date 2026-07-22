import { describe, expect, it } from "vitest";
import {
  isBranchKong,
  xunKongOfDay,
  xunShouOfDay,
  XUNKONG_BY_XUN_SHOU,
} from "./kongwang";
import {
  resolveCastTimeContext,
  resolveYingQi,
} from "./yingqi";
import { castLiuyao } from "../cast";

describe("旬空表（T180）", () => {
  it("六旬空亡完整", () => {
    expect(Object.keys(XUNKONG_BY_XUN_SHOU)).toHaveLength(6);
    expect(xunKongOfDay("甲子")).toEqual(["戌", "亥"]);
    expect(xunKongOfDay("乙丑")).toEqual(["戌", "亥"]);
    expect(xunKongOfDay("甲戌")).toEqual(["申", "酉"]);
    expect(xunKongOfDay("甲午")).toEqual(["辰", "巳"]);
    expect(xunKongOfDay("甲寅")).toEqual(["子", "丑"]);
  });

  it("xunShouOfDay", () => {
    expect(xunShouOfDay("甲子")).toBe("甲子");
    expect(xunShouOfDay("癸酉")).toBe("甲子");
    expect(xunShouOfDay("甲戌")).toBe("甲戌");
  });

  it("isBranchKong", () => {
    expect(isBranchKong("戌", ["戌", "亥"])).toBe(true);
    expect(isBranchKong("子", ["戌", "亥"])).toBe(false);
  });
});

describe("占时 + 应期入盘（T180）", () => {
  it("有 castAt 写入日辰月建旬空", () => {
    const chart = castLiuyao({
      question: "求财运如何",
      method: "manual",
      lines: [7, 8, 7, 8, 7, 8],
      castAt: "2024-06-15T10:00",
      id: "ly_t180_1",
    });
    expect(chart.meta.engineVersion).toBe("0.5.0");
    expect(chart.meta.castingSchool).toBe("najia-manual");
    expect(chart.castAt).toBe("2024-06-15T10:00");
    expect(chart.dayGanZhi).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
    expect(chart.yueJian).toMatch(/^[子丑寅卯辰巳午未申酉戌亥]$/);
    expect(chart.xunKong).toHaveLength(2);
    expect(chart.yingQiHint).toMatch(/日辰|旬空/);
    expect(typeof chart.yongShenKong).toBe("boolean");
  });

  it("无 castAt 仍给出缺省提示", () => {
    const chart = castLiuyao({
      question: "求财运如何",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      id: "ly_t180_2",
    });
    expect(chart.dayGanZhi).toBeUndefined();
    expect(chart.yingQiHint).toMatch(/未提供占时/);
  });

  it("resolveCastTimeContext 确定性", () => {
    const a = resolveCastTimeContext("2024-01-01T12:00");
    const b = resolveCastTimeContext("2024-01-01T12:00");
    expect(a).toEqual(b);
    expect(a.dayGanZhi.length).toBe(2);
  });

  it("resolveYingQi 用神空亡可测", () => {
    const ctx = resolveCastTimeContext("2024-06-15T10:00");
    const yq = resolveYingQi(
      {
        lines: [
          {
            yao: 1,
            value: 7,
            changing: false,
            branch: ctx.xunKong[0],
            liuqin: "妻财",
          },
          { yao: 2, value: 7, changing: false, branch: "子" },
          { yao: 3, value: 7, changing: false, branch: "丑" },
          { yao: 4, value: 7, changing: false, branch: "寅" },
          { yao: 5, value: 7, changing: false, branch: "卯" },
          { yao: 6, value: 7, changing: false, branch: "辰" },
        ],
        yongShenYao: 1,
        yongShen: "妻财",
        castAt: ctx.castAt,
      },
      ctx,
    );
    expect(yq.yongShenKong).toBe(true);
    expect(yq.yingQiHint).toMatch(/旬空|出空/);
    expect(yq.yingQiHint).not.toMatch(/必死|大凶|血光/);
  });
});
