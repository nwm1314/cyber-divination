# 第三轮修复报告（FIX_REPORT_ROUND3）· B 档收口 + 交接未验证项

> 起点：`d7aa93e`（第二轮报告产出提交），工作树干净
> 终点：见 §3 commit 清单；**14 个 commit**，68 文件变更（+2529 / −211）
> 交接依据：`docs/GAP_AUDIT_AND_HANDOFF.md` §2.2 B 档 + 本轮任务书
> 阅读顺序建议：§0 结论 → §2.3/§2.4（本轮新发现与对提示词的更正）→ §2.5（未验证）

---

## 0. 一句话结论

B 档 **16 项全部有终态**：10 项落地并带测试，6 项以实测取证判定「不做」。
过程中发现并修复 **2 个交接文档未列出的真实故障**，并**更正提示词/前序报告的 5 处前提错误**——
其中一处是上一轮自己引入的回归（守护测试自身污染 Tailwind 提取器，导致 dev/e2e 整站样式再次全灭）。

| 分类 | 项 |
|---|---|
| 落地（10） | B16 server-only、B1 请求体单一路径、B2 请求期 DDL 强制、B6 readiness degraded、B7 直连限流身份、B12 EmptyState、B14 离开确认、B15 紫微复用人物档案、B5 拉取扇出并发、B4 乐观锁 |
| 实测取证后判定不做（4） | B3（不可消除，改为固化双向不变量）、B8（不合并，补差异测试）、B9、B10、B11、B13 |
| 新发现并已修（2） | 守护测试污染 Tailwind；CI standalone 服务在生产模式下无法启动 |
| 新发现但**未修**（5） | 见 §2.6，交下一轮决策 |

---

## 1. 量化对比总表（改动前 → 改动后）

| 指标 | 改动前 | 改动后 | 依据 |
|---|---|---|---|
| auth 目录 server-only 覆盖 | 4 / 9 文件 | **8 / 9**（`types.ts` 刻意保持同构） | `server-only-boundary.test.ts` 9 例 |
| 请求体上限实现路径 | 2 套（`parseJsonBody` + share 手工 `checkBodySize`） | **1 套**（`checkBodySize` 已删除） | grep 0 命中 |
| share 请求体计量口径 | UTF-16 字符数（CJK 实际约 3× 字节）+ 先整体缓冲 | **UTF-8 字节** + Content-Length 预检 | `misc-routes.test.ts` CJK 例 |
| 生产请求期建表 DDL | 允许（校验器不读开关） | **fail-fast 必填** `DB_SKIP_ENSURE_SCHEMA=1` | 双校验器 + CI 双向断言，实测 exit 1/0 |
| readiness 降级可见性 | 只有 `skipped`，`ready` 恒 true | 新增 `degraded` + `degradedChecks`（严格增量字段） | readiness 5 例、route 断言 |
| 直连模式限流桶 | 全站共享 1 个常量桶 | **登录用户各 1 桶** + 匿名共享桶 | rate-limit 22 例（+4） |
| 云端拉取详情请求 | 1 列表 + N 详情**串行**（≈N×RTT） | 并发 ≤6，落盘仍按列表顺序 | `sync.test.ts` +3 例（含并发度与顺序断言） |
| 可反复改写表的并发写 | 无条件覆盖，双方都收 200 | `version` 列 + 409 冲突，不覆盖已存数据 | `version-conflict.test.ts` 9 例 + version-guard 9 例 |
| 列表空态实现 | 5 处手写 Card + 段落 | **1 个 EmptyState**，文案/间距实测逐字一致 | 浏览器实测 5 处（§2.1.8） |
| 八字向导脏数据离开 | 无提示 | `beforeunload` 守卫，仅脏时注册、提交后解除 | 浏览器实测 prevented=false→true |
| 紫微新建复用人物档案 | 无（须整表重填） | 档案下拉带入 + `linkZiweiId` 回链 | 浏览器全链路实测 + 10 例单测 |
| 三术 LLM 管线合并判定 | 无行为差异测试 | **9 例差异测试**，判定不合并并给出依据 | `llm-pipelines-divergence.test.ts` |
| CSP unsafe-inline | 「改注释了事」级别的说明 + 一处错误归因 | **实测证据 + 双向不变量门禁** | `npm run check:csp`、`csp-inline-necessity.test.ts` |
| 守护测试自身安全性 | 自我豁免 + 内含危险字面量 | 取消豁免，危险样本运行时拼装 | 实测 dev CSS 从报错→干净 |
| CI e2e standalone 启动 | **起不来**（24 例不可能通过） | 起来（`/api/health` 200 实测） | 见 §2.3.2 |
| 测试规模 | 93 文件 / 833 通过 + 1 skipped | **100 文件 / 900 通过 + 1 skipped**（见 §4 实测） | `npm run check` |
| `npm run check` 门禁项 | 4 项 | **5 项**（新增 `check:csp`） | package.json |

