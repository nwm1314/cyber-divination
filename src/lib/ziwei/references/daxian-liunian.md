# 大限 · 流年（三合 · T102）

> 权威说明；实现见 `src/lib/ziwei/daxian/**`。**禁止 LLM 补全**。

## 1. 大限

### 1.1 起限岁数（五行局）

| 局 | 起运虚岁（本引擎 `startAge`） |
|----|------------------------------|
| 水二局 | 2 |
| 木三局 | 3 |
| 金四局 | 4 |
| 土五局 | 5 |
| 火六局 | 6 |

- 每限 **10 年**：`endAge = startAge + 9`，下一步 `startAge + 10`。
- 排出 **12 步**（绕十二宫一周）。
- **童限**（起运前）：不单独成步；`currentDaxianIndex = -1` 表示尚未入首限。

### 1.2 顺逆

按**年干阴阳 × 性别**（与八字大运同构）：

| 条件 | 方向 | 宫序 |
|------|------|------|
| 阳干男 / 阴干女 | **顺行** | 命→父母→福德→田宅→官禄→交友→迁移→疾厄→财帛→子女→夫妻→兄弟 |
| 阴干男 / 阳干女 | **逆行** | 命→兄弟→夫妻→子女→财帛→疾厄→迁移→交友→官禄→田宅→福德→父母 |

阳干：甲丙戊庚壬；阴干：乙丁己辛癸。

宫位地支随命盘十二宫；顺/逆对应寅起索引 `+1` / `-1`（见 `palaces.ts` 逆布约定）。

### 1.3 当前大限

- 基准年：`analysisBaseDate` 的公历年；缺省为运行日（单测应传入固定日）。
- 计岁：**严格虚岁** `age = year - birthYear + 1`（T270；`meta.agePolicy = "xusui"`，flag `daxian_age_xusui`）。
- 已故：`alive === false` 且有 `deathYear` 时，有效年 `min(基准年, deathYear)`。
- `currentDaxianIndex`：命中某步则为其 `index`（0..11）；否则 `-1`。

## 2. 流年（简化）

- 取有效年末尾 **3 个公历年**（`effectiveYear-2 .. effectiveYear`）。
- 已故截断：不生成 `year > deathYear` 的条目。
- **太岁入宫（简化）**：流年地支 = 该年农历年支（`lunar-javascript` 年中点取干支）；落在 **宫支 = 年支** 的那一宫。
- `age = year - birthYear + 1`（虚岁，与大限一致）。

## 2.1 运限飞星叠盘（T200 / T201 · v0.6.0+）

| 层 | 规则 | 字段 |
|----|------|------|
| 大限 | 取该限所落宫的 **本命宫干**，按四化表飞出 | `daxian[].stem`、`sihuaOut[]` |
| 流年 | 取该年 **年干** 飞出四化 | `liunian[].stem`、`sihuaOut[]` |
| 流年昌曲 | 年支按流昌流曲公式 → 落宫名 | `liuChangPalace` / `liuQuPalace` |

- **不**写回本命 `star.sihua`（避免污染本命盘）；仅运限层结构。
- 四化表与生年/宫干同源 `SIHUA_BY_YEAR_STEM`。

## 2.2 流月 / 流日（T240 · v0.7.0）

| 层 | 规则 | 字段 |
|----|------|------|
| 流月 | 基准月 ±1；`lunar-javascript` **月干支**；月支落宫；月干飞四化 | `liuyue[]`：`month`、`stem`、`branch`、`palace`、`sihuaOut` |
| 流日 | 基准日 ±1；**日干支**；日支落宫；日干飞四化 | `liuri[]`：`date`、`stem`、`branch`、`palace`、`sihuaOut` |

- 基准日来自 `analysisBaseDate`（`YYYY-MM-DD`）；缺省用运行日。
- 仍 **不**写回本命 `star.sihua`。
- 未做：斗君起月、流月昌曲表、小限。

## 3. Flags

| flag | 含义 |
|------|------|
| `daxian_sanhe_tables` | 本表驱动大限 |
| `daxian_age_xusui` | 计岁严格虚岁（T270） |
| `daxian_age_solar_diff` | （已弃用）旧周岁口径 |
| `liunian_by_year_branch` | 流年按年支落宫 |
| `yun_feixing_overlay` | 大限/流年运限飞星 |
| `liuyue_by_month_gz` | 流月按月干支（T240） |
| `liuri_by_day_gz` | 流日按日干支（T240） |
| `death_year_clamp` | 已按卒年截断 |
| `shichen_multi_candidate` | 未知时辰多盘候选（T270） |

## 4. 来源与局限

- 三合常见口诀：大限起命宫、十年一限、阳男阴女顺、阴男阳女逆、局数起运。
- 已实现严格虚岁（T270）；未做生日换岁/立春换岁细分。
- 未实现：小限、斗君、童限宫位细分、飞星派改安星。
- 表变更需主 Agent 评审并 bump `engineVersion`（当前 **0.8.0**）。
