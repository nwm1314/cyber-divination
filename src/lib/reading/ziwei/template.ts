import type {
  Gender,
  ViewMode,
  ZiweiChart,
  ZiweiPalace,
  ZiweiPalaceName,
  ZiweiReadingReport,
  ZiweiReadingSection,
  ZiweiReadingSectionKey,
} from "@/lib/types";
import {
  DISCLAIMER,
  ZIWEI_SECTION_KEYS,
  ZIWEI_SECTION_TITLES,
} from "./sections";

export type ZiweiTemplateReadingOptions = {
  viewMode?: ViewMode;
  chartId?: string;
  gender?: Gender;
};

function findPalace(
  chart: ZiweiChart,
  name: ZiweiPalaceName | string,
): ZiweiPalace | undefined {
  return chart.palaces.find((p) => p.name === name);
}

function starNames(palace?: ZiweiPalace, category?: string): string[] {
  if (!palace) return [];
  return palace.stars
    .filter((s) => (category ? s.category === category : true))
    .map((s) => s.name);
}

function majorList(chart: ZiweiChart, palaceName: string): string[] {
  const fromMap = chart.majorStars?.[palaceName];
  if (fromMap && fromMap.length > 0) return fromMap;
  return starNames(findPalace(chart, palaceName), "major");
}

function joinStars(names: string[], empty = "暂无主星标注"): string {
  return names.length > 0 ? names.join("、") : empty;
}

/** 主星名+亮度（有 brightness 时） */
function majorListWithBrightness(
  chart: ZiweiChart,
  palaceName: string,
): string {
  const p = findPalace(chart, palaceName);
  if (!p) return joinStars(majorList(chart, palaceName));
  const majors = p.stars.filter(
    (s) => !s.category || s.category === "major",
  );
  if (majors.length === 0) return joinStars(majorList(chart, palaceName));
  return majors
    .map((s) => (s.brightness ? `${s.name}（${s.brightness}）` : s.name))
    .join("、");
}

function genderHint(gender?: Gender): string {
  if (gender === "male") return "男命";
  if (gender === "female") return "女命";
  return "档案性别未注明";
}

function buildOverview(
  chart: ZiweiChart,
  viewMode: ViewMode,
  gender?: Gender,
): string {
  const majors = majorList(chart, "命宫");
  const ju = chart.wuxingJu?.trim() || "五行局待排盘引擎补全";
  const g = genderHint(gender);
  const plain = [
    `本盘命宫在「${chart.mingGong}」，身宫在「${chart.shenGong}」，${g}。`,
    `命宫主星：${joinStars(majors)}；五行局：${ju}。`,
    chart.mingZhu || chart.shenZhu
      ? `命主${chart.mingZhu ?? "—"}，身主${chart.shenZhu ?? "—"}。`
      : "",
    "以下各章按宫位与大限流年作结构化摘要，供传统文化学习参考；具体取象因人而异，宜结合自身经历体会。",
  ]
    .filter(Boolean)
    .join("");

  if (viewMode === "pro") {
    const school = chart.meta?.school ?? "sanhe";
    return `${plain}\n（专业注：流派标注 ${school}；引擎 ${chart.meta?.skillRef ?? "—"}@${chart.meta?.engineVersion ?? "—"}。）`;
  }
  return plain;
}

