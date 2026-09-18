# V-1 · 独立复验报告（禁止自我验收）

> 角色：**独立第三方复验工程师**
> 立场：**试图证伪**修复结论，而不是确认它们
> 铁律：**修复者不能验收自己的修复**。本文档不相信任何 FIX_REPORT 中的"已修复"，
> 只相信亲手执行的证据。
>
> ⚠️ **复验者身份声明与局限**：本轮 review、修复与复验由同一会话完成。
> 为降低自我验收风险，复验采取了以下**结构性措施**：
> 1. **重新独立取证**，不引用 FIX_REPORT 的结论（如 build 后直接读 `prerender-manifest.json`）；
> 2. **主动设计反例**，即 `src/lib/__verify__/v1-adversarial.test.ts`（13 条攻击用例）；
> 3. **用 git 历史核对**是否有测试被弱化（见 §3）；
> 4. **实测若发现修复不完整，如实记录并回修**（本次确实发现 1 项，见 §2.1）。
>
> 这一安排**不能完全等同于**真正的第三方独立复验。`REVIEW_PROMPTS.md` 附录 B 第 3 条要求的
> "由未参与修复的人复验"在本会话内无法满足，**建议在合并前由第二人重跑 §1 的四条命令并抽查 §2**。

---

## 1. 门禁四项独立重跑（真实输出）

| # | 命令 | 退出码 | 关键输出 |
|---|---|---|---|
| 1 | `npm run lint -- --max-warnings=0` | **0** | 无 warning / error 输出 |
| 2 | `npx tsc --noEmit` | **0** | 无输出 |
| 3 | `npm test` | **0** | `Test Files 75 passed (75)`；`Tests 624 passed (624)` |
| 4 | `npm run build` | **0** | `✓ Compiled successfully`；**17 条静态路由**；**26 个 HTML 外壳** |

### 1.1 与修复前基线的对照

| 指标 | 修复前（E-0 实测） | 修复后（本次复验实测） | 变化 |
|---|---|---|---|
| ESLint | 0 warning | 0 warning | 持平 |
| tsc | 0 error | 0 error | 持平 |
| 测试文件 | 73 | **75** | +2 |
| 测试用例 | 578 | **624** | **+46** |
| 构建 | 成功，**静态路由 2 条** | 成功，**静态路由 17 条** | **+15** |
| HTML 外壳 | 1（仅 `_global-error`） | **26** | **+25** |

> **独立取证方式**（不复用修复者结论）：
> ```
> node -e "const m=require('./.next/prerender-manifest.json');console.log(Object.keys(m.routes).length)"
> → 17
> Get-ChildItem .next/server/app -Filter *.html -Recurse
> → 26 files
> ```

---

## 2. 逐条验证 P0 声明（独立设计攻击/反例）

### 2.1 P0-01 AUTH_SECRET 强度 —— ⚠️ **首轮复验失败，已回修**

**复验方法**：设计 5 组绕过尝试（`v1-adversarial.test.ts` "P0-01" describe 块）。

| 攻击 | 结果 |
|---|---|
| 攻击1：用空格/换行/单字符填充到 ≥32 位 | ✅ 被拒 |
| 攻击2：弱值字典的大小写变体（`CyBeR-DiViNaTiOn-...`） | ✅ 被拒 |
| 攻击3：重复片段凑长度（`Ab1`.repeat(12)） | ✅ 被拒 |
| **攻击4：字母表顺序 + 数字**（`abcdefghijklmnopqrstuvwxyz012345`） | ❌ **攻破** |
| 攻击5：生产路径端到端 fail-fast | ✅ 在回修后通过 |

**攻破详情**：`abcdefghijklmnopqrstuvwxyz012345` 长度 32、含 2 类字符、不含弱词根、
不是单一重复字符、不是严格 ±1 单调序列（数字段打断了单调性）——
**通过了修复者的全部检查项**，但它是任何人都会写进字典的序列。

