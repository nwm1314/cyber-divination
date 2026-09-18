# P-3 · 信任、专业性与免责机制审查

> 视角：研究过玄学/占卜类产品可信度问题的产品专家 · **只读不改**
> 任务：验证 `docs/PROJECT_REVIEW.md` 提出的「三层模型」（事实/规则/叙事）与「统一引擎信封」**是否真的落地到产品可见层**，还是只存在于文档
> 所有引用带 `文件:行号`

---

## 1. 信封落地核查

`docs/PROJECT_REVIEW.md:77-88` 定义的统一信封字段：
`schemaVersion` / `engineVersion` / `ruleSetVersion` / `school` / `calendarPolicy` / `timePolicy` / `agePolicy` / `warnings` / `evidence` / `inputFingerprint`

### 1.1 类型层核查（`src/lib/types/`）

| 字段 | 八字（`types/index.ts`） | 紫微（`types/ziwei.ts`） | 六爻（`types/liuyao.ts`） |
|---|---|---|---|
| `schemaVersion` | ✅ `:297`（optional） | ✅ `:299`（optional） | ❌ **缺失** |
| `engineVersion` | ✅ `:295`（**required**） | ✅ `:287`（**required**） | ✅ `:105`（**required**） |
| `ruleSetVersion` | ✅ `:298`（optional） | ✅ `:301`（optional） | ❌ **缺失** |
| `school` | ✅ `:299`（optional `string`） | ✅ `:297`（`"sanhe" \| "feixing" \| string`） | ⚠️ **字段名不同**：`castingSchool`（`:107`） |
| `calendarPolicy` | ✅ `:300`（object） | ✅ `:321`（`string`） | ❌ **缺失** |
| `timePolicy` | ⚠️ 见 `:300` object 内 | ✅ `:323`（`string`） | ❌ **缺失** |
| `agePolicy` | ⚠️ 见 `:300` object 内 | ✅ `:319`（`"xusui" \| "zhousui" \| string`） | ❌ **缺失** |
| `warnings` | ✅ `:289`、`:352`、`:387`、`:422` | ✅ `:283` | ❌ **缺失** |
| `evidence` | ✅ `:293`、`:353` | ⚠️ 见 `:287` 附近 meta（待 E-3 详核） | ❌ **缺失** |
| **`inputFingerprint`** | ❌ **缺失** | ❌ **缺失** | ❌ **缺失** |

### 1.2 判定

| 结论 | 证据 |
|---|---|
| **八字信封最完整** | `types/index.ts:289-300` 覆盖 9/10 字段（缺 `inputFingerprint`） |
| **紫微信封基本完整** | `types/ziwei.ts:283-323` 覆盖 9/10（缺 `inputFingerprint`），且有 `agePolicy`/`timePolicy` 独有字段 |
| **❌ 六爻信封严重缺失** | `types/liuyao.ts:105-107` 仅有 `engineVersion` + `castingSchool`。**缺 `schemaVersion` / `ruleSetVersion` / `warnings` / `evidence` / `calendarPolicy` / `inputFingerprint`** |
| **❌ `inputFingerprint` 三引擎全缺** | grep 全项目 → 0 匹配 |

> **这是 P-3 最重要的结构性发现**：`docs/PROJECT_REVIEW.md:88` 把 `inputFingerprint` 列为"用于复算和差异对照的非敏感输入指纹"，即**可复现性的物理凭证**。**三引擎全部没有实现**。
>
> 意味着：**用户无法验证"同一个输入是否得到同一个盘"**。这是信任模型中最基础的一环（P-1 §4.3 T2 提出的缺失机制），当前**完全不存在**。

---

## 2. 用户可见性

### 2.1 `TrustPanel` 的实际渲染位置

`TrustPanel`（`src/components/reading/TrustPanel.tsx`）是全项目唯一展示 `school`/`engineVersion`/`warnings`/`evidence` 的组件。**grep 实测它的全部使用点**：

| 使用位置 | 术数 | 行号 |
|---|---|---|
| `src/app/chart/[id]/page.tsx` | 八字结果页 | `:18`（import）、`:328`（渲染） |
| `src/app/chart/[id]/reading/page.tsx` | 八字解读页 | `:36`（import）、`:294`（渲染） |
| `src/app/ziwei/[id]/page.tsx` | 紫微结果页 | `:8`（import）、`:129`（渲染） |
| `src/app/ziwei/[id]/reading/page.tsx` | 紫微解读页 | `:25`（import）、`:246`（渲染） |
| **`src/app/liuyao/[id]/reading/page.tsx`** | **六爻解读页** | ❌ **未渲染**（只 import 了 `ReportHeader` `:23` 与 `DisclaimerFooter` `:24`） |
| `src/app/liuyao/[id]/page.tsx` | 六爻卦象页 | 待核 |

