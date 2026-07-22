import { describe, expect, it } from "vitest";
import { ENGINE_VERSION, SKILL_REF } from "@/lib/bazi";
import { DISCLAIMER } from "@/lib/reading";

describe("工程基线占位", () => {
  it("引擎 meta 常量可用", () => {
    expect(ENGINE_VERSION).toBeTruthy();
    expect(SKILL_REF).toBe("bazi-skill");
  });

  it("免责文案存在", () => {
    expect(DISCLAIMER.length).toBeGreaterThan(0);
  });
});
