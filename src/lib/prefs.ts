import type { ViewMode } from "@/lib/types";

const KEY = "bd_prefs";

export type UserPrefs = {
  /** 命盘/报告默认通俗或专业 */
  defaultViewMode: ViewMode;
  /** 表单默认是否勾选真太阳时 */
  defaultUseTrueSolarTime: boolean;
};

export const DEFAULT_PREFS: UserPrefs = {
  defaultViewMode: "plain",
  defaultUseTrueSolarTime: false,
};

export function getPrefs(): UserPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<UserPrefs>;
    return {
      defaultViewMode:
        parsed.defaultViewMode === "pro" ? "pro" : "plain",
      defaultUseTrueSolarTime: Boolean(parsed.defaultUseTrueSolarTime),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: UserPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}
