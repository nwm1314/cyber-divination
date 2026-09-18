# 赛博命理 · 工程架构与代码质量审查报告

> 审查类型：**只读审查**（未修改任何源文件、未执行 `npm install`、未启动 dev server）
> 基线：Next.js **16.2.10** / React 19.2.4 / TypeScript / Tailwind v4
> 范围：`src/app/**`、`src/lib/**`、`src/components/**`
> 方法：先读 `node_modules/next/dist/docs/` 现行指南，再评审代码（见 §4）
> 说明：所有结论均标注 `文件:行号`。凡未能直接验证者，明确写「不确定」。

---

## 1. 架构现状图

### 1.1 渲染边界（Server / Client）

**统计事实**（`grep '^"use client"'` 全仓匹配）：

| 维度 | 数量 |
|---|---|
| `"use client"` 文件总数 | **37** |
| `page.tsx` 总数 | 24 |
| 其中客户端页面 | **14** |
| 其中服务端页面 | **10** |
| `route.ts`（Route Handler） | 23 |

客户端边界的分布（三类）：

1. **页面级 `"use client"`（14 个）**——整页成为客户端组件，这是最主要的边界扩张来源：
   `/charts`、`/people`、`/people/[id]`、`/settings`、`/auth/callback`、
   `/chart/[id]`、`/chart/[id]/calibrate`、`/chart/[id]/reading`、
   `/ziwei`、`/ziwei/[id]`、`/ziwei/[id]/reading`、
   `/liuyao`、`/liuyao/[id]`、`/liuyao/[id]/reading`
2. **组件级 `"use client"`（21 个）**——表单向导、分享面板、图表可视化、阅读交互：
   `BirthWizard`、`ZiweiWizard`、`CastForm`、`Field`、`DateTimeFields`、`RegionSelect`、
   `UserMenu`、`LoginForm`、`AuthModeSync`、`AccountPanel`、`GuestBanner`、
   `ShareSheet`、`ZiweiShareSheet`、`LiuyaoShareSheet`、`ExportBar`、
   `CalibrateBox`、`CalibrateQuestion`、`TrustPanel`、`ChartResult`、
   `HexagramVisual`、`YaoLine`、`YunStrip`
3. **错误边界 `error.tsx`（1 个）**——`src/app/error.tsx:1`，必需（React 错误边界必须是客户端组件）。

**符合度评估**：组件级边界**基本合理**——`Field`/`Button`/`Card` 之外的可交互单元都标了 `"use client"`，纯展示组件（`BaziTable`、`WuxingBars`、`PalaceGrid`、`ShareCard`、`DisclaimerFooter` 等）保持服务端。**问题在页面级**：14 个页面整体标为客户端，其中 `/charts`（`src/app/charts/page.tsx:1`，434 行）、`/people/[id]`（`src/app/people/[id]/page.tsx:1`，406 行）等页面把「取数 + 渲染」全部放进客户端，服务端完全没有参与数据准备。

### 1.2 根布局读取会话 —— 全站动态渲染的根源

**核实结论：`docs/PROJECT_REVIEW.md` §2.6 指出的问题仍然存在，未修复。**

```
src/app/layout.tsx:26    const session = await getServerSession();
```

调用链：

```
src/app/layout.tsx:26  await getServerSession()
  └─ src/lib/auth/get-session.ts:14   await cookies()      ← 运行时 API
     └─ src/lib/auth/get-session.ts:16 sessionFromToken(token)
```

`cookies()` 是 Next.js 的 runtime API。根布局是**所有路由的公共祖先**（App Router 中每个页面都嵌套在根布局内），因此根布局一旦访问 `cookies()`，**整个应用的每一个页面**都失去静态预渲染资格，被迫按请求渲染。

**独立验证（不依赖主 reviewer 的结论）**：

我读取了构建产物而非依赖他人转述：

```
.next/prerender-manifest.json  →  routes 仅 2 条：
   /_global-error
   /favicon.ico
```

也就是说，**真实业务页面静态预渲染数量 = 0**。`.next/app-path-routes-manifest.json` 中登记的 52 个路由（24 页面 + 23 Route Handler + 5 特殊文件）无一进入静态清单。这与主 reviewer 所述「49 条路由全部 `ƒ (Dynamic)`，静态页 0 条」在实质上一致（口径差异：他计 49 条业务路由，我计 52 条含特殊文件），**该事实成立**。

**受影响页面清单（全部 24 个页面，无一例外）**：

| 页面 | 路径 | 类型 | 受根布局影响 |
|---|---|---|---|
| 首页 | `src/app/page.tsx` | 服务端组件，纯静态内容 | ✅ 动态 |
| 隐私政策 | `src/app/privacy/page.tsx` | 服务端组件，纯静态文案 | ✅ 动态 |
| 账号 | `src/app/account/page.tsx` | 服务端组件 | ✅ 动态 |
| 登录 | `src/app/auth/login/page.tsx` | 服务端组件 | ✅ 动态 |
| 新建命盘 | `src/app/chart/new/page.tsx` | 服务端组件 | ✅ 动态 |
| 新建紫微 | `src/app/ziwei/new/page.tsx` | 服务端组件 | ✅ 动态 |
| 新建六爻 | `src/app/liuyao/new/page.tsx` | 服务端组件 | ✅ 动态 |
| **八字公开分享** | `src/app/share/[token]/page.tsx` | 服务端组件，`generateMetadata` + `getShareSnapshot` | ✅ **动态（重点）** |
| **紫微公开分享** | `src/app/share/ziwei/[token]/page.tsx` | 服务端组件 | ✅ **动态（重点）** |
| **六爻公开分享** | `src/app/share/liuyao/[token]/page.tsx` | 服务端组件 | ✅ **动态（重点）** |
| 分享 OG 图 | `src/app/share/[token]/opengraph-image.tsx` | 图片生成 | ✅ 动态 |
| 其余 13 个客户端页面 | 见 §1.1 | 客户端组件 | ✅ 动态 |

**对首页 `/` 的具体影响**（`src/app/page.tsx:82-163`）：该页内容**完全静态**——所有文案来自 `@/content/zh` 编译期常量（`src/app/page.tsx:4`），无任何取数。它本可 100% 预渲染为静态 HTML，现在每次请求都要：读取 cookie → 解析会话 → 服务端渲染。这是纯粹的浪费，且使首页无法被 CDN 边缘缓存。

**对公开分享页的具体影响**（`src/app/share/[token]/page.tsx:52-89`）——这是**更严重**的一类：

- 分享页是**面向未登录外部访客**的页面（`robots: { index: false }`，`src/app/share/[token]/page.tsx:48`）。
- 该页需要 `getShareSnapshot(token)`（`src/app/share/[token]/page.tsx:54`）才能渲染，**本身就是动态的**——这一点必须讲清楚：**即使修好根布局，分享页也不会自动变成静态页**，因为 `generateMetadata`（`:11-50`）与页面（`:52-89`）都要读取 token 对应的数据。
- 但根布局让它**更糟**：根布局的 `cookies()` 在**页面组件之前**解析，意味着请求必须先完成会话读取，才能开始渲染分享内容。同时 `SiteHeader`（`src/components/auth/SiteHeader.tsx:7-21`）会被渲染到分享页上，把**访客无关的登录态 UI**注入到一个应当极简、可缓存的公开页面。
- 结论：分享页应当是「不读会话、可缓存/可流式」的路由。当前它被根布局绑死在动态且带会话的渲染路径上。

**关键判断**：这不只是「性能打折」。因为根布局**同时**做了两件强耦合的事——(a) 读取会话，(b) 渲染 `SiteHeader`/`AuthModeSync` 这两个依赖会话的 UI——所以**不能通过简单删掉 `:26` 那行来修复**，必须先把会话读取下移到真正需要它的位置（详见 §3 P0-1 的修复方案）。

### 1.3 敏感数据是否泄漏到客户端 props

**结论：未发现会话凭证泄漏。** 逐一核对了从服务端组件传入客户端组件的 props：

- `src/app/layout.tsx:34-35` 把 `session` 传给 `AuthModeSync` 与 `SiteHeader`（二者 → `UserMenu`，`src/components/auth/SiteHeader.tsx:17`）。
- `AppSession` 的形状（`src/lib/types/user.ts:95-105`）仅含：`userId`、`email`、`displayName`、`image`、`authenticated`、`expires`。
- **不含** session token、cookie 值、密码哈希、密钥。`src/lib/auth/get-session.ts:15` 读取的 token 仅用于 `sessionFromToken(token)`（`:16`），token 本身未进入返回对象。

