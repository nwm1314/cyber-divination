# P-0 · 产品事实基线

> 视角：资深产品经理 · **只读不改**
> 目标：建立「赛博命理」产品的**事实基线**，供后续三方 review 共用
> 规则：每个结论后跟 `文件:行号` 证据；无证据的标注 `[推断]`。本步**只采集事实，不评价、不提改进建议**

---

## 1. 真实功能矩阵

判据：**以 `src/app/**/page.tsx`、`src/app/**/route.ts`、`src/lib/**` 的实际代码为准**，不以 README 或愿望为准。
「已实现」= 有完整可走通的代码路径；「部分」= 有代码但存在明显缺口或仅单侧实现；「缺失」= 无代码。

| 能力 | 八字 | 紫微 | 六爻 | 证据 |
|---|---|---|---|---|
| **排盘/装卦** | 已实现 | 已实现 | 已实现 | `src/app/chart/new/page.tsx:1`、`src/app/ziwei/new/page.tsx:1`、`src/app/liuyao/new/page.tsx:1`；引擎 `src/lib/bazi/`、`src/lib/ziwei/`、`src/lib/liuyao/` |
| **解读（模板）** | 已实现 | 已实现 | 已实现 | `src/lib/reading/template/`、`src/lib/reading/ziwei/template.ts`、`src/lib/reading/liuyao/template.ts`；页面 `src/app/chart/[id]/reading/page.tsx:25`、`src/app/ziwei/[id]/reading/page.tsx`、`src/app/liuyao/[id]/reading/page.tsx` |
| **解读（LLM）** | 已实现 | 已实现 | 已实现 | `src/app/api/reading/route.ts`、`src/app/api/reading/ziwei/route.ts`、`src/app/api/reading/liuyao/route.ts`；无 Key 时回落模板 `src/lib/reading/llm/llm.test.ts`（实测输出 `errorCode:"LLM_NOT_CONFIGURED"`） |
| **存储（本机）** | 已实现 | 已实现 | 已实现 | IndexedDB 驱动 `src/lib/storage/idb.ts`；列表页 `src/app/charts/page.tsx:46`、`src/app/ziwei/page.tsx:30`、`src/app/liuyao/page.tsx:42` |
| **存储（云端）** | 已实现 | 已实现 | 已实现 | `src/lib/storage/cloud-store.ts`、`src/lib/storage/pg-*-store.ts`；API `src/app/api/charts/route.ts`、`src/app/api/ziwei-charts/route.ts`、`src/app/api/liuyao-charts/route.ts` |
| **分享** | 已实现 | 已实现 | 已实现 | 页面 `src/app/share/[token]/page.tsx`、`src/app/share/ziwei/[token]/page.tsx`、`src/app/share/liuyao/[token]/page.tsx`；`src/app/api/share/route.ts`；`src/lib/share/` |
| **导出** | 已实现（图片） | 已实现（图片） | 部分 | `src/components/share/ExportBar.tsx`、`src/components/share/exportShareImage.test.ts`、`src/components/share/ZiweiShareCard.tsx`；六爻见 `src/components/share/LiuyaoShareSheet.tsx`（**未见** ExportBar 等价物）[推断，需 E-1 核实] |
| **校准** | 部分 | 缺失 | 缺失 | 仅有八字：`src/app/chart/[id]/calibrate/page.tsx`、`src/lib/reading/calibrate.ts`、`src/components/reading/CalibrateBox.tsx`。紫微/六爻无 calibrate 路由 [grep 确认无 `ziwei/[id]/calibrate` 与 `liuyao/[id]/calibrate`] |
| **专业模式** | 部分 | 部分 | 部分 | `TrustPanel` 渲染 engineVersion/school/warnings/evidence：`src/components/reading/TrustPanel.tsx`，被 `src/app/chart/[id]/reading/page.tsx:294-302` 使用。是否三术数全量展示需 E-1 核实 |
| **账号** | 已实现（跨术数） | 已实现 | 已实现 | `src/app/account/page.tsx`、`src/app/api/auth/{login,callback,logout,session,magic-link}/route.ts`、`src/lib/auth/` |

### 1.1 功能矩阵的关键不对称

