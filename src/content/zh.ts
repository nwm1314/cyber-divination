/** 全局静态中文文案 — 集中管理，各页面引用 */

export const DISCLAIMER =
  "本产品仅供传统文化学习与娱乐参考，不构成医疗、投资、法律或人生决策依据。健康问题请就医，财务请理性决策。命理分析仅供参考，人生在于自身的努力和选择。排盘由本地确定性引擎计算；解读（模板/LLM）只组织语言，不保证现实预测准确率。信息不完整或边界情况会给出警告，通俗模式亦不隐藏关键限制。";

/** 总品牌（多术数） */
export const BRAND = {
  name: "赛博命理",
  nameEn: "Cyber Divination",
  tagline: "专业排盘 · 典籍约束解读",
  heroLead: "把传统术数写成",
  heroAccent: "可读的赛博报告",
  heroDesc:
    "八字、紫微、六爻统一入口：确定性引擎排盘/装卦，再以规则模板或 LLM 生成解读。默认通俗，可切专业模式。",
  footer: "赛博命理 · 娱乐与爱好者兼顾",
  secondaryHint: "本地优先，数据默认留在本机。",
} as const;

export type ArtKey = "bazi" | "ziwei" | "liuyao";

export type ArtStatus = "live" | "coming";

export type ArtEntry = {
  key: ArtKey;
  /** 术数简称 */
  name: string;
  /** 子品牌 */
  product: string;
  description: string;
  /** 已上线路径；未上线为 null */
  href: string | null;
  status: ArtStatus;
  cta: string;
};

/** 首页术数入口 — status 控制可点 / 灰显「即将推出」 */
export const ARTS: readonly ArtEntry[] = [
  {
    key: "bazi",
    name: "八字",
    product: "赛博八字",
    description: "四柱、大运、流年；填盘 → 看盘 → 批命报告",
    href: "/chart/new",
    status: "live",
    cta: "开始排盘",
  },
  {
    key: "ziwei",
    name: "紫微",
    product: "赛博紫微",
    description: "十二宫主星与大限流年；整盘论命可视化",
    href: "/ziwei/new",
    status: "live",
    cta: "排紫微盘",
  },
  {
    key: "liuyao",
    name: "六爻",
    product: "赛博六爻",
    description: "一事一问起卦装卦；铜钱 / 时间 / 手动",
    href: "/liuyao/new",
    status: "live",
    cta: "起一卦",
  },
] as const;

export const HOME = {
  artsTitle: "选择术数",
  artsSubtitle: "已上线可直接进入；未上线显示即将推出",
  comingSoon: "即将推出",
  archives: "我的档案",
  settings: "设置",
  /** 术数卡片可用状态徽标 */
  available: "可用",
  /** 首页底部导航 */
  peopleLink: "人物档案",
  privacyLink: "隐私政策",
  accountLink: "账号",
} as const;

/** 通用无障碍与状态文案 */
export const A11Y = {
  skipToContent: "跳到主要内容",
  mainNavLabel: "术数导航",
  loading: "正在加载…",
  saving: "保存中…",
  syncing: "同步中…",
  deleting: "删除中…",
} as const;

/** 通用错误与空态文案（集中管理，避免各页硬编码） */
export const MESSAGES = {
  saveFailed: "保存失败，请检查填写内容后重试",
  saveFailedRetry: "保存失败，请稍后重试",
  rateLimited: "请求过于频繁，请稍后再试",
  cloudFailed: "云端操作失败，请确认已登录后重试",
  notFoundChart: "未找到命盘数据，请先完成排盘。",
  readingFailed: "解读生成失败，请稍后重试。",
  disclaimerTitle: "免责声明",
  disclaimerSubtitle: "请在使用前阅读",
} as const;

/**
 * 档案/历史页统一术语（P1 修复）。
 *
 * 此前三个术数的同类页面标题互不相同：
 * 「我的档案」/「紫微命盘」/「问卦历史」。
 * 现统一为「…档案」句式，仅保留术数名差异，便于用户建立一致心智。
 */
export const ARCHIVES = {
  baziTitle: "八字档案",
  ziweiTitle: "紫微档案",
  liuyaoTitle: "六爻档案",
  /** 通用返回无障碍标签 */
  backToArchives: "返回档案",
} as const;

/**
 * 新建盘时「复用人物档案」文案（B15 / IA-6）。
 *
 * 紫微向导此前只能整表手填，已建档案里的生辰无法带入，
 * 用户在同一台机器上会为同一个人重复输入相同字段。
 */
export const PERSON_PREFILL = {
  fieldLabel: "从人物档案带入",
  fieldHint: "选择已建档案可带入姓名与生辰，仍可逐项修改",
  manualOption: "手动填写（不使用档案）",
} as const;
