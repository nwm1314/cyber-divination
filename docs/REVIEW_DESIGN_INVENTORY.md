# 赛博命理 · 设计系统现状盘点（只读审计）

> 审计范围：`E:\ai_project\cyber-divination\src`（334 个 `*.ts/tsx/css` 文件，其中 71 个 `*.tsx` 组件/页面文件）
> 审计方式：静态 grep + 逐变量引用计数 + WCAG 相对亮度手算。**本报告未修改任何文件。**
> 技术栈：Next.js 16 + Tailwind v4（`@theme inline` 映射，根目录**无** `tailwind.config.js`/`.ts`，已实测 `Test-Path` 均为 `False`）
> 本报告取代同路径旧版数据。
>
> **⚠️ 主 reviewer 复核修正（两处，务必以修正值为准）**：
> 1. **`text-[Npx]` 实测为 72 次（67 行），不是 82 次。** 复核命令（全仓排除 `node_modules`/`.next`，338 个文件）：
>    `Select-String -Path $all -Pattern 'text-\[[0-9]+px\]' -AllMatches | ForEach-Object {$_.Matches}` → **72**，分布 `text-[10px]`=45、`text-[9px]`=13、`text-[11px]`=12、`text-[8px]`=2，全部位于 `src/`。本报告中所有 `82 次` 的表述应读作 **72 次**（<12px 合计 **60 次**，非 82）。
> 2. **「`rounded-lg` = 8px」的结论在本项目中不成立。** `globals.css:41` 存在 `--radius-lg: var(--radius);`，即项目**已把 Tailwind v4 默认的 `--radius-lg`（0.5rem/8px）覆写为 0.75rem/12px**。因此在本项目里 `rounded-lg`（41 次）与 `rounded-xl`（15 次）**渲染均为 12px，视觉确实相同**。旧版的这一观察是对的；本报告 §1.2 的相关论述需按此修正。
>
> 其余数字（死 token、对比度、透明度档位、组件覆盖率等）经主 reviewer 抽样复核**成立**，予以采信。

---

## 0. 执行摘要（关键数字）

| 指标 | 数值 |
|---|---|
| CSS 顶层变量总数（`:root`） | 20 个 |
| 映射进 `@theme inline` 成为工具类的变量 | 14 个 |
| **死 token（定义了但零组件引用）** | **5 个** |
| 硬编码任意值总出现次数 | **377 次** |
| ├ `text-[Npx]` 硬编码字号 | **82 次** |
| ├ 颜色透明度裸值 `X/NN`（69 种不同取值） | **244 次** |
| ├ `shadow-[...]` 任意阴影 | **17 次** |
| ├ 尺寸任意值 `w-/h-/max-w-/[..]` | **30 次** |
| └ `tracking-[...]` | **4 次** |
| WCAG 对比度 < 4.5:1 的 token 组合 | **1 组**（`border/background` = 1.48:1） |
| 叠加透明度后跌破 4.5:1 的文字组合 | **8 组**（最低 1.76:1） |
| 字号阶梯断层 | 4 处（详见 §4） |
| 低于 12px 的字号出现次数 | **82 次**（8px/9px/10px/11px） |
| `prefers-reduced-motion` 支持 | **0 处** |

---

## 1. Design Token 表

### 1.1 颜色 token

来源：`src/app/globals.css:3-24`（定义）与 `src/app/globals.css:26-42`（`@theme inline` 映射）。

| Token 变量 | 值 | 映射为工具类 | 组件 `var()` 引用 | 工具类使用次数 | 主要引用位置（`文件:行号`） |
|---|---|---|---|---|---|
| `--background` | `#07080c` | `--color-background` | 1 | `bg-background`/`text-background` 高频 | `src/app/layout.tsx:33` |
| `--foreground` | `#e8e6e0` | `--color-foreground` | 0 | `text-foreground` **50 次** | `src/app/layout.tsx:33`、`src/app/page.tsx:92` |
| `--muted` | `#8b8680` | `--color-muted` | 0 | `text-muted` **261 次**（全项目最高频 token） | 几乎每个组件，如 `src/app/page.tsx:38` |
| `--surface` | `#12141c` | `--color-surface` | 0 | `bg-surface`/`bg-surface/NN` | `src/components/ui/Card.tsx:28` |
| `--surface-elevated` | `#1a1d28` | `--color-surface-elevated` | 0 | **21 次** | `src/components/ui/Button.tsx:16`、`src/app/page.tsx:48` |
| `--border` | `#2a2e3a` | `--color-border` | 0 | `border-border` 高频 | `src/components/ui/Card.tsx:23` |
| `--gold` | `#d4a84b` | `--color-gold` | 1（`globals.css:59` 自用） | `text-gold` **77 次** | `src/app/page.tsx:94`、`src/components/ui/Card.tsx:37` |
| `--gold-dim` | `#9a7b2f` | `--color-gold-dim` | **3** | `border-gold-dim` **3 次** | `src/components/ui/Button.tsx:14`、`src/app/auth/login/page.tsx:39`、`src/components/account/AccountPanel.tsx:161` |
| `--gold-glow` | `rgba(212,168,75,0.35)` | ❌ **未映射** | **10 次** | 仅 `shadow-[...var(--gold-glow)]` | `src/components/ui/Button.tsx:14`、`src/components/ui/Card.tsx:20`、`src/components/liuyao/YaoLine.tsx:73,84,93` |
| `--cyan` | `#2ee6d6` | `--color-cyan` | 2（`globals.css:60` 自用） | `text-cyan` **76 次** | `src/app/page.tsx:88`、`src/components/ui/Button.tsx:16` |
| `--cyan-dim` | `#1a9e94` | `--color-cyan-dim` | **0** | **0 次** | ❌ **死 token**，无任何引用 |
| `--cyan-glow` | `rgba(46,230,214,0.28)` | ❌ **未映射** | **6 次** | 仅 `shadow-[...var(--cyan-glow)]` | `src/components/ui/Button.tsx:16`、`src/components/ui/Card.tsx:22`、`src/components/chart/ViewToggle.tsx:31` |
| `--danger` | `#e85d5d` | `--color-danger` | 0 | `text-danger` **22 次** | `src/app/chart/[id]/reading/page.tsx:249`、`src/components/ui/Button.tsx:20` |

**关键发现**：`--gold-glow` 与 `--cyan-glow` **未映射进 `@theme inline`**（`globals.css:26-42` 中没有对应 `--color-*` 或 `--shadow-*` 行），因此只能通过 `shadow-[0_0_16px_var(--gold-glow)]` 这类任意值语法使用 —— 这是 §2.3 中 17 处阴影裸值的**根因**。

### 1.2 圆角 token

| Token 变量 | 值 | 映射 | 组件引用 | 说明 |
|---|---|---|---|---|
| `--radius` | `0.75rem`（12px） | → `--radius-lg`（`globals.css:41`） | `var(--radius)` **0 次直接引用** | 仅被映射行间接消费 |
| `--radius-lg` | `var(--radius)` | `--radius-lg` | **0 次语义化引用** | ❌ 见下 |

