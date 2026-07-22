import type { BaziChart, CalibratePrompt, Gender, ViewMode } from "@/lib/types";
import {
  ADVICE_COLORS,
  ADVICE_DIRS,
  BRANCH_SEASON,
  DISEASE_MEDICINE,
  isDeLing,
  liuqinHint,
  loveAdviceHint,
  PATTERN_DESC,
  PATTERN_FROM_TEN_GOD,
  PATTERN_XIANG_TEN_GODS,
  PATTERN_YONG_TEN_GODS,
  STEM_META,
  TEN_GOD_MEANING,
  tiaohouHint,
  WUXING_LABEL,
  WUXING_ORDER,
  YONG_CATEGORY_TEN_GODS,
  YONGSHEN_BY_STRENGTH,
} from "./constants";
import {
  natureForGanZhi,
  plainAdvice,
  plainCalibrate,
  plainDayMaster,
  plainDayun,
  plainLiunian,
  plainPattern,
  plainTenGods,
  plainWuxing,
} from "./plain-copy";

export type Strength = "身旺" | "身弱" | "中和" | "从强" | "从弱";

export type PatternStatus = "成格" | "有病" | "破象" | "待定";

/** 可解释的格局病象（神峰通考病药 + 子平真诠破格） */
export type PatternDisease = {
  key: string;
  label: string;
  medicine: string;
  citation: string;
};

export type ChartAnalysis = {
  strength: Strength;
  deLing: boolean;
  deDi: boolean;
  deShi: boolean;
  monthBranch: string;
  monthTenGod: string;
  patternName: string;
  patternDesc: string;
  patternStatus: PatternStatus;
  patternNote: string;
  /** 月令本气是否透干（《子平真诠》透干取格） */
  touGan: boolean;
  /** 月令本气天干 */
  monthBenQi?: string;
  /** 格局用神十神是否在地支有根 */
  yongHasRoot: boolean;
  /** 是否见相神辅佐 */
  hasXiangShen: boolean;
  /** 病象列表（可空） */
  diseases: PatternDisease[];
  /** 成格/败格解释句（供报告引用） */
  patternExplain: string;
  yong: string;
  ji: string;
  yongNote: string;
  topWuxing: string;
  weakWuxing: string;
  yongWuxingHint: string;
  currentDayun?: BaziChart["dayun"][number];
  hourUnknown: boolean;
  changShengMonth?: string;
};

function scoreSum(scores: BaziChart["wuxingScores"]): number {
  return WUXING_ORDER.reduce((s, k) => s + (scores[k] ?? 0), 0);
}

function rankWuxing(scores: BaziChart["wuxingScores"]): {
  top: (typeof WUXING_ORDER)[number];
  weak: (typeof WUXING_ORDER)[number];
} {
  let top: (typeof WUXING_ORDER)[number] = WUXING_ORDER[0];
  let weak: (typeof WUXING_ORDER)[number] = WUXING_ORDER[0];
  for (const k of WUXING_ORDER) {
    if ((scores[k] ?? 0) > (scores[top] ?? 0)) top = k;
    if ((scores[k] ?? 0) < (scores[weak] ?? 0)) weak = k;
  }
  return { top, weak };
}

/** 按柱位计数（T261：禁止仅用 tenGods Record 合并） */
function countSupportTenGods(
  chart: BaziChart,
  fallbackTenGods?: Record<string, string>,
): {
  support: number;
  drain: number;
} {
  let support = 0;
  let drain = 0;
  const byPos = chart.tenGodsByPosition;
  if (byPos && byPos.length > 0) {
    for (const p of byPos) {
      if (p.position === "day") continue;
      const v = p.tenGod;
      if (!v || v === "日主" || v === "—") continue;
      if (["比肩", "劫财", "正印", "偏印", "枭神"].includes(v)) support += 1;
      if (
        ["食神", "伤官", "正财", "偏财", "正官", "七杀", "偏官"].includes(v)
      )
        drain += 1;
    }
    return { support, drain };
  }
  // 优先 pillars 柱位 tenGod
  const pillars = [
    chart.pillars.year,
    chart.pillars.month,
    chart.pillars.hour,
  ];
  let usedPillar = false;
  for (const p of pillars) {
    if (!p?.tenGod) continue;
    usedPillar = true;
    const v = p.tenGod;
    if (!v || v === "日主" || v === "—") continue;
    if (["比肩", "劫财", "正印", "偏印", "枭神"].includes(v)) support += 1;
    if (["食神", "伤官", "正财", "偏财", "正官", "七杀", "偏官"].includes(v))
      drain += 1;
  }
  if (usedPillar) return { support, drain };

  const tenGods = fallbackTenGods ?? chart.tenGods;
  for (const v of Object.values(tenGods)) {
    if (!v || v === "日主" || v === "—") continue;
    if (["比肩", "劫财", "正印", "偏印", "枭神"].includes(v)) support += 1;
    if (["食神", "伤官", "正财", "偏财", "正官", "七杀", "偏官"].includes(v))
      drain += 1;
  }
  return { support, drain };
}

