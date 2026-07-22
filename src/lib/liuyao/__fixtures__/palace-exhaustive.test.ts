/**
 * T282 · 八宫/世应/纳甲穷举（表驱动）
 */
import { describe, expect, it } from "vitest";
import { HEXAGRAMS } from "../data/hexagrams";
import {
  PALACE_BY_BINARY,
  PALACE_ROOTS,
  SHI_BY_PALACE_POS,
  buildPalaceMembers,
  getPalaceMember,
} from "../analyze/palaces";
import { shiYingFromBinary, yingFromShi } from "../analyze/shi-ying";
import { assignLiuqin, TRIGRAM_NAJIA } from "../analyze/liuqin";
import type { TrigramName } from "@/lib/types/liuyao";
import { LIUYAO_DATA_SOURCES } from "../data/sources";
import { castLiuyao } from "../cast";

describe("T282 八宫穷举", () => {
  it("八宫各 8 卦，共 64 且无重叠", () => {
    const palaces = Object.keys(PALACE_ROOTS) as TrigramName[];
    expect(palaces).toHaveLength(8);
    const keys = new Set<string>();
    for (const p of palaces) {
      const members = buildPalaceMembers(p);
      expect(members).toHaveLength(8);
      for (const m of members) {
        expect(keys.has(m.binaryKey)).toBe(false);
        keys.add(m.binaryKey);
        expect(PALACE_BY_BINARY[m.binaryKey]?.palace).toBe(p);
      }
    }
    expect(keys.size).toBe(64);
  });

  it("六十四卦均可归属八宫", () => {
    for (const h of HEXAGRAMS) {
      const m = getPalaceMember(h.binary);
      expect(m, h.name).toBeDefined();
    }
  });

  it("世应口诀与 yingFromShi 一致（64 卦）", () => {
    for (const h of HEXAGRAMS) {
      const sy = shiYingFromBinary(h.binary);
      expect(sy.shiYao).toBe(SHI_BY_PALACE_POS[sy.palacePos]);
      expect(sy.yingYao).toBe(yingFromShi(sy.shiYao));
    }
  });
});

describe("T282 纳甲表驱动", () => {
  it("八卦内外纳甲各三支", () => {
    const names = Object.keys(TRIGRAM_NAJIA) as TrigramName[];
    expect(names).toHaveLength(8);
    for (const n of names) {
      expect(TRIGRAM_NAJIA[n].inner).toHaveLength(3);
      expect(TRIGRAM_NAJIA[n].outer).toHaveLength(3);
    }
  });

  it("64 卦六亲安爻长度 6 且确定性", () => {
    for (const h of HEXAGRAMS) {
      const a = assignLiuqin(h.binary);
      const b = assignLiuqin(h.binary);
      expect(a).toEqual(b);
      expect(a).toHaveLength(6);
      expect(new Set(a.map((x) => x.yao)).size).toBe(6);
    }
  });
});

describe("T282 来源元数据", () => {
  it("data sources 含版本与规则锚点", () => {
    expect(LIUYAO_DATA_SOURCES.dataVersion).toMatch(/^liuyao-data-/);
    expect(LIUYAO_DATA_SOURCES.ruleSetVersion).toMatch(/w26|rules/);
    expect(LIUYAO_DATA_SOURCES.bagong).toMatch(/八宫|京房/);
    expect(LIUYAO_DATA_SOURCES.najia).toMatch(/纳甲/);
    expect(LIUYAO_DATA_SOURCES.meihuaTime).toMatch(/梅花/);
  });

  it("装卦 meta 带 dataVersion", () => {
    const chart = castLiuyao({
      question: "元数据",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      id: "t282-meta",
    });
    expect(chart.meta.dataVersion).toBe(LIUYAO_DATA_SOURCES.dataVersion);
    expect(chart.meta.castingSchool).toBe("najia-manual");
  });
});