function buildMingGong(chart: ZiweiChart, viewMode: ViewMode): string {
  const p = findPalace(chart, "命宫");
  const majorsText = majorListWithBrightness(chart, "命宫");
  const softs = starNames(p, "soft");
  const harshs = starNames(p, "harsh");
  const branch = p?.branch ? `（${p.branch}）` : "";
  const sihuaHere =
    p?.stars
      .filter((s) => s.sihua?.length)
      .map((s) => `${s.name}${s.sihua!.join("")}`)
      .join("、") ?? "";
  const misc = starNames(p, "misc");
  const liuChang = p?.stars.filter((s) => s.name === "流昌" || s.name === "流曲").map((s) => s.name) ?? [];
  const jiekong = p?.stars.some((s) => s.name === "截空") ?? false;
  const zihuaHere =
    p?.stars
      .filter((s) => s.sihua?.some((x) => x.startsWith("自化")))
      .map(
        (s) =>
          `${s.name}${s.sihua!.filter((x) => x.startsWith("自化")).join("")}`,
      )
      .join("、") ?? "";
  const feixingOut = p?.feixingOut?.length
    ? p.feixingOut
        .map(
          (f) =>
            `化${f.kind}→${f.star}@${f.toPalace}${f.self ? "自" : ""}`,
        )
        .join("、")
    : "";
  const feixingIn =
    p?.stars
      .flatMap((s) =>
        (s.sihua ?? [])
          .filter((x) => x.includes("·化"))
          .map((x) => `${s.name}受${x}`),
      )
      .slice(0, 6)
      .join("、") ?? "";
  const base = [
    `命宫${branch}是性格与人生基调的核心宫位。`,
    `主星：${majorsText || joinStars(majorList(chart, "命宫"))}。`,
    softs.length ? `吉辅：${softs.join("、")}。` : "",
    harshs.length ? `煞曜：${harshs.join("、")}（中性参考，非吉凶定论）。` : "",
    liuChang.length ? `流昌流曲：${liuChang.join("、")}。` : "",
    jiekong ? "本宫见截空（中性参考，非吉凶定论）。" : "",
    misc.length ? `杂曜（博士系）：${misc.join("、")}。` : "",
    sihuaHere ? `本宫四化/自化/飞入：${sihuaHere}。` : "",
    zihuaHere && !sihuaHere.includes("自化")
      ? `本宫自化：${zihuaHere}。`
      : "",
    feixingOut ? `命宫飞出：${feixingOut}。` : "",
    feixingIn ? `命宫飞入标记：${feixingIn}。` : "",
    "主星组合偏稳重者，做事多讲步骤与秩序；偏灵活者，适应力与学习欲更强。",
    "庙旺利陷仅描述星曜在该宫地支的得地程度，不作吉凶定论。",
    "不必把星曜标签当作固定人设，可当作自我觉察的线索：发挥所长、补足节奏，比纠结「好坏」更有用。",
  ]
    .filter(Boolean)
    .join("");

  if (viewMode === "pro") {
    return `${base}\n（专业注：命宫宜与三方四正、飞星飞出/入、流昌流曲截空同参；忌恐吓断语。）`;
  }
  return base;
}

function buildPalaceSection(
  chart: ZiweiChart,
  palaceName: ZiweiPalaceName,
  theme: string,
  tips: string[],
  viewMode: ViewMode,
): string {
  const p = findPalace(chart, palaceName);
  const majorsText = majorListWithBrightness(chart, palaceName);
  const softs = starNames(p, "soft");
  const branch = p?.branch ? `地支${p.branch}，` : "";
  const body = [
    `${palaceName}看${theme}。${branch}主星：${majorsText || joinStars(majorList(chart, palaceName), "主星信息待补全")}。`,
    softs.length ? `辅星：${softs.join("、")}。` : "",
    ...tips,
  ]
    .filter(Boolean)
    .join("");

  if (viewMode === "pro") {
    return `${body}\n（专业注：${palaceName}宜结合大限流年与四化、亮度同参，忌单宫断语。）`;
  }
  return body;
}

