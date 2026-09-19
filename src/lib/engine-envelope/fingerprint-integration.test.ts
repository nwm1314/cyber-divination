/**
 * 三引擎 inputFingerprint 落地测试（GAP-5 / 波次 2）
 *
 * 单元测试（fingerprint.test.ts）验证算法本身；本文件验证**真的接进了引擎**，
 * 并验证信任模型的核心承诺：
 *   同一输入 → 同一个盘 → 同一个指纹
 *   输入变化 → 指纹变化（差异可检出）
 *
 * 同时固化「指纹只由输入决定」这一约束：personId / name 等身份展示字段
 * 不得影响指纹，否则同一出生信息的两个人会得到不同指纹。
 */

import { describe, expect, it } from "vitest";
import type { BirthProfile } from "@/lib/types";
import { computeChart } from "@/lib/bazi";
import { computeZiweiChart } from "@/lib/ziwei";
import { castLiuyao } from "@/lib/liuyao";

const PROFILE: BirthProfile = {
  id: "p-fp",
  name: "指纹",
  gender: "male",
  solarDate: "1990-01-01",
  birthTime: "12:00",
  alive: true,
  analysisBaseDate: "2026-07-20",
  useTrueSolarTime: false,
};

describe("八字 inputFingerprint", () => {
  it("meta.inputFingerprint 存在且格式正确", () => {
    const chart = computeChart(PROFILE);
    expect(chart.meta.inputFingerprint).toMatch(/^bazi-[0-9a-f]{16}$/);
  });

  it("同输入 → 同指纹（复算自证）", () => {
    const a = computeChart(PROFILE);
    const b = computeChart({ ...PROFILE });
    expect(a.meta.inputFingerprint).toBe(b.meta.inputFingerprint);
    // 盘本身也必须一致
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("出生日期变化 → 指纹变化", () => {
    const a = computeChart(PROFILE);
    const b = computeChart({ ...PROFILE, solarDate: "1990-01-02" });
    expect(a.meta.inputFingerprint).not.toBe(b.meta.inputFingerprint);
  });

  it("出生时辰变化 → 指纹变化", () => {
    const a = computeChart(PROFILE);
    const b = computeChart({ ...PROFILE, birthTime: "13:00" });
    expect(a.meta.inputFingerprint).not.toBe(b.meta.inputFingerprint);
  });

  it("性别变化 → 指纹变化（大运顺逆依赖性别）", () => {
    const a = computeChart(PROFILE);
    const b = computeChart({ ...PROFILE, gender: "female" });
    expect(a.meta.inputFingerprint).not.toBe(b.meta.inputFingerprint);
  });

  it("档案 id / 姓名 / userId 不影响指纹（同一出生信息 = 同一盘）", () => {
    const a = computeChart(PROFILE);
    const b = computeChart({
      ...PROFILE,
      id: "another-id",
      name: "另一个人",
      userId: "usr_whatever",
    });
    expect(a.meta.inputFingerprint).toBe(b.meta.inputFingerprint);
  });

  it("真太阳时开关变化 → 指纹变化", () => {
    const a = computeChart(PROFILE);
    const b = computeChart({ ...PROFILE, useTrueSolarTime: true });
    expect(a.meta.inputFingerprint).not.toBe(b.meta.inputFingerprint);
  });
});

describe("紫微 inputFingerprint", () => {
  const INPUT = {
    solarDate: "1990-01-01",
    birthTime: "12:00",
    gender: "male" as const,
    analysisBaseDate: "2026-07-20",
  };

  it("meta.inputFingerprint 存在且格式正确", () => {
    const chart = computeZiweiChart(INPUT);
    expect(chart.meta.inputFingerprint).toMatch(/^ziwei-[0-9a-f]{16}$/);
  });

  it("同输入 → 同指纹", () => {
    const a = computeZiweiChart(INPUT);
    const b = computeZiweiChart({ ...INPUT });
    expect(a.meta.inputFingerprint).toBe(b.meta.inputFingerprint);
  });

  it("出生日期变化 → 指纹变化", () => {
    const a = computeZiweiChart(INPUT);
    const b = computeZiweiChart({ ...INPUT, solarDate: "1990-01-02" });
    expect(a.meta.inputFingerprint).not.toBe(b.meta.inputFingerprint);
  });

  it("personId / profileId / name 不影响指纹", () => {
    const a = computeZiweiChart(INPUT);
    const b = computeZiweiChart({
      ...INPUT,
      personId: "person-x" as never,
      profileId: "profile-y",
      userId: "usr_z" as never,
      name: "张三",
    });
    expect(a.meta.inputFingerprint).toBe(b.meta.inputFingerprint);
  });

  it("八字与紫微相同输入 → 指纹不同（命名空间隔离）", () => {
    const bazi = computeChart(PROFILE);
    const ziwei = computeZiweiChart(INPUT);
    expect(bazi.meta.inputFingerprint).not.toBe(ziwei.meta.inputFingerprint);
  });
});

describe("六爻 inputFingerprint", () => {
  const BASE = {
    question: "此事可否",
    method: "manual" as const,
    lines: [7, 8, 9, 6, 7, 8] as const,
    castAt: "2026-07-20T12:00",
  };

  it("meta.inputFingerprint 存在且格式正确", () => {
    const chart = castLiuyao(BASE);
    expect(chart.meta.inputFingerprint).toMatch(/^liuyao-[0-9a-f]{16}$/);
  });

  it("同输入 → 同指纹（含可复现性）", () => {
    const a = castLiuyao(BASE);
    const b = castLiuyao({ ...BASE });
    expect(a.meta.inputFingerprint).toBe(b.meta.inputFingerprint);
  });

  it("爻值变化 → 指纹变化", () => {
    const a = castLiuyao(BASE);
    const b = castLiuyao({ ...BASE, lines: [7, 8, 9, 6, 7, 9] });
    expect(a.meta.inputFingerprint).not.toBe(b.meta.inputFingerprint);
  });

  it("所问事项变化 → 指纹变化", () => {
    const a = castLiuyao(BASE);
    const b = castLiuyao({ ...BASE, question: "换个问题" });
    expect(a.meta.inputFingerprint).not.toBe(b.meta.inputFingerprint);
  });

  it("占时变化 → 指纹变化（日辰月建随占时变）", () => {
    const a = castLiuyao(BASE);
    const b = castLiuyao({ ...BASE, castAt: "2026-07-21T12:00" });
    expect(a.meta.inputFingerprint).not.toBe(b.meta.inputFingerprint);
  });

  it("可复现：同 seed 的铜钱卦指纹一致", () => {
    const a = castLiuyao({
      question: "财运",
      method: "coins",
      seed: "fixed-seed",
    });
    const b = castLiuyao({
      question: "财运",
      method: "coins",
      seed: "fixed-seed",
    });
    expect(a.meta.inputFingerprint).toBe(b.meta.inputFingerprint);
    expect(a.lines.map((l) => l.value)).toEqual(b.lines.map((l) => l.value));
  });

  it("盘 id 不影响指纹", () => {
    const a = castLiuyao(BASE);
    const b = castLiuyao({ ...BASE, id: "ly_forced_id" });
    expect(a.meta.inputFingerprint).toBe(b.meta.inputFingerprint);
  });
});

describe("三引擎信封字段对齐", () => {
  it("三引擎 meta 均含 schemaVersion / ruleSetVersion / engineVersion / inputFingerprint", () => {
    const bazi = computeChart(PROFILE);
    const ziwei = computeZiweiChart({
      solarDate: "1990-01-01",
      birthTime: "12:00",
      gender: "male",
      analysisBaseDate: "2026-07-20",
    });
    const liuyao = castLiuyao({
      question: "对齐检查",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
      castAt: "2026-07-20T12:00",
    });

    for (const [name, meta] of [
      ["bazi", bazi.meta],
      ["ziwei", ziwei.meta],
      ["liuyao", liuyao.meta],
    ] as const) {
      expect(meta.engineVersion, `${name}.engineVersion`).toBeTruthy();
      expect(meta.schemaVersion, `${name}.schemaVersion`).toBeTruthy();
      expect(meta.ruleSetVersion, `${name}.ruleSetVersion`).toBeTruthy();
      expect(meta.inputFingerprint, `${name}.inputFingerprint`).toBeTruthy();
    }
  });

  it("六爻 warnings 已填充（混合方法必须明示）", () => {
    const time = castLiuyao({
      question: "时间起卦",
      method: "time",
      datetime: "2026-07-20T12:00",
    });
    expect(time.warnings?.length).toBeGreaterThan(0);
    expect(time.warnings!.join("")).toContain("梅花易数");

    const coins = castLiuyao({ question: "铜钱", method: "coins", seed: "s1" });
    expect(coins.warnings?.length).toBeGreaterThan(0);
  });

  it("六爻缺占时 → warnings 提示无法计算日辰月建", () => {
    const chart = castLiuyao({
      question: "无占时",
      method: "manual",
      lines: [7, 7, 7, 7, 7, 7],
    });
    expect(chart.warnings?.join("")).toContain("占时");
  });

  it("六爻 evidence 已生成规则链", () => {
    const chart = castLiuyao({
      question: "求财",
      method: "manual",
      lines: [7, 8, 9, 6, 7, 8],
      castAt: "2026-07-20T12:00",
    });
    expect(chart.evidence?.length).toBeGreaterThan(0);
    const ids = chart.evidence!.map((e) => e.ruleId);
    expect(ids).toContain("liuyao.shi_ying.v1");
    expect(ids).toContain("liuyao.liuqin.najia.v1");
    expect(ids).toContain("liuyao.kongwang.v1");
    // 每条 evidence 必须来源可溯
    for (const e of chart.evidence!) {
      expect(e.source).toBeTruthy();
      expect(e.conclusion).toBeTruthy();
      expect(e.confidence).toBeGreaterThan(0);
    }
  });
});
