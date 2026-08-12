import type {
  LiuyaoChart,
  LiuyaoLine,
  LiuyaoMethod,
  LiuyaoReadingReport,
  LiuyaoReadingSection,
  LiuyaoReadingSectionKey,
  ViewMode,
  YaoValue,
} from "@/lib/types";
import {
  getHexagramByTrigrams,
  type HexagramEntry,
} from "@/lib/liuyao";
import { analyzeDongBian, staticDongBianHint } from "@/lib/liuyao/analyze/dongbian";
import { resolveYongShenStatus } from "@/lib/liuyao/analyze/yongshen-status";
import { LIUYAO_RULE_SCOPE_NOTE } from "@/lib/liuyao/analyze/scope";
import {
  DISCLAIMER,
  LIUYAO_SECTION_KEYS,
  LIUYAO_SECTION_TITLES,
} from "./sections";

export type LiuyaoTemplateReadingOptions = {
  viewMode?: ViewMode;
  chartId?: string;
};

const YAO_POS_LABEL: Record<number, string> = {
  1: "初爻",
  2: "二爻",
  3: "三爻",
  4: "四爻",
  5: "五爻",
  6: "上爻",
};

const YAO_VALUE_LABEL: Record<YaoValue, string> = {
  6: "老阴（动）",
  7: "少阳（静）",
  8: "少阴（静）",
  9: "老阳（动）",
};

const METHOD_LABEL: Record<LiuyaoMethod, string> = {
  coins: "铜钱起卦",
  time: "时间起卦",
  manual: "手动指定",
};

function lookupHex(upper: string, lower: string): HexagramEntry | undefined {
  return getHexagramByTrigrams(
    upper as HexagramEntry["upper"],
    lower as HexagramEntry["lower"],
  );
}

function formatLine(line: LiuyaoLine): string {
  const pos = YAO_POS_LABEL[line.yao] ?? `第${line.yao}爻`;
  const val = YAO_VALUE_LABEL[line.value] ?? String(line.value);
  return `${pos}${val}${line.changing ? " ←动" : ""}`;
}

function changingLines(chart: LiuyaoChart): LiuyaoLine[] {
  return chart.lines.filter((l) => l.changing);
}

function buildQuestion(chart: LiuyaoChart, viewMode: ViewMode): string {
  const method = METHOD_LABEL[chart.method] ?? chart.method;
  const scopeNote = LIUYAO_RULE_SCOPE_NOTE;
  const base = [
    scopeNote,
    "六爻解卦强调「一事一问」：本卦只对应您当下所问的一件事，勿把同一卦套到无关议题。",
    `所问：${chart.question.trim() || "（未填写事项）"}。`,
    `起卦方式：${method}。`,
    "若所问含糊、多事并问，宜重新聚焦核心问题后再起一卦。",
  ].join("");

  if (viewMode === "pro") {
    return `${base}\n（专业注：问句宜具体、可行动；忌包罗万象的「运势总评」。）`;
  }
  return base;
}

function buildBenGua(chart: LiuyaoChart, viewMode: ViewMode): string {
  const { benGua } = chart;
  const entry = lookupHex(benGua.upper, benGua.lower);
  const lineDesc = chart.lines.map(formatLine).join("；");
  const guaci = entry?.guaci?.trim() || "卦辞摘要待数据表补全。";
  const short = entry?.shortName ? `（${entry.shortName}）` : "";

  const base = [
    `本卦「${benGua.name}」${short}：上${benGua.upper}、下${benGua.lower}。`,
    `卦辞要旨：${guaci}`,
    `六爻（自下而上）：${lineDesc}。`,
    "本卦描述当下局面的主基调，宜与所问事项对照理解，而非抽象断「吉凶终身」。",
  ].join("");

  if (viewMode === "pro") {
    const idx = entry?.index != null ? `文王序第${entry.index}卦；` : "";
    return `${base}\n（专业注：${idx}引擎 ${chart.meta?.engineVersion ?? "—"}；本模板以 lines/benGua 为主，世应/用神待 T112 完善。）`;
  }
  return base;
}