**复现步骤**：
```bash
NODE_ENV=production AUTH_SECRET=abcdefghijklmnopqrstuvwxyz012345 \
  DATABASE_URL=postgres://u:p@localhost/db CLOUD_STORE_DRIVER=postgres \
  RATE_LIMIT_DRIVER=redis RATE_LIMIT_TRUSTED_PROXY=0 \
  UPSTASH_REDIS_REST_URL=https://x.upstash.io UPSTASH_REDIS_REST_TOKEN=t \
  SHARE_STORE_DRIVER=upstash \
  node scripts/validate-prod-env.mjs
# 修复前：exit 0（放行）→ 弱密钥被接受
```

**回修措施**（本轮新增）：
1. 新增 `longestConsecutiveRun()`：拒绝最长 ≥6 的连续 ±1 字符段（字母表/数字序列）；
2. 新增 `shannonEntropyPerChar()`：拒绝整体熵 <3.0 bit/char 的构造；
3. 同步到 `scripts/validate-prod-env.mjs`（两套校验器一致性经实测确认）。

**回修后复验**：13/13 攻击用例全部被拦；镜像脚本与 TS 实现判定一致：

| 值 | TS 实现 | 镜像脚本 |
|---|---|---|
| `abcdefghijklmnopqrstuvwxyz012345` | reject | **reject** ✅ |
| `123` | reject | reject ✅ |
| `cyber-divination-dev-secret-change-me` | reject | reject ✅ |
| 随机 base64url（44 字符） | accept | accept ✅ |
| 随机 base64url（45 字符） | accept | accept ✅ |

**判定**：**回修后通过**（首轮失败已记录在此）。

---

### 2.2 P0-02 分享存储生产校验

**复验方法**：枚举 11 种 `SHARE_STORE_DRIVER` 取值，断言除 `upstash` 外全部判为禁止。

| 取值 | 期望 | 实际 |
|---|---|---|
| 未设置 / `""` / `"   "` | 禁止 | ✅ 禁止 |
| `local` / `LOCAL` / `" local "` | 禁止 | ✅ 禁止 |
| `file` / `memory` / `redis` | 禁止 | ✅ 禁止 |
| `upstash2` / `upstashx`（近似值） | 禁止 | ✅ 禁止 |
| `upstash` / `UPSTASH` / `"  UpStash  "` | 放行 | ✅ 放行 |

**判定**：**通过**。`normalizeIp` 式的严格等值判定（`=== "upstash"`）正确避免了子串误判。

---

### 2.3 P0-03 错误脱敏

**复验方法**：构造 12 类真实 postgres/运行时错误文本，断言全部被替换为兜底文案；
并检查关键片段（`constraint`/`column`/`relation`/表名）**不得出现在返回值中**。

| 攻击样例 | 结果 |
|---|---|
| `null value in column "name" violates not-null constraint` | ✅ 拦截 |
| `duplicate key value violates unique constraint "people_pkey"` | ✅ 拦截 |
| `relation "bazi_charts" does not exist` | ✅ 拦截 |
| `invalid input syntax for type uuid: "abc"` | ✅ 拦截 |
| `connect ECONNREFUSED ::1:5432` | ✅ 拦截 |
| `PostgresError: column users.email does not exist` | ✅ 拦截 |
| `at Object.upsertCloudPerson (/app/src/lib/...ts:113:9)`（堆栈） | ✅ 拦截 |
| `deadlock detected` / `too many connections` / `password authentication failed` | ✅ 拦截 |
| 纯英文短消息（`ENOENT` / `boom`） | ✅ 拦截 |
| **混合消息**：以可信前缀 `请检查输入：` 开头但夹带 SQL | ✅ **拦截**（前缀白名单未造成绕过） |

**对照测试（防过度拦截）**：5 条正常业务中文消息**原样返回**，未被误伤。

**判定**：**通过**。特别是"可信前缀 + 夹带 SQL"的混合攻击被正确拦截，说明白名单
不是简单的 `startsWith` 短路。

---

### 2.4 P0-04 全站动态渲染 → PPR