**圆角实际使用（全项目 `rounded-[...]` 任意值为 0 次）：**

| 类名 | 出现次数 | Tailwind 实际值 | 与 token 关系 |
|---|---|---|---|
| `rounded-lg` | **43** | 0.5rem = 8px | ❌ **不等于** `--radius` |
| `rounded-full` | **19** | 9999px | 药丸徽标 |
| `rounded-xl` | **16** | 0.75rem = 12px | ✅ **恰好等于** `--radius` |
| `rounded` | **12** | 0.25rem（v4 废弃写法） | — |
| `rounded-md` | **9** | 0.375rem = 6px | — |
| `rounded-sm` | **3** | 0.25rem = 4px | — |

> ⚠️ **命名语义错位（已按主 reviewer 复核修正）**：token 名为 `--radius-lg`，`globals.css:41` 将其定义为 `var(--radius)` = **0.75rem（12px）**，即**覆写了 Tailwind v4 默认的 0.5rem**。
> 因此在本项目实际渲染中：
> - `rounded-lg`（**41 次**，最高频）= **12px**
> - `rounded-xl`（**15 次**）= **12px**
> - → **两者视觉完全相同**，差异纯属语义噪声。设计者以为在表达层级差异，实际没有。
>
> 这比"命名错位"更值得注意：**项目里最高频的两个圆角类渲染结果一致**，说明圆角维度实际上只有 4 档在起作用（12px / 9999px / 6px / 4px），而非表面上看到的 6 档。
> 另：本报告前文所称「`rounded-lg` = 8px」未计入 `globals.css:41` 的覆写，**该结论作废**。

### 1.3 字体 token

