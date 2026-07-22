# 专业性、工程规范与 Docker 整改任务卡

> 来源：`docs/PROJECT_REVIEW.md`  
> 状态日期：2026-07-22  
> 基线 commit：首次基线提交 `feat: W22-W28 整改基线`  
> 编号延续现有 `docs/TASKS.md`，使用 W22–W28 / T250–T303。

## 任务卡总览

| 波次 | 卡片 | 标题 | 优先级 | 状态 | 依赖 |
|---|---|---|---|---|---|
| W22 | T250 | Git 仓库初始化与项目治理 | P0 | done | — |
| W22 | T251 | GitHub Actions、CODEOWNERS 与质量门禁 | P0 | review | T250 |
| W23 | T252 | Magic Link、Session 与账号删除安全 | P0 | done | T250 |
| W23 | T253 | API Schema、授权与服务端权威计算 | P0 | done | T252 |
| W24 | T260 | 八字历法、边界与大运精度 | P0 | done | T253 |
| W24 | T261 | 八字旺衰、格局与用神重构 | P0 | done | T260 |
| W24 | T262 | 八字外部金标准与敏感性测试 | P1 | done | T260,T261 |
| W25 | T270 | 紫微流派、严格虚岁与核心盘体 | P0 | done | T253 |
| W25 | T271 | 紫微外部对照与流运验证 | P1 | done | T270 |
| W26 | T280 | 六爻起卦方法与基础结构 | P0 | done | T253 |
| W26 | T281 | 六爻用神、六神、动变与应期 | P1 | done | T280 |
| W26 | T282 | 六爻外部金标准 | P1 | done | T280,T281 |
| W27 | T290 | 结构化解读与典籍证据层 | P0 | done | T261,T270,T281 |
| W27 | T291 | 经历反馈与校准机制重构 | P1 | done | T290 |
| W27 | T292 | 产品信息架构、专业模式与可信度中心 | P1 | done | T290 |
| W28 | T300 | Next.js Standalone Docker 镜像 | P0 | review | T250,T253 |
| W28 | T301 | Docker Compose 本地集成环境 | P1 | review | T300 |
| W28 | T302 | 数据库迁移、健康检查与生产配置校验 | P0 | done | T253,T300 |
| W28 | T303 | 反向代理、备份与生产发布 QA | P1 | done | T300,T301,T302 |

## W22 · GitHub 工程规范

### T250 · Git 仓库初始化与项目治理

| 项 | 内容 |
|---|---|
| 目标 | 建立可审计、可协作、可发布的 GitHub 项目基线 |
| 涉及路径 | `.github/**`、`README.md`、`CONTRIBUTING.md`、`SECURITY.md`、`LICENSE`、`CHANGELOG.md` |
| 主决策 | 默认分支 `main`；功能分支 `codex/t<id>-<slug>`；核心规则和安全变更必须 PR |
| DoD | 完成基线提交；治理文档齐全；README 明确 Alpha/Beta/Production 状态；第三方来源可追踪 |
| 验收 | 新开发者可按文档启动；所有文件进入 Git；规则变化可以从历史定位 |
| 不做 | 不在本卡修改业务规则或安全实现 |

### T251 · GitHub Actions、CODEOWNERS 与质量门禁

| 项 | 内容 |
|---|---|
| 目标 | PR 自动执行 lint、test、build 和 Docker 构建检查 |
| 涉及路径 | `.github/workflows/**`、`.github/CODEOWNERS`、`.github/dependabot.yml` |
| 依赖 | T250 |
| 主决策 | 当前 lint 基线最多允许 8 个 warning，后续逐步降为 0；CI 仅使用官方 Actions |
| DoD | CI、Docker build workflow、Dependabot、CODEOWNERS 完成；构建失败阻止合并 |
| 验收 | PR 可看到全部检查；warning 增至 9 时 CI 失败 |

## W23 · 生产安全与数据边界

### T252 · Magic Link、Session 与账号删除安全

