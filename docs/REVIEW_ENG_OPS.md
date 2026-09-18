# 工程 / 运维只读审查报告（性能 · 可靠性 · 可观测性 · 部署）

- **审查对象**：`cyber-divination`（Next.js 16.2.10，「赛博命理」）
- **审查性质**：**只读**。未修改任何文件、未执行 `npm install`、未启动 dev server。
- **审查日期**：以仓库当前工作区状态为准
- **方法**：静态代码阅读 + 构建产物（`.next/`）取证 + grep 全库扫描
- **关键取证命令与产物**：`.next/app-path-routes-manifest.json`、`.next/prerender-manifest.json`（见 §A2）

## 判定图例

| 标记 | 含义 |
| --- | --- |
| **仍存在** | 有直接代码/产物证据，缺陷未修复 |
| **已修复** | 有直接证据表明已解决 |
| **部分修复** | 有缓解但未根治，或仅文档/样例覆盖 |
| **无法确认** | 静态阅读无法判定，需运行时验证 |

---

## A. 性能

### A.1 首屏体积：三个新建向导把完整计算引擎打进客户端 bundle

| 领域 | 问题 | 影响面 | 严重度 | 证据 | 修复方案 |
| --- | --- | --- | --- | --- | --- |
| 性能/首屏 | **三个向导均为 `"use client"` 且在模块顶层静态 import 完整计算引擎**，引擎随首屏 JS 一并下发并在浏览器执行 | `/chart/new`、`/ziwei/new`、`/liuyao/new` 首屏 JS 显著增大；移动端 TTI/LCP 变差 | **P1** | `src/components/form/BirthWizard.tsx:1`（`"use client"`）、`:6`（`import { computeChart } from "@/lib/bazi"`）、`:7`（`lunarToSolarDate`）、`:8`（`@/lib/storage`）；`src/components/ziwei/ZiweiWizard.tsx:1`、`:7`（`computeZiweiChart`）、`:8`；`src/components/liuyao/CastForm.tsx:1`、`:10`（`castLiuyao`）、`:11`（`CATEGORY_LABEL` from `@/lib/liuyao/analyze/yongshen`） | 见下方「拆分方案」 |

**被打进客户端 bundle 的引擎模块与体量（源码 bytes/行数，非压缩后；用于排序优先级）**

| 引擎 | 目录 | 文件数 | 源码 bytes | 行数 | 入口 |
| --- | --- | --- | --- | --- | --- |
| 八字 | `src/lib/bazi` | 19 | 74,390 | 2,369 | `src/lib/bazi/index.ts`（单文件 15.2 KB / 505 行） |
| 紫微 | `src/lib/ziwei` | 22 | 77,789 | 2,718 | `src/lib/ziwei/index.ts`（117 行 re-export 面） |
| 六爻 | `src/lib/liuyao` | 28 | 100,103 | 3,047 | `src/lib/liuyao/cast/index.ts` |
| 读盘/模板 | `src/lib/reading` | 24 | 162,843 | 4,258 | 结果页再叠加 |
| 合计 | — | **93** | **~415 KB** | **~12,392** | — |

> 说明：上表为**源码文本体量**，用于量化「拆分收益」的相对量级；**压缩后 gzip 体积需运行时验证**（`npm run build` 后读 `.next/` 的 route 级 JS 清单，或 `ANALYZE=true`）。本次为只读审查，未执行构建。

**应拆分/迁移的具体模块**

| 模块 | 当前位置 | 现状 | 建议归属 | 拆分方式 |
| --- | --- | --- | --- | --- |
| `computeChart`（八字排盘） | `src/lib/bazi/index.ts:193` | 向导内联调用 `BirthWizard.tsx:252` | **服务端**（API 或 Server Action） | 新增 `POST /api/charts/compute`，由服务端 `computeAuthoritativeChart`（`src/lib/bazi/index.ts:494`）计算；客户端只提交 `BirthProfile`。**注意**：服务端已有权威重算路径 `src/app/api/charts/migrate/route.ts:92`，复用它可让「浏览器即时算」与「服务端权威算」合一 |
| `lunarToSolarDate`（农历换算） | `src/lib/bazi/calendar/lunar.ts` | `BirthWizard.tsx:7,72,178`；`ZiweiWizard.tsx:8,55,134` | **按需 dynamic import** | 仅在用户填了农历时才 `await import("@/lib/bazi/calendar/lunar")`；校验路径同理（`BirthWizard.tsx:178`） |
| `computeZiweiChart`（紫微排盘） | `src/lib/ziwei/compute.ts` | `ZiweiWizard.tsx:192` | **服务端** | 同八字，走统一「排盘 API」 |
| `castLiuyao`（六爻装卦） | `src/lib/liuyao/cast/index.ts:131` | `CastForm.tsx:120` | **服务端**（推荐） | 装卦确定性且零 LLM，适合服务端；但**必须回传 `replaySeed`**（`cast/index.ts:148`）保证可复现 |
| `CATEGORY_LABEL`（用神类别表） | `src/lib/liuyao/analyze/yongshen.ts` | `CastForm.tsx:11` 仅为渲染下拉框（`:56-61`） | **数据下沉/内联** | 这是纯 `Record<Category,string>` 展示文案，却经 `analyze/yongshen` 把**整个六爻分析引擎**拖进向导。改为把 label 表独立到 `src/lib/liuyao/data/category-label.ts`（零依赖），或直接内联到组件 |
| `renderZiweiTemplateReading` 等模板引擎 | `src/lib/reading/**` | 结果页 `src/app/ziwei/[id]/reading/page.tsx:20` | **dynamic import** | 模板渲染只在用户切到「模板」模式时才需要（该页 `:88-98` 的 `useMemo` 在首屏即执行），改为按需加载 |
| `@/lib/storage` 全量桶 | `src/lib/storage/index.ts` | 向导 `BirthWizard.tsx:8`、`CastForm.tsx:12` 引入 | **按需 import** | 桶文件会把 `sync.ts`（17.6 KB）、`migrate.ts`（10.6 KB）一并拉入；改为只 import 具体 save 函数 |

**判定**：**仍存在**（PROJECT_REVIEW §2.6 第二条）。

**推荐拆分方式（按收益/风险排序）**

1. **`dynamic import` 立即见效、改动最小**：把 `CATEGORY_LABEL` 从 `analyze/yongshen` 解耦（收益最大，单点移除整个分析引擎）；`lunarToSolarDate` 改为条件加载。
2. **服务端化（根治）**：三个向导只采集数据、提交 API、用返回结果跳转。这与项目既有「服务端权威」原则完全一致——`src/lib/bazi/index.ts:489-496` 注释明确写着「The browser may calculate an instant chart for responsiveness, but every persisted/narrated chart must be regenerated from the validated BirthProfile before it is trusted」。**当前浏览器算出的盘随后又被服务端丢弃重算，属于纯浪费**。
3. **`next/dynamic` 包裹向导主体**：作为过渡手段（`ssr: false`），可把引擎移出首屏关键路径，但**不减少总下载量**，只降低首屏阻塞——优先级低于 1、2。

---

### A.2 渲染模式：根布局 `await getServerSession()` 使全部页面被迫动态渲染

| 领域 | 问题 | 影响面 | 严重度 | 证据 | 修复方案 |
| --- | --- | --- | --- | --- | --- |
| 性能/渲染模式 | **根布局读取会话，使所有页面（含纯静态公开页）丧失静态化能力** | 首页、`/privacy`、`/share/[token]`、`/not-found` 全部 SSR 动态渲染；无 CDN 可缓存 HTML；TTFB 上升；每请求都付 node 渲染成本 | **P1** | `src/app/layout.tsx:26`（`const session = await getServerSession();`）；会话读取实现 `src/lib/auth/get-session.ts:15`（`await cookies()`）——`cookies()` 是 Next.js 的动态 API，一旦在根布局调用，**整棵路由树强制 dynamic** | 见下方「修复思路」 |

**构建产物取证（决定性证据）**

```
.next/prerender-manifest.json  →  routes: [_global-error, /favicon.ico]   # 仅此两项
.next/server/app/*.html        →  仅 _global-error.html (9512 bytes)
.next/app-path-routes-manifest.json → 含 "/page": "/"、"/privacy/page"、"/share/[token]/page"
                                      但均未出现在 prerender-manifest 中
```

结论：**`/`（首页）、`/privacy`、`/share/[token]`、`/_not-found` 一个都没有被静态预渲染**。这直接证实 PROJECT_REVIEW §2.6 第一条缺陷。

**被迫 dynamic 渲染的公开页面清单**

| 页面 | 文件 | 本可静态化 | 为何被迫 dynamic |
| --- | --- | --- | --- |
| 首页 `/` | `src/app/page.tsx:82` | ✅ 纯静态内容（`ARTS`/`BRAND`/`HOME` 常量，来自 `@/content/zh`） | 继承根布局的 `cookies()` |
| 隐私政策 `/privacy` | `src/app/privacy/page.tsx` | ✅ 完全静态 | 同上 |
| 分享页 `/share/[token]` | `src/app/share/[token]/page.tsx:52` | ⚠️ 数据相关，但**可 ISR**（快照内容不可变） | 同上 + `getShareSnapshot` 读存储 |
| 分享页 `/share/ziwei/[token]` | `src/app/share/ziwei/[token]/page.tsx` | ⚠️ 同上 | 同上 |
| 分享页 `/share/liuyao/[token]` | `src/app/share/liuyao/[token]/page.tsx` | ⚠️ 同上 | 同上 |
| `not-found` | Next 内置 | ✅ 静态 | 同上 |

**修复思路（会话依赖下沉到组件级 + Suspense）**

1. **把 `getServerSession()` 从 `layout.tsx:26` 移除**，让根布局成为纯静态组件（只保留 `<html>`/`<body>`/`globals.css`）。
2. **新增一个 async Server Component** 承载会话，例如 `src/components/auth/SessionHeader.tsx`：
   - 内部 `await getServerSession()`，渲染 `<SiteHeader>` 与 `<AuthModeSync>`。
   - 在布局中用 `<Suspense fallback={<HeaderSkeleton />}>` 包裹。**关键点**：`cookies()` 的动态性被限制在 `<Suspense>` 边界内的子树，Next.js 会继续对边界的静态外壳做预渲染（PPR / 流式），根路由不再整体 dynamic。
