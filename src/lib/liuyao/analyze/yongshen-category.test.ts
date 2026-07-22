import { describe, expect, it } from "vitest";
import { castLiuyao } from "../cast";
import {
  CATEGORY_YONGSHEN,
  inferQuestionCategory,
  resolveYongShenDetail,
  resolveYongShenKind,
} from "./yongshen";

describe("T281 问事类别与用神确认", () => {
  it("inferQuestionCategory 映射关键词", () => {
    expect(inferQuestionCategory("今年求财运如何")).toBe("wealth");
    expect(inferQuestionCategory("工作升迁")).toBe("career");
    expect(inferQuestionCategory("感情复合")).toBe("marriage");
  });

  it("questionCategory 优先于关键词", () => {
    const r = resolveYongShenKind("感情如何", undefined, {
      questionCategory: "wealth",
    });
    expect(r.kind).toBe("妻财");
    expect(r.ruleId).toBe("category-wealth");
    expect(r.category).toBe("wealth");
  });

  it("yongShenConfirm 最高优先级", () => {
    const r = resolveYongShenKind("求财", undefined, {
      questionCategory: "wealth",
      yongShenConfirm: "官鬼",
    });
    expect(r.kind).toBe("官鬼");
    expect(r.fromConfirm).toBe(true);
    expect(r.ruleId).toBe("confirm");
  });

  it("类别表覆盖主要事类", () => {
    expect(CATEGORY_YONGSHEN.career).toBe("官鬼");
    expect(CATEGORY_YONGSHEN.self).toBe("世");
    expect(CATEGORY_YONGSHEN.offspring).toBe("子孙");
  });

  it("cast 传入 questionCategory 写入盘", () => {
    const chart = castLiuyao({
      question: "随便问问",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      questionCategory: "career",
      id: "t281-cat",
    });
    expect(chart.questionCategory).toBe("career");
    expect(chart.yongShen).toBe("官鬼");
  });

  it("yongShenConfirm 写入盘", () => {
    const chart = castLiuyao({
      question: "随便问问",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      yongShenConfirm: "兄弟",
      id: "t281-confirm",
    });
    expect(chart.yongShenConfirm).toBe("兄弟");
    expect(chart.yongShen).toBe("兄弟");
  });

  it("婚恋类别 + female 取官鬼", () => {
    const r = resolveYongShenDetail("感情", {
      binary: [1, 1, 1, 1, 1, 1],
      shiYao: 6,
      questionCategory: "marriage",
      gender: "female",
    });
    expect(r.yongShen).toBe("官鬼");
    expect(r.category).toBe("marriage");
  });
});
