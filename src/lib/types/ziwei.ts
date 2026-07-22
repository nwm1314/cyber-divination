/**
 * 紫微斗数类型契约（T100 · §6.4）
 *
 * 引擎策略（主 Agent 拍板）：
 * - 自研表驱动 + 纯函数排盘（`src/lib/ziwei/**`）
 * - 不引入重型紫微 npm 依赖
 * - **禁止 LLM 排盘**：星曜落宫、大限流年等必须确定性、可单测
 *
 * 规则权威源：`src/lib/ziwei/references/README.md`
 * 排盘实现：T101+；本文件仅锁类型，可扩展字段。
 *
 * 注意：本文件不从 ./index 导入，避免与 index 再导出形成循环依赖。
 */

import type { PersonId, UserId } from "./user";

/** 紫微盘 ID */
export type ZiweiChartId = string;

/**
 * 十二宫名（地支序位由引擎填；名称固定）
 * 顺序：命→兄→夫→子→财→疾→迁→仆→官→田→福→父
 */
export type ZiweiPalaceName =
  | "命宫"
  | "兄弟"
  | "夫妻"
  | "子女"
  | "财帛"
  | "疾厄"
  | "迁移"
  | "交友"
  | "官禄"
  | "田宅"
  | "福德"
  | "父母";

/** 十二地支（宫位定位） */
export type Dizhi =
  | "子"
  | "丑"
  | "寅"
  | "卯"
  | "辰"
  | "巳"
  | "午"
  | "未"
  | "申"
  | "酉"
  | "戌"
  | "亥";

/** 星曜亮度（常见四态；可扩展） */
export type StarBrightness = "庙" | "旺" | "得" | "利" | "平" | "不" | "陷";

/** 星曜类别 */
export type StarCategory =
  | "major" // 十四主星
  | "soft" // 六吉等辅星
  | "harsh" // 六煞等
  | "misc"; // 杂曜 / 博士十二神等

/**
 * 单颗星曜落宫信息
 * T101 可只填 name；亮度/四化等后续扩展
 */
export type ZiweiStar = {
  name: string;
  category?: StarCategory;
  brightness?: StarBrightness;
  /** 生年/自化等四化标记，如「禄」「权」「科」「忌」；飞星叠「来源宫·化X」 */
  sihua?: string[];
};

/** 飞星一条：源宫宫干飞出四化落目标星所在宫（T190） */
export type FeixingFlight = {
  /** 源宫名 */
  fromPalace: ZiweiPalaceName | string;
  /** 源宫干 */
  fromStem: string;
  /** 禄|权|科|忌 */
  kind: "禄" | "权" | "科" | "忌" | string;
  /** 四化目标星名 */
  star: string;
  /** 目标星所在宫 */
  toPalace: ZiweiPalaceName | string;
  /** 是否自化（源宫=目标宫） */
  self?: boolean;
};

/**
 * 单宫
 * §6.4 以 palaces[] 表达十二宫；本结构为可扩展单元
 */
export type ZiweiPalace = {
  /** 宫名 */
  name: ZiweiPalaceName;
  /** 该宫地支 */
  branch: Dizhi;
  /** 落在本宫的星曜（主星+辅星；引擎可分批填充） */
  stars: ZiweiStar[];
  /** 是否身宫所在 */
  isShenGong?: boolean;
  /** 天干（五虎遁等，T101 填） */
  stem?: string;
  /**
   * 本宫宫干飞出的四化（飞星派结构；T190）
   * 与 star.sihua 上的「源宫·化X」对齐
   */
  feixingOut?: FeixingFlight[];
};

/** 运限一层四化摘要（大限/流年 · T200/T201） */
export type YunSihuaItem = {
  kind: "禄" | "权" | "科" | "忌" | string;
  star: string;
  toPalace: ZiweiPalaceName | string;
  self?: boolean;
};

/** 大限一步 */
export type ZiweiDaxianStep = {
  startAge: number;
  endAge: number;
  /** 大限所落宫名 */
  palace: ZiweiPalaceName | string;
  /** 大限地支（可选） */
  branch?: Dizhi;
  index?: number;
  /** 大限宫天干（本命盘该宫 stem）（T200） */
  stem?: string;
  /** 大限宫干飞出四化（不写回本命星 sihua，仅运限层）（T200） */
  sihuaOut?: YunSihuaItem[];
};

/** 流年项（T102 + T201 运限飞星） */
export type ZiweiLiunianItem = {
  year: number;
  age: number;
  palace?: ZiweiPalaceName | string;
  branch?: Dizhi;
  /** 流年干（农历年干）（T201） */
  stem?: string;
  /** 流年干四化落宫（T201） */
  sihuaOut?: YunSihuaItem[];
  /** 流年流昌所在宫（T201） */
  liuChangPalace?: ZiweiPalaceName | string;
  /** 流年流曲所在宫（T201） */
  liuQuPalace?: ZiweiPalaceName | string;
};

/** 流月项（T240） */
export type ZiweiLiuyueItem = {
  /** YYYY-MM */
  month: string;
  year: number;
  monthIndex: number;
  palace?: ZiweiPalaceName | string;
  branch?: Dizhi;
  stem?: string;
  sihuaOut?: YunSihuaItem[];
};

/** 流日项（T240） */
export type ZiweiLiuriItem = {
  /** YYYY-MM-DD */
  date: string;
  year: number;
  monthIndex: number;
  day: number;
  palace?: ZiweiPalaceName | string;
  branch?: Dizhi;
  stem?: string;
  sihuaOut?: YunSihuaItem[];
};