3. **对分享页加 ISR**：`export const revalidate = 3600;`（或把 `SHARE_TTL_SECONDS` 对齐）。快照一经写入不再变化（`src/lib/share/types.ts` 的 `ShareSnapshot` 无更新路径），非常适合缓存。当前全库 **grep `revalidate` 只命中 1 处**（见 §A5），分享页完全没利用。
4. **`generateMetadata` 的会话无关性**：`src/app/share/[token]/page.tsx:11` 只读 snapshot、不读会话，静态化后可直接受益。
5. **验证手段**：改完后 `npm run build`，确认 `.next/prerender-manifest.json` 的 `routes` 中出现 `/`、`/privacy`；或看构建日志中 `/` 被标记为 `○ (Static)` 而非 `ƒ (Dynamic)`。

**判定**：**仍存在**。

---

### A3. 数据库：表/索引、N+1、批量同步

#### A3.1 表与索引清单

| 表 | 主键 | 索引 | 外键 |
| --- | --- | --- | --- |
| `users` | `id` | `email UNIQUE` | — |
| `magic_links` | `token_hash` | `magic_links_email_idx (email)` | — |
| `people` | `id` | `people_user_id_idx (user_id)` | `user_id → users(id) ON DELETE CASCADE` |
| `bazi_charts` | `id` | `bazi_charts_user_id_idx (user_id)` | `user_id → users(id) ON DELETE CASCADE` |
| `ziwei_charts` | `id` | `ziwei_charts_user_id_idx (user_id)` | `user_id → users(id) ON DELETE CASCADE` |
| `liuyao_charts` | `id` | `liuyao_charts_user_id_idx (user_id)` | `user_id → users(id) ON DELETE CASCADE` |

证据：`src/lib/db/schema.ts:99-158`（`SCHEMA_SQL`），`src/lib/db/migrate.sql:7-66`。两份定义**逐字节一致**（content 相同），无漂移风险。

**高频查询字段索引核查**

| 查询模式 | 出处 | 索引 | 判定 |
| --- | --- | --- | --- |
| 按 `user_id` 查 charts | `src/lib/storage/pg-bazi-store.ts:51` | `bazi_charts_user_id_idx` | ✅ 已覆盖 |
| 按 `user_id` 查 people | `src/lib/storage/pg-person-store.ts` | `people_user_id_idx` | ✅ 已覆盖 |
| 按 `user_id` + `id` 查 | `pg-bazi-store.ts:64` | PK `id` + 过滤 `user_id` | ✅ 可接受（`id` 已是 PK） |
| `ORDER BY updated_at DESC` | `pg-bazi-store.ts:52` | **无 `(user_id, updated_at)` 复合索引** | ⚠️ **P2**：数据量增长后 list 查询需排序 |
| **按 `token` 查 share** | `src/lib/share/upstash-redis.ts`（Redis GET，非 SQL） | 不适用 | ✅ share 不走 Postgres |

> **说明**：share 快照存于 Upstash Redis 或本地 JSON 文件（`src/lib/share/index.ts:20-27`），**不在 Postgres**，因此「按 token 查 share 需要索引」在本架构下不成立。

**建议**：为 `bazi_charts`/`ziwei_charts`/`liuyao_charts` 增加 `CREATE INDEX ... ON x_charts(user_id, updated_at DESC);`，可让 `ORDER BY updated_at DESC` 走索引扫描。**P2，非阻塞**。

#### A3.2 N+1 查询

| 领域 | 问题 | 影响面 | 严重度 | 证据 | 修复方案 |
| --- | --- | --- | --- | --- | --- |
| 数据库 | **三个 pull 循环内逐条 `await` 详情请求（典型 N+1）** | 登录后自动同步在档案多时线性变慢；每个盘一次 HTTP 往返 | **P1** | `src/lib/storage/sync.ts:288-299`（`for (const item of items) { const detail = await fetchCloudChart(...) }`）、`:403-415`（紫微）、`:488-499`（六爻） | 见下 |
| 数据库 | 服务端迁移循环内逐条 upsert | 迁移请求随档案数线性增长 | **P1** | `src/app/api/charts/migrate/route.ts:127-174`，尤其 `:139` `await upsertCloudChart(...)` 在 `for (const d of plan.decisions)` 内 | 见下 |
| 数据库 | 循环内可能有兜底单查 | 潜在额外 N 次查询 | **P2** | `src/app/api/charts/migrate/route.ts:162-164`：`cloudById.get(...) ?? (await getCloudChart(...))`；`cloudById` 已由 `:114-117` 用全量列表填充，正常路径不触发，但**容错分支是隐藏的 N+1** | 去掉兜底或改为批量预取 |
| 数据库 | upsert 前先做一次存在性查询 | 每次 upsert 2 次往返 | **P2** | `src/lib/storage/pg-bazi-store.ts:84`（`const existing = await pgGetCloudChart(...)`）后再 `:100` INSERT…ON CONFLICT。**该 SELECT 只是为了继承 `createdAt` 与保留 report/calibration** | 用 `ON CONFLICT ... DO UPDATE SET report_json = COALESCE(EXCLUDED.report_json, bazi_charts.report_json)` 合并语义，省掉前置 SELECT |

**修复方案（N+1）**

- **`sync.ts` 三个 pull**：新增批量详情端点（如 `GET /api/charts?ids=a,b,c` 或 `POST /api/charts/batch-get`），或让 list 接口直接返回完整 record。退一步至少用 `Promise.all` 分片并发（注意限流桶 `reading`/`share` 与 DB 连接池 `max: 5`，`src/lib/db/client.ts:35`），建议并发上限 4–6。
- **`migrate` 循环**：改为 `Promise.all` 或单条 SQL 的 `INSERT ... VALUES (...), (...) ON CONFLICT` 批量写入；`pool max: 5`（`src/lib/db/client.ts:35`）意味着并发超过 5 会排队，批量 SQL 比并发请求更优。

#### A3.3 `sync.ts` 批量同步：逐条，非批量

| 领域 | 问题 | 严重度 | 证据 |
| --- | --- | --- | --- |
| 性能/可靠性 | **批量同步实际是逐条串行 upsert**，无批量接口、无并发、无事务 | **P1** | `src/lib/storage/sync.ts:233-259`（push 循环 `await upsertCloudChartApi`）、`:355-376`（紫微 push）、`:452-464`（六爻 push） |

**影响**：N 个档案 = N 次顺序 HTTP + N 次 DB 往返；中途失败仅记录到 `failed[]`（`:237-242`）后继续，**无重试、无退避、无事务**——部分成功后用户看到「部分完成」（`:152-157`），需手动重跑。

**修复**：新增 `POST /api/charts/batch-upsert`（单事务、单往返）；客户端分片 + 指数退避重试。

**判定（A3 整体）**：PROJECT_REVIEW §2.6 未直接提及数据库，但本节列出的 N+1 与逐条同步属**新发现**，均为 **仍存在**。

---

### A4 外部依赖：LLM 客户端缺超时/重试，且非流式

| 领域 | 问题 | 影响面 | 严重度 | 证据 | 修复方案 |
| --- | --- | --- | --- | --- | --- |
| 可靠性/性能 | **LLM `fetch` 无超时、无 `AbortSignal`，可无限期挂起** | 上游卡住时请求线程/连接与用户页面同时被占死；无界并发可耗尽服务 | **P0** | `src/lib/reading/llm/client.ts:87-99`：`await fetch(url, { method, headers, body })`——**无 `signal`、无 `timeout`**。全库 grep `AbortSignal.timeout\|signal:\|AbortController` → **0 匹配** | 加 `signal: AbortSignal.timeout(LLM_TIMEOUT_MS)`（默认 60s），超时归类为 `LLM_NETWORK`（复用 `client.ts:180`） |
| 可靠性 | **无重试、无退避** | 上游瞬时 429/5xx 直接失败，用户感知为解读失败 | **P1** | `src/lib/reading/llm/client.ts:103-119`：任何非 2xx 立即 `throw new Error(\`LLM_HTTP_${res.status}\`)`，无重试循环 | 对 429/5xx 做有限重试（≤2 次）+ 指数退避 + 抖动；`Retry-After` 优先 |
| 可靠性/性能 | **无并发上限/信号量/队列** | LLM 并发无界，成本与上游限流风险不可控 | **P1** | 全库无 semaphore/p-limit/queue；每个请求独立 `fetch`（`client.ts:87`）。限流仅在入口按 IP（`src/lib/api/rate-limit.ts:202`），**不限制全局并发** | 进程内信号量（如上限 8–16），或改为任务队列 + worker |
| 性能/感知延迟 | **非流式：等待完整响应后才返回** | 用户盯着 spinner 等待整篇 8 章报告；感知延迟 = 总生成时间 | **P1** | `src/lib/reading/llm/client.ts:93-98`：请求体无 `stream: true`；`:121` `await res.json()` 一次性解析。路由 `src/app/api/reading/route.ts:94` `await llmReading(...)` 后 `:121` 一次性 `NextResponse.json` | 改用 SSE / `stream: true`，把 token 增量推给前端；前端已有 loading UI（`src/app/ziwei/[id]/reading/page.tsx:226-235`）可平滑接入 |
| 任务模型 | **同步阻塞式，无任务 ID / 轮询 / 恢复** | 刷新或断网即丢结果；无进度；无法异步化 | **P1** | `src/app/api/reading/status/route.ts:8-13` **仅返回 `{ llmConfigured: boolean }`，不是任务状态接口**。真实解读为单次同步 POST（`src/app/api/reading/route.ts:94`） | 若引入流式即可省掉任务模型；若需长任务，建 job 表 + `GET /api/reading/jobs/:id` |

> **`/api/reading/status` 的重要澄清**：从名字看像「任务状态」，**实际是「LLM 是否已配置」的 feature flag**。前端用它决定是否允许切到 LLM 模式（`src/app/ziwei/[id]/reading/page.tsx:72-82`、`:148`）。**不存在任务模型**——解读是同步请求-响应，超时由 `max_tokens: 4096`（`client.ts:96`）间接约束，但**没有硬时限**。

