/**
 * T290 · LLM 叙事安全：绝对断言 / 虚构引用拦截
 * 命中则整份报告回落模板，不局部修补。
 */

/** 绝对断言 / 恐吓 / 医疗投资保证（简体） */
const ABSOLUTE_ASSERTION_PATTERNS: RegExp[] = [
  /必定会?/,
  /必然会?/,
  /一定会?/,
  /绝对会?/,
  /肯定会?/,
  /百分之百/,
  /100%/,
  /必将/,
  /必死/,
  /必患/,
  /必得(?:重病|癌症|绝症)/,
  /稳赚不赔/,
  /必赚/,
  /注定(?:破产|失败|死亡|离婚)/,
  /逃不过/,
  /在劫难逃/,
  /无可避免地/,
  /铁定/,
  /板上钉钉/,
];

/** 允许的典籍/出处风格名（风格标注，非页码核验） */
const ALLOWED_CITATION_BOOKS = new Set([
  "穷通宝典",
  "三命通会",
  "滴天髓",
  "渊海子平",
  "千里命稿",
  "协纪辨方书",
  "子平真诠",
  "神峰通考",
  "果老星宗",
  "周易",
  "易经",
  "增删卜易",
  "卜筮正宗",
  "渊海",
  "子平",
  "滴天",
  "紫微斗数",
  "三合",
  "飞星",
]);

/** 疑似虚构精确引用：带卷/页/条而无法核验 */
const FAKE_CITATION_PATTERNS: RegExp[] = [
  /《[^》]{1,20}》\s*第\s*\d+\s*[页卷章条回]/,
  /据《[^》]+》\s*p\.?\s*\d+/i,
  /出处：\s*[^（(]{0,20}第\d+页/,
  /见《[^》]+》\s*卷[一二三四五六七八九十百千\d]+第\d+/,
];

export type SafetyViolation =
  | { kind: "absolute_assertion"; match: string }
  | { kind: "fake_citation"; match: string }
  | { kind: "unknown_book"; match: string };

/**
 * 扫描全文；返回首个违规（有则应回落模板）
 */
export function findSafetyViolation(text: string): SafetyViolation | null {
  if (!text.trim()) return null;

  for (const re of ABSOLUTE_ASSERTION_PATTERNS) {
    const m = text.match(re);
    if (m) return { kind: "absolute_assertion", match: m[0] };
  }

  for (const re of FAKE_CITATION_PATTERNS) {
    const m = text.match(re);
    if (m) return { kind: "fake_citation", match: m[0] };
  }

  // 《书名》中未知书名（过严会误伤，仅拦明显胡编长名+「据」）
  const bookRefs = text.matchAll(/据《([^》]{2,24})》/g);
  for (const m of bookRefs) {
    const name = m[1]!;
    const known = [...ALLOWED_CITATION_BOOKS].some(
      (b) => name.includes(b) || b.includes(name),
    );
    if (!known) {
      return { kind: "unknown_book", match: m[0]! };
    }
  }

  return null;
}

export function safetyViolationMessage(v: SafetyViolation): string {
  switch (v.kind) {
    case "absolute_assertion":
      return `模型输出含绝对断言「${v.match}」，已回落规则模板。`;
    case "fake_citation":
      return `模型输出含不可核验精确引用「${v.match}」，已回落规则模板。`;
    case "unknown_book":
      return `模型输出含未授权典籍标注「${v.match}」，已回落规则模板。`;
  }
}
