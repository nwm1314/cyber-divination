# 全面 Review 提示词集（产品 / 设计 / 开发）

> 适用项目：**赛博命理 · Cyber Divination**（Next.js 16.2.10 + React 19.2.4 + TS + Tailwind v4）
> 代码规模基线：`src/**` 333 个 TS/TSX 文件、73 个测试文件、约 40,147 行；默认分支 `main`，工作树干净。
> 已有资产：`docs/PROJECT_REVIEW.md`（工程审查）、`docs/REMEDIATION_TASKS.md`（T250–T303）、`docs/EXECUTION_GUIDE.md`（DoR/DoD）、`e2e/critical-flows.spec.ts`、73 个单测文件。
>
> **使用方式**：本文件是「提示词库」，不是任务卡。按 §0 的编排流程，逐条复制到新会话执行。每条提示词都是自包含的，不依赖上下文。

---

## 0. 编排总览

### 0.1 三视角的分工边界

| 视角 | 回答的问题 | 产出物 | 权威文档 |
|---|---|---|---|
| **产品（PM）** | 值不值得做、给谁做、凭什么信、怎么变现 | PRD 修订、信息架构、信任模型、北极星指标 | `docs/PRODUCT.md` |
| **设计（UX/UI）** | 用户能不能顺畅走完、看不懂哪里、移动端是否可用 | 体验问题清单、设计规范、可访问性报告 | `src/app/globals.css` + `src/content/zh.ts` |
| **开发（Eng）** | 是否安全、正确、可维护、可发布 | 缺陷清单、修复 PR、测试与门禁 | `docs/EXECUTION_GUIDE.md` |

**关键约束**：三视角必须**读同一份事实**——`src/content/zh.ts`（文案）、`src/lib/contracts/**`（契约）、`src/app/**/page.tsx`（真实页面）。禁止凭 README 想象产品。

### 0.2 推荐执行顺序

```text
Phase 1  证据采集（P-0 / D-0 / E-0）      ← 只读，不改代码，产出基线报告
Phase 2  视角深挖（P-1..P-3 / D-1..D-3 / E-1..E-4）  ← 可并行，写集互斥
Phase 3  交叉仲裁（X-1）                  ← 合并三方冲突，定优先级
Phase 4  修复执行（F-1..F-3）              ← 按 Gate 分批，每批可回滚
Phase 5  复验（V-1）                      ← 独立视角复验，禁止自我验收
```

### 0.3 全局硬性规则（所有提示词都隐含遵守）

```text
1. 先读后写：任何判断必须先读对应源文件，禁止基于文件名或 README 推测。
2. 事实 / 规则 / 叙事三层不可混淆：
   - 事实层 = 历法、干支、星曜、爻位、运限（确定性计算）
   - 规则层 = 旺衰、格局、四化、用神、动变（结构化推断）
   - 叙事层 = 模板或 LLM 组织语言，不得产生或修改事实
3. LLM 绝不参与排盘，不修改计算事实，不虚构典籍依据。
4. 规则变化必须更新 engineVersion / ruleSetVersion，并给出差异报告。
5. 不改业务规则时不要顺手改；一次只做一件事。
6. 每次改动必须跑：npm run lint -- --max-warnings=0 && npm test && npm run build
7. 不做外部网络调用、不安装新依赖，除非明确要求。
8. 输出中文，路径用相对路径，引用代码必须带 文件:行号。
```

---

## Phase 1 · 证据采集（只读）

### P-0 · 产品事实基线

```text
你是资深产品经理。只读不改。目标是建立「赛博命理」产品的**事实基线**，供后续三方 review 共用。

必读（用 read/grep，逐条列出行号证据）：
- docs/PRODUCT.md —— 现有定位、功能清单、商业模式
- README.md §当前状态、§路线图摘要
- src/content/zh.ts —— 全部面向用户的文案（BRAND / HOME / ARTS 等）
- src/app/page.tsx —— 首页实际呈现
- src/app/**/page.tsx 全部页面清单（用 glob 列出）

产出 docs/REVIEW_PRODUCT_BASELINE.md，包含：
1. **真实功能矩阵**：表格列出 八字/紫微/六爻 × {排盘, 解读, 存储, 分享, 导出, 校准, 专业模式, 账号}，
   每格填「已实现 / 部分 / 缺失」，并附 `文件:行号` 证据。缺证据的填「未验证」，不要猜。
2. **用户可走通的最短路径**：从首页到拿到一份完整解读，逐步骤写出真实路由和交互。
3. **文案事实抽取**：BRAND.tagline / heroLead / heroAccent / heroDesc 的原文（逐字引用）。
4. **定位漂移检测**：README 声称的能力 vs 代码实际能力，逐条对比列差异。
5. **未验证列表**：你无法从代码确认的断言（如"专业级""权威"），单独列出。

硬性要求：
- 每个结论后面必须跟证据 `文件:行号`。无证据的结论标注 [推断]。
- 不评价、不提改进建议 —— Phase 2 才做。本步只采集事实。
- 不要运行 dev/build（避免污染），只读源码。
```

### D-0 · 设计资产盘点

```text
你是资深 UI 设计师。只读不改。盘点「赛博命理」的**设计系统现状**。

必读：
- src/app/globals.css —— 全部 CSS 变量、@theme 映射、工具类
- src/components/ui/{Button,Card}.tsx —— 基础组件真实 API
- src/components/**/*.tsx —— 全部组件（用 glob 列清单）
- src/app/**/page.tsx —— 页面级布局

产出 docs/REVIEW_DESIGN_INVENTORY.md：
1. **Design Token 表**：颜色 / 圆角 / 字体 / 间距 / 阴影，逐项列出变量名、值、实际使用它的组件。
   特别标注：在 CSS 中定义但**没有任何组件引用**的 token（死 token）。
2. **禁用 Tailwind 裸值审计**：grep 出所有 `text-[10px]`、`bg-gold/15`、`shadow-[0_0_16px_...]`
   这类硬编码值，统计出现次数与所在文件。列出应下沉为 token 的高频项。
3. **组件清单**：每个组件的 props、是否有 loading/error/empty 态、是否支持键盘焦点。
4. **字号阶梯**：把所有 text-* 类按大小排序，列出实际使用的完整阶梯，标出断层与过小字号（<12px）。
5. **色彩对比度计算**：对 §1 的 token 两两组合（foreground/background、muted/surface、
   gold/background、cyan/background），用 WCAG 公式手算对比度比值，标出 <4.5:1 的组合。

输出必须包含具体数字，不要写"建议优化对比度"这种空话。
```

### E-0 · 工程质量门禁基线

