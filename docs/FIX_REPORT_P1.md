# P1 修复报告 · 赛博命理

> 结论口径：本报告所有"实测"数字均由本文档作者在本机亲跑命令得到，命令与输出见 §3 与 §5。
> 凡无法核实者一律标注 **未验证**。所有代码引用带 `文件:行号`。

- 仓库：`E:\ai_project\cyber-divination`
- 核查基线：`HEAD = 6c40d1a0b96a3a53bc78f6964e59c7ea61778e49`（`git rev-parse HEAD`）
- 运行时：Node `v24.15.0` / npm `11.12.1` / Next.js `16.2.10 (Turbopack)`
- 覆盖 commit：`63f0e20` `488b1c6` `169b28a` `efaff81` `fd46c4e` `ac0153c`

---

## 0. 修复项总览

| ID | 问题 | 关键文件 | 状态 |
|---|---|---|---|
| P1-01 | 六爻列表页缺「解读」入口 | `src/app/liuyao/page.tsx` | 已修复 ✅ |
| P1-02 | `SiteHeader` 无术数导航 | `src/components/auth/SiteHeader.tsx` | 已修复 ✅ |
| P1-03 | 6 处 API route 直出 `e.message` | `src/lib/api/safe-error.ts` + 6 route | 已修复 ✅ |
| P1-04 | CRUD / `account/export` 无限流 | `src/lib/api/rate-limit.ts` + 19 handler | 已修复 ✅ |
| P1-05 | 26 处 `muted/40..80` 对比度不足 | 20 个文件 | 已修复 ✅ |
| P1-06 | 零 `prefers-reduced-motion` | `src/app/globals.css` | 已修复 ✅ |
| P1-07 | 全站零 `aria-live` | 多处 | 已修复 ✅ |
| P1-08 | 无 `<main>` landmark / skip link | `src/app/layout.tsx`、`globals.css` | 已修复 ✅ |
| P1-09 | 紫微十二宫 375px 每格 85px | `src/components/ziwei/PalaceGrid.tsx` | 已修复 ✅ |
| P1-10 | 解读页行长约 82 中文字 | `src/components/reading/SectionCard.tsx` | 已修复 ✅ |
| P1-11 | 计算引擎进客户端 bundle | 新增 `src/lib/liuyao/labels.ts` | **部分修复 ⚠️ 见 §1.11** |

---

## 1. 逐项详情

### P1-01 六爻列表页缺「解读」入口

**问题复述**：八字、紫微、六爻三个术数中，只有六爻的档案列表页缺少直达「解读」的按钮，用户必须在列表页点「看卦」进入结果页后才能再进解读页，多一次跳转。结果页 `src/app/liuyao/[id]/page.tsx` 本就有入口，唯独列表页缺失。

**根因**：`src/app/liuyao/page.tsx` 的卡片操作区此前只有「看卦」与删除两个动作，没有指向 `/liuyao/${item.id}/reading` 的链接。

**修复方案**：在卡片操作区补一个「解读」按钮，指向 `/liuyao/${item.id}/reading`。

- 修复位置：`src/app/liuyao/page.tsx:156-158`（由 `git show 63f0e20` 确认新增三行）

```
+  <Link href={`/liuyao/${item.id}/reading`}>
+    <Button size="sm">解读</Button>
+  </Link>
```

**量化对比**：三术数档案列表页「解读」直达入口数 **2 → 3**（八字/紫微原本已有，六爻补齐）。

**验证证据**：`git show 63f0e20 -- src/app/liuyao/page.tsx` 输出中可见上述新增块，插在「看卦」与删除按钮之间。

---

### P1-02 `SiteHeader` 无术数导航

**问题复述**：全局顶栏此前只有品牌字标与账号菜单，三个术数入口只能从首页卡片或 `/charts` 的 pill 抵达，导致 `/ziwei`、`/liuyao` 列表页成为二级孤儿，用户在任一术数解读页内也无法便捷切换术数。

**根因**：`src/components/auth/SiteHeader.tsx` 旧版（`git show 63f0e20^:src/components/auth/SiteHeader.tsx`）只渲染 `BRAND.name` 与 `<UserMenu>`，无 `<nav>`。

**修复方案**：从 `src/content/zh.ts` 的 `ARTS` 派生导航项，过滤 `status === "live" && href` 后渲染为 `<nav aria-label="术数导航">`，并额外补「档案」入口；移动端保留紧凑布局。

- 修复位置：`src/components/auth/SiteHeader.tsx:21-38`（`liveArts` 派生 + `<nav>` 块）