/** 天干十神列表（年/月/时干，不含日主） */
function stemTenGods(chart: BaziChart): string[] {
  const keys: (keyof BaziChart["pillars"])[] = ["year", "month", "hour"];
  const out: string[] = [];
  for (const k of keys) {
    const p = chart.pillars[k];
    if (!p) continue;
    const tg =
      p.tenGod ??
      chart.tenGods[k] ??
      chart.tenGods[p.stem] ??
      "";
    if (tg && tg !== "日主" && tg !== "—") out.push(tg);
  }
  return out;
}

/** 全盘十神（天干 + 柱上标注）去重收集 */
function allTenGodSet(chart: BaziChart): Set<string> {
  const s = new Set<string>();
  for (const v of Object.values(chart.tenGods)) {
    if (v && v !== "日主" && v !== "—") s.add(v);
  }
  for (const tg of stemTenGods(chart)) s.add(tg);
  return s;
}

/** 四柱天干列表 */
function allStemsOf(chart: BaziChart): string[] {
  return [
    chart.pillars.year.stem,
    chart.pillars.month.stem,
    chart.pillars.day.stem,
    chart.pillars.hour?.stem,
  ].filter(Boolean) as string[];
}

/** 地支藏干扁平（含 pillars 与 chart.hiddenStems） */
function allHiddenStems(chart: BaziChart): string[] {
  const fromPillars = [
    chart.pillars.year.hiddenStems,
    chart.pillars.month.hiddenStems,
    chart.pillars.day.hiddenStems,
    chart.pillars.hour?.hiddenStems,
  ]
    .filter(Boolean)
    .flat() as string[];
  const fromMap = Object.values(chart.hiddenStems).flat();
  return [...fromPillars, ...fromMap].filter(Boolean);
}

/**
 * 某十神在地支是否有根：同五行之藏干出现
 * （子平真诠：用神有力须得地）
 */
function tenGodHasRoot(
  chart: BaziChart,
  tenGodNames: string[],
): boolean {
  if (!tenGodNames.length) return false;
  const targetWx = new Set<string>();
  // 从天干上找对应十神之干，取其五行
  const pillars = [
    chart.pillars.year,
    chart.pillars.month,
    chart.pillars.hour,
  ].filter(Boolean) as NonNullable<BaziChart["pillars"]["year"]>[];
  for (const p of pillars) {
    const tg = p.tenGod ?? chart.tenGods[p.stem] ?? "";
    if (tenGodNames.includes(tg)) {
      const wx = STEM_META[p.stem]?.wuxing;
      if (wx) targetWx.add(wx);
    }
  }
  // 亦从 tenGods 记录反查干
  for (const [k, v] of Object.entries(chart.tenGods)) {
    if (!tenGodNames.includes(v)) continue;
    if (STEM_META[k]?.wuxing) targetWx.add(STEM_META[k].wuxing);
  }
  if (!targetWx.size) {
    // 无透干时：用格局用神十神对应的五行类（无法精确则 false）
    return false;
  }
  const roots = allHiddenStems(chart);
  return roots.some((stem) => {
    const wx = STEM_META[stem]?.wuxing;
    return Boolean(wx && targetWx.has(wx));
  });
}

function makeDisease(key: string, label: string): PatternDisease {
  const med = DISEASE_MEDICINE[key];
  return {
    key,
    label,
    medicine: med?.medicine ?? "运助喜用、制化忌神",
    citation: med?.citation ?? "《神峰通考》病药说",
  };
}

/**
 * 格局成败规则（《子平真诠》《三命通会》《神峰通考》）
 * - 透干：月令本气透出天干
 * - 成格：透干 + 用神有根 + 无破格病
 * - 破象：伤官见官等破格
 * - 有病：未透/无根/枭夺食等，可药
 */
