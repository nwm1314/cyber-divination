# 三术数计算引擎技术审校报告（只读审查）

> 审查范围：`src/lib/bazi/`、`src/lib/ziwei/`、`src/lib/liuyao/`、`src/lib/types/`、`src/lib/reading/template/`
> 审查基准：`docs/PROJECT_REVIEW.md` §2.2 / §2.3 / §2.4 原始缺陷清单
> 审查方式：只读（未修改任何文件，未执行 npm install）
> 审查日期：2026-08（以仓库当前工作区状态为准）
> 验证环境：实测 `npx vitest run src/lib/bazi src/lib/ziwei src/lib/liuyao` → **35 files / 297 tests 全通过**；实测 `node scripts/compare-iztro.mjs` → **exit 0，status: passed**

---

## 0. 审查原则与判定口径

本报告严格区分三层：

1. **事实层**（历法/干支/星曜/爻位）：必须与权威来源一致，可逐位复核。
2. **规则层**（旺衰/格局/四化/用神/动变）：必须在**明确声明的流派**下自洽，并且该流派声明要在产物里可见。
3. **叙事层**（模板/LLM 文案）：不得回写前两层。

**判定标准（本轮核心）**：不是"算对了"，而是"**在声明了流派的前提下自洽、可复核、有外部来源**"。
凡本报告给出"规则应改为 X"之处，均注明流派归属与仓库内来源；**凡无法核验典籍依据之处，一律标注"无法确认"，不臆断**。

**判定标签**：`已修复` / `仍存在` / `部分修复` / `无法确认`。

---

## A. 八字引擎（`src/lib/bazi/`）

### A.1 节气交接时刻用哪套数据？精度到分还是到日？

**结论**：`已修复`（精度到秒，且上游库为分/秒级）。

**证据**：
- `src/lib/bazi/calendar/solar.ts:44-53`：`Solar.fromYmdHms(...)` → `solar.getLunar().getEightChar()`，四柱（含月柱分界）全部由 `lunar-javascript` 计算，未自行实现节气表。
- `src/lib/bazi/dayun/index.ts:62-77`：起运取节时显式读取秒：`js.getSecond()`，并组装 `Date.UTC(y, m-1, d, h, min, sec)`。
- `src/lib/bazi/boundary/index.ts:60-70`：交界判定同样读取 `getSecond()`。

**说明**：节气时刻由 `lunar-javascript@1.7.7`（实测 `node_modules` 内版本号确为 `1.7.7`）提供，精度为**分钟/秒级**，非"到日"。本引擎未内嵌独立天文算法，属**依赖上游**，故其精度上限 = 上游库精度。

| 项目 | 值 | 证据 |
|---|---|---|
| 节气数据来源 | `lunar-javascript@1.7.7` | `package.json:27`；实测安装版本 1.7.7 |
| 分界精度 | 秒级调用，上游为分/秒级 | `dayun/index.ts:68-77`、`boundary/index.ts:61-70` |
| 年柱分界 | 立春（`JieqiPolicy = "lichun_year_jie_month"`） | `policy.ts:15, 34` |
| 月柱分界 | 十二节 | 同上 |

**流派归属**：`ziping-default`（`policy.ts:9`、`BAZI_SCHOOL`），年立春分年、月节气分月为子平通行口径。

**优先级**：P3（无缺陷，仅记录依赖边界）。

---

### A.2 `boundary/boundary.test.ts` 覆盖了哪些临界点？未覆盖的边界

**结论**：`部分修复` —— 覆盖了 5 类，但**关键流派分歧点与历史 DST 边界仍未被测试覆盖**。

**已覆盖**（`src/lib/bazi/boundary/boundary.test.ts`）：

| 测试 | 行号 | 覆盖内容 |
|---|---|---|
| 拒绝非法日期 | `:23-27` | `2023-02-30` / `2023-13-01` / 非日期串 |
| 接受闰年 2/29 | `:29-35` | `2000-02-29` |
| 23 点子时 → `night_zi` | `:37-44` | `23:30` 标志 + 时支为「子」 |
| 节气交界 flag | `:46-53` | `1990-05-05 20:00` → `jieqi_boundary` |
| 立春前后 1 分钟四柱切换 | `:55-76` | `1990-02-04 10:00`（己巳）vs `10:15`（庚午） |
| 未知时辰 → 六字 + warnings | `:78-85` | `shichen_unknown`、`pillars.hour === null` |
| 大运 `startAt` 存在 | `:87-92` | `YYYY-MM-DD` 正则 |
| meta 含 schema/ruleSet/school | `:94-100` | `school === "ziping-default"`、`calendarPolicy.nightZi === "next_day"` |

**主动发现的未覆盖边界（缺口）**：

| # | 未覆盖边界 | 为什么重要 | 现状 |
|---|---|---|---|
| G1 | **`23:00–24:00` 夜子时的"早子时/晚子时"流派分歧未做双解验证** | 引擎**单方面**选定 `setSect(1)`（日柱取次日，`solar.ts:53`），但没有测试断言"另一流派（sect=0，日柱不换）会得到什么"，也没有在产物中并列两解。分歧只被记录成一句 warning（`index.ts:370`） | **仍存在（部分）** |
| G2 | **`1966–1978` 中国行政时区/夏令时、`1949` 前时区未覆盖** | `solar-time/` 只做经度+均时差 | **仍存在** |
| G3 | **1900/2100 边界年份** | `parseSolarDate` 显式拒绝 `<1900` 与 `>2100`（`solar.ts:91-93`），但**没有测试**断言 1900-01-01 与 2100-12-31 的排盘结果，也未断言边界外抛错 | **仍存在** |
| G4 | **闰月出生（农历）→ 排盘** | `lunar.test.ts` 仅 2 个用例 | **仍存在** |
| G5 | **节气当天 0 点前后 / 交节时刻前后 1 秒** | `boundary.test.ts:46-53` 只测了"距交节 6.5h"的 flag，**没有测交节时刻两侧 1 分钟内的月柱是否真的切换**（立春有测，其他 11 节无测） | **仍存在** |

**验证方法建议**：见文末《应补充的金标准测试清单》B-01…B-06。

---

### A.3 真太阳时是否完整建模经度 / 历史夏令时 / 行政时区？

**结论**：`部分修复` —— 经度+均时差**已完整建模（含跨日）**；**历史 DST 明确未建模，但已显式声明并告警**。

**证据**：
- 经度偏移 + 均时差：`src/lib/bazi/solar-time/index.ts:64-67`
  ```
  const lngOffset = (lng - 120) * 4;   // 以东经 120° 为基准
  const eot = equationOfTime(doy);      // 均时差
  ```
- **跨日处理已实现**：`solar-time/index.ts:69-104`（`dayDelta` ±1，返回校正后日期，注释明确 `@deprecated` 旧接口 `:107-110`）。
- **历史 DST 显式不建模并声明**：
  - `policy.ts:17-18`：`TimezonePolicy = "asia_shanghai_wall_clock"`，注释「真太阳时仅做经度+均时差，不回溯历史夏令时」。
  - `policy.ts:28-30, 37`：`historicalDst: false`。
  - `index.ts:233-235`：开启真太阳时即 push `FLAG_DST_NOT_MODELED` + warning「真太阳时未回溯历史夏令时与行政时区变更」。
  - 常量 `FLAG_DST_NOT_MODELED` 经 `index.ts:24` 导入。

**判定细节**：原缺陷描述"未完整建模出生地时区、历史夏令时和行政时间变化"。当前状态是：
- 时区：**未建模**（硬编码东八区墙钟），但**显式声明**；
- 历史 DST（1986–1991 中国 DST）：**未建模**，但**显式声明 + 告警 flag**；
- 行政时间变化：**未建模**，但**显式声明**。

> **这是一个关键的判定分歧点**：从"功能完整性"看是**仍存在**；从"是否诚实声明"看是**已修复（以政策性声明替代实现）**。本报告判定为 **`部分修复`**：系统不再**静默**给出错误真太阳时，而是**带 flag 与 warning 交付**。但注意——**flag 只在 `useTrueSolarTime=true` 且提供了经度时才 push**（`index.ts:212-235`），若用户在 1986–1991 出生但**未开启真太阳时**，则不会看到任何 DST 提示。

**`boundary/dst-scope.test.ts` 覆盖范围**：**极窄，仅 1 个用例**（`dst-scope.test.ts:6-23`）：
- 只测了 `1990-05-15 10:30` + 北京经度 + `useTrueSolarTime: true` 这一种组合；
- 只断言 `flags` 含 `dst_not_modeled` 且 warning 含"夏令时"；
- **没有**断言 DST 实际生效期间（如 1986-05-04 至 1991-09-15）的**时间应如何偏移**，也**没有**断言未开启真太阳时（`useTrueSolarTime: false`）时是否应仍提示 DST。

**流派归属**：`asia_shanghai_wall_clock`（`policy.ts:18`）。真太阳时校正（经度+均时差）为术数界通行做法；是否回溯历史 DST 属**工程口径选择**，非流派争论。

**优先级**：**P1**（1986–1991 出生人口基数大，且 23:00–01:00 出生者时柱可能整体错位）。

**验证方法**：
- 断言 `1988-06-15 23:30` + 上海经度 + 真太阳时 → 应产出明确 warning 说明"该时刻处于中国夏令时期间，未做 -1h 回溯"，并给出**若回溯后的时柱**作为对照候选。
- 断言 `useTrueSolarTime: false` 且出生年 ∈ [1986,1991] → 也应产出 DST 提示（当前不会）。

---

### A.4 四柱推算与五虎遁/五鼠遁是否一致？

**结论**：`已修复`。

**证据**：
- 四柱整体来自 `getEightChar()`（`solar.ts:52`），即五虎遁（年干→月干）、五鼠遁（日干→时干）由上游库保证。
- 仓库**另存一份**五鼠遁实现用于独立校验与 UI：`calendar/shichen.ts` 导出 `WUSHU_ZI_STEM` / `hourStemFromDayStem` / `branchFromHour`（经 `index.ts:69-71` 再导出）。
- 测试：`buildPillars.test.ts`（8 tests）+ `computeChart.test.ts`（7 tests）+ golden 9 例，均对四柱逐柱断言。

**风险（低）**：存在**双实现**（上游 `getEightChar` 与本仓 `shichen.ts`）。若二者口径漂移（尤其夜子时），将出现"UI 显示与实际排盘不一致"。建议补一条**交叉一致性测试**：对 60 日干 × 12 时辰穷举，断言 `hourStemFromDayStem` 与 `getEightChar().getTimeGan()` 完全一致。

**优先级**：P2（建议补交叉一致性测试）。

---

### A.5 起运是否已改为精确到月？—— 原缺陷核实

**原缺陷**：「起运虽保存年/月细节，但正式大运仍按整岁和整数年份判断。」

**结论**：`部分修复`（**关键部分仍存在**）。

**已修复的部分**：
- 起运细节计算到**天**并折算为年+月：`dayun/index.ts:79-96`
  ```
  diffDays = |节时刻 - 出生时刻| / 86400000     // 精确到毫秒差
  raw = diffDays / 3                            // 3天=1年
  years = Math.floor(raw + 1e-9)
  months = Math.round((raw - years) * 12)       // 余数→月
  ```
- **交运日（`startAt`）已精确到日**：`dayun/index.ts:92-94`（`出生日 + years*12 + months 个月`），并写入 `StartAgeDetail.startAt`。
- 大运步的 `startAt` 逐级 +10 年推算：`dayun/index.ts:165-171`。

**仍存在的部分（核心缺陷未闭合）**：
1. **正式大运仍按整岁分档**：`dayun/index.ts:226` `const startAge = toRoundedStartAge(startAgeDetail)`，而 `toRoundedStartAge`（`:99-102`）= `Math.round(diffDays / 3)` —— 这正是原缺陷描述的"整岁"。
2. **步长仍为整 10 年**：`dayun/index.ts:152-164`，`stepStart = startAge + i*10`，`endAge = stepStart + 9`。
3. **`startAgeMonths` 只挂在第 0 步**：`dayun/index.ts:162` `startAgeMonths: i === 0 ? startAgeMonths : 0`。
4. **`currentDayunIndex` 判定仍用整岁**：`dayun/index.ts:236-247`，`currentAge = effectiveYear - birthYear`（**周岁、整年**），再与 `step.startAge/endAge`（整岁）比较。**既未用虚岁，也未用交运日**。
5. **`DayunStep.startYear/endYear` 仍用 `birthYear + startAge`**：`dayun/index.ts:160-161`，未用 `startAt` 的真实年份。

> **实测补充（已消解一个疑虑）**：对 `1990-05-15 10:30 男` 实测得
> `startAgeDetail = {"years":7,"months":3,"diffDays":21.8446...,"startAt":"1997-08-15"}`，
> `dayun[0] = {"startAge":7,"endAge":16,"startYear":1997,"endYear":2006,"startAgeMonths":3,"startAt":"1997-08-15"}`。
> 本例 **`startAt` 年份与 `startYear` 一致（MATCH0/MATCH1 均为 true）**，原因是 `diffDays=21.84` → `raw=7.28` → `years=7, months=3`，`years` 恰为 7 且 `months=3` 不足以跨年。
> **故"startAt 与 startYear 相矛盾"并非必然发生，而是取决于余数**：当 `months` 使 `addMonthsUtc` 跨过日历年边界时（例如 `years=7, months=11` 且生日在 12 月），`startAt` 会落到 `startYear+1`，二者即不一致。因此该风险应表述为**"边界条件下可能不一致"**，而非已确认缺陷。相应测试（B-09）应**构造 `months` 接近 11–12 且生日靠年末的用例**才能暴露。

**`dayun.test.ts` 的断言实际验证了什么**（这是关键）：`dayun/dayun.test.ts:20-23`
```
expect(f[0].startAge).toBe(7);
expect(f[0].endAge).toBe(16);
expect(f[0].startYear).toBe(1997);
```
→ **测试把"整岁起点"固化成了金标准**。`:29` 只断言 `years + months/12 > 0`，是**极弱断言**，未校验 `months` 的具体值是否正确。

