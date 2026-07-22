import { describe, expect, it } from "vitest";
import {
  TIAOHOU_TABLE_COVERED,
  TIAOHOU_TABLE_TOTAL,
  tiaohouCoverage,
  tiaohouHint,
} from "./constants";
import { renderTemplateReading } from "./render";
import { mockChart } from "./render.test";

/** 与穷通宝典 skill 摘要对齐的抽样（classical-texts.md 口诀） */
const QIONGTONG_SAMPLES: {
  day: string;
  month: string;
  mustInclude: RegExp;
  note: string;
}[] = [
  {
    day: "甲",
    month: "寅",
    mustInclude: /丙|癸|余寒|暖/,
    note: "甲木正月：先丙后癸",
  },
  {
    day: "甲",
    month: "酉",
    mustInclude: /丁火|制金/,
    note: "甲木八月：先丁制金",
  },
  {
    day: "庚",
    month: "子",
    mustInclude: /丙火|解冻|丁|寒/,
    note: "庚金十一月：丙火解冻",
  },
  {
    day: "丙",
    month: "午",
    mustInclude: /壬|水|调候/,
    note: "夏生火旺须水",
  },
  {
    day: "壬",
    month: "午",
    mustInclude: /金|水|燥/,
    note: "壬水午月火土燥",
  },
  {
    day: "戊",
    month: "子",
    mustInclude: /丙|暖|寒/,
    note: "冬土须火暖",
  },
];

describe("T92 调候表扩展", () => {
  it("覆盖 ≥60 组且说明 120 全集", () => {
    const c = tiaohouCoverage();
    expect(TIAOHOU_TABLE_TOTAL).toBe(120);
    expect(TIAOHOU_TABLE_COVERED).toBeGreaterThanOrEqual(60);
    expect(c.covered).toBe(TIAOHOU_TABLE_COVERED);
    expect(c.covered).toBe(120);
    expect(c.note).toMatch(/120/);
  });

  it("10 干 × 12 支均有具体细则（非仅季节兜底）", () => {
    const stems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
    const branches = [
      "寅",
      "卯",
      "辰",
      "巳",
      "午",
      "未",
      "申",
      "酉",
      "戌",
      "亥",
      "子",
      "丑",
    ];
    for (const d of stems) {
      for (const b of branches) {
        const line = tiaohouHint(d, b);
        expect(line).toContain(`日主${d}`);
        expect(line).toMatch(/月/);
        // 满表条目应带出具体用神倾向，不应只剩笼统「当令」兜底
        expect(line.length).toBeGreaterThan(20);
      }
    }
  });

  it("抽样与穷通原则一致", () => {
    for (const s of QIONGTONG_SAMPLES) {
      const line = tiaohouHint(s.day, s.month);
      expect(line, s.note).toMatch(s.mustInclude);
    }
  });

  it("模板 plain/pro 正文均强制引用一行调候", () => {
    const plain = renderTemplateReading(mockChart, { viewMode: "plain" });
    const pro = renderTemplateReading(mockChart, { viewMode: "pro" });
    const dmPlain = plain.sections.find((s) => s.key === "day_master")?.body ?? "";
    const wxPlain = plain.sections.find((s) => s.key === "wuxing")?.body ?? "";
    const dmPro = pro.sections.find((s) => s.key === "day_master")?.body ?? "";
    const wxPro = pro.sections.find((s) => s.key === "wuxing")?.body ?? "";

    // mock 日主戊、月支寅
    for (const body of [dmPlain, wxPlain, dmPro, wxPro]) {
      expect(body).toMatch(/调候|丙|暖|穷通|余寒/);
      expect(body).toContain("戊");
    }
  });
});