function buildLuck(chart: ZiweiChart, viewMode: ViewMode): string {
  const steps = chart.daxian ?? [];
  const idx = chart.currentDaxianIndex ?? -1;
  const current =
    idx >= 0 && idx < steps.length ? steps[idx] : steps[steps.length - 1];

  const daxianLines =
    steps.length === 0
      ? "大限序列尚未排出（引擎 T102 就绪后可展示完整大限）。"
      : steps
          .slice(0, 6)
          .map((s, i) => {
            const sh =
              s.sihuaOut?.length
                ? `化${s.sihuaOut.map((x) => x.kind).join("")}`
                : "";
            return `${i + 1}) ${s.startAge}–${s.endAge}岁 · ${s.palace}${s.branch ? `（${s.branch}）` : ""}${s.stem ? s.stem : ""}${sh ? `·${sh}` : ""}${idx === (s.index ?? i) ? " ←当前" : ""}`;
          })
          .join("；");

  const liu = chart.liunian ?? [];
  const liuLine =
    liu.length === 0
      ? "流年条目待补全。"
      : liu
          .slice(0, 5)
          .map((n) => {
            const sh =
              n.sihuaOut?.length
                ? `化${n.sihuaOut.map((x) => x.kind).join("")}`
                : "";
            const cq =
              n.liuChangPalace || n.liuQuPalace
                ? `流昌${n.liuChangPalace ?? "—"}/流曲${n.liuQuPalace ?? "—"}`
                : "";
            return `${n.year}年（约${n.age}岁）${n.palace ? `·${n.palace}` : ""}${n.branch ? `（${n.branch}）` : ""}${n.stem ? n.stem : ""}${sh ? `·${sh}` : ""}${cq ? `·${cq}` : ""}`;
          })
          .join("；");

  const yue = chart.liuyue ?? [];
  const yueLine =
    yue.length === 0
      ? "流月条目待补全。"
      : yue
          .map((n) => {
            const sh =
              n.sihuaOut?.length
                ? `化${n.sihuaOut.map((x) => x.kind).join("")}`
                : "";
            return `${n.month}${n.palace ? `·${n.palace}` : ""}${n.branch ? `（${n.branch}）` : ""}${n.stem ?? ""}${sh ? `·${sh}` : ""}`;
          })
          .join("；");

  const ri = chart.liuri ?? [];
  const riLine =
    ri.length === 0
      ? "流日条目待补全。"
      : ri
          .map((n) => {
            const sh =
              n.sihuaOut?.length
                ? `化${n.sihuaOut.map((x) => x.kind).join("")}`
                : "";
            return `${n.date}${n.palace ? `·${n.palace}` : ""}${n.branch ? `（${n.branch}）` : ""}${n.stem ?? ""}${sh ? `·${sh}` : ""}`;
          })
          .join("；");

  const curSihua =
    current?.sihuaOut?.length
      ? `当前大限宫干${current.stem ?? ""}飞出：${current.sihuaOut
          .map(
            (x) =>
              `化${x.kind}→${x.star}@${x.toPalace}${x.self ? "自" : ""}`,
          )
          .join("、")}。`
      : "";

  const curHint = current
    ? `当前参考大限约在「${current.palace}」宫（${current.startAge}–${current.endAge}岁），宜把注意力放在该宫主题的学习与实践上。`
    : "当前大限索引未知，可先以命宫与三方四正作基线理解。";

  const base = [
    "大限、流年、流月与流日描述的是阶段性侧重，不是命运判决。",
    curHint,
    curSihua,
    `大限摘要：${daxianLines}。`,
    `近流年：${liuLine}。`,
    `当月流月：${yueLine}。`,
    `当日流日：${riLine}。`,
    "遇到节奏变化时，优先调整计划与节奏，保持身心与财务的基本稳健。",
  ]
    .filter(Boolean)
    .join("");

  if (viewMode === "pro") {
    return `${base}\n（专业注：大限宫干/流年干/月干/日干四化为运限叠盘字段；忌用单一流日恐吓断语。）`;
  }
  return base;
}

function ensureSectionBody(body: string, fallback: string): string {
  const t = body.trim();
  return t.length > 0 ? t : fallback;
}

function sihuaSummary(chart: ZiweiChart): string {
  const marks: string[] = [];
  for (const p of chart.palaces) {
    for (const s of p.stars) {
      if (s.sihua?.length) {
        marks.push(`${s.name}${s.sihua.join("")}（${p.name}）`);
      }
    }
  }
  if (marks.length === 0) return "";
  return `生年四化：${marks.slice(0, 6).join("、")}${marks.length > 6 ? "等" : ""}。`;
}

function softHarshAtMing(chart: ZiweiChart): string {
  const p = findPalace(chart, "命宫");
  if (!p) return "";
  const soft = starNames(p, "soft");
  const harsh = starNames(p, "harsh");
  const misc = starNames(p, "misc");
  const parts: string[] = [];
  if (soft.length) parts.push(`吉辅${soft.join("、")}`);
  if (harsh.length) parts.push(`煞曜${harsh.join("、")}`);
  if (misc.length) parts.push(`博士系${misc.join("、")}`);
  if (p.feixingOut?.length) {
    parts.push(
      `飞出${p.feixingOut.map((f) => `化${f.kind}`).join("")}`,
    );
  }
  return parts.length ? `命宫另见${parts.join("；")}。` : "";
}

