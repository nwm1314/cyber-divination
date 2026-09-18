# E-0 · 工程质量门禁基线

> 采集时间：本轮 review 会话
> 代码基线：`src/**` 333 个 TS/TSX 文件、40,147 行、73 个测试文件（与 `docs/REVIEW_PROMPTS.md` 声称一致，已实测核对）
> 采集方式：只读执行门禁命令，未修改任何文件

---

## 1. 门禁现状表

| 命令 | 退出码 | 关键输出摘要 | 是否达标（对照 `EXECUTION_GUIDE.md` §5 DoD） |
|---|---|---|---|
| `npm run lint -- --max-warnings=0` | **0** | 无任何 warning / error 输出 | ✅ 达标（且优于文档基线） |
| `npm test` | **0** | `Test Files 73 passed (73)`；`Tests 578 passed (578)`；Duration 18.23s | ✅ 达标 |
| `npx tsc --noEmit` | **0** | 无输出，零类型错误 | ✅ 达标 |
| `npm run build` | **0** | `✓ Compiled successfully in 12.5s`；`✓ Generating static pages using 11 workers (35/35) in 702ms`；**全部 49 条路由均为 `ƒ (Dynamic)`，静态页 0 条** | ✅ 构建达标；⚠️ **渲染模式不达标**（见 §6.1） |
| `npm run check:prod-env` | **0** | `[check:prod-env] NODE_ENV 非 production，跳过校验（部署前请设 NODE_ENV=production）` | ⚠️ 局部达标：脚本在非生产环境下**直接跳过**，等于基线未校验 |

### 1.1 与文档声称的差异（重要）

| 指标 | 文档声称 | 实测 | 判定 |
|---|---|---|---|
| ESLint warning 数 | `docs/PROJECT_REVIEW.md:8` 与 `README.md` 隐含 "8 warnings"；`REVIEW_PROMPTS.md:5` 称 "lint 8 warnings" | **0** | ⚠️ **文档债**：门禁已优于文档，但文档未更新（`README.md:22` 仅写 "15/18 done"），且 CI 的 `--max-warnings` 阈值未随之收紧 |
| 测试文件数 | 56（`PROJECT_REVIEW.md:8`）、73（`REVIEW_PROMPTS.md:4`） | **73** | ✅ 与最新声称一致；`PROJECT_REVIEW.md:8` 的 56 已过时 |
| 测试用例数 | 444（`PROJECT_REVIEW.md:8`） | **578** | ⚠️ 文档债：已增长 134 个用例未记录 |
| 代码行数 | 约 40,147 行（`REVIEW_PROMPTS.md:4`） | **40,147** | ✅ 完全一致 |

---

## 2. 测试覆盖盲区

### 2.1 全部 API route（23 个）与测试覆盖对照

`src/app/**/route.ts` 共 23 个。以「存在覆盖其逻辑的测试文件」为判据（grep 同名模块的 `*.test.ts` / 直接 import 该 route 的测试）：

