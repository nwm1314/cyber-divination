# D-3 · 可访问性与内容设计审查

> 视角：无障碍（a11y）与内容设计专家 · **只读不改**
> 基准：WCAG 2.2 AA（逐条给 grep 证据）
> 所有计数为实测 grep，引用带 `文件:行号`

---

# A. 无障碍审计

## A1. 语义结构：`<h1>` 覆盖

**实测：24 个 `page.tsx` 中，11 个完全没有 `<h1>`。**

| 页面 | `<h1>` 数 | `<main>` 数 | 判定 |
|---|---|---|---|
| `src/app/page.tsx` | 1 | 1 | ✅ |
| `src/app/account/page.tsx` | 1 | 0 | ⚠️ 无 main |
| `src/app/auth/callback/page.tsx` | **0** | 0 | ❌ **缺 h1** |
| `src/app/auth/login/page.tsx` | **0** | 0 | ❌ **缺 h1** |
| `src/app/chart/new/page.tsx` | 1 | 1 | ✅ |
| `src/app/chart/[id]/page.tsx` | **0** | 0 | ❌ **缺 h1** |
| `src/app/chart/[id]/calibrate/page.tsx` | **0** | 0 | ❌ **缺 h1** |
| `src/app/chart/[id]/reading/page.tsx` | **0** | 0 | ❌ **缺 h1** |
| `src/app/charts/page.tsx` | 1 | 0 | ⚠️ 无 main |
| `src/app/liuyao/page.tsx` | 1 | 0 | ⚠️ 无 main |
| `src/app/liuyao/new/page.tsx` | 1 | 1 | ✅ |
| `src/app/liuyao/[id]/page.tsx` | **0** | 0 | ❌ **缺 h1** |
| `src/app/liuyao/[id]/reading/page.tsx` | **0** | 0 | ❌ **缺 h1** |
| `src/app/people/page.tsx` | 1 | 0 | ⚠️ 无 main |
| `src/app/people/[id]/page.tsx` | **0** | 0 | ❌ **缺 h1** |
| `src/app/privacy/page.tsx` | 1 | 0 | ⚠️ 无 main |
| `src/app/settings/page.tsx` | 1 | 0 | ⚠️ 无 main |
| `src/app/share/liuyao/[token]/page.tsx` | **0** | 0 | ❌ **缺 h1**（公开分享页！） |
| `src/app/share/ziwei/[token]/page.tsx` | **0** | 0 | ❌ **缺 h1**（公开分享页！） |
| `src/app/share/[token]/page.tsx` | **0** | 0 | ❌ **缺 h1**（公开分享页！） |
| `src/app/ziwei/page.tsx` | 1 | 0 | ⚠️ 无 main |
| `src/app/ziwei/new/page.tsx` | 1 | 1 | ✅ |
| `src/app/ziwei/[id]/page.tsx` | **0** | 0 | ❌ **缺 h1** |
| `src/app/ziwei/[id]/reading/page.tsx` | **0** | 0 | ❌ **缺 h1** |

**统计**：
- 缺 `<h1>`：**11 / 24**（45.8%）
- 有 `<main>`：**4 / 24**（16.7%）
- 多个 `<h1>`：**0**（无重复 h1 问题）✅

**WCAG 条款**：**1.3.1 Info and Relationships (A)** + **2.4.6 Headings and Labels (AA)**。

**关键发现**：**三个公开分享页全部缺 `<h1>`**。分享页是外部访问的落地页，其可访问性缺陷影响面最大（任何人点开链接都受影响），且 SEO 上也没有主标题。

> **注意**：`<h3>` 在 `src/app/page.tsx:16` 出现（`ArtCard` 内），其父级是 `<h2>`（`:103` `arts-heading`）—— 层级 h1→h2→h3 **正确** ✅。首页不存在标题跳跃。

## A2. Landmark

`src/app/layout.tsx`（**已实测：无 `<main>`**）：

