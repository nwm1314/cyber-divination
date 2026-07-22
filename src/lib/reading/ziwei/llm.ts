import type {
  Gender,
  ViewMode,
  ZiweiChart,
  ZiweiReadingReport,
  ZiweiReadingSection,
} from "@/lib/types";
import {
  DISCLAIMER,
  ZIWEI_SECTION_KEYS,
  ZIWEI_SECTION_TITLES,
} from "./sections";
import { renderZiweiTemplateReading } from "./template";
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
import { attachTrustToZiweiReport } from "@/lib/reading/llm/evidence";

function genderLabel(gender?: Gender): string {
  if (gender === "male") return "男命";
  if (gender === "female") return "女命";
  return "性别未注明";
}

function buildSystemPrompt(chart: ZiweiChart, gender?: Gender): string {
  const g = genderLabel(gender);
  return `你是熟悉紫微斗数三合派常识的中文撰稿助手，为学习与文化娱乐撰写命盘摘要。

## 原则
- 全部使用简体中文
- 语气中性、建设性，禁止恐吓、医疗断言、投资保证、宿命论断语
- 禁止「必定」「必死」「稳赚」等绝对断言
- 不编造引擎未给出的星曜；信息不足时明确说明「待补全」
- 禁止伪造典籍卷页码
- 当前档案：${g}

## 命盘 JSON
\`\`\`json
${JSON.stringify(chart, null, 2)}
\`\`\`

## 输出格式（优先 JSON）
{
  "sections": [
    { "key": "overview", "body": "…" },
    { "key": "ming_gong", "body": "…" },
    { "key": "career", "body": "…" },
    { "key": "wealth", "body": "…" },
    { "key": "relationship", "body": "…" },
    { "key": "luck", "body": "…" },
    { "key": "advice", "body": "…" },
    { "key": "disclaimer", "body": "本产品仅供传统文化学习与娱乐参考…" }
  ]
}
八个 key 必须齐全。不要输出 ruleId。

若无法 JSON，则按 8 章纯文本（标题含章节名）：
1. 命盘总览
2. 命宫解读
3. 事业宫（官禄）
4. 财帛宫
5. 感情宫（夫妻）
6. 大限与运限
7. 综合建议
8. 免责声明`;
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

export type ZiweiLlmReadingOptions = {
  viewMode?: ViewMode;
  gender?: Gender;
  chartId?: string;
  requestId?: string;
};

export type ZiweiLlmReadingResult = ZiweiReadingReport & {
  meta?: {
    model: string | null;
    usage: LlmUsage;
    llmDurationMs?: number;
    errorCode?: string;
    parseSource?: "json" | "text";
  };
};

function withTrust(
  report: ZiweiLlmReadingResult,
  chart: ZiweiChart,
): ZiweiLlmReadingResult {
  return { ...attachTrustToZiweiReport(report, chart), meta: report.meta };
}

export async function llmZiweiReading(
  chart: ZiweiChart,
  viewModeOrOptions: ViewMode | ZiweiLlmReadingOptions = "plain",
): Promise<ZiweiLlmReadingResult> {
  const options: ZiweiLlmReadingOptions =
    typeof viewModeOrOptions === "string"
      ? { viewMode: viewModeOrOptions }
      : viewModeOrOptions;
  const viewMode: ViewMode = options.viewMode ?? "plain";
  const gender = options.gender;
  const chartId = options.chartId ?? chart.id;
  const requestId = options.requestId ?? "ziwei-local";
  const model = getLlmModel();

  if (!isLlmConfigured()) {
    logApi("info", "llm.reading.fallback", {
      requestId,
      route: "llm.reading.ziwei",
      art: "ziwei",
      model,
      durationMs: 0,
      fallback: true,
      errorCode: "LLM_NOT_CONFIGURED",
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    });
    const fallback = renderZiweiTemplateReading(chart, {
      viewMode,
      chartId,
      gender,
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
        ? "请用通俗白话，少用术语。"
        : "可用专业术语，并注明「宜同参三方四正」等提醒。";
    const chat = await chatCompletion(
      [
        { role: "system", content: buildSystemPrompt(chart, gender) },
        {
          role: "user",
          content: `请为该紫微盘生成完整八章报告（优先 JSON）。${tone}\n档案性别：${genderLabel(gender)}\n命宫：${chart.mingGong}；身宫：${chart.shenGong}；五行局：${chart.wuxingJu ?? "未知"}。`,
        },
      ],
      { art: "ziwei", requestId },
    );

    const parsed = parseLlmReadingContent(
      chat.content,
      ZIWEI_SECTION_KEYS,
      ZIWEI_SECTION_TITLES,
    );
    if (!parsed.ok) {
      throw new Error(`PARSE_${parsed.reason}`);
    }

    const sections: ZiweiReadingSection[] = ZIWEI_SECTION_KEYS.map((key) => {
      const p = parsed.sections.find((s) => s.key === key)!;
      return {
        key,
        title: ZIWEI_SECTION_TITLES[key],
        body: key === "disclaimer" ? DISCLAIMER : p.body,
        citations: p.styleCitations,
      };
    });

    return withTrust(
      {
        chartId,
        kind: "ziwei",
        mode: "llm",
        viewMode,
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
      route: "llm.reading.ziwei",
      art: "ziwei",
      model,
      durationMs: 0,
      fallback: true,
      errorCode: parseFail ? "LLM_PARSE_REJECT" : errorCode,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    });
    const fallback = renderZiweiTemplateReading(chart, {
      viewMode,
      chartId,
      gender,
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