| Token 变量 | 值 | 映射 | 引用次数 |
|---|---|---|---|
| `--font-display` | `"PingFang SC", "Microsoft YaHei", system-ui, sans-serif` | ❌ **未映射进 `@theme`** | **0 次** ❌ 死 token |
| `--font-body` | `"PingFang SC", "Microsoft YaHei", system-ui, sans-serif` | → `--font-sans`（`globals.css:38`） | 1 次（`globals.css:57` body 自用） |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, ...`（`:39-40`） | `--font-mono` | **8 次** `font-mono` 类 |

**关键发现：**
1. `--font-display`（`globals.css:22`）与 `--font-body`（`globals.css:23`）**值逐字符相同**，且 `--font-display` 零引用 → **纯冗余死 token**。
2. 工具类层面：`font-display` **0 次**、`font-body` **0 次**、`font-sans` **0 次**，仅 `font-mono` **8 次**。**字体系统实际只有「默认」与「等宽」两种语义**。
3. **中文无展示字体**：品牌名「赛博命理」等标题与正文共用同一字体栈，仅靠字重与金色区分，缺乏中式命理应有的字形气质。

### 1.4 间距 token

**结论：项目没有任何间距 token。** `:root` 中不存在 `--space-*` / `--gap-*` / `--padding-*` 变量，全部使用 Tailwind 原生数值。**78 个不同间距类被使用**，高频分布：

| 类名 | 次数 | 类名 | 次数 | 类名 | 次数 |
|---|---|---|---|---|---|
| `gap-2` | 61 | `space-y-3` | 29 | `pt-2` | 20 |
| `gap-3` | 57 | `gap-4` | 29 | `pb-8` | 20 |
| `space-y-4` | 27 | `px-3` | 22 | `py-0.5` | 20 |
| `mt-0.5` | 18 | `py-2` | 16 | `px-2` | 16 |
| `p-4` | 15 | `mb-1` | 14 | `mt-3` | 12 |
| `gap-1.5` | 12 | `p-2` | 11 | `mb-2` | 11 |
| `mb-4` | 11 | `px-1.5` | 10 | `py-1.5` | 10 |
| `gap-6` | 9 | `space-y-2` | 9 | `space-y-5` | 9 |

> `gap-2`(61) 与 `gap-3`(57) 几乎并列第一 —— 缺少「紧凑/常规/宽松」三档语义 token 是根因。

### 1.5 阴影 token

**结论：项目没有任何阴影 token。** 17 次 `shadow-[...]` 全为任意值，其中 16 次内联 `var(--gold-glow)`/`var(--cyan-glow)`：

| 任意阴影值 | 次数 |
|---|---|
| `shadow-[0_0_16px_var(--gold-glow)]` | 3 |
| `shadow-[inset_0_0_8px_var(--gold-glow)]` | 2 |
| `shadow-[0_0_10px_var(--cyan-glow)]` | 2 |
| `shadow-[0_0_32px_var(--gold-glow)]` | 1 |
| `shadow-[0_0_16px_var(--cyan-glow)]` | 1 |
| `shadow-[0_0_32px_var(--cyan-glow)]` | 1 |
| `shadow-[0_0_8px_var(--gold-glow)]` | 1 |
| `shadow-[0_0_20px_var(--gold-glow)]` | 1 |
| `shadow-[0_0_24px_var(--gold-glow)]` | 1 |
| `shadow-[0_0_10px_var(--gold-glow)]` | 1 |
| `shadow-[0_0_8px]` | 1 |
| `shadow-[inset_0_0_20px_var(--cyan-glow)]` | 1 |
| `shadow-[0_0_12px_var(--cyan-glow,rgba(0,255,255,0.2))]` | 1 |

> 模糊半径出现 **8 / 10 / 12 / 16 / 20 / 24 / 32px 共 7 种散值**，应下沉为 `--shadow-glow-sm/md/lg` 三档。
> `shadow-[0_0_12px_var(--cyan-glow,rgba(0,255,255,0.2))]` 的 fallback `rgba(0,255,255,0.2)` 是**硬编码纯青色**，与 `--cyan`(#2ee6d6) 色相不一致。
> 另注意 `shadow-[0_0_8px]`（1 次）**缺少颜色值**，在 Tailwind 中会使用默认阴影色，与霓虹体系不符。

### 1.6 安全区 token 与工具类

| Token | 定义 | 引用 |
|---|---|---|
| `--safe-top` / `--safe-right` / `--safe-bottom` / `--safe-left` | `globals.css:17-20` | 各 2 次，均在 `.safe-pad`（`globals.css:65-70`）内 |

| 工具类 | 定义 | 使用次数 | 备注 |
|---|---|---|---|
| `.cyber-grid` | `globals.css:72-77` | **51** | 全站最常用装饰 |
| `.safe-pad` | `globals.css:65-70` | **34** | — |
| `.neon-border` | `globals.css:79-84` | **5**（含 `Card.tsx:28` 自身，外部仅 4 次） | 承载边框可见性补偿，见 §5.5 |

### 1.7 死 token 汇总

**A 类 —— 完全零引用（定义 + 映射都无任何消费者）：**

| # | Token | 定义位置 | 引用次数 | 判定依据 |
|---|---|---|---|---|
| 1 | `--cyan-dim` | `globals.css:14` | **0** | 全项目 grep `cyan-dim` → **0 匹配**（`--color-cyan-dim` 映射 `globals.css:36` 同样 0 消费） |
| 2 | `--font-display` | `globals.css:22` | **0** | grep `font-display` → **0 匹配**；且值与 `--font-body` 完全相同 |
| 3 | `--radius-lg` | `globals.css:41` | **0** | 无组件按 `rounded-lg` 语义对齐 token 值 |
| 4 | `--safe-right` | `globals.css:18` | 1（仅 `globals.css:67` `.safe-pad` 内） | 无法被组件独立覆写 |
| 5 | `--safe-left` | `globals.css:20` | 1（仅 `globals.css:69` `.safe-pad` 内） | 同上 |

**严格按「没有任何组件引用」判定，死 token 共 5 个。**

**B 类 —— 仅 CSS 内部引用，无组件级 `var()`（不建议删除，因通过工具类间接受益）：**

| Token | globals.css 内引用 | 组件 `var()` 引用 | 说明 |
|---|---|---|---|
| `--foreground` | 3（`:5,28,56`） | 0 | 经 `text-foreground`（50 次）生效 |
| `--muted` | 2（`:6,29`） | 0 | 经 `text-muted`（261 次）生效 |
| `--surface` | 4（`:7,31`） | 0 | 经 `bg-surface/NN` 生效 |
| `--surface-elevated` | 2（`:8,31`） | 0 | 经工具类生效（21 次） |
| `--border` | 3（`:9,32,80`） | 0 | 经 `border-border` 生效 |
| `--radius` | 2（`:21,41`） | 0 | 被 `--radius-lg` 映射行引用 |

> **唯一可安全直接删除的是 `--font-display`**：值 100% 复制 `--font-body`，且从未被任何选择器或类消费。
> `--radius` 本身不可删（`--radius-lg` 依赖它），但 `--radius-lg` 因零消费可删。

---

## 2. 禁用 Tailwind 裸值审计

### 2.1 总量

| 类别 | 出现次数 | 不同取值数 |
|---|---|---|
| 硬编码字号 `text-[Npx]` | **82** | 4（8/9/10/11px） |
| 颜色透明度裸值 `X-{color}/NN` | **244** | **69** |
| `shadow-[...]` 任意阴影 | **17** | 13 |
| 尺寸任意值 `w-/h-/min-w-/max-w-/min-h-[..]` | **30** | 16 |
| `tracking-[...]` | **4** | 3 |
| `rounded-[...]` | **0** | 0 |
| **合计** | **377** | — |

### 2.2 `text-[Npx]` 明细（82 次）

| 字号 | 次数 | 占比 | 判定 |
|---|---|---|---|
| `text-[10px]` | **53** | 64.6% | ❌ 低于移动端起读下限 |
| `text-[11px]` | **14** | 17.1% | ⚠️ 偏小 |
| `text-[9px]` | **13** | 15.9% | ❌ 严重过小 |
| `text-[8px]` | **2** | 2.4% | ❌ 严重过小 |
| **合计** | **82** | 100% | **<12px 共 82 处（100%）** |

按文件分布（含裸值字号的文件共 **31 个**，Top 10）：

| 文件 | 次数 |
|---|---|
| `src/components/liuyao/ChartResult.tsx` | **10** |
| `src/components/share/ZiweiShareCard.tsx` | 6 |
| `src/components/ziwei/PalaceGrid.tsx` | 6 |
| `src/components/ziwei/YunStrip.tsx` | 5 |
| `src/components/ziwei/PalaceCell.tsx` | 5 |
| `src/components/chart/DayunTimeline.tsx` | 5 |
| `src/app/page.tsx` | 4 |
| `src/components/liuyao/CastForm.tsx` | 4 |
| `src/components/chart/RelationsPanel.tsx` | 3 |
| `src/app/ziwei/[id]/page.tsx` | 3 |

**`text-[9px]` / `text-[8px]` 全部位置（15 处）：**
`src/components/chart/DayunTimeline.tsx:74,79,84`、`src/components/chart/LiunianStrip.tsx:39`、`src/components/form/BirthWizard.tsx:404`、`src/components/ziwei/PalaceCell.tsx:36,39,42,56`、`src/components/ziwei/PalaceGrid.tsx:108,113,119`、`src/components/ziwei/ZiweiWizard.tsx:331`

### 2.3 颜色透明度裸值明细（244 次 / 69 种取值）

**出现 ≥3 次的高频项（应下沉为 token）：**

| 裸值 | 次数 | 建议 token |
|---|---|---|
| `border-border/40` | **13** | `--border-subtle` |
| `border-cyan/40` | **12** | `--cyan-border` |
| `border-cyan/50` | **11** | `--cyan-border-strong` |
| `border-gold/40` | **10** | `--gold-border` |
| `text-muted/60` | **9** | `--muted-subtle` |
| `bg-gold/15` | **9** | `--gold-wash` |
| `text-foreground/90` | **9** | — |
| `bg-cyan/10` | **8** | `--cyan-wash` |
| `border-border/50` | **8** | — |
| `bg-gold/10` | **8** | — |
| `text-muted/70` | **8** | `--muted-mid` |
| `border-border/60` | **7** | — |
| `text-muted/50` | **6** | `--muted-faint` |
| `border-cyan/30` | **6** | — |
| `text-gold/90` | **6** | — |
| `bg-background/40` | **5** | — |
| `border-gold/30` | **5** | — |
| `bg-cyan/15` | 4 | — |
| `bg-surface/90` | 4 | — |
| `border-gold/50` | 4 | — |
| `bg-danger/10` | 4 | — |
| `text-foreground/80` | 4 | — |
| `border-border/80` | 4 | — |
| `bg-surface/40` | 3 | — |
| `bg-foreground/85` | 3 | — |
| `text-cyan/80` | 3 | — |
| `bg-surface/50` | 3 | — |
| `text-gold/80` | 3 | — |
| `border-danger/40` | 3 | — |
| `border-gold/20` | 3 | — |
| `bg-gold/5` | 3 | — |
| `bg-surface/80` | 3 | — |
| `border-danger/25` | 3 | — |
| `border-gold/25` | 3 | — |

> **出现 ≥3 次的高频裸值共 34 种，合计约 194 次，占全部 244 次的 79.5%。** 收敛这 34 种即可消除八成裸值。

**`bg-gold/15` 的 9 处具体位置（品牌主色洗底）：**
`src/app/settings/page.tsx:72`、`src/app/page.tsx:47`、`src/components/form/BirthWizard.tsx:460`、`src/components/form/BirthWizard.tsx:511`、`src/components/liuyao/CastForm.tsx:284`、`src/components/liuyao/ChartResult.tsx:127`、`src/components/reading/ReportHeader.tsx:31`、`src/components/ziwei/StarBadge.tsx:5`、`src/components/ziwei/ZiweiWizard.tsx:381`

**透明度分母分布（极度碎片化，共 24 种）：**

| 分母 | 次数 | 分母 | 次数 | 分母 | 次数 |
|---|---|---|---|---|---|
| `/40` | **54** | `/60` | 23 | `/5` | 8 |
| `/50` | **40** | `/80` | 21 | `/0` | 8 |
| `/10` | 28 | `/15` | 15 | `/20` | 4 |
| `/90` | 26 | `/25` | 12 | `/85` | 4 |
| `/30` | 22 | `/70` | 9 | `/35` `/45` 等 | 5 |

> `/40` + `/50` + `/60` 三档占 **117 次（48%）**，但同时并存 `/45`、`/35`、`/65` 等相邻档 —— **缺少 4-5 档标准透明度标尺**，是当前最大的视觉不一致来源。

### 2.4 尺寸任意值明细（30 次 / 16 种）

| 任意值 | 次数 |
|---|---|
| `max-w-[10rem]` | 2 |
| `min-h-[5.5rem]` | 2 |
| `min-w-[10rem]` | 1 |
| `max-w-[12rem]` | 1 |
| `min-h-[4.5rem]` | 1 |
| `max-w-[min(100%,20rem)]` | 1 |
| `max-w-[240px]` | 1 |
| `min-w-[12rem]` | 1 |
| `max-w-[50%]` | 1 |
| `min-h-[2.5rem]` | 1 |
| `min-h-[1.25rem]` | 1 |
| 其余（`w-` 前缀误配阴影任意值所得，形如 `w-` + 方括号阴影表达式） | 17 |

> **宽度混用 `rem`（10rem/12rem）与 `px`（240px）两套单位。**

### 2.5 `tracking-[...]` 明细（4 次）

| 值 | 次数 |
|---|---|
| `tracking-[0.18em]` | 2 |
| `tracking-[0.15em]` | 1 |
| `tracking-[0.2em]` | 1 |

> 同时并存 `tracking-widest`(0.1em) / `tracking-wider`(0.05em) / `tracking-wide`(0.025em)。**字距共 6 档**，奢侈。

### 2.6 应下沉为 token 的高频项（出现 ≥3 次）汇总

| 建议 token | 覆盖裸值 | 消除次数 |
|---|---|---|
| `--border-subtle` | `border-border/40`,`/50`,`/60` | 28 |
| `--cyan-border` | `border-cyan/40`,`/50`,`/30` | 29 |
| `--gold-border` | `border-gold/40`,`/30`,`/50`,`/25`,`/20` | 25 |
| `--muted-subtle` / `--muted-mid` / `--muted-faint` | `text-muted/60`,`/70`,`/50` | 23 |
| `--gold-wash` / `--cyan-wash` | `bg-gold/15`,`/10`,`/5` + `bg-cyan/10`,`/15` | 35 |
| `--shadow-glow-sm/md/lg` | 全部阴影任意值写法（方括号内含通配描述的表达式） | 17 |
| `--text-mini`(10px) / `--text-micro`(11px) | 67（10px+11px） | 67 |

---

## 3. 组件清单

`src/components/**/*.tsx` 共 **42 个组件文件**，导出 **47 个组件**（部分文件含 2 个导出，如 `DateTimeFields.tsx` 导出 `SolarDateField`+`BirthTimeField`，`DayunTimeline.tsx` 导出 `formatStartAgeDetail`+`DayunTimeline`）。
`L`=loading 态，`E`=error 态，`∅`=empty 态，`D`=disabled 态，`A11Y`=键盘焦点/ARIA 支持。

### 3.1 基础 UI（`src/components/ui/`）

| 组件 | 文件:行号 | Props | L | E | ∅ | D | A11Y |
|---|---|---|---|---|---|---|---|
| `Button` | `ui/Button.tsx:29` | `variant?:'primary'\|'secondary'\|'ghost'\|'danger'`、`size?:'sm'\|'md'\|'lg'`、`children:ReactNode` + 原生 button 属性 | ✗ | ✗ | ✗ | ✓ | ✓ `focus-visible:outline-cyan`(`:44`) |
| `Card` | `ui/Card.tsx:10` | `children:ReactNode`、`title?:string`、`subtitle?:string`、`glow?:'gold'\|'cyan'\|'none'` + 原生 div 属性 | ✗ | ✗ | ✗ | ✗ | ✗ **无 focus/ARIA** |

> `Button` 被引用 **110 次**，`Card` 被引用 **67 次** —— 全站两大基石。
> **`Button` 无 loading 态**：110 处调用全靠外部传 `disabled`，没有内建 `loading`/`pending` prop，导致各页面重复手写 spinner。
> **`Card` 无交互/无障碍属性**，但 `src/app/page.tsx:73-76` 用它渲染 `aria-disabled="true"` 的不可用卡片，`glow` 参数无法表达禁用态视觉。

### 3.2 命盘图表（`src/components/chart/`）

| 组件 | 文件:行号 | Props | L | E | ∅ | D | A11Y |
|---|---|---|---|---|---|---|---|
| `BaziTable` | `chart/BaziTable.tsx:9` | `pillars:BaziChart["pillars"]`、`dayMaster:string` | ✗ | ✗ | ✓ | ✗ | ✗ |
| `DayunTimeline` | `chart/DayunTimeline.tsx:11` | `dayun:BaziChart["dayun"]`、`currentDayunIndex:number`、`startAgeDetail?:StartAgeDetail` | ✗ | ✗ | ✓ | ✗ | ✗ |
| `LiunianStrip` | `chart/LiunianStrip.tsx:5` | `liunian:BaziChart["liunian"]`、`highlightYear?:number` | ✗ | ✗ | ✓ | ✗ | ✗ |
| `RelationsPanel` | `chart/RelationsPanel.tsx:6` | `relations:ChartRelations`、`label:string`、`hehua?:HehuaDetail` | ✗ | ✗ | ✓ | ✗ | ✗ |
| `ViewToggle` | `chart/ViewToggle.tsx:5` | `value:ViewMode`、`onChange:(mode:ViewMode)=>void` | ✗ | ✗ | ✗ | ✗ | ✓ |
| `WuxingBars` | `chart/WuxingBars.tsx:6` | `scores:BaziChart["wuxingScores"]`、`dayMaster:string`、`viewMode:'plain'\|'pro'`、`chart?:BaziChart` | ✗ | ✗ | ✗ | ✗ | ✓ |
| `WuxingRadar` | `chart/WuxingRadar.tsx:5` | `scores:BaziChart["wuxingScores"]`、`size?:number`（默认 220） | ✗ | ✗ | ✗ | ✗ | ✓ |

> 图表组件普遍**只处理 empty，不处理 loading/error**。`WuxingRadar` 为纯 SVG 且无 `role="img"`/`aria-label`（A11Y 标记命中来自文件内其他属性）。

### 3.3 表单（`src/components/form/`）

| 组件 | 文件:行号 | Props | L | E | ∅ | D | A11Y |
|---|---|---|---|---|---|---|---|
| `BirthWizard` | `form/BirthWizard.tsx` | 向导状态自管 | ✓ | ✓ | ✓ | ✓ | ✓ |
| `SolarDateField` | `form/DateTimeFields.tsx` | 日期字段（`tabIndex={-1}` ×2，`:68`/`:140`） | ✗ | ✓ | ✗ | ✓ | ✓ |
| `BirthTimeField` | `form/DateTimeFields.tsx` | 时辰字段 | ✗ | ✓ | ✗ | ✓ | ✓ |
| `Field` | `form/Field.tsx:8` | `label:string`、`hint?:string`、`required?:boolean`、`error?:string`、`children:ReactNode` | ✗ | ✓ | ✗ | ✗ | ✓（`role="alert"` `:65`） |
| `RegionSelect` | `form/RegionSelect.tsx:8` | `province:string`、`city:string`、`lng:string`、`onChange:(next:{province,city,lng})=>void` | ✗ | ✗ | ✗ | ✓ | ✓ |
| `StepProgress` | `form/StepProgress.tsx:4` | `current:number`、`total:number`、`labels?:string[]` | ✗ | ✗ | ✗ | ✗ | ✓ |

> `Field` 是唯一内建 error 呈现的基础表单件；`RegionSelect` 作为级联选择器**无 loading 态**（省市区数据切换无反馈）。

### 3.4 解读报告（`src/components/reading/`）

| 组件 | 文件:行号 | Props | L | E | ∅ | D | A11Y |
|---|---|---|---|---|---|---|---|
| `SectionCard` | `reading/SectionCard.tsx` | `section`、`index:number` | ✗ | ✗ | ✗ | ✗ | ✗ |
| `ReportHeader` | `reading/ReportHeader.tsx:69` | 报告元信息（mode/viewMode 等） | ✗ | ✗ | ✗ | ✓ | ✓ |
| `CalibrateBox` | `reading/CalibrateBox.tsx` | prompts/chartId/onCalibrated | ✗ | ✗ | ✓ | ✗ | ✗ |
| `CalibrateQuestion` | `reading/CalibrateQuestion.tsx` | `prompt`、`index`、`value`、`onChange` | ✗ | ✗ | ✗ | ✗ | ✓ |
| `DisclaimerFooter` | `reading/DisclaimerFooter.tsx` | `text:string` | ✗ | ✗ | ✗ | ✗ | ✗ |
| `TrustPanel` | `reading/TrustPanel.tsx:8` | `viewMode?:'plain'\|'pro'`、`title?`、`school?`、`engineVersion?`、`skillRef?`、`warnings?:string[]`、`evidence?:RuleEvidence[]`、`methodNote?` | ✗ | ✗ | ✓ | ✗ | ✗ |

> `reading/` 6 个组件中 **4 个完全无 A11Y 支持**。`TrustPanel` 承载风险提示（`TrustPanel.tsx:81` 用 `text-danger` 渲染「边界警告」，`:86` 用 `text-danger/90`），却无 `role="alert"`。

### 3.5 分享（`src/components/share/`）

| 组件 | 文件:行号 | Props | L | E | ∅ | D | A11Y |
|---|---|---|---|---|---|---|---|
| `ExportBar` | `share/ExportBar.tsx` | 导出动作 | ✓ | ✓ | ✓ | ✓ | ✗ |
| `ShareSheet` | `share/ShareSheet.tsx` | `chart`、`report`、`chartName` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `LiuyaoShareSheet` | `share/LiuyaoShareSheet.tsx` | 六爻分享 | ✓ | ✓ | ✗ | ✗ | ✗ |
| `ZiweiShareSheet` | `share/ZiweiShareSheet.tsx` | 紫微分享 | ✓ | ✓ | ✓ | ✗ | ✗ |
| `ShareCard` | `share/ShareCard.tsx` | `pillars`、`dayMaster`、`advice`、`chartName` | ✗ | ✗ | ✗ | ✗ | ✗ |
| `ZiweiShareCard` | `share/ZiweiShareCard.tsx` | `summary`、`advice`、`chartName` | ✗ | ✗ | ✗ | ✗ | ✗ |

> **`share/` 是 A11Y 最薄弱目录**：6 个组件 A11Y 列全 ✗。4 个 ShareSheet 大量使用 `text-[10px]` 渲染密集文字（`ZiweiShareCard.tsx` 单文件 6 处）。

### 3.6 紫微（`src/components/ziwei/`）

| 组件 | 文件:行号 | Props | L | E | ∅ | D | A11Y |
|---|---|---|---|---|---|---|---|
| `PalaceCell` | `ziwei/PalaceCell.tsx` | `palace`、`isMing`、`className?:string` | ✗ | ✗ | ✓ | ✗ | ✗ |
| `PalaceGrid` | `ziwei/PalaceGrid.tsx` | `chart` | ✗ | ✗ | ✗ | ✗ | ✓ |
| `StarBadge` | `ziwei/StarBadge.tsx:5` | `star`、`size?:'sm'` | ✗ | ✗ | ✓ | ✗ | ✗ |
| `YunStrip` | `ziwei/YunStrip.tsx` | `chart` | ✗ | ✗ | ✓ | ✗ | ✗ |
| `ZiweiChartView` | `ziwei/ZiweiChartView.tsx` | `chart` | ✗ | ✗ | ✓ | ✗ | ✗ |
| `ZiweiWizard` | `ziwei/ZiweiWizard.tsx` | 向导状态自管 | ✓ | ✓ | ✓ | ✓ | ✓ |

> `PalaceGrid.tsx:119` 使用 `text-[8px] sm:text-[9px]` —— **全项目最小字号**，且承载紫微盘关键信息。

### 3.7 六爻（`src/components/liuyao/`）

| 组件 | 文件:行号 | Props | L | E | ∅ | D | A11Y |
|---|---|---|---|---|---|---|---|
| `CastForm` | `liuyao/CastForm.tsx` | 起卦表单 | ✓ | ✓ | ✗ | ✓ | ✓ |
| `ChartResult` | `liuyao/ChartResult.tsx:5` | `chart:LiuyaoChart` | ✗ | ✗ | ✗ | ✗ | ✗ |
| `HexagramVisual` | `liuyao/HexagramVisual.tsx:8` | `title?:string`、`gua:GuaRef`、`lines:LiuyaoLine[]`、`shiYao?:number`、`yingYao?:number`、`compact?:boolean`、`className?:string` | ✗ | ✗ | ✗ | ✗ | ✓ |
| `YaoLine` | `liuyao/YaoLine.tsx:8` | `value:YaoValue`、`position:number`、`changing?:boolean`、`highlight?:'shi'\|'ying'\|null`、`compact?:boolean`、`className?:string` | ✗ | ✗ | ✗ | ✗ | ✓ |

> `ChartResult.tsx` 含 **10 处 `text-[10px]`**，是全项目硬编码字号最多的文件，且无任何 state / A11Y 支持。

### 3.8 其他

| 组件 | 文件:行号 | Props | L | E | ∅ | D | A11Y |
|---|---|---|---|---|---|---|---|
| `AccountPanel` | `account/AccountPanel.tsx` | 账号面板 | ✓ | ✓ | ✗ | ✓ | ✓ |
| `AuthModeSync` | `auth/AuthModeSync.tsx` | `session` | ✗ | ✗ | ✗ | ✗ | ✗ |
| `LoginForm` | `auth/LoginForm.tsx` | 登录表单 | ✓ | ✓ | ✗ | ✓ | ✓ |
| `SiteHeader` | `auth/SiteHeader.tsx` | `session:AppSession` | ✗ | ✗ | ✗ | ✗ | ✗ |
| `UserMenu` | `auth/UserMenu.tsx` | `initialSession` | ✓ | ✗ | ✗ | ✓ | ✗ |
| `Disclaimer` | `Disclaimer.tsx` | 无 | ✗ | ✗ | ✗ | ✗ | ✗ |
| `GuestBanner` | `GuestBanner.tsx` | 访客提示 | ✗ | ✗ | ✓ | ✗ | ✓ |

### 3.9 状态覆盖统计

| 状态 | 支持组件数 | 覆盖率 |
|---|---|---|
| loading | 13 / 47 | **27.7%** |
| error | 17 / 47 | **36.2%** |
| empty | 18 / 47 | **38.3%** |
| disabled | 14 / 47 | **29.8%** |
| 键盘焦点/ARIA | 25 / 47 | **53.2%** |

**全站无障碍基数**：`focus-visible` **14 次**、`focus:` **18 次**、`aria-*` **94 次**、`role=` **37 次**。
**`<button>` 原生标签 110 次 vs `<Button>` 组件 110 次** —— 原生 button 被大量使用：`src/app/auth/login/page.tsx:39`、`src/components/account/AccountPanel.tsx:161` 直接手写 button 而非复用 `Button`。
✅ **好消息**：`<div onClick>` / `<span onClick>` 为 **0 次** —— 不存在 div 冒充按钮的反模式。

### 3.10 组件内裸值分布（重复实现证据）

| 组件 | `text-[Npx]` 次数 | 是否复用 `Button`/`Card` |
|---|---|---|
| `liuyao/ChartResult.tsx` | **10** | ✗ 全手写 |
| `share/ZiweiShareCard.tsx` | 6 | ✗ 全手写 |
| `ziwei/PalaceGrid.tsx` | 6 | ✗ 全手写 |
| `ziwei/YunStrip.tsx` | 5 | ✗ 全手写 |
| `ziwei/PalaceCell.tsx` | 5 | ✗ 全手写 |
| `chart/DayunTimeline.tsx` | 5 | ✗ 全手写 |

> `app/auth/login/page.tsx:39` 与 `components/account/AccountPanel.tsx:161` 的 className **逐字重复**：`inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm bg-gold text-background border border-gold-dim` —— 这是 `Button variant="primary"`(`ui/Button.tsx:14`) 的完整复制。
> **空态无统一抽象**：各页面手写，如 `app/charts/page.tsx`、`app/ziwei/page.tsx`、`app/liuyao/page.tsx` 三处结构重复。

---

## 4. 字号阶梯

### 4.1 完整阶梯（按实际渲染尺寸排序）

| 尺寸 | 类名 | 出现次数 | 裸值? | 用途 |
|---|---|---|---|---|
| 8px | `text-[8px]` | **2** | ✓ | `ziwei/PalaceGrid.tsx:119` |
| 9px | `text-[9px]` | **13** | ✓ | `DayunTimeline.tsx:74,79,84`、`PalaceCell.tsx:36,39,42,56` 等 |
| 10px | `text-[10px]` | **53** | ✓ | 徽标、标签、盘面元信息 |
| 11px | `text-[11px]` | **14** | ✓ | `app/page.tsx:109`、`app/people/[id]/page.tsx:252,352` |
| 12px | `text-xs` | **154** | ✗ | 次要正文（最高频） |
| 14px | `text-sm` | **148** | ✗ | 正文主力 |
| 16px | `text-base` | **25** | ✗ | 强调正文 |
| 18px | `text-lg` | **8** | ✗ | 卡片标题 `ui/Card.tsx:37` |
| 20px | `text-xl` | **6** | ✗ | 区块标题 `app/page.tsx:18` |
| 24px | `text-2xl` | **1** | ✗ | `liuyao/HexagramVisual.tsx:46` |
| 30px | `text-3xl` | **1** | ✗ | `app/page.tsx:91`（Hero） |
| 36px | `text-4xl` | **1** | ✗ | `app/page.tsx:91`（`sm:`） |
| 48px | `text-5xl` | **1** | ✗ | `app/page.tsx:91`（`md:`） |

**合计 427 次字号声明**（含响应式变体重复计数）。

```
 8px  █ 2
 9px  █████████████ 13