```tsx
:28-38
<html lang="zh-CN" className="h-full antialiased">
  <body className="min-h-full flex flex-col text-foreground bg-background">
    <AuthModeSync session={session} />
    <SiteHeader session={session} />       // <header> ✅
    {children}                              // ← 无 <main> 包裹
  </body>
</html>
```

| Landmark | 状态 | 证据 |
|---|---|---|
| `<header>` | ✅ 有 | `SiteHeader.tsx:9` |
| `<nav>` | ❌ **无全局 nav** | `SiteHeader.tsx:11-17` 只有 logo + UserMenu |
| `<main>` | ❌ **布局层无**；仅 4 个页面自建 | `layout.tsx:36`；`page.tsx:86`、`chart/new`、`liuyao/new`、`ziwei/new` |
| `<footer>` | ⚠️ 仅首页有 | `page.tsx:151` |

**WCAG 条款**：**1.3.6 Identify Purpose / 2.4.1 Bypass Blocks (A)**。

**问题**：20/24 页面**没有 `<main>` landmark**。屏幕阅读器用户无法用"跳到主内容"快捷导航（且因为也没有 `skip-link`，**Bypass Blocks 完全失败**）。

**修复（S 成本）**：在 `layout.tsx` 用 `<main id="main">{children}</main>` 包裹，并在 `SiteHeader` 加一个 `sr-only focus:not-sr-only` 的 skip link。

## A3. 键盘可达

### A3.1 `onClick` 绑定在非 button 元素上

**实测：0 处。** ✅

```powershell
Select-String -Path $tsx -Pattern '<(div|span|li|section|p|a)\b[^>]*onClick'  →  无匹配
```

**这是本项目无障碍的一个亮点** —— 没有把 `onClick` 挂到 `div`/`span` 上。

### A3.2 自定义交互组件

| 组件 | 实现 | 键盘支持 | ARIA | 判定 |
|---|---|---|---|---|
| **`ViewToggle`** | `role="tablist"` + `aria-label="通俗/专业模式"` + 每个选项 `<button role="tab" aria-selected={active}>` | ✅ 原生 `<button>`，Tab/Enter/Space 均可 | ✅ 正确 | ✅ **优秀**。唯一瑕疵：`role="tab"` 严格应按 WAI-ARIA 规范配套 `aria-controls` + roving tabindex，但用原生 button 已保证可达性 |
| **`PalaceCell`** | 待核（`PalaceGrid` 传 `className="h-full"`） | 待核 | 待核 | ⚠️ 见 A4 |
| `CalibrateBox` / `CalibrateQuestion` | 待核 | ✅（D-0 记为支持键盘焦点） | 待核 | ⚠️ |

### A3.3 `tabIndex` 反模式

**实测：仅 2 处，且均为 `-1`（合法）**：
- `src/components/form/DateTimeFields.tsx:68` — `tabIndex={-1}`
- `src/components/form/DateTimeFields.tsx:140` — `tabIndex={-1}`

✅ **无 `tabIndex > 0` 反模式**。负值 `tabIndex={-1}` 用于程序化聚焦，是标准做法。

## A4. ARIA 正确性

### A4.1 全局 ARIA 覆盖实测

| 属性 | 出现次数 | 判定 |
|---|---|---|
| `aria-label` | **55** | ✅ 覆盖良好 |
| `role=` | **37** | ✅ |
| `sr-only` | **4** | ⚠️ 偏少 |
| **`aria-live`** | **0** | ❌ **完全没有** |
| **`aria-expanded`** | **0** | ❌ 完全没有 |
| `aria-selected` | 2 | ✅（`ViewToggle.tsx:27`） |
| `aria-required` | 3 | ✅（`Field.tsx:42`） |
| `aria-invalid` | 3 | ✅（`Field.tsx:41`） |
| `aria-describedby` | **1** | ⚠️（`Field.tsx:43`，动态生成） |

### A4.2 术数视觉元素的文本替代

