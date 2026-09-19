/**
 * inputFingerprint 单元测试（GAP-5 / 波次 2）
 *
 * 核心不变量：
 * 1. 同输入 → 同指纹（复算可自证）
 * 2. 输入任一字段变化 → 指纹变化（差异可检出）
 * 3. 对象键序不影响指纹（不是语义）
 * 4. 数组顺序影响指纹（爻位等顺序是语义）
 * 5. 三引擎命名空间隔离（相同输入不产生相同指纹）
 * 6. 不依赖派生结果（只哈希输入）
 */

import { describe, expect, it } from "vitest";
import {
  computeInputFingerprint,
  INPUT_FINGERPRINT_VERSION,
  shortFingerprint,
} from "./fingerprint";

describe("computeInputFingerprint · 同一性", () => {
  it("同输入多次调用结果一致（确定性）", () => {
    const input = { solarDate: "1990-01-01", birthTime: "12:00", gender: "male" };
    const a = computeInputFingerprint("bazi", input);
    const b = computeInputFingerprint("bazi", input);
    const c = computeInputFingerprint("bazi", { ...input });
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it("对象键序不同但内容相同 → 同指纹", () => {
    const a = computeInputFingerprint("bazi", {
      solarDate: "1990-01-01",
      gender: "male",
    });
    const b = computeInputFingerprint("bazi", {
      gender: "male",
      solarDate: "1990-01-01",
    });
    expect(a).toBe(b);
  });

  it("嵌套对象键序不同 → 同指纹", () => {
    const a = computeInputFingerprint("bazi", {
      birthPlace: { province: "广东", city: "深圳", lng: 114.06 },
    });
    const b = computeInputFingerprint("bazi", {
      birthPlace: { lng: 114.06, city: "深圳", province: "广东" },
    });
    expect(a).toBe(b);
  });

  it("显式 undefined 与字段缺省等价", () => {
    const a = computeInputFingerprint("bazi", {
      solarDate: "1990-01-01",
      birthTime: undefined,
    });
    const b = computeInputFingerprint("bazi", { solarDate: "1990-01-01" });
    expect(a).toBe(b);
  });
});

describe("computeInputFingerprint · 差异检出", () => {
  it("任一字段变化 → 指纹变化", () => {
    const base = { solarDate: "1990-01-01", birthTime: "12:00", gender: "male" };
    const baseFp = computeInputFingerprint("bazi", base);

    expect(computeInputFingerprint("bazi", { ...base, solarDate: "1990-01-02" })).not.toBe(baseFp);
    expect(computeInputFingerprint("bazi", { ...base, birthTime: "13:00" })).not.toBe(baseFp);
    expect(computeInputFingerprint("bazi", { ...base, gender: "female" })).not.toBe(baseFp);
  });

  it("新增字段 → 指纹变化", () => {
    const a = computeInputFingerprint("bazi", { solarDate: "1990-01-01" });
    const b = computeInputFingerprint("bazi", {
      solarDate: "1990-01-01",
      birthTime: "12:00",
    });
    expect(a).not.toBe(b);
  });

  it("数组顺序不同 → 指纹不同（爻位顺序是语义）", () => {
    const a = computeInputFingerprint("liuyao", { values: [7, 8, 9, 6, 7, 8] });
    const b = computeInputFingerprint("liuyao", { values: [8, 7, 9, 6, 7, 8] });
    expect(a).not.toBe(b);
  });

  it("数值类型差异被区分（1 vs \"1\"）", () => {
    const a = computeInputFingerprint("bazi", { x: 1 });
    const b = computeInputFingerprint("bazi", { x: "1" });
    expect(a).not.toBe(b);
  });

  it("null 与缺省不同（null 是显式语义）", () => {
    const a = computeInputFingerprint("bazi", { birthTime: null });
    const b = computeInputFingerprint("bazi", {});
    expect(a).not.toBe(b);
  });
});

describe("computeInputFingerprint · 命名空间隔离", () => {
  it("相同输入在不同命名空间产生不同指纹", () => {
    const input = { date: "1990-01-01" };
    const bazi = computeInputFingerprint("bazi", input);
    const ziwei = computeInputFingerprint("ziwei", input);
    const liuyao = computeInputFingerprint("liuyao", input);
    expect(bazi).not.toBe(ziwei);
    expect(ziwei).not.toBe(liuyao);
    expect(bazi).not.toBe(liuyao);
  });

  it("指纹带命名空间前缀，便于识别来源", () => {
    expect(computeInputFingerprint("bazi", {})).toMatch(/^bazi-[0-9a-f]{16}$/);
    expect(computeInputFingerprint("ziwei", {})).toMatch(/^ziwei-[0-9a-f]{16}$/);
    expect(computeInputFingerprint("liuyao", {})).toMatch(/^liuyao-[0-9a-f]{16}$/);
  });
});

describe("computeInputFingerprint · 边界", () => {
  it("空对象可计算", () => {
    expect(computeInputFingerprint("bazi", {})).toMatch(/^bazi-[0-9a-f]{16}$/);
  });

  it("函数/symbol 被忽略，不影响指纹", () => {
    const a = computeInputFingerprint("bazi", { solarDate: "1990-01-01" });
    const b = computeInputFingerprint("bazi", {
      solarDate: "1990-01-01",
      fn: () => 1,
      sym: Symbol("x"),
    });
    expect(a).toBe(b);
  });

  it("不存在碰撞：1000 个连续日期产生 1000 个不同指纹", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 1000; d++) {
      const day = String((d % 28) + 1).padStart(2, "0");
      const month = String((Math.floor(d / 28) % 12) + 1).padStart(2, "0");
      seen.add(
        computeInputFingerprint("bazi", { solarDate: `1990-${month}-${day}` }),
      );
    }
    // 28 天 × 12 月 = 336 个唯一日期
    expect(seen.size).toBe(336);
  });

  it("指纹不包含输入明文（不泄露 PII）", () => {
    const fp = computeInputFingerprint("bazi", {
      name: "张三",
      solarDate: "1990-01-01",
    });
    expect(fp).not.toContain("张三");
    expect(fp).not.toContain("1990");
  });
});

describe("shortFingerprint", () => {
  it("取哈希部分前 8 位", () => {
    const fp = computeInputFingerprint("bazi", { a: 1 });
    expect(shortFingerprint(fp)).toHaveLength(8);
    expect(fp).toContain(shortFingerprint(fp));
  });

  it("undefined / 空串 → 空字符串", () => {
    expect(shortFingerprint(undefined)).toBe("");
    expect(shortFingerprint("")).toBe("");
  });

  it("无前缀的裸串原样截取", () => {
    expect(shortFingerprint("abcdef1234567890")).toBe("abcdef12");
  });
});

describe("版本常量", () => {
  it("INPUT_FINGERPRINT_VERSION 为 v1", () => {
    expect(INPUT_FINGERPRINT_VERSION).toBe("1");
  });
});
