/**
 * 伏神（T281 务实版）
 * 用神六亲在本卦不现时，从本宫八纯对应爻「飞伏」取伏神。
 * 规则：本宫八纯六亲与当前卦同位对照；飞神=本卦现爻，伏神=本宫有而本卦无的六亲所在宫爻支。
 */

import type { LiuqinName, YaoPosition } from "@/lib/types/liuyao";
import {
  assignLiuqin,
  type Dizhi,
  type Liuqin,
  type YaoLiuqin,
} from "./liuqin";
import {
  getPalaceMember,
  PALACE_ROOTS,
  type Binary6,
} from "./palaces";

export type FushenItem = {
  /** 伏于哪一爻（飞神爻位） */
  yao: YaoPosition;
  /** 飞神六亲（本卦该爻） */
  feiLiuqin: Liuqin;
  feiBranch: Dizhi;
  /** 伏神六亲 */
  fuLiuqin: Liuqin;
  fuBranch: Dizhi;
};

/**
 * 本卦相对本宫缺失的六亲：在本宫出现而本卦不出现的六亲，
 * 取其在本宫的爻位，作为伏于本卦同位飞神之下。
 */
export function resolveFushen(
  binary: Binary6 | string,
  targetLiuqin?: Liuqin | LiuqinName | null,
): FushenItem[] {
  const bits: Binary6 =
    typeof binary === "string"
      ? ([
          Number(binary[0]) as 0 | 1,
          Number(binary[1]) as 0 | 1,
          Number(binary[2]) as 0 | 1,
          Number(binary[3]) as 0 | 1,
          Number(binary[4]) as 0 | 1,
          Number(binary[5]) as 0 | 1,
        ] as Binary6)
      : binary;

  const member = getPalaceMember(bits);
  if (!member) return [];

  const ben = assignLiuqin(bits);
  const root = PALACE_ROOTS[member.palace];
  const gong = assignLiuqin(root);

  const benKinds = new Set(ben.map((r) => r.liuqin));
  const items: FushenItem[] = [];

  for (const g of gong) {
    if (benKinds.has(g.liuqin)) continue;
    if (targetLiuqin && g.liuqin !== targetLiuqin) continue;
    const fei = ben.find((b) => b.yao === g.yao);
    if (!fei) continue;
    items.push({
      yao: g.yao,
      feiLiuqin: fei.liuqin,
      feiBranch: fei.branch,
      fuLiuqin: g.liuqin,
      fuBranch: g.branch,
    });
  }

  return items.sort((a, b) => a.yao - b.yao);
}

/** 将伏神贴到六亲行（仅贴匹配 target 或全部缺失项中的第一批） */
export function attachFushenToRows(
  rows: readonly YaoLiuqin[],
  fushen: readonly FushenItem[],
): Array<
  YaoLiuqin & { fushen?: Liuqin; fushenBranch?: Dizhi }
> {
  const byYao = new Map(fushen.map((f) => [f.yao, f]));
  return rows.map((r) => {
    const f = byYao.get(r.yao);
    if (!f) return { ...r };
    return {
      ...r,
      fushen: f.fuLiuqin,
      fushenBranch: f.fuBranch,
    };
  });
}