因此这是**信息暴露最小化做得正确的部分**。唯一可讨论点：`userId`/`email` 会随 RSC payload 下发到客户端，但它们是渲染登录态 UI 的必需数据，且属于「用户自己的数据」，不构成越权泄漏。

### 1.4 数据流：浏览器 IDB ↔ 服务端 Postgres ↔ 云存储（文件）

实际存在**两条正交的「双实现」轴**，这是本项目存储层最需要理解的结构：

**轴 A —— 本地存储介质按登录态切换**（浏览器侧）

```
                     isAccountPersistMode()  ← src/lib/storage/mode.ts:33-41
                     （localStorage 中 bd_account_mode === "1"）
                              │
              ┌───────────────┴───────────────┐
         已登录(account)                   未登录(guest)
              │                               │
        localStorage                      sessionStorage
              │                         （关浏览器即清空）
              └───────────┬───────────────────┘
                          ▼
                 getDataStore()  src/lib/storage/mode.ts:193-198
                          │
              ┌───────────┴────────────┐
              ▼                        ▼
      kv.ts（同步读写，主路径）    idb.ts（IndexedDB 异步后备）
      src/lib/storage/kv.ts       src/lib/storage/idb.ts
              │                        │
              │  写入时机：仅账号模式（index.ts:35-39 persistIdb）
              └───────────┬────────────┘
                          ▼
              storage/index.ts（八字）、person.ts、liuyao.ts
```

关键细节：**IndexedDB 只在账号模式下写入**（`src/lib/storage/index.ts:35-39`，`persistIdb` 内部判断 `isAccountPersistMode()`）。游客模式下 IDB 完全不参与。因此 kv.ts 是**唯一权威读写路径**，idb.ts 实质是「账号模式的耐久备份」，而非对称的读写层。这削弱了「IDB 后备」这一表述的准确性。

**轴 B —— 云端存储驱动按环境变量切换**（服务端）

```
        getCloudStoreDriver()   src/lib/storage/driver.ts:11-24
        CLOUD_STORE_DRIVER = postgres | file | (未设→自动)
                    │
        ┌───────────┴────────────┐
   "postgres"                  "file"
   （要求 DATABASE_URL，         （data/*.json）
    否则 driver.ts:14-18 抛错）        │
        │                              ▼
        │                    内存 memory + fs 写盘
        │                    （进程内缓存，见 cloud-store.ts:36-64）
        ▼
   pg-bazi-store.ts / pg-ziwei-store.ts / pg-person-store.ts
   （cloud-liuyao-store.ts 内联 SQL，无独立 pg 模块）

   两者的分派点：各 cloud-*.ts 内部的 isPostgresDriver()
```

**浏览器 ↔ 服务端的同步通道**：

```
浏览器 localStorage/sessionStorage
        │  src/lib/storage/sync.ts: push / pull / merge / auto
        ▼
fetch("/api/charts", "/api/ziwei-charts", "/api/liuyao-charts", "/api/charts/migrate")
        ▼
   Route Handlers（src/app/api/**/route.ts）
        ▼  校验 session（sessionFromToken）→ 强制 userId 分区
   云端 store（cloud-store.ts 等）
        ▼
   Postgres  或  data/*.json
```

**迁移/合并路径**（首次登录时）：

```
src/lib/storage/migrate.ts:271-315  runMigrateFromLocal()
  ├─ collectLocalChartsForMigrate()  :103-124   收集本机全部档案
  └─ POST /api/charts/migrate
        └─ src/app/api/charts/migrate/route.ts:29-191
              ├─ planMerge()  纯函数：比较 updatedAt 决定胜负
              └─ upsertCloudChart / getCloudChart
```

### 1.5 模块依赖方向

**循环依赖检查（已实测，非目测）**：我对 `src/lib` + `src/components` 构建了导入图（解析 `@/` 别名到真实文件，共 **251 条边**），并用 DFS 做环检测。

**结论：未发现循环依赖（0 个环）。** 包括扩大步长到 8 跳的搜索。

需要特别说明两处「看起来像环但实际不是」的地方，因为它们是刻意设计：

- `src/lib/types/user.ts:4` 明确注释「本文件不从 `./index` 导入，避免与 index 再导出形成循环依赖」——该防御是有效的，`src/lib/types/index.ts:25-33` 单向再导出 `user.ts`。
- `src/lib/storage/migrate.ts:17-27` 与 `src/lib/storage/sync.ts:19-30,48-60` 从 `./index` 导入，而 `index.ts` **不**再导出 `migrate`/`sync`（`src/lib/storage/index.ts` 的再导出仅覆盖 `liuyao`/`person`/`mode`）。因此是单向依赖，无环。

**分层方向**：整体是合规的 `app → components → lib`，无反向依赖。但存在 **§3 P1-3 所述 100 处深层导入**，破坏了封装的**边界**（不是方向）。

---

## 2. 问题清单表

严重度定义：**P0** = 影响正确性/安全/可缓存性根基，应尽快修；**P1** = 结构性技术债，显著抬高维护与扩展成本；**P2** = 局部问题或可读性。
修复成本：**S** ≈ 1 小时内、单文件；**M** ≈ 半天、少量文件；**L** ≈ 1 天以上、跨模块。