**判定**：PROJECT_REVIEW §2.6 未提及 LLM 客户端细节，本节为**新发现**，全部**仍存在**。其中**无超时**为 **P0**。

---

### A5 缓存：几乎无缓存，重复计算普遍

| 领域 | 问题 | 严重度 | 证据 |
| --- | --- | --- | --- |
| 缓存 | **全库仅 1 处 `revalidate`，位于 OG 图；无 `unstable_cache`、无 `use cache`、无页面级 `revalidate`** | **P1** | 全库 grep `revalidate\|unstable_cache\|no-store\|force-dynamic\|force-static\|dynamic =\|use cache` → **仅 3 处命中**：`src/app/share/[token]/opengraph-image.tsx:45`（`revalidate: 86400*30`）、`src/app/api/health/route.ts:16` 与 `src/app/api/health/ready/route.ts:19`（均为 `no-store`，正确）。**`unstable_cache` / `use cache` 零命中** |
| 缓存 | **分享快照每次访问都读一次存储** | **P1** | `src/app/share/[token]/page.tsx:3` + `:54` `await getShareSnapshot(token)`；且 `:13` `generateMetadata` **再读一次**（同页两次读，无 `cache()` 去重） |
| 缓存 | **结果页模板报告首屏即全量计算** | **P1** | `src/app/ziwei/[id]/reading/page.tsx:88-98`：`useMemo` 在挂载即调用 `renderZiweiTemplateReading`（该模块 `src/lib/reading/ziwei/template.ts` 15.9 KB） |

**重复计算的具体位置**

| 重复计算 | 出处 | 说明 |
| --- | --- | --- |
| 同 id 盘被算两遍 | `BirthWizard.tsx:252` 客户端算 → `src/app/api/charts/migrate/route.ts:92` 服务端再算 | 设计上的「权威重算」，但对同一份输入做了两次完整计算 |
| share 快照读两次 | `src/app/share/[token]/page.tsx:13` 与 `:54` | 可用 React `cache()` 包装 `getShareSnapshot` 去重 |
| 模板解读重复渲染 | 结果页 `useMemo` 依赖 `viewMode`（`:98`） | 切换视图会整体重算，无缓存 |

**修复方案**

1. 分享页加 `export const revalidate = 3600;`（快照不可变，见 `src/lib/share/types.ts`）；配合 A2 的静态化。
2. 用 `cache()` 包装 `getShareSnapshot`，消除同请求内重复读。
3. 排盘结果按 `(引擎版本, 输入 hash)` 做服务端缓存（`unstable_cache` + tag），因引擎是纯函数、确定性（`src/lib/bazi/index.ts:193`、`src/lib/liuyao/cast/index.ts:131`），**缓存收益高且安全**。
4. 模板解读下沉为按需 `dynamic import`。

**判定**：**仍存在**（属新发现；PROJECT_REVIEW §2.6 未列，但与「初始 JS 仍有优化空间」同源）。

---

## B. 可靠性

### B1 健康检查

| 领域 | 问题 | 影响面 | 严重度 | 证据 | 修复方案 |
| --- | --- | --- | --- | --- | --- |
| 可靠性 | **liveness 不探依赖（设计如此，正确）**；readiness 探 DB/Redis ✅ | — | — | `src/app/api/health/route.ts:7-19` 仅返回 `{status:"ok"}` 且注释明确「不探测 DB/Redis」；`src/app/api/health/ready/route.ts:9` 调 `runReadinessChecks()`，`:17` 按结果返回 200/503 | 无需改 |
| 可靠性 | **readiness 按需跳过检查，可能给出「假就绪」** | 依赖配置漂移时，探针返回 ready 而实际不可用 | **P1** | `src/lib/health/readiness.ts:22-33`：`needsDbCheck()` 仅在 `CLOUD_STORE_DRIVER=postgres` **或** 有 `DATABASE_URL` 时为 true；`needsRedisCheck()` 仅在 `RATE_LIMIT_DRIVER=redis` 或 `SHARE_STORE_DRIVER=upstash` 时 true。否则 `:73`/`:80-84` 返回 `{ok:true, skipped:true}`。**`ready = db.ok && redis.ok`（`:87`）恒为 true** | 生产应设 `READINESS_STRICT=1`，强制探 DB/Redis 而不依赖驱动推断；或在 `validate-prod` 通过时同时校验两项驱动 |
| 可靠性 | **降级行为：不健康即 503，无部分降级** | Redis 挂 → 整个实例被踢出 LB，即使 DB 正常 | **P1** | `src/lib/health/readiness.ts:87`：`ready` 是 `db.ok && redis.ok` 的**全有全无**，没有「Redis 降级为内存限流、仍可服务」的表达 | 引入分级：DB 挂 = not ready（必须下线）；Redis 挂 = degraded（仍 ready，限流退化为本地内存但**必须记录告警**） |

**readiness 输出（`src/app/api/health/ready/route.ts:10-15`）**

```json
{ "status": "ready" | "not_ready",
  "checks": { "db": {ok,message,skipped?}, "redis": {ok,message,skipped?} },
  "timestamp": "..." }
```

**判定**：探针**确实检查了真实依赖**（DB 走 `SELECT 1`：`src/lib/db/client.ts:69`；Redis 走真实 `ping`：`src/lib/health/readiness.ts:47`），**优于** PROJECT_REVIEW 的担忧；但「按驱动跳过」是个**新的假就绪风险**（P1）。

---

### B2 降级路径：数据丢失与文件存储风险

| 领域 | 问题 | 影响面 | 严重度 | 证据 | 修复方案 |
| --- | --- | --- | --- | --- | --- |
| 可靠性/数据 | **生产未强制禁止分享快照落本地文件** | 多实例/无持久盘环境下，分享链接**随机 404**；重启即丢 | **P0** | `src/lib/share/index.ts:20-27`：`resolveDriver()` 默认 `"local"`（`process.env.SHARE_STORE_DRIVER ?? "local"`）；`:49-51` 返回 `LocalFileShareStore`。**`src/lib/config/validate-prod.ts` 全文（1-87 行）从未读取 `SHARE_STORE_DRIVER`**——只校验 `AUTH_SECRET`、`AUTH_ALLOW_DEV_LOGIN`、`CLOUD_STORE_DRIVER`、`RATE_LIMIT_DRIVER`。全库 grep `SHARE_STORE_DRIVER` → 仅出现在 `share/index.ts`、`readiness.ts`、测试文件，**validate-prod.ts 零命中** | 在 `validate-prod.ts` 增加：生产必须 `SHARE_STORE_DRIVER=upstash` 且 URL/TOKEN 非空 |
| 可靠性/数据 | **`LocalFileShareStore` 生产风险**：读写竞态 + 无持久盘 | 并发写丢更新；容器重建即丢全部分享 | **P0**（多实例时） | `src/lib/share/local-file.ts:26-34` `readAll()` 全量读；`:36-39` `writeAll()` **全量覆盖写**；`:41-45` `save()` = read-modify-write，**无文件锁**。两个并发 `save` 会互相覆盖（丢快照）。`:8` 注释自承「Vercel 等无持久磁盘的 Serverless 环境不可靠」 | 生产强制 upstash；若必须文件，加 `proper-lockfile` 或改 append-only |
| 可靠性/数据 | **文件版 cloud-store 同样全量 JSON 覆盖写** | 同进程内存缓存与磁盘不一致风险 | **P1** | `src/lib/storage/cloud-store.ts:59-64` `persist()` 全量 `writeFile`；`:36-37` 模块级 `memory` 单例；`:43-57` `ensureLoaded()` 一次性加载。**多实例下各进程内存各写一份，互相覆盖** | 生产强制 Postgres（已被 `validate-prod.ts:48-54` 覆盖 ✅） |
| 可靠性 | **降级是否静默丢数据？** | — | — | ✅ **主存储降级是 fail-fast，不静默**：`src/lib/storage/driver.ts:14-18`（`CLOUD_STORE_DRIVER=postgres` 无 `DATABASE_URL` 时**抛错**，注释「禁止静默回落文件」）；`src/lib/api/rate-limit.ts:164-168`（redis 缺凭证**抛错**，「禁止静默回落 memory」）；`src/lib/share/index.ts:55-59`（upstash 缺凭证**抛错**，「禁止静默回落本地文件」）。**三处均为 fail-fast**，设计良好 | 保持 |
| 可靠性 | **但存在一处真实静默失败** | 紫微排盘后的云端同步失败被完全吞掉 | **P1** | `src/components/ziwei/ZiweiWizard.tsx:196-200`：`pushOneZiwei({...}).catch(() => undefined)`——**空 catch 吞掉所有错误**，用户与日志均无感知 | 至少 `logApi("warn", ...)`；UI 提示「云端同步失败，已存本机」 |
| 可靠性 | **`persist()` 失败被吞** | 文件驱动下写盘失败不可见 | **P1** | `src/lib/storage/cloud-store.ts:204`、`:217`、`:240`：`await persist().catch(() => undefined)`——**三处空 catch** | 记录错误并向上抛，或至少告警 |

**判定（B2）**：

- Redis/Postgres 不可用 → **main 路径 fail-fast，不静默丢数据**（`driver.ts:14-18` 等）→ 此项**已修复/良好**。
- **但分享存储（`SHARE_STORE_DRIVER`）是唯一漏网之鱼**：默认 local、生产不校验 → **仍存在（P0）**。
- 静默丢数据的真实位置不在驱动降级，而在**空 catch**（`ZiweiWizard.tsx:198`、`cloud-store.ts:204/217/240`）→ **仍存在（P1）**。

---

### B3 幂等与并发：多设备同盘冲突