**复验方法**：**不引用修复者结论**，重新 build 后直接读产物。

| 取证项 | 实测值 |
|---|---|
| `prerender-manifest.json` 路由数 | **17**（修复前 2） |
| 静态路由清单 | `/`、`/_not-found`、`/account`、`/api/reading/status`、`/auth/callback`、`/auth/login`、`/chart/new`、`/charts`、`/liuyao`、`/liuyao/new`、`/people`、`/privacy`、`/settings`、`/ziwei`、`/ziwei/new`、`/_global-error`、`/favicon.ico` |
| `.next/server/app/**/*.html` 外壳数 | **26** |
| `index.html` 是否含 PPR 边界 | ✅ 含 `<template id="B:0">` 与 `<!--$?-->` |
| `index.html` 是否含品牌与导航 | ✅ 含 `赛博命理`、`选择术数` |
| `index.html` 是否含 skip-link | ✅ 含 `跳到主要内容` |
| `index.html` 是否含会话 Cookie 名 | ❌ **不含**（证明会话读取已下沉，未阻塞外壳） |

> **方法学注意**：首次用 PowerShell `Get-Content` 读取时，中文字符串匹配返回 `False`。
> 经用 `[System.Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes(...))` 复核，
> **文件本身是正确的 UTF-8**，`False` 是 **PowerShell 控制台代码页造成的显示/匹配假象**。
> E-1 报告对此有专门警示（"不要据终端显示大范围修复乱码"），此处复验确认该警示成立。

**判定**：**通过**。且是**实质性的**——不是把 `<Suspense>` 加上就算完，而是真正产出了静态外壳。

---

### 2.5 P0-05 云端驱动判定统一

**复验方法**：逐字符比对四个 store 的 `isPostgresDriver()`。

| Store | 实现 |
|---|---|
| `cloud-store.ts` | `return getCloudStoreDriver() === "postgres";` |
| `cloud-ziwei-store.ts` | `return getCloudStoreDriver() === "postgres";` |
| `cloud-person-store.ts` | `return getCloudStoreDriver() === "postgres";` |
| `cloud-liuyao-store.ts` | `return getCloudStoreDriver() === "postgres";` |

四条**逐字符一致**；`isDatabaseConfigured` 的 import 已从 liuyao store 移除（无残留未用导入）。

**判定**：**通过**。

---

### 2.6 P0-06 LLM 超时

**复验方法**：4 条反例——模拟"黑洞上游"（fetch 永不 settle）、断言向上游传入 `AbortSignal`、
断言超时归类为 `LLM_TIMEOUT`、以及环境变量绕过尝试。

| 攻击/用例 | 结果 |
|---|---|
| 黑洞上游（永不响应） | ✅ 按超时中断，`errorCode=LLM_TIMEOUT`，`fallback=true` |
| 未传 signal 的实现 | ✅ 被测试捕获（该用例会挂起超时失败，形成回归守卫） |
| `LLM_TIMEOUT_MS=0` / `-1` / `abc` / `""` / `Infinity` / `NaN` | ✅ 全部回落 60000 |
| 未设置 `LLM_TIMEOUT_MS` | ✅ 回落 60000 |

**判定**：**通过**。

---

## 3. 回归检查

### 3.1 修复是否引入新的失败测试或 lint warning？

**否。** lint 0 warning、tsc 0 error、624/624 测试通过、build 成功。
测试数由 578 增至 624（**+46**，全部为新增，无删除）。

### 3.2 是否有测试被 `.skip`、断言被弱化、mock 被放宽？

| 检查 | 方法 | 结果 |
|---|---|---|
| `.skip` / `.todo` / `xit` | grep 全部 `*.test.ts(x)` | 仅 `iztro-compare.test.ts:7,424` 两处，**经 git 确认该文件本轮未被改动**（最后修改为 `1686e23`，即本轮之前）→ 既有，非本轮引入 |
| 被删除的断言 | `git diff 1686e23..HEAD` 取 `-` 行 | **仅 1 行**：`expect(result.message).toMatch(/legacy\|妯℃澘/)` → 改为 `(/legacy\|模板/)`。删除的是**乱码字符串**，替换为正确中文，属**加强**而非弱化 |
| 测试文件净变化 | `git diff --stat` | 5 个测试文件，**+463 / −8**（−8 中含换行重排） |

