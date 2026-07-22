import { describe, expect, it } from "vitest";
import { castLiuyao } from "../cast";
import {
  analyzeDongBian,
  dongBianSectionBody,
  wuxingRelation,
  staticDongBianHint,
  huitouOf,
} from "./dongbian";
import { enrichChart } from "./index";

describe("T161 动变生克", () => {
  it("五行关系表", () => {
    expect(wuxingRelation("木", "木")).toBe("比和");
    expect(wuxingRelation("木", "火")).toBe("动生化");
    expect(wuxingRelation("木", "土")).toBe("动克化");
    expect(wuxingRelation("火", "木")).toBe("化生动");
    expect(wuxingRelation("土", "木")).toBe("化克动");
  });

  it("回头生克标签", () => {
    expect(huitouOf("化生动")).toBe("回头生");
    expect(huitouOf("化克动")).toBe("回头克");
    expect(huitouOf("比和")).toBe("无");
  });

  it("静卦无动变项", () => {
    const chart = enrichChart(
      castLiuyao({
        question: "静卦",
        method: "manual",
        lines: [7, 7, 7, 7, 7, 7],
        id: "db-static",
      }),
    );
    expect(analyzeDongBian(chart)).toEqual([]);
    expect(dongBianSectionBody(chart)).toBe(staticDongBianHint());
  });

  it("有动爻时产出 relation 与中性 summary", () => {
    const chart = enrichChart(
      castLiuyao({
        question: "求合作",
        method: "manual",
        lines: [9, 7, 7, 7, 7, 7],
        id: "db-move",
      }),
    );
    const items = analyzeDongBian(chart);
    expect(items.length).toBeGreaterThanOrEqual(1);
    const first = items[0]!;
    expect(first.yao).toBe(1);
    expect(first.fromWuxing).toBeTruthy();
    expect(first.toWuxing).toBeTruthy();
    expect(first.summary).toMatch(/动|化/);
    expect(first.summary).not.toMatch(/必死|大凶|血光/);
  });

  it("多动爻按爻位升序", () => {
    const chart = enrichChart(
      castLiuyao({
        question: "多动",
        method: "manual",
        lines: [9, 7, 6, 7, 7, 9],
        id: "db-multi",
      }),
    );
    const items = analyzeDongBian(chart);
    expect(items.length).toBe(3);
    expect(items.map((i) => i.yao)).toEqual([1, 3, 6]);
  });

  it("section body 含生克与免责向表述", () => {
    const chart = enrichChart(
      castLiuyao({
        question: "求财",
        method: "manual",
        lines: [6, 8, 7, 7, 7, 7],
        id: "db-body",
      }),
    );
    const body = dongBianSectionBody(chart);
    expect(body).toMatch(/动变生克|动爻/);
    expect(body).toMatch(/不作吉凶恐吓|不替代/);
  });

  it("同输入确定性", () => {
    const mk = () =>
      enrichChart(
        castLiuyao({
          question: "确定",
          method: "manual",
          lines: [9, 8, 7, 6, 7, 8],
          id: "db-det",
        }),
      );
    expect(analyzeDongBian(mk())).toEqual(analyzeDongBian(mk()));
  });
});
