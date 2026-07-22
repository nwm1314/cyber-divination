/**
 * 持久化模式：账号 → localStorage；游客 → sessionStorage（关浏览器清空）
 */

const ACCOUNT_FLAG = "bd_account_mode";

export type PersistMode = "guest" | "account";

/** 浏览器 / 测试环境统一取全局 Storage（不依赖 window 存在） */
function globalLocalStorage(): Storage | null {
  try {
    const g = globalThis as typeof globalThis & {
      localStorage?: Storage;
    };
    return g.localStorage ?? null;
  } catch {
    return null;
  }
}

function globalSessionStorage(): Storage | null {
  try {
    const g = globalThis as typeof globalThis & {
      sessionStorage?: Storage;
    };
    return g.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** 是否账号持久化（登录后置 true；登出置 false） */
export function isAccountPersistMode(): boolean {
  const ls = globalLocalStorage();
  if (!ls) return false;
  try {
    return ls.getItem(ACCOUNT_FLAG) === "1";
  } catch {
    return false;
  }
}

export function getPersistMode(): PersistMode {
  return isAccountPersistMode() ? "account" : "guest";
}

/** 登录成功后调用 */
export function setAccountPersistMode(on: boolean): void {
  const ls = globalLocalStorage();
  if (!ls) return;
  try {
    if (on) {
      ls.setItem(ACCOUNT_FLAG, "1");
    } else {
      ls.removeItem(ACCOUNT_FLAG);
    }
  } catch {
    // ignore
  }
}

/** 列表类键：合并而非整表覆盖 */
const LIST_KEYS = new Set([
  "bd_list_",
  "bd_ziwei_list_",
  "bd_liuyao_list_",
  "bd_person_list_",
]);

function listIdField(key: string): string {
  if (key === "bd_list_") return "profileId";
  if (key === "bd_ziwei_list_") return "chartId";
  if (key === "bd_liuyao_list_") return "id";
  return "id"; // person_list 为 string[] 或 {id}
}

function mergeListJson(key: string, localRaw: string | null, sessionRaw: string): string {
  let localArr: unknown[] = [];
  let sessionArr: unknown[] = [];
  try {
    if (localRaw) localArr = JSON.parse(localRaw) as unknown[];
  } catch {
    localArr = [];
  }
  try {
    sessionArr = JSON.parse(sessionRaw) as unknown[];
  } catch {
    return localRaw ?? sessionRaw;
  }
  if (!Array.isArray(localArr)) localArr = [];
  if (!Array.isArray(sessionArr)) return localRaw ?? sessionRaw;

  // person_list：string[]
  if (key === "bd_person_list_") {
    const set = new Set<string>();
    for (const x of [...sessionArr, ...localArr]) {
      if (typeof x === "string" && x) set.add(x);
    }
    return JSON.stringify([...set]);
  }

  const idField = listIdField(key);
  const map = new Map<string, unknown>();
  for (const item of localArr) {
    if (item && typeof item === "object" && idField in (item as object)) {
      const id = String((item as Record<string, unknown>)[idField] ?? "");
      if (id) map.set(id, item);
    }
  }
  // session 覆盖同 id（游客当次结果优先）
  for (const item of sessionArr) {
    if (item && typeof item === "object" && idField in (item as object)) {
      const id = String((item as Record<string, unknown>)[idField] ?? "");
      if (id) map.set(id, item);
    }
  }
  return JSON.stringify([...map.values()]);
}

/**
 * 登录前：把游客 sessionStorage 中的 bd_* 提升到 localStorage。
 * 实体键：session 覆盖；列表键：合并。提升后清除 session 中对应键。
 * @returns 写入/合并的键数量
 */
export function promoteGuestSessionToAccount(): number {
  const ls = globalLocalStorage();
  const ss = globalSessionStorage();
  if (!ls || !ss) return 0;

  const keys: string[] = [];
  try {
    const len = typeof ss.length === "number" ? ss.length : 0;
    for (let i = 0; i < len; i++) {
      const k = ss.key(i);
      if (k && k.startsWith("bd_")) keys.push(k);
    }
    // 兼容 length 未实现的 mock：尝试 Object.keys 式探测
    if (keys.length === 0 && typeof (ss as unknown as { _keys?: () => string[] })._keys === "function") {
      for (const k of (ss as unknown as { _keys: () => string[] })._keys()) {
        if (k.startsWith("bd_")) keys.push(k);
      }
    }
  } catch {
    return 0;
  }

  let n = 0;
  for (const key of keys) {
    let sv: string | null = null;
    try {
      sv = ss.getItem(key);
    } catch {
      continue;
    }
    if (sv == null) continue;
    try {
      if (LIST_KEYS.has(key)) {
        const lv = ls.getItem(key);
        ls.setItem(key, mergeListJson(key, lv, sv));
      } else {
        ls.setItem(key, sv);
      }
      n += 1;
    } catch {
      // quota
    }
  }

  for (const key of keys) {
    try {
      ss.removeItem(key);
    } catch {
      // ignore
    }
  }
  return n;
}

/**
 * 登录并切换为账号持久化：先提升游客数据，再打开账号模式。
 */
export function enterAccountPersistMode(): number {
  const promoted = promoteGuestSessionToAccount();
  setAccountPersistMode(true);
  return promoted;
}

/**
 * 当前模式应读写的 Storage。
 * 游客：sessionStorage；账号：localStorage。
 * 无 Storage 时返回 null。
 */
export function getDataStore(): Storage | null {
  if (isAccountPersistMode()) {
    return globalLocalStorage();
  }
  return globalSessionStorage() ?? globalLocalStorage();
}

/** 是否允许写云端 / 生成分享链接 */
export function canUseCloudAndShare(): boolean {
  return isAccountPersistMode();
}