| # | 路由文件 | 直接测试 | 间接覆盖 | 判定 |
|---|---|---|---|---|
| 1 | `src/app/api/account/delete/route.ts` | ✗ | `src/lib/auth/account.ts` | ⚠️ **无 route 级测试**（原 P0 场景：删除级联、二次确认） |
| 2 | `src/app/api/account/export/route.ts` | ✗ | — | ❌ **未覆盖** |
| 3 | `src/app/api/auth/callback/route.ts` | ✗ | `session.test.ts` | ⚠️ 无 route 级测试 |
| 4 | `src/app/api/auth/login/route.ts` | ✗ | `magic-link.test.ts` | ⚠️ 无 route 级测试 |
| 5 | `src/app/api/auth/logout/route.ts` | ✗ | `session.test.ts` | ⚠️ 无 route 级测试 |
| 6 | `src/app/api/auth/magic-link/route.ts` | ✗ | `magic-link.test.ts`（5 用例） | ⚠️ **核心 P0 场景无 route 级测试** |
| 7 | `src/app/api/auth/session/route.ts` | ✗ | `session.test.ts`（14 用例） | ⚠️ 无 route 级测试 |
| 8 | `src/app/api/charts/route.ts` | ✗ | `storage.test.ts`、`validate.test.ts` | ⚠️ 无 route 级测试 |
| 9 | `src/app/api/charts/migrate/route.ts` | ✗ | `migrate.test.ts`（19 用例） | ⚠️ 无 route 级测试 |
| 10 | `src/app/api/charts/[id]/route.ts` | ✗ | — | ❌ **未覆盖**（IDOR 高危面） |
| 11 | `src/app/api/health/route.ts` | ✗ | `readiness.test.ts` | ⚠️ 无 route 级测试 |
| 12 | `src/app/api/health/ready/route.ts` | ✗ | `readiness.test.ts`（3 用例） | ⚠️ 无 route 级测试 |
| 13 | `src/app/api/liuyao-charts/route.ts` | ✗ | `liuyao.test.ts` | ⚠️ 无 route 级测试 |
| 14 | `src/app/api/liuyao-charts/[id]/route.ts` | ✗ | — | ❌ **未覆盖**（IDOR 高危面） |
| 15 | `src/app/api/people/route.ts` | ✗ | `person.test.ts`（11 用例） | ⚠️ 无 route 级测试 |
| 16 | `src/app/api/people/[id]/route.ts` | ✗ | — | ❌ **未覆盖**（IDOR 高危面） |
| 17 | `src/app/api/reading/route.ts` | ✗ | `llm.test.ts`、`template.test.ts` | ⚠️ 无 route 级测试 |
| 18 | `src/app/api/reading/liuyao/route.ts` | ✗ | `reading/liuyao/llm.test.ts` | ⚠️ 无 route 级测试 |
| 19 | `src/app/api/reading/status/route.ts` | ✗ | — | ❌ **未覆盖** |
| 20 | `src/app/api/reading/ziwei/route.ts` | ✗ | `reading/ziwei/llm.test.ts` | ⚠️ 无 route 级测试 |
| 21 | `src/app/api/share/route.ts` | ✗ | `share-store.test.ts`（10 用例） | ⚠️ 无 route 级测试 |
| 22 | `src/app/api/ziwei-charts/route.ts` | ✗ | `compute.test.ts` | ⚠️ 无 route 级测试 |
| 23 | `src/app/api/ziwei-charts/[id]/route.ts` | ✗ | — | ❌ **未覆盖**（IDOR 高危面） |

**未覆盖路由清单（完全无任何测试）**：
- `src/app/api/account/export/route.ts`
- `src/app/api/charts/[id]/route.ts`
- `src/app/api/liuyao-charts/[id]/route.ts`
- `src/app/api/people/[id]/route.ts`
- `src/app/api/reading/status/route.ts`
- `src/app/api/ziwei-charts/[id]/route.ts`

> **结论**：**23 个 route 中 0 个有 route 级（handler 级）测试**。现有 73 个测试文件全部是 `src/lib/**` 的单元测试 + 少量组件测试。
> `EXECUTION_GUIDE.md:88` 明确要求 "API 集成 | 400/401/403/404/409/413/429/500"，**该层级完全缺失**。
> 6 个完全未覆盖的 route 中有 **4 个是 `[id]` 动态路由**——正是 IDOR 越权的高危面。

### 2.2 页面（24 个 `page.tsx`）

24 个页面中**无一个**有对应的页面级测试；`e2e/critical-flows.spec.ts` 是唯一的浏览器层覆盖。

---

## 3. 依赖审计

### 3.1 运行期依赖