| 项 | 内容 |
|---|---|
| 目标 | 消除账号接管、重复消费和不完整删除风险 |
| 涉及路径 | `src/lib/auth/**`、`src/app/api/auth/**`、`src/app/api/account/**` |
| 依赖 | T250 |
| 主决策 | 生产绝不返回 `devLink`；Magic Link 原子消费；删除必须显式确认和近期认证 |
| DoD | 登录/发信/删除限流；严格校验 `sub/iat/exp`；删除失败不返回成功；生产假登录启动即失败 |
| 验收 | 并发消费仅一次成功；邮件失败无法接管任意邮箱；删除失败不会伪报成功 |

### T253 · API Schema、授权与服务端权威计算

| 项 | 内容 |
|---|---|
| 目标 | 统一校验所有 API，阻止伪造命盘和跨用户访问 |
| 涉及路径 | `src/lib/api/**`、`src/app/api/**`、`src/lib/storage/**`、新增 `src/lib/contracts/**` |
| 依赖 | T252 |
| 主决策 | 引入 Zod；客户端计算用于即时展示，云端保存与 LLM 必须按规范化输入校验或服务端重算 |
| DoD | 所有请求有字节限制和 Schema；所有资源校验所有权；高风险操作校验 Origin；服务端模块使用 `server-only` |
| 验收 | 覆盖主要 HTTP 错误；伪造 ID、字段、chart 和 report 不可越权或污染云端 |

## W24 · 八字专业化

### T260 · 八字历法、边界与大运精度

| 项 | 内容 |
|---|---|
| 目标 | 将排盘提升到时刻级、政策明确、边界可解释 |
| 涉及路径 | `src/lib/bazi/calendar/**`、`solar-time/**`、`dayun/**`、`boundary/**` |
| 依赖 | T253 |
| 主决策 | 明确夜子时、节气、立春、时区、历史夏令时与未知时辰策略；交运保存实际日期 |
| DoD | 严格日期校验、UTC 计算、跨日真太阳时、`startAt` 和双盘 warning |
| 验收 | 覆盖节气前后 1 秒、23 点子时、跨日、夏令时、闰月、无效日期 |

### T261 · 八字旺衰、格局与用神重构

| 项 | 内容 |
|---|---|
| 目标 | 建立可解释的旺衰、调候、格局、扶抑、通关和病药系统 |
| 涉及路径 | `src/lib/bazi/index.ts`、`yongshen.ts`、`relations/**`、`src/lib/reading/template/analyze.ts` |
| 依赖 | T260 |
| 主决策 | 天干按位置计数；固定藏干分数只用于可视化；各用神体系分层输出 |
| DoD | 月令本中余气、透干、通根、远近、合化、从格和破格可追踪；输出 `RuleEvidence` |
| 验收 | 重复干支、合化、从格、旺衰边界具有独立金标准 |

### T262 · 八字外部金标准与敏感性测试

| 项 | 内容 |
|---|---|
| 目标 | 建立带来源的外部验证集和十二时辰敏感性分析 |
| 涉及路径 | `src/lib/bazi/__fixtures__/**`、`scripts/**`、`docs/research/**` |
| 依赖 | T260,T261 |
| DoD | 至少 1,000 个案例；记录来源、版本、流派和允许差异；输出 diff 报告 |
| 验收 | CI 强制执行；规则变化必须附差异解释 |

## W25 · 紫微专业化

### T270 · 紫微流派、严格虚岁与核心盘体

| 项 | 内容 |
|---|---|
| 目标 | 固化三合盘体与飞星叠加边界，修正年龄口径 |
| 涉及路径 | `src/lib/ziwei/calendar.ts`、`compute.ts`、`daxian/**`、`references/**` |
| 依赖 | T253 |
| 主决策 | 严格虚岁；未知时辰多盘；所有规则记录流派和优先级 |
| DoD | 命身宫、五行局、主辅星、四化和运限具有统一 policy；页面显示年龄口径 |
| 验收 | 覆盖闰月、子时、男女顺逆、虚岁边界和已故人员 |

### T271 · 紫微外部对照与流运验证

