# D-2 · 关键页面体验走查（重点：移动端）

> 视角：资深移动端交互设计师 · **只读不改**
> 依据：代码类名与结构推理（**未跑 dev server 截图**，符合提示词要求）
> 目标视口：**375 × 667**（iPhone SE/8 基准）
> ⚠️ 凡标注「需真机验证」的结论，均为静态推理无法定论项，汇总于 §7

---

## 1. 首页 `/`（`src/app/page.tsx`）

### 1.1 首屏信息层级

3 秒内可见（375px 宽，`flex-1 justify-center` 垂直居中）：

| 顺序 | 元素 | 字号 | 证据 |
|---|---|---|---|
| 1 | tagline `专业排盘 · 典籍约束解读` | `text-sm`(14px) cyan | `:88-90` |
| 2 | **h1** `把传统术数写成 / 可读的赛博报告` | `text-3xl`(30px) | `:91-95` |
| 3 | heroDesc | `text-base`(16px) `sm:text-lg` | `:96-98` |
| 4 | **术数卡片区**（3 张，`grid gap-4 sm:grid-cols-3`） | — | `:111-115` |

**主 CTA 是否明确？** ✅ **明确**。三张卡片本身就是 CTA（`ArtCard` 内的 `span` 视觉上是按钮，整卡可点 —— `Link` 包裹 `Card`，`:56-69`）。卡片按钮文案分别为"开始排盘"/"排紫微盘"/"起一卦"（`zh.ts:45,54,63`）。

### 1.2 移动端适配

| 检查项 | 结果 | 证据 |
|---|---|---|
| 卡片在 375px 下布局 | `grid gap-4 sm:grid-cols-3` → 375px 时 **单列堆叠** ✅ | `:111` |
| h1 `text-3xl`(30px) 是否溢出 | 30px × 中文，`max-w-3xl` 容器（`safe-pad` 内约 343px 可用宽）→ 单行约 11 字，`把传统术数写成` 7 字 ✅ 不溢出 | `:86,91` |
| 底部按钮组 `flex-col sm:flex-row` | 375px 时**单列** ✅，但按钮 `w-full sm:w-auto` + `h-12`（48px）✅ 达触摸标准 | `:118-136` |
| ⚠️ 首屏是否过挤 | 首页内容垂直居中（`justify-center`）且**无 `min-h-dvh`**（D-1 §5 不一致 #1）。375×667 下 3 张卡片 + 免责声明卡片 + footer 必然**超出首屏**，需滚动 | `:84-86`、`:142-159` |

**发现**：首页底部还有一张"免责声明" `Card`（`:142-148`）+ footer（`:151-159`）。在 667px 高度下，用户在**没滚动时看不到免责声明** —— 这与 P-1 §6.2 提出的"免责应出现在关键时刻"相关。

---

## 2. 八字新建向导 `/chart/new` + `BirthWizard`

### 2.1 分步逻辑

| 检查项 | 结果 | 证据 |
|---|---|---|
| 分步组件 | `StepProgress current={step} total={STEPS.length} labels={[...STEPS]}` | `BirthWizard.tsx:266` |
| 是否有进度提示 | ✅ **有**（`StepProgress`） | `BirthWizard.tsx:266` |
| 每步字段数 | 待核（需读 `STEPS` 定义） | `BirthWizard.tsx` |
| 地区选择 | `RegionSelect province city lng onChange` | `BirthWizard.tsx:469`、`RegionSelect.tsx:17` |

### 2.2 地区选择在大数据量下是否可搜索？

- `RegionSelect` 的 props 为 `{ province, city, lng, onChange }`（`RegionSelect.tsx:17`）—— **无搜索相关 prop**。
- 数据源 `src/lib/geo/china-regions.ts`（有测试 `china-regions.test.ts`，4 用例）。
- ⚠️ **需真机验证**：若为 `<select>` 省 + `<select>` 市两级联动，则在原生移动端 picker 下**可接受**（系统自带滚动选择）；若为自绘列表则**不可接受**。静态无法判定渲染方式。

### 2.3 校验错误如何呈现

由 `Field.tsx` 承担（`BirthWizard.tsx:14` 附近 import 段引用 `Field`）。详见 D-3 §A6 的表单无障碍审计。

---

## 3. 八字结果页 `/chart/[id]`

四个可视化组件：`BaziTable`、`DayunTimeline`、`WuxingBars`、`WuxingRadar`。