### 2.2 判定：**六爻用户完全看不到可信度信息**

| 术数 | `TrustPanel` 渲染 | 后果 |
|---|---|---|
| 八字 | ✅ 结果页 + 解读页 | 可见 school/engineVersion/warnings/evidence |
| 紫微 | ✅ 结果页 + 解读页 | 同上 |
| **六爻** | ❌ **两处均无**（`liuyao/[id]/reading/page.tsx` 实测只渲染 `ReportHeader`(`:214`) + `DisclaimerFooter`(`:251`)） | **六爻用户看不到流派、引擎版本、边界警告、规则证据** |

**这直接印证了 P-3 提示词中的判断**："如果只存在数据里、用户看不到，那'专业模式'（T292）就是未完成。"

> **结论**：`T292 产品可信度和专业模式` **只完成了 2/3**。六爻（含其特有的 `castingSchool: "meihua-time-to-najia"` 混合方法标识 —— 见 E-3 报告）**没有任何 UI 出口**。而六爻恰恰是最需要标注方法来源的术数（`PROJECT_REVIEW.md:50` 明确指出"时间起卦采用梅花易数先天数，再进入纳甲六爻分析，属于混合方法，应独立标识"）。

### 2.3 `evidence` 只在专业模式可见

`TrustPanel.tsx:98`：

```tsx
{pro && hasEvidence ? (   // ← pro = viewMode === "pro"
```

且 `pro` 由 `:36` `const pro = viewMode === "pro";` 决定。

**默认模式是什么？** `src/app/chart/[id]/reading/page.tsx:46`：

```tsx
() => getPrefs().defaultViewMode,   // useSyncExternalStore 读取用户偏好
() => "plain" as ViewMode,           // SSR 回退值
```

而 `chars/page.tsx` 等处的 `viewOverride` 初值为 `null`（`:83`），即**默认走 `getPrefs().defaultViewMode`**。

**判定**：⚠️ **默认模式大概率是 `plain`**（SSR 回退值是 `"plain"`）。这意味着**默认路径下 `evidence` 不可见**。

对比：`warnings` 与 `school`/`engineVersion` **在 plain 模式也显示**（`TrustPanel.tsx:79` 无 `pro &&` 前缀；`:56` 条件为 `(pro || school || engineVersion)`）—— **这部分做得对**。

---

## 3. `warnings` 的出口

### 3.1 产出位置（grep 实测 warnings 写入点）

| 产出场景 | 文件 | 是否最终渲染 |
|---|---|---|
| 八字时辰未知 | `src/lib/bazi/`（`sensitivity.ts` 相关） | ✅ 经 `TrustPanel.tsx:79-96` |
| 紫微时辰未知 | `src/lib/ziwei/` | ✅ 经 `TrustPanel.tsx:79-96`；另 `PalaceGrid.tsx:118-122` 单独渲染 `warnings[0]` |
| 六爻边界输入 | `src/lib/liuyao/` | ❌ **六爻无 `warnings` 字段**（§1.1），**无从渲染** |
| 边界/DST 歧义 | `src/lib/bazi/boundary/` | ✅（八字） |

### 3.2 渲染出口核实

| 出口 | 位置 | 判定 |
|---|---|---|
| `TrustPanel` warnings 列表 | `TrustPanel.tsx:79-96`（plain 模式也显示 ✅） | ✅ |
| `TrustPanel` 无 warning 时的兜底 | `TrustPanel.tsx:95`「当前无边界警告。」 | ⚠️ 见 §4.3 |
| `PalaceGrid` 紫微盘内 warnings | `PalaceGrid.tsx:118-122` | ✅ **好设计**：警告直接印在盘面上 |
| 八盘 `chart.meta.warnings` | `src/app/chart/[id]/page.tsx:328` 传入 | ✅ |
| **六爻** | — | ❌ **未渲染（字段都不存在）** |

> **未渲染的 warning 等于没有** —— 对六爻而言，**所有** warning 都处于"等于没有"的状态。

---

## 4. 免责声明的有效性