> 结论：`startAgeDetail`（精确到月/日）**被计算出来了，但没有驱动正式大运分档** —— 即原缺陷「起运虽保存年/月细节，但正式大运仍按整岁和整数年份判断」**仍然成立**。`startAt` 是唯一的精确产物，且它只作为展示字段。

**流派归属**：子平通行法「三日折一年、一日折四月」—— `dayun/index.ts:47-49` 注释自述「skill：整岁 = round(天/3)；余 1 天≈4 月、余 2 天≈8 月」。**该口径与"余数折月"自相矛盾**：若余数折月，则不应同时 `round` 到整岁。

**影响（排错盘/解读偏差）**：
- `currentDayunIndex` 在**交运日附近**可能错 1 步（尤其 `months` 接近 6~11 时，`round` 与 `floor` 相差一年）→ **解读会引用错误的大运干支**（事实层被污染）。
- `startYear/endYear` 与 `startAt` **可能不一致**：例如 `startAt = 1997-09-20` 但 `startYear = 1997`（若 `startAge` 由 `round` 得 7 而真实为 6 年 11 月，则 `startYear=1996` 与 `startAt=1997` 冲突）。这是**同一对象内自相矛盾**，属自洽性缺陷。

**优先级**：**P1**（这是原始缺陷清单中唯一"明确点名且可机器判定"的规则层缺陷，当前未闭合）。

**验证方法**：
- 构造 `diffDays = 2.9`（`raw = 0.9667` → `years=0, months=12→ 进位为 1年0月`）与 `diffDays = 3.1`（`raw=1.0333` → `years=1, months=0`）的临界用例。
- 断言 `startAt` 与 `startYear` 的年份一致：`Number(startAt.slice(0,4)) === startYear`（**该断言当前很可能失败**）。
- 断言 `currentDayunIndex` 在 `baseDate = startAt` 当天应指向 `index+1`（已交运）而非 `index`。

---

### A.6 大运顺逆（阳男阴女顺行）判断是否正确？

**结论**：`已修复`，**与通行口诀一致**。

**证据**：
- `src/lib/bazi/dayun/index.ts:12-24`：
  ```
  const YANG_STEMS = new Set(["甲","丙","戊","庚","壬"]);   // :12
  if ((yang && gender === "male") || (!yang && gender === "female")) return "forward";  // :20-22
  ```
- 即「阳年男 / 阴年女 → 顺行；阴年男 / 阳年女 → 逆行」，**与子平通行口诀一致**。
- 判据取**年干**（`computeDayun` 形参 `yearStem`，`dayun/index.ts:205`；调用处 `index.ts:264` 传 `pillarsResult.year.stem`）—— **正确**（顺逆看年干阴阳，非日干）。
- 测试覆盖：`dayun.test.ts:14-41`（庚午男 forward / 庚午女 reverse）、`:43-50`（乙丑男 reverse）、`:52-57`（癸卯女 forward）、`:59-67`（丙子男 forward）。golden 里 L01 阴男 reverse、L02 阳男 forward、L06 阴男 reverse、L07 阴女 forward。**四象限齐备**。

**流派归属**：子平通行（阳男阴女顺行）。

**优先级**：P3（无缺陷）。

---

### A.7 原缺陷：`tenGods` 以天干字符为键、同干重复被合并 —— 核实是否已修复

**结论**：`已修复`（**核心路径已修复，但叙事层仍残留旧字段消费**）。

**原缺陷**：旺衰分析使用以天干字符为键的 `tenGods` 统计力量，相同天干重复出现时会被合并。

**修复证据**：
1. **新增按柱位结构**：`src/lib/types/index.ts:259-263` 定义 `tenGodsByPosition?: TenGodByPosition[]`，注释明确「旺衰计数请用 `tenGodsByPosition`」。
2. **生成侧**：`src/lib/bazi/index.ts:286-295` 按 year/month/day/hour **四个柱位**生成（不再按干去重）。
3. **旺衰计数改用柱位**：`src/lib/bazi/yongshen.ts:102-121`
   ```
   export function countTenGodsByPosition(chart) {
     const positions = chart.tenGodsByPosition;
     if (positions && positions.length > 0) { ... 逐柱位统计 support/drain ... }
     // 回退：按 pillars 柱位，避免 Record 合并   // :122
   ```
   注释 `:100` 明写「T261：修复同干合并导致 support/drain 失真」。
4. **旧字段降级为兼容**：`index.ts:297-301` 注释「兼容旧 UI：同干合并表」，且 `countTenGodsByPosition` 的回退路径**也优先走 pillars 柱位**（`yongshen.ts:122-137`）而非 Record。
5. **模板层同步**：`src/lib/reading/template/analyze.ts:107-120` 同样优先用 `byPos`；注释 `:97`「T261：禁止仅用 tenGods Record 合并」；回退路径优先 pillars（`:122-137`）。
6. **测试**：`yongshen.test.ts:23-24` 断言 `tenGodsByPosition.length === 4`；`:70` 未知时辰断言 `length === 3`；`:112` 显式构造 `Object.keys(chart.tenGods).length === 1` 的场景。

**残留（低危，叙事层）**：`analyze.ts` 仍有若干处读旧 `chart.tenGods`：
- `:139`（回退分支，仅在无 `byPos` 且无 pillar.tenGod 时）
- `:158-159`、`:169`、`:217`、`:224-226`（`tenGodHasRoot` 的"亦从 tenGods 记录反查干"路径）
- `:272-273`、`:632-633`

其中 `:224-226` 的 `tenGodHasRoot` **仍依赖以干为键的 Record 反查五行**，在**同干重复**时不会新增信息（Record 已合并），但因为它**同时**遍历 pillars（`:211-222`）并可回退返回 `false`，属**保守**（宁可判无根），风险可控。

**流派归属**：子平扶抑派以"得令/得地/得势"论旺衰（月令为主）。当前实现**以柱位计数 + 可视化分数辅助**，属**简化口径**，已在证据中自述 confidence 0.7 并注明"visualRatio辅助"（`yongshen.ts:247-253`）。

**影响**：若回退路径被触发（旧存档数据），同干重复仍会导致 support/drain 偏小 → 旺衰误判 → 喜忌整体偏移。**当前主路径安全**。

**优先级**：P2（建议在 `analyze.ts:224-226` 增加注释与保护，或统一改走 `byPosition`）。

---

### A.8 藏干权重、月令司令、透干、通根、刑冲合化：结构化还是固定权重？

**结论**：`部分修复` —— **刑冲合化已结构化**；**藏干权重仍固定**（但已明确降级为"仅供可视化"）；**月令司令未实现**；**透干/通根为部分实现**。

| 子项 | 状态 | 证据 |
|---|---|---|
| **藏干权重** | **仍为固定权重**（0.6/0.3/0.1） | `bazi/index.ts:321` 注释「固定藏干权重：仅可视化（T261）」；`:340-352` 应用 `HIDDEN_STEM_WEIGHTS[i]`；`yongshen.ts:280-284` 证据 `wuxing.visual_weights.v1` 自述「wuxingScores 仅供可视化，非月令司令/通根权威」 |
| **月令司令** | **未实现** | 全仓无"司令"实现；`yongshen.ts:157` 注释「可视化分数仅作从格启发式辅助，非月令司令」。**已诚实声明** |
| **透干** | **部分实现** | `analyze.ts:150-164` `stemTenGods` 取年月时干十神（不含日主），即"透干"的天干层面；但**未与藏干做"透出"匹配**（即未判断某藏干是否透出到天干） |
| **通根** | **部分实现（简化）** | `analyze.ts:204-237` `tenGodHasRoot`：以目标十神对应天干的五行，去藏干列表中找同五行。**这是"同五行即有根"，未区分本气/中气/余气，也未区分根之远近**。且无透干时直接 `return false`（`:228-231`） |
| **刑冲合化** | **已结构化** | `src/lib/bazi/relations/index.ts`（有独立实现）+ `relations.test.ts`（13 tests）；`bazi/index.ts:316-319` 调用时传入 `monthBranch`、`orderedStems`（含位置信息） |

**说明**：固定藏干权重本身**不是错误**（多个流派使用固定权重做人门级五行分布），关键在**是否声明其非权威**。此处**已声明**（`:321`、`yongshen.ts:280-284` 的 `confidence: 1` 证据行）。

**流派归属**：`ziping-default`。月令司令（人元司令分野）属子平进阶口径，各流派分野天数表不同（**流派分歧大**）。**本报告不指定应采用哪张司令表** —— 若产品要引入，须先声明采用哪一派的分野天数，否则即属臆断。

**优先级**：P2（月令司令缺失导致旺衰是"势"而非"令"，属已知简化；建议在专业模式显式展示该 confidence 与说明）。

---

### A.9 用神判定（扶抑/调候/通关/病药）是否有冲突解释？

**结论**：`已修复`（**四层已分层输出 + 冲突显式标注**），但**调候表为"风格化简表"**，与穷通宝典原文非逐格对应。

**证据**：
- **分层结构**：`policy.ts:57-62` 定义 `YongshenLayered = { fuyi, tiaohou, tongguan, bingyao }`，**四层并列**，不再压缩为单一"喜用五行"。
- **实现**：`yongshen.ts:175-238` `buildLayered()` 逐层构造，每层带独立 `note`。
- **冲突显式标注**：`yongshen.ts:208-211`
  ```
  if (tiaohouKeys.length && !favorable.some((f) => tiaohouKeys.includes(f))) {
    diseases.push("调候与扶抑可能冲突");
    medicines.push(...tiaohouKeys.map(...));
  }
  ```
  → **这正是原缺陷要求的"冲突解释"**。
- **证据链**：`yongshen.ts:240-286` `buildEvidence()` 产出 6 条 `RuleEvidence`，含 `ruleId` / `source` / `conclusion` / `confidence` / `condition`（如 `strength.fuyi.v1` conf 0.7、`yongshen.tiaohou.v1` conf 0.55）。写入 `chart.evidence`（`bazi/index.ts:478, 484`）。
- **仍保留单一入口**：`favorable` / `unfavorable` / `plainLine`（`:296-345`）供 UI 五行条使用 —— 属**展示层聚合**，与分层并存，可接受。

**调候表来源与完整性**（`constants.tiaohou.test.ts`）：
- `constants.tiaohou.test.ts:57-64`：断言 `TIAOHOU_TABLE_TOTAL === 120`、`tiaohouCoverage().covered === 120` → **120 全表覆盖（10 干 × 12 支）**。
- `:66-91`：断言 10×12 全部有具体细则且 `line.length > 20`（"非仅季节兜底"）。
- `:93-98`：抽样 6 组与穷通宝典原则比对（甲寅→丙癸、甲酉→丁制金、庚子→丙火解冻、丙午→壬水、壬午→金水、戊子→丙暖）。测试注释 `:11` 自述「与穷通宝典 skill 摘要对齐的抽样（classical-texts.md 口诀）」。
- `yongshen.ts:51-65` **另存**一份 `TIAOHOU_BY_MONTH`（**只按月支**，不分日干，注释 `:51`「调候简表：月支 → 优先调候五行（穷通宝典风格简化）」）；证据 `:262` 自述「穷通宝典风格调候简表」、`yongshen.ts:221` note 同。

> ⚠️ **重要区分**：存在**两张调候表**：
> - `reading/template/constants.ts` 的 120 格全表（按 日干×月支），有穷通抽样测试；
> - `bazi/yongshen.ts:52-65` 的 12 格简表（**仅按 月支**）。
> 二者**粒度不同**：`yongshen.ts` 的调候**不区分日主天干**，仅凭月支给出两个五行。这意味着 `yongshen.tiaohou.v1` 证据行的调候结论**粒度为简表**，与模板层 120 格全表**可能不一致**。
> 这是**自洽性风险**：同一命盘，模板层说"甲木正月先丙后癸"，用神层说"寅月调候取水、火"——**结论未必冲突但推导粒度不同**，且**未标注二者关系**。

**流派归属**：扶抑（子平主流）、调候（穷通宝典）、通关（五行流通）、病药（神峰通考）—— 均为**已声明来源**（`yongshen.ts:249, 256, 262, 269, 275`）。confidence 0.5–0.7 已标注，属**诚实**。

**影响（解读偏差）**：`favorable` 聚合数组仍会用于五行条与 `plainLine`（`:344-367`），若用户只看 `plainLine`，则**看不到"调候与扶抑冲突"这一关键信息**（该信息只在 `layered.bingyao.disease` 里）。建议 UI 在存在冲突时强制展示 `layered`。

**优先级**：P2（建议统一调候表粒度，或在证据行注明"简表（仅月支）"与全表的差异）。

---

### A.10 原缺陷：时辰未知仅出六字盘，无敏感性分析 —— 核实

**结论**：`已修复`。

**证据**：
- `src/lib/bazi/sensitivity.ts:26-69` `buildHourSensitivityReport(solarDate)`：**枚举十二地支**（`:32` 遍历 `EARTHLY_BRANCHES`），对每支取中点小时（`HOUR_MID` `:8-21`），子时特判 23:30 触发夜子时（`:34-42`），产出 12 个候选（含 `dayMaster/dayStem/dayBranch/hourStem/hourBranch/flags`）。
- **额外产出变体集合**：`dayPillarVariants`（`:56-58`）与 `hourPillarVariants`（`:59-61`）—— 因为夜子时会使**日柱**也变化，故日柱变体数为 2。
- 摘要文本：`formatHourSensitivityDiff`（`:74-86`）。
- 策略声明：`policy.ts:20-21` `UnknownHourPolicy = "six_pillars_plus_sensitivity"`。
- 测试：`sensitivity.test.ts`（3 tests）。

