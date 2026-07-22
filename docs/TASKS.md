# 赛博八字 · 开发任务卡

> 依据 `docs/PRODUCT.md` 拆分，供**主 Agent 编排 + 子 Agent 并行落地**  
> 硬约束：规则与解读**最大化复用** `.claude/skills/bazi`（bazi-skill）  
> 状态：`todo` | `doing` | `blocked` | `done`  
> 优先级：P0 > P1 > P2

---

## 0. 协作约定（主 Agent 必读）

### 0.1 角色

| 角色 | 职责 |
|------|------|
| **主 Agent** | 拆任务、定接口契约、合并冲突、验收 DoD、更新本文件状态、跑全量 lint/test |
| **子 Agent-引擎** | `src/lib/bazi/**` 排盘纯函数与单测 |
| **子 Agent-解读** | `src/lib/reading/**` + API LLM，复用 skill 典籍 |
| **子 Agent-UI** | `src/app/**` + `src/components/**` 赛博国潮与双端布局 |
| **子 Agent-数据** | 本地存储、分享 API、卡片导出 |
| **子 Agent-质量** | 用例金标准、E2E 主路径、文案免责 |

### 0.2 全局接口契约（先锁后写）

所有子任务以以下类型为边界（实现时落在 `src/lib/types/`）：

```ts
// 信息收集（对齐 skill Step 1–9）
type BirthProfile = {
  id: string;
  name: string;
  formerName?: string;
  renameYear?: number | "unknown";
  solarDate?: string;       // YYYY-MM-DD
  lunarDate?: string;
  isLeapMonth?: boolean;
  birthTime?: string;       // HH:mm，可选
  shichenUnknown?: boolean;
  gender: "male" | "female";
  birthPlace?: { province: string; city: string; lng?: number; lat?: number };
  alive: boolean;
  deathYear?: number;
  analysisBaseDate: string; // 默认今天
  useTrueSolarTime: boolean; // 默认 false
};

// 确定性排盘结果（零 LLM）
type BaziChart = {
  profileId: string;
  pillars: {
    year: Pillar; month: Pillar; day: Pillar;
    hour?: Pillar | null; // 未知时 null
  };
  dayMaster: string;
  tenGods: Record<string, string>;
  hiddenStems: Record<string, string[]>;
  wuxingScores: Record<"wood"|"fire"|"earth"|"metal"|"water", number>;
  dayun: DayunStep[];
  currentDayunIndex: number;
  liunian: LiunianItem[];
  flags: string[];
  meta: { engineVersion: string; skillRef: "bazi-skill" };
};

type ReadingMode = "template" | "llm";
type ViewMode = "plain" | "pro";

type ReadingReport = {
  chartId: string;
  mode: ReadingMode;
  viewMode: ViewMode;
  sections: {
    key: "day_master"|"ten_gods"|"wuxing"|"pattern"|"dayun"|"liunian"|"calibrate"|"advice";
    title: string;
    body: string;
    citations?: string[];
  }[];
  calibratePrompts: { ageRange: string; yearHint: string; nature: string }[];
  disclaimer: string;
};
```

### 0.3 目录约定

```
src/
  app/                    # 路由与 API
  components/             # UI
  lib/
    types/                # 共享类型
    bazi/                 # 排盘引擎
      references/         # 自 skill 同步
    reading/              # 模板 + prompt
    storage/              # 本地档案
  content/                # 静态中文文案
docs/
  PRODUCT.md
  TASKS.md
.claude/skills/bazi/      # skill 权威源
```

### 0.4 并行与依赖（简图）

```
T00 工程基线 ─────────────────────────────┐
T01 类型与契约 ──┬── T10 引擎日历/四柱 ──┬── T14 引擎集成
                 ├── T11 十神藏干五行 ───┤
                 ├── T12 大运流年 ───────┤
                 └── T13 真太阳时+边界 ──┘
T20 skill 同步 ── T30 规则模板 ── T31 LLM API
T40 设计 token ── T41 表单 ── T42 命盘 ── T43 报告页
T50 本地档案 ── T51 校准 ── T52 分享+卡片
T60 金标准 ── T61 E2E ── T62 文案合规
```

**可并行波次：**

| 波次 | 任务 | 建议子角色 |
|------|------|------------|
| W0 | T00, T01, T20, T40 | 主 + 任意 |
| W1 | T10–T13, T30, T41 | 引擎 / 解读 / UI |
| W2 | T14, T31, T42, T50 | 引擎 / 解读 / UI / 数据 |
| W3 | T43, T51, T52 | UI / 数据 |
| W4 | T60–T62 | 质量 + 主验收 |

### 0.5 子 Agent Prompt 模板（复制即用）

```
你是赛博八字项目的子 Agent，只处理任务卡 {ID}。
必读：docs/PRODUCT.md、docs/TASKS.md 中该卡、.claude/skills/bazi/SKILL.md 与相关 references。
硬约束：不另创命理体系；排盘确定性；简体中文；不写无关重构。
范围：仅修改该卡「涉及路径」。
完成前：满足 DoD；说明变更文件列表与如何本地验证。
禁止：提交密钥；做账号/支付；偏离 PRODUCT 非目标。
```

---

## 1. 任务卡一览

| ID | 标题 | 优先级 | 依赖 | 波次 | 状态 |
|----|------|--------|------|------|------|
| T00 | 工程基线与脚本 | P0 | — | W0 | done |
| T01 | 共享类型与错误码 | P0 | T00 | W0 | done |
| T20 | Skill references 同步管道 | P0 | T00 | W0 | done |
| T40 | 设计 Token + 根布局 | P0 | T00 | W0 | done |
| T10 | 日历与四柱排盘 | P0 | T01,T20 | W1 | done |
| T11 | 十神/藏干/五行/干支关系 | P0 | T01,T20 | W1 | done |
| T30 | 规则模板解读（skill 章节） | P0 | T01,T20 | W1 | done |
| T41 | 落地页 + 引导采集表单 | P0 | T01,T40 | W1 | done |
| T12 | 大运与流年 | P0 | T10 | W1 | done |
| T13 | 真太阳时与边界 flags | P0 | T10 | W1 | done |
| T14 | 排盘服务集成 computeChart | P0 | T10–T13 | W2 | done |
| T31 | LLM 解读 API + 回落 | P0 | T14,T30 | W2 | done |
| T42 | 命盘可视化（通俗/专业） | P0 | T14,T40 | W2 | done |
| T50 | 本地档案 CRUD | P0 | T01 | W2 | done |
| T43 | 解读报告页双模式 | P0 | T30,T31,T42 | W3 | done |
| T51 | 历史事件校准流 | P1 | T30,T50 | W3 | done |
| T52 | 分享链接 + 图片卡片 | P1 | T14,T50 | W3 | done |
| T60 | 排盘金标准用例集 | P0 | T14 | W4 | done |
| T62 | 合规文案与全局免责 | P0 | T40 | W4 | done |
| T61 | 主路径 E2E/手工验收清单 | P1 | T43,T51,T52 | W4 | done |

---

## 2. 任务卡详情

### T00 · 工程基线与脚本

| 项 | 内容 |
|----|------|
| **目标** | 可 dev/build/lint/test；包名与 README 对齐赛博八字 |
| **涉及路径** | package.json, README.md, .env.example, vitest 配置, src/lib 骨架 |
| **依赖** | — |
| **并行** | 可与 T20/T40 并行 |
| **DoD** | npm run build 通过；npm test 占位通过；.env.example 含 LLM_*；README 指向 PRODUCT/TASKS |
| **验收** | 主 Agent 执行 build + test |
| **备注** | 包名 cyber-divination；Next 16 先读 node_modules/next/dist/docs/ |

---

### T01 · 共享类型与错误码

| 项 | 内容 |
|----|------|
| **目标** | 锁死 BirthProfile / BaziChart / ReadingReport 等 |
| **涉及路径** | src/lib/types/*.ts |
| **依赖** | T00 |
| **DoD** | 与 PRODUCT §4.3/§5 及 skill 字段对齐；统一导出 |
| **验收** | 其它任务可编译引用 |
| **备注** | 契约变更需主 Agent 评审 |

---

### T20 · Skill references 同步管道

| 项 | 内容 |
|----|------|
| **目标** | 从 .claude/skills/bazi/references 同步到运行时引用位置 |
| **涉及路径** | scripts/sync-bazi-skill.mjs, src/lib/bazi/references/**, package.json script sync:skill |
| **依赖** | T00 |
| **DoD** | npm run sync:skill 同步 4 个 md；说明 skill 为权威源 |
| **验收** | 同步结果与 skill 一致 |
| **备注** | 禁止业务手写第二套五行表 |

---

### T10 · 日历与四柱排盘

| 项 | 内容 |
|----|------|
| **目标** | 年/月/日/时柱确定性计算 |
| **涉及路径** | src/lib/bazi/calendar/**, src/lib/bazi/pillars/** |
| **依赖** | T01, T20 |
| **Skill 必读** | SKILL.md 第二阶段, shichen-table.md, wuxing-tables.md |
| **DoD** | 纯函数 buildPillars；时辰未知→时柱 null；夜子时 flag；单测≥5 组 |
| **验收** | 与万年历/金标准对照 |

---

### T11 · 十神 / 藏干 / 五行 / 干支关系

| 项 | 内容 |
|----|------|
| **目标** | 十神、藏干、五行计分、核心合冲 |
| **涉及路径** | src/lib/bazi/relations/**, src/lib/bazi/wuxing/** |
| **依赖** | T01, T20（可与 T10 并行） |
| **Skill 必读** | wuxing-tables.md |
| **DoD** | 表驱动；单测覆盖十神与藏干本气 |
| **验收** | 输出与 skill 表一致 |

---

### T12 · 大运与流年

| 项 | 内容 |
|----|------|
| **目标** | 顺逆排、起运年龄、十年步、当前大运、近 1–3 流年 |
| **涉及路径** | src/lib/bazi/dayun/** |
| **依赖** | T10 |
| **Skill 必读** | dayun-rules.md |
| **DoD** | 阳男阴女顺/阴男阳女逆；已故截断；单测起运公式 |
| **验收** | 与 skill 示例结构一致 |

---

### T13 · 真太阳时与边界 flags

| 项 | 内容 |
|----|------|
| **目标** | 可选真太阳时；节气/立春交界 flags |
| **涉及路径** | src/lib/bazi/solar-time/** |
| **依赖** | T10 |
| **DoD** | 默认关闭；开启可测；flags key 稳定 |
| **验收** | 经度偏移单测 |

---

### T14 · 排盘服务集成

| 项 | 内容 |
|----|------|
| **目标** | 统一 computeChart(profile): BaziChart |
| **涉及路径** | src/lib/bazi/index.ts, 可选 src/app/api/chart/route.ts |
| **依赖** | T10–T13 |
| **DoD** | 同输入 deep equal；meta.skillRef 固定 |
| **验收** | 集成测试 1 条完整盘 |

---

### T30 · 规则模板解读

| 项 | 内容 |
|----|------|
| **目标** | 无 LLM 生成 8 章报告 + 3–5 校准题 |
| **涉及路径** | src/lib/reading/template/**, src/lib/reading/sections.ts |
| **依赖** | T01, T20（可用 mock chart） |
| **Skill 必读** | SKILL.md 第三阶段, classical-texts.md |
| **DoD** | renderTemplateReading；8 section keys；disclaimer |
| **验收** | mock 盘章节齐全 |

---

### T31 · LLM 解读 API + 回落

| 项 | 内容 |
|----|------|
| **目标** | 服务端 OpenAI 兼容代理；失败回落 T30 |
| **涉及路径** | src/app/api/reading/route.ts, src/lib/reading/llm/** |
| **依赖** | T14, T30 |
| **Skill 必读** | SKILL.md 注意事项, classical-texts.md |
| **DoD** | Key 不暴露客户端；失败 fallback:true |
| **验收** | 无 Key→template；有 Key→llm |

---

### T40 · 设计 Token + 根布局

| 项 | 内容 |
|----|------|
| **目标** | 赛博国潮：暗底、金/电青、基础组件 |
| **涉及路径** | src/app/globals.css, layout.tsx, src/components/ui/** |
| **依赖** | T00 |
| **DoD** | CSS 变量；lang=zh-CN；Button/Card；双端安全区 |
| **验收** | 暗色主题一致 |

---

### T41 · 落地页 + 引导采集表单

| 项 | 内容 |
|----|------|
| **目标** | / 与 /chart/new 分步采集，对齐 skill Step 1–9 |
| **涉及路径** | src/app/page.tsx, src/app/chart/new/**, src/components/form/** |
| **依赖** | T01, T40 |
| **DoD** | 阳历农历至少其一；性别必填；时辰可跳过；确认可改 |
| **验收** | 双端走完表单 |

---

### T42 · 命盘可视化

| 项 | 内容 |
|----|------|
| **目标** | /chart/[id] 四柱/五行/大运/流年 + 通俗专业切换 |
| **涉及路径** | src/app/chart/[id]/**, src/components/chart/** |
| **依赖** | T14, T40, T50 |
| **DoD** | 桌面双栏移动单栏；未知时柱；flags 提示 |
| **验收** | 金标准盘可读 |

---

### T43 · 解读报告页双模式

| 项 | 内容 |
|----|------|
| **目标** | /chart/[id]/reading 模板/LLM 切换 |
| **涉及路径** | src/app/chart/[id]/reading/**, src/components/reading/** |
| **依赖** | T30, T31, T42 |
| **DoD** | 8 章；加载态；fallback 提示；结束固定句 |
| **验收** | 无 Key 仍完整可读 |

---

### T50 · 本地档案 CRUD

| 项 | 内容 |
|----|------|
| **目标** | 本地存 profile+chart+report；列表 |
| **涉及路径** | src/lib/storage/**, src/app/charts/** |
| **依赖** | T01 |
| **DoD** | 增删改查；预留 userId；刷新不丢 |
| **验收** | 刷新后最近档案仍在 |

---

### T51 · 历史事件校准流

| 项 | 内容 |
|----|------|
| **目标** | /calibrate 反馈与报告侧重调整 |
| **涉及路径** | src/app/chart/[id]/calibrate/**, src/lib/reading/calibrate.ts |
| **依赖** | T30, T50 |
| **DoD** | 3–5 题；本地保存；不重算四柱 |
| **验收** | 反馈后文案侧重可感知 |

---

### T52 · 分享链接 + 图片卡片

| 项 | 内容 |
|----|------|
| **目标** | 分享快照页 + 四柱卡片图 |
| **涉及路径** | src/app/api/share/**, src/app/share/[token]/**, src/components/share/** |
| **依赖** | T14, T50 |
| **DoD** | token 难枚举；免责；卡片含四柱+签语 |
| **验收** | 无登录可打开分享链 |

---

### T60 · 排盘金标准用例集

| 项 | 内容 |
|----|------|
| **目标** | 固化对照用例防回归 |
| **涉及路径** | src/lib/bazi/__fixtures__/**, **/*.test.ts |
| **依赖** | T14 |
| **DoD** | ≥8 例（立春附近/夜子时/未知时辰/男女顺逆）；CI 可跑 |
| **验收** | npm test 全绿 |