export function evaluatePattern(chart: BaziChart): {
  patternName: string;
  patternDesc: string;
  patternStatus: PatternStatus;
  patternNote: string;
  patternExplain: string;
  touGan: boolean;
  monthBenQi?: string;
  monthTenGod: string;
  yongHasRoot: boolean;
  hasXiangShen: boolean;
  diseases: PatternDisease[];
} {
  const monthBranch = chart.pillars.month.branch;
  const monthTenGod =
    chart.pillars.month.tenGod ??
    chart.tenGods.month ??
    chart.tenGods["month"] ??
    "";

  const patternName =
    PATTERN_FROM_TEN_GOD[monthTenGod] ??
    (monthTenGod
      ? `${monthTenGod}相关格局（待细参月令藏干透干）`
      : "月令格局待定");
  const patternDesc =
    PATTERN_DESC[patternName] ??
    "格局以月令为提纲（《子平真诠》），须看透干与用神清浊。";

  const monthHidden =
    chart.pillars.month.hiddenStems ??
    chart.hiddenStems[monthBranch] ??
    chart.hiddenStems.month ??
    [];
  const monthBenQi = monthHidden[0];
  const stems = allStemsOf(chart);
  const touGan = Boolean(monthBenQi && stems.includes(monthBenQi));

  const patternYongGods = PATTERN_YONG_TEN_GODS[patternName] ?? [];
  const yongHasRoot =
    patternYongGods.length > 0
      ? tenGodHasRoot(chart, patternYongGods) ||
        // 月令本气即格局用神气根
        Boolean(
          monthBenQi &&
            allHiddenStems(chart).includes(monthBenQi) &&
            (touGan || monthHidden.length > 0),
        )
      : false;

  // 月令藏干本身即为用神之根（本气在月）
  const yongRootEffective =
    yongHasRoot ||
    (patternYongGods.length > 0 &&
      Boolean(monthTenGod) &&
      patternYongGods.includes(monthTenGod));

  const tenSet = allTenGodSet(chart);
  const hasShang = tenSet.has("伤官");
  const hasGuan = tenSet.has("正官");
  const hasXiao = tenSet.has("偏印") || tenSet.has("枭神");
  const hasShi = tenSet.has("食神");
  const hasZhengCai = tenSet.has("正财");
  const hasPianCai = tenSet.has("偏财");
  const hasCai = hasZhengCai || hasPianCai;
  const hasBiJie = tenSet.has("比肩") || tenSet.has("劫财");
  const hasZhengYin = tenSet.has("正印");
  const hasSha = tenSet.has("七杀") || tenSet.has("偏官");
  const hasShiShang = hasShi || hasShang;

  const xiangGods = PATTERN_XIANG_TEN_GODS[patternName] ?? [];
  const hasXiangShen =
    xiangGods.length > 0 && xiangGods.some((g) => tenSet.has(g));

  const diseases: PatternDisease[] = [];

  // 伤官见官（《三命通会》：伤官见官为祸百端）
  if (hasShang && hasGuan) {
    diseases.push(makeDisease("伤官见官", "伤官见官"));
  }
  // 枭神夺食
  if (hasXiao && hasShi) {
    diseases.push(makeDisease("枭神夺食", "枭神夺食"));
  }
  // 财格忌比劫争财
  if (
    (patternName === "正财格" || patternName === "偏财格") &&
    hasCai &&
    hasBiJie
  ) {
    diseases.push(makeDisease("比劫争财", "比劫争财"));
  }
  // 印格忌财星坏印
  if (
    (patternName === "正印格" || patternName === "偏印格") &&
    (hasZhengYin || hasXiao) &&
    hasCai
  ) {
    diseases.push(makeDisease("财星坏印", "财星坏印"));
  }
  // 七杀无制无化
  if (
    patternName === "七杀格（偏官格）" &&
    hasSha &&
    !hasShiShang &&
    !hasZhengYin &&
    !hasXiao
  ) {
    diseases.push(makeDisease("杀重无制", "杀重无制"));
  }
  if (!touGan && monthBenQi) {
    diseases.push(makeDisease("月令未透", "月令本气未透"));
  }
  if (patternYongGods.length > 0 && !yongRootEffective) {
    diseases.push(makeDisease("用神无根", "格局用神无根"));
  }
  // 官杀混杂 / 财官印食多透为浊（简化：官杀同见且非杀格制化语境）
  if (hasGuan && hasSha && patternName === "正官格") {
    diseases.push(makeDisease("格局混杂", "官杀混杂"));
  }

  const poXiangKeys = new Set(["伤官见官", "杀重无制"]);
  const hasPoXiang = diseases.some((d) => poXiangKeys.has(d.key));
  const softDiseaseKeys = new Set([
    "枭神夺食",
    "比劫争财",
    "财星坏印",
    "月令未透",
    "用神无根",
    "格局混杂",
  ]);
  const hasSoftDisease = diseases.some((d) => softDiseaseKeys.has(d.key));

  let patternStatus: PatternStatus = "待定";
  let patternNote = "须结合透干、用神有根细参（《子平真诠》）。";

  if (hasPoXiang) {
    patternStatus = "破象";
    const d = diseases.find((x) => poXiangKeys.has(x.key))!;
    patternNote = `${d.label}，格局有破象风险（${d.citation}）。药：${d.medicine}。`;
  } else if (
    touGan &&
    yongRootEffective &&
    !hasSoftDisease &&
    (hasXiangShen || patternYongGods.length === 0)
  ) {
    // 成格：透干 + 用神有根 + 无病；相神有则更清，建禄类可无严格相神
    patternStatus = "成格";
    patternNote = hasXiangShen
      ? "月令透干、用神有根且见相神辅佐，成格倾向（《子平真诠》：用神有力、相神辅佐）。"
      : "月令透干且用神有根，格局较清（《子平真诠》成格条件）。";
  } else if (touGan && yongRootEffective && !hasPoXiang) {
    // 透干有根但仍有软病 → 有病（成中有败）
    if (hasSoftDisease) {
      patternStatus = "有病";
      const labels = diseases.map((d) => d.label).join("、");
      patternNote = `透干且用神有根，然见「${labels}」，成中有病（《神峰通考》病药说），运药可解。`;
    } else {
      patternStatus = "成格";
      patternNote =
        "月令透干且用神有根，格局较清（《子平真诠》成格条件）。";
    }
  } else if (hasSoftDisease || !touGan || !yongRootEffective) {
    patternStatus = "有病";
    if (!touGan && monthBenQi) {
      patternNote =
        "月令本气未透，格成而力弱，运助透出方显（《子平真诠》透干取格）。";
    } else if (!yongRootEffective) {
      patternNote =
        "格局用神根气不足，宜运助用神得地（《子平真诠》：用神有力）。";
    } else {
      const labels = diseases.map((d) => d.label).join("、") || "气势未纯";
      patternNote = `见「${labels}」，有病待药（《神峰通考》）。`;
    }
  }

  // 成格时若 hasXiangShen 条件过严导致「有病」却无 diseases：修正
  if (
    patternStatus === "有病" &&
    diseases.length === 0 &&
    touGan &&
    yongRootEffective
  ) {
    patternStatus = "成格";
    patternNote =
      "月令透干且用神有根，格局较清（《子平真诠》成格条件）。";
  }

  const diseaseExplain =
    diseases.length > 0
      ? diseases
          .map(
            (d) =>
              `【病】${d.label}（${d.citation}）→【药】${d.medicine}`,
          )
          .join("；")
      : "未见典型破格病象。";

  const patternExplain = [
    `格局「${patternName}」判定为「${patternStatus}」。`,
    `透干：${touGan ? "是" : "否"}${monthBenQi ? `（月令本气${monthBenQi}）` : ""}；用神有根：${yongRootEffective ? "是" : "否"}；相神：${hasXiangShen ? "见" : "未见"}。`,
    diseaseExplain,
    "以上为规则模板摘要，非绝对断语；成中有败、败中有成须运岁细参（《子平真诠》）。",
  ].join("");

  return {
    patternName,
    patternDesc,
    patternStatus,
    patternNote,
    patternExplain,
    touGan,
    monthBenQi,
    monthTenGod: monthTenGod || "未知",
    yongHasRoot: yongRootEffective,
    hasXiangShen,
    diseases,
  };
}