```text
你是资深全栈工程师。只读不改。先测出**当前真实工程基线**，为后续修复提供对照。

执行（按顺序，记录每条命令的真实输出与退出码）：
1. npm run lint -- --max-warnings=0   （预期可能失败，记录 warning 数量与规则名）
2. npm test                            （记录 通过/失败/跳过 的文件数与用例数）
3. npx tsc --noEmit                    （记录类型错误）
4. npm run build                       （记录是否成功、构建产物大小、有无告警）
5. npm run check:prod-env              （记录校验行为）

产出 docs/REVIEW_ENGINEERING_BASELINE.md：
1. **门禁现状表**：命令 / 退出码 / 关键输出摘要 / 是否达标（对照 docs/EXECUTION_GUIDE.md §5 DoD）
2. **测试覆盖盲区**：列出 src/app 下所有 route.ts 与 page.tsx，标注哪些**没有**对应测试文件
   （grep 测试文件名与源文件名比对）。给出"未覆盖路由清单"。
3. **依赖审计**：读 package.json，列出 next/react 的确切版本，标注是否为当前稳定版；
   列出 devDependencies 中被生产代码意外导入的包（如 iztro 只应在脚本/测试中用）。
4. **文档债**：检查 README.md 声称的状态（"15/18 done""lint 8 warnings"）与实际基线是否一致。
5. **失败清单**：所有非零退出项，逐条给出报错原文。

禁止修改任何文件。禁止 npm install。
```

---

## Phase 2A · 产品视角

### P-1 · 产品定位与价值主张审查

```text
你是负责过 C 端玄学/工具类产品的资深 PM。基于 docs/REVIEW_PRODUCT_BASELINE.md 的事实基线，
对「赛博命理」做**定位与价值主张**审查。不接受"传统文化+AI"这类正确但无用的结论。

先读：src/content/zh.ts、docs/PRODUCT.md、src/app/page.tsx、src/components/Disclaimer.tsx

逐项回答，每项必须给出理由和证据：

1. **一句话定位是否成立？**
   现有 tagline："{逐字引用 src/content/zh.ts 中的 BRAND.tagline}"
   用「为 [谁] 解决 [什么场景下的什么任务]，不同于 [替代方案]，因为 [独特能力]」的句式重写，
   至少给 3 个候选，每个注明它假设的目标用户和场景。

2. **目标用户分层**：
   列出 3 个真实用户画像（年龄、术数经验、使用频次、设备、付费意愿），
   逐个判断当前产品**是否服务得了**他——以代码中的真实功能为准，不以愿望为准。

3. **替代方案竞争分析**：
   用户不用本产品时会用什么？（微信小程序排盘、知乎/小红书找人算、专业软件、纸质万年历）
   从「上手成本 / 结果可验证性 / 隐私 / 价格 / 视觉体验」5 维度做对比表，
   指出本产品的**真实护城河**与**最容易被打穿的短板**。

4. **信任模型**：这是玄学产品的生死线。
   审查当前产品用什么建立信任：`src/components/reading/TrustPanel.tsx`、
   `src/components/reading/ReportHeader.tsx`、`src/components/Disclaimer.tsx`、
   `src/lib/reading/llm/evidence.ts`（证据层）。
   回答：一个新用户凭什么相信这份解读不是随机生成的？现有信任信号够不够？
   列出**最缺的 3 个信任机制**（如：规则可溯源、参数可调、差异对照、典籍原文）。

5. **变现路径可行性**：
   基于真实功能，列出可落地的变现方式，每种标注「当前技术上已具备 / 需要开发 / 需要资质」。
   明确回答：免费额度在哪切断？付费点是否触碰了用户的核心体验？

6. **合规与伦理红线**：
   项目声明"仅供传统文化学习与娱乐参考"。以代码为准，检查这个声明是否被产品行为违背
   （例如高风险主题——健康/投资/婚恋——是否给出了现实建议提示）。
   引用 `src/lib/reading/llm/safety.ts` 的实际实现判断，不要只看声明。

输出 docs/REVIEW_PRODUCT_POSITIONING.md。
禁止写"建议加强"这类空话；每条结论必须是可以直接开成任务卡的。
```

### P-2 · 信息架构与核心流程审查

```text
你是资深产品设计师，专长工具类产品的 IA 与流程。只读不改。

以 src/app 下的**真实路由**为唯一依据（先 glob 出全部 page.tsx），
绘制并审查信息架构：

1. **真实站点地图**：从 src/app 目录结构反推完整路由树，
   标注每个页面的：用途、是否需要登录、进入路径（从哪些页面能到达）、
   离开路径（能去哪）。**重点找孤儿页面**：除了直接输入 URL，没有任何入口能到达的页面。

2. **核心任务流走查**（逐步写出真实交互）：
   - 流 A：新用户 → 排八字 → 看解读 → 分享
   - 流 B：老用户 → 管理人物档案 → 批量排盘
   - 流 C：紫微用户 → 生成星盘 → 流月流日 → 解读
   - 流 D：六爻用户 → 起卦 → 看卦象 → 解读
   每条流写出：步骤数、每步的真实 URL 与组件、
   **卡点**（需要用户到哪里找按钮/需要二次确认/需要理解专业术语的地方）。

3. **导航一致性**：读 src/components/auth/SiteHeader.tsx。
   检查：三个术数入口是否等权可达？首页卡片 → 术数首页 → 新建 → 结果 → 解读，
   层级有几层？是否存在"进入解读后无法方便回到别的术数"的死胡同？

4. **状态与返回**：检查每个流程中的"取消/返回"行为。
   用户填了一半生日想退出会怎样？解读生成中刷新页面会怎样？
   （读 src/app/api/reading/status/route.ts 判断有无断点续传）

5. **空态与首次体验**：新用户首次进入 /charts、/people、/ziwei、/liuyao 会看到什么？
   （读这些 page.tsx 的空态分支）是否存在"一片空白无引导"的情况？

6. **重复劳动**：三个术数的新建流程是否各自重复实现了日期/地区/时辰输入？
   grep BirthWizard / ZiweiWizard / CastForm / RegionSelect / DateTimeFields 的复用关系，
   判断用户是否需要在不同术数间**重复输入同一份出生信息**。

输出 docs/REVIEW_PRODUCT_IA.md，
包含一张「问题 / 影响用户 / 严重度 P0-P2 / 证据 文件:行号」的表格，按严重度排序。
```

### P-3 · 信任、专业性与免责机制审查

```text
你是研究过玄学/占卜类产品可信度问题的产品专家。只读不改。
本项目已有 docs/PROJECT_REVIEW.md 提出的「三层模型」（事实/规则/叙事）与「统一引擎信封」
（schemaVersion/engineVersion/ruleSetVersion/school/calendarPolicy/warnings/evidence/inputFingerprint）。

任务：验证这套设计**是否真的落地到产品可见层**，还是只存在于文档。

1. **信封落地核查**：
   grep 三术数引擎的返回类型定义（src/lib/types/、src/lib/contracts/），
   逐字段核对：schemaVersion / engineVersion / ruleSetVersion / school / calendarPolicy /
   warnings / evidence / inputFingerprint 中，哪些**真实存在并有值**，
   哪些只是文档里写了、代码里没有。给出 `文件:行号` 对照表。

2. **用户可见性**：这些元数据有多少**展示给了用户**？
   grep 前端组件中是否渲染 engineVersion / school / warnings / evidence。
   如果只存在数据里、用户看不到，那"专业模式"（T292）就是未完成。

3. **warnings 的出口**：
   grep 所有产生 warnings 的位置（时辰未知、边界输入、流派冲突、DST 歧义），
   追踪它们是否最终被渲染。**未渲染的 warning 等于没有**。

4. **免责声明的有效性**：
   读 src/components/Disclaimer.tsx、src/components/reading/DisclaimerFooter.tsx、src/app/privacy/page.tsx、
   src/content/privacy.ts。评估：
   - 免责是否出现在**关键时刻**（结果页底部）而非只在首页；
   - 高风险类问题（婚恋/健康/财运）解读时是否有专门提示；
   - 文案是否可被普通用户理解（不要写"本内容不构成任何建议"这类法律套话）。

5. **反馈闭环**：
   读 src/lib/reading/calibrate.ts、src/components/reading/CalibrateBox.tsx、
   src/components/reading/CalibrateQuestion.tsx 与 src/app/chart/[id]/calibrate/page.tsx。
   docs/PROJECT_REVIEW.md 曾指出"历史事件校准只追加侧重文案，没有重新计算格局或用神，
   容易形成确认偏误"。**验证这个缺陷现在是否已修复**——校准后是否真的重算了？
   如果只是改了文案权重，明确指出这仍是确认偏误。

输出 docs/REVIEW_PRODUCT_TRUST.md，每条结论带 `文件:行号`。
最后给出「产品可信度缺口清单」，按对用户信任的伤害程度排序。
```

