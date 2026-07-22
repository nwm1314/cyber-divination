/**
 * 六爻 / 周易数据来源说明（T110 + T282）
 * 爻辞为通行本意摘要，中性表述，禁止恐吓式改写。
 */

export const LIUYAO_DATA_SOURCES = {
  /** 卦序与卦名 */
  sequence: "周易·文王卦序（通行本六十四卦）",
  /** 卦辞爻辞 */
  text: "周易卦辞、爻辞通行本意摘要（非原文逐字，供展示与模板引用）",
  /** 经卦结构 */
  trigrams: "周易八卦：乾兑离震巽坎艮坤，阴阳爻自下而上",
  /**
   * 六亲安爻（T153）
   * 京房纳甲地支 + 八宫五行生克定六亲；学习向表驱动 v1
   * 详见 analyze/liuqin.ts 与 docs/research/liuyao-sources.md
   */
  liuqin:
    "京房纳甲六亲：内外卦纳支 → 爻支五行，与宫五行生克定父母/兄弟/子孙/妻财/官鬼",
  /** 八宫世应 */
  bagong:
    "京房八宫：本宫→一世…五世→游魂→归魂；世应口诀表驱动（analyze/palaces.ts）",
  /** 纳甲 */
  najia: "京房纳甲内外卦地支表（TRIGRAM_NAJIA）",
  /** 六神 */
  liushen: "按日干起六神：甲乙青龙…壬癸玄武，初爻起顺排（analyze/liushen.ts）",
  /** 时间起卦 */
  meihuaTime:
    "梅花易数先天数（1乾…8坤）起上下卦与动爻；再入纳甲分析（castingSchool=meihua-time-to-najia）",
  /** 流派标注 */
  school:
    "学习向·表驱动 v1；非单一师承全书；规则 id 可追溯",
  /** 不采用 */
  excluded: "不采用恐吓、诅咒、绝对化断语；不替代专业决策",
  /** 引擎版本标记（与装卦 meta 可对齐） */
  dataVersion: "liuyao-data-1.1.0",
  /** 规则集版本（T282） */
  ruleSetVersion: "liuyao-rules-w26-0.5.0",
} as const;