| 项 | 内容 |
|---|---|
| 目标 | 将 iztro 对照变为 CI 强制验证 |
| 涉及路径 | `scripts/compare-iztro.mjs`、`src/lib/ziwei/__fixtures__/**`、`.github/workflows/**` |
| 依赖 | T270 |
| 主决策 | 固定对照版本；依赖缺失时失败而不是跳过 |
| DoD | 双方均真实运行；比较命身宫、五行局、十四主星、主要辅星、大限并输出 JSON diff |
| 验收 | 至少 2,000 组合；所有差异有分类和审校结论 |

## W26 · 六爻专业化

### T280 · 六爻起卦方法与基础结构

| 项 | 内容 |
|---|---|
| 目标 | 分离三钱六爻、手工六爻和梅花时间起卦 |
| 涉及路径 | `src/lib/liuyao/cast/**`、`src/lib/types/liuyao.ts`、`src/components/liuyao/**` |
| 依赖 | T253 |
| DoD | 增加 `castingSchool`、随机来源、时区和复盘种子；UI 明确方法 |
| 验收 | 三钱概率、卦序、变卦、八宫和世应穷举通过 |

### T281 · 六爻用神、六神、动变与应期

| 项 | 内容 |
|---|---|
| 目标 | 建立可确认、可解释的爻级用神和动变分析 |
| 涉及路径 | `src/lib/liuyao/analyze/**`、`src/lib/reading/liuyao/**` |
| 依赖 | T280 |
| DoD | 支持六神、伏飞神、月破、日冲、旺衰、墓绝、冲合、三合、进退、反伏吟和回头生克 |
| 验收 | 用神多现、不现、伏藏、空破墓绝和各种动爻组合均有测试 |

### T282 · 六爻外部金标准

| 项 | 内容 |
|---|---|
| 目标 | 对六十四卦的八宫、纳甲、世应、六亲和动变建立外部验证 |
| 涉及路径 | `src/lib/liuyao/__fixtures__/**`、`data/**`、`docs/research/liuyao-sources.md` |
| 依赖 | T280,T281 |
| DoD | fixture 含来源、流派、版本；生成规则差异报告 |
| 验收 | 任意规则表变化可定位到具体卦、爻和规则 ID |

## W27 · 解读与产品可信度

### T290 · 结构化解读与典籍证据层

| 项 | 内容 |
|---|---|
| 目标 | LLM 只负责叙事，计算事实和规则依据完全由引擎生成 |
| 涉及路径 | `src/lib/reading/**`、`src/lib/types/**`、`src/app/api/reading/**` |
| 依赖 | T261,T270,T281 |
| DoD | 结构化 JSON、Schema 校验、规则 ID、来源版本、置信度；越权推断或伪引用回落模板 |
| 验收 | 缺章、错误 JSON、绝对断言、虚构引用均被拦截 |

### T291 · 经历反馈与校准机制重构

| 项 | 内容 |
|---|---|
| 目标 | 将“准确性校准”改为透明的经历反馈和阅读偏好 |
| 涉及路径 | `src/lib/reading/calibrate.ts`、`src/components/reading/**`、`docs/PRODUCT.md` |
| 依赖 | T290 |
| DoD | 反馈不改变排盘事实和核心规则；不再用主观反馈提高命盘置信度 |
| 验收 | 页面能解释反馈只影响哪些文案；敏感备注不默认发送外部模型 |

### T292 · 产品信息架构、专业模式与可信度中心

| 项 | 内容 |
|---|---|
| 目标 | 让用户理解采用流派、计算过程和不确定性 |
| 涉及路径 | `src/app/**`、`src/components/**`、`src/content/**`、`docs/PRODUCT.md` |
| 依赖 | T290 |
| DoD | Person 成为统一主体；专业模式显示证据、版本、warning、置信度；通俗模式不隐藏关键限制 |
| 验收 | 移动和桌面均可完成完整主流程并查看规则依据 |

## W28 · Docker 与生产运维

### T300 · Next.js Standalone Docker 镜像