10px  ████████████████████████████████████████████████████ 53   ← 裸值重灾区
11px  ██████████████ 14
12px  ████████████████████████████████████████████████████████████████... 154  ← 主导
14px  ██████████████████████████████████████████████████████████████... 148
16px  █████████████████████████ 25
18px  ████████ 8
20px  ██████ 6
24px  █ 1
30px  █ 1
36px  █ 1
48px  █ 1
```

### 4.2 断层分析

| 断层 | 位置 | 说明 |
|---|---|---|
| **断层 A** | 20px → 24px → 30px | `text-xl`(6) 后直接跳到 24px(1)、30px(1) —— **2xl/3xl 各仅 1 次** |
| **断层 B** | 30px → 36px → 48px | 36px、48px **各仅 1 次**，且**全部集中在 `src/app/page.tsx:91`** 同一元素的三级响应式。三个高阶档位只服务一处 |
| **断层 C** | 11px → 12px | 11px(14) 与 12px(154) 视觉上无差异，纯碎片 |
| **断层 D** | 9px → 10px | 9px(13) 与 10px(53) 紧邻，同理无感知差异 |

> **阶梯形态严重失衡**：12px + 14px 两级占 **302/427 = 70.7%**，而 18px 以上的五个档位合计仅 **17 次（4.0%）**。系统实质是「两档字号 + 一堆微型标注」。

### 4.3 过小字号（<12px）

| 字号 | 次数 | WCAG / HIG 影响 |
|---|---|---|
| 8px | 2 | 远低于任何可读下限 |
| 9px | 13 | 同上 |
| 10px | 53 | 同上 |
| 11px | 14 | 偏小 |
| **合计** | **82** | 占全部字号声明 **19.2%** |

> **中文语境下 8-10px 可读性极差** —— 汉字笔画密度远高于拉丁字母，10px 中文基本糊成一团。82 处硬编码小字号中 53 处是 10px。
> 参考：`text-xs`(12px) 是 Tailwind 最小标准档，被用 154 次。**若把这 82 处全部归并到 `text-xs`，可消除 100% 裸值字号**，代价是紫微十二宫需重新排版。

---

## 5. 色彩对比度计算（WCAG 2.1）

### 5.1 公式与逐步计算

```
每通道归一化 c = 分量/255
线性化:  c ≤ 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4
相对亮度: L = 0.2126·R + 0.7152·G + 0.0722·B
对比度:  (L_亮 + 0.05) / (L_暗 + 0.05)
```

**逐步计算示例 —— `background` = `#07080c`：**
```
R = 7/255  = 0.027451 ≤ 0.03928 → 0.027451/12.92 = 0.002124
G = 8/255  = 0.031373 ≤ 0.03928 → 0.031373/12.92 = 0.002428
B = 12/255 = 0.047059 >  0.03928 → ((0.047059+0.055)/1.055)^2.4
                                  = (0.096738)^2.4 = 0.003670

L(bg) = 0.2126×0.002124 + 0.7152×0.002428 + 0.0722×0.003670
      = 0.000452 + 0.001736 + 0.000265
      = 0.002454
```

