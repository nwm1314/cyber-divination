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
} as const;