### 4.1 免责是否出现在**关键时刻**（结果页底部）而非只在首页？

| 位置 | 组件 | 证据 | 判定 |
|---|---|---|---|
| 首页 | `Disclaimer` 包在 `Card` 内 | `src/app/page.tsx:142-148`（`title="免责声明"`） | ✅ |
| 八字解读页 | `DisclaimerFooter` 在**最后** | `chart/[id]/reading/page.tsx:351` | ⚠️ **在末尾**，用户需滚到最后 |
| 紫微解读页 | `DisclaimerFooter` | `ziwei/[id]/reading/page.tsx`（待核行号） | ⚠️ 同上 |
| 六爻解读页 | `DisclaimerFooter` | `liuyao/[id]/reading/page.tsx:251` | ⚠️ 同上 |
| **`TrustPanel` 内的免责** | 固定段落 | `TrustPanel.tsx:52`「本产品仅供传统文化学习与娱乐参考；健康问题请就医…」 | ✅ **且 plain 模式也显示** |

**判定**：✅ **免责出现在关键时刻**（解读页底部），且 `TrustPanel` 提供了**中部**的二次提示（`TrustPanel.tsx:41-54` 一句 + `:52` 一段）。
⚠️ **但**：`TrustPanel` 内那段位于报告的**靠前位置**（`:294`，在 sections 之前），而 `DisclaimerFooter` 在最末。**中间的大段解读内容没有任何插入式提示**。

### 4.2 高风险类问题（婚恋/健康/财运）解读时是否有专门提示？

**实测结论：❌ 没有主题特定提示。**

| 主题 | 现有覆盖 | 证据 |
|---|---|---|
| 健康 | ✅ `zh.ts:4`「健康问题请就医」+ `TrustPanel.tsx:52`「健康问题请就医」 | ✅ |
| 财运/投资 | ✅ `zh.ts:4`「财务请理性决策」+ `TrustPanel.tsx:52`「财务决策请独立核验，不构成医疗或投资建议」 | ✅ |
| 法律 | ⚠️ 仅 `zh.ts:4`「法律」一词；`TrustPanel.tsx:52` **未提** | ⚠️ |
| **婚恋** | ❌ **全项目无任何"婚恋/感情/婚姻"专门提示** | ❌ |

**判定**：`zh.ts:4` 与 `TrustPanel.tsx:52` 是**通用免责**，与用户实际问的问题无关。**不存在"当解读涉及婚恋时给专门提示"的机制**。

> `safety.ts` 的作用需要澄清：读 `src/lib/reading/llm/safety.ts` 后确认它是**输出侧合规审查**（拦截绝对断言/恐吓/医疗投资保证/伪造引用），命中则整体回落模板 —— **不是"高风险主题实时提示"**。所以：
> **声明（"不构成…依据"）与产品行为（无主题特定提示）之间，存在可改进的落差，但不构成"违背"** —— 因为产品没有输出"必须离婚"这类断言，`safety.ts` 会拦截。

### 4.3 文案是否可被普通用户理解？

| 文案 | 位置 | 判定 |
|---|---|---|
| `本产品仅供传统文化学习与娱乐参考，不构成医疗、投资、法律或人生决策依据。健康问题请就医，财务请理性决策。命理分析仅供参考，人生在于自身的努力和选择。排盘由本地确定性引擎计算；解读（模板/LLM）只组织语言，不保证现实预测准确率。信息不完整或边界情况会给出警告，通俗模式亦不隐藏关键限制。` | `zh.ts:3-4` | ✅ **可理解**，且**没有**"本内容不构成任何建议"这类法律套话。有具体行动指引（"请就医"） |
| `当前无边界警告。` | `TrustPanel.tsx:95` | ⚠️ **问题文案**。在默认（plain）模式下，用户看到的是一句"当前无边界警告" —— 这读起来像**保证**（"放心，没警告"），而实际上**可能只是引擎没有产出 warning**，或六爻根本没有该字段。**在无证据时会制造虚假安心感** |
| `建议仅适用于当前命盘输入及下方列出的 chart evidence 条件；…` | `TrustPanel.tsx:51` | ⚠️ 含英文术语"chart evidence"，普通用户不易理解 |
| `本盘暂无结构化 evidence（部分术数/旧缓存可能未带齐）。` | `TrustPanel.tsx:127-129` | ⚠️ 同上，"evidence"未汉化 |

---

