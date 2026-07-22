import type {
  CalibratePrompt,
  ReadingReport,
  ReadingSection,
  ReadingSectionKey,
} from "@/lib/types";

export type CalibrateAccuracy = "accurate" | "partial" | "inaccurate";

export type CalibrateAnswer = {
  promptIndex: number;
  accuracy: CalibrateAccuracy;
  /** 用户备注：默认仅本地展示，不外发 LLM */
  note?: string;
  /** 显式同意外发备注（默认 false） */
  shareNoteExternally?: boolean;
};

export type CalibrationData = {
  chartId: string;
  answers: CalibrateAnswer[];
};

export type CalibrationSummary = {
  emphasisNote: string;
  sectionTags: Partial<Record<ReadingSectionKey, string>>;
  /** 说明反馈边界，供 UI 展示 */
  policyNote: string;
};

/** 反馈策略说明（T291） */
export const CALIBRATION_POLICY_NOTE =
  "经历反馈只影响报告文案侧重与阅读提示，不会改变四柱、大运、流年等排盘事实，也不会修改核心用神/格局规则或提高命盘「准确率」。敏感备注默认仅保存在本机，不会发送给外部模型。";

function mergeTag(
  existing: string | undefined,
  next: CalibrateAccuracy,
): string {
  if (next === "accurate") {
    return existing === "inaccurate" ? "partial" : "accurate";
  }
  if (next === "inaccurate") {
    return existing === "accurate" ? "partial" : "inaccurate";
  }
  return existing === "accurate" || existing === "inaccurate"
    ? existing
    : "partial";
}

function sectionForPrompt(
  prompt: CalibratePrompt | undefined,
  promptIndex: number,
): ReadingSectionKey {
  if (prompt?.source === "liunian") return "liunian";
  if (prompt?.source === "dayun") return "dayun";
  if (prompt?.source === "life_stage") return "day_master";
  if (prompt?.nature.includes("流年")) return "liunian";
  if (prompt?.nature.includes("大运")) return "dayun";
  return promptIndex < 4 ? "dayun" : "liunian";
}

/**
 * 根据经历反馈生成阅读侧重文案与章节标签。
 * 不重算四柱、不改核心规则、不提高命盘置信度。
 */
export function computeCalibrationSummary(
  report: ReadingReport,
  calibration: CalibrationData,
): CalibrationSummary {
  const policyNote = CALIBRATION_POLICY_NOTE;
  const total = calibration.answers.length;
  if (total === 0) {
    return { emphasisNote: "", sectionTags: {}, policyNote };
  }

  let accurate = 0;
  let partial = 0;
  for (const a of calibration.answers) {
    if (a.accuracy === "accurate") accurate++;
    else if (a.accuracy === "partial") partial++;
  }
  const inaccurate = total - accurate - partial;
  const accurateRatio = accurate / total;
  const positiveRatio = (accurate + partial) / total;

  // 备注仅用于本地展示；默认不拼入可外发摘要
  const notes = calibration.answers
    .filter((a) => a.shareNoteExternally && a.note?.trim())
    .map((a) => a.note!.trim());

  let emphasisNote: string;
  if (accurateRatio >= 0.6) {
    emphasisNote =
      "基于您的经历反馈，相关章节的阅读侧重已略作加强（仅文案提示，不代表命盘更「准」）。";
  } else if (positiveRatio >= 0.6) {
    emphasisNote =
      "根据您的经历反馈，报告在部分章节的表述做了适度阅读侧重调整（不改变排盘与规则）。";
  } else if (inaccurate / total >= 0.6) {
    emphasisNote =
      "感谢您的反馈。命理分析仅供参考；以下保持客观陈述，并提示宜以实际经历对照阅读（未下调引擎规则，仅调整文案侧重）。";
  } else {
    emphasisNote =
      "基于您的经历反馈，以下报告做了适度文案侧重调整（不改变排盘事实）。";
  }
  if (notes.length > 0) {
    emphasisNote += ` 您同意展示的备注：${notes.slice(0, 2).join("；")}`;
  }

  const sectionTags: Partial<Record<ReadingSectionKey, string>> = {};
  for (const answer of calibration.answers) {
    const prompt = report.calibratePrompts[answer.promptIndex];
    const sectionKey = sectionForPrompt(prompt, answer.promptIndex);
    sectionTags[sectionKey] = mergeTag(
      sectionTags[sectionKey],
      answer.accuracy,
    );
  }

  // 仅联动文案提示章，不改 wuxing/pattern 的「置信度」语义
  if (accurateRatio >= 0.6) {
    sectionTags.advice = mergeTag(sectionTags.advice, "accurate");
  } else if (inaccurate / total >= 0.6) {
    sectionTags.advice = mergeTag(sectionTags.advice, "partial");
  }

  return { emphasisNote, sectionTags, policyNote };
}

/** 将阅读侧重写入章节正文（不改排盘、不改规则结论） */
export function applyCalibrationToReport(
  report: ReadingReport,
  summary: CalibrationSummary,
): ReadingReport {
  if (!summary.emphasisNote && Object.keys(summary.sectionTags).length === 0) {
    return report;
  }

  const sections: ReadingSection[] = report.sections.map((s) => {
    const tag = summary.sectionTags[s.key];
    if (!tag) return s;

    let suffix = "";
    if (tag === "accurate") {
      if (s.key === "advice") {
        suffix =
          "\n\n【阅读侧重】您反馈相关经历较吻合，可更优先参考本章建议方向（仍须结合现实；不改变排盘事实）。";
      } else {
        suffix =
          "\n\n【阅读侧重】您反馈相关经历较吻合，此章可作更优先的阅读参考（非命盘置信度提升）。";
      }
    } else if (tag === "partial") {
      suffix =
        "\n\n【阅读侧重】您反馈部分吻合，此章宜结合现实经历辩证阅读，勿机械套用。";
    } else if (tag === "inaccurate") {
      suffix =
        "\n\n【阅读侧重】您反馈相关经历吻合度偏低；命理仅供参考，请以实际经历与自身选择为准（排盘与规则未改）。";
    }
    if (!suffix || s.body.includes("【阅读侧重】") || s.body.includes("【校准侧重】"))
      return s;
    return { ...s, body: s.body + suffix };
  });

  return { ...report, sections };
}

/** 供 LLM 等外部调用：剥离默认不外发的备注 */
export function sanitizeCalibrationForExternal(
  calibration: CalibrationData,
): CalibrationData {
  return {
    chartId: calibration.chartId,
    answers: calibration.answers.map((a) => ({
      promptIndex: a.promptIndex,
      accuracy: a.accuracy,
      ...(a.shareNoteExternally && a.note
        ? { note: a.note, shareNoteExternally: true as const }
        : {}),
    })),
  };
}

export function createEmptyCalibration(chartId: string): CalibrationData {
  return {
    chartId,
    answers: [],
  };
}