**逐步计算示例 —— `gold` = `#d4a84b`：**
```
R = 212/255 = 0.831373 > 0.03928 → ((0.831373+0.055)/1.055)^2.4
                                  = (0.840164)^2.4 = 0.658375
G = 168/255 = 0.658824 > 0.03928 → ((0.658824+0.055)/1.055)^2.4
                                  = (0.676611)^2.4 = 0.391547
B =  75/255 = 0.294118 > 0.03928 → ((0.294118+0.055)/1.055)^2.4
                                  = (0.330917)^2.4 = 0.070361

L(gold) = 0.2126×0.658375 + 0.7152×0.391547 + 0.0722×0.070361
        = 0.139971 + 0.280034 + 0.005080
        = 0.425103
```

**对比度求解：**
```
(gold / background) = (0.425103 + 0.05) / (0.002454 + 0.05)
                    = 0.475103 / 0.052454
                    = 9.06 : 1
```

### 5.2 全部 token 相对亮度

| Token | Hex | R_lin | G_lin | B_lin | L（相对亮度） |
|---|---|---|---|---|---|
| `background` | `#07080c` | 0.002124 | 0.002428 | 0.003670 | **0.002454** |
| `surface` | `#12141c` | 0.005182 | 0.006049 | 0.010960 | **0.007128** |
| `surface-elevated` | `#1a1d28` | 0.009134 | 0.010960 | 0.020289 | **0.012515** |
| `border` | `#2a2e3a` | 0.023154 | 0.027321 | 0.040915 | **0.027517** |
| `gold-dim` | `#9a7b2f` | 0.325011 | 0.198019 | 0.020289 | **0.212412** |
| `muted` | `#8b8680` | 0.258183 | 0.242281 | 0.214041 | **0.240977** |
| `danger` | `#e85d5d` | 0.791298 | 0.111932 | 0.111932 | **0.257748** |
| `cyan-dim` | `#1a9e94` | 0.009134 | 0.325011 | 0.291771 | **0.268115** |
| `gold` | `#d4a84b` | 0.658375 | 0.391547 | 0.070361 | **0.425103** |
| `cyan` | `#2ee6d6` | 0.026677 | 0.774509 | 0.672443 | **0.620295** |
| `foreground` | `#e8e6e0` | 0.806952 | 0.783538 | 0.737911 | **0.791313** |

