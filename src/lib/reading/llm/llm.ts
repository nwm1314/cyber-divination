import type {
  BaziChart,
  Gender,
  ReadingReport,
  ReadingSection,
  ViewMode,
} from "@/lib/types";
import { renderTemplateReading } from "@/lib/reading/template";
import { buildCalibratePrompts } from "@/lib/reading/template/analyze";
import { SECTION_KEYS, SECTION_TITLES, DISCLAIMER } from "@/lib/reading/sections";
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
import {
  attachTrustToBaziReport,
  ensureChartEvidenceOnAdvice,
} from "@/lib/reading/llm/evidence";

/** 嵌入 classical-texts 可执行摘要（对齐 bazi-skill） */
const CLASSICAL_RULES_SNIPPET = `
## 典籍硬规则摘要（须遵守）
1. 《穷通宝典》调候优先：冬生宜火、夏生宜水；日干×月令细则优先于笼统扶抑。
2. 《滴天髓》旺衰：得令最重，次看得地（通根）、得势（比劫印党众）；从强/从弱须顺势。
3. 《子平真诠》格局：以月令为提纲，看透干与用神清浊；忌伤官见官、枭神夺食等破格象。
4. 《渊海子平》十神六亲（须按性别取象）：正印母、偏财父；男命正财为妻星、女命正官为夫星；女命食伤为子女缘；比劫为兄弟姊妹。
5. 《千里命稿》：大运流年看是否助用神、冲合原局。
6. 《神峰通考》病药：命有所病，运药相济。
每章末可用「（据《××》风格）」标注出处风格；禁止编造卷页码与精确条文号。
`.trim();

function genderLabel(gender?: Gender): string {
  if (gender === "male") return "男命";
  if (gender === "female") return "女命";
  return "性别未注明（六亲取象请中性表述）";
}

function buildSystemPrompt(chart: BaziChart, gender?: Gender): string {
  const genderLine = genderLabel(gender);
  const liuqinRule =
    gender === "male"
      ? "本盘为男命：六亲以正印母、偏财父、正财/偏财看伴侣议题；食伤偏才艺表达。"
      : gender === "female"
        ? "本盘为女命：六亲以正印母、偏财父、正官/七杀看伴侣议题；食神/伤官看子女缘。"
        : "性别未注明：六亲与感情宜中性表述，勿武断套用男/女命专属取象。";

  const evidenceHint =
    chart.evidence && chart.evidence.length > 0
      ? `\n## 引擎规则证据（只可叙述，不可改写 ruleId/结论）\n\`\`\`json\n${JSON.stringify(chart.evidence.slice(0, 12), null, 2)}\n\`\`\``
      : "\n## 引擎规则证据\n当前命盘没有结构化 chart evidence；不得补造 ruleId、来源、结论或置信度。";

  return `你是一位精通中国传统命理学的资深专家，师承《穷通宝典》《三命通会》《滴天髓》《渊海子平》《千里命稿》《协纪辨方书》《子平真诠》《神峰通考》《果老星宗》九部经典。

## 核心原则
- 论命首重调候，次论格局旺衰
- 分析需有典籍风格依据；禁止伪造卷页码
- 禁止恐吓性、医疗或财务绝对断言（如「必定」「必死」「稳赚」）
- 语气中性、建设性，适合现代读者
- 所有输出使用简体中文
- 必须按档案性别区分六亲与感情建议（当前：${genderLine}）
- 只做叙事组织，不修改四柱/大运等引擎事实
- 每条材料性建议都要说明对应的盘面事实或 chart evidence；只在 evidence 的 condition 成立时适用
- 对没有 evidence、输入不完整或规则未覆盖之处明确写出不确定性，不能把趋势写成确定预测
- 保留文化学习/娱乐定位；健康问题请就医，财务决策请独立核验，不提供医疗或投资建议

${CLASSICAL_RULES_SNIPPET}

## 性别与六亲
- 档案性别：${genderLine}
- ${liuqinRule}
- 感情建议须建设性，不恐吓、不宿命论

## 当前命盘
\`\`\`json
${JSON.stringify(chart, null, 2)}
\`\`\`
${evidenceHint}

## 输出格式（优先）
请只输出一个 JSON 对象（可包在代码块中），结构：
{
  "sections": [
    { "key": "day_master", "body": "…", "styleCitations": ["穷通宝典"] },
    { "key": "ten_gods", "body": "…" },
    { "key": "wuxing", "body": "…" },
    { "key": "pattern", "body": "…" },
    { "key": "dayun", "body": "…" },
    { "key": "liunian", "body": "…" },
    { "key": "calibrate", "body": "…" },
    { "key": "advice", "body": "…" }
  ]
}
八个 key 必须齐全且 body 非空。不要输出 ruleId 或 evidence 数组。
advice 章必须包含：盘面依据、适用条件、不确定性，以及上述文化娱乐和医疗/财务边界；不得声称「必然」「稳赚」等确定结果。

若无法输出 JSON，则按以下八章纯文本依次分析（标题含章节名）：
1. 日主强弱与性格倾向
2. 十神与六亲要点
3. 五行平衡与喜用
4. 格局判定
5. 大运分析
6. 流年分析
7. 历史事件校准
8. 综合建议

各章需引用典籍风格，最后以"命理分析仅供参考，人生在于自身的努力和选择。"收尾。`;
}

