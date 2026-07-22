/**
 * computeZiweiChart — 紫微排盘纯函数（T101+…+T270 虚岁/流派/未知时辰）
 * 主星+辅星+流昌流曲+截空+博士+亮度+生年四化+自化+飞星飞宫+大限流年
 */

import type {
  Dizhi,
  ZiweiChart,
  ZiweiChartInput,
  ZiweiHourCandidate,
  ZiweiPalaceName,
} from "@/lib/types/ziwei";
import { resolveBirthContext } from "./calendar";
import { computeDaxian } from "./daxian";
import {
  buildTwelvePalaces,
  palaceNameAtYinIndex,
  placeMingShen,
} from "./palaces";
import { applyBirthYearSihua } from "./sihua";
import { applyChartZihua } from "./zihua";
import { applyFeixingFlights } from "./feixing";
import { majorStarAtYin, placeMajorStars } from "./stars";
import { auxStarsAsZiwei, placeAuxStars } from "./aux-stars";
import { boshiStarsAsZiwei, placeBoshiForChart } from "./boshi";
import {
  liuChangJiekongAsZiwei,
  placeLiuChangJiekong,
} from "./liuchang";
import { applyMajorBrightness } from "./brightness";
import {
  AGE_POLICY_XUSUI,
  CALENDAR_POLICY,
  DIZHI_LIST,
  ENGINE_VERSION,
  FLAG_DEFAULT_NOON,
  FLAG_SHICHEN_MULTI_CANDIDATE,
  FLAG_SHICHEN_UNKNOWN,
  MING_ZHU_BY_YEAR_BRANCH,
  RULE_PRIORITY,
  RULE_SET_VERSION,
  SCHEMA_VERSION,
  SCHOOL_CORE,
  SCHOOL_FEIXING,
  SHEN_ZHU_BY_YEAR_BRANCH,
  SKILL_REF,
  TIME_POLICY_SHICHEN,
  TIME_POLICY_UNKNOWN_MULTI,
  yinIndexFromBranch,
} from "./tables/constants";

function stableChartId(parts: string[]): string {
  // 确定性短 id（非加密；仅稳定复现）
  const raw = parts.join("|");
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return `zw-${hex}`;
}

function parseBaseDate(analysisBaseDate?: string): {
  year: number;
  month: number;
  day: number;
} {
  if (analysisBaseDate && /^\d{4}-\d{2}-\d{2}$/.test(analysisBaseDate.trim())) {
    const t = analysisBaseDate.trim();
    return {
      year: Number(t.slice(0, 4)),
      month: Number(t.slice(5, 7)),
      day: Number(t.slice(8, 10)),
    };
  }
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

function buildMeta(opts: {
  shichenUnknown: boolean;
}): ZiweiChart["meta"] {
  return {
    engineVersion: ENGINE_VERSION,
    skillRef: SKILL_REF,
    schemaVersion: SCHEMA_VERSION,
    ruleSetVersion: RULE_SET_VERSION,
    // 主流派：三合盘体；飞星为叠加命名空间
    school: SCHOOL_CORE,
    schools: {
      core: SCHOOL_CORE,
      feixing: SCHOOL_FEIXING,
      zihua: SCHOOL_CORE,
    },
    rulePriority: [...RULE_PRIORITY],
    agePolicy: AGE_POLICY_XUSUI,
    calendarPolicy: CALENDAR_POLICY,
    timePolicy: opts.shichenUnknown
      ? TIME_POLICY_UNKNOWN_MULTI
      : TIME_POLICY_SHICHEN,
  };
}

function majorByBranchFromPalaces(
  palaces: { name: string; branch: Dizhi; stars: { name: string; category?: string }[] }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of palaces) {
    for (const s of p.stars) {
      if (s.category === "major") out[s.name] = p.branch;
    }
  }
  return out;
}

/**
 * 未知时辰：十二时辰候选摘要（不输出 12 份完整盘）
 */
