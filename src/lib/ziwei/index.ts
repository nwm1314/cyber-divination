/**
 * 紫微斗数引擎入口（T101+…+T190 飞星 + T191/192 流昌截空）
 * **禁止 LLM 排盘** — 仅表驱动纯函数。
 */

export type {
  Dizhi,
  FeixingFlight,
  StarBrightness,
  StarCategory,
  YunSihuaItem,
  ZiweiChart,
  ZiweiChartId,
  ZiweiChartInput,
  ZiweiDaxianStep,
  ZiweiLiunianItem,
  ZiweiLiuriItem,
  ZiweiLiuyueItem,
  ZiweiPalace,
  ZiweiPalaceName,
  ZiweiStar,
} from "@/lib/types/ziwei";

export { ZIWEI_SKILL_REF } from "@/lib/types/ziwei";

export {
  ENGINE_VERSION,
  SKILL_REF,
  SCHEMA_VERSION,
  RULE_SET_VERSION,
  SCHOOL_CORE,
  SCHOOL_FEIXING,
  RULE_PRIORITY,
  AGE_POLICY_XUSUI,
  FLAG_SHICHEN_MULTI_CANDIDATE,
} from "./tables/constants";
export { computeZiweiChart } from "./compute";
export { resolveBirthContext, contextFromLunarYmd } from "./calendar";
export {
  placeMingShen,
  fiveElementsClass,
  buildTwelvePalaces,
} from "./palaces";
export { locateZiweiTianfu, placeMajorStars } from "./stars";
export {
  getBirthYearSihua,
  applyBirthYearSihua,
  sihuaMarksByStar,
} from "./sihua";
export { SIHUA_BY_YEAR_STEM, SIHUA_KINDS } from "./tables/sihua";
export type { SihuaKind, SihuaTargets } from "./tables/sihua";
export {
  applyChartZihua,
  applyPalaceZihua,
  hasZihua,
} from "./zihua";
export {
  ZIHUA_PREFIX,
  sihuaTargetsByPalaceStem,
  zihuaMarkOf,
} from "./tables/zihua";
export type { ZihuaMark } from "./tables/zihua";
export {
  placeAuxStars,
  auxStarsAtYin,
  auxStarsAsZiwei,
  AUX_STAR_ORDER,
  AUX_STAR_CATEGORY,
} from "./aux-stars";
export type { AuxStarName, AuxStarPlacement } from "./aux-stars";
export {
  BOSHI_TWELVE,
  placeBoshiTwelve,
  placeBoshiForChart,
  boshiAtYin,
  boshiStarsAsZiwei,
} from "./boshi";
export type { BoshiStarName } from "./boshi";
export {
  applyFeixingFlights,
  mingFeixingSummary,
  sihuaFlightsFromStem,
  flightsToYunSihua,
  FLAG_FEIXING_FLIGHTS,
  feixingMark,
  isFeixingMark,
} from "./feixing";
export {
  placeLiuChangJiekong,
  liuChangJiekongAsZiwei,
  liuChangQuByYearBranch,
  jiekongYinIndices,
  JIEKONG_BY_YEAR_STEM,
} from "./liuchang";
export type { LiuChangJiekongPlacement } from "./liuchang";
export {
  applyMajorBrightness,
  lookupMajorBrightness,
  brightnessHint,
  MAJOR_BRIGHTNESS,
} from "./brightness";
export {
  computeDaxian,
  daxianDirection,
  startAgeFromJu,
  daxianPalaceName,
  daxianBranch,
  xusuiAge,
  FLAG_DAXIAN_SANHE,
  FLAG_DAXIAN_AGE_SOLAR,
  FLAG_DAXIAN_AGE_XUSUI,
  FLAG_LIUNIAN_YEAR_BRANCH,
  FLAG_DEATH_CLAMP,
  FLAG_YUN_FEIXING,
  FLAG_LIUYUE,
  FLAG_LIURI,
} from "./daxian";