| # | 问题 | 影响 | 严重度 | 证据（文件:行号） | 成本 |
|---|---|---|---|---|---|
| **P0-1** | 根布局 `await getServerSession()` 使全站动态渲染 | 24/24 页面失去静态预渲染；首页、隐私页等纯静态页也无法 CDN 缓存；公开分享页被迫先读会话 | **P0** | `src/app/layout.tsx:26`；`src/lib/auth/get-session.ts:15`；`.next/prerender-manifest.json`（仅 2 条，无业务页） | M |
| **P0-2** | `validate.ts` 与 `contracts/charts.ts` 存在 **5 处** mojibake（GBK 被当 UTF-8 解码），乱码直接返回给 API 调用方 | 用户可见的错误提示为乱码；「legacy 盘无权威输入」等关键引导语不可读 | **P0** | `src/lib/api/validate.ts:54,68,69,80`；`src/lib/contracts/charts.ts:152` | **S** |
| **P0-3** | 云端 4 个 store 各自 `isPostgresDriver()` 判定**不一致**：liuyao 多一个 `&& isDatabaseConfigured()` | 同一部署下，三术数据可能分别落到 Postgres 与 JSON 文件，导出/删号/迁移语义分裂（详见 §3） | **P0** | `src/lib/storage/cloud-liuyao-store.ts:54-56` vs `cloud-store.ts:28-30`、`cloud-ziwei-store.ts:26-28`、`cloud-person-store.ts:18-20` | S |
| **P0-4** | 迁移/合并为「读-改-写」且无事务/无并发保护 | 多设备并发迁移时可能丢更新；`updatedAt` 相同即「云端胜」策略在时钟偏差下可能覆盖较新本地数据 | **P0** | `src/app/api/charts/migrate/route.ts:72`（读）→`:127-174`（改）→`upsertCloudChart`（写）；`src/lib/storage/migrate.ts:216-225,137-148` | M |
| **P1-1** | 三术解读管线是三份近似复制的实现（**~177/~249 归一化行重合，约 71%**） | 改一处需同步改三处；新增术数须再抄一遍；`sections.ts` 三份几乎同构 | **P1** | `src/lib/reading/llm/llm.ts`（306 行）、`src/lib/reading/ziwei/llm.ts`（255 行）、`src/lib/reading/liuyao/llm.ts`（245 行）；共享函数 `sanitizeFallbackReason`/`withTrust` 三处各写一遍 | L |
| **P1-2** | 云端存储「文件 + Postgres」两套并行实现，**27 处运行时分支** | 任一侧改动都要双侧同步；liuyao 已出现分支判定漂移（P0-3）；无独立 `pg-liuyao-store.ts`，SQL 内联 | **P1** | `cloud-store.ts`(7 分支)、`cloud-ziwei-store.ts`(7)、`cloud-person-store.ts`(6)、`cloud-liuyao-store.ts`(7) | L |
| **P1-3** | `components`/`app` 对 `lib` 深层内部模块的直接导入共 **100 处** | 破坏封装：内部重命名/移动会波及调用方；`lib/<domain>/index.ts` 的公共契约形同虚设 | **P1** | 见 §3 P1-3 明细表（`auth` 35、`storage` 21、`types` 18、`reading` 12、`bazi` 7…） | L |
| **P1-4** | 三个新建向导在客户端静态引入完整计算引擎 | 首屏 JS 偏大，三术引擎合计约 **8984 行源码**（bazi 2601 / ziwei 3035 / liuyao 3348）被纳入客户端图 | **P1** | `src/components/form/BirthWizard.tsx:6`（`@/lib/bazi`）、`ZiweiWizard.tsx:7`（`@/lib/ziwei`）、`CastForm.tsx:10-11`（`@/lib/liuyao/cast` + `analyze/yongshen`） | M |
| **P1-5** | `types/` 与 `contracts/` 职责重叠：章节 key 契约被**三处独立定义** | 同一契约三个真相源，改名时极易漏改，且三处已使用不同措辞的注释声称「稳定契约」 | **P1** | `src/lib/types/index.ts:314-322,357-365,391-398`（union）；`src/lib/contracts/reading.ts:4-34`（zod enum）；`src/lib/reading/sections.ts`、`ziwei/sections.ts`、`liuyao/sections.ts`（`as const` 数组） | M |
| **P1-6** | 24 个**真正空** catch 块（`catch {}` 无任何语句） | 静默吞异常，故障不可观测；部分位于存储/认证关键路径 | **P1** | 见 §3 P1-6 完整清单（24 处，已用花括号配平算法提取而非正则猜测） | M |
| **P1-7** | `catch` 块普遍只 `return null`/赋默认值，无日志 | 133 个 catch 中 70 个体量 ≤80 字符，多以「返回 null」收场，失败无痕迹 | **P1** | 全仓 133 个 catch；典型：`src/lib/storage/mode.ts:16,27,38`、`src/lib/storage/kv.ts:12,22,32,42,50` | M |
| **P2-1** | 24 个页面中 14 个整页 `"use client"` | 服务端不参与取数，HTML 首屏依赖 JS；`/charts`(434 行)、`/people/[id]`(406 行) 尤重 | **P2** | `src/app/charts/page.tsx:1`、`src/app/people/[id]/page.tsx:1` 等 14 处 | L |
| **P2-2** | 未使用 `next/image`，`next.config.ts` 无 `images` 配置 | 目前项目**确实没有位图资源**（`next/image` 零引用），故**当前无实际损失**；属「未来若加图需补配置」的提醒 | **P2** | `next.config.ts`（无 `images` 键）；全仓 `next/image` 0 命中 | S |
| **P2-3** | 83 处非空断言 `!`，其中 34 处集中在 4 个云端 store 的 `memory!.users[...]` | 依赖「`await ensureLoaded()` 后 memory 必非空」的隐式约定，重构时易炸 | **P2** | `cloud-store.ts`(9)、`cloud-ziwei-store.ts`(9)、`cloud-liuyao-store.ts`(8)、`cloud-person-store.ts`(8) 等 | S |
| **P2-4** | `as unknown as` 8 处（含 5 处在测试中 mock fetch） | 生产代码 3 处需关注 | **P2** | `src/lib/storage/mode.ts:138,139`（mock Storage 探测）；`src/components/auth/LoginForm.tsx:180`；测试 5 处 | S |
| **P2-5** | `@ts-expect-error` 9 处，其中 6 处为 `lunar-javascript` 无类型 | 合理但可收敛为 `declare module` | **P2** | `src/lib/bazi/dayun/index.ts:1`、`bazi/calendar/solar.ts:1`、`bazi/calendar/lunar.ts:1`、`bazi/boundary/index.ts:1`、`src/lib/ziwei/calendar.ts:5`、`ziwei/daxian/index.ts:6`；测试 3 处 | S |
| **P2-6** | `sync.ts` 分派逻辑中缩进错乱，`if` 块与 `continue` 层级不一致 | 可读性差，易误读控制流（功能正确性未发现缺陷） | **P2** | `src/lib/storage/sync.ts:237-242,251-257,357-363,368-374,454-457,490-496` | S |

---

## 3. 逐条修复方案

> 每条给出：**改哪个文件 → 怎么改 → 为什么**。

### P0-1 根布局读取会话导致全站动态

**为什么**：根布局是全体页面的公共祖先。`cookies()` 是运行时 API，一旦在根布局调用，**所有**后代路由都失去静态预渲染。修复要点不是「删掉那行」，而是**把会话读取下移到真正需要它的叶子**，让不需要会话的路由（首页、隐私页、分享页）恢复静态/可缓存能力。

**改法（三步）**：

1. **删除** `src/app/layout.tsx:26` 的 `const session = await getServerSession();`，
   并删除 `:4` 的 import。让 `RootLayout` 变回同步函数（去掉 `async`，`:21`）。
   同时**移除** `:34` `AuthModeSync` 与 `:35` `SiteHeader` 这两处依赖 `session` 的渲染。

2. **新建一个「头部岛」服务端组件**，把会话读取封进去并就地流式渲染，例如
   `src/components/auth/HeaderSlot.tsx`：

   ```tsx
   import { Suspense } from "react";
   import { getServerSession } from "@/lib/auth/get-session";
   import { SiteHeader } from "./SiteHeader";

   async function HeaderContent() {
     const session = await getServerSession();
     return <SiteHeader session={session} />;
   }

   export function HeaderSlot() {
     return (
       <Suspense fallback={<header className="h-[var(--header-h)]" />}>
         <HeaderContent />
       </Suspense>
     );
   }
   ```

   然后在 `src/app/layout.tsx` 的 `<body>` 中渲染 `<HeaderSlot />`。
   `AuthModeSync` 同理包一个 `AuthModeSlot`。

   **依据当前版本文档**：`01-app/01-getting-started/08-caching.md:141-163`
   ——「Components that access runtime APIs should be wrapped in `<Suspense>`」，
   文档给出 `cookies()` + `<Suspense>` 的标准写法（`:143-163`）；
   同文 `:130` 还澄清 `<Suspense>` 本身不会把组件「变成」动态，只有真正的异步工作才会。

3. **移除非全局依赖**：确认首页 `/`、`/privacy`、三个 `share/[token]` 页面
   **不**需要会话。分享页若要真正的静态化，还需把 `getShareSnapshot(token)`
   改为按 token 缓存（见下）。

**为什么这样改而不是别的**：
- 不建议用 `export const dynamic = 'force-static'` 强行标记——那会让
  `cookies()` 返回空值（文档 `02-guides/caching-without-cache-components.md:104`），
  登录态 UI 会静默失效，属于「把症状摁下去」。
- 不建议在根布局加 `<Suspense fallback={null}>` 包住 `<body>`——文档
  `01-app/01-getting-started/08-caching.md:298` 明确指出这会「让整个应用
  都推迟到请求时渲染」，与目标相反。

**（可选，需先开 `cacheComponents`）分享页静态化**：分享内容由 token 决定、
且不因人而异，是 `use cache` 的典型场景。可在 `getShareSnapshot` 外侧包一层
带 `cacheLife`/`cacheTag` 的缓存函数（文档 `01-app/01-getting-started/08-caching.md:56-68`），
并在分享新增/删除时 `updateTag`。**注意**：本项依赖先启用 `cacheComponents`
（`next.config.ts` 当前**未**启用，见 §4），属较大改动，建议在 P0-1 第 1–2 步验证生效后再做。

**验证方式**：改完后重新构建，检查 `.next/prerender-manifest.json` 中是否出现
`/`、`/privacy` 等条目（当前为 0）。**不要**只看 build 输出的符号。

---

### P0-2 修复 mojibake 乱码

**为什么**：这 5 个字符串是**面向用户的错误信息**，乱码会直接展示在 UI 上。
`src/lib/api/validate.ts:68` 的整句（「legacy 盘无服务端权威用户输入，请合并新版档案或使用模板解读」）
是 legacy 用户的**唯一引导语**，乱码等于该引导失效。

**改哪个文件 / 怎么改**：逐字替换为正确中文（内容可依据上下文与
`src/lib/api/validate.test.ts:67` 的断言 `/legacy|妯℃澘/` 推断原意）。

| 文件:行 | 当前（乱码） | 应改为 |
|---|---|---|
| `src/lib/api/validate.ts:54` | `"Bazi璇锋眰浣撴棤鏁?"` | `"Bazi 请求体无效"` |
| `src/lib/api/validate.ts:68` | `"legacy 鐩樻棤鏈嶅姟绔潈濞佺敤鎴疯緭鍏ワ紝璇峰悎骞舵柊鐗堟。妗ｆ垨浣跨敤妯℃澘瑙ｈ"` | `"legacy 盘无服务端权威用户输入，请合并新版档案或使用模板解读"` |
| `src/lib/api/validate.ts:69` | `"Bazi 鐢熷嚭淇℃伅鏃犳晥"` | `"Bazi 出生信息无效"` |
| `src/lib/api/validate.ts:80` | `"Bazi 鍛界洏璁＄畻澶辫触"` | `"Bazi 命盘计算失败"` |
| `src/lib/contracts/charts.ts:152` | `"缂哄皯 Bazi 鐢熷嚭淇℃伅鎴栨湁鏁堢洏"` | `"缺少 Bazi 出生信息或有效盘"` |