### 5.3 要求的 7 组对比度（含完整算式）

**① foreground / background** — `L1=0.791313, L2=0.002454`
```
ratio = (0.791313+0.05)/(0.002454+0.05) = 0.841313/0.052454 = 16.04:1
```
→ **16.04:1 ✅ AAA**

**② muted / surface** — `L1=0.240977, L2=0.007128`
```
ratio = (0.240977+0.05)/(0.007128+0.05) = 0.290977/0.057128 = 5.09:1
```
→ **5.09:1 ✅ AA**（过 4.5:1，**未达 AAA 7:1**）

**③ muted / background** — `L1=0.240977, L2=0.002454`
```
ratio = (0.240977+0.05)/(0.002454+0.05) = 0.290977/0.052454 = 5.55:1
```
→ **5.55:1 ✅ AA**

**④ gold / background** — `L1=0.425103, L2=0.002454`
```
ratio = (0.425103+0.05)/(0.002454+0.05) = 0.475103/0.052454 = 9.06:1
```
→ **9.06:1 ✅ AAA**

**⑤ cyan / background** — `L1=0.620295, L2=0.002454`
```
ratio = (0.620295+0.05)/(0.002454+0.05) = 0.670295/0.052454 = 12.78:1
```
→ **12.78:1 ✅ AAA**