/** 扶抑用神十神是否在藏干有根 */
export function fuyiYongHasRoot(
  chart: BaziChart,
  yongCategory: string,
): boolean {
  const gods = YONG_CATEGORY_TEN_GODS[yongCategory];
  if (!gods || gods.length === 0) return true; // 调候类不按十神根气硬判
  return tenGodHasRoot(chart, gods);
}

/** 旺衰 + 从格启发式 + 格局成败 */
export function analyzeChart(chart: BaziChart): ChartAnalysis {
  const monthBranch = chart.pillars.month.branch;
  const deLing = isDeLing(chart.dayMaster, monthBranch);
  const { support, drain } = countSupportTenGods(chart);
  const deShi = support >= 2;
  const roots = allHiddenStems(chart);
  const dmWx = STEM_META[chart.dayMaster]?.wuxing;
  const deDi = roots.some((s) => {
    if (!s) return false;
    if (s === chart.dayMaster) return true;
    const rootWx = STEM_META[s]?.wuxing;
    return Boolean(dmWx && rootWx && rootWx === dmWx);
  });

  const dmKey =
    dmWx === "木"
      ? "wood"
      : dmWx === "火"
        ? "fire"
        : dmWx === "土"
          ? "earth"
          : dmWx === "金"
            ? "metal"
            : "water";
  const score = chart.wuxingScores[dmKey] ?? 0;
  const total = scoreSum(chart.wuxingScores) || 1;
  const ratio = score / total;

  let strength: Strength = "中和";
  if (ratio >= 0.45 && support >= 3 && drain <= 1) strength = "从强";
  else if (ratio <= 0.12 && !deDi && drain >= 3 && support <= 1)
    strength = "从弱";
  else if (deLing && (deShi || deDi)) strength = "身旺";
  else if (!deLing && support < drain && !deDi) strength = "身弱";
  else if (deLing && drain > support + 1) strength = "中和";
  else if (!deLing && support > drain) strength = "中和";
  else if (deLing) strength = "身旺";
  else if (!deLing && !deShi) strength = "身弱";

  const pattern = evaluatePattern(chart);

  const yongCfg = YONGSHEN_BY_STRENGTH[strength];
  const { top, weak } = rankWuxing(chart.wuxingScores);
  const topWuxing = WUXING_LABEL[top];
  const weakWuxing = WUXING_LABEL[weak];

  const yongWuxingHint =
    strength === "身旺"
      ? `泄耗方向可参考偏弱之${weakWuxing}与食伤财官之流通`
      : strength === "从强"
        ? `顺势助旺，喜${topWuxing}一类比印延续`
        : strength === "身弱"
          ? `扶身方向可参考日主同类与印星，并留意${topWuxing}是否过旺夺气`
          : strength === "从弱"
            ? `顺势从弱，宜财官食伤流通，忌强扶`
            : `宜以调候与通关为主，平衡${topWuxing}过旺与${weakWuxing}偏缺`;

  const formalDayun = chart.dayun.filter((d) => !d.isPreDayun);
  const currentDayun =
    formalDayun.find((d) => d.index === chart.currentDayunIndex) ??
    formalDayun[0] ??
    undefined;

  return {
    strength,
    deLing,
    deDi,
    deShi,
    monthBranch,
    monthTenGod: pattern.monthTenGod,
    patternName: pattern.patternName,
    patternDesc: pattern.patternDesc,
    patternStatus: pattern.patternStatus,
    patternNote: pattern.patternNote,
    touGan: pattern.touGan,
    monthBenQi: pattern.monthBenQi,
    yongHasRoot: pattern.yongHasRoot,
    hasXiangShen: pattern.hasXiangShen,
    diseases: pattern.diseases,
    patternExplain: pattern.patternExplain,
    yong: yongCfg.yong,
    ji: yongCfg.ji,
    yongNote: yongCfg.note,
    topWuxing,
    weakWuxing,
    yongWuxingHint,
    currentDayun,
    hourUnknown: chart.pillars.hour == null,
    changShengMonth: chart.changSheng?.month,
  };
}