**量化对比**：顶栏可见导航链接 **0 → 4**（八字 / 紫微 / 六爻 / 档案）；二级孤儿页 **2 → 0**。

**验证证据**：`git show 63f0e20 -- src/components/auth/SiteHeader.tsx` 显示 `+ <nav aria-label="术数导航" className="hidden md:flex ...">` 与 `liveArts.map` 分支。

> **已知边界（未验证）**：导航类名为 `hidden md:flex`，即 **<768px 视口不显示**。移动端仍只能从首页卡片与档案页 pill 抵达术数。代码注释（`SiteHeader.tsx:56-60` 区域）已声明这是有意取舍，但"移动端导航可达性"本身 **未验证**。

---

### P1-03 API 错误信息直出内部异常

**问题复述**：6 处 API route 把 `e.message` 原文返回客户端。应用自定义校验消息无害，但 postgres 驱动错误含表名/列名/约束名，属内部结构泄露。

**根因**：`people/route.ts`、`people/[id]/route.ts`、`charts/route.ts`、`ziwei-charts/route.ts`、`liuyao-charts/route.ts` 中的 `error instanceof Error ? error.message : "..."` 直接进入响应体（`safe-error.ts:1-15` 的文件头注释记录了这 5 处行号；`git show 488b1c6` 确认共 6 处替换）。

**修复方案**：新增 `src/lib/api/safe-error.ts`，导出 `toSafeErrorMessage(err, fallback, onLog?)`：

- 白名单放行中文业务消息：`TRUSTED_PREFIXES`（`safe-error.ts:18-25`）——`profile.id` / `chart.` / `缺少` / `无效的` / `无法` / `请`；
- 拦截驱动错误：`driverMarkers`（`safe-error.ts:34-49`）——`constraint` / `violates` / `relation` / `column` / `syntax error` / `duplicate key` / `ECONNREFUSED` / `ETIMEDOUT` / `ENOTFOUND` / `at ` / `.ts:` / `.js:` / `postgres` / `SQL`；
- 超长消息（>200 字符）拦截（`safe-error.ts:53`）；
- 原文只经 `onLog` 进服务端日志，不进响应（`safe-error.ts:70-76`）；
- 日志回调抛错不影响错误响应（`safe-error.ts:71-75` 的 `try/catch`）。

**量化对比**：

| 指标 | 修复前 | 修复后 |
|---|---|---|
| 响应体内 `e.message` 直出点 | 6 | **0** |
| `toSafeErrorMessage` 生产调用点 | 0 | **5 处 / 4 文件** |
| safe-error 回归测试 | 0 | **7** |

**核实细节（重要）**：全仓仍存在 4 处 `err.message`，但**均在 `logApi` 的日志入参中，不构成泄露**。已逐处打开确认：

- `src/app/api/reading/route.ts:141` — `message:` 位于 `logApi(...)` 调用内；同一 `catch` 的响应体为 `message: "解读服务异常"`（`route.ts:147`）。
- `src/app/api/reading/liuyao/route.ts:173`、`src/app/api/reading/ziwei/route.ts:177`、`src/app/api/share/route.ts:338` — 同构，均为日志字段。

**新增测试清单**：`src/lib/api/safe-error.test.ts`（7 条）：

1. 放行本项目自定义的中文业务校验消息（3 例）
2. 拦截 Postgres 驱动错误，避免泄露表名/列名/约束名（5 类真实文本，含 `null value in column "question" violates not-null constraint`）
3. 拦截英文技术错误与堆栈残留（含 `ECONNREFUSED`、`at foo (.../client.ts:42:11)`）
4. 拦截超长消息
5. 非 Error 输入（字符串/null/undefined/对象）安全兜底
6. 通过 `onLog` 把原文交给服务端日志，且返回值仍是安全文案
7. `onLog` 抛错不影响返回

**验证证据**：

```
> npx vitest run src/lib/api/safe-error.test.ts src/lib/api/rate-limit.test.ts

 ✓ src/lib/api/safe-error.test.ts (7 tests) 7ms
 ✓ src/lib/api/rate-limit.test.ts (18 tests) 43ms

 Test Files  2 passed (2)
      Tests  25 passed (25)
   Duration  1.63s
EXIT=0
```

---

### P1-04 CRUD / `account/export` 完全无限流

**问题复述**：`checkRateLimit` 此前只覆盖 8 个路由；所有 `[id]` CRUD 与 `account/export` 完全无限流，可高频枚举 id 拖库或消耗 DB 连接。