/**
 * 未知时辰多盘候选摘要（T270）
 * 不输出唯一完整盘；仅关键字段供校盘
 */
export type ZiweiHourCandidate = {
  /** 时支 */
  hourBranch: Dizhi;
  mingBranch: Dizhi;
  shenGong: ZiweiPalaceName | string;
  shenBranch: Dizhi;
  wuxingJu: string;
  /** 主星名 → 地支 */
  majorByBranch: Record<string, string>;
  /** 是否与默认午时参考盘一致 */
  isDefaultNoon?: boolean;
};

/**
 * 排盘输入（与八字复用生辰语义；T101 使用）
 * 不强制完整 BirthProfile，便于单独起盘
 */
export type ZiweiChartInput = {
  /** 阳历 YYYY-MM-DD */
  solarDate?: string;
  lunarDate?: string;
  isLeapMonth?: boolean;
  /** HH:mm；未知时配合 shichenUnknown */
  birthTime?: string;
  shichenUnknown?: boolean;
  gender: "male" | "female";
  birthPlace?: {
    province: string;
    city: string;
    lng?: number;
    lat?: number;
  };
  useTrueSolarTime?: boolean;
  /** 分析基准日，默认今天 */
  analysisBaseDate?: string;
  /** 在世；false 时流年/当前限截断至 deathYear（T102） */
  alive?: boolean;
  deathYear?: number;
  personId?: PersonId;
  profileId?: string;
  userId?: UserId | null;
  name?: string;
};

/**
 * 确定性紫微命盘（零 LLM）
 * 兼容 docs/TASKS.md §6.4；下列字段为最小必填，其余可选扩展
 */
export type ZiweiChart = {
  id: ZiweiChartId;
  personId?: PersonId;
  /** 可关联八字 BirthProfile.id */
  profileId?: string;
  userId?: UserId | null;
  /** 展示用姓名快照 */
  name?: string;

  /** 十二宫（长度应为 12；顺序建议按宫名常序） */
  palaces: ZiweiPalace[];
  /** 命宫宫名 */
  mingGong: ZiweiPalaceName | string;
  /** 身宫宫名 */
  shenGong: ZiweiPalaceName | string;
  /**
   * 宫名 → 主星名列表（便于 UI 快速索引）
   * 与 palaces[].stars 中 category=major 应对齐；引擎保证一致
   */
  majorStars: Record<string, string[]>;

  /** 大限序列（T102 填满；T101 可空数组） */
  daxian: ZiweiDaxianStep[];
  /** 当前大限下标；未知为 -1 */
  currentDaxianIndex?: number;
  /** 流年（T102） */
  liunian?: ZiweiLiunianItem[];
  /** 流月（T240；基准月 ± 邻月） */
  liuyue?: ZiweiLiuyueItem[];
  /** 流日（T240；基准日 ± 邻日） */
  liuri?: ZiweiLiuriItem[];

  /**
   * 五行局等（T101 填）
   * 例：水二局、木三局…
   */
  wuxingJu?: string;
  /** 命主 / 身主星名（可选） */
  mingZhu?: string;
  shenZhu?: string;

  /**
   * 全盘飞星边列表（T190；与各宫 feixingOut 一致）
   * 便于解读/调试一次遍历
   */
  feixingFlights?: FeixingFlight[];

  /**
   * 未知时辰：十二时辰候选摘要（T270）
   * 有值时主盘仅为默认午时参考，不可当作唯一完整盘
   */
  hourCandidates?: ZiweiHourCandidate[];

  /** 边界 / 缺失 / 冲突警告（T270） */
  warnings?: string[];

  flags: string[];
  meta: {
    engineVersion: string;
    /**
     * 规则源标识；与 references 对齐
     * 例：`ziwei-tables`（自研表驱动）
     */
    skillRef: string;
    /**
     * 主流派：盘体/安星为三合（T270）
     * 飞星为叠加命名空间，见 schools / rulePriority
     */
    school?: "sanhe" | "feixing" | string;
    /** 数据结构版本（统一引擎信封） */
    schemaVersion?: string;
    /** 规则集版本 */
    ruleSetVersion?: string;
    /**
     * 分层流派命名空间
     * - core：命身宫、五行局、主辅星、大限（三合）
     * - feixing：宫干飞星飞宫（叠加，不改安星）
     * - zihua：宫干自化（三合扩展）
     */
    schools?: {
      core: "sanhe" | string;
      feixing?: "feixing" | string;
      zihua?: "sanhe" | string;
    };
    /**
     * 规则应用优先级（先 → 后）
     * 同标记冲突时以后写叠加为准，但事实层以 core 为准
     */
    rulePriority?: string[];
    /** 年龄口径：严格虚岁 year-birthYear+1（T270） */
    agePolicy?: "xusui" | "zhousui" | string;
    /** 历法策略 */
    calendarPolicy?: string;
    /** 时辰策略 */
    timePolicy?: string;
  };
};

/** 规则源标识（与 references / 引擎 SKILL_REF 对齐） */
export const ZIWEI_SKILL_REF = "ziwei-tables" as const;
/** @deprecated 使用 `@/lib/ziwei` 的 ENGINE_VERSION */
export const ZIWEI_ENGINE_VERSION_PLACEHOLDER = "0.8.0" as const;
