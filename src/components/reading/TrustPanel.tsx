"use client";

import type { RuleEvidence } from "@/lib/types";
import { Card } from "@/components/ui";

export type TrustPanelProps = {
  /** plain：仅关键限制；pro：流派/版本/证据 */
  viewMode?: "plain" | "pro";
  title?: string;
  school?: string;
  engineVersion?: string;
  skillRef?: string;
  warnings?: string[];
  evidence?: RuleEvidence[];
  /** 额外方法说明 */
  methodNote?: string;
};

/**
 * T292 · 可信度/方法说明
 * - 通俗模式：不隐藏关键限制（warnings + 方法边界）
 * - 专业模式：显示流派、引擎版本、evidence
 */
export function TrustPanel({
  viewMode = "plain",
  title = "方法与可信度",
  school,
  engineVersion,
  skillRef,
  warnings,
  evidence,
  methodNote,
}: TrustPanelProps) {
  const hasWarnings = Boolean(warnings?.length);
  const hasEvidence = Boolean(evidence?.length);
  const pro = viewMode === "pro";

  return (
    <Card title={title} glow="cyan">
      <div className="space-y-3 text-sm">
        <p className="text-xs text-muted leading-relaxed">
          排盘由确定性引擎计算；解读只组织语言。不承诺现实预测准确率。
          {methodNote ? ` ${methodNote}` : ""}
        </p>

        {(pro || school || engineVersion) && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {school ? (
              <div>
                <dt className="text-muted">流派 / 策略</dt>
                <dd className="text-foreground font-medium">{school}</dd>
              </div>
            ) : null}
            {engineVersion ? (
              <div>
                <dt className="text-muted">引擎版本</dt>
                <dd className="text-foreground font-mono">{engineVersion}</dd>
              </div>
            ) : null}
            {pro && skillRef ? (
              <div>
                <dt className="text-muted">规则源</dt>
                <dd className="text-foreground">{skillRef}</dd>
              </div>
            ) : null}
          </dl>
        )}

        {hasWarnings ? (
          <div>
            <h4 className="text-xs font-semibold text-danger mb-1">边界警告</h4>
            <ul className="space-y-1">
              {warnings!.map((w) => (
                <li
                  key={w}
                  className="text-xs text-danger/90 leading-relaxed flex gap-1.5"
                >
                  <span className="shrink-0">·</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted/70">当前无边界警告。</p>
        )}

        {pro && hasEvidence ? (
          <div>
            <h4 className="text-xs font-semibold text-gold mb-1">规则证据</h4>
            <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {evidence!.slice(0, 12).map((e) => (
                <li
                  key={`${e.ruleId}-${e.conclusion}`}
                  className="rounded-md border border-border/40 bg-surface/40 p-2 text-xs space-y-0.5"
                >
                  <div className="font-mono text-cyan/90">{e.ruleId}</div>
                  <div className="text-foreground/90">{e.conclusion}</div>
                  <div className="text-muted">
                    来源：{e.source}
                    {typeof e.confidence === "number"
                      ? ` · 置信 ${Math.round(e.confidence * 100)}%`
                      : ""}
                  </div>
                  {e.condition ? (
                    <div className="text-muted/70">条件：{e.condition}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {pro && !hasEvidence ? (
          <p className="text-xs text-muted/70">
            本盘暂无结构化 evidence（部分术数/旧缓存可能未带齐）。
          </p>
        ) : null}
      </div>
    </Card>
  );
}
