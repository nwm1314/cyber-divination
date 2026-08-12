/** 共享类型契约 — 变更需主 Agent 评审 */

import type { PersonId, UserId } from "./user";

export type Gender = "male" | "female";

export type BaziSkillProvenance = {
  skillRef: "bazi-skill";
  source: "project-synced-skill";
  sourceLicense: "MIT";
  referenceManifestVersion: string;
  referenceHash: string;
  files: readonly { path: string; sha256: string }[];
  execution: "deterministic-project-engine";
};

export type BirthPlace = {
  province: string;
  city: string;
  lng?: number;
  lat?: number;
};

/** 账号 / 人物 / 会话（T80 / T121 · 详见 user.ts 与 @/lib/auth） */
export type {
  AppSession,
  Person,
  PersonId,
  PersonInput,
  PersonListEntry,
  User,
  UserId,
} from "./user";

/** 紫微斗数（T100 · §6.4；引擎 T101+） */
export type {
  Dizhi,
  FeixingFlight,
  StarBrightness,
  StarCategory,
  YunSihuaItem,
  ZiweiChart,
  ZiweiChartId,
  ZiweiChartInput,
  ZiweiDaxianStep,
  ZiweiHourCandidate,
  ZiweiLiunianItem,
  ZiweiLiuriItem,
  ZiweiLiuyueItem,
  ZiweiPalace,
  ZiweiPalaceName,
  ZiweiStar,
} from "./ziwei";
export {
  ZIWEI_ENGINE_VERSION_PLACEHOLDER,
  ZIWEI_SKILL_REF,
} from "./ziwei";

/** 六爻（T110 · §6.4；装卦 T111+；T153 六亲/用神落爻） */
export type {
  GuaRef,
  HexagramEntry,
  LiuyaoChart,
  LiuyaoLine,
  LiuyaoMethod,
  LiuqinName,
  TrigramName,
  YaoPosition,
  YaoValue,
} from "./liuyao";


/** 信息收集（对齐 skill Step 1–9） */
export type BirthProfile = {
  id: string;
  /**
   * 归属用户；null / 缺省 = 仅本地（匿名会话）
   * 规则见 `@/lib/auth`：`anon_` 前缀或 null
   */
  userId?: UserId | null;
  /**
   * 统一人物主体 Person.id（T121）；缺省表示尚未挂到 Person
   * 关联：Person 可挂多份 BirthProfile / 紫微盘
   */
  personId?: PersonId;
  name: string;
  formerName?: string;
  renameYear?: number | "unknown";
  solarDate?: string;
  lunarDate?: string;
  isLeapMonth?: boolean;
  birthTime?: string;
  shichenUnknown?: boolean;
  gender: Gender;
  birthPlace?: BirthPlace;
  alive: boolean;
  deathYear?: number;
  analysisBaseDate: string;
  useTrueSolarTime: boolean;
};

export type StemBranch = {
  stem: string;
  branch: string;
};

export type Pillar = StemBranch & {
  tenGod?: string;
  hiddenStems?: string[];
};

export type DayunStep = {
  /** -1 = 起运前（小运/月柱），0+ = 正式大运 */
  index: number;
  stem: string;
  branch: string;
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
  /** 起运余月（仅第一步正式大运有意义；skill：余天→月） */
  startAgeMonths?: number;
  /** 是否起运前小运步 */
  isPreDayun?: boolean;
  /** 交运实际日期 YYYY-MM-DD（第一步正式大运=起运日） */
  startAt?: string;
};

/** 起运精细度（年+月） */
export type StartAgeDetail = {
  years: number;
  months: number;
  /** 到节气天数（用于展示） */
  diffDays: number;
  /** 交运实际日期 YYYY-MM-DD */
  startAt?: string;
};

/** 规则证据（T261 可解释输出） */
export type RuleEvidence = {
  ruleId: string;
  source: string;
  conclusion: string;
  confidence: number;
  condition?: string;
};

/** 按柱位的十神（避免同干合并丢计数） */
export type TenGodByPosition = {
  position: "year" | "month" | "day" | "hour";
  stem: string;
  tenGod: string;
};

/** 用神分层（调候/扶抑/通关/病药） */
export type YongshenLayered = {
  fuyi: { favorable: string[]; unfavorable: string[]; note: string };
  tiaohou: { favorable: string[]; note: string };
  tongguan: { favorable: string[]; note: string };
  bingyao: { disease: string[]; medicine: string[]; note: string };
};

export type LiunianItem = {
  year: number;
  stem: string;
  branch: string;
  age: number;
};

