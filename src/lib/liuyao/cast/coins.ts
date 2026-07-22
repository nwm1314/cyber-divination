import type { YaoValue } from "@/lib/types/liuyao";
import { createSeededRng, hashSeed } from "./rng";

/**
 * 三钱法：三枚各 0/1（阴/阳），阳数 + 6 → 爻值
 * 0阳=6老阴，1阳=7少阳，2阳=8少阴，3阳=9老阳
 */
export function castOneYao(rng: () => number): YaoValue {
  let yang = 0;
  for (let i = 0; i < 3; i++) {
    if (rng() < 0.5) yang += 1;
  }
  return (6 + yang) as YaoValue;
}

/** 自下而上六爻 */
export function castCoinsLines(seed: string | number): YaoValue[] {
  const rng = createSeededRng(seed);
  const values: YaoValue[] = [];
  for (let i = 0; i < 6; i++) {
    values.push(castOneYao(rng));
  }
  return values;
}

/** 无种子时用时间戳+随机，仍可记录 seed 便于复盘 */
export function freshCoinSeed(): number {
  const t = Date.now() >>> 0;
  const r = (Math.random() * 0x100000000) >>> 0;
  return hashSeed(`${t}:${r}`);
}
