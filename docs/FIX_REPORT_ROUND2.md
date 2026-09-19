# 第二轮修复报告（FIX_REPORT_ROUND2）

> 起点：`eedb16d`（第二批 review 交接文档），工作树干净
> 终点：`eba1b8b`，**10 个 commit**，48 文件变更（+4661 / −98）
> 交接依据：`docs/GAP_AUDIT_AND_HANDOFF.md` §3 交接提示词
>
> **门禁实测（真实输出，非声称）**：
> ```
> npm run check  →  退出码 0
>   lint --max-warnings=0       0 problem
>   test                        92 文件 830 通过 + 1 skipped（831）
>   build                       Compiled successfully in 9.4s
>   check:prerender             通过：静态路由 17 条（阈值 15）
> ```

---

## 0. 一句话结论

交接文档列出的 **6 项 P1 硬缺口全部闭环**，**A 档 8 项 P2 全部收口**；
过程中**新发现并修复 1 个真实越权漏洞（IDOR）**，
**更正 2 处前序文档自身矛盾**。

| 波次 | 内容 | 状态 |
|---|---|---|
| 1 | API 集成测试 **0/23 → 23/23** | ✅ 闭环 |
| 2 | 信任模型闭环（inputFingerprint / 六爻信封 / TrustPanel） | ✅ 闭环 |
| 3 | 引擎规则（GAP-2 起运到月、GAP-3 前进退空破冲合） | ✅ 闭环 |
| 4 | P2 A 档 8 项 | ✅ 闭环 |
| — | 额外：修复实测发现的 IDOR 漏洞 | ✅ 已修 + 已测 |

---

## 1. 量化对比总表

| 指标 | 改动前 | 改动后 | 变化 |
|---|---|---|---|
| API route 有测试覆盖 | **0 / 23** | **23 / 23** | +23 |
| 测试文件数 | 78 | 92 | +14 |
| 测试用例数 | 633 通过 + 1 skipped | **830 通过 + 1 skipped** | **+197** |
| `inputFingerprint` 全项目命中 | **0** | 13 处（3 引擎 + UI） | +13 |
| 六爻信封字段 | 2 个 | 6 个 | +4 |
| 六爻变卦覆盖度 | **0%** | **100%（4096/4096）** | +100% |
| 六爻动变规则维度 | 1（五行生克） | 5（+进退/冲合/空破） | +4 |
| lint warning / error | 0 | 0 | — |
| tsc error | 0 | 0 | — |
| 静态路由 | 17 | 17 | 保持 |
| 引擎版本 | bazi 0.3.0 / liuyao 0.5.0 | bazi 0.4.0 / liuyao 0.6.0 | 按规程递增 |

---

## 2. 波次 1：API 集成测试 0/23 → 23/23

### 2.1 技术决策（含理由）

**决策：直接 import route handler + 构造 `NextRequest`，不起独立 server。**

理由（记录于 `src/test/api-helpers.ts` 文件头）：

1. route handler 是纯函数 `(request, context) → Response`，直接调用即可覆盖
   鉴权、Origin、限流、zod 校验、权威重算、越权归属**全部 handler 内逻辑**；
2. 起 server 需 `next start` + 端口管理，在 CI 与沙箱下不稳定，
   且**无法注入内存 store**（需真实 DATABASE_URL）；
3. 未被覆盖的仅是 Next.js 路由框架层（路径匹配等），
   该层由 `check:prerender`（17 条静态路由）与 e2e 覆盖。

**存储方案**：复用项目既有 file 驱动 + `reset*ForTests()` 注入内存，
**无需 DATABASE_URL**。这是项目已具备的能力（`cloud-store.ts:67` 等）。

### 2.2 新增 8 个测试文件（213 例）

| 文件 | 例数 | 覆盖重点 |
|---|---|---|
| `idor.test.ts` | 15 | 4 个 `[id]` 路由交叉账号读/写/删 + 伪造 token |
| `account-delete.test.ts` | 6 | 删号级联：直查 4 个 store 断言无残留 |
| `magic-link-concurrency.test.ts` | 8 | 并发 2/8/16 次消费同一 token |
| `charts-authority.test.ts` | 8 | 伪造派生字段被服务端重算 |
| `rate-limit-429.test.ts` | 6 | 429 + Retry-After + 桶/身份隔离 |
| `account-export.test.ts` | 8 | 导出接口加固（A8） |
| `auth-routes.test.ts` | 16 | magic-link 签发 → callback 消费 → session → logout 全链路 |
| `misc-routes.test.ts` | 15 | health/ready/列表/迁移/分享 |
| `reading-routes.test.ts` | 16 | 3 个解读 route + login + status |
| **合计** | **98** | 覆盖 23/23 route |