**根因**：`src/lib/api/rate-limit.ts` 只有 `reading | share | auth | account` 四个桶（`rate-limit.ts:28` 现为五桶），且无统一便捷入口，各 route 需自行拼装 429 响应，成本高导致遗漏。

**修复方案**：

- 新增 `crud` 桶，默认 `120/分钟`，可配 `RATE_LIMIT_CRUD_MAX` / `RATE_LIMIT_CRUD_WINDOW_MS`（`rate-limit.ts:16-17` 文档，`81-86` 实现）；
- 新增 `enforceRateLimit(request, bucket, routeLabel)` 便捷入口，超限直接返回 429 + 限流响应头（`rate-limit.ts:300-327`）；
- 429 响应头由 `rateLimitResponseHeaders` 统一产出：`X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` / `Retry-After`（`rate-limit.ts:276-283`）。

**量化对比**：

| 指标 | 修复前 | 修复后 |
|---|---|---|
| `enforceRateLimit(` 调用点（src/app/api 内） | 0 | **10** |
| `src/app/api` 下含限流的 route.ts | 8 | **18 / 23** |
| `git show 169b28a` 新增 `enforceRateLimit` 行 | — | **19** |

> **关于 19 的来源**：`git show 169b28a` 的 diff 中，`const limited = await enforceRateLimit(...)` 新增行恰为 19 条。但当前 HEAD 实测 `enforceRateLimit(` 调用点为 **10 个**——因为 `169b28a` 之后 `488b1c6`/`ac0153c` 对同文件做了改写，且校验方式不同：diff 计的是"新增行数"，实测计的是"当前存在的调用点"。两个数字都对，口径不同，**不可互相替代**。逐文件实测分布见下表。

逐 route 限流覆盖（实测，`limited=TRUE` 表示含 `enforceRateLimit` 或 `checkRateLimit`）：

```
account\delete\route.ts         limited=True   calls=1
account\export\route.ts         limited=True   calls=1
auth\callback\route.ts          limited=True   calls=1
auth\login\route.ts             limited=True   calls=1
auth\logout\route.ts            limited=False  calls=0
auth\magic-link\route.ts        limited=True   calls=1
auth\session\route.ts           limited=False  calls=0
charts\route.ts                 limited=True   calls=2
charts\migrate\route.ts         limited=True   calls=1
charts\[id]\route.ts            limited=True   calls=2
health\route.ts                 limited=False  calls=0
health\ready\route.ts           limited=False  calls=0
liuyao-charts\route.ts          limited=True   calls=2
liuyao-charts\[id]\route.ts     limited=True   calls=2
people\route.ts                 limited=True   calls=2
people\[id]\route.ts            limited=True   calls=3
reading\route.ts                limited=True   calls=1
reading\liuyao\route.ts         limited=True   calls=1
reading\status\route.ts         limited=False  calls=0
reading\ziwei\route.ts          limited=True   calls=1
share\route.ts                  limited=True   calls=1
ziwei-charts\route.ts           limited=True   calls=2
ziwei-charts\[id]\route.ts      limited=True   calls=2
```

未限流的 5 个：`auth/logout`、`auth/session`、`health`、`health/ready`、`reading/status`。这四个健康检查/会话端点为**有意保留**（探针需高频访问，限流会误杀）——**该意图未经代码注释核实，标注为未验证**。

**新增测试清单**：`src/lib/api/rate-limit.test.ts` 由 **14 → 18**（`169b28a` 新增 4 条）：

- 「额度内放行（返回 null）」
- 「超限时返回 429 并带限流响应头」
- 「crud 桶默认 120/分钟」
- 「crud 与其他桶相互隔离（不同桶不共享计数）」

**验证证据**：见 P1-03 的 vitest 输出（同一批次运行，18 tests 全绿）。

---

### P1-05 `muted/40..80` 对比度不足

**问题复述**：26 处 `text-muted/NN`（NN≤80）在深色背景上对比度 1.77–3.90:1，低于 WCAG 2.1 AA 正文要求的 4.5:1。

**根因**：`--muted: #8b8680`（`src/app/globals.css:6`）为不透明色，叠加 alpha 后实际渲染色逼近 `--background: #07080c`，对比度随 alpha 线性衰减。

**修复方案**：把 26 处 `text-muted/NN`（NN≤80）统一提升为 `text-muted/90`，涉及 20 个文件。

**量化对比（我独立复算 WCAG 2.1 相对亮度公式得到，非引用 commit message）**：

