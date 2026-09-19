/**
 * 服务端权威重算测试（GAP-1 · 波次 1）
 *
 * 攻击模型：客户端提交**伪造的派生字段**（日主、四柱、五行分、大运、
 * engineVersion），试图污染保存的命盘、后续解读与分享快照。
 *
 * 断言：POST /api/charts 一律丢弃提交的派生字段，用服务端
 * computeAuthoritativeChart(profile) 重算；profile.userId 强制取 session。
 *
 * 这条防线是本轮 4 项 P0 之一的运行时保障，此前只有静态核对。
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { BirthProfile } from "@/lib/types";
import { computeAuthoritativeChart } from "@/lib/bazi";
import { resetCloudStoreForTests, getCloudChart } from "@/lib/storage/cloud-store";
import { findOrCreateUserByEmail, resetUserStoreForTests } from "@/lib/auth/users";
import { getMemoryRateLimiter, setRateLimiterForTests } from "@/lib/api/rate-limit";
import { createTestUser, makeRequest } from "@/test/api-helpers";

import * as chartsRoute from "@/app/api/charts/route";

const PROFILE: BirthProfile = {
  id: "p-auth",
  name: "权威",
  gender: "male",
  solarDate: "1990-01-01",
  birthTime: "12:00",
  alive: true,
  analysisBaseDate: "2026-07-20",
  useTrueSolarTime: false,
};

/** 全字段伪造的派生 chart */
function forgedChart() {
  return {
    profileId: "p-auth",
    pillars: {
      year: { stem: "伪", branch: "造" },
      month: { stem: "伪", branch: "造" },
      day: { stem: "伪", branch: "造" },
      hour: { stem: "伪", branch: "造" },
    },
    dayMaster: "伪日主",
    tenGods: { 伪造: 999 },
    hiddenStems: {},
    wuxingScores: { wood: 999, fire: 999, earth: 999, metal: 999, water: 999 },
    relations: {
      stemHe: [],
      branchChong: [],
      branchLiuhe: [],
      branchSanhe: [],
      branchSanhui: [],
      branchXing: [],
      branchHai: [],
    },
    dayun: [],
    currentDayunIndex: 99,
    liunian: [],
    flags: ["伪造标记"],
    meta: { engineVersion: "9.9.9-forged", skillRef: "forged" },
  };
}

let token: string;
let userId: string;

beforeEach(async () => {
  resetCloudStoreForTests();
  resetUserStoreForTests();
  setRateLimiterForTests(getMemoryRateLimiter());
  getMemoryRateLimiter().reset();

  const created = await createTestUser("authority@example.com", "权威");
  token = created.token;
  userId = created.user.id;
});

describe("POST /api/charts · 服务端权威重算", () => {
  it("伪造的 chart 派生字段被完全忽略并重算", async () => {
    const res = await chartsRoute.POST(
      makeRequest("/api/charts", {
        method: "POST",
        token,
        body: { profile: PROFILE, chart: forgedChart() },
      }),
    );
    expect(res.status).toBe(200);

    const stored = await getCloudChart(userId as never, "p-auth");
    expect(stored).not.toBeNull();

    const expected = computeAuthoritativeChart(PROFILE);
    expect(stored!.chart).toEqual(expected);

    // 逐项确认伪造值未落地
    expect(stored!.chart.dayMaster).not.toBe("伪日主");
    expect(stored!.chart.pillars.day.stem).not.toBe("伪");
    expect(stored!.chart.wuxingScores.wood).not.toBe(999);
    expect(stored!.chart.currentDayunIndex).not.toBe(99);
    expect(stored!.chart.meta.engineVersion).not.toBe("9.9.9-forged");
    expect(stored!.chart.flags).not.toContain("伪造标记");
  });

  it("伪造 profile.userId 被强制覆盖为 session userId", async () => {
    const res = await chartsRoute.POST(
      makeRequest("/api/charts", {
        method: "POST",
        token,
        body: {
          profile: { ...PROFILE, userId: "usr_victim_forged" },
          chart: forgedChart(),
        },
      }),
    );
    expect(res.status).toBe(200);

    const stored = await getCloudChart(userId as never, "p-auth");
    expect(stored!.userId).toBe(userId);
    expect(stored!.profile.userId).toBe(userId);
    expect(stored!.profile.userId).not.toBe("usr_victim_forged");
  });

  it("合同要求 chart 作为兼容载体；缺失时 400（派生结果仍不被信任）", async () => {
    // cloudChartUpsertSchema 要求 chart 存在（contracts/charts.ts:125），
    // 且 superRefine 要求 chart.profileId === profile.id。
    // 它的角色只是「兼容载体」——服务端随后完全丢弃其内容并重算。
    const res = await chartsRoute.POST(
      makeRequest("/api/charts", {
        method: "POST",
        token,
        body: { profile: PROFILE },
      }),
    );
    expect(res.status).toBe(400);
    expect(await getCloudChart(userId as never, "p-auth")).toBeNull();
  });

  it("chart.profileId 与 profile.id 不一致 → 400，不落库", async () => {
    const res = await chartsRoute.POST(
      makeRequest("/api/charts", {
        method: "POST",
        token,
        body: {
          profile: PROFILE,
          chart: { ...forgedChart(), profileId: "someone-else" },
        },
      }),
    );
    expect(res.status).toBe(400);
    expect(await getCloudChart(userId as never, "p-auth")).toBeNull();
  });

  it("无效出生信息 → 400，不落库", async () => {
    const res = await chartsRoute.POST(
      makeRequest("/api/charts", {
        method: "POST",
        token,
        body: {
          profile: { ...PROFILE, solarDate: "not-a-date" },
          chart: forgedChart(),
        },
      }),
    );
    expect(res.status).toBe(400);
    expect(await getCloudChart(userId as never, "p-auth")).toBeNull();
  });

  it("GET 列表只返回本人档案", async () => {
    await chartsRoute.POST(
      makeRequest("/api/charts", {
        method: "POST",
        token,
        body: { profile: PROFILE, chart: forgedChart() },
      }),
    );

    const other = await findOrCreateUserByEmail({ email: "bystander@example.com" });
    const otherToken = (await createTestUser("bystander@example.com")).token;

    const mine = await chartsRoute.GET(makeRequest("/api/charts", { token }));
    expect(mine.status).toBe(200);
    const mineBody = (await mine.json()) as { items: unknown[] };
    expect(mineBody.items).toHaveLength(1);

    const theirs = await chartsRoute.GET(
      makeRequest("/api/charts", { token: otherToken }),
    );
    const theirsBody = (await theirs.json()) as { items: unknown[] };
    expect(theirsBody.items).toHaveLength(0);
    expect(other.id).toBeTruthy();
  });

  it("未登录 → 401", async () => {
    const res = await chartsRoute.POST(
      makeRequest("/api/charts", { method: "POST", body: { profile: PROFILE } }),
    );
    expect(res.status).toBe(401);
  });

  it("跨站 Origin → 403", async () => {
    const res = await chartsRoute.POST(
      makeRequest("/api/charts", {
        method: "POST",
        token,
        origin: "https://evil.example",
        body: { profile: PROFILE },
      }),
    );
    expect(res.status).toBe(403);
  });
});