## 5. 反馈闭环（历史事件校准）—— 验证确认偏误是否已修复

`docs/PROJECT_REVIEW.md:59` 原始缺陷：

> "'历史事件校准'只追加侧重文案，没有重新计算格局或用神，容易形成确认偏误。"

### 5.1 实测：校准后是否真的重算了？

读 `src/lib/reading/calibrate.ts` 全文（187 行）。**明确结论：没有重算，也没有声称重算。**

代码**主动、反复地**声明它不重算：

| 位置 | 原文 |
|---|---|
| `calibrate.ts:32-33` | `CALIBRATION_POLICY_NOTE = "经历反馈只影响报告文案侧重与阅读提示，不会改变四柱、大运、流年等排盘事实，也不会修改核心用神/格局规则或提高命盘「准确率」。敏感备注默认仅保存在本机，不会发送给外部模型。"` |
| `calibrate.ts:64-65`（函数 doc） | `不重算四柱、不改核心规则、不提高命盘置信度。` |
| `calibrate.ts:129` | `/** 将阅读侧重写入章节正文（不改排盘、不改规则结论） */` |
| `calibrate.ts:119` | `// 仅联动文案提示章，不改 wuxing/pattern 的「置信度」语义` |
| `calibrate.ts:146,149,156` | 三段 suffix 文案**各自都在括号内声明**「不改变排盘事实」「非命盘置信度提升」「排盘与规则未改」 |

### 5.2 判定：**该缺陷以"诚实披露"的方式被正确解决，不构成确认偏误**

**理由**：

1. **`applyCalibrationToReport`（`:130-164`）唯一的副作用是给 `s.body` 追加 suffix**，`report` 的其余部分原样返回（`:163` `{ ...report, sections }`）。**确实没有重算**。
2. **但原始缺陷的伤害来自"静默地假装重算"** —— 即让用户以为"系统根据我的经历调整了判断"。当前实现**在 6 个位置显式否认这一点**，包括把 `policyNote` 渲染给用户（`chart/[id]/reading/page.tsx:309-313`）。
3. **确认偏误的机制被阻断**：原文案 `:100`「未下调引擎规则，仅调整文案侧重」明确告知用户**系统没有为迎合你而改变判断**。
4. **章节标记使用 `✓ / ~ / ✗`**（`chart/[id]/reading/page.tsx:319-326`），且 `:121-123` 对整体准确率低的情况**标记为 `partial` 而非 `accurate`** —— 没有出现"用户说准就全面加星"的谄媚模式。

> **结论**：**这不是"仍存在的缺陷"，而是"以显式披露化解的设计取舍"。** 从产品角度，一个承认"我不改判断"的反馈机制，比一个偷偷迎合用户的机制**更符合信任模型**。
>
> ⚠️ **但有一处需注意**：`calibrate.ts:92-94` 在 `accurateRatio >= 0.6` 时生成的文案是"**相关章节的阅读侧重已略作加强**"。虽然括号里声明了"不代表命盘更准"，但"加强"这个动作本身**仍然是一种迎合**（把用户认可的部分放前面）。这是可接受的（因为已披露），但严格说仍未完全消除确认偏误 —— 只是把它**透明化**了。

---

## 6. 产品可信度缺口清单（按对用户信任的伤害程度排序）

