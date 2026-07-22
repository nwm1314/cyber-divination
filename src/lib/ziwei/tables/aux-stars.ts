/**
 * 常用辅星安星表（三合派通行 · T160）
 * 寅起索引 0=寅 … 11=丑
 */

import type { Dizhi } from "@/lib/types/ziwei";
import type { Tiangan } from "./constants";
import { DIZHI_LIST, fixMod, hourIndexFromBranch, yinIndexFromBranch } from "./constants";

export type AuxStarName =
  | "左辅"
  | "右弼"
  | "文昌"
  | "文曲"
  | "天魁"
  | "天钺"
  | "禄存"
  | "擎羊"
  | "陀罗"
  | "火星"
  | "铃星"
  | "地空"
  | "地劫";

export type AuxStarCategory = "soft" | "harsh";

export const AUX_STAR_CATEGORY: Readonly<Record<AuxStarName, AuxStarCategory>> = {
  左辅: "soft",
  右弼: "soft",
  文昌: "soft",
  文曲: "soft",
  天魁: "soft",
  天钺: "soft",
  禄存: "soft",
  擎羊: "harsh",
  陀罗: "harsh",
  火星: "harsh",
  铃星: "harsh",
  地空: "harsh",
  地劫: "harsh",
};

/** 安星展示顺序 */
export const AUX_STAR_ORDER: readonly AuxStarName[] = [
  "左辅",
  "右弼",
  "文昌",
  "文曲",
  "天魁",
  "天钺",
  "禄存",
  "擎羊",
  "陀罗",
  "火星",
  "铃星",
  "地空",
  "地劫",
] as const;

/** 年干 → 禄存地支 */
export const LUCUN_BY_YEAR_STEM: Readonly<Record<Tiangan, Dizhi>> = {
  甲: "寅",
  乙: "卯",
  丙: "巳",
  丁: "午",
  戊: "巳",
  己: "午",
  庚: "申",
  辛: "酉",
  壬: "亥",
  癸: "子",
};

/** 年干 → 天魁 / 天钺 地支 */
export const KUI_YUE_BY_YEAR_STEM: Readonly<
  Record<Tiangan, { kui: Dizhi; yue: Dizhi }>
> = {
  甲: { kui: "丑", yue: "未" },
  戊: { kui: "丑", yue: "未" },
  庚: { kui: "丑", yue: "未" },
  乙: { kui: "子", yue: "申" },
  己: { kui: "子", yue: "申" },
  丙: { kui: "亥", yue: "酉" },
  丁: { kui: "亥", yue: "酉" },
  壬: { kui: "卯", yue: "巳" },
  癸: { kui: "卯", yue: "巳" },
  辛: { kui: "午", yue: "寅" },
};

/** 年支三合局 → 火星/铃星起点（寅起索引） */
export type FireBellStarts = { huo: number; ling: number };

/**
 * 寅午戌→火丑铃卯；申子辰→火寅铃戌；
 * 巳酉丑→火卯铃戌；亥卯未→火酉铃戌
 */
export function fireBellStartsByYearBranch(yearBranch: Dizhi): FireBellStarts {
  const i = DIZHI_LIST.indexOf(yearBranch);
  // 寅午戌
  if (i === 2 || i === 6 || i === 10) {
    return { huo: yinIndexFromBranch("丑"), ling: yinIndexFromBranch("卯") };
  }
  // 申子辰
  if (i === 8 || i === 0 || i === 4) {
    return { huo: yinIndexFromBranch("寅"), ling: yinIndexFromBranch("戌") };
  }
  // 巳酉丑
  if (i === 5 || i === 9 || i === 1) {
    return { huo: yinIndexFromBranch("卯"), ling: yinIndexFromBranch("戌") };
  }
  // 亥卯未
  return { huo: yinIndexFromBranch("酉"), ling: yinIndexFromBranch("戌") };
}

/**
 * 农历月 1..12（正月=1=寅月）→ 左辅/右弼 寅起索引
 * 正月：左辰右戌；月数顺辅逆弼
 */
