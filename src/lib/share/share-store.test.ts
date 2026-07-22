import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import type { ShareSnapshot } from "@/lib/types";
import { LocalFileShareStore } from "./local-file";
import { UpstashShareStore, type RedisLike } from "./upstash-redis";
import {
  createShareStore,
  resetShareStoreCache,
  saveShareSnapshot,
  getShareSnapshot,
  deleteShareSnapshot,
} from "./index";

function sampleSnapshot(token = "tok-abc"): ShareSnapshot {
  return {
    token,
    chartId: "chart-1",
    chartName: "张*",
    nameMasked: true,
    pillars: {
      year: { stem: "庚", branch: "午" },
      month: { stem: "壬", branch: "子" },
      day: { stem: "甲", branch: "辰" },
      hour: null,
    },
    dayMaster: "甲",
    advice: "稳中求进",
    disclaimer: "命理分析仅供参考，人生在于自身的努力和选择。",
    createdAt: "2026-07-20T00:00:00.000Z",
  };
}

describe("LocalFileShareStore", () => {
  let tmpDir: string;
  let store: LocalFileShareStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "share-store-"));
    store = new LocalFileShareStore({ dataDir: tmpDir });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("同 token 可 save 后 get", async () => {
    const snap = sampleSnapshot("local-1");
    await store.save(snap);
    const got = await store.get("local-1");
    expect(got).toEqual(snap);
  });

  it("未知 token 返回 null", async () => {
    expect(await store.get("missing")).toBeNull();
  });

  it("delete 后不可再 get", async () => {
    await store.save(sampleSnapshot("del-1"));
    await store.delete("del-1");
    expect(await store.get("del-1")).toBeNull();
  });

  it("写入 shares.json 与现有格式兼容", async () => {
    const snap = sampleSnapshot("fmt-1");
    await store.save(snap);
    const raw = await fs.readFile(path.join(tmpDir, "shares.json"), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, ShareSnapshot>;
    expect(parsed["fmt-1"]).toEqual(snap);
  });
});

describe("UpstashShareStore", () => {
  function memoryRedis(): RedisLike & { map: Map<string, string> } {
    const map = new Map<string, string>();
    return {
      map,
      async set(key, value, opts) {
        map.set(key, typeof value === "string" ? value : JSON.stringify(value));
        if (opts?.ex != null) {
          // 单测不模拟过期，仅确认调用路径
        }
        return "OK";
      },
      async get(key) {
        return map.get(key) ?? null;
      },
      async del(...keys) {
        let n = 0;
        for (const k of keys) {
          if (map.delete(k)) n++;
        }
        return n;
      },
    };
  }

  it("同 token 可读写", async () => {
    const redis = memoryRedis();
    const store = new UpstashShareStore(redis, 3600);
    const snap = sampleSnapshot("up-1");
    await store.save(snap);
    expect(redis.map.has("share:up-1")).toBe(true);
    expect(await store.get("up-1")).toEqual(snap);
  });

  it("delete 移除 key", async () => {
    const redis = memoryRedis();
    const store = new UpstashShareStore(redis);
    await store.save(sampleSnapshot("up-2"));
    await store.delete("up-2");
    expect(await store.get("up-2")).toBeNull();
  });
});

describe("createShareStore 工厂", () => {
  const envKeys = [
    "SHARE_STORE_DRIVER",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "SHARE_TTL_SECONDS",
  ] as const;
  const backup: Partial<Record<(typeof envKeys)[number], string | undefined>> =
    {};

  beforeEach(() => {
    for (const k of envKeys) {
      backup[k] = process.env[k];
      delete process.env[k];
    }
    resetShareStoreCache();
  });

  afterEach(() => {
    for (const k of envKeys) {
      const v = backup[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    resetShareStoreCache();
  });

  it("默认 local", () => {
    const store = createShareStore();
    expect(store).toBeInstanceOf(LocalFileShareStore);
  });

  it("upstash 缺配置 fail-fast", () => {
    process.env.SHARE_STORE_DRIVER = "upstash";
    expect(() => createShareStore()).toThrow(/UPSTASH_REDIS_REST/);
  });

  it("无效 driver 抛错", () => {
    process.env.SHARE_STORE_DRIVER = "s3";
    expect(() => createShareStore()).toThrow(/SHARE_STORE_DRIVER/);
  });
});

describe("统一入口 save/get/delete", () => {
  let tmpDir: string;
  const envKeys = ["SHARE_STORE_DRIVER"] as const;
  const backup: Partial<Record<(typeof envKeys)[number], string | undefined>> =
    {};
  let cwdSpy: { mockRestore: () => void } | undefined;

  beforeEach(async () => {
    for (const k of envKeys) {
      backup[k] = process.env[k];
      delete process.env[k];
    }
    process.env.SHARE_STORE_DRIVER = "local";
    resetShareStoreCache();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "share-entry-"));
    // LocalFile 默认写 process.cwd()/data；测试用 chdir 到临时目录
    const prev = process.cwd();
    process.chdir(tmpDir);
    cwdSpy = {
      mockRestore: () => {
        process.chdir(prev);
      },
    };
  });

  afterEach(async () => {
    cwdSpy?.mockRestore();
    for (const k of envKeys) {
      const v = backup[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    resetShareStoreCache();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("saveShareSnapshot / getShareSnapshot 互通", async () => {
    const snap = sampleSnapshot("entry-1");
    await saveShareSnapshot(snap);
    expect(await getShareSnapshot("entry-1")).toEqual(snap);
    await deleteShareSnapshot("entry-1");
    expect(await getShareSnapshot("entry-1")).toBeNull();
  });
});
