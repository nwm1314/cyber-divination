"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AppSession } from "@/lib/types/user";
import {
  getProfile,
  getChart,
  getReport,
  getCalibration,
  listCharts,
} from "@/lib/storage";
import { Button, Card } from "@/components/ui";

type Props = {
  session: AppSession;
};

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Let the browser finish resolving the blob URL before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AccountPanel({ session }: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"export" | "local" | "delete" | null>(null);

  const onExportCloud = async () => {
    setBusy("export");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/account/export", {
        credentials: "same-origin",
      });
      const data = (await res.json()) as {
        error?: { message?: string };
      };
      if (!res.ok) {
        setErr(data.error?.message ?? "导出失败");
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(`cyber-bazi-cloud-${stamp}.json`, data);
      setMsg("云端数据已下载为 JSON 文件");
    } catch {
      setErr("网络错误，请稍后重试");
    } finally {
      setBusy(null);
    }
  };

  const onExportLocal = () => {
    setBusy("local");
    setErr(null);
    setMsg(null);
    try {
      const entries = listCharts();
      const profiles = [];
      const charts = [];
      const reports = [];
      const calibrations = [];
      for (const e of entries) {
        const p = getProfile(e.profileId);
        const c = getChart(e.profileId);
        const r = getReport(e.profileId);
        const cal = getCalibration(e.profileId);
        if (p) profiles.push(p);
        if (c) charts.push(c);
        if (r) reports.push(r);
        if (cal) calibrations.push(cal);
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(`cyber-bazi-local-${stamp}.json`, {
        exportedAt: new Date().toISOString(),
        version: 1,
        source: "localStorage",
        list: entries,
        profiles,
        charts,
        reports,
        calibrations,
      });
      setMsg(
        entries.length
          ? `已导出本机 ${entries.length} 条档案`
          : "本机暂无档案，已导出空清单",
      );
    } catch {
      setErr("读取本机数据失败");
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async () => {
    const ok = window.confirm(
      "确定永久删除账号及云端数据？此操作不可撤销。本机浏览器数据不会自动清除。",
    );
    if (!ok) return;
    const again = window.confirm(
      "再次确认：删除后将无法使用该账号登录，云端档案将被清除。",
    );
    if (!again) return;

    setBusy("delete");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = (await res.json()) as {
        error?: { message?: string };
        ok?: boolean;
      };
      if (!res.ok) {
        setErr(data.error?.message ?? "删除失败");
        return;
      }
      setMsg("账号已删除");
      router.refresh();
      router.push("/");
    } catch {
      setErr("网络错误，请稍后重试");
    } finally {
      setBusy(null);
    }
  };

  if (!session.authenticated) {
    return (
      <Card title="账号" subtitle="登录后可导出云端数据或删除账号">
        <p className="text-sm text-muted leading-relaxed mb-4">
          你当前未登录。本地排盘数据仍保存在本机浏览器；可先导出本机数据，或前往登录。
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={onExportLocal}
          >
            {busy === "local" ? "导出中…" : "导出本机数据"}
          </Button>
          <Link
            href="/auth/login?callbackUrl=/account"
            className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-medium bg-gold text-background border border-gold-dim"
          >
            去登录
          </Link>
        </div>
        {msg ? (
          <p className="mt-3 text-xs text-cyan" role="status">
            {msg}
          </p>
        ) : null}
        {err ? (
          <p className="mt-3 text-xs text-danger" role="alert">
            {err}
          </p>
        ) : null}
      </Card>
    );
  }

  const label =
    session.displayName?.trim() ||
    session.email?.split("@")[0] ||
    session.userId;

  return (
    <div className="space-y-4">
      <Card title="当前账号" subtitle="登录身份与会话">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">显示名</dt>
            <dd className="text-gold text-right truncate">{label}</dd>
          </div>
          {session.email ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">邮箱</dt>
              <dd className="text-right truncate">{session.email}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-muted">用户 ID</dt>
            <dd className="text-right font-mono text-xs truncate">
              {session.userId}
            </dd>
          </div>
        </dl>
      </Card>

      <Card
        title="导出数据"
        subtitle="云端 JSON 需登录；本机数据仅在当前浏览器可读"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={() => void onExportCloud()}
          >
            {busy === "export" ? "导出中…" : "导出云端 JSON"}
          </Button>
          <Button
            variant="ghost"
            disabled={busy !== null}
            onClick={onExportLocal}
          >
            {busy === "local" ? "导出中…" : "导出本机数据"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted leading-relaxed">
          云端导出包含账号信息与已同步档案（若云端同步尚未启用则为空集）。本机导出读取
          localStorage 中的命盘列表。
        </p>
      </Card>

      <Card
        title="删除账号"
        subtitle="永久删除账号与云端数据，不可撤销"
        glow="none"
      >
        <p className="text-sm text-muted leading-relaxed mb-4">
          删除后会话立即失效，相关接口将返回 401/404。本机浏览器中的档案不会自动清除，可先「导出本机数据」或在「我的档案」中手动删除。
        </p>
        <Button
          variant="danger"
          disabled={busy !== null}
          onClick={() => void onDelete()}
        >
          {busy === "delete" ? "删除中…" : "删除账号及云端数据"}
        </Button>
      </Card>

      {msg ? (
        <p className="text-xs text-cyan" role="status">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="text-xs text-danger" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