---

## 2. 逐项说明

### 2.1 落地项（10）

1. **B16 · auth server-only 边界**（`4013ea9`）
   补 `pg-users.ts`（SQL + Node crypto）、`get-session.ts`（`next/headers`）、`index.ts`（桶文件转出服务端模块）、
   `constants.ts`。`constants.ts` 是**对提示词前提的修正**：任务书称其为「纯常量不应加」，
   实测它导出 `DEV_AUTH_SECRET_FALLBACK`（`session.ts:52` 实际用作签名密钥）→ 必须加。
   `types.ts` 保持不加（纯契约，且 `src/app/api/*` 与客户端都可能引）。
   新增 `server-only-boundary.test.ts` 把约定钉成断言（含「types.ts 必须不加」的反向断言）。

2. **B1 · share 请求体单一路径**（`cae4cb0`）
   删除 `checkBodySize`（`validate.ts:22`）与其桶导出；share 改走 `parseJsonBody` + 新增
   `shareRequestBodySchema`（只约束外壳，chart/report 仍由既有 `validate*ChartPayload` 按 kind 逐字段核验）。
   413/400 文案与状态码保持一致（`请求体过大（>200000 字节）`、`JSON 解析失败` 逐字相同）。
   两处**行为变化**（均为修正方向，已实测）：上限口径由字符改为 UTF-8 字节（与 `/api/charts` 等写路由一致，
   后者一直带 report 全量在同一字节上限下工作，故不构成新的截断风险）；空 body 的 400 文案由
   `JSON 解析失败` 变为更准确的 `缺少有效报告数据`。

3. **B2 · 生产强制跳过请求期 DDL**（`51f06ed`）
   `ensuresSchemaOnRequestPath()` 加入 `validate-prod.ts` 与 `validate-prod-env.mjs`（两份保持一致），
   CI 补双向断言（合规放行 / 缺开关拒绝）。实测：缺 `DB_SKIP_ENSURE_SCHEMA` 时 `exit 1`，
   设为 `1` 后 `exit 0`。文档措辞由「建议」改为「生产必填」（DEPLOY.md / QA.md / .env.example / Dockerfile / client.ts / migrate.sql）。
   对上一轮守护测试只做了**夹具扩充**（`v1-adversarial.test.ts` 的 `snapshotProd` 增加该变量），
   「强密钥必须放行」的断言未弱化。

4. **B6 · readiness 暴露降级**（`fd6f5d5`）
   选择「显式标 degraded」而非「只写文档」：降级实例仍在正常服务，用非 200 摘流量是错的；
   但 `ready: true` 也不能被读成「依赖健康」。`status`/HTTP 语义不变（严格增量字段）。

5. **B7 · 直连限流身份**（`940cfd2`）
   提示词给的 (a)/(b) 之间选了 (b) 的可落地子集：用**服务端自己签发的会话 Cookie**（HMAC 验签）
   作桶身份，取 `sha256(userId)` 前 16 位（内部 id 不进 Redis 键与日志）；伪造/篡改 → 回落 `anon`。
   仍不读 `x-forwarded-for`（直连下它由调用方自设，信任即等于限流失效）。
   同时更正 `DEPLOY.md:82` 的失实描述（原文写「直连时使用直连地址」，实现从未取得对端 IP），
   并写明残留代价：匿名流量仍共用一个桶。附带修掉 `rate-limit.test.ts` identity 块的 env 泄漏（顺序敏感偶发失败）。

6. **B5 · 拉取扇出并发**（`48b9149`）
   先读代码确证：真正在循环内的是三个 pull（`sync.ts:288/403/488`，1 列表 + N 详情**串行**）；
   push 侧（`:233/:355/:452`）每条一次 POST，无 bulk 端点不可合并。
   改动后**请求条数不变**（真正的批量化需要 bulk 端点，代价是单次响应体积随档案数线性增长，需产品定档案规模上限），
   墙钟由 ≈N×RTT 降到 ≈⌈N/6⌉×RTT；落盘在并发之后按列表顺序执行，避免完成顺序改变本机列表次序。