---

### T61 · 主路径验收清单

| 项 | 内容 |
|----|------|
| **目标** | docs/QA.md + 可选 e2e |
| **涉及路径** | docs/QA.md, 可选 e2e/** |
| **依赖** | T43, T51, T52 |
| **DoD** | 覆盖 PRODUCT §9；主 Agent 勾选通过 |
| **验收** | 双端清单走通 |

---

### T62 · 合规文案与全局免责

| 项 | 内容 |
|----|------|
| **目标** | 全局 disclaimer；健康/财务提示；skill 结束语 |
| **涉及路径** | src/content/zh.ts, src/components/Disclaimer.tsx |
| **依赖** | T40 |
| **DoD** | 落地/报告/分享三处可见 |
| **验收** | 无绝对化承诺 |

---

## 3. 主 Agent 每日编排清单

1. 更新 TASKS.md 状态  
2. 每次子 Agent 领 1 张主卡（或无冲突的 2 张）  
3. 合并前：npm run lint / test / build  
4. 类型契约变更走 T01  
5. 与 skill 不一致时以 skill references 为准  

---

## 4. 建议首派（Kickoff）

T00 完成后第一批并行：

1. **子-引擎**：T10（可 scaffold T11 表常量）  
2. **子-解读**：T20 + T30（mock chart）  
3. **子-UI**：T40 + T41  

第二批：T12/T13 → T14；T31；T42+T50。

---

## 5. 项目级 MVP Done

- [x] 专业排盘可复现 + T60 绿  
- [x] 表单→命盘→模板解读→校准→分享 全通  
- [x] LLM 可选且可回落  
- [x] 赛博国潮双端可用  
- [x] 免责到位  
- [x] 无账号完整体验  

---

## 6. Post-MVP 协作约定（主 Agent 必读）

> 依据 `docs/PRODUCT.md` §12。MVP 卡 T00–T62 已 done。  
> 本段供主 Agent **调度 / 决策 / 汇总**，子 Agent **一次只领 1 张卡**。

### 6.1 角色扩展

| 角色 | 职责 | 典型卡 |
|------|------|--------|
| **主 Agent** | 拆卡、锁契约、合并冲突、验收 DoD、更新本文件状态、全量 lint/test/build | 全部 |
| **子-平台** | 分享存储、限流、观测、部署文档 | T70–T73 |
| **子-账号** | auth、云端同步、迁移、隐私页 | T80–T84 |
| **子-八字深化** | 格局/合化/性别六亲/分享图/雷达 | T90–T96 |
| **子-紫微引擎** | `src/lib/ziwei/**` 确定性排盘 + 金标准 | T100–T104 |
| **子-紫微产品** | 紫微 UI / 解读 / 档案挂接 | T105–T109 |
| **子-六爻引擎** | `src/lib/liuyao/**` 装卦 + 金标准 | T110–T113 |
| **子-六爻产品** | 起卦 UI / 解卦 / 问卦列表 | T114–T117 |
| **子-跨术数** | 首页入口、人物档案、合参 | T120–T123 |
| **子-增长** | 额度/可选会员（P5，可延后） | T130–T132 |
| **子-质量** | 回归金标准、E2E、合规文案 | 各阶段收尾卡 |
| **子-解读体验** | 报告 UI、签语/建议空内容、LLM 开关体验 | T140–T143 |
| **子-调研** | 紫微/六爻开源与典籍资料调研，输出选型备忘 | T150–T151 |

### 6.2 硬约束（全体子 Agent）

1. **排盘/装卦零 LLM**：紫微、六爻与八字一样，结果必须确定性、可单测。  
2. **解读**：模板 + LLM 双模式；LLM 失败回落模板；Key 仅服务端。  
3. **不另创命理体系**：规则来自 references/skill/经典摘要，禁止随意断语。  
4. **简体中文**；免责与 skill 注意事项语气不变。  
5. **范围纪律**：只改该卡「涉及路径」；契约变更先走对应 Txx 类型卡并由主 Agent 评审。  
6. **禁止**：提交密钥、做支付（除非 T130+ 明确开启）、恐吓式断语、医疗/投资绝对断言。  
7. **完成回报**：变更文件列表 + 本地验证命令 + 未决风险；由主 Agent 勾 DoD。

### 6.3 子 Agent Prompt 模板（Post-MVP）

```
你是赛博命理项目的子 Agent，只处理任务卡 {ID}。
必读：docs/PRODUCT.md（含 §12 路线图）、docs/TASKS.md 中该卡详情。
若涉及八字：.claude/skills/bazi/SKILL.md 与 references。
若涉及紫微/六爻：该卡注明的 references 或「先锁规则来源再写引擎」。
硬约束：排盘/装卦确定性；解读可回落；简体中文；不写无关重构。
范围：仅修改该卡「涉及路径」。
完成前：满足 DoD；列出变更文件与验证步骤。
禁止：提交密钥；越权做其它卡；偏离 PRODUCT 非目标。
```

### 6.4 全局接口契约（Post-MVP 增量，落在 `src/lib/types/`）

主 Agent 在开对应波次前锁死；实现以类型文件为准。

```ts
// —— 人物与账号（P1）——
type UserId = string;
type PersonId = string; // 同一人生辰主体，可挂八字/紫微多盘

type User = {
  id: UserId;
  email?: string;
  displayName?: string;
  createdAt: string;
};

type Person = {
  id: PersonId;
  userId?: UserId | null; // null = 仅本地
  name: string;
  gender?: "male" | "female";
  // 复用 BirthProfile 生辰字段子集
  solarDate?: string;
  lunarDate?: string;
  birthTime?: string;
  birthPlace?: BirthPlace;
};

// —— 紫微（P2）——
type ZiweiChart = {
  id: string;
  personId?: PersonId;
  profileId?: string; // 可关联八字 profile
  palaces: ZiweiPalace[]; // 十二宫
  mingGong: string;
  shenGong: string;
  majorStars: Record<string, string[]>; // 宫 -> 主星
  daxian: { startAge: number; endAge: number; palace: string }[];
  flags: string[];
  meta: { engineVersion: string; skillRef: string };
};

// —— 六爻（P3）——
type LiuyaoMethod = "coins" | "time" | "manual";
type LiuyaoChart = {
  id: string;
  userId?: UserId | null;
  question: string;
  method: LiuyaoMethod;
  lines: { yao: 1|2|3|4|5|6; value: 6|7|8|9; changing: boolean }[];
  benGua: { name: string; upper: string; lower: string };
  bianGua?: { name: string; upper: string; lower: string };
  shiYao: number;
  yingYao: number;
  yongShen?: string;
  meta: { engineVersion: string };
};

// —— 分享存储抽象（P0）——
interface ShareStore {
  save(snapshot: ShareSnapshot): Promise<void>;
  get(token: string): Promise<ShareSnapshot | null>;
  delete?(token: string): Promise<void>;
}
```

### 6.5 并行波次与依赖

```
MVP done
   │
   ▼
W5  T70–T73 生产加固 ─────────────────────────────┐
   │                                                │
   ├──────────────┬─────────────────────────────────┤
   ▼              ▼                                 ▼
W6 T80–T84 账号   W7 T90–T96 八字深化（可与 W6 并行）
   │              │
   ├──────────────┤
   ▼              ▼
W8 T100–T109 紫微（建议账号后）   或   W9 T110–T117 六爻
   │                                    │
   └────────────────┬───────────────────┘
                    ▼
              W10 T120–T123 跨术数
                    ▼
              W11 T130–T132 增长（可选）
```

| 波次 | 任务 | 建议并行角色 | 主 Agent 决策点 |
|------|------|--------------|-----------------|
| **W5** | T70–T73 | 平台 ×2–3 | 分享后端选型（KV/DB） |
| **W6** | T80–T84 | 账号 + UI | 登录提供商（Magic Link / OAuth） |
| **W7** | T90–T96 | 八字引擎 + 解读 + UI | 与 W6 无路径冲突可并行 |
| **W8** | T100–T109 | 紫微引擎 + 产品 | **先紫微还是先六爻**（PRODUCT §12.9） |
| **W9** | T110–T117 | 六爻引擎 + 产品 | 同上 |
| **W10** | T120–T123 | UI + 数据 | 品牌文案「赛博命理」是否启用 |
| **W11** | T130–T132 | 增长 | 是否做付费（默认可跳过） |

### 6.6 主 Agent 每日编排清单（Post-MVP）

1. 更新本文件状态（`todo`→`doing`→`done`/`blocked`）  
2. 每子 Agent 只领 **1 张**主卡（无冲突时可 2 张）  
3. 合并前：`npm run lint` / `test` / `build`  
4. 契约变更：先合并类型卡，再开依赖卡  
5. 与 skill/references 冲突时以权威规则源为准  
6. blocked 时记录阻塞原因与解阻卡 ID  
7. 阶段结束跑对应「收尾质量卡」再进下一波次  

---

## 7. Post-MVP 任务卡一览

| ID | 标题 | 优先级 | 依赖 | 波次 | 状态 |
|----|------|--------|------|------|------|
| **W5 生产加固** |
| T70 | 分享存储抽象 + 持久后端 | P0 | MVP | W5 | done |
| T71 | API 全局限流与观测 | P0 | MVP | W5 | done |
| T72 | 部署与运维文档 | P0 | T70 | W5 | done |
| T73 | 生产冒烟与回滚清单 | P0 | T70,T71 | W5 | done |
| **W6 账号** |
| T80 | Auth 契约与会话模型 | P0 | T70 | W6 | done |
| T81 | 登录/回调/登出 UI 与 API | P0 | T80 | W6 | done |
| T82 | 云端档案 CRUD + 同步 | P0 | T81 | W6 | done |
| T83 | 本地→云端迁移与合并 | P0 | T82 | W6 | done |
| T84 | 隐私政策/导出删除账号 | P1 | T81 | W6 | done |
| **W7 八字深化** |
| T90 | 格局成格/败格规则增强 | P1 | MVP | W7 | done |
| T91 | 合化条件与关系展示 | P1 | MVP | W7 | done |
| T92 | 调候表扩展（穷通摘要） | P1 | MVP | W7 | done |
| T93 | 解读分性别六亲 | P1 | MVP | W7 | done |
| T94 | 起运岁+月 UI 展示 | P1 | MVP | W7 | done |
| T95 | 分享 PNG/OG 图 | P1 | T70 | W7 | done |
| T96 | 五行雷达 + 体验打磨 | P2 | MVP | W7 | done |
| **W8 紫微** |
| T100 | 紫微类型契约 + 规则源 | P0 | T70 | W8 | done |
| T101 | 紫微排盘引擎·十二宫主星 | P0 | T100 | W8 | done |
| T102 | 紫微大限/流年 | P0 | T101 | W8 | done |
| T103 | 紫微金标准用例 | P0 | T101,T102 | W8 | done |
| T104 | 紫微模板解读 + LLM | P0 | T101,T30 模式 | W8 | done |
| T105 | 紫微采集与命盘 UI | P0 | T101,T40 | W8 | done |
| T106 | 紫微报告页 | P0 | T104,T105 | W8 | done |
| T107 | 紫微本地/云端档案 | P1 | T105,T82? | W8 | done |
| T108 | 紫微分享只读页 | P1 | T70,T105 | W8 | done |
| T109 | 紫微阶段验收清单 | P0 | T103,T106 | W8 | done |
| **W9 六爻** |
| T110 | 六爻类型契约 + 卦辞数据 | P0 | T70 | W9 | done |
| T111 | 装卦引擎（铜钱/时间/手动） | P0 | T110 | W9 | done |
| T112 | 世应/用神/动变爻 | P0 | T111 | W9 | done |
| T113 | 六爻金标准用例 | P0 | T111,T112 | W9 | done |
| T114 | 六爻解卦模板 + LLM | P0 | T112 | W9 | done |
| T115 | 起卦与结果 UI | P0 | T111,T40 | W9 | done |
| T116 | 问卦历史列表 | P1 | T115,T82? | W9 | done |
| T117 | 六爻阶段验收清单 | P0 | T113,T115 | W9 | done |
| **W10 跨术数** |
| T120 | 首页多术数入口与 IA | P1 | T105 或 T115 | W10 | done |
| T121 | Person 统一档案模型 | P1 | T80,T107 或 八字 | W10 | done |
| T122 | 一人多盘列表 UI | P1 | T121 | W10 | done |
| T123 | 八字×紫微合参摘要（可选） | P2 | T122,T106 | W10 | cancel |
| **W11 增长（可选）** |
| T130 | LLM 额度与用量统计 | P2 | T81,T71 | W11 | cancel |
| T131 | 可选会员/权益开关 | P2 | T130 | W11 | cancel |
| T132 | 免费排盘底线守卫测试 | P1 | T131 | W11 | cancel |

> `T82?` 表示「有账号则接云端，无账号则仅本地」——主 Agent 按是否完成 W6 裁剪。

---

## 8. Post-MVP 任务卡详情

### W5 · 生产加固

#### T70 · 分享存储抽象 + 持久后端

| 项 | 内容 |
|----|------|
| **目标** | 去掉对本地 `data/shares.json` 的生产依赖；可插拔 ShareStore |
| **涉及路径** | `src/lib/share-store.ts`、`src/lib/share/**`、`src/app/api/share/**`、`.env.example` |
| **依赖** | MVP |
| **主决策** | **已拍板：Upstash Redis（生产）+ LocalFile（开发）**。`SHARE_STORE_DRIVER=local|upstash`；生产缺云配置 fail-fast。可选 `SHARE_TTL_SECONDS`。 |
| **DoD** | `ShareStore` 接口；至少 1 个云实现 + 1 个 local dev 实现；同 token 跨进程可读；文档说明 |
| **验收** | 模拟冷启动后仍能 GET 分享页 |
| **子角色** | 平台 |

#### T71 · API 全局限流与观测

| 项 | 内容 |
|----|------|
| **目标** | `/api/reading`、`/api/share` 等可配置限流；LLM 调用可观测 |
| **涉及路径** | `src/lib/api/**`、`src/app/api/**`、可选日志适配 |
| **依赖** | MVP（可与 T70 并行） |
| **DoD** | 超限 429；结构化日志含 requestId/耗时/fallback；无 Key 泄露 |
| **验收** | 压测脚本或手工连续请求触发 429 |
| **子角色** | 平台 |

#### T72 · 部署与运维文档

| 项 | 内容 |
|----|------|
| **目标** | 他人可按文档部署 |
| **涉及路径** | `docs/DEPLOY.md`、`.env.example`、README 链接 |
| **依赖** | T70 |
| **DoD** | 环境变量表、分享后端配置、备份/删除分享策略、回滚步骤 |
| **验收** | 主 Agent 按文档 dry-run 通过 |
| **子角色** | 平台 |

#### T73 · 生产冒烟与回滚清单

| 项 | 内容 |
|----|------|
| **目标** | 上线检查表 |
| **涉及路径** | `docs/QA.md` 增补「生产冒烟」 |
| **依赖** | T70, T71 |
| **DoD** | 排盘/解读/分享/404 冒烟步骤；失败回滚条件 |
| **验收** | 主 Agent 勾选通过 |
| **子角色** | 质量 + 主 |

---

### W6 · 账号体系

#### T80 · Auth 契约与会话模型

| 项 | 内容 |
|----|------|
| **目标** | 锁死 User/Session/Person 类型与错误码 |
| **涉及路径** | `src/lib/types/**`、`src/lib/auth/types.ts` |
| **依赖** | T70（生产环境就绪更佳） |
| **主决策** | Auth 方案：Auth.js / Clerk / 自建 Magic Link |
| **DoD** | 类型导出；与现有 BirthProfile 关联字段；匿名 userId 规则 |
| **验收** | 其它账号卡可编译引用 |
| **子角色** | 账号（主 Agent 评审契约） |

#### T81 · 登录/回调/登出 UI 与 API

| 项 | 内容 |
|----|------|
| **目标** | 可完成登录与登出 |
| **涉及路径** | `src/app/auth/**`、`src/app/api/auth/**`、`src/components/auth/**`、layout 用户入口 |
| **依赖** | T80 |
| **DoD** | 登录页、回调、登出；未登录可继续本地排盘；会话 Cookie/JWT 安全 |
| **验收** | 双端走通登录→首页显示已登录 |
| **子角色** | 账号 + UI |

#### T82 · 云端档案 CRUD + 同步

| 项 | 内容 |
|----|------|
| **目标** | 登录用户八字 profile/chart/report/calibrate 云端读写 |
| **涉及路径** | `src/lib/storage/**`、`src/app/api/charts/**`、DB schema |
| **依赖** | T81 |
| **DoD** | 列表/详情/删除 API；客户端同步策略文档；权限仅本人 |
| **验收** | 换浏览器登录可见同一档案 |
| **子角色** | 账号 + 数据 |

#### T83 · 本地→云端迁移与合并

| 项 | 内容 |
|----|------|
| **目标** | 首次登录合并 localStorage 档案 |
| **涉及路径** | `src/lib/storage/migrate.ts`、登录后引导 UI |
| **依赖** | T82 |
| **DoD** | 不丢盘；冲突策略明确（按 id / 按时间）；可跳过 |
| **验收** | 预置本地盘→登录→云端可见 |
| **子角色** | 账号 |

#### T84 · 隐私政策/导出删除账号

| 项 | 内容 |
|----|------|
| **目标** | 合规最小集 |
| **涉及路径** | `src/app/privacy/**`、`src/app/account/**`、导出 API |
| **依赖** | T81 |
| **DoD** | 隐私页、导出 JSON、删除账号及云端数据 |
| **验收** | 删除后 API 404 |
| **子角色** | 账号 + UI |

---

### W7 · 八字深化（补当前实现缺口）

#### T90 · 格局成格/败格规则增强

| 项 | 内容 |
|----|------|
| **目标** | 超越「月令十神贴标签」；输出成格/有病/破象可解释字段 |
| **涉及路径** | `src/lib/reading/template/analyze.ts`、`constants.ts`、单测 |
| **依赖** | MVP |
| **Skill** | classical-texts、子平真诠摘要 |
| **DoD** | 透干、用神有根、伤官见官等可测规则；报告 pattern 章引用 |
| **验收** | ≥5 组格局单测 |
| **子角色** | 八字深化-解读 |

#### T91 · 合化条件与关系展示

| 项 | 内容 |
|----|------|
| **目标** | 合见 vs 合化区分；UI 展示 |
| **涉及路径** | `src/lib/bazi/relations/**`、`RelationsPanel` |
| **依赖** | MVP |
| **DoD** | 得令/得地条件表驱动；标签区分「合绊/合化」 |
| **验收** | 单测 + 命盘页可见 |
| **子角色** | 八字深化-引擎 |

#### T92 · 调候表扩展

| 项 | 内容 |
|----|------|
| **目标** | 扩大日干×月令调候覆盖 |
| **涉及路径** | `src/lib/reading/template/constants.ts`、references 摘要 |
| **依赖** | MVP |
| **DoD** | 覆盖常见 60 组以上或文档说明覆盖率；正文强制引用一行 |
| **验收** | 抽样与穷通原则一致 |
| **子角色** | 八字深化-解读 |

#### T93 · 解读分性别六亲

| 项 | 内容 |
|----|------|
| **目标** | 模板/LLM 注入 gender；六亲与感情建议分支 |
| **涉及路径** | `src/lib/reading/**`、`BirthProfile` 传入链路 |
| **依赖** | MVP |
| **DoD** | 男/女命文案不同；LLM prompt 含性别 |
| **验收** | 同盘改性别，十神/建议章可区分 |
| **子角色** | 八字深化-解读 |

#### T94 · 起运岁+月 UI

| 项 | 内容 |
|----|------|
| **目标** | 展示 `startAgeDetail`（引擎已有） |
| **涉及路径** | `DayunTimeline`、命盘侧栏、报告大运章 |
| **依赖** | MVP |
| **DoD** | 文案如「约 X 岁 Y 个月起运」；起运前小运步可见 |
| **验收** | 金标准盘 UI 截图/手工 |
| **子角色** | UI |

#### T95 · 分享 PNG/OG 图

| 项 | 内容 |
|----|------|
| **目标** | 真图片导出 + 可选 OG meta |
| **涉及路径** | `src/components/share/**`、`src/app/share/**`、可选 `@vercel/og` |
| **依赖** | T70 |
| **DoD** | PNG 或稳定 SVG→栅格方案；分享页 Open Graph |
| **验收** | 下载文件可打开；链接预览有图（若平台支持） |
| **子角色** | UI + 平台 |

#### T96 · 五行雷达 + 体验打磨

| 项 | 内容 |
|----|------|
| **目标** | PRODUCT 雷达；表单/a11y 残余 |
| **涉及路径** | `WuxingBars` 或新组件、表单 a11y |
| **依赖** | MVP |
| **DoD** | 通俗模式可见雷达；主要控件 aria 齐全 |
| **验收** | 双端无布局崩 |
| **子角色** | UI |

---

### W8 · 紫微斗数

#### T100 · 紫微类型契约 + 规则源

| 项 | 内容 |
|----|------|
| **目标** | 锁 `ZiweiChart` 等类型；确定规则来源（库/表/skill） |
| **涉及路径** | `src/lib/types/ziwei.ts`、`src/lib/ziwei/references/README.md` |
| **依赖** | T70 |
| **主决策** | 采用开源排盘库二次封装 vs 自研表；流派说明 |
| **DoD** | 类型合并导出；规则权威源文档；禁止 LLM 排盘写明 |
| **验收** | 主 Agent 评审通过 |
| **子角色** | 紫微引擎 + 主 |

#### T101 · 紫微排盘引擎·十二宫主星

| 项 | 内容 |
|----|------|
| **目标** | `computeZiweiChart(input)` 确定性 |
| **涉及路径** | `src/lib/ziwei/**` |
| **依赖** | T100 |
| **DoD** | 十二宫、命宫身宫、主星落宫；纯函数；同输入 deep equal |
| **验收** | 与选定金标准源对照 ≥5 例 |
| **子角色** | 紫微引擎 |

#### T102 · 紫微大限/流年

| 项 | 内容 |
|----|------|
| **目标** | 大限序列 + 当前限/流年 |
| **涉及路径** | `src/lib/ziwei/daxian/**` 等 |
| **依赖** | T101 |
| **DoD** | 结构稳定；已故/基准日边界 |
| **验收** | 单测 |
| **子角色** | 紫微引擎 |

#### T103 · 紫微金标准用例

| 项 | 内容 |
|----|------|
| **目标** | 防回归 |
| **涉及路径** | `src/lib/ziwei/__fixtures__/**` |
| **依赖** | T101, T102 |
| **DoD** | ≥8 例；npm test 绿 |
| **验收** | CI 可跑 |
| **子角色** | 质量 + 引擎 |

#### T104 · 紫微模板解读 + LLM

| 项 | 内容 |
|----|------|
| **目标** | 固定章节报告；LLM 回落 |
| **涉及路径** | `src/lib/reading/ziwei/**`、`src/app/api/reading/ziwei/**`（或统一 reading 带 kind） |
| **依赖** | T101 |
| **DoD** | 章节 key 稳定；免责；失败 fallback |
| **验收** | 无 Key 完整可读 |
| **子角色** | 紫微产品-解读 |

#### T105 · 紫微采集与命盘 UI

| 项 | 内容 |
|----|------|
| **目标** | `/ziwei/new`、`/ziwei/[id]` |
| **涉及路径** | `src/app/ziwei/**`、`src/components/ziwei/**` |
| **依赖** | T101, T40 模式 |
| **DoD** | 复用生辰字段；宫位盘+星曜；赛博国潮 |
| **验收** | 双端可读 |
| **子角色** | 紫微产品-UI |

#### T106 · 紫微报告页

| 项 | 内容 |
|----|------|
| **目标** | `/ziwei/[id]/reading` |
| **涉及路径** | 同上 + reading 组件复用 |
| **依赖** | T104, T105 |
| **DoD** | 模板/LLM 切换；加载与 fallback |
| **验收** | 主路径通 |
| **子角色** | 紫微产品-UI |

#### T107 · 紫微本地/云端档案

| 项 | 内容 |
|----|------|
| **目标** | 存储与列表 |
| **涉及路径** | storage 扩展、`/charts` 或 `/ziwei` 列表 |
| **依赖** | T105；（云端）T82 |
| **DoD** | 本地必做；登录则同步 |
| **验收** | 刷新不丢 |
| **子角色** | 数据 |

#### T108 · 紫微分享只读页

| 项 | 内容 |
|----|------|
| **目标** | 复用 ShareStore |
| **涉及路径** | share API 扩展 kind、分享页 |
| **依赖** | T70, T105 |
| **DoD** | 脱敏；免责 |
| **验收** | 无登录可打开 |
| **子角色** | 平台 + UI |

#### T109 · 紫微阶段验收清单

| 项 | 内容 |
|----|------|
| **目标** | 阶段 Done |
| **涉及路径** | `docs/QA.md` 紫微章节 |
| **依赖** | T103, T106 |
| **DoD** | 对照 PRODUCT §12.5 验收 |
| **验收** | 主 Agent 勾选 |
| **子角色** | 质量 + 主 |

---

### W9 · 六爻占卜

#### T110 · 六爻类型契约 + 卦辞数据

| 项 | 内容 |
|----|------|
| **目标** | 锁 `LiuyaoChart`；六十四卦/爻辞表 |
| **涉及路径** | `src/lib/types/liuyao.ts`、`src/lib/liuyao/data/**` |
| **依赖** | T70 |
| **DoD** | 数据完整可引用；来源注明 |
| **验收** | 类型评审通过 |
| **子角色** | 六爻引擎 + 主 |

#### T111 · 装卦引擎

| 项 | 内容 |
|----|------|
| **目标** | 铜钱/时间/手动 → 六爻 |
| **涉及路径** | `src/lib/liuyao/cast/**` |
| **依赖** | T110 |
| **DoD** | 三种 method；手动可复现；随机铜钱可种子化测试 |
| **验收** | 单测 |
| **子角色** | 六爻引擎 |

#### T112 · 世应/用神/动变爻

| 项 | 内容 |
|----|------|
| **目标** | 解卦结构化字段 |
| **涉及路径** | `src/lib/liuyao/analyze/**` |
| **依赖** | T111 |
| **DoD** | 本卦变卦、世应、动爻列表；用神规则表驱动（可先简化） |
| **验收** | 单测 |
| **子角色** | 六爻引擎 |

#### T113 · 六爻金标准

| 项 | 内容 |
|----|------|
| **目标** | ≥8 例装卦+结构 |
| **涉及路径** | `src/lib/liuyao/__fixtures__/**` |
| **依赖** | T111, T112 |
| **DoD** | npm test 绿 |
| **验收** | CI |
| **子角色** | 质量 |

#### T114 · 解卦模板 + LLM

| 项 | 内容 |
|----|------|
| **目标** | 针对「所问」的报告；易理 Prompt |
| **涉及路径** | `src/lib/reading/liuyao/**`、API |
| **依赖** | T112 |
| **DoD** | 固定章节；强调一事一问；fallback |
| **验收** | 无 Key 可读 |
| **子角色** | 六爻产品-解读 |

#### T115 · 起卦与结果 UI

| 项 | 内容 |
|----|------|
| **目标** | `/liuyao/new`、`/liuyao/[id]` |
| **涉及路径** | `src/app/liuyao/**`、`src/components/liuyao/**` |
| **依赖** | T111, T40 |
| **DoD** | 事项输入、method 选择、卦象可视化 |
| **验收** | 双端主路径 |
| **子角色** | 六爻产品-UI |

#### T116 · 问卦历史列表

| 项 | 内容 |
|----|------|
| **目标** | 历史问卦 |
| **涉及路径** | storage / API / 列表页 |
| **依赖** | T115；（云端）T82 |
| **DoD** | 本地必做；登录同步可选 |
| **验收** | 刷新仍在 |
| **子角色** | 数据 |

#### T117 · 六爻阶段验收清单

| 项 | 内容 |
|----|------|
| **目标** | 对照 PRODUCT §12.6 |
| **涉及路径** | `docs/QA.md` |
| **依赖** | T113, T115 |
| **DoD** | 主 Agent 勾选 |
| **子角色** | 质量 + 主 |

---

### W10 · 跨术数

#### T120 · 首页多术数入口与 IA

| 项 | 内容 |
|----|------|
| **目标** | 八字/紫微/六爻入口；品牌可切换文案 |
| **涉及路径** | `src/app/page.tsx`、`src/content/zh.ts` |
| **依赖** | T105 或 T115 至少一个 |
| **DoD** | 未上线术数可「即将推出」灰显 |
| **验收** | 导航可达已上线术数 |
| **子角色** | UI |

#### T121 · Person 统一档案模型

| 项 | 内容 |
|----|------|
| **目标** | 一生辰主体挂多盘 |
| **涉及路径** | types、storage/API |
| **依赖** | T80；已有八字/紫微档案 |
| **DoD** | Person CRUD；关联 chart ids |
| **验收** | 类型与 API 测通 |
| **子角色** | 数据 + 主契约 |

#### T122 · 一人多盘列表 UI

| 项 | 内容 |
|----|------|
| **目标** | 人物下看八字/紫微盘 |
| **涉及路径** | `src/app/people/**` 或扩展 `/charts` |
| **依赖** | T121 |
| **DoD** | 列表/详情入口 |
| **验收** | 手工走通 |
| **子角色** | UI |

#### T123 · 八字×紫微合参摘要（可选）

| 项 | 内容 |
|----|------|
| **目标** | 谨慎合参一段话 |
| **涉及路径** | reading 合参模板 |
| **依赖** | T122, T106 |
| **DoD** | 不互相恐吓；标明两套体系 |
| **验收** | 文案评审 |
| **子角色** | 解读 |
| **备注** | 主 Agent 可判 cancel |

---

### W11 · 增长（可选，默认可整波 cancel）

#### T130 · LLM 额度与用量统计

| 项 | 内容 |
|----|------|
| **目标** | 登录用户 LLM 次数计数 |
| **涉及路径** | API + DB |
| **依赖** | T81, T71 |
| **DoD** | 超额提示并回落模板；排盘永不因额度失败 |
| **验收** | 单测/手工 |
| **子角色** | 增长 |

#### T131 · 可选会员/权益开关

| 项 | 内容 |
|----|------|
| **目标** | 特性开关，不接支付也可 mock |
| **涉及路径** | flags、account UI |
| **依赖** | T130 |
| **DoD** | 文档说明；默认关闭付费 |
| **验收** | 开关可测 |
| **子角色** | 增长 |
| **备注** | **不含真实支付**除非主 Agent 另开卡 |

#### T132 · 免费排盘底线守卫测试

| 项 | 内容 |
|----|------|
| **目标** | 防止误锁核心排盘 |
| **涉及路径** | 测试 |
| **依赖** | T131 |
| **DoD** | 自动化断言：无登录/无额度仍可 computeChart |
| **验收** | CI 绿 |
| **子角色** | 质量 |

---

## 9. 主 Agent 首派建议（Kickoff Post-MVP）

**立即（W5）：**

1. 主 Agent：拍板 T70 存储选型 → 更新 T70 备注  
2. **子-平台 A**：T70  
3. **子-平台 B**：T71（与 T70 并行）  
4. T70/T71 done 后：**子-平台** T72 + **质量** T73  

**W5 完成后并行：**

| 线 | 卡序 |
|----|------|
| 账号线 | T80 → T81 → T82 → T83；T84 可与 T82 并行 |
| 八字深化线 | T90–T94 可多子并行；T95 等 T70；T96 可随时 |

**术数线（主 Agent 二选一先开）：**

- 先紫微：T100 → T101+T102 → T103；并行 T104 scaffold；再 T105–T109  
- 先六爻：T110 → T111+T112 → T113；再 T114–T117  

**不要**在 W5 完成前对公网承诺分享/LLM 稳定。

---

## 10. 项目级最终形态 Done（定义）

> **严格最终形态（§18.3 · 2026-07-21）：** 下列为 PRODUCT §12 除 P5 的验收语义。  
> 代码与自动化验收已绿；**生产跨设备/真邮件**见 `docs/QA.md` §G，依赖用户侧密钥。

**严格（W18–W21 代码 done）：**

- [x] **P0 严格**：Upstash 分享 + Redis 分布式限流 + LLM 结构化观测 + DEPLOY 域名/观测专节  
- [x] **P1 严格**：Magic Link + `/auth/callback` + Postgres 驱动（`DATABASE_URL`）+ 登录自动同步 + 六爻云端 + 导出/删除三术；无 DB 时回落 `data/*.json`  
- [x] **P1.5**：八字深化 T90–T96  
- [x] **P2+P3**：紫微/六爻全链路 + **流月/流日（T240 · engine 0.7.0）**  
- [x] **P4**：首页入口 + Person + 品牌「赛博命理」；合参 cancel  
- [x] **P5**：cancel（不阻塞）  
- [x] 全量 `npm test` 546 绿；`npm run lint` 0 error  

**生产人工冒烟：** `docs/QA.md` §G（需 `DATABASE_URL` / Upstash / 可选邮件密钥）。  

---

## 11. 状态看板（主 Agent 维护）

| 波次 | 主题 | 状态 | 备注 |
|------|------|------|------|
| W0–W4 | MVP | **done** | T00–T62 |
| W5 | 生产加固 | done | T70–T73；Upstash + 限流 + DEPLOY/QA |
| W6 | 账号 | done | T80–T84 全 done |
| W7 | 八字深化 | done | T90–T96 全 done |
| W8 | 紫微 | done | T100–T109；T107 云端 API + 同步已补 |
| W9 | 六爻 | done | T110–T117；卦名全表 + 解卦页已补 |
| W10 | 跨术数 | done | T120–T122；Person REST `/api/people` 已补；T123 cancel |
| W11 | 增长 | skip | T130–T132 cancel（默认不阻塞最终形态） |
| W12 | 验收热修 + 深化 | **done** | T140–T143 热修；T150–T151 调研；T152–T154 第一切片已落地 |
| W13 | 引擎深化第二刀 | **done** | T160 辅星；T161 动变生克；T162 模板事实引用 |
| W14 | 引擎深化第三刀 | **done** | T170 庙旺；T171 用神扩展+状态；T172 模板引用 |
| W15 | 引擎深化第四刀 | **done** | T180 应期/空亡；T181 自化；T182 博士；T183 iztro；T184 模板 |
| W16 | 飞星飞宫 + 流昌截空 | **done** | T190 飞星；T191 流昌流曲；T192 截空；T193 模板 |
| W17 | 运限飞星叠盘 | **done** | T200 大限宫干四化；T201 流年干+流昌曲；T202 模板 |
| W18 | P0 严格收口 | **done** | T210–T212；见 §18 |
| W19 | P1 真登录+Postgres | **done** | T220–T226；见 §18 |
| W20 | 品牌统一 | **done** | T230；见 §18 |
| W21 | 紫微流月/流日 | **done** | T240 必做（方案 2）；见 §18 |
| 收口 | T231 总验收 | **done** | 代码/文档收口；生产 §G 待密钥人工 |

---

## 17. 运限飞星叠盘（W17 · 2026-07-21）

> 来源：W16 后置「大限/流年飞星叠盘」。  
> **拍板：** 运限层字段不写回本命 `star.sihua`；OAuth/W11 仍 cancel。

### 17.1 任务卡

| ID | 标题 | 优先级 | 依赖 | 状态 |
|----|------|--------|------|------|
| T200 | 大限宫干四化飞出 | P0 | T190 | **done** |
| T201 | 流年干四化 + 流年流昌曲 | P0 | T191,T190 | **done** |
| T202 | 模板大限/流年章引用运限飞星 | P1 | T200,T201 | **done** |

### 17.2 落地

| 卡 | 路径 |
|----|------|
| T200 | `daxian[].stem` + `sihuaOut`；`sihuaFlightsFromStem`；`FLAG_YUN_FEIXING` |
| T201 | `liunian[].stem/sihuaOut/liuChangPalace/liuQuPalace` |
| T202 | `template.ts` buildLuck |
| 版本 | `ENGINE_VERSION=0.6.0` |

### 17.3 验证

`npx vitest run src/lib/ziwei/daxian/yun-feixing.test.ts src/lib/ziwei/daxian/daxian.test.ts src/lib/reading/ziwei/template.test.ts --pool=forks --maxWorkers=1`

**仍后置：** 流月流日、飞星派改安星、生产 OAuth、W11（cancel）。

---

## 16. 飞星飞宫与杂曜（W16 · 2026-07-21）

> 来源：W15 明确后置。  
> **拍板：** 宫干飞出四化边（不改三合安星）；年支流昌流曲；年干截空；模板中性引用；`ENGINE=0.5.0`。

### 16.1 任务卡一览

| ID | 标题 | 优先级 | 依赖 | 波次 | 状态 |
|----|------|--------|------|------|------|
| T190 | 飞星飞宫（十二宫干飞出） | P0 | T181 | W16 | **done** |
| T191 | 流昌 / 流曲 | P0 | T160 | W16 | **done** |
| T192 | 截空 | P0 | T160 | W16 | **done** |
| T193 | 模板引用飞星/流昌/截空 | P1 | T190–T192 | W16 | **done** |

### 16.2 落地摘要

| 卡 | 路径 |
|----|------|
| T190 | `tables/feixing.ts`、`feixing.ts`；`FeixingFlight`；`feixingFlights`/`feixingOut`；flag `feixing_palace_flights` |
| T191 | `tables/liuchang.ts` 流昌流曲；生年支安年流 |
| T192 | 同表截空两宫；`category=harsh` |
| T193 | 命宫/advice 引飞出、流昌流曲、截空 |

### 16.3 验证

```
npx vitest run src/lib/ziwei/feixing.test.ts src/lib/ziwei/liuchang.test.ts src/lib/reading/ziwei/template.test.ts src/lib/ziwei/__fixtures__/golden.test.ts --pool=forks --maxWorkers=1
```

**明确不在本波次（大限/流年飞星已开 W17）：** 流月流日、飞星派改安星、生产 OAuth、W11。

---

## 15. 引擎深化第四刀（W15 · 2026-07-21）

> 来源：W14 明确后置项。  
> **拍板：** 六爻应期/空亡（需占时）；紫微宫干自化（非完整飞星）；博士十二神；iztro 仅测试/脚本对照；模板引用新字段。

### 15.1 任务卡一览

| ID | 标题 | 优先级 | 依赖 | 波次 | 状态 |
|----|------|--------|------|------|------|
| T180 | 六爻日辰/旬空/简单应期 | P0 | T171 | W15 | **done** |
| T181 | 紫微宫干自化（三合扩展） | P0 | T170 | W15 | **done** |
| T182 | 博士十二神 | P0 | T160 | W15 | **done** |
| T183 | iztro 对照流水线（测试/脚本） | P1 | T152 | W15 | **done** |
| T184 | 模板引用空亡/自化/博士 | P1 | T180–T182 | W15 | **done** |

### 15.2 任务卡详情

#### T180 · 六爻应期/空亡

| 项 | 内容 |
|----|------|
| **落地** | `analyze/kongwang.ts`、`yingqi.ts`；`castAt` 入盘；日柱/月建复用 bazi；`LIUYAO=0.4.0`；`references/yingqi.md` |
| **DoD** | 有占时→日辰/旬空/用神空/yingQiHint；无占时中性提示；无恐吓语；单测绿 |

#### T181 · 宫干自化

| 项 | 内容 |
|----|------|
| **落地** | `tables/zihua.ts`、`zihua.ts`；生年四化后叠「自化X」；`school` 仍 sanhe；`ENGINE=0.4.0` |
| **DoD** | 与生年表同源；可叠生年标记；非飞星全套；单测绿 |

#### T182 · 博士十二神

| 项 | 内容 |
|----|------|
| **落地** | `tables/boshi.ts`、`boshi.ts`；禄存起博士；阳男阴女顺/逆；`category=misc` |
| **DoD** | 12 神各一宫；入盘 12 misc；单测绿 |

#### T183 · iztro 对照

| 项 | 内容 |
|----|------|
| **落地** | `__fixtures__/iztro-compare.test.ts`（无 iztro skip）；`scripts/compare-iztro.mjs`；**不**进 runtime deps |
| **DoD** | 无 iztro 测试仍绿；有 iztro 可 diff 主星/命宫 |

#### T184 · 模板引用

| 项 | 内容 |
|----|------|
| **落地** | 六爻世应/advice 引旬空应期；紫微命宫/advice 引自化·博士 |
| **DoD** | 事实词可测；无恐吓 |

### 15.3 验证

```
npx vitest run src/lib/liuyao/analyze/kongwang.test.ts src/lib/ziwei/zihua.test.ts src/lib/ziwei/boshi.test.ts src/lib/ziwei/__fixtures__/iztro-compare.test.ts src/lib/reading/ziwei/template.test.ts src/lib/reading/liuyao/template.test.ts --pool=forks --maxWorkers=1
```

**明确不在本波次（已开 W16）：** 完整飞星派飞宫、流昌流曲/截空 → 见 §16；生产 OAuth、W11 增长仍后置。

---

## 14. 引擎深化第三刀（W14 · 2026-07-21）

> 来源：调研剩余 P1 + W13 未做项。  
> **拍板：** 主星亮度表驱动；用神事类/性别扩展 + 静动化；模板只引用字段。

### 14.1 任务卡一览

| ID | 标题 | 优先级 | 依赖 | 波次 | 状态 |
|----|------|--------|------|------|------|
| T170 | 紫微十四主星庙旺亮度 | P0 | T160 | W14 | **done** |
| T171 | 六爻用神规则扩展 + 静/动/化状态 | P0 | T161 | W14 | **done** |
| T172 | 模板引用亮度与用神状态 | P1 | T170,T171 | W14 | **done** |

### 14.2 落地摘要

| 卡 | 路径/版本 |
|----|-----------|
| T170 | `tables/brightness.ts`、`brightness.ts`；`ENGINE_VERSION=0.3.0`；`references/brightness.md` |
| T171 | `yongshen.ts` 扩展 + gender；`yongshen-status.ts`；`yongShenStatus` 入盘；`LIUYAO=0.3.0` |
| T172 | 紫微命宫/宫位主星带亮度；六爻世应/advice 引静动化 |

### 14.3 验证

`npx vitest run src/lib/ziwei/brightness.test.ts src/lib/liuyao/analyze/yongshen.test.ts src/lib/reading/ziwei/template.test.ts src/lib/reading/liuyao/template.test.ts --pool=forks --maxWorkers=1`

**明确不在本波次：** 应期/空亡、飞星自化、博士十二神、iztro 对照流水线。

---

## 13. 引擎深化第二刀（W13 · 2026-07-21）

> 来源：T150/T151 调研优先项 + 用户冒烟通过后开波。  
> **拍板：** 自研表驱动；辅星 13 颗；动变生克中性；模板只引用引擎字段。

### 13.1 任务卡一览

| ID | 标题 | 优先级 | 依赖 | 波次 | 状态 |
|----|------|--------|------|------|------|
| T160 | 紫微常用辅星安星（13） | P0 | T152 | W13 | **done** |
| T161 | 六爻动变生克简述 | P0 | T153 | W13 | **done** |
| T162 | 模板解读引用辅星/四化/动变事实 | P1 | T160,T161 | W13 | **done** |

### 13.2 任务卡详情

#### T160 · 紫微常用辅星安星

| 项 | 内容 |
|----|------|
| **落地** | `tables/aux-stars.ts`、`aux-stars.ts`；`computeZiweiChart` 入盘；`ENGINE_VERSION=0.2.0`；`references/aux-stars.md` |
| **DoD** | 13 辅/煞各一宫；soft/harsh；与四化可叠（文昌等）；单测绿 |

#### T161 · 六爻动变生克简述

| 项 | 内容 |
|----|------|
| **落地** | `analyze/dongbian.ts`；五行生克五态；`LIUYAO_ENGINE_VERSION=0.2.0` |
| **DoD** | 动爻有 relation+中性 summary；静卦提示；无恐吓语；单测绿 |

#### T162 · 模板事实引用

| 项 | 内容 |
|----|------|
| **落地** | 紫微命宫/advice 引辅星·四化；六爻 changing/advice 引动变生克与用神落爻 |
| **DoD** | 模板单测覆盖事实词；签语仍非空 |

### 13.3 验证

`npx vitest run src/lib/ziwei/aux-stars.test.ts src/lib/liuyao/analyze/dongbian.test.ts src/lib/reading/ziwei/template.test.ts src/lib/reading/liuyao/template.test.ts --pool=forks --maxWorkers=1`

**明确不在本波次：** 庙旺利陷、应期/空亡、飞星自化、博士十二神。

---

## 12. 验收热修与深化（W12 · 本会话确认）

> 来源：本地验收反馈 + 主 Agent 与用户对齐（2026-07-21）。  
> **已拍板：** 无 Key 禁用 LLM；签语/建议空内容两处都修；引擎+解读都要加强，先调研再深化。  
> **文案：** 采集/起卦页已改为「引擎不经 LLM；报告可选模板/LLM」（用户可见层）。

### 12.1 问题汇总（会话确认）

| # | 问题 | 根因摘要 | 用户拍板 | 对应卡 |
|---|------|----------|----------|--------|
| Q1 | 紫微签语为空；报告「综合建议」也空/无实质 | 分享签语截 `advice` 首句易空；模板 `buildAdvice` 可能空泛或字段未渲染 | 两处都修，且签语不能为空 | **T140** |
| Q2 | 模板/LLM 与 通俗/专业 未水平对齐 | `ReportHeader` 内嵌模式切换 + 外侧 `ViewToggle` 分行 | 同一水平线成组 | **T141** |
| Q3a | 无 LLM Key 仍可切 LLM，再回落模板 | 产品原设计「可点+回落」 | **无 Key 禁用 LLM + 配置说明** | **T142** |
| Q3b | 起卦/排盘页写「零 LLM」易误解成全程无 AI | 只描述引擎层，未提报告层 | 改为精确分层文案 | **T143**（用户可见层已改；卡内收尾+八字页对齐） |
| Q4 | 紫微/六爻是否专业权威 | 引擎 MVP～中等；解读为学习向模板；辅星/四化/细断待补 | 引擎+解读都加强；**先调研** GitHub/典籍资料 | **T150–T151** → 后续 T152+ |

### 12.2 任务卡一览

| ID | 标题 | 优先级 | 依赖 | 波次 | 状态 |
|----|------|--------|------|------|------|
| T140 | 紫微/六爻签语与综合建议非空修复 | P0 | — | W12 | **done** |
| T141 | 报告页双切换控件水平对齐 | P0 | — | W12 | **done** |
| T142 | 无 LLM Key 时禁用 LLM 并说明配置 | P0 | — | W12 | **done** |
| T143 | 排盘/装卦 vs 解读分层文案全站对齐 | P1 | — | W12 | **done** |
| T150 | 紫微引擎与解读资料调研备忘 | P1 | — | W12 | **done** |
| T151 | 六爻引擎与解卦资料调研备忘 | P1 | — | W12 | **done** |
| T152 | 紫微生年四化（第一切片） | P1 | T150 | W12 | **done** |
| T153 | 六爻六亲安爻+用神落爻（第一切片） | P1 | T151 | W12 | **done** |
| T154 | 紫微/六爻模板解读质量（第一切片） | P2 | T150,T151 | W12 | **done** |

**并行建议：** T140 ∥ T141 ∥ T142 ∥ T143；T150 ∥ T151。T152–T154 等调研结论后由主 Agent 写详情再派。

### 12.3 任务卡详情

#### T140 · 紫微/六爻签语与综合建议非空修复

| 项 | 内容 |
|----|------|
| **目标** | 分享/导出「签语」与报告「综合建议/行动建议」章均有可读正文，禁止空白 |
| **涉及路径** | `src/lib/reading/ziwei/template.ts`（`buildAdvice` 等）、`src/lib/reading/liuyao/template.ts`；`src/components/share/ZiweiShareSheet.tsx`、`ShareSheet.tsx`、`LiuyaoShareSheet.tsx`（签语截取逻辑）；相关 `*.test.ts` |
| **依赖** | 无 |
| **根因排查** | 1）签语是否只取首句标题导致空；2）`advice` section body 是否未生成；3）渲染层是否丢字段 |
| **DoD** | 任意有效盘：报告 advice 章 `body.trim().length > 0`；分享卡签语非空且含实质句（非仅「综合建议：」）；单测覆盖截取与兜底 |
| **验收** | 手工：紫微/六爻解读页 + 分享预览签语可见；`npm test` 相关绿 |
| **子角色** | 子-解读体验 |

#### T141 · 报告页双切换控件水平对齐

| 项 | 内容 |
|----|------|
| **目标** | 「模板 \| LLM」与「通俗 \| 专业」同一水平线、视觉成组，标题长时不乱 |
| **涉及路径** | `src/components/reading/ReportHeader.tsx`、`src/components/chart/ViewToggle.tsx`；`src/app/chart/[id]/reading/page.tsx`、`ziwei/.../reading`、`liuyao/.../reading` |
| **依赖** | 无（可与 T142 同改 ReportHeader） |
| **DoD** | 三术数报告页桌面/窄屏：两套切换水平对齐或明确同一工具条；无重叠遮挡 |
| **验收** | 手工截图或双端过一眼 |
| **子角色** | 子-解读体验 / UI |

#### T142 · 无 LLM Key 时禁用 LLM 并说明配置

| 项 | 内容 |
|----|------|
| **目标** | 服务端/客户端能感知「是否配置 LLM」；未配置时 LLM 按钮禁用 + 配置说明，不再「可点再回落」 |
| **涉及路径** | 可选 `GET /api/reading/status` 或 env 安全探测；`ReportHeader`；三术数 reading 页；`docs` 或 `.env.example` 说明 `LLM_*` |
| **依赖** | 无 |
| **注意** | 禁止把 API Key 暴露到客户端；仅暴露 boolean `llmConfigured` |
| **DoD** | 无 Key：LLM disabled + 文案指向 `.env.local`；有 Key：可切且真调用（或可测 mock） |
| **验收** | 本地无 Key / 有 Key 各验一次 |
| **子角色** | 子-解读体验 + 平台（若加 API） |

#### T143 · 排盘/装卦 vs 解读分层文案全站对齐

| 项 | 内容 |
|----|------|
| **目标** | 用户可见文案统一为：「排盘/装卦 = 确定性引擎（不经 LLM）；解读/解卦 = 模板或 LLM」 |
| **涉及路径** | 紫微/六爻 new 与 Wizard/CastForm（**用户可见层已改**）；八字 `BirthWizard`/相关页；分享页脚；`docs/QA.md` 相关句 |
| **依赖** | 无 |
| **DoD** | 三术数采集/结果入口无「零 LLM」易误解句；代码注释可保留「引擎零 LLM」 |
| **验收** | grep 用户可见中文无歧义「零 LLM」单独出现 |
| **子角色** | 子-解读体验 / 质量 |

#### T150 · 紫微引擎与解读资料调研备忘

| 项 | 内容 |
|----|------|
| **目标** | 调研 GitHub 优质紫微项目 + 权威/通行规则资料，输出可落地的选型与缺口清单 |
| **涉及路径** | **新建** `docs/research/ziwei-sources.md`（或 `docs/RESEARCH-ziwei.md`）；不改引擎代码 |
| **依赖** | 无 |
| **调研范围** | 开源排盘库/表驱动实现；三合安星/辅星/四化资料；与当前 `src/lib/ziwei/references` 对照 |
| **DoD** | 文档含：候选源链接、许可证、与本项目契合度、建议优先补的能力（辅星/四化/…）、风险（流派冲突） |
| **验收** | 主 Agent 评审后可开 T152 |
| **子角色** | 子-调研 |

#### T151 · 六爻引擎与解卦资料调研备忘

| 项 | 内容 |
|----|------|
| **目标** | 调研 GitHub/资料中装卦、世应、用神、动变细断的通行做法 |
| **涉及路径** | **新建** `docs/research/liuyao-sources.md`；不改引擎代码 |
| **依赖** | 无 |
| **DoD** | 同 T150 结构；对照当前 `yongshen` 简化表与缺口 |
| **验收** | 主 Agent 评审后可开 T153 |
| **子角色** | 子-调研 |

#### T152 · 紫微生年四化（第一切片 · done）

| 项 | 内容 |
|----|------|
| **落地** | `tables/sihua.ts` + `sihua.ts`；`computeZiweiChart` 填 `star.sihua`；`ENGINE_VERSION=0.1.1`；`references/sihua.md` |
| **DoD** | 生年干→四化表 10 干；排盘后主星带禄权科忌；单测 ≥5；禁混飞星 |
| **后续可选** | 辅星全量、庙旺、与 iztro 对照金标准扩展 |

#### T153 · 六爻六亲安爻 + 用神落爻（第一切片 · done）

| 项 | 内容 |
|----|------|
| **落地** | `analyze/liuqin.ts` 纳甲六亲；`yongShenYao`；`ChartResult` 展示；类型扩展 |
| **DoD** | 本卦六亲可测；用神尽量绑爻，否则世；单测 ≥5 |
| **后续可选** | 动变生克、应期、空亡 |

#### T154 · 模板解读质量（第一切片 · done）

| 项 | 内容 |
|----|------|
| **落地** | 紫微/六爻 `buildAdvice` 首条实质句 + 事实引用；`ensureSectionBody`；与 `extractShareMotto` 联调单测 |
| **DoD** | advice 非空非纯标题；签语可截实质句 |

### 12.4 主 Agent 派工建议（Kickoff W12）

**立即并行（热修）：**

1. **子-解读体验 A**：T140  
2. **子-解读体验 B**：T141 + T142（同改 ReportHeader 可一张卡领完或拆两人）  
3. **子-解读体验 C / 质量**：T143 收尾  

**并行调研（不阻塞热修）：**

4. **子-调研 A**：T150  
5. **子-调研 B**：T151  

**子 Agent Prompt 追加句（W12）：**

```
本卡属 W12 验收热修/调研。必读 docs/TASKS.md §12。
拍板：无 LLM Key → 禁用 LLM；签语与 advice 禁止空；排盘零 LLM、解读可 LLM。
调研卡只写 docs/research/*，禁止改引擎实现。
```

### 12.5 本会话已落地（供对照，勿重复做）

| 项 | 状态 |
|----|------|
| 游客 sessionStorage / 账号 localStorage | done |
| 登录提升游客数据 | done |
| 导出 PNG/PDF + 分享需登录 | done |
| 六爻分享链路 | done |
| 采集/起卦页分层文案（用户可见） | done（T143） |
| T140 签语截取跳过标题行 + 兜底 + 单测 | done |
| T141 ReportHeader 双切换同一工具条 | done |
| T142 `/api/reading/status` + LLM 按钮禁用 | done |
| T150 `docs/research/ziwei-sources.md` | done |
| T151 `docs/research/liuyao-sources.md` | done |

### 12.6 主 Agent 汇总（2026-07-21）

| 卡 | 结果 | 要点 |
|----|------|------|
| T140 | done | 根因：签语取 advice 首段落到「综合建议：」；统一 `extractShareMotto` |
| T141 | done | `ReportHeader` 内 `role=toolbar` 水平成组 ViewToggle |
| T142 | done | `llmConfigured` boolean；无 Key 禁用 + `.env.local` 说明 |
| T143 | done | 用户可见无单独「零 LLM」；仅代码注释保留 |
| T150 | done | 自研表+iztro 对照；优先四化/辅星 |
| T151 | done | 用神简化表缺口；优先六亲落爻 |
| T152 | done | 生年四化表 + 排盘标记；engine **0.1.1** |
| T153 | done | 纳甲六亲 + 用神落爻 + UI 展示 |
| T154 | done | 建议章实质句 + 签语可截 |

**验证（本机低内存 · forks/maxWorkers=1）：**  
- 关键切片：`sihua` + `liuqin` + `extract-motto` → **31 passed**  
- 相关域：`src/lib/ziwei` + `liuyao` + `share` + `reading` → **201 passed**  
- 全量 `npm test` 仍可能 OOM，建议 CI；eslint 关键路径 0 error  

**项目收口定义（本波次）：**  
- [x] W12 热修 T140–T143  
- [x] 调研 T150–T151  
- [x] 深化第一切片 T152–T154  
- [x] 相关域 lint/test 绿（201；全量 CI 补）  
- [ ] 真机双端冒烟（验收人）  

**明确不在本波次：** 紫微辅星全量、六爻应期/空亡、生产级 OAuth/Postgres、W11 增长（cancel）。

---

## 18. 最终形态收口路线（W18–W20 · 2026-07-21 拍板）

> **范围定义（用户确认）：** 完整实现 `docs/TASKS.md` §10 **且** `docs/PRODUCT.md` §12 中 **除 P5 外**全部目标。  
> **本会话仅拆卡与路线，不写业务代码。**  
> **P5（T130–T132）** 仍 cancel，不阻塞。

### 18.1 与现状差距（主 Agent 汇总）

| PRODUCT | 文档曾标 | 真缺口 |
|---------|----------|--------|
| §12.2 分享存储 | done | **无**（Upstash 已就绪） |
| §12.2 限流与鉴权 | done | **部分**：memory 可用；`RATE_LIMIT_DRIVER=redis` **未实现** |
| §12.2 观测 | done | **部分**：有 logApi；**无** token/成本结构化字段与可汇总错误维度 |
| §12.2 部署文档 | done | **接近**：缺域名专节 |
| §12.3 登录 | done | **未满足验收语义**：现为开发邮箱假登录，无 Magic Link/OAuth、无 `/auth/callback` |
| §12.3 换设备可见档案 | done | **未满足**：`data/*.json` 单机；多实例/Serverless 不可靠 |
| §12.3 游客 + 本地模式 | done | **基本满足** |
| §12.3 隐私导出删除 | done | **部分**：缺六爻云端范围 |
| §12.3 六爻登录后云端历史 | 体验句 | **未满足**：六爻仅本地 |
| §12.4–§12.6 八字/紫微/六爻主链路 | done | **满足**（引擎甚至超额至 W17） |
| §12.7 首页入口 + Person | done | **满足** |
| §12.7 品牌「赛博命理」 | 部分 | **壳层/元数据未统一** |
| §12.7 合参 | cancel | 见 §18.2 决策 |
| §12.8 P5 | cancel | **保持 cancel** |

### 18.2 产品决策（本轮拍板 + 主 Agent 建议）

| # | 议题 | 决策 | 说明 |
|---|------|------|------|
| D1 | 登录 | **必须真登录** | 至少一种：邮箱 Magic Link **或** OAuth；假登录仅 `NODE_ENV=development` 可保留 |
| D2 | 档案存储 | **Postgres** | User / 八字 / 紫微 / 六爻 / Person 迁出 `data/*.json`；推荐 Neon/Supabase 等托管 |
| D3 | 观测档位 | **结构化可汇总日志** | token usage、model、fallback、errorCode 入 log；**不做**独立看板 UI |
| D4 | 合参 T123 | **继续 cancel（用户确认方案 2）** | 不做合参；T241 仅预留不排期 |
| D5 | 流月流日 | **纳入最终形态必做（用户确认方案 2）** | **W21 · T240**；与 W18–W20 一并完成后才算严格最终形态 |
| D6 | 飞星派改安星 | **不做** | 见下「影响」；保持三合 + 现有宫干飞出 |
| D7 | P5 | **cancel** | 不变 |

#### 合参（T123）优劣 · 用户视角 · 建议

| | 内容 |
|--|------|
| **利** | 一人多盘叙事更完整；爱好者愿意对照两种命理；差异化卖点 |
| **弊** | 极易出现「八字说甲、紫微说乙」的打架断语；合规与信任风险高；模板/LLM 约束成本大；PRODUCT 已标「可选」 |
| **建议** | **最终形态不做**。先把登录+Postgres+同步做稳；合参若做，单独立项为「谨慎摘要、禁止互相否定句」，且排在 W20 之后可选。 |

#### 流月流日 / 飞星派 · 产品影响 · 建议

| 项 | 用户价值 | 工程/风险 | 建议 |
|----|----------|-----------|------|
| **流月/流日** | 紫微用户关心「当月/当日」运势，传播与回访有加成 | 中等：表驱动+叠盘+模板章；可复用大限/流年模式 | **用户拍板方案 2：最终形态必做** → **W21 T240**（合参仍不做） |
| **飞星派改安星** | 飞星派用户需要，但与当前三合用户重叠有限 | **大**：安星体系分叉、金标准重做、与现 `school=sanhe` 冲突、解读规则双轨 | **弊大于利** → **明确不做**；文档写死三合；现有「宫干飞出四化」≠ 飞星派 |

### 18.3 修订后的最终形态 Done（替换/收紧 §10 勾选语义）

> 旧 §10 勾选反映「骨架 done」；下列为 **PRODUCT §12 除 P5 的严格验收**。全部勾选后才可再标项目最终形态。

- [x] **P0 严格**：分享 Upstash（已有）+ **Redis 分布式限流** + **LLM 结构化观测** + 部署域名专节（W18 · T210–T212）  
- [x] **P1 严格**：Magic Link + Postgres 驱动 + 登录自动同步 + 六爻云端 + 导出/删除三术（W19 · T220–T226；生产需配 `DATABASE_URL`/邮件）  
- [x] **P1.5**：T90–T96（已有，保持）  
- [x] **P2+P3**：紫微/六爻全链路 + **流月/流日（T240 · engine 0.7.0）**  
- [x] **P4**：首页入口 + Person + **品牌「赛博命理」（T230）**；合参 **不要求**  
- [ ] **P5**：不要求（cancel）  
- [x] 全量 `lint` 0 error / `test` 546 绿；QA §G 生产冒烟清单已备（跨设备需密钥人工勾选）  

### 18.4 波次与依赖

```
W18  P0 收口严格     T210–T212
        │
        ▼
W19  P1 生产账号     T220 契约/Schema
        │            T221 Postgres 接入
        │            T222 真登录 + callback
        │            T223 档案迁移 JSON→PG
        │            T224 登录自动同步
        │            T225 六爻云端
        │            T226 隐私导出删除扩三术
        ▼
W20  P4 品牌收口      T230 品牌统一
        │              （T123 合参仍 cancel）
        │
        ▼  （可与 W20 并行：无路径冲突）
W21  紫微流月流日      T240 引擎+模板+UI 引用
        │
        ▼
     T231 总验收（依赖 W18–W21 + T230）
```

| 波次 | 主题 | 依赖 | 状态 |
|------|------|------|------|
| **W18** | P0 严格收口 | 现网代码 | **done** |
| **W19** | P1 真登录 + Postgres + 同步 + 六爻云 | W18 建议先或与 T210 并行 | **done** |
| **W20** | 品牌统一 | 可与 W18/W19/W21 并行 | **done** |
| **W21** | 紫微流月/流日（最终形态必做） | T201；可与 W18–W20 并行 | **done** |
| **收口** | T231 总验收 | T210–T226, T230, **T240** | **done** |
| W11/P5 | 增长 | — | **cancel** |
| 合参 | T123 / T241 | — | **cancel / 不排期** |
| 飞星派 | — | — | **wontfix** |

### 18.5 任务卡一览

| ID | 标题 | 优先级 | 依赖 | 波次 | 状态 |
|----|------|--------|------|------|------|
| **W18 · P0 严格** |
| T210 | 分布式限流 Redis（真实现） | P0 | T71 | W18 | **done** |
| T211 | LLM/API 结构化观测（usage/成本字段） | P0 | T71 | W18 | **done** |
| T212 | DEPLOY 域名专节 + 观测运维说明 | P1 | T210,T211 | W18 | **done** |
| **W19 · P1 严格** |
| T220 | Postgres 数据模型与类型契约 | P0 | — | W19 | **done** |
| T221 | Postgres 客户端与环境变量 | P0 | T220 | W19 | **done** |
| T222 | 真登录（Magic Link 或 OAuth）+ `/auth/callback` | P0 | T221 | W19 | **done** |
| T223 | 云端档案 JSON → Postgres 迁移 | P0 | T221 | W19 | **done** |
| T224 | 登录后自动同步（本地↔云端） | P0 | T222,T223 | W19 | **done** |
| T225 | 六爻云端 CRUD + 同步 + 问卦列表 | P0 | T223,T222 | W19 | **done** |
| T226 | 导出/删除账号覆盖三术 + PG 数据 | P1 | T225 | W19 | **done** |
| **W20 · P4 品牌** |
| T230 | 全站品牌「赛博命理」统一 | P1 | — | W20 | **done** |
| **W21 · 紫微流月流日（必做）** |
| T240 | 紫微流月/流日叠盘 + 模板 + UI | P0 | T201 | W21 | **done** |
| **总验收** |
| T231 | 最终形态 QA 冒烟 + §10/看板收口 | P0 | T210–T226,T230,**T240** | 收口 | **done** |
| T123 | 八字×紫微合参 | P2 | — | — | **cancel**（方案 2 确认） |
| T241 | （预留）合参轻量摘要 | P2 | — | — | **cancel**（不排期） |
| — | 飞星派改安星 | — | — | — | **wontfix** |
| T130–T132 | P5 增长 | — | — | W11 | **cancel** |

### 18.6 任务卡详情

#### T210 · 分布式限流 Redis（真实现）

| 项 | 内容 |
|----|------|
| **目标** | `RATE_LIMIT_DRIVER=redis` 多实例共享计数；不再静默整段回落 memory |
| **涉及路径** | `src/lib/api/rate-limit.ts`、相关 test、`.env.example`、`docs/DEPLOY.md` |
| **依赖** | T71（已有 memory 与接入点） |
| **主决策** | 与分享共用 Upstash Redis REST；key 如 `rl:{bucket}:{id}`；固定窗口或滑动窗口二选一（推荐固定窗口对齐现 memory） |
| **DoD** | driver=redis 时跨进程计数；缺凭证 fail-fast 或显式 document 的安全回落策略（二选一写清，禁止静默）；429 行为与 memory 一致；单测可用 mock Redis |
| **验收** | 两 worker/两次冷启动连续打满阈值触发 429 |
| **子角色** | 子-平台 |

#### T211 · LLM/API 结构化观测

| 项 | 内容 |
|----|------|
| **目标** | 满足 §12.2「调用日志 + 可汇总错误维度 + 成本相关字段」；不做看板 UI |
| **涉及路径** | `src/lib/api/logger.ts`、`src/lib/reading/llm/**`、三术 `api/reading/**` |
| **依赖** | T71 |
| **DoD** | 成功/失败日志含：`requestId`、`art`、`model`、`durationMs`、`fallback`、`errorCode`；有 usage 时写 `promptTokens`/`completionTokens`/`totalTokens`（无则 null）；禁止打出 API Key；LLM 层不用裸 `console.error` 替代统一 logger |
| **验收** | 本地触发一次模板回落 + 一次 mock 成功，日志可 grep 上述字段 |
| **子角色** | 子-平台 |

#### T212 · DEPLOY 域名与观测说明

| 项 | 内容 |
|----|------|
| **目标** | §12.2 部署文档补齐域名；写明限流 redis 与日志字段 |
| **涉及路径** | `docs/DEPLOY.md`、README 链接如需 |
| **依赖** | T210, T211 |
| **DoD** | 自定义域名/HTTPS 分步（Vercel 或自托管各一小节）；观测字段表；限流 redis 配置表 |
| **验收** | 主 Agent dry-run 文档可跟做 |
| **子角色** | 子-平台 |

#### T220 · Postgres 数据模型与类型契约

| 项 | 内容 |
|----|------|
| **目标** | 锁死 User / Session 元数据 / Person / 八字档案 / 紫微档案 / 六爻问卦 的表结构与 TS 类型 |
| **涉及路径** | `src/lib/types/**`、`src/lib/db/schema.ts`（或等价）、迁移 SQL/说明 |
| **依赖** | 无（可与 W18 并行） |
| **主决策** | 单库多表；JSON 列可存 chart 快照；`userId` 外键；六爻 `question` 必填 |
| **DoD** | 类型导出；与现有 API 响应形状兼容或附迁移映射表；主 Agent 评审通过后才开 T221 |
| **验收** | 其它 W19 卡可引用类型编译 |
| **子角色** | 子-账号（主 Agent 审契约） |

#### T221 · Postgres 客户端与环境变量

| 项 | 内容 |
|----|------|
| **目标** | 可连接托管 Postgres；开发可 Docker/本地 |
| **涉及路径** | `src/lib/db/**`、`.env.example`、`docs/DEPLOY.md` |
| **依赖** | T220 |
| **主决策** | 驱动：`postgres`/`@neondatabase/serverless`/`pg` 择一；`DATABASE_URL` 必填于生产账号功能 |
| **DoD** | 健康检查或简单 query；缺 URL 时账号 API 明确错误；文档连接步骤 |
| **验收** | 本地连上库 `SELECT 1` |
| **子角色** | 子-账号 / 平台 |

#### T222 · 真登录 + `/auth/callback`

| 项 | 内容 |
|----|------|
| **目标** | 替换生产路径上的「填邮箱即登录」；完成 PRODUCT 建议登录形态之一 |
| **涉及路径** | `src/app/auth/**`、`src/app/api/auth/**`、`src/lib/auth/**`、`src/components/auth/**` |
| **依赖** | T221（用户落 PG） |
| **主决策（执行前再确认一种）** | **A** Auth.js + GitHub OAuth；**B** Auth.js/自建 + 邮箱 Magic Link（Resend/SMTP）。可 A+B，至少落地 **一种** |
| **DoD** | `/auth/login`、`/auth/callback`、登出；会话安全（HttpOnly Cookie、生产 AUTH_SECRET）；UI 去掉生产「开发登录」主路径；dev 可保留假登录开关 |
| **验收** | 真提供商走通登录→session→`/account` 显示已登录 |
| **子角色** | 子-账号 + UI |
| **阻塞风险** | 需用户提供 OAuth App / SMTP 密钥；无密钥则 **blocked** |

#### T223 · 云端档案 JSON → Postgres

| 项 | 内容 |
|----|------|
| **目标** | `cloud-charts` / `cloud-ziwei` / `cloud-people` / `users` 读写迁 PG；去掉生产对 `data/*.json` 的依赖 |
| **涉及路径** | `src/lib/storage/cloud-*.ts`、`src/lib/auth/users.ts`、API routes |
| **依赖** | T221 |
| **DoD** | CRUD 全走 PG；权限仍本人；提供一次性迁移脚本（JSON→PG）可选；Serverless 多实例同库可见 |
| **验收** | 实例 A 写入、实例 B（或重启后）可读同 user 档案 |
| **子角色** | 子-账号 + 数据 |

#### T224 · 登录后自动同步

| 项 | 内容 |
|----|------|
| **目标** | 登录成功后自动合并/拉取，减少「我的档案」纯手动推拉 |
| **涉及路径** | `src/lib/storage/sync.ts`、`migrate`、`LoginForm`/`AuthModeSync`、档案页提示 |
| **依赖** | T222, T223 |
| **DoD** | 冲突策略文档化（按 id / updatedAt）；可跳过；八字+紫微+Person；失败可重试不丢本地 |
| **验收** | 设备 A 排盘登录同步 → 设备 B 同账号登录可见（需 PG） |
| **子角色** | 子-账号 |

#### T225 · 六爻云端 CRUD + 同步

| 项 | 内容 |
|----|------|
| **目标** | 满足 §12.6「历史问卦列表（登录后云端）」 |
| **涉及路径** | `src/lib/storage/liuyao*.ts`、`src/app/api/liuyao/**`（新建）、`src/app/liuyao/**` 列表 UI |
| **依赖** | T223, T222 |
| **DoD** | 登录用户 list/get/create/delete；游客仍 session/local；登录自动同步问卦；权限本人 |
| **验收** | 换设备可见历史问卦 |
| **子角色** | 子-六爻产品 + 账号 |

#### T226 · 导出/删除覆盖三术

| 项 | 内容 |
|----|------|
| **目标** | 隐私最小集覆盖六爻与 PG 全量用户数据 |
| **涉及路径** | `src/lib/auth/account.ts`、`/api/account/export|delete`、`AccountPanel` |
| **依赖** | T225 |
| **DoD** | export JSON 含八字+紫微+六爻+Person；delete 清 PG 对应用户行；政策文案同步 |
| **验收** | 删除后 API 401/404 且库无残留 |
| **子角色** | 子-账号 |

#### T230 · 全站品牌「赛博命理」

| 项 | 内容 |
|----|------|
| **目标** | §12.7 品牌：总称赛博命理，子品牌保留 |
| **涉及路径** | `src/content/zh.ts`、`layout.tsx`、`SiteHeader`、隐私/账号/分享页脚、metadata |
| **依赖** | 无（可与 W19 并行） |
| **DoD** | 用户可见主标题/站点名统一；子产品名在入口保留；无大面积残留「仅赛博八字」作总品牌 |
| **验收** | grep 用户可见文案抽检通过 |
| **子角色** | 子-跨术数 / UI |

#### T231 · 最终形态 QA 与看板收口

| 项 | 内容 |
|----|------|
| **目标** | 严格 §18.3 可勾选；更新 QA/看板/§10 |
| **涉及路径** | `docs/QA.md` §G、`docs/TASKS.md` §10/§11/§18、`README.md` |
| **依赖** | T210–T226, T230, **T240** |
| **DoD** | §10 改为严格语义并勾选代码项；W18–W21 + T231 状态 done；QA §G 含登录/PG/限流 redis/六爻云/流月流日清单；自动化 test/lint 绿 |
| **验收** | 主 Agent 代码收口通过；生产放量由验收人勾选 QA §G 人工项 |
| **状态** | **done**（代码/文档；生产 §G 待密钥） |
| **子角色** | 子-质量 + 主 |

#### T240 · 紫微流月/流日叠盘 + 模板 + UI（最终形态必做）

| 项 | 内容 |
|----|------|
| **目标** | 在大限/流年之上补 **流月、流日** 运限叠盘；命盘/报告可中性展示；同输入可复现 |
| **涉及路径** | `src/lib/ziwei/daxian/**`、类型 `ZiweiChart` 运限字段、`src/lib/reading/ziwei/template.ts`、紫微命盘/报告 UI（如 `src/components/ziwei/**`、`src/app/ziwei/**`）、单测与 references 摘要 |
| **依赖** | T201（流年干/运限飞星模式可复用） |
| **主决策** | 仍 **三合**；运限层字段不写回本命 `star.sihua`（与 W17 一致）；文案中性、禁恐吓/绝对断言 |
| **DoD** | 引擎输出流月/流日结构（宫/干或叠盘字段表驱动）；确定性单测 ≥ 覆盖起例；模板 luck/advice 可引用事实词；UI 至少一处可选查看当月/当日（或报告章）；`ENGINE_VERSION`  bump |
| **验收** | 同生辰+同参考日多次结果一致；通俗/专业下可见流月或流日摘要且非空 |
| **状态** | **done**（方案 2） |
| **子角色** | 子-紫微引擎 + 紫微产品 |

#### T241 · 合参轻量摘要（不排期）

| 项 | 内容 |
|----|------|
| **目标** | 预留：若未来要做合参，仅对照摘要、禁止打架断言 |
| **依赖** | — |
| **状态** | **cancel**（方案 2：合参不做；与 T123 一致） |
| **子角色** | — |

### 18.7 主 Agent 派工顺序（执行阶段用）

**W18（可并行）：**

1. 子-平台 A：T210  
2. 子-平台 B：T211  
3. T210/T211 后：T212  

**W19：**

1. 主审 T220 契约 → T221  
2. T222（需密钥，可能 blocked）∥ T223  
3. T224、T225（依 T222+T223）→ T226  

**W20 / W21（可与账号线并行）：**

1. 子-跨术数：T230  
2. 子-紫微：T240（流月流日，**必做**）  
3. 上列 + W18/W19 done 后：T231 总验收  

**子 Agent Prompt 追加：**

```
本卡属 W18–W21 最终形态收口。必读 docs/TASKS.md §18 与 docs/PRODUCT.md §12。
P5/合参/飞星派：不要做。流月流日见 T240（必做）。
排盘/装卦零 LLM；密钥不入库；简体中文。
```

### 18.8 已知阻塞（无法仅靠代码自行解）

| 阻塞 | 需要用户 |
|------|----------|
| OAuth App / Magic Link 邮件服务 | 注册 GitHub OAuth 或 Resend/SMTP，提供回调 URL 与密钥到 `.env`（勿提交仓库） |
| Postgres 实例 | Neon/Supabase/自建 `DATABASE_URL` |
| 生产 Upstash | 分享 + 限流 redis 共用或分库 |
| 真机双端 / 跨设备冒烟 | 人工按 QA 勾选 |

### 18.9 状态看板增量

| 波次 | 主题 | 状态 | 备注 |
|------|------|------|------|
| W18 | P0 严格收口 | **done** | T210–T212 |
| W19 | P1 真登录+Postgres+六爻云 | **done** | T220–T226 |
| W20 | 品牌统一 | **done** | T230 |
| W21 | 紫微流月/流日 | **done** | T240（最终形态必做 · 方案 2） |
| 收口 | 总验收 | **done** | T231；生产 §G 待密钥人工 |
| 飞星派 | — | wontfix | 保持三合 |
| 合参 T123/T241 | — | cancel | 方案 2：不做 |
| P5 | — | cancel | 不变 |

---

*版本：v2.10 · W18–W28 done · 2026-07-22*
---

## 19. 专业性、工程规范与 Docker 整改（W22–W28）

> 审查日期：2026-07-21  
> 完整审查结论：[`PROJECT_REVIEW.md`](./PROJECT_REVIEW.md)  
> 规范化任务卡：[`REMEDIATION_TASKS.md`](./REMEDIATION_TASKS.md)  
> 执行与门禁：[`EXECUTION_GUIDE.md`](./EXECUTION_GUIDE.md)

### 19.1 状态看板

| 波次 | 主题 | 任务 | 状态 |
|---|---|---|---|
| W22 | GitHub 工程规范 | T250–T251 | done |
| W23 | 安全与 API 契约 | T252–T253 | done |
| W24 | 八字专业化 | T260–T262 | done |
| W25 | 紫微专业化 | T270–T271 | done |
| W26 | 六爻专业化 | T280–T282 | done |
| W27 | 解读与产品可信度 | T290–T292 | done |
| W28 | Docker 与生产运维 | T300–T303 | done |

### 19.2 执行门禁

1. W22 建立基线后才开始大规模并行修改；
2. W23 属于 P0，未完成不得公开放量；
3. W24–W26 可按三术数目录并行，但必须先锁定公共契约；
4. W27 依赖三术数结构化证据，禁止先让 LLM 自行补规则；
5. W28 在生产放量前完成，并执行备份恢复和回滚演练。

任务卡详情以 `REMEDIATION_TASKS.md` 为单一事实源，避免继续扩大本文件体积。