function buildHourCandidates(
  input: ZiweiChartInput,
  defaultNoon: ZiweiHourCandidate,
): ZiweiHourCandidate[] {
  const candidates: ZiweiHourCandidate[] = [];
  for (const hourBranch of DIZHI_LIST) {
    if (hourBranch === "午") {
      candidates.push({ ...defaultNoon, isDefaultNoon: true });
      continue;
    }
    // 用固定时支直接排关键字段（不依赖 birthTime 字符串）
    const ctx = resolveBirthContext({
      solarDate: input.solarDate,
      lunarDate: input.lunarDate,
      isLeapMonth: input.isLeapMonth,
      // 取时支中点代表时刻，避免未知时路径
      birthTime: hourBranchToSampleTime(hourBranch),
      shichenUnknown: false,
    });
    // 强制使用目标时支（sample time 已对应，但再校验）
    const hour = hourBranch;
    const mingShen = placeMingShen(ctx.lunarMonth, hour, ctx.yearStem);
    const major = placeMajorStars(ctx.lunarDay, mingShen.juValue);
    const majorByBranch: Record<string, string> = {};
    for (const [star, branch] of Object.entries(major.starBranch)) {
      majorByBranch[star] = branch;
    }
    candidates.push({
      hourBranch: hour,
      mingBranch: mingShen.mingBranch,
      shenGong: mingShen.shenGong,
      shenBranch: mingShen.shenBranch,
      wuxingJu: mingShen.wuxingJu,
      majorByBranch,
    });
  }
  return candidates;
}

/** 时支 → 代表时刻 HH:mm（该时辰中点） */
function hourBranchToSampleTime(branch: Dizhi): string {
  // 子 23–1 → 00:00；丑 1–3 → 02:00 …
  const map: Record<Dizhi, string> = {
    子: "00:00",
    丑: "02:00",
    寅: "04:00",
    卯: "06:00",
    辰: "08:00",
    巳: "10:00",
    午: "12:00",
    未: "14:00",
    申: "16:00",
    酉: "18:00",
    戌: "20:00",
    亥: "22:00",
  };
  return map[branch];
}

/**
 * 确定性紫微排盘（零 LLM）
 * 同输入 → deep equal（含 id；含固定 analysisBaseDate 时）
 *
 * 未知时辰（T270）：主盘仍为默认午时参考盘，但附 hourCandidates + warnings，
 * 不得当作唯一完整盘使用。
 */
