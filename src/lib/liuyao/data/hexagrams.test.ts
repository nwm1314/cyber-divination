import { describe, expect, it } from "vitest";
import type { HexagramEntry, TrigramName } from "@/lib/types/liuyao";
import { TRIGRAM_BY_NAME } from "./trigrams";
import {
  HEXAGRAMS,
  HEXAGRAM_BY_BINARY,
  HEXAGRAM_BY_INDEX,
  getHexagram,
  getHexagramByBinary,
  getHexagramByTrigrams,
} from "./hexagrams";

function expectedBinary(
  lower: TrigramName,
  upper: TrigramName,
): HexagramEntry["binary"] {
  const lo = TRIGRAM_BY_NAME[lower].binary;
  const up = TRIGRAM_BY_NAME[upper].binary;
  return [lo[0], lo[1], lo[2], up[0], up[1], up[2]];
}

describe("六十四卦数据（T110）", () => {
  it("恰好 64 条", () => {
    expect(HEXAGRAMS).toHaveLength(64);
  });

  it("index 为 1..64 且无重复", () => {
    const indices = HEXAGRAMS.map((h) => h.index);
    expect(new Set(indices).size).toBe(64);
    for (let i = 1; i <= 64; i++) {
      expect(indices).toContain(i);
      expect(HEXAGRAM_BY_INDEX[i]?.index).toBe(i);
      expect(getHexagram(i)?.index).toBe(i);
    }
  });

  it("binary 唯一且长度 6", () => {
    const keys = HEXAGRAMS.map((h) => h.binary.join(""));
    expect(new Set(keys).size).toBe(64);
    for (const h of HEXAGRAMS) {
      expect(h.binary).toHaveLength(6);
      for (const b of h.binary) {
        expect(b === 0 || b === 1).toBe(true);
      }
      expect(HEXAGRAM_BY_BINARY[h.binary.join("")]?.index).toBe(h.index);
    }
  });

  it("binary 与 upper+lower 经卦组合一致，且可互查", () => {
    for (const h of HEXAGRAMS) {
      const fromTrigrams = expectedBinary(h.lower, h.upper);
      expect([...h.binary]).toEqual([...fromTrigrams]);

      const byUL = getHexagramByTrigrams(h.upper, h.lower);
      expect(byUL?.index).toBe(h.index);

      const byBin = getHexagramByBinary(h.binary);
      expect(byBin?.index).toBe(h.index);
      expect(getHexagramByBinary(h.binary.join(""))?.index).toBe(h.index);
    }
  });

  it("每条含 name/shortName/guaci 与 6 条 yaoci", () => {
    for (const h of HEXAGRAMS) {
      expect(h.name.length).toBeGreaterThan(0);
      expect(h.shortName.length).toBeGreaterThan(0);
      expect(h.guaci.length).toBeGreaterThan(0);
      expect(h.yaoci).toHaveLength(6);
      for (const y of h.yaoci) {
        expect(y.length).toBeGreaterThan(0);
      }
    }
  });

  it("抽检文王序代表卦", () => {
    expect(getHexagram(1)?.shortName).toBe("乾");
    expect(getHexagram(1)?.binary.join("")).toBe("111111");
    expect(getHexagram(2)?.shortName).toBe("坤");
    expect(getHexagram(2)?.binary.join("")).toBe("000000");
    expect(getHexagramByTrigrams("坎", "震")?.shortName).toBe("屯");
    expect(getHexagramByTrigrams("离", "坎")?.shortName).toBe("未济");
    expect(getHexagram(63)?.shortName).toBe("既济");
    expect(getHexagram(64)?.shortName).toBe("未济");
  });
});