**残留问题**：
1. `computeChart` 在 `shichenUnknown` 时**只**产出六字盘 + warning 文案「建议十二时辰敏感性分析」（`index.ts:372-374`），**并未自动调用** `buildHourSensitivityReport`，也未把结果挂到 `BaziChart` 上。即敏感性分析是**独立可选 API**，不是未知时辰盘的组成部分。
2. `sensitivity.ts` 对子时**只取 23:30 一种**（`:35, :41`），即**默认晚子时**（与 `solar.ts:53` 的 `setSect(1)` 一致），**未并出早子时（00:30）候选** → 与 G1 同源。
3. `HourSensitivityItem` 只含盘面摘要，**不含旺衰/用神**，因此无法直接比较"十二个候选的用神是否翻转"（而这恰恰是未知时辰最需要回答的问题）。

**流派归属**：晚子时 `next_day`（`policy.ts:11-12`、`DEFAULT_CALENDAR_POLICY.nightZi`）。

**优先级**：P2（功能已存在但未接入主流程；子时双解未覆盖）。

---

### A.11 金标准用例来源、数量、覆盖缺口

**结论**：`部分修复` —— **数量 9 例，来源为本仓自产回归快照，非外部权威来源**（已诚实标注）。

**证据**：
- `src/lib/bazi/__fixtures__/index.ts:11-16`：
  ```
  export const FIXTURE_META: GoldenMeta = {
    source: "engine-regression",              // ← 自述为内部回归
    ruleSetVersion: "2026.07-w24",
    school: "ziping-default",
    notes: "内部回归金标准；外部门户集见 docs/research/bazi-sources.md",
  };
  ```
- `golden.test.ts:6-11`：**显式断言** `FIXTURE_META.source === "engine-regression"`，测试标题「明确标注为内部回归，不冒充外部验证 corpus」，并断言 `goldenCases).toHaveLength(9)`。

> **这是本报告正面肯定的设计**：测试**主动防止**把自产快照伪装成"外部金标准"。符合"禁止臆断来源"的原则。

**9 例清单**（`__fixtures__/index.ts:32-193`）：

| # | label | 输入 | 期望 | 覆盖边界 |
|---|---|---|---|---|
| L01 | 立春分年·立春前 | `1990-02-04 10:00` | 己巳/丁丑/庚子/辛巳 | 立春前 |
| L02 | 立春分年·立春后 | `1990-02-04 10:15` | 庚午/戊寅/庚子/辛巳 | 立春后（15 分钟之差） |
| L03 | 夜子时 | `2000-01-01 23:30` | 己卯/丙子/己未/甲子 | 夜子时（仅晚子时） |
| L04 | 未知时辰 | `1990-05-15`（无时辰） | 六字 | 六字盘 + 五行分 |
| L05 | 节气交界 | `1990-05-05 20:00` | 庚午/庚辰/庚午/丙戌 | 节气边界 flag |
| L06 | 阴年男 | `2000-01-01 10:00` | 逆排 | 大运逆 |
| L07 | 阴年女 | `2000-01-01 10:00` female | 顺排 | 大运顺 |
| L08 | 已故截断 | `1990-05-15` + deathYear 1995 | liunian 止于 1995 | 流年截断 |
| L09 | 真太阳时 | `1990-05-15 10:30` 乌鲁木齐 lng 87.6 | 时柱 辛巳→庚辰 | 真太阳时改变时柱 |

**缺失的金标准用例**：见文末《应补充的金标准测试清单》B-01…B-14（共 14 条），要点：
- ❌ 无 **1900/2100 边缘年**用例
- ❌ 无 **闰月出生**用例
- ❌ 无 **早子时（sect=0）对照**用例
- ❌ 无 **非立春的其他 11 节交节时刻 ±1 分钟**用例
- ❌ 无 **1986–1991 夏令时期间**用例
- ❌ 无 **真太阳时跨日（dayDelta ≠ 0）**用例（已有 `FLAG_TRUE_SOLAR_CROSS_DAY` 但 golden 未覆盖）
- ❌ 无 **从强/从弱格**用例
- ❌ 无 **大运交运日与 startYear 一致性**用例
- ❌ 无 **外部权威来源对照**（`docs/research/bazi-sources.md` 仅被注释引用，未形成可执行用例）

**流派归属**：`ziping-default`。

**优先级**：**P1**（"外部金标准"缺位是 A 部分的系统性风险：所有断言的自洽性都只对**自己**成立）。

---

## B. 紫微引擎（`src/lib/ziwei/`）

### B.1 原缺陷：大限用 `基准年-出生年` 而非严格虚岁 —— 核实是否已修复

**结论**：`已修复`（**判定逻辑已改虚岁**），但遗留一个**未使用的旧常量**与**周岁/虚岁混用点**。

**修复证据**：
1. **虚岁函数**：`src/lib/ziwei/daxian/index.ts:51-57`
   ```
   /** 严格虚岁：出生年虚岁 1，次年 2… age = year - birthYear + 1 */
   export function xusuiAge(year: number, birthYear: number): number {
     return year - birthYear + 1;
   }
   ```
2. **大限匹配改用虚岁**：`daxian/index.ts:415-425`
   ```
   // T270：严格虚岁（非 基准年-出生年 周岁）
   const currentAge = xusuiAge(effectiveYear, birthYear);
   ...
   if (currentAge >= step.startAge && currentAge <= step.endAge) { currentDaxianIndex = idx; break; }
   ```
3. **流年也改虚岁**：`daxian/index.ts:216` `age: xusuiAge(y, birthYear)`。
4. **标志位**：`daxian/index.ts:42` `FLAG_DAXIAN_AGE_XUSUI = "daxian_age_xusui"`，`:459` 加入 flags。
5. **旧常量已弃用标注**：`daxian/index.ts:37-40`
   ```
   /** @deprecated T270 起改用严格虚岁 FLAG_DAXIAN_AGE_XUSUI；保留常量以免外部引用断裂 */
   export const FLAG_DAXIAN_AGE_SOLAR = "daxian_age_solar_diff";
   ```
6. **meta 标注年龄口径**：`types/ziwei.ts:318-319` `agePolicy?: "xusui" | "zhousui" | string`；`iztro-compare.test.ts:403` 断言 `chart.meta.agePolicy === "xusui"`；`:413` golden 用例断言 `c.agePolicy === "xusui"`。

**遗留问题**：
- **`FLAG_DAXIAN_AGE_SOLAR` 仍在文件中定义但未被使用**（`daxian/index.ts:40`；`flags` 数组 `:457-464` 未包含它）→ 死代码，无害但易误导。
- **`startAgeFromJu` 用五行局值作为大限起始虚岁**（`daxian/index.ts:103-110`，`WUXING_JU_VALUE`），而 `generateDaxianSteps` 以 `startAge + i*10` 分档（`:147-148`）→ 这是三合派通行做法（水二局起 2 岁虚岁）。**但严格说，紫微大限的起限岁数本身存在流派分歧**（是否含"起限前"过渡、是否按虚岁整算），本仓未在 `meta` 中声明该分歧 → 属"已声明 school 但未声明该细则流派"。
- `computeDaxian` 的 `startAge` 直接来自五行局（`:402`），**未考虑出生月日对起限的微调**（部分流派按生日在月内位置微调起限）。**本报告不主张应做微调**（该细节流派分歧大、无统一权威），仅指出**未声明**。

**测试**：`daxian/daxian.test.ts`（17 tests）—— 需确认其是否断言虚岁。已由 `iztro-compare.test.ts:403` 与 golden 层断言 `agePolicy === "xusui"`。

**流派归属**：三合派（`SCHOOL_CORE = "sanhe"`，`tables/constants.ts:15-16`）。

**优先级**：P2（清理死常量；在 meta 中补充大限起限细则的流派声明）。

---

### B.2 五行局、命宫身宫定位、紫微天府安星规则

**结论**：`已修复`，且**有外部 oracle 对照通过**（这是三引擎中最强的证据链）。

**证据**：
- **五行局/命身宫/十四主星/前两步大限**与 `iztro@2.5.8` 逐项差分 → 实测 `node scripts/compare-iztro.mjs` **exit 0 / status: passed**，`"child": {"exitCode": 0}`。
- 对照字段（`iztro-compare.test.ts:33-39` / `compare-iztro.mjs:47-53`）：
  ```
  comparedFields: mingBranch, shenBranch, wuxingJu, majorByBranch[*], daxian[0..1].{startAge,endAge,palace,branch}
  excludedFields: minorStars, adjectiveStars, brightness, mutagen, horoscope, daxian[2..11]
  allowedDifferences: []
  ```
  → **`allowedDifferences: []`**，即**零容忍**差分。这是强断言。
- **对照是真实执行的，不是空跑**：`compare-iztro.mjs:190-206` 用 `spawnSync` 真实调用 vitest 并 `stdio: "inherit"`，读取子进程 `exitCode`（`:208-209`），非零即 gate 失败。
- **依赖版本硬校验**：`compare-iztro.mjs:130-146` 校验 `version === "2.5.8"` **且** `license === "MIT"`，不匹配即 `blocked` + exit 1。
- golden fixture 自身也断言 14 主星数量：`iztro-compare.test.ts:400` `expect(Object.keys(snap.majorByBranch).length).toBe(14)`。

**排除字段的影响**（诚实评估）：`minorStars` / `adjectiveStars` / `brightness` / `mutagen` / `horoscope` / `daxian[2..11]` **未经外部对照**。即：
- **十四主星、命身宫、五行局、前两步大限**：**有外部 oracle 背书** ✅
- **辅星、杂曜、亮度、四化、流年/流月/流日、第 3–12 步大限**：**无外部 oracle**，仅内部回归 ⚠️

**流派归属**：`sanhe`（三合盘体），oracle 为 `iztro v2.5.8 default configuration`（`iztro-compare.test.ts:28-32`，并自述「不宣称跨流派或全功能等价」）。

**优先级**：P2（建议把辅星/亮度/四化也纳入某个外部对照，或明确声明其无外部背书）。

---

### B.3 十四主星+辅星安放、亮度表来源、四化区分

**结论**：`部分修复` —— 安星表驱动且**主星有外部背书**；**亮度表来源未标注权威出处**；**四化区分清晰**。

**主星**：见 B.2（有 iztro 对照）。表在 `tables/constants.ts`（`tables/` 目录含 `aux-stars.ts` / `brightness.ts` / `boshi.ts` / `constants.ts` / `feixing.ts` / `liuchang.ts` / `sihua.ts` / `zihua.ts`）。

**辅星**：`tables/aux-stars.ts` + `aux-stars.ts` + `aux-stars.test.ts`（9 tests）。**无外部 oracle**。

**亮度表来源**：`tables/brightness.ts` + `brightness.ts` + `brightness.test.ts`（7 tests）。
> ⚠️ **亮度表来源未在代码中标注典籍/权威出处**（本次审查未在 `tables/brightness.ts` 内发现 provenance 常量或注释级来源）。且紫微星曜亮度（庙旺利陷）**各流派表差异显著**（尤其"得地/不得地"档位与部分星的庙陷归属），**无单一权威**。
> 依审查原则，**本报告不臆断该表应采用哪一派**，仅判定：**来源未声明 → 不满足"有外部来源"验收标准**。

**四化区分**：**清晰**。
- 生年四化 / 大限四化 / 流年四化 分别由 `sihua.ts`、`daxian/index.ts:154-155`（`sihuaFlightsFromStem(step.stem, ...)` → `yunSihua`）、`daxian/index.ts:211-212`（流年）产出，**命名空间分离**（`YunSihuaItem` vs 生年）。
- 自化独立文件：`zihua.ts` + `tables/zihua.ts` + `zihua.test.ts`（3 tests）。`tables/zihua.ts:7` 注释明确「非完整飞星派（不改 school；仍 sanhe）；飞星全套另 school/version」→ **诚实边界声明**。
- 四化表：`tables/sihua.ts` + `sihua.test.ts`（15 tests）。
- 运限飞星：`daxian/yun-feixing.test.ts`（5 tests）、`feixing.test.ts`（4 tests）。

**优先级**：P2（亮度表补来源声明或标注"本仓自定，无外部权威"）。

---

### B.4 原缺陷：三合/飞星/自化混用、缺流派命名空间与优先级 —— 核实

**结论**：`已修复`（**school 命名空间与 rulePriority 已引入**）。

**证据**：
1. **常量定义**：`src/lib/ziwei/tables/constants.ts:15-18`
   ```
   /** 主流派：三合盘体 */
   export const SCHOOL_CORE = "sanhe" as const;
   export const SCHOOL_FEIXING = "feixing" as const;
   ```
2. **meta 分层命名空间**：`src/lib/types/ziwei.ts:293-317`
   ```ts
   school?: "sanhe" | "feixing" | string;
   schools?: {
     core: "sanhe" | string;
     feixing?: "feixing" | string;
     zihua?: "sanhe" | string;
   };
   rulePriority?: string[];
   ```
   注释明确：「core：命身宫、五行局、主辅星、大限（三合）；feixing：宫干飞星飞宫（叠加，不改安星）；zihua：宫干自化（三合扩展）」，以及「同标记冲突时以后写叠加为准，但**事实层以 core 为准**」（`:313-317`）。
3. **实际写入**：`src/lib/ziwei/compute.ts:93-98`
   ```
   // 主流派：三合盘体；飞星为叠加命名空间
   school: SCHOOL_CORE,
   schools: { core: SCHOOL_CORE, feixing: SCHOOL_FEIXING, zihua: SCHOOL_CORE },
   ```
4. **测试**：`compute.test.ts:108-111`
   ```
   expect(chart.meta.school).toBe("sanhe");
   expect(chart.meta.schools?.core).toBe("sanhe");
   expect(chart.meta.schools?.feixing).toBe("feixing");
   ```
5. **飞星不改默认 school**：`feixing.ts:7` 注释「不改默认 school 为 feixing-only；flags 记 feixing_palace_flights」。
6. **自化边界声明**：`tables/zihua.ts:7`（见 B.3）。

