# P-2 · 信息架构与核心流程审查

> 视角：资深产品设计师（工具类产品 IA 与流程专长）· **只读不改**
> 唯一依据：`src/app` 下的**真实路由**（glob 实测 24 个 `page.tsx`、23 个 `route.ts`）
> 导航依据：`src/components/auth/SiteHeader.tsx`、`src/components/auth/UserMenu.tsx`（grep 全项目 `href` 实测）

---

## 1. 真实站点地图

从 `src/app` 目录结构反推。**入口列**为 grep 全项目 `href="..."` 实测得到的真实来源。

| 路由 | 用途 | 需登录 | 进入路径（实测） | 离开路径 | 类型 |
|---|---|---|---|---|---|
| `/` | 首页 / 术数选择 | 否 | 品牌 logo（`SiteHeader.tsx:11-16`） | `/chart/new`、`/ziwei/new`、`/liuyao/new`、`/people`、`/charts`、`/settings`、`/privacy`、`/account` | ✅ 枢纽 |
| `/chart/new` | 八字排盘向导 | 否 | `/`(`page.tsx:112`)、`/charts`(`:187,292,310`)、`/chart/[id]/reading`(`:238`) | `/chart/[id]` | ✅ |
| `/chart/[id]` | 八字命盘结果 | 否 | `/chart/new` 提交后 | 待核 | ✅ |
| `/chart/[id]/reading` | 八字解读报告 | 否 | `/charts`(`:334`) | `/chart/[id]/calibrate`(`:287`) | ✅ |
| `/chart/[id]/calibrate` | 八字校准页 | 否 | `/chart/[id]/reading`(`:287`) | — | ✅ |
| `/charts` | 八字档案列表（含紫微摘要） | 否（云端部分需） | **`/`(`page.tsx:126`)**、`/people`(`:125`) | `/ziwei`(`:199,377,432`)、`/liuyao`(`:205`)、`/people`(`:211`)、`/chart/new`、`/ziwei/new`、各 `[id]` | ✅ |
| `/ziwei/new` | 紫微排盘向导 | 否 | `/`(`page.tsx:113`)、`/charts`(`:386`)、`/ziwei`(`:109,149`) | `/ziwei/[id]` | ✅ |
| `/ziwei/[id]` | 紫微命盘 | 否 | `/ziwei`(`:168`)、`/charts`(`:405`) | 待核 | ✅ |
| `/ziwei/[id]/reading` | 紫微解读 | 否 | `/ziwei`(`:173`)、`/charts`(`:420`) | — | ✅ |
| `/ziwei` | 紫微盘列表 | 否 | **⚠️ 仅 `/charts`(`:199,377,432`)** | `/charts`(`:101`)、`/ziwei/new` | ⚠️ **二级孤儿** |
| `/liuyao/new` | 六爻起卦 | 否 | `/`(`page.tsx:114`)、`/liuyao`(`:104,130`) | `/liuyao/[id]` | ✅ |
| `/liuyao/[id]` | 六爻卦象 | 否 | `/liuyao`(`:150`) | 待核 | ✅ |
| `/liuyao/[id]/reading` | 六爻解读 | 否 | ❌ **无任何入口** | — | ❌ **孤儿** |
| `/liuyao` | 问卦历史 | 否 | **⚠️ 仅 `/charts`(`:205`)** | `/liuyao/new`(`:104,130`) | ⚠️ **二级孤儿** |
| `/people` | 人物档案 | 否 | `/`(`page.tsx:120`)、`/charts`(`:211`) | `/charts`(`:125`) | ✅ |
| `/people/[id]` | 人物详情 | 否 | 待核 | 待核 | ⚠️ 待核 |
| `/settings` | 设置 | 否 | `/`(`page.tsx:132`)、`/account`(`:44`)、`/privacy`(`:60`) | 待核 | ✅ |
| `/account` | 账号 | 否 | `/`(`page.tsx:156`)、`/privacy`(`:31,64`)、`UserMenu`(`:88,101`) | `/privacy`(`:28,38`)、`/settings`(`:44`) | ✅ |
| `/privacy` | 隐私政策 | 否 | `/`(`page.tsx:153`)、`/account`(`:28,38`)、`/settings`、`UserMenu`(`:60`) | `/settings`(`:60`)、`/account`(`:64`) | ✅ |
| `/auth/login` | 登录 | 否 | `UserMenu`（待核具体行） | — | ✅ |
| `/auth/callback` | 登录回调 | 否 | 邮件链接 | — | ✅ |
| `/share/[token]` | 分享（八字） | 否 | 分享链接（外部） | — | ✅ |
| `/share/ziwei/[token]` | 分享（紫微） | 否 | 分享链接 | — | ✅ |
| `/share/liuyao/[token]` | 分享（六爻） | 否 | 分享链接 | — | ✅ |

