/**
 * IDOR 交叉账号越权测试（GAP-1 · 波次 1）
 *
 * 覆盖 4 个 `[id]` 动态路由：
 * - /api/charts/[id]        GET / DELETE
 * - /api/people/[id]        GET / PUT / DELETE
 * - /api/ziwei-charts/[id]  GET / DELETE
 * - /api/liuyao-charts/[id] GET / DELETE
 *
 * 攻击模型：攻击者 B 持有自己的合法会话，尝试用受害者 A 的资源 id 读/写/删。
 * 断言：一律 404，且文案不得区分「存在但无权」与「根本不存在」。
 *
 * 这是一份**攻击测试**，即修复 P0-越权 后必须存在的运行时防线。
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { BirthProfile } from "@/lib/types";
import { computeAuthoritativeChart } from "@/lib/bazi";
import { resetCloudStoreForTests, upsertCloudChart } from "@/lib/storage/cloud-store";
import { resetCloudZiweiStoreForTests, upsertCloudZiwei } from "@/lib/storage/cloud-ziwei-store";
import {
  resetCloudPeopleStoreForTests,
  upsertCloudPerson,
} from "@/lib/storage/cloud-person-store";
import {
  resetCloudLiuyaoStoreForTests,
  upsertCloudLiuyao,
} from "@/lib/storage/cloud-liuyao-store";
import { resetUserStoreForTests } from "@/lib/auth/users";
import { getMemoryRateLimiter, setRateLimiterForTests } from "@/lib/api/rate-limit";
import {
  createTestUser,
  expectOpaqueNotFound,
  makeRequest,
  routeContext,
} from "@/test/api-helpers";
import type { ZiweiChart } from "@/lib/types/ziwei";
import type { LiuyaoChart } from "@/lib/types/liuyao";

import * as chartsId from "@/app/api/charts/[id]/route";
import * as peopleId from "@/app/api/people/[id]/route";
import * as ziweiId from "@/app/api/ziwei-charts/[id]/route";
import * as liuyaoId from "@/app/api/liuyao-charts/[id]/route";

const VICTIM_EMAIL = "victim@example.com";
const ATTACKER_EMAIL = "attacker@example.com";

const PROFILE: BirthProfile = {
  id: "p-victim",
  name: "受害者",
  gender: "male",
  solarDate: "1990-01-01",
  birthTime: "12:00",
  alive: true,
  analysisBaseDate: "2026-07-20",
  useTrueSolarTime: false,
};

let victimToken: string;
let attackerToken: string;

function mockZiweiChart(id: string): ZiweiChart {
  return {
    id,
    mingGong: "子",
    shenGong: "丑",
    palaces: Array.from({ length: 12 }, (_, i) => ({
      branch: "子",
      index: i,
      name: `宫${i}`,
    })) as unknown as ZiweiChart["palaces"],
    majorStars: {},
    daxian: [],
    meta: { engineVersion: "1.0.0", school: "sanhe" },
  } as unknown as ZiweiChart;
}

function mockLiuyaoChart(id: string): LiuyaoChart {
  return {
    id,
    question: "测试问卦",
    method: "coins",
    lines: Array.from({ length: 6 }, (_, i) => ({
      yao: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6,
      value: 7 as const,
    })) as unknown as LiuyaoChart["lines"],
    benGua: { name: "乾", upper: "乾", lower: "乾" },
    shiYao: 1,
    yingYao: 4,
    meta: { engineVersion: "1.0.0" },
  } as unknown as LiuyaoChart;
}

beforeEach(async () => {
  resetCloudStoreForTests();
  resetCloudZiweiStoreForTests();
  resetCloudPeopleStoreForTests();
  resetCloudLiuyaoStoreForTests();
  resetUserStoreForTests();
  // 每个用例独立限流桶，避免 crud 桶 120/60s 被前序用例耗尽导致假 429
  setRateLimiterForTests(getMemoryRateLimiter());
  getMemoryRateLimiter().reset();

  victimToken = (await createTestUser(VICTIM_EMAIL, "受害者")).token;
  attackerToken = (await createTestUser(ATTACKER_EMAIL, "攻击者")).token;

  // 受害者 A 写入四类资源
  const { user } = await createTestUser(VICTIM_EMAIL, "受害者");
  await upsertCloudChart(user.id, {
    profile: PROFILE,
    chart: computeAuthoritativeChart(PROFILE),
  });
  await upsertCloudZiwei(user.id, {
    chart: mockZiweiChart("z-victim"),
  } as never);
  await upsertCloudPerson(user.id, {
    id: "person-victim",
    name: "受害者人物",
  } as never);
  await upsertCloudLiuyao(user.id, {
    chart: mockLiuyaoChart("l-victim"),
  } as never);
});

describe("IDOR · /api/charts/[id]", () => {
  it("B 读 A 的档案 → 404 且不泄露存在性", async () => {
    const res = await chartsId.GET(
      makeRequest("/api/charts/p-victim", { token: attackerToken }),
      routeContext("p-victim"),
    );
    await expectOpaqueNotFound(res);
  });

  it("B 删 A 的档案 → 404，且 A 的数据仍在", async () => {
    const res = await chartsId.DELETE(
      makeRequest("/api/charts/p-victim", {
        method: "DELETE",
        token: attackerToken,
      }),
      routeContext("p-victim"),
    );
    await expectOpaqueNotFound(res);

    // 关键：越权删除必须没有实际生效
    const { user } = await createTestUser(VICTIM_EMAIL);
    const still = await chartsId.GET(
      makeRequest("/api/charts/p-victim", { token: victimToken }),
      routeContext("p-victim"),
    );
    expect(still.status).toBe(200);
    expect(user.id).toBeTruthy();
  });

  it("A 自己读自己的档案 → 200", async () => {
    const res = await chartsId.GET(
      makeRequest("/api/charts/p-victim", { token: victimToken }),
      routeContext("p-victim"),
    );
    expect(res.status).toBe(200);
  });

  it("未登录 → 401", async () => {
    const res = await chartsId.GET(
      makeRequest("/api/charts/p-victim"),
      routeContext("p-victim"),
    );
    expect(res.status).toBe(401);
  });
});

describe("IDOR · /api/people/[id]", () => {
  it("B 读 A 的人物 → 404 且不泄露存在性", async () => {
    const res = await peopleId.GET(
      makeRequest("/api/people/person-victim", { token: attackerToken }),
      routeContext("person-victim"),
    );
    await expectOpaqueNotFound(res);
  });

  it("B 改 A 的人物 → 404，A 的数据未被改写", async () => {
    const res = await peopleId.PUT(
      makeRequest("/api/people/person-victim", {
        method: "PUT",
        token: attackerToken,
        body: { name: "被篡改的名字" },
      }),
      routeContext("person-victim"),
    );
    await expectOpaqueNotFound(res);

    const check = await peopleId.GET(
      makeRequest("/api/people/person-victim", { token: victimToken }),
      routeContext("person-victim"),
    );
    expect(check.status).toBe(200);
    const body = (await check.json()) as { person: { name: string } };
    expect(body.person.name).toBe("受害者人物");
  });

  it("B 删 A 的人物 → 404，A 的数据仍在", async () => {
    const res = await peopleId.DELETE(
      makeRequest("/api/people/person-victim", {
        method: "DELETE",
        token: attackerToken,
      }),
      routeContext("person-victim"),
    );
    await expectOpaqueNotFound(res);

    const check = await peopleId.GET(
      makeRequest("/api/people/person-victim", { token: victimToken }),
      routeContext("person-victim"),
    );
    expect(check.status).toBe(200);
  });

  it("未登录写 → 401", async () => {
    const res = await peopleId.PUT(
      makeRequest("/api/people/person-victim", {
        method: "PUT",
        body: { name: "x" },
      }),
      routeContext("person-victim"),
    );
    expect(res.status).toBe(401);
  });

  it("跨站 Origin 写 → 403（带合法会话）", async () => {
    const res = await peopleId.PUT(
      makeRequest("/api/people/person-victim", {
        method: "PUT",
        token: victimToken,
        origin: "https://evil.example",
        body: { name: "x" },
      }),
      routeContext("person-victim"),
    );
    expect(res.status).toBe(403);
  });
});

describe("IDOR · /api/ziwei-charts/[id]", () => {
  it("B 读/删 A 的紫微盘 → 404", async () => {
    const read = await ziweiId.GET(
      makeRequest("/api/ziwei-charts/z-victim", { token: attackerToken }),
      routeContext("z-victim"),
    );
    await expectOpaqueNotFound(read);

    const del = await ziweiId.DELETE(
      makeRequest("/api/ziwei-charts/z-victim", {
        method: "DELETE",
        token: attackerToken,
      }),
      routeContext("z-victim"),
    );
    await expectOpaqueNotFound(del);

    // A 仍可读
    const still = await ziweiId.GET(
      makeRequest("/api/ziwei-charts/z-victim", { token: victimToken }),
      routeContext("z-victim"),
    );
    expect(still.status).toBe(200);
  });

  it("未登录 → 401", async () => {
    const res = await ziweiId.GET(
      makeRequest("/api/ziwei-charts/z-victim"),
      routeContext("z-victim"),
    );
    expect(res.status).toBe(401);
  });
});

describe("IDOR · /api/liuyao-charts/[id]", () => {
  it("B 读/删 A 的问卦 → 404", async () => {
    const read = await liuyaoId.GET(
      makeRequest("/api/liuyao-charts/l-victim", { token: attackerToken }),
      routeContext("l-victim"),
    );
    await expectOpaqueNotFound(read);

    const del = await liuyaoId.DELETE(
      makeRequest("/api/liuyao-charts/l-victim", {
        method: "DELETE",
        token: attackerToken,
      }),
      routeContext("l-victim"),
    );
    await expectOpaqueNotFound(del);

    const still = await liuyaoId.GET(
      makeRequest("/api/liuyao-charts/l-victim", { token: victimToken }),
      routeContext("l-victim"),
    );
    expect(still.status).toBe(200);
  });

  it("未登录 → 401", async () => {
    const res = await liuyaoId.GET(
      makeRequest("/api/liuyao-charts/l-victim"),
      routeContext("l-victim"),
    );
    expect(res.status).toBe(401);
  });
});

describe("IDOR · 伪造会话 token", () => {
  it("篡改签名的 token 一律视为未登录（401）", async () => {
    const forged = `${attackerToken.split(".")[0]}.AAAAforgedsignatureAAAA`;
    const res = await chartsId.GET(
      makeRequest("/api/charts/p-victim", { token: forged }),
      routeContext("p-victim"),
    );
    expect(res.status).toBe(401);
  });

  it("anon_ 会话 token 被拒（401）", async () => {
    const res = await chartsId.GET(
      makeRequest("/api/charts/p-victim", { token: "anon_forged.value" }),
      routeContext("p-victim"),
    );
    expect(res.status).toBe(401);
  });
});
