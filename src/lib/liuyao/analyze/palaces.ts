/**
 * 京房八宫归属表（表驱动）
 * binary：自下而上六爻，1=阳 0=阴
 * 宫内序：0 本宫八纯 → 1–5 世 → 6 游魂 → 7 归魂
 */

import type { TrigramName } from "@/lib/types/liuyao";

export type Binary6 = readonly [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1];

/** 八宫本宫（八纯） */
export const PALACE_ROOTS: Readonly<Record<TrigramName, Binary6>> = {
  乾: [1, 1, 1, 1, 1, 1],
  坤: [0, 0, 0, 0, 0, 0],
  震: [1, 0, 0, 1, 0, 0],
  巽: [0, 1, 1, 0, 1, 1],
  坎: [0, 1, 0, 0, 1, 0],
  离: [1, 0, 1, 1, 0, 1],
  艮: [0, 0, 1, 0, 0, 1],
  兑: [1, 1, 0, 1, 1, 0],
} as const;

/** 宫内序 → 世爻位（1–6） */
export const SHI_BY_PALACE_POS: readonly [
  6, 1, 2, 3, 4, 5, 4, 3,
] = [6, 1, 2, 3, 4, 5, 4, 3] as const;

export type PalaceMember = {
  palace: TrigramName;
  /** 0 本宫 … 5 五世，6 游魂，7 归魂 */
  pos: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  binary: Binary6;
  binaryKey: string;
};

function flipBit(bits: number[], i: number): void {
  bits[i] = bits[i] === 1 ? 0 : 1;
}

/** 由本宫 binary 生成八宫八卦（京房变卦序） */
export function buildPalaceMembers(palace: TrigramName): PalaceMember[] {
  const root = [...PALACE_ROOTS[palace]];
  const out: PalaceMember[] = [];

  const push = (pos: PalaceMember["pos"], bits: number[]) => {
    const binary: Binary6 = [
      bits[0]! as 0 | 1,
      bits[1]! as 0 | 1,
      bits[2]! as 0 | 1,
      bits[3]! as 0 | 1,
      bits[4]! as 0 | 1,
      bits[5]! as 0 | 1,
    ];
    out.push({
      palace,
      pos,
      binary,
      binaryKey: binary.join(""),
    });
  };

  push(0, [...root]);

  for (let gen = 1; gen <= 5; gen++) {
    const cur = [...root];
    for (let i = 0; i < gen; i++) flipBit(cur, i);
    push(gen as PalaceMember["pos"], cur);
  }

  // 游魂：五世变四爻（index 3）
  const you = [...out[5]!.binary];
  flipBit(you, 3);
  push(6, you);

  // 归魂：游魂下卦归本宫
  const gui = [...you];
  gui[0] = root[0]!;
  gui[1] = root[1]!;
  gui[2] = root[2]!;
  push(7, gui);

  return out;
}

/** binaryKey → 宫归属 */
export const PALACE_BY_BINARY: Readonly<Record<string, PalaceMember>> = (() => {
  const map: Record<string, PalaceMember> = {};
  const palaces = Object.keys(PALACE_ROOTS) as TrigramName[];
  for (const p of palaces) {
    for (const m of buildPalaceMembers(p)) {
      map[m.binaryKey] = m;
    }
  }
  return map;
})();

export function getPalaceMember(
  binary: Binary6 | string,
): PalaceMember | undefined {
  const key = typeof binary === "string" ? binary : binary.join("");
  return PALACE_BY_BINARY[key];
}