### 3.1 `BaziTable` 在窄屏是否需要横向滚动？

⚠️ **需真机验证**（未读到 `BaziTable.tsx` 的完整类名）。但可确认的**结构性风险**：

- 四柱八字表天然是 **4 列 × 多行**（年月日时 × 天干/地支/十神/藏干/纳音…）。在 343px 可用宽度下，每列约 **85px**。
- 若单元格内含"正官""偏印"等 2 字十神 + 藏干列表，**85px 极可能溢出**。
- **滚动是否可发现？** 若用 `overflow-x-auto` 而无滚动提示（渐变遮罩/箭头），移动端用户**不会知道右边还有内容** —— 这是最典型的隐藏内容问题。

> **需真机验证清单项 B1**。

### 3.2 `WuxingRadar` / `WuxingBars` 在 375px 下

均为百分比/自绘 SVG 或 div 条形，通常自适应容器宽度。⚠️ 需真机验证尺寸与可读性。

---

## 4. 解读页 `/chart/[id]/reading` —— **长文本行长**

### 4.1 行长计算（关键可计算项）

| 项 | 值 | 证据 |
|---|---|---|
| 容器最大宽度 | `max-w-6xl` = **72rem = 1152px** | `reading/page.tsx:260` |
| 移动端实际宽度 | 375px − `safe-pad` 左右各 `max(1rem, safe)` ≈ **343px** | `globals.css:65-70` |
| 桌面端可用宽度 | 1152px 上限 | 同上 |
| `SectionCard` 正文容器 | 待核实内部 padding | `src/components/reading/SectionCard.tsx` |

**判定**：

- **移动端（343px）**：中文单字约 `fontSize` 宽。若正文为 `text-sm`(14px)，每行约 **343 / 14 ≈ 24.5 个中文字符**。中文排版推荐行长 **25–40 字**，**24.5 字处于下限但可接受**。✅ **移动端无行长问题**。
- **桌面端（1152px）**：同样 14px 中文，每行约 **1152 / 14 ≈ 82 个中文字符** —— ❌ **严重超过推荐上限（40 字）**，也超过提示词给出的 75 字符阈值。

> **这是 D-2 最明确的可计算发现**：`max-w-6xl`（`reading/page.tsx:260`）对**散文式长文本解读**过宽。桌面端用户需要频繁横向扫视（saccade），阅读疲劳显著。
>
> **修复方案（S 成本）**：给 `SectionCard` 正文加 `max-w-[38rem]`（约 38 个中文字宽）或 `prose` 容器宽度限制，而**不是**改页面容器（因为表格/雷达图需要宽度）。即：**宽容器 + 窄正文**。

### 4.2 加载态

| 检查项 | 结果 | 证据 |
|---|---|---|
| 是否有 spinner | ✅ `animate-spin` + "正在调用 LLM 生成解读..." | `reading/page.tsx:272-279` |
| 是否流式还是轮询 | **同步等待**（非流式、非轮询） | 见 §5.3 |
| ⚠️ 亮度反馈缺陷 | `const loading = mode === "llm" && llmLoading && !report`（`:256`）—— **已有旧 report 时 `!report` 为 false，loading 不显示**。用户切换 LLM 模式重算时**看不到任何进度反馈** | `:256` |

---

## 5. 紫微十二宫网格 `/ziwei/[id]` + `PalaceGrid`（**重点**）

### 5.1 375px 下的每格宽度估算（精确计算）

```tsx
// PalaceGrid.tsx:51-55
<div className="relative w-full max-w-2xl mx-auto aspect-square">     // max-w-2xl = 42rem = 672px
  <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-px
                  rounded-xl overflow-hidden border border-border neon-border bg-border/40">
```

**计算过程**：

| 步骤 | 值 |
|---|---|
| 375px 视口 − `safe-pad` 左右各 16px | **343px** |
| `max-w-2xl` = 672px，但受父容器限制 → 实际取 **343px** |
| `aspect-square` → 高度也是 **343px** |
| `grid-cols-4` + `gap-px`（1px × 3 间隔） | 内容宽 = 343 − 3 = **340px** |
| **每格宽度** = 340 / 4 = **85px** |
| 每格高度 = (343 − 3) / 4 = **85px** |

**每格 85 × 85px。**

### 5.2 文字是否溢出？逐项分析 `PalaceCell`