**连带修复**：`src/lib/api/validate.test.ts:67` 的断言含乱码
`expect(result.message).toMatch(/legacy|妯℃澘/)`，应同步改为 `/legacy|模板/`，
否则修好源码后该断言会因匹配乱码而失败。

**为什么只改这 5 处**：我用「GBK 重编码 → UTF-8 解码」往返算法扫描了
`src/**` 全部非测试文件，**仅这 2 个文件命中**。`src/lib/reading/sections.ts`
等文件的中文**是正常的**（我已用 UTF-8 显式读取原始字节确认）——
早先在终端看到的乱码是 PowerShell 控制台代码页的显示问题，**不是文件缺陷**，请勿据此大范围「修复」。

---

### P0-3 统一云端驱动的判定

**为什么**：四个 store 对「是否用 Postgres」给出了**不同**答案：

```
cloud-store.ts:29          getCloudStoreDriver() === "postgres"
cloud-ziwei-store.ts:27    getCloudStoreDriver() === "postgres"
cloud-person-store.ts:19   getCloudStoreDriver() === "postgres"
cloud-liuyao-store.ts:55   getCloudStoreDriver() === "postgres" && isDatabaseConfigured()   ← 多一个条件
```

`driver.ts:11-24` 中，`CLOUD_STORE_DRIVER=postgres` 且无 `DATABASE_URL` 时**会抛错**
（`:14-18`），所以理论上不会出现「声称 postgres 却连不上」。
但**真正的不一致场景**是：`CLOUD_STORE_DRIVER` 未设且 `DATABASE_URL` 运行时被清空/注入失败时，
`cloud-store.ts` 的三术会走 `postgres` 分支并**在 `getSql()` 抛错**（`src/lib/db/client.ts:29-33`），
而 liuyao 会**静默回落 JSON 文件**。结果是：同一用户的三术档案分裂在两个介质中，
而 `/api/account/export`（经 `cloud-hooks.ts:34-42` 聚合四类数据）与删号
（`deleteCloudDataForUser`）会读到**混合状态**，出现「删了但没删净」或「导出缺一半」。

**改哪个文件 / 怎么改**：

1. 在 `src/lib/storage/driver.ts` 导出一个**唯一**判定函数，例如：

   ```ts
   export function isCloudPostgres(): boolean {
     return getCloudStoreDriver() === "postgres";
   }
   ```

   并在 `driver.ts:14-18` 已有的「postgres 必须配 DATABASE_URL」保护下，
   让判定结果成为**唯一真相**（该保护已经保证了 postgres ⟹ DATABASE_URL 存在，
   因此 `&& isDatabaseConfigured()` 是冗余且**引入分歧**的）。

2. 删除四个 store 各自的局部 `isPostgresDriver`（`cloud-store.ts:28-30`、
   `cloud-ziwei-store.ts:26-28`、`cloud-person-store.ts:18-20`、`cloud-liuyao-store.ts:54-56`），
   改为统一 `import { isCloudPostgres } from "./driver"`。

3. 顺带删除 `cloud-liuyao-store.ts:10` 中因此不再需要的 `isDatabaseConfigured` 导入。

**为什么**：把「驱动选择」从 4 份内联判断收敛为 1 个导出函数，消除漂移可能。
这是 P1-2 重构的第一步，且**独立成立**（即使不做大重构也应修）。

---

### P0-4 迁移/合并的并发与幂等

**现状分析**（`src/app/api/charts/migrate/route.ts`）：

```
:72   const cloudList = await getAllCloudChartsForUser(userId);   ← 读快照
:119  const plan = planMerge(localMeta, cloudMeta, ...);          ← 基于快照算计划
:127-174  循环内 await upsertCloudChart(...)                       ← 逐条写
```

这是典型的 **read-modify-write**，且循环内**没有**事务、**没有**乐观锁
（无 version / ETag 校验）、**没有**重试。两个设备同时迁移时，双方的
`cloudList` 快照相同，各自算出 `keep_local → upload`，后写者**静默覆盖**先写者。

**冲突策略本身的弱点**（`src/lib/storage/migrate.ts`）：
- `:216-225`：`lMs === cMs` 时判定 `equal_cloud`「云端优先不覆盖」。
  若两台设备在同一毫秒级时间窗内各自修改，`updatedAt` 相同即放弃本地——可能丢掉真实的新编辑。
- `:143-148` `pickConflictWinner`：`l == null && c == null` 与 `l == null` 都返回 `cloud`。
  「本地无时间戳」的档案**永远拿不到上传机会**，即使用户刚在本机新建。
  这与 `:7` 文件头注释「本地无时间戳 → 云端优先（不覆盖云端，并建议拉取）」一致，
  **属有意设计**，但缺少用户可见的「本次未上传」提示——`route.ts:149-156` 会把它记成
  `keep_cloud` 并在 `reason` 里写「上传失败」，措辞与成因不符。

**改哪个文件 / 怎么改**：

1. **加乐观并发控制**（首选，成本最低）：
   在 `cloud-store.ts` 的 `CloudChartRecord` 上引入单调 `version` 字段
   （Postgres 侧用 `UPDATE ... WHERE version = $expected` 并检查影响行数；
   文件侧在 `upsertCloudChart` 内比对 `existing.updatedAt`）。
   `route.ts:139` 的 `upsertCloudChart` 调用传入从 `:114-117` 快照读到的
   `updatedAt` 作为期望值；不匹配则**不覆盖**，改为把该条加入 `pullRecords`
   并给出 `reason: "并发修改，已拉取云端最新"`。这样把「静默覆盖」变成「显式冲突」。

2. **把判定与写入放进同一事务**（Postgres 侧）：
   在 `pg-bazi-store.ts` 增加一个批量 `upsertMany(userId, records[])`，
   用单条 `INSERT ... ON CONFLICT ... WHERE EXCLUDED.updated_at > chart_json->>'updatedAt'`
   做**条件写**，避免 N 次往返 + N 个竞态窗口。

3. **修正 `:149-156` 的归因措辞**：把「上传失败，保留云端现有数据」拆成
   `"本地无时间戳，按策略保留云端"`（策略性）与 `"上传异常，保留云端"`（异常性）两种 reason，
   便于用户与排查者区分。

4. **补并发测试**：`src/lib/storage/migrate.test.ts` 与 `migrate-server.test.ts` 已存在，
   在其中新增「两客户端同快照并发 upsert」用例，断言不丢数据。

**为什么**：迁移是**低频但高风险**的路径——一旦丢档案，用户无法察觉也无法恢复。
乐观锁是此处性价比最高的防护，且不需要引入数据库级锁。

---

### P1-1 三术解读管线去重

**量化证据（实测，非估算）**：我对三个 LLM 入口做「去注释 + 字符串归一化」后按行比对：

| 对比 | 归一化行数 | 三文件共有行 |
|---|---|---|
| `reading/llm/llm.ts`（八字） | 280 | — |
| `reading/ziwei/llm.ts` | 239 | — |
| `reading/liuyao/llm.ts` | 228 | — |
| **三文件共有** | **177** | **约占最小文件 228 行的 78%，约占三文件合计 747 行的 24%** |

`ziwei ∩ liuyao` 单独重合 **189 行**（紫微与六爻的 LLM 管线几乎逐行同构）。

**结构性重复的具体函数**（三处各写一遍，逻辑一致）：

| 函数 | 八字 | 紫微 | 六爻 |
|---|---|---|---|
| `sanitizeFallbackReason(err)` | `llm.ts:126-147` | `ziwei/llm.ts:75(?)-81` | `liuyao/llm.ts:66(?)-` |
| `withTrust(report, chart)` | `llm.ts:169-172` | `ziwei/llm.ts:110-115` | `liuyao/llm.ts:100-106` |
| `buildSectionsFromParsed` | `llm.ts:149-161` | 内联于 `ziwei/llm.ts:191-199` | 内联于 `liuyao/llm.ts` |
| 未配置 → 模板回落 | `llm.ts:187-220` | `ziwei/llm.ts:131-164` | `liuyao/llm.ts:~107-140` |
| try → parse → 失败回落 | `llm.ts:222-306` | `ziwei/llm.ts:166-255` | `liuyao/llm.ts:~140-235` |
| `meta`（model/usage/durationMs/errorCode/parseSource） | `llm.ts:118-124` | `ziwei/llm.ts:90-98` | 同构 |

