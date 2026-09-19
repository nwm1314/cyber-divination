# 起运精确到月：流派声明与差异报告（GAP-2）

> 对应 `docs/GAP_AUDIT_AND_HANDOFF.md` §2.1 GAP-2 / `REVIEW_ENG_ENGINE.md` E-3
> 规程依据：`docs/EXECUTION_GUIDE.md:75-76`、`docs/REVIEW_PROMPTS.md` 全局规则 4
> 「规则变化必须更新 engineVersion / ruleSetVersion，并给出差异报告」

---

## 1. 问题陈述（改动前事实）

`src/lib/bazi/dayun/index.ts` 的起运计算**已经**算出了精确到月的起运量：

- `:84` `const raw = diffDays / 3;` —— 3 天折 1 年
- `:85-86` 拆成 `years`（整岁）+ `months`（余月）

但**正式大运分档只用了整岁**：

- `:100-102` `toRoundedStartAge()` → `Math.round(detail.diffDays / 3)`
- `:226` `const startAge = toRoundedStartAge(startAgeDetail);`
- `:153-159` 每一步的 `startAge / endAge / startYear / endYear` 全部基于该整岁

**后果（可复核）**：交运日 `startAt` 用的是 `years*12 + months` 个自然月
（`:92-94`，精确到月），而同一份 chart 的 `startAge` 却用四舍五入的整岁。
**两者自相矛盾**——这是 bug 的客观证据，不需要流派即可判定。

---

## 2. 流派声明（必须先声明，才能讨论"应该改成什么"）

本引擎既有声明（`src/lib/bazi/policy.ts:9`）：

```
BAZI_SCHOOL = "ziping-default"（子平法·默认口径）
```

### 2.1 起运折算的流派分歧（事实陈述，非评价）

起运（交运年龄）的换算，传统上有两套主流口径：

| 口径 | 折算规则 | 常见表述 |
|---|---|---|
| **A. 三天一岁·精确到月** | 3 天 = 1 年，1 天 = 4 个月，1 时辰 ≈ 10 天；余数保留为**月**，不四舍五入 | 「三日为一岁，一日为四月」——《三命通会》《渊海子平》系 |
| **B. 三天一岁·取整岁** | 同上折算，但**只取整岁**，余月不进位、不展示 | 部分现代排盘软件的默认显示（简化呈现） |

**本引擎选择口径 A**，理由：

1. **与本引擎已有输出自洽**——`startAgeDetail`、`startAt`、证据链
   （`bazi/index.ts:498-502` 输出 `交运日 ${startAt}`）本就按精确月计算。
   继续用整岁分档会让同一份 chart 内部互相矛盾。
2. **口径 A 信息量严格优于 B**——A 可以退化为 B（展示时取整即可），
   反之不成立。数据层保留精度、展示层决定粒度，是更稳的分层。
3. **不做无依据的"改进"**：本改动**只消除内部矛盾**，不引入新的
   折算常数、不改 3 天=1 年这一核心比例、不改顺逆判定。
   凡超出此范围（如按时辰精确折算、引入真太阳时修正起运）一律不做。

### 2.2 明确的非目标（防止范围蔓延）

- ❌ 不改 `diffDays / 3` 这一核心折算比例
- ❌ 不改大运顺逆（阳男阴女顺行）判定
- ❌ 不改月柱推导、不改节气数据源
- ❌ 不引入「起运按虚岁」等其他流派口径
- ❌ 不改 `endAge` 的 10 年跨度定义

---

## 3. 改动方案

### 3.1 数据层（保留精度）

`DayunStep` 增加**月级**字段，与既有整岁字段并存：

```ts
startAge: number;          // 整岁部分（保持向后兼容的展示语义）
startAgeMonths?: number;   // 该步起运的余月（0-11）
```

- 第 0 步正式大运：`startAgeMonths = startAgeDetail.months`
- 后续步骤：起运时刻整体后移 10 年，余月**继承首步**（因为 10 年为整周期）

同时新增基于**总月数**的判定，供 `currentDayunIndex` 使用：

```
startTotalMonths(i) = startAge*12 + startAgeMonths + i*120
```

### 3.2 判定层（消除矛盾）

`currentDayunIndex` 改为按**实际年龄的月数**比较，而非整岁：

```
ageMonths = (currentDate - birthDate) 的完整月数
命中条件： startTotalMonths(i) <= ageMonths < startTotalMonths(i+1)
```

这样 `currentDayunIndex` 与 `startAt`（交运日）在**同一天**切换，
不再出现「交运日已到、但索引仍停在上一运」的错位。

### 3.3 兼容性

- `startAge / endAge / startYear / endYear` 字段**保留且语义不变**
  （整岁展示），因此 `DayunTimeline.tsx`、`analyze.ts:727-733`、
  `plain-copy.ts` 等展示层**无需改动**，不会发生视觉回归。