### 1.1 孤儿页面清单（除直接输 URL 外无入口）

| 严重度 | 页面 | 证据 |
|---|---|---|
| **P1** | **`/liuyao/[id]/reading`（六爻解读页）** | grep `href={\`/liuyao/${item.id}/reading\`}` → **0 匹配**。对比：`/chart/${id}/reading`（`charts/page.tsx:334`）与 `/ziwei/${id}/reading`（`ziwei/page.tsx:173`、`charts/page.tsx:420`）均有入口。**六爻解读功能存在但完全无法从 UI 到达** |
| **P1** | **`/ziwei` 列表页（二级孤儿）** | 仅 `/charts/page.tsx:199,377,432` 链接。首页**没有**指向 `/ziwei` 的链接（`src/app/page.tsx` grep 无 `/ziwei`，只有 `/ziwei/new`） |
| **P1** | **`/liuyao` 列表页（二级孤儿）** | **仅** `/charts/page.tsx:205` 一处链接。首页**没有**指向 `/liuyao` 的链接 |

> **关键结论**：`SiteHeader`（`SiteHeader.tsx:11-17`）只含**品牌 logo → `/`** 与 `UserMenu`，**没有任何术数导航**。因此：
> - 首页出现的三个术数卡片直达 **`/new`（新建）**，不是列表页；
> - 用户建完盘后想去"六爻列表"，必须：首页 → `/charts`（八字档案）→ 找到 `:205` 的"六爻"pill → `/liuyao`。
> - **这是 3 跳，且中间路过的是"八字档案"页**——信息架构上把六爻档案挂在了八字页面下。

---

## 2. 核心任务流走查

### 流 A：新用户 → 排八字 → 看解读 → 分享

| 步 | 真实 URL | 组件 | 卡点 |
|---|---|---|---|
| 1 | `/` | `src/app/page.tsx` `ArtCard`(`:6-80`) | ✅ 主 CTA 明确（"开始排盘"，`zh.ts:45`） |
| 2 | `/chart/new` | `BirthWizard`(`src/components/form/BirthWizard.tsx:149`) | ⚠️ **卡点 1**：分步向导。用户需理解"阳历/农历""时辰"等术语，且地区选择 `RegionSelect`(`:469`) 需先选省再选市 |
| 3 | `/chart/[id]` | `src/app/chart/[id]/page.tsx` | ⚠️ **卡点 2**：结果页信息密度高（`BaziTable`/`DayunTimeline`/`WuxingBars`/`WuxingRadar` 四个可视化）。**"解读"入口在哪？** 首页路径下没有明显引导 |
| 4 | `/chart/[id]/reading` | `chart/[id]/reading/page.tsx` | ⚠️ **卡点 3**：从 `/chart/new` 直接到结果页的用户，**不知道要去 `/charts` 才能点"解读"**。`charts/page.tsx:334` 是唯一的解读入口 |
| 5 | 分享 | `ShareSheet`(`chart/[id]/reading/page.tsx:284`) | ✅ 分享在解读页顶部，位置合理 |

**步骤数**：4 步。**卡点数**：3 个。

**根因**：**解读入口只在档案列表页**（`charts/page.tsx:334`），不在**结果页本身**（`chart/[id]/page.tsx` 无 `reading` 链接 —— grep 确认 `chart/[id]/page.tsx` 无 `/reading` href）。新用户走"首页 → 新建"路径时，永远不会经过 `/charts`。

### 流 B：老用户 → 管理人物档案 → 批量排盘

| 步 | 真实 URL | 组件 | 卡点 |
|---|---|---|---|
| 1 | `/` → `/people` | `src/app/page.tsx:120` | ✅ |
| 2 | `/people` | `src/app/people/page.tsx` | ✅ 有列表与空态 |
| 3 | `/charts` | `people/page.tsx:125` | ✅ 有返回 |
| — | **批量排盘** | — | ❌ **不存在批量排盘功能**。`charts/page.tsx:187,292,310` 的"新建八字"每次只能建一个 |