模板侧同样重复：`ziwei/template.ts`（453 行）∩ `liuyao/template.ts`（419 行）
**共有 160 行**；两者前 45 行中 `:1`、`:10`、`:11` 等导入区逐字相同。
`sections.ts` 三份（`reading/sections.ts` 27 行、`ziwei/sections.ts` 28 行、`liuyao/sections.ts` 26 行）
除了 key 列表与标题表外，`DISCLAIMER` 的复用方式也完全一致
（`ziwei/sections.ts` 与 `liuyao/sections.ts` 都是 `import { DISCLAIMER } from "@/lib/reading/sections"` 后原样再导出）。

**改哪个文件 / 怎么改**：

1. **先抽出三个纯函数**到 `src/lib/reading/llm/shared.ts`（新建）：
   `sanitizeFallbackReason`、`buildSectionsFromParsed(parsed, keys, titles, disclaimer)`、
   `buildMeta(chat, parsed)`。这三个**不含术数特有逻辑**，是纯样板。

2. **抽出一个通用管线** `runLlmReading<TChart, TReport>({ chart, keys, titles, disclaimer, buildSystemPrompt, buildUserMessage, renderTemplate, attachTrust, art, requestId })`，
   把「未配置回落 → 调用 → 解析 → 失败回落」这条**完全同构**的控制流收敛为一份。
   三个入口变为 ~30 行的适配器，只提供各自特有的 `buildSystemPrompt`/`renderTemplate`。

   `withTrust` 的差异（八字多一步 `ensureChartEvidenceOnAdvice`，`llm.ts:170`）
   用可选 hook 表达即可，不需分叉。

3. **模板侧**：先把 `ziwei/template.ts` 与 `liuyao/template.ts` 的
   「章节装配 + 输出组装」抽为 `assembleTemplateReport(sections, disclaimer, options)`，
   两者的 160 行重合绝大部分在此。八字 `template/render.ts`（107 行）本就很薄，
   可作为该抽象的参照实现。

**预期收益**：LLM 三入口从 306+255+245 = **806 行**降至约 90 行适配器 + 约 200 行共享管线，
净减约 **500 行**；模板侧可再减约 200 行。更重要的是：**新增第四种术数只需写适配器**。

**为什么先抽纯函数再抽管线**：纯函数抽取零风险、可立即做；
管线抽取涉及泛型与回落语义，需在纯函数落地、测试全绿后再动。

---

### P1-2 云端存储双实现收敛

**现状**：4 个 `cloud-*.ts` 各自「同文件内塞两套实现」（文件分支 + SQL 分支），
共 **27 处 `isPostgresDriver()` 分支**、34 处 `memory!`：

| 文件 | 行数 | 驱动分支数 | `memory!` 次数 |
|---|---|---|---|
| `cloud-store.ts` | 239 | 7 | 9 |
| `cloud-ziwei-store.ts` | 154 | 7 | 9 |
| `cloud-person-store.ts` | 154 | 6 | 8 |
| `cloud-liuyao-store.ts` | 225 | 7 | 8 |
| `pg-bazi-store.ts` | 167 | — | — |
| `pg-ziwei-store.ts` | 136 | — | — |
| `pg-person-store.ts` | 115 | — | — |
| **`pg-liuyao-store.ts`** | **不存在** | — | — |

**关键结构缺陷**：liuyao **没有**独立的 `pg-liuyao-store.ts`，SQL 直接内联在
`cloud-liuyao-store.ts:111-123,144-164,177-192,197-207,212-219`，
与其余三术的组织方式**不一致**。

**改哪个文件 / 怎么改**：

1. **抽出接口**（新建 `src/lib/storage/cloud-driver.ts`）：
   定义 `CloudStore<TRecord, TListItem, TUpsert>` 接口，含
   `list / get / upsert / remove / getAll / deleteAll` 六个方法（对应现有各 store 的方法集）。

2. **拆出 `pg-liuyao-store.ts`**：把 `cloud-liuyao-store.ts` 内联的 SQL
   迁到新文件，与 `pg-bazi-store.ts` 等保持同构。这是**纯搬运**，可独立提交。

3. **让 `cloud-*.ts` 只做委托**：
   每个方法体从「`if (isPostgresDriver()) {...SQL...} {...file...}`」变为
   `return driver.list(userId)`，其中 `driver` 由 `driver.ts` 的
   `getCloudStoreDriver()` 一次性选出。文件实现可收进 `file-cloud-driver.ts`。

4. **消除 `memory!`**：`ensureLoaded()` 返回 `CloudChartsFile` 而不是写模块级变量，
   调用方 `const data = await ensureLoaded()`，34 处非空断言（P2-3）自然消失。

**为什么要做**：这同时解决 P0-3（判定分歧）、P2-3（`!` 断言）、
并让 liuyao 与其余三术结构对齐。**注意顺序**：先做 P0-3（改判定），
再做第 2 步（搬 SQL），最后做第 3 步（委托化），每步保持测试绿。

**风险提示**：文件驱动当前是**进程内内存 + 全量写盘**（`cloud-store.ts:36-64`），
多实例部署下本身就不安全。收敛后应在 `driver.ts` 中**显式拒绝**在
`NODE_ENV=production` 且多实例场景下使用 file 驱动，而不是仅靠文档警告
（`src/lib/db/client.ts:4` 注释已承认「账号云端可回落 JSON 文件」）。

---

### P1-3 深层导入（100 处）收敛

**实测清单**（`components` + `app` 对 `lib/<有 barrel 的域>/<子模块>` 的直接导入）：

| 域 | 次数 |
|---|---|
| `auth` | 35 |
| `storage` | 21 |
| `types` | 18 |
| `reading` | 12 |
| `bazi` | 7 |
| `liuyao` | 3 |
| `share` | 3 |
| `api` | 1 |
| **合计** | **100** |

**高频目标**（代表位置）：

| 目标模块 | 次数 | 代表位置 |
|---|---|---|
| `@/lib/auth/session` | 16 | `src/app/api/charts/[id]/route.ts`、`src/app/api/auth/logout/route.ts` |
| `@/lib/types/user` | 8 | `src/lib/auth/types.ts:23`、`src/app/account/page.tsx` |
| `@/lib/auth/types` | 6 | `src/app/api/auth/callback/route.ts`、`login/route.ts`（各 2 次） |
| `@/lib/reading/calibrate` | 5 | `src/lib/storage/migrate.ts:16`、`sync.ts:18` |
| `@/lib/auth/users` | 5 | `src/app/api/account/delete/route.ts`、`api/auth/magic-link/route.ts` |
| `@/lib/storage/cloud-store` | 3 | `src/app/api/charts/route.ts`、`api/charts/[id]/route.ts` |

**改哪个文件 / 怎么改**：

1. **扩充 barrel**：`src/lib/auth/index.ts`、`src/lib/storage/index.ts`、
   `src/lib/types/index.ts` 已存在，但导出面不全。把
   `session`/`types`/`users`/`get-session`（auth）、
   `cloud-store`/`sync`/`migrate`/`mode`（storage）中**属于公共契约的符号**补进 barrel。
   注意 `types/index.ts` 已经是 barrel 且已再导出 `./user`（`:25-33`），
   所以 `@/lib/types/user` 的 8 处导入**可直接改为 `@/lib/types`**——这是**零成本**的 8 处。

2. **加约束防回潮**：在 `eslint.config.mjs` 增加 `no-restricted-imports` 规则，
   对 `src/components/**`、`src/app/**` 禁止 `@/lib/*/*`（允许 `@/lib/<domain>` 一层），
   并把现有例外（若确需）显式列入 `allowImportNames`。

**为什么分两步**：先把「barrel 已有对应导出」的导入换掉（低风险、数量大），
再上 lint 规则。若一开始就开 lint，会立刻产生 100 个错误阻塞 CI，无法落地。

**不建议的做法**：不要为了消灭深层导入而把 `lib/storage` 摊平成一个文件——
那会牺牲现有的内聚结构。正确方向是**对齐 barrel 与内部实现的边界**，而非取消层次。

---

### P1-4 向导客户端引擎瘦身

**核实结论：问题仍然存在。** 三个向导组件顶部均为**静态 import**（非动态），
因此引擎会进入客户端 bundle：