function buildChanging(chart: LiuyaoChart, viewMode: ViewMode): string {
  const movers = changingLines(chart);
  if (movers.length === 0) {
    const base = [
      "本卦无动爻，暂不变卦。",
      staticDongBianHint(),
      "若后续情况变化明显，可就新问题另起一卦（仍须一事一问）。",
    ].join("");
    if (viewMode === "pro") {
      return `${base}\n（专业注：无动爻时不以变卦辞强行取象；引擎无动变生克项。）`;
    }
    return base;
  }

  const moverText = movers
    .map((l) => {
      const pos = YAO_POS_LABEL[l.yao] ?? `第${l.yao}爻`;
      const entry = lookupHex(chart.benGua.upper, chart.benGua.lower);
      const yaoci =
        entry?.yaoci?.[l.yao - 1]?.trim() ||
        `${pos}动，宜结合卦象与所问体会。`;
      const lq = l.liuqin ? `六亲${l.liuqin}` : "";
      const wx = l.wuxing ? `${l.wuxing}` : "";
      const meta = [lq, wx].filter(Boolean).join("·");
      return `${pos}（${YAO_VALUE_LABEL[l.value]}${meta ? `，${meta}` : ""}）：${yaoci}`;
    })
    .join("\n");

  const dongItems = analyzeDongBian(chart);
  const dongLines =
    dongItems.length > 0
      ? [
          "动变生克（表驱动简表）：",
          ...dongItems.map((it) => it.summary),
        ].join("\n")
      : "";

  const bian = chart.bianGua;
  const bianEntry = bian
    ? lookupHex(bian.upper, bian.lower)
    : undefined;
  const bianLine = bian
    ? `变卦「${bian.name}」：上${bian.upper}、下${bian.lower}。${bianEntry?.guaci ? `要旨：${bianEntry.guaci}` : ""}`
    : "变卦信息待补全。";

  const base = [
    `动爻共 ${movers.length} 处，提示局面中正在变化或需重点留意的环节。`,
    moverText,
    dongLines,
    bianLine,
    "动变描述的是趋势与转折，宜作节奏参考，不作恐吓式断言。",
  ]
    .filter(Boolean)
    .join("\n");

  if (viewMode === "pro") {
    return `${base}\n（专业注：多动爻时宜分主次；生克为五行倾向，忌恐吓断语。）`;
  }
  return base;
}

function buildShiYing(chart: LiuyaoChart, viewMode: ViewMode): string {
  const shiOk = chart.shiYao >= 1 && chart.shiYao <= 6;
  const yingOk = chart.yingYao >= 1 && chart.yingYao <= 6;
  const yong = chart.yongShen?.trim();

  if (!shiOk && !yingOk) {
    const base = [
      "世应与用神字段尚未由解卦引擎（T112）完整填充，本模板仅据六爻与本/变卦作中性说明。",
      "一般而言：世爻多关「问事之主体/己方」，应爻多关「对方或所对之事」。",
      "待世应排出后，可再对照动爻位置，看主客互动是否顺畅。",
      yong ? `用神标注：${yong}。` : "用神规则表就绪后将按事项类别取用神。",
    ]
      .filter(Boolean)
      .join("");

    if (viewMode === "pro") {
      return `${base}\n（专业注：shiYao/yingYao 当前为占位；勿据 0 位强断。）`;
    }
    return base;
  }

  const shiLabel = shiOk
    ? YAO_POS_LABEL[chart.shiYao] ?? `第${chart.shiYao}爻`
    : "未定";
  const yingLabel = yingOk
    ? YAO_POS_LABEL[chart.yingYao] ?? `第${chart.yingYao}爻`
    : "未定";
  const shiLine = shiOk
    ? chart.lines.find((l) => l.yao === chart.shiYao)
    : undefined;
  const yingLine = yingOk
    ? chart.lines.find((l) => l.yao === chart.yingYao)
    : undefined;

  const yongYao =
    chart.yongShenYao != null && chart.yongShenYao >= 1 && chart.yongShenYao <= 6
      ? YAO_POS_LABEL[chart.yongShenYao] ?? `第${chart.yongShenYao}爻`
      : "";
  const yongLine =
    yongYao && chart.yongShenYao
      ? chart.lines.find((l) => l.yao === chart.yongShenYao)
      : undefined;
  const yongSt =
    chart.yongShenStatus ??
    resolveYongShenStatus(chart, chart.yongShenYao).status;
  const yongStSummary = resolveYongShenStatus(
    chart,
    chart.yongShenYao,
  ).summary;
  const yongKong =
    chart.yongShenKong === true
      ? "用神值旬空"
      : chart.yongShenKong === false && chart.xunKong
        ? "用神不空"
        : "";
  const yongDetail = yong
    ? `用神：${yong}${yongYao ? `（落${yongYao}${yongLine?.liuqin ? `·${yongLine.liuqin}` : ""}${yongLine?.wuxing ? yongLine.wuxing : ""}${yongLine?.branch ? yongLine.branch : ""}，${yongSt}${yongKong ? `，${yongKong}` : ""}）` : `（${yongSt}）`}。`
    : "用神可按所问类别进一步取定（规则表驱动）。";

  const timeHint = chart.dayGanZhi
    ? `占时日辰${chart.dayGanZhi}${chart.yueJian ? `，月建${chart.yueJian}` : ""}${chart.xunKong ? `，旬空${chart.xunKong.join("")}` : ""}。`
    : "";
  const yingQi = chart.yingQiHint?.trim()
    ? chart.yingQiHint.trim()
    : "";

  const base = [
    `世爻在${shiLabel}${shiLine ? `（${YAO_VALUE_LABEL[shiLine.value]}${shiLine.changing ? "，动" : ""}${shiLine.liuqin ? `，${shiLine.liuqin}` : ""}）` : ""}，多关己方状态与主动选择。`,
    `应爻在${yingLabel}${yingLine ? `（${YAO_VALUE_LABEL[yingLine.value]}${yingLine.changing ? "，动" : ""}${yingLine.liuqin ? `，${yingLine.liuqin}` : ""}）` : ""}，多关对方、环境或所问对象。`,
    yongDetail,
    yongStSummary,
    timeHint,
    yingQi,
    "世应关系宜中性理解：顺畅时利于协作推进，阻滞时宜沟通与调整节奏，而非判定「必成/必败」。",
  ]
    .filter(Boolean)
    .join("");

  if (viewMode === "pro") {
    return `${base}\n（专业注：世应宜与动爻、变卦、用神状态、旬空/应期同参；忌单看世应恐吓。）`;
  }
  return base;
}