合成公式：`composited = round(fg × α + bg × (1-α))`，`bg = #07080c`。

| alpha | 合成后 RGB | 对比度 vs #07080c | AA 4.5:1 |
|---|---|---|---|
| 0.40 | `rgb(60,58,58)` | **1.77** | FAIL |
| 0.50 | `rgb(73,71,70)` | **2.17** | FAIL |
| 0.60 | `rgb(86,84,82)` | **2.66** | FAIL |
| 0.70 | `rgb(99,96,93)` | **3.20** | FAIL |
| 0.80 | `rgb(113,109,105)` | **3.90** | FAIL |
| **0.90** | `rgb(126,121,116)` | **4.65** | **PASS** ✅ |
| 1.00 | `rgb(139,134,128)` | **5.55** | **PASS** ✅ |

结论：**只有 α ≥ 0.90 才过 AA**，故取 `muted/90`（4.65:1）为统一收敛值。

**残留检查（实测）**：全仓 `text-muted/NN` with NN≤80 命中数 = **0**；现存变体仅 `muted/90`，共 **22 处**。

> **口径说明**：commit message 称改动 26 处，当前实测现存 `muted/90` 为 22 处。差异来自 `fd46c4e` 之后 `ac0153c` 等 commit 对部分文件的进一步改写（例如 `src/app/page.tsx`、`src/app/liuyao/page.tsx` 有新增/移动）。"26 处被修改"与"22 处现存"是两个不同口径，均成立；**26 这一数字本身未在本报告中被独立复现**。

---

### P1-06 零 `prefers-reduced-motion`

**问题复述**：全站 0 处 `prefers-reduced-motion` 支持，而项目有大量 transition/animate。开启系统"减少动态效果"的前庭功能障碍用户仍会看到全部动效。

**根因**：`src/app/globals.css` 无任何 motion 媒体查询。

**修复方案**：在 `globals.css` 增加全局降级块（`globals.css:112-128`），对 `*`、`*::before`、`*::after` 统一压缩：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**量化对比**：

| 指标 | 修复前 | 修复后 |
|---|---|---|
| `prefers-reduced-motion` 出现处（含注释） | 0 | **2**（`globals.css:115` 注释 + `:119` 媒体查询） |
| 受影响的 `transition` 声明 | 全部生效 | **58 处全部被覆盖** |
| 受影响的 `animate-` 类 | 全部生效 | **2 处全部被覆盖** |

（58 / 2 为实测 `Select-String` 计数：`transition` 命中 58 行、`animate-` 命中 2 行。）

---

### P1-07 全站零 `aria-live`

**问题复述**：全站没有任何 `aria-live`，动态状态变化（解读加载、云端同步结果、登录回调）对屏幕阅读器完全静默。

**修复方案**：在关键异步状态处补 `aria-live` / `role="status"` / `role="alert"`。

**量化对比**：

| 指标 | 修复前 | 修复后 |
|---|---|---|
| `aria-live` 出现处 | **0** | **4** |

修复后 `aria-live` 全部落点（实测）：

- `src/app/auth/callback/page.tsx:85` — `role="status" aria-live="polite"`
- `src/app/charts/page.tsx:279` — `aria-live="polite"`
- `src/app/liuyao/page.tsx:139` — `aria-live="polite"`
- `src/app/ziwei/page.tsx:141` — `aria-live="polite"`

同一批 commit 另补 `role="status"` / `role="alert"` 共 15 处（`git grep` 实测），分布在 `AccountPanel`(4)、`LoginForm`(2)、`Field`(1)、`CastForm`(1)、`GuestBanner`(1)、`auth/callback`(2)、`charts`(1)、`liuyao`(1)、`settings`(1)、`ziwei`(1)。

补充：`chart/[id]/reading/page.tsx:255` 的失败态补了 `role="alert" aria-live="assertive"`。

> **未验证**：`aria-live` 的实际播报效果需要真实屏幕阅读器（NVDA/VoiceOver）验证，本报告仅核实属性存在与位置正确。

---

### P1-08 无 `<main>` landmark，无 skip link

**问题复述**：20/24 页无 `<main>` landmark，且无 skip link，键盘用户无法跳过顶栏。

**根因**：`src/app/layout.tsx` 直接渲染 `{children}`，未包裹 `<main>`；`globals.css` 无 `.skip-link` 工具类。

**修复方案**：