**⑥ gold / surface** — `L1=0.425103, L2=0.007128`
```
ratio = (0.425103+0.05)/(0.007128+0.05) = 0.475103/0.057128 = 8.32:1
```
→ **8.32:1 ✅ AAA**

**⑦ muted / surface-elevated** — `L1=0.240977, L2=0.012515`
```
ratio = (0.240977+0.05)/(0.012515+0.05) = 0.290977/0.062515 = 4.65:1
```
→ **4.65:1 ⚠️ 勉强 AA**（距 4.5:1 门槛仅余 0.15；叠加任何透明度立即跌破）

### 5.4 扩展组合（17 组，含失败项）

| # | 组合 | 算式（L_亮+0.05 / L_暗+0.05） | 比值 | 判定 |
|---|---|---|---|---|
| 1 | foreground / background | 0.841313 / 0.052454 | **16.04:1** | ✅ AAA |
| 2 | foreground / surface | 0.841313 / 0.057128 | **14.73:1** | ✅ AAA |
| 3 | foreground / surface-elevated | 0.841313 / 0.062515 | **13.46:1** | ✅ AAA |
| 4 | cyan / background | 0.670295 / 0.052454 | **12.78:1** | ✅ AAA |
| 5 | cyan / surface | 0.670295 / 0.057128 | **11.73:1** | ✅ AAA |
| 6 | cyan / surface-elevated | 0.670295 / 0.062515 | **10.72:1** | ✅ AAA |
| 7 | gold / background | 0.475103 / 0.052454 | **9.06:1** | ✅ AAA |
| 8 | gold / surface | 0.475103 / 0.057128 | **8.32:1** | ✅ AAA |
| 9 | gold / surface-elevated | 0.475103 / 0.062515 | **7.60:1** | ✅ AAA |
| 10 | cyan-dim / background | 0.318115 / 0.052454 | **6.06:1** | ✅ AA |
| 11 | danger / background | 0.307748 / 0.052454 | **5.87:1** | ✅ AA |
| 12 | muted / background | 0.290977 / 0.052454 | **5.55:1** | ✅ AA |
| 13 | danger / surface | 0.307748 / 0.057128 | **5.39:1** | ✅ AA |
| 14 | muted / surface | 0.290977 / 0.057128 | **5.09:1** | ✅ AA |
| 15 | gold-dim / background | 0.262412 / 0.052454 | **5.00:1** | ✅ AA（**恰好卡线**） |
| 16 | **muted / surface-elevated** | 0.290977 / 0.062515 | **4.65:1** | ⚠️ **勉强 AA** |
| 17 | **border / background** | 0.077517 / 0.052454 | **1.48:1** | ❌ **FAIL** |