7. **B4 · 乐观锁**（`6bfe7c9`）
   `people` / `bazi_charts` 加 `version INTEGER NOT NULL DEFAULT 0`；
   **旧库兼容**：`SCHEMA_SQL` 与 `migrate.sql` 都追加幂等
   `ALTER TABLE … ADD COLUMN IF NOT EXISTS version …`（`CREATE TABLE IF NOT EXISTS` 不会给已存在的表加列，
   这一点是本轮补上的真实缺口），已有行按 0，无回填脚本。
   判定逻辑放在 `storage/version-guard.ts`，**两种驱动共用同一结论**；PG 侧把比较与覆盖收进同一条
   `INSERT … ON CONFLICT … WHERE version = expected` 语句（不依赖先读后写时序）。
   写接口接受可选 `expectedVersion`：落后 → 409 `STORAGE_VERSION_CONFLICT` 且**不覆盖已存数据**；
   不带该字段 → 维持旧的后写覆盖（兼容旧客户端），版本仍自增。
   客户端传入的 `version` 字段一律不采信（有测试）。
   范围克制：没有给 `users` / `ziwei_charts` / `liuyao_charts` 加「无人读写的死列」，
   并写了守护测试防止这类越界（`schema.test.ts`）。

8. **B12 · EmptyState**（`4bbfb2e`）
   `components/ui/EmptyState.tsx` 仍渲染同一个 `Card`；正文下边距按「有无 CTA」区分。
   浏览器实测 5 处：文案逐字一致，`hint` 的 `margin-bottom` 有 CTA 为 16px、无 CTA 为 0px（与改前一致）。

9. **B14 · 向导离开确认**（`df83d14`）
   `unsaved-changes.ts`：`isDraftChanged` 按字段值与挂载初值比较（改回原值不算脏），
   `useUnsavedChangesGuard(active)` 只在 active 时注册、卸载/提交即清理。
   浏览器实测：进页面未输入时派发 `beforeunload` → `defaultPrevented: false`；输入姓名后 → `true`。
   已知局限（写进代码注释）：`beforeunload` 不覆盖应用内 `Link`/`router.push`，Next 16 无公开导航拦截 API。

10. **B15 · 紫微新建复用人物档案**（`0166f2b`）
    **提示词前提修正**：不存在可照抄的「八字向导既有做法」——`BirthWizard.tsx` 也不复用人物档案，
    且任务书写的 `listPeople` / `getPerson` 里 `listPeople` 这个名字在仓库中不存在（实际是 `listPersons` / `listPersonEntries`）。
    实现：step 0 增「从人物档案带入」下拉（仅有档案时渲染，**不新增步骤**，避免破坏 e2e 的五步流程），
    带入姓名/性别/阳历或农历生日/闰月/时辰/时辰未知/省市/经度；排盘后 `chart.personId` 落库并 `linkZiweiId` 回链。
    纯映射层 `person-prefill.ts` 带 10 例测试，含关键不变量：**带不带 `personId`，盘面十二宫/主星与 `inputFingerprint` 完全一致**（归属不改变计算事实）。
    新增文案入 `content/zh.ts`（`PERSON_PREFILL`）。
    浏览器全链路实测：建档案 → 选择带入 → 走完五步 → `person.ziweiIds = [zw-…]`、`chart.personId` 正确。
    工程细节：effect 内取数用 `setTimeout` 而非仓库惯用的 `requestAnimationFrame`——后台标签页不产帧，rAF 永不触发会让下拉永不出现（本轮实测踩过，故 `DEPLOY`/注释均记录）。

### 2.2 判定不做项（取证）

