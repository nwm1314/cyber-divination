/**
 * 通俗模式：锚定本盘四柱/十神/大运，少术语、无「第四墙」元话术。
 */
import type { BaziChart, Gender, StartAgeDetail } from "@/lib/types";
import {
  ADVICE_COLORS,
  ADVICE_DIRS,
  BRANCH_SEASON,
  loveAdviceHint,
  STEM_META,
  TEN_GOD_MEANING,
  tiaohouHint,
  WUXING_LABEL,
  WUXING_ORDER,
} from "./constants";

type Strength = "身旺" | "身弱" | "中和" | "从强" | "从弱";

type AnalysisLite = {
  strength: Strength;
  monthBranch: string;
  monthTenGod: string;
  patternName: string;
  patternStatus?: string;
  patternNote?: string;
  touGan?: boolean;
  yongHasRoot?: boolean;
  patternExplain?: string;
  yong: string;
  ji: string;
  topWuxing: string;
  weakWuxing: string;
  currentDayun?: BaziChart["dayun"][number];
  hourUnknown: boolean;
};

const STRENGTH_PLAIN: Record<Strength, string> = {
  从强: "气势偏从旺，宜顺势发挥长处，不必硬拧方向",
  从弱: "气势偏从弱，宜借势借力，不宜硬扛",
  身旺: "自身能量偏足，做事容易靠自己顶上，也要防「什么都揽」",
  身弱: "更依赖环境与助力，适合借平台、团队把事做稳，不宜长期硬扛",
  中和: "自身与环境相对平衡，顺不顺主要看选择与时机是否匹配",
};

/** 十神 → 生活白话（用于建议与十神章） */
const TEN_GOD_LIFE: Record<string, string> = {
  比肩: "同辈协作与竞争——能抱团也容易较劲",
  劫财: "行动快、竞争感强，也要防冲动花钱或抢节奏",
  食神: "兴趣输出、表达与从容享受生活的能力",
  伤官: "创意、吐槽与打破常规，适合创新但别怼过头",
  偏财: "机会型收入、人脉与「会抓资源」",
  正财: "稳定收入、储蓄与务实经营",
  七杀: "高压挑战与爆发力——有章法时像推手，没章法时像压力",
  偏官: "高压挑战与爆发力——有章法时像推手，没章法时像压力",
  正官: "规则、平台、头衔与被认可的路径",
  偏印: "冷门专长、独特路径，有时也会偏独处",
  枭神: "冷门专长、独特路径，有时也会偏独处",
  正印: "学习成长、贵人托底与安全感",
  日主: "你自己",
};

const CAREER_BY_GOD: Record<string, string> = {
  正官: "体制内、大平台、需要合规与可验证成绩的岗位更合拍",
  七杀: "高压项目、销售攻坚、创业冲刺类场景更能发挥",
  偏官: "高压项目、销售攻坚、创业冲刺类场景更能发挥",
  正财: "财务、运营、供应链等「把事做实」的岗位更稳",
  偏财: "商务拓展、投资机会、资源撮合类工作更敏感",
  正印: "教研、内容、专业背书、顾问类路径更顺",
  偏印: "技术钻研、小众赛道、独立工作室更合适",
  枭神: "技术钻研、小众赛道、独立工作室更合适",
  食神: "设计、内容、服务体验、产品打磨类工作有优势",
  伤官: "创意、产品创新、自媒体与「敢改规则」的岗位更匹配",
  比肩: "合伙、同业协作或需要强自主的角色常见",
  劫财: "竞争激烈、节奏快的业务线更能适应，也要控风险",
};

const MONEY_BY_GOD: Record<string, string> = {
  正财: "更适合工资+稳健理财，少碰高杠杆",
  偏财: "对机会钱敏感，但每笔大钱都要冷静复盘",
  比肩: "钱上容易「一起花/一起扛」，边界要说清",
  劫财: "防冲动消费与跟风投资，留应急金",
  食神: "技能变现、兴趣变现路径更自然",
  伤官: "创意变现可以，别因情绪决策砸钱",
  正官: "收入与职级/平台绑定度高，升迁比投机更重要",
  七杀: "高压换高回报时，先算清楚代价",
  偏官: "高压换高回报时，先算清楚代价",
  正印: "先投资自己的能力，再谈加码收入",
  偏印: "偏门专长可变现，但周期可能更长",
  枭神: "偏门专长可变现，但周期可能更长",
};

