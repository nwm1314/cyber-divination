/**
 * 用神规则表（按所问类别关键词 → 六亲类型 → 落爻）
 * 确定性、表驱动；未命中或六亲不现则取「世」
 *
 * T153：关键词命中后尽量绑定爻位（依赖本卦六亲安爻）
 * T171：事类扩展 + 可选性别（婚恋男/女命取用差异）
 */

import type {
  LiuyaoQuestionCategory,
  YaoPosition,
} from "@/lib/types/liuyao";
import {
  assignLiuqin,
  pickLiuqinYao,
  type Liuqin,
  type YaoLiuqin,
} from "./liuqin";
import type { Binary6 } from "./palaces";

export type YongShenGender = "male" | "female";

export type YongShenRule = {
  /** 规则 id，便于测试 */
  id: string;
  /** 问事类别（与 UI 确认字段对齐） */
  category: LiuyaoQuestionCategory;
  /** 匹配所问 */
  pattern: RegExp;
  /** 默认用神六亲 */
  yongShen: Liuqin;
  /**
   * 可选：按性别覆盖六亲（婚恋等）
   * 未传 gender 时用 yongShen
   */
  byGender?: Partial<Record<YongShenGender, Liuqin>>;
};

/** 类别 → 默认六亲（用户确认类别时用） */
export const CATEGORY_YONGSHEN: Readonly<
  Record<LiuyaoQuestionCategory, Liuqin | "世">
> = {
  wealth: "妻财",
  career: "官鬼",
  lawsuit: "官鬼",
  marriage: "妻财",
  health: "官鬼",
  travel: "父母",
  parents: "父母",
  offspring: "子孙",
  siblings: "兄弟",
  self: "世",
  other: "世",
} as const;

export const CATEGORY_LABEL: Readonly<
  Record<LiuyaoQuestionCategory, string>
> = {
  wealth: "求财",
  career: "功名事业",
  lawsuit: "官非诉讼",
  marriage: "婚恋感情",
  health: "健康疾病",
  travel: "出行迁移",
  parents: "父母文书房产",
  offspring: "子女晚辈",
  siblings: "兄弟朋友合伙",
  self: "自身/综合",
  other: "其他（取世）",
} as const;

/** 先匹配先生效；顺序即优先级 */
export const YONGSHEN_RULES: readonly YongShenRule[] = [
  {
    id: "wealth",
    category: "wealth",
    pattern: /财|钱|生意|投资|求财|进账|收入|利润|买卖|赌|贷款|回款|房价/,
    yongShen: "妻财",
  },
  {
    id: "career",
    category: "career",
    pattern: /官|职|升|考|功名|仕途|工作|求职|仕|晋升|录取|面试|跳槽|职称|编制/,
    yongShen: "官鬼",
  },
  {
    id: "lawsuit",
    category: "lawsuit",
    pattern: /讼|官司|纠纷|起诉|被告|原告|仲裁|维权|违法/,
    yongShen: "官鬼",
  },
  {
    id: "marriage",
    category: "marriage",
    pattern: /婚|恋|配|感情|桃花|对象|配偶|分手|复合|相亲|男友|女友|丈夫|妻子/,
    yongShen: "妻财",
    // 学习向通行：男问妻财、女问官鬼；无性别时保持妻财（兼容旧金标准）
    byGender: { male: "妻财", female: "官鬼" },
  },
  {
    id: "health",
    category: "health",
    pattern: /病|疾|健康|医|伤|痛|手术|身体|康复|检查/,
    yongShen: "官鬼",
  },
  {
    id: "travel",
    category: "travel",
    pattern: /行|出行|旅|出差|迁移|搬家|远行|航班|车程/,
    yongShen: "父母",
  },
  {
    id: "parents",
    category: "parents",
    pattern: /父|母|长辈|文书|合同|房|屋|车|证照|信息|消息|邮件/,
    yongShen: "父母",
  },
  {
    id: "offspring",
    category: "offspring",
    pattern: /子|女|晚辈|学生|宠物|孕|胎|小孩|孩子/,
    yongShen: "子孙",
  },
  {
    id: "siblings",
    category: "siblings",
    pattern: /兄|弟|姐|妹|友|合伙|竞争|同事|搭档|朋友/,
    yongShen: "兄弟",
  },
] as const;

export const DEFAULT_YONGSHEN = "世";

export type YongShenKind = Liuqin | typeof DEFAULT_YONGSHEN;

/** 用神解析结果（含可选爻位） */
export type YongShenResolved = {
  /** 展示/兼容字段：六亲名或「世」 */
  yongShen: YongShenKind;
  /** 规则 id；默认世时为 default；用户确认为 confirm */
  ruleId: string;
  /** 落爻 1–6；默认世时为世爻 */
  yao: YaoPosition;
  /** 是否回落到世（未命中关键词，或六亲不现） */
  fallbackShi: boolean;
  /** 推断或确认的问事类别 */
  category?: LiuyaoQuestionCategory;
  /** 是否来自用户确认 */
  fromConfirm?: boolean;
};

