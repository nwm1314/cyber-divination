/**
 * 报告导出：可打印 HTML → 用户「另存为 PDF」或浏览器打印
 * 零第三方依赖；图片导出仍走 SVG→PNG
 */

export type ReportExportSection = {
  title: string;
  body: string;
};

export type ReportExportInput = {
  title: string;
  subtitle?: string;
  sections: ReportExportSection[];
  disclaimer?: string;
  /** 文件名建议（不含扩展名） */
  filenameBase?: string;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bodyToHtml(body: string): string {
  return esc(body)
    .split(/\n+/)
    .map((p) => `<p style="margin:0 0 0.6em;line-height:1.65">${p || "&nbsp;"}</p>`)
    .join("");
}

/**
 * 打开打印窗口，用户可「另存为 PDF」
 */
export function openReportPrintDialog(input: ReportExportInput): void {
  const sectionsHtml = input.sections
    .map(
      (s, i) => `
    <section style="margin-bottom:1.25rem;page-break-inside:avoid">
      <h2 style="font-size:1rem;color:#b8860b;margin:0 0 0.4rem;letter-spacing:0.05em">
        ${i + 1}. ${esc(s.title)}
      </h2>
      <div style="font-size:0.9rem;color:#1a1a1a">${bodyToHtml(s.body)}</div>
    </section>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>${esc(input.title)}</title>
  <style>
    @page { margin: 16mm; }
    body { font-family: "PingFang SC","Microsoft YaHei",system-ui,sans-serif; color:#1a1a1a; max-width:720px; margin:0 auto; padding:12px 8px; }
    h1 { font-size:1.35rem; color:#8b6914; margin:0 0 0.25rem; }
    .sub { color:#666; font-size:0.85rem; margin-bottom:1.25rem; }
    .disc { margin-top:2rem; padding-top:1rem; border-top:1px solid #ddd; font-size:0.75rem; color:#666; }
    @media print {
      .no-print { display:none !important; }
    }
  </style>
</head>
<body>
  <p class="no-print" style="font-size:0.8rem;color:#888;margin-bottom:1rem">
    请使用浏览器菜单「打印」→「另存为 PDF」保存本报告。
  </p>
  <h1>${esc(input.title)}</h1>
  ${input.subtitle ? `<p class="sub">${esc(input.subtitle)}</p>` : ""}
  ${sectionsHtml}
  ${
    input.disclaimer
      ? `<p class="disc">${esc(input.disclaimer)}</p>`
      : `<p class="disc">命理分析仅供参考，人生在于自身的努力和选择。</p>`
  }
  <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) {
    throw new Error("无法打开打印窗口，请允许弹窗后重试");
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/**
 * 通用 SVG 卡片 → PNG（紫微/六爻签语卡）
 */
export async function downloadGenericCardPng(input: {
  title: string;
  brand: string;
  lines: string[];
  footer?: string;
  filename?: string;
}): Promise<"png" | "svg"> {
  const W = 720;
  const PAD = 40;
  const titleH = 80;
  const lineH = 28;
  const lines = input.lines.slice(0, 12);
  const H = PAD + titleH + lines.length * lineH + (input.footer ? 48 : 24) + PAD;

  const escLocal = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const textLines = lines
    .map((line, i) => {
      const y = PAD + titleH + 20 + i * lineH;
      return `<text x="${PAD}" y="${y}" fill="#e8e6e0" font-size="17" font-family="system-ui,'PingFang SC','Microsoft YaHei',sans-serif">${escLocal(line)}</text>`;
    })
    .join("\n");

  const footerSvg = input.footer
    ? `<text x="${W / 2}" y="${H - PAD + 4}" text-anchor="middle" fill="#6b6560" font-size="12" font-family="system-ui,sans-serif">${escLocal(input.footer)}</text>`
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
  <text x="${W / 2}" y="${PAD + 28}" text-anchor="middle" fill="#d4a84b" font-size="26" font-weight="700" font-family="system-ui,'PingFang SC','Microsoft YaHei',sans-serif" letter-spacing="3">${escLocal(input.title)}</text>
  <text x="${W / 2}" y="${PAD + 54}" text-anchor="middle" fill="#8b8680" font-size="13" font-family="system-ui,'PingFang SC','Microsoft YaHei',sans-serif">${escLocal(input.brand)}</text>
  <line x1="${PAD}" y1="${PAD + titleH - 8}" x2="${W - PAD}" y2="${PAD + titleH - 8}" stroke="#d4a84b" stroke-opacity="0.2"/>
  ${textLines}
  ${footerSvg}
</svg>`;

  const stamp = Date.now();
  const base = input.filename ?? `card-${stamp}`;

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = filename;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

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
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 不可用");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img, 0, 0, W, H);
    URL.revokeObjectURL(svgUrl);
    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG 编码失败"))),
        "image/png",
      );
    });
    downloadBlob(pngBlob, `${base}.png`);
    return "png";
  } catch {
    downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${base}.svg`);
    return "svg";
  }
}