| 包 | package.json 声明 | 实测安装版本 | 是否当前稳定 | 备注 |
|---|---|---|---|---|
| `next` | `16.2.10`（精确锁定） | 16.2.10 | ✅ | 与 `eslint-config-next` 同步锁定 |
| `react` | `19.2.4`（精确锁定） | 19.2.4 | ✅ | |
| `react-dom` | `19.2.4`（精确锁定） | 19.2.4 | ✅ | |
| `zod` | `^4.4.3` | — | ✅ | 用于 API 边界解析 |
| `lunar-javascript` | `^1.7.7` | — | ⚠️ 需外部验证 | 农历数据正确性无法离线核实 |
| `postgres` | `^3.4.9` | — | ✅ | |
| `@upstash/redis` | `^1.38.0` | — | ✅ | |
| `server-only` | `^0.0.1` | — | ✅ | 用于服务端边界守卫 |

> ✅ **值得肯定的点**：`next` / `react` / `react-dom` 采用**精确版本锁定**（无 `^`），避免了 Next.js 16 破坏性变更导致的意外升级。这在 Next 16 项目里是正确的做法。

### 3.2 devDependencies 被生产代码意外导入

| 包 | 是否被 `src/**`（非测试）导入 | 判定 |
|---|---|---|
| `iztro` | 见下 | 待核 |
| `vitest` | 仅 `*.test.ts` | ✅ 正常 |
| `@playwright/test` | 仅 `e2e/**` | ✅ 正常 |
| `tailwindcss` / `@tailwindcss/postcss` | 仅构建期 | ✅ 正常 |
| `typescript` | 构建期 | ✅ 正常 |

> `iztro@2.5.8` 已精确固定在 devDependencies —— 这一点满足 `REMEDIATION_TASKS.md` T271 的要求（原缺陷"未固定为开发依赖"）。**是否被生产代码导入需 E-3 交叉核实**。

---

## 4. 文档债

| # | 文档位置 | 声称 | 实测 | 判定 |
|---|---|---|---|---|
| 1 | `README.md:22` | "W22–W28 整改（15/18 done，T300/T301/T251 待外部验证）" | 任务状态未复核 | ⚠️ 需 V-1 核实 |
| 2 | `README.md:24` | "核心整改已基本完成" | 见各专项报告 | ⚠️ 待核 |
| 3 | `README.md:44` | `npm run check` = "lint warning 基线 + test + build" | 实际为 `lint --max-warnings=0 && test && build` —— 已是**零容忍**而非"基线" | ⚠️ 描述过时（实际更严格，是好事） |
| 4 | `PROJECT_REVIEW.md:8` | "56 个测试文件、444 个测试通过，ESLint 有 8 个 warning" | 73 文件 / 578 用例 / 0 warning | ❌ **文档债：三个数字全部过时** |
| 5 | `EXECUTION_GUIDE.md:94` | "Beta：W22–W28 基本完成（15/18 done）" | 同上 | ⚠️ 待 V-1 核实 |
| 6 | `README.md:18-24` | 勾选项全为 `[x]` | 存在未验证项（T251/T300/T301） | ⚠️ 见 V-1 |

**关键文档债**：`PROJECT_REVIEW.md:8` 的基线数字（56/444/8）是**上一轮**审查的快照，但该文件同时被 `REVIEW_PROMPTS.md` 当作"权威缺陷来源"引用。若不更新，后续所有 review 都会基于错误的基线数推理。

---

## 5. 失败清单

**当前无失败项。** 已执行的 4 条命令全部退出码 0：

- `npm run lint -- --max-warnings=0` → **exit 0**（无输出）
- `npx tsc --noEmit` → **exit 0**（无输出）
- `npm test` → **exit 0**（73 files / 578 tests passed）
- `npm run check:prod-env` → **exit 0**（但为非生产跳过路径，见 §1）

> `npm run build` 与 `npm run test:e2e` 未在本节基线内执行（build 耗时较长，单独记录；e2e 需要 Playwright 浏览器环境）。两者的结果见对应专项报告与 V-1 复验章节。

### 5.1 非失败但需注意的行为

