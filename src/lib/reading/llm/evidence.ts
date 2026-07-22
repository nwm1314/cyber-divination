/**
 * T290 · 引擎 evidence / 版本 meta 透传（禁止 LLM 发明）
 */

import type { BaziChart, RuleEvidence, ReadingReport } from "@/lib/types";
import type { ZiweiChart, ZiweiReadingReport } from "@/lib/types";
import type { LiuyaoChart, LiuyaoReadingReport } from "@/lib/types";

export type ReadingTrustMeta = {
  engineVersion?: string;
  skillRef?: string;
  school?: string;
  schemaVersion?: string;
  ruleSetVersion?: string;
  warnings?: string[];
  evidence?: RuleEvidence[];
};

/** 从八字盘提取可信度信封 */
export function extractBaziTrust(chart: BaziChart): ReadingTrustMeta {
  return {
    engineVersion: chart.meta?.engineVersion,
    skillRef: chart.meta?.skillRef,
    school: chart.meta?.school,
    schemaVersion: chart.meta?.schemaVersion,
    ruleSetVersion: chart.meta?.ruleSetVersion,
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
