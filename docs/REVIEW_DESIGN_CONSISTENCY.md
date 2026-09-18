# D-1 · 视觉系统与一致性问题审计

> 视角：资深视觉设计师 · **只读不改**
> 前置：`docs/REVIEW_DESIGN_INVENTORY.md`（D-0 盘点，含主 reviewer 复核修正）
> 设计语言：深色底 `#07080c` + 金 `#d4a84b` + 青 `#2ee6d6`，"赛博 + 传统"混合
> 技术栈：Tailwind v4（配置在 `globals.css` 的 `@theme inline`，**无 tailwind.config.js** —— 已实测 `Test-Path` 为 `False`）
> 所有计数为实测 grep，引用带 `文件:行号`

---

## 1. 硬编码值泛滥度

### 1.1 总量

| 类别 | 实测出现次数 | 备注 |
|---|---|---|
| `text-[Npx]` 硬编码字号 | **72**（67 行，24 个文件） | 分布：`10px`=45、`9px`=13、`11px`=12、`8px`=2 |
| 颜色透明度裸值 `X/NN` | **244**（69 种不同取值） | — |
| `shadow-[...]` 任意阴影 | **17** | 16 次内联 `var(--gold-glow)`/`var(--cyan-glow)` |
| 尺寸任意值 `w-/h-/max-w-/[..]` | **30** | — |
| `tracking-[...]` | **4** | — |
| **合计** | **377** | |

> 复核说明：D-0 报告初稿记 `text-[Npx]` 为 82 次，经主 reviewer 全仓复核（338 文件，排除 `node_modules`/`.next`）实测为 **72 次**（67 行）。本报告采用 **72**。

### 1.2 出现最多的文件（`text-[Npx]` Top 10）

`text-[10px]`（45 次）与 `text-[11px]`（12 次）集中在徽标、标签、辅助说明。代表位置：

| 文件 | 代表行号 | 用法 |
|---|---|---|
| `src/app/page.tsx` | `:13` | `text-[10px]` 术数产品名（`{art.product}`） |
| `src/app/page.tsx` | `:26` | `text-[10px]` "可用"徽标 |
| `src/app/page.tsx` | `:30` | `text-[10px]` "即将推出"徽标 |
| `src/app/page.tsx` | `:109` | `text-[11px]` `{HOME.artsSubtitle}` |
| `src/components/ziwei/StarBadge.tsx` | 多处 | 星曜徽标 |
| `src/components/chart/BaziTable.tsx` | 多处 | 表格内标注 |
| `src/components/reading/TrustPanel.tsx` | 多处 | 证据条目 |

### 1.3 应下沉为 token 的高频项（≥3 次）

**颜色透明度类**（69 种取值中 34 种出现 ≥3 次，占裸值总量 79.5%）：

| 裸值 | 次数 | 建议 token | 语义 |
|---|---|---|---|
| `cyan/40` | **13** | `--color-cyan-line` | 次级边框 |
| `gold/40` | **10** | `--color-gold-line` | 次级边框 |
| `gold/15` | **9** | `--color-gold-soft` | 按钮底色 |
| `foreground/90` | 8 | `--color-fg-strong` | 强调正文 |
| `cyan/50` | 8 | `--color-cyan-line-strong` | 强调边框 |
| `cyan/10` | 7 | `--color-cyan-soft` | 淡底 |
| `gold/10` | 7 | `--color-gold-soft-2` | 淡底 |
| `muted/60` | 6 | ⚠️ **不应下沉为 token，应提高对比度**（见 §4） | — |
| `gold/50` | 6 | `--color-gold-line-strong` | 强调边框 |
| `muted/70` | 6 | ⚠️ 同上 | — |
| `muted/50` | 6 | ⚠️ 同上 | — |
| `gold/90` | 6 | `--color-gold-strong` | 强调文本 |
| `cyan/30` | 6 | `--color-cyan-line-weak` | 弱边框 |

**阴影类**：

`--gold-glow` 与 `--cyan-glow` **未映射进 `@theme inline`**（`globals.css:26-42` 无对应行），这是 17 处阴影裸值的**根因**。建议新增：

