/**
 * 六爻类型契约（T110 · 对齐 docs/TASKS.md §6.4）
 * W26（T280–T282）：起卦流派标识、装卦 meta、用神确认与爻级分析扩展。
 * 注意：本文件不从 ./index 导入，避免循环依赖。
 */

import type { UserId } from "./user";

/** 起卦方式：铜钱 / 时间 / 手动指定 */
export type LiuyaoMethod = "coins" | "time" | "manual";

/**
 * 装卦流派/方法族（T280）
 * - najia-coins：三钱纳甲六爻
 * - najia-manual：手工指定六爻后按纳甲装卦
 * - meihua-time-to-najia：梅花先天数时间起卦 → 再入纳甲分析（混合，不可伪装纯纳甲）
 */
export type LiuyaoCastingSchool =
  | "najia-coins"
  | "najia-manual"
  | "meihua-time-to-najia";

/** 随机来源（铜钱法） */
export type LiuyaoRandomSource = "seeded-prng" | "fresh-seed" | "none";

/** 问事类别（用神确认入口 · T281） */
export type LiuyaoQuestionCategory =
  | "wealth"
  | "career"
  | "lawsuit"
  | "marriage"
  | "health"
  | "travel"
  | "parents"
  | "offspring"
  | "siblings"
  | "self"
  | "other";

/**
 * 爻值（三钱法通行编码）
 * - 6 老阴（×，动）
 * - 7 少阳（—，静）
 * - 8 少阴（--，静）
 * - 9 老阳（○，动）
 */
export type YaoValue = 6 | 7 | 8 | 9;

/** 爻位：自下而上 1=初爻 … 6=上爻 */
export type YaoPosition = 1 | 2 | 3 | 4 | 5 | 6;

/** 六亲（纳甲安爻；T153） */
export type LiuqinName =
  | "父母"
  | "兄弟"
  | "子孙"
  | "妻财"
  | "官鬼";

/** 六神（按日干起 · T281） */
export type LiushenName =
  | "青龙"
  | "朱雀"
  | "勾陈"
  | "螣蛇"
  | "白虎"
  | "玄武";

/** 单爻记录（装卦结果行） */
export type LiuyaoLine = {
  yao: YaoPosition;
  value: YaoValue;
  /** 是否动爻（value 为 6 或 9） */
  changing: boolean;
  /** 本卦六亲（enrichChart 填充） */
  liuqin?: LiuqinName;
  /** 纳甲地支（可选展示） */
  branch?: string;
  /** 爻支五行 */
  wuxing?: string;
  /** 六神（有日干时填充） */
  liushen?: LiushenName;
  /** 伏神六亲（用神不现时可能有） */
  fushen?: LiuqinName;
  /** 伏神地支 */
  fushenBranch?: string;
  /** 月破（爻支冲月建） */
  yuePo?: boolean;
  /** 日冲（爻支冲日支） */
  riChong?: boolean;
};

/** 卦象摘要：卦名 + 上下经卦 */
export type GuaRef = {
  /** 通行卦名，如「乾为天」「水雷屯」 */
  name: string;
  /** 上卦（外卦）经卦名：乾|坤|震|巽|坎|离|艮|兑 */
  upper: string;
  /** 下卦（内卦）经卦名 */
  lower: string;
};

/** 装卦 meta（T280） */
export type LiuyaoChartMeta = {
  engineVersion: string;
  /** 装卦流派；时间法必须为 meihua-time-to-najia */
  castingSchool?: LiuyaoCastingSchool;
  /** 随机来源：铜钱种子 / 新鲜种子 / 手动与时间无随机 */
  randomSource?: LiuyaoRandomSource;
  /** IANA 时区或 offset 说明，如 Asia/Shanghai */
  timezone?: string;
  /** 复盘种子（铜钱法） */
  replaySeed?: string | number;
  /** 方法说明（面向展示，中性） */
  methodNote?: string;
  /** 规则/数据版本锚点 */
  dataVersion?: string;
};

/**
 * 六爻盘（确定性装卦输出，零 LLM）
 * 世应/用神等解卦字段由 T112 填充；本契约仅锁结构。
 */
export type LiuyaoChart = {
  id: string;
  /** null / 缺省 = 仅本地 */
  userId?: UserId | null;
  /** 所问事项（一事一问） */
  question: string;
  method: LiuyaoMethod;
  /** 六爻自下而上 */
  lines: LiuyaoLine[];
  /** 本卦 */
  benGua: GuaRef;
  /** 变卦；无动爻时可缺省 */
  bianGua?: GuaRef;
  /** 世爻位 1–6 */
  shiYao: number;
  /** 应爻位 1–6 */
  yingYao: number;
  /** 用神标签：六亲名或「世」（规则表驱动） */
  yongShen?: string;
  /**
   * 用神所落爻位 1–6（T153）
   * 关键词命中且六亲现于本卦 → 该爻；否则回落世爻
   */
  yongShenYao?: number;
  /**
   * 用神状态：静 | 动 | 化（T171）
   */
  yongShenStatus?: "静" | "动" | "化";
  /**
   * 问事类别（用户确认或规则推断 · T281）
   */
  questionCategory?: LiuyaoQuestionCategory;
  /**
   * 用户确认用神（六亲或「世」）；有值时优先于关键词
   */
  yongShenConfirm?: string;
  /**
   * 占时（ISO 或 YYYY-MM-DD[THH:mm]；T180）
   * 有值才可确定性计算日辰/月建/旬空
   */
  castAt?: string;
  /** 日干支，如「甲子」（T180） */
  dayGanZhi?: string;
  /** 月建地支（节气月支）（T180） */
  yueJian?: string;
  /** 日旬空亡两支（T180） */
  xunKong?: [string, string];
  /** 用神所落爻支是否落空（T180） */
  yongShenKong?: boolean;
  /**
   * 简单应期提示（中性；无恐吓）（T180）
   * 依赖动爻/用神支与日辰月建；无占时则为缺省说明
   */
  yingQiHint?: string;
  meta: LiuyaoChartMeta;
};

/** 八卦经卦（数据表用） */
export type TrigramName =
  | "乾"
  | "坤"
  | "震"
  | "巽"
  | "坎"
  | "离"
  | "艮"
  | "兑";

/** 六十四卦静态条目（卦辞/爻辞表） */
export type HexagramEntry = {
  /** 文王序 1–64 */
  index: number;
  /** 通行全名，如「乾为天」 */
  name: string;
  /** 单字或简称，如「乾」「屯」 */
  shortName: string;
  upper: TrigramName;
  lower: TrigramName;
  /**
   * 自下而上六爻阴阳：1=阳 0=阴，长度 6
   * 与装卦 binary 一致，供 T111 查表
   */
  binary: readonly [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1];
  /** 卦辞摘要（通行本意，中性） */
  guaci: string;
  /**
   * 六爻爻辞摘要，下标 0=初爻 … 5=上爻
   * 文首可带「初九」等称谓，内容为通行本摘要
   */
  yaoci: readonly [string, string, string, string, string, string];
};
