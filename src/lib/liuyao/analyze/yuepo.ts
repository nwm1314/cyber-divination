/**
 * 月破 / 日冲（T281）
 * 月破：爻支与月建六冲；日冲：爻支与日支六冲。
 */

import { isBranchChong } from "./yingqi";

export type BranchFlags = {
  yuePo: boolean;
  riChong: boolean;
};

export function branchYuePo(
  branch: string | undefined,
  yueJian: string | undefined,
): boolean {
  if (!branch || !yueJian) return false;
  return isBranchChong(branch, yueJian);
}

export function branchRiChong(
  branch: string | undefined,
  dayBranch: string | undefined,
): boolean {
  if (!branch || !dayBranch) return false;
  return isBranchChong(branch, dayBranch);
}

export function resolveBranchFlags(
  branch: string | undefined,
  ctx: { yueJian?: string; dayBranch?: string } | null | undefined,
): BranchFlags {
  if (!ctx) return { yuePo: false, riChong: false };
  return {
    yuePo: branchYuePo(branch, ctx.yueJian),
    riChong: branchRiChong(branch, ctx.dayBranch),
  };
}
