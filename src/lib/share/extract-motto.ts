/**
 * 从解读报告 advice（或其它章）正文截取分享「签语」。
 * 跳过「综合建议：」类标题行，保证非空且含实质句。
 */

const TITLE_LIKE =
  /^(综合建议|行动建议|建议|签语|结论|综述)[（(]?[^。！？\n]*[：:]\s*$/;

const FALLBACK_BAZI = "命理分析仅供参考";
const FALLBACK_LIUYAO = "一事一问，仅供参考";

export type ExtractMottoOptions = {
  /** 最大字符数（含省略号前） */
  maxLen?: number;
  /** 兜底文案 */
  fallback?: string;
};

function isTitleLike(segment: string): boolean {
  const t = segment.trim();
  if (!t) return true;
  if (TITLE_LIKE.test(t)) return true;
  // 仅标题词、无实质（如「综合建议（供参考）」无冒号时）
  if (/^(综合建议|行动建议|建议)[（(]?[^。！？:：]{0,24}[)）]?$/.test(t)) {
    return true;
  }
  // 纯序号
  if (/^\d+[.、．)]\s*$/.test(t)) return true;
  return false;
}

function isSubstantive(segment: string): boolean {
  const t = segment.trim();
  if (t.length < 6) return false;
  if (isTitleLike(t)) return false;
  // 至少含汉字且不止标点/数字
  const hans = t.replace(/[^\u4e00-\u9fff]/g, "");
  return hans.length >= 4;
}

/**
 * 从 section body 提取签语：优先第一条实质句，否则兜底。
 */
export function extractShareMotto(
  body: string | undefined | null,
  options?: ExtractMottoOptions,
): string {
  const maxLen = options?.maxLen ?? 60;
  const fallback = options?.fallback ?? FALLBACK_BAZI;
  const raw = body?.trim() ?? "";
  if (!raw) return fallback;

  const parts = raw
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const pick =
    parts.find(isSubstantive) ??
    parts.find((p) => !isTitleLike(p) && p.trim().length >= 4) ??
    fallback;

  const text = pick.trim();
  if (!text) return fallback;
  if (text.length > maxLen) return `${text.slice(0, maxLen)}…`;
  return text;
}

/** 从 sections 中取 advice（六爻可回落 judgment）再截签语 */
export function extractShareMottoFromSections(
  sections:
    | { key: string; body?: string }[]
    | undefined
    | null,
  options?: ExtractMottoOptions & { preferKeys?: string[] },
): string {
  const keys = options?.preferKeys ?? ["advice", "judgment"];
  if (!sections?.length) {
    return extractShareMotto("", options);
  }
  for (const key of keys) {
    const sec = sections.find((s) => s.key === key);
    if (sec?.body?.trim()) {
      return extractShareMotto(sec.body, options);
    }
  }
  return extractShareMotto(sections[0]?.body, options);
}

export const MOTTO_FALLBACK = {
  bazi: FALLBACK_BAZI,
  ziwei: FALLBACK_BAZI,
  liuyao: FALLBACK_LIUYAO,
} as const;