1. **`npm run check:prod-env` 的静默跳过**：`NODE_ENV !== "production"` 时脚本直接 `exit 0` 且只打印提示。这意味着**本地与 CI 默认路径下生产配置校验形同虚设**。若 CI 未显式设置 `NODE_ENV=production`，该门禁永远不会真正校验。→ 应改为：非生产环境下**打印明确警告并仍退出 0**，但 CI 中必须显式以 `NODE_ENV=production` 调用；或增加 `--force` 参数供 CI 使用。（详见 REVIEW_ENG_OPS.md）

2. **测试输出的 stderr 噪声**：`llm.test.ts` 系列用例会在 stderr 打印 `llm.chat.error` 的结构化日志（`{"event":"llm.chat.error",...,"message":"fetch failed"}`），这是用例**故意**触发的网络失败路径。已核实为预期行为，非缺陷。日志本身**未见 PII 泄漏**，仅含 `requestId` / `route` / `art` / `model` / `errorCode`。

---

## 6. 基线结论

| 维度 | 状态 |
|---|---|
| 类型安全 | ✅ 零错误 |
| Lint | ✅ 零 warning（优于文档声称的 8） |
| 单元测试 | ✅ 578/578 通过 |
| **API 集成测试** | ❌ **0/23 覆盖 —— 最大工程债** |
| 页面测试 | ❌ 0/24 |
| 生产配置校验 | ⚠️ 路径依赖，默认不生效 |
| 文档一致性 | ⚠️ `PROJECT_REVIEW.md:8` 基线数字全部过时 |

**这是本轮 review 最重要的发现**：工程门禁（lint/tsc/test/build）看起来全绿，但 `EXECUTION_GUIDE.md:88` 要求的 API 集成测试层级**完全不存在**。安全类 P0 缺陷（Magic Link 并发消费、IDOR 越权、删除级联）都恰好位于这层，意味着**现有 578 个测试对 P0 安全缺陷零防护**。这也解释了为什么 T251/T300/T301 长期卡在 `review` 状态。

> 该结论直接支撑 `REVIEW_PROMPTS.md` 附录 B 第 3 条的判断："已修复"必须由攻击性复验确认。

---

## 6.1 渲染模式实测（build 输出硬证据）

`npm run build` 的路由表显示 **49 条路由全部标记 `ƒ (Dynamic)`（server-rendered on demand）**，**没有任何 `○ (Static)` 或 `● (SSG)` 路由**。

受影响的**公开、本可静态化**页面：

| 路由 | 本应可静态化 | 实测 | 证据 |
|---|---|---|---|
| `/` | ✅ 纯静态展示（`src/app/page.tsx` 无任何数据获取，仅 import 常量） | `ƒ Dynamic` | build 输出 `ƒ /`；`src/app/page.tsx:1-4` 无动态 API |
| `/privacy` | ✅ 静态法律文本 | `ƒ Dynamic` | build 输出 `ƒ /privacy` |
| `/_not-found` | ✅ 静态 | `ƒ Dynamic` | build 输出 `ƒ /_not-found` |
| `/share/[token]` | 参数化，但可 ISR/缓存 | `ƒ Dynamic` | build 输出 `ƒ /share/[token]` |
| `/share/ziwei/[token]`、`/share/liuyao/[token]` | 同上 | `ƒ Dynamic` | build 输出 |
| `/share/-/opengraph-image` | ✅ 可缓存 | `ƒ Dynamic` | build 输出 |

**根因**：`src/app/layout.tsx:26` 的 `const session = await getServerSession();` 位于**根布局**，使整棵路由树退出静态化。

> 这**逐字证实**了 `docs/PROJECT_REVIEW.md:64` 的原始缺陷仍然存在：
> "根布局读取会话，使首页和公开分享页等全部成为动态渲染页面。"
> 该项在 `REMEDIATION_TASKS.md` 中被列在 W22–W28 整改范围，但**代码未变**。这是本轮 E-0 最硬的一条证据。
