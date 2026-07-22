import { describe, expect, it } from "vitest";
import { buildShareCardSvg } from "./exportShareImage";

describe("buildShareCardSvg", () => {
  it("输出合法 SVG 与尺寸", () => {
    const { svg, width, height } = buildShareCardSvg({
      chartName: "张*",
      dayMaster: "甲",
      advice: "稳中求进，厚积薄发",
      pillars: {
        year: { stem: "庚", branch: "午" },
        month: { stem: "壬", branch: "子" },
        day: { stem: "甲", branch: "辰" },
        hour: null,
      },
    });

    expect(width).toBe(720);
    expect(height).toBeGreaterThan(400);
    expect(svg).toContain("<svg");
    expect(svg).toContain("张*");
    expect(svg).toContain("甲");
    expect(svg).toContain("稳中求进");
    expect(svg).toContain("赛博八字");
    expect(svg).not.toContain("foreignObject");
  });

  it("转义特殊字符", () => {
    const { svg } = buildShareCardSvg({
      chartName: 'A&B<C>"',
      dayMaster: "乙",
      advice: "测试&符号",
      pillars: {
        year: { stem: "甲", branch: "子" },
        month: { stem: "乙", branch: "丑" },
        day: { stem: "丙", branch: "寅" },
        hour: { stem: "丁", branch: "卯" },
      },
    });
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&lt;");
    expect(svg).not.toMatch(/chartName.*[<>]/);
  });
});