- 根布局包裹 `<main id="main" className="flex flex-1 flex-col">`（`layout.tsx:44-46`）；
- 顶部加 `<a href="#main" className="skip-link">跳到主要内容</a>`（`layout.tsx:40-42`）；
- `globals.css` 补 `.skip-link`（默认视觉隐藏，聚焦显示）与 `.skip-link:focus`（`globals.css:130-147`）。

**量化对比**：

| 指标 | 修复前 | 修复后 |
|---|---|---|
| 根布局级 `<main>` landmark | 0 | **1（全站覆盖）** |
| 源码中 `<main` 标签总数 | 4 | **5** |
| skip link | **0** | **1** |

修复后 5 处 `<main`（实测）：

- `src/app/layout.tsx:44` — 根 landmark `id="main"`
- `src/app/page.tsx:86` — 首页（根 landmark 内的嵌套 `<main>`）
- `src/app/chart/new/page.tsx:26`
- `src/app/liuyao/new/page.tsx:31`
- `src/app/ziwei/new/page.tsx:30`

> **实测发现的偏差**：这 4 个页面级 `<main>` 现在嵌套在根 `<main id="main">` 内部，形成 **一个页面内多个 `<main>` landmark**。这不符合 ARIA 实践（`main` 应每页唯一，或用 `role="main"` 标注且唯一）。**这是本次修复引入的新问题**，属于可访问性回归风险，建议后续把这 4 处页面级 `<main>` 改为 `<div>`/`<section>`。本报告如实记录，不掩盖。

---

### P1-09 紫微十二宫 375px 下每格 85px

**问题复述**：375px 视口下紫微十二宫每格仅 85px，字号被压到 8–10px。

**根因**：`PalaceGrid` 的 4×4 网格受父容器 `max-w-2xl` 与视口双重限制，375px 视口下容器内宽 343px，4 列均分即 85.8px。

**修复方案**：外层加 `overflow-x-auto`，内层网格加 `min-w-[560px]`，允许横向滚动以换取每格宽度（`PalaceGrid.tsx:57-59`）；中宫与缺宫字号由 `8px/9px` 提升到 `10px/11px`（`PalaceGrid.tsx:87`、`:114`、`:139`）。

**量化对比（独立算得）**：

| 场景 | 容器内宽 | 每格宽度 | 中宫/缺宫字号 |
|---|---|---|---|
| 修复前 @375px | 343px | **85.8px** | 8px / 9px |
| 修复后 @375px | 560px（min-w，横向滚动） | **140.0px** | 10px / 11px |
| 修复后 @≥672px | 672px（max-w-2xl） | 168.0px | 10px / 11px |

每格宽度 **85.8px → 140.0px（+63.2%）**，字号 **8px → 10px（+25%）**。

附带的 a11y 修复：整体 `role="img"` → `role="group"` + `aria-label`（`PalaceGrid.tsx:60-61`），并补 `sr-only` 纯文本摘要 `<ul>`（`PalaceGrid.tsx:68-80`），使屏幕阅读器可逐宫读到「宫名（地支）：星曜」列表。

---

### P1-10 解读页桌面端行长约 82 中文字

**问题复述**：解读页容器 `max-w-6xl`（1152px）下，14px 中文每行约 82 字，远超中文排版推荐的 40 字上限，阅读时易串行。

**根因**：`src/components/reading/SectionCard.tsx` 正文直接继承页面容器宽度，无独立行长约束。

**修复方案**：**不**收窄页面容器（表格/雷达图仍需宽度），只给正文与脚注单独限宽 `max-w-[38rem]`。

- `SectionCard.tsx:22` — 正文 `text-sm leading-relaxed whitespace-pre-wrap max-w-[38rem]`
- `SectionCard.tsx:26` — 脚注 `mt-3 pt-3 border-t border-border/40 max-w-[38rem]`

**量化对比（按 CJK 字形宽 = 字号 14px 独立算得）**：

| 场景 | 文本域宽度 | 每行中文字数 |
|---|---|---|
| 修复前 | 1152px（`max-w-6xl`） | **82** |
| 修复后 | 608px（`max-w-[38rem]`） | **43** |

行长 **82 → 43 字（-47.6%）**，进入 40 字左右的推荐区间。

---

### P1-11 向导把完整计算引擎打进客户端 bundle ⚠️ 部分修复

**问题复述**：`CastForm.tsx` 仅为渲染一个问事类别下拉框，就 `import { CATEGORY_LABEL } from "@/lib/liuyao/analyze/yongshen"`，把六爻分析引擎拉进 `/liuyao/new` 首屏。

**修复方案（已落地部分）**：