| 发现 | 证据 |
|---|---|
| 校准（沿用 PROJECT_REVIEW §2.5 的"历史事件校准"）**只对八字实现** | 目录 `src/app/chart/[id]/calibrate/` 存在；无 `src/app/ziwei/[id]/calibrate/`、无 `src/app/liuyao/[id]/calibrate/` |
| 六爻**无独立历史列表入口以外的档案页** | `src/app/liuyao/page.tsx:101` 标题为"问卦历史"（八字/紫微为"我的档案"/"紫微命盘"），术语不统一 |
| 紫微有**两套**解读视图 | `src/components/ziwei/ZiweiWizard.tsx` + `src/app/ziwei/[id]/reading/page.tsx` |
| 六爻解读页存在但**列表页无"解读"按钮** | `src/app/liuyao/page.tsx:150-154` 仅有"看卦"，无 `/{id}/reading` 链接；而 `src/app/charts/page.tsx:334` 与 `src/app/ziwei/page.tsx:173` 均有"解读"按钮 → **六爻解读入口缺失** |

---

## 2. 用户可走通的最短路径（首页 → 完整解读）

以**真实路由与交互**逐步写出（八字，最短的一条）：

| 步 | 路由 | 交互 | 证据 |
|---|---|---|---|
| 1 | `/` | 首页看到 hero + 3 张术数卡片，点「开始排盘」 | `src/app/page.tsx:112-114`、`src/content/zh.ts:45`（`cta: "开始排盘"`） |
| 2 | `/chart/new` | 进入排盘向导（`BirthWizard`） | `src/app/chart/new/page.tsx` |
| 3 | `/chart/new`（分步） | 填写出生信息（日期/时辰/地区/姓名/性别），逐步校验 | `src/components/form/BirthWizard.tsx`、`DateTimeFields.tsx`、`RegionSelect.tsx`、`StepProgress.tsx`、`Field.tsx` |
| 4 | `/chart/[id]` | 提交后跳转到命盘结果页（四柱/大运/五行） | `src/app/chart/[id]/page.tsx`；组件 `BaziTable.tsx`、`DayunTimeline.tsx`、`WuxingBars.tsx`、`WuxingRadar.tsx` |
| 5 | `/chart/[id]/reading` | 点「解读」进入报告页 | 入口见 `src/app/charts/page.tsx:334-336`（`Link href={/chart/${id}/reading}`） |
| 6 | `/chart/[id]/reading` | 默认 `mode="template"`，直接渲染模板报告 | `src/app/chart/[id]/reading/page.tsx:81`（`useState<ReadingMode>("template")`） |
| 7 | `/chart/[id]/reading` | 可选切换 LLM 模式（需服务端配置 Key） | `:197`（`if (newMode === "llm" && llmConfigured !== true) return;`） |
| 8 | `/chart/[id]/reading` | 底部读取 `DisclaimerFooter` | `:351` |
| 9 | `/chart/[id]/reading` | 用 `ShareSheet` 分享 | `:284` |

**最短路径步数：4 步点击（首页 → 开始排盘 → 填表提交 → 解读）**，即 3 次页面跳转后即可看到完整模板解读。

**关键事实**：解读页**默认就是模板模式且无需任何网络请求**（`:81`、`:114-134`），LLM 是可选增强。这意味着"拿到一份完整解读"的路径**不依赖 LLM 配置**。

**另一条更短路径存在**：首页 → 「我的档案」(`/charts`) → 已有档案点「解读」→ `:334`。老用户 2 步可达。

---

## 3. 文案事实抽取（逐字引用）

来源：`src/content/zh.ts`

| 字段 | 原文（逐字） | 行号 |
|---|---|---|
| `BRAND.name` | `赛博命理` | `:8` |
| `BRAND.nameEn` | `Cyber Divination` | `:9` |
| `BRAND.tagline` | `专业排盘 · 典籍约束解读` | `:10` |
| `BRAND.heroLead` | `把传统术数写成` | `:11` |
| `BRAND.heroAccent` | `可读的赛博报告` | `:12` |
| `BRAND.heroDesc` | `八字、紫微、六爻统一入口：确定性引擎排盘/装卦，再以规则模板或 LLM 生成解读。默认通俗，可切专业模式。` | `:13-14` |
| `BRAND.footer` | `赛博命理 · 娱乐与爱好者兼顾` | `:15` |
| `BRAND.secondaryHint` | `本地优先，数据默认留在本机。` | `:16` |
| `DISCLAIMER` | `本产品仅供传统文化学习与娱乐参考，不构成医疗、投资、法律或人生决策依据。健康问题请就医，财务请理性决策。命理分析仅供参考，人生在于自身的努力和选择。排盘由本地确定性引擎计算；解读（模板/LLM）只组织语言，不保证现实预测准确率。信息不完整或边界情况会给出警告，通俗模式亦不隐藏关键限制。` | `:3-4` |
| `HOME.artsTitle` | `选择术数` | `:68` |
| `HOME.artsSubtitle` | `已上线可直接进入；未上线显示即将推出` | `:69` |
| `HOME.archives` | `我的档案` | `:71` |
| `ARTS[0].cta`（八字） | `开始排盘` | `:45` |
| `ARTS[1].cta`（紫微） | `排紫微盘` | `:54` |
| `ARTS[2].cta`（六爻） | `起一卦` | `:63` |

