# 赛博命理 · Cyber Divination

基于 [bazi-skill](https://github.com/jinchenma94/bazi-skill) 的 Web 赛博术数工具（包名 `cyber-divination`）。  
总品牌 **赛博命理**；子产品：赛博八字 / 赛博紫微 / 赛博六爻。

## 文档

- [产品方案](docs/PRODUCT.md)
- [项目审查结论](docs/PROJECT_REVIEW.md)（专业性、安全、工程与部署）
- [整改任务卡](docs/REMEDIATION_TASKS.md)（W22–W28 / T250–T303）
- [执行指南](docs/EXECUTION_GUIDE.md)（门禁、分支、DoR/DoD）
- [历史开发任务](docs/TASKS.md)
- [部署与运维](docs/DEPLOY.md)（Vercel、Docker、Postgres、Upstash）
- [QA 验收](docs/QA.md)

## 当前状态

- [x] MVP 八字全链路（排盘 → 解读 → 反馈 → 分享）
- [x] P0–P4 骨架 + 引擎深化至 W17
- [x] W18–W21：限流、观测、账号、Postgres、六爻云端、品牌、紫微流月/流日
- [x] T231：原阶段代码与文档收口
- [ ] W22–W28：专业准确性、安全、GitHub 规范与 Docker 生产化整改

> 当前建议定位：传统文化学习型 **Alpha**。公开 Beta 前须完成 [项目审查结论](docs/PROJECT_REVIEW.md) 中的 P0 门禁。

## 本地开发

```bash
npm ci
# PowerShell: Copy-Item .env.example .env.local
# Bash: cp .env.example .env.local
npm run dev
```

### 脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建 |
| `npm run lint` | ESLint |
| `npm test` | Vitest 单测 |
| `npm run sync:skill` | 同步 bazi skill references |
| `npm run check` | lint warning 基线 + test + build |
| `npm run docker:build` | 构建本地生产镜像 |
| `npm run docker:up` | Docker Compose 启动 Web + Postgres |
| `npm run docker:down` | 停止 Compose 环境 |

## Docker 本地集成

```bash
# 可选：复制并修改本地 Compose 配置
cp .env.docker.example .env.docker

docker compose up --build
# 探活：http://localhost:3000/api/health
```

`compose.yaml` 仅用于本地集成/演示，默认启用开发登录、memory 限流和本地分享存储。生产必须使用强 `AUTH_SECRET`、真实 Magic Link、Postgres 与多实例 Redis/Upstash，并关闭 `AUTH_ALLOW_DEV_LOGIN`。

## 环境变量摘要

| 场景 | 变量 |
|---|---|
| LLM 解读 | `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` |
| 分享 / 限流 | `SHARE_STORE_DRIVER=upstash`、`RATE_LIMIT_DRIVER=redis`、`UPSTASH_*` |
| 登录 | `AUTH_SECRET`、`AUTH_URL`；可选 `RESEND_API_KEY` + `AUTH_EMAIL_FROM` |
| 云端档案 | `DATABASE_URL` + `CLOUD_STORE_DRIVER=postgres` |

完整说明见 [部署文档](docs/DEPLOY.md)、`.env.example` 和 `.env.docker.example`。

## 目录要点

```text
src/lib/types/     # 共享契约
src/lib/bazi/      # 八字引擎
src/lib/ziwei/     # 紫微引擎
src/lib/liuyao/    # 六爻引擎
src/lib/db/        # Postgres schema / 客户端
src/lib/auth/      # 会话 + Magic Link
src/lib/reading/   # 模板 + LLM
.github/           # CI、Issue/PR 模板、CODEOWNERS
docs/              # 产品、审查、任务和部署文档
```

## 路线图摘要

| 阶段 | 内容 | 状态 |
|---|---|---|
| MVP | 八字排盘 → 解读 → 反馈 → 分享 | 已完成 |
| P0–P4 骨架 | 账号、紫微、六爻、跨术数 | 已完成 |
| 原阶段收口 | 限流、观测、登录、Postgres、流月流日 | W18–W21 完成 |
| 专业与工程整改 | 安全、金标准、证据层、GitHub、Docker | W22–W28 待执行 |
| 生产放量 | P0 门禁 + QA + 备份恢复 | 暂缓 |

## 许可与第三方材料

项目原始代码当前为保留所有权利，详见 [LICENSE](LICENSE)。第三方依赖和 bazi-skill 的许可说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 免责

仅供传统文化学习与娱乐参考，不构成医疗、投资、法律或人生决策依据。
