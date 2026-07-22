import type { BaziChart } from "@/lib/types";

export type ShareCardExportInput = {
  pillars: BaziChart["pillars"];
  dayMaster: string;
  advice: string;
  chartName: string;
  /** 可选页脚（如分享 URL） */
  footer?: string;
};

const STEM_HEX: Record<string, string> = {
  甲: "#34d399",
  乙: "#6ee7b7",
  丙: "#f87171",
  丁: "#fda4af",
  戊: "#fbbf24",
  己: "#fcd34d",
  庚: "#e4e4e7",
  辛: "#d4d4d8",
  壬: "#22d3ee",
  癸: "#67e8f9",
};

const BRANCH_HEX: Record<string, string> = {
  子: "#22d3ee",
  丑: "#fbbf24",
  寅: "#34d399",
  卯: "#6ee7b7",
  辰: "#fbbf24",
  巳: "#f87171",
  午: "#f87171",
  未: "#fbbf24",
  申: "#e4e4e7",
  酉: "#d4d4d8",
  戌: "#fbbf24",
  亥: "#67e8f9",
};

const LABELS = ["年", "月", "日", "时"] as const;
const W = 720;
const PAD = 40;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(text: string, maxChars: number): string[] {
  const t = text.trim();
  if (!t) return [];
  const lines: string[] = [];
  let i = 0;
  while (i < t.length) {
    lines.push(t.slice(i, i + maxChars));
    i += maxChars;
  }
  return lines.slice(0, 4);
}

/**
 * 生成纯 SVG 命盘卡片（无 foreignObject / 外链），便于 Canvas 栅格为 PNG。
 */
export function buildShareCardSvg(input: ShareCardExportInput): {
  svg: string;
  width: number;
  height: number;
} {
  const { pillars, dayMaster, advice, chartName, footer } = input;
  const cols = [
    pillars.year,
    pillars.month,
    pillars.day,
    pillars.hour ?? null,
  ];

  const adviceLines = wrapText(advice || "命理分析仅供参考", 18);
  const name = chartName || "命盘分享";

  // 布局：标题区 + 四柱 + 签语 + 页脚
  const titleH = 88;
  const tableTop = PAD + titleH;
  const colW = (W - PAD * 2) / 4;
  const rowH = 52;
  const tableH = 36 + rowH * 2; // 标签 + 天干 + 地支
  const adviceTop = tableTop + tableH + 36;
  const adviceH = 28 + adviceLines.length * 28;
  const footerH = footer ? 36 : 16;
  const H = adviceTop + adviceH + footerH + PAD;

  const stemCells = cols
    .map((p, i) => {
      const x = PAD + colW * i + colW / 2;
      const y = tableTop + 36 + rowH * 0.55;
      if (!p) {
        return `<text x="${x}" y="${y}" text-anchor="middle" fill="#8b8680" font-size="22" font-family="system-ui,sans-serif">—</text>`;
      }
      const fill = STEM_HEX[p.stem] ?? "#e8e6e0";
      return `<text x="${x}" y="${y}" text-anchor="middle" fill="${fill}" font-size="36" font-weight="600" font-family="system-ui,'PingFang SC','Microsoft YaHei',sans-serif">${esc(p.stem)}</text>`;
    })
    .join("\n");

  const branchCells = cols
    .map((p, i) => {
      const x = PAD + colW * i + colW / 2;
      const y = tableTop + 36 + rowH + rowH * 0.55;
      if (!p) {
        return `<text x="${x}" y="${y}" text-anchor="middle" fill="#8b8680" font-size="22" font-family="system-ui,sans-serif">未知</text>`;
      }
      const fill = BRANCH_HEX[p.branch] ?? "#e8e6e0";
      return `<text x="${x}" y="${y}" text-anchor="middle" fill="${fill}" font-size="36" font-weight="600" font-family="system-ui,'PingFang SC','Microsoft YaHei',sans-serif">${esc(p.branch)}</text>`;
    })
    .join("\n");

  const labels = LABELS.map((label, i) => {
    const x = PAD + colW * i + colW / 2;
    const isDay = i === 2;
    const fill = isDay ? "#d4a84b" : "#8b8680";
    const sub = isDay
      ? `<text x="${x}" y="${tableTop + 28}" text-anchor="middle" fill="#22d3ee" font-size="12" font-family="system-ui,sans-serif">日主·${esc(dayMaster)}</text>`
      : "";
    return `<text x="${x}" y="${tableTop + 14}" text-anchor="middle" fill="${fill}" font-size="14" font-weight="600" font-family="system-ui,'PingFang SC','Microsoft YaHei',sans-serif">${label}柱</text>${sub}`;
  }).join("\n");

  const adviceSvg = adviceLines
    .map((line, i) => {
      const y = adviceTop + 36 + i * 28;
      return `<text x="${PAD}" y="${y}" fill="#e8e6e0" font-size="18" font-family="system-ui,'PingFang SC','Microsoft YaHei',sans-serif">${esc(line)}</text>`;
    })
    .join("\n");

  const footerSvg = footer
    ? `<text x="${W / 2}" y="${H - PAD + 4}" text-anchor="middle" fill="#6b6560" font-size="12" font-family="system-ui,sans-serif">${esc(footer)}</text>`
    : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0c0e14"/>
      <stop offset="100%" stop-color="#12141c"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="20" fill="url(#bg)"/>
  <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="18.5" fill="none" stroke="#d4a84b" stroke-opacity="0.45" stroke-width="2"/>
  <text x="${W / 2}" y="${PAD + 28}" text-anchor="middle" fill="#d4a84b" font-size="28" font-weight="700" font-family="system-ui,'PingFang SC','Microsoft YaHei',sans-serif" letter-spacing="4">${esc(name)}</text>
  <text x="${W / 2}" y="${PAD + 54}" text-anchor="middle" fill="#8b8680" font-size="13" font-family="system-ui,'PingFang SC','Microsoft YaHei',sans-serif">赛博八字 · 命盘分享</text>
  <line x1="${PAD}" y1="${tableTop - 8}" x2="${W - PAD}" y2="${tableTop - 8}" stroke="#d4a84b" stroke-opacity="0.2"/>
  ${labels}
  ${stemCells}
  ${branchCells}
  <line x1="${PAD}" y1="${adviceTop}" x2="${W - PAD}" y2="${adviceTop}" stroke="#d4a84b" stroke-opacity="0.25"/>
  <text x="${PAD}" y="${adviceTop + 22}" fill="#d4a84b" font-size="14" font-weight="600" font-family="system-ui,'PingFang SC','Microsoft YaHei',sans-serif" letter-spacing="2">签语</text>
  ${adviceSvg}
  ${footerSvg}
</svg>`;

  return { svg, width: W, height: H };
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = filename;
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * 导出 PNG（SVG → Canvas 栅格，2x 清晰度）。
 * 失败时降级下载 SVG。
 */
export async function downloadShareCardImage(
  input: ShareCardExportInput,
): Promise<"png" | "svg"> {
  const { svg, width, height } = buildShareCardSvg(input);
  const stamp = Date.now();

  try {
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("SVG 解码失败"));
      el.src = svgUrl;
    });

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 不可用");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(svgUrl);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG 编码失败"))),
        "image/png",
      );
    });

    downloadBlob(pngBlob, `bazi-card-${stamp}.png`);
    return "png";
  } catch {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, `bazi-card-${stamp}.svg`);
    return "svg";
  }
}
