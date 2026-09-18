# 交接：Review 结果与当前实现的缺口清单（含交接提示词）

> 生成时间：本轮 review 会话结束时
> 当前 HEAD：`62263ff`（工作树干净，13 个修复 commit）
> 门禁实测：`lint=0` / `tsc=0` / `78 文件 633 通过 + 1 skipped` / `build 成功，静态路由 17 条`
> 本文档的**所有缺口都经过实际代码核验**（而非转述前序报告），核验命令与结果附在每项下。

---

## 0. 一句话结论

**P0 已全部闭环（6/6）**；**P1 完成 8/16**；**P2 完成 8/30**。
真正的硬缺口是 **API 集成测试 0/23** 与 **6 项引擎规则类问题**——
前者是唯一"未达标的 Beta 门槛"，后者按规程必须走领域审校而非在 review 批次里顺手改。

---

## 1. 已完成的修复（供交接者确认基线，勿重复做）

| 类别 | 项 | commit |
|---|---|---|
| P0 | AUTH_SECRET 强度校验（含 V-1 回修补熵检查） | `8911b5e` + `0093abd` |
| P0 | 分享存储生产校验 | `8911b5e` |
| P0 | API 错误文案乱码（5 处） | `1e20b04` |
| P0 | 全站动态渲染 → cacheComponents/PPR | `146f075` |
| P0 | 云端驱动判定统一 + LLM 超时 | `69bba86` |
| P1 | 六爻解读入口、SiteHeader 术数导航、术语统一 | `63f0e20` |
| P1 | API 错误脱敏（6 处 route） | `488b1c6` |
| P1 | CRUD/导出限流（19 handler） | `169b28a` |
| P1 | 紫微十二宫移动端、解读页行长 | `169b28a` |
| P1 | 对比度（26 处 muted）、reduced-motion、aria-live、`<main>`+skip-link、h1 | `63f0e20` `fd46c4e` |
| P1 | CATEGORY_LABEL 解耦（部分，见 §2.1） | `efaff81` |
| P2 | 死 token 清理、阴影 token 化、非法 CSS | `fd46c4e` |
| P2 | 静默失败（导出/云同步）、Button loading、文案入 content | `ac0153c` |
| P2 | 文档债（PROJECT_REVIEW/README 基线） | `6c40d1a` |
| — | V-1 复验发现的 3 项自身缺陷回修 + 4 个守护测试/脚本 | `62263ff` |

**新增守护资产**（后续改动会受其约束，修改时注意）：
- `scripts/check-prerender-budget.mjs`（已接入 `npm run check` 与 CI）
- `src/lib/__verify__/v1-adversarial.test.ts`（13 条攻击用例）
- `src/lib/__verify__/design-token-consistency.test.ts`（shadow token 双向）
- `src/lib/__verify__/cloud-driver-consistency.test.ts`（四 store 一致性）
- `src/lib/__verify__/bundle-boundary.test.ts`（六爻 bundle 真实边界）

---

## 2. 未修复缺口（逐项核验结果）

### 2.1 P1 级（阻断流程 / 门禁不达标）—— **6 项**

#### GAP-1 · API 集成测试 0/23 ⭐ **最高优先**

**核验**：`src/app/api` 下 `route.ts` 共 23 个，`*.test.ts` **0 个**。

```
Get-ChildItem -Recurse src/app/api -Filter route.ts | measure  → 23
Get-ChildItem -Recurse src/app/api -Include *.test.ts          → 0
```

**为什么最重要**：`EXECUTION_GUIDE.md:88` 要求「API 集成 | 400/401/403/404/409/413/429/500」，
该层级**完全缺失**。本轮 6 项 P0 中有 4 项（越权、Magic Link 并发、删除级联、权威重算）
的运行时防线都在这一层——**当前只有静态核对，没有可执行断言**。
这也是 `PROJECT_REVIEW.md` §5 Beta 门槛中**唯一明确"未达标"**的一条。