function plainOrPro(viewMode: ViewMode, plain: string, pro: string): string {
  return viewMode === "pro" ? `${plain}\n\n【专业补充】${pro}` : plain;
}

export function buildDayMasterSection(
  chart: BaziChart,
  a: ChartAnalysis,
  viewMode: ViewMode,
): string {
  const meta = STEM_META[chart.dayMaster];
  const trait = meta?.trait ?? "日主特性需结合全局细参";
  const wuxing = meta?.wuxing ?? "未知";
  const yy = meta?.yinYang ?? "";
  const ling = a.deLing ? "得令" : "不得令";
  const di = a.deDi ? "得地" : "根气一般";
  const shi = a.deShi ? "得势" : "党众偏少";

  const plain = plainDayMaster(chart, a);

  const cs = a.changShengMonth
    ? `月令十二长生：${a.changShengMonth}。`
    : "";
  const pro = [
    `日主${chart.dayMaster}（${yy}${wuxing}）。${trait}。旺衰：${a.strength}（${ling}/${di}/${shi}）。${cs}`,
    `《滴天髓》旺衰：得令最重，次看得地、得势；从强从弱须顺势。`,
    tiaohouHint(chart.dayMaster, a.monthBranch),
  ].join(" ");

  return plainOrPro(viewMode, plain, pro);
}

