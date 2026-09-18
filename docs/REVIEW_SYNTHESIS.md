# X-1 · 三视角冲突仲裁与优先级排序

> 角色：技术负责人（Tech Lead）
> 输入：`docs/REVIEW_PROMPTS.md` Phase 1–2 产出的 **13 份**报告
> 输出：去重合并、冲突裁决、统一问题清单、修复路线图
> 状态：**本文档撰写时，标记为 P0 与高价值 P1 的项已全部修复并提交（10 个 commit）**，逐项标注实际状态

---

## 0. 输入清单核对

| # | 报告 | 大小 | 状态 |
|---|---|---|---|
| 1 | `REVIEW_PRODUCT_BASELINE.md`（P-0） | 14 KB | ✅ |
| 2 | `REVIEW_PRODUCT_POSITIONING.md`（P-1） | 16 KB | ✅ |
| 3 | `REVIEW_PRODUCT_IA.md`（P-2） | 16 KB | ✅ |
| 4 | `REVIEW_PRODUCT_TRUST.md`（P-3） | 19 KB | ✅ |
| 5 | `REVIEW_DESIGN_INVENTORY.md`（D-0） | 41 KB | ✅ |
| 6 | `REVIEW_DESIGN_CONSISTENCY.md`（D-1） | 16 KB | ✅ |
| 7 | `REVIEW_DESIGN_MOBILE.md`（D-2） | 18 KB | ✅ |
| 8 | `REVIEW_DESIGN_A11Y.md`（D-3） | 21 KB | ✅ |
| 9 | `REVIEW_ENGINEERING_BASELINE.md`（E-0） | 12 KB | ✅ |
| 10 | `REVIEW_ENG_ARCHITECTURE.md`（E-1） | 62 KB | ✅ |
| 11 | `REVIEW_ENG_SECURITY.md`（E-2） | 52 KB | ✅ |
| 12 | `REVIEW_ENG_ENGINE.md`（E-3） | 96 KB | ✅ |
| 13 | `REVIEW_ENG_OPS.md`（E-4） | 67 KB | ✅ |

> **主 reviewer 复核修正记录**：本轮 review 中，主 reviewer 对 4 处结论做了独立复核并更正，避免错误结论流入修复：
> 1. `REVIEW_DESIGN_INVENTORY.md` — 「`rounded-lg` = 8px」结论作废：`globals.css:41` 已把 `--radius-lg` 覆写为 12px，故 `rounded-lg` 与 `rounded-xl` 在本项目渲染相同。
> 2. `REVIEW_DESIGN_INVENTORY.md` — `text-[Npx]` 计数由 82 更正为 **72**（67 行）。
> 3. `REVIEW_DESIGN_A11Y.md` — 「11/24 页缺 `<h1>`」更正为 **2/24**：原统计未计入 `ReportHeader.tsx:69` 渲染的 h1。
> 4. `REVIEW_PRODUCT_IA.md` — 「解读入口只存在于档案列表页」更正：三个结果页（`chart/[id]:169,345`、`ziwei/[id]:140`、`liuyao/[id]:98`）**均有**入口。

---

## 1. 去重合并（多视角共现 = 高优先级信号）

| 合并 ID | 问题 | 共现视角 | 判定 |
|---|---|---|---|
| **M-1** | **根布局 `await getServerSession()` 致全站动态渲染** | E-0（build 输出）、E-1（架构，独立读 prerender-manifest）、E-4（ops）、P-1（性能感知） | **4 视角共现** → 最高优先级 |
| **M-2** | **六爻解读链路不可达 / 六爻无可信度信息** | P-2（列表页无入口）、P-3（六爻不渲染 TrustPanel 且缺 warnings/evidence/school 字段）、E-3（六爻信封字段最不全） | **3 视角共现** → 高 |
| **M-3** | **生产配置校验存在盲区** | E-2（AUTH_SECRET 强度）、E-4（SHARE_STORE_DRIVER 未校验）、E-2（DB_SKIP_ENSURE_SCHEMA 未强制） | **2 视角 3 项** |
| **M-4** | **`muted` 透明度滥用导致对比度不达标** | D-0（手算 8 组 <4.5:1）、D-1（§8 复核确认）、D-3（1.4.3 AA）、D-2（移动端弱光） | **4 视角共现** |
| **M-5** | **零 `prefers-reduced-motion`** | D-1（§6.2）、D-3（A7）、D-2 | **3 视角共现** |
| **M-6** | **三术数入口不等权可达 / 导航断层** | P-2（SiteHeader 无导航，`/ziwei`、`/liuyao` 二级孤儿）、P-1（"统一入口"文案与实现不符） | **2 视角** |
| **M-7** | **三术解读管线为三份复制粘贴** | E-1（量化 177 行共有）、P-0（三术数档案页术语不统一）、E-3（信封字段三份不一致） | **3 视角共现** |
| **M-8** | **向导客户端加载完整计算引擎** | E-4（§A.1 量化 ~415KB 源码）、E-1（P1-4）、PROJECT_REVIEW §2.6（原始缺陷） | **3 视角共现** |
| **M-9** | **错误信息泄露内部细节** | E-2（P1，postgres 错误直出）、E-1（P0-2，乱码直出） | **2 视角共现** |
| **M-10** | **`inputFingerprint` 三引擎全缺** | P-3（§1.1）、E-3（跨引擎 D.1） | **2 视角共现** |
| **M-11** | **AI/LLM 相关可靠性缺口** | E-4（无超时、非流式）、D-2（无进度反馈）、P-2（刷新无断点续传） | **3 视角共现** |
| **M-12** | **静默失败（空 catch / 伪成功）** | E-1（24 个空 catch）、E-2（导出路径标准不一致）、E-0（`check:prod-env` 静默跳过） | **3 视角共现** |

