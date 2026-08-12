/**
 * T290 · 引擎 evidence / 版本 meta 透传（禁止 LLM 发明）
 */

import type {
  BaziChart,
  BaziSkillProvenance,
  RuleEvidence,
  ReadingReport,
} from "@/lib/types";
import type { ZiweiChart, ZiweiReadingReport } from "@/lib/types";
import type { LiuyaoChart, LiuyaoReadingReport } from "@/lib/types";

export type ReadingTrustMeta = {
  engineVersion?: string;
  skillRef?: string;
  school?: string;
  schemaVersion?: string;
  ruleSetVersion?: string;
  provenance?: BaziSkillProvenance;
  warnings?: string[];
  evidence?: RuleEvidence[];
};

const CHART_EVIDENCE_NOTE_MARKER = "【盘面依据与适用边界】";

function uniqueNonEmpty(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))] as string[];
}

/**
 * Build a deterministic, model-independent evidence envelope for material advice.
 * The envelope deliberately uses only chart evidence/warnings and never invents
 * a rule or certainty when the engine did not provide one.
 */
export function buildChartEvidenceNote(chart: BaziChart): string {
  const evidence = chart.evidence?.slice(0, 12) ?? [];
  const conditions = uniqueNonEmpty(evidence.map((item) => item.condition));
  const warnings = uniqueNonEmpty(chart.warnings ?? []);
  const evidenceText = evidence.length
    ? evidence
        .map((item) => {
          const confidence = Number.isFinite(item.confidence)
            ? `，置信度约 ${Math.round(item.confidence * 100)}%`
            : "";
          return `${item.ruleId}：${item.conclusion}（来源：${item.source}${confidence}）`;
        })
        .join("；")
    : "当前命盘未提供结构化 chart evidence，本段不把缺失证据当作确定结论";

  const applicabilityText = conditions.length
    ? conditions.join("；")
    : "仅适用于当前命盘输入、引擎版本及其已列出的规则条件，不外推为其他命盘或具体现实事件";
  const uncertaintyText = warnings.length
    ? `引擎边界/不确定性：${warnings.join("；")}；现实环境、输入完整性与未覆盖规则仍可能改变实际结果`
    : "不确定性：输入完整性、时辰边界、未覆盖规则与现实环境变化都可能影响解读，不应视为确定预测";

  return [
    CHART_EVIDENCE_NOTE_MARKER,
    `盘面依据：${evidenceText}。`,
    `适用条件：${applicabilityText}。`,
    `${uncertaintyText}。`,
    "用途边界：仅供传统文化学习与娱乐参考；健康问题请就医，财务决策请独立核验，不构成医疗或投资建议。",
  ].join("\n");
}

/** Ensure both template and successful/fallback LLM reports expose the same envelope. */
export function ensureChartEvidenceOnAdvice(
  report: ReadingReport,
  chart: BaziChart,
): ReadingReport {
  const note = buildChartEvidenceNote(chart);
  let changed = false;
  const sections = report.sections.map((section) => {
    if (section.key !== "advice" || section.body.includes(CHART_EVIDENCE_NOTE_MARKER)) {
      return section;
    }
    changed = true;
    return { ...section, body: `${section.body}\n\n${note}` };
  });

  return changed ? { ...report, sections } : report;
}

/** 从八字盘提取可信度信封 */
export function extractBaziTrust(chart: BaziChart): ReadingTrustMeta {
  return {
    engineVersion: chart.meta?.engineVersion,
    skillRef: chart.meta?.skillRef,
    school: chart.meta?.school,
    schemaVersion: chart.meta?.schemaVersion,
    ruleSetVersion: chart.meta?.ruleSetVersion,
    provenance: chart.meta?.provenance,
    warnings: chart.warnings?.length ? [...chart.warnings] : undefined,
    evidence: chart.evidence?.length
      ? chart.evidence.map((e) => ({ ...e }))
      : undefined,
  };
}

export function extractZiweiTrust(chart: ZiweiChart): ReadingTrustMeta {
  return {
    engineVersion: chart.meta?.engineVersion,
    skillRef: chart.meta?.skillRef,
    school: chart.meta?.school,
    schemaVersion: chart.meta?.schemaVersion,
    ruleSetVersion: chart.meta?.ruleSetVersion,
    warnings: chart.warnings?.length ? [...chart.warnings] : undefined,
  };
}

export function extractLiuyaoTrust(chart: LiuyaoChart): ReadingTrustMeta {
  return {
    engineVersion: chart.meta?.engineVersion,
    skillRef: chart.meta?.dataVersion,
    school: chart.meta?.castingSchool,
    schemaVersion: chart.meta?.dataVersion,
    ruleSetVersion: chart.meta?.dataVersion,
    warnings: chart.meta?.methodNote ? [chart.meta.methodNote] : undefined,
  };
}

export function attachTrustToBaziReport(
  report: ReadingReport,
  chart: BaziChart,
): ReadingReport {
  const trust = extractBaziTrust(chart);
  return {
    ...report,
    engineVersion: trust.engineVersion,
    school: trust.school,
    warnings: trust.warnings,
    evidence: trust.evidence,
  };
}

export function attachTrustToZiweiReport(
  report: ZiweiReadingReport,
  chart: ZiweiChart,
): ZiweiReadingReport {
  const trust = extractZiweiTrust(chart);
  return {
    ...report,
    engineVersion: trust.engineVersion,
    school: trust.school,
    warnings: trust.warnings,
  };
}

export function attachTrustToLiuyaoReport(
  report: LiuyaoReadingReport,
  chart: LiuyaoChart,
): LiuyaoReadingReport {
  const trust = extractLiuyaoTrust(chart);
  return {
    ...report,
    engineVersion: trust.engineVersion,
    school: trust.school,
    warnings: trust.warnings,
  };
}
