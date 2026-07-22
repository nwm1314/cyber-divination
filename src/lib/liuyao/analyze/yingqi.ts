/**
 * 月建日辰上下文 + 简单应期（T180）
 * 中性提示；无恐吓语。依赖占时 → 日柱/月支（复用 bazi 八字）。
 */

import {
  computeRawPillars,
  parseSolarDate,
} from "@/lib/bazi/calendar/solar";
import type { LiuyaoChart, LiuyaoLine } from "@/lib/types/liuyao";
import {
  isBranchKong,
  xunKongOfDay,
  type Dizhi12,
} from "./kongwang";

export type CastTimeContext = {
  castAt: string;
  dayGanZhi: string;
  dayStem: string;
  dayBranch: Dizhi12;
  yueJian: Dizhi12;
  xunKong: readonly [Dizhi12, Dizhi12];
};

/** 解析占时字符串 → 公历部件 */
export function parseCastAt(castAt: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const s = castAt.trim();
  // YYYY-MM-DD or YYYY-MM-DDTHH:mm or ISO
  const m =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::\d{2})?)?/.exec(s);
  if (!m) {
    // try Date parse fallback for full ISO
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`invalid castAt: ${castAt}`);
    }
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
    };
  }
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: m[4] != null ? Number(m[4]) : 12,
    minute: m[5] != null ? Number(m[5]) : 0,
  };
}

/** 由占时推日辰/月建/旬空 */
export function resolveCastTimeContext(castAt: string): CastTimeContext {
  const parts = parseCastAt(castAt);
  // 校验日期
  parseSolarDate(
    `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
  );
  const pillars = computeRawPillars({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  });
  const dayGanZhi = `${pillars.dayStem}${pillars.dayBranch}`;
  const xunKong = xunKongOfDay(dayGanZhi);
  return {
    castAt,
    dayGanZhi,
    dayStem: pillars.dayStem,
    dayBranch: pillars.dayBranch as Dizhi12,
    yueJian: pillars.monthBranch as Dizhi12,
    xunKong,
  };
}

export type YingQiResult = {
  yongShenKong: boolean;
  yingQiHint: string;
  dongYaoKong: number[];
};

/**
 * 简单应期/空亡摘要（学习向 v1）
 * - 用神落空：提示出空/填实节奏，非吉凶
 * - 动爻落空：提示该爻所示变化节奏偏缓
 * - 无占时：说明缺日辰
 */
export function resolveYingQi(
  chart: Pick<LiuyaoChart, "lines" | "yongShenYao" | "yongShen" | "castAt">,
  ctx?: CastTimeContext | null,
): YingQiResult {
  if (!ctx) {
    return {
      yongShenKong: false,
      yingQiHint:
        "未提供占时，暂不算日辰/月建/旬空；铜钱/手动起卦可传入 castAt 以启用应期参考。",
      dongYaoKong: [],
    };
  }

  const yongLine =
    chart.yongShenYao != null &&
    chart.yongShenYao >= 1 &&
    chart.yongShenYao <= 6
      ? chart.lines.find((l) => l.yao === chart.yongShenYao)
      : undefined;
  const yongShenKong = isBranchKong(yongLine?.branch, ctx.xunKong);

  const dongYaoKong: number[] = [];
  for (const l of chart.lines) {
    if ((l.changing || l.value === 6 || l.value === 9) &&
      isBranchKong(l.branch, ctx.xunKong)) {
      dongYaoKong.push(l.yao);
    }
  }

  const parts: string[] = [];
  parts.push(
    `日辰${ctx.dayGanZhi}，月建${ctx.yueJian}，旬空${ctx.xunKong[0]}${ctx.xunKong[1]}。`,
  );
  if (yongShenKong) {
    parts.push(
      `用神${chart.yongShen ?? ""}落${yongLine?.branch ?? "?"}支，值旬空：节奏上宜看出空/填实，不作吉凶定论。`,
    );
  } else if (yongLine?.branch) {
    parts.push(
      `用神落${yongLine.branch}支，本日不值旬空；可与月建${ctx.yueJian}、日支${ctx.dayBranch}对照旺衰（简表不断死生）。`,
    );
  }
  if (dongYaoKong.length > 0) {
    parts.push(
      `动爻中第${dongYaoKong.join("、")}爻支落空，所示变化或偏缓，宜预留弹性。`,
    );
  }
  parts.push("应期仅为学习向节奏参考，不替代现实日程与专业判断。");

  return {
    yongShenKong,
    yingQiHint: parts.join(""),
    dongYaoKong,
  };
}

/** 便于单测：指定日支是否冲某爻支（子午冲等） */
export function isBranchChong(a: string, b: string): boolean {
  const pairs: [string, string][] = [
    ["子", "午"],
    ["丑", "未"],
    ["寅", "申"],
    ["卯", "酉"],
    ["辰", "戌"],
    ["巳", "亥"],
  ];
  return pairs.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x),
  );
}

export function lineBranchKong(
  line: LiuyaoLine | undefined,
  xunKong: readonly [string, string] | undefined,
): boolean {
  return isBranchKong(line?.branch, xunKong);
}