function ensureSectionBody(body: string, fallback: string): string {
  const t = body.trim();
  return t.length > 0 ? t : fallback;
}

function moverSummary(movers: LiuyaoLine[]): string {
  if (movers.length === 0) return "无动爻（静卦）";
  return movers
    .map((l) => YAO_POS_LABEL[l.yao] ?? `第${l.yao}爻`)
    .join("、");
}

function yongShenLabel(chart: LiuyaoChart): string {
  const yong = chart.yongShen?.trim();
  return yong && yong.length > 0 ? yong : "用神待按事类取定";
}

function questionLabel(chart: LiuyaoChart): string {
  const q = chart.question?.trim();
  return q && q.length > 0 ? q : "当前所问一事";
}

function buildJudgment(chart: LiuyaoChart, viewMode: ViewMode): string {
  const movers = changingLines(chart);
  const entry = lookupHex(chart.benGua.upper, chart.benGua.lower);
  const guaci = entry?.guaci?.trim() || "参见本卦概览。";
  const yong = yongShenLabel(chart);
  const q = questionLabel(chart);
  const moverText = moverSummary(movers);

  let trend: string;
  if (movers.length === 0) {
    trend =
      "当前为静卦，判断宜偏「稳中求进」：先把已有条件落实，再谈扩张。";
  } else if (movers.length === 1) {
    const m = movers[0]!;
    trend = `单爻发动于${YAO_POS_LABEL[m.yao] ?? `第${m.yao}爻`}，变化焦点相对集中，宜围绕该环节做准备与复盘。`;
  } else {
    trend = `多爻同动（${movers.length}处：${moverText}），局面因素较多，宜分清主次、避免一次决策包办所有分支。`;
  }

  // 首句即含本卦/动爻/用神事实，便于签语与一事一问对照
  const lead = `就「${q}」一事：本卦「${chart.benGua.name}」${movers.length === 0 ? "无动爻" : `动于${moverText}`}，用神侧重${yong}，宜只对照本问、勿混读他事。`;

  const base = ensureSectionBody(
    [
      lead,
      `卦辞要旨——${guaci}`,
      trend,
      chart.bianGua
        ? `变向「${chart.bianGua.name}」提示后续可能的局面延伸，可作预案参考。`
        : "无变卦时，重点在本卦所示态度与步骤。",
      "易理判断重在启发选择与节奏，不替代专业咨询，也不作宿命宣判。",
    ].join(""),
    `就「${q}」对照本卦「${chart.benGua.name}」，宜一事一问、稳中求进。`,
  );

  if (viewMode === "pro") {
    return `${base}\n（专业注：判断章不写恐吓断语；信息不足处标明待补全。）`;
  }
  return base;
}

