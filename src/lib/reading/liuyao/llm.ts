import type {
  LiuyaoChart,
  LiuyaoReadingReport,
  LiuyaoReadingSection,
  ViewMode,
} from "@/lib/types";
import {
  DISCLAIMER,
  LIUYAO_SECTION_KEYS,
  LIUYAO_SECTION_TITLES,
} from "./sections";
import { renderLiuyaoTemplateReading } from "./template";
import { isLlmConfigured } from "@/lib/reading/llm/config";
import {
  chatCompletion,
  emptyUsage,
  getLlmModel,
  llmErrorCode,
  type LlmUsage,
} from "@/lib/reading/llm/client";
import { logApi } from "@/lib/api/logger";
import { parseLlmReadingContent } from "@/lib/reading/llm/parse";
import { attachTrustToLiuyaoReport } from "@/lib/reading/llm/evidence";

function buildSystemPrompt(chart: LiuyaoChart): string {
  return `你是熟悉《周易》与六爻常识的中文撰稿助手，为学习与文化娱乐撰写「针对所问」的解卦摘要。

## 原则
- 全部使用简体中文
- 语气中性、建设性，禁止恐吓、医疗断言、投资保证、宿命论断语
- 禁止「必定」「必死」「稳赚」等绝对断言
- 强调「一事一问」：报告只围绕 chart.question
- 不编造引擎未给出的世应/用神；信息不足时明确说明「待补全」
- 禁止伪造典籍卷页码
- 若 shiYao/yingYao 为 0 或缺失，勿强行定世应

## 卦盘 JSON
\`\`\`json
${JSON.stringify(chart, null, 2)}
\`\`\`

## 输出格式（优先 JSON）
{
  "sections": [
    { "key": "question", "body": "…" },
    { "key": "ben_gua", "body": "…" },
    { "key": "changing", "body": "…" },
    { "key": "shi_ying", "body": "…" },
    { "key": "judgment", "body": "…" },
    { "key": "advice", "body": "…" },
    { "key": "disclaimer", "body": "本产品仅供传统文化学习与娱乐参考…" }
  ]
}
七个 key 必须齐全。不要输出 ruleId。

若无法 JSON，则按 7 章纯文本（标题含章节名）：
1. 所问事项
2. 本卦概览
3. 动爻与变卦
4. 世应要点
5. 易理判断
6. 行动建议
7. 免责声明`;
}

function sanitizeFallbackReason(err: unknown): string {
  const msg = err instanceof Error ? err.message : "LLM 调用失败";
  if (msg.startsWith("LLM_HTTP_")) {
    return `上游服务返回 ${msg.replace("LLM_HTTP_", "")}，已回落规则模板。`;
  }
  if (msg === "LLM_EMPTY") {
    return "模型返回空内容，已回落规则模板。";
  }
  if (msg.includes("not configured") || msg.includes("LLM_API_KEY")) {
    return "未配置 LLM_API_KEY，已使用规则模板。";
  }
  if (msg === "LLM_NETWORK") {
    return "网络异常，已回落规则模板。";
  }
  if (msg.startsWith("PARSE_")) return msg.slice("PARSE_".length);
  return "LLM 调用失败，已回落规则模板。";
}

export type LiuyaoLlmReadingOptions = {
  viewMode?: ViewMode;
  chartId?: string;
  requestId?: string;
};

export type LiuyaoLlmReadingResult = LiuyaoReadingReport & {
  meta?: {
    model: string | null;
    usage: LlmUsage;
    llmDurationMs?: number;
    errorCode?: string;
    parseSource?: "json" | "text";
  };
};

function withTrust(
  report: LiuyaoLlmReadingResult,
  chart: LiuyaoChart,
): LiuyaoLlmReadingResult {
  return { ...attachTrustToLiuyaoReport(report, chart), meta: report.meta };
}