---

## 2. 冲突仲裁

### 冲突 1：产品要"专业模式暴露复杂选项" vs 设计要"简化新手路径"

| 方 | 主张 | 依据 |
|---|---|---|
| 产品（P-1 §4.3） | 应把 `evidence` 从专业模式**解锁到通俗模式**（T1 建议） | 默认模式下信任模型失效；大多数用户看不到证据 |
| 设计（D-1 §4、D-2 §7） | 界面已过密（60 处 <12px、`muted` 透明度档位 69 种），应**简化而非增加** | 认知负荷 |

**裁决**：**采纳产品主张，但以"渐进披露"实现，不增加默认视觉密度。**

**理由**：`TrustPanel.tsx:98` 的 evidence 是**折叠态可解决**的信息量问题，不是布局问题。默认模式下渲染一行"N 条规则证据 → 展开"既满足信任需求，又不占视觉预算。

**对设计方的补偿**：同一批次内**不新增**任何常驻元素；展开控件复用现有 `text-xs` + `border-border` 规格，不引入新 token。

**状态**：⚠️ **未实施**（本轮优先修 P0/P1 骨架问题）。已登记为 P2 待办，见 §6「不做的事」。

---

### 冲突 2：工程要"启用 cacheComponents 修动态渲染" vs 风险控制要"最小改动"

| 方 | 主张 |
|---|---|
| 工程（E-1 §3 P0-1） | 必须把会话读取下沉 + `<Suspense>`，让首页/分享页恢复可缓存 |
| 风险（本文档初始判断） | 仅加 `<Suspense>` 可能不足以恢复静态化；启用 `cacheComponents` 改动面大 |

**裁决**：**先验证假设，再决定改动面。**

**执行过程（实证）**：
1. 仅下沉会话到 `HeaderSlot`（含 `<Suspense>`）→ **build 后仍全部 `ƒ (Dynamic)`，静态路由仍为 2 条**。假设被证伪。
2. 读 `node_modules/next/dist/docs/.../cacheComponents.md` → 确认「cacheComponents implements Partial Prerendering (PPR) as the default behavior」，**必须开启该开关**。
3. 启用 `cacheComponents: true` → build **失败**并给出可操作错误（`Uncached data was accessed outside of <Suspense>`），逐页暴露出 8 个 `useParams` 页 + 2 个会话页 + 3 个分享页 + 4 处 `new Date()` 非确定性来源。
4. 逐个修复 → **build 通过，静态路由 2 → 17，26 个 HTML 外壳预渲染**。

**结论**：E-1 的方案正确，但**其"仅下沉会话即可"的隐含预期不成立**；实际必须连带开启 `cacheComponents` 并适配全部运行时 API 访问点。这是本轮改动面最大的一项。

**状态**：✅ **已实施**（commit `146f075`）。

---

### 冲突 3：a11y 要"提高 `--border` 对比度到 3:1" vs 视觉要"保持低调描边设计语言"

| 方 | 主张 |
|---|---|
| a11y（D-0 §5.4、D-3 1.4.11） | `--border`/`background` = 1.48:1，低于非文本 3:1 要求 |
| 视觉（F-3 硬性约束） | "视觉不得发生意外变化：改 token 时保持等效色值/尺寸" |

**裁决**：**保留 `--border` 原值，记录为已知偏差并说明缓解措施。**

**理由**：实测提到 3:1 需把 `#2a2e3a` 改为约 `#5a6076` —— 这是从"几乎不可见的描边"到"明显中灰边框"的**设计语言级变化**，会让所有 `Card`/面板的视觉重量显著加重。F-3 明确禁止此类意外视觉变化，且该条属**非阻断**（1.4.11 不涉及文本可读性，本产品的信息层级不单独依赖 border 成立：卡片另有 `bg-surface` 底色差、选中态走 gold/cyan 高亮环、表单有 focus outline）。

