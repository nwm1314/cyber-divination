import type {
  BaziChart,
  Gender,
  ReadingReport,
  ReadingSection,
  ViewMode,
} from "@/lib/types";
import { DISCLAIMER, SECTION_KEYS, SECTION_TITLES } from "../sections";
import {
  analyzeChart,
  buildAdviceSection,
  buildCalibratePrompts,
  buildCalibrateSection,
  buildDayMasterSection,
  buildDayunSection,
  buildLiunianSection,
  buildPatternSection,
  buildTenGodsSection,
  buildWuxingSection,
  sectionCitations,
} from "./analyze";
import { ensureChartEvidenceOnAdvice } from "@/lib/reading/llm/evidence";

export type TemplateReadingOptions = {
  viewMode?: ViewMode;
  /** 覆盖 chartId；默认 profileId */
  chartId?: string;
  /** 曾用名：轻量提及，对齐 PRODUCT */
  formerName?: string;
  renameYear?: number | "unknown";
  /** 性别：六亲与感情建议分支（BirthProfile.gender） */
  gender?: Gender;
};

/**
 * 规则模板解读（无 LLM）
 * 章节结构 = bazi-skill 第三阶段 1–8；条文对齐 classical-texts 摘要。
 */
export function renderTemplateReading(
  chart: BaziChart,
  options?: TemplateReadingOptions,
): ReadingReport {
  const viewMode: ViewMode = options?.viewMode ?? "plain";
  const gender = options?.gender;
  const analysis = analyzeChart(chart);
  const calibratePrompts = buildCalibratePrompts(chart);

  const formerNote =
    options?.formerName && options.formerName.trim()
      ? `另悉曾用名「${options.formerName.trim()}」${
          options.renameYear && options.renameYear !== "unknown"
            ? `（约${options.renameYear}年改名）`
            : options.renameYear === "unknown"
              ? "（改名年份不详）"
              : ""
        }，姓名学不在本盘详论，仅作档案记录。`
      : "";

  let dayMasterBody = buildDayMasterSection(chart, analysis, viewMode);
  if (formerNote) {
    dayMasterBody = `${dayMasterBody}\n${formerNote}`;
  }

  const bodies: Record<(typeof SECTION_KEYS)[number], string> = {
    day_master: dayMasterBody,
    ten_gods: buildTenGodsSection(chart, analysis, viewMode, gender),
    wuxing: buildWuxingSection(chart, analysis, viewMode),
    pattern: buildPatternSection(chart, analysis, viewMode),
    dayun: buildDayunSection(chart, analysis, viewMode),
    liunian: buildLiunianSection(chart, analysis, viewMode),
    calibrate: buildCalibrateSection(calibratePrompts, viewMode),
    advice: buildAdviceSection(chart, analysis, viewMode, gender),
  };

  // 合冲轻量并入十神章（专业可读）
  const rel = chart.relations;
  if (rel && (rel.stemHe.length > 0 || rel.branchChong.length > 0)) {
    const he = rel.stemHe.map((r) => r.label).join("、");
    const ch = rel.branchChong.map((r) => r.label).join("、");
    const bits = [he && `天干：${he}`, ch && `地支：${ch}`].filter(Boolean);
    if (bits.length) {
      bodies.ten_gods += `\n干支关系（核心合冲）：${bits.join("；")}。`;
    }
  }

  const sections: ReadingSection[] = SECTION_KEYS.map((key) => ({
    key,
    title: SECTION_TITLES[key],
    body: bodies[key],
    citations: sectionCitations(key),
  }));

  return ensureChartEvidenceOnAdvice(
    {
      chartId: options?.chartId ?? chart.profileId,
      mode: "template",
      viewMode,
      sections,
      calibratePrompts,
      disclaimer: DISCLAIMER,
      engineVersion: chart.meta?.engineVersion,
      school: chart.meta?.school,
      warnings: chart.warnings?.length ? [...chart.warnings] : undefined,
      evidence: chart.evidence?.length
        ? chart.evidence.map((e) => ({ ...e }))
        : undefined,
    },
    chart,
  );
}