| 项 | 判定 | 实测依据 |
|---|---|---|
| **B3 CSP** | **不可消除，改为固化不变量**（详见 §2.1 与 `docs/DEPLOY.md` 安全头一节） | 临时去掉 `script-src 'unsafe-inline'` 并以生产 standalone 实测：首页 9 条 `Refused to execute inline script`，浏览器建议的 sha256 **每条不同**（内联脚本是 Next 按响应写的 RSC flight payload）→ 构建期哈希/SRI 不可行；nonce 与 PPR 互斥（Next 16 文档原文），改用 nonce 需全站转动态，会推翻 P0-04 并使 `check:prerender`（阈值 15）失败。`style-src` 的原因是另一类：仅 `WuxingBars.tsx`、`PalaceGrid.tsx` 按数据生成的内联 `style`。新增 `scripts/check-csp-inline.mjs`（接入 `npm run check` 与 CI）：实测 26 份产物 HTML 全部含内联脚本（共 29 个），并做成**双向不变量**——若产物不再内联脚本而策略仍留 unsafe-inline，门禁即要求收紧 |
| **B8 三术管线** | 不合并；本轮只补差异测试（按 C 档规程） | 9 例断言钉住 5 处不可互换行为：章节集合 8/8/7（仅 `advice` 共有）、报告结构字段（`calibratePrompts` / `question` / `kind`）、事实注入方式、**免责声明归属**（紫微/六爻有 disclaimer 章并被服务端文案强制覆盖，八字章节集合里没有该章）、服务端改写程度（八字会在 advice 追加证据注记，紫微原样采用）。可复用的公共层确认是 `client` + `parse` 两层，而非管线层 |
| **B9 深层导入** | 不做 | 深层导入是**规避桶文件**的手段，不是缺陷：`@/lib/api` 桶转出 `validate.ts`，而后者 `import { computeAuthoritativeChart } from "@/lib/bazi"`——为了拿一个 `rateLimit` 而走桶，会把八字引擎拉进依赖图（正是上一轮 bundle 问题的方向）。实测高频深层导入：`@/lib/types/liuyao` 40、`@/lib/types/ziwei` 39、`@/lib/api/rate-limit` 23、`@/lib/auth/session` 22；且「25 处」的口径依赖把 `@/lib/types/*` 算作桶，本身不稳定 |
| **B10 `castingSchool`** | 不做（改名风险 > 收益） | 该字段已写入存量盘与分享快照；用户可见层**已经一致**：`src/app/liuyao/[id]/reading/page.tsx:250` 用 `school={report.school ?? chart.meta?.castingSchool}` 喂 TrustPanel，`ChartResult.tsx:43` 经 `SCHOOL_LABEL` 出中文标签。改名需要永久双写兼容，收益仅是内部命名一致，且会牵动存储与快照兼容 |
| **B11 手写 button** | 不做（前提已失效） | 实测 `<button>` **19** 处 vs `<Button>` **94** 处（任务书写的 113:113 是旧状态）。逐一看过 19 处：`CastForm.tsx:214`（`role="radio"` 方法选择）、`:284/:296`（爻线/老阴老阳切换）、`ViewToggle`、`DateTimeFields`、向导步进按钮等，全是分段/图形控件；主 CTA（`BirthWizard.tsx:678-692` 的上一步/下一步/提交）已用 `<Button>` 且带 `disabled`/`aria-label`。把它们换成 `<Button>` 会破坏 radiogroup 语义 |
| **B13 硬编码中文** | 只做增量，不批量迁移 | 本轮新增的用户可见 UI 文案已入 `content/zh.ts`（`PERSON_PREFILL` 三条）；其余沿用既有边界：组件标签文案（`ARCHIVES`/`HOME`/`A11Y` 之外）与 API 校验消息就近放置。批量迁移 102 处需先按页分批并逐页视觉核对，属独立一轮；若要做的分批计划见 §5 |

### 2.3 本轮新发现的真实故障（已修）

1. **上一轮的守护测试自身是污染源**（`35aabe5`）
   `src/lib/__verify__/tailwind-extractor-safety.test.ts` 在 JSDoc 里原样写了「前缀 + 方括号 + 通配符」示例，
   同时对**本文件自我豁免**——而 Tailwind 提取器不会豁免。结果：dev server PostCSS 报 `Unexpected token`，
   `npx playwright test` **24 例全灭**（本轮实测复现）。上一轮报告 §11.5 声称「已实测有效性」，
   但那次实测只跑到守护测试，没有再跑一次 e2e。
   修复：说明文字去字面量、危险样本改为运行时拼装、**取消自我豁免**。