export async function llmLiuyaoReading(
  chart: LiuyaoChart,
  viewModeOrOptions: ViewMode | LiuyaoLlmReadingOptions = "plain",
): Promise<LiuyaoLlmReadingResult> {
  const options: LiuyaoLlmReadingOptions =
    typeof viewModeOrOptions === "string"
      ? { viewMode: viewModeOrOptions }
      : viewModeOrOptions;
  const viewMode: ViewMode = options.viewMode ?? "plain";
  const chartId = options.chartId ?? chart.id;
  const requestId = options.requestId ?? "liuyao-local";
  const model = getLlmModel();

  if (!isLlmConfigured()) {
    logApi("info", "llm.reading.fallback", {
      requestId,
      route: "llm.reading.liuyao",
      art: "liuyao",
      model,
      durationMs: 0,
      fallback: true,
      errorCode: "LLM_NOT_CONFIGURED",
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    });
    const fallback = renderLiuyaoTemplateReading(chart, {
      viewMode,
      chartId,
    });
    return withTrust(
      {
        ...fallback,
        mode: "llm",
        fallback: true,
        fallbackReason:
          "未配置 LLM_API_KEY，已使用规则模板。请在项目根目录创建 .env.local 并填写 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL 后重启 dev。",
        meta: {
          model,
          usage: emptyUsage(),
          errorCode: "LLM_NOT_CONFIGURED",
        },
      },
      chart,
    );
  }

  try {
    const tone =
      viewMode === "plain"
        ? "请用通俗白话，少用术语；强调一事一问。"
        : "可用专业术语，并注明「宜同参动变与世应」等提醒；强调一事一问。";
    const chat = await chatCompletion(
      [
        { role: "system", content: buildSystemPrompt(chart) },
        {
          role: "user",
          content: `请为该六爻盘生成完整七章解卦报告（优先 JSON）。${tone}\n所问：${chart.question}\n本卦：${chart.benGua.name}（上${chart.benGua.upper}下${chart.benGua.lower}）${chart.bianGua ? `；变卦：${chart.bianGua.name}` : "；无变卦"}。`,
        },
      ],
      { art: "liuyao", requestId },
    );

    const parsed = parseLlmReadingContent(
      chat.content,
      LIUYAO_SECTION_KEYS,
      LIUYAO_SECTION_TITLES,
    );
    if (!parsed.ok) {
      throw new Error(`PARSE_${parsed.reason}`);
    }

    const sections: LiuyaoReadingSection[] = LIUYAO_SECTION_KEYS.map((key) => {
      const p = parsed.sections.find((s) => s.key === key)!;
      return {
        key,
        title: LIUYAO_SECTION_TITLES[key],
        body: key === "disclaimer" ? DISCLAIMER : p.body,
        citations: p.styleCitations,
      };
    });

    return withTrust(
      {
        chartId,
        kind: "liuyao",
        mode: "llm",
        viewMode,
        question: chart.question,
        sections,
        disclaimer: DISCLAIMER,
        fallback: false,
        meta: {
          model: chat.model,
          usage: chat.usage,
          llmDurationMs: chat.durationMs,
          parseSource: parsed.source,
        },
      },
      chart,
    );
  } catch (err) {
    const errorCode = llmErrorCode(err);
    const parseFail =
      err instanceof Error && err.message.startsWith("PARSE_");
    logApi("warn", "llm.reading.fallback", {
      requestId,
      route: "llm.reading.liuyao",
      art: "liuyao",
      model,
      durationMs: 0,
      fallback: true,
      errorCode: parseFail ? "LLM_PARSE_REJECT" : errorCode,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    });
    const fallback = renderLiuyaoTemplateReading(chart, {
      viewMode,
      chartId,
    });
    return withTrust(
      {
        ...fallback,
        mode: "llm",
        fallback: true,
        fallbackReason: sanitizeFallbackReason(err),
        meta: {
          model,
          usage: emptyUsage(),
          errorCode: parseFail ? "LLM_PARSE_REJECT" : errorCode,
        },
      },
      chart,
    );
  }
}