export function buildTenGodsSection(
  chart: BaziChart,
  a: ChartAnalysis,
  viewMode: ViewMode,
  gender?: Gender,
): string {
  const lines: string[] = [];
  const pillarLabels: [string, keyof BaziChart["pillars"]][] = [
    ["年柱", "year"],
    ["月柱", "month"],
    ["日柱", "day"],
    ["时柱", "hour"],
  ];

  for (const [label, key] of pillarLabels) {
    const p = chart.pillars[key];
    if (p == null) {
      lines.push(`${label}：未知（六字盘）`);
      continue;
    }
    const tg =
      p.tenGod ??
      chart.tenGods[key] ??
      (key === "day" ? "日主" : chart.tenGods[`${key}Stem`] ?? "");
    const meaning = TEN_GOD_MEANING[tg] ?? (tg ? "见十神表" : "—");
    lines.push(
      `${label} ${p.stem}${p.branch}${tg ? `（${tg}）` : ""}：${meaning}`,
    );
  }

  const focus = a.monthTenGod && a.monthTenGod !== "未知" ? a.monthTenGod : "月令十神";
  const plain = plainTenGods(chart, a, gender);

  const pro = [
    lines.join("\n"),
    `对日主影响较著者，首重月令提纲之「${focus}」。`,
    liuqinHint(gender),
    "十神以日干为基准（《渊海子平》）；分析时宜看透干力量与地支藏干本气是否一致。",
  ].join("\n");

  return plainOrPro(viewMode, plain, pro);
}

export function buildWuxingSection(
  chart: BaziChart,
  a: ChartAnalysis,
  viewMode: ViewMode,
): string {
  const total = scoreSum(chart.wuxingScores) || 1;
  const dist = WUXING_ORDER.map((k) => {
    const n = chart.wuxingScores[k] ?? 0;
    const pct = Math.round((n / total) * 100);
    return `${WUXING_LABEL[k]}${n}（约${pct}%）`;
  }).join("、");

  const plain = plainWuxing(chart, a);

  const pro = [
    `五行力量分布：${dist}。相对偏旺：${a.topWuxing}；相对偏弱：${a.weakWuxing}。`,
    `喜用侧重「${a.yong}」，忌「${a.ji}」。${a.yongWuxingHint}。`,
    tiaohouHint(chart.dayMaster, a.monthBranch),
    `${a.yongNote}。用神取法尚须兼顾扶抑、调候、通关、顺势（《渊海子平》）。`,
  ].join("\n");

  return plainOrPro(viewMode, plain, pro);
}

export function buildPatternSection(
  chart: BaziChart,
  a: ChartAnalysis,
  viewMode: ViewMode,
): string {
  const plain = plainPattern(chart, a);

  const diseaseLines =
    a.diseases.length > 0
      ? a.diseases
          .map(
            (d) =>
              `病象「${d.label}」→ 药「${d.medicine}」（${d.citation}）`,
          )
          .join("；")
      : "未见典型破格病象。";

  const pro = [
    `月令地支为${a.monthBranch}（${BRANCH_SEASON[a.monthBranch] ?? "当令"}），月令十神倾向「${a.monthTenGod}」。`,
    `格局判定：${a.patternName}（${a.patternStatus}）。${a.patternDesc}`,
    a.patternNote,
    `可解释字段——透干：${a.touGan ? "是" : "否"}${a.monthBenQi ? `（本气${a.monthBenQi}）` : ""}；用神有根：${a.yongHasRoot ? "是" : "否"}；相神：${a.hasXiangShen ? "见" : "未见"}。`,
    diseaseLines,
    a.patternExplain,
    `用神宜清不宜浊（《子平真诠》）：扶抑喜用「${a.yong}」，忌「${a.ji}」。`,
    "《神峰通考》病药说：命有所病，运药相济，方见发挥。以上为规则模板摘要，非绝对断语。",
  ].join("\n");

  return plainOrPro(viewMode, plain, pro);
}