**对 a11y 方的补偿**：在 `globals.css` 中**写明判断依据**，并给出如需严格达标的建议路径（单独引入 `--border-strong` 用于需可辨识的边界，不动 `--border` 的装饰用途）。同时**真实修复**了对比度问题中最严重的部分——`muted/40..80` 共 26 处（1.77–3.90:1）。

**状态**：✅ **已实施**（`--border` 保留 + 注释说明；`muted` 透明度已修，commit `fd46c4e`）。

---

### 冲突 4：产品要"补齐校准/专业功能到三术数" vs 工程要"先还技术债"

| 方 | 主张 |
|---|---|
| 产品（P-0 §1.1、P-2 §6） | 校准只有八字；紫微与八字重复输入出生信息 |
| 工程（E-1、E-4） | 三术解读管线 177 行重复；向导引擎入 bundle；`inputFingerprint` 全缺 |

**裁决**：**工程优先，产品项登记不实施。**

**理由**：P-0 §1.1 已确认**产品可走通**（三条主链路完整，模板解读离线可用）。校准只覆盖八字属于**功能广度**问题，不阻断任何现有流程；而 E-1 的重复代码与 E-4 的 bundle 体积是**持续恶化成本**。

**对产品方的补偿**：本轮已修复**真正阻断流程**的产品项——六爻解读入口（IA-1）与 SiteHeader 术数导航（IA-2），这两项是"功能存在但用户到不了"的硬伤，优先级高于"功能不存在"。

**状态**：✅ 阻断项已修（commit `63f0e20`）；广度项登记为后续任务。

---

### 冲突 5：安全要"给所有路由加限流" vs 性能要"减少每请求开销"

| 方 | 主张 |
|---|---|
| 安全（E-2 §C3） | 所有 `[id]` CRUD 与 `account/export` 无限流，可枚举拖库 |
| 性能（E-0/E-4） | 已有 8 个路由限流；memory 驱动在多实例下无效；每次 `checkRateLimit` 有开销 |

**裁决**：**全量覆盖，但设较高默认额度（120/分钟）避免误伤正常交互。**

**理由**：无限流的读接口是明确的拖库面（`[id]` 枚举 + 导出）。120/分钟对正常用户（浏览 + 增删改查）几乎不可能触及，但对自动化枚举是硬约束。生产已由 `validate-prod.ts:18-31` 强制 `RATE_LIMIT_DRIVER=redis`，多实例失效问题有既有保障。

**对性能方的补偿**：`enforceRateLimit` 复用已有的 `checkRateLimit` 单例与桶机制，无新增连接；额度可通过 `RATE_LIMIT_CRUD_MAX` 调整。

**状态**：✅ **已实施**（19 个 handler，commit `169b28a`）。

---

### 冲突 6：E-2 与 E-4 对「分享存储」的严重度判定不同

| 方 | 判定 |
|---|---|
| E-2（§B3、§总表#5） | `SHARE_STORE_DRIVER` 默认 local **未在总表列为 P0**，仅在正文提示"生产应设 upstash" |
| E-4（§A/P0-1） | 判定为 **P0**：多实例无锁全量读改写 → 静默丢分享链接 |

**裁决**：**采纳 E-4 的 P0 判定。**