2. **CI 下 e2e standalone 服务根本起不来**（`108ed12`）
   `playwright.config.ts` 的 `webServer.command` 在 CI 用 `node .next/standalone/server.js`（NODE_ENV 默认 production），
   `instrumentation.ts:9` 会执行 `validateProductionConfig()` 并 fail-fast，而占位 env 有两项不合规：
   `AUTH_SECRET: "e2e-only-secret"`（15 字符 < 32）与未设 `SHARE_STORE_DRIVER`（落 local）。
   实测（旧 env 启动 standalone）：`/api/health` → **500**，日志为生产校验失败 → webServer 120s 超时 → 24 例全部失败。
   改为合规占位值后：`/api/health` 200、`/` 200、`/api/health/ready` 503（依赖不可达时正确降级）。
   这意味着**上一轮 §11.6 对 e2e 失败的归因不完整**（见 §2.4 第 5 条）。

### 2.4 对提示词 / 前序报告的更正

| # | 位置 | 原结论 | 实测 |
|---|---|---|---|
| 1 | 任务书 B2 | 「全项目 grep `DB_SKIP_ENSURE_SCHEMA` → 0 命中」 | **错**。开关自 T221 就在：`db/client.ts:52`、`.env.example:65`、`compose.production.yaml:40`、`compose.acceptance.yaml:45`、`Dockerfile:35`。真实缺口是两套生产校验器都不读它 |
| 2 | 任务书 B16 | 「纯常量（`constants.ts`）不应加 server-only」 | 该文件导出 `DEV_AUTH_SECRET_FALLBACK`（`session.ts:52` 实际用作签名密钥）→ 属于「含 secrets 必须加」 |
| 3 | 任务书 B11 | 「原生 `<button>` 113 vs `<Button>` 113」 | 实测 **19 vs 94**，剩余 19 处为 radiogroup/图形控件 |
| 4 | 任务书 B15 | 「参考八字向导既有做法」「`listPeople`/`getPerson`」 | 八字向导**没有**复用人物档案（无 `listPersons`/`getPerson` 引用）；`listPeople` 这个名字不存在，实际 API 是 `listPersons` / `listPersonEntries` |
| 5 | 第二轮 §11.6 | 剩余 e2e 失败为「`e2e.invalid` 占位符与移动端并行超时，与代码改动无关」 | 不完整：**CI 路径下服务从未启动**（§2.3.2）。本机 dev 路径确实只有占位符/负载两类原因，但那条结论不能推广到 CI |

### 2.5 未验证（如实标注，未以「已修复」掩盖）

| 项 | 状态 | 原因 |
|---|---|---|
| PG 侧 SQL 路径（乐观锁原子性、`ALTER` 幂等、`db:migrate`） | **未验证** | 本机无 Postgres、无 docker（`docker: command not found`）。乐观锁的**判定逻辑**与 409 语义用 file 驱动实测（18 例），SQL 文本仅静态断言 |
| 备份恢复演练（DEPLOY.md §11.4） | **仍未演练** | 需真实 Postgres 环境；9 步表格保持未勾选状态，未改动 |
| B4 端到端「客户端回传版本」 | **未接** | 本机存储不持久化 `version`，故线上仍是盲写。已交付的是服务端契约 + 读接口带 version + 409 语义；接线列为 §5 第 1 项 |
| beforeunload 真实弹窗 | **部分验证** | 验证了监听器注册与解除（`defaultPrevented` false→true）；Chromium 对非用户手势导航不弹框，未做真弹窗验收；SPA 内导航不受该守卫覆盖（已在代码注释与报告声明） |
| 引擎流派归属（起运到月 / 六爻进退空破） | **未做外部审校** | 本轮未新增或修改任何排盘/规则事实（仅 B15 的归属字段，且已测试其不改变盘面与指纹） |
| e2e 全绿 | **未达成** | 见 §4 真实输出。本机 chromium 单进程 6 passed / 2 failed（2 例为 §2.6-1 缺陷，改动前后同样失败）；全量并行 11 passed / 13 failed，其中 10 例是 `iphone-13` 项目所需的 WebKit 二进制未安装（环境），其余为 §2.6-1 与负载敏感超时。未改任何测试预期 |

### 2.6 本轮新发现但**未修**的缺陷（交下一轮决策，含证据）

1. **限流后端不可用会把受覆盖接口打成 500，掩盖 401/403。**
   `RedisRateLimiter.check`（`rate-limit.ts`）无 try/catch，`enforceRateLimit` 又在鉴权/同源**之前**调用，
   Redis 不可达 → 抛错 → 500。证据：e2e `critical-flows.spec.ts:55`（期望 400/401/403，实得 500）、
   `:65`（期望 401）。修法需在「限流 fail-open + 告警」与「把限流后置到鉴权之后」之间做安全取舍，
   属策略变更，不随本轮顺手改。
