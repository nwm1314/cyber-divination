/**
 * 存储层乐观锁（B4：多设备并发写不得静默覆盖）
 *
 * ## 问题
 * `ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload` 是**无条件覆盖**。
 * 典型丢失：设备 A 与 B 都读到同一条档案，A 改备注、B 改生辰，后写者把前者的
 * 整行覆盖掉，双方都收到 200，没有任何一方知道丢了一次写。
 *
 * ## 方案
 * 表上加 `version`（旧行按 0）。写入方可选携带 `expectedVersion`：
 * - 携带 → 服务端只在版本相符时写入并把 version 自增，否则返回 409；
 * - 未携带 → 维持原有「后写覆盖」行为（兼容旧客户端与首轮迁移），
 *   但 version 仍然自增，使后续请求可以开始带版本。
 *
 * PG 侧的原子性由 `WHERE version = expectedVersion` 保证；本模块只做
 * **两种驱动共用**的判定，使 file 驱动与 PG 驱动对同一请求给出同一结果。
 */

export type VersionedResource = "person" | "chart";

/** 旧行 / 旧快照缺 version 时按 0 处理（向后兼容） */
export function normalizeVersion(raw: unknown): number {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0
    ? raw
    : 0;
}

export class VersionConflictError extends Error {
  readonly code = "STORAGE_VERSION_CONFLICT" as const;
  constructor(
    readonly resource: VersionedResource,
    readonly resourceId: string,
    readonly expectedVersion: number,
    readonly storedVersion: number,
  ) {
    super(
      `并发冲突：${resource === "person" ? "人物档案" : "命盘"} ${resourceId} 已被其他设备更新` +
        `（期望版本 ${expectedVersion}，当前 ${storedVersion}）。请刷新后重试，不要直接覆盖。`,
    );
    this.name = "VersionConflictError";
  }
}

/** 写入后的新版本号 */
export function nextVersion(stored: unknown): number {
  return normalizeVersion(stored) + 1;
}

/**
 * 校验 expectedVersion 是否可写，返回写入后的新版本。
 * @throws VersionConflictError 版本落后于服务端已存版本
 */
export function assertVersionWritable(params: {
  resource: VersionedResource;
  resourceId: string;
  storedVersion: unknown;
  expectedVersion: number | undefined;
}): number {
  const stored = normalizeVersion(params.storedVersion);
  const expected = params.expectedVersion;
  if (expected !== undefined && expected !== stored) {
    throw new VersionConflictError(
      params.resource,
      params.resourceId,
      expected,
      stored,
    );
  }
  return stored + 1;
}

export function isVersionConflict(
  error: unknown,
): error is VersionConflictError {
  return error instanceof VersionConflictError;
}
