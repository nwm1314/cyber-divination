"use client";

import { useState } from "react";
import Link from "next/link";
import type { ViewMode } from "@/lib/types";
import { getPrefs, savePrefs, type UserPrefs } from "@/lib/prefs";
import { Button, Card } from "@/components/ui";

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<UserPrefs>(() =>
    typeof window !== "undefined" ? getPrefs() : {
      defaultViewMode: "plain",
      defaultUseTrueSolarTime: false,
    },
  );
  const [saved, setSaved] = useState(false);

  const patch = (p: Partial<UserPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...p }));
    setSaved(false);
  };

  const onSave = () => {
    savePrefs(prefs);
    setSaved(true);
  };

  return (
    <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
      <div className="safe-pad flex flex-1 flex-col max-w-lg mx-auto w-full gap-4 pb-8">
        <header className="flex items-center justify-between gap-3 pt-2">
          <Link
            href="/"
            className="text-sm text-muted hover:text-cyan transition-colors"
          >
            ← 首页
          </Link>
          <h1 className="text-base font-medium text-gold tracking-wide">
            本地设置
          </h1>
          <span className="w-10" aria-hidden />
        </header>

        <Card title="默认偏好" subtitle="仅保存在本机浏览器，不上传账号">
          <div className="space-y-5">
            <div>
              <p className="text-sm text-muted mb-2" id="pref-view-mode-label">
                默认命盘/报告模式
              </p>
              <div
                className="flex gap-2"
                role="group"
                aria-labelledby="pref-view-mode-label"
              >
                {(
                  [
                    ["plain", "通俗"],
                    ["pro", "专业"],
                  ] as const
                ).map(([v, lab]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={prefs.defaultViewMode === v}
                    aria-label={`默认${lab}模式`}
                    onClick={() =>
                      patch({ defaultViewMode: v as ViewMode })
                    }
                    className={[
                      "flex-1 h-11 rounded-lg border text-sm transition-colors",
                      prefs.defaultViewMode === v
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-border bg-surface-elevated text-muted",
                    ].join(" ")}
                  >
                    {lab}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.defaultUseTrueSolarTime}
                onChange={(e) =>
                  patch({ defaultUseTrueSolarTime: e.target.checked })
                }
                className="accent-cyan size-4"
                aria-label="新建命盘时默认开启真太阳时"
              />
              新建命盘时默认开启真太阳时
            </label>

            <p className="text-xs text-muted leading-relaxed">
              真太阳时校正需在表单中填写出生地经度；未填经度时引擎将标记「未校正」提示。
            </p>

            <div className="flex items-center gap-3">
              <Button onClick={onSave} aria-label="保存本地设置">
                保存
              </Button>
              {saved ? (
                <span className="text-xs text-cyan" role="status">
                  已保存
                </span>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