| 领域 | 问题 | 影响面 | 严重度 | 证据 | 修复方案 |
| --- | --- | --- | --- | --- | --- |
| 可靠性/并发 | **多设备并发上传同一命盘 = 最后写入者胜（LWW），无乐观锁/版本号** | 设备 A、B 同时编辑同一 `profileId`，一方修改**静默丢失** | **P1** | `src/lib/storage/pg-bazi-store.ts:113-119`：`ON CONFLICT (id) DO UPDATE SET ... updated_at = EXCLUDED.updated_at`——**无条件覆盖，无 `WHERE` 版本比较**。表结构（`src/lib/db/schema.ts:128-138`）**无 `version` / `revision` / `etag` 列** | 加 `revision INTEGER NOT NULL DEFAULT 1` 列；upsert 改 `DO UPDATE SET ... , revision = bazi_charts.revision + 1 WHERE bazi_charts.revision = $expected`；受影响行数为 0 则返回 409 |
| 可靠性/并发 | **迁移合并靠 `updatedAt` 字符串比较，时钟偏移即误判** | 客户端时钟不准时，「较新者胜」判断错误 | **P1** | `src/lib/storage/migrate.ts:150-154`（`parseIsoMs`）、`:137-148`（`pickConflictWinner`）；`:216-225`（相等即云端胜）。**`localUpdatedAt` 来自浏览器 localStorage**（`migrate.ts:377-390` `touchLocalUpdatedAt`），可被用户随意篡改 | 服务端以自身 `updated_at` 为准；客户端时间仅作提示，不参与仲裁 |
| 可靠性/并发 | **迁移「上传」路径先算后写，非事务** | 部分上传后失败 → 状态不一致 | **P2** | `src/app/api/charts/migrate/route.ts:127-174` 逐条 upsert，无事务包裹 | 单事务批量写 |
| 可靠性 | **`ensureSchema()` 请求路径建表** | 并发 DDL 风险 | **P2** | `src/lib/db/client.ts:50-60`；`:53-57` 用模块级 `schemaReady` promise 去重（单进程有效）。生产已建议 `DB_SKIP_ENSURE_SCHEMA=1`（`:52`），且 `compose.production.yaml:40` 已设 `"1"` ✅ | 保持；文档强调必设 |

**结论**：**无乐观锁、无版本号、无条件覆盖**。合并策略（LWW + 云端优先打破平局）已在 `src/lib/storage/migrate.ts:4-12` 文档化且**自洽**，但**并发同一档案会丢更新**。

**判定**：**仍存在**（P1）。

---

### B4 限流降级：多实例内存限流失效？

| 领域 | 问题 | 严重度 | 证据 |
| --- | --- | --- | --- |
| 可靠性 | **内存限流在多实例下完全失效——但生产已被强制要求 Redis ✅** | **已修复** | `src/lib/api/rate-limit.ts:82-118` `MemoryRateLimiter`（进程内 `Map`，`:83`；注释 `:81` 明示「Serverless 多实例不共享」）；`:159-178` `createRateLimiter()` 按 `RATE_LIMIT_DRIVER` 选择。**`src/lib/config/validate-prod.ts:18-39` 强制生产 `RATE_LIMIT_DRIVER=redis`**（`:20-22` 抛错「禁止静默使用 memory 限流（多实例保护）」）并校验 URL/TOKEN（`:25-30`），且要求显式 `RATE_LIMIT_TRUSTED_PROXY`（`:33-38`） |
| 可靠性 | **双实现一致性**：`scripts/validate-prod-env.mjs` 与 TS 版对齐 | — | `scripts/validate-prod-env.mjs:24-41` 与 `src/lib/config/validate-prod.ts:18-39` 逻辑一致 ✅（各自独立实现，存在漂移风险但有配套测试） |
| 可靠性 | **可信代理信任模型正确** | — | `src/lib/api/rate-limit.ts:233-240` `getRateLimitIdentityMode()`：非 `0/1` 抛错；`:249-262` `clientKeyFromRequest()`：**direct 模式永远返回 `"anon"`，不信任任何客户端可控头**（注释 `:248`）；`:255-256` 优先 `x-real-ip`，`:258-260` 才回退 `x-forwarded-for` |
| 可靠性 | **⚠️ `direct` 模式下限流键退化为常量 `"anon"` → 全站共享一个桶** | **P1** | `src/lib/api/rate-limit.ts:250`：`if (getRateLimitIdentityMode() === "direct") return "anon";`。这意味着**所有直连用户共享同一限流计数**，任一用户打满 15 次/分钟，**全站其他人全部被 429**。若生产误设 `RATE_LIMIT_TRUSTED_PROXY=0`（直连），即为**全站拒绝服务向量** |

> **重要**：`compose.production.yaml:44` 设 `RATE_LIMIT_TRUSTED_PROXY: ${RATE_LIMIT_TRUSTED_PROXY:-1}`（默认 1 ✅），`compose.acceptance.yaml:48` 设 `"0"`。**但 `validate-prod.ts:33-38` 只校验该值为 `0` 或 `1`，不校验「生产应为 1」**——设为 `0` 同样通过校验，却触发上述全站单桶问题。

**修复**：`direct` 模式不应退化为常量；应使用连接层可得的真实 IP（如 `request.ip` / socket 地址），或至少在 `direct` + 生产组合下**拒绝启动**并提示必须置于可信代理之后。

**判定（B4）**：核心问题（生产强制 Redis）**已修复**；但 `direct` 模式的桶退化是**新发现的 P1**。

---

## C. 可观测性

### C1 日志与错误上报

| 领域 | 问题 | 影响面 | 严重度 | 证据 | 修复方案 |
| --- | --- | --- | --- | --- | --- |
| 可观测性 | **日志是结构化 JSON ✅，含 requestId ✅** | — | **已修复** | `src/lib/api/logger.ts:72-92`：`logApi()` 构造 `{ts, level, event, ...fields}` 后 `JSON.stringify`（`:77-84`），按 level 写 stdout/stderr（`:85-91`）。`requestId` 为必填字段（`:2`）。脱敏完善（`:27-66`：屏蔽 `apiKey`/`authorization`/`token`/`prompt`/`bearer`，且保留 usage token 数字，`:30-36`） |
| 可观测性 | **requestId 可跨请求追踪，但仅 API 路由有** | 页面/Server Component 无 requestId | **P2** | `src/lib/api/request-id.ts:6-12` `resolveRequestId()`（读取 `x-request-id`，校验长度 ≤128 与字符集），`:14-16` 回写响应头。**验证**：仅 route handlers 使用（`src/app/api/reading/route.ts:20`、`src/app/api/share/route.ts:83`）；`src/app/layout.tsx`、各 page 无此机制 |
| 可观测性 | **⚠️ 无任何错误上报（无 Sentry/OTel）** | **生产排障盲区**：客户端异常、SSR 崩溃、未捕获 Promise rejection 全部无声 | **P0** | 全库 grep `Sentry\|@sentry\|useReportWebVitals\|web-vitals\|routeChangeStart\|sendBeacon` → **0 匹配**。`src/instrumentation.ts:1-10` **只做 `validateProductionConfig()`**（`:8-9`），未注册 `onRequestError`、未初始化错误上报 |
| 可观测性 | **无 alerting / trace / metrics 导出** | 无法做 SLO、无法告警 | **P0** | 同上；无 Prometheus/OTel exporter，无 `/metrics` 端点 |

**生产排障盲区（明确指出）**

1. **客户端错误完全不可见**：无 `onRequestError`（Next.js 15+ 提供）、无 `global-error` 上报（仅 `.next/server/app/_global-error.html` 静态页）、无 window.onerror 上报。
2. **`console.error(JSON)` 到 stdout 是唯一通道**：若日志采集未配置（仓库内无 Fluent Bit/Vector/Loki/promtail 配置，见 §D3），**日志即黑洞**。
3. **无告警规则**：`docs/` 与 `deploy/` 中未见任何告警配置。
4. **`catch {}` 静默吞错**多处（见 B2 表格），这些错误即使有上报也不会到达。

**修复方案**：接入 Sentry（`@sentry/nextjs`）+ `instrumentation.ts` 注册 `onRequestError`；补 `/metrics`（Prometheus 文本格式）暴露 LLM 调用计数/延迟/错误码、DB 查询耗时、限流命中数。

---

### C2 关键业务指标：排盘/解读成功率埋点

| 领域 | 问题 | 影响面 | 严重度 | 证据 |
| --- | --- | --- | --- | --- |
| 可观测性 | **无业务指标埋点，产品无法度量成功率** | 无法回答「解读成功率多少」「模板回落率多少」「排盘失败率多少」 | **P0** | 全库 grep `metrics\|analytics\|track(\|web-vitals` → **0 业务埋点**。**唯一的替代是日志文本**：`src/app/api/reading/route.ts:102-119` 记录 `fallback`（`:111`）、`fallbackReason`（`:112`）、`errorCode`（`:113`）、token usage（`:114-116`）、`mode`（`:118`） |

**可提取但未结构化的信号**

| 信号 | 日志位置 | 现状 |
| --- | --- | --- |
| 解读成功/失败 + 回落 | `src/app/api/reading/route.ts:102-119`（`api.reading.ok`，含 `fallback`） | 仅在日志中，需人工 grep |
| 解读异常 | `src/app/api/reading/route.ts:133-142`（`api.reading.error`） | 同上 |
| LLM 上游结果 | `src/lib/reading/llm/client.ts:144-154`（`llm.chat.ok`，含 token 与 `durationMs` `:149`）、`:105-117`（`llm.chat.error`） | 同上；**已有 token 计量，可算成本** |
| 限流命中 | `src/app/api/reading/route.ts:40-48`（`api.rate_limited`） | 同上 |
| 排盘成功 | `src/components/form/BirthWizard.tsx:252` 纯客户端，**无任何日志** | ❌ 完全不可见 |
| 分享生成 | `src/app/api/share/route.ts:306-316`（`api.share.ok`） | 日志中 |

**结论**：**产品无法度量**排盘/解读成功率——排盘全在浏览器（无埋点），解读虽记日志但无聚合、无指标、无看板、无告警。**P0**。

**修复**：定义 4 个核心 SLI：① 排盘成功率；② LLM 解读成功率（区分上游错误码）；③ 模板回落率；④ LLM P95 延迟与 token/成本。以计数器/直方图导出，接告警。

---