**`rulePriority` 已实际填充（实测确认，此前的疑虑已排除）**：
- 代码侧：`compute.ts:100` `rulePriority: [...RULE_PRIORITY]`（在 `buildMeta` 内，`:85` 定义 `buildMeta`）。
- **实测输出**：`chart.meta.rulePriority = ["sanhe.core","sanhe.sihua","sanhe.zihua","feixing.flights","sanhe.daxian"]`，`meta.calendarPolicy = "lunar_javascript_cny"`，`meta.agePolicy = "xusui"`。
- 该数组**明确把 `sanhe.core` 置于首位、`feixing.flights` 置于其后**，与类型注释「事实层以 core 为准」（`types/ziwei.ts:315-317`）**一致** → 规则优先级**可运行时复核** ✅

**残留（轻微）**：`rulePriority` 数组内容**未见于测试断言**（`compute.test.ts:108-111` 只断言 `school` 与 `schools.{core,feixing}`）。建议补一条断言，锁住 `rulePriority[0] === "sanhe.core"` 与 `feixing` 序位，防止后续重排。另：`meta.calendarPolicy` 实测值为 `"lunar_javascript_cny"` —— 该字符串**表明紫微年干支按农历春节换年**（与 D.2 的判断一致），但**未细分月界/日界**（见 B.6）。

**流派归属**：core = `sanhe`；叠加 = `feixing`；自化为三合扩展。

**影响（解读偏差）**：`flags` 中同时出现 `daxian_sanhe_tables`、`yun_feixing_overlay`、`liuyue_by_month_gz`、`liuri_by_day_gz`（`daxian/index.ts:457-464`），且 `schools.feixing` 被声明，消费者可能**误以为飞星结论与三合结论同级**。有 `rulePriority` 且实际填充才能消除此歧义。

**优先级**：**P2**（建议实测确认 `rulePriority` 是否写入；若未写入，补全并加断言）。

---

### B.5 原缺陷：iztro 未固定为 devDependency；缺失时静默跳过 —— 核实

**结论**：`已修复`（**依赖已固定；静默跳过已被"独立 gate + 强制失败开关"消解**）。

**逐项核实**：

| 原缺陷描述 | 核实结果 | 证据 |
|---|---|---|
| "iztro 未固定为开发依赖" | **已修复** | `package.json:43` `"iztro": "2.5.8"`（**精确版本，无 `^`**）；实测 `node_modules/iztro/package.json` 版本 = `2.5.8` |
| "未安装时对照测试仍通过，对照脚本没有真正执行双方 diff" | **已修复** | ① `iztro-compare.test.ts:416-430`：无 iztro 时若 `IZTRO_REQUIRE=1` → **throw 失败**；否则 `it.skip` 并写明原因。② `compare-iztro.mjs` 强制 `IZTRO_REQUIRE=1`（`:184-187`）并校验版本/许可证（`:130-146`）。③ **实测 `node scripts/compare-iztro.mjs` → exit 0，`status: passed`，子进程 `exitCode: 0`** → 双方 diff **确实执行了** |

**关于"静默跳过"的判定**：
- 测试文件确实**保留**了 skip 分支（`:424-429`），但：
  - 它**不是静默的** —— `it.skip` 的标题明确写「skip：未安装 iztro（独立 gate 请运行 node scripts/compare-iztro.mjs）」，vitest 输出会显示为 skipped；
  - **CI 路径上不会静默** —— `compare-iztro.mjs` 是独立 gate，依赖缺失/版本漂移/许可证不符均 **exit 1**；
  - `IZTRO_REQUIRE=1` 提供显式强制失败开关。
- 设计意图已在文件头注释 `:1-13` 说明：「原则：运行时不依赖 iztro；独立 gate 要求精确的 iztro@2.5.8。`IZTRO_REQUIRE=1` 由 `scripts/compare-iztro.mjs` 设置；普通 npm test 保留缺依赖 skip，避免把内部回归套件和独立 oracle gate 混在一起。」

> **判定**：从"静默跳过等于对照失效"的角度，该风险**已被 gate 设计消除**。但需注意一个**残余工程风险**：`package.json` 的 `"check"` 脚本（`:18`）为 `lint && test && build`，**不包含** `compare:iztro`。若 CI 未单独调用 `scripts/compare-iztro.mjs`，则 oracle 对照在常规 `npm run check` 中**不会执行**。建议将 `npm run compare:iztro` 加入 CI 必需步骤。

**优先级**：**P2**（确认 CI 已挂载 compare:iztro；否则 oracle 退化为"本地手动跑"）。

---

### B.6 流月流日：月界/日界定义是否明确？适用流派是否标注？

**结论**：`部分修复` —— **实现有、flag 有，但"月界/日界定义"与"适用流派"未明确声明**。

**证据**：
- **流月实现**：`daxian/index.ts:292-322` `generateLiuyue()`
  - 取基准月 ±1（`:303` `for (const delta of [-1, 0, 1])`）
  - 干支由 `monthGanZhi(year, month, midDay)` 求得（`:307`），其中 `midDay` 在 `delta !== 0` 时**硬编码为 15**（`:306` `const midDay = delta === 0 ? day : 15;`）
  - 标签注释 `:293`「表驱动月干四化 + 月支落宫」
- **流日实现**：`daxian/index.ts:327-355` `generateLiuri()` —— 基准日 ±1（`:335`），干支由 `dayGanZhi`（`:338`）
- **干支定义**：`monthGanZhi`（`:262-275`）用 `lunar-javascript` 的 `l.getMonthGan()/getMonthZhi()` → **月界 = 节气**（与八字口径一致）；`dayGanZhi`（`:277-290`）用 `l.getDayGan()/getDayZhi()` → **日界 = 公历日 0 点**（`Solar.fromYmd`，**未考虑夜子时换日**）。
- **flags**：`daxian/index.ts:48-49` `FLAG_LIUYUE = "liuyue_by_month_gz"`、`FLAG_LIURI = "liuri_by_day_gz"`，加入 `:462-463`。

**未明确的点**：
1. **月界未声明流派**：紫微流月的月界有**多种流派**（按农历月、按节气月、按流年斗君起正月等）。本实现采用**节气月**（借 `lunar-javascript` 的 `getMonthGan/Zhi`），但：
   - `types/ziwei.ts` 中 `liuyue` 无 `school` 或 `boundaryPolicy` 字段；
   - meta 的 `calendarPolicy?: string`（`types/ziwei.ts:321`）是**单个字符串**，未细分为月界/日界；
   - **紫微的月建口径与八字不同是常见流派差异** —— 三合派紫微通常用**农历月**（非节气月），本实现却用节气月，**这可能是跨术数口径混用**。
2. **日界未声明**：`dayGanZhi` 用公历日（`:277-290`），而**紫微（尤其飞星派）对"晚子时是否换日"也有分歧**。`calendar.ts:98-100` 对出生时辰 push `FLAG_NIGHT_ZI`，但**流日计算完全没有夜子时处理**。
3. **±1 的语义未声明**：`delta ∈ [-1, 0, 1]`（`:303, :335`）是"近三月/近三日"的展示窗口，**不是标准流月流日推算**（标准做法是按流年斗君 / 流月命宫叠盘）。注释 `:292` 自述"表驱动月干四化 + 月支落宫"，即**只做了宫位落点 + 四化**，**未做流月宫位重排**。
4. `delta !== 0` 时 `midDay` 固定 15（`:306`）→ 若某月 15 日前后节气切换，则**取到的月干可能不是该月代表值**（边界脆弱）。

**影响（解读偏差）**：用户若据此推流月吉凶，会得到**非标准叠盘**的结论，且**无法知道月界依据**。

**优先级**：**P1**（"流月流日属于简化叠盘"这一原始缺陷**仍成立**；至少须在 meta 声明月界=节气月、日界=公历日、窗口=±1、以及"非标准斗君叠盘"）。

---

### B.7 原缺陷：未知时辰不应输出唯一完整紫微盘

**结论**：`已修复`。

**证据**：
- `compute.ts:292-314`：`shichenUnknown` 时构建 `hourCandidates`（12 候选摘要），并 push warning。
- `compute.ts:303` warning 原文：「时辰未知：主盘为默认午时参考盘，不可当作唯一完整盘；请对照 hourCandidates 多时辰校盘」。
- `compute.ts:122-124` 注释：「未知时辰：十二时辰候选摘要（不输出 12 份完整盘）」。
- `types/ziwei.ts:280` `hourCandidates?: ZiweiHourCandidate[]`。
- 主盘仍输出（默认午时）但**被明确降级为"参考盘"**，且 `meta.timePolicy` 标注（`compute.ts:103`）。

**流派归属**：默认午时（`FLAG_DEFAULT_NOON`，`calendar.ts:91`）；夜子时 flag 见 `calendar.ts:98-100`。

**优先级**：P3（无缺陷）。

---

### B.8 紫微 golden 用例数量与来源

**证据**：`src/lib/ziwei/__fixtures__/golden-cases.ts` —— 8 例（`id: "g1"`…`"g8"`，行 `:46, 77, 108, 139, 170, 201, 232, 263`）。
- 用例元数据：`golden-cases.ts:38-40` `source: "self-engine-snapshot"`、`engineVersionAtCapture: "0.8.0"`、`agePolicy: "xusui"` → **来源诚实标注为自产快照**。
- `compare-iztro.mjs:39` 亦声明 `expectedCaseCount: 8`、`sourceKind: "self-engine-snapshot"`、`role: "project-selected input vectors; not external evidence"` → **明确不把输入向量当外部证据**（输入端确实不是证据；**证据来自 iztro 的输出**，这一点区分正确）。

**注意**：`compare-iztro.mjs:39` 的 `expectedCaseCount: 8` **仅作为契约元数据输出，未在脚本内做数量断言**（脚本只校验版本/许可证，然后跑 vitest）。若 golden-cases 增至 9 例而契约仍写 8，**不会报错** → 契约漂移风险。建议在 gate 中断言实际用例数 === `expectedCaseCount`。

**优先级**：P3（补数量断言）。

---

## C. 六爻引擎（`src/lib/liuyao/`）

### C.1 原缺陷：时间起卦用梅花先天数再入纳甲，属混合方法，应独立标识 —— 核实

**结论**：`已修复`，且**标识贯穿数据层与展示层**。

**证据**：
1. **专门的方法/流派模块**：`src/lib/liuyao/cast/method.ts`
   ```ts
   export const CASTING_SCHOOL_BY_METHOD = {          // :12-18
     coins: "najia-coins",
     manual: "najia-manual",
     time: "meihua-time-to-najia",                    // ← 混合方法独立标识
   } as const;
   ```
2. **方法说明文本明确"混合"**：`method.ts:20-27`
   ```
   time: "梅花时间起卦（先天数上下卦+动爻）后再入纳甲六爻分析；非纯三钱纳甲起卦，属混合方法。"
   ```
3. **展示标签**：`method.ts:29-33` `SCHOOL_LABEL["meihua-time-to-najia"] = "梅花时间→纳甲（混合）"`。
4. **写入卦象 meta**：`cast/build.ts:54` `castingSchool: castingSchoolOf(method)`；`cast/build.ts:57` `methodNote: methodNoteOf(method)`。
5. **类型契约**：`types/liuyao.ts:107` `castingSchool?: LiuyaoCastingSchool`，注释「装卦流派；时间法必须为 meihua-time-to-najia」。
6. **梅花序一致性**：`cast/time.ts:12-21` `MEIHUA_ORDER = ["乾","兑","离","震","巽","坎","艮","坤"]`（1乾…8坤），与 `:9-10` 注释「与先天八卦数一致，%8 时 0 作 8」一致 —— **正确**。
7. **数据来源标注**：`data/sources.ts:28-29` `meihuaTime: "梅花易数先天数（1乾…8坤）起上下卦与动爻；再入纳甲分析（castingSchool=meihua-time-to-najia）"`。
8. **测试**：`cast/method.test.ts:18-22`「时间法 methodNote 标明梅花混合，不伪装纯纳甲」；`:49-60` 断言 `castingSchool === "meihua-time-to-najia"` 且 `methodNote` 匹配 `/梅花|混合/`。

**流派归属**：`meihua-time-to-najia`（**混合方法，已显式声明为非纯纳甲**）。

**优先级**：P3（无缺陷）。

---

### C.2 `cast/rng.ts` 随机数质量与可复现性

**结论**：`部分修复` —— **可复现性设计良好**（种子化 PRNG + replaySeed）；但**无种子时熵源为 `Math.random()` + 时间戳，非密码学安全**。

**证据**：
- **PRNG**：`cast/rng.ts:20-28` `createSeededRng` = **mulberry32**（`a = (a + 0x6d2b79f5)|0`，标准实现），周期 2³²，**非密码学安全**，但对占卜用途**足够**（质量要求是均匀性，非抗预测）。
- **哈希种子**：`rng.ts:6-17` `hashSeed` 用 **FNV-1a**（`2166136261` / `16777619`），确定性。
- **铜钱法**：`cast/coins.ts:8-14` `castOneYao` 三次 `rng() < 0.5` 累加阳数，返回 `6+yang` → 概率分布为 **binomial(3, 0.5)**：老阴(6)=1/8、少阳(7)=3/8、少阴(8)=3/8、老阳(9)=1/8 —— **与传统三钱法概率一致** ✅。
- **无种子熵源**：`cast/coins.ts:27-31`
  ```
  const t = Date.now() >>> 0;
  const r = (Math.random() * 0x100000000) >>> 0;
  return hashSeed(`${t}:${r}`);
  ```
  → 用 `Math.random()`，**不是 `crypto.getRandomValues`**。
- **可复现性**：`cast/index.ts:109, 146-148` 写入 `replaySeed` 与 `randomSource`（`"seeded-prng"` / `"fresh-seed"` / `"none"`），`method.ts:43-49` `randomSourceOf`。测试 `method.test.ts:24-46` 断言 `replaySeed === 42`、`randomSource` 取值正确。**→ 任何一次铜钱起卦都可凭 `replaySeed` 完整复现** ✅。
- **随机源标注**：`types/liuyao.ts:108-113` `randomSource?` / `replaySeed?`。