function scoreSum(scores: BaziChart["wuxingScores"]): number {
  return WUXING_ORDER.reduce((s, k) => s + (scores[k] ?? 0), 0);
}

function topTenGods(chart: BaziChart, limit = 3): string[] {
  const counts = new Map<string, number>();
  for (const p of [
    chart.pillars.year,
    chart.pillars.month,
    chart.pillars.day,
    chart.pillars.hour,
  ]) {
    if (!p?.tenGod || p.tenGod === "日主") continue;
    counts.set(p.tenGod, (counts.get(p.tenGod) ?? 0) + 1);
  }
  const mt = chart.pillars.month.tenGod;
  if (mt && mt !== "日主") counts.set(mt, (counts.get(mt) ?? 0) + 1.5);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

function pillarLine(
  label: string,
  p: BaziChart["pillars"]["year"] | null | undefined,
): string {
  if (p == null) return `${label}：时辰未填，这一段先不细断`;
  const tg =
    p.tenGod && p.tenGod !== "日主"
      ? p.tenGod
      : label.startsWith("日柱")
        ? "你自己"
        : "—";
  const life =
    TEN_GOD_LIFE[p.tenGod ?? ""] ?? TEN_GOD_MEANING[p.tenGod ?? ""] ?? "";
  return `${label}「${p.stem}${p.branch}」：${tg}${life ? `——${life}` : ""}`;
}

function wuxingRankText(chart: BaziChart): string {
  const total = scoreSum(chart.wuxingScores) || 1;
  return WUXING_ORDER.map((k) => {
    const n = chart.wuxingScores[k] ?? 0;
    return `${WUXING_LABEL[k]}${Math.round((n / total) * 100)}%`;
  }).join(" · ");
}

function hourBranchHint(chart: BaziChart): string {
  const h = chart.pillars.hour;
  if (!h) return "";
  const tg = h.tenGod ?? "";
  const life = TEN_GOD_LIFE[tg] ?? "";
  return `时柱「${h.stem}${h.branch}」${tg ? `（${tg}）` : ""}体现后半程节奏与输出方式${life ? `：${life}` : ""}。`;
}

export function plainDayMaster(chart: BaziChart, a: AnalysisLite): string {
  const meta = STEM_META[chart.dayMaster];
  const trait = meta?.trait ?? "性格需结合整盘看";
  const season = BRANCH_SEASON[a.monthBranch] ?? "当季";
  const pillars = `${chart.pillars.year.stem}${chart.pillars.year.branch}、${chart.pillars.month.stem}${chart.pillars.month.branch}、${chart.pillars.day.stem}${chart.pillars.day.branch}${
    chart.pillars.hour
      ? `、${chart.pillars.hour.stem}${chart.pillars.hour.branch}`
      : "（时辰未填）"
  }`;
  const hourPart = hourBranchHint(chart);

  const lines = [
    `你是「${chart.dayMaster}${meta?.wuxing ?? ""}」日主：${trait}`,
    `四柱为 ${pillars}。出生约在${season}，整盘力量判断为「${a.strength}」——${STRENGTH_PLAIN[a.strength]}。`,
  ];

  if (a.hourUnknown) {
    lines.push(
      "时辰未填，按六字盘看大方向；与子女、晚年相关的细节会留白，不做硬猜。",
    );
  } else if (hourPart) {
    lines.push(hourPart);
  }

  lines.push(
    `月令提纲偏「${a.monthTenGod}」，可理解为你对外做事时默认的主风格。`,
  );
  // T92：正文强制一行调候（《穷通宝典》原则摘要，不作吉凶断语）
  lines.push(tiaohouHint(chart.dayMaster, a.monthBranch));

  return lines.join("\n");
}

function plainLiuqinLine(gender?: Gender): string {
  if (gender === "male") {
    return "六亲（男命文化参考）：印≈母/庇护与学习，偏财≈父/资源，正财≈伴侣议题，食伤≈表达与才艺，比劫≈兄弟姊妹。请勿对号入座恐吓自己。";
  }
  if (gender === "female") {
    return "六亲（女命文化参考）：印≈母/庇护与学习，偏财≈父/资源，正官≈伴侣议题，食伤≈子女缘与表达，比劫≈兄弟姊妹。请勿对号入座恐吓自己。";
  }
  return "六亲仅作文化参考：印≈庇护/学习，财≈资源与伴侣议题，官杀≈规则与压力，食伤≈表达与子女缘。请勿对号入座恐吓自己。";
}

export function plainTenGods(
  chart: BaziChart,
  a: AnalysisLite,
  gender?: Gender,
): string {
  const focus = topTenGods(chart, 3);
  const focusText =
    focus.length > 0
      ? focus.map((t) => `${t}（${TEN_GOD_LIFE[t] ?? t}）`).join("；")
      : "各柱十神较分散，以月令主轴为准";

  return [
    "按四柱看你人生里几条更显眼的线（参考，非宿命标签）：",
    pillarLine("年柱·早年与家庭底色", chart.pillars.year),
    pillarLine("月柱·社会角色与主业风格", chart.pillars.month),
    pillarLine("日柱·自己与亲密关系", chart.pillars.day),
    pillarLine("时柱·后期节奏与输出", chart.pillars.hour),
    `本盘更突出：${focusText}。月令主轴是「${a.monthTenGod}」。`,
    plainLiuqinLine(gender),
  ].join("\n");
}

export function plainWuxing(chart: BaziChart, a: AnalysisLite): string {
  const favor =
    a.strength === "身旺" || a.strength === "从强"
      ? "宜把精力用在做事、表达、经营与担责上，少靠堆资源硬撑"
      : a.strength === "身弱" || a.strength === "从弱"
        ? "宜先学习充电、挂靠靠谱平台或队友，再谈独自冲刺"
        : "宜小步试错：哪条路顺就加注，哪条堵就换策略";

  return [
    `五行占比：${wuxingRankText(chart)}。`,
    `相对偏多是${a.topWuxing}，相对偏少是${a.weakWuxing}。多不等于全好，少不等于全坏，关键看是否「堵」或「虚」。`,
    `结合日主「${a.strength}」：${favor}。`,
    // T92：五行章正文强制一行调候
    tiaohouHint(chart.dayMaster, a.monthBranch),
    `喜用方向（规则粗判）：多靠近「${a.yong}」相关状态，少长期处在「${a.ji}」过重的环境。`,
  ].join("\n");
}

export function plainPattern(chart: BaziChart, a: AnalysisLite): string {
  const name = a.patternName;
  const soft =
    name.includes("官") && !name.includes("杀")
      ? "更吃规则、平台与可验证成绩"
      : name.includes("杀")
        ? "更吃高压下的决断与执行"
        : name.includes("印")
          ? "更吃学习、背书与专业深度"
          : name.includes("财")
            ? "更吃经营、变现与资源调度"
            : name.includes("食") || name.includes("伤")
              ? "更吃表达、创意与内容输出"
              : "格局名只作粗分，别当身份标签";

  const status = a.patternStatus ?? "待定";
  const statusPlain =
    status === "成格"
      ? "条件相对整齐，发挥空间更大"
      : status === "破象"
        ? "有明显冲突点，宜先化解再冲刺"
        : status === "有病"
          ? "有短板（「病」），用对方法（「药」）仍可走通"
          : "还需结合经历细看";

  const techBits = [
    a.touGan === true
      ? "月令力量透出"
      : a.touGan === false
        ? "月令力量偏藏"
        : "",
    a.yongHasRoot === true
      ? "关键力量有根基"
      : a.yongHasRoot === false
        ? "关键力量根基偏虚"
        : "",
  ]
    .filter(Boolean)
    .join("；");

  return [
    `月令地支「${a.monthBranch}」（约${BRANCH_SEASON[a.monthBranch] ?? "当季"}），提纲十神「${a.monthTenGod}」。`,
    `格局粗判「${name}」（${status}）：${soft}。整体：${statusPlain}。`,
    techBits ? `结构提示：${techBits}。` : "",
    a.patternNote ? `说明：${a.patternNote}` : "",
    `用神方向：多给「${a.yong}」空间，少让「${a.ji}」长期压着你。`,
    "格局是分析框架不是社会阶层；同一格局结果可差很远，选择与努力权重大。",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatStartAgeLine(detail?: StartAgeDetail): string | null {
  if (!detail) return null;
  const { years, months } = detail;
  if (years <= 0 && months <= 0) return "约出生即起运";
  if (months > 0) return `约 ${years} 岁 ${months} 个月起运`;
  return `约 ${years} 岁起运`;
}

export function plainDayun(chart: BaziChart, a: AnalysisLite): string {
  if (!chart.dayun.length) return "大运数据暂缺，请先完成排盘。";
  const cur = a.currentDayun;
  const next = cur
    ? chart.dayun.find((d) => d.index === cur.index + 1)
    : chart.dayun.find((d) => !d.isPreDayun) ?? chart.dayun[0];
  const startLine = formatStartAgeLine(chart.startAgeDetail);

  const curText = cur
    ? `当前大运「${cur.stem}${cur.branch}」（约${cur.startAge}–${cur.endAge}岁，${cur.startYear}–${cur.endYear}年）。主题倾向：${natureForGanZhi(cur.stem, cur.branch, cur.index)}。`
    : "当前年龄未落在已列大运区间（可能尚未起运或已超出列表），请对照下方列表看年龄。";

  const yongHint = cur
    ? `这十年粗看是否帮你靠近「${a.yong}」、少踩「${a.ji}」：是则可顺势加码，否则先稳住基本盘。`
    : `对照喜用「${a.yong}」看哪一步更顺。`;

  const list = chart.dayun
    .slice(0, 6)
    .map((d) => {
      const tag = d.isPreDayun ? "（起运前·小运）" : "";
      return `· ${d.stem}${d.branch}${tag}：约${d.startAge}–${d.endAge}岁（${d.startYear}–${d.endYear}）`;
    })
    .join("\n");

  return [
    startLine,
    curText,
    yongHint,
    next
      ? `下一步「${next.stem}${next.branch}」约自${next.startAge}岁（${next.startYear}）起，可提前储备能力与关系，不必焦虑。`
      : "",
    "大运前几步：",
    list,
  ]
    .filter(Boolean)
    .join("\n");
}

export function plainLiunian(chart: BaziChart, a: AnalysisLite): string {
  if (!chart.liunian.length) return "流年数据暂缺。";

  const lines = chart.liunian.map((y, i) => {
    const theme = natureForGanZhi(y.stem, y.branch, i);
    return `· ${y.year}年「${y.stem}${y.branch}」（约${y.age}岁）：可观察是否出现「${theme}」类节奏——用经历对照，不作事件预言。`;
  });

  return [
    "近 1–3 年谈趋势，不预测具体事件：",
    ...lines,
    `总原则：原局 + 大运 + 流年一起看；喜用「${a.yong}」得助时更可尝试，忌神重时先防守。`,
  ].join("\n");
}

export function plainCalibrate(
  prompts: { ageRange: string; yearHint: string; nature: string }[],
): string {
  const lines = prompts.map(
    (p, i) =>
      `${i + 1}. 约 ${p.ageRange}（${p.yearHint}）前后，是否经历过类似「${p.nature}」？`,
  );
  return [
    "以下问题用于校准报告侧重点：选准确 / 部分准确 / 不准即可。不会改写你的四柱，只会调整后文强调。",
    ...lines,
  ].join("\n");
}

export function plainAdvice(
  chart: BaziChart,
  a: AnalysisLite,
  gender?: Gender,
): string {
  const focus = topTenGods(chart, 2);
  const mainGod = a.monthTenGod && a.monthTenGod !== "未知" ? a.monthTenGod : focus[0] ?? "";
  const careerGod = CAREER_BY_GOD[mainGod] ?? CAREER_BY_GOD[focus[0] ?? ""] ?? "";
  const moneyGod = MONEY_BY_GOD[mainGod] ?? MONEY_BY_GOD[focus[0] ?? ""] ?? "";

  const careerStrength =
    a.strength === "身旺" || a.strength === "从强"
      ? "你能量偏足，适合扛事、对外输出，但要设边界，别把「能扛」变成「全扛」。"
      : a.strength === "身弱" || a.strength === "从弱"
        ? "你更适合先挂靠平台/导师/团队，专业做深再谈单干，拒绝长期透支。"
        : "事业上宜「试点→反馈→加注」，避免一次 All-in。";

  const career = [
    careerStrength,
    careerGod ? `结合月令「${mainGod}」：${careerGod}。` : "",
    `格局粗标「${a.patternName}」，路径尽量与「${a.yong}」同向，少硬刚「${a.ji}」。`,
  ]
    .filter(Boolean)
    .join("");

  const money = [
    a.strength === "身旺" || a.strength === "从强"
      ? "钱上可学经营，忌赌性投机，现金流优先。"
      : "先稳住主业收入，再谈副业；大额决策给自己冷静期。",
    moneyGod ? `本盘「${mainGod}」取象：${moneyGod}。` : "",
    "以上不构成投资建议。",
  ]
    .filter(Boolean)
    .join("");

  const dayBranch = chart.pillars.day.branch;
  const loveExtra = loveAdviceHint(gender, dayBranch);

  const yongEl =
    a.strength === "身弱"
      ? STEM_META[chart.dayMaster]?.wuxing ?? a.weakWuxing
      : a.weakWuxing;
  const color = ADVICE_COLORS[yongEl] ?? "中性色";
  const dir = ADVICE_DIRS[yongEl] ?? "顺势";

  const cur = a.currentDayun;
  const timing = cur
    ? `当前大运「${cur.stem}${cur.branch}」阶段，优先把资源投在与「${a.yong}」一致的方向上。`
    : `对照喜用「${a.yong}」安排近阶段重心。`;

  return [
    `【事业】${career}`,
    `【钱】${money}`,
    `【感情】${loveExtra}`,
    `【身心】五行上${a.topWuxing}偏显眼、${a.weakWuxing}偏弱时，注意劳逸与睡眠；身体问题请就医。`,
    `【节奏】${timing}`,
    `【趣味】颜色/方位可轻取：${color}、${dir}，仅作氛围参考。`,
    "命理分析仅供参考，人生在于自身的努力和选择。",
  ].join("\n");
}

const NATURE_BY_STEM: Record<string, string[]> = {
  甲: ["新方向启动或换赛道", "承担责任变重", "学习成长加速"],
  乙: ["关系协作变化", "计划需要变通", "表达/审美类机会"],
  丙: ["曝光与社交变多", "热情项目上线", "作息容易过载"],
  丁: ["专注深耕一段", "细节要求变高", "情绪需细心照顾"],
  戊: ["稳定建设期", "信任与信誉议题", "置业或长期承诺"],
  己: ["事务与协调变多", "理财习惯调整", "照顾型责任"],
  庚: ["需要决断与切割", "规则冲突", "效率改革"],
  辛: ["对品质要求变高", "合作细节计较", "精致化升级"],
  壬: ["流动、出行或信息过载", "思路打开", "跨界接触"],
  癸: ["需要休整沉淀", "隐性机会", "情绪起伏"],
};

export function natureForGanZhi(
  stem: string,
  branch: string,
  fallbackIndex: number,
): string {
  const pool = NATURE_BY_STEM[stem] ?? [
    "环境节奏变化",
    "重要选择节点",
    "关系或资源重组",
  ];
  const bi = ["子", "午", "卯", "酉"].includes(branch) ? 1 : 0;
  return pool[(fallbackIndex + bi) % pool.length];
}