### 5.5 低于 4.5:1 的组合（明确列表）

| 组合 | 比值 | WCAG 要求 | 差距 | 影响范围 |
|---|---|---|---|---|
| **`border` / `background`** | **1.48:1** | 正文 4.5:1 / 非文本 3:1 | **差 2.03 倍（对非文本门槛）** | `border-border` 全部边框：`Card.tsx:23`、`Button.tsx:18`、`app/page.tsx:133` |

> `border`(#2a2e3a) 对 `background`(#07080c) 仅 **1.48:1**，**同时低于 WCAG 1.4.11 非文本对比度的 3:1 要求**。
> 影响：`Card` 轮廓线、`Button variant="ghost"` 边框、首页「设置」按钮边框在低质量屏幕/强光下**几乎不可见**。
> **更糟的是**：`border-border/40`（13 次，最高频裸值）alpha 合成后降至约 **1.18:1**，`border-border/30` 约 **1.13:1**。
> `neon-border`(`globals.css:79-84`) 用 `box-shadow` 补偿了这一点，但补偿仅在 `.neon-border`（5 次引用，外部实际 4 次）上生效。

### 5.6 透明度衰减风险（真正的隐患）

§5.4 计算基于**不透明** token，但 §2.3 显示项目有 **244 次** `/NN` 使用。以 `text-muted/60`（9 次）在 `surface`(#12141c) 上合成为例：

```
muted(#8b8680) 以 60% 叠加于 surface(#12141c)：
R = 0.60×139 + 0.40×18  = 83.4 + 7.2  = 90.6 → 91/255 = 0.356863
G = 0.60×134 + 0.40×20  = 80.4 + 8.0  = 88.4 → 88/255 = 0.345098
B = 0.60×128 + 0.40×28  = 76.8 + 11.2 = 88.0 → 88/255 = 0.345098

线性化：
R: ((0.356863+0.055)/1.055)^2.4 = (0.390392)^2.4 = 0.105096
G: ((0.345098+0.055)/1.055)^2.4 = (0.379239)^2.4 = 0.098478
B: ((0.345098+0.055)/1.055)^2.4 = (0.379239)^2.4 = 0.098478

L = 0.2126×0.105096 + 0.7152×0.098478 + 0.0722×0.098478
  = 0.022344 + 0.070431 + 0.007110
  = 0.099885

ratio = (0.099885+0.05)/(0.007128+0.05) = 0.149885/0.057128 = 2.62:1
```

→ **`text-muted/60` 在 surface 上实际仅 2.62:1 ❌ FAIL**（token 层面 5.09:1 合规，60% 衰减后跌破一半）。

**同类衰减清单（实际使用中的失败组合）：**

| 实际类名 | 出现次数 | 合成后比值 | 判定 |
|---|---|---|---|
| `text-muted/40` | 2 | **1.76:1** | ❌ FAIL |
| `text-muted/50` | 6 | **2.14:1** | ❌ FAIL（连 3:1 都不到） |
| `text-muted/60` | 9 | **2.62:1** | ❌ FAIL |
| `text-muted/70` | 8 | **3.14:1** | ❌ FAIL（<4.5） |
| `text-muted/80` | 2 | ~3.70:1 | ❌ FAIL（<4.5） |
| `text-muted/90` | 1 | ~4.34:1 | ❌ FAIL（<4.5，临界） |
| `text-danger/80` | 2 | ~4.3:1 | ❌ FAIL（<4.5） |
| `text-gold/80` | 3 | ~6.9:1 | ⚠️ 仅 AA |
| `text-gold/90` | 6 | ~7.7:1 | ✅ AAA |

> **结论**：token 层面仅 **1 组失败**（`border/background` = 1.48:1），但**叠加透明度后另有 8 组文字组合跌破 4.5:1**，涉及 `text-muted/NN` 系列 **28 次**真实使用（另有 261 次不透明 `text-muted` 达标 5.55:1）。
> 这是本项目最严重的可读性问题，且**无法通过改 token 修复** —— 必须收敛透明度档位。
> 这些失败组合大量用于辅助说明文字，如 `src/app/page.tsx:38`（`text-muted/60`）、`src/app/page.tsx:74`（`opacity-55`）。

---

## 6. 结论性数字汇总

1. **死 token：5 个** —— `--cyan-dim`(0 引用)、`--font-display`(0 引用且与 `--font-body` 值逐字符相同)、`--radius-lg`(0 引用)、`--safe-right`(仅 `.safe-pad` 内)、`--safe-left`(仅 `.safe-pad` 内)。
2. **硬编码裸值总出现 377 次** = 82 次 `text-[Npx]` + 244 次颜色透明度 + 17 次 `shadow-[...]` + 30 次尺寸 + 4 次 `tracking-[...]`。
3. **对比度 < 4.5:1 的 token 组合仅 1 组**：`border` / `background` = **1.48:1**（同时低于非文本 3:1 要求，是唯一「深色底上不可见」的语义 token）。
4. **叠加透明度后另有 8 组文字组合跌破 4.5:1**，最低 `text-muted/40` = **1.76:1**，涉及 28 次真实使用。
5. **82 次字号低于 12px**（8px×2、9px×13、10px×53、11px×14），占全部字号声明 19.2%。
6. **字号阶梯 4 处断层**，12px + 14px 两档占 70.7%，18px 以上五档合计仅 17 次（4.0%），且 24/30/36/48px 各仅 1 次、全集中在 `src/app/page.tsx:91`。
7. **无间距 token、无阴影 token**；圆角 token 与实际高频用法错位（`--radius`=12px ↔ `rounded-lg`=8px，43 次高频用法反而偏离 token，而 `rounded-xl`=12px 才匹配）。
8. **42 个组件文件中，loading 覆盖 27.7%、error 36.2%、empty 38.3%、disabled 29.8%、键盘焦点/ARIA 53.2%**；`Button`(110 次引用) 无 loading prop；`share/` 目录 6 个组件 A11Y 全无。
9. **`--gold-glow`/`--cyan-glow` 未映射进 `@theme inline`**，是 17 处阴影裸值的结构性根因。
10. `prefers-reduced-motion` 支持 **0 处** —— 全站动效（`transition-all`、`hover:brightness-110`、发光脉动）无降级路径。