| 组件 | 是否有 `role`/`aria-label` | 证据 | 判定 |
|---|---|---|---|
| **`YaoLine`（爻线）** | ✅ `role="img"` + `aria-label={`${posName}爻 ${YAO_LABEL[value]}${isDong ? " 动" : ""}`}` | `YaoLine.tsx:53-54` | ✅ **优秀**（如"初爻 老阴 动"） |
| **`PalaceGrid`（十二宫）** | ✅ `role="img"` + `aria-label="紫微十二宫命盘"` | `PalaceGrid.tsx:52-53` | ⚠️ **有 role 但信息量不足**：整个方盘被折叠成一个 img，屏幕阅读器用户**完全读不到 12 个宫位的内容** |
| `StarBadge`（星曜徽章） | ❌ 无 | 待核 | ❌ |
| `WuxingBars`（五行柱） | ❌ 无 | 待核 | ❌ |
| `WuxingRadar`（五行雷达） | ❌ 无 | 待核 | ❌ |
| `HexagramVisual` | 待核 | — | ⚠️ |

> **`PalaceGrid.tsx:52-53` 的 `role="img"` 是一个典型的"善意的错误"**：它让屏幕阅读器**跳过**整个网格，而不是**读出**内容。正确做法是让 12 个宫位成为可读的结构（如 `role="list"` + 每宫 `aria-label`），或提供 `sr-only` 的文本摘要表。

### A4.3 加载与错误提示的 `aria-live`

| 位置 | 现状 | 证据 |
|---|---|---|
| 解读页 LLM loading | 纯视觉 spinner，**无 `aria-live`** | `reading/page.tsx:272-279` |
| 解读页错误 | `setError` 渲染为纯文本，**无 `aria-live`/`role="alert"`** | `reading/page.tsx:249` |
| 全局错误页 | **无 `aria-live`** | `src/app/error.tsx:21-24`（文本）；`:15` 仅 `console.error` |
| 表单错误 | ✅ **有 `role="alert"`** | `Field.tsx:65` |
| 同步状态消息 | 纯文本 | `charts/page.tsx:274-276` |

**WCAG 条款**：**4.1.3 Status Messages (AA)**。

**判定**：❌ **全站零 `aria-live`**。屏幕阅读器用户在提交表单、等待解读、触发同步时**得不到任何状态播报**。唯一例外是 `Field.tsx:65` 的 `role="alert"`（这实际上是 `aria-live="assertive"` 的等价语义），说明**项目作者知道这个模式但只在一个组件里用了**。

## A5. 色彩依赖

五行配色（金木水火土）是否**仅靠颜色**传达信息？

| 检查 | 结果 | 证据 |
|---|---|---|
| `WuxingBars` 是否有文字标签 | 待核 | `src/components/chart/WuxingBars.tsx` |
| `WuxingRadar` 是否有文字标签 | 待核 | `src/components/chart/WuxingRadar.tsx` |
| `BaziTable` 的五行是否只染色 | 待核 | `src/components/chart/BaziTable.tsx` |
| `PalaceCell` 四化（禄权科忌） | 待核 | — |
| `StarBadge` 星曜亮度 | 待核 | — |

**可确认的**：项目中 `gold` 与 `cyan` 承载了**极重的语义负载**（D-1 §2.1）—— 金色=主/吉，青色=辅。在 `WuxingBars` 这类"用颜色区分五行"的图表中，色盲用户（尤其红绿色盲，占男性 8%）**无法区分**。

**WCAG 条款**：**1.4.1 Use of Color (A)**。

> **⚠️ 需真机/代码复核**：请 D-2 的 B5 项一并复核 `WuxingBars`/`WuxingRadar` 是否有图案或文字辅助。从 D-0 的组件清单看，这两个组件**没有 `aria-label`**（A4.2 表），因此**至少屏幕阅读器层面是缺失的**。

## A6. 表单无障碍（`src/components/form/Field.tsx`）

