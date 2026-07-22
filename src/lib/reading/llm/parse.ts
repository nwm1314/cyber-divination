/**
 * T290 · 结构化 JSON 优先解析，文本分段为 fallback
 */

import { structuredReadingSchema } from "@/lib/contracts/reading";
import { findSafetyViolation, safetyViolationMessage } from "./safety";

export type ParsedSection = {
  key: string;
  body: string;
  styleCitations?: string[];
};

export type ParseResult =
  | { ok: true; sections: ParsedSection[]; source: "json" | "text" }
  | { ok: false; reason: string };

/**
 * 从模型原文提取 JSON 对象（支持 ```json 围栏）
 */
export function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // fenced
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() ?? trimmed;

  // 直接对象
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

/**
 * 文本分段：按「N. 标题」或包含 title 匹配
 */
export function parseSectionsFromText(
  text: string,
  sectionKeys: readonly string[],
  sectionTitles: Record<string, string>,
): ParsedSection[] {
  const lines = text.split("\n");
  const found: ParsedSection[] = [];
  let currentKey: string | null = null;
  let currentBody: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // 仅标题行：编号开头，或整行近似章节名（避免正文夹带标题误切）
    const matched = sectionKeys.find((k) => {
      const title = sectionTitles[k] ?? "";
      const n = sectionKeys.indexOf(k) + 1;
      if (trimmed.startsWith(`${n}.`) || trimmed.startsWith(`${n}、`)) {
        return title ? trimmed.includes(title) || trimmed.length < 40 : true;
      }
      if (!title) return false;
      // 整行以标题为主（允许前后装饰）
      return (
        trimmed === title ||
        trimmed === `【${title}】` ||
        (trimmed.length <= title.length + 8 && trimmed.includes(title))
      );
    });
    if (matched) {
      if (currentKey && currentBody.length > 0) {
        found.push({
          key: currentKey,
          body: currentBody.join("\n").trim(),
        });
      }
      currentKey = matched;
      currentBody = [];
    } else if (currentKey) {
      currentBody.push(line);
    }
  }

  if (currentKey && currentBody.length > 0) {
    found.push({
      key: currentKey,
      body: currentBody.join("\n").trim(),
    });
  }

  return found;
}

function hasAllKeys(
  sections: ParsedSection[],
  required: readonly string[],
): boolean {
  const keys = new Set(sections.map((s) => s.key));
  return required.every((k) => keys.has(k) && Boolean(sections.find((s) => s.key === k)?.body?.trim()));
}

/**
 * 优先 JSON Schema；失败则文本分段；再校验缺章与安全策略
 */
export function parseLlmReadingContent(
  raw: string,
  sectionKeys: readonly string[],
  sectionTitles: Record<string, string>,
): ParseResult {
  if (!raw.trim()) {
    return { ok: false, reason: "模型返回空内容" };
  }

  // 全文安全扫描（JSON 与正文均覆盖）
  const violation = findSafetyViolation(raw);
  if (violation) {
    return { ok: false, reason: safetyViolationMessage(violation) };
  }

  let sections: ParsedSection[] = [];
  let source: "json" | "text" = "text";

  const json = extractJsonObject(raw);
  if (json != null) {
    const parsed = structuredReadingSchema.safeParse(json);
    if (parsed.success) {
      const allowed = new Set(sectionKeys);
      sections = parsed.data.sections
        .filter((s) => allowed.has(s.key))
        .map((s) => ({
          key: s.key,
          body: s.body.trim(),
          styleCitations: s.styleCitations,
        }));
      source = "json";
    }
  }

  if (sections.length === 0) {
    sections = parseSectionsFromText(raw, sectionKeys, sectionTitles);
    source = "text";
  }

  // 缺章 / 空章 → 失败（调用方回落模板）
  if (!hasAllKeys(sections, sectionKeys)) {
    const missing = sectionKeys.filter(
      (k) => !sections.find((s) => s.key === k)?.body?.trim(),
    );
    return {
      ok: false,
      reason: `结构化校验失败：缺少或空章节 ${missing.join("、")}`,
    };
  }

  // 再扫各章正文
  for (const s of sections) {
    const v = findSafetyViolation(s.body);
    if (v) {
      return { ok: false, reason: safetyViolationMessage(v) };
    }
  }

  // 按约定顺序
  const ordered = sectionKeys.map((k) => {
    const s = sections.find((x) => x.key === k)!;
    return s;
  });

  return { ok: true, sections: ordered, source };
}