/** 合化判定细节（表驱动；仅合见则为合绊） */
export type HehuaDetail = {
  /** true=合化成功；false=仅合绊 */
  transformed: boolean;
  /** UI 标签：合化 | 合绊 */
  tag: "合化" | "合绊";
  /** 得令/得时：月令助化神 */
  deLing: boolean;
  /** 得地：地支有化神之根 */
  deDi: boolean;
  /** 天干相邻（天干五合专用；六合固定 true） */
  adjacent: boolean;
};

export type StemHeRelation = {
  kind: "he";
  a: string;
  b: string;
  result: string;
  label: string;
  hehua: HehuaDetail;
};

export type BranchChongRelation = {
  kind: "chong";
  a: string;
  b: string;
  label: string;
};

export type BranchLiuheRelation = {
  kind: "liuhe";
  a: string;
  b: string;
  result: string;
  label: string;
  hehua: HehuaDetail;
};

export type BranchSanheRelation = {
  kind: "sanhe";
  members: string[];
  result: string;
  label: string;
  partial?: boolean;
};

export type BranchSanhuiRelation = {
  kind: "sanhui";
  members: string[];
  result: string;
  label: string;
};

export type BranchXingRelation = {
  kind: "xing";
  members: string[];
  label: string;
};

export type BranchHaiRelation = {
  kind: "hai";
  a: string;
  b: string;
  label: string;
};

export type ChartRelations = {
  stemHe: StemHeRelation[];
  branchChong: BranchChongRelation[];
  branchLiuhe: BranchLiuheRelation[];
  branchSanhe: BranchSanheRelation[];
  branchSanhui: BranchSanhuiRelation[];
  branchXing: BranchXingRelation[];
  branchHai: BranchHaiRelation[];
};

/** 确定性排盘结果（零 LLM） */
export type BaziChart = {
  profileId: string;
  pillars: {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour?: Pillar | null;
  };
  dayMaster: string;
  /**
   * 天干→十神（同干合并，仅便于 UI 查表）
   * 旺衰计数请用 tenGodsByPosition
   */
  tenGods: Record<string, string>;
  /** 按柱位十神（T261：重复天干分别计数） */
  tenGodsByPosition?: TenGodByPosition[];
  hiddenStems: Record<string, string[]>;
  /**
   * 固定藏干权重五行分（T261：仅可视化/雷达，不可替代月令司令与通根）
   */
  wuxingScores: Record<"wood" | "fire" | "earth" | "metal" | "water", number>;
  /** 与 wuxingScores 同源；语义标注为可视化专用 */
  wuxingScoresVisual?: Record<
    "wood" | "fire" | "earth" | "metal" | "water",
    number
  >;
  relations: ChartRelations;
  dayun: DayunStep[];
  currentDayunIndex: number;
  liunian: LiunianItem[];
  /** 起运年+月（skill dayun-rules） */
  startAgeDetail?: StartAgeDetail;
  /** 日主在四柱地支的十二长生 */
  changSheng?: {
    year?: string;
    month?: string;
    day?: string;
    hour?: string | null;
  };
  flags: string[];
  /** 边界/策略警告（可与 flags 并存） */
  warnings?: string[];
  /** 用神分层输出 */
  yongshenLayered?: YongshenLayered;
  /** 规则证据链 */
  evidence?: RuleEvidence[];
  meta: {
    engineVersion: string;
    skillRef: "bazi-skill";
    schemaVersion?: string;
    ruleSetVersion?: string;
    school?: string;
    calendarPolicy?: {
      nightZi: string;
      jieqi: string;
      timezone: string;
      unknownHour: string;
      historicalDst: boolean;
    };
    provenance?: BaziSkillProvenance;
  };
};

export type ReadingMode = "template" | "llm";
export type ViewMode = "plain" | "pro";

export type ReadingSectionKey =
  | "day_master"
  | "ten_gods"
  | "wuxing"
  | "pattern"
  | "dayun"
  | "liunian"
  | "calibrate"
  | "advice";

export type ReadingSection = {
  key: ReadingSectionKey;
  title: string;
  body: string;
  citations?: string[];
};

export type CalibratePrompt = {
  ageRange: string;
  yearHint: string;
  nature: string;
  /** 题源：用于校准反馈映射章节，禁止写死 index 阈值 */
  source?: "dayun" | "liunian" | "life_stage";
};

export type ReadingReport = {
  chartId: string;
  mode: ReadingMode;
  viewMode: ViewMode;
  sections: ReadingSection[];
  calibratePrompts: CalibratePrompt[];
  disclaimer: string;
  fallback?: boolean;
  /** LLM 回落原因（仅 mode=llm 且 fallback 时） */
  fallbackReason?: string;
  /** T290：引擎透传，非 LLM 发明 */
  engineVersion?: string;
  school?: string;
  warnings?: string[];
  evidence?: RuleEvidence[];
};

