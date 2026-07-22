/**
 * 飞星飞宫：十二宫各以宫干飞出四化至目标星所在宫（T190）
 *
 * - 表源：SIHUA_BY_YEAR_STEM（宫干查同表）
 * - 自化：源宫=目标宫时 flight.self=true，并与 T181「自化X」并存
 * - 飞入：目标星 sihua 叠「源宫·化X」
 * - 不改默认 school 为 feixing-only；flags 记 feixing_palace_flights
 */

import type {
  FeixingFlight,
  ZiweiPalace,
  ZiweiPalaceName,
} from "@/lib/types/ziwei";
import type { Tiangan } from "./tables/constants";
import { TIANGAN_LIST } from "./tables/constants";
import { SIHUA_BY_YEAR_STEM, SIHUA_KINDS, type SihuaKind } from "./tables/sihua";
import { FLAG_FEIXING_FLIGHTS, feixingMark } from "./tables/feixing";

export { FLAG_FEIXING_FLIGHTS, feixingMark, isFeixingMark } from "./tables/feixing";

function isTiangan(s: string | undefined): s is Tiangan {
  return !!s && (TIANGAN_LIST as readonly string[]).includes(s);
}

/** 星名 → 所在宫名（先扫到的宫；主星/辅星同名取首次） */
function starPalaceMap(
  palaces: ZiweiPalace[],
): Map<string, ZiweiPalaceName | string> {
  const m = new Map<string, ZiweiPalaceName | string>();
  for (const p of palaces) {
    for (const s of p.stars) {
      if (!m.has(s.name)) m.set(s.name, p.name);
    }
  }
  return m;
}

export type ApplyFeixingResult = {
  flights: FeixingFlight[];
  flags: string[];
};

/**
 * 计算并写入飞星边 + 目标星标记
 * @returns 全盘 flights
 */
export function applyFeixingFlights(palaces: ZiweiPalace[]): ApplyFeixingResult {
  const starAt = starPalaceMap(palaces);
  const flights: FeixingFlight[] = [];

  for (const from of palaces) {
    if (!isTiangan(from.stem)) {
      from.feixingOut = [];
      continue;
    }
    const targets = SIHUA_BY_YEAR_STEM[from.stem];
    const outs: FeixingFlight[] = [];
    for (const kind of SIHUA_KINDS) {
      const starName = targets[kind as SihuaKind];
      const toPalace = starAt.get(starName);
      if (!toPalace) continue; // 星未入盘（罕见）
      const self = toPalace === from.name;
      const flight: FeixingFlight = {
        fromPalace: from.name,
        fromStem: from.stem,
        kind,
        star: starName,
        toPalace,
        self,
      };
      outs.push(flight);
      flights.push(flight);

      // 标记目标星
      const toP = palaces.find((p) => p.name === toPalace);
      if (!toP) continue;
      const star = toP.stars.find((s) => s.name === starName);
      if (!star) continue;
      const mark = feixingMark(from.name, kind);
      const existing = star.sihua ?? [];
      if (!existing.includes(mark)) {
        star.sihua = [...existing, mark];
      }
    }
    from.feixingOut = outs;
  }

  return {
    flights,
    flags: [FLAG_FEIXING_FLIGHTS],
  };
}

/** 命宫飞出摘要（解读用） */
export function mingFeixingSummary(flights: FeixingFlight[]): string {
  const ming = flights.filter((f) => f.fromPalace === "命宫");
  if (ming.length === 0) return "";
  return ming
    .map(
      (f) =>
        `命宫化${f.kind}飞${f.star}入${f.toPalace}${f.self ? "（自化）" : ""}`,
    )
    .join("；");
}

/**
 * 单干四化飞出（大限宫干 / 流年干 · T200/T201）
 * 不 mutate 星盘 sihua，仅返回结构化边
 */
export function sihuaFlightsFromStem(
  stem: string | undefined,
  palaces: ZiweiPalace[],
  sourceLabel: string,
): FeixingFlight[] {
  if (!isTiangan(stem)) return [];
  const starAt = starPalaceMap(palaces);
  const targets = SIHUA_BY_YEAR_STEM[stem];
  const flights: FeixingFlight[] = [];
  for (const kind of SIHUA_KINDS) {
    const starName = targets[kind as SihuaKind];
    const toPalace = starAt.get(starName);
    if (!toPalace) continue;
    flights.push({
      fromPalace: sourceLabel,
      fromStem: stem,
      kind,
      star: starName,
      toPalace,
      self: toPalace === sourceLabel,
    });
  }
  return flights;
}

export function flightsToYunSihua(
  flights: FeixingFlight[],
): { kind: string; star: string; toPalace: string; self?: boolean }[] {
  return flights.map((f) => ({
    kind: f.kind,
    star: f.star,
    toPalace: String(f.toPalace),
    ...(f.self ? { self: true } : {}),
  }));
}
