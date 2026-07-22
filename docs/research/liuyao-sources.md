# 六爻引擎与解卦资料调研备忘（T151 → W26 T282）

> 初版：2026-07-21（T151）  
> 更新：2026-07-22（W26 · T280–T282）  
> 范围：装卦方法标识、世应、用神、六神/伏神/月破、动变、外部金标准  
> **约束：** 学习向·表驱动；规则 id 可追溯；禁止恐吓断语。

---

## 1. 本项目现状（W26 后）

| 能力 | 状态 | 路径/说明 |
|------|------|-----------|
| 装卦（铜钱/时间/手动） | 已实现 + **流派标识** | `cast/**`；`castingSchool` |
| 三钱纳甲 | `najia-coins` | 种子/复盘 `replaySeed` |
| 手工纳甲 | `najia-manual` | 同纳甲规则层 |
| 梅花时间→纳甲（混合） | `meihua-time-to-najia` | **不可伪装纯纳甲**；见 `cast/time.ts` + `cast/method.ts` |
| 六十四卦名/结构 | 已实现 | `data/hexagrams.ts`、`trigrams.ts` |
| 世应 / 八宫 | 已实现 + 穷举测 | `analyze/palaces.ts`、`shi-ying.ts`；`__fixtures__/palace-exhaustive.test.ts` |
| 六亲 / 纳甲 | 已实现 | `analyze/liuqin.ts` |
| 用神 | 关键词 + **问事类别** + **用户确认** | `analyze/yongshen.ts` |
| 六神 | 按日干起 | `analyze/liushen.ts` |
| 月破 / 日冲 | 有占时写入爻标志 | `analyze/yuepo.ts` |
| 伏神 | 本宫对照务实版 | `analyze/fushen.ts` |
| 动变 / 回头生克 | 五行关系 + `huitou` | `analyze/dongbian.ts` |
| 应期 / 旬空 | T180 | `analyze/yingqi.ts`、`kongwang.ts` |
| 金标准 fixture | 含来源元数据 | `__fixtures__/golden-cases.ts` → `LIUYAO_GOLDEN_META` |
| 数据版本 | `liuyao-data-1.1.0` | `data/sources.ts` |
| 规则集版本 | `liuyao-rules-w26-0.5.0` | 同上 |
| 引擎版本 | `0.5.0` | `cast/build.ts` |

---

## 2. 起卦方法分离（T280 · 验收要点）

| method | castingSchool | 随机 | 说明 |
|--------|---------------|------|------|
| `coins` | `najia-coins` | seeded / fresh | 三钱 → 纳甲 |
| `manual` | `najia-manual` | none | 指定六爻 → 纳甲 |
| `time` | `meihua-time-to-najia` | none | 梅花先天数起卦 **再** 入纳甲分析 |

meta 字段：`engineVersion`、`castingSchool`、`randomSource`、`timezone`、`replaySeed`、`methodNote`、`dataVersion`。

UI：`CastForm` 明确三种方法说明；时间法展示混合标识。

---

## 3. 用神 / 六神 / 动变（T281 · 务实范围）

**已落地：**

- 六神（日干起，初爻顺排）
- 月破 / 日冲（爻级 boolean）
- 回头生克（`huitou`: 回头生|回头克|无）
- 伏神（用神不现时本宫对照，结构允许则挂爻）
- 问事类别 `questionCategory` + `yongShenConfirm`

**未完整（后续波次）：**

- 旺相休囚完整表、墓绝、三合、进退神、反伏吟全量状态机
- 暗动、飞神细断文案引擎
- 多流派可切换规则包

---

## 4. 外部金标准（T282）

| 项 | 做法 |
|----|------|
| fixture 元数据 | `LIUYAO_GOLDEN_META`：source / school / dataVersion / ruleSetVersion / references |
| 八宫/世应 | 64 卦穷举：`palace-exhaustive.test.ts` |
| 纳甲六亲 | 64 卦 `assignLiuqin` 确定性 |
| 规则 diff | 改 `PALACE_*` / `TRIGRAM_NAJIA` / `YONGSHEN_RULES` 时由单测 id 定位 |

**非目标：** 逐盘对齐某一商业 App 断语；外部闭源库不作为运行时依赖。

---

## 5. 候选开源 / 资料源（沿用 T151）

| 源 | 契合度 | 备注 |
|----|--------|------|
| 京房八宫 / 纳甲通行表 | 高 | 已表驱动 |
| 《增删卜易》《卜筮正宗》整理 | 高（方法论） | 细断分阶段 |
| GitHub iching/liuyao 教学项目 | 中 | 仅对照，不直接依赖 |
| 本仓 `hexagrams` 文王序 | 已用 | |

---

## 6. 用神规则表（摘要）

| id / category | 关键词向 | 默认用神 |
|---------------|----------|----------|
| wealth | 财/投资… | 妻财 |
| career | 官/职/考… | 官鬼 |
| lawsuit | 讼/官司… | 官鬼 |
| marriage | 婚恋… | 妻财（女命可官鬼） |
| health | 病/医… | 官鬼 |
| travel | 出行… | 父母 |
| parents | 父母/文书/房… | 父母 |
| offspring | 子女/孕… | 子孙 |
| siblings | 兄弟/合伙… | 兄弟 |
| confirm | 用户确认 | 任意六亲/世 |
| default | 未命中 | 世 |

优先级：`yongShenConfirm` > `questionCategory` > 关键词 > 世。

---

## 7. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 时间法被当成纯纳甲 | `castingSchool` + UI 文案强制混合标识 |
| 流派差异 | 文档标学习向 v1；ruleSetVersion 可追溯 |
| 恐吓断语 | 中性模板 + QA 禁词 |
| 伏神/细断过度简化 | 标明务实版；证据层后续 T290 |

---

## 8. 本仓锚点

- 类型：`src/lib/types/liuyao.ts`
- 装卦：`src/lib/liuyao/cast/**`
- 分析：`src/lib/liuyao/analyze/**`
- 金标准：`src/lib/liuyao/__fixtures__/**`
- 数据来源：`src/lib/liuyao/data/sources.ts`
- 任务：`docs/REMEDIATION_TASKS.md` W26 T280–T282

*文档版本：W26 · 2026-07-22*