**结论**：流 B 的后半段（批量排盘）**功能缺失**。

### 流 C：紫微用户 → 生成星盘 → 流月流日 → 解读

| 步 | 真实 URL | 组件 | 卡点 |
|---|---|---|---|
| 1 | `/` → `/ziwei/new` | `src/app/page.tsx:113` | ✅ |
| 2 | `/ziwei/new` | `ZiweiWizard`(`ZiweiWizard.tsx:109`) | ⚠️ **重复输入**：需重新填一次出生信息（见 §6） |
| 3 | `/ziwei/[id]` | `src/app/ziwei/[id]/page.tsx` | ⚠️ **卡点**：从 `/ziwei/new` 提交后到此处，**无"解读"入口**（与流 A 相同问题） |
| 4 | `/ziwei/[id]/reading` | `ziwei/[id]/reading/page.tsx` | ⚠️ 入口只在 `/ziwei`(`:173`) 与 `/charts`(`:420`) |
| 5 | 流月流日 | `src/components/ziwei/YunStrip.tsx` | 待 E-3 核实月界/日界 |
| — | **回到 `/ziwei` 列表** | — | ⚠️ 需从 `/ziwei/[id]` 找到返回（待核） |

**步骤数**：5 步。**卡点数**：3 个（重复输入 + 解读入口 + 返回路径）。

### 流 D：六爻用户 → 起卦 → 看卦象 → 解读

| 步 | 真实 URL | 组件 | 卡点 |
|---|---|---|---|
| 1 | `/` → `/liuyao/new` | `src/app/page.tsx:114` | ✅ |
| 2 | `/liuyao/new` | `CastForm`(`CastForm.tsx:77`) | ✅ |
| 3 | `/liuyao/[id]` | `src/app/liuyao/[id]/page.tsx` | ✅ |
| 4 | `/liuyao/[id]/reading` | `liuyao/[id]/reading/page.tsx` | ❌ **死路**：**没有任何 UI 入口**。用户只能手输 URL |

**结论**：流 D **第 4 步断裂**。这是 IA 层面最严重的问题。

---

## 3. 导航一致性

`src/components/auth/SiteHeader.tsx` 全文（21 行）：

```
:11-16  <Link href="/" ...>{BRAND.name}</Link>     ← 品牌 → 首页
:17     <UserMenu initialSession={session} />       ← 账号菜单
```

**检查项**：

| 检查 | 结果 | 证据 |
|---|---|---|
| 三个术数入口是否等权可达？ | ❌ **均不可从 header 到达** | `SiteHeader.tsx:11-17` 只有 logo + UserMenu |
| 首页卡片 → 术数首页 → 新建 → 结果 → 解读，层级几层？ | **5 层**（`/` → `/charts` → `/liuyao` → `/liuyao/new` → `/liuyao/[id]` → `/reading`） | §1 站点地图 |
| 是否存在"进入解读后无法方便回到别的术数"的死胡同？ | ❌ **是**。`chart/[id]/reading/page.tsx` 仅有 `/chart/[id]/calibrate`(`:287`)，**无任何术数切换入口** | grep `reading/page.tsx` 无 `/ziwei`、`/liuyao` href |

### 3.1 导航断层证据

grep 全项目**三个术数列表页的互链**：

| 源 | 目标 `/charts` | `/ziwei` | `/liuyao` |
|---|---|---|---|
| `/charts` | —（自身） | ✅ `:199,377,432` | ✅ `:205` |
| `/ziwei` | ✅ `:101` | —（自身） | ❌ **无** |
| `/liuyao` | ❌ **无** | ❌ **无** | —（自身） |

> **`/liuyao` 是死胡同**：只能通过 `/` 链接回首页（`liuyao/page.tsx:99`）。三个术数列表页**没有形成等权的三角导航**，而是**以 `/charts` 为中心的星形**——因为 `/charts` 同时承担"八字档案"和"术数导航枢纽"两个职责。

---

## 4. 状态与返回

