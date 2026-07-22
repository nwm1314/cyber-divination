import { describe, expect, it } from "vitest";
import {
  computeRelations,
  findStemHe,
  findBranchChong,
  findBranchLiuhe,
  findBranchSanhe,
  findBranchSanhui,
  findBranchXing,
  findBranchHai,
  isHehuaDeLing,
  isHehuaDeDi,
  areStemsAdjacent,
  HEHUA_DE_LING,
} from "./index";

describe("relations", () => {
  it("天干五合：无上下文时仅合绊", () => {
    const r = findStemHe(["甲", "丙", "己"]);
    expect(r).toHaveLength(1);
    expect(r[0].hehua.tag).toBe("合绊");
    expect(r[0].hehua.transformed).toBe(false);
    expect(r[0].label).toBe("甲己合绊");
  });

  it("天干五合：得令+得地+相邻 → 合化", () => {
    // 甲己合土；月令辰（土旺）；地支有辰（土根）；甲己相邻
    const r = findStemHe(["甲", "己", "丙"], ["辰", "寅", "午"], {
      monthBranch: "辰",
      orderedStems: ["甲", "己", "丙"],
    });
    expect(r).toHaveLength(1);
    expect(r[0].hehua.deLing).toBe(true);
    expect(r[0].hehua.deDi).toBe(true);
    expect(r[0].hehua.adjacent).toBe(true);
    expect(r[0].hehua.tag).toBe("合化");
    expect(r[0].label).toBe("甲己合化土");
  });

  it("天干五合：得令得地但不相邻 → 合绊", () => {
    const r = findStemHe(["甲", "丙", "己"], ["辰", "寅", "午", "子"], {
      monthBranch: "辰",
      orderedStems: ["甲", "丙", "己"],
    });
    expect(r[0].hehua.adjacent).toBe(false);
    expect(r[0].hehua.tag).toBe("合绊");
    expect(r[0].label).toBe("甲己合绊");
  });

  it("地支六冲：子午冲", () => {
    const r = findBranchChong(["子", "午", "寅"]);
    expect(r).toHaveLength(1);
    expect(r[0].label).toBe("子午冲");
  });

  it("地支六合：子丑 — 月令土旺且有土根 → 合化", () => {
    const r = findBranchLiuhe(["子", "丑", "寅"], { monthBranch: "辰" });
    const hit = r.find((x) => x.a === "子" || x.b === "子");
    expect(hit).toBeDefined();
    expect(hit!.hehua.tag).toBe("合化");
    expect(hit!.label).toBe("子丑合化土");
  });

  it("地支六合：子丑 — 月令非土 → 合绊", () => {
    const r = findBranchLiuhe(["子", "丑", "寅"], { monthBranch: "寅" });
    const hit = r.find((x) => x.result === "土");
    expect(hit!.hehua.deLing).toBe(false);
    expect(hit!.hehua.tag).toBe("合绊");
    expect(hit!.label).toBe("子丑合绊");
  });

  it("三合局 / 半合", () => {
    const full = findBranchSanhe(["申", "子", "辰"]);
    expect(full.some((x) => x.label.includes("三合") && !x.partial)).toBe(true);
    const half = findBranchSanhe(["申", "子"]);
    expect(half.some((x) => x.partial)).toBe(true);
  });

  it("三会局", () => {
    const r = findBranchSanhui(["寅", "卯", "辰"]);
    expect(r.some((x) => x.label.includes("三会"))).toBe(true);
  });

  it("相刑 / 相害", () => {
    expect(findBranchXing(["子", "卯"]).some((x) => x.label.includes("刑"))).toBe(
      true,
    );
    expect(findBranchHai(["子", "未"])[0]?.label).toBe("子未害");
  });

  it("无合冲时核心字段为空", () => {
    const r = computeRelations(["甲", "乙"], ["寅", "卯"]);
    expect(r.stemHe).toHaveLength(0);
    expect(r.branchChong).toHaveLength(0);
    expect(r.branchLiuhe).toBeDefined();
    expect(r.branchSanhe).toBeDefined();
  });

  it("得令/得地表驱动", () => {
    expect(isHehuaDeLing("土", "辰")).toBe(true);
    expect(isHehuaDeLing("土", "寅")).toBe(false);
    expect(isHehuaDeLing("水", "子")).toBe(true);
    expect(isHehuaDeDi("土", ["辰", "寅"])).toBe(true);
    expect(isHehuaDeDi("金", ["寅", "卯"])).toBe(false);
    expect(HEHUA_DE_LING["火"]).toEqual(["巳", "午"]);
  });

  it("相邻判定确定性", () => {
    expect(areStemsAdjacent(["甲", "己", "丙"], "甲", "己")).toBe(true);
    expect(areStemsAdjacent(["甲", "丙", "己"], "甲", "己")).toBe(false);
  });

  it("computeRelations 传入月令后标签区分合绊/合化", () => {
    const ban = computeRelations(["甲", "己"], ["寅", "卯"], {
      monthBranch: "寅",
      orderedStems: ["甲", "己"],
    });
    expect(ban.stemHe[0].hehua.tag).toBe("合绊");

    const hua = computeRelations(["甲", "己"], ["辰", "丑"], {
      monthBranch: "辰",
      orderedStems: ["甲", "己"],
    });
    expect(hua.stemHe[0].hehua.tag).toBe("合化");
    expect(hua.stemHe[0].label).toContain("合化");
  });
});