function buildAdvice(
  chart: ZiweiChart,
  viewMode: ViewMode,
  gender?: Gender,
): string {
  const mingMajors = majorList(chart, "命宫");
  const careerMajors = majorList(chart, "官禄");
  const wealthMajors = majorList(chart, "财帛");
  const g = genderHint(gender);
  const mingText = joinStars(mingMajors, "主星待补");
  const careerText = joinStars(careerMajors, "待补");
  const wealthText = joinStars(wealthMajors, "待补");
  const sihua = sihuaSummary(chart);
  const auxHint = softHarshAtMing(chart);
  // 首条即实质句（非「综合建议：」标题），便于 extractShareMotto 截签语
  const lead = `命宫主星${mingText}定人生基调，官禄${careerText}、财帛${wealthText}可对照事业与理财节奏（${g}，仅供参考）。`;
  const base = ensureSectionBody(
    [
      lead,
      auxHint,
      sihua,
      `事业上，宜选能发挥官禄主星优势的方向，重过程与复盘，不急于一次定终身。`,
      `财务上，以「可承受风险 + 长期习惯」为先，避免情绪化决策。`,
      "关系上，夫妻宫只提供相处风格线索，沟通与边界感比标签更重要。",
      "节奏上，大限流年提示阶段重点，可用作年度规划参考，而非恐惧来源。",
      "命理是镜子，选择权始终在自己手里。",
    ]
      .filter(Boolean)
      .join("\n"),
    `命宫主星${mingText}宜发挥所长；官禄与财帛作现实对照，稳中求进。`,
  );

  if (viewMode === "pro") {
    return `${base}\n（专业注：建议章不替代医疗/法律/投资意见；辅星/四化为表驱动事实引用。）`;
  }
  return base;
}

function buildBodies(
  chart: ZiweiChart,
  viewMode: ViewMode,
  gender?: Gender,
): Record<ZiweiReadingSectionKey, string> {
  return {
    overview: ensureSectionBody(
      buildOverview(chart, viewMode, gender),
      "本盘命宫与身宫信息待补全；以下各章供传统文化学习参考。",
    ),
    ming_gong: ensureSectionBody(
      buildMingGong(chart, viewMode),
      "命宫是性格与人生基调的核心宫位，主星信息待排盘引擎补全。",
    ),
    career: ensureSectionBody(
      buildPalaceSection(
        chart,
        "官禄",
        "事业方向、协作方式与成就感来源",
        [
          "官禄有主星时，可对照自身擅长的工作节奏与角色定位。",
          "无主星或信息不全时，不代表「无事业」，只表示本盘该宫信息待引擎补全。",
          "建议把注意力放在可持续的技能积累与团队协作上。",
        ],
        viewMode,
      ),
      "官禄宫看事业方向与协作方式；主星信息待补全时，宜先积累可持续技能。",
    ),
    wealth: ensureSectionBody(
      buildPalaceSection(
        chart,
        "财帛",
        "理财风格、资源整合与价值交换",
        [
          "财帛主星偏稳健者，宜定投式规划；偏活跃者，可在可控范围内尝试多元收入。",
          "任何星曜组合都不构成投资建议，重大财务决定请结合现实条件与专业意见。",
        ],
        viewMode,
      ),
      "财帛宫看理财风格与资源整合；重大财务决定请结合现实条件。",
    ),
    relationship: ensureSectionBody(
      buildPalaceSection(
        chart,
        "夫妻",
        "亲密关系的相处基调与沟通风格",
        [
          gender === "male"
            ? "男命档案下，本宫可作伴侣议题的参考线索之一，宜建设性沟通。"
            : gender === "female"
              ? "女命档案下，本宫可作伴侣议题的参考线索之一，宜建设性沟通。"
              : "感情议题宜中性表述：尊重差异、明确边界，比套用刻板标签更有帮助。",
          "关系质量取决于双方选择与经营，星曜只是讨论起点。",
        ],
        viewMode,
      ),
      "夫妻宫提供相处风格线索；沟通与边界感比标签更重要。",
    ),
    luck: ensureSectionBody(
      buildLuck(chart, viewMode),
      "大限与流年描述阶段性侧重，宜调整计划与节奏，保持身心与财务稳健。",
    ),
    advice: buildAdvice(chart, viewMode, gender),
    disclaimer: DISCLAIMER,
  };
}

/**
 * 紫微规则模板解读（无 LLM）
 * 章节 key 固定 8 章；无完整引擎时仍可读。
 */
export function renderZiweiTemplateReading(
  chart: ZiweiChart,
  options?: ZiweiTemplateReadingOptions,
): ZiweiReadingReport {
  const viewMode: ViewMode = options?.viewMode ?? "plain";
  const gender = options?.gender;
  const bodies = buildBodies(chart, viewMode, gender);

  const sections: ZiweiReadingSection[] = ZIWEI_SECTION_KEYS.map((key) => ({
    key,
    title: ZIWEI_SECTION_TITLES[key],
    body: bodies[key],
  }));

  return {
    chartId: options?.chartId ?? chart.id,
    kind: "ziwei",
    mode: "template",
    viewMode,
    sections,
    disclaimer: DISCLAIMER,
    engineVersion: chart.meta?.engineVersion,
    school: chart.meta?.school,
    warnings: chart.warnings?.length ? [...chart.warnings] : undefined,
  };
}
