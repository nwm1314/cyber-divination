import { Redis } from "@upstash/redis";
import type { ShareSnapshot } from "@/lib/types";
import { LocalFileShareStore } from "./local-file";
import { UpstashShareStore } from "./upstash-redis";
import type { ShareStore, ShareStoreDriver } from "./types";

export type { ShareStore, ShareStoreDriver } from "./types";
export { LocalFileShareStore } from "./local-file";
export { UpstashShareStore } from "./upstash-redis";
export type { RedisLike } from "./upstash-redis";
export {
  extractShareMotto,
  extractShareMottoFromSections,
  MOTTO_FALLBACK,
} from "./extract-motto";
export type { ExtractMottoOptions } from "./extract-motto";

let cachedStore: ShareStore | null = null;

function resolveDriver(): ShareStoreDriver {
  const raw = (process.env.SHARE_STORE_DRIVER ?? "local").trim().toLowerCase();
  if (raw === "upstash") return "upstash";
  if (raw === "local" || raw === "") return "local";
  throw new Error(
    `无效的 SHARE_STORE_DRIVER="${process.env.SHARE_STORE_DRIVER}"，仅支持 local | upstash`,
  );
}

function parseTtlSeconds(): number | undefined {
  const raw = process.env.SHARE_TTL_SECONDS?.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(
      `无效的 SHARE_TTL_SECONDS="${process.env.SHARE_TTL_SECONDS}"，须为非负数字（秒）`,
    );
  }
  return n === 0 ? undefined : Math.floor(n);
}

/**
 * 按环境变量创建 ShareStore。
 * - SHARE_STORE_DRIVER=local（默认）：LocalFileShareStore
 * - SHARE_STORE_DRIVER=upstash：需 UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN，缺则 fail-fast
 */
export function createShareStore(): ShareStore {
  const driver = resolveDriver();

  if (driver === "local") {
    return new LocalFileShareStore();
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    throw new Error(
      "SHARE_STORE_DRIVER=upstash 时必须配置 UPSTASH_REDIS_REST_URL 与 UPSTASH_REDIS_REST_TOKEN，禁止静默回落本地文件",
    );
  }

  const redis = new Redis({ url, token });
  return new UpstashShareStore(redis, parseTtlSeconds());
}

/** 进程内单例；测试可调用 resetShareStoreCache */
export function getShareStore(): ShareStore {
  if (!cachedStore) {
    cachedStore = createShareStore();
  }
  return cachedStore;
}

/** 仅测试用：清空工厂缓存 */
export function resetShareStoreCache(): void {
  cachedStore = null;
}

export async function saveShareSnapshot(
  snapshot: ShareSnapshot,
): Promise<void> {
  await getShareStore().save(snapshot);
}

export async function getShareSnapshot(
  token: string,
): Promise<ShareSnapshot | null> {
  return getShareStore().get(token);
}

export async function deleteShareSnapshot(token: string): Promise<void> {
  const store = getShareStore();
  if (store.delete) {
    await store.delete(token);
  }
}