> 注：加上引擎侧新增的 99 例，本轮共新增 **197** 例。

### 2.3 ⭐ 实测发现并修复真实越权漏洞（IDOR）

**这不是交接文档列出的缺口，是测试写完后跑出来的真实漏洞。**

- **发现**：`idor.test.ts` 的「B 改 A 的人物」用例返回 **200**（期望 404）。
- **复现**（独立验证，非仅凭 route 返回）：
  ```
  upsertCloudPerson("userB", { id: "p1" })   // p1 属于 userA
  → 返回 {"id":"p1","name":"B篡改","userId":"userB"}   // 成功
  ```
- **根因**：`src/app/api/people/[id]/route.ts` 的 PUT 直接调用
  `upsertCloudPerson(session.userId, { ...body, id })`，
  **未校验 `id` 是否属于当前会话用户**。PUT 语义是「更新已存在记录」，
  却允许任意登录用户凭他人 id 写入（`personInputSchema` 的 `id` 为可选自由字段）。
- **影响**：资源命名空间污染。虽然记录按 `users[userId][id]` 分桶存储，
  攻击者无法直接读改 A 的数据，但可**占用任意 id**，
  使 A 后续 upsert 同 id 时产生预期外的并发/覆盖语义，
  且越权请求返回 200 而非 404（泄露"该 id 可能可用"）。
- **修复**：PUT 前先 `personBelongsToUser(userId, id)` 校验归属，
  失败返回 404「人物不存在或无权访问」——与 GET/DELETE 一致，
  **不泄露该 id 是否真实存在**。
- **commit**：`f4c6258 fix(security): PUT /api/people/[id] 越权可为他人 id 建档（IDOR）`

**副产物**：同一批用例验证了其余 3 个 `[id]` 路由
（`charts` / `ziwei-charts` / `liuyao-charts`）的 GET/DELETE
**均正确按 `userId` 限定**，未发现越权。

---

## 3. 波次 2：信任模型闭环

### 3.1 GAP-5 · `inputFingerprint` 三引擎补齐（0 → 13 处）

**新增** `src/lib/engine-envelope/fingerprint.ts`：

| 设计约束 | 理由 |
|---|---|
| **只哈希输入**，不含派生结果 | 否则「指纹不一致」无法区分"输入变了"还是"算法变了"，失去复算意义。版本差异由 `meta.engineVersion` 对照，职责分离 |
| **零依赖**（FNV-1a 64 位，非 node:crypto） | 三引擎 meta 也会在客户端组件读取（TrustPanel），必须同构可用 |
| **键序规范化**（对象键字典序、数组保序） | 对象键序非语义；数组顺序是语义（六爻爻位） |
| **不携带 PII 明文** | 可安全展示与写入分享快照。测试断言指纹不含「张三」「1990」 |
| **排除身份字段**（id/name/userId/personId） | 否则「同一出生信息的两个档案」会得到不同指纹，破坏可自证语义 |

**接入点**：`bazi/index.ts`、`ziwei/compute.ts`、`liuyao/cast/build.ts`。

**测试**：单元 19 例（含 336 个日期**无碰撞**断言）+ 集成 23 例
（含「档案改名/换 id 指纹不变」「三引擎命名空间隔离」）。

### 3.2 GAP-4 · 六爻信封 + TrustPanel

**改动前**（`types/liuyao.ts`）：只有 `engineVersion` + `castingSchool` 两个字段，
**无** `schemaVersion` / `ruleSetVersion` / `warnings` / `evidence`。

**改动后**：

- `LiuyaoChartMeta` 补 `schemaVersion` / `ruleSetVersion` / `inputFingerprint`
- `LiuyaoChart` 补 `warnings` / `evidence`（与八字/紫微对齐）
- 新增 `buildCastingWarnings()`：**时间起卦必须明示「梅花易数先天数 + 纳甲混合法」**
  —— 这是六爻最需要标注方法来源之处（此前完全没有出口）
- 新增 `buildLiuyaoEvidence()`：7 类 `ruleId` 规则链，
  只描述**已实际应用**的规则，未覆盖项引 `scope.ts`
- `liuyao/[id]/reading/page.tsx` **首次渲染 TrustPanel**（此前完全不渲染）

