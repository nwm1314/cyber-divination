"use client";

import type { ReactNode } from "react";
import { Card } from "./Card";

export type EmptyStateProps = {
  /** 空态标题，如「暂无八字档案」 */
  title: string;
  /** 标题下的一句说明（渲染为 Card 的 subtitle） */
  subtitle?: string;
  /** 正文补充说明；无 CTA 时不带下边距，与逐页手写版本像素一致 */
  hint?: ReactNode;
  /** 引导动作（通常是 Link + Button） */
  children?: ReactNode;
};

/**
 * 列表空态（B12）。
 *
 * 此前 5 个档案/历史页各自手写 `Card title="暂无…" subtitle=…` + 一段
 * `text-sm text-muted leading-relaxed` 正文 + 可选 CTA，结构完全同构。
 * 抽出来**不是为了改视觉**：仍渲染同一个 `Card`，间距按有无 CTA 区分，
 * 目的是让后续「空态加图标 / 统一 CTA 样式」只改一处。
 */
export function EmptyState({
  title,
  subtitle,
  hint,
  children,
}: EmptyStateProps) {
  return (
    <Card title={title} subtitle={subtitle}>
      {hint ? (
        <p
          className={
            children
              ? "text-sm text-muted mb-4 leading-relaxed"
              : "text-sm text-muted leading-relaxed"
          }
        >
          {hint}
        </p>
      ) : null}
      {children}
    </Card>
  );
}