| 向导 | 静态导入引擎 | 位置 |
|---|---|---|
| `BirthWizard` | `@/lib/bazi`（`computeChart`） | `src/components/form/BirthWizard.tsx:6` |
| | `@/lib/bazi/calendar`（`lunarToSolarDate`） | `:7` |
| `ZiweiWizard` | `@/lib/ziwei`（`computeZiweiChart`） | `src/components/ziwei/ZiweiWizard.tsx:7` |
| | `@/lib/bazi/calendar` | `:8` |
| `CastForm` | `@/lib/liuyao/cast`（`castLiuyao`） | `src/components/liuyao/CastForm.tsx:10` |
| | `@/lib/liuyao/analyze/yongshen`（`CATEGORY_LABEL`） | `:11` |

**引擎规模**（非测试 `.ts` 源码行数，口径：`File.ReadAllLines().Count`，含空行与注释）：

| 引擎 | 文件数 | 行数 |
|---|---|---|
| `src/lib/bazi` | 19 | 2601 |
| `src/lib/ziwei` | 22 | 3035 |
| `src/lib/liuyao` | 28 | 3348 |
| **合计** | **69** | **8984** |

> 口径说明：同一批文件用 `Measure-Object -Line`（只计非空行）测得 2369 / 2718 / 3047，
> 合计 8134。**本报告统一采用含空行的 8984** 作为「源码规模」，
> 因为它更接近文件实际体积；两个口径的差异为纯空行，不影响任何结论与排序。

**应注意的边界**：这些 import 是**功能必需**的——排盘**确实**在浏览器本地完成
（产品承诺「确定性引擎排盘，不经 LLM」，如 `src/app/chart/new/page.tsx:29-30` 所述）。
所以**不能简单地改成服务端排盘**，那会改变产品语义。优化目标是**减小首屏与拆分时机**，
而非消除计算。

**应拆分的模块清单与具体方式**：

1. **`@/lib/liuyao/analyze/yongshen` 的 `CATEGORY_LABEL`（最优先，收益最直接）**
   `CastForm.tsx:11` 只为拿一个**标签映射表**，就把整个 `analyze/` 目录拖进客户端。
   `analyze/` 下有 14 个非测试文件（`dongbian/fushen/kongwang/liuqin/liushen/palaces/scope/shi-ying/yingqi/yongshen/yongshen-status/yuepo` 等）。
   **改法**：把 `CATEGORY_LABEL`（纯常量）移到不依赖引擎的
   `src/lib/liuyao/labels.ts`（新建），`CastForm` 改从该文件导入，
   `analyze/yongshen.ts` 反过来从 `labels.ts` 再导出以保持兼容。
   这是**单文件、零风险**的改动，却能把 `analyze/` 整目录移出 `CastForm` 的客户端图。

2. **`CastForm` 的 `castLiuyao` 改为按需动态导入**
   `src/lib/liuyao/cast/` 目录 8 个文件（build 88 / coins 27 / index 149 / method 42 /
   resolve-gua 48 / rng 26 / time 94 / yao 47 行，合计约 521 行），
   其中 `data/hexagrams.ts`（卦表）体积更大。
   **改法**：`CastForm.tsx:120` 起卦是**用户点击后**才发生的事件（`:120` 在提交处理函数内），
   把顶部静态 import 改为函数内 `const { castLiuyao } = await import("@/lib/liuyao/cast")`。
   **依据当前版本文档**：`01-app/02-guides/lazy-loading.md:99-129`
   正是「External libraries can be loaded on demand」的原生 `import()` 写法；
   `:20` 也说明「Lazy loading applies to Client Components」，此处适用。

3. **`BirthWizard` / `ZiweiWizard` 同理**：`computeChart`（`BirthWizard.tsx:6`）
   与 `computeZiweiChart`（`ZiweiWizard.tsx:7`）都在「确认」按钮的处理函数里调用，
   改为动态 `import()`。`@/lib/bazi/calendar` 的 `lunarToSolarDate`
   在**农历输入校验**时即需要（`BirthWizard.tsx:179`、`ZiweiWizard.tsx:135` 附近有
   `e.date = "农历格式应为 YYYY-M-D"` 的校验分支），**该处不宜延后**，
   但可只保留 `calendar` 而把重量级的 `@/lib/bazi`（含 pillars/dayun/wuxing/relations）
   延后。

4. **不要用的方案**：不要用 `next/dynamic({ ssr: false })` —— 文档
   `01-app/02-guides/lazy-loading.md:94-95` 明确指出 `ssr: false` **不允许**在
   Server Component 中使用；而这些向导是被服务端页面（`src/app/chart/new/page.tsx:32`
   等）渲染的。用原生 `import()` 在事件处理器内触发是正确的形态。

**建议顺序**：先做第 1 项（改一个常量位置，立即见效）→ 再做第 3 项中「把
`computeChart` 延后」→ 最后做第 2 项。每步用 `next build` 的路由首屏 JS 尺寸对比验证。

---

### P1-5 `types/` 与 `contracts/` 职责重叠

**它们是两个不同的东西，且都存在合理理由，但当前存在真实重复：**

- `src/lib/types/**`：**运行时类型契约**（`type`/`interface`），零运行时开销，
  被引擎与 UI 共享。如 `BaziChart`（`types/index.ts:248-309`）、`BirthProfile`（`:74-100`）。
- `src/lib/contracts/**`：**网络边界校验契约**（zod schema），带运行时校验。
  如 `baziBirthProfileSchema`（`contracts/charts.ts:43-85`）、`loginBodySchema`。

**结论：不应合并。** 二者职责确实不同（一个描述形状，一个做运行时校验）。
`contracts/charts.ts:43` 的 `baziBirthProfileSchema` 是
`birthProfileMinSchema.extend(...)`（`:27,43`）——这正是**正确的组合方式**：
zod 从自己的最小 schema 扩展，而**不是**从 `types` 派生。

**但确有重复定义，具体清单**：

| 重复契约 | 定义处 1 | 定义处 2 | 定义处 3 |
|---|---|---|---|
| **八字章节 key** | `types/index.ts:314-322`（`ReadingSectionKey` union） | `contracts/reading.ts:4-14`（`baziSectionKeySchema` z.enum） | `reading/sections.ts`（`SECTION_KEYS` as const 数组） |
| **紫微章节 key** | `types/index.ts:357-365`（`ZiweiReadingSectionKey`） | `contracts/reading.ts:16-26`（`ziweiSectionKeySchema`） | `reading/ziwei/sections.ts`（`ZIWEI_SECTION_KEYS`） |
| **六爻章节 key** | `types/index.ts:391-398`（`LiuyaoReadingSectionKey`） | `contracts/reading.ts:28-38`（`liuyaoSectionKeySchema`） | `reading/liuyao/sections.ts`（`LIUYAO_SECTION_KEYS`） |
| 章节标题 | — | — | `reading/sections.ts` `SECTION_TITLES`；`ziwei/sections.ts` `ZIWEI_SECTION_TITLES`；`liuyao/sections.ts` `LIUYAO_SECTION_TITLES` |

即**同一组 key 有三份手工维护的字面量列表**。三者当前**值是一致的**
（我逐项比对过：八字 8 项、紫微 8 项、六爻 7 项均对应），
但一致性靠人工维持，`contracts/reading.ts` 的注释还写着
「稳定契约，勿随意改名」，三处都这么说——这本身就说明作者知道有漂移风险。

**改哪个文件 / 怎么改**：

1. **确立单一真相源为 `contracts/`（zod）**，因为它是唯一带运行时校验的一侧：
   在 `contracts/reading.ts` 中已有 `BAZI_SECTION_KEYS = baziSectionKeySchema.options`（`:56`）
   等三个派生常量——**它们就是现成的真相源**。

2. **`types/index.ts:314-322,357-365,391-398` 改为从 zod 派生**：

   ```ts
   import type { z } from "zod";
   import type { baziSectionKeySchema, ziweiSectionKeySchema, liuyaoSectionKeySchema } from "./…";
   export type ReadingSectionKey = z.infer<typeof baziSectionKeySchema>;
   ```

   注意：`types/` 目前**零依赖**（不 import zod），引入 `import type` 不会产生运行时依赖，
   **不会**破坏 `types/user.ts:4` 那条「避免循环依赖」的防御（因为是 `import type`，
   编译期擦除）。

3. **`reading/*/sections.ts` 的 `as const` 数组改为引用派生常量**：
   `const SECTION_KEYS: readonly ReadingSectionKey[] = BAZI_SECTION_KEYS;`
   （`reading/sections.ts` 当前手写 8 项字面量）。

4. **加类型级守护测试**：在 `contracts/contracts.test.ts` 增加断言，
   确保三处的 key 集合与标题表的键完全一致（用 `Record<ReadingSectionKey, string>`
   已有穷尽性检查，再加 `Object.keys(SECTION_TITLES).length === SECTION_KEYS.length`）。