export function buildDayunSection(
  chart: BaziChart,
  a: ChartAnalysis,
  viewMode: ViewMode,
): string {
  if (!chart.dayun.length) {
    return "大运数据暂缺，请先完成排盘引擎大运计算后再解读。";
  }

  const cur = a.currentDayun;
  const detail = chart.startAgeDetail;
  const startLine = detail
    ? detail.months > 0
      ? `起运：约 ${detail.years} 岁 ${detail.months} 个月。`
      : detail.years > 0
        ? `起运：约 ${detail.years} 岁。`
        : "起运：约出生即起运。"
    : "";

  const overview = chart.dayun
    .slice(0, 6)
    .map((d) => {
      const tag = d.isPreDayun ? "起运前小运" : `第${d.index}步`;
      return `${tag} ${d.stem}${d.branch}（约${d.startAge}-${d.endAge}岁，${d.startYear}-${d.endYear}）`;
    })
    .join("；");

  const curText = cur
    ? `当前大运：${cur.stem}${cur.branch}（约${cur.startAge}-${cur.endAge}岁，${cur.startYear}-${cur.endYear}年）。宜对照用神「${a.yong}」是否得运助。`
    : "当前大运索引未命中，请检查 currentDayunIndex。";

  const plain = plainDayun(chart, a);

  const pro = [
    startLine,
    curText,
    `大运序列摘要：${overview}${chart.dayun.length > 6 ? "……" : ""}。`,
    "看运先看是否助用神，次看是否冲合原局忌神（《千里命稿》）。",
  ]
    .filter(Boolean)
    .join("\n");

  return plainOrPro(viewMode, plain, pro);
}

export function buildLiunianSection(
  chart: BaziChart,
  a: ChartAnalysis,
  viewMode: ViewMode,
): string {
  if (!chart.liunian.length) {
    return "流年数据暂缺。可推近 1–3 年干支与原局、大运的生克关系作趋势参考。";
  }

  const lines = chart.liunian.map(
    (y) =>
      `${y.year}年 ${y.stem}${y.branch}（约${y.age}岁）：与原局、大运并参，看是否引动财官印食或冲合日支。`,
  );

  const plain = plainLiunian(chart, a);

  const pro = [
    "近流年：",
    ...lines,
    `喜用「${a.yong}」得年为助则偏顺，忌神当令则宜稳守。《千里命稿》：流年引动何柱，事应何类。`,
  ].join("\n");

  return plainOrPro(viewMode, plain, pro);
}

export function buildCalibrateSection(
  prompts: CalibratePrompt[],
  viewMode: ViewMode,
): string {
  const plain = plainCalibrate(prompts);

  const pro = [
    "校准题（skill 第三阶段第 7 步）：反馈准确/部分准确/不准，仅调表述侧重，不重算四柱。",
    ...prompts.map(
      (p, i) =>
        `${i + 1}. ${p.ageRange}（${p.yearHint}）：${p.nature}`,
    ),
  ].join("\n");

  return plainOrPro(viewMode, plain, pro);
}

export function buildAdviceSection(
  chart: BaziChart,
  a: ChartAnalysis,
  viewMode: ViewMode,
  gender?: Gender,
): string {
  const yongEl =
    a.strength === "身弱" || a.strength === "从弱"
      ? STEM_META[chart.dayMaster]?.wuxing ?? a.weakWuxing
      : a.weakWuxing;
  const color = ADVICE_COLORS[yongEl] ?? "中性淡雅之色";
  const dir = ADVICE_DIRS[yongEl] ?? "顺势而为";

  const plain = plainAdvice(chart, a, gender);
  const love = loveAdviceHint(gender, chart.pillars.day.branch);

  const pro = [
    `【事业】日主${a.strength}，喜用侧重「${a.yong}」，格局「${a.patternName}」。`,
    `【财运】身旺任财、身弱先立业；忌绝对断言。`,
    `【感情】${love}`,
    `【健康】${a.topWuxing}偏旺、${a.weakWuxing}偏弱时注意劳逸；就医优先。`,
    `【方位颜色】${dir}、${color}（趣味参考）。`,
    "禁止恐吓式断语；财务理性决策；健康遵医嘱。",
  ].join("\n");

  return plainOrPro(viewMode, plain, pro);
}

/**
 * 历史校准只问「已发生」时段（PRODUCT §5.4）。
 * 分析基准年：优先流年条最大年（与排盘 analysisBaseDate 一致），否则取今天。
 */