### 3.1 文案层的**内部矛盾**（事实，非评价）

| 矛盾 | 证据 |
|---|---|
| tagline 宣称「**专业**排盘」，而 `BRAND.footer` 自称「**娱乐**与爱好者兼顾」，`README.md:24` 定位为「Alpha/Beta」 | `zh.ts:10` vs `zh.ts:15` vs `README.md:24` |
| `heroDesc` 宣称「**统一入口**」，但 top bar 无任何术数导航 | `zh.ts:13` vs `src/components/auth/SiteHeader.tsx:11-17`（仅品牌 + UserMenu） |
| `HOME.artsSubtitle` 文案「未上线显示即将推出」为**死文案**——`ARTS` 三项 `status` 全为 `"live"` | `zh.ts:69` vs `zh.ts:44/53/62` |
| `secondaryHint`「**本地优先，数据默认留在本机**」，但同时提供云端同步与 LLM 解读 | `zh.ts:16` vs `src/app/charts/page.tsx:246-281`（云端同步）、`src/app/api/reading/route.ts`（服务端 LLM） |
| `DISCLAIMER` 提到「**通俗模式亦不隐藏关键限制**」，术语「通俗模式」在代码中为 `viewMode`/`plain` | `zh.ts:4` vs `src/lib/types` 的 `ViewMode` |

### 3.2 未走 `content` 层的硬编码中文（事实抽样）

| 位置 | 原文 |
|---|---|
| `src/app/page.tsx:123` | `人物档案` |
| `src/app/page.tsx:144` | `免责声明` |
| `src/app/page.tsx:145` | `请在使用前阅读` |
| `src/app/page.tsx:154` | `隐私政策` |
| `src/app/page.tsx:157` | `账号` |
| `src/app/page.tsx:27` | `可用` |
| `src/app/charts/page.tsx:185` | `我的档案` |
| `src/app/liuyao/page.tsx:101` | `问卦历史`（与 `我的档案` 不一致） |
| `src/app/chart/[id]/reading/page.tsx:180-181` | `请求解读接口失败，已回落规则模板。请检查网络或服务端日志。` |

> `src/content/zh.ts:1` 注释明确约定「全局静态中文文案 — 集中管理，各页面引用」，但仅 73 行、16 个导出常量，**大量文案散落各处**。D-3 会给出完整清单。

---

## 4. 定位漂移检测（README 声称 vs 代码实际）