```css
@theme inline {
  --shadow-glow-gold: 0 0 16px var(--gold-glow);
  --shadow-glow-gold-lg: 0 0 24px var(--gold-glow);
  --shadow-glow-cyan: 0 0 10px var(--cyan-glow);
}
```

> **原则应用**：`text-[10px]`（45 次）与 `text-[9px]`（13 次）虽高频，但**不应下沉为 token** —— 它们本身就是应当被消除的值（见 §4）。把它们 token 化会把"过小字号"制度化。正确做法是**提升到 ≥12px 并改用 `text-xs`**。

---

## 2. 颜色语义一致性

### 2.1 gold 与 cyan 的语义（grep 用法归纳）

| 颜色 | 全部用法场景 | 归纳语义 |
|---|---|---|
| **gold** | 品牌名（`SiteHeader.tsx:13`）、术数名称（`page.tsx:19`）、页面主标题（`charts/page.tsx:184`、`ziwei/page.tsx:106`）、档案名（`charts/page.tsx:288`）、**主 CTA**（`page.tsx:47`）、`Button` primary（`Button.tsx:13-14`）、五行"金"（`BaziTable`）、证据标题（`TrustPanel.tsx:100`） | **主品牌色 / 主操作 / 核心内容强调** |
| **cyan** | 副标题（`page.tsx:88`）、次级链接（`charts/page.tsx:181`）、**次级按钮**（`page.tsx:127`）、"可用"徽标（`page.tsx:26`）、`TrustPanel` 边框（`TrustPanel.tsx:39` `glow="cyan"`）、`ruleId`（`TrustPanel.tsx:109`） | **辅助信息 / 次级操作 / 技术性数据** |

### 2.2 主 CTA 配色不一致

**`src/components/ui/Button.tsx` 的 variant 定义**（gold 为 primary）：

| variant | 配色 | 证据 |
|---|---|---|
| `primary`（默认） | `border-gold-dim` + gold 系 | `Button.tsx:13-14` |
| `secondary` | cyan 系 | `Button.tsx:16` |
| `ghost` | 边框/中性 | `Button.tsx` |

**手写按钮（未复用 `Button`）的配色** —— 列出所有主 CTA 及其配色：

| 位置 | 用途 | 配色 | 是否与 primary 一致 |
|---|---|---|---|
| `src/app/page.tsx:43-52` | **术数卡片主 CTA** | `bg-gold/15 text-gold border border-gold/40` + hover 变 `bg-gold` | ⚠️ **手写**，非 `Button`（`h-10 w-full rounded-lg`） |
| `src/app/page.tsx:119-124` | "人物档案" | `border-gold/40 text-gold` | ⚠️ 手写，`h-12 rounded-xl` |
| `src/app/page.tsx:125-130` | "我的档案" | `border-cyan/40 text-cyan` | ⚠️ 手写，**cyan 而非 gold** |
| `src/app/page.tsx:131-136` | "设置" | `border-border text-muted` | ⚠️ 手写，`h-12 rounded-xl` |
| `src/app/auth/login/page.tsx:39` | 登录提交 | 逐字复制了 `Button` primary 的 className | ❌ **重复实现**（D-0 已指出） |

**发现的不一致**：

1. **同一个"主操作"语义用两种颜色**：术数卡片 CTA 是 **gold**（`page.tsx:47`），而首页"我的档案"入口是 **cyan**（`page.tsx:127`）。二者在用户眼里都是"点这里继续"。
2. **`h-10` vs `h-12` 高度漂移**：卡片 CTA 是 `h-10`（`page.tsx:45`），首页三个入口是 `h-12`（`page.tsx:121,127,133`），`Button` 组件是另一套。
3. **`rounded-lg` vs `rounded-xl` 漂移**：卡片 CTA 用 `rounded-lg`（`:45`），首页入口用 `rounded-xl`（`:121`）。**注意**：在本项目中两者渲染均为 12px（`globals.css:41` 覆写了 `--radius-lg`），所以这属于**语义噪声而非视觉差异** —— 但正因如此，它更难被察觉和统一。

**结论**：主 CTA 配色**确实不一致**（gold/cyan 混用表达同一"继续"语义），且存在 3 处尺寸/圆角参数漂移。