**建议范围**（按性价比）：
1. 4 个 `[id]` 动态路由的 IDOR 交叉账号测试（A 读/写/删 B 的资源 → 404 且不泄露存在性）
2. `POST /api/account/delete` 的级联完整性（删后直查库断言无残留）
3. Magic Link 并发消费（并发 2 次同 token → 仅 1 次成功）
4. 伪造派生字段被服务端重算（`POST /api/charts`）
5. 限流生效（19 个新覆盖 handler 中抽 3 个断言 429 + `Retry-After`）

**技术提示**：项目用 vitest，无 route 级测试先例。需决定：
(a) 直接 import route handler 并构造 `NextRequest`（轻量，推荐）；
(b) 起独立 server 做真 HTTP（重，仅 IDOR/级联这类需真实存储的用）。
PG 相关测试需要可用的 `DATABASE_URL` 或注入内存 store（`cloud-*.ts` 已有 file 驱动可借用）。

---

#### GAP-2 · 起运精确到月未驱动正式大运分档

**核验**：`src/lib/bazi/dayun/index.ts:84` 仍为 `const raw = diffDays / 3;`，
`:86` `let months = Math.round((raw - years) * 12);` —— 即起运**细节算出来了**，
但 `startAge/endAge/startYear` 与 `currentDayunIndex` 全部基于整岁。

**额外风险**：E-3 指出 `src/lib/bazi/dayun/dayun.test.ts:20-23` **把"整岁起点"写成了期望值**，
即缺陷已被测试固化。改实现必须先改断言。

**必须走的流程**（`EXECUTION_GUIDE.md:75-76`）：
声明流派 → 生成差异报告 → 领域审校 → 才可合并。
**不要在无流派声明的情况下"改对"**——那是幻觉风险最高的地方。

---

#### GAP-3 · 六爻动变缺进退/空破/冲合

**核验**：`src/lib/liuyao/analyze/dongbian.ts` 的 import 仅 3 行
（`types/liuyao`、`cast/yao`、`analyze/liuqin`）——**未 import `kongwang`/`yuepo`**，
证实"只做五行层回头生克"。

**后果**：「寅化卯」（进神）与「寅化午」当前同判为"动生化"。

**建议**：先补 E-3 报告 B-23 的 4096 变卦穷举测试（当前变卦覆盖度 0%），
再按流派补规则。同样需要流派声明。

---

#### GAP-4 · 六爻信封字段缺失 + 不渲染 TrustPanel

**核验**：
```
src/lib/types/liuyao.ts:105  engineVersion: string;
src/lib/types/liuyao.ts:107  castingSchool?: LiuyaoCastingSchool;
```
**仅有 2 个字段**。缺 `schemaVersion` / `ruleSetVersion` / `warnings` / `evidence`。
且 `src/app/liuyao/[id]/reading/page.tsx` 只渲染 `ReportHeader` + `DisclaimerFooter`，
**不渲染 `TrustPanel`** → 六爻用户看不到流派、方法来源（梅花易数混合法）、任何边界警告。

**这是 P-3 报告 T-2 的缺口，也是六爻"最需要标注方法来源却最缺失"的地方。**

**注意**：加字段会影响存储与分享快照兼容，需要迁移方案。

---

#### GAP-5 · `inputFingerprint` 三引擎全缺

**核验**：全项目 `inputFingerprint` **0 命中**。

**含义**：`PROJECT_REVIEW.md:88` 要求该字段用于"复算和差异对照"，
即**用户无法自证"同一输入得到同一个盘"**——这是信任模型里最基础的一环。
P-3 报告把它列为 T-1（最高伤害度缺口）。

---

#### GAP-6 · 八字/紫微向导仍把引擎打进客户端 bundle

