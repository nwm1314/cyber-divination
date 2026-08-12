import { describe, expect, it } from "vitest";
import {
  emailSchema,
  loginBodySchema,
  magicLinkBodySchema,
  deleteConfirmSchema,
  baziChartMinSchema,
  cloudChartUpsertSchema,
  personInputSchema,
  assertChartProfileConsistency,
} from "./index";

describe("contracts/auth", () => {
  it("email 规范化小写", () => {
    const r = emailSchema.safeParse("  Foo@Bar.COM ");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("foo@bar.com");
  });

  it("login body 拒绝坏邮箱", () => {
    expect(loginBodySchema.safeParse({ email: "x" }).success).toBe(false);
  });

  it("magic-link callbackUrl 防 open redirect", () => {
    const r = magicLinkBodySchema.safeParse({
      email: "a@b.com",
      callbackUrl: "https://evil.com",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.callbackUrl).toBe("/");
  });

  it("delete confirm 伪造失败", () => {
    expect(deleteConfirmSchema.safeParse({ confirm: "yes" }).success).toBe(
      false,
    );
    expect(deleteConfirmSchema.safeParse({ confirm: "DELETE" }).success).toBe(
      true,
    );
  });
});

describe("contracts/charts", () => {
  const minChart = {
    profileId: "p1",
    pillars: {
      year: { stem: "甲", branch: "子" },
      month: { stem: "乙", branch: "丑" },
      day: { stem: "丙", branch: "寅" },
    },
    dayMaster: "丙",
    wuxingScores: { wood: 1 },
    dayun: [],
    liunian: [],
  };

  it("bazi 最小 schema", () => {
    expect(baziChartMinSchema.safeParse(minChart).success).toBe(true);
    expect(baziChartMinSchema.safeParse({}).success).toBe(false);
  });

  it("upsert 要求 id 一致", () => {
    const r = cloudChartUpsertSchema.safeParse({
      profile: {
        id: "p1",
        name: "A",
        gender: "male",
        solarDate: "1990-01-01",
        alive: true,
        analysisBaseDate: "2026-01-01",
        useTrueSolarTime: false,
      },
      chart: { ...minChart, profileId: "p2" },
    });
    expect(r.success).toBe(false);
  });

  it("assertChartProfileConsistency", () => {
    expect(
      assertChartProfileConsistency({
        profile: { id: "a" },
        chart: { profileId: "a" },
      }),
    ).toBeNull();
    expect(
      assertChartProfileConsistency({
        profile: { id: "a" },
        chart: { profileId: "b" },
      }),
    ).toMatch(/不一致/);
  });

  it("person 需要 name", () => {
    expect(personInputSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(personInputSchema.safeParse({ name: "李四" }).success).toBe(true);
  });
});
