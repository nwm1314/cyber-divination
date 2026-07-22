/**
 * 动变生克简述（表驱动 · T161）
 * 中性表述，禁止恐吓断语。
 */

import type { LiuyaoChart, YaoPosition } from "@/lib/types/liuyao";
import { toBinary, toBianValues, isChanging } from "../cast/yao";
import { assignLiuqin, type Liuqin, type Wuxing } from "./liuqin";

export type WuxingRelation =
  | "比和"
  | "动生化"
  | "动克化"
  | "化生动"
  | "化克动";

/** 回头生克标签（T281）：化生动=回头生，化克动=回头克 */
export type HuitouKind = "回头生" | "回头克" | "无";

export type DongBianItem = {
  yao: YaoPosition;
  fromLiuqin: Liuqin;
  fromWuxing: Wuxing;
  toLiuqin: Liuqin;
  toWuxing: Wuxing;
  relation: WuxingRelation;
  /** 回头生 / 回头克 / 无 */
  huitou: HuitouKind;
  /** 中性一句摘要 */
  summary: string;
};

export function huitouOf(relation: WuxingRelation): HuitouKind {
  if (relation === "化生动") return "回头生";
  if (relation === "化克动") return "回头克";
  return "无";
}

const SHENG: Record<Wuxing, Wuxing> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};

const KE: Record<Wuxing, Wuxing> = {
  木: "土",
  火: "金",
  土: "水",
  金: "木",
  水: "火",
};

export function wuxingRelation(from: Wuxing, to: Wuxing): WuxingRelation {
  if (from === to) return "比和";
  if (SHENG[from] === to) return "动生化";
  if (KE[from] === to) return "动克化";
  if (SHENG[to] === from) return "化生动";
  if (KE[to] === from) return "化克动";
  // 五行环上总有生克链；兜底比和
  return "比和";
}

const RELATION_HINT: Record<WuxingRelation, string> = {
  比和: "动化五行同类，力量延续，宜保持既有节奏并复盘。",
  动生化: "动爻生变爻，趋势向外延伸，可分步推进并预留调整空间。",
  动克化: "动爻克变爻，转化中有阻力，宜拆解目标、避免一次到位。",
  化生动: "变爻回头生，外力或后续条件对主体有助，宜借势协作。",
  化克动: "变爻回头克，后续条件偏紧，宜控风险、加强沟通与边界。",
};

function yaoLabel(yao: YaoPosition): string {
  const labels = ["", "初", "二", "三", "四", "五", "上"];
  return `${labels[yao] ?? yao}爻`;
}

/**
 * 分析各动爻「本爻 → 化爻」五行生克
 */
export function analyzeDongBian(chart: LiuyaoChart): DongBianItem[] {
  const values = chart.lines.map((l) => l.value);
  const benBinary = toBinary(values);
  const bianBinary = toBinary(toBianValues(values));
  const benRows = assignLiuqin(benBinary);
  const bianRows = assignLiuqin(bianBinary);

  const items: DongBianItem[] = [];
  for (const line of chart.lines) {
    if (!(line.changing || isChanging(line.value))) continue;
    const from = benRows.find((r) => r.yao === line.yao);
    const to = bianRows.find((r) => r.yao === line.yao);
    if (!from || !to) continue;
    const relation = wuxingRelation(from.wuxing, to.wuxing);
    const huitou = huitouOf(relation);
    const huitouTag =
      huitou === "无" ? "" : `【${huitou}】`;
    const summary = [
      `${yaoLabel(line.yao)}动：${from.liuqin}${from.branch}${from.wuxing}`,
      `化${to.liuqin}${to.branch}${to.wuxing}（${relation}${huitouTag}）。`,
      RELATION_HINT[relation],
    ].join("");
    items.push({
      yao: line.yao,
      fromLiuqin: from.liuqin,
      fromWuxing: from.wuxing,
      toLiuqin: to.liuqin,
      toWuxing: to.wuxing,
      relation,
      huitou,
      summary,
    });
  }
  return items.sort((a, b) => a.yao - b.yao);
}

/** 静卦时的中性说明 */
export function staticDongBianHint(): string {
  return "本卦无动爻，暂无动变生克；宜守中、按步骤推进，情况有变可另起一卦。";
}

export function dongBianSectionBody(chart: LiuyaoChart): string {
  const items = analyzeDongBian(chart);
  if (items.length === 0) return staticDongBianHint();
  return [
    `动变生克（学习向简表，共 ${items.length} 处动爻）：`,
    ...items.map((it) => it.summary),
    "生克仅描述五行关系倾向，不作吉凶恐吓，不替代现实决策。",
  ].join("\n");
}


