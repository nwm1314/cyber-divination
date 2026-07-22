import { describe, expect, it } from "vitest";
import { castLiuyao } from "../cast";
import { enrichChart, analyzeLiuyao } from "./index";
import {
  resolveYongShenKind,
  resolveYongShenDetail,
  YONGSHEN_RULES,
} from "./yongshen";
import { resolveYongShenStatus } from "./yongshen-status";

describe("T171 用神规则扩展", () => {
  it("规则表含 lawsuit/travel 等扩展 id", () => {
    const ids = YONGSHEN_RULES.map((r) => r.id);
    expect(ids).toContain("lawsuit");
    expect(ids).toContain("travel");
    expect(ids).toContain("marriage");
  });

  it("婚恋默认妻财；女命/gender=female → 官鬼", () => {
    expect(resolveYongShenKind("感情是否复合").kind).toBe("妻财");
    expect(resolveYongShenKind("感情是否复合", "female").kind).toBe("官鬼");
    expect(resolveYongShenKind("感情是否复合", "male").kind).toBe("妻财");
    expect(resolveYongShenKind("女命问感情对象").kind).toBe("官鬼");
  });

  it("诉讼/出行关键词", () => {
    expect(resolveYongShenKind("官司纠纷如何").kind).toBe("官鬼");
    expect(resolveYongShenKind("这次出差是否顺利").kind).toBe("父母");
  });
});

describe("T171 用神状态静动化", () => {
  it("静卦用神为静", () => {
    const chart = enrichChart(
      castLiuyao({
        question: "求财是否顺利",
        method: "manual",
        lines: [7, 7, 7, 7, 7, 7],
        id: "ys-static",
      }),
    );
    expect(chart.yongShenStatus).toBe("静");
    const st = resolveYongShenStatus(chart, chart.yongShenYao);
    expect(st.status).toBe("静");
    expect(st.summary).toMatch(/静爻|稳步/);
  });

  it("用神爻发动且有变卦 → 化", () => {
    // 乾为天 初爻动：老阳 9
    const chart = enrichChart(
      castLiuyao({
        question: "求财是否顺利",
        method: "manual",
        lines: [9, 7, 7, 7, 7, 7],
        id: "ys-hua",
      }),
    );
    expect(chart.bianGua).toBeDefined();
    const a = analyzeLiuyao(chart);
    // 若用神落在动爻则化，否则可能静
    const st = resolveYongShenStatus(chart, a.yongShenYao);
    expect(["静", "动", "化"]).toContain(st.status);
    if (chart.lines.find((l) => l.yao === a.yongShenYao)?.changing) {
      expect(st.status).toBe("化");
      expect(st.summary).toMatch(/变卦|分步/);
    }
  });

  it("analyzeLiuyao 含 yongShenStatus 字段", () => {
    const chart = castLiuyao({
      question: "工作晋升",
      method: "manual",
      lines: [8, 7, 7, 7, 7, 7],
      id: "ys-analyze",
    });
    const a = analyzeLiuyao(chart);
    expect(a.yongShenStatus).toMatch(/静|动|化/);
    expect(a.yongShenStatusSummary.length).toBeGreaterThan(4);
  });

  it("resolveYongShenDetail 接受 gender", () => {
    const chart = castLiuyao({
      question: "感情复合",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      id: "ys-g",
    });
    const binary = chart.lines.map((l) => (l.value === 7 || l.value === 9 ? 1 : 0));
    const female = resolveYongShenDetail("感情复合", {
      binary: binary.join("") as never,
      shiYao: chart.shiYao as 1 | 2 | 3 | 4 | 5 | 6,
      gender: "female",
    });
    expect(female.yongShen).toBe("官鬼");
  });
});