- 新增 `src/lib/liuyao/labels.ts`，`CATEGORY_LABEL` 迁入，**仅 `import type`**，零引擎依赖（`labels.ts:14`、`:16-30`）；
- `yongshen.ts` 改为 re-export 保持向后兼容（`git show efaff81` 确认 `-export const CATEGORY_LABEL...` → `+export { CATEGORY_LABEL } from "@/lib/liuyao/labels";`）；
- `CastForm.tsx:11` 现为 `import { CATEGORY_LABEL } from "@/lib/liuyao/labels";`。

**bundle 实测（我亲跑，关键结论与 commit message 不完全一致）**：

`/liuyao/new` 的客户端入口 chunk 由 `.next/server/app/liuyao/new/page_client-reference-manifest.js` 的 `entryJSFiles` 确定：

```
"[/liuyao/new/page]":["static/chunks/302eyrvkghkx3.js","static/chunks/0vk3nqty20h_-.js",
                      "static/chunks/0lgz32w6j0qhc.js","static/chunks/2rvac13wjzp6e.js",
                      "static/chunks/1-2q508y8gstd.js"]
```

对全部 **45 个** `.next/static/chunks` 文件做字节级 UTF-8 扫描：

| 标识符 | 命中文件数 |
|---|---|
| `CATEGORY_YONGSHEN` | **0** ✅ |
| `YONGSHEN_RULES` | **0** ✅ |
| `inferQuestionCategory` | **0** ✅ |
| `CATEGORY_LABEL` | **0** ✅ |
| `assignLiuqin` / `pickLiuqinYao` / `judgeLiuqin` | **0** ✅ |

**但**：`求财`（`CATEGORY_LABEL` 的中文值）命中 **5 个 chunk**，其中 **`0lgz32w6j0qhc.js` 与 `1-2q508y8gstd.js` 正是 `/liuyao/new` 的入口 chunk**。上下文显示完整类别映射仍在：

```js
g=[{id:"",label:"自动（按事项关键词）"},...Object.entries(
  {wealth:"求财",career:"功名事业",lawsuit:"官非诉讼",marriage:"婚恋感情",
   health:"健康疾病",travel:"出行迁移",parents:"父母文书房产",offspring:"子女晚辈",
   siblings:"兄弟朋友合伙",self:"自身/综合",other:"其他（取世）"}
).map(([e,t])=>({id:e,label:t}))]
```

进一步，`1-2q508y8gstd.js` 与 `1858q_vfv336v.js` 内含完整用神规则表：

```js
let p={wealth:"妻财",career:"官鬼",lawsuit:"官鬼",marriage:"妻财",...},
$=[{id:"wealth",category:"wealth",pattern:/财|钱|生意|投资|求财|进账|.../,yongShen:"妻财"},...]
```

**成因**：`/liuyao/new` 页面同时渲染 `ChartResult`，而 `ChartResult` 依赖 `HexagramVisual`/`YaoLine`，其上游 `castLiuyao`（`CastForm.tsx:10` → `src/lib/liuyao/cast/index.ts`）经 `cast/build.ts:16` **`import { enrichChart } from "../analyze"`** 反向拉入整个 `analyze/` 目录。压缩后标识符被重命名（故 `CATEGORY_YONGSHEN` 等**符号名**已搜不到），但**规则数据与正则本身仍在客户端**。

**结论与量化对比**：

| 指标 | 修复前 | 修复后 | 判定 |
|---|---|---|---|
| `CATEGORY_YONGSHEN` 符号名在客户端 chunk | 存在 | **0** | ✅ 已消除 |
| `YONGSHEN_RULES` 符号名在客户端 chunk | 存在 | **0** | ✅ 已消除 |
| `inferQuestionCategory` 符号名在客户端 chunk | 存在 | **0** | ✅ 已消除 |
| `CATEGORY_LABEL` 符号名在客户端 chunk | 存在 | **0** | ✅ 已消除 |
| `CATEGORY_LABEL` **数据值**（`求财` 等） | 存在 | **仍存在（2 个入口 chunk）** | ⚠️ |
| 用神规则表**数据**（`求财` 正则等） | 存在 | **仍存在** | ⚠️ |