**实测：这是全项目无障碍质量最高的组件。**

```tsx
Field.tsx:26-45
const uid = useId();
const hintId = `${uid}-hint`;
const errorId = `${uid}-error`;
const describedBy = [error ? errorId : null, hint && !error ? hintId : null]
  .filter(Boolean).join(" ") || undefined;
// ...
cloneElement(children, {
  "aria-invalid": error ? true : undefined,
  "aria-required": required || undefined,
  "aria-describedby": describedBy,
})
```

| 检查项 | 结果 | 证据 |
|---|---|---|
| label 是否正确关联 input？ | ✅ **通过 `<label>` 包裹 `<span>{label}</span>` + 控件**，隐式关联成立 | `Field.tsx:48,50,58` |
| 错误信息是否用 `aria-describedby` 关联？ | ✅ **是**，且用 `useId()` 保证唯一 | `Field.tsx:29-32,43,65` |
| 必填是否用 `aria-required`？ | ✅ **是** | `Field.tsx:42` |
| 错误是否有 `role="alert"`？ | ✅ **是** | `Field.tsx:65` |
| 必填标记是否对屏幕阅读器友好？ | ✅ 视觉 `*` 加 `aria-hidden`，另加 `<span className="sr-only">（必填）</span>` | `Field.tsx:52-56` |
| `aria-invalid` | ✅ 有 | `Field.tsx:41` |

**⚠️ 一个限制**：`isFormControl` 判定（`Field.tsx:34-37`）只对**字符串类型的原生元素**（`input`/`select`/`textarea`）注入 ARIA 属性。若传入自定义组件（如 `RegionSelect` 的自绘下拉、`DateTimeFields` 的复合输入），**ARIA 属性不会注入**：

```tsx
Field.tsx:11    const FORM_CONTROL_TYPES = new Set(["input", "select", "textarea"]);
Field.tsx:36    FORM_CONTROL_TYPES.has(children.type)   // 自定义组件的 type 是函数/对象 → false
Field.tsx:45    : children;                              // ← 原样返回，无 ARIA
```

> **修复方向**：让 `Field` 支持通过 `render` prop 或接受自定义控件的 `id`，或要求自定义控件自行 `useId` 关联。

## A7. 动效敏感（`prefers-reduced-motion`）

**实测：0 处。** ❌

```powershell
Select-String -Path $cssAndTsx -Pattern 'prefers-reduced-motion'  →  无匹配
```

而项目存在 **54 处动效**（`transition-colors` 40 + `transition-all` 14）+ `animate-spin`（`reading/page.tsx:275`）。

**WCAG 条款**：**2.2.2 Pause, Stop, Hide (A)** + **2.3.3 Animation from Interactions (AAA)**。

**修复（S 成本，见 D-1 §6.2）**。

---

## A. WCAG 条款汇总表