`PalaceCell` 接收 `className="h-full"`（`PalaceGrid.tsx:77`），说明格子高度受限。格内需容纳：

| 内容 | 字号（`PalaceGrid.tsx` 中宫对比 / `PalaceCell` 待核） | 85px 能否容纳 |
|---|---|---|
| 宫位名（如"命宫"） | 待核 | 2 字 ✅ |
| 地支（如"巳"） | 待核 | 1 字 ✅ |
| **主星名**（如"紫微天相"） | 待核 | 4 字 × 假设 12px ≈ 48px ✅ |
| **辅星列表**（如"左辅 右弼 文昌 文曲 天魁"） | **`text-[10px]` 或更小** | 5 星 × 2 字 = 10 字，10px 时 ≈ 100px → ❌ **必然换行或溢出** |
| 四化标记（禄权科忌） | 小字 | 需挤入 |

**参照证据**：连**中宫**（2×2 = 172 × 172px，比单格大 4 倍）都在用极小字号：

| 中宫元素 | 类名 | 375px 实际字号 |
|---|---|---|
| "紫微斗数" | `text-[10px] sm:text-xs` | **10px** |
| 命主/身主 | `text-[9px] sm:text-[10px]` | **9px** |
| 版本信息 | `text-[8px] sm:text-[9px]` | **8px** |
| 警告文本 | `text-[8px] sm:text-[9px]` | **8px** |

（`PalaceGrid.tsx:88, 108, 113, 119`）

> **结论**：中宫面积是单格的 4 倍，却已经把字号压到 **8–10px**。**由此可确凿推断：单格（PalaceCell）内的字号必然 ≤10px**，否则无法容纳辅星列表。
>
> **这不是"是否溢出"的问题，而是"为了不溢出而牺牲可读性"的问题** —— 12 宫在 375px 下的必然结果是每格 85px + 8-10px 字。**移动端十二宫网格在当前设计下不可读**。

### 5.3 结构性修复建议

| 方案 | 做法 | 成本 |
|---|---|---|
| **A. 横向滚动 + 放大** | 设 `min-w-[560px]` 于网格，外层 `overflow-x-auto`，每格回到 ~140px，字号可回落到 ≥11px | **S** |
| **B. 移动端改列表视图** | 375px 以下改为"一宫一卡"纵向列表（`ViewToggle` 已有雏形，`src/components/chart/ViewToggle.tsx`） | **M** |
| **C. 点击放大** | 保持网格，点击宫位弹出全屏详情（当前 `PalaceCell` 是否可点待核） | **M** |

**推荐 A**（改动最小、保留"方盘"心智模型，且滚动条在 375px 下天然可见于方形盘下方）。

---

## 6. 六爻 `/liuyao/new` + `CastForm` / `HexagramVisual` / `YaoLine`

### 6.1 爻线尺寸（`YaoLine.tsx`）— 可精确计算

```tsx
// YaoLine.tsx:46-52
<div className="flex items-center gap-3 rounded-lg px-2 py-1.5 ..." role="img" aria-label={...}>
  <span className="w-8 shrink-0 ...">      // 爻位标签 32px
  <div className="flex flex-1 items-center justify-center gap-1 min-h-[1.25rem]">
    <div className="w-full max-w-[10rem] rounded-sm h-2 ..." />   // 阳爻：h-2 = 8px 高
  </div>
  <span className="w-10 shrink-0 ...">     // 动爻标记 40px
  <span className="w-12 shrink-0 text-xs"> // 爻名标签 48px
</div>
```

| 元素 | 尺寸 | 375px 下是否适合触摸/阅读 |
|---|---|---|
| 爻线高度 | **`h-2` = 8px**（`compact` 时 `h-1.5` = 6px） | ⚠️ 8px 很细，但**爻线是图形不是触摸目标**，可接受 |
| 爻线最大宽 | `max-w-[10rem]` = 160px | 375px 宽下 ✅ 充裕 |
| **整行高度** | `py-1.5`(6px×2) + `min-h-[1.25rem]`(20px) = **约 32px** | ❌ **低于 44px 触摸下限** |
| 整行是否可点？ | **否** —— `YaoLine` 是纯展示，无 `onClick` | ✅ 因此 32px 不构成触摸违规 |

**判定**：`YaoLine` **不是交互元素**，因此不适用 44px 规则。✅ 设计合格，且有 `role="img"` + `aria-label`（`:53-54`，形如"初爻 老阴 动"）—— **这是全项目无障碍做得最好的组件之一**。