export function computeZiweiChart(input: ZiweiChartInput): ZiweiChart {
  const shichenUnknown =
    input.shichenUnknown === true ||
    input.birthTime == null ||
    input.birthTime === "";

  const ctx = resolveBirthContext({
    solarDate: input.solarDate,
    lunarDate: input.lunarDate,
    isLeapMonth: input.isLeapMonth,
    birthTime: input.birthTime,
    shichenUnknown: input.shichenUnknown,
  });

  const mingShen = placeMingShen(
    ctx.lunarMonth,
    ctx.hourBranch,
    ctx.yearStem,
  );

  const palaces = buildTwelvePalaces(
    mingShen.mingYinIndex,
    mingShen.shenYinIndex,
    ctx.yearStem,
  );

  const major = placeMajorStars(ctx.lunarDay, mingShen.juValue);
  const aux = placeAuxStars({
    yearStem: ctx.yearStem,
    yearBranch: ctx.yearBranch,
    lunarMonth: ctx.lunarMonth,
    hourBranch: ctx.hourBranch,
  });
  const boshi = placeBoshiForChart({
    yearStem: ctx.yearStem,
    yearBranch: ctx.yearBranch,
    gender: input.gender,
  });
  // 年流昌/流曲 + 截空（以生年支/年干）
  const liuJk = placeLiuChangJiekong({
    yearStem: ctx.yearStem,
    flowBranch: ctx.yearBranch,
  });

  // 主星 + 辅星 + 流昌流曲截空 + 博士 + 亮度 + 生年四化 + 自化 + 飞星
  for (const p of palaces) {
    const yi = yinIndexFromBranch(p.branch);
    p.stars = [
      ...majorStarAtYin(major, yi),
      ...auxStarsAsZiwei(aux, yi),
      ...liuChangJiekongAsZiwei(liuJk, yi),
      ...boshiStarsAsZiwei(boshi, yi),
    ];
    applyMajorBrightness(p.stars, p.branch);
    applyBirthYearSihua(p.stars, ctx.yearStem);
  }
  applyChartZihua(palaces);
  const feixing = applyFeixingFlights(palaces);

  const majorStars: Record<string, string[]> = {};
  for (const p of palaces) {
    const names = p.stars
      .filter((s) => s.category === "major")
      .map((s) => s.name);
    if (names.length) majorStars[p.name] = names;
  }

  // 保证 majorStars 键完整覆盖有主星的宫；无主星宫不出现
  // 同时用地支索引校验：每颗主星恰一宫
  for (const [starName, yi] of Object.entries(major.starYinIndex)) {
    const pname = palaceNameAtYinIndex(mingShen.mingYinIndex, yi);
    if (!majorStars[pname]) majorStars[pname] = [];
    if (!majorStars[pname].includes(starName)) {
      majorStars[pname].push(starName);
    }
  }

  const birthYear = Number(ctx.solarDate.slice(0, 4));
  const base = parseBaseDate(input.analysisBaseDate);
  const baseYear = base.year;

  const daxianResult = computeDaxian({
    palaces,
    mingYinIndex: mingShen.mingYinIndex,
    yearStem: ctx.yearStem,
    gender: input.gender,
    wuxingJu: mingShen.wuxingJu,
    birthYear,
    baseYear,
    baseMonth: base.month,
    baseDay: base.day,
    alive: input.alive,
    deathYear: input.deathYear,
  });

  const flags = [
    ...ctx.flags,
    ...daxianResult.flags,
    ...feixing.flags,
  ];

  const warnings: string[] = [];
  let hourCandidates: ZiweiHourCandidate[] | undefined;

  if (shichenUnknown) {
    if (!flags.includes(FLAG_SHICHEN_UNKNOWN)) {
      flags.push(FLAG_SHICHEN_UNKNOWN);
    }
    if (!flags.includes(FLAG_DEFAULT_NOON)) {
      flags.push(FLAG_DEFAULT_NOON);
    }
    flags.push(FLAG_SHICHEN_MULTI_CANDIDATE);
    warnings.push(
      "时辰未知：主盘为默认午时参考盘，不可当作唯一完整盘；请对照 hourCandidates 多时辰校盘",
    );
    const defaultNoon: ZiweiHourCandidate = {
      hourBranch: "午",
      mingBranch: mingShen.mingBranch,
      shenGong: mingShen.shenGong,
      shenBranch: mingShen.shenBranch,
      wuxingJu: mingShen.wuxingJu,
      majorByBranch: majorByBranchFromPalaces(palaces),
      isDefaultNoon: true,
    };
    hourCandidates = buildHourCandidates(input, defaultNoon);
  }

  const id = stableChartId([
    ctx.solarDate,
    ctx.hourBranch,
    input.gender,
    String(ctx.lunarMonth),
    String(ctx.lunarDay),
    input.personId ?? "",
    input.profileId ?? "",
    input.name ?? "",
    // 大限/流年/流月流日边界进入 id，保证不同基准/卒年不撞盘
    String(baseYear),
    String(base.month),
    String(base.day),
    input.alive === false ? `d${input.deathYear ?? ""}` : "alive",
    shichenUnknown ? "unk" : "known",
  ]);

  return {
    id,
    personId: input.personId,
    profileId: input.profileId,
    userId: input.userId ?? null,
    name: input.name,
    palaces,
    mingGong: "命宫" satisfies ZiweiPalaceName,
    shenGong: mingShen.shenGong,
    majorStars,
    daxian: daxianResult.daxian,
    currentDaxianIndex: daxianResult.currentDaxianIndex,
    liunian: daxianResult.liunian,
    liuyue: daxianResult.liuyue,
    liuri: daxianResult.liuri,
    wuxingJu: mingShen.wuxingJu,
    mingZhu: MING_ZHU_BY_YEAR_BRANCH[ctx.yearBranch],
    shenZhu: SHEN_ZHU_BY_YEAR_BRANCH[ctx.yearBranch],
    feixingFlights: feixing.flights,
    ...(hourCandidates ? { hourCandidates } : {}),
    ...(warnings.length ? { warnings } : {}),
    flags,
    meta: buildMeta({ shichenUnknown }),
  };
}