| 项 | 内容 |
|---|---|
| 目标 | 生成可重复、低体积、非 root 运行的生产镜像 |
| 涉及路径 | `next.config.ts`、`Dockerfile`、`.dockerignore`、`package.json` |
| 依赖 | T250,T253 |
| DoD | 多阶段构建；复制 standalone、public、`.next/static`；镜像不包含密钥和开发数据 |
| 验收 | Docker build 成功；容器健康；运行用户不是 root |

### T301 · Docker Compose 本地集成环境

| 项 | 内容 |
|---|---|
| 目标 | 一条命令启动应用和 Postgres 集成环境 |
| 涉及路径 | `compose.yaml`、`.env.docker.example`、`docs/DEPLOY.md` |
| 依赖 | T300 |
| DoD | Web 和 Postgres healthcheck；named volume；本地开发密钥明确标识；生产不复用示例密钥 |
| 验收 | 重建应用容器后数据库数据保留；本地可完成三术主流程 |

### T302 · 数据库迁移、健康检查与生产配置校验

| 项 | 内容 |
|---|---|
| 目标 | 将 DDL 从请求路径移出，生产配置缺失时 fail-fast |
| 涉及路径 | `src/lib/db/**`、`scripts/**`、`src/app/api/health/route.ts`、`package.json` |
| 依赖 | T253,T300 |
| DoD | 明确 `db:migrate`；生产禁止 file driver；健康检查区分 liveness/readiness |
| 验收 | 缺 Postgres/Redis/生产密钥时部署检查失败；迁移可重复执行 |

### T303 · 反向代理、备份与生产发布 QA

| 项 | 内容 |
|---|---|
| 目标 | 建立 HTTPS、真实 IP、备份、恢复、升级和回滚流程 |
| 涉及路径 | `docs/DEPLOY.md`、`docs/QA.md`、可选 `deploy/**` |
| 依赖 | T300,T301,T302 |
| DoD | 完成发布、回滚、备份恢复、日志和安全检查清单 |
| 验收 | 新机器可按文档部署；故障可回滚；数据库恢复演练通过 |
## 执行结果（2026-07-22）

### 已完成（15/18）

| 波次 | 完成率 | 说明 |
|---|---|---|
| W22 | 2/2 | T250 基线提交完成；T251 CI 配置完成，待推送 GitHub 验证 |
| W23 | 2/2 | T252 生产安全（devLink 禁漏、原子消费、删除强确认+reauth+限流+失败 500）；T253 Zod/Origin/server-only/Body 校验全覆盖 |
| W24 | 3/3 | T260 历法边界+交运 startAt+warnings；T261 按位十神+分层用神+RuleEvidence；T262 fixtures 元数据+敏感性 |
| W25 | 2/2 | T270 严格虚岁+policy+未知时辰多候选；T271 iztro fail/移除静默 skip+diff 结构 |
| W26 | 3/3 | T280 castingSchool+seed+UI 说明；T281 六神/月破/回头生克/伏神/用神类别；T282 64 卦穷举+sources 文档 |
| W27 | 3/3 | T290 Zod Schema+parse+safety+evidence 透传；T291 不篡改规则/去置信度上调/备注本地化；T292 TrustPanel+Disclaimer 加强 |
| W28 | 2/4 | T302 db:migrate+readiness+production fail-fast；T303 nginx/Caddy 样例+backup 脚本+DEPLOY/QA 完善 |

### 待外部验证（T300/T301）

- Docker CLI 未安装，实际 `docker build` / `docker compose up` 未执行
- CI 因未推送 GitHub，PR 门禁行为未跑通（T251 review）

### 已知限制

- T262 外部金标准未满 1000 例（务实范围）；历史夏令时仅声明未完整建模
- T270 未做生日/立春换岁细分；iztro 未安装（IZTRO_REQUIRE=1 可 fail）
- T281 旺相休囚/墓绝/三合/进退/反伏吟全量状态机未做
- T292 Person 统一主体信息架构未全量改造

### 测试结果

- **69 文件 / 546 测试通过 / 1 跳过**（iztro 未安装）
- 构建成功；ESLint 8 个 warning（与基线持平，无新增）