**为什么这样改而非「合并两个目录」**：合并会迫使 `types` 依赖 zod，
把网络校验细节渗透进引擎层；而引擎应只依赖纯类型。**保留两个目录，消除重复的字面量**才是正确解。

---

### P1-6 24 个真正空的 catch

**测量方法说明**（避免误报）：我没有用简单的单行正则
（那会把跨行的 `catch {` 全部误判为空）。我对每个 `catch` 用**花括号配平**提取完整 body，
剥离注释后再判断长度是否为 0。全仓 **133 个 catch**，其中**真正空的有 24 个**：

| # | 位置 | 上下文 |
|---|---|---|
| 1 | `src/app/auth/callback/page.tsx:44` | 客户端回调 |
| 2 | `src/app/liuyao/page.tsx:58` | 列表加载 |
| 3 | `src/app/liuyao/page.tsx:67` | 列表加载 |
| 4 | `src/components/auth/LoginForm.tsx:33` | 登录提交 |
| 5 | `src/lib/auth/account.ts:45` | **账号相关** |
| 6 | `src/lib/auth/magic-link.ts:60` | **Magic Link** |
| 7 | `src/lib/auth/users.ts:62` | **用户读取** |
| 8 | `src/lib/bazi/boundary/index.ts:83` | 边界判定 |
| 9 | `src/lib/storage/cloud-liuyao-store.ts:44` | 文件读取 miss |
| 10 | `src/lib/storage/cloud-person-store.ts:69` | 文件读取 miss |
| 11 | `src/lib/storage/cloud-store.ts:53` | 文件读取 miss |
| 12 | `src/lib/storage/cloud-ziwei-store.ts:50` | 文件读取 miss |
| 13 | `src/lib/storage/kv.ts:22` | **本地读写** |
| 14 | `src/lib/storage/kv.ts:32` | **本地读写** |
| 15 | `src/lib/storage/kv.ts:50` | **本地读写** |
| 16 | `src/lib/storage/migrate.ts:337` | sessionStorage 清理 |
| 17 | `src/lib/storage/migrate.ts:353` | localStorage 清理 |
| 18 | `src/lib/storage/migrate.ts:370` | 迁移标记 |
| 19 | `src/lib/storage/migrate.ts:387` | 时间戳写入 |
| 20 | `src/lib/storage/mode.ts:57` | 模式切换 |
| 21 | `src/lib/storage/mode.ts:164` | 游客数据提升（quota） |
| 22 | `src/lib/storage/mode.ts:172` | 游客数据提升（清理） |
| 23 | `src/lib/storage/sync.ts:109` | 同步状态写入 |
| 24 | `src/lib/storage/sync.ts:118` | 同步状态读取 |

**分级判断**（不搞一刀切）：

- **可接受（16 处）**：`storage/kv.ts`、`storage/mode.ts`、`storage/migrate.ts`、
  `storage/sync.ts`、`cloud-*-store.ts` 的空 catch 属**浏览器 quota / 文件不存在**这类
  预期失败。文档已经用**注释说明**（如 `sync.ts:110` 「The UI can still read the in-memory
  state for this page lifetime」、`migrate.ts:338` `/* ignore */`），
  这类「静默但已声明」是可辩护的。
- **需要修（8 处，标粗项）**：
  - `src/lib/auth/account.ts:45`、`magic-link.ts:60`、`users.ts:62`：
    **认证路径静默吞错**，与 `docs/PROJECT_REVIEW.md` §2.1 第 3 条
    「云端删除异常会被吞掉，可能出现『返回成功但数据未删净』」**是同一类问题的残留**。
  - `src/lib/storage/kv.ts:22,32,50`：本地主读写路径，失败后**上层会拿到 null**
    并被解释为「无数据」，用户档案可能"消失"而无任何痕迹。
  - `src/components/auth/LoginForm.tsx:33`、`src/app/auth/callback/page.tsx:44`：
    登录 UI 静默失败，用户点了没反应也无从排查。

**改哪个文件 / 怎么改**：

1. **对认证与本地存储的 8 处**：改为「记日志 + 上报」，最小改动是在 catch 内加
   `console.error("[auth.account] failed", err)` 级别的结构化日志。仓库已有
   `src/lib/api/logger.ts`（`logApi`），但这些路径在客户端/非 API 上下文，
   可复用其脱敏约定或新建 `src/lib/log.ts` 轻量封装。

2. **对剩余的 16 处**：**不要**为了「消灭空 catch」而强行加日志——
   文件不存在的读取在每次冷启动都会触发，加日志只会制造噪音。
   正确做法是**保留空 catch 但把原因写进注释**（部分已有），
   并在 ESLint 中开启 `no-empty` 的 `allowEmptyCatch: false` 之前，
   先用 `// eslint-disable-next-line no-empty -- quota 预期失败` 显式豁免。

3. **P1-7 的连带修复**（133 个 catch 中 70 个体量 ≤80 字符，多为 `return null`）：
   这些**不是**要改成抛异常（会破坏「优雅降级」的产品行为），
   而是应在**每个降级点带上原因**。建议给 `parseLlmReadingContent`
   （`src/lib/reading/llm/parse.ts:35-36` 的 `catch { return null }`）这类关键解析函数
   返回 `{ ok, reason }` 而非裸 `null`，让上层 `sanitizeFallbackReason`
   （`llm.ts:126-147`，它已经在按 error message 分类）能拿到真实原因。

### P2 级问题的修复要点（简述）

- **P2-1（14 个整页 "use client"）**：择机把 `/charts`、`/people`、`/ziwei`、`/liuyao`
  的列表页改为「服务端取列表 + 客户端交互子组件」。
  **注意**：这些页当前数据源是**浏览器 localStorage**（`src/lib/storage/index.ts`），
  服务端拿不到，所以**不能直接改**。真正可行的路径是先做「登录用户走云端 API 取数」
  （`cloud-client.ts` 已具备），再让页面变服务端。属长期项，**不建议**在没有云端口径前动手。
- **P2-2（`images`）**：当前 `next/image` 零引用，**无需配置**。若未来引入位图再补
  `images.remotePatterns`；CSP 的 `img-src 'self' data: blob:`（`next.config.ts:17`）
  届时需同步放宽。
- **P2-3（83 处 `!`）**：随 P1-2 收敛后自然减少 34 处。
- **P2-4/P2-5**：见清单，逐处评估。`mode.ts:138-139` 的 `as unknown as`
  是为兼容「未实现 `length` 的 mock Storage」，属测试兼容代码，可接受；
  建议改为给 mock 补 `_keys`，或直接用 `Object.keys(ss)` 替代。
- **P2-6（`sync.ts` 缩进）**：`sync.ts:237-242` 等处 `if` 块体缩进层级与
  `continue` 不一致，纯格式问题，建议 `prettier --write` 统一。

---

## 4. Next.js 16 文档核对

### 4.1 我实际读过的文档文件

以下均为**逐行完整读取**（非关键词检索）：

| # | 文档路径 | 用途 |
|---|---|---|
| 1 | `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`（597 行） | Server/Client 边界规则、`server-only`、context provider 位置 |
| 2 | `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md`（724 行） | 取数、`<Suspense>` 流式、`use` API、`React.cache` |
| 3 | `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`（418 行） | `use cache`、`cacheLife`、runtime API + `<Suspense>`、PPR、静态壳 |
| 4 | `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`（202 行） | Route Handler 约定、默认不缓存、`RouteContext` |
| 5 | `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`（364 行） | 未启 `cacheComponents` 时的旧模型：`dynamic`/`revalidate`/`unstable_cache` |
| 6 | `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`（306 行） | `next/dynamic`、`React.lazy`、原生 `import()`、`ssr:false` 限制 |
| 7 | `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`（56 行） | `cacheComponents` 语义、PPR 成为默认、`Activity` |

另通过目录枚举确认了同目录下 `07-mutating-data`、`09-revalidating`、`10-error-handling`、
`16-proxy`、`use-cache.md`、`use-cache-remote.md` 等的存在，但**未逐行读取**，
故本报告中**不引用**其内容。

### 4.2 代码与当前版本文档的冲突点

**冲突 1（最重要）：`cacheComponents` 未启用，但项目结构完全按「全动态」在跑**

- 文档：`01-app/01-getting-started/08-caching.md:16` 明确本页所述缓存模型
  **仅在** `next.config.ts` 设置 `cacheComponents: true` 时适用；否则应参考
  `02-guides/caching-without-cache-components.md`。
