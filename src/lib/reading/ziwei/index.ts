/** 紫微解读（T104）— 模板 + LLM 回落 */
export {
  DISCLAIMER,
  ZIWEI_SECTION_KEYS,
  ZIWEI_SECTION_TITLES,
} from "./sections";
export { renderZiweiTemplateReading } from "./template";
export type { ZiweiTemplateReadingOptions } from "./template";
export { llmZiweiReading } from "./llm";
export type { ZiweiLlmReadingOptions } from "./llm";
export { createZiweiFixtureChart } from "./fixture";