export type LlmReadingResult = ReadingReport & {
  fallbackReason?: string;
  meta?: {
    model: string | null;
    usage: LlmUsage;
    llmDurationMs?: number;
    errorCode?: string;
    parseSource?: "json" | "text";
  };
};

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
  if (msg.startsWith("PARSE_")) {
    return msg.slice("PARSE_".length);
  }
  if (msg.includes("回落规则模板") || msg.includes("结构化")) {
    return msg;
  }
  return "LLM 调用失败，已回落规则模板。";
}

function buildSectionsFromParsed(
  parsed: { key: string; body: string; styleCitations?: string[] }[],
): ReadingSection[] {
  return SECTION_KEYS.map((key) => {
    const p = parsed.find((s) => s.key === key)!;
    return {
      key,
      title: SECTION_TITLES[key],
      body: p.body,
      citations: p.styleCitations,
    };
  });
}

export type LlmReadingOptions = {
  viewMode?: ViewMode;
  gender?: Gender;
  requestId?: string;
};

function withTrust(report: LlmReadingResult, chart: BaziChart): LlmReadingResult {
  const withEvidence = ensureChartEvidenceOnAdvice(report, chart);
  return { ...attachTrustToBaziReport(withEvidence, chart), meta: report.meta };
}

export async function llmReading(
  chart: BaziChart,
  viewModeOrOptions: ViewMode | LlmReadingOptions = "plain",
): Promise<LlmReadingResult> {
  const options: LlmReadingOptions =
    typeof viewModeOrOptions === "string"
      ? { viewMode: viewModeOrOptions }
      : viewModeOrOptions;
  const viewMode: ViewMode = options.viewMode ?? "plain";
  const gender = options.gender;
  const requestId = options.requestId ?? "bazi-local";
  const model = getLlmModel();

  if (!isLlmConfigured()) {
    logApi("info", "llm.reading.fallback", {
      requestId,
      route: "llm.reading.bazi",
      art: "bazi",
      model,
      durationMs: 0,
      fallback: true,
      errorCode: "LLM_NOT_CONFIGURED",
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    });
    const fallback = renderTemplateReading(chart, {
      viewMode,
      chartId: chart.profileId,
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
    const systemPrompt = buildSystemPrompt(chart, gender);
    const tone =
      viewMode === "plain"
        ? "请用通俗白话写，少用术语；必要时括号内给一句术语对照。"
        : "可用专业术语，并简要标注典籍风格依据。";
    const genderNote = genderLabel(gender);
    const userMessage = `请为以下命盘生成完整的八章解读报告（优先 JSON）。${tone}\n\n档案性别：${genderNote}\n日主：${chart.dayMaster}\n四柱：${chart.pillars.year.stem}${chart.pillars.year.branch} / ${chart.pillars.month.stem}${chart.pillars.month.branch} / ${chart.pillars.day.stem}${chart.pillars.day.branch}${chart.pillars.hour ? ` / ${chart.pillars.hour.stem}${chart.pillars.hour.branch}` : "（时辰未知）"}`;

    const chat = await chatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      { art: "bazi", requestId },
    );

    const parsed = parseLlmReadingContent(
      chat.content,
      SECTION_KEYS,
      SECTION_TITLES,
    );

    if (!parsed.ok) {
      throw new Error(`PARSE_${parsed.reason}`);
    }

    const sections = buildSectionsFromParsed(parsed.sections);
    const calibratePrompts = buildCalibratePrompts(chart);

    return withTrust(
      {
        chartId: chart.profileId,
        mode: "llm",
        viewMode,
        sections,
        calibratePrompts,
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
      route: "llm.reading.bazi",
      art: "bazi",
      model,
      durationMs: 0,
      fallback: true,
      errorCode: parseFail ? "LLM_PARSE_REJECT" : errorCode,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    });
    const fallback = renderTemplateReading(chart, {
      viewMode,
      chartId: chart.profileId,
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
