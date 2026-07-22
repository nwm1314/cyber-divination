import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonBody, DEFAULT_MAX_BODY_BYTES } from "./parse-body";
import {
  deleteConfirmSchema,
  loginBodySchema,
  cloudChartUpsertSchema,
} from "@/lib/contracts";

function makeRequest(body: unknown, init?: RequestInit): Request {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw,
    ...init,
  });
}

describe("parseJsonBody", () => {
  it("解析合法 JSON + schema", async () => {
    const req = makeRequest({ email: "a@b.com", displayName: "测" });
    const r = await parseJsonBody(req, loginBodySchema);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.email).toBe("a@b.com");
      expect(r.data.displayName).toBe("测");
    }
  });

  it("无效 JSON → 400", async () => {
    const req = makeRequest("{not-json");
    const r = await parseJsonBody(req, z.object({ a: z.string() }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.message).toMatch(/JSON/);
    }
  });

  it("schema 失败 → 400", async () => {
    const req = makeRequest({ email: "not-an-email" });
    const r = await parseJsonBody(req, loginBodySchema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
    }
  });

  it("超大 body → 413", async () => {
    const big = "x".repeat(DEFAULT_MAX_BODY_BYTES + 10);
    const req = makeRequest(`{"a":"${big}"}`);
    const r = await parseJsonBody(req, z.object({ a: z.string() }), 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(413);
      expect(r.message).toMatch(/过大/);
    }
  });

  it("delete confirm 必须为 DELETE", async () => {
    const bad = await parseJsonBody(
      makeRequest({ confirm: "delete" }),
      deleteConfirmSchema,
    );
    expect(bad.ok).toBe(false);

    const missing = await parseJsonBody(makeRequest({}), deleteConfirmSchema);
    expect(missing.ok).toBe(false);

    const good = await parseJsonBody(
      makeRequest({ confirm: "DELETE" }),
      deleteConfirmSchema,
    );
    expect(good.ok).toBe(true);
  });

  it("charts upsert 校验 profileId 一致", async () => {
    const body = {
      profile: {
        id: "p1",
        name: "张三",
        gender: "male",
        analysisBaseDate: "2026-01-01",
        useTrueSolarTime: false,
      },
      chart: {
        profileId: "p2",
        pillars: {
          year: { stem: "甲", branch: "子" },
          month: { stem: "乙", branch: "丑" },
          day: { stem: "丙", branch: "寅" },
        },
        dayMaster: "丙",
        wuxingScores: { wood: 1, fire: 1, earth: 1, metal: 1, water: 1 },
        dayun: [],
        liunian: [],
      },
    };
    const r = await parseJsonBody(makeRequest(body), cloudChartUpsertSchema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/不一致|profileId/);
    }
  });
});
