/**
 * 账号 / 人物域类型契约（T80）
 * 实现登录 UI/API 见 T81；Person CRUD 见 T121。
 * 注意：本文件不从 ./index 导入，避免与 index 再导出形成循环依赖。
 */

/** 登录用户 ID；匿名见 `@/lib/auth` 的 ANON_USER_ID_PREFIX */
export type UserId = string;

/** 同一人生辰主体，可挂八字 / 紫微等多盘 */
export type PersonId = string;

/**
 * 登录用户（云端账号主体）
 * Auth 提供商：Auth.js (NextAuth v5) 预留，T81 再接 Credentials / Magic Link / OAuth
 */
export type User = {
  id: UserId;
  email?: string;
  displayName?: string;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601；可选，供同步/审计 */
  updatedAt?: string;
  /** 头像 URL（OAuth 等） */
  image?: string | null;
};

/**
 * 生辰人物主体（可本地-only 或归属 User）
 *
 * 与 BirthProfile / 紫微盘关联（T121）：
 * - Person 为跨术数统一档案；BirthProfile 为八字一次排盘输入快照
 * - BirthProfile.personId → Person.id；ZiweiChart.personId → Person.id
 * - BirthProfile.userId / Person.userId 语义一致（null = 仅本地）
 * - Person 字段为 BirthProfile 生辰子集，便于列表与跨盘展示
 * - chartIds：八字盘 id（= BirthProfile.id / BaziChart.profileId）
 * - ziweiIds：紫微盘 id（= ZiweiChart.id）
 * - gender / birthPlace 结构与 Gender、BirthPlace 一致（结构兼容）
 */
export type Person = {
  id: PersonId;
  /** null / 缺省 = 仅本地，未归属登录用户 */
  userId?: UserId | null;
  name: string;
  gender?: "male" | "female";
  /** 复用 BirthProfile 生辰字段子集 */
  solarDate?: string;
  lunarDate?: string;
  isLeapMonth?: boolean;
  birthTime?: string;
  shichenUnknown?: boolean;
  birthPlace?: {
    province: string;
    city: string;
    lng?: number;
    lat?: number;
  };
  /**
   * 挂载的八字盘 id 列表（= profileId）
   * 一人可多份八字快照（改名/不同基准日等）
   */
  chartIds?: string[];
  /**
   * 挂载的紫微盘 id 列表
   * 一人可多份紫微盘
   */
  ziweiIds?: string[];
  /** ISO 8601 */
  createdAt?: string;
  updatedAt?: string;
};

/** 创建 / 更新 Person 时的输入（id 由存储层生成或调用方指定） */
export type PersonInput = Omit<Person, "id" | "createdAt" | "updatedAt"> & {
  id?: PersonId;
};

/** 人物列表摘要（T122 UI 钩子） */
export type PersonListEntry = {
  id: PersonId;
  name: string;
  gender?: "male" | "female";
  solarDate?: string;
  chartCount: number;
  ziweiCount: number;
  /** ISO 8601 */
  updatedAt?: string;
};

/**
 * 应用层会话视图（已解析、供 UI / API 使用）
 * 与 Auth.js Session 的映射见 `@/lib/auth/types`
 */
export type AppSession = {
  /** null = 匿名 / 未登录 */
  userId: UserId | null;
  email?: string | null;
  displayName?: string | null;
  image?: string | null;
  /** 是否已登录（有真实账号，非 anon_） */
  authenticated: boolean;
  /** 会话过期时间 ISO 8601；匿名可为 null */
  expires: string | null;
};