**理由**：E-4 给出了更完整的证据链——`share/index.ts:21` 默认值确实为 `"local"`，`local-file.ts:26-45` 确为全量读改写且无锁，且**两套 env 校验器全文都不读该变量**（E-2 也独立确认了此点）。两个视角对事实无分歧，仅严重度判定不同；按本套提示词的排序规则「P0 = 正确性错误/安全漏洞/**数据丢失**」，静默丢失分享链接属数据丢失。

**状态**：✅ **已实施**（commit `8911b5e`）。

---

## 3. 统一问题清单

字段：`ID | 视角 | 问题 | 证据 | 严重度 | 影响用户 | 成本 | 依赖 | 波次 | 状态`

### 3.1 P0（正确性 / 安全 / 数据丢失 / 合规）

| ID | 视角 | 问题 | 证据 `文件:行号` | 严重度 | 影响用户 | 成本 | 波次 | 状态 |
|---|---|---|---|---|---|---|---|---|
| P0-01 | E-2 | `AUTH_SECRET` 仅校验非空，弱密钥可离线伪造会话 → 账号接管 | `validate-prod.ts:65-67`（原）；`session.ts:46-53` | **P0** | 全部登录用户 | S | W1 | ✅ **已修** `8911b5e` |
| P0-02 | E-4 | 生产未禁止 `SHARE_STORE_DRIVER=local`，多实例无锁全量写 → 静默丢分享 | `share/index.ts:21`；`local-file.ts:26-45` | **P0** | 分享创建者 | S | W1 | ✅ **已修** `8911b5e` |
| P0-03 | E-1 | API 错误文案为 mojibake（GBK 误读 UTF-8），用户可见乱码 | `validate.ts:54,68,69,80`；`charts.ts:152` | **P0** | 全部用户 | S | W1 | ✅ **已修** `1e20b04` |
| P0-04 | E-0/E-1/E-4 | 根布局读会话致全站动态渲染（24/24 页，静态页 0） | `layout.tsx:26`；`.next/prerender-manifest.json` | **P0** | 全部用户 | M | W2 | ✅ **已修** `146f075` |
| P0-05 | E-1 | 云端驱动判定四份不一致（liuyao 多一个条件）→ 数据分裂到两个介质 | `cloud-liuyao-store.ts:57` vs 另三个 store | **P0** | 云端用户 | S | W1 | ✅ **已修** `69bba86` |
| P0-06 | E-4 | LLM `fetch` 无超时，上游挂起即永久占用 | `client.ts:87-99`（原，全库无 AbortSignal） | **P0** | 解读用户 | S | W1 | ✅ **已修** `69bba86` |

### 3.2 P1（阻断流程 / 严重体验 / 门禁不达标）

| ID | 视角 | 问题 | 证据 | 严重度 | 成本 | 波次 | 状态 |
|---|---|---|---|---|---|---|---|
| P1-01 | P-2 | 六爻列表页缺「解读」入口（三术数中唯一） | `liuyao/page.tsx:150-154` | **P1** | S | W3 | ✅ **已修** `63f0e20` |
| P1-02 | P-2/P-1 | `SiteHeader` 无术数导航；`/ziwei`、`/liuyao` 为二级孤儿 | `SiteHeader.tsx:11-17`（原） | **P1** | S | W3 | ✅ **已修** `63f0e20` |
| P1-03 | E-2 | 6 处 route 直出 `e.message`，泄露 postgres 表名/约束名 | `people/route.ts:80` 等 6 处 | **P1** | S | W3 | ✅ **已修** `488b1c6` |
| P1-04 | E-2 | CRUD / `account/export` 完全无限流，可枚举拖库 | `charts/[id]/route.ts` 等全文无限流 | **P1** | S | W3 | ✅ **已修** `169b28a` |
| P1-05 | D-0/D-1/D-3 | 26 处 `muted/40..80` 对比度 1.77–3.90:1（<4.5:1 AA） | 20 个文件 | **P1** | M | W4 | ✅ **已修** `fd46c4e` |
| P1-06 | D-1/D-2/D-3 | 零 `prefers-reduced-motion`（全站 50+ 动效） | `globals.css`（原无该查询） | **P1** | S | W4 | ✅ **已修** `63f0e20` |
| P1-07 | D-3 | 全站零 `aria-live`，状态/错误对屏幕阅读器静默 | 原 0 处 | **P1** | S | W4 | ✅ **已修** `63f0e20` |
| P1-08 | D-3 | 20/24 页无 `<main>` landmark，无 skip link | `layout.tsx:36`（原） | **P1** | S | W4 | ✅ **已修** `63f0e20` |
| P1-09 | D-2 | 紫微十二宫 375px 下每格 85px，字号被压到 8–10px | `PalaceGrid.tsx:51,88,108,113` | **P1** | S | W5 | ✅ **已修** `169b28a` |
| P1-10 | D-2 | 解读页桌面端行长约 82 中文字（容器 1152px） | `reading/page.tsx:260`、`SectionCard.tsx` | **P1** | S | W5 | ✅ **已修** `169b28a` |
| P1-11 | E-1/E-4 | 向导把完整计算引擎打进客户端 bundle | `CastForm.tsx:11`；`BirthWizard.tsx:6`；`ZiweiWizard.tsx:7` | **P1** | M | W5 | ⚠️ **部分修** `efaff81`（六爻已剔除）；八字/紫微待做 |
| P1-12 | E-3 | 起运精确到月的信息未驱动正式大运分档（`Math.round(diffDays/3)`） | `dayun/index.ts:226`；`dayun.test.ts:20-23` 固化缺陷 | **P1** | M | W6 | ❌ **未修**（引擎规则，需领域审校） |
| P1-13 | E-3 | 六爻动变只做五行层回头生克，进/退/空/破/冲合全缺 | `dongbian.ts:94` | **P1** | L | W6 | ❌ **未修**（引擎规则） |
| P1-14 | P-3/E-3 | 六爻缺 `warnings`/`evidence`/`school` 字段且不渲染 `TrustPanel` | `types/liuyao.ts:105-107`；`liuyao/[id]/reading/page.tsx:23-24` | **P1** | M | W6 | ❌ **未修** |
| P1-15 | P-3/E-3 | `inputFingerprint` 三引擎全缺（可复现性凭证） | 全项目 grep 0 匹配 | **P1** | M | W6 | ❌ **未修** |
| P1-16 | E-0 | API 集成测试层级 0/23 覆盖（P0 场景无防护） | `EXECUTION_GUIDE.md:88` vs 实测 | **P1** | L | W7 | ⚠️ **部分修**（新增 30 条库级回归，未建 route 级测试） |

### 3.3 P2（一致性 / 打磨 / 技术债）

| ID | 视角 | 问题 | 证据 | 状态 |
|---|---|---|---|---|
| P2-01 | D-0/D-1 | 死 token：`--cyan-dim`、`--font-display`、`--shadow-glow-gold-lg` | `globals.css` | ✅ **已修** `fd46c4e` |
| P2-02 | D-0/D-1 | `--gold-glow`/`--cyan-glow` 未映射进 `@theme`，17 处阴影裸值 | `globals.css:26-42`（原） | ✅ **已修**（10 处下沉为 token）`fd46c4e` |
| P2-03 | D-1 | `shadow-[0_0_8px]` 缺颜色值，非法 CSS | `WuxingBars.tsx:73` | ✅ **已修** `fd46c4e` |
| P2-04 | E-1 | 导出路径空 catch 静默失败，与删除路径标准不一致 | `account.ts:43-47`（原） | ✅ **已修** `ac0153c` |
| P2-05 | E-1 | `liuyao/page.tsx` 推送/拉取云端空 catch 无反馈 | `liuyao/page.tsx:54-71`（原） | ✅ **已修** `ac0153c` |
| P2-06 | D-0 | `Button` 无 `loading` prop | `Button.tsx`（原） | ✅ **已修** `ac0153c` |
| P2-07 | D-3 | 首页 8 处硬编码中文未走 content 层 | `page.tsx:123,144,145,154,157` 等 | ✅ **已修** `ac0153c` |
| P2-08 | P-2 | 三术数档案页术语不统一 | `charts:185`/`ziwei:106`/`liuyao:101` | ✅ **已修** `63f0e20` |
| P2-09 | D-2 | 解读失败态裸文本无 CTA | `reading/page.tsx:246-252`（原） | ✅ **已修** `63f0e20` |
| P2-10 | E-2 | `--border` 对比度 1.48:1（<3:1 非文本） | `globals.css:9` | ⚠️ **有意保留** + 注释说明 `fd46c4e` |
| P2-11 | P-3 | `TrustPanel` 的 `evidence` 仅专业模式可见 | `TrustPanel.tsx:98` | ❌ 未修（§6 不做） |
| P2-12 | P-3 | `TrustPanel.tsx:95`「当前无边界警告。」制造虚假安心 | `TrustPanel.tsx:94-96` | ❌ 未修 |
| P2-13 | E-1 | 深层导入 100 处破坏封装 | 全项目 | ❌ 未修 |
| P2-14 | E-1 | `types/` 与 `contracts/` 职责重叠 | 两目录 | ❌ 未修 |
| P2-15 | E-4 | 零可观测性（无错误上报 / 无指标 / 无埋点） | grep 0 匹配 | ❌ 未修（需外部服务） |
| P2-16 | E-4 | `sync.ts` 三个 pull 循环 N+1 查询 | `sync.ts:288-299,403-415,488-499` | ❌ 未修 |
| P2-17 | E-4 | 数据库表无 `version` 列，`ON CONFLICT` 无条件覆盖（多设备丢更新） | `pg-bazi-store.ts:113-119` | ❌ 未修 |
| P2-18 | E-4 | `readiness.ts` 按驱动跳过检查，ready 可能恒 true | `readiness.ts:22-33` | ❌ 未修 |
| P2-19 | E-4 | `direct` 模式限流键退化为常量 `"anon"`，全站共享一个桶 | `rate-limit.ts:250` | ❌ 未修（设计取舍，已文档化） |
| P2-20 | E-4 | 备份恢复演练清单 5 项全未勾选；Upstash 分享数据不在 PG 备份范围 | `docs/DEPLOY.md:368-374` | ❌ 未修（运维项） |
| P2-21 | E-3 | `lunar-javascript` 用范围版本 `^1.7.7`，无法事后核验历法版本 | `package.json:27` | ❌ 未修 |
| P2-22 | P-1 | tagline "专业" 与 footer "娱乐" 定位矛盾 | `zh.ts:10` vs `:15` | ❌ 未修 |
| P2-23 | P-1 | 婚恋主题无专门高风险提示 | `zh.ts:3-4`、`TrustPanel.tsx:52` | ❌ 未修 |
| P2-24 | E-1 | `src/lib/auth/**` 缺 `server-only` | `get-session.ts` 等 | ❌ 未修 |
| P2-25 | E-2 | 生产 CSP 仍含 `script-src 'unsafe-inline'` | `next.config.ts:15` | ❌ 未修（需 nonce 机制） |
| P2-26 | E-1/E-4 | 三术解读管线 177 行重复 | 三个 LLM 入口 | ❌ 未修（§6 不做，>100 行但风险高） |
| P2-27 | E-4 | `check:prod-env` 在非生产下静默跳过 | `validate-prod-env.mjs:44-49` | ❌ 未修 |
| P2-28 | E-3 | 六爻 `castingSchool` 与八字/紫微 `school` 字段名不一致 | `types/liuyao.ts:107` | ❌ 未修 |
| P2-29 | D-1 | 手写按钮未复用 `Button`（110 处原生 button） | 多页 | ❌ 未修 |
| P2-30 | D-1 | 空态手写重复 3 次，无 `EmptyState` 抽象 | 三个档案页 | ❌ 未修 |

---

## 4. 优先级排序规则（严格执行）

- **P0 = 正确性错误 / 安全漏洞 / 数据丢失 / 合规风险**
- **P1 = 阻断核心流程 / 严重体验缺陷 / 门禁不达标**
- **P2 = 一致性、打磨、技术债**

**规则执行**：**P0 修复前不投入任何新功能开发。** 本轮的 6 项 P0 已全部在 W1–W2 完成，未在修复期间动任何新功能。

---

## 5. 修复路线图（3 批次，写集互斥、可独立回滚）

> 实际执行时合并为 10 个原子 commit（一个问题一个 commit），每批结束后 `npm run check` 通过。

### 批次 1（W1）：配置与文案安全 —— 写集：`src/lib/config/**`、`scripts/**`、`src/lib/api/validate.ts`、`src/lib/contracts/**`

| 项 | 问题 ID | 涉及文件 | 验收标准 | 工作量 |
|---|---|---|---|---|
| 1.1 | P0-01 | `validate-prod.ts`、`validate-prod.test.ts` | 弱密钥（`123`/开发占位/重复片段）在生产 fail-fast；11 条新测试通过 | S |
| 1.2 | P0-02 | 同上 + `validate-prod-env.mjs` | 未设 `SHARE_STORE_DRIVER` 时生产 fail-fast | S |
| 1.3 | P0-03 | `validate.ts`、`charts.ts`、`validate.test.ts` | 5 处乱码修复；新增防乱码回归测试 | S |

**验收**：`npm run lint -- --max-warnings=0 && npm test && npx tsc --noEmit && npm run build` 全绿 ✅
**回滚**：`git revert 8911b5e 1e20b04`

### 批次 2（W2）：渲染模式与运行时可靠性 —— 写集：`next.config.ts`、`src/app/**/page.tsx`、`src/app/layout.tsx`、`src/components/auth/**`、`src/lib/storage/cloud-liuyao-store.ts`、`src/lib/reading/llm/client.ts`

| 项 | 问题 ID | 涉及文件 | 验收标准 | 工作量 |
|---|---|---|---|---|
| 2.1 | P0-05 | `cloud-liuyao-store.ts` | 四个 store 的 `isPostgresDriver` 逐字符一致 | S |
| 2.2 | P0-06 | `llm/client.ts` + 测试 | 向上游传 `AbortSignal`；黑洞上游归类 `LLM_TIMEOUT` | S |
| 2.3 | P0-04 | `next.config.ts`（`cacheComponents: true`）、`layout.tsx`、新增 `HeaderSlot.tsx`、8 个 `useParams` 页、`account`/`login`/3 个 share 页、`BirthWizard`、`CastForm`、`LiunianStrip` | **build 输出静态路由 ≥17**；26 个 HTML 外壳预渲染；全部页面为 `◐` | **M** |

**验收**：全绿 ✅；实测 `prerender-manifest.json` 由 2 条 → 17 条
**回滚**：`git revert 69bba86 146f075`

### 批次 3（W3–W5）：体验、无障碍与安全边界 —— 写集：`src/lib/api/safe-error.ts`（新）、`src/lib/api/rate-limit.ts`、`src/app/api/**`、`src/components/**`、`src/content/zh.ts`、`src/app/globals.css`

| 项 | 问题 ID | 涉及文件 | 验收标准 | 工作量 |
|---|---|---|---|---|
| 3.1 | P1-03 | 新增 `safe-error.ts` + 6 处 route | postgres 错误不再外泄；7 条测试通过 | S |
| 3.2 | P1-01/02/08 | `SiteHeader.tsx`、`liuyao/page.tsx`、`layout.tsx`、`globals.css` | 六爻有解读入口；header 有三术数导航；`<main>` + skip link | S |
| 3.3 | P1-04 | `rate-limit.ts` + 19 个 handler | 429 生效并带限流头；4 条测试通过 | S |
| 3.4 | P1-09/10 | `PalaceGrid.tsx`、`SectionCard.tsx` | 网格最小 560px 可横向滚动；正文 ≤38rem | S |
| 3.5 | P1-05/06/07 | 20 个文件 + `globals.css` | `muted` 全部 `/90`；有 reduced-motion；有 aria-live | M |
| 3.6 | P2-01/02/03 | `globals.css`、8 个组件 | 阴影 token 化且值与原先逐字符一致；死 token 清除 | S |
| 3.7 | P2-04/05/06 | `account.ts`、`liuyao/page.tsx`、`Button.tsx` | 失败可见；Button 支持 loading | S |
| 3.8 | P1-11 | 新增 `lib/liuyao/labels.ts` | 客户端 chunk 无引擎痕迹 | S |

**验收**：全绿 ✅；新增测试 33 条（578 → 611）
**回滚**：`git revert 63f0e20 488b1c6 169b28a efaff81 fd46c4e ac0153c`

---

## 6. 不做什么（明确列出本轮不修的问题及理由）

| 项 | 问题 ID | 不做的理由 |
|---|---|---|
| 起运精确到月（`Math.round(diffDays/3)`） | P1-12 | **属引擎规则变更**。E-3 明确指出该缺陷已被 `dayun.test.ts:20-23` 的断言固化，改它会改变既有排盘结果，必须走「声明流派 → 给出差异报告 → 领域审校」流程（`EXECUTION_GUIDE.md:75-76`），不能在 review 修复批次里顺手改 |
| 六爻动变补进退/空破/冲合 | P1-13 | 同上，属规则层扩张，需明确流派归属与穷举测试（E-3 建议 B-23~B-27）后才可动 |
| 六爻信封字段补齐 + `inputFingerprint` | P1-14/15 | 涉及三引擎数据结构变更，影响存储与分享快照兼容性，需独立迁移方案 |
| 三术解读管线去重（177 行） | P2-26 | F-3 规定"仅在重复量 >100 行时才做"，**本条满足该门槛**，但三个 LLM 入口各有细微的术数差异（E-1 指出 ziwei∩liuyao 重合 189 行而 bazi 不同）。合并需先补足三者行为差异的测试，否则会静默改变行为 |
| 深层导入收敛（100 处） | P2-13 | 纯重构，无功能收益，且改动面横跨 5 个子系统，回归风险高于收益 |
| `types/` 与 `contracts/` 合并 | P2-14 | 需先确认两者是否真的重叠（E-1 未给出最终结论），属架构决策而非缺陷 |
| 可观测性（Sentry / 指标 / 埋点） | P2-15 | 需引入外部服务与第三方依赖，违反本轮"不安装新依赖"约束 |
| `--border` 提到 3:1 | P2-10 | 会显著改变设计语言（详见冲突 3 裁决） |
| `Button` 手写按钮全量替换（110 处） | P2-29 | 改动面覆盖 20+ 文件且纯属一致性收益，与 P1-09/10 的视觉改动叠加会放大回归面 |
| CSP nonce | P2-25 | 需要 nonce 注入改造与 `unsafe-inline` 移除验证，属独立安全专题 |
| 备份恢复演练 | P2-20 | 运维流程项，需真实环境执行，非代码可闭环 |
| `lunar-javascript` 版本锁定 | P2-21 | 锁 `1.7.7` 会改变依赖解析；E-3 已标注"需外部验证"该版本是否有历法错误，结论未定前不宜锁定 |

---

## 7. 应补的测试清单（按四类汇总）

### A. 金标准（外部来源 + 流派归属）

来源：E-3 报告 §F，共 **35 条**（B-01…B-35）。优先级最高的 8 条：

| ID | 输入 | 期望输出 | 流派 |
|---|---|---|---|
| B-06 | 十二节交节时刻 ±1 分钟 | 月柱在交节瞬间切换 | ziping-default `[外部]` |
| B-08 | 1986–1991 中国夏令时区间出生 | 真太阳时正确回溯 DST | 需声明 |
| B-23 | 64 卦 × 变爻穷举（4096 组合） | 变卦推导正确 | 纳甲 |
| B-24–27 | 进神/退神/化空/化破/冲合 | 各有独立结论（当前全归"动生化"） | 纳甲 |
| B-32/33 | 三引擎信封 + `inputFingerprint` | 字段齐全且有值 | 跨引擎 |
| B-34 | `lunar-javascript` 锁版 | 版本可核验 | — |
| B-35 | 节气时刻外部比对 | 与权威万年历一致 | `[外部]` |

### B. 边界

- 1900-01-01 / 2100-12-31（`solar.ts:91-93` 已拒绝边界外，但无断言）
- 闰月出生 → 排盘（`lunar.test.ts` 仅 2 用例）
- 早子时/晚子时双解（当前仅单方面选 `sect(1)`，未并列另一流派）
- 其他 11 节（目前只测立春）

### C. API 集成（E-0 最大缺口：0/23 覆盖）

| 场景 | 目标路由 | 断言 |
|---|---|---|
| 400/401/403/404/409/413/429/500 | 全部 23 个 route | `EXECUTION_GUIDE.md:88` 要求 |
| IDOR：两账号交叉读/写/删 | 4 个 `[id]` route | 返回 404 且不泄露资源存在性 |
| 限流生效 | 19 个新覆盖的 handler | 超限返回 429 + `Retry-After` |
| 伪造派生字段被忽略 | `POST /api/charts` | 服务端重算 |
| 删除级联完整性 | `POST /api/account/delete` | 删后直查库核对无残留 |

### D. E2E（Playwright）

- 六爻：列表 → 看卦 → **解读**（本轮新增入口）
- 导航：header 三术数入口可达
- 形态：`/luyao/[id]/reading` 可从列表页两步内到达

### E. 安全

本轮已补 **33 条**（578 → 611）：
- AUTH_SECRET 强度 11 条（`validate-prod.test.ts`）
- 分享存储校验 6 条（同上）
- LLM 超时 4 条（`client.test.ts`）
- 错误脱敏 7 条（`safe-error.test.ts`）
- 限流 4 条（`rate-limit.test.ts`）
- 防乱码 2 条（`validate.test.ts`）

**仍缺**：Magic Link 并发消费的**真实并发测试**（E-2 判定 PG 路径已原子，但无并发用例）、IDOR 交叉账号测试、删除级联的库级断言。

---

## 8. 如果只能做 5 件事（投入产出比最高）

| # | 事项 | 投入产出比论证 |
|---|---|---|
| **1** | **P0-04 启用 cacheComponents 修复全站动态渲染** | **唯一一项同时改善性能、成本与架构的改动**。静态路由 2→17，首页/隐私页/分享页从"每请求 SSR"变为"预渲染外壳 + 流式"。且它暴露并迫使修复了 17 处隐藏的运行时 API 误用。 |
| **2** | **P0-01 AUTH_SECRET 强度校验** | **唯一的上线阻断项**（E-2 结论）。13 行代码消除"完全账号接管"面。没有它，其他所有安全整改都可被绕过。 |
| **3** | **P0-02 分享存储生产校验** | 与 2 同批完成。修的是**静默数据丢失**——最贵的故障类型，因为用户不会收到任何错误。 |
| **4** | **P1-03/04 错误脱敏 + 全量限流** | 两项合计 20 行核心代码，同时封堵"内部结构泄露"与"枚举拖库"两个攻击面。是所有 API 安全整改中单位成本收益最高的组合。 |
| **5** | **P1-09/10 移动端可读性（十二宫 + 行长）** | **唯一直接影响"产品能不能用"的体验项**。十二宫在手机上不可读 = 紫微移动端整体失效；82 字/行的解读 = 桌面端阅读疲劳。两项合计改动 2 个组件。 |

> 若只能做 1 件：**选 #1**。它不只是性能问题——E-1 指出根布局的会话耦合"绑死了公开分享页的渲染路径"，而分享是玄学产品的核心增长路径。

---

## 9. 结论

**本轮 review 的核心判断**：项目**工程质量高于文档自称**（lint 0 warning 而非 8、611 测试而非 444/578），但**文档准确性低于代码质量**——`PROJECT_REVIEW.md:8` 的基线数字全部过时，README 的"15/18 done"缺乏复核。

**P0 的性质**：6 项 P0 中，**4 项是"整改补齐了一半"**（AUTH_SECRET 补了必填没补强度；`SHARE_STORE_DRIVER` 补了 DB/限流没补分享；云端驱动改了三个漏了一个；会话下沉从未做）。这说明**上一轮整改的验收环节失效**——正如 `REVIEW_PROMPTS.md` 附录 B 第 3 条所指出的："开发者自评不等于验收通过"。

**E-1 的独立取证值得记录**：它在不知道主 reviewer 结论的情况下，自行读取 `.next/prerender-manifest.json` 得出相同结论（仅 2 条路由），并对 `rulePriority`、`startAt`/`startYear` 两处**主动推翻了自己的初步怀疑**。这种自我纠正正是 `REVIEW_PROMPTS.md` 附录 B 第 2 条要求的"不臆断典籍依据"。

**本轮实际产出**：13 份 review 报告 + 10 个修复 commit（611 测试全绿、lint 0、tsc 0、build 成功且静态路由 17 条）。**剩余 P1/P2 项已在 §3 逐条登记状态**，其中 6 项引擎规则类问题按 §6 明确不修并说明了原因。
