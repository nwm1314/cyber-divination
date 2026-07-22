import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  getDataStore,
  getPersistMode,
  isAccountPersistMode,
  setAccountPersistMode,
  canUseCloudAndShare,
  enterAccountPersistMode,
} from "./mode";
import { saveProfile, getProfile } from "./index";
import type { BirthProfile } from "@/lib/types";

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
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
    _keys: () => [...store.keys()],
  };
}

const profile: BirthProfile = {
  id: "guest-p1",
  name: "游客甲",
  gender: "male",
  solarDate: "1990-01-01",
  analysisBaseDate: "1990-01-01",
  shichenUnknown: true,
  alive: true,
  useTrueSolarTime: false,
};

describe("persist mode guest vs account", () => {
  let local: ReturnType<typeof mockStorage>;
  let session: ReturnType<typeof mockStorage>;

  beforeEach(() => {
    local = mockStorage();
    session = mockStorage();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("默认游客：sessionStorage，不可分享云端", () => {
    expect(isAccountPersistMode()).toBe(false);
    expect(getPersistMode()).toBe("guest");
    expect(canUseCloudAndShare()).toBe(false);
    expect(getDataStore()).toBe(session);
  });

  it("账号模式写 localStorage", () => {
    setAccountPersistMode(true);
    expect(isAccountPersistMode()).toBe(true);
    expect(getDataStore()).toBe(local);
    saveProfile(profile);
    expect(getProfile("guest-p1")?.name).toBe("游客甲");
    expect(local.getItem("bd_profile_guest-p1")).toBeTruthy();
    expect(session.getItem("bd_profile_guest-p1")).toBeNull();
  });

  it("游客模式写 sessionStorage", () => {
    setAccountPersistMode(false);
    saveProfile(profile);
    expect(session.getItem("bd_profile_guest-p1")).toBeTruthy();
    expect(local.getItem("bd_profile_guest-p1")).toBeNull();
  });

  it("enterAccountPersistMode 提升游客数据到 local", () => {
    setAccountPersistMode(false);
    saveProfile(profile);
    expect(session.getItem("bd_profile_guest-p1")).toBeTruthy();

    const n = enterAccountPersistMode();
    expect(n).toBeGreaterThan(0);
    expect(isAccountPersistMode()).toBe(true);
    expect(local.getItem("bd_profile_guest-p1")).toBeTruthy();
    expect(session.getItem("bd_profile_guest-p1")).toBeNull();
    expect(getProfile("guest-p1")?.name).toBe("游客甲");
  });
});
