/**
 * 乐观锁并发写冲突测试（B4）
 *
 * 故障模型：同一账号的两台设备都读到 version=N 的档案，各自修改后写回。
 * 改动前两条写都返回 200，后写者**静默覆盖**整行，双方都不知道丢了一次写。
 * 改动后：带 `expectedVersion` 的写在版本落后时返回 409 且不覆盖已存数据；
 *         不带该字段的写维持旧行为（兼容尚未回传版本的客户端）。
 *
 * 用 file 驱动（无需 DATABASE_URL）验证服务端契约与判定路径；
 * PG 驱动共用同一个 `assertVersionWritable` 判定，其 SQL 原子性
 * 需真实 Postgres 才能验证（本轮环境无 Postgres，见报告「未验证」）。
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { BirthProfile } from "@/lib/types";
import { computeAuthoritativeChart } from "@/lib/bazi";
import {
  getCloudPerson,
  resetCloudPeopleStoreForTests,
  upsertCloudPerson,
} from "@/lib/storage/cloud-person-store";
import {
  getCloudChart,
  resetCloudStoreForTests,
} from "@/lib/storage/cloud-store";
import { resetUserStoreForTests } from "@/lib/auth/users";
import {
  getMemoryRateLimiter,
  setRateLimiterForTests,
} from "@/lib/api/rate-limit";
import { createTestUser, makeRequest, routeContext } from "@/test/api-helpers";

import * as peopleListRoute from "@/app/api/people/route";
import * as peopleIdRoute from "@/app/api/people/[id]/route";
import * as chartsRoute from "@/app/api/charts/route";

const PROFILE: BirthProfile = {
  id: "p-version",
  name: "并发测试",
  gender: "male",
  solarDate: "1990-01-01",
  birthTime: "12:00",
  alive: true,
  analysisBaseDate: "2026-07-20",
  useTrueSolarTime: false,
};

let token: string;
let userId: string;

beforeEach(async () => {
  resetCloudPeopleStoreForTests();
  resetCloudStoreForTests();
  resetUserStoreForTests();
  setRateLimiterForTests(getMemoryRateLimiter());
  getMemoryRateLimiter().reset();
  const created = await createTestUser("version@example.com", "并发");
  token = created.token;
  userId = created.user.id;
});

async function jsonOf(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

function errorOf(body: Record<string, unknown>): { code?: string; message?: string } {
  return (body.error ?? {}) as { code?: string; message?: string };
}

describe("POST /api/people 乐观锁", () => {
  it("首写成功并落版本 1", async () => {
    const res = await peopleListRoute.POST(
      makeRequest("/api/people", {
        method: "POST",
        token,
        body: { id: "per_v", name: "设备A", expectedVersion: 0 },
      }),
    );
    expect(res.status).toBe(200);
    expect(((await jsonOf(res)).person as { version?: number }).version).toBe(1);
  });

  it("两台设备带同一版本写：一成一 409，过期写不覆盖已存内容", async () => {
    // 设备 A 先写：0 → 1
    const first = await peopleListRoute.POST(
      makeRequest("/api/people", {
        method: "POST",
        token,
        body: { id: "per_v", name: "设备A改", expectedVersion: 0 },
      }),
    );
    expect(first.status).toBe(200);

    // 设备 B 仍以为版本是 0
    const stale = await peopleListRoute.POST(
      makeRequest("/api/people", {
        method: "POST",
        token,
        body: { id: "per_v", name: "设备B改", expectedVersion: 0 },
      }),
    );
    expect(stale.status).toBe(409);
    const err = errorOf(await jsonOf(stale));
    expect(err.code).toBe("STORAGE_VERSION_CONFLICT");
    expect(err.message).toMatch(/并发冲突/);
    expect((await getCloudPerson(userId, "per_v"))?.name).toBe("设备A改");
  });

  it("读到新版本后可继续写，版本递增", async () => {
    await upsertCloudPerson(userId, { id: "per_v", name: "占位" });
    const v = (await getCloudPerson(userId, "per_v"))?.version ?? 0;

    const res = await peopleListRoute.POST(
      makeRequest("/api/people", {
        method: "POST",
        token,
        body: { id: "per_v", name: "设备C", expectedVersion: v },
      }),
    );
    expect(res.status).toBe(200);
    expect(
      ((await jsonOf(res)).person as { version: number }).version,
    ).toBe(v + 1);
  });

  it("不带 expectedVersion 的旧客户端仍放行（向后兼容）且版本自增", async () => {
    const res = await peopleListRoute.POST(
      makeRequest("/api/people", {
        method: "POST",
        token,
        body: { id: "per_legacy", name: "旧客户端" },
      }),
    );
    expect(res.status).toBe(200);
    expect(
      ((await jsonOf(res)).person as { version: number }).version,
    ).toBe(1);

    const again = await peopleListRoute.POST(
      makeRequest("/api/people", {
        method: "POST",
        token,
        body: { id: "per_legacy", name: "旧客户端再写" },
      }),
    );
    expect(again.status).toBe(200);
    expect(
      ((await jsonOf(again)).person as { version: number }).version,
    ).toBe(2);
  });

  it("expectedVersion 非整数 → 400", async () => {
    const res = await peopleListRoute.POST(
      makeRequest("/api/people", {
        method: "POST",
        token,
        body: { id: "per_bad", name: "坏版本", expectedVersion: 1.5 },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("客户端自带的 version 字段不被采信（由服务端计算）", async () => {
    const res = await peopleListRoute.POST(
      makeRequest("/api/people", {
        method: "POST",
        token,
        body: { id: "per_spoof", name: "伪造版本", version: 999 },
      }),
    );
    expect(res.status).toBe(200);
    expect(
      ((await jsonOf(res)).person as { version: number }).version,
    ).toBe(1);
  });
});

describe("PUT /api/people/[id] 乐观锁", () => {
  it("过期版本 → 409 且内容未被覆盖", async () => {
    await upsertCloudPerson(userId, { id: "per_put", name: "初值" });
    const stored = (await getCloudPerson(userId, "per_put"))?.version ?? 0;

    const stale = await peopleIdRoute.PUT(
      makeRequest("/api/people/per_put", {
        method: "PUT",
        token,
        body: { name: "过期写", expectedVersion: Math.max(stored - 1, -1) },
      }),
      routeContext("per_put"),
    );
    expect(stale.status).toBe(409);
    expect((await getCloudPerson(userId, "per_put"))?.name).toBe("初值");

    const fresh = await peopleIdRoute.PUT(
      makeRequest("/api/people/per_put", {
        method: "PUT",
        token,
        body: { name: "正确写", expectedVersion: stored },
      }),
      routeContext("per_put"),
    );
    expect(fresh.status).toBe(200);
    expect((await getCloudPerson(userId, "per_put"))?.name).toBe("正确写");
  });
});

describe("POST /api/charts 乐观锁", () => {
  const chartBody = (expectedVersion?: number) => ({
    profile: PROFILE,
    chart: computeAuthoritativeChart(PROFILE),
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
  });

  it("首写版本 1；过期重放 409；带新版本可继续", async () => {
    const first = await chartsRoute.POST(
      makeRequest("/api/charts", {
        method: "POST",
        token,
        body: chartBody(0),
      }),
    );
    expect(first.status).toBe(200);
    expect(
      ((await jsonOf(first)).record as { version: number }).version,
    ).toBe(1);

    const stale = await chartsRoute.POST(
      makeRequest("/api/charts", { method: "POST", token, body: chartBody(0) }),
    );
    expect(stale.status).toBe(409);
    expect(errorOf(await jsonOf(stale)).code).toBe("STORAGE_VERSION_CONFLICT");
    // 未覆盖：服务端存的仍是版本 1
    expect((await getCloudChart(userId, PROFILE.id))?.version).toBe(1);

    const again = await chartsRoute.POST(
      makeRequest("/api/charts", { method: "POST", token, body: chartBody(1) }),
    );
    expect(again.status).toBe(200);
    expect(
      ((await jsonOf(again)).record as { version: number }).version,
    ).toBe(2);
  });

  it("旧客户端不带版本时盲写仍成功（行为不变）", async () => {
    const res = await chartsRoute.POST(
      makeRequest("/api/charts", {
        method: "POST",
        token,
        body: chartBody(),
      }),
    );
    expect(res.status).toBe(200);
    expect(
      ((await jsonOf(res)).record as { version: number }).version,
    ).toBe(1);
  });
});
