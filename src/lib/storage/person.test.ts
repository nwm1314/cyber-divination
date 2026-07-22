import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { Person } from "@/lib/types/user";
import {
  createPerson,
  savePerson,
  getPerson,
  listPersons,
  listPersonEntries,
  toPersonListEntry,
  deletePerson,
  updatePerson,
  linkChartId,
  unlinkChartId,
  linkZiweiId,
  unlinkZiweiId,
} from "./person";

function mockStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
}

describe("Person storage (T121)", () => {
  beforeEach(() => {
    const local = mockStorage();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", mockStorage());
    local.setItem("bd_account_mode", "1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("CRUD", () => {
    it("createPerson 生成 id 与时间戳，默认空盘列表", () => {
      const p = createPerson({
        name: "张三",
        gender: "male",
        solarDate: "1990-01-15",
      });
      expect(p.id).toMatch(/^person_/);
      expect(p.name).toBe("张三");
      expect(p.chartIds).toEqual([]);
      expect(p.ziweiIds).toEqual([]);
      expect(p.createdAt).toBeTruthy();
      expect(p.updatedAt).toBeTruthy();
      expect(getPerson(p.id)).toEqual(p);
    });

    it("createPerson 可指定 id 与挂盘", () => {
      const p = createPerson({
        id: "person_fixed",
        name: "李四",
        chartIds: ["c1", "c1", "c2"],
        ziweiIds: ["z1"],
      });
      expect(p.id).toBe("person_fixed");
      expect(p.chartIds).toEqual(["c1", "c2"]);
      expect(p.ziweiIds).toEqual(["z1"]);
    });

    it("savePerson 覆盖并保留 createdAt", () => {
      const p = createPerson({ id: "person_a", name: "甲" });
      const createdAt = p.createdAt;
      const next = savePerson({ ...p, name: "乙", chartIds: ["x"] });
      expect(next.name).toBe("乙");
      expect(next.chartIds).toEqual(["x"]);
      expect(next.createdAt).toBe(createdAt);
      expect(next.updatedAt).toBeTruthy();
    });

    it("getPerson 不存在返回 null", () => {
      expect(getPerson("nope")).toBeNull();
    });

    it("listPersons / deletePerson", () => {
      createPerson({ id: "p1", name: "一" });
      createPerson({ id: "p2", name: "二", userId: "u1" });
      expect(listPersons()).toHaveLength(2);
      expect(listPersons("u1")).toHaveLength(1);
      expect(listPersons(null)).toHaveLength(1);
      deletePerson("p1");
      expect(getPerson("p1")).toBeNull();
      expect(listPersons()).toHaveLength(1);
    });

    it("updatePerson 局部更新", () => {
      createPerson({ id: "p1", name: "旧", chartIds: ["a"] });
      const u = updatePerson("p1", { name: "新", gender: "female" });
      expect(u?.name).toBe("新");
      expect(u?.gender).toBe("female");
      expect(u?.chartIds).toEqual(["a"]);
      expect(updatePerson("missing", { name: "x" })).toBeNull();
    });
  });

  describe("关联 chart / ziwei ids", () => {
    it("linkChartId / unlinkChartId", () => {
      createPerson({ id: "p1", name: "甲" });
      const linked = linkChartId("p1", "profile_001");
      expect(linked?.chartIds).toEqual(["profile_001"]);
      linkChartId("p1", "profile_001");
      expect(getPerson("p1")?.chartIds).toEqual(["profile_001"]);
      linkChartId("p1", "profile_002");
      expect(getPerson("p1")?.chartIds).toEqual(["profile_001", "profile_002"]);
      unlinkChartId("p1", "profile_001");
      expect(getPerson("p1")?.chartIds).toEqual(["profile_002"]);
    });

    it("linkZiweiId / unlinkZiweiId", () => {
      createPerson({ id: "p1", name: "甲" });
      linkZiweiId("p1", "zw_1");
      linkZiweiId("p1", "zw_2");
      expect(getPerson("p1")?.ziweiIds).toEqual(["zw_1", "zw_2"]);
      unlinkZiweiId("p1", "zw_1");
      expect(getPerson("p1")?.ziweiIds).toEqual(["zw_2"]);
    });

    it("一人可同时挂八字与紫微多盘", () => {
      const p = createPerson({
        name: "跨术数",
        chartIds: ["bazi_a", "bazi_b"],
        ziweiIds: ["zw_a"],
      });
      linkZiweiId(p.id, "zw_b");
      const got = getPerson(p.id)!;
      expect(got.chartIds).toEqual(["bazi_a", "bazi_b"]);
      expect(got.ziweiIds).toEqual(["zw_a", "zw_b"]);
      const entry = toPersonListEntry(got);
      expect(entry.chartCount).toBe(2);
      expect(entry.ziweiCount).toBe(2);
    });
  });

  describe("T122 UI 钩子", () => {
    it("listPersonEntries 摘要", () => {
      createPerson({
        id: "p1",
        name: "展示",
        gender: "male",
        solarDate: "1991-02-03",
        chartIds: ["c1"],
        ziweiIds: ["z1", "z2"],
      });
      const entries = listPersonEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        id: "p1",
        name: "展示",
        gender: "male",
        solarDate: "1991-02-03",
        chartCount: 1,
        ziweiCount: 2,
      });
    });
  });

  describe("类型契约", () => {
    it("Person 结构可序列化往返", () => {
      const raw: Person = {
        id: "person_contract",
        userId: null,
        name: "契约",
        gender: "female",
        solarDate: "1988-06-01",
        lunarDate: "一九八八五月十七",
        isLeapMonth: false,
        birthTime: "09:30",
        shichenUnknown: false,
        birthPlace: { province: "广东", city: "广州", lng: 113.2, lat: 23.1 },
        chartIds: ["prof_1"],
        ziweiIds: ["zw_1"],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
      const saved = savePerson(raw);
      expect(getPerson(saved.id)).toMatchObject({
        name: "契约",
        chartIds: ["prof_1"],
        ziweiIds: ["zw_1"],
        birthPlace: { province: "广东", city: "广州" },
      });
    });
  });
});