### 6.2 `HexagramVisual`

待核（未读取）。⚠️ 需真机验证项 B2。

---

## 7. 触摸目标审计（<44×44px）

### 7.1 `Button` 组件尺寸（`Button.tsx:23-27`）

| size | 高度类 | 实际 px | 是否达 44px |
|---|---|---|---|
| `sm` | `h-9` | **36px** | ❌ **不达标** |
| `md`（默认） | `h-11` | **44px** | ✅ **恰好达标** |
| `lg` | `h-12` | 48px | ✅ |

**问题**：`size="sm"`（36px 高）在项目中被**大量使用**：

| 使用位置 | 证据 |
|---|---|
| 档案列表操作按钮（看盘/解读/删除） | `charts/page.tsx:330,335,339,348,351` |
| 紫微列表操作按钮 | `ziwei/page.tsx:110,120,128,170,174,178,185` |
| 六爻列表操作按钮 | `liuyao/page.tsx:105,113,116,151,156,163` |
| 解读页"独立校准页" | `reading/page.tsx:288` |

> `size="sm"` 的 36px 高度**违反了 WCAG 2.5.8（Target Size Minimum, AA，要求 24×24 最小）在技术上通过，但低于 iOS HIG / Material 推荐的 44×44**。
> 严格按 WCAG 2.5.8 的 24px 门槛，36px 是**通过**的；按提示词给出的 44px 实践标准，**不达标**。判定为 **P2**（体验优化级，非违规阻断）。

### 7.2 其他小尺寸交互元素

| 位置 | 元素 | 尺寸 | 证据 |
|---|---|---|---|
| `src/app/page.tsx:151-158` | footer 链接（隐私政策/账号） | `text-xs`(12px) 纯文本链接，无 padding | `:153,156` |
| `src/app/charts/page.tsx:291-296` | "新建" 文本链接 | `text-xs` | `:293` |
| `src/app/charts/page.tsx:194-216` | 术数切换 pill | `px-2.5 py-1` + `text-xs` ≈ **24px 高** | `:195,200,206,212` |
| `src/app/page.tsx:60` | 术数卡片整卡链接 | 整卡区域 ≫ 44px | ✅ |

> **最低的是 `charts/page.tsx:194-216` 的术数 pill（约 24px 高）** —— 但它恰好是 IA-2/IA-4 中"三术数唯一导航路径"的载体。**最小的触摸目标承载着最重要的导航职责**，这是设计上的错配。

---

## 8. 加载态与进度反馈

| 检查项 | 结果 | 证据 |
|---|---|---|
| 排盘是流式还是轮询？ | **都不是** —— `/api/reading/status` 只是 **LLM 配置探针**，不是任务状态接口 | `src/app/api/reading/status/route.ts:8-13`（经 E-4 核实）；前端 `reading/page.tsx:98-103` 只用它取 `llmConfigured` |
| LLM 解读是流式吗？ | ❌ **非流式**。`chatCompletion` 的 fetch 无 `stream: true` | `src/lib/reading/llm/client.ts:93-98`（经 E-4 核实） |
| 前端是否有进度反馈？ | ⚠️ 仅一个无限 spinner，**无进度百分比、无阶段提示** | `reading/page.tsx:272-279` |
| 感知延迟 | = **LLM 完整生成时间**（`max_tokens: 4096`，`temperature: 0.7`） | `client.ts:96-97` |
| ⚠️ 已有 report 时切换模式无 loading | 见 §4.2 | `reading/page.tsx:256` |
| 解读生成中刷新 | **无断点续传**（无任务模型） | P-2 §4 |

> **这是移动端最痛的体验点**：用户在移动网络下点"LLM 解读"，面对一个无限转圈，**可能等待 30-60 秒**（4096 tokens 生成），且**刷新即丢失**。

---

## 9. 暗色模式

项目**只有暗色**（`globals.css:49` `color-scheme: dark`；`layout.tsx:31` 无主题切换）。因此不存在"暗色适配"问题，但需检查对比度 —— 见 D-0 §5 与 D-1 §8：

| 组合 | 对比度 | 判定 |
|---|---|---|
| `text-muted/50` on background | **2.14:1** | ❌ 6 处 |
| `text-muted/60` on background | **2.62:1** | ❌ 6 处 |
| `text-muted/70` on background | **3.14:1** | ❌ 6 处 |
| `border` on `background` | **1.48:1** | ❌ 非文本元素 |