2. **就绪探针回显后端原始错误文本。** `readiness.ts` / `db/client.ts:64-77` 把驱动错误原文放进 `/api/health/ready` 的
   `message`（实测出现 `用户 "e2e" Password 认证失败` 一类内容），该端点无需鉴权，泄露内部主机/用户名信息。
   建议接 `toSafeErrorMessage` 并把原文只留服务端日志。
3. **5 个页面用 `requestAnimationFrame` 做客户端取数**（`people`、`people/[id]`、`charts`、`liuyao`、`ziwei`）。
   后台标签页不产帧 → 列表可能一直停在「加载中」。本轮在紫微向导改用 `setTimeout` 规避，页面侧未动（一致性重构应单独一轮）。
4. **八字向导同样没有复用人物档案**（IA-6 只补了紫微侧），且**紫微/六爻向导没有 B14 的离开确认**——
   共用件 `unsaved-changes.ts` 已就位，接入是每处 2 行的量级。
5. **B4 的 bulk 端点缺失**：拉取仍是 1 + N 次请求（本轮只降了墙钟）。需要单次响应体积预算才能决定要不要做。

---

## 3. commit 清单（14）

| commit | 类型 | 内容 |
|---|---|---|
| `4013ea9` | fix(auth) | B16 server-only 边界 + 边界守护测试 |
| `cae4cb0` | refactor(api) | B1 share 统一 `parseJsonBody`，删 `checkBodySize` |
| `51f06ed` | fix(ops) | B2 生产强制 `DB_SKIP_ENSURE_SCHEMA=1`（含 CI 双向断言） |
| `35aabe5` | **fix** | 守护测试自身污染 Tailwind → dev/e2e 全站样式再次失败（新发现） |
| `108ed12` | **fix(ci)** | e2e standalone 在生产模式下无法启动（新发现） |
| `fd6f5d5` | fix(ops) | B6 readiness 暴露 `degraded` / `degradedChecks` |
| `940cfd2` | perf(api) | B7 直连限流键改用已验签会话 + 文档更正 + env 泄漏修复 |
| `df83d14` | a11y(ux) | B14 八字向导离开确认 |
| `0166f2b` | feat(ziwei) | B15 紫微新建复用人物档案 |
| `48b9149` | perf(storage) | B5 拉取详情受控并发 |
| `4bbfb2e` | refactor(ui) | B12 EmptyState 抽取（5 处替换） |
| `6bfe7c9` | feat(storage) | B4 `version` 列 + 乐观锁写路径 + 409 |
| `d788309` | fix(security) | B3 CSP 实测结论 + 双向不变量门禁 |
| `db2150f` | test(reading) | B8 三术 LLM 管线行为差异测试（判定不合并） |

---

## 4. 最终门禁真实输出

以下为本轮结束时的**真实执行输出**（非转述、非估算）。

### 4.1 `npm run check`（lint → test → build → check:prerender → check:csp）

```powershell
PS> npm run check

> eslint --max-warnings=0            # 0 problem

 Test Files  100 passed (100)
      Tests  908 passed | 1 skipped (909)
   Duration  21.93s

 ✓ Compiled successfully             # next build（无 CSS 解析错误）

> node scripts/check-prerender-budget.mjs
[check-prerender] 通过：静态路由 17 条（阈值 15）
  / /_global-error /_not-found /account /api/reading/status /auth/callback /auth/login
  /chart/new /charts /favicon.ico /liuyao /liuyao/new /people /privacy /settings /ziwei /ziwei/new

> node scripts/check-csp-inline.mjs
[check-csp] 产物：26 份 HTML，26 份含内联脚本，共 29 个内联 script；CSP script-src = "script-src 'self' 'unsafe-inline'"
[check-csp] 通过：CSP 与产物内联脚本状况一致

=== EXIT: 0 ===
```

**与第二轮基线对比**：93 文件 833 通过 + 1 skipped → **100 文件 908 通过 + 1 skipped**（+7 文件 / +75 例）；
lint 0、tsc 0、build 成功、静态路由 17 条均保持；门禁项由 4 项增至 5 项（新增 `check:csp`）。

### 4.2 生产配置校验器（双向，真实退出码）