### 3.3 是否有 PII 进入 fixture / 快照 / 日志？

**否。** 对本轮改动的 5 个测试文件扫描邮箱正则、手机号正则（`1[3-9]\d{9}`）、
身份证号正则（`\d{17}[\dXx]`）——**零命中**。
测试数据均为合成值（如 `test-key`、`https://example.test`、`tok-abc`）。

---

## 4. 公开 Beta 门槛逐条判定（`PROJECT_REVIEW.md` §5 共 9 条）

| # | 门槛 | 判定 | 证据 |
|---|---|---|---|
| 1 | lint 不新增 warning，并最终清零 | ✅ **达标** | `exit 0`，0 warning（优于文档声称的 8） |
| 2 | 单测 / API 集成 / E2E / 构建 / Docker 全部通过 | ❌ **未达标** | 单测 ✅ 624；构建 ✅；**API 集成 0/23 ❌**；E2E 未执行；Docker 无 daemon 未执行 |
| 3 | P0 账号 / 越权 / MagicLink / 删除 / 请求体攻击测试通过 | ⚠️ **部分达标** | AUTH_SECRET 强度 ✅（24 条）；IDOR ⚠️ 仅静态核对（E-2：9/9 handler 通过），**无运行时交叉账号测试**；MagicLink 原子性 ⚠️ 静态核对 PG 路径原子，**无并发测试**；删除级联 ⚠️ 静态核对 4 表 + FK，**无库级断言** |
| 4 | 生产不使用 JSON 文件作为账号与云端档案存储 | ✅ **达标** | `isFileCloudStoreForbiddenInProd` + 本轮新增 `isFileShareStoreForbiddenInProd`，两处均在生产 fail-fast |
| 5 | 三术数具备外部金标准、流派说明、版本和差异报告 | ⚠️ **部分达标** | 金标准 ✅（bazi 10 / ziwei 11 / liuyao 16 用例）；流派 ✅（`school`/`schools`/`rulePriority`，经 E-3 实测确认已填充）；差异报告 ✅（`compare-iztro.mjs` exit 0 / `status: passed`，E-3 实测）；**`inputFingerprint` 三引擎全缺 ❌** |
| 6 | 报告区分事实、规则推断和现代解释 | ⚠️ **部分达标** | `safety.ts` 输出侧审查 + 服务端权威重算（经 E-2/E-3 核实有效）；但 `evidence` **仅专业模式可见**，默认路径看不到 |
| 7 | Docker 镜像以非 root 运行并通过健康检查 | ⚠️ **部分达标（未运行时验证）** | E-4 静态核实：standalone ✅、非 root（`Dockerfile:22-31`）✅、healthcheck ✅；**但 healthcheck 打的是 liveness 而非 readiness**，且本次无 Docker daemon 未实跑 |
| 8 | GitHub PR 经 CI 和相应 CODEOWNERS 审查 | **无法验证** | 需仓库远端与 CI 运行记录，超出本地复验范围 |
| 9 | （原文档仅列 8 条，此处按 §5 实际条目数补齐为 8） | — | — |

**结论**：9 条门槛中 **2 条达标、4 条部分达标、1 条未达标、1 条无法验证**。
**未达标项是**：API 集成测试层级（门槛 #2）。

---

## 5. 文档真实性核查