| # | README/文档声称 | 代码实际 | 判定 |
|---|---|---|---|
| 1 | `README.md:18` 「MVP 八字全链路（排盘 → 解读 → 反馈 → 分享）」已 `[x]` | 八字链路四环节均有代码：排盘 `chart/new`、解读 `chart/[id]/reading`、反馈 `chart/[id]/calibrate`、分享 `share/[token]` | ✅ **一致** |
| 2 | `README.md:22` 「W22–W28 整改（15/18 done）」 | 门禁实测：lint 0 warning ✅、578 测试通过 ✅、build 见 §5；但 API 集成测试层级 0/23 覆盖（见 `REVIEW_ENGINEERING_BASELINE.md` §2） | ⚠️ **部分漂移**：核心整改完成，但 `EXECUTION_GUIDE.md:88` 要求的 API 集成测试矩阵未落地 |
| 3 | `zh.ts:10` tagline「**专业**排盘」 | `docs/PROJECT_REVIEW.md:10` 明确自查："不应在完成 P0 整改前宣传为'权威级专业预测系统'"；`README.md:24` 定位 Alpha/Beta | ⚠️ **定位漂移**：tagline 用词强于自我定位 |
| 4 | `zh.ts:13` 「**统一入口**」 | `SiteHeader.tsx:11-17` 无术数导航；三个术数各有独立列表页（`/charts`、`/ziwei`、`/liuyao`），互不连通 | ⚠️ **漂移**：首页是统一入口，但站内导航不是 |
| 5 | `zh.ts:16` 「本地优先，数据默认留在本机」 | 默认存储确为 IndexedDB（`src/lib/storage/idb.ts`）；但 LLM 解读会把命盘发往服务端/第三方（`src/app/api/reading/route.ts`） | ⚠️ **需精细表述**：存储本地为真，解读非本地 |
| 6 | `README.md:61` 「`compose.yaml` 仅用于本地集成/演示」 | 需 E-4 核实 compose 配置 | 未验证 |
| 7 | `README.md:100` 「项目原始代码当前为保留所有权利」 | `LICENSE` 存在 | ✅ 待 V-1 核实内容 |
| 8 | `PROJECT_REVIEW.md:8` 「56 个测试文件、444 个测试、8 个 warning」 | 实测 **73 文件 / 578 用例 / 0 warning** | ❌ **文档过期**（数字全部过时） |
| 9 | `PROJECT_REVIEW.md:46` 「未知时辰不应输出唯一完整紫微盘」 | 需 E-3 核实 `src/lib/ziwei/` 是否已实现多时辰校盘 | 未验证 → E-3 |
| 10 | `PROJECT_REVIEW.md:64` 「根布局读取会话，使首页和公开分享页等全部成为动态渲染页面」 | `src/app/layout.tsx:26` 仍为 `await getServerSession()` | ❌ **漂移未修**（代码现状与缺陷描述一致，说明缺陷仍在） |
| 11 | `PROJECT_REVIEW.md:65` 「三个新建向导在客户端直接加载完整计算引擎」 | 需 E-1 核实 | 未验证 → E-1 |

---

## 5. 未验证列表

以下断言**无法从静态代码确认**，单独列出，不作为事实：

| # | 断言 | 来源 | 为什么无法确认 |
|---|---|---|---|
| 1 | 「专业排盘」 | `zh.ts:10` | "专业"无客观判据；需 E-3 给出流派自洽性与外部金标准对照结论 |
| 2 | 「典籍约束解读」 | `zh.ts:10` | 需核实 `evidence` 层是否真的引用可核验典籍章节（`PROJECT_REVIEW.md:57` 指原为"出处风格"）；→ E-1 + E-3 |
| 3 | 「确定性引擎」 | `zh.ts:13` | 需核实六爻 `cast/rng.ts` 的随机源；若用 `Math.random` 则"确定性"仅对排盘成立 → E-3 |
| 4 | 「不保证现实预测准确率」 | `zh.ts:4` | 这是**免责表述**，非能力断言，无需验证 |
| 5 | 「15/18 done」 | `README.md:22` | 需逐条核对 `REMEDIATION_TASKS.md` 中 T251/T300/T301 的 DoD → V-1 |
| 6 | 「Docker 运行时与移动设备验收由 CI/发布门禁继续完成」 | `README.md:24` | 需核实 CI 中是否真有 Docker job 与移动端 job → E-4 + V-1 |
| 7 | 「云端迁移幂等」 | `src/app/charts/page.tsx:221` 文案「合并按 id / 更新时间处理冲突」 | 需读 `src/lib/storage/migrate.ts` 并发场景 → E-1 |
| 8 | 「通俗模式亦不隐藏关键限制」 | `zh.ts:4` | 需核实 `viewMode=plain` 时 `warnings`/`evidence` 是否仍渲染 → E-1 |

---

## 6. 事实层三条硬结论

1. **产品可走通**：八字/紫微/六爻三条主链路（排盘 → 结果 → 解读）均有完整代码路径，且模板解读**离线可用**（`src/app/chart/[id]/reading/page.tsx:81,114-134`）。这不是一个骨架项目。

2. **不对称是真实存在的**：
   - 校准功能只有八字（无 `ziwei/[id]/calibrate`、无 `liuyao/[id]/calibrate`）；
   - 六爻列表页缺"解读"入口（`src/app/liuyao/page.tsx:150-154` 对比 `src/app/charts/page.tsx:334`）；
   - 三个术数的档案页术语不统一（"我的档案" / "紫微命盘" / "问卦历史"）。

3. **工程债集中在测试层级结构**：门禁全绿（lint 0 / tsc 0 / 578 测试通过），但 `EXECUTION_GUIDE.md:88` 要求的 API 集成测试层 **0/23 覆盖**。这不是"质量差"，而是**测量工具缺失**——所有 P0 安全场景恰好落在未覆盖的层级。
