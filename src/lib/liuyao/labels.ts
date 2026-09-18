/**
 * 问事类别的展示文案（纯数据，零引擎依赖）。
 *
 * 提取原因（P1 体积优化）：此前该常量放在
 * `lib/liuyao/analyze/yongshen.ts`（322 行）中，而客户端组件
 * `CastForm.tsx` 只为渲染一个下拉框就 `import { CATEGORY_LABEL }`，
 * 导致整个六爻分析引擎（`analyze/` 下 13 个文件）被拖进
 * `/liuyao/new` 的首屏 bundle。
 *
 * 本模块**只依赖类型**，import 它不会引入任何引擎代码。
 * 请勿在此文件中添加对 analyze/ 或 cast/ 的 import。
 */

import type { LiuyaoQuestionCategory } from "@/lib/types/liuyao";

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