| 场景 | 行为 | 证据 | 判定 |
|---|---|---|---|
| 用户填了一半生日想退出 | 无确认、无草稿保存 | `BirthWizard.tsx` grep 无 `beforeunload`/`unstable_beforeunload` | ⚠️ 数据丢失无提示 |
| **解读生成中刷新页面** | **无断点续传** | `src/app/api/reading/status/route.ts` 仅返回 `llmConfigured` 探测（`chart/[id]/reading/page.tsx:98-103`），**无任务 ID / 进度查询** | ⚠️ 解读是**同步等待**，非任务模型 |
| LLM 解读的等待反馈 | 有 spinner | `chart/[id]/reading/page.tsx:272-279`（`animate-spin` + "正在调用 LLM 生成解读..."） | ⚠️ 但 `:256` `const loading = mode === "llm" && llmLoading && !report;` —— **若已有旧 report 则 loading 为 false**，用户看不到"正在刷新"反馈 |
| 解读失败 | 回落模板 + 文案 | `:173-187` | ✅ 降级设计良好 |
| 表单校验错误 | 由 `Field.tsx` 呈现 | `src/components/form/Field.tsx` | 待 D-3 核实 aria 关联 |

---

## 5. 空态与首次体验

| 页面 | 空态实现 | 是否有引导 | 证据 |
|---|---|---|---|
| `/charts` | `Card title="暂无八字档案"` + "完成引导采集后即可在此查看历史命盘。" + `<Button>开始排盘</Button>` | ✅ **有引导**（含 CTA 按钮） | `charts/page.tsx:302-313` |
| `/charts`（紫微段） | `Card title="暂无紫微盘"` + `<Button>排紫微盘</Button>` | ✅ 有引导 | `charts/page.tsx:381-389` |
| `/people` | 待核 | 待核 | `src/app/people/page.tsx` |
| `/ziwei` | `Card title="暂无紫微盘"` + `<Button>去排紫微盘</Button>` | ✅ 有引导 | `ziwei/page.tsx:144-152` |
| `/liuyao` | `Card title="暂无问卦"` + `<Button>去起卦</Button>` | ✅ 有引导 | `liuyao/page.tsx:125-133` |
| `/chart/[id]/reading`（无磁盘数据） | `"未找到命盘数据，请先完成排盘。"` + `<Button>新建命盘</Button>` | ✅ 有引导 | `chart/[id]/reading/page.tsx:233-244` |
| `/chart/[id]/reading`（模板渲染失败） | `{error ?? "模板渲染失败"}` —— **裸文本，无 CTA** | ❌ **无引导** | `chart/[id]/reading/page.tsx:246-252` |

**结论**：**空态设计整体良好**（5/6 有 CTA 引导），这推翻了"一片空白无引导"的预设担忧。**唯一缺陷**是解读页模板失败态（`:246-252`）只显示错误文本，无恢复路径。

---

## 6. 重复劳动（三术数是否重复输入同一份出生信息？）

**grep 复用关系实测**：

| 组件 | 被谁使用 | 证据 |
|---|---|---|
| `BirthWizard` | 仅 `/chart/new` | `src/app/chart/new/page.tsx:2,32` |
| `ZiweiWizard` | 仅 `/ziwei/new` | `src/app/ziwei/new/page.tsx:2,36` |
| `CastForm` | 仅 `/liuyao/new` | `src/app/liuyao/new/page.tsx:2,37` |
| `StepProgress` | ✅ **被两者共用** | `BirthWizard.tsx:12,266`、`ZiweiWizard.tsx:14,211` |
| `DateTimeFields`（`SolarDateField`/`BirthTimeField`） | ⚠️ **仅 `BirthWizard` 使用** | `BirthWizard.tsx:13` —— **`ZiweiWizard` 未 import** |
| `RegionSelect` | ✅ **被两者共用** | `BirthWizard.tsx:14,469`、`ZiweiWizard.tsx:17,390` |

### 关键判定