### C3 健康检查输出能否被监控系统消费

| 领域 | 问题 | 严重度 | 证据 |
| --- | --- | --- | --- |
| 可观测性 | **可被消费，格式规范 ✅** | **已修复** | liveness：`src/app/api/health/route.ts:9-13` 返回 `{status:"ok",service,timestamp}`；readiness：`src/app/api/health/ready/route.ts:10-15` 返回 `{status,checks,timestamp}`，**HTTP 状态码本身承载语义**（`:17` 200 ready / 503 not_ready）——K8s/LB 可直接用状态码探活 ✅ |
| 可观测性 | **缺机器可读的细粒度指标** | **P2** | 上述为**布尔就绪**，无延迟/连接池/错误率等数值指标；无 `/metrics` |
| 可观测性 | **`Cache-Control: no-store` 正确设置 ✅** | — | `src/app/api/health/route.ts:16`、`src/app/api/health/ready/route.ts:19` |

**判定**：**已修复**（PROJECT_REVIEW §2.6 未直接提出此项；健康检查设计良好），仅缺细粒度指标（P2）。

---

## D. 部署

### D1 Dockerfile 与 next.config.ts

| 领域 | 问题 | 严重度 | 证据 | 对照 EXECUTION_GUIDE §6 |
| --- | --- | --- | --- | --- |
| 部署 | **standalone 输出 ✅** | **已修复** | `next.config.ts:74` `output: "standalone"`；`Dockerfile:28` `COPY --from=builder /app/.next/standalone ./`；`:40` `CMD ["node","server.js"]` | 测试矩阵「Docker build」✅ |
| 部署 | **非 root 用户 ✅** | **已修复** | `Dockerfile:22-25` 创建 `nextjs`(uid 1001)/`nodejs`(gid 1001) 并 `chown`；`:31` `USER nextjs` | 矩阵「非 root」✅ |
| 部署 | **healthcheck 指令 ✅（镜像 + compose 双份）** | **已修复** | `Dockerfile:37-38`（30s 间隔/5s 超时/20s 启动期/3 次重试）；`compose.yaml:43-52`；`compose.production.yaml:57-66` | 矩阵「healthcheck」✅ |
| 部署 | **多阶段构建 + 版本锁定 ✅** | **已修复** | `Dockerfile:3,8,15` 固定 `node:20.19.4-bookworm-slim`；`:6` `npm ci`（锁定 `package-lock.json`） | ✅ |
| 部署 | **`outputFileTracingExcludes` 排除 `data/**` ✅** | — | `next.config.ts:78-80`（注释 `:76-77`「Never package local users, magic links, charts, or shares into an image」） | ✅ |
| 部署 | **安全响应头齐全 ✅** | **已修复** | `next.config.ts:41-54`（CSP、`X-Content-Type-Options`、`X-Frame-Options: DENY`、`X-XSS-Protection: 0`、`Referrer-Policy`、`Permissions-Policy`）；HSTS 仅在 `x-forwarded-proto: https` 时下发（`:58-68`，`:33-37` 注释解释为何条件化）；`getContentSecurityPolicy()` `:10-25` | ✅ 对应 PROJECT_REVIEW §2.6 第四条 |
| 部署 | **⚠️ Dockerfile healthcheck 用 liveness 而非 readiness** | **P2** | `Dockerfile:37-38`、`compose.yaml:48`、`compose.production.yaml:62` **全部打 `/api/health`**（不探 DB/Redis）。DB 挂掉时容器仍报 healthy → 编排不会剔除该实例，持续接收流量并 500 | 建议健康检查改打 `/api/health/ready`，或分开配置 |
| 部署 | **构建期未执行 `validate-prod`** | **P2** | `Dockerfile:13` `RUN npm run build` 未注入 `NODE_ENV=production` 校验步骤（校验发生在运行时 `src/instrumentation.ts:8-9`）。**好处是 fail-fast 在启动时而非构建时，坏处是坏配置能构建出可用镜像** | 可在 `builder` 阶段加 `RUN NODE_ENV=production node scripts/validate-prod-env.mjs`（需占位 env） |

**判定**：PROJECT_REVIEW §2.6 第四条（缺 CSP/安全头/`server-only`/生产校验）→ **已修复**（详见 §E 对照表）。

---

### D2 Compose 三件套差异与生产密钥/外部存储

#### 三者差异对照

| 维度 | `compose.yaml`（本地） | `compose.production.yaml`（生产） | `compose.acceptance.yaml`（验收） |
| --- | --- | --- | --- |
| 项目名 | `cyber-divination` | `cyber-divination` | `cyber-divination-acceptance` |
| `NODE_ENV` | `${NODE_ENV:-development}`（`:18`） | `production`（`:31`） | 继承 base |
| 端口 | `${APP_PORT:-3000}:3000`（`:11`） | **`127.0.0.1:18080:3000`**（`:29`，仅本机绑定 ✅） | `127.0.0.1:18081:3000`（`:39`） |
| `AUTH_SECRET` | `${AUTH_SECRET:-local-compose-auth-secret-change-before-production}`（`:21`，**有弱默认值**） | `${AUTH_SECRET:-}`（`:34`，**无默认，空则启动失败** ✅） | `acceptance-only-auth-secret`（`:41`） |
| `AUTH_METHOD` | `${AUTH_METHOD:-credentials}`（`:23`） | **`magic`**（`:36`） | 继承 |
| `AUTH_ALLOW_DEV_LOGIN` | `${...:-1}`（`:24`，**默认开启假登录**） | **`"0"`**（`:37` ✅） | **`"0"`**（`:42` ✅） |
| `CLOUD_STORE_DRIVER` | `${...:-postgres}`（`:26`） | `postgres`（`:39` ✅） | `postgres`（`:44` ✅） |
| `DATABASE_URL` | 硬编码弱密码 `cyber:cyber` 默认（`:25`） | `${DATABASE_URL:-}`（`:38`，**无默认** ✅） | 硬编码 `cyber:cyber`（`:43`，验收环境可接受） |
| `SHARE_STORE_DRIVER` | `${...:-local}`（`:29`） | **`upstash`**（`:41` ✅） | `local`（`:46`，⚠️ 但走 stub） |
| `RATE_LIMIT_DRIVER` | `${...:-memory}`（`:30`） | **`redis`**（`:43` ✅） | **`redis`**（`:47` ✅） |
| `RATE_LIMIT_TRUSTED_PROXY` | 未设 | `${...:-1}`（`:44` ✅） | `"0"`（`:48`） |
| `DB_SKIP_ENSURE_SCHEMA` | 注释掉（`:28`） | **`"1"`**（`:40` ✅） | `"1"`（`:45` ✅） |
| `depends_on` | `db: service_healthy`（`:34-36`） | `migrate: service_completed_successfully`（`:50-52` ✅） | `redis-rest: service_healthy`（`:53-55`） |
| 数据卷 | `app_data` + `postgres_data`（`:37-38`） | **无卷**（不可变容器 ✅） | `acceptance_app_data` + `acceptance_postgres_data` |
| `migrate` 服务 | ❌ 无（靠 `:63` initdb 挂载 `migrate.sql`） | ✅ 有（`:4-20`，独立 migrate 容器 ✅） | ✅ 有（`:29-35`） |
| 安全加固 | `no-new-privileges`（`:41-42`） | `no-new-privileges` + `tmpfs /tmp`（`:53-56`） | 继承 |
| Redis stub | ❌ | ❌（真实 Upstash） | ✅ `redis-rest`（`:4-13`，用 `node:20.19.4-alpine` + stub） |

#### 生产 compose 是否真用了强密钥与外部存储？

| 检查项 | 结论 | 证据 |
| --- | --- | --- |
| 强密钥 | ✅ **强制外部注入，无弱默认** | `compose.production.yaml:34` `AUTH_SECRET: ${AUTH_SECRET:-}`、`:38` `DATABASE_URL: ${DATABASE_URL:-}`、`:46` `UPSTASH_REDIS_REST_TOKEN: ${UPSTASH_REDIS_REST_TOKEN:-}`——**全部空默认**，缺失则 `validateProductionConfig()`（`src/instrumentation.ts:8-9`）抛错拒绝启动 |
| 外部存储（DB） | ✅ `postgres` + 外部 `DATABASE_URL` | `:38-39` |
| 外部存储（Redis/分享） | ✅ `upstash` + 外部凭证 | `:41`、`:45-46` |
| 外部 Redis（限流） | ✅ `redis` | `:43` |
| 关闭假登录 | ✅ `AUTH_ALLOW_DEV_LOGIN: "0"` | `:37` |
| 端口不裸暴露 | ✅ 仅 `127.0.0.1:18080` | `:29` |

**判定**：生产 compose **确实**使用强密钥与外部存储 ✅。**但**：`.env.docker.example:5-19` 提供的是**仅供本地**的弱配置（`cyber:cyber`、`AUTH_ALLOW_DEV_LOGIN=1`、`RATE_LIMIT_DRIVER=memory`），且该文件顶部注释（`:1`）已明确「仅供本地 Docker Compose」——**风险在于运维若直接复用该文件到生产**，将被 `validate-prod` 拦截 ✅（因为 `RATE_LIMIT_DRIVER=memory` 与 `CLOUD_STORE_DRIVER` 会被拒），**但 `SHARE_STORE_DRIVER=local` 不会被拦**（见 B2 的 P0）。

#### `.env.docker.example` + `scripts/validate-prod-env.mjs` 覆盖度核查