**核验**（V-1 已修正此项定性）：
- `efaff81` 使**符号名**从 `/liuyao/new` 入口 chunk 消失，但**用神规则表数据仍在下发**
  （实测：`1-2q508y8gstd.js` 40.6 KB，含"求财"/"妻财"）
- 根因：`src/lib/liuyao/cast/build.ts:16` `import { enrichChart } from "../analyze"`
- 八字 `BirthWizard.tsx:6`、紫微 `ZiweiWizard.tsx:7` **完全未动**

**根治方式**：服务端化装卦/排盘（`castLiuyao`/`computeChart` 移入 API），
客户端只提交输入、用返回结果跳转。但六爻需回传 `replaySeed` 保证可复现。

**约束**：`bundle-boundary.test.ts` 固化了当前状态，真正拆分后需同步更新该测试。

---

### 2.2 P2 级（一致性 / 打磨 / 技术债）—— 已核验 **22 项**

按"是否值得做"分三档：

#### A 档：建议做（有实际用户影响）

| # | 缺口 | 核验证据 | 建议 |
|---|---|---|---|
| A1 | **`TrustPanel` evidence 仅专业模式可见** | `TrustPanel.tsx:98` `{pro && hasEvidence ? ...}` | 默认模式加折叠入口（P-3 的 T-3）。这是信任模型在默认路径上的唯一出口 |
| A2 | **`TrustPanel.tsx:95`「当前无边界警告。」** | 仍是原文 | 改为中性表述，避免在无证据时制造虚假安心 |
| A3 | **`StarBadge` 零 aria** | `aria/role` 命中 **0** | 星曜徽章对屏幕阅读器不可读（D-3 A4.2） |
| A4 | **甲微/六爻解读失败态无 `role="alert"`** | 两页 `role=alert` 命中 **0** | bazi 已修，这两页未同步 |
| A5 | **备份恢复演练清单 8 项全未勾选** | `docs/DEPLOY.md:737-744` 全为 `- [ ]` | 属流程项，需真实环境执行；至少记录"未演练"事实 |
| A6 | **`check:prod-env` 非生产静默跳过** | `validate-prod-env.mjs:204` | 本地/CI 默认路径下该校验形同虚设；建议加 `--force` 或 CI 显式设 `NODE_ENV=production` |
| A7 | **`logger.ts:7` 注释称 clientKey 已哈希** | 原文仍在；`rate-limit.ts:262` 实际返回纯 IP | 注释与实现不符；要么真哈希，要么改注释 |
| A8 | **`account/export` 仍为 GET 无 Origin 校验** | `export/route.ts:8` `export async function GET` | 建议改 POST + `assertSameOrigin` + 近期认证 |

#### B 档：可选（收益有限或风险偏高）

| # | 缺口 | 核验证据 |
|---|---|---|
| B1 | `checkBodySize` 死代码 | 4 处引用（`share/route.ts:21,150`、`api/index.ts:2`、`validate.ts:22`），与 `parseJsonBody` 并存 |
| B2 | `DB_SKIP_ENSURE_SCHEMA` 未强制 | `validate-prod.ts` 中无该检查（请求期 DDL 默认开启） |
| B3 | CSP 仍含 `unsafe-inline` | `next.config.ts:15,16` |
| B4 | 数据库表无 `version` 列 | `src/lib/db/schema.ts` 中 grep `version` **0 命中** → `ON CONFLICT` 无条件覆盖，多设备并发丢更新 |
| B5 | `sync.ts` N+1 查询 | `:233`、`:288`、`:355` 三处循环内 await |
| B6 | `readiness` 按驱动跳过检查 | `readiness.ts:73,82-83` `skipped: true` → ready 可能恒 true |
| B7 | `direct` 模式限流键为常量 | `rate-limit.ts:262` `return "anon"` → 全站共享一个桶 |
| B8 | 三术 LLM 管线重复 | `llm/llm.ts` 306 行 / `ziwei/llm.ts` 255 / `liuyao/llm.ts` 243（E-1 量化共有 177 行） |
| B9 | 深层导入 | **准确值 25 处**（lib 21 / app 3 / components 1）——**远低于 E-1 报告的 100 处**，因 E-1 口径含 `@/lib/types` 等一级路径。实际风险低 |
| B10 | 六爻 `castingSchool` 字段名与八字/紫微 `school` 不一致 | `types/liuyao.ts:107` vs `types/index.ts:299` |
| B11 | 手写 `<button>` 未复用 `Button` | 原生 `<button>` **113** vs `<Button>` **113**（各半） |
| B12 | `EmptyState` 无抽象 | `暂无` 出现 5 处，各页手写 |
| B13 | 硬编码中文未入 content | `src/app` 下 JSX 内联中文文本节点 **102 处** |
| B14 | `BirthWizard` 填表中途退出无确认 | `beforeunload` **未加** |
| B15 | 紫微向导不复用人物档案 | `ZiweiWizard.tsx` 无 `listPeople`/`getPerson`；需重新手填出生信息（IA-6） |
| B16 | auth 目录 `server-only` 覆盖不全 | `src/lib/auth` 9 个文件，含 `server-only` **4 个**（`types.ts`/`types/user.ts` 不应加，需逐个甄别） |