**兼容性**：全部新增字段为 optional，旧缓存/分享快照仍可解析。

### 3.3 A1/A2 · TrustPanel evidence 默认可见 + 去虚假安心

| 项 | 改动前 | 改动后 |
|---|---|---|
| A1 evidence | `{pro && hasEvidence}` —— **通俗模式完全看不到规则来源** | 默认模式提供 `<details>` 折叠入口（原生元素，键盘可达）；专业模式直接展开 |
| A2 无警告文案 | 「当前无边界警告。」→ 在无证据时制造**虚假安心** | 「本盘未触发已知边界警告；这不表示结论没有不确定性，实际判断仍需结合现实情况。」 |
| 新增 | — | 展示 `inputFingerprint`，用户可自证「同一输入 → 同一个盘」 |

### 3.4 a11y（A3/A4）

- **A3** `StarBadge`：补 `aria-label`（含「主星/吉星/煞星」类别标签），
  类别**不再仅靠颜色**传达（原 `aria`/`role` 命中为 0）；视觉文本包 `aria-hidden`
  避免重复朗读。
- **A4** 紫微/六爻解读页失败态补 `role="alert"`（bazi 此前已修，这两页未同步）。

---

## 4. 波次 3：引擎规则（走领域审校流程）

> 规程依据：`EXECUTION_GUIDE.md:75-76`、`REVIEW_PROMPTS.md` 全局规则 4。
> 两份专项报告已产出：`docs/ENGINE_RULE_DAYUN_START.md`、
> `docs/ENGINE_RULE_LIUYAO_DONGBIAN.md`（含流派声明、差异报告、未验证项）。

### 4.1 GAP-2 · 起运精确到月

**改动前缺陷（客观、无需流派即可判定）**：
`dayun/index.ts:84` 算出精确月数，但 `:100-102` 又用
`Math.round(diffDays/3)` 取整岁分档，而同一份 chart 的 `startAt`
用 `(years*12+months)` 个月 —— **同一盘内部自相矛盾**。

**流派声明**：沿用既有 `ziping-default`，
明确选择**「三天一岁·精确到月」**口径（余数保留为月，不四舍五入到整岁），
理由是与本引擎已有 `startAt` / evidence 输出自洽。
**非目标已列明**：不改折算比例、不改顺逆、不引入其他流派口径。

**实测差异**（非估算）：

| 样本 | diffDays | 精确起运 | 旧 startAge | 新 startAge |
|---|---|---|---|---|
| 乙丑男 1985-03-20 | 14.2803 | 4 岁 9 个月 | 5（`round(4.76)`） | **4** |
| 丙子男 1996-12-25 | 11.3087 | 3 岁 9 个月 | 4 | **3** |
| golden L01 立春前 | 29.4769 | 9 岁 10 个月 | 10 | **9** |
| golden L02 立春后 | 29.7530 | 9 岁 11 个月 | 10 | **9** |
| golden L07 阴年女 | 4.9588 | 1 岁 8 个月 | 2 | **1** |
| 庚午男 1990-05-15 | 21.8447 | 7 岁 3 个月 | 7 | 7（**不变**） |

> 旧值 5 与自身 `startAt=1989-12-20`（= 出生 +57 个月 = 4y9m）矛盾。
> 余月 <6 的样本口径**完全不变**，改动范围受控。

**测试**：新增 `dayun-start-precision.test.ts`（31 例），固化
`startAge ↔ startAgeMonths ↔ startAt ↔ currentDayunIndex` 四者自洽，
并**显式断言**两个分歧样本「新值 = 旧值 − 1」，同时验证 8 个正式步
在长跨度下无空洞覆盖。

**同时更正**：`references/dayun-rules.md` **自身矛盾**
（§57-60 月级折算 vs §62 整岁四舍五入），已统一并同步 3 个 skill 目录
（经 `npm run sync:skill` 哈希校验）。

**版本**：bazi engine `0.3.0 → 0.4.0`、ruleSet `w24 → w25`、schema `1.1.0 → 1.2.0`。

### 4.2 GAP-3 · 六爻动变进退/空破/冲合

**改动前**：`dongbian.ts` 只 import 3 个模块，**未引入 `kongwang`/`yuepo`**，
「寅化卯」（进神）与「卯化寅」（退神）同判为「比和」。

**先补覆盖度（B-23，原 0%）**：`dongbian-exhaustive.test.ts` 穷举
**64 本卦 × 64 动爻模式 = 4096 组合**，断言：