**风险评估**：
| 维度 | 评价 |
|---|---|
| 可复现性 | **优秀** —— replaySeed 保证审计可回溯 |
| 分布均匀性 | **良好** —— mulberry32 + 二叉分布正确 |
| 抗预测性 | **弱** —— `Math.random()` 可被同源 JS 预测/覆写 |

**对占卜产品的影响**：**抗预测性不是核心需求**（占卜不要求不可预测的密码学随机；传统上以"诚心"为主）。但若产品声明"随机不可预测"，则与实现不符。**当前 meta 未做此类声明** → **无虚假宣传**。

**建议（可选）**：若希望更强的"仪式感"，可用 `crypto.getRandomValues` 生成 seed（**但会破坏同构性**：server 与 client 行为不同）。**本报告不主张必须改**，因当前设计在"可复现性 vs 不可预测性"上选择了前者，且**已声明 `randomSource: "fresh-seed"`**。

**优先级**：P3（现状可接受；仅建议在 UI 说明"以时间为熵源，非密码学随机"）。

---

### C.3 三种起卦法是否在结果中明确标识？

**结论**：`已修复`。

**证据**：`CastLiuyaoResult.meta`（`cast/build.ts:50-60`）写入：
- `castingSchool`（`:54`）—— 三值区分
- `randomSource`（`:55`）—— `"none"` / `"seeded-prng"` / `"fresh-seed"`
- `timezone`（`:56`）
- `methodNote`（`:57`）
- `replaySeed`（`:59`，条件）
- `dataVersion`（`palace-exhaustive.test.ts:89` 断言）

测试：`method.test.ts:11-15`（映射）、`:24-36`（铜钱）、`:49-60`（时间）、`:63-72`（手动）。三种方法**均有测试**。

**优先级**：P3（无缺陷）。

---

### C.4 六爻分析层规则表逐项核对

**结论**：`已修复`（各规则表与通行口径一致，且有穷举/单元测试）。

#### C.4.1 旬空推法

**证据**：`analyze/kongwang.ts`
- 旬首表（`:61-70`）：甲子→戌亥、甲戌→申酉、甲申→午未、甲午→辰巳、甲辰→寅卯、甲寅→子丑 —— **与通行六十甲子旬空表完全一致** ✅
- 推法（`:73-82`）：`shouBi = (bi - si) mod 12`，`旬首 = 甲 + shouBi`
  - 验证：日干支「丙寅」→ `si=2(丙)`, `bi=2(寅)` → `shouBi=0` → 甲子 → 空戌亥。正确（丙寅属甲子旬）。
  - 验证：「壬申」→ `si=8(壬)`, `bi=8(申)` → `shouBi=0` → 甲子 → 空戌亥。正确。
  - 验证：「甲戌」→ `si=0`, `bi=10(戌)` → `shouBi=10` → 甲戌 → 空申酉。正确。
- 测试：`kongwang.test.ts`（7 tests）。

**流派归属**：京房纳甲通行旬空（日旬空）。

#### C.4.2 六神起法

**证据**：`analyze/liushen.ts`
- 六神环（`:22-29`）：青龙→朱雀→勾陈→螣蛇→白虎→玄武 ✅
- 起法表（`:32-43`）：甲/乙→0(青龙)、丙/丁→1(朱雀)、戊→2(勾陈)、己→3(螣蛇)、庚/辛→4(白虎)、壬/癸→5(玄武) ✅
- 排法（`:50-56`）：初爻起，自下而上顺排 ✅
- **与通行口诀一致**：甲乙起青龙、丙丁起朱雀、戊起勾陈、己起螣蛇、庚辛起白虎、壬癸起玄武 ✅
- 测试：`liushen.test.ts`（9 tests）。
- 来源标注：`data/sources.ts:26`「按日干起六神：甲乙青龙…壬癸玄武，初爻起顺排（analyze/liushen.ts）」✅

**流派归属**：纳甲通行六神（按日干起）。**注**：另有"按日支起六神"的流派，本仓明确采用**日干**并已声明。

#### C.4.3 六亲定法

**证据**：`analyze/liuqin.ts`（`assignLiuqin` / `pickLiuqinYao` / `TRIGRAM_NAJIA`）
- 纳甲表：`TRIGRAM_NAJIA`（内外卦各三支），穷举测试 `palace-exhaustive.test.ts:52-60` 断言 8 卦 × 内外 × 3 支齐备。
- 六亲：以**宫五行**与**爻支五行**生克定（`data/sources.ts:18-19`）。
- 穷举测试：`palace-exhaustive.test.ts:62-70` 断言 **64 卦**六亲安爻长度 6、确定性、爻位唯一。

**流派归属**：京房纳甲（宫五行定六亲）。

#### C.4.4 世应定位

**证据**：`analyze/palaces.ts`（`PALACE_BY_BINARY` / `PALACE_ROOTS` / `SHI_BY_PALACE_POS` / `buildPalaceMembers`）+ `analyze/shi-ying.ts`（`shiYingFromBinary` / `yingFromShi`）
- 世应口诀表驱动：`data/sources.ts:21-22`「京房八宫：本宫→一世…五世→游魂→归魂；世应口诀表驱动」✅
- `yingFromShi`：世应相隔三位（世 1→应 4、世 2→应 5、世 3→应 6）✅
- **穷举测试**：`palace-exhaustive.test.ts:19-50`
  - `:20-34`：八宫各 8 卦、共 **64**、无重叠、`PALACE_BY_BINARY` 反查一致
  - `:36-41`：**64 卦**均可归属八宫
  - `:43-49`：**64 卦**断言 `shiYao === SHI_BY_PALACE_POS[palacePos]` 且 `yingYao === yingFromShi(shiYao)`

**流派归属**：京房八宫世应。

#### C.4.5 月破定义

**证据**：`analyze/yuepo.ts` —— 文件存在（本次审查读到此文件在 `analyze/` 目录清单中）。
**注**：本次审查**未逐行读取 `yuepo.ts` 内容**，故**不对其内部月破判定（月建地支之对冲支）做断言**。按数据来源 `data/sources.ts` 未单列月破条目。
**建议**：在报告的金标准清单中补月破用例（B-31）。

**优先级**：C.4 整体 P3（规则表正确且有测试）；月破项 **P2（需补来源声明与用例）**。

---

### C.5 原缺陷：用神主要依赖问题关键词 —— 核实是否已增加类别/主体/性别/关系维度

**结论**：`已修复`（**已增加问事类别、性别、用户确认三个维度**；"主体/关系"为部分覆盖）。

**修复证据**（`analyze/yongshen.ts`）：

1. **问事类别维度**：`yongshen.ts:40-54`
   ```ts
   export const CATEGORY_YONGSHEN: Record<LiuyaoQuestionCategory, Liuqin | "世"> = {
     wealth: "妻财", career: "官鬼", lawsuit: "官鬼", marriage: "妻财",
     health: "官鬼", travel: "父母", parents: "父母", offspring: "子孙",
     siblings: "兄弟", self: "世", other: "世",
   }
   ```
   → **11 个类别**，与关键词推断并存。
2. **性别维度**：`yongshen.ts:21` `YongShenGender`；`:36` `byGender?: Partial<Record<YongShenGender, Liuqin>>`；`:93-99` 婚恋规则 `byGender: { male: "妻财", female: "官鬼" }`（男问妻财、女问官鬼）。
3. **用户确认优先级最高**：`yongshen.ts:166-168`（`questionCategory` / `yongShenConfirm`）；`:222-230` 确认用神直接返回 `ruleId: "confirm"`；`:232-249` 类别次之。
4. **性别推断兜底**：`yongshen.ts:171-175` `inferGenderFromQuestion`（女命/我是女/女方问/女测）。
5. **命中后绑定爻位**：`yongshen.ts:303` `pickLiuqinYao(rows, kind, ctx.dongYao)`（多现时优先动爻），`:304-313` 六亲不现回落到世爻并标 `fallbackShi: true`。
6. **规则可追溯**：`:74-130` 每条规则带 `id`（如 `"marriage"`、`"career"`），`:257` 返回 `ruleId: rule.id`。
7. **测试**：`yongshen.test.ts`（7）+ `yongshen-category.test.ts`（7）。`:11-13` 自述 T171「事类扩展 + 可选性别（婚恋男/女命取用差异）」。

**仍存在的"关键词依赖"**：
- `:251-263` 仍是**正则关键词匹配**（`YONGSHEN_RULES` 的 `pattern`）。这是**兜底层**，设计上被 `yongShenConfirm` / `questionCategory` 覆盖 —— 属**可接受的分层**。
- **"主体/关系"维度覆盖不完整**：`CATEGORY_YONGSHEN` 有 `self`/`other`（`:52-53`），但 `other`（他人）**未细分为具体六亲**（如"问朋友之事"是取兄弟还是取应爻？）。`ResolveYongShenContext`（`:152-169`）**未包含"求测人 vs 所问对象"的关系字段**。
- **正则误命中风险**：`YONGSHEN_RULES` 按顺序先匹配先生效（`:72` 注释「先匹配先生效；顺序即优先级」）。例如问题「面试能通过吗」 → `career` 规则 pattern 含 `面试`（`:83`）✅；但 `parents` 规则含 `信息|消息`（`:115`），问题「等他消息」会命中 `parents`（父母）→ **可能误判**（实际可能是问感情）。此类**同义冲突**未做消歧。

**影响（解读偏差）**：关键词误命中会导致**用神取错六亲** → 整个断卦主线偏移。当前有 `questionCategory`/`yongShenConfirm` 作为人工纠偏通道（`fromConfirm` 标记），**属可用的缓解**。

**优先级**：**P2**（建议补充"主体/关系"字段；对易冲突的 category 增加互斥消歧规则与测试）。

---

### C.6 动变：`dongbian.ts` 是否实现回头生克/化进化退/化空化破/冲合转换？

**结论**：`部分修复`。

| 规则 | 状态 | 证据 |
|---|---|---|
| **回头生克** | **已实现** ✅ | `analyze/dongbian.ts:17-18, 33-37`：`HuitouKind = "回头生"\|"回头克"\|"无"`；`huitouOf()` 把 `化生动 → 回头生`、`化克动 → 回头克`；`:95-97` 生成 `【回头生】/【回头克】` 标签；`:96-102` 写入 summary |
| **本爻→化爻五行生克** | **已实现** ✅ | `:55-63` `wuxingRelation()` 五值：比和/动生化/动克化/化生动/化克动，生克表 `:39-53` **正确** |
| **化进化退** | **未实现** ❌ | 全文件**无"进神/退神"概念**。化进（如 寅化卯、巳化午）与化退（卯化寅、午化巳）需比对**地支序**，当前**只比对五行**（`:94` `wuxingRelation(from.wuxing, to.wuxing)`）→ 寅化卯 与 寅化午 在五行层都是"动生化"（木生火），**无法区分** |
| **化空** | **未实现** ❌ | `dongbian.ts` **未引用 `kongwang`**（无 import）。变爻是否落空亡**未判断** |
| **化破** | **未实现** ❌ | **未引用月破**（无 `yuepo` import） |
| **冲合转换** | **未实现** ❌ | 无地支六冲/六合/三合判断 |

**另外**：`:60-62` 的兜底 `return "比和"` 在五行环上**逻辑上不可达**（五行相生相克覆盖全部异类对），但作为防御可接受。

**对比原缺陷**：「动变主要描述本爻与化爻五行关系，尚缺回头生克、化进化退、化空化破和冲合转换」→ **回头生克已补；其余四项仍缺**。故判定 `部分修复`。

**影响（解读偏差）**：`dongbian.ts` 的 `summary` 与 `RELATION_HINT`（`:65-71`）文案较中性（"趋势向外延伸""宜拆解目标"），**不构成吉凶误判**，但**丢失了进/退/空/破这些关键证据**，导致动变分析**信息量不足**。

**测试**：`dongbian.test.ts`（7 tests）—— 现有测试**未覆盖**化进化退/化空/化破（因未实现）。

**流派归属**：纳甲六爻动变（增删卜易/卜筮正宗体系）；**进神退神、化空化破、冲合**均为该体系标准内容，流派分歧小。

**优先级**：**P1**（原缺陷明确列出且**大部分未闭合**；这是六爻规则层的核心分析缺口）。

---

### C.7 穷举测试覆盖的状态空间（具体数字）

**证据**：`src/lib/liuyao/__fixtures__/palace-exhaustive.test.ts`

| 断言 | 覆盖空间 | 具体数字 | 行号 |
|---|---|---|---|
| 八宫各 8 卦、共 64、无重叠 | **全卦空间** | **8 宫 × 8 卦 = 64 卦**，`keys.size === 64` | `:20-34` |
| 64 卦均可归属八宫 | **全卦空间** | **64 卦** | `:36-41` |
| 世应口诀一致 | **全卦空间** | **64 卦 × (shiYao + yingYao) = 64 × 2 = 128 个断言点** | `:43-49` |
| 八卦内外纳甲各三支 | **纳甲表** | **8 卦 × 2（内外）× 3 支 = 48 支** | `:52-60` |
| 64 卦六亲安爻 | **全卦空间** | **64 卦 × 6 爻 = 384 个爻位**；且断言 `Set(yao).size === 6`（爻位唯一） | `:62-70` |
| 来源元数据 | — | `dataVersion` / `ruleSetVersion` / `bagong` / `najia` / `meihuaTime` | `:73-80` |
| 装卦 meta | — | `castingSchool === "najia-manual"` | `:82-91` |

**状态空间总结**：
- **卦象空间**：64 卦 **100% 穷举** ✅
- **爻位空间**：64 × 6 = **384 爻位 100% 穷举**（六亲安爻）✅
- **世应空间**：64 × 2 = **128 点 100% 穷举** ✅
- **纳甲空间**：**48 支 100% 穷举** ✅

