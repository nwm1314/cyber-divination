import { describe, expect, it } from "vitest";
import type { BirthProfile } from "@/lib/types";
import { computeChart } from "@/lib/bazi";
import {
  stripAuthorityInput,
  validateAuthoritativeBaziRequest,
} from "./validate";

function profile(overrides?: Partial<BirthProfile>): BirthProfile {
  return {
    id: "authority-001",
    name: "测试",
    solarDate: "1990-05-15",
    birthTime: "10:30",
    gender: "male",
    birthPlace: { province: "北京", city: "北京", lng: 116.4, lat: 39.9 },
    alive: true,
    analysisBaseDate: "2026-07-20",
    useTrueSolarTime: false,
    ...overrides,
  };
}

describe("authoritative Bazi request validation", () => {
  it("recomputes from profile and ignores forged derived fields/gender", () => {
    const expected = computeChart(profile());
    const result = validateAuthoritativeBaziRequest({
      profile: profile(),
      gender: "female",
      viewMode: "pro",
      chart: {
        profileId: profile().id,
        dayMaster: "伪造",
        pillars: { day: { stem: "伪", branch: "造" } },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.source).toBe("profile");
      expect(result.data.viewMode).toBe("pro");
      expect(result.data.profile.gender).toBe("male");
      expect(result.data.chart).toEqual(expected);
      expect(result.data.chart.dayMaster).not.toBe("伪造");
    }
  });

  it("supports a newly computed local chart through embedded input", () => {
    const localChart = computeChart(profile());
    const result = validateAuthoritativeBaziRequest({
      chart: localChart,
      viewMode: "plain",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.source).toBe("embedded");
      expect(result.data.chart).toEqual(localChart);
    }
  });

  it("rejects legacy chart-only payloads without an authority input", () => {
    const legacy = stripAuthorityInput(computeChart(profile()));
    const result = validateAuthoritativeBaziRequest({ chart: legacy });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/legacy|模板/);
  });

  it("返回可读的中文错误信息（防乱码回归）", () => {
    // 回归守卫：曾出现 UTF-8 被按 GBK 解码的 mojibake，导致 API 错误提示为乱码。
    // 此处断言关键错误文案既非 ASCII 兜底、也不含替换字符或典型乱码码位。
    const legacy = stripAuthorityInput(computeChart(profile()));
    const result = validateAuthoritativeBaziRequest({ chart: legacy });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("legacy");
      expect(result.message).toMatch(/[\u4e00-\u9fff]/);
      expect(result.message).not.toContain("\uFFFD");
      // 常见 mojibake 码位（GBK 误读 UTF-8 的产物，如「鐩樸€嶃€岄杽」等）
      expect(result.message).not.toMatch(/[\u9400-\u9fff]/u);
    }
  });

  it("请求体非法时返回可读错误而非乱码", () => {
    const result = validateAuthoritativeBaziRequest({ nonsense: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain("\uFFFD");
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});