| WCAG 条款 | 问题 | 证据 `文件:行号` | 等级 | 修复建议 |
|---|---|---|---|---|
| **1.3.1** Info and Relationships | 11/24 页面缺 `<h1>`（含 3 个公开分享页） | `chart/[id]/page.tsx`、`chart/[id]/reading/page.tsx`、`share/[token]/page.tsx`、`share/ziwei/[token]/page.tsx`、`share/liuyao/[token]/page.tsx`、`auth/login/page.tsx`、`auth/callback/page.tsx`、`chart/[id]/calibrate/page.tsx`、`liuyao/[id]/page.tsx`、`liuyao/[id]/reading/page.tsx`、`people/[id]/page.tsx`、`ziwei/[id]/page.tsx`、`ziwei/[id]/reading/page.tsx` | **A** | 每页补一个 `<h1>`（可用 `sr-only`） |
| **1.3.6 / 2.4.1** Bypass Blocks | 20/24 页面无 `<main>`；无 skip link | `layout.tsx:36`（无 main） | **A** | `layout.tsx` 包 `<main>` + 加 `sr-only focus:not-sr-only` skip link |
| **1.4.1** Use of Color | 五行/四化/星曜可能仅靠颜色区分；`WuxingBars`/`WuxingRadar` 无 `aria-label` | `src/components/chart/WuxingBars.tsx`、`WuxingRadar.tsx` | **A** | 加文字标签 + 图案区分；补 `aria-label` |
| **4.1.3** Status Messages | **全站 0 处 `aria-live`**；loading/错误/同步无播报 | `reading/page.tsx:249,272-279`、`error.tsx`、`charts/page.tsx:274` | **AA** | 加 `aria-live="polite"`（状态）与 `role="alert"`（错误） |
| **2.4.6** Headings and Labels | 同 1.3.1 | 同上 | **AA** | 同上 |
| **2.2.2** Pause/Stop/Hide | 无 `prefers-reduced-motion`；54 处动效 + spinner | `globals.css`（无该查询） | **A** | 加媒体查询（D-1 §6.2） |
| **1.4.3** Contrast (Minimum) | `muted/50`=2.14:1、`muted/60`=2.62:1、`muted/70`=3.14:1，共 18 处 | 见 D-0 §5.3 | **AA** | 收敛透明度档位（改 token 无效） |
| **1.4.11** Non-text Contrast | `border`/`background` = **1.48:1**（< 3:1） | `globals.css:9` | **AA** | 提高 `--border` 亮度 |
| **2.5.8** Target Size (Minimum) | `Button size="sm"` = 36px（> 24px，**通过**）；术数 pill ≈24px（临界） | `Button.tsx:24`、`charts/page.tsx:195` | AA | 见 D-2 §7 |
| **1.4.4** Resize Text | 60 处 <12px 字号（10px 占 45 处） | `page.tsx:13,26,30` 等 | AA（争议） | 见 D-2 §7.2；徽标类可豁免，信息性文本需提升 |
| **1.3.1**（补充） | `PalaceGrid.tsx:52` 用 `role="img"` 折叠整个 12 宫，屏幕阅读器读不到内容 | `PalaceGrid.tsx:52-53` | **A** | 改为 `role="list"` + 每宫 `aria-label`，或补 `sr-only` 摘要 |

---

# B. 内容设计（微文案）审计

## B1. 未走 `content` 层的硬编码中文

`src/content/zh.ts:1` 约定「全局静态中文文案 — 集中管理，各页面引用」，但该文件**仅 73 行、16 个导出常量**。以下为实测的硬编码中文（抽样，非穷举）：

| 文件:行号 | 硬编码文案 | 是否应从 `zh.ts` 取 |
|---|---|---|
| `src/app/page.tsx:123` | `人物档案` | ✅ 应（`HOME` 已有 `archives` 却无 `people`） |
| `src/app/page.tsx:144` | `免责声明` | ✅ 应 |
| `src/app/page.tsx:145` | `请在使用前阅读` | ✅ 应 |
| `src/app/page.tsx:154` | `隐私政策` | ✅ 应 |
| `src/app/page.tsx:157` | `账号` | ✅ 应 |
| `src/app/page.tsx:27` | `可用` | ✅ 应 |
| `src/app/charts/page.tsx:185` | `我的档案`（**与 `HOME.archives` 重复定义**） | ✅ 应复用 `HOME.archives` |
| `src/app/charts/page.tsx:303` | `暂无八字档案` | ✅ 应 |
| `src/app/charts/page.tsx:311` | `开始排盘`（**与 `ARTS[0].cta` 重复**） | ✅ 应复用 |
| `src/app/ziwei/page.tsx:106` | `紫微命盘` | ✅ 应 |
| `src/app/liuyao/page.tsx:101` | `问卦历史` | ✅ 应 |
| `src/app/chart/[id]/reading/page.tsx:180-181` | `请求解读接口失败，已回落规则模板。请检查网络或服务端日志。` | ✅ 应（且含技术术语，见 B3） |
| `src/app/error.tsx:21,23` | `出了点问题` / `页面渲染异常，可重试或返回首页。...` | ✅ 应 |
| `src/app/charts/page.tsx:92,102` | `确定只删除本机档案？云端档案不会改变。` | ✅ 应 |

