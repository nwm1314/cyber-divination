"use client";

import type { RuleEvidence } from "@/lib/types";
import { Card } from "@/components/ui";

export type TrustPanelProps = {
  /** plain：仅关键限制；pro：流派/版本/证据全部展开 */
  viewMode?: "plain" | "pro";
  title?: string;
  school?: string;
  engineVersion?: string;
  skillRef?: string;
  warnings?: string[];
  evidence?: RuleEvidence[];
  /** 额外方法说明 */
  methodNote?: string;
  /**
   * 输入指纹（GAP-5）。
   *
   * 展示给用户后可自证「同一输入 → 同一个盘」：两次排盘若指纹一致，
   * 说明输入与算法版本都未被改动。
   */
  inputFingerprint?: string;
};

/**
 * T292 · 可信度/方法说明
 *
 * - 通俗模式：关键限制（warnings + 方法边界）**始终可见**；
 *   规则证据（evidence）以折叠入口提供，默认收起、点击展开。
 * - 专业模式：流派、引擎版本、evidence 全部直接展开。
 *
 * 修复（P2 A1）：此前 evidence 仅在 `pro && hasEvidence` 时渲染，
 * 通俗模式下用户完全看不到规则来源——而通俗模式是默认路径，
 * 这使「规则可溯源」这一信任机制在默认路径上失效。
 * 现改为默认模式也提供折叠入口（用原生 <details> 保证键盘可达性）。
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
  inputFingerprint,
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

        <div className="rounded-md border border-border/40 bg-surface/30 p-2 text-xs text-muted leading-relaxed">
          <h4 className="font-semibold text-foreground/80 mb-1">
            适用范围与不确定性
          </h4>
          <p>
            建议仅适用于当前命盘输入及下方列出的 chart evidence 条件；输入不完整、规则未覆盖或现实环境变化，都可能影响实际结果。
            本产品仅供传统文化学习与娱乐参考；健康问题请就医，财务决策请独立核验，不构成医疗或投资建议。
          </p>
        </div>

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

        {inputFingerprint ? (
          <div className="text-xs">
            <span className="text-muted">输入指纹：</span>
            <span
              className="font-mono text-foreground/90 break-all"
              title="同一输入始终得到同一指纹；指纹变化说明输入或规则集发生了变化"
            >
              {inputFingerprint}
            </span>
          </div>
        ) : null}

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
          // 修复（P2 A2）：原为「当前无边界警告。」——在无证据/未做完整
          // 边界检查时，这句话会制造**虚假安心**。改为陈述本盘的实际状态，
          // 并明确「无警告 ≠ 无风险」。
          <p className="text-xs text-muted/90">
            本盘未触发已知边界警告；这不表示结论没有不确定性，实际判断仍需结合现实情况。
          </p>
        )}

        {/* 证据链：专业模式直接展开；通俗模式提供折叠入口（键盘可达） */}
        {hasEvidence && !pro ? (
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold text-gold hover:text-gold/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan rounded">
              查看盘面规则证据（{evidence!.length} 条）
            </summary>
            <EvidenceList items={evidence!} />
          </details>
        ) : null}

        {pro && hasEvidence ? (
          <div>
            <h4 className="text-xs font-semibold text-gold mb-1">
              盘面规则证据（chart evidence）
            </h4>
            <EvidenceList items={evidence!} />
          </div>
        ) : null}

        {pro && !hasEvidence ? (
          <p className="text-xs text-muted/90">
            本盘暂无结构化 evidence（部分术数/旧缓存可能未带齐）。
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function EvidenceList({ items }: { items: RuleEvidence[] }) {
  return (
    <ul className="space-y-2 max-h-48 overflow-y-auto pr-1 mt-2">
      {items.slice(0, 12).map((e) => (
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
            <div className="text-muted/90">适用条件：{e.condition}</div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