---

## 10. 需要真机验证清单

以下结论**静态推理无法定论**，必须真机/真浏览器验证：

| # | 待验证项 | 验证方法 | 关联问题 |
|---|---|---|---|
| **B1** | `BaziTable` 在 375px 下是否横向溢出？滚动是否可发现？ | 真机打开 `/chart/[id]`，检查是否出现横向滚动条，以及右侧内容是否被截断 | §3.1 |
| **B2** | `HexagramVisual` 在 375px 下的尺寸与可读性 | 真机打开 `/liuyao/[id]` | §6.2 |
| **B3** | `RegionSelect` 的实现方式（原生 select 还是自绘列表）与可搜索性 | 真机打开 `/chart/new` 走到地区步骤 | §2.2 |
| **B4** | `PalaceCell` 内部实际字号与溢出情况 | 真机打开 `/ziwei/[id]`，放大截图读字号；或用 DevTools 检查 computed font-size | §5.2（本报告已从"中宫 8px"反推单格 ≤10px，需实测确认） |
| **B5** | `WuxingRadar` / `WuxingBars` 在 375px 下的渲染尺寸 | 真机打开 `/chart/[id]` | §3.2 |
| **B6** | `SectionCard` 正文容器的实际宽度与每行字数 | DevTools 测量 `.prose` 或正文 div 的 `clientWidth`，除以字体大小 | §4.1（本报告已算出桌面端约 82 字/行） |
| **B7** | 首页在 375×667 下是否需要滚动才能看到免责声明 | 真机打开 `/`，不滚动截图 | §1.2 |
| **B8** | LLM 解读的实际等待时长 | 配置真实 `LLM_API_KEY` 后计时 | §8 |
| **B9** | 触摸目标实测（尤其 `charts/page.tsx:194-216` 的术数 pill） | 真机点击测试误触率 | §7.2 |
| **B10** | 解读页桌面端行长（1152px 容器）实际每行字数 | 浏览器 1440px 宽打开解读页，数一行中文字符数 | §4.1 |

---

## 11. 问题清单（按严重度）

| ID | 问题 | 影响 | 严重度 | 证据 | 修复成本 |
|---|---|---|---|---|---|
| **M1** | **解读页桌面端行长约 82 中文字符**（容器 `max-w-6xl`=1152px，正文 14px），远超 40 字推荐上限 | 桌面阅读疲劳 | **P1** | `reading/page.tsx:260` | **S** |
| **M2** | **紫微十二宫在 375px 下每格仅 85px，字号被压到 8-10px**，移动端不可读 | 紫微移动端基本不可用 | **P1** | `PalaceGrid.tsx:51,88,108,113,119`（85px 与 8px 为精算/反推） | **S**（方案 A） |
| **M3** | **LLM 解读无进度反馈**（非流式、无任务模型、无百分比），且已有 report 时连 spinner 都不显示 | 用户可能面对 30-60s 无反馈等待 | **P1** | `reading/page.tsx:256,272-279`；`client.ts:93-98` | **M** |
| **M4** | `BaziTable` 窄屏横向溢出风险（4 列 × 85px） | 具体数据可能被隐藏 | **P1**（待 B1 确认） | §3.1 | 待定 |
| **M5** | **最小触摸目标（24px 术数 pill）承载三术数唯一导航** | 误触 + 导航失效叠加 | **P1** | `charts/page.tsx:194-216` | **S**（配合 IA-2） |
| **M6** | `Button size="sm"` = 36px 高，低于 44px 实践标准，且被大量用于列表操作 | 移动端操作易误触 | **P2** | `Button.tsx:24`；`charts/page.tsx:330` 等 20+ 处 | **S** |
| **M7** | 首页无 `min-h-dvh`，375×667 下免责声明在首屏外 | 免责可见性 | **P2** | `page.tsx:84-86`、`:142-148` | **S** |
| **M8** | `text-muted/50·60·70` 三档对比度 2.14–3.14:1，共 18 处 | 弱光环境不可读 | **P2** | 见 D-0 §5.3 | **M** |
| **M9** | 解读页失败态无恢复 CTA | 用户卡死 | **P2** | `reading/page.tsx:246-252` | **S** |
| **M10** | 填表中途退出无确认（`beforeunload` 缺失） | 数据丢失 | **P2** | `BirthWizard.tsx` | **S** |