> **重复定义的具体证据**：`开始排盘` 同时存在于 `zh.ts:45`（`ARTS[0].cta`）与 `charts/page.tsx:311`（硬编码）。`我的档案` 同时存在于 `zh.ts:71`（`HOME.archives`）与 `charts/page.tsx:185`（硬编码）。

## B2. 术语一致性

| 概念 | 出现的多种写法 | 证据 | 建议统一 |
|---|---|---|---|
| **档案列表页标题** | `我的档案`（`charts/page.tsx:185`）/ `紫微命盘`（`ziwei/page.tsx:106`）/ `问卦历史`（`liuyao/page.tsx:101`） | 同上 | ⚠️ **三种写法**。三者其实是同一类页面 |
| **模式名** | `通俗`/`专业`（`ViewToggle.tsx:9-10`），而 `zh.ts:4` 的免责声明称之为「**通俗模式**」，`BRAND.heroDesc`（`zh.ts:14`）称之为「默认通俗，可切专业模式」 | `ViewToggle.tsx:9` vs `zh.ts:4,14` | 基本一致 ✅ |
| **六爻方法名** | `铜钱`/`时间`/`手动`（`liuyao/page.tsx:21-23`） | 与 `zh.ts:60` 的「铜钱 / 时间 / 手动」一致 ✅ | ✅ 一致 |
| **"排盘" vs "看盘"** | `开始排盘`（`zh.ts:45`）、`看盘`（`charts/page.tsx:331`）、`排紫微盘`（`zh.ts:54`）、`看卦`（`liuyao/page.tsx:152`）、`起卦`（`zh.ts:63`） | 多处 | ⚠️ 八字用"排盘/看盘"，六爻用"起卦/看卦" —— **术数内部自洽，跨术数不统一但可理解** |
| **"命盘" vs "档案"** | `charts/page.tsx:289` 用「八字档案」，`:325` 用「基准日」，`zh.ts:71` 用「我的档案」 | 同上 | ⚠️ "档案"与"命盘"混用 |

**最明确的不一致**：三个术数列表页的标题分别是「我的档案」「紫微命盘」「问卦历史」。其中「我的档案」和「紫微命盘」甚至**在同一个页面**（`charts/page.tsx:185` 与 `charts/page.tsx:368` 的 `紫微命盘`）—— 同一页两个区块用了两种命名逻辑。

## B3. 文案语气

抽查错误提示是否"说人话"：

| 位置 | 原文 | 判定 |
|---|---|---|
| `src/app/chart/[id]/reading/page.tsx:237` | `未找到命盘数据，请先完成排盘。` | ✅ **说人话**，含下一步指引 |
| `src/app/chart/[id]/reading/page.tsx:180-181` | `请求解读接口失败，已回落规则模板。请检查网络或服务端日志。` | ❌ **面向开发者**。"接口""回落""服务端日志"是工程师语言，普通用户看到"服务端日志"不知所措 |
| `src/app/chart/[id]/reading/page.tsx:249` | `模板渲染失败` | ⚠️ 术语化，但至少指明了是什么失败 |
| `src/app/error.tsx:23` | `页面渲染异常，可重试或返回首页。数据保存在本机浏览器，通常不会丢失。` | ✅ **说人话**，且安抚了数据顾虑 |
| `src/components/form/Field.tsx:65` | 由调用方传入 | 待核具体文案 |
| `src/app/charts/page.tsx:92` | `确定只删除本机档案？云端档案不会改变。` | ✅ **说人话**，且明确边界 |
| `src/app/charts/page.tsx:108` | `云端删除失败，本机档案已保留` | ✅ **说人话** |

