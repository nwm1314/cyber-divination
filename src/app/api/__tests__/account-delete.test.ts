/**
 * POST /api/account/delete 级联完整性测试（GAP-1 · 波次 1）
 *
 * 对应 P0「删除级联」的运行时防线：删号后**直查四个 store**断言无残留，
 * 而不是只信 route 返回的 ok:true。
 *
 * 四类云端数据（cloud-hooks.deleteCloudDataForUser 覆盖范围）：
 * bazi charts / ziwei charts / people / liuyao charts
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { BirthProfile } from "@/lib/types";
import { computeAuthoritativeChart } from "@/lib/bazi";
import { createSessionToken } from "@/lib/auth/session";
import { findOrCreateUserByEmail, getUserById, resetUserStoreForTests } from "@/lib/auth/users";
import { resetCloudStoreForTests, upsertCloudChart, getAllCloudChartsForUser } from "@/lib/storage/cloud-store";
import {
  resetCloudZiweiStoreForTests,
  upsertCloudZiwei,
  getAllCloudZiweiForUser,
} from "@/lib/storage/cloud-ziwei-store";
import {
  resetCloudPeopleStoreForTests,
  upsertCloudPerson,
  listCloudPeople,
} from "@/lib/storage/cloud-person-store";
import {
  resetCloudLiuyaoStoreForTests,
  upsertCloudLiuyao,
  getAllCloudLiuyaoForUser,
} from "@/lib/storage/cloud-liuyao-store";
import { getMemoryRateLimiter, setRateLimiterForTests } from "@/lib/api/rate-limit";
import { makeRequest } from "@/test/api-helpers";

import * as deleteRoute from "@/app/api/account/delete/route";

const PROFILE: BirthProfile = {
  id: "p-del",
  name: "待删",
  gender: "female",
  solarDate: "1992-03-03",
  birthTime: "08:00",
  alive: true,
  analysisBaseDate: "2026-07-20",
  useTrueSolarTime: false,
};

const KEEP_PROFILE: BirthProfile = { ...PROFILE, id: "p-keep", name: "保留" };

let userId: string;
let token: string;

async function seedAllFour(uid: string, suffix: string) {
  const profile = suffix === "keep" ? KEEP_PROFILE : PROFILE;
  await upsertCloudChart(uid, {
    profile,
    chart: computeAuthoritativeChart(profile),
  });
  await upsertCloudZiwei(uid, {
    chart: {
      id: `z-${suffix}`,
      mingGong: "子",
      shenGong: "丑",
      palaces: [],
      majorStars: {},
      daxian: [],
      meta: {},
    },
  } as never);
  await upsertCloudPerson(uid, {
    id: `person-${suffix}`,
    name: `人物-${suffix}`,
  } as never);
  await upsertCloudLiuyao(uid, {
    chart: { id: `l-${suffix}`, question: "问", lines: [] },
  } as never);
}

beforeEach(async () => {
  resetCloudStoreForTests();
  resetCloudZiweiStoreForTests();
  resetCloudPeopleStoreForTests();
  resetCloudLiuyaoStoreForTests();
  resetUserStoreForTests();
  setRateLimiterForTests(getMemoryRateLimiter());
  getMemoryRateLimiter().reset();

  const user = await findOrCreateUserByEmail({
    email: "cascade@example.com",
    displayName: "级联",
  });
  userId = user.id;
  // iat 为当前时间，满足 SESSION_REAUTH_MAX_AGE_SEC（15 分钟）近期认证要求
  token = createSessionToken(user);
  await seedAllFour(userId, "del");
});

describe("POST /api/account/delete · 级联完整性", () => {
  it("删号后四类云端数据全部无残留，且用户记录消失", async () => {
    // 前置：四类数据均存在
    expect(await getAllCloudChartsForUser(userId)).toHaveLength(1);
    expect(await getAllCloudZiweiForUser(userId)).toHaveLength(1);
    expect(await listCloudPeople(userId)).toHaveLength(1);
    expect(await getAllCloudLiuyaoForUser(userId)).toHaveLength(1);

    const res = await deleteRoute.POST(
      makeRequest("/api/account/delete", {
        method: "POST",
        token,
        body: { confirm: "DELETE" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      cloudDeleted: number;
    };
    expect(body.ok).toBe(true);
    // 4 类各 1 条
    expect(body.cloudDeleted).toBe(4);

    // 直查库：无残留
    expect(await getAllCloudChartsForUser(userId)).toEqual([]);
    expect(await getAllCloudZiweiForUser(userId)).toEqual([]);
    expect(await listCloudPeople(userId)).toEqual([]);
    expect(await getAllCloudLiuyaoForUser(userId)).toEqual([]);
    expect(await getUserById(userId as never)).toBeNull();
  });

  it("失败时不得伪成功：缺少 confirm 返回 400，数据仍在", async () => {
    const res = await deleteRoute.POST(
      makeRequest("/api/account/delete", {
        method: "POST",
        token,
        body: { confirm: "yes" },
      }),
    );
    expect(res.status).toBe(400);

    // 数据必须完全未受影响
    expect(await getAllCloudChartsForUser(userId)).toHaveLength(1);
    expect(await listCloudPeople(userId)).toHaveLength(1);
    expect(await getUserById(userId as never)).not.toBeNull();
  });

  it("未登录 → 401，数据不受影响", async () => {
    const res = await deleteRoute.POST(
      makeRequest("/api/account/delete", {
        method: "POST",
        body: { confirm: "DELETE" },
      }),
    );
    expect(res.status).toBe(401);
    expect(await getAllCloudChartsForUser(userId)).toHaveLength(1);
  });

  it("跨站 Origin → 403，数据不受影响", async () => {
    const res = await deleteRoute.POST(
      makeRequest("/api/account/delete", {
        method: "POST",
        token,
        origin: "https://evil.example",
        body: { confirm: "DELETE" },
      }),
    );
    expect(res.status).toBe(403);
    expect(await getAllCloudChartsForUser(userId)).toHaveLength(1);
  });

  it("陈旧会话（iat 超 15 分钟）→ 403 要求重新登录", async () => {
    const stale = createSessionToken(
      { id: userId, email: "cascade@example.com", displayName: "级联" },
      { now: Math.floor(Date.now() / 1000) - 16 * 60 },
    );
    const res = await deleteRoute.POST(
      makeRequest("/api/account/delete", {
        method: "POST",
        token: stale,
        body: { confirm: "DELETE" },
      }),
    );
    expect(res.status).toBe(403);
    expect(await getAllCloudChartsForUser(userId)).toHaveLength(1);
  });

  it("级联不影响其他用户的数据", async () => {
    const other = await findOrCreateUserByEmail({ email: "other@example.com" });
    await seedAllFour(other.id, "keep");

    const res = await deleteRoute.POST(
      makeRequest("/api/account/delete", {
        method: "POST",
        token,
        body: { confirm: "DELETE" },
      }),
    );
    expect(res.status).toBe(200);

    // 攻击面：删号必须严格按 userId 隔离
    expect(await getAllCloudChartsForUser(other.id)).toHaveLength(1);
    expect(await listCloudPeople(other.id)).toHaveLength(1);
    expect(await getAllCloudLiuyaoForUser(other.id)).toHaveLength(1);
    expect(await getUserById(other.id)).not.toBeNull();
  });
});