---

## 3. 组件重复实现

### 3.1 手写按钮（未复用 `ui/Button`）

D-0 实测：原生 `<button>` **110 次** vs `<Button>` **110 次**。手写按钮的**参数漂移**：

| 参数 | 手写取值集合 | `Button` 组件取值 |
|---|---|---|
| 高度 | `h-10`（`page.tsx:45`）、`h-12`（`page.tsx:121,127,133`） | 由 `size` prop 控制（`Button.tsx`） |
| 圆角 | `rounded-lg`（`page.tsx:45`）、`rounded-xl`（`page.tsx:121,127,133`） | 统一 |
| padding | `px-6`（`page.tsx:121,127,133`） | 统一 |
| hover | `group-hover:bg-gold`（`:47`）、`hover:bg-gold/10`（`:121`）、`hover:bg-cyan/10`（`:127`）、`hover:text-foreground`（`:133`） | variant 内定义 |

**代表性重复**：`src/app/auth/login/page.tsx:39` 逐字复制了 `Button` primary 的 className —— 这是最典型的"应复用而未复用"。

### 3.2 空态重复实现

三个档案页的空态结构**手工重复三次**：

| 页面 | 空态代码 | 结构 |
|---|---|---|
| `src/app/charts/page.tsx:302-313` | `Card title="暂无八字档案"` + `<Button>开始排盘</Button>` | 标题 + 说明 + CTA |
| `src/app/ziwei/page.tsx:144-152` | `Card title="暂无紫微盘"` + `<Button>去排紫微盘</Button>` | 同上 |
| `src/app/liuyao/page.tsx:125-133` | `Card title="暂无问卦"` + `<Button>去起卦</Button>` | 同上 |

> 42 个组件中**没有任何 empty 态抽象**。建议提取 `<EmptyState title description cta />`。

---

## 4. 字号阶梯断层

实测（D-0 §4，`src/` 全量）：

| 类 | px | 次数 | 占比 |
|---|---|---|---|
| `text-xs` | 12 | **124** | 32.9% |
| `text-sm` | 14 | **108** | 28.7% |
| `text-base` | 16 | 21 | 5.6% |
| `text-lg` | 18 | 5 | 1.3% |
| `text-xl` | 20 | 4 | 1.1% |
| `text-2xl` | 24 | 1 | 0.3% |
| `text-3xl` | 30 | 1 | 0.3% |
| `text-4xl` | 36 | 1 | 0.3% |
| `text-5xl` | 48 | 1 | 0.3% |
| `text-[11px]` | 11 | 12 | 3.2% |
| `text-[10px]` | 10 | **45** | 11.9% |
| `text-[9px]` | 9 | **13** | 3.4% |
| `text-[8px]` | 8 | **2** | 0.5% |

### 断层（4 处）

1. **16px → 18px → 20px**：按 tailwind 连续，但**使用量从 21 骤降到 5、4** —— 中间层几乎不用。
2. **20px → 24px → 30px → 36px → 48px**：每档各 **1 次**，且**全部集中在 `src/app/page.tsx:91`**（首页 h1 的 `text-3xl sm:text-4xl md:text-5xl`）。也就是说**除了首页标题，全站没有大字号**。
3. **12px 与 14px 之间无过渡**：`text-xs`(124) + `text-sm`(108) = **232 次 = 70.7%** 全部字号使用。正文被压缩在两档里。
4. **8px / 9px / 10px 三档游离在 Tailwind 阶梯之外**，只能靠 `text-[Npx]` 表达。

### 低于移动端可读下限（<12px）的统计

**共 60 次**：`10px`=45、`9px`=13、`8px`=2。

| 字号 | 次数 | 判定 |
|---|---|---|
| `text-[10px]` | **45** | ❌ iOS HIG 建议正文最小 11pt；10px 在 375px 视口下明显吃力 |
| `text-[9px]` | **13** | ❌ 严重过小 |
| `text-[8px]` | **2** | ❌ 不可读 |

