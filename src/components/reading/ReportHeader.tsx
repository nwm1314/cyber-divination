import type { ReadingMode, ViewMode } from "@/lib/types";
import Link from "next/link";
import { ViewToggle } from "@/components/chart";

type Props = {
  chartId: string;
  mode: ReadingMode;
  fallback?: boolean;
  fallbackReason?: string;
  onModeChange: (mode: ReadingMode) => void;
  /** 通俗 / 专业 */
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  /**
   * 是否已配置 LLM（来自 GET /api/reading/status）。
   * null = 探测中；false = 禁用 LLM 按钮。
   */
  llmConfigured?: boolean | null;
  /** 返回命盘链接，默认八字 `/chart/[id]` */
  backHref?: string;
  /** 标题，默认「综合解读报告」 */
  title?: string;
};

const MODE_OPTIONS: { value: ReadingMode; label: string }[] = [
  { value: "template", label: "模板" },
  { value: "llm", label: "LLM" },
];

const MODE_BADGE: Record<string, { label: string; cls: string }> = {
  template: { label: "模板", cls: "bg-gold/15 text-gold border-gold/30" },
  llm: { label: "LLM 已生成", cls: "bg-cyan/15 text-cyan border-cyan/30" },
  fallback: {
    label: "LLM 未生效·已回落模板",
    cls: "bg-amber-400/15 text-amber-400 border-amber-400/30",
  },
};

const LLM_SETUP_HINT =
  "未配置 LLM：请在项目根目录创建 .env.local，填写 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL 后重启 dev。排盘不依赖 LLM；仅「解读」可选 LLM。";

export function ReportHeader({
  chartId,
  mode,
  fallback,
  fallbackReason,
  onModeChange,
  viewMode,
  onViewModeChange,
  llmConfigured = null,
  backHref,
  title = "综合解读报告",
}: Props) {
  const badgeKey =
    mode === "llm" && fallback ? "fallback" : mode === "llm" ? "llm" : "template";
  const badge = MODE_BADGE[badgeKey];
  const href = backHref ?? `/chart/${chartId}`;
  const llmDisabled = llmConfigured !== true;

  return (
    <div className="space-y-2 pt-2 w-full min-w-0">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          href={href}
          className="text-xs text-muted hover:text-gold transition-colors shrink-0"
        >
          ← 返回命盘
        </Link>
        <h1 className="text-lg font-bold tracking-wider text-gold min-w-0 break-words">
          {title}
        </h1>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${badge.cls}`}
        >
          {badge.label}
        </span>

        {/* 双切换同一工具条：模板|LLM + 通俗|专业 */}
        <div
          className="flex flex-wrap items-center gap-2 ml-auto shrink-0"
          role="toolbar"
          aria-label="解读模式与视图"
        >
          <div
            className="inline-flex rounded-lg border border-border overflow-hidden"
            role="tablist"
            aria-label="模板/LLM 模式"
          >
            {MODE_OPTIONS.map((opt) => {
              const active = mode === opt.value;
              const isLlm = opt.value === "llm";
              const disabled = isLlm && llmDisabled;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={disabled}
                  title={
                    disabled
                      ? "未配置 LLM_API_KEY，请见 .env.local"
                      : undefined
                  }
                  onClick={() => {
                    if (disabled) return;
                    onModeChange(opt.value);
                  }}
                  className={`px-4 py-1.5 text-xs font-medium transition-all ${
                    disabled
                      ? "bg-surface text-muted/50 cursor-not-allowed opacity-60"
                      : active
                        ? "bg-gold text-background shadow-[inset_0_0_8px_var(--gold-glow)]"
                        : "bg-surface text-muted hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <ViewToggle value={viewMode} onChange={onViewModeChange} />
        </div>
      </header>

      {llmDisabled ? (
        <p className="text-xs text-muted leading-relaxed border border-border/60 rounded-lg px-3 py-2 bg-surface/50">
          {LLM_SETUP_HINT}
        </p>
      ) : null}

      {mode === "llm" && fallback && fallbackReason ? (
        <p className="text-xs text-amber-400/90 leading-relaxed border border-amber-400/25 rounded-lg px-3 py-2 bg-amber-400/5">
          {fallbackReason}
        </p>
      ) : null}
      {mode === "llm" && !fallback && llmConfigured === true ? (
        <p className="text-[10px] text-muted">
          当前为 LLM 生成正文；与模板切换对比时内容应明显不同。
        </p>
      ) : null}
    </div>
  );
}