- 代码事实：`next.config.ts` **没有** `cacheComponents`、**没有** `experimental`（我逐键检查过：
  `images`/`cacheComponents`/`experimental`/`redirects`/`rewrites` 全部 ABSENT）。
- 因此本项目处于**「旧缓存模型」**：`use cache` / `cacheLife` / `cacheTag` **不可用**，
  静态化只能靠路由段配置（`dynamic`/`revalidate`）。
- **判断**：这不是「违反」，而是「选了一条路但走得不够」——项目既没用新模型，
  又在旧模型下把**全部**路由做成了动态（因 P0-1）。文档
  `08-caching.md:280` 描述的 PPR（静态壳 + 流式动态内容）在本项目中**完全没有体现**。

**冲突 2：根布局的 `cookies()` 未包在 `<Suspense>` 中 —— 直接违反现行推荐**

- 文档：`01-app/01-getting-started/08-caching.md:141`「Components that access runtime APIs
  should be wrapped in `<Suspense>`」，并在 `:143-163` 给出 `cookies()` + `<Suspense>` 的
  标准示例；`:167-196` 进一步给出「把 runtime 值取出来传给被缓存函数」的推荐模式。
- 代码：`src/app/layout.tsx:26` 直接 `await getServerSession()`，无任何 `<Suspense>` 边界。
- 因此无法获得「静态壳先到达，会话相关 UI 流式补齐」的收益。这正是 §3 P0-1 修复方案第 2 步的依据。

**冲突 3：`loading.js` 无法覆盖根布局的取数（文档已预警，代码恰好踩中）**

- 文档：`01-app/01-getting-started/06-fetching-data.md:167` 明确
  「a layout that accesses uncached or runtime data (e.g. `cookies()`, `headers()`, or uncached
  fetches) **does not fall back to a same route segment `loading.js`**. Instead, it blocks
  navigation until the layout finishes rendering.」
- 代码：根布局访问 `cookies()`（`src/app/layout.tsx:26` → `get-session.ts:14`）。
- 后果：**任何一个 `loading.tsx` 都救不了**——导航会被根布局阻塞到会话读完为止。
  文档 `:171` 的结论「using `<Suspense>` closer to the runtime or uncached data access is
  recommended」正是修复方向。**注意**：我检查了 `src/app`，**当前没有任何 `loading.tsx`**，
  所以此条为「未来会踩的坑」，但根因（根布局阻塞）现在就存在。

**冲突 4：客户端引擎未做懒加载 —— 与文档推荐的懒加载形态有差距**

- 文档：`01-app/02-guides/lazy-loading.md:99-129` 推荐用 `await import()` 按需加载外部库；
  `:20` 说明「Lazy loading applies to Client Components」，而三个向导**都是** Client Components
  （`BirthWizard.tsx:1`、`ZiweiWizard.tsx:1`、`CastForm.tsx:1`）。
- 代码：`BirthWizard.tsx:6`、`ZiweiWizard.tsx:7`、`CastForm.tsx:10-11` 全部为**静态 import**。
- 这属于「未采用推荐优化」而非硬性违规。修复方案见 §3 P1-4。
- **一处必须避开的陷阱**：不能用 `dynamic(() => import(...), { ssr: false })`——
  文档 `lazy-loading.md:94-95` 明确「`ssr: false` is not allowed with `next/dynamic`
  in Server Components」，而向导由服务端页面渲染（`src/app/chart/new/page.tsx:32`）。

**冲突 5：`server-only` 只用在云端存储，未覆盖其他服务端专属模块**

- 文档：`01-app/01-getting-started/05-server-and-client-components.md:555-573` 推荐用
  `server-only` 包防止服务端代码被误引入客户端（会在**构建期**报错）。
- 代码现状：`src/lib/storage/cloud-store.ts:6`、`cloud-ziwei-store.ts`、`cloud-person-store.ts`、
  `cloud-liuyao-store.ts:5`、`src/lib/db/client.ts:7` **已**正确使用 `import "server-only"` ✅
  （`docs/PROJECT_REVIEW.md` §2.6 提到的「缺少 server-only 边界」**已部分修复**）。
- **但仍有缺口**：`src/lib/auth/**` 全目录（含 `get-session.ts`、`session.ts`、`users.ts`、
  `magic-link.ts`、`pg-users.ts`、`account.ts`）**均无** `server-only`。
  `src/lib/auth/get-session.ts:5` 直接 `import { cookies } from "next/headers"`——
  若被客户端组件误引用，当前只能靠运行时错误暴露，而非构建期拦截。
- **建议**：给 `src/lib/auth/get-session.ts`、`session.ts`、`users.ts`、`magic-link.ts`、
  `pg-users.ts`、`account.ts` 顶部加 `import "server-only"`。
  **注意**：`src/lib/auth/types.ts` 与 `constants.ts` **不得**加
  （`types.ts:23` 仅导入类型，且 `createAnonymousUserId`（`:100-107`）是浏览器侧要用的），
  `src/lib/types/user.ts` 同理。这是一个**需要逐个甄别**的改动，不可整目录加。

**冲突 6（澄清，非违规）：`output` 与 `headers` 的使用是正确的**

- `next.config.ts:74` `output: "standalone"`、`:81-83` `async headers()` ——
  均非废弃写法，配置本身没问题。
- `:78-80` `outputFileTracingExcludes` 排除 `data/**/*` 是**有意的安全设计**
  （注释 `:76-77` 说明不得把本地用户数据打进镜像），保留。

### 4.3 明确「不该用」的写法（避免误修）

| 诱惑性的「修复」 | 为什么不该做 | 文档依据 |
|---|---|---|
| 给根布局加 `export const dynamic = 'force-static'` | 会让 `cookies()` 返回空值，登录态 UI 静默失效 | `02-guides/caching-without-cache-components.md:104` |
| 在根布局包 `<Suspense fallback={null}>` 包住 `<body>` | 文档明确指出这会让**整个应用**推迟到请求时渲染，与目标相反 | `01-app/01-getting-started/08-caching.md:298` |
| 用 `use cache` 直接解决 P0-1 | 未启用 `cacheComponents` 时该指令**不生效**；需先改配置 | `08-caching.md:16`；`cacheComponents.md:10-20` |
| 用 `dynamic(..., { ssr: false })` 拆分向导引擎 | 服务端组件渲染的路径下不允许 | `02-guides/lazy-loading.md:94-95` |
| 在 Route Handler body 内直接用 `use cache` | 文档明确须抽到独立 helper 函数 | `01-app/01-getting-started/15-route-handlers.md:144` |

### 4.4 不确定之处（如实声明）

1. 我**未运行** `npm run build`（任务禁止），因此「49/52 条全动态」的结论**基于
   `.next/prerender-manifest.json` 与 `.next/app-path-routes-manifest.json` 这两个已存在的构建产物**，
   而非我亲自构建的结果。若这些产物早于当前源码，结论的时效性需以一次新构建为准。
2. 我**未**验证 `.next` 产物与当前 `src/` 的提交版本是否严格对应（无 `git` 状态比对）。
3. 关于 `pg-*-store.ts` 与文件驱动在**并发行为上是否还有其它语义差异**
   （如排序、时区、`sql.json` 序列化差异），我只做了结构比对，**未做逐方法的行为等价性验证**。
4. 三术 `template.ts` 的重复行数（ziwei∩liuyao = 160 行）是**归一化行**口径
   （去注释、字符串折叠为 `"S"`），与实际「可直接删除的代码行」不是同一口径，
   实际可删量需在重构时以 AST 比对确定。

---

## 5. 修复优先级建议

| 批次 | 内容 | 理由 |
|---|---|---|
| **第 1 批（立即，S 成本）** | P0-2 乱码（5 处 + 1 处测试断言）、P0-3 驱动判定统一 | 单文件级改动，立即消除用户可见缺陷与数据分裂风险 |
| **第 2 批（本周）** | P0-1 根布局解耦（拆 Session 岛 + `<Suspense>`） | 影响全部 24 页，是后续一切静态优化与 PPR 的前提 |
| **第 3 批（本迭代）** | P1-4 第 1 项（`CATEGORY_LABEL` 外移）、P1-6 认证/存储 8 处空 catch、P1-5 key 单源化 | 均为低成本、边界清晰的改动 |
| **第 4 批（规划）** | P0-4 迁移乐观锁、P1-1 解读管线去重、P1-2 存储收敛、P1-3 深层导入 | 结构性重构，需测试护航，逐项独立提交 |
| **长期** | P2-1 页面服务端化 | 依赖「登录用户走云端取数」的产品口径确定后再动 |

---

*报告结束。本报告未修改任何源文件。*
