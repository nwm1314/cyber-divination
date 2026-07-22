# 八字外部金标准与来源（T262）

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

## 4. 敏感性与后续外部集

- 函数：`buildHourSensitivityReport` / `formatHourSensitivityDiff`（`src/lib/bazi/sensitivity.ts`）
- 测试：`src/lib/bazi/sensitivity.test.ts`
- **未完成**：≥1000 例外部门户案例（需标注门户版本、允许差异字段）；本波次以 fixtures 元数据 + 敏感性测试落地

## 5. 规则变更 diff 约定

1. 修改排盘/大运/十神规则后必须跑：`npm test -- src/lib/bazi`
2. golden 失败时：更新 `__fixtures__/index.ts` 期望值，并在本文件或 PR 说明差异原因与 `ruleSetVersion` 变更
3. 禁止在无解释情况下静默改 golden
