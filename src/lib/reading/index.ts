/** 解读模块入口 — T30 规则模板；T31 LLM；T104 紫微；T114 六爻 */
export { DISCLAIMER, SECTION_KEYS, SECTION_TITLES } from "./sections";
export {
  renderTemplateReading,
  analyzeChart,
} from "./template";
export type { TemplateReadingOptions, ChartAnalysis, Strength } from "./template";
export { llmReading } from "./llm/llm";
export type { LlmReadingOptions } from "./llm/llm";
export { isLlmConfigured } from "./llm/config";
export {
  computeCalibrationSummary,
  applyCalibrationToReport,
  createEmptyCalibration,
  sanitizeCalibrationForExternal,
  CALIBRATION_POLICY_NOTE,
} from "./calibrate";
export type {
  CalibrationData,
  CalibrateAnswer,
  CalibrationSummary,
} from "./calibrate";

/** 紫微解读（T104） */
export {
  ZIWEI_SECTION_KEYS,
  ZIWEI_SECTION_TITLES,
  renderZiweiTemplateReading,
  llmZiweiReading,
  createZiweiFixtureChart,
} from "./ziwei";
export type {
  ZiweiTemplateReadingOptions,
  ZiweiLlmReadingOptions,
} from "./ziwei";

/** 六爻解卦（T114） */
export {
  LIUYAO_SECTION_KEYS,
  LIUYAO_SECTION_TITLES,
  renderLiuyaoTemplateReading,
  llmLiuyaoReading,
  createLiuyaoFixtureChart,
} from "./liuyao";
export type {
  LiuyaoTemplateReadingOptions,
  LiuyaoLlmReadingOptions,
} from "./liuyao";