- `startAt` 语义不变。
- 新增字段为 optional，旧缓存数据仍可解析（`startAgeMonths` 缺省按 0 处理）。

---

## 4. 差异报告（改动前 → 改动后）

以测试中现有用例为样本（均为**引擎回归**样本，非外部权威）：

| 用例 | 改动前 startAge | 改动后 startAge | startAgeMonths | currentDayunIndex（2026） |
|---|---|---|---|---|
| 庚午男 1990-05-15 10:30 | 7 | 7 | 见 §5 实测 | 见 §5 实测 |
| 庚午女 1990-05-15 10:30 | 3 | 3 | 见 §5 实测 | 见 §5 实测 |
| 乙丑男 1985-03-20 06:00 | 5 | 5 | 见 §5 实测 | 见 §5 实测 |
| 丙子男 1996-12-25 08:00 | 4 | 4 | 见 §5 实测 | 见 §5 实测 |

> 上表 `startAge` 数值预期**不变**——这正是本改动的关键性质：
> 改动**只影响边界附近的行为**（余月 ≥ 6 个月导致 round 进位错位的情形），
> 不推翻既有整岁结果。真实实测值见 §5，由 `dayun-start-precision.test.ts` 固化。

### 4.1 行为差异的可观察点

| 场景 | 改动前 | 改动后 |
|---|---|---|
| 余月 = 5 个月，当年为交运年 | 整岁 round 可能**提前**命中新运 | 按实际月数，交运日**当天**才切换 |
| 余月 = 7 个月 | round 进位，startAge 多 1 岁 | startAge 由精确月数推导，不多算 |
| `startAt`（交运日） | 已精确到月 | **不变** |
| 展示文案 | 整岁区间 | **不变**（不引入视觉回归） |

**诚实说明**：由于 `startAge` 字段本身仍以整岁对外展示，
本改动对**纯展示**的影响很小；真正的收益是
①消除 `startAge` 与 `startAt` 的内部矛盾，②让 `currentDayunIndex`
在交运年边界附近与实际交运日一致。

---

## 5. 验证方法与实测结果

### 5.1 需要固化的测试

1. `startAge` 与 `startAgeDetail` 自洽：`startAge*12 + startAgeMonths`
   应等于 `round(diffDays/3*12)`（月级四舍五入），而非 `round(diffDays/3)*12`
2. `startAt` 与 `startAgeMonths` 自洽：`startAt` = 出生日 + 总月数
3. 边界：余月 ≥ 6 时，改动前后 `startAge` 差异必须被显式断言
4. `currentDayunIndex` 在交运日前后一天正确切换
5. 既有 `dayun.test.ts:14-23` 的整岁期望**必须先改断言**
   （该测试当前把"整岁起点"写成了期望值，即缺陷被测试固化）

### 5.2 实测结果

见 `src/lib/bazi/dayun/dayun-start-precision.test.ts` 与
`docs/FIX_REPORT_ROUND2.md` 的实测输出。

### 5.3 未验证项（如实标注）

- 本改动的**流派归属**为项目既有 `ziping-default` 声明下的工程自洽性修复，
  **未经外部命理师审校**。按 `REVIEW_PROMPTS.md` 验收标准，
  本项属于「在声明流派前提下自洽、可复核」，
  但**不声称**它是某部典籍逐字规定的唯一算法。
- 3 天 = 1 年的比例本身**未做外部验证**，沿用既有实现。
- 余月进位到整岁的**展示取舍**属产品决策，非本改动范围。

### 5.4 附带发现：参考文档自身矛盾（已一并更正）

`src/lib/bazi/references/dayun-rules.md` 此前**内部自相矛盾**：

- §57-60 列出月级折算（「余 1 天：约 4 个月起运」）
- §62 紧接着写「四舍五入到最接近的整数岁数」

两者不可能同时成立。该文档已修订为以月级折算为准，并说明
整岁仅作展示取整、以及不一致时的具体后果。
（同步至 `.claude/skills/` 与 `.agents/skills/`，经 `npm run sync:skill` 校验哈希一致。）

> 这也印证了 GAP-2 的判断：该缺陷不是"某处写错一行"，
> 而是**实现与文档各自内部就不自洽**，因此必须连同断言与文档一起修。

---

## 6. 版本影响

| 项 | 改动前 | 改动后 | 理由 |
|---|---|---|---|
| `BAZI_ENGINE_VERSION` | 0.3.0 | **0.4.0** | 起运分档行为变化 |
| `BAZI_RULE_SET_VERSION` | 2026.07-w24 | **2026.07-w25** | 规则集变更 |
| `BAZI_SCHEMA_VERSION` | 1.1.0 | **1.2.0** | `DayunStep` 增加字段 |

因为规则变化，`inputFingerprint` 不含版本号（只含输入），
**旧 chart 的指纹不会变化**——这是刻意设计：指纹用于验证"输入相同"，
版本差异通过 `meta.engineVersion` 对照，两者职责分离。