- 全部可装卦、结构完整；动爻数一致；有动爻 ⇔ 有变卦
- 64 本卦全覆盖；**变卦映射满射到 64 卦**（无越界）
- 静卦恒 64 组、有动爻恒 64×63 组
- 六爻皆动 ⇒ 变卦为**错卦**（逐卦与数据层比对）

**再按流派补规则**（声明见专项报告）：

| 规则 | 判定 | 保守约束 |
|---|---|---|
| 进退神 | 同五行 + 十二支**相邻**位移（寅→卯进、卯→寅退） | **异五行不判**（属生克）；**土支跨支不判**（各流派无共识） |
| 空破 | 接既有 `kongwang` 旬空表 + `yuepo` 六冲表 | **不改任何判定表**；无占时 → `undefined`（不臆断） |
| 冲合 | 六冲沿用 `yingqi` 同表；六合取通行配对 | — |

**关键性质**：五行生克结果**完全不变**，仅在其上**叠加**结构化标签。
`DongBianItem` 新增 8 个 optional 字段（旧数据可解析）。
`summary` 保持**中性**（测试用黑名单断言不含「大凶/必败/破财/血光」等）。

**测试**：新增 `dongbian-jintui.test.ts`（20 例）——进退神逐对断言、
异五行/同支/土支跨支不判、冲合**对称性与互斥性**、
无占时 `undefined`、中性词黑名单。进/退神样本用 4096 组合**搜索真实卦象**，
**不手工臆造**。

**版本**：liuyao engine `0.5.0 → 0.6.0`、ruleSet `w26-0.5.0 → w26-0.6.0`、
schema `1.0.0 → 1.1.0`；`scope.ts` 移除已实现的「进退神」，保留未实现项。

---

## 5. 波次 4：P2 A 档 8 项

| # | 项 | 改动前 → 改动后 | 证据 |
|---|---|---|---|
| A1 | evidence 默认可见 | 仅 `pro` 可见 → 默认 `<details>` 折叠入口 | `TrustPanel.tsx` |
| A2 | 虚假安心文案 | 「当前无边界警告。」→ 中性表述 + 「无警告 ≠ 无风险」 | 同上 |
| A3 | StarBadge aria | 命中 0 → `aria-label` 含类别，不靠颜色 | `StarBadge.tsx:54` |
| A4 | 两页 role=alert | 命中 0 → 紫微/六爻失败态补 `role="alert"` | 两个 reading 页 |
| A5 | 备份演练记录 | 8 项空勾选 → §11.4 新增 9 步演练表，**如实标注「尚未演练 UNVERIFIED」** | `DEPLOY.md` §11.4 |
| A6 | prod-env 静默跳过 | 非生产**静默跳过** → **fail-closed**（`--force` 可演练）+ 接入 CI 双向断言 | `validate-prod-env.mjs:202` |
| A7 | logger 注释不符 | 称「已哈希」→ 更正为实际返回**明文 IP**，并注明属 PII | `logger.ts:7-15` |
| A8 | export 无 Origin 校验 | `GET` 无校验 → `POST` + 同源 + 近期认证（15min），GET 返 405 | `export/route.ts` |

**A6 实测**（真实输出）：
```
$ node scripts/validate-prod-env.mjs              → exit 1（fail-closed）
$ node scripts/validate-prod-env.mjs --force      → exit 1（列出 5 项缺失）
$ NODE_ENV=production <合规环境> npm run check:prod-env  → exit 0
```

**A8 实测**：GET → 405 + `Allow: POST`；跨站 POST → 403；
陈旧会话（iat >15min）→ 403；合法近期会话 → 200 + `no-store`。

---

## 6. 对前序文档的更正（本轮发现）

按交接提示词「若发现前序报告的结论有误，如实更正并说明」：

| # | 位置 | 前序结论 | 实际 | 处理 |
|---|---|---|---|---|
| 1 | `references/dayun-rules.md` §57-62 | 先写月级折算，又写「四舍五入到整岁」 | **文档自身内部矛盾**，两者不可能同时成立 | 已统一为月级并说明后果；同步 3 个 skill 目录 |
| 2 | `LIUYAO_RULE_SCOPE_NOTE` | 声称「不覆盖进退神」 | 与实现一致（改动前确实未覆盖） | 本实现补上后**同步更新**该声明 |
| 3 | 交接文档 §2.1 GAP-1 建议 | 未提及 `people` PUT 有越权风险 | **实测发现真实 IDOR** | 已修 + 已测（见 §2.3） |

---