#### C 档：本轮明确判定"不做"（理由见 `REVIEW_SYNTHESIS.md` §6）

| # | 缺口 | 不做的理由 |
|---|---|---|
| C1 | 可观测性（Sentry/指标/埋点） | 核验 0 命中。需引入外部服务与依赖，超出"不安装新依赖"约束 |
| C2 | `--border` 对比度 1.48:1 | 提到 3:1 需改为 `#5a6076` 中灰，属设计语言级变化 |
| C3 | `types/` 与 `contracts/` 合并 | 属架构决策，需先确认是否真重叠 |
| C4 | `lunar-javascript` 锁版 | E-3 标注"需外部验证"该版本是否有历法错误，结论未定前不宜锁 |
| C5 | 三术 LLM 管线合并（B8） | 满足 >100 行门槛，但三者有术数差异，合并前需先补行为差异测试 |
| C6 | tagline/婚恋提示等产品定位项 | 需产品决策；核验确认**婚恋主题无任何面向用户的专门提示**（6 处命中全在引擎/测试） |

---

## 3. 交接提示词（可直接复制到新会话）

```text
你是资深全栈工程师。工作目录 E:\ai_project\cyber-divination
（Next.js 16.2.10 + React 19.2.4 + TS + Tailwind v4，「赛博命理」）。

## 前置阅读（必读，按顺序）

1. AGENTS.md —— ⚠️ 本项目 Next.js 16 有破坏性变更，
   写代码前必须读 node_modules/next/dist/docs/ 下相关指南，不要凭记忆写
2. docs/REVIEW_PROMPTS.md —— 本轮 review 的提示词库与全局硬性规则
3. docs/GAP_AUDIT_AND_HANDOFF.md —— **缺口清单与本文档的来源**
4. docs/REVIEW_SYNTHESIS.md —— X-1 仲裁：统一问题清单 + 冲突裁决 + 修复路线图
5. docs/REVIEW_VERIFICATION.md —— V-1 复验结论（含 §6.4 复验发现的自身缺陷）
6. docs/FIX_REPORT_P0.md / P1.md / P2.md —— 已完成修复的详细记录
   专项报告按需查阅：REVIEW_ENG_{ARCHITECTURE,SECURITY,ENGINE,OPS}.md、
   REVIEW_DESIGN_{INVENTORY,CONSISTENCY,MOBILE,A11Y}.md、
   REVIEW_PRODUCT_{BASELINE,POSITIONING,IA,TRUST}.md

## 当前基线（已验证，勿重复修复）

HEAD = 62263ff，工作树干净，13 个修复 commit。
门禁实测：lint 0 warning / tsc 0 error / 78 文件 633 通过 + 1 skipped /
build 成功且静态路由 17 条（npm run check 含 check:prerender 门禁）。

已有守护资产（改动相关代码时会受约束，别绕过它们）：
- scripts/check-prerender-budget.mjs（静态路由 >= 15）
- src/lib/__verify__/*.test.ts（4 个文件：攻击用例、shadow token 双向、
  四 store 一致性、六爻 bundle 真实边界）

## 任务：完成剩余缺口，按以下波次推进

### 波次 1（最高优先，先做这个）
**补 API 集成测试（当前 0/23）** —— 这是 PROJECT_REVIEW.md §5
公开 Beta 门槛中唯一明确"未达标"的一条，也是本轮 6 项 P0 中
4 项的运行时防线所在。当前 src/app/api 下 23 个 route.ts
对应 0 个测试文件。

建议覆盖顺序（按性价比）：
1. 4 个 [id] 动态路由的 IDOR 交叉账号测试
   （A 读/写/删 B 的资源 → 404，且不泄露资源存在性）
2. POST /api/account/delete 级联完整性（删后直查库断言无残留）
3. Magic Link 并发消费（并发 2 次同 token → 仅 1 次成功）
4. POST /api/charts 提交伪造派生字段 → 断言被服务端重算
5. 抽 3 个新覆盖的限流 handler 断言 429 + Retry-After

技术决策需自行判断并说明理由：直接 import route handler 构造
NextRequest（轻量）vs 起独立 server 做真 HTTP（重）。
PG 相关可借用 cloud-*.ts 已有的 file 驱动或注入内存 store。

### 波次 2：信任模型闭环（3 项，互相独立）
- inputFingerprint 三引擎全补（当前全项目 0 命中）
- 六爻信封字段：types/liuyao.ts 仅有 engineVersion + castingSchool，
  缺 schemaVersion/ruleSetVersion/warnings/evidence；
  且 liuyao/[id]/reading/page.tsx 不渲染 TrustPanel
- TrustPanel evidence 从"仅专业模式"解锁到默认模式（折叠入口）
⚠️ 这三项都涉及数据结构变更，需先给迁移/兼容方案。

### 波次 3：引擎规则（必须走领域审校流程）
⚠️ 这一波**最容易产生幻觉**，严格遵守 REVIEW_PROMPTS.md 附录 B 第 2 条：
验收标准不是"算对了"，而是"在声明了流派的**前提下自洽、可复核、有外部来源**"。
**凡给出"规则应改为 X"却未注明流派与来源的，一律视为幻觉，打回。**

- 起运精确到月：dayun/index.ts:84 仍 `diffDays / 3` 取整岁。
  注意 dayun.test.ts:20-23 **把缺陷写成了期望值**，必须先改断言。
- 六爻动变进退/空破/冲合：dongbian.ts 仅 import 了 types/liuyao、cast/yao、
  analyze/liuqin，未引入 kongwang/yuepo。
  先补 E-3 报告 B-23 的 4096 变卦穷举测试（当前变卦覆盖度 0%）。
- 参考 docs/REVIEW_ENG_ENGINE.md §F 的 35 条金标准测试清单（B-01…B-35），
  其中标 [外部] 的需外部权威核验。

### 波次 4：P2 收口（按 docs/GAP_AUDIT_AND_HANDOFF.md §2.2 的 A 档 8 项）
优先级：A1（evidence 默认可见）> A2（虚假安心文案）> A3/A4（StarBadge aria、
两页 role=alert）> A6（check:prod-env 静默跳过）> A7（logger 注释不符）
> A8（export 改 POST）> A5（备份演练记录）
B 档 16 项按需，C 档 6 项已判定不做，勿动。

## 硬性规则

1. 先读后写：任何判断必须先读对应源文件，禁止基于文件名或 README 推测
2. 事实/规则/叙事三层不可混淆：LLM 绝不参与排盘，不修改计算事实，不虚构典籍依据
3. 规则变化必须更新 engineVersion / ruleSetVersion，并给出差异报告
4. 不改业务规则时不要顺手改；一次只做一件事
5. 每个问题一个 commit（fix: / fix(security): / perf: / a11y: / feat: / refactor:）
6. 每完成一项跑：npm run check（含 lint --max-warnings=0 + test + build + check:prerender）
7. 不安装新依赖，除非明确要求
8. 输出中文，路径用相对路径，引用代码必须带 文件:行号

## 需要警惕的三个陷阱（本轮复验实际踩过）

1. **视觉静默失效**：Tailwind 对未定义的自定义阴影类名不报错、只是不生成规则。
   本轮曾误删 --shadow-glow-gold-lg 导致首页悬停光晕消失而门禁全绿。
   改动 design token 时务必跑 design-token-consistency.test.ts。
2. **以符号名 grep 冒充体积验证**：本轮曾声称"引擎已从客户端 bundle 剔除"，
   实际只是符号名被压缩重命名，规则表数据仍在下发。
   验证 bundle 要看 page_client-reference-manifest 定位入口 chunk 后做字节级扫描。
3. **PowerShell 控制台代码页假象**：用 Get-Content 读 UTF-8 中文文件会出现
   "乱码"或匹配 False，但**文件本身是正确的**。校核中文内容请用
   [System.Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes(path))。
   本轮 E-1 报告对此有专门警示。

## 交付要求

- 每波的完成情况追加到对应报告（不要新开一堆文件）
- 最终产出 docs/FIX_REPORT_ROUND2.md，含每项「改动前 → 改动后」量化对比
- 结束前跑完整门禁并粘贴真实输出与退出码
- 若发现本文档或前序报告的结论有误，**如实更正并说明**——
  本轮 V-1 复验就攻破了 P0-01 的首版实现、并发现了两处自身缺陷，
  这是预期的、有价值的产出，不是失败
```