```powershell
PS> node scripts/validate-prod-env.mjs
[check:prod-env] NODE_ENV 非 production，拒绝以非生产模式静默通过。
=== EXIT: 1 ===                      # A6 的 fail-closed 行为保持

PS> $env:NODE_ENV="production"; …（合规 env，但**去掉** DB_SKIP_ENSURE_SCHEMA）
[check:prod-env] 生产配置校验失败:
  - 生产必须设置 DB_SKIP_ENSURE_SCHEMA=1：先执行 npm run db:migrate 预跑 DDL（src/lib/db/migrate.sql）…
=== EXIT: 1 ===                      # B2 新增校验实际生效

PS> 同上但含 DB_SKIP_ENSURE_SCHEMA=1
[check:prod-env] 生产配置校验通过
=== EXIT: 0 ===
```

### 4.3 `npx playwright test`（未全绿，如实记录）

```powershell
# 全量并行（3 项目 24 例）
PS> npx playwright test
  13 failed
  11 passed (35.8s)                 # 与第二轮记录的 11/24 同水准

# 本机 chromium 单进程（排除并行负载）
PS> npx playwright test --project=chromium --workers=1
  ok 1 … three-art entry points and mobile layout are reachable (1.6s)
  ok 2 … guest can export local data without an account (1.1s)
  ok 3 … guest archive delete is local-only and sync actions disclose login requirement (1.7s)
  x  4 … health and anonymous protected write surface are deterministic (4.6s)
  x  5 … login entry is usable and anonymous account deletion is refused (5.7s)
  ok 6 … three-art creation smoke › Bazi creation reaches the reading page (5.0s)
  ok 7 … three-art creation smoke › Ziwei creation reaches the reading page (4.4s)
  ok 8 … three-art creation smoke › Liuyao creation validates the question before casting (4.0s)
  2 failed
  6 passed (37.3s)
```

失败构成（逐条归类，未改任何测试预期）：

| 数量 | 归因 | 性质 |
|---|---|---|
| 10 | `iphone-13` 项目全部：`browserType.launch: Executable doesn't exist at …webkit-2336\Playwright.exe` | 本机未装 WebKit 二进制（环境） |
| 2 | `:55` / `:65`：跨站或匿名写请求得到 **500**（期望 401/403） | **真实缺陷 §2.6-1**：Redis 限流后端指向保留域 `e2e.invalid`，`RedisRateLimiter.check` 不捕获异常且发生在鉴权之前。改动前后同样失败 |
| 1 | 并行样本中 1 例 30s 超时（`--workers=1` 复跑通过） | 负载敏感，非功能缺陷 |

另：本轮修复的 CI 启动问题使「standalone 在 production 下起不来」不再让 24 例全灭，
实测证据是 `/api/health` 从 500 → 200（§2.3.2）。

### 4.4 其他门禁

```powershell
PS> npm run check:skill
[sync:skill] wuxing-tables.md
[sync:skill] shichen-table.md
[sync:skill] dayun-rules.md
[sync:skill] classical-texts.md
[sync:skill] check passed (07552d25facd22555b00f60b75073e587959dcad2808667d00e342df081470eb)
=== EXIT: 0 ===

PS> npx vitest run src/lib/__verify__/tailwind-extractor-safety.test.ts
 ✓ src/lib/__verify__/tailwind-extractor-safety.test.ts (3 tests) 520ms
 Test Files  1 passed (1)      # 取消自我豁免（守护自己也进扫描面）后仍通过
```

---

## 5. 建议的下一步（按性价比）

1. **B4 客户端接线**：本机存储持久化 `version` → 推拉时回传 `expectedVersion`，让 409 真正生效（服务端已就绪）。
2. **§2.6-1 限流降级策略**：决定 fail-open + 告警，或把 `enforceRateLimit` 后置到鉴权之后；顺带让 2 例 e2e 自然通过。
3. **§2.6-2 探针消息脱敏**（小改动，属信息泄露收口）。
4. **B13 分批迁移**：按页 5 批（account/settings → 4 个列表页 → 3 个解读页 → 3 个新建页 → 组件层），
   每批跑 `npm run check` + 人工视觉核对，避免一次性大改。
5. **真实 Postgres 环境**：跑一次 `db:migrate` + 乐观锁并发实测 + 备份恢复演练，把 §2.5 两项从「未验证」落地。
6. **IA-6 补齐**：八字向导接人物档案、紫微/六爻向导接离开确认（共用件已就位）。