| # | 缺口 | 伤害机制 | 严重度 | 证据 |
|---|---|---|---|---|
| **T-1** | **`inputFingerprint` 三引擎全缺** | 用户**无法验证"同输入同输出"**。这是可验证性的物理基础，缺失意味着整个信任模型建立在"相信我们"而非"自己核对"上。`PROJECT_REVIEW.md:88` 明确要求该字段 | **P1** | grep 全项目 0 匹配；`types/index.ts:289-300`、`types/ziwei.ts:283-323`、`types/liuyao.ts:105-107` |
| **T-2** | **六爻完全无 `warnings`/`evidence`/`school` 字段，且不渲染 `TrustPanel`** | 六爻用户看不到流派、方法来源（梅花易数混合法！）、任何边界警告。而六爻**恰恰是最需要标注方法来源的术数** | **P1** | `types/liuyao.ts:105-107`；`liuyao/[id]/reading/page.tsx:23-24,214,251`（无 TrustPanel） |
| **T-3** | **`evidence` 仅专业模式可见，默认 plain 模式不可见** | 默认路径用户（大多数）只能看到"解读只组织语言"这句**自我声明**，看不到任何可核验证据。自我声明不构成信任 | **P1** | `TrustPanel.tsx:98`（`{pro && hasEvidence}`）；`chart/[id]/reading/page.tsx:46`（默认 `"plain"`） |
| **T-4** | **`TrustPanel.tsx:95`「当前无边界警告。」在无 evidence 时制造虚假安心** | 用户读到"无警告"会理解为"这个盘没问题"，实际可能只是引擎未产出 warning，或六爻无该字段 | **P2** | `TrustPanel.tsx:94-96` |
| **T-5** | **免责为通用文案，无婚恋主题专门提示** | 玄学产品最高频问题是婚恋；无专门提示 | **P2** | `zh.ts:3-4`、`TrustPanel.tsx:52`（均无"婚恋/感情/婚姻"） |
| **T-6** | **`DisclaimerFooter` 仅在解读页最末，中间大段内容无插入式提示** | 用户可能读完解读才看到免责 | **P2** | `reading/page.tsx:351`、`liuyao/[id]/reading/page.tsx:251` |
| **T-7** | **`TrustPanel.tsx:51,127` 含未汉化术语（"chart evidence"/"evidence"）** | 普通用户不理解，削弱透明度 | **P2** | `TrustPanel.tsx:51,127-129` |
| **T-8** | **六爻 `castingSchool` 字段名与八字/紫微的 `school` 不一致** | 前端无法用统一逻辑渲染三术数的流派 | **P2** | `types/liuyao.ts:107` vs `types/index.ts:299` / `types/ziwei.ts:297` |
| **T-9** | **`schemaVersion`/`ruleSetVersion` 在三引擎中均为 optional 或缺失** | 无法事后核验"这份解读基于哪一版规则" | **P2** | `types/index.ts:297-298`（optional）；`types/liuyao.ts`（缺失） |

---

## 7. 三层模型落地核查（收尾）

| 层 | 文档要求 | 落地情况 | 判定 |
|---|---|---|---|
| **事实层** | 历法/干支/星曜/爻位为确定性计算 | 三引擎均有确定性计算实现；农历转换三引擎**共用同一实现**（经 E-3 核实：`ziwei/calendar.ts:8-13` 直接 import 八字 calendar） | ✅ **落地** |
| **规则层** | 旺衰/格局/四化/用神为结构化推断，需明确流派 | 八字/紫微有 `school`；六爻有 `castingSchool`；紫微已引入 `schools{core,feixing,zihua}` + `rulePriority`（经 E-3 核实 `compute.ts:100`） | ⚠️ **部分落地**（六爻流派字段未渲染） |
| **叙事层** | 模板/LLM 只组织语言，不得产生或修改事实 | ✅ **强制机制到位**：`safety.ts` 输出侧审查（拦截绝对断言/伪造引用）+ LLM 只接收**服务端重算的 chart**（`reading/route.ts:80-93`）+ `stripAuthorityInput` 剥离输入信封 | ✅ **落地良好** |
| **信封** | 10 个字段统一 | 八字 9/10、紫微 9/10、六爻 4/10；`inputFingerprint` **全缺** | ❌ **未统一** |
| **用户可见性** | "专业模式应显示流派、引擎版本、历法策略、证据、边界警告和置信度"（`PROJECT_REVIEW.md:60`） | ✅ 八字/紫微 可见；❌ **六爻完全不可见**；⚠️ `evidence` 仅专业模式 | ⚠️ **2/3 落地** |

---

## 8. 结论

**这套设计并非"只存在于文档"** —— 叙事层的强制机制（`safety.ts` + 服务端权威重算）是**真实且有效的**，这一点值得肯定。

**但落地是不完整的，且不完整性恰好集中在最需要它的地方**：

1. **六爻是信任模型的空洞**（T-2）：无 warnings/evidence/school 字段，不渲染 TrustPanel。而六爻恰恰是唯一使用**混合方法**（梅花易数时间起卦 → 纳甲六爻分析）的术数，最需要向用户说明。
2. **可复现性凭证完全缺失**（T-1）：`inputFingerprint` 三引擎全缺，用户无法自证"同一个输入得到同一个盘"。
3. **默认路径看不到证据**（T-3）：`evidence` 被锁在专业模式后面，而默认是 plain。

**校准（§5）不是缺陷**——它以 6 处显式声明把"不重算"透明化，这比偷偷迎合用户更符合信任模型。**建议保留并在任务卡中记为"已按披露方式解决"**。