**如实结论**：commit message 所述"已无 `CATEGORY_YONGSHEN` / `YONGSHEN_RULES` / `inferQuestionCategory` 任何痕迹"——**在"字符串符号名"口径下成立**（我用字节扫描复核确认 0 命中）。但**"引擎已从客户端 bundle 剔除"这一更强的表述不成立**：真正的引擎数据（用神规则、问事类别映射）仍随 `/liuyao/new` 下发，只是被压缩器重命名了。要真正剔除，需拆分 `cast/build.ts` 的 `enrichChart` 依赖，或让 `/liuyao/new` 不渲染 `ChartResult`（改为跳转到结果页再计算）。**此项建议重新打开。**

> **未验证**：未做前后体积（kB）对比——`efaff81` 未记录基线体积，且 `git worktree` 复现需完整重跑构建，本次未执行。

---

## 2. 新增测试清单汇总

| 文件 | 新增/变化 | 条数 |
|---|---|---|
| `src/lib/api/safe-error.test.ts` | 全新增（`488b1c6`） | 7 |
| `src/lib/api/rate-limit.test.ts` | 14 → 18（`169b28a`） | +4 |
| **合计** | | **+11** |

实测测试总数：**600 → 611**（工作树文件 73 → 74）。

---

## 3. 门禁复验

以下四项均由本报告作者在本机亲跑，核查基线 `HEAD = 6c40d1a`。

> **并发写入提示**：本次核查期间，仓库有**另一个 agent 并行提交**（在我完成核查后 `HEAD` 前进到 `0093abd fix(security): 补 AUTH_SECRET 熵检查`）。已核实 `6c40d1a` 是当前 HEAD 的祖先（`git merge-base --is-ancestor 6c40d1a HEAD` 退出码 0），六个 P1/P2 commit 全部完好。§3.1–3.4 的输出为 **`6c40d1a` 时点**的真实结果；§3.5 为 `0093abd` 时点的复跑结果（测试数因并发 agent 新增用例而变化）。

### 3.1 `npm run lint -- --max-warnings=0`

```
> cyber-divination@0.1.0 lint
> eslint --max-warnings=0

LINT_EXIT=0
```

**退出码：0**（无任何输出，即 0 error / 0 warning）

### 3.2 `npx tsc --noEmit`

```
===== GATE 2: npx tsc --noEmit =====

TSC_EXIT=0
```

**退出码：0**（无类型错误）

### 3.3 `npm test`

```
> cyber-divination@0.1.0 test
> vitest run

 Test Files  74 passed (74)
      Tests  611 passed (611)
   Start at  02:12:44
   Duration  12.98s (transform 9.53s, setup 0ms, collect 42.63s, tests 13.17s, environment 30ms, prepare 25.20s)

TEST_EXIT=0
```

**退出码：0**（74 文件 / 611 测试全通过）

关键子集：

```
 ✓ src/lib/api/safe-error.test.ts (7 tests) 12ms
 ✓ src/lib/api/rate-limit.test.ts (18 tests) 46ms
```

### 3.4 `npm run build`

```
▲ Next.js 16.2.10 (Turbopack)
- Cache Components enabled

  Creating an optimized production build ...
Found 2 warnings while optimizing generated CSS:

Issue #1:
│   .w-\[0_0_\*px_var\(--\*-glow\)\] {
│     width: 0 0 *px var(--*-glow);
┆                          ^-- Unexpected token Delim('*')

Issue #2:
│   .shadow-\[0_0_\*px_var\(--\*-glow\)\] {
│     --tw-shadow: 0 0 *px var(--*-glow);
┆                                ^-- Unexpected token Delim('*')

✓ Compiled successfully in 7.5s
  Running TypeScript ...
  Finished TypeScript in 11.1s ...
✓ Generating static pages using 11 workers (46/46) in 1480ms
  Finalizing page optimization ...

> cyber-divination@0.1.0 postbuild
> node scripts/copy-standalone-assets.mjs

BUILD_EXIT=0
```

**退出码：0**（构建成功，46/46 静态页生成）

### 3.5 复跑（`HEAD = 0093abd`，并发 agent 提交后）

为排除"并发提交破坏门禁"的可能，在 `0093abd` 时点复跑前三项：

```
--- lint ---
> eslint --max-warnings=0
LINT_EXIT=0

--- tsc ---
TSC_EXIT=0

--- test ---
 Test Files  76 passed (76)
      Tests  627 passed (627)
   Duration  10.85s
TEST_EXIT=0
```

**退出码：全部 0 ✅**

> 测试数 **611 → 627**（74 → 76 文件）的原因是并发 agent 提交了新的测试文件（`src/lib/__verify__/` 等），**与 P1 六项修复无关**。P1 相关的 611 基线仍然成立。

### 3.6 关于那 2 条 CSS 警告（实测追踪，与 commit message 的定性不同）

