import { ImageResponse } from "next/og";
import { getShareSnapshot } from "@/lib/share";
import type { BaziChart } from "@/lib/types";

export const runtime = "nodejs";
export const alt = "赛博八字 · 命盘分享";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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

const LABELS = ["年柱", "月柱", "日柱", "时柱"] as const;

/** 轻量中文字体（woff2 子集源）；失败时 Satori 仍可出图（中文可能缺字） */
async function loadCjkFont(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(
      "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@5.2.5/chinese-simplified-400-normal.woff",
      { next: { revalidate: 86400 * 30 } },
    );
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function pillarCells(pillars: BaziChart["pillars"]) {
  return [
    pillars.year,
    pillars.month,
    pillars.day,
    pillars.hour ?? null,
  ] as const;
}

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const snapshot = await getShareSnapshot(token);

  const chartName = snapshot?.chartName ?? "命盘分享";
  const dayMaster = snapshot?.dayMaster ?? "—";
  const advice = (snapshot?.advice ?? "命理分析仅供参考").slice(0, 48);
  const cols =
    snapshot?.pillars != null
      ? pillarCells(snapshot.pillars)
      : ([null, null, null, null] as const);

  const fontData = await loadCjkFont();
  const fonts = fontData
    ? [
        {
          name: "NotoSansSC",
          data: fontData,
          style: "normal" as const,
          weight: 400 as const,
        },
      ]
    : undefined;

  const fontFamily = fontData
    ? "NotoSansSC, sans-serif"
    : "system-ui, sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0c0e14 0%, #12141c 100%)",
          color: "#e8e6e0",
          fontFamily,
          padding: 56,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            border: "2px solid rgba(212,168,75,0.45)",
            borderRadius: 24,
            padding: 40,
            flex: 1,
            background: "rgba(18,20,28,0.9)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: 28,
            }}
          >
            <div
              style={{
                fontSize: 42,
                fontWeight: 700,
                color: "#d4a84b",
                letterSpacing: 6,
              }}
            >
              {chartName}
            </div>
            <div style={{ fontSize: 20, color: "#8b8680", marginTop: 8 }}>
              赛博八字 · 命盘分享
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            {LABELS.map((label, i) => {
              const p = cols[i];
              const isDay = i === 2;
              return (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: "22%",
                  }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      color: isDay ? "#d4a84b" : "#8b8680",
                      marginBottom: 8,
                    }}
                  >
                    {label}
                  </div>
                  {isDay ? (
                    <div
                      style={{
                        fontSize: 16,
                        color: "#22d3ee",
                        marginBottom: 10,
                      }}
                    >
                      日主·{dayMaster}
                    </div>
                  ) : (
                    <div style={{ height: 26, marginBottom: 10 }} />
                  )}
                  <div
                    style={{
                      fontSize: 48,
                      fontWeight: 600,
                      color: p ? STEM_HEX[p.stem] ?? "#e8e6e0" : "#8b8680",
                    }}
                  >
                    {p?.stem ?? "—"}
                  </div>
                  <div
                    style={{
                      fontSize: 48,
                      fontWeight: 600,
                      color: p ? BRANCH_HEX[p.branch] ?? "#e8e6e0" : "#8b8680",
                      marginTop: 8,
                    }}
                  >
                    {p?.branch ?? "—"}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 36,
              borderTop: "1px solid rgba(212,168,75,0.25)",
              paddingTop: 24,
            }}
          >
            <div
              style={{
                fontSize: 20,
                color: "#d4a84b",
                letterSpacing: 4,
                marginBottom: 12,
              }}
            >
              签语
            </div>
            <div style={{ fontSize: 28, color: "#e8e6e0", lineHeight: 1.4 }}>
              {advice}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    },
  );
}
