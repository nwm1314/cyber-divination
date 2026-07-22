import { describe, expect, it } from "vitest";
import type { ReadingReport } from "@/lib/types";
import {
  computeCalibrationSummary,
  createEmptyCalibration,
  applyCalibrationToReport,
  sanitizeCalibrationForExternal,
  CALIBRATION_POLICY_NOTE,
} from "./calibrate";
import type { CalibrationData } from "./calibrate";

function mockReport(overrides?: Partial<ReadingReport>): ReadingReport {
  return {
    chartId: "test-001",
    mode: "template",
    viewMode: "plain",
    sections: [
      { key: "day_master", title: "日主", body: "日主分析" },
      { key: "dayun", title: "大运", body: "大运分析" },
      { key: "liunian", title: "流年", body: "流年分析" },
      { key: "advice", title: "建议", body: "建议正文" },
      { key: "wuxing", title: "五行", body: "五行正文" },
      { key: "pattern", title: "格局", body: "格局正文" },
    ],
    calibratePrompts: [
      { ageRange: "3-12岁", yearHint: "1993-2002", nature: "丁丑大运阶段的事业变动" },
      { ageRange: "13-22岁", yearHint: "2003-2012", nature: "戊寅大运阶段的学业进修" },
      { ageRange: "23-32岁", yearHint: "2013-2022", nature: "己卯大运阶段的家庭迁移" },
      { ageRange: "33-42岁", yearHint: "2023-2032", nature: "庚辰大运阶段的财务变化" },
      { ageRange: "约34岁", yearHint: "2024", nature: "甲辰流年相关的人际变化" },
    ],
    disclaimer: "仅供娱乐参考",
    ...overrides,
  };
}