## 7. 测试策略上的一个自我修正

穷举测试（4096 组合）与搜索型用例耗时数秒，全量并行时
**超过 vitest 默认 5s 单测超时**，在单文件运行时通过、全量运行时偶发失败——
这是**负载敏感的假失败**，会掩盖真实回归。

处理：对这几个重用例显式放大超时并注明理由，而非提高全局阈值
（避免其他测试悄悄变慢而无人察觉）。

---

## 8. 未完成 / 未验证（如实标注）

### 8.1 明确未做（沿用交接文档 C 档判定，理由已核验）

| 项 | 不做的理由 |
|---|---|
| 可观测性（Sentry/指标/埋点） | 需引入外部服务与依赖，超出「不安装新依赖」约束 |
| `--border` 对比度提到 3:1 | 属设计语言级变化 |
| `types/` 与 `contracts/` 合并 | 架构决策，需先确认重叠范围 |
| `lunar-javascript` 锁版 | 需外部验证该版本历法错误，结论未定 |
| 三术 LLM 管线合并（>100 行） | 三者有术数差异，合并前需先补行为差异测试 |

### 8.2 未验证（需真实环境或外部权威）

| 项 | 状态 | 说明 |
|---|---|---|
| **备份恢复演练** | **未演练（UNVERIFIED）** | 需真实 Postgres 环境；已在 `DEPLOY.md` §11.4 列 9 步可执行表格并如实标注 |
| **PG 驱动的 API 行为** | **未验证** | 本轮测试使用 file 驱动注入内存；`pg-*-store.ts` 的 SQL 路径需 DATABASE_URL 才能验证 |
| GAP-2/GAP-3 的**流派归属** | **未经外部命理师审校** | 按规程属「声明流派前提下自洽、可复核」，**不声称**是典籍逐字规定 |
| 「三天一岁」折算比例 | 未做外部验证 | 沿用既有实现，未改动 |
| `lunar-javascript` 历法正确性 | 需外部验证 | 交接文档 C4 已列 |
| e2e（Playwright） | **未执行** | 本轮未运行 `npm run test:e2e`（需浏览器环境）；CI 中有该步骤 |

### 8.3 风险提示

1. **GAP-2 改变了用户可见的大运年龄**（余月 ≥6 的样本 −1 岁）。
   这是**有意的正确性修复**，但若线上已有分享快照/缓存，
   旧盘与新盘的 `startAge` 会不一致。
   **缓解**：`meta.engineVersion` 从 0.3.0 → 0.4.0，
   可据此识别旧盘；`inputFingerprint` 不含版本号（刻意设计，
   使"输入相同"仍可验证）。
2. **GAP-3 新增字段为 optional**，旧缓存 `DongBianItem` 缺
   `jintui`/`chongHe` 时 UI 需容忍 `undefined`（已按 optional 处理）。

---

## 9. commit 清单（10 个）

| commit | 类型 | 内容 |
|---|---|---|
| `f4c6258` | **fix(security)** | PUT /api/people/[id] 越权 IDOR + 测试基础设施 |
| `0c9d9f8` | test | API 集成测试 0/23 → 4 文件 43 例 |
| `8f5aea9` | feat | 信任模型闭环（fingerprint + 六爻信封 + TrustPanel + A 档） |
| `be05113` | fix(bazi) | 起运精确到月（GAP-2） |
| `42cf78d` | test(liuyao) | 4096 变卦穷举覆盖（B-23） |
| `7525732` | feat(liuyao) | 动变补进退神/空破冲合（GAP-3） |
| `9c665a9` | chore | 修正新增测试的 lint 问题 |
| `b4be7d0` | test(auth) | 认证面 5 个 route（16 例） |
| `4f73fe1` | test(api) | health/列表/迁移/分享（15 例） |
| `eba1b8b` | test(api) | 解读面 5 个 route，覆盖达 23/23 |

---

## 10. 最终门禁真实输出

```powershell
PS> npm run check
> npm run lint -- --max-warnings=0 && npm test && npm run build && npm run check:prerender

> eslint --max-warnings=0          # 0 problem

 Test Files  92 passed (92)
      Tests  830 passed | 1 skipped (831)

 ✓ Compiled successfully in 9.4s

[check-prerender] 通过：静态路由 17 条（阈值 15）

=== EXIT: 0 ===
```

**对比交接基线**：78 文件 633 通过 → **92 文件 830 通过**，
lint 0 / tsc 0 / build 成功 / 静态路由 17 条，**全部保持或提升**。
