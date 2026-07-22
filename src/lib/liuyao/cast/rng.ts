/**
 * 可种子伪随机（mulberry32），供铜钱起卦确定性复现。
 */

/** 将任意字符串稳定哈希为 32-bit 无符号整数 */
export function hashSeed(input: string | number): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input >>> 0;
  }
  const s = String(input);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 返回 [0, 1) 的确定性 RNG */
export function createSeededRng(seed: string | number): () => number {
  let a = hashSeed(seed);
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