/** 紫微报告章节 key（T104 · 稳定契约，勿随意改名） */
export type ZiweiReadingSectionKey =
  | "overview"
  | "ming_gong"
  | "career"
  | "wealth"
  | "relationship"
  | "luck"
  | "advice"
  | "disclaimer";

export type ZiweiReadingSection = {
  key: ZiweiReadingSectionKey;
  title: string;
  body: string;
  citations?: string[];
};

/** 紫微解读报告（与八字 ReadingReport 并列；kind 便于统一 API） */
export type ZiweiReadingReport = {
  chartId: string;
  kind: "ziwei";
  mode: ReadingMode;
  viewMode: ViewMode;
  sections: ZiweiReadingSection[];
  disclaimer: string;
  fallback?: boolean;
  fallbackReason?: string;
  /** T290：引擎透传 */
  engineVersion?: string;
  school?: string;
  warnings?: string[];
};

/** 六爻报告章节 key（T114 · 稳定契约，勿随意改名） */
export type LiuyaoReadingSectionKey =
  | "question"
  | "ben_gua"
  | "changing"
  | "shi_ying"
  | "judgment"
  | "advice"
  | "disclaimer";

export type LiuyaoReadingSection = {
  key: LiuyaoReadingSectionKey;
  title: string;
  body: string;
  citations?: string[];
};

/** 六爻解卦报告（与八字/紫微并列；kind 便于统一 API） */
export type LiuyaoReadingReport = {
  chartId: string;
  kind: "liuyao";
  mode: ReadingMode;
  viewMode: ViewMode;
  /** 所问事项（一事一问） */
  question: string;
  sections: LiuyaoReadingSection[];
  disclaimer: string;
  fallback?: boolean;
  fallbackReason?: string;
  /** T290：引擎透传 */
  engineVersion?: string;
  school?: string;
  warnings?: string[];
};

export const ErrorCode = {
  INVALID_PROFILE: "INVALID_PROFILE",
  MISSING_BIRTH_DATE: "MISSING_BIRTH_DATE",
  CHART_COMPUTE_FAILED: "CHART_COMPUTE_FAILED",
  LLM_UNAVAILABLE: "LLM_UNAVAILABLE",
  NOT_FOUND: "NOT_FOUND",
  /** 未登录且接口要求登录 */
  AUTH_REQUIRED: "AUTH_REQUIRED",
  /** 会话无效或过期 */
  AUTH_SESSION_INVALID: "AUTH_SESSION_INVALID",
  /** 登录凭证 / Magic Link / OAuth 失败 */
  AUTH_LOGIN_FAILED: "AUTH_LOGIN_FAILED",
  /** 无权限访问该资源（非本人档案等） */
  AUTH_FORBIDDEN: "AUTH_FORBIDDEN",
  /** 账号不存在 */
  AUTH_USER_NOT_FOUND: "AUTH_USER_NOT_FOUND",
  /** 匿名数据合并冲突等 */
  AUTH_MERGE_CONFLICT: "AUTH_MERGE_CONFLICT",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type AppError = {
  code: ErrorCode;
  message: string;
};

/** 分享快照术种；缺省视为 bazi（兼容旧数据） */
export type ShareKind = "bazi" | "ziwei" | "liuyao";

/** 紫微只读摘要（脱敏；不含完整十二宫/完整 LLM 长文） */
export type ZiweiShareSummary = {
  mingGong: string;
  shenGong: string;
  wuxingJu?: string;
  mingZhu?: string;
  shenZhu?: string;
  /** 命宫主星名列表 */
  mingStars?: string[];
};

/** 六爻只读摘要（脱敏；不含完整爻辞长文） */
export type LiuyaoShareSummary = {
  question: string;
  method: string;
  benGuaName: string;
  bianGuaName?: string;
  shiYao?: number;
  yingYao?: number;
  yongShen?: string;
};

export type ShareSnapshot = {
  token: string;
  /** 默认 bazi */
  kind?: ShareKind;
  chartId: string;
  chartName: string;
  /** 是否对姓名脱敏展示 */
  nameMasked?: boolean;
  /** 八字四柱（kind=bazi 或旧快照） */
  pillars?: BaziChart["pillars"];
  dayMaster?: string;
  /** 紫微摘要（kind=ziwei） */
  ziwei?: ZiweiShareSummary;
  /** 六爻摘要（kind=liuyao） */
  liuyao?: LiuyaoShareSummary;
  advice: string;
  disclaimer: string;
  createdAt: string;
};