function buildAdvice(chart: LiuyaoChart, viewMode: ViewMode): string {
  const movers = changingLines(chart);
  const hasChange = movers.length > 0;
  const yong = yongShenLabel(chart);
  const q = questionLabel(chart);
  const moverText = moverSummary(movers);
  const benName = chart.benGua.name || "本卦";

  const dongHint =
    hasChange
      ? (() => {
          const items = analyzeDongBian(chart);
          if (items.length === 0) return "有动变，宜预留弹性与沟通空间。";
          const rels = [...new Set(items.map((i) => i.relation))].join("、");
          return `动变生克倾向含${rels}，宜预留弹性与沟通空间，重大动作可分步验证。`;
        })()
      : "静卦宜按既定步骤稳步推进，少做突然转向。";

  const yongSt =
    chart.yongShenStatus ??
    resolveYongShenStatus(chart, chart.yongShenYao).status;
  const kongBit =
    chart.yongShenKong === true
      ? "，用神值旬空"
      : chart.xunKong
        ? "，用神不空"
        : "";
  // 首条实质句：引用本卦名、动爻、用神 + 一事一问语气
  const lead = `就「${q}」：本卦「${benName}」${hasChange ? `动爻在${moverText}` : "无动爻"}，用神侧重${yong}（${yongSt}${kongBit}）——一事一问，本卦只答当前所问。`;
  const yingQiLine = chart.yingQiHint?.trim()
    ? `应期/空亡参考：${chart.yingQiHint.trim()}`
    : "";

  const base = ensureSectionBody(
    [
      lead,
      `节奏上，${dongHint}`,
      yingQiLine,
      `对照卦象检查准备度、协作与风险边界；若另有独立议题，请另起一卦，避免混读。`,
      "现实优先：健康、财务、法律等专业问题请咨询相应从业者；命理不能替代现实决策。",
      "选择权在自己：卦象提示可能路径，践行与复盘决定结果。",
    ]
      .filter(Boolean)
      .join("\n"),
    `就「${q}」对照本卦「${benName}」，一事一问、分步验证，现实决策优先。`,
  );

  if (viewMode === "pro") {
    return `${base}\n（专业注：建议章不构成医疗/投资/法律意见；用神状态、动变、旬空应期为表驱动 v1。）`;
  }
  return base;
}

function buildBodies(
  chart: LiuyaoChart,
  viewMode: ViewMode,
): Record<LiuyaoReadingSectionKey, string> {
  return {
    question: ensureSectionBody(
      buildQuestion(chart, viewMode),
      "六爻解卦强调一事一问：请聚焦核心问题后再起一卦。",
    ),
    ben_gua: ensureSectionBody(
      buildBenGua(chart, viewMode),
      `本卦「${chart.benGua.name || "待定"}」描述当下局面主基调，宜与所问事项对照理解。`,
    ),
    changing: ensureSectionBody(
      buildChanging(chart, viewMode),
      "动变信息待补全；无动爻时宜守中、按步骤推进。",
    ),
    shi_ying: ensureSectionBody(
      buildShiYing(chart, viewMode),
      "世应与用神信息待解卦引擎补全；一般世关己方、应关对方或所对之事。",
    ),
    judgment: buildJudgment(chart, viewMode),
    advice: buildAdvice(chart, viewMode),
    disclaimer: DISCLAIMER,
  };
}

/**
 * 六爻规则模板解卦（无 LLM）
 * 章节 key 固定 7 章；T112 未就绪时仍可读（lines/benGua/bianGua）。
 */
export function renderLiuyaoTemplateReading(
  chart: LiuyaoChart,
  options?: LiuyaoTemplateReadingOptions,
): LiuyaoReadingReport {
  const viewMode: ViewMode = options?.viewMode ?? "plain";
  const bodies = buildBodies(chart, viewMode);

  const sections: LiuyaoReadingSection[] = LIUYAO_SECTION_KEYS.map((key) => ({
    key,
    title: LIUYAO_SECTION_TITLES[key],
    body: bodies[key],
  }));

  return {
    chartId: options?.chartId ?? chart.id,
    kind: "liuyao",
    mode: "template",
    viewMode,
    question: chart.question,
    sections,
    disclaimer: DISCLAIMER,
    engineVersion: chart.meta?.engineVersion,
    school: chart.meta?.castingSchool,
    warnings: chart.meta?.methodNote ? [chart.meta.methodNote] : undefined,
  };
}