export function zuoYouByLunarMonth(lunarMonth: number): {
  zuo: number;
  you: number;
} {
  const m = Math.min(12, Math.max(1, Math.floor(lunarMonth)));
  const offset = m - 1;
  return {
    zuo: fixMod(yinIndexFromBranch("辰") + offset),
    you: fixMod(yinIndexFromBranch("戌") - offset),
  };
}

/**
 * 时支 → 文昌/文曲 寅起索引
 * 文昌：戌起子时逆行；文曲：辰起子时顺行
 */
export function changQuByHourBranch(hourBranch: Dizhi): {
  chang: number;
  qu: number;
} {
  const h = hourIndexFromBranch(hourBranch);
  return {
    chang: fixMod(yinIndexFromBranch("戌") - h),
    qu: fixMod(yinIndexFromBranch("辰") + h),
  };
}

/**
 * 时支 → 地空/地劫 寅起索引
 * 亥起子时：空逆劫顺
 */
export function kongJieByHourBranch(hourBranch: Dizhi): {
  kong: number;
  jie: number;
} {
  const h = hourIndexFromBranch(hourBranch);
  const hai = yinIndexFromBranch("亥");
  return {
    kong: fixMod(hai - h),
    jie: fixMod(hai + h),
  };
}

export type AuxStarPlacement = {
  /** 星名 → 寅起宫位索引 */
  starYinIndex: Partial<Record<AuxStarName, number>>;
};

/**
 * 计算常用辅星落宫（寅起索引）
 * @param lunarMonth 1–12 正月起
 */
export function placeAuxStars(input: {
  yearStem: Tiangan | string;
  yearBranch: Dizhi | string;
  lunarMonth: number;
  hourBranch: Dizhi | string;
}): AuxStarPlacement {
  const yearStem = input.yearStem as Tiangan;
  const yearBranch = input.yearBranch as Dizhi;
  const hourBranch = input.hourBranch as Dizhi;

  const starYinIndex: Partial<Record<AuxStarName, number>> = {};

  const lucunBranch = LUCUN_BY_YEAR_STEM[yearStem];
  if (lucunBranch) {
    const lucunYi = yinIndexFromBranch(lucunBranch);
    starYinIndex["禄存"] = lucunYi;
    starYinIndex["擎羊"] = fixMod(lucunYi + 1);
    starYinIndex["陀罗"] = fixMod(lucunYi - 1);
  }

  const kuiYue = KUI_YUE_BY_YEAR_STEM[yearStem];
  if (kuiYue) {
    starYinIndex["天魁"] = yinIndexFromBranch(kuiYue.kui);
    starYinIndex["天钺"] = yinIndexFromBranch(kuiYue.yue);
  }

  const zy = zuoYouByLunarMonth(input.lunarMonth);
  starYinIndex["左辅"] = zy.zuo;
  starYinIndex["右弼"] = zy.you;

  const cq = changQuByHourBranch(hourBranch);
  starYinIndex["文昌"] = cq.chang;
  starYinIndex["文曲"] = cq.qu;

  const fb = fireBellStartsByYearBranch(yearBranch);
  const h = hourIndexFromBranch(hourBranch);
  starYinIndex["火星"] = fixMod(fb.huo + h);
  starYinIndex["铃星"] = fixMod(fb.ling + h);

  const kj = kongJieByHourBranch(hourBranch);
  starYinIndex["地空"] = kj.kong;
  starYinIndex["地劫"] = kj.jie;

  return { starYinIndex };
}

/** 某寅起索引上的辅星列表（按 AUX_STAR_ORDER） */
export function auxStarsAtYin(
  placement: AuxStarPlacement,
  yinIndex: number,
): { name: AuxStarName; category: AuxStarCategory }[] {
  const out: { name: AuxStarName; category: AuxStarCategory }[] = [];
  for (const name of AUX_STAR_ORDER) {
    if (placement.starYinIndex[name] === yinIndex) {
      out.push({ name, category: AUX_STAR_CATEGORY[name] });
    }
  }
  return out;
}