| 要求 | 是否覆盖 | 证据 |
| --- | --- | --- |
| **`AUTH_ALLOW_DEV_LOGIN` 关闭** | ✅ **已覆盖** | `scripts/validate-prod-env.mjs:57-59`：`if ((process.env.AUTH_ALLOW_DEV_LOGIN ?? "").trim() === "1") errors.push(...)`；TS 版 `src/lib/config/validate-prod.ts:69-71`（用 `isTruthyOne` `:10-12`）。**注意差异**：JS 版是 `=== "1"`，TS 版也是 `=== "1"`（经 `isTruthyOne`），两者一致 ✅ |
| **Postgres 必填** | ✅ **已覆盖** | `validate-prod-env.mjs:61-66` + `:17-22` `isFileCloudStoreForbiddenInProd()`；TS 版 `validate-prod.ts:73-78` + `:48-54`。无 `DATABASE_URL` 即报错 ✅ |
| **Redis 必填** | ✅ **已覆盖（限流）** | `validate-prod-env.mjs:24-36`：`RATE_LIMIT_DRIVER !== "redis"` 报错，且校验 URL/TOKEN ✅；TS 版 `validate-prod.ts:18-31` ✅ |
| **Redis 必填（分享存储）** | ❌ **未覆盖** | **两个校验器均未读取 `SHARE_STORE_DRIVER`**（全库 grep 证实，见 B2）→ **P0** |
| `AUTH_SECRET` 必填 | ✅ 已覆盖 | `validate-prod-env.mjs:53-55`；`validate-prod.ts:65-67` |
| `RATE_LIMIT_TRUSTED_PROXY` 显式 | ✅ 已覆盖 | `validate-prod-env.mjs:37-40`；`validate-prod.ts:33-38` |
| 二者逻辑一致性 | ✅ 一致 | 逐项对照无差异 |

**判定**：校验覆盖 **AUTH_ALLOW_DEV_LOGIN ✅ / Postgres ✅ / Redis（限流）✅**，**缺口为 `SHARE_STORE_DRIVER`（分享存储）❌ P0**。

---

### D3 反向代理配置（`deploy/`）

`deploy/` 仅 2 个文件：`deploy/nginx.example.conf`（149 行）、`deploy/Caddyfile.example`（44 行）。**无日志采集配置（无 Fluent Bit/Vector/Loki/promtail）** → 见 C1 的排障盲区。

| 领域 | 检查项 | Nginx | Caddy | 严重度 | 证据 |
| --- | --- | --- | --- | --- | --- |
| 安全头 | CSP | ✅ 与 `next.config.ts` 逐字节对齐 | ✅ | — | `nginx.example.conf:68`、`:21`、`:57-59` 注释；`Caddyfile.example:22`、`:20-21` 注释 |
| 安全头 | HSTS | ✅ `max-age=63072000; includeSubDomains; preload` | ✅ | — | `nginx.example.conf:75`；`Caddyfile.example:27` |
| 安全头 | nosniff / X-Frame-Options / Referrer-Policy / Permissions-Policy | ✅ 全部 | ✅ 全部 | — | `nginx.example.conf:70-74`；`Caddyfile.example:23-28` |
| 安全头 | **`proxy_hide_header` 防重复头** | ✅ 隐藏上游 7 个安全头，由代理独占 | N/A | — | `nginx.example.conf:60-66`（注释 `:57-59` 解释原因） |
| 真实 IP | `X-Real-IP` | ✅ `proxy_set_header X-Real-IP $remote_addr;` | ✅ `header_up X-Real-IP {remote_host}` | — | `nginx.example.conf:88`；`Caddyfile.example:11` |
| 真实 IP | `X-Forwarded-For` **覆盖而非追加** | ✅ `proxy_set_header X-Forwarded-For $remote_addr;`（注释 `:89`「Overwrite, do not append」） | ✅ `header_up X-Forwarded-For {remote_host}`（注释 `:10`） | — | 同上 |
| 真实 IP | `X-Forwarded-Proto/Host/Port` | ✅ | 由 Caddy 自动 | — | `nginx.example.conf:91-93` |
| 真实 IP | **限流只信任可信代理** | ✅ 应用侧 `getRateLimitIdentityMode()` 默认 `direct` 即不信任；生产强制显式声明 | ✅ | — | `src/lib/api/rate-limit.ts:233-262`；`validate-prod.ts:33-38` |
| 超时 | connect/send/read | ✅ `30s / 60s / 60s` | ⚠️ 未显式（Caddy 默认无读超时 = 无限，**对无超时的 LLM 调用是风险叠加**） | **P1** | `nginx.example.conf:96-98`；`Caddyfile.example:9-13`（无 timeout 配置） |
| 超时 | **与 LLM 无超时的叠加风险** | ⚠️ Nginx `proxy_read_timeout 60s`（`:98`）会在 60s 断开，但**应用侧 LLM fetch 无超时**（`client.ts:87`），上游连接泄漏 | 同上 | **P1** | 见 A4 |
| 限流 | 代理层限流 | ⚠️ **仅注释掉的样例**（`:127-139`），未启用 | ❌ 无 | **P2** | `nginx.example.conf:127-139` 全为注释 |
| 请求体 | 大小限制 | ✅ `client_max_body_size 1m`（`:107`） | ✅ `max_size 1MB`（`:32-34`） | — | 与应用 `200_000` 字符硬编码对齐（注释 `:106`） |
| 静态缓存 | `/_next/static` | ⚠️ `proxy_cache_valid 200 1y` **但未定义 `proxy_cache_path`**，故实际不缓存；靠 Next 自带 immutable 头 | ❌ 无 | **P2** | `nginx.example.conf:142-148`（注释 `:145-147` 解释依赖 Next 头） |
| 健康检查 | 独立 location + `access_log off` | ✅ | ❌ 未配 | **P2** | `nginx.example.conf:111-116` |
| TLS | 协议/套件/OCSP | ✅ Mozilla Intermediate（`ssl_protocols TLSv1.2 TLSv1.3`、OCSP stapling） | ✅ 自动 | — | `nginx.example.conf:42-53` |
| 日志 | 访问日志 | 默认 | ✅ JSON 格式 + 轮转 | — | `Caddyfile.example:37-43` |
| 日志 | **采集/导出至日志平台** | ❌ | ❌ | **P1** | 两者均无 shipper 配置；`Caddyfile.example:38` 只写本地文件 |

**判定**：安全头、真实 IP 传递、请求体限制 **✅ 良好**；**超时（尤其 Caddy 无超时 + LLM 无超时）、代理层限流未启用、日志无采集** 为主要缺口。

---

### D4 备份恢复：是否有演练记录？

| 领域 | 问题 | 严重度 | 证据 |
| --- | --- | --- | --- |
| 部署/DR | **有脚本、有文档、有清单——但无任何「已执行」的记录** | **P1** | 脚本：`scripts/backup-postgres.example.ps1`（185 行，支持 plain/custom/directory 三种格式 `:115-130`，含 `--no-owner --no-acl` `:111-112`，自动打印恢复命令 `:162-178`，`finally` 清理 `PGPASSWORD` `:182-185`）。文档：`docs/DEPLOY.md:293-374`（§4.6 备份与恢复）。**演练清单 `docs/DEPLOY.md:368-374` 的 5 个复选框全部为未勾选 `- [ ]`**；`:740` 也是未勾选的 `- [ ] 完成 Postgres 备份与恢复演练；` |
| 部署/DR | **无 RPO/RTO 目标定义** | **P1** | `docs/DEPLOY.md:353-359` 仅给「生产每日、保留 7 天日备 + 4 周周备」的策略建议表，**未定义 RPO/RTO 数值**，也未说明该 cron 是否已部署 |
| 部署/DR | **无自动化备份验证** | **P2** | 全库无备份校验/定时任务脚本（`scripts/` 下无相关文件）；`docs/DEPLOY.md:281-283` 表明确承认「应用本身无全量导出 API」（针对 upstash 分享存储） |
| 部署/DR | **⚠️ 分享快照（Upstash）不在 Postgres 备份范围内** | **P1** | `scripts/backup-postgres.example.ps1` 只备份 Postgres；而 share 存于 Upstash（`compose.production.yaml:41`）。`docs/DEPLOY.md:281-283` 建议「Upstash 控制台导出 / 商业备份」——**无脚本、无演练**。**恢复 Postgres 无法恢复分享链接** |
| 部署/DR | **回滚文档存在 ✅** | — | `docs/DEPLOY.md:378-394`（应用版本回滚，Vercel + 自托管）；`:466` 要求回滚前先备份 |

**结论**：备份能力**已具备**（脚本 + 文档 + 恢复命令），但**演练记录为零**——`docs/DEPLOY.md:368-374` 的清单是空模板，且 `docs/EXECUTION_GUIDE.md:95`、`docs/TASKS.md:1978`、`docs/REMEDIATION_TASKS.md:242` 均将其列为**待完成项**。此外 **Upstash 分享数据完全在备份覆盖之外**（P1）。

**判定**：**部分修复**——工具与文档就绪，**演练未执行、无记录**（P1）。

---

## E. PROJECT_REVIEW §2.6 原始缺陷逐条判定

| # | PROJECT_REVIEW 原始缺陷（`docs/PROJECT_REVIEW.md` 行号） | 判定 | 证据 |
| --- | --- | --- | --- |
| 1 | 「根布局读取会话，使首页和公开分享页等全部成为动态渲染页面。」（`:64`） | **仍存在** | `src/app/layout.tsx:26`；`src/lib/auth/get-session.ts:15`；**构建产物 `.next/prerender-manifest.json` 仅含 `_global-error`/`favicon.ico`，`/`、`/privacy`、`/share/[token]` 均未预渲染** |
| 2 | 「三个新建向导在客户端直接加载完整计算引擎，初始 JS 仍有优化空间。」（`:65`） | **仍存在** | `src/components/form/BirthWizard.tsx:1,6,7,8`；`src/components/ziwei/ZiweiWizard.tsx:1,7,8`；`src/components/liuyao/CastForm.tsx:1,10,11` |
| 3 | 「API、账号、Postgres/Redis 和主要页面缺少集成/E2E 测试。」（`:66`） | **部分修复，无法完全确认** | **已修复部分**：单测大量存在（`src/lib/storage/storage.test.ts`、`migrate.test.ts`、`migrate-server.test.ts`、`src/lib/share/share-store.test.ts`、`src/lib/health/readiness.test.ts`、`src/lib/api/*.test.ts` 等），`e2e/` 目录存在，`playwright.config.ts` 与 `vitest.config.ts` 齐备，`compose.acceptance.yaml` 提供验收环境。**仍需运行时验证**：`e2e/` 覆盖了哪些路径、Postgres/Redis 集成测试是否在 CI 实际运行（需读 `.github/` workflow 与执行 `npx playwright test`/`npm test`） |
| 4 | 「缺少 CSP、安全响应头、`server-only` 边界和生产配置启动校验。」（`:67`） | **已修复** | CSP/安全头：`next.config.ts:10-71`；`server-only`：`src/lib/storage/pg-bazi-store.ts:5`、`src/lib/db/client.ts:7`（`import "server-only"`）；生产校验：`src/lib/config/validate-prod.ts:60-86` + `src/instrumentation.ts:5-9`（启动时 fail-fast）+ `scripts/validate-prod-env.mjs:43-79`（部署前）。**残留缺口**：`SHARE_STORE_DRIVER` 未纳入校验（见 B2 P0），`server-only` 覆盖不完整（`src/lib/storage/` 下多个 pg-* 与 cloud-store 需逐一确认，**需运行时验证**） |

