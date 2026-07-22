/**
 * 分享存储统一入口（兼容旧 import 路径）。
 * 实现见 src/lib/share/**；驱动由 SHARE_STORE_DRIVER 选择。
 */
export {
  saveShareSnapshot,
  getShareSnapshot,
  deleteShareSnapshot,
  getShareStore,
  createShareStore,
  resetShareStoreCache,
  LocalFileShareStore,
  UpstashShareStore,
} from "./share";
export type { ShareStore, ShareStoreDriver, RedisLike } from "./share";