---

## 4. 附：核验命令速查

```powershell
# 门禁四项
npm run lint -- --max-warnings=0 ; npx tsc --noEmit ; npm test
npm run build ; node scripts/check-prerender-budget.mjs

# API 测试缺口
(Get-ChildItem -Recurse src/app/api -Filter route.ts).Count      # 23
(Get-ChildItem -Recurse src/app/api -Include *.test.ts).Count    # 0

# 引擎缺口
Select-String src\lib\bazi\dayun\index.ts -Pattern 'diffDays / 3'
Select-String src\lib\liuyao\analyze\dongbian.ts -Pattern '^import'
Select-String src\lib\types\liuyao.ts -Pattern 'schemaVersion|warnings|evidence'
Get-ChildItem -Recurse src -Include *.ts,*.tsx | Select-String 'inputFingerprint'   # 0

# 渲染模式
node -e "console.log(Object.keys(require('./.next/prerender-manifest.json').routes).length)"  # 17

# 中文文件正确读法（避免控制台假象）
[System.Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($path))
```

## 5. 参考：本轮 review 的判断分歧记录

交接者需知道以下 3 处**前序报告与实际不符**，已被更正（避免据错误结论行动）：

| 报告原结论 | 实际情况 | 更正位置 |
|---|---|---|
| D-0「`rounded-lg` = 8px，与 `rounded-xl` 不同」 | `globals.css:41` 覆写了 `--radius-lg`，两者**均为 12px** | `REVIEW_DESIGN_INVENTORY.md` 文首 |
| D-3「11/24 页缺 `<h1>`」 | 实为 **2/24**（3 个解读页的 h1 由 `ReportHeader.tsx:69` 渲染） | `REVIEW_DESIGN_A11Y.md` §A1 |
| E-1「深层导入 100 处」 | 按"跳过桶文件"口径实为 **25 处**；100 处含 `@/lib/types` 等一级路径 | 本文档 §2.2 B9 |