**⚠️ 关键缺口**：**原文要求的"64 卦 × N 变爻"未实现**。
- 变爻组合空间 = **64 卦 × 2⁶ 动爻组合 = 64 × 64 = 4096** 种卦变。
- 当前 `palace-exhaustive.test.ts` **完全未触及变卦空间**（无 `toBianValues` / `bianGua` 相关断言）。
- `dongbian.test.ts`（7 tests）为**少量手工用例**，非穷举。
- 因此：**"64 卦 × N 变爻"中 N=0** —— 变爻维度**零覆盖**。

**当前穷举覆盖度评分**：

| 维度 | 穷举度 |
|---|---|
| 本卦（64） | **100%** |
| 六亲/纳甲/世应 | **100%** |
| **变卦（4096 组合）** | **0%** |
| 月建/日辰/旬空 × 卦组合 | **0%**（仅单元测试抽样） |

**优先级**：**P1**（建议新增变卦穷举：对 64 卦 × 64 种动爻组合断言变卦正确性、`bianGua` 存在性、动变生克确定性）。

---

### C.8 64 卦数据完整性与来源标注

**结论**：`已修复`。

**证据**：
- **数量**：`data/hexagrams.ts` **586 行**，`HEXAGRAMS` 数组从 `:41` 起，`entry(1, "乾为天", ...)` 起（`:42`）。
- **完整性测试**：`data/hexagrams.test.ts`
  - `:23-25` **恰好 64 条**
  - `:27-35` `index` 为 **1..64 且无重复**，`HEXAGRAM_BY_INDEX` / `getHexagram` 一致
  - `:37-47` **binary 唯一且长度 6**（`Set(keys).size === 64`），每爻 ∈ {0,1}
  - `:49-61` **binary 与 upper+lower 组合一致**且可双向互查（`getHexagramByTrigrams` / `getHexagramByBinary`）
  - `:63-73` **每条含 name/shortName/guaci 与恰好 6 条 yaoci**，且每爻非空
  - `:75-84` 抽检代表卦：乾(1)=111111、坤(2)=000000、屯(坎上震下)、未济(离上坎下)、既济(63)、未济(64) ✅
- **无占位符**：grep `TODO|FIXME|占位|placeholder|XXX` → **0 命中**（实测）。
- **干数据由 `bin()` 生成**（`:10-17`），非手写 → **消除手抄错误** ✅

**来源标注**：`data/sources.ts`
```ts
sequence: "周易·文王卦序（通行本六十四卦）",                              // :8
text: "周易卦辞、爻辞通行本意摘要（非原文逐字，供展示与模板引用）",        // :10
trigrams: "周易八卦：乾兑离震巽坎艮坤，阴阳爻自下而上",                    // :12
liuqin: "京房纳甲六亲：内外卦纳支 → 爻支五行，与宫五行生克定父母/兄弟/子孙/妻财/官鬼",  // :18-19
bagong: "京房八宫：本宫→一世…五世→游魂→归魂；世应口诀表驱动（analyze/palaces.ts）",   // :21-22
najia: "京房纳甲内外卦地支表（TRIGRAM_NAJIA）",                           // :24
liushen: "按日干起六神：甲乙青龙…壬癸玄武，初爻起顺排（analyze/liushen.ts）",  // :26
meihuaTime: "梅花易数先天数（1乾…8坤）起上下卦与动爻；再入纳甲分析（castingSchool=meihua-time-to-najia）",  // :28-29
school: "学习向·表驱动 v1；非单一师承全书；规则 id 可追溯",               // :31-32
excluded: "不采用恐吓、诅咒、绝对化断语；不替代专业决策",                 // :34
dataVersion: "liuyao-data-1.1.0",                                        // :36
ruleSetVersion: "liuyao-rules-w26-0.5.0",                                // :38
```

**评价**：来源标注**质量较高** —— 明确指向京房纳甲体系、文王卦序，并**诚实声明"非原文逐字"**（`:10`）与"非单一师承全书"（`:31-32`）。

**⚠️ 注意事项**：
1. 爻辞为**意摘要非原文**（`:10` 已声明）→ 若 UI 引用为"易经原文"则构成**叙事层污染事实层**。**需在展示层核对是否已标注**（本次审查未验证 UI 层，标注为**无法确认**）。
2. `ruleSetVersion: "liuyao-rules-w26-0.5.0"`（`:38`）—— 注意 `palace-exhaustive.test.ts:76` 断言 `/w26|rules/`，**断言宽松**（只要能匹配 `w26` 或 `rules` 即可）。**版本号演进时该测试不会失败**，无法捕捉版本漂移。

**优先级**：P2（`ruleSetVersion` 断言过宽；UI 层爻辞标注需另查）。

---

## D. 跨引擎一致性

### D.1 三引擎信封字段对照表

**结论**：`部分修复` —— **核心版本字段不统一，且 `inputFingerprint` 三引擎全缺**。

| 字段 | 八字 | 紫微 | 六爻 | 判定 |
|---|---|---|---|---|
| `schemaVersion` | ✅ `meta.schemaVersion` = `"1.1.0"`（`policy.ts:6`；写入 `bazi/index.ts:451`） | ✅ `meta.schemaVersion?`（`types/ziwei.ts:299`） | ❌ **无** | **不统一** |
| `engineVersion` | ✅ `"0.3.0"`（`policy.ts:7`；`bazi/index.ts:449`） | ✅ `meta.engineVersion`（`types/ziwei.ts:287`） | ✅ `meta.engineVersion`（`types/liuyao.ts:105`） | **统一** ✅ |
| `ruleSetVersion` | ✅ `"2026.07-w24"`（`policy.ts:8`；`:452`） | ✅ `meta.ruleSetVersion?`（`types/ziwei.ts:301`） | ❌ **无**（仅有 `dataVersion` / `LIUYAO_DATA_SOURCES.ruleSetVersion`，**未写入 chart.meta**） | **不统一** |
| `school` | ✅ `meta.school` = `"ziping-default"`（`policy.ts:9`；`:453`） | ✅ `meta.school` + `meta.schools{core,feixing,zihua}` + `rulePriority?`（`types/ziwei.ts:297-317`） | ⚠️ `meta.castingSchool`（**命名不同**，`types/liuyao.ts:107`） | **语义等价、命名不统一** |
| `calendarPolicy` | ✅ `meta.calendarPolicy`（**结构化对象**，`policy.ts:32-38`；`bazi/index.ts:454`） | ⚠️ `meta.calendarPolicy?: string`（**字符串非对象**，`types/ziwei.ts:321`；**实测值** `"lunar_javascript_cny"`） | ❌ **无** | **不统一**（语义有、结构不同） |
| `timePolicy` | ⚠️ 并入 `calendarPolicy.timezone`（`policy.ts:37`） | ✅ `meta.timePolicy?: string`（`types/ziwei.ts:323`；`compute.ts:103`） | ⚠️ `meta.timezone?: string`（`types/liuyao.ts:111`） | **不统一** |
| `agePolicy` | ❌ **无**（八字无年龄口径声明） | ✅ `meta.agePolicy` = `"xusui"`（`types/ziwei.ts:319`） | ❌ 不适用 | **八字缺** |
| `warnings` | ✅ `chart.warnings?: string[]`（`types/index.ts:289, 352, 387, 422`） | ✅ `chart.warnings?: string[]`（`types/ziwei.ts:283`） | ⚠️ **未在 `LiuyaoChart` 顶层发现**（仅 `flags` 概念；`types/liuyao.ts` 无 `warnings`） | **六爻缺** |
| `evidence` | ✅ `chart.evidence?: RuleEvidence[]`（`types/index.ts:293`；`bazi/index.ts:484`） | ⚠️ 有 `RuleEvidence` 类型（`types/index.ts:352, 387, 422` 附近）但未确认写入 ziwei chart | ❌ **无** | **不统一** |
| `inputFingerprint` | ❌ **无** | ❌ **无** | ❌ **无** | **三引擎全缺** |
| `flags` | ✅ | ✅ | ✅ | **统一** ✅ |

**关键发现**：
1. **`inputFingerprint` 三引擎全部缺失**。原审查原则（`PROJECT_REVIEW.md` §3.2）要求"统一引擎信封"包含该字段。**无指纹 → 无法验证"用户提交的盘 = 由权威 profile 重算的盘"**。
   - 八字有 `authoritativeInput` + `computeAuthoritativeChart` + `chartMatchesProfile`（`bazi/index.ts:172-183, 494-505`）作为**替代机制**（服务端重算比对），**设计上部分弥补**，但用的是 `JSON.stringify` 全量比较（`:504`），**不是指纹**，且 `stripAuthorityInput`（`:186-191`）会在送 LLM 前移除，**无法用于事后审计**。
2. **六爻信封最弱**：缺 `schemaVersion` / `ruleSetVersion`（写入 chart）/ `warnings`，且 `school` 字段名不同（`castingSchool`）。
3. **紫微信封最完整**（有 `schools` 命名空间 + `rulePriority` + `agePolicy`）。

**流派归属**：三引擎各自已声明（`ziping-default` / `sanhe`(+`feixing`) / `castingSchool` 三值）。

**影响**：
- 消费方（LLM prompt、分享页、报告导出）**无法用统一逻辑读取流派与版本** → 每条消费路径都要写术数专属分支 → **易漏 `ruleSetVersion`**，导致"解读基于旧规则却标注新版本"。
- 无 `inputFingerprint` → **无法证明**某份解读对应哪份输入（审计缺口）。

**优先级**：**P1**（统一信封是原审查原则明确要求；当前跨引擎不可统一消费）。

---

### D.2 三引擎农历转换是否共用同一实现？

**结论**：`已修复`（**共用同一实现**，无口径分裂风险）。

**证据**：
- **八字侧**：`src/lib/bazi/calendar/lunar.ts:8-26` `lunarToSolarDate(lunarDate, isLeapMonth)`，内部 `Lunar.fromYmd(year, lunarMonth, day)`（`:20`），闰月用**负数月**表示（`:19` `const lunarMonth = isLeapMonth ? -month : month;`）。
- **紫微侧**：`src/lib/ziwei/calendar.ts:6-13` **直接 import 八字模块**：
  ```ts
  import {
    branchFromHour, isNightZiHour, lunarToSolarDate,
    parseBirthTime, parseSolarDate,
  } from "@/lib/bazi/calendar";                    // ← 复用，非另写
  ```
  - 使用点：`calendar.ts:73` `solarDate = lunarToSolarDate(input.lunarDate, input.isLeapMonth === true);`
  - 另有 `contextFromLunarYmd`（`:134-163`）供测试用，闰月同样用**负数月**（`:141` `const lunarMonthArg = isLeapMonth ? -lunarMonth : lunarMonth;`）—— **与八字侧约定一致** ✅
- **共同底层**：两者均依赖 `lunar-javascript@1.7.7`。
- **夏令时/夜子时也复用**：`isNightZiHour` / `branchFromHour` / `parseBirthTime` 均来自 `@/lib/bazi/calendar`（`ziwei/calendar.ts:8-13`）→ **时辰边界口径跨引擎一致** ✅

**评价**：这是**架构上的正确决策**。`ziwei/calendar.ts:2` 文件头注释即写「紫微用历：复用 lunar-javascript + 项目 bazi 时辰表」。

**残留小差异**：
- 紫微 `resolveBirthContext` 用 `lunar.getYearGan()/getYearZhi()` 取**年干支**（`calendar.ts:127-128`），即**以农历春节换年**；而八字用**立春换年**（`solar.ts:52` `getEightChar()`）。**这是正确的**（紫微按农历年、八字按节气年，属**流派差异而非 bug**），且 `ziwei/calendar.ts:56` 注释已声明「年干支取农历春节换年」。
  → **但该差异未在 meta 中作为"历法策略"显式声明**（`meta.calendarPolicy` 是 `string`，未见写入内容）。建议在 `meta` 中写明"紫微年干支按农历春节换年"。

**优先级**：P3（架构良好；建议补 meta 历法策略声明）。

---

### D.3 依赖版本 `lunar-javascript ^1.7.7` 的已知错误

**结论**：`无法确认`（需外部验证）。

**证据**：
- `package.json:27`：`"lunar-javascript": "^1.7.7"` —— **注意是 `^` 范围**，非精确锁定。
- 实测 `node_modules/lunar-javascript` 安装版本 **1.7.7**。
- 上游仓库：`https://github.com/6tail/lunar-javascript`（`node_modules/lunar-javascript/package.json` 内 repository 字段）。

**风险点**：
1. **`^1.7.7` 允许 1.x 任意更高版本** → `npm install` 可能拉到 1.7.8+，若上游对节气表/八字算法做了修正或引入回归，**引擎行为会静默改变**，而 `ruleSetVersion` 不会变 → **可复现性破口**。
   - 对比：紫微 oracle 依赖用**精确版本** `"iztro": "2.5.8"`（`package.json:43`），说明团队已意识到精确锁定的必要性，但**历法核心库反而用了范围版本**。
2. **已知错误**：本次审查为**只读且未联网核实上游 changelog / issues**，故**无法确认** `1.7.7` 是否存在已知的节气时刻偏差、闰月判断错误或干支边界 bug。**依审查原则，此处标注"需外部验证"，不作臆断**。

**建议的验证方法**：
- 对若干已知权威节气时刻（如紫金山天文台发布的年度节气表）做**定点比对**：断言 `1990 立夏` 的交节时刻（本仓 golden L05 注释 `__fixtures__/index.ts:105` 自述「1990 立夏约 05-06 02:35」—— **该数值本身未经外部核验，属仓库自述**）。
- 检查上游 `CHANGELOG`/releases 是否含节气修正条目。

**优先级**：**P1**（`^` 范围 + 核心历法依赖 + 未核验 = 可复现性风险）；建议改为**精确版本** `"lunar-javascript": "1.7.7"`。

---

## E. 原始缺陷逐条判定汇总