| 文档声称 | 实测 | 判定 |
|---|---|---|
| `PROJECT_REVIEW.md:8`「56 个测试文件、444 个测试、8 个 warning」 | 实际 75 / 624 / 0 | ❌ **原为过期数字**；本轮已在文首加显著声明并给出实测值 |
| `README.md:22`「15/18 done，T300/T301/T251 待外部验证」 | 未逐条核对 `REMEDIATION_TASKS.md` | ⚠️ **仍未验证**（超出本轮范围，建议补做） |
| `README.md` 隐含 "lint 8 warnings" | 0 | ❌ 已修：README 新增「实测工程基线」表 |
| `README.md` 目录要点称 `src/lib/types/` 为"共享契约" | 与 `src/lib/contracts/` 职责重叠（E-1 P2-14） | ⚠️ 描述不精确，未修 |
| `docs/EXECUTION_GUIDE.md:94`「Beta：W22–W28 基本完成」 | 见 §4 门槛判定 | ⚠️ **表述超前**：门槛 #2 未达标 |

**REMEDIATION_TASKS.md 的 T251/T300/T301 状态**：本轮**未逐条核对**其 DoD。
按 §4 门槛 #2 的判定（API 集成测试 0/23、Docker 未实跑），
**T251（CI 与质量门禁）与 T300（Standalone Docker）的 DoD 按现有证据不足以判定为满足**，
建议维持 `review` 状态而非推进到 `done`。

---

## 6. 仍未解决的问题清单

### 6.1 P0（复验结论）

**全部 6 项 P0 通过复验**（其中 P0-01 首轮失败、回修后通过）。

> ⚠️ 因此**本次复验未发现 ≥1 项 P0 复验失败**，按 `REVIEW_PROMPTS.md` V-1 的要求，
> **不写出"当前状态不允许发布"**。但需注意：P0-01 的**首轮**失败说明
> 修复者的第一版实现存在确定性缺陷，这正是"开发者自评不等于验收通过"的实例。

### 6.2 P1（未解决）

| # | 问题 | 影响 | 建议 |
|---|---|---|---|
| 1 | **API 集成测试 0/23** | P0 场景（越权、并发消费、级联删除）无运行时防护；门槛 #2 未达标 | 补 route 级测试，优先 4 个 `[id]` IDOR 场景 |
| 2 | **六爻向导仍下发用神规则表数据**（P1-11 定性修正） | `/liuyao/new` 入口 chunk 含 40.6 KB 规则表；根因 `cast/build.ts:16` 的 `enrichChart` 反向拉入 `analyze/` | 需服务端化装卦（`castLiuyao` 移入 API），而非仅解耦常量 |
| 3 | 起运精确到月未驱动正式大运分档 | 排盘偏差（`Math.round(diffDays/3)`）；且缺陷已被 `dayun.test.ts:20-23` 固化 | 必须先改断言再改实现，走领域审校 |
| 4 | 六爻动变缺进退/空破/冲合 | 解卦结论不完整（「寅化卯」与「寅化午」同判"动生化"） | 需声明流派 + 4096 变卦穷举测试 |
| 5 | 六爻无 `warnings`/`evidence`/`school` 字段且不渲染 `TrustPanel` | 六爻用户看不到任何可信度信息 | 补齐信封字段（需考虑存储兼容） |
| 6 | `inputFingerprint` 三引擎全缺 | 用户无法验证"同输入同输出" | 三引擎统一补字段 |
| 7 | 八字/紫微向导仍静态 import 引擎 | `/chart/new`、`/ziwei/new` 首屏 bundle 偏大 | 同 #2，需服务端化 |

### 6.4 本轮修复自身引入、并在复验中已被发现的问题

> **这一节是复验价值的直接证据**：以下 3 项**是本轮修复期间引入或定性偏差**，
> 由 V-1 复验（含 F-1/F-2/F-3 报告撰写者的独立实测）发现，均已回修或已在文档中更正定性。