> 是否属于"正文"需辨析：这些 10px 多用于**徽标/标签/辅助标注**（如 `page.tsx:26` 的"可用"徽标），严格说不是正文，不构成 WCAG 1.4.4 的必然违规。但 `page.tsx:13` 的 `{art.product}`（术数产品名）是**信息性文本**，10px 确实过小。**45 次 10px 中至少有一部分是承载信息的**。

---

## 5. 间距与栅格

### 5.1 抽查 6 个页面的外层容器

| 页面 | 外层容器类 | 内容容器 |
|---|---|---|
| `src/app/page.tsx:84-86` | `flex flex-1 flex-col cyber-grid` | `safe-pad flex flex-1 flex-col items-center` → `main w-full max-w-3xl flex-1 flex flex-col justify-center gap-8 py-6 sm:py-8` |
| `src/app/charts/page.tsx:175-176` | `flex flex-1 flex-col cyber-grid min-h-dvh` | `safe-pad flex flex-1 flex-col max-w-2xl mx-auto w-full gap-4 pb-8` |
| `src/app/ziwei/page.tsx:97-98` | `flex flex-1 flex-col cyber-grid min-h-dvh` | `safe-pad flex flex-1 flex-col max-w-2xl mx-auto w-full gap-4 pb-8` |
| `src/app/liuyao/page.tsx:92-93` | `flex flex-1 flex-col cyber-grid min-h-dvh` | `safe-pad flex flex-1 flex-col max-w-2xl mx-auto w-full gap-4 pb-8` |
| `src/app/chart/[id]/reading/page.tsx:259-260` | `flex flex-1 flex-col cyber-grid min-h-dvh` | `safe-pad flex flex-1 flex-col max-w-6xl mx-auto w-full gap-4 sm:gap-6 pb-8` |
| `src/app/people/page.tsx` | 待核 | 待核 |

### 不一致处

| # | 不一致 | 证据 |
|---|---|---|
| 1 | **首页缺 `min-h-dvh`**，其余页面均有 | `page.tsx:84`（无）vs `charts/page.tsx:175`（有） |
| 2 | **最大宽度有 3 档**：`max-w-3xl`(首页) / `max-w-2xl`(三个档案页) / `max-w-6xl`(解读页) | `page.tsx:86`、`charts/page.tsx:176`、`reading/page.tsx:260` |
| 3 | **`gap-4` vs `gap-8` vs `gap-4 sm:gap-6` 三种间距策略** | `charts/page.tsx:176`(gap-4)、`page.tsx:86`(gap-8)、`reading/page.tsx:260`(gap-4 sm:gap-6) |
| 4 | 首页 `py-6 sm:py-8`，其余 `pb-8` | `page.tsx:86` vs `charts/page.tsx:176` |

> 三个档案页（`charts`/`ziwei`/`liuyao`）的外层容器**完全一致**，这是好的。首页与解读页各自偏离。

### 无间距 token

D-0 §1.4 实测：**项目没有任何间距 token**，**78 个不同间距类**被使用。`gap-2`(61) 与 `gap-3`(57) 几乎并列第一。

---

## 6. 动效

### 6.1 实测

| 类 | 次数 |
|---|---|
| `transition-colors` | **40** |
| `transition-all` | **14** |
| `duration-*` | **1** |
| `animate-spin` | 见 `chart/[id]/reading/page.tsx:275` |

### 6.2 评估

| 问题 | 判定 | 证据 |
|---|---|---|
| **有无统一时长标准？** | ❌ **无**。`duration-*` 仅 **1 处**，其余 54 处动效全部使用 Tailwind 默认时长（`transition-*` 默认 150ms）。即：**没有任何显式时长控制** | grep `duration-` → 1 命中 |
| **是否尊重 `prefers-reduced-motion`？** | ❌ **完全没有**。`globals.css` 全文无该媒体查询（D-0 实测 **0 处**） | grep `prefers-reduced-motion` 全项目 → **0 命中** |
| `transition-all` 是否滥用？ | ⚠️ **14 处**。`transition-all` 会监听所有属性，性能与可预测性都差于 `transition-colors`/`transition-transform` | e.g. `src/app/page.tsx:45,63,121` |

**修复成本**：**S**（小）。在 `globals.css` 增加：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

