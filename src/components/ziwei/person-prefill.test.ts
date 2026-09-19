import { describe, expect, it } from "vitest";
import type { Person } from "@/lib/types/user";
import { computeZiweiChart } from "@/lib/ziwei";
import {
  emptyZiweiBirthDraftFields,
  personOptionLabel,
  personToZiweiDraftFields,
} from "./person-prefill";

const person = (over: Partial<Person> = {}): Person => ({
  id: "per_1",
  name: "张三",
  gender: "male",
  solarDate: "1990-05-15",
  birthTime: "14:30",
  birthPlace: { province: "江苏省", city: "南京市", lng: 118.7969 },
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("personToZiweiDraftFields（B15 档案 → 草稿）", () => {
  it("完整档案逐字段带入，经纬度转回表单用的字符串", () => {
    expect(personToZiweiDraftFields(person())).toEqual({
      name: "张三",
      solarDate: "1990-05-15",
      lunarDate: "",
      isLeapMonth: false,
      birthTime: "14:30",
      shichenUnknown: false,
      gender: "male",
      province: "江苏省",
      city: "南京市",
      lng: "118.7969",
    });
  });

  it("空档案只带入姓名，其余保持空值（不写入猜测值）", () => {
    const bare = person({
      name: "李四",
      gender: undefined,
      solarDate: undefined,
      birthTime: undefined,
      birthPlace: undefined,
    });
    const mapped = personToZiweiDraftFields(bare);
    expect(mapped.name).toBe("李四");
    expect(mapped.solarDate).toBe("");
    expect(mapped.birthTime).toBe("");
    expect(mapped.gender).toBe("");
    expect(mapped.lng).toBe("");
    // 缺时辰 ≠ 时辰未知：不得替用户勾选
    expect(mapped.shichenUnknown).toBe(false);
  });

  it("农历与闰月、时辰未知可带入", () => {
    const mapped = personToZiweiDraftFields(
      person({
        solarDate: undefined,
        lunarDate: "1990-4-21",
        isLeapMonth: true,
        birthTime: undefined,
        shichenUnknown: true,
      }),
    );
    expect(mapped.lunarDate).toBe("1990-4-21");
    expect(mapped.isLeapMonth).toBe(true);
    expect(mapped.shichenUnknown).toBe(true);
  });

  it("非有限的经纬度不写入草稿", () => {
    const mapped = personToZiweiDraftFields(
      person({ birthPlace: { province: "x", city: "y", lng: Number.NaN } }),
    );
    expect(mapped.lng).toBe("");
  });

  it("映射结果覆盖草稿的全部生辰字段", () => {
    expect(Object.keys(personToZiweiDraftFields(person())).sort()).toEqual(
      Object.keys(emptyZiweiBirthDraftFields()).sort(),
    );
  });
});

describe("personOptionLabel", () => {
  it("姓名 + 性别 + 生日", () => {
    expect(personOptionLabel(person())).toBe("张三 · 男 · 1990-05-15");
  });

  it("无生日时明确标注，避免误选", () => {
    expect(
      personOptionLabel(person({ solarDate: undefined, gender: undefined })),
    ).toBe("张三 · 未填生日");
  });

  it("只有农历时回落到农历", () => {
    expect(
      personOptionLabel(person({ solarDate: undefined, lunarDate: "1990-4-21" })),
    ).toBe("张三 · 男 · 1990-4-21");
  });

  it("无名档案用占位名，不出现空选项", () => {
    expect(personOptionLabel(person({ name: "  " }))).toContain("未命名档案");
  });
});

/**
 * B15 的关键不变量：复用档案只影响归属，不得改变排盘事实。
 */
describe("复用档案不改变计算事实", () => {
  const inputFrom = (personId?: string) => {
    const f = personToZiweiDraftFields(person());
    return {
      solarDate: f.solarDate,
      birthTime: f.birthTime,
      gender: f.gender as "male",
      birthPlace: { province: f.province, city: f.city, lng: Number(f.lng) },
      name: f.name,
      personId,
    } as const;
  };

  it("同一档案无论是否带 personId，盘面与 inputFingerprint 一致", () => {
    const withPerson = computeZiweiChart(inputFrom("per_1"));
    const manual = computeZiweiChart(inputFrom(undefined));

    expect(withPerson.personId).toBe("per_1");
    expect(manual.personId).toBeUndefined();
    expect(withPerson.mingGong).toBe(manual.mingGong);
    expect(withPerson.palaces).toEqual(manual.palaces);
    expect(withPerson.meta?.inputFingerprint).toBe(
      manual.meta?.inputFingerprint,
    );
    // 盘 id 含 personId（同一人生肖数据不同归属时不撞盘）
    expect(withPerson.id).not.toBe(manual.id);
  });
});
