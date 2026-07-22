import type { ShareSnapshot } from "@/lib/types";

/** 可插拔分享快照存储（本地文件 / Upstash Redis 等） */
export interface ShareStore {
  save(snapshot: ShareSnapshot): Promise<void>;
  get(token: string): Promise<ShareSnapshot | null>;
  delete?(token: string): Promise<void>;
}

export type ShareStoreDriver = "local" | "upstash";
