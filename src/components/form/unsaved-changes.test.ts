import { describe, expect, it } from "vitest";
import { isDraftChanged } from "./unsaved-changes";

type Form = {
  name: string;
  solarDate: string;
  shichenUnknown: boolean;
  useTrueSolarTime: boolean;
};

const INITIAL: Form = {
  name: "",
  solarDate: "",
  shichenUnknown: false,
  useTrueSolarTime: false,
};

describe("isDraftChanged（B14 离开确认判据）", () => {
  it("未改动 → 不脏", () => {
    expect(isDraftChanged({ ...INITIAL }, INITIAL)).toBe(false);
  });

  it("任一字段改动 → 脏", () => {
    expect(isDraftChanged({ ...INITIAL, name: "张三" }, INITIAL)).toBe(true);
    expect(
      isDraftChanged({ ...INITIAL, solarDate: "1990-05-15" }, INITIAL),
    ).toBe(true);
    expect(
      isDraftChanged({ ...INITIAL, shichenUnknown: true }, INITIAL),
    ).toBe(true);
    expect(
      isDraftChanged({ ...INITIAL, useTrueSolarTime: true }, INITIAL),
    ).toBe(true);
  });

  it("改动后又改回原值 → 不脏（避免误报弹窗）", () => {
    const touched = { ...INITIAL, name: "张三", solarDate: "2000-01-01" };
    expect(isDraftChanged(touched, INITIAL)).toBe(true);
    expect(isDraftChanged({ ...touched, name: "", solarDate: "" }, INITIAL)).toBe(
      false,
    );
  });

  it("基准为挂载时的初值（含本地偏好），不把偏好默认值误判成用户输入", () => {
    const withPrefs = { ...INITIAL, useTrueSolarTime: true };
    expect(isDraftChanged(withPrefs, withPrefs)).toBe(false);
    expect(isDraftChanged({ ...withPrefs, name: "李四" }, withPrefs)).toBe(true);
  });
});