export type ResolveYongShenContext = {
  /** 本卦 binary（自下而上） */
  binary: Binary6 | string;
  shiYao: YaoPosition;
  /** 动爻位，用于用神多现时优先动爻 */
  dongYao?: readonly YaoPosition[];
  /** 已算好的六亲（可复用，避免重复） */
  liuqinRows?: readonly YaoLiuqin[];
  /**
   * 问事者性别（可选；仅影响 byGender 规则）
   * 也可从问题文本启发式：男/女命、我是男/女
   */
  gender?: YongShenGender;
  /** 用户确认的问事类别（优先于关键词） */
  questionCategory?: LiuyaoQuestionCategory;
  /** 用户确认的用神（六亲或「世」；最高优先级） */
  yongShenConfirm?: string;
};

function inferGenderFromQuestion(q: string): YongShenGender | undefined {
  if (/女命|我是女|女方问|女测/.test(q)) return "female";
  if (/男命|我是男|男方问|男测/.test(q)) return "male";
  return undefined;
}

function pickKind(
  rule: YongShenRule,
  gender?: YongShenGender,
): Liuqin {
  if (gender && rule.byGender?.[gender]) {
    return rule.byGender[gender]!;
  }
  return rule.yongShen;
}

const LIUQIN_SET = new Set<string>([
  "父母",
  "兄弟",
  "子孙",
  "妻财",
  "官鬼",
  "世",
]);

/** 由关键词推断问事类别 */
export function inferQuestionCategory(
  question: string,
): LiuyaoQuestionCategory | undefined {
  const q = question.trim();
  if (!q) return undefined;
  for (const rule of YONGSHEN_RULES) {
    if (rule.pattern.test(q)) return rule.category;
  }
  return undefined;
}

/** 仅按所问取六亲类型（不含爻位；兼容旧 API） */
export function resolveYongShenKind(
  question: string,
  gender?: YongShenGender,
  opts?: {
    questionCategory?: LiuyaoQuestionCategory;
    yongShenConfirm?: string;
  },
): {
  kind: YongShenKind;
  ruleId: string;
  category?: LiuyaoQuestionCategory;
  fromConfirm?: boolean;
} {
  const confirm = opts?.yongShenConfirm?.trim();
  if (confirm && LIUQIN_SET.has(confirm)) {
    return {
      kind: confirm as YongShenKind,
      ruleId: "confirm",
      category: opts?.questionCategory ?? inferQuestionCategory(question),
      fromConfirm: true,
    };
  }

  const cat = opts?.questionCategory;
  if (cat) {
    const kind = CATEGORY_YONGSHEN[cat];
    const g = gender ?? inferGenderFromQuestion(question);
    if (cat === "marriage" && g) {
      const rule = YONGSHEN_RULES.find((r) => r.id === "marriage")!;
      return {
        kind: pickKind(rule, g),
        ruleId: "category-marriage",
        category: cat,
      };
    }
    return {
      kind,
      ruleId: `category-${cat}`,
      category: cat,
    };
  }

  const q = question.trim();
  if (!q) return { kind: DEFAULT_YONGSHEN, ruleId: "default" };
  const g = gender ?? inferGenderFromQuestion(q);
  for (const rule of YONGSHEN_RULES) {
    if (rule.pattern.test(q)) {
      return {
        kind: pickKind(rule, g),
        ruleId: rule.id,
        category: rule.category,
      };
    }
  }
  return { kind: DEFAULT_YONGSHEN, ruleId: "default", category: "other" };
}

/**
 * 按所问事项取用神标签（简化表）
 * 兼容：仅返回「妻财」|「官鬼」|…|「世」，不含爻位
 */
export function resolveYongShen(question: string): string {
  return resolveYongShenKind(question).kind;
}

/**
 * 用神落爻：确认/类别/关键词 → 六亲 → 本卦爻位；不现/未命中 → 世爻
 */
export function resolveYongShenDetail(
  question: string,
  ctx: ResolveYongShenContext,
): YongShenResolved {
  const { kind, ruleId, category, fromConfirm } = resolveYongShenKind(
    question,
    ctx.gender,
    {
      questionCategory: ctx.questionCategory,
      yongShenConfirm: ctx.yongShenConfirm,
    },
  );
  const shi = ctx.shiYao;

  if (kind === DEFAULT_YONGSHEN) {
    return {
      yongShen: DEFAULT_YONGSHEN,
      ruleId,
      yao: shi,
      fallbackShi: true,
      category,
      fromConfirm,
    };
  }

  const rows = ctx.liuqinRows ?? assignLiuqin(ctx.binary);
  const yao = pickLiuqinYao(rows, kind, ctx.dongYao);
  if (yao == null) {
    return {
      yongShen: kind,
      ruleId,
      yao: shi,
      fallbackShi: true,
      category,
      fromConfirm,
    };
  }
  return {
    yongShen: kind,
    ruleId,
    yao,
    fallbackShi: false,
    category,
    fromConfirm,
  };
}