---

## F. 问题汇总（按严重度）

### P0（3 项，上线前必须修复）

| # | 领域 | 问题 | 证据 |
| --- | --- | --- | --- |
| P0-1 | 可靠性/数据 | **生产未强制禁止 `SHARE_STORE_DRIVER=local`**：默认落本地文件，多实例/无持久盘下分享链接随机 404、并发写互相覆盖；两个 env 校验器均不读该变量 | `src/lib/share/index.ts:20-27,49-51`；`src/lib/share/local-file.ts:26-45`；`src/lib/config/validate-prod.ts:1-87`（零命中）；`scripts/validate-prod-env.mjs:1-81`（零命中） |
| P0-2 | 可靠性 | **LLM `fetch` 无超时/无 `AbortSignal`**，上游挂起即永久占用；全库无 `AbortController` | `src/lib/reading/llm/client.ts:87-99`；grep `AbortSignal.timeout\|signal:\|AbortController` → 0 匹配 |
| P0-3 | 可观测性 | **无任何错误上报与业务指标**，生产排障与产品度量双盲 | grep `Sentry\|web-vitals\|metrics\|analytics` → 0 匹配；`src/instrumentation.ts:1-10` 仅做配置校验 |

### P1（14 项）

| # | 领域 | 问题 | 证据 |
| --- | --- | --- | --- |
| P1-1 | 性能/渲染 | 根布局 `await getServerSession()` 使全部页面 dynamic，公开页无法静态化 | `src/app/layout.tsx:26`；`.next/prerender-manifest.json` |
| P1-2 | 性能/首屏 | 三向导静态引入完整计算引擎 | `BirthWizard.tsx:6-8`；`ZiweiWizard.tsx:7-8`；`CastForm.tsx:10-11` |
| P1-3 | 性能/DB | pull 侧 N+1（三个循环内逐条 await 详情） | `sync.ts:288-299,403-415,488-499` |
| P1-4 | 性能/DB | migrate 服务端循环内逐条 upsert，无事务 | `api/charts/migrate/route.ts:127-174`（`:139`） |
| P1-5 | 性能/DB | 批量同步实为逐条串行，无批量接口/并发/重试 | `sync.ts:233-259,355-376,452-464` |
| P1-6 | 性能/缓存 | 几乎无缓存；分享页同请求读两次；模板报告首屏即算 | grep `revalidate` 仅 1 命中（OG 图）；`share/[token]/page.tsx:13,54`；`ziwei/[id]/reading/page.tsx:88-98` |
| P1-7 | 可靠性/LLM | 无重试/退避；非流式（感知延迟 = 总生成时间）；无并发上限 | `client.ts:103-119,93-98,121`；无 semaphore |
| P1-8 | 可靠性 | `/api/reading/status` 非任务模型，解读为同步阻塞、无任务 ID | `api/reading/status/route.ts:8-13`；`api/reading/route.ts:94` |
| P1-9 | 可靠性 | readiness 依赖驱动推断，可能「假就绪」（恒 true） | `readiness.ts:22-33,73,80-87` |
| P1-10 | 可靠性 | readiness 全有全无，Redis 挂即整体下线，无降级分级 | `readiness.ts:87` |
| P1-11 | 可靠性 | 静默吞错：紫微同步空 catch、cloud-store persist 三处空 catch | `ZiweiWizard.tsx:196-200`；`cloud-store.ts:204,217,240` |
| P1-12 | 可靠性/并发 | 无乐观锁/版本号，多设备并发上传 LWW 静默丢更新 | `pg-bazi-store.ts:113-119`；`schema.ts:128-138`（无 version 列） |
| P1-13 | 可靠性/并发 | 合并仲裁依赖客户端 `updatedAt`，时钟可篡改 | `migrate.ts:150-154,137-148,377-390` |
| P1-14 | 部署/DR | 备份恢复无演练记录（清单全空）；Upstash 分享数据不在备份范围；无 RPO/RTO | `DEPLOY.md:368-374`（全 `- [ ]`）、`:740`、`:281-283` |

### P2（12 项）

| # | 领域 | 问题 | 证据 |
| --- | --- | --- | --- |
| P2-1 | DB | 缺 `(user_id, updated_at)` 复合索引 | `pg-bazi-store.ts:51-53`；`schema.ts:138` |
| P2-2 | DB | upsert 前置 SELECT（可省） | `pg-bazi-store.ts:84,100-120` |
| P2-3 | DB | migrate 容错分支隐藏 N+1 | `migrate/route.ts:162-164` |
| P2-4 | 可观测性 | requestId 仅覆盖 API 路由，页面/SSR 无 | `request-id.ts:6-16`；`api/reading/route.ts:20` |
| P2-5 | 可观测性 | 健康检查只有布尔，无细粒度指标、无 `/metrics` | `health/ready/route.ts:10-15` |
| P2-6 | 部署 | 容器 healthcheck 打 liveness 而非 readiness | `Dockerfile:37-38`；`compose.yaml:48`；`compose.production.yaml:62` |
| P2-7 | 部署 | 构建期未跑 prod env 校验 | `Dockerfile:13` |
| P2-8 | 部署 | 代理层限流仅注释样例，未启用 | `nginx.example.conf:127-139` |
| P2-9 | 部署 | Nginx `proxy_cache_path` 未定义，静态缓存实际不生效 | `nginx.example.conf:142-148` |
| P2-10 | 部署 | Caddy 未配超时 | `Caddyfile.example:9-13` |
| P2-11 | 部署 | 无日志采集/导出配置（shipper） | `deploy/` 仅 2 文件；`Caddyfile.example:37-43` 仅本地文件 |
| P2-12 | 可靠性 | `direct` 限流模式键退化为常量 `"anon"`，全站共享桶；且校验不要求生产为 `1` | `rate-limit.ts:250`；`validate-prod.ts:33-38` |

---

## G. 上线前必须验证清单（可执行命令级）

> 约定：所有命令在仓库根 `E:\ai_project\cyber-divination` 执行；标注「需授权」的项会修改环境或启动服务，请在获准后进行。

### G0 前置：只读基线（本报告已完成，可复现）

```powershell
# 复现 A2 的渲染模式结论
Get-Content .next\prerender-manifest.json -Raw | ConvertFrom-Json |
  Select-Object -ExpandProperty routes | Select-Object -ExpandProperty PSObject |
  ForEach-Object { $_.Properties.Name }
# 期望（修复前）：仅 /_global-error、/favicon.ico
# 期望（修复后）：应出现 /、/privacy

# 确认三向导仍在客户端引入引擎
Select-String -Path src\components\form\BirthWizard.tsx,src\components\ziwei\ZiweiWizard.tsx,src\components\liuyao\CastForm.tsx -Pattern '^"use client"|from "@/lib/(bazi|ziwei|liuyao)'

# 确认全库无超时/错误上报/缓存
Select-String -Path src\**\*.ts,src\**\*.tsx -Pattern 'AbortSignal|AbortController' | Measure-Object
Select-String -Path src\**\*.ts,src\**\*.tsx -Pattern 'Sentry|web-vitals|unstable_cache' | Measure-Object
```

### G1 P0 阻断项验证（任一失败即禁止上线）

```powershell
# P0-1 分享存储必须是 upstash（当前会失败 —— 这就是缺陷）
# 修复后：向 validate-prod.ts / validate-prod-env.mjs 增加 SHARE_STORE_DRIVER 校验
$env:NODE_ENV="production"
$env:SHARE_STORE_DRIVER="local"
node scripts\validate-prod-env.mjs
# 期望（修复后）：exit 1 并提示禁止 local

# 生产配置整体校验（模拟生产环境）
$env:SHARE_STORE_DRIVER="upstash"
$env:UPSTASH_REDIS_REST_URL="https://example.upstash.io"
$env:UPSTASH_REDIS_REST_TOKEN="dummy"
$env:AUTH_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
$env:AUTH_ALLOW_DEV_LOGIN="0"
$env:DATABASE_URL="postgres://user:pass@host:5432/db"
$env:CLOUD_STORE_DRIVER="postgres"
$env:RATE_LIMIT_DRIVER="redis"
$env:RATE_LIMIT_TRUSTED_PROXY="1"
node scripts\validate-prod-env.mjs
# 期望：exit 0，"生产配置校验通过"

# P0-2 LLM 超时：修复后应能 grep 到超时控制
Select-String -Path src\lib\reading\llm\client.ts -Pattern 'AbortSignal|timeout|signal:'
# 期望（修复后）：≥1 命中

# P0-3 错误上报：修复后应能 grep 到
Select-String -Path src\instrumentation.ts -Pattern 'onRequestError|Sentry'
# 期望（修复后）：≥1 命中
```

### G2 构建与渲染模式验证

```powershell
# 全量构建（需授权：会在 .next 写入）
npm run build

# 验证静态化（A2 修复验收）
Get-Content .next\prerender-manifest.json -Raw | ConvertFrom-Json |
  Select-Object -ExpandProperty routes | Select-Object -ExpandProperty PSObject |
  ForEach-Object { $_.Properties.Name } | Select-String -Pattern '^/$|^/privacy$'
# 期望（修复后）：两条均命中

# 验证首屏 JS 体积（A1 修复验收）
# 记录 /chart/new、/ziwei/new、/liuyao/new 的 First Load JS，
# 与修复前对比，确认引擎模块已移出或按需加载
Get-ChildItem .next\static\chunks -Filter *.js |
  Sort-Object Length -Descending | Select-Object -First 10 Name,
  @{n='KB';e={[math]::Round($_.Length/1KB,1)}}
```