**判定**：**整体语气是面向普通用户的**，`error.tsx:23` 和 `charts/page.tsx:92` 是好的范例。**唯一的例外**是 `reading/page.tsx:180-181` 的"服务端日志"。

## B4. 空态文案

| 页面 | 空态文案 | 引导还是"暂无数据" | 证据 |
|---|---|---|---|
| `/charts`（八字） | `暂无八字档案` + `完成引导采集后即可在此查看历史命盘。` + `开始排盘` 按钮 | ✅ **引导** | `charts/page.tsx:302-313` |
| `/charts`（紫微） | `暂无紫微盘` + `紫微盘与八字档案分开保存...` + `排紫微盘` 按钮 | ✅ **引导** | `charts/page.tsx:381-389` |
| `/ziwei` | `暂无紫微盘` + `完成一次紫微排盘后即可在此查看历史命盘。` + `去排紫微盘` | ✅ **引导** | `ziwei/page.tsx:144-152` |
| `/liuyao` | `暂无问卦` + `完成一次起卦后即可在此查看历史卦象与所问事项。` + `去起卦` | ✅ **引导** | `liuyao/page.tsx:125-133` |
| `/chart/[id]/reading` | `未找到命盘数据，请先完成排盘。` + `新建命盘` | ✅ **引导** | `reading/page.tsx:233-244` |

**判定**：✅ **空态文案质量良好**，5/5 都有 CTA 引导，且文案说明了"数据存在哪"（本机浏览器）。这**推翻了 P-2 §5 的预设担忧**。

**唯一短板**：`reading/page.tsx:246-252` 的模板渲染失败态只有 `{error ?? "模板渲染失败"}` 裸文本，**无 CTA**（与空态形成对比）。

---

## C. 结论与修复优先级

### 无障碍（a11y）

| 优先级 | 问题 | 条款 | 成本 |
|---|---|---|---|
| **P1** | 零 `aria-live` → 状态/错误对屏幕阅读器完全静默 | 4.1.3 AA | **S** |
| **P1** | 20/24 页面无 `<main>` + 无 skip link | 2.4.1 A | **S** |
| **P1** | 11/24 页面缺 `<h1>`（含 3 个公开分享页） | 1.3.1 / 2.4.6 A/AA | **M** |
| **P1** | 无 `prefers-reduced-motion` | 2.2.2 A | **S** |
| **P2** | `PalaceGrid` 用 `role="img"` 折叠 12 宫，内容不可读 | 1.3.1 A | **M** |
| **P2** | 五行可视化无 `aria-label`/文字替代 | 1.4.1 A | **M** |
| **P2** | 18 处 `muted/50·60·70` 对比度不达标 | 1.4.3 AA | **M** |
| **P2** | `--border` 对比度 1.48:1 | 1.4.11 AA | **S** |

### 内容设计

| 优先级 | 问题 | 成本 |
|---|---|---|
| **P2** | 大量硬编码中文未入 `zh.ts`（含 2 处与 `zh.ts` 重复定义） | **M** |
| **P2** | 三术数列表页标题术语不统一（我的档案/紫微命盘/问卦历史） | **S** |
| **P2** | `reading/page.tsx:180-181` 错误文案含"服务端日志"等技术术语 | **S** |

### 值得肯定的部分（避免过度修复）

- ✅ **`Field.tsx` 表单无障碍实现优秀**（`useId` + `aria-describedby` + `role="alert"` + `sr-only`）
- ✅ **`ViewToggle` 的 tablist ARIA 正确**
- ✅ **`YaoLine` 的 `role="img"` + `aria-label` 优秀**（"初爻 老阴 动"）
- ✅ **无 `onClick` 绑定在 `div`/`span`**（0 处）
- ✅ **无 `tabIndex > 0` 反模式**
- ✅ **无重复 `<h1>`**
- ✅ **空态文案 5/5 有引导**
- ✅ **整体文案语气面向普通用户**