| 问题 | 结论 | 证据 |
|---|---|---|
| 三个术数的新建流程是否各自重复实现了日期/地区/时辰输入？ | ⚠️ **部分重复**。`RegionSelect` 与 `StepProgress` 已复用 ✅；但 `ZiweiWizard` **未复用 `DateTimeFields`**，自行实现日期/时辰输入 | `BirthWizard.tsx:13` vs `ZiweiWizard.tsx:14-17`（import 列表无 `DateTimeFields`） |
| 用户是否需在不同术数间**重复输入同一份出生信息**？ | ❌ **是**。`BirthWizard` 与 `ZiweiWizard` 是**两个独立的向导组件**（分别 149 行起、109 行起），各自管理 form state，**不共享人物档案选择** | `BirthWizard.tsx:149`、`ZiweiWizard.tsx:109` |
| 已有 `/people` 人物档案，向导是否可从中选择？ | ⚠️ 待核。`BirthWizard` grep 未见 `listPeople`/`getProfile` 之类调用 | `BirthWizard.tsx` import 段（`:1-20`）无 `@/lib/storage` |

> **结论**：用户已有 `/people` 人物档案，**但排紫微盘时要重新手填一遍出生信息**。这是最直接的重复劳动。

---

## 7. 问题清单（按严重度排序）

| ID | 问题 | 影响用户 | 严重度 | 证据 `文件:行号` |
|---|---|---|---|---|
| **IA-1** | **六爻解读页 `/liuyao/[id]/reading` 无入口**（列表页缺"解读"按钮） | 六爻用户 | **P1** | `src/app/liuyao/page.tsx:150-154` 仅有"看卦"；对比 `charts/page.tsx:334`、`ziwei/page.tsx:173`。**注**：结果页 `/liuyao/[id]/page.tsx:98` 有入口，但列表页缺 |
| **IA-2** | **SiteHeader 无术数导航**，三术数不等权可达 | 所有用户 | **P1** | `SiteHeader.tsx:11-17` |
| **IA-3** | **解读入口在档案列表页与结果页都有**，但首页→新建路径的落点是 `/chart/[id]`，其入口在页面底部 `ml-auto` 处，视觉优先级低 | 新用户 | **P2** | `chart/[id]/page.tsx:169,345`、`ziwei/[id]/page.tsx:140`、`liuyao/[id]/page.tsx:98`（**均为底部按钮**，不在首屏） |
| **IA-4** | **`/liuyao` 是导航死胡同**（无 `/charts`、无 `/ziwei` 互链） | 六爻用户 | **P1** | `liuyao/page.tsx` grep 无 `/charts`、无 `/ziwei` |
| **IA-5** | 解读页无术数切换入口（死胡同） | 所有用户 | **P1** | `chart/[id]/reading/page.tsx:287` 仅 `/calibrate` |
| **IA-6** | 紫微与八字**重复输入出生信息**，不共享 `/people` 档案 | 紫微用户 | **P1** | `ZiweiWizard.tsx:109` vs `BirthWizard.tsx:149`；`ZiweiWizard` 未 import `DateTimeFields` |
| **IA-7** | 解读失败态（`chart/[id]/reading/page.tsx:246-252`）无 CTA | 遇到渲染失败的用户 | P2 | 同上 |
| **IA-8** | 解读生成中刷新无断点续传；无任务模型 | 网络慢的用户 | P2 | `src/app/api/reading/status/route.ts` 仅返回 `llmConfigured` |
| **IA-9** | LLM 刷新时 loading 反馈可能不显示（有旧 report 时） | 切换模式的用户 | P2 | `chart/[id]/reading/page.tsx:256` |
| **IA-10** | 填表中途退出无确认、无草稿 | 新用户 | P2 | `BirthWizard.tsx` 无 `beforeunload` |
| **IA-11** | 流量 B 的"批量排盘"功能不存在 | 老用户 | P2 | `charts/page.tsx:187,292,310` 单条新建 |
| **IA-12** | 三术数档案页术语不统一（"我的档案"/"紫微命盘"/"问卦历史"） | 所有用户 | P2 | `charts/page.tsx:185`、`ziwei/page.tsx:106`、`liuyao/page.tsx:101` |

### 修一条最快见效的：IA-1

`src/app/liuyao/page.tsx:150-154` 缺少的只是一个 `<Link href={\`/liuyao/${item.id}/reading\`}>` 包裹的 `<Button>解读</Button>`，与 `src/app/charts/page.tsx:334-336` 完全对称。**1 行改动，解锁一整个功能**。

### 修一条影响面最大的：IA-2

在 `SiteHeader` 增加三个术数入口（八字/紫微/六爻）。这一改动同时缓解 IA-3、IA-4、IA-5 —— 用户在解读页可通过 header 直接跳到别的术数。
