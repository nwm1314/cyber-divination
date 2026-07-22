/**
 * 喜用神统一口径（命盘 UI / 五行条 / 模板解读共用）
 * 扶抑为主：身旺泄耗、身弱扶抑、中和调候流通
 * T261：分层输出调候/扶抑/通关/病药 + RuleEvidence
 */
import type { BaziChart, RuleEvidence, YongshenLayered } from "@/lib/types";
import { STEM_WUXING } from "./wuxing";

export type WuxingKey = "wood" | "fire" | "earth" | "metal" | "water";

export const WUXING_LABEL_ZH: Record<WuxingKey, string> = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
};

const WO_SHENG: Record<WuxingKey, WuxingKey> = {
  wood: "fire",
  fire: "earth",
  earth: "metal",
  metal: "water",
  water: "wood",
};

const SHENG_WO: Record<WuxingKey, WuxingKey> = {
  wood: "water",
  fire: "wood",
  earth: "fire",
  metal: "earth",
  water: "metal",
};

const WO_KE: Record<WuxingKey, WuxingKey> = {
  wood: "earth",
  fire: "metal",
  earth: "water",
  metal: "wood",
  water: "fire",
};

const KE_WO: Record<WuxingKey, WuxingKey> = {
  wood: "metal",
  fire: "water",
  earth: "wood",
  metal: "fire",
  water: "earth",
};

/** 调候简表：月支 → 优先调候五行（穷通宝典风格简化） */
const TIAOHOU_BY_MONTH: Record<string, WuxingKey[]> = {
  寅: ["water", "fire"],
  卯: ["water", "fire"],
  辰: ["water", "metal"],
  巳: ["water", "metal"],
  午: ["water", "metal"],
  未: ["water", "wood"],
  申: ["wood", "fire"],
  酉: ["wood", "fire"],
  戌: ["wood", "water"],
  亥: ["fire", "wood"],
  子: ["fire", "wood"],
  丑: ["fire", "wood"],
};

export type StrengthLevel = "身旺" | "身弱" | "中和" | "从强" | "从弱";

export type YongshenAdvice = {
  strength: StrengthLevel;
  favorable: WuxingKey[];
  unfavorable: WuxingKey[];
  yongTenGods: string;
  jiTenGods: string;
  plainLine: string;
  layered?: YongshenLayered;
  evidence?: RuleEvidence[];
};

function dayMasterWx(dayMaster: string): WuxingKey {
  return (STEM_WUXING[dayMaster as keyof typeof STEM_WUXING] ??
    "earth") as WuxingKey;
}

function rankScores(scores: BaziChart["wuxingScores"]): {
  top: WuxingKey;
  weak: WuxingKey;
} {
  const keys: WuxingKey[] = ["wood", "fire", "earth", "metal", "water"];
  let top: WuxingKey = "wood";
  let weak: WuxingKey = "wood";
  for (const k of keys) {
    if ((scores[k] ?? 0) > (scores[top] ?? 0)) top = k;
    if ((scores[k] ?? 0) < (scores[weak] ?? 0)) weak = k;
  }
  return { top, weak };
}

/**
 * 按柱位计数十神（T261：修复同干合并导致 support/drain 失真）
 */