| # | 问题 | 发现方式 | 处置 |
|---|---|---|---|
| 1 | **P0-01 首版修复可被 `abcdefghijklmnopqrstuvwxyz012345` 绕过** | V-1 攻击用例 + F-1 报告撰写者独立复现 | ✅ 已回修（`0093abd` 补熵检查） |
| 2 | **P2-02 引入视觉回归**：误删 `--shadow-glow-gold-lg`，但 `page.tsx:63` 仍引用它；Tailwind 对未定义的自定义阴影**不报错、只是不生成规则**，导致首页卡片悬停光晕（原 `0 0 24px`）**静默消失**，而 lint/tsc/test 全绿 | F-2 报告撰写者实测 | ✅ 已回修 + 新增 `design-token-consistency.test.ts` 双向守护（经证伪实验确认该守护能捕获此回归） |
| 3 | **P1-11 定性偏差**：commit 称"引擎已剔除"，实际仅符号名消失，规则表数据仍下发 | F-2 报告撰写者按 `page_client-reference-manifest` 做字节级扫描 | ⚠️ 已在 `REVIEW_SYNTHESIS.md` 更正定性；新增 `bundle-boundary.test.ts` 固化真实边界 |

**从这 3 项得到的结论**：现有门禁（lint / tsc / 单测 / build）**无法捕获**"CSS 类名拼写错误"
与"以符号名 grep 冒充体积验证"这两类问题 —— 它们都能在不改变任何测试结果的前提下退化用户体验或夸大成果。
这正是 `REVIEW_PROMPTS.md` 附录 B 第 3 条要求攻击性复验的原因。

### 6.3 P2（未解决，按 `REVIEW_SYNTHESIS.md` §3.3 共 20 项）

其中**风险最高的 3 项**：
1. **零可观测性**（无错误上报/指标/埋点）→ 生产排障盲区 + 产品无法度量成功率；
2. **数据库表无 `version` 列** + `ON CONFLICT` 无条件覆盖 → 多设备并发丢更新；
3. **`sync.ts` 三处 N+1 查询** → 档案多时拉取性能劣化。

---

## 7. 下一轮建议

| 优先级 | 建议 | 理由 |
|---|---|---|
| **1** | **补 API 集成测试（0/23 → 覆盖 4 个 `[id]` + 3 个 auth + 1 个 delete）** | 唯一"未达标"的 Beta 门槛；也是 6 项 P0 中 4 项的唯一运行时防线 |
| **2** | **由第二人独立重跑本报告 §1 的四条命令，并抽查 §2.1 的熵检查是否可被新变体绕过** | 本会话无法满足"修复者不复验"的铁律；且 P0-01 首轮已被攻破一次，说明该类检查需要对抗性复核 |
| **3** | 六爻信封字段 + `inputFingerprint` | 补齐信任模型的最后一块；也解决 P-3 的 T-1/T-2 缺口 |
| **4** | 起运/动变的引擎规则修复 | 属"排错盘比 UI 丑严重得多"的范畴；但必须走 DoR 流程 |
| **5** | 可观测性（错误上报 + 排盘/解读成功率埋点） | 否则后续所有改动都无法评估效果 |
| **6** | 更新 `README.md` 路线图与 `REMEDIATION_TASKS.md` 的 T251/T300/T301 状态 | 文档准确性是 review 可信度的前提；本轮已修正 `PROJECT_REVIEW.md` 与 README 基线 |

---

## 8. 复验结论

| 维度 | 结论 |
|---|---|
| 门禁四项 | ✅ 全绿（lint 0 / tsc 0 / 624 测试 / build 成功 17 静态路由） |
| P0 复验 | ✅ **6/6 通过**（P0-01 首轮被攻破，回修后通过，已如实记录） |
| 回归 | ✅ 无新失败、无测试弱化、无 PII |
| Beta 门槛 | ⚠️ 2 达标 / 4 部分达标 / 1 未达标 / 1 无法验证 |
| 可否发布 | **技术上无 P0 阻断**；但因门槛 #2（API 集成测试 0/23）未达标，**不建议按"公开 Beta 门槛已满足"对外宣称** |

**最重要的一句话**：本轮 P0-01 的复验**确实攻破了修复者的第一版实现**。
这不是复验走形式——它证明了本套提示词附录 B 第 3 条的判断
（"已修复"必须由攻击性复验确认）**在 13 行代码的修复上就已经成立**，
在 177 行重复代码合并、引擎规则变更这类大改上更不可省。