---

## Phase 2B · 设计视角

### D-1 · 视觉系统与一致性问题审计

```text
你是资深视觉设计师。基于 docs/REVIEW_DESIGN_INVENTORY.md 的盘点结果，做一致性审计。只读不改。

当前设计语言：深色底(#07080c) + 金(#d4a84b) + 青(#2ee6d6)，"赛博 + 传统"混合风格。
技术栈：Tailwind v4（配置在 globals.css 的 @theme inline 中，**没有 tailwind.config.js**）。

审计项，每项必须 grep 出真实出现次数与文件清单：

1. **硬编码值泛滥度**：
   grep `text-\[1[0-1]px\]`、`text-\[10px\]`、`bg-\w+/\d+`、`shadow-\[` 在全项目的分布。
   统计：多少处使用了未经 token 化的颜色/字号/阴影。列出出现最多的 10 个文件。

2. **颜色语义一致性**：
   gold 和 cyan 分别代表什么语义？（grep 它们的用法场景）
   检查是否存在同一个语义用两种颜色的情况——例如"主操作按钮"在某些页面是 gold、
   在另一些页面是 cyan。列出所有"主 CTA"按钮，标注其配色，找出不一致。

3. **组件重复实现**：
   grep 按钮样式：项目已有 src/components/ui/Button.tsx，
   但统计有多少页面**没有用它**而是手写了 `inline-flex h-12 items-center justify-center rounded-xl...`。
   列出所有手写按钮的位置（如 src/app/page.tsx:119-136 就是手写而非复用 Button）。
   给出手写样式的**参数漂移**（h-12 vs h-10、rounded-xl vs rounded-lg 等）。

4. **间距与栅格**：抽查 6 个页面的外层容器类（max-w-*、py-*、gap-*），
   列出实际使用的完整组合，指出不一致处。

5. **字号阶梯断层**：把全部 text-* 使用情况按出现频次排序。
   判断：是否存在 10px 这种低于移动端可读下限的正文？有多少处？

6. **动效**：grep transition / animate / duration。
   评估：有无统一时长标准？是否尊重 prefers-reduced-motion？
   （grep globals.css 中是否有该媒体查询）

输出 docs/REVIEW_DESIGN_CONSISTENCY.md，
含「问题 / 出现次数 / 代表位置 文件:行号 / 修复成本 S-M-L」表格。
```

### D-2 · 关键页面体验走查（重点：移动端）

```text
你是资深移动端交互设计师。只读不改。对核心页面做**逐屏走查**。

必读页面（全部读完再下结论）：
- src/app/page.tsx（首页）
- src/app/chart/new/page.tsx + src/components/form/BirthWizard.tsx（八字新建向导）
- src/components/form/{DateTimeFields,RegionSelect,StepProgress,Field}.tsx
- src/app/chart/[id]/page.tsx + src/components/chart/{BaziTable,DayunTimeline,WuxingBars,WuxingRadar}.tsx
- src/app/chart/[id]/reading/page.tsx + src/components/reading/*.tsx
- src/app/ziwei/[id]/page.tsx + src/components/ziwei/{PalaceGrid,PalaceCell}.tsx（十二宫网格——重点）
- src/app/liuyao/new/page.tsx + src/components/liuyao/{CastForm,HexagramVisual}.tsx

对每个页面输出：
1. **首屏信息层级**：用户 3 秒内看到什么？主 CTA 是否明确？
2. **移动端适配**（视口 375×667）：
   - 十二宫紫微盘在 375px 宽下如何布局？（读 PalaceGrid 的 grid 类名，估算每格宽度，判断文字是否溢出）
   - 八字表格（BaziTable）在窄屏是否需要横向滚动？滚动是否可发现？
   - 六爻爻线（YaoLine）尺寸是否适合触摸/阅读？
   - 长文本解读（SectionCard）的行长是否超过 75 字符导致阅读疲劳？
3. **表单体验**：BirthWizard 的分步逻辑——每步字段数、是否有进度提示、
   校验错误如何呈现、地区选择（RegionSelect，读 src/lib/geo/china-regions.ts 判断数据量）
   在大数据量下是否可搜索。
4. **触摸目标**：grep 所有按钮/链接的尺寸类，列出 <44×44px 的交互元素（移动端可点击性下限）。
5. **加载态**：grep loading / skeleton / Suspense。解读生成可能需要等待，
   读 src/app/api/reading/route.ts 与 src/app/api/reading/status/route.ts 判断是流式还是轮询，
   对应前端是否有进度反馈。
6. **暗色模式**：项目只有暗色。检查是否有对比度不足处（结合 D-0 的对比度计算结果）。

输出 docs/REVIEW_DESIGN_MOBILE.md。
**不要跑 dev server 截图**——基于代码类名和结构推理，并明确标注哪些结论需要真机验证。
最后单独给出「需要真机验证清单」。
```

### D-3 · 可访问性与内容设计审查

```text
你是无障碍（a11y）与内容设计专家。只读不改。

A. 无障碍审计（以 WCAG 2.2 AA 为基准，逐条给 grep 证据）

1. **语义结构**：grep 每个 page.tsx 的 <h1>。是否存在多个 h1 或完全没有 h1 的页面？
   标题层级是否跳跃（h1 → h3）？列出问题页面。
2. **Landmark**：读 src/app/layout.tsx（注意：它没有 <main>）。
   main 元素在各页面是否正确使用？nav/header/footer 是否语义化？
3. **键盘可达**：
   - grep 所有 onClick 绑定的 div/span（非 button 元素），这些无法用键盘触发。
   - 读 src/components/chart/ViewToggle.tsx、src/components/ziwei/PalaceCell.tsx，
     判断自定义交互组件是否支持 Tab/Enter/Space 与 aria 状态。
   - grep tabIndex，检查是否有 tabIndex > 0 的反模式。
4. **ARIA 正确性**：
   - Divination 结果的视觉元素（爻线、星曜徽章、五行柱）对屏幕阅读器是否有文本替代？
     grep aria-label / sr-only / role= 在 src/components/liuyao/、src/components/ziwei/、src/components/chart/ 的覆盖情况。
   - grep aria-expanded / aria-selected / aria-live，检查交互状态是否暴露。
   - 加载与错误提示是否有 aria-live（读 src/app/error.tsx）。
5. **色彩依赖**：五行配色（读 src/lib/bazi/wuxing/、globals.css）是否**仅靠颜色**传达信息？
   色盲用户在五行雷达图/柱状图上能否区分？grep 是否有图案/文字辅助。
6. **表单无障碍**：读 src/components/form/Field.tsx——label 是否正确关联 input？
   错误信息是否用 aria-describedby 关联？必填项是否用 aria-required？
7. **动效敏感**：grep prefers-reduced-motion，判断是否存在缺失。

B. 内容设计（微文案）审计

读 src/content/zh.ts（集中式文案）+ 各组件内的硬编码中文（grep 中文字符串）。
1. 列出**未走 content 层**的硬编码中文文案（如 src/app/page.tsx:123 "人物档案"、
   :144 "免责声明"），这些应集中管理。
2. 术语一致性：八字/紫微/六爻的专业术语（用神、大限、伏神、旬空、日辰…）
   在全站是否有统一说法？grep 找出同一概念的多种写法。
3. 文案语气：面向普通用户还是面向术数专家？抽查错误提示文案是否说人话
   （如"校验失败" vs "请检查出生日期"）。
4. 空态文案：新用户看到的是引导还是"暂无数据"？

输出 docs/REVIEW_DESIGN_A11Y.md，
含「WCAG 条款 / 问题 / 证据 文件:行号 / 等级 A-AA / 修复建议」表格。
```

---

## Phase 2C · 开发视角

### E-1 · 架构与代码质量审查（基于最新 Next.js 16 文档）

```text
你是资深 Next.js 架构师。只读不改。

⚠️ 关键前置：本项目使用 **Next.js 16.2.10**，其 App Router API 与训练数据可能不同。
**必须先读 `node_modules/next/dist/docs/` 下相关指南**（App Router、data fetching、caching、
route handlers、server/client components），确认当前版本的推荐写法，再评审代码。
不要用你记忆中的旧版 Next.js 规范下判断。

评审范围：src/app/**（路由与页面）、src/lib/**（业务逻辑）、src/components/**（视图）

1. **Server/Client 边界**：
   - grep `"use client"` 统计客户端组件数量与位置。
   - 检查是否符合"默认 Server Component，仅交互处 use client"。
   - 读 src/app/layout.tsx:26（`await getServerSession()`）：
     docs/PROJECT_REVIEW.md §2.6 曾指出"根布局读取会话使全部页面动态渲染"。
     **核实是否仍存在**，并追踪它对首页 / 公开分享页（src/app/share/[token]/page.tsx）
     的渲染模式（dynamic vs static）影响。给出影响页面清单。
   - 检查是否有 Server Component 中泄漏了敏感数据到客户端 props。

2. **数据流与存储抽象**：
   读 src/lib/storage/ 全部文件（driver.ts、mode.ts、idb.ts、cloud-store.ts、pg-*-store.ts、sync.ts）。
   - 画出真实的数据流：浏览器 IDB ↔ 服务端 Postgres ↔ 云存储。
   - 判断抽象是否清晰，是否存在**两套并行的存储实现**导致的逻辑分叉
     （本地路径与云端路径行为不一致）。
   - 读 src/lib/storage/migrate.ts + src/lib/storage/sync.ts，
     审查本地→云端迁移的幂等性与冲突解决策略（并发设备场景）。

3. **模块依赖方向**：
   - 检查 src/lib 内部是否有循环依赖（A 引 B，B 引 A）。
   - 检查 components 是否直接 import lib 的深层内部模块（如 `@/lib/bazi/pillars/buildPillars`
     而非 `@/lib/bazi`），破坏封装。
   - 检查 src/lib/types 与 src/lib/contracts 的职责重叠——两者都定义类型吗？
     是否应该合并？

4. **重复与抽象泄漏**：
   - 三术数引擎（bazi/ziwei/liuyao）是否有可提取的公共模式？
   - 读 src/lib/reading/{template,llm}/ 与 src/lib/reading/{ziwei,liuyao}/，
     判断八字/紫微/六爻的解读管线是否是**三份复制粘贴**。指出重复代码量。
   - 是否存在同一逻辑在客户端和服务端各实现一遍（读 src/lib/reading/llm/ 与
     src/lib/storage/cloud-hooks.ts）。

5. **错误处理**：
   - grep `catch` 统计吞掉异常的位置（catch 块为空或仅 console.log）。
   - 读 src/app/error.tsx、src/app/not-found.tsx 与各 API route 的错误分支，
     判断是否有统一的错误契约。

6. **性能**：
   - 读 next.config.ts，审查 images / headers / output 配置。
   - grep 三个新建向导顶部 import 的引擎模块
     （src/app/chart/new/page.tsx、src/app/ziwei/new/page.tsx、src/app/liuyao/new/page.tsx）：
     docs/PROJECT_REVIEW.md §2.6 指出"客户端直接加载完整计算引擎"。
     **核实是否仍存在**，如存在给出应拆分的模块清单。

7. **类型安全**：
   - grep `as any`、`as unknown as`、`@ts-ignore`、`@ts-expect-error`、`!` 非空断言
     的全部位置。评估每一处是否必要。
   - 检查 API 边界（src/lib/api/validate.ts）是否用 zod 严格解析
     而非"最小字段校验"。docs/PROJECT_REVIEW.md §2.1 曾指出此问题，核实是否已修复。

输出 docs/REVIEW_ENG_ARCHITECTURE.md：
先给「架构现状图」（文字版），再给「问题清单表」（问题/影响/严重度 P0-P2/证据 文件:行号/修复成本）。
**对每条问题必须给出具体的修复方案**（改哪个文件、怎么改），不要只说"建议重构"。
```

### E-2 · 安全与数据边界审查

```text
你是应用安全工程师。只读不改。以攻击者视角审查「赛博命理」。
注意：README 声明"W22–W28 安全整改基本完成"，你的任务是**验证这些整改是否真实有效**，
而非复述文档结论。

审查清单（逐项给 `文件:行号` 证据 + 判断"已修复/仍存在/无法确认"）：

A. 认证与账号（对照 docs/PROJECT_REVIEW.md §2.1 的 P0 列表）
1. 读 src/lib/auth/magic-link.ts、src/app/api/auth/magic-link/route.ts：
   - 邮件发送失败时是否**不再**返回有效登录链接？（原缺陷：发送失败仍返回链接 → 账号接管）
   - token 消费是否为**原子操作**？（并发请求能否重复成功）读消费实现判断。
   - token 是否一次性、有 TTL、绑定邮箱？
2. 读 src/lib/auth/session.ts + src/lib/auth/constants.ts：
   - AUTH_SECRET 强度是否有校验（读 src/lib/config/validate-prod.ts）？
   - cookie 是否 httpOnly / secure / sameSite？
   - 是否存在 AUTH_ALLOW_DEV_LOGIN 在生产被误开的风险？校验逻辑是否拦截？
3. 读 src/app/api/account/delete/route.ts + src/lib/auth/account.ts：
   - 删除是否有二次确认且不可省略？
   - 云端删除异常是否仍被吞掉（"返回成功但数据未删净"）？
   - 是否级联删除所有关联数据（charts/people/liuyao/ziwei/share）？逐表核对。

B. 授权与越权（IDOR）
grep 所有 `[id]` 动态路由（src/app/api/charts/[id]/route.ts、people/[id]、
ziwei-charts/[id]、liuyao-charts/[id]）：
- 每个 handler 是否校验**资源归属当前会话用户**？给出逐文件对照表。
- 未登录用户能否通过猜 id 读取他人命盘？分享 token 的权限边界在哪？
- 读 src/app/api/charts/[id]/route.ts 的 GET/PUT/DELETE，判断是否存在越权写/删。

C. API 边界
1. 读 src/lib/api/{validate,parse-body,origin,rate-limit}.ts：
   - 请求体上限是否统一应用（grep checkBodySize 的调用覆盖率，列出**未调用**的 route）？
   - Origin 校验（assertSameOrigin）覆盖了哪些 route？列出缺失的。
   - 限流覆盖了哪些 route？读 clientKeyFromRequest —— 是否仍直接信任
     `x-forwarded-for`（可伪造）？是否考虑了可信代理配置？
2. 服务端权威计算：读 src/lib/api/validate.ts 的 validateAuthoritativeBaziRequest
   与 stripAuthorityInput。核实**客户端提交的派生结果是否会被服务端忽略并重算**
   （原缺陷：可提交伪造派生结果影响保存/分享/LLM 解读）。
   逐字段核对：哪些字段仍被信任？
3. 日志脱敏：读 src/lib/api/logger.ts。grep 是否记录 IP、生日、姓名、email 等 PII。
   原缺陷"日志可能记录未脱敏客户端 IP"是否修复？
4. 错误泄露：grep API 响应中的 error 字段，检查是否返回堆栈、SQL、内部路径。

D. 注入与依赖
1. grep SQL 拼接（src/lib/db/、src/lib/storage/pg-*.ts）——
   是否全部使用参数化查询（postgres 模板字符串）？有无字符串拼接 SQL。
2. 读 src/lib/db/client.ts —— 数据库连接是否用了最小权限账号？
   grep 应用请求期间执行 DDL 的痕迹（原缺陷：请求期建表）。
3. 读 src/lib/reading/llm/client.ts + evidence.ts ——
   用户输入进入 LLM 时是否有 prompt injection 防护？
   用户能否通过输入让 LLM 输出违法违规内容？读 src/lib/reading/llm/safety.ts 判断。
4. 读 next.config.ts —— CSP 与安全响应头是否配置（原缺陷：缺少 CSP）？
   grep headers() 配置，逐个头列出（CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy）。

E. 隐私
读 src/app/privacy/page.tsx + src/content/privacy.ts + src/app/api/account/export/route.ts。
- 隐私政策描述的数据收集是否与代码实际行为**一致**？逐条核对（常见问题：政策没提
  第三方 LLM 会把命盘数据发出去）。
- 导出功能是否导出全部数据（GDPR 可携带权）？

输出 docs/REVIEW_ENG_SECURITY.md：
「漏洞 / 攻击场景（具体步骤）/ 影响 / 严重度 P0-P2 / 证据 文件:行号 / 修复方案」表格。
P0 项必须给出**可复现的攻击步骤**。无法确认的项明确标注"需运行时验证"，不要臆断。
```

### E-3 · 计算引擎正确性审查（三术数专业性）

```text
你是懂历法与术数规则的技术审校。只读不改。
本项目的立身之本是**计算正确性**——排错盘比 UI 丑严重得多。

⚠️ 原则：事实层（历法/干支/星曜/爻位）必须与权威来源一致；
规则层（旺衰/格局/四化/用神）必须在**明确流派**下自洽；
叙事层不得污染前两层。

A. 八字 (src/lib/bazi/)
1. 读 calendar/{solar,lunar,shichen,constants}.ts + boundary/index.ts：
   - 节气交接时刻（月柱分界）用的是哪套数据？精度到分还是到日？
   - 检查 src/lib/bazi/boundary/boundary.test.ts 覆盖了哪些临界点。
     **主动找测试未覆盖的边界**：节气当天出生、23:00-24:00 子时归属（早晚子时流派分歧）、
     立春前后、闰月、公历 1900/2100 边缘。
   - 读 src/lib/bazi/solar-time/ —— 真太阳时是否完整建模出生地经度、
     **历史夏令时（1986–1991 中国 DST）**与行政时区变化？
     读 src/lib/bazi/boundary/dst-scope.test.ts 判断覆盖范围。中国 1986-1991 实行过夏令时，
     这是常见错误点，务必核实。
2. 读 pillars/buildPillars.ts + dayun/index.ts：
   - 四柱推算与五虎遁/五鼠遁口诀是否一致？
   - 起运：docs/PROJECT_REVIEW.md §2.2 曾指出"正式大运仍按整岁和整数年份判断"。
     **核实是否已改为精确到月**。读 src/lib/bazi/dayun/dayun.test.ts 的断言。
   - 大运顺逆（阳男阴女顺行）判断是否正确？
3. 读 wuxing/、relations/、yongshen.ts + template/analyze.ts：
   - docs/PROJECT_REVIEW.md §2.2 指出"旺衰分析使用以天干字符为键的 tenGods 统计力量，
     相同天干重复出现时会被合并"。grep tenGods 的使用，**核实该缺陷是否已修复**。
   - 藏干权重、月令司令、透干、通根、刑冲合化是否结构化实现，还是仍用固定权重？
   - 用神判定（扶抑/调候/通关/病药）是否有冲突解释，还是压缩成单一"喜用五行"？
     读 src/lib/reading/template/constants.tiaohou.test.ts 判断调候表来源与完整性。
4. 读 src/lib/bazi/sensitivity.ts + sensitivity.test.ts：
   时辰未知时是否生成十二时辰候选+敏感性分析？还是仍只出六字盘？
5. 读 src/lib/bazi/__fixtures__/golden.test.ts + README.md：
   金标准用例来自哪个权威来源（万年历/排盘软件/典籍）？用例数量多少？
   逐条判断是否覆盖了上述边界。**列出缺失的金标准用例**（这是最该补的）。

B. 紫微 (src/lib/ziwei/)
1. 读 compute.ts + palaces.ts + calendar.ts：
   - docs/PROJECT_REVIEW.md §2.3 指出"大限使用 基准年-出生年，不是严格虚岁，可能错位一年"。
     grep 大限计算逻辑（daxian/index.ts），**核实是否已改为严格虚岁**。
   - 五行局、命宫身宫定位、紫微天府安星规则是否正确？
     读 tables/constants.ts 核对定局表与安星表。
2. 读 stars.ts + brightness.ts + sihua.ts + tables/：
   - 十四主星 + 辅星安放是否符合规则？亮度表来源？
   - 四化（生年/大限/流年/自化）区分是否清晰？读 zihua.ts + sihua.ts。
3. 流派命名空间：docs/PROJECT_REVIEW.md §2.3 指出"三合盘体、飞星、自化规则同时存在，
   但缺少流派命名空间和规则优先级"。读 feixing.ts + liuchang.ts + tables/feixing.ts，
   **核实是否已引入 school 命名空间**。若无，指出当前混合使用可能导致的矛盾结论。
4. 读 __fixtures__/iztro-compare.test.ts + scripts/compare-iztro.mjs：
   docs/PROJECT_REVIEW.md 指出"iztro 未固定为开发依赖；未安装时对照测试仍通过，
   对照脚本没有真正执行双方 diff"。**核实**：iztro 是否已在 package.json devDependencies
   （注意版本 2.5.8 已固定）？测试是否会在 iztro 缺失时**静默跳过**而非失败？
   读测试的 skip 分支判断——静默跳过等于对照失效。
5. 流月流日（读 src/lib/types/ziwei.ts + 相关实现）：
   月界/日界定义是否明确？适用流派是否标注？

C. 六爻 (src/lib/liuyao/)
1. 读 cast/{method,coins,time,rng,yao,resolve-gua}.ts：
   - docs/PROJECT_REVIEW.md §2.4 指出"时间起卦采用梅花易数先天数，再进入纳甲六爻分析，
     属于混合方法，应独立标识"。**核实是否已标注方法来源**。
   - 读 cast/rng.ts —— 随机数质量如何？（Math.random 还是 crypto）是否影响可复现性？
   - 三种起卦法（铜钱/时间/手动）是否在结果中明确标识？
2. 读 analyze/ 全部文件（kongwang/liushen/liuqin/palaces/shi-ying/fushen/dongbian/
   yongshen/yongshen-category/yongshen-status/yuepo/yingqi/scope）：
   - 逐一核对规则表正确性：旬空推法、六神起法、六亲定法、世应定位、月破定义。
   - docs/PROJECT_REVIEW.md §2.4 指出"用神主要依赖问题关键词"。
     读 yongshen-category.ts + yongshen.test.ts，**核实是否已增加问事类别/主体/性别/关系维度**。
   - 动变：dongbian.ts 是否实现了回头生克、化进化退、化空化破、冲合转换？
     原缺陷是"仅描述本爻与化爻五行关系"。
   - 读 __fixtures__/palace-exhaustive.test.ts —— 穷举测试覆盖了多大的状态空间？
     给出具体数字（如 64 卦 × N 变爻）。
3. 读 data/hexagrams.ts + sources.ts：
   64 卦数据完整性与来源标注。grep 是否有卦缺失或占位符。

D. 跨引擎一致性
1. 三引擎的**信封字段**是否统一（schemaVersion/engineVersion/ruleSetVersion/school/
   calendarPolicy/warnings/evidence/inputFingerprint）？给出三引擎对照表。
2. 三引擎的**农历转换**是否共用同一实现？（读 src/lib/bazi/calendar/lunar.ts
   与 src/lib/ziwei/calendar.ts）如果各写一套，是否存在口径不一致的风险？
3. 依赖版本：package.json 中 lunar-javascript ^1.7.7 —— 农历数据是否有已知错误？
   如无法联网核实，标注"需外部验证"。

输出 docs/REVIEW_ENG_ENGINE.md：
分 八字/紫微/六爻/跨引擎 四节。每个问题给「问题 / 流派归属 / 影响（排错盘/解读偏差）/
证据 文件:行号 / 验证方法（具体该写什么测试）/ 优先级」。
**对不确定的规则明确说明不确定**，禁止臆断典籍依据。
最后给出「应补充的金标准测试清单」（具体到输入值 → 期望输出）。
```

### E-4 · 性能、可靠性与可观测性审查

```text
你是 SRE / 性能工程师。只读不改。

A. 性能
1. **首屏体积**：读三个新建向导与结果页的 import 图
   （src/app/chart/new/page.tsx、src/app/ziwei/new/page.tsx、src/app/liuyao/new/page.tsx、
   src/components/chart/**、src/components/ziwei/**、src/components/liuyao/**）。
   估算：哪些计算引擎模块被打进客户端 bundle？哪些本可留在服务端？
   给出应拆分的具体模块与拆分方式（dynamic import / Server Component / 移到 API）。
2. **渲染模式**：读 src/app/layout.tsx（根布局 await session）。
   列出因此被迫 dynamic 渲染的**公开页面**（首页、share/[token]、privacy、not-found），
   这些本可静态化。给出修复思路（把会话依赖下沉到组件级 + Suspense）。
3. **数据库**：读 src/lib/db/schema.ts + migrate.sql + src/lib/storage/pg-*.ts：
   - 列出全部表与索引。检查高频查询字段是否建索引
     （按 user_id 查 charts/people、按 token 查 share）。
   - 是否存在 N+1 查询（在循环里 await db 查询）？grep 判断。
   - 读 src/lib/storage/sync.ts —— 批量同步是逐条还是批量插入？
4. **外部依赖**：读 src/lib/reading/llm/client.ts —— 有无超时/重试/并发上限？
   LLM 调用是流式还是等待完整响应（影响用户感知延迟）？
   读 src/app/api/reading/status/route.ts 判断任务模型。
5. **缓存**：grep `revalidate`、`cache`、`unstable_cache`、`no-store`。
   哪些本可缓存的计算结果在重复计算？（同一命盘反复访问结果页）

B. 可靠性
1. **健康检查**：读 src/app/api/health/route.ts + health/ready/route.ts + src/lib/health/readiness.ts。
   ready 探针是否检查了真实依赖（DB、Redis）？降级行为如何？
2. **降级路径**：读 src/lib/storage/{mode,driver}.ts + src/lib/share/share-store.ts。
   - Redis/Postgres 不可用时是否优雅降级？降级是否会**静默丢数据**？
   - 读 src/lib/share/local-file.ts —— 生产用文件存储的风险（多实例/无持久盘）。
     读 src/lib/config/validate-prod.ts 判断是否**强制**禁止生产用文件存储。
3. **幂等与并发**：读 src/lib/storage/migrate.ts + sync.ts ——
   多设备并发上传同一命盘会怎样？有无乐观锁/版本号？
4. **限流降级**：读 src/lib/api/rate-limit.ts ——
   内存限流在多实例下失效，生产是否强制要求 Redis？读 validate-prod.ts 核实。

C. 可观测性
1. 读 src/lib/api/logger.ts + src/instrumentation.ts：
   - 日志是结构化 JSON 吗？含 requestId 吗？能跨请求追踪吗？
   - 有无错误上报（Sentry 类）？无则指出生产排障盲区。
2. 关键业务指标：grep 是否有排盘/解读成功率的埋点。无则指出**产品无法度量**。
3. 读 src/app/api/health/*.ts 的输出，判断能否被监控系统直接消费。

D. 部署
1. 读 Dockerfile + next.config.ts：
   - 是否 standalone 输出？是否非 root 用户？（对照 docs/EXECUTION_GUIDE.md §6 Docker 测试矩阵）
   - 有无 healthcheck 指令？
2. 读 compose.yaml / compose.production.yaml / compose.acceptance.yaml：
   - 三者差异是什么？生产 compose 是否真的用了强密钥与外部存储？
   - 读 .env.docker.example 与 scripts/validate-prod-env.mjs，判断校验是否覆盖了
     AUTH_ALLOW_DEV_LOGIN 关闭、Postgres 必填、Redis 必填。
3. 读 deploy/{Caddyfile.example,nginx.example.conf}：
   - 反向代理是否设置了安全头、真实 IP 传递（X-Forwarded-For **且**限流只信任可信代理）、
     超时、限流？
4. 读 scripts/backup-postgres.example.ps1 + docs/DEPLOY.md：
   备份恢复是否有**演练记录**？（docs/PROJECT_REVIEW.md §5 要求"备份恢复演练"）

输出 docs/REVIEW_ENG_OPS.md：
「领域 / 问题 / 影响面 / 严重度 / 证据 文件:行号 / 修复方案」表格。
另附「上线前必须验证清单」（可执行的命令级步骤）。
```

---

## Phase 3 · 交叉仲裁

### X-1 · 三视角冲突仲裁与优先级排序

```text
你是技术负责人（Tech Lead），负责在 产品 / 设计 / 开发 三方 review 结论之间做仲裁。

前置：读齐以下 9 份报告（若某份不存在，明确说明并跳过）：
- docs/REVIEW_PRODUCT_BASELINE.md / REVIEW_PRODUCT_POSITIONING.md /
  REVIEW_PRODUCT_IA.md / REVIEW_PRODUCT_TRUST.md
- docs/REVIEW_DESIGN_INVENTORY.md / REVIEW_DESIGN_CONSISTENCY.md /
  REVIEW_DESIGN_MOBILE.md / REVIEW_DESIGN_A11Y.md
- docs/REVIEW_ENGINEERING_BASELINE.md / REVIEW_ENG_ARCHITECTURE.md /
  REVIEW_ENG_SECURITY.md / REVIEW_ENG_ENGINE.md / REVIEW_ENG_OPS.md

产出 docs/REVIEW_SYNTHESIS.md：

1. **去重合并**：多份报告指向同一问题的，合并为一条，标注「由 N 个视角共同发现」
   （多视角共现 = 高优先级信号）。
2. **冲突仲裁**：找出三方结论矛盾之处，逐条裁决。典型冲突：
   - 产品要加功能 vs 工程要还技术债 —— 谁先？
   - 设计要提升视觉冲击 vs 可访问性要求降低动效/提高对比度
   - 产品要"专业模式"暴露复杂选项 vs 设计要简化新手路径
   每条给出**裁决 + 理由 + 对另一方的补偿措施**。
3. **统一问题清单**：一张大表，字段：
   `ID | 视角 | 问题 | 证据 文件:行号 | 严重度(P0/P1/P2) | 影响用户 | 修复成本(S/M/L) | 依赖 | 建议波次`
4. **优先级排序规则**（严格执行，不要凭感觉）：
   - **P0 = 正确性错误 / 安全漏洞 / 数据丢失 / 合规风险**（排错盘、越权、删数据不干净）
   - **P1 = 阻断核心流程 / 严重体验缺陷 / 门禁不达标**（走不通、看不懂、构建失败）
   - **P2 = 一致性、打磨、技术债**（不影响可用性）
   明确说明：**P0 修复前不投入任何新功能开发**。
5. **修复路线图**：把 P0/P1 分成 3 个批次，每批满足：
   - 写集互斥（不与其他批次改同一文件）
   - 每批结束后 `npm run check` 可通过
   - 每批可独立回滚
   每批列出：包含的问题 ID、涉及文件、验收标准、预计工作量（S/M/L）。
6. **应补的测试清单**：汇总三方提出的缺失测试，按「金标准 / 边界 / API / E2E / 安全」分类。
7. **不做什么**：明确列出本轮**不修**的问题及理由（避免范围蔓延）。

最后输出「如果只能做 5 件事」的清单 —— 列出投入产出比最高的 5 项。
```

---

## Phase 4 · 修复执行

### F-1 · P0 修复（正确性与安全）

```text
你是资深工程师，执行 docs/REVIEW_SYNTHESIS.md 中标记为 **P0** 的修复。

前置阅读：
- docs/REVIEW_SYNTHESIS.md（问题清单与批次）
- docs/EXECUTION_GUIDE.md §5 DoD 与 §6 测试矩阵
- AGENTS.md（⚠️ 本项目 Next.js 16 有破坏性变更，
  **写代码前必须读 `node_modules/next/dist/docs/` 下相关指南**，不要凭记忆写）

执行规则：
1. **一个问题一个 commit**，commit message 用 `fix: <中文简述>`（P0 安全类用 `fix(security):`）。
   禁止把多个不相关问题混在一个 commit。
2. **先写失败的测试，再修**。每个 P0 修复必须留下一个能复现原缺陷的测试：
   - 安全类 → 测试攻击场景（如并发消费 magic link token）
   - 引擎类 → 金标准用例（具体输入 → 期望输出，注明来源）
   - 数据类 → 断言删除的级联完整性
3. **修复必须是最小改动**。不做顺手重构、不改无关格式、不加新依赖。
4. 涉及安全或引擎规则时，按 docs/EXECUTION_GUIDE.md §3 走分支 `codex/t<任务号>-<slug>`，
   不在 main 上直接改。
5. 每完成一项，跑：
   `npm run lint -- --max-warnings=0 && npm test && npx tsc --noEmit && npm run build`
   任一失败就修到通过，**不要跳过**。

对每个 P0 问题输出：
- 问题复述（一句话）
- 根因（精确定位到 文件:行号）
- 修复方案（改哪个文件、怎么改、为什么这样改）
- 新增测试（文件路径 + 测试断言）
- 验证证据（命令 + 真实输出）
- 回滚方式

禁止事项：
- 禁止跳过失败测试 / 用 `.skip` 掩盖
- 禁止降低断言强度让测试通过
- 禁止在 fixture 或快照中写入真实姓名、生日、邮箱等 PII
- 禁止用 `as any` / `@ts-ignore` 绕过类型错误

完成后输出 docs/FIX_REPORT_P0.md。
```

### F-2 · P1 修复（流程、体验与门禁）

```text
你是资深全栈工程师 + 交互设计师，执行 docs/REVIEW_SYNTHESIS.md 中标记为 **P1** 的修复。

范围：阻断核心流程的问题、严重体验缺陷、工程门禁不达标项。
（P0 必须已全部完成——先读 docs/FIX_REPORT_P0.md 确认，若未完成则停止并报告。）

分类执行：

**A. 工程门禁类**
- 按 docs/EXECUTION_GUIDE.md §5 与 docs/PROJECT_REVIEW.md §5：
  目标是把 lint warning 清零（原基线 8 个 → 0），补齐缺失的 API/E2E 测试。
- 每消除一类 warning，同步更新 .github/workflows 中的 `--max-warnings` 数值，
  形成单调下降的门禁。

**B. 体验类**（与 A 并行时注意写集互斥）
- 修复 P1 流程卡点：孤儿页面、找不到的 CTA、重复输入出生信息、无引导的空态。
- 修复移动端 P1：横向溢出、<44px 触摸目标、超长行宽。
- 修复 a11y 的 Level A 违规（缺 h1、键盘不可达、表单 label 未关联）。
- **每个体验修复必须写 E2E 测试**（Playwright，参照 e2e/critical-flows.spec.ts 的写法），
  断言修复后的行为。
- 优先复用 src/components/ui/Button.tsx 等既有组件，消除手写样式漂移
  （如 src/app/page.tsx:119-136 的手写按钮改为 Button）。

**C. 性能类**
- 拆分会话依赖：把 src/app/layout.tsx 的 `await getServerSession()` 下沉，
  让首页与公开分享页恢复可静态化。改完验证渲染模式确实变化。
- 把客户端不必要的计算引擎移出 bundle（具体模块清单来自 REVIEW_ENG_ARCHITECTURE.md），
  记录改动前后的构建产物大小对比。

规则：
- 一次一个主题一个 commit（`perf:` / `a11y:` / `feat:` / `refactor:`）。
- 每个改动前后对比可量化指标（bundle 大小、warning 数、测试数），写进报告。
- 改完跑完整门禁：`npm run check`。
- **不改变既有业务规则**（引擎逻辑属 P0/F-1 范围或另开任务卡）。

输出 docs/FIX_REPORT_P1.md，含每项的「改动前 → 改动后」对比数据。
```

### F-3 · P2 优化与设计系统收口

```text
你是资深设计工程师，执行 docs/REVIEW_SYNTHESIS.md 中标记为 **P2** 的优化。

**A. 设计系统收口**（依据 docs/REVIEW_DESIGN_INVENTORY.md 与 REVIEW_DESIGN_CONSISTENCY.md）
1. 把高频硬编码值下沉为 token（在 src/app/globals.css 的 `@theme inline` 中定义）：
   - `text-[10px]` 这类字号 → 定义语义化字号阶（如 --text-caption）
   - `gold/NN`、`cyan/NN` 透明度 → 定义语义化颜色（如 --color-gold-soft）
   - 长阴影值 → 定义 --shadow-glow-gold / --shadow-glow-cyan
   原则：**只下沉出现 ≥3 次的值**，避免过度抽象。
2. 删除 D-0 盘点出的死 token。
3. 统一点击目标与按钮规格：把散落的手写按钮全部改为复用
   src/components/ui/Button.tsx，必要时给 Button 增加 variant，而不是新增组件。
4. **每改一个 token，必须全项目替换并跑测试**，避免视觉回归无声发生。

**B. 可访问性 AA 收口**（依据 docs/REVIEW_DESIGN_A11Y.md）
- 修正 <4.5:1 的文本对比度（改 token 值，不改设计语言本质）
- 给五行可视化增加非颜色编码（图案/文字标签），让色盲用户可读
- 补齐 aria-live（加载/错误提示）、aria-label（爻线/星曜视觉元素）
- 增加 `prefers-reduced-motion` 支持

**C. 文案与内容**
- 把硬编码中文迁入 src/content/zh.ts（保持集中管理约定）
- 统一专业术语（同概念一个说法）
- 错误提示改为可操作的人话（"请检查出生日期"而非"校验失败"）

**D. 技术债**
- 消除 `as any` / `@ts-ignore`（能修则修，不能修则加注释说明原因）
- 合并 src/lib/types 与 src/lib/contracts 的重叠定义（如确认应合并）
- 提取三术数解读管线的重复代码（仅在重复量 >100 行时才做）

硬性约束：
- **视觉不得发生意外变化**：改 token 时保持等效色值/尺寸。
  若必须微调（如为对比度提高亮度），逐条列出改变前后的值并说明理由。
- 每个 commit 跑 `npm run check` 与 `npm run test:e2e`。
- 不引入新依赖（如需图标库等，先说明理由并单独征询）。

输出 docs/FIX_REPORT_P2.md，含「token 变更对照表」与「对比度修正前后数值表」。
```

---

## Phase 5 · 复验

### V-1 · 独立复验（禁止自我验收）

```text
你是**独立的第三方复验工程师**，未参与任何修复。
你的任务是**试图证伪**修复结论，而不是确认它们。

前置：读 docs/FIX_REPORT_P0.md、FIX_REPORT_P1.md、FIX_REPORT_P2.md 与
docs/REVIEW_SYNTHESIS.md。

⚠️ 铁律：**修复者不能验收自己的修复**。不要相信报告中的"已修复"，只相信你亲手执行的证据。

执行：

1. **重跑全部门禁**（记录真实输出与退出码，与 FIX_REPORT 中的声称对比）：
   `npm run lint -- --max-warnings=0`
   `npx tsc --noEmit`
   `npm test`
   `npm run build`
   `npm run test:e2e`（如环境允许；不允许则明确标注"未执行"）

2. **逐条验证 P0 声明**：
   对 REPORT 中每个"已修复"，**独立设计一个攻击/反例**：
   - 声称 magic link 原子消费 → 写并发测试验证是否真只成功一次
   - 声称越权已修 → 用两个账号交叉尝试读/写/删对方资源
   - 声称删除已级联 → 删除后直接查库核对残留记录
   - 声称服务端权威计算 → 提交伪造派生字段，验证是否被忽略
   - 声称引擎某缺陷已修 → 用 F-1 未使用过的新输入复现原缺陷
   **攻不破才算通过**。攻破了就记为"复验失败"并给出复现步骤。

3. **回归检查**：
   - 修复是否引入了新的失败测试或 lint warning？
   - 是否有测试被 `.skip`、断言被弱化、mock 被放宽？
     （用 `git log -p` 检查测试文件的改动，重点看断言是否变松）
   - 是否有 PII 进入了 fixture / 快照 / 日志？
4. **门禁一致性**：对照 docs/PROJECT_REVIEW.md §5「公开 Beta 门槛」9 条，逐条判定
   「达标 / 未达标 / 无法验证」，给证据。

5. **文档真实性**：README.md 的「当前状态」与「路线图」是否与实际一致？
   检查"15/18 done""lint 8 warnings"这类具体数字是否已更新。
   docs/REMEDIATION_TASKS.md 中 T251/T300/T301 仍为 review 状态——
   核实它们的 DoD 是否真的满足，或应改回 in-progress。

输出 docs/REVIEW_VERIFICATION.md：
「声明 / 我的验证方法 / 实际结果 / 判定（通过/失败/无法验证）/ 证据」表格。
最后给出**仍未解决的问题清单**与**下一轮建议**。

若发现 ≥1 项 P0 复验失败，明确写出：
「当前状态不允许发布，原因：...」
```

---

## 附录 A · 快速上手（第一次用这套提示词）

如果不想一次跑全部，按这个最小路径走：

```text
第 1 步：E-0（工程基线）        → 知道现在能不能构建、测试是否通过
第 2 步：E-2（安全）            → 玄学产品涉及生日/姓名/位置，隐私是第一位
第 3 步：E-3（引擎正确性）      → 排错盘是产品的立身之本
第 4 步：P-0 + D-0（事实基线）  → 建立产品与设计的共同事实基础
第 5 步：X-1（仲裁）            → 拿到统一优先级清单
第 6 步：F-1（P0 修复）         → 只修 P0
第 7 步：V-1（独立复验）        → 必须有第三方验收
```

## 附录 B · 三条最容易被忽略的事

1. **本项目的 Next.js 16.2.10 不是你训练数据里的版本。**
   任何写代码的提示词都必须强制 agent 先读 `node_modules/next/dist/docs/`。
   `AGENTS.md` 里已经写了这条规则，但 review 类提示词容易漏掉。

2. **术数产品的"专业正确性"没有单一标准答案，流派分歧是常态。**
   所以 E-3 的验收标准不是"算对了"，而是"**在声明了流派的前提下自洽、可复核、有外部来源**"。
   如果 agent 给出"这个规则应该改成 X"却没有注明流派和来源，那是幻觉，必须打回。

3. **"已修复"必须由攻击性复验确认。**
   项目文档里已经写了 15/18 done，但 T251/T300/T301 卡在 review。
   这正是因为**开发者自评不等于验收通过**。V-1 是本套提示词里最不能省的一步。
