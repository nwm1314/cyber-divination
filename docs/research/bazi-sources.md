# 八字金标准与来源（T262 / TASK-004）

## 1. 引擎与流派元数据

| 字段 | 当前值 | 说明 |
|------|--------|------|
| schemaVersion | `1.1.0` | `BaziChart` 结构版本 |
| engineVersion | `0.3.0` | 计算引擎版本（`src/lib/bazi`） |
| ruleSetVersion | `2026.07-w24` | 规则集标签 |
| school | `ziping-default` | 默认子平向简化流派 |

历法策略（`calendarPolicy`）：

- **夜子时** `next_day`：23:00 后日柱取次日（lunar-javascript `setSect(1)`）
- **节气** `lichun_year_jie_month`：立春分年、十二节分月
- **时区** `asia_shanghai_wall_clock`：默认东八区墙钟；真太阳时 = 经度偏移 + 均时差
- **历史夏令时** `historicalDst: false`：不回溯，输出 `dst_not_modeled` warning
- **未知时辰** `six_pillars_plus_sensitivity`：六字盘 + 十二候选报告

## 2. 内部 Golden Fixtures

路径：`src/lib/bazi/__fixtures__/`

| ID | 标签 | 覆盖点 | 来源性质 |
|----|------|--------|----------|
| golden-L01 | 立春前 | 年柱己巳 | 引擎自洽 + 立春交节 |
| golden-L02 | 立春后 | 年柱庚午 | 同上 |
| golden-L03 | 夜子时 | night_zi | 策略固定 |
| golden-L04 | 未知时辰 | 六字盘 | 策略固定 |
| golden-L05 | 节气交界 | jieqi_boundary | 边界 12h |
| golden-L06/L07 | 阴阳男女顺逆 | 大运方向 | dayun-rules |
| golden-L08 | 已故截断 | liunian | 产品规则 |
| golden-L09 | 真太阳时 | 时柱变化 | 经度校正 |

**说明**：当前 golden 为 **引擎回归金标准**（规则变化可 diff），并非 1000 例外部门户对照集。外部扩容见 §4。

## 3. 经典与表源（规则层引用）

- `src/lib/bazi/references/dayun-rules.md` — 起运、顺逆
- `src/lib/bazi/references/wuxing-tables.md` — 五行/藏干
- `src/lib/bazi/references/shichen-table.md` — 时辰
- `src/lib/bazi/references/classical-texts.md` — 典籍风格索引

用神分层证据 `RuleEvidence.ruleId` 前缀：

- `calendar.*` / `dayun.*` — 事实层
- `strength.*` / `yongshen.*` — 规则层
- `wuxing.visual_weights.v1` — 可视化分数免责

## 4. 敏感性与外部验证边界

- 函数：`buildHourSensitivityReport` / `formatHourSensitivityDiff`（`src/lib/bazi/sensitivity.ts`）
- 测试：`src/lib/bazi/sensitivity.test.ts`
- 当前 9 条 `goldenCases` 均为 `engine-regression`，不是外部样本；数量不能计入独立验证。
- **未完成**：≥1000 例外部门户案例。当前仓库没有该 corpus、门户版本、原始许可或允许差异清单，因此不得填写数量或把内部 case 改标为 `external`。
- Bazi 独立 oracle gate：**未建立**。TASK-004 本波次只建立 Ziwei 的 iztro gate；Bazi 必须在获得可审计 corpus 后另行增加 gate。

## 5. 来源与许可证审计（TASK-004）

| 来源 | 当前状态 | 许可证/可审计边界 |
|------|----------|------------------|
| `jinchenma94/bazi-skill` | 本地 `.claude/skills/bazi/`；`src/lib/bazi/references/` 由 `scripts/sync-bazi-skill.mjs` 只读同步 | 本地 `LICENSE` 为 MIT，版权 `Copyright (c) 2025 jinchenma94`；同步内容不是外部排盘 oracle，远端分支/提交未锁定 |
| 《穷通宝典》等九种典籍摘要 | 本地 skill/reference 的规则摘要 | 典籍原作与现代整理本的版本、版权和许可不等同；本项目只保留规则摘要，不把摘要当作可复现的外部样本集 |
| 外部门户案例（计划 ≥1000） | 未获取 | 没有来源 URL、导出版本、授权条款、样本哈希或允许差异，当前不得纳入门禁 |

`bazi-skill` 的 MIT 文本在 `.claude/skills/bazi/LICENSE`、`.agents/skills/bazi/LICENSE` 和
`THIRD_PARTY_NOTICES.md` 保留。任何未来外部 corpus 必须同时记录来源、版本/提交、学校、字段 schema、许可证/授权、样本计数和哈希；未满足前只能声明“内部回归”。

## 6. 规则变更 diff 约定

1. 修改排盘/大运/十神规则后必须跑：`npm test -- src/lib/bazi`
2. golden 失败时：更新 `__fixtures__/index.ts` 期望值，并在本文件或 PR 说明差异原因与 `ruleSetVersion` 变更
3. 禁止在无解释情况下静默改 golden