`fd46c4e` 的 commit message 称其为"既有问题，经 `git stash` 对照验证与本次改动无关（Tailwind v4 + Turbopack 上游交互）"。**我实测追到了确切来源**：

1. 生成的 CSS（`.next/static/chunks/36epm5m8sbj2k.css`，60095 字节）中确实存在非法规则：
   ```
   .shadow-\[0_0_\*px_var\(--\*-glow\)\]{box-shadow:var(--tw-inset-shadow), ...}
   ```
2. 全仓搜索该字面量，唯一命中 **`docs/REVIEW_DESIGN_INVENTORY.md:300` 与 `:323`**：
   ```
   300: | 其余（`w-[0_0_*px_var(--*-glow)]` 系阴影被 `w-` 前缀误配所得） | 17 |
   323: | `--shadow-glow-sm/md/lg` | 全部 `shadow-[0_0_*px_var(--*-glow)]` | 17 |
   ```
3. 该文档**未被这 6 个 P1/P2 commit 修改**（`git log -- docs/REVIEW_DESIGN_INVENTORY.md` 只显示 `8911b5e`）。

**结论**：警告的根因是 **Tailwind v4 的静态提取器扫描了 Markdown 文档中的字面量**（`docs/` 在扫描范围内），把文档里作为**说明文字**的反引号代码片段当成了真实工具类，生成了 `w-[0_0_*px_...]` 与 `shadow-[0_0_*px_...]` 两条非法规则。这**确实不是这 6 个 commit 引入的**（文档未被它们改动），但也不是"上游 Turbopack 交互"——而是**文档内含可被误提取的类名字面量**。

`globals.css:66-68` 的注释已意识到同类风险（"注释中不要写出 shadow- 紧跟方括号的任意值类名文本"），但只治理了 `globals.css`，**未治理 `docs/REVIEW_DESIGN_INVENTORY.md`**。修复方向是把该文档里的 `` `w-[0_0_*px_var(--*-glow)]` `` 拆开写（如加空格或转义）以避开提取器。

> **未验证**：未实际修改该文档验证警告消失（禁止修改报告外文件）。

---

## 4. 遗留与建议

| 项 | 说明 | 建议 |
|---|---|---|
| P1-11 二次修复 | 用神规则/类别映射数据仍在 `/liuyao/new` 客户端 chunk 内（仅符号名被压缩重命名） | **重新打开**：拆分 `cast/build.ts` 的 `enrichChart` 依赖 |
| P1-08 多 `<main>` | 页面级 4 个 `<main>` 嵌套于根 `<main id="main">` 内，违反唯一 landmark 实践 | 改为 `<div>`/`<section>` |
| P1-02 移动端导航 | `hidden md:flex` 使 <768px 无术数导航 | 补移动端菜单或确认取舍 |
| CSS 提取警告 | `docs/REVIEW_DESIGN_INVENTORY.md:300,323` 的字面量被 Tailwind 误提取 | 拆分该文档中的类名字面量 |
| 屏幕阅读器 | `aria-live` 实际播报效果未用 NVDA/VoiceOver 验证 | 手工 a11y 测试 |

---

## 5. 复现命令

```powershell
cd E:\ai_project\cyber-divination
git rev-parse HEAD                     # 6c40d1a0b96a3a53bc78f6964e59c7ea61778e49
git show --stat 63f0e20 488b1c6 169b28a efaff81 fd46c4e ac0153c
npm run lint -- --max-warnings=0       # exit 0
npx tsc --noEmit                       # exit 0
npm test                               # exit 0, 74 files / 611 tests
npm run build                          # exit 0, 2 CSS warnings

# bundle 扫描（注意 chunk 无扩展名陷阱：Get-ChildItem -Filter *.js 会返回 0）
$chunks = Get-ChildItem .next\static\chunks -Recurse -File
foreach ($f in $chunks) {
  $t = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
  if ($t.Contains('求财')) { $f.Name }
}

# 基线测试数复现
git worktree add "$env:TEMP\cd-pre-p1" 69bba86
cmd /c mklink /J "$env:TEMP\cd-pre-p1\node_modules" "E:\ai_project\cyber-divination\node_modules"
cd $env:TEMP\cd-pre-p1; npx vitest run    # 73 files / 600 tests
cd E:\ai_project\cyber-divination; git worktree remove "$env:TEMP\cd-pre-p1" --force
```

---

*报告生成时间：2026-09-19 · 核查 HEAD：`6c40d1a`*