function resolveAnalysisYear(chart: BaziChart): number {
  if (chart.liunian.length > 0) {
    return Math.max(...chart.liunian.map((l) => l.year));
  }
  if (chart.dayun.length > 0 && chart.currentDayunIndex >= 0) {
    const cur = chart.dayun.find(
      (d) => !d.isPreDayun && d.index === chart.currentDayunIndex,
    );
    if (cur) return Math.min(cur.endYear, new Date().getFullYear());
  }
  return new Date().getFullYear();
}

export function buildCalibratePrompts(chart: BaziChart): CalibratePrompt[] {
  const prompts: CalibratePrompt[] = [];
  const analysisYear = resolveAnalysisYear(chart);

  // 大运：正式步（跳过起运前小运），整步已结束或已开始
  const pastDayun = chart.dayun
    .filter((d) => !d.isPreDayun && d.index >= 0 && d.startYear < analysisYear)
    .filter((d) => d.endYear < analysisYear || d.startYear <= analysisYear - 1)
    .sort((a, b) => a.startYear - b.startYear);

  for (let i = 0; i < pastDayun.length && prompts.length < 5; i++) {
    const d = pastDayun[i];
    const nature = natureForGanZhi(d.stem, d.branch, i);
    // 展示年份截断到基准年之前，避免「2024-2033」整段像在问未来
    const hintEnd = Math.min(d.endYear, analysisYear - 1);
    if (hintEnd < d.startYear) continue;
    prompts.push({
      ageRange: `${d.startAge}-${Math.min(d.endAge, d.startAge + (hintEnd - d.startYear))}岁`,
      yearHint: `${d.startYear}-${hintEnd}年`,
      nature: `${d.stem}${d.branch}大运阶段：${nature}`,
      source: "dayun",
    });
  }

  // 流年：仅严格早于分析基准年
  const pastLiunian = chart.liunian
    .filter((y) => y.year < analysisYear)
    .sort((a, b) => a.year - b.year);

  for (let i = 0; i < pastLiunian.length && prompts.length < 5; i++) {
    const y = pastLiunian[i];
    const nature = natureForGanZhi(y.stem, y.branch, i + 3);
    prompts.push({
      ageRange: `约${y.age}岁`,
      yearHint: `${y.year}年`,
      nature: `${y.stem}${y.branch}流年：${nature}`,
      source: "liunian",
    });
  }

  // 仍不足：用更早的大运已结束步；禁止编造未来年份
  if (prompts.length < 3) {
    const ended = chart.dayun
      .filter((d) => d.endYear < analysisYear)
      .sort((a, b) => b.endYear - a.endYear);
    for (const d of ended) {
      if (prompts.length >= 3) break;
      if (prompts.some((p) => p.yearHint.startsWith(`${d.startYear}-`))) continue;
      prompts.push({
        ageRange: `${d.startAge}-${d.endAge}岁`,
        yearHint: `${d.startYear}-${d.endYear}年`,
        nature: `${d.stem}${d.branch}大运阶段：${natureForGanZhi(d.stem, d.branch, prompts.length)}`,
        source: "dayun",
      });
    }
  }

  // 最后兜底：年龄段表述，不写具体未来公元年
  while (prompts.length < 3) {
    const n = prompts.length;
    prompts.push({
      ageRange: `${12 + n * 8}-${20 + n * 8}岁前后`,
      yearHint: "已过去的对应年龄段",
      nature: natureForGanZhi("甲", "子", n),
      source: "life_stage",
    });
  }

  return prompts.slice(0, 5);
}

export function sectionCitations(key: string): string[] {
  switch (key) {
    case "day_master":
      return ["《滴天髓》旺衰", "《穷通宝典》调候"];
    case "ten_gods":
      return ["《渊海子平》十神六亲"];
    case "wuxing":
      return ["《穷通宝典》调候", "《渊海子平》用神取法"];
    case "pattern":
      return ["《子平真诠》格局", "《三命通会》格局", "《神峰通考》病药"];
    case "dayun":
    case "liunian":
      return ["《千里命稿》断命要点", "bazi-skill dayun-rules"];
    case "calibrate":
      return ["bazi-skill 第三阶段·历史事件校准"];
    case "advice":
      return ["bazi-skill 注意事项", "《渊海子平》"];
    default:
      return ["bazi-skill classical-texts"];
  }
}