describe("computeCalibrationSummary T291", () => {
  it("返回空 emphasisNote 当 answers 为空", () => {
    const report = mockReport();
    const calibration: CalibrationData = {
      chartId: "test-001",
      answers: [],
    };
    const result = computeCalibrationSummary(report, calibration);
    expect(result.emphasisNote).toBe("");
    expect(result.sectionTags).toEqual({});
    expect(result.policyNote.length).toBeGreaterThan(20); expect(result.policyNote).toMatch(/排盘|文案|外发|准确率/);
  });

  it("准确率 >= 60% 时生成阅读侧重文案（不宣称命盘更准）", () => {
    const report = mockReport();
    const calibration: CalibrationData = {
      chartId: "test-001",
      answers: [
        { promptIndex: 0, accuracy: "accurate" },
        { promptIndex: 1, accuracy: "accurate" },
        { promptIndex: 2, accuracy: "accurate" },
        { promptIndex: 3, accuracy: "partial" },
        { promptIndex: 4, accuracy: "accurate" },
      ],
    };
    const result = computeCalibrationSummary(report, calibration);
    expect(result.emphasisNote).toMatch(/阅读侧重|文案/);
    expect(result.emphasisNote).not.toMatch(/命盘.*吻合度较高.*置信/);
    expect(result.sectionTags.dayun).toBe("accurate");
    expect(result.sectionTags.liunian).toBe("accurate");
    // 不再用反馈抬高 wuxing 置信度标签
    expect(result.sectionTags.wuxing).toBeUndefined();
    expect(result.sectionTags.advice).toBe("accurate");
  });

  it("positiveRatio >= 60% 时生成适度侧重调整文案", () => {
    const report = mockReport();
    const calibration: CalibrationData = {
      chartId: "test-001",
      answers: [
        { promptIndex: 0, accuracy: "accurate" },
        { promptIndex: 1, accuracy: "partial" },
        { promptIndex: 2, accuracy: "partial" },
        { promptIndex: 3, accuracy: "inaccurate" },
        { promptIndex: 4, accuracy: "inaccurate" },
      ],
    };
    const result = computeCalibrationSummary(report, calibration);
    expect(result.emphasisNote).toContain("侧重");
    expect(result.sectionTags.dayun).toBe("partial");
    expect(result.sectionTags.liunian).toBe("inaccurate");
  });

  it("不准率 >= 60% 时不宣称下调引擎置信度", () => {
    const report = mockReport();
    const calibration: CalibrationData = {
      chartId: "test-001",
      answers: [
        { promptIndex: 0, accuracy: "inaccurate" },
        { promptIndex: 1, accuracy: "inaccurate" },
        { promptIndex: 2, accuracy: "inaccurate" },
        { promptIndex: 3, accuracy: "partial" },
        { promptIndex: 4, accuracy: "inaccurate" },
      ],
    };
    const result = computeCalibrationSummary(report, calibration);
    expect(result.emphasisNote).toMatch(/仅供参考|文案侧重/);
    expect(result.emphasisNote).not.toContain("置信度做了下调");
    expect(result.sectionTags.pattern).toBeUndefined();
    expect(result.sectionTags.wuxing).toBeUndefined();
    expect(result.sectionTags.dayun).toBe("inaccurate");
  });

  it("默认备注不进入外发摘要", () => {
    const report = mockReport();
    const calibration: CalibrationData = {
      chartId: "test-001",
      answers: [
        {
          promptIndex: 0,
          accuracy: "accurate",
          note: "敏感隐私备注",
        },
      ],
    };
    const result = computeCalibrationSummary(report, calibration);
    expect(result.emphasisNote).not.toContain("敏感隐私备注");
  });

  it("显式同意后备注可展示", () => {
    const report = mockReport();
    const calibration: CalibrationData = {
      chartId: "test-001",
      answers: [
        {
          promptIndex: 0,
          accuracy: "accurate",
          note: "可展示备注",
          shareNoteExternally: true,
        },
      ],
    };
    const result = computeCalibrationSummary(report, calibration);
    expect(result.emphasisNote).toContain("可展示备注");
  });

  it("按 prompt.source 映射章节", () => {
    const report = mockReport({
      calibratePrompts: [
        {
          ageRange: "3-12岁",
          yearHint: "1993-2002",
          nature: "阶段A",
          source: "liunian",
        },
        {
          ageRange: "约20岁",
          yearHint: "2010",
          nature: "阶段B",
          source: "dayun",
        },
      ],
    });
    const calibration: CalibrationData = {
      chartId: "test-001",
      answers: [
        { promptIndex: 0, accuracy: "accurate" },
        { promptIndex: 1, accuracy: "inaccurate" },
      ],
    };
    const result = computeCalibrationSummary(report, calibration);
    expect(result.sectionTags.liunian).toBe("accurate");
    expect(result.sectionTags.dayun).toBe("inaccurate");
  });

  it("policyNote 固定说明边界", () => {
    expect(CALIBRATION_POLICY_NOTE).toMatch(/不改变|不.*外发|文案/);
  });
});

describe("sanitizeCalibrationForExternal", () => {
  it("剥离未授权备注", () => {
    const cleaned = sanitizeCalibrationForExternal({
      chartId: "c1",
      answers: [
        { promptIndex: 0, accuracy: "accurate", note: "secret" },
        {
          promptIndex: 1,
          accuracy: "partial",
          note: "ok",
          shareNoteExternally: true,
        },
      ],
    });
    expect(cleaned.answers[0]!.note).toBeUndefined();
    expect(cleaned.answers[1]!.note).toBe("ok");
  });
});

describe("createEmptyCalibration", () => {
  it("创建空校准数据", () => {
    const result = createEmptyCalibration("test-001");
    expect(result.chartId).toBe("test-001");
    expect(result.answers).toEqual([]);
  });
});

describe("applyCalibrationToReport", () => {
  it("在 dayun/liunian 章节追加阅读侧重文案", () => {
    const report = mockReport();
    const summary = computeCalibrationSummary(report, {
      chartId: "test-001",
      answers: [
        { promptIndex: 0, accuracy: "accurate" },
        { promptIndex: 4, accuracy: "inaccurate" },
      ],
    });
    const next = applyCalibrationToReport(report, summary);
    const dayun = next.sections.find((s) => s.key === "dayun");
    const liunian = next.sections.find((s) => s.key === "liunian");
    expect(dayun?.body).toMatch(/阅读侧重|校准侧重/);
    expect(liunian?.body).toContain("吻合度偏低");
  });
});