export function countTenGodsByPosition(chart: BaziChart): {
  support: number;
  drain: number;
} {
  const positions = chart.tenGodsByPosition;
  if (positions && positions.length > 0) {
    let support = 0;
    let drain = 0;
    for (const p of positions) {
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
  // 回退：按 pillars 柱位，避免 Record 合并
  let support = 0;
  let drain = 0;
  const pillars = [
    chart.pillars.year,
    chart.pillars.month,
    chart.pillars.hour,
  ];
  for (const p of pillars) {
    if (!p) continue;
    const v = p.tenGod ?? chart.tenGods[p.stem] ?? "";
    if (!v || v === "日主" || v === "—") continue;
    if (["比肩", "劫财", "正印", "偏印", "枭神"].includes(v)) support += 1;
    if (["食神", "伤官", "正财", "偏财", "正官", "七杀", "偏官"].includes(v))
      drain += 1;
  }
  return { support, drain };
}

/**
 * 简化旺衰（与 reading/template/analyze 对齐并扩展从格）
 */
export function estimateStrength(
  chart: BaziChart,
  opts?: { deLing?: boolean; deDi?: boolean; support?: number; drain?: number },
): StrengthLevel {
  const dm = chart.dayMaster;
  const dmWx = dayMasterWx(dm);
  const counted = countTenGodsByPosition(chart);
  const {
    support = counted.support,
    drain = counted.drain,
    deLing = false,
    deDi = false,
  } = opts ?? {};
  // 可视化分数仅作从格启发式辅助，非月令司令
  const score = chart.wuxingScores[dmWx] ?? 0;
  const total =
    Object.values(chart.wuxingScores).reduce((a, b) => a + b, 0) || 1;
  const ratio = score / total;

  if (ratio >= 0.45 && support >= 3 && drain <= 1) return "从强";
  if (ratio <= 0.12 && !deDi && drain >= 3 && support <= 1) return "从弱";

  if (deLing && (support >= 2 || deDi)) return "身旺";
  if (!deLing && support < drain && !deDi) return "身弱";
  if (deLing && drain > support + 1) return "中和";
  if (!deLing && support > drain) return "中和";
  if (deLing) return "身旺";
  if (!deLing && support < 2) return "身弱";
  return "中和";
}

function buildLayered(
  chart: BaziChart,
  s: StrengthLevel,
  favorable: WuxingKey[],
  unfavorable: WuxingKey[],
): YongshenLayered {
  const monthBranch = chart.pillars.month.branch;
  const tiaohouKeys = TIAOHOU_BY_MONTH[monthBranch] ?? [];
  const { top, weak } = rankScores(chart.wuxingScores);

  // 通关：克战双方之间的中间五行（简化：顶克弱时取生顶克弱者）
  const tongguan: WuxingKey[] = [];
  if (top !== weak) {
    // 若 top 克 weak，通关为 top 所生；若 weak 克 top，通关为 weak 所生
    if (WO_KE[top] === weak) tongguan.push(WO_SHENG[top]);
    else if (WO_KE[weak] === top) tongguan.push(WO_SHENG[weak]);
    else if (WO_SHENG[top] === weak || WO_SHENG[weak] === top) {
      // 已有相生流通，不必强行通关
    } else {
      tongguan.push(weak);
    }
  }

  const diseases: string[] = [];
  const medicines: string[] = [];
  if (s === "身弱" && unfavorable.includes(KE_WO[dayMasterWx(chart.dayMaster)])) {
    diseases.push("官杀克身");
    medicines.push(...favorable.map((k) => WUXING_LABEL_ZH[k]));
  }
  if (s === "身旺" && (chart.wuxingScores[dayMasterWx(chart.dayMaster)] ?? 0) > 3) {
    diseases.push("比劫过旺");
    medicines.push(...favorable.map((k) => WUXING_LABEL_ZH[k]));
  }
  if (tiaohouKeys.length && !favorable.some((f) => tiaohouKeys.includes(f))) {
    diseases.push("调候与扶抑可能冲突");
    medicines.push(...tiaohouKeys.map((k) => WUXING_LABEL_ZH[k]));
  }

  return {
    fuyi: {
      favorable: favorable.map((k) => WUXING_LABEL_ZH[k]),
      unfavorable: unfavorable.map((k) => WUXING_LABEL_ZH[k]),
      note: `扶抑主判：${s}`,
    },
    tiaohou: {
      favorable: tiaohouKeys.map((k) => WUXING_LABEL_ZH[k]),
      note: `月令${monthBranch}调候优先（穷通宝典风格简表）`,
    },
    tongguan: {
      favorable: [...new Set(tongguan)].map((k) => WUXING_LABEL_ZH[k]),
      note:
        tongguan.length > 0
          ? `五行偏枯时取通关：${top}↔${weak}`
          : "五行未见明显克战，通关从缓",
    },
    bingyao: {
      disease: diseases,
      medicine: [...new Set(medicines)],
      note: diseases.length
        ? "病药为规则摘要，须与运岁细参"
        : "未见突出病象",
    },
  };
}

function buildEvidence(
  chart: BaziChart,
  s: StrengthLevel,
  layered: YongshenLayered,
): RuleEvidence[] {
  const { support, drain } = countTenGodsByPosition(chart);
  return [
    {
      ruleId: "strength.fuyi.v1",
      source: "子平扶抑（简化）",
      conclusion: s,
      confidence: 0.7,
      condition: `support=${support},drain=${drain},visualRatio辅助`,
    },
    {
      ruleId: "yongshen.fuyi.v1",
      source: "扶抑用神",
      conclusion: `喜${layered.fuyi.favorable.join("、") || "—"}，忌${layered.fuyi.unfavorable.join("、") || "—"}`,
      confidence: 0.65,
    },
    {
      ruleId: "yongshen.tiaohou.v1",
      source: "穷通宝典风格调候简表",
      conclusion: `调候喜${layered.tiaohou.favorable.join("、") || "—"}`,
      confidence: 0.55,
      condition: `月支${chart.pillars.month.branch}`,
    },
    {
      ruleId: "yongshen.tongguan.v1",
      source: "五行通关（简化）",
      conclusion: layered.tongguan.note,
      confidence: 0.5,
    },
    {
      ruleId: "yongshen.bingyao.v1",
      source: "神峰通考病药说（摘要）",
      conclusion: layered.bingyao.note,
      confidence: 0.5,
    },
    {
      ruleId: "wuxing.visual_weights.v1",
      source: "固定藏干权重",
      conclusion: "wuxingScores 仅供可视化，非月令司令/通根权威",
      confidence: 1,
    },
  ];
}

export function computeYongshen(
  chart: BaziChart,
  strength?: StrengthLevel,
): YongshenAdvice {
  const dmWx = dayMasterWx(chart.dayMaster);
  const { weak } = rankScores(chart.wuxingScores);
  const s = strength ?? estimateStrength(chart);

  let favorable: WuxingKey[];
  let unfavorable: WuxingKey[];
  let yongTenGods: string;
  let jiTenGods: string;

  switch (s) {
    case "身旺":
      favorable = [WO_SHENG[dmWx], WO_KE[dmWx], KE_WO[dmWx]];
      unfavorable = [dmWx, SHENG_WO[dmWx]];
      yongTenGods = "食伤、财星、官杀";
      jiTenGods = "比劫、印星过重";
      break;
    case "从强":
      favorable = [dmWx, SHENG_WO[dmWx]];
      unfavorable = [WO_KE[dmWx], KE_WO[dmWx]];
      yongTenGods = "比劫、印星（顺势）";
      jiTenGods = "财官克泄";
      break;
    case "身弱":
      favorable = [dmWx, SHENG_WO[dmWx]];
      unfavorable = [WO_KE[dmWx], KE_WO[dmWx], WO_SHENG[dmWx]];
      yongTenGods = "印星、比劫";
      jiTenGods = "官杀、财星过重而无制";
      break;
    case "从弱":
      favorable = [WO_KE[dmWx], KE_WO[dmWx], WO_SHENG[dmWx]];
      unfavorable = [dmWx, SHENG_WO[dmWx]];
      yongTenGods = "财官食伤（顺势）";
      jiTenGods = "比印扶身";
      break;
    default: {
      favorable = [weak, SHENG_WO[weak]].filter(
        (v, i, arr) => arr.indexOf(v) === i,
      );
      unfavorable = Object.keys(WUXING_LABEL_ZH).filter(
        (k) => !favorable.includes(k as WuxingKey),
      ) as WuxingKey[];
      yongTenGods = "调候与流通之五行";
      jiTenGods = "过旺阻滞、过弱虚浮之五行";
      break;
    }
  }

  favorable = [...new Set(favorable)].slice(0, 3);
  unfavorable = [...new Set(unfavorable)]
    .filter((k) => !favorable.includes(k))
    .slice(0, 3);

  const favZh = favorable.map((k) => WUXING_LABEL_ZH[k]);
  const unfavZh = unfavorable.map((k) => WUXING_LABEL_ZH[k]);
  const roles =
    s === "身弱" || s === "从强"
      ? favZh
          .map((z, i) =>
            i === 0 && favorable[0] === dmWx
              ? `${z}（助身）`
              : i === 0 || favorable[i] === SHENG_WO[dmWx]
                ? `${z}（生身）`
                : z,
          )
          .join("、")
      : favZh
          .map((z, i) => {
            const k = favorable[i];
            if (k === WO_SHENG[dmWx]) return `${z}（泄秀）`;
            if (k === WO_KE[dmWx]) return `${z}（财）`;
            if (k === KE_WO[dmWx]) return `${z}（官杀）`;
            return z;
          })
          .join("、");

  const plainLine = `喜${roles}，忌${unfavZh.join("、") || "过极之五行"}`;
  const layered = buildLayered(chart, s, favorable, unfavorable);
  const evidence = buildEvidence(chart, s, layered);

  return {
    strength: s,
    favorable,
    unfavorable,
    yongTenGods,
    jiTenGods,
    plainLine,
    layered,
    evidence,
  };
}
