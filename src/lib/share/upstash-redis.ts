import "server-only";
import type { ShareSnapshot } from "@/lib/types";
import type { ShareStore } from "./types";

/** 便于单测注入的最小 Redis 接口（兼容 @upstash/redis） */
export type RedisLike = {
  set(
    key: string,
    value: unknown,
    opts?: { ex?: number },
  ): Promise<"OK" | null | unknown>;
  get(key: string): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
};

const KEY_PREFIX = "share:";

function shareKey(token: string): string {
  return `${KEY_PREFIX}${token}`;
}

function parseSnapshot(raw: unknown): ShareSnapshot | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as ShareSnapshot;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && raw !== null && "token" in raw) {
    return raw as ShareSnapshot;
  }
  return null;
}

/**
 * Upstash Redis REST 分享存储（生产推荐）。
 * 可选 SHARE_TTL_SECONDS 控制 key 过期。
 */
export class UpstashShareStore implements ShareStore {
  constructor(
    private readonly redis: RedisLike,
    private readonly ttlSeconds?: number,
  ) {}

  async save(snapshot: ShareSnapshot): Promise<void> {
    const key = shareKey(snapshot.token);
    // 存 JSON 字符串，避免与自动反序列化路径纠缠
    const value = JSON.stringify(snapshot);
    if (this.ttlSeconds != null && this.ttlSeconds > 0) {
      await this.redis.set(key, value, { ex: this.ttlSeconds });
    } else {
      await this.redis.set(key, value);
    }
  }

  async get(token: string): Promise<ShareSnapshot | null> {
    const raw = await this.redis.get(shareKey(token));
    return parseSnapshot(raw);
  }

  async delete(token: string): Promise<void> {
    await this.redis.del(shareKey(token));
  }
}
