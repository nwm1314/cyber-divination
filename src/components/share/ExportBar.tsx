"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { canUseCloudAndShare } from "@/lib/storage/mode";
import {
  openReportPrintDialog,
  type ReportExportSection,
} from "@/lib/export/reportPdf";

type Props = {
  /** 报告章节（PDF） */
  reportTitle: string;
  reportSubtitle?: string;
  sections: ReportExportSection[];
  disclaimer?: string;
  /** 下载 PNG 卡片 */
  onExportPng?: () => Promise<void>;
  /** 生成分享链接（仅登录） */
  onShare?: () => Promise<void>;
  shareUrl?: string | null;
  shareLoading?: boolean;
  /** 登录回调路径 */
  loginHref?: string;
};

export function ExportBar({
  reportTitle,
  reportSubtitle,
  sections,
  disclaimer,
  onExportPng,
  onShare,
  shareUrl,
  shareLoading,
  loginHref = "/auth/login",
}: Props) {
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canShare = canUseCloudAndShare();

  const handlePdf = useCallback(() => {
    setErr(null);
    setHint(null);
    setBusy("pdf");
    try {
      openReportPrintDialog({
        title: reportTitle,
        subtitle: reportSubtitle,
        sections,
        disclaimer,
      });
      setHint("已打开打印窗口，请选择「另存为 PDF」");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "导出 PDF 失败");
    } finally {
      setBusy(null);
    }
  }, [reportTitle, reportSubtitle, sections, disclaimer]);

  const handlePng = useCallback(async () => {
    if (!onExportPng) return;
    setErr(null);
    setHint(null);
    setBusy("png");
    try {
      await onExportPng();
      setHint("已下载图片");
    } catch {
      setErr("导出图片失败，请重试");
    } finally {
      setBusy(null);
    }
  }, [onExportPng]);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-surface/40 p-3 sm:p-4">
      <p className="text-xs text-muted">导出命盘摘要与解读报告</p>
      <div className="flex flex-wrap gap-2 items-center">
        {onExportPng && (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy !== null}
            onClick={() => void handlePng()}
          >
            {busy === "png" ? "导出中…" : "下载 PNG"}
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null || sections.length === 0}
          onClick={handlePdf}
        >
          {busy === "pdf" ? "打开中…" : "导出 PDF"}
        </Button>

        {canShare && onShare && !shareUrl && (
          <Button
            variant="ghost"
            size="sm"
            disabled={shareLoading}
            onClick={() => void onShare()}
          >
            {shareLoading ? "生成中…" : "生成分享链接"}
          </Button>
        )}
        {canShare && shareUrl && (
          <>
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 min-w-[10rem] bg-surface text-xs text-foreground px-3 py-2 rounded-lg border border-border"
            />
            <Button variant="secondary" size="sm" onClick={() => void handleCopy()}>
              {copied ? "已复制" : "复制链接"}
            </Button>
          </>
        )}
        {!canShare && (
          <Link
            href={loginHref}
            className="text-xs text-cyan hover:text-gold underline-offset-2 hover:underline px-1"
          >
            登录后可生成分享链接
          </Link>
        )}
      </div>
      {err && <p className="text-xs text-danger">{err}</p>}
      {hint && !err && <p className="text-xs text-cyan/80">{hint}</p>}
    </div>
  );
}
