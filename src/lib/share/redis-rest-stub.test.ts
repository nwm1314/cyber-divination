import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { Redis } from "@upstash/redis";
import type { ShareSnapshot } from "@/lib/types";
import { UpstashShareStore } from "./upstash-redis";

const STUB_PATH = fileURLToPath(
  new URL("../../../scripts/redis-rest-stub.mjs", import.meta.url),
);

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let stub: ChildProcess;
let stubUrl: string;

beforeAll(async () => {
  const port = await freePort();
  stubUrl = `http://127.0.0.1:${port}`;
  stub = spawn(process.execPath, [STUB_PATH], {
    env: { ...process.env, REDIS_STUB_PORT: String(port) },
    stdio: "ignore",
  });
  const probe = new Redis({ url: stubUrl, token: "stub-token" });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await probe.ping();
      return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error("redis-rest 桩未能启动");
});

afterAll(() => {
  stub?.kill();
});

// 非 ASCII 正文是重点：@upstash/redis 恒带 Upstash-Encoding: base64 头，
// 但 /pipeline 请求体里的参数是 plain UTF-8，桩若据此解码参数就会返回乱码。
function snapshot(token: string): ShareSnapshot {
  return {
    token,
    chartId: "chart-Stub1",
    chartName: "张三是 🎴",
    nameMasked: false,
    dayMaster: "甲",
    advice: "稳中求进，宜守不宜攻 🎴",
    disclaimer: "命理分析仅供参考。",
    createdAt: "2026-09-19T00:00:00.000Z",
  };
}

function store(ttlSeconds?: number) {
  return new UpstashShareStore(
    new Redis({ url: stubUrl, token: "stub-token" }),
    ttlSeconds,
  );
}

describe("redis-rest 桩支撑 UpstashShareStore 的真实线格式", () => {
  it("save 后 get 原样往返（含中文与 emoji）", async () => {
    const snap = snapshot("stub-roundtrip");
    await store(3600).save(snap);
    expect(await store().get("stub-roundtrip")).toEqual(snap);
  });

  it("不带 TTL 的 save 同样可取回", async () => {
    const snap = snapshot("stub-no-ttl");
    await store().save(snap);
    expect(await store().get("stub-no-ttl")).toEqual(snap);
  });

  it("未写入与已删除的 token 都返回 null", async () => {
    expect(await store().get("stub-missing")).toBeNull();
    const snap = snapshot("stub-delete");
    await store().save(snap);
    await store().delete("stub-delete");
    expect(await store().get("stub-delete")).toBeNull();
  });
});