### §2.2 八字专业性

| # | 原缺陷 | 判定 | 关键证据 |
|---|---|---|---|
| B-a | 旺衰用天干字符为键的 `tenGods`，同干重复被合并 | **已修复** | `types/index.ts:259-263`；`yongshen.ts:102-121`；`bazi/index.ts:286-295`；`yongshen.test.ts:23-24,70,112`。残留：`analyze.ts:224-226` 的 `tenGodHasRoot` 仍读旧 Record（低危） |
| B-b | 固定藏干权重不能替代月令司令/透干/通根/远近/刑冲合化 | **部分修复** | 刑冲合化**已结构化**（`relations/index.ts` + 13 tests）；权重**仍固定**但已声明"仅可视化"（`bazi/index.ts:321`、`yongshen.ts:280-284`）；**月令司令未实现**（已诚实声明 `yongshen.ts:157`）；透干/通根为简化实现（`analyze.ts:150-164, 204-237`） |
| B-c | 调候/格局/扶抑/通关/病药压缩为单一"喜用五行"，缺冲突解释 | **已修复** | `policy.ts:57-62` 四层结构；`yongshen.ts:175-238`；**冲突显式标注** `:208-211`「调候与扶抑可能冲突」；6 条 `RuleEvidence` `:240-286`。残留：`yongshen.ts:51-65` 调候简表**仅按月支**，与模板层 120 格全表粒度不一致且未说明关系 |
| B-d | 起运保存年/月细节，但正式大运仍按整岁和整数年份 | **仍存在** | `dayun/index.ts:226` `toRoundedStartAge`（`:99-102` = `Math.round(diffDays/3)`）；步长 `:152-164`；`currentDayunIndex` 用周岁整年 `:236-247`；`startYear` 用 `birthYear+startAge` `:160-161`。**`startAt` 精确到日但只作展示**。测试把整岁固化为期望值（`dayun.test.ts:20-23`） |
| B-e | 真太阳时未完整建模时区/历史夏令时/行政时间 | **部分修复** | 经度+均时差+跨日**已实现**（`solar-time/index.ts:64-104`）；历史 DST **未建模但显式声明**（`policy.ts:17-18,28-30,37`；`bazi/index.ts:233-235`）。`dst-scope.test.ts` **仅 1 例**，覆盖极窄。**未开启真太阳时时不给 DST 提示** |
| B-f | 时辰未知仅生成六字盘，无十二时辰敏感性分析 | **已修复** | `sensitivity.ts:26-69` 十二候选 + 日/时柱变体集合；`policy.ts:20-21`。残留：`computeChart` **未自动调用**该 API（`index.ts:372-374` 仅给文案）；子时**只取 23:30**（晚子时单一解） |

### §2.3 紫微专业性

| # | 原缺陷 | 判定 | 关键证据 |
|---|---|---|---|
| Z-a | 大限用 `基准年-出生年`，非严格虚岁，可能错位一年 | **已修复** | `daxian/index.ts:51-57` `xusuiAge`；`:415-425` 改用虚岁；`:216` 流年亦虚岁；`FLAG_DAXIAN_AGE_XUSUI` `:42,459`；`meta.agePolicy === "xusui"`（`iztro-compare.test.ts:403`）。残留：`FLAG_DAXIAN_AGE_SOLAR` 死常量（`:40`）；起限细则流派未声明 |
| Z-b | iztro 未固定 devDependency；未安装时对照仍通过，脚本未真正 diff | **已修复** | `package.json:43` `"iztro": "2.5.8"`（精确）；`iztro-compare.test.ts:416-430`（`IZTRO_REQUIRE=1` 强制失败）；`compare-iztro.mjs:130-146`（版本+许可证硬校验）、`:190-209`（真实 spawn + 读 exitCode）。**实测 exit 0 / passed** |
| Z-c | 三合/飞星/自化并存，缺流派命名空间与规则优先级 | **已修复** | `tables/constants.ts:15-18` `SCHOOL_CORE/SCHOOL_FEIXING`；`types/ziwei.ts:293-317` `school`/`schools{core,feixing,zihua}`/`rulePriority`；`compute.ts:93-98` 写入 `school`/`schools`，**`:100` 写入 `rulePriority`**；`compute.test.ts:108-111` 断言。**实测 `rulePriority = ["sanhe.core","sanhe.sihua","sanhe.zihua","feixing.flights","sanhe.daxian"]`**，core 居首与注释一致。残留：该数组无测试断言锁定（建议补） |
| Z-d | 流月流日属简化叠盘，需明确月界/日界/适用流派 | **部分修复** | 实现存在（`daxian/index.ts:292-355`）+ flags（`:48-49,462-463`）；但**月界（节气月 vs 农历月）与日界（公历日，未处理夜子时）未声明**；窗口为 ±1（`:303,335`），**非标准斗君叠盘**；`delta≠0` 时 `midDay` 硬编码 15（`:306`） |
| Z-e | 未知时辰不应输出唯一完整紫微盘，应进入多时辰校盘 | **已修复** | `compute.ts:292-314` `hourCandidates` + warning `:303`；`:122-124` 注释；`types/ziwei.ts:280` |

### §2.4 六爻专业性

| # | 原缺陷 | 判定 | 关键证据 |
|---|---|---|---|
| L-a | 时间起卦用梅花先天数再入纳甲，属混合方法，应独立标识 | **已修复** | `cast/method.ts:12-18` `meihua-time-to-najia`；`:20-27` methodNote 明写"混合方法"；`cast/build.ts:54,57` 写入 meta；`types/liuyao.ts:107`；`data/sources.ts:28-29`；`method.test.ts:18-22,49-60` |
| L-b | 六神/伏神/飞神/月破/暗动/旺相休囚/墓绝/进退/反伏吟未完整结构化 | **部分修复** | **已结构化**：六神（`liushen.ts` + 9 tests）、伏神（`fushen.ts`）、月破（`yuepo.ts`）、用神状态（`yongshen-status.ts`）、应期（`yingqi.ts`）、范围（`scope.ts`）。**未确认覆盖**：暗动、旺相休囚、墓绝、进退、反伏吟（本次审查未在这些文件中发现对应实现） |
| L-c | 用神主要依赖问题关键词，应增加问事类别/主体/性别/关系和用户确认 | **部分修复** | **已加**：类别（`yongshen.ts:40-54`，11 类）、性别（`:21,36,93-99,171-175`）、用户确认（`:166-168,222-249`）、爻位绑定（`:303`）。**仍缺**：主体/关系维度未细分（`other` 不细分六亲）；正则误命中无消歧（如 `parents` 含 `信息|消息` `:115`） |
| L-d | 动变仅描述本爻与化爻五行关系，缺回头生克/化进化退/化空化破/冲合转换 | **部分修复** | **已实现**：回头生克（`dongbian.ts:17-18,33-37,95-97`）、五行生克五值（`:55-63`）。**未实现**：化进化退（仅比五行 `:94`，无法区分寅化卯 vs 寅化午）、化空（未引用 kongwang）、化破（未引用 yuepo）、冲合转换（无地支冲合判断） |

---

## F. 应补充的金标准测试清单

> 格式：**输入值 → 期望输出**。所有条目均需在**声明流派**的测试标题中标注口径。
> 标注 `[外部]` 者需引入外部权威数据；`[内部]` 者为可自证的确定性断言（但仍应注明流派）。

### B-01 公历 1900 边缘年 `[内部]`
- **输入**：`solarDate: "1900-01-01"`, `birthTime: "12:00"`, 男
- **期望**：四柱成功产出（不抛错）；`flags` 不含异常；`pillars.year` 与上游 `getEightChar()` 一致
- **流派**：`ziping-default`（立春分年 / 节气分月）
- **验证点**：`parseSolarDate("1900-01-01")` 通过（`solar.ts:91` 边界包含 1900）

### B-02 公历 2100 边缘年 `[内部]`
- **输入**：`solarDate: "2100-12-31"`, `birthTime: "12:00"`
- **期望**：成功产出；`parseSolarDate("2101-01-01")` **抛错** /out of supported range/
- **流派**：同上

### B-03 边界外拒绝 `[内部]`
- **输入**：`"1899-12-31"`, `"2101-01-01"`
- **期望**：**均抛错**，error message 匹配 `/out of supported range/`
- **依据**：`solar.ts:91-93`

### B-04 农历闰月出生 `[内部]`
- **输入**：`lunarDate: "2020-4-15"`, `isLeapMonth: true`, `birthTime: "10:00"`
- **期望**：转换出的 `solarDate` 等于权威闰四月十五对应公历日（**需外部权威历表核验**）；`flags` 含闰月标记
- **流派**：农历月建（`lunar.ts:19` 负数月表示闰月）

### B-05 早子时 / 晚子时双解对照 `[内部 + 流派分歧显式化]`
- **输入**：`solarDate: "2000-01-01"`, `birthTime: "23:30"`
- **期望（当前 sect=1 口径）**：日柱 = 次日日柱（己未），`flags` 含 `night_zi`
- **期望（对照 sect=0 口径）**：日柱 = **当日**日柱（戊午）
- **要求**：测试须**同时断言两种口径的期望值**，并在标题写明「晚子时（sect=1，日柱换日）vs 早子时（sect=0，日柱不换）」，证明分歧**可复核**而非单解
- **依据**：`solar.ts:53` `eight.setSect(1)`；`policy.ts:11-12`

### B-06 十二节交节时刻 ±1 分钟（遍历 11 个非立春节） `[外部]`
- **输入**：对 立春/惊蛰/清明/立夏/芒种/小暑/立秋/白露/寒露/立冬/大雪/小寒 各取某年交节时刻 T，分别取 `T-1min` 与 `T+1min`
- **期望**：两者**月柱不同**（`-1min` 为前一月，`+1min` 为后一月）
- **流派**：节气分月
- **依据**：现有测试只覆盖立春（`boundary.test.ts:55-76`）与立夏 flag（`:46-53`），**未验证其他 10 节的实际月柱切换**

### B-07 真太阳时跨日 `[内部]`
- **输入**：`solarDate: "1990-05-15"`, `birthTime: "00:20"`, `useTrueSolarTime: true`, `birthPlace.lng = 87.6`（乌鲁木齐）
- **期望**：`calcTrueSolarTime` 返回 `dayDelta === -1`；`flags` 含 `true_solar_cross_day`；`warnings` 含跨日说明；**日柱与未校正时不同**
- **依据**：`solar-time/index.ts:100-104`；`bazi/index.ts:227-232` 已产生 `FLAG_TRUE_SOLAR_CROSS_DAY` 但 **golden 9 例中无一覆盖**

### B-08 中国夏令时期间告警 `[内部]`
- **输入 A**：`solarDate: "1988-06-15"`, `birthTime: "23:30"`, `useTrueSolarTime: true`, 上海 lng≈121.5
- **期望 A**：`flags` 含 `dst_not_modeled`；`warnings` 含"夏令时"；**额外期望**：给出若回溯 -1h 后的时柱作为对照候选
- **输入 B**：同 A 但 `useTrueSolarTime: false`
- **期望 B**：**当前实现不会产生任何 DST 提示 → 该用例应失败，从而暴露缺口**
- **流派**：`asia_shanghai_wall_clock`（`policy.ts:18`）
- **依据**：`dst-scope.test.ts` 仅 1 例且只测 1990+真太阳时

### B-09 大运交运日与 startYear 一致性（边界条件） `[内部]`
- **输入**：构造 `startAgeMonths` 接近 11–12 且**生日靠年末**（如 12 月出生）的用例，使 `addMonthsUtc(出生日 + years*12 + months)` 跨过日历年边界
- **期望**：`Number(step.startAt.slice(0,4)) === step.startYear`
- **实测说明**：对 `1990-05-15` 实测 MATCH0/MATCH1 **均为 true**（`startAt="1997-08-15"`、`startYear=1997`）→ **一般情形下二者一致**。仅当 `months` 使交运日跨年时才会不一致，故**必须构造年末+长余数用例**才能真正检验
- **流派**：子平「三日折一年、余数折月」
- **依据**：`dayun/index.ts:92-94, 160-161`

### B-10 起运余数临界 `[内部]`
- **输入**：构造 `diffDays = 2.9`（`raw=0.9667`）与 `diffDays = 3.1`（`raw=1.0333`）
- **期望**：前者 → `years=1, months=0`（因 `months=Math.round(0.9667*12)=12` → 进位）；后者 → `years=1, months=0`
- **期望（真正的"余数折月"口径）**：前者应为 `0年11月`，而非进位为 `1年0月`
- **要求**：测试须显式记录**采用哪种口径**，并在 `policy.ts` 增加对应字段
- **依据**：`dayun/index.ts:84-90`

### B-11 从强格 `[内部]`
- **输入**：日主五行占比 ≥ 0.45、support ≥ 3、drain ≤ 1 的命盘
- **期望**：`estimateStrength() === "从强"`；`favorable` 含日主五行与印；`layered.fuyi.note` 含"从强"
- **流派**：子平从格（从强/从弱）—— 需在测试标题声明从格判据阈值来源
- **依据**：`yongshen.ts:163`

### B-12 从弱格 `[内部]`
- **输入**：`ratio ≤ 0.12`、`!deDi`、`drain ≥ 3`、`support ≤ 1`
- **期望**：`=== "从弱"`；`favorable` 含财官食伤
- **依据**：`yongshen.ts:164`

### B-13 调候与扶抑冲突显式输出 `[内部]`
- **输入**：构造使 `tiaohouKeys` 与 `favorable` **无交集**的命盘
- **期望**：`layered.bingyao.disease` 含 `"调候与扶抑可能冲突"`；`medicines` 含调候五行
- **依据**：`yongshen.ts:208-211`

### B-14 调候表粒度一致性 `[内部]`
- **输入**：日主甲、月支寅
- **期望**：`reading/template` 的 `tiaohouHint("甲","寅")` 与 `bazi/yongshen` 的 `TIAOHOU_BY_MONTH["寅"]` **不产生相互否定的结论**，或明确标注二者粒度不同
- **依据**：`constants.tiaohou.test.ts:18-23` vs `yongshen.ts:52-65`