> 这一条同时是 WCAG 2.3.3（Animation from Interactions, AAA）与 2.2.2（Pause/Stop/Hide, A）的要求面。

---

## 7. 问题清单

| # | 问题 | 出现次数 | 代表位置 `文件:行号` | 修复成本 |
|---|---|---|---|---|
| **C1** | **无 `prefers-reduced-motion` 支持** | 全站 0 处支持 / 54 处动效 | `globals.css`（无该查询）；`src/app/page.tsx:45,63,121` | **S** |
| **C2** | **`--gold-glow`/`--cyan-glow` 未映射进 `@theme`**，导致 17 处阴影裸值 | 17 | `globals.css:26-42`（缺失）；`page.tsx:47,63` | **S** |
| **C3** | **主 CTA 配色不一致（gold vs cyan 表达同一语义）** | 2 类 | `page.tsx:47`(gold) vs `page.tsx:127`(cyan) | **S** |
| **C4** | **手写按钮而未复用 `Button`**，含逐字复制 | 110 原生 `<button>` | `page.tsx:43-52,119-136`；`auth/login/page.tsx:39` | **M** |
| **C5** | **<12px 字号 60 处**（其中 10px 占 45 处） | 60 | `page.tsx:13,26,30`；`StarBadge.tsx`；`BaziTable.tsx` | **M** |
| **C6** | **无统一动效时长标准**（`duration-*` 仅 1 处） | 54 处动效 | 全站 `transition-*` | **S** |
| **C7** | **空态手写重复 3 次**，无 `EmptyState` 抽象 | 3 | `charts/page.tsx:302-313`、`ziwei/page.tsx:144-152`、`liuyao/page.tsx:125-133` | **M** |
| **C8** | **透明度档位过多（69 种取值）且含 8 组对比度不达标** | 244 | 见 §8 | **M** |
| **C9** | **页面容器不一致**（max-w 3 档、gap 3 档、首页缺 `min-h-dvh`） | 4 处 | `page.tsx:84-86` vs `charts/page.tsx:175-176` | **S** |
| **C10** | **无间距 token**，78 个间距类 | 78 | `globals.css:3-24`（无 `--space-*`） | **L**（不建议全做） |
| **C11** | **`rounded-lg` 与 `rounded-xl` 渲染同值（均 12px）**，语义噪声 | 41+15 | `globals.css:41` 覆写 `--radius-lg` | **S** |
| **C12** | **`Button` 无 `loading` prop**，而 loading 覆盖仅 27.7% | — | `Button.tsx` | **S** |

---

## 8. 对比度补充（衔接 D-0 §5）

D-0 的核心结论：**纯 token 组合只有 1 组不达标** —— `border`/`background` = **1.48:1**（`--border` `#2a2e3a` 是深色底上的边框色，作为**非文本**元素应满足 3:1，1.48:1 确实偏低）。

**但叠加透明度后，另有 8 组文字组合跌破 4.5:1**：

| 组合 | 对比度 | 判定 | 实测使用次数 |
|---|---|---|---|
| `text-muted/40` | 1.76:1 | ❌ | 见 D-0 |
| `text-muted/50` | 2.14:1 | ❌ | 6 |
| `text-muted/60` | 2.62:1 | ❌ | 6 |
| `text-muted/70` | 3.14:1 | ❌ | 6 |
| `text-muted/80` | ≈3.70:1 | ❌ | — |
| `text-muted/90` | ≈4.34:1 | ❌ 临界 | — |
| `text-danger/80` | ≈4.3:1 | ❌ | — |
| **合计涉及** | — | — | **28 次真实使用** |

**关键洞察**：`--muted` 本身（`#8b8680`）在背景上是 **5.55:1，达标**。问题**不是 token 值**，而是**透明度修饰符滥用**。因此：

> ⚠️ **改 token 值无法修复这 8 组** —— 必须**收敛透明度档位**（如只允许 `muted`（不透明）与 `muted/90` 两档，删除 `/40`–`/70`）。

这与 §1.3 的结论一致：`muted/60`、`muted/70`、`muted/50` **不应被 token 化**，而应被**删除或提高不透明度**。
