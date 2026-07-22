/**
 * 世应：八宫世爻口诀表驱动
 * 本宫世在六，一世初、二世二…五世五；游魂世在四，归魂世在三。
 * 应爻与世爻隔两位（相隔两爻）：应 = ((世-1+3) mod 6)+1
 */

import type { YaoPosition } from "@/lib/types/liuyao";
import {
  getPalaceMember,
  SHI_BY_PALACE_POS,
  type Binary6,
  type PalaceMember,
} from "./palaces";

export type ShiYing = {
  shiYao: YaoPosition;
  yingYao: YaoPosition;
  palace: PalaceMember["palace"];
  palacePos: PalaceMember["pos"];
};

export function yingFromShi(shi: YaoPosition): YaoPosition {
  return ((((shi - 1 + 3) % 6) + 1) as YaoPosition);
}

export function shiYingFromBinary(binary: Binary6 | string): ShiYing {
  const member = getPalaceMember(binary);
  if (!member) {
    throw new Error(
      `无法归属八宫 binary=${typeof binary === "string" ? binary : binary.join("")}`,
    );
  }
  const shiYao = SHI_BY_PALACE_POS[member.pos] as YaoPosition;
  return {
    shiYao,
    yingYao: yingFromShi(shiYao),
    palace: member.palace,
    palacePos: member.pos,
  };
}