### B-15 五鼠遁双实现交叉一致性 `[内部]`
- **输入**：60 日干（十日干 × 六旬）× 12 时辰，穷举 720 组合
- **期望**：`hourStemFromDayStem(dayStem, branch)` === `computeRawPillars(...).hourStem`（**全部 720 例一致**）
- **依据**：`calendar/shichen.ts` 与 `solar.ts:52` 双实现

### B-16 十二时辰敏感性完整性 `[内部]`
- **输入**：`buildHourSensitivityReport("1990-05-15")`
- **期望**：`candidates.length === 12`；`dayPillarVariants.length === 2`（因夜子时换日）；`hourPillarVariants.length === 12`；`candidates` 覆盖全部 12 地支
- **依据**：`sensitivity.ts:26-69`

### B-17 紫微大限虚岁边界 `[内部]`
- **输入**：出生年 Y，分析基准年 Y（虚岁 1）、Y+1（虚岁 2）、Y+9（虚岁 10）、Y+10（虚岁 11）
- **期望**：`xusuiAge(Y, Y) === 1`；水二局起限 → 虚岁 1 岁**不落任何大限**（`currentDaxianIndex === -1`），虚岁 2 落 `index 0`
- **流派**：三合（`sanhe`）+ 严格虚岁
- **依据**：`daxian/index.ts:51-57, 103-110, 415-425`

### B-18 紫微 `rulePriority` 内容锁定 `[内部]`
- **输入**：任意紫微盘
- **期望**：`chart.meta.rulePriority[0] === "sanhe.core"`；且 `"feixing.flights"` 的索引 **大于** `"sanhe.core"` 的索引
- **现状**：**该字段已填充**（实测 `["sanhe.core","sanhe.sihua","sanhe.zihua","feixing.flights","sanhe.daxian"]`），但**无测试断言其内容/顺序** → 本用例用于**锁定**，防止后续重排导致事实层优先级倒置
- **依据**：`compute.ts:100`；`types/ziwei.ts:313-317`

### B-19 紫微辅星/亮度/四化外部对照 `[外部]`
- **输入**：8 个 golden case
- **期望**：`minorStars` / `brightness` 与 `iztro` 对照一致（**需先扩展 `comparedFields`**，或明确声明"无外部背书"）
- **依据**：`iztro-compare.test.ts:40-47` `excludedFields`

### B-20 紫微 golden 用例数契约 `[内部]`
- **输入**：`ziweiGoldenCases`
- **期望**：`ziweiGoldenCases.length === CONTRACT.fixture.expectedCaseCount`（当前均为 8）
- **依据**：`compare-iztro.mjs:39` 的 `expectedCaseCount: 8` 仅输出未断言

### B-21 紫微流月月界声明 `[内部]`
- **输入**：`2026-03-15`（跨惊蛰）
- **期望**：`liuyue` 各项含明确的 `boundaryPolicy: "solar_term_month"`（或等价字段）；且测试断言该字段存在
- **预期结果**：**当前失败**（无该字段）→ 暴露 Z-d
- **依据**：`daxian/index.ts:262-275`（用 `getMonthGan/Zhi`，即节气月）

### B-22 紫微流日夜子时处理 `[内部]`
- **输入**：基准日 `2026-03-15`，构造使 `dayGanZhi` 跨夜子时
- **期望**：明确声明流日日界（公历日 0 点 或 夜子时 23 点换日），并有一致断言
- **依据**：`daxian/index.ts:277-290`（用 `Solar.fromYmd`，未处理夜子时）

### B-23 六爻变卦穷举 `[内部]`
- **输入**：64 卦 × 64 种动爻组合（`2⁶ = 64`）= **4096 组合**
- **期望**：每种组合的 `bianGua` 正确（逐爻取反）；`toBianValues` 确定性；动变生克结果确定
- **要求**：这是**原文要求的"64 卦 × N 变爻"**，当前覆盖度为 **0%**

### B-24 化进化退 `[内部]`
- **输入**：动爻 寅（木）化 卯（木）；动爻 卯（木）化 寅（木）；动爻 巳（火）化 午（火）
- **期望**：前者 → `"化进神"`；中间 → `"化退神"`；后者 → `"化进神"`
- **预期结果**：**当前失败**（未实现）→ 暴露 L-d
- **流派**：增删卜易/卜筮正宗 进神退神

### B-25 化空 `[内部]`
- **输入**：日干支使旬空为 X、Y；动爻化出之支 ∈ {X, Y}
- **期望**：`DongBianItem` 增加 `huakong: true` 字段并输出
- **预期结果**：**当前失败**（未实现）

### B-26 化破 `[内部]`
- **输入**：月建支 M；动爻化出之支 = M 之对冲支
- **期望**：`huapo: true`
- **预期结果**：**当前失败**（未实现）

### B-27 冲合转换 `[内部]`
- **输入**：动爻支与化爻支构成六冲（子午/丑未/寅申/卯酉/辰戌/巳亥）或六合（子丑/寅亥/卯戌/辰酉/巳申/午未）
- **期望**：`chonghe: "六冲" | "六合" | "无"`
- **预期结果**：**当前失败**（未实现）

### B-28 旬空推法穷举 `[内部]`
- **输入**：60 甲子日干支全枚举
- **期望**：每个日干支的 `xunKongOfDay` 与通行旬空表一致（甲子旬空戌亥 … 甲寅旬空子丑），**6 旬 × 10 日 = 60 例全通过**
- **依据**：`kongwang.ts:61-70, 73-92`（表正确，但**未见 60 例穷举测试**）

### B-29 六神起法穷举 `[内部]`
- **输入**：10 日干
- **期望**：甲乙→初爻青龙；丙丁→朱雀；戊→勾陈；己→螣蛇；庚辛→白虎；壬癸→玄武；且六爻顺序 = 青龙→朱雀→勾陈→螣蛇→白虎→玄武
- **依据**：`liushen.ts:32-43`（表正确；`liushen.test.ts` 9 tests 需确认是否覆盖全部 10 干）

### B-30 用神类别消歧 `[内部]`
- **输入**：问题文本含**跨类别关键词**，如「等他消息」（`parents` 含 `信息|消息` `yongshen.ts:115`）
- **期望**：明确该场景的期望类别与规则 id，或引入 `questionCategory` 确认后结果变更
- **要求**：测试须记录**误命中风险**并给出消歧口径

### B-31 月破定义 `[内部]`
- **输入**：月建支 = 子（月破为午）；月建 = 寅（月破为申）
- **期望**：`yuepo` 判定正确，且 `data/sources.ts` 增加月破来源条目
- **注**：本次审查**未逐行核验 `yuepo.ts`**，需补充来源声明

### B-32 三引擎信封统一 `[内部]`
- **输入**：同一出生信息分别跑三引擎
- **期望**：三盘 `meta` **均含** `schemaVersion` / `engineVersion` / `ruleSetVersion` / `school` / `calendarPolicy` / `warnings` / `evidence`，且类型定义统一
- **预期结果**：**当前失败**（六爻缺 4 项；`inputFingerprint` 三引擎全缺）→ 暴露 D.1

### B-33 输入指纹 `[内部]`
- **输入**：`BirthProfile`
- **期望**：`chart.meta.inputFingerprint` 为确定性哈希；同输入同指纹、异输入异指纹；可在 `stripAuthorityInput` 后仍保留
- **预期结果**：**当前失败**（无该字段）→ 暴露 D.1

### B-34 历法依赖版本锁定 `[内部]`
- **输入**：`package.json`
- **期望**：`dependencies["lunar-javascript"]` 为**精确版本**（无 `^`）
- **预期结果**：**当前失败**（`^1.7.7`）→ 暴露 D.3

### B-35 节气时刻外部核验 `[外部]`
- **输入**：选定年份的权威节气表（如紫金山天文台/香港天文台发布）
- **期望**：引擎给出的交节时刻与权威表**逐分一致**（容差 ≤ 1 分钟）
- **备注**：本仓 golden L05 注释自述「1990 立夏约 05-06 02:35」（`__fixtures__/index.ts:105`）**未经外部核验**，须以外部表替换

---

## G. 结论与优先级建议

### 仍未修复的缺陷数

按原始缺陷清单（§2.2 6 条 + §2.3 5 条 + §2.4 4 条 = **15 条**）判定：

| 判定 | 数量 | 条目 |
|---|---|---|
| **已修复** | **9** | B-a、B-c、B-f、Z-a、Z-b、Z-c、Z-e、L-a +（B-e 的经度建模部分）；**详见下方按 15 条原缺陷的严格计数** |
| **部分修复** | **5** | B-b、B-e、Z-d、L-b、L-c、L-d |
| **仍存在** | **1** | **B-d（起运仍按整岁）** |
| **无法确认** | **1** | D.3（`lunar-javascript` 已知错误需外部验证，非原缺陷清单条目） |

> **严格按 15 条原缺陷计**：**已修复 8 条**（B-a、B-c、B-f、Z-a、Z-b、Z-c、Z-e、L-a）、**部分修复 6 条**（B-b、B-e、Z-d、L-b、L-c、L-d）、**仍存在 1 条**（B-d）。
> 若把"部分修复"中未闭合的核心子项视为未修复，则**实质未闭合缺陷为 7 个**：
> 1. **B-d** 起运仍按整岁（P1，唯一判定为"仍存在"）
> 2. **B-b** 月令司令未实现（已声明，P2）
> 3. **B-e** 历史 DST 未建模且未开启真太阳时时无提示（P1）
> 4. **Z-d** 流月流日无月界/日界/流派声明（P1）
> 5. **L-b** 暗动/旺相休囚/墓绝/进退/反伏吟未确认完整结构化（P1）
> 6. **L-c** 用神"主体/关系"维度缺失 + 关键词误命中（P2）
> 7. **L-d** 化进化退/化空/化破/冲合转换未实现（P1）
>
> 加上跨引擎 **D.1 信封不统一 + `inputFingerprint` 全缺**（P1）与 **D.3 依赖未锁定**（P1），共 **9 项 P1**。

### 最严重的三个发现

1. **【八字 B-d】起运精确到月的信息被计算出来，却没有驱动正式大运分档** —— `dayun/index.ts:226` 仍用 `Math.round(diffDays/3)` 取整岁，`step.startAge/endAge/startYear` 全部基于整岁（`:152-164`），`currentDayunIndex` 用周岁整年比较（`:236-247`）。`startAt`（精确到日）**只是展示字段**。更糟的是 **`dayun.test.ts:20-23` 把整岁起点写成了期望值**，使缺陷被"测试固化"。这是原始缺陷清单中**唯一可机器判定为"仍存在"**的条目。

2. **【六爻 L-d】动变分析只做了五行层面的回头生克，进/退/空/破/冲合全部缺失** —— `dongbian.ts:94` 仅比对 `from.wuxing` 与 `to.wuxing`，因此「寅化卯」（化进神）与「寅化午」在代码眼中都是 `"动生化"`，**无法区分**；且 `dongbian.ts` **未 import `kongwang` / `yuepo`**，变爻的空破状态完全未判。穷举测试也**只覆盖本卦 64 × 6 爻 = 384 点，变卦 4096 组合覆盖度为 0%**（`palace-exhaustive.test.ts` 全文无变卦断言）。

3. **【跨引擎 D.1】统一信封未落地：`inputFingerprint` 三引擎全缺，六爻还缺 4 个版本字段** —— 八字有 `schemaVersion`/`ruleSetVersion`/`calendarPolicy`（对象）/`evidence`；紫微有 `schools` 命名空间 + `agePolicy` 但 `calendarPolicy` 退化为字符串；六爻**只有 `engineVersion`**，`ruleSetVersion` 仅存在于 `LIUYAO_DATA_SOURCES` 常量（`data/sources.ts:38`）而**未写入 `chart.meta`**，`warnings`/`evidence`/`school`（命名不同）均缺。叠加 `lunar-javascript` 使用 `^1.7.7` 范围版本（`package.json:27`），**"解读基于哪版规则"与"输入是哪份"都无法事后核验**。

### 值得肯定的已修复项（避免误伤）

- **iztro 对照是真实的外部 oracle**：实测 `node scripts/compare-iztro.mjs` **exit 0 / passed**，精确锁定 `iztro@2.5.8` + 许可证校验 + `allowedDifferences: []` 零容忍差分，且脚本真实 `spawnSync` 读子进程 exit code（非空跑）。
- **来源诚实性**：八字 golden 主动断言 `FIXTURE_META.source === "engine-regression"`（`golden.test.ts:6-11`），紫微 oracle 声明 `role: "project-selected input vectors; not external evidence"`（`compare-iztro.mjs:37`），六爻声明爻辞"非原文逐字"（`data/sources.ts:10`）—— **没有一处冒充外部权威**。
- **流派命名空间**：紫微已引入 `schools{core,feixing,zihua}`（`types/ziwei.ts:308-312`），六爻已引入 `castingSchool` 三值（`cast/method.ts:12-18`），八字已引入 `school: "ziping-default"`（`policy.ts:9`）。
- **三引擎农历转换共用同一实现**：紫微直接 `import ... from "@/lib/bazi/calendar"`（`ziwei/calendar.ts:8-13`），**无口径分裂**。
- **六爻本卦侧穷举扎实**：64 卦 + 384 爻位 + 128 世应点 + 48 纳甲支 **100% 覆盖**，且数据由 `bin()` 程序化生成（`hexagrams.ts:10-17`）而非手抄。

---

*报告完。本次审查严格只读：未修改任何文件，未执行 npm install。所有 `文件:行号` 引用均基于当前工作区状态。* 
*凡涉及典籍依据之处，仅复述仓库内自述来源；未在仓库中找到依据的，一律标注"无法确认"或"未声明"，未作臆断。*
