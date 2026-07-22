import { describe, expect, it } from "vitest";
import { lunarToSolarDate } from "./lunar";

describe("lunarToSolarDate", () => {
  it("converts common lunar date", () => {
    const solar = lunarToSolarDate("1990-1-1");
    expect(solar).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rejects invalid format", () => {
    expect(() => lunarToSolarDate("bad")).toThrow(/invalid lunarDate/);
  });
});