### G3 数据库与索引验证（需授权：需可连的 Postgres）

```powershell
# 迁移幂等（连续执行两次均须成功）
$env:DATABASE_URL="postgres://cyber:cyber@localhost:5432/cyber_divination"
npm run db:migrate
npm run db:migrate

# 表与索引清单
psql $env:DATABASE_URL -c "\dt"
psql $env:DATABASE_URL -c "\di"
# 期望：6 张表 + magic_links_email_idx / people_user_id_idx /
#       bazi_charts_user_id_idx / ziwei_charts_user_id_idx / liuyao_charts_user_id_idx

# P2-1 复合索引（修复后应存在）
psql $env:DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE tablename='bazi_charts';"

# 高频查询走索引验证（应出现 Index Scan，而非 Seq Scan）
psql $env:DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM bazi_charts WHERE user_id='u1' ORDER BY updated_at DESC;"

# 并发写冲突验证（P1-12 乐观锁修复验收）
# 两个并发 upsert 同一 id，修复后其一应返回 409 / 受影响行数 0
```

### G4 可靠性验证（需授权：启动服务）

```powershell
# readiness 真实依赖探测
npm run start   # 或按 compose 启动
Invoke-WebRequest http://127.0.0.1:3000/api/health        | Select-Object StatusCode
Invoke-WebRequest http://127.0.0.1:3000/api/health/ready  | Select-Object StatusCode, Content
# 期望：200/200，checks.db.ok=true，checks.redis.ok=true
# 然后停掉 Redis，再请求 ready
# 期望：503（并且修复后应体现为 degraded 而非整体不可用 —— 见 P1-10）

# 降级 fail-fast 验证（应启动失败，而非静默回落）
$env:RATE_LIMIT_DRIVER="redis"; Remove-Item Env:\UPSTASH_REDIS_REST_URL -ErrorAction SilentlyContinue
node -e "require('child_process')" # 见下方 vitest 用例更可靠
npx vitest run src/lib/api/rate-limit.test.ts src/lib/share/share-store.test.ts src/lib/storage/mode.test.ts
# 期望：全绿（含「禁止静默回落」断言）

# 全量单测
npm test
```

### G5 限流与代理信任验证（需授权：需起服务 + 代理）

```powershell
# 可信代理模式：伪造 X-Forwarded-For 应生效（RATE_LIMIT_TRUSTED_PROXY=1）
$env:RATE_LIMIT_TRUSTED_PROXY="1"
# 连打 16 次 /api/reading，期望第 16 次 429，且响应头含 X-RateLimit-*
1..16 | ForEach-Object {
  (Invoke-WebRequest -Method POST http://127.0.0.1:3000/api/reading `
    -Headers @{ "x-forwarded-for"="203.0.113.$_" } `
    -Body '{}' -ContentType 'application/json' -SkipHttpErrorCheck).StatusCode
}
# 期望：不同 IP 各自独立计数（不全 429）

# direct 模式（P2-12）：所有请求共享 "anon" 桶
$env:RATE_LIMIT_TRUSTED_PROXY="0"
# 期望（修复后）：不应退化为全站单桶；当前实现会误伤全站
```

### G6 LLM 行为验证（需授权：需真实/桩 LLM 上游）

```powershell
# 超时验证（P0-2 修复验收）：指向一个永不响应的地址
$env:LLM_BASE_URL="http://127.0.0.1:9"   # 黑洞端口
$env:LLM_API_KEY="dummy"
# 调用 /api/reading，修复后应在配置的超时内返回错误，而非无限挂起
Measure-Command {
  Invoke-WebRequest -Method POST http://127.0.0.1:3000/api/reading `
    -Body '{"profile":{...},"chart":{...}}' -ContentType 'application/json' -SkipHttpErrorCheck
}
# 期望（修复后）：< 超时阈值（如 60s）+ 少量余量；当前实现会挂起至代理超时

# 流式验证（P1-7 修复验收）：响应应为 text/event-stream
Invoke-WebRequest -Method POST http://127.0.0.1:3000/api/reading -SkipHttpErrorCheck |
  Select-Object -ExpandProperty Headers | Select-String 'Content-Type'
```

### G7 部署与容器验证

```powershell
# 镜像构建
docker build -t cyber-divination:verify .

# 非 root 验证（应输出 nextjs 或 1001）
docker run --rm cyber-divination:verify id

# standalone 验证（应无 devDependencies 痕迹、server.js 存在）
docker run --rm cyber-divination:verify ls -la /app/server.js /app/.next

# healthcheck 验证（P2-6：修复后应打 /api/health/ready）
docker inspect --format '{{json .Config.Healthcheck}}' cyber-divination:verify

# compose 配置解析（不启动）
docker compose -f compose.production.yaml config
# 期望：AUTH_SECRET/DATABASE_URL/UPSTASH_* 在未注入时为「空」，
#       配合 validate-prod 应导致启动失败（这才是正确行为）
```

### G8 备份与恢复演练（P1-14 验收 —— 必须留下记录）

```powershell
# 1. 备份
$env:PGHOST="localhost"; $env:PGPORT="5432"; $env:PGUSER="cyber"
$env:PGPASSWORD="cyber"; $env:PGDATABASE="cyber_divination"
.\scripts\backup-postgres.example.ps1 -Format custom -BackupDir ".\backups"
# 期望：退出 0，打印耗时与文件大小

# 2. 校验产物
Get-ChildItem .\backups\*.dump | Select-Object Name, Length
# 期望：Length > 0

# 3. 恢复到临时库（不得覆盖生产库）
$env:PGDATABASE="cyber_divination_restore_test"
# 修复后应先建库：psql -c "CREATE DATABASE cyber_divination_restore_test;"
pg_restore -h $env:PGHOST -p $env:PGPORT -U $env:PGUSER -d $env:PGDATABASE -c --if-exists ".\backups\cyber_divination_<ts>.dump"

# 4. 应用连临时库，readiness 必须 200（DEPLOY.md:372）
# 5. 登录后能读取八字/紫微/六爻历史档案（DEPLOY.md:373）
# 6. 迁移幂等（DEPLOY.md:374）
npm run db:migrate

# 7. ✅ 将本次演练结果（日期/执行人/结论）登记到 docs/DEPLOY.md §4.6.4，
#    把 - [ ] 改为 - [x] 并附证据 —— 当前该清单全为空（P1-14）
```

### G9 可观测性验收（P0-3 修复后）

```powershell
# 结构化日志 + requestId 贯通
Invoke-WebRequest http://127.0.0.1:3000/api/health -Headers @{ "x-request-id"="trace-abc-123" }
# 期望：响应头回显 x-request-id: trace-abc-123（src/lib/api/request-id.ts:14-16）
# 且服务端 stdout 出现 {"ts":...,"level":"info","requestId":"trace-abc-123",...}

# 敏感信息不得出现（logger.ts:27-66 脱敏）
# 触发一次 LLM 调用后，grep 日志中不得出现 sk- 开头的 key 或完整 prompt

# 修复后应存在指标端点
Invoke-WebRequest http://127.0.0.1:3000/metrics -SkipHttpErrorCheck | Select-Object StatusCode
# 期望（修复后）：200，含 reading_success_total / reading_fallback_total / llm_duration_seconds
```

### G10 代理配置验证（需授权：需 nginx/caddy）

```powershell
# 安全头最终态（应与 next.config.ts:10-71 一致，且不重复）
curl -sI https://<host>/ | Select-String 'content-security-policy|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy|permissions-policy'

# 真实 IP 覆盖而非追加（nginx.example.conf:90 / Caddyfile.example:12）
curl -s -H 'X-Forwarded-For: 1.2.3.4' https://<host>/api/health -v
# 期望：应用看到的 IP 为真实对端，而非 1.2.3.4

# 300 重定向不携带 HSTS（next.config.ts:58-68 / nginx.example.conf:21）
curl -sI http://<host>/ | Select-String 'strict-transport-security'
# 期望：无该头
```

---

## H. 关键澄清与限制

1. **源码体量 ≠ 压缩后体积**：§A1 表格统计的是**源码文本 bytes/行数**（用于相对排序），**gzip 后的实际 bundle 增量需运行时验证**（`npm run build` 后读 route 级清单）。本次为只读审查，未执行构建。
2. **`.next/` 为既有产物**：§A2 的 prerender 取证基于**工作区现有的 `.next/`**。若该目录来自更早的构建，结论需以重新 `npm run build` 为准——但**根布局 `await getServerSession()`（`layout.tsx:26`）的代码事实独立成立**，该缺陷与构建时间无关。建议按 §G2 重新构建复核。
3. **`/api/reading/status` 不是任务状态接口**：它是 LLM 配置探针（`api/reading/status/route.ts:8-13`），易被名字误导。结论：**当前无任务模型**。
4. **分享数据不在 Postgres**：存于 Upstash 或本地 JSON（`src/lib/share/index.ts:20-27`），故「按 token 建索引」是伪需求；但带来**备份覆盖缺口**（P1-14）。
5. **`import "server-only"` 覆盖度未逐一穷举**：已确认 `pg-bazi-store.ts:5`、`db/client.ts:7`；其余 `storage/` 与 `share/` 模块**需运行时验证**（构建时应报错而非静默打包）。
6. **`e2e/` 实际覆盖范围未核查**：`e2e/` 目录与 `playwright.config.ts` 存在，但未逐文件审阅、未在 CI 验证（PROJECT_REVIEW §2.6 第三条判为「部分修复，无法确认」）。若需精确判定，建议增加一轮针对 `e2e/**` 与 `.github/workflows/**` 的专项审查。
7. **本报告未修改任何文件**，仅新增本文档 `docs/REVIEW_ENG_OPS.md`。

---

*报告结束。所有结论均附 `文件:行号` 证据；不确定项已显式标注「需运行时验证」。*
