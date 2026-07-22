# 赛博命理 · 部署与运维

> 面向他人按文档完成生产部署。行为以当前代码为准（`src/lib/share/**`、`src/lib/api/rate-limit.ts`、`src/app/api/**`）。  
> **禁止**将真实密钥写入仓库或本文件；一律通过平台环境变量或本地 `.env.local` 注入。

---

## 1. 部署方式概览

| 方式 | 适用 | 分享存储 | 说明 |
|------|------|----------|------|
| **Vercel（推荐）** | Serverless | 必须 `SHARE_STORE_DRIVER=upstash` | 无持久磁盘，`local` 写入会丢 |
| **自托管 Node** | 单机 / 容器 | `upstash` 推荐；有持久卷时可用 `local` | `npm run build` + `npm start` |
| **本地开发** | 开发机 | 默认 `local` | `npm run dev`，见 §6 |

技术栈：Next.js 16、Node 运行时、可选 Upstash Redis REST。

---

## 2. 环境变量表（生产相关）

复制根目录 `.env.example` 为平台环境变量或本地 `.env.local`。`.env*` 与 `data/` 已在 `.gitignore` 中忽略。

### 2.1 必填 / 强烈建议（生产）

| 变量 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `SHARE_STORE_DRIVER` | 生产建议 | `local` | `local` \| `upstash`。生产 Serverless **必须** `upstash` |
| `UPSTASH_REDIS_REST_URL` | `upstash` 时必填 | — | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | `upstash` 时必填 | — | Upstash Redis REST Token |

`SHARE_STORE_DRIVER=upstash` 且缺少 URL/TOKEN 时 **fail-fast**（抛错，**不会**静默回落本地文件）。非法驱动名也会直接报错。

### 2.2 分享可选

| 变量 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `SHARE_TTL_SECONDS` | 否 | 不过期 | 仅 **upstash** 生效。正整数：写入 Redis 时 `SET ... EX`；`0` 或不设：不过期。非法值 fail-fast |

Key 形态：`share:{token}`（见 `src/lib/share/upstash-redis.ts`）。

### 2.3 LLM（服务端 only，切勿暴露给浏览器）

| 变量 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `LLM_BASE_URL` | 否 | `https://api.openai.com/v1` | OpenAI 兼容 Chat Completions 基址 |
| `LLM_API_KEY` | LLM 模式需要 | 空 | 未配置时报告页 **禁用 LLM 按钮** 并提示配置 `.env.local`；服务端若仍被调用则回落模板 |
| `LLM_MODEL` | 否 | `gpt-4o-mini` | 模型名 |

仅服务端读取（`src/lib/reading/llm/**`）。客户端通过 `GET /api/reading/status` 仅获 boolean `llmConfigured`，**永不**暴露 Key。

### 2.3b 账号 / Postgres / Magic Link（W19 · T220–T222）

| 变量 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `AUTH_SECRET` | 生产必填 | 开发占位 | 签名 `cyber_session` |
| `AUTH_URL` | Magic Link 建议 | — | 站点公网根 URL，拼回调 |
| `AUTH_METHOD` | 否 | 见说明 | `magic` \| `credentials`；生产默认 magic |
| `AUTH_ALLOW_DEV_LOGIN` | 否 | 关 | 生产设 `1` 才允许假登录（不推荐） |
| `AUTH_EMAIL_FROM` / `RESEND_API_KEY` | 发信可选 | — | 未配时开发返回 `devLink` |
| `DATABASE_URL` | 生产账号建议 | — | Postgres 连接串；有则用户/三术档案走 PG |
| `CLOUD_STORE_DRIVER` | 否 | 自动 | `file` \| `postgres`；`postgres` 时 `DATABASE_URL` 必填 |
| `DB_SKIP_ENSURE_SCHEMA` | 否 | 关 | 设 `1` 时跳过请求路径 `ensureSchema()`（生产建议在 `db:migrate` 后开启） |

DDL：`src/lib/db/schema.ts` / `src/lib/db/migrate.sql`。  
**生产**：启动应用前执行 `npm run db:migrate`（幂等 `CREATE IF NOT EXISTS`）；可选 `DB_SKIP_ENSURE_SCHEMA=1`。  
开发：无 `DATABASE_URL` 时回落 `data/*.json`；有库时请求路径仍可 `ensureSchema()` 幂等建表。

### 2.4 API 限流（T210）

| 变量 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `RATE_LIMIT_DRIVER` | 否 | `memory` | `memory` \| `redis`。非法值 fail-fast |
| `RATE_LIMIT_READING_MAX` | 否 | `15` | `/api/reading*` 窗口内最大次数 |
| `RATE_LIMIT_READING_WINDOW_MS` | 否 | `60000` | 解读限流窗口（毫秒） |
| `RATE_LIMIT_SHARE_MAX` | 否 | `30` | `/api/share` 窗口内最大次数 |
| `RATE_LIMIT_SHARE_WINDOW_MS` | 否 | `60000` | 分享限流窗口（毫秒） |
| `UPSTASH_REDIS_REST_URL` | `redis` 时必填 | — | 可与分享共用同一 Upstash 库 |
| `UPSTASH_REDIS_REST_TOKEN` | `redis` 时必填 | — | 同上 |

客户端标识：`x-forwarded-for` 首段 → `x-real-ip` → `anon`（截断 64 字符）。超限返回 **HTTP 429**，并带 `X-RateLimit-*`、`Retry-After`。

| 驱动 | 行为 |
|------|------|
| `memory` | 进程内固定窗口；**单实例**有效；多实例吞吐可能高于配置 |
| `redis` | Upstash `INCR` + `PEXPIRE` 固定窗口；key=`rl:{bucket}:{clientKey}`；**多实例共享** |
| `redis` 缺凭证 | **fail-fast** 抛错，**禁止**静默回落 memory（与分享 upstash 策略一致） |

生产 Serverless 推荐：

```text
RATE_LIMIT_DRIVER=redis
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
# 分享若也用 upstash，可共用同一组凭证
SHARE_STORE_DRIVER=upstash
```

### 2.5 非环境变量的硬编码限制

| 项 | 值 | 位置 |
|----|-----|------|
| 请求体上限 | 约 200_000 字符 | `src/lib/api/validate.ts`；超限 **413** |
| 分享 POST | 仅创建 | `POST /api/share`；**无**公开 DELETE API |

---

## 3. 分享后端配置（Upstash）

### 3.1 创建 Upstash Redis

1. 打开 [Upstash Console](https://console.upstash.com/)，注册/登录。
2. **Create Database** → 选区域（尽量靠近部署区域，如 Vercel 香港/东京对应亚太）。
3. 进入数据库 → **REST API** 面板，复制：
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. 勿将 Token 提交 Git 或贴到 Issue/聊天记录。

### 3.2 绑定 Vercel

1. 将仓库导入 [Vercel](https://vercel.com/)，Framework 选 Next.js。
2. **Project → Settings → Environment Variables**，为 Production（及 Preview 如需）添加：

```text
SHARE_STORE_DRIVER=upstash
UPSTASH_REDIS_REST_URL=<你的 REST URL>
UPSTASH_REDIS_REST_TOKEN=<你的 REST Token>
SHARE_TTL_SECONDS=2592000
RATE_LIMIT_DRIVER=redis
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=<可选>
LLM_MODEL=gpt-4o-mini
# 限流阈值可按需覆盖，不设则用默认 15/30 次/分钟
```

3. 重新 **Deploy**。部署后分享链路：
   - 前端创建分享 → `POST /api/share` 写入 Redis `share:{uuid}`
   - 打开 `/share/{token}` → 服务端 `getShareSnapshot` 读取；不存在则 **404**

也可使用 Upstash 的 Vercel Integration 一键注入 REST 变量，仍须**显式**设置 `SHARE_STORE_DRIVER=upstash`。

### 3.3 自托管 Node / Docker

#### 直接运行 Node

```bash
npm ci
npm run build
npm start
```

#### Docker 镜像

项目使用 Next.js 16 `output: "standalone"`。Dockerfile 会复制 `.next/standalone`、`public` 与 `.next/static`，并以非 root 用户运行：

```bash
docker build -t cyber-divination:local .
docker run --rm -p 3000:3000 \
  --env-file .env.production \
  cyber-divination:local
```

探活：

| 端点 | 含义 |
|------|------|
| `GET /api/health` | Liveness（进程存活） |
| `GET /api/health/ready` | Readiness（DB/Redis 依赖；失败 503） |

数据库迁移（生产必做，幂等）：

```bash
# 需已配置 DATABASE_URL
npm run db:migrate
# 部署前配置校验（NODE_ENV=production）
NODE_ENV=production npm run check:prod-env
```

#### Docker Compose 本地集成

```bash
cp .env.docker.example .env.docker
docker compose up --build
```

Compose 启动 Web + Postgres，并使用 named volume 保存数据库和本地分享数据。示例默认启用开发 Credentials 登录、memory 限流与 local 分享，**只允许本地集成使用**。

| 场景 | 建议 |
|---|---|
| 本地 Compose | Postgres + local 分享 + memory 限流 |
| 生产单副本 | Postgres；分享仍推荐 Upstash；禁止示例密钥 |
| 生产多副本 | Postgres + Upstash 分享 + Redis 限流；禁止 file/memory |
| 反向代理 | 配置可信代理和真实客户端 IP；完成 T253 前不得盲目信任外部 `X-Forwarded-For` |

健康检查建议：

1. `/api/health` 返回 200（liveness）；
2. `/api/health/ready` 在 Postgres 就绪后返回 200（readiness）；
3. 打开首页可访问；
4. 排盘 → 解读（无 Key 应模板回落）；
5. 创建分享并在无痕窗口访问；
6. 无效 token 返回 404；
7. 重启 Web 容器后 Postgres 数据仍存在。

### 3.4 健康检查（Liveness & Readiness · T302）

应用暴露两个独立端点供编排平台（Docker / K8s / Compose）配置探针：

| 端点 | 类型 | 预期 | 依赖 |
|------|------|------|------|
| `GET /api/health` | **Liveness** | 200 `{ status: "ok" }` | 仅进程存活 |
| `GET /api/health/ready` | **Readiness** | 200 `{ status: "ready" }` 或 503 | DB / Redis 依赖就绪 |

**Docker 容器**：Dockerfile 已内置 HEALTHCHECK 指令，指向 `/api/health`，间隔 30s，超时 5s，启动缓冲 20s，重试 3 次。容器启动后 Docker 自动进行 liveness 探测。

**Docker Compose**：`compose.yaml` 为 `web` 服务配置了 healthcheck，`db` 服务配置了 `pg_isready`。`web` 的 `depends_on` 依赖 `db` 的 `service_healthy`，确保 Postgres 就绪后才启动 Web。

**Kubernetes**（可选）：

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 20
  periodSeconds: 30
  timeoutSeconds: 5
readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
```

**手工验证**：

```bash
curl -s http://localhost:3000/api/health       # 期望 200
curl -s http://localhost:3000/api/health/ready  # 期望 200（DB/Redis 就绪时）
```

如果 readiness 返回 503，检查：`DATABASE_URL` 是否正确、Postgres 是否可达、Upstash Redis 凭证是否有效（若 `RATE_LIMIT_DRIVER=redis` 或 `SHARE_STORE_DRIVER=upstash`）。

---

## 4. 备份 / 删除分享策略

### 4.1 数据内容

分享快照为脱敏摘要（四柱、日主、一句建议、免责声明等），**不含**完整 LLM 长文。见 `ShareSnapshot` 与 `POST /api/share` 写入逻辑。

### 4.2 TTL（推荐生产开启）

| 配置 | 行为 |
|------|------|
| 不设 / `0` | Upstash key **不过期**，需人工清理 |
| 正整数（秒） | 写入时设置 Redis 过期；例 `2592000` ≈ 30 天 |
| `local` 驱动 | **忽略** TTL；文件内永久保存直至删除 |

### 4.3 删除方式

| 方式 | 现状 |
|------|------|
| 公开 HTTP DELETE | **无**。应用层未暴露删除 API |
| 库函数 | `deleteShareSnapshot(token)`（`src/lib/share/index.ts`）供内部/测试；Upstash `DEL share:{token}`，local 改写 `data/shares.json` |
| 运维手工（Upstash） | Console 或 CLI：删除 key `share:<完整 token>` |
| 运维手工（local） | 编辑/清空 `data/shares.json` 对应条目 |
| 批量过期 | 依赖 `SHARE_TTL_SECONDS`；改 TTL **不回溯**已写入且无 EX 的 key |

### 4.4 备份建议

| 驱动 | 备份 |
|------|------|
| **upstash** | Upstash 控制台导出 / 商业备份；或定期脚本 `GET` 业务关心的 token（应用本身无全量导出 API） |
| **local** | 定期复制 `data/shares.json` 到安全存储 |

### 4.5 运维注意

- Token 为 UUID，知链即可读；日志仅记 **token 前 8 位**（`api.share.ok`），勿在日志打全量 token/密钥。  
- 轮换 `UPSTASH_REDIS_REST_TOKEN` 后旧 Token 立即失效，需同步更新部署环境并重新部署。  
- 切换 `local` ↔ `upstash` **不会**自动迁移历史分享。  
  - 合规：用户要求删除某条分享时，用完整 token 在 Redis/文件中删除对应 key。

### 4.6 Postgres 数据库备份与恢复（T303）

应用状态包括两部分：Postgres 数据库（用户/档案/六爻/分享记录）和 Redis/Upstash 分享快照。本节聚焦 Postgres。

#### 4.6.1 备份脚本

项目提供 `scripts/backup-postgres.example.ps1`（Windows PowerShell）作为 pg_dump 封装：

```powershell
# 1. 配置环境变量
$env:PGHOST = "your-db-host.example.com"
$env:PGPORT = "5432"
$env:PGUSER = "cyber"
$env:PGPASSWORD = "your-strong-password"
$env:PGDATABASE = "cyber_divination"

# 2. 执行备份（plain → .sql.gz；custom → .dump）
.\scripts\backup-postgres.example.ps1
.\scripts\backup-postgres.example.ps1 -Format custom -BackupDir "D:\db-backups"
```

脚本功能：
- 检查 `PGHOST` / `PGUSER` / `PGPASSWORD` 环境变量，缺失时提示配置方法
- 支持三种输出格式：`plain`（.sql.gz，默认）、`custom`（.dump，pg_restore 友好）、`directory`（并行恢复）
- 输出到 `../backups/` 目录，文件名带时间戳（`cyber_divination_20260722-103000.sql.gz`）
- 打印耗时、文件大小及对应的 **pg_restore 恢复命令**

Linux/macOS 环境可参考脚本逻辑编写 `.sh` 版本，核心相同：

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="${1:-./backups}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILE="${BACKUP_DIR}/cyber_divination_${TIMESTAMP}.sql.gz"
pg_dump -h "${PGHOST}" -p "${PGPORT:-5432}" -U "${PGUSER}" -d "${PGDATABASE}" \
  --no-owner --no-acl -Fp | gzip > "$FILE"
echo "[backup] done: $FILE"
```

#### 4.6.2 恢复步骤

**plain 格式**（.sql.gz）：

```powershell
gzip -d -c "backups\cyber_divination_20260722-103000.sql.gz" | psql -h $env:PGHOST -p $env:PGPORT -U $env:PGUSER -d $env:PGDATABASE
```

**custom 格式**（.dump，推荐）：

```powershell
pg_restore -h $env:PGHOST -p $env:PGPORT -U $env:PGUSER -d $env:PGDATABASE -c --if-exists "backups\cyber_divination_20260722-103000.dump"
```

- `-c --if-exists`：恢复前清理已有对象（幂等），首次恢复时可省略
- `--no-owner --no-acl`：备份脚本已剥离 owner/ACL，恢复时不依赖源库角色

**重要**：恢复前确认目标库为空或理解覆盖后果；生产恢复建议先在临时库验证。

#### 4.6.3 备份策略建议

| 场景 | 频率 | 保留 |
|------|------|------|
| 生产 | 每日（cron / Task Scheduler） | 7 天日备 + 4 周周备 |
| 预发 | 每次发布前 | 按 release 保留 |
| 本地 Compose | 按需 | 按需 |

使用 Windows Task Scheduler 示例：

```
触发器：每日 02:00
操作：powershell.exe -File "E:\ai_project\cyber-divination\scripts\backup-postgres.example.ps1" -Format custom
```

#### 4.6.4 恢复演练清单

- [ ] 备份文件存在且大小 > 0
- [ ] pg_restore 到临时库成功
- [ ] 应用连接临时库，`/api/health/ready` 返回 200
- [ ] 登录后可读取历史档案（八字/紫微/六爻）
- [ ] `npm run db:migrate` 在临时库幂等执行无报错

---

## 5. 回滚步骤

### 5.1 应用版本回滚

**Vercel**

1. Project → **Deployments** → 选上一稳定部署 → **Promote to Production**（或 Redeploy 该次构建）。  
2. 确认环境变量未被误改；若本次故障由 env 引起，先改 env 再 Promote。

**自托管**

```bash
git checkout <上一稳定 tag 或 commit>
npm ci
npm run build
# 用进程管理器重启，例如：
# pm2 restart cyber-divination
# 或 systemctl restart <your-service>
npm start
```

### 5.2 配置回滚

| 误配 | 处理 |
|------|------|
| `upstash` 缺凭证导致 500 | 补全 URL/TOKEN，或临时改回 `local`（仅非 Serverless 且可接受丢分享）后重新部署 |
| 限流过严 | 调大 `RATE_LIMIT_*_MAX` 或窗口后重新部署/热更新 env（视平台是否需 redeploy） |
| LLM 异常 | 清空或修正 `LLM_*`；无 Key 时自动模板回落，服务仍可用 |

### 5.3 数据面

- 回滚应用**不会**删除 Redis 中已有 `share:*`。  
- 错误写入的分享：按 §4.3 按 token 删除。  
- 勿在生产用 `local`「回滚分享」——Serverless 上本就不可靠。

### 5.4 回滚判定（建议）

出现以下情况应回滚或紧急修 env：

- 分享创建或打开大面积 500，且日志含 `UPSTASH` / `SHARE_STORE`  
- 错误部署导致密钥泄露（立刻轮换 Upstash Token 与 `LLM_API_KEY`，再回滚代码）  
- 构建/运行时崩溃无法提供主路径（排盘页）

### 5.5 Docker / Compose 回滚

**Docker 镜像回滚**（使用不可变 tag 或 digest）：

```bash
# 假设当前版本有问题，切回上一稳定镜像
docker stop cyber-divination
docker rm cyber-divination

# 方式 1：使用本地旧镜像
docker images cyber-divination --format "{{.Repository}}:{{.Tag}}  {{.CreatedAt}}"
docker run -d --name cyber-divination \
  --env-file .env.production \
  -v app_data:/app/data \
  -p 3000:3000 \
  cyber-divination:previous-stable

# 方式 2：从 registry 拉取旧版本
docker run -d --name cyber-divination \
  --env-file .env.production \
  -p 3000:3000 \
  your-registry/cyber-divination:v1.2.3
```

**Docker Compose 回滚**：

```bash
# 1. 停止当前 stack
docker compose down

# 2. 切回上一稳定 Git 版本
git checkout <上一稳定 tag 或 commit>

# 3. 若镜像已推送 registry，可在 compose.yaml 中固定旧镜像 tag
#    或直接使用本地旧镜像重建
docker compose build --no-cache
docker compose up -d

# 4. 验证
curl -s http://localhost:3000/api/health
curl -s http://localhost:3000/api/health/ready
```

**数据保护**（重要）：
- Compose 的 named volume（`postgres_data`、`app_data`）在 `docker compose down` 时默认保留；除非使用 `-v` 参数，否则数据不丢失
- 回滚前应按 **§4.6** 执行 Postgres 备份
- 切勿在故障排查中误删 volume

---

## 6. 本地 dev vs 生产差异

| 项 | 本地开发 | 生产（Vercel / 公网） |
|----|----------|------------------------|
| 启动 | `npm install` → `npm run dev` | `npm run build` → `npm start` 或 Vercel 构建 |
| 环境文件 | `.env.local`（勿提交） | 平台 Environment Variables |
| `SHARE_STORE_DRIVER` | 默认 **`local`** → `data/shares.json` | **`upstash`** + REST 凭证 |
| 缺 Upstash 配置 | 仅当显式 `upstash` 时 fail-fast | 必须配齐，否则分享 API 失败 |
| `SHARE_TTL_SECONDS` | local 下无效 | upstash 下按配置过期 |
| 限流 | 默认 memory，单进程 | 推荐 `RATE_LIMIT_DRIVER=redis` + Upstash，多实例共享 |
| `RATE_LIMIT_DRIVER=redis` 缺凭证 | 启动/首次 check **fail-fast** | 同左；勿静默回落 |
| LLM | 可空，自动模板 | 建议配置 Key；可空仍可用模板 |
| 磁盘 | 可写 `data/` | Serverless 无持久盘 |
| 域名 / HTTPS | localhost | 见 **§9** |
| 观测 | 终端 `logApi` JSON | 见 **§10**；含 usage / errorCode / art |

### 6.1 本地最小步骤

```bash
cp .env.example .env.local
# 可选：填写 LLM_* 体验 LLM 解读
npm install
npm run dev
```

本地验证生产分享（可选）：在 `.env.local` 设 `SHARE_STORE_DRIVER=upstash` 与 REST 凭证后重启 dev，创建分享并冷启动后再访问 `/share/{token}`。

### 6.2 生产检查清单（部署后）

- [ ] `SHARE_STORE_DRIVER=upstash`，URL/TOKEN 已绑定且非空  
- [ ] （建议）`SHARE_TTL_SECONDS` 已设合理值  
- [ ] `RATE_LIMIT_DRIVER=redis` 且 Upstash 凭证有效（Serverless 强烈建议）  
- [ ] `LLM_*` 仅服务端；未泄漏到 `NEXT_PUBLIC_*`  
- [ ] 创建分享 → 新会话打开链接成功  
- [ ] 连续刷 `/api/reading` 或 `/api/share` 可触发 429（redis 下跨冷启动也应累计）  
- [ ] 无效分享 token → 404  
- [ ] 无 `LLM_API_KEY` 时解读仍返回模板（若未配 Key）  
- [ ] 日志可 grep `llm.chat.ok` / `api.reading.ok` 字段见 §10  

---

## 7. 相关代码索引

| 能力 | 路径 |
|------|------|
| 分享驱动工厂 | `src/lib/share/index.ts` |
| Upstash 实现 | `src/lib/share/upstash-redis.ts` |
| 本地文件实现 | `src/lib/share/local-file.ts` |
| 创建分享 API | `src/app/api/share/route.ts` |
| 只读分享页 | `src/app/share/[token]/page.tsx` |
| 解读 API | `src/app/api/reading/route.ts` |
| 限流 | `src/lib/api/rate-limit.ts` |
| LLM 共享客户端 | `src/lib/reading/llm/client.ts` |
| LLM 调用（八字） | `src/lib/reading/llm/llm.ts` |
| 结构化日志 | `src/lib/api/logger.ts` |
| 环境变量样例 | `.env.example` |

---

## 8. 文档自检清单

部署文档作者 / 主 Agent dry-run 时可勾选：

- [ ] §2 环境变量与 `.env.example`、代码默认值一致  
- [ ] §3 Upstash 创建与 Vercel/自托管步骤可执行  
- [ ] §4 写明 TTL、无公开 DELETE、运维删 key 方式  
- [ ] §5 含应用回滚与配置回滚  
- [ ] §6 本地 vs 生产差异清晰  
- [ ] §9 自定义域名步骤可跟做  
- [ ] §10 观测字段与限流 redis 配置表完整  
- [ ] 全文无真实密钥/Token  

---

## 9. 自定义域名与 HTTPS（T212）

### 9.1 Vercel

1. Project → **Settings → Domains** → 添加域名（如 `app.example.com`）。  
2. 按控制台提示在 DNS 添加 **A / CNAME** 记录（Vercel 提供目标）。  
3. 证书由 Vercel 自动签发（Let's Encrypt）；状态变为 **Valid** 后即可 HTTPS 访问。  
4. 若使用 Auth / 回调（W19 起）：将生产回调 URL 配为 `https://你的域名/auth/callback`。  
5. 强制 HTTPS：Vercel 默认将 HTTP 重定向到 HTTPS，无需额外配置。

### 9.2 自托管（Nginx 示例）

1. 域名 DNS **A/AAAA** 指向服务器公网 IP。  
2. 应用监听本机（如 `127.0.0.1:3000`）：`npm run build && npm start`。  
3. Nginx 反代并终止 TLS（certbot 或自有证书）：

```nginx
server {
  listen 443 ssl http2;
  server_name app.example.com;
  ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

4. **务必**转发 `X-Forwarded-For` / `X-Real-IP`，否则限流键多为 `anon`。  
5. HTTP→HTTPS 可用 certbot `redirect` 或额外 `listen 80` 301。

#### 完整配置样例

项目提供两份反向代理配置样例，可直接参考：

| 文件 | 适用 | 说明 |
|------|------|------|
| `deploy/nginx.example.conf` | Nginx | HTTPS 终结、安全头（CSP / X-Content-Type-Options / HSTS）、真实 IP 转发、Proxy Protocol 支持、Nginx 层限流备选 |
| `deploy/Caddyfile.example` | Caddy | 一行反向代理 + 自动 Let's Encrypt HTTPS；Caddy 自动续期证书，配置极简 |

使用方式：

```bash
# Nginx（需先安装 certbot + nginx）
sudo cp deploy/nginx.example.conf /etc/nginx/sites-available/cyber-divination
sudo sed -i 's/app.example.com/你的域名/g' /etc/nginx/sites-available/cyber-divination
sudo certbot --nginx -d 你的域名
sudo nginx -t && sudo systemctl reload nginx

# Caddy（Caddy 自动申请证书，无需 certbot）
sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo sed -i 's/app.example.com/你的域名/g' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

**安全头说明**（nginx.example.conf 已配置）：
- `Content-Security-Policy`：仅允许自身资源，`style-src 'unsafe-inline'` 适配 Tailwind CSS
- `X-Content-Type-Options: nosniff`：禁止 MIME 类型嗅探
- `X-Frame-Options: DENY`：禁止被嵌入 iframe
- `Strict-Transport-Security`：强制 HTTPS（HSTS, max-age=2年）
- `Referrer-Policy: strict-origin-when-cross-origin`：跨域时仅发送域名
- `Permissions-Policy`：禁用摄像头/麦克风/地理位置

### 9.3 检查

- [ ] `https://你的域名` 证书有效、无混合内容告警  
- [ ] 创建分享链接使用生产域名  
- [ ] 限流在代理后按真实客户端 IP 计数（非全站 `anon`）  

---

## 10. 观测与运维（T211 / T212）

应用 stdout 输出 **一行一条 JSON**（`logApi`），平台（Vercel Logs / Docker / journald）按 JSON 检索即可。**不做**独立看板 UI。

### 10.1 通用字段

| 字段 | 说明 |
|------|------|
| `ts` | ISO 时间 |
| `level` | `info` \| `warn` \| `error` |
| `event` | 事件名，如 `api.reading.ok`、`llm.chat.ok` |
| `requestId` | 请求 ID（头 `x-request-id` 或生成） |
| `route` | API 路径或逻辑路由 |
| `durationMs` | 耗时毫秒 |
| `status` | HTTP 状态（API 层） |
| `clientKey` | 客户端键（IP 截断，非完整密钥） |
| `errorCode` | 可汇总错误码 |
| `fallback` | 是否模板回落 |
| `art` | `bazi` \| `ziwei` \| `liuyao` |
| `model` | LLM 模型名；无则 `null` |
| `promptTokens` / `completionTokens` / `totalTokens` | usage；无则 `null` |

**禁止**出现在日志中的内容：`LLM_API_KEY`、完整 prompt、`Authorization` 头、Upstash Token。敏感 key 名会被 scrub 为 `[redacted]`。

### 10.2 关键 event

| event | 含义 |
|-------|------|
| `api.reading.ok` / `api.reading.ziwei.ok` / `api.reading.liuyao.ok` | 解读成功（含 fallback 标记与 usage） |
| `api.reading.error` 等 | 解读 500 |
| `api.rate_limited` | 429 |
| `llm.chat.ok` | 上游 Chat Completions 成功 + usage |
| `llm.chat.error` | 上游失败（`errorCode` 如 `LLM_HTTP_429`） |
| `llm.reading.fallback` | 业务层回落模板（含 `errorCode`） |
| `api.share.ok` | 分享创建成功（token 仅前 8 位） |

### 10.3 本地验收示例

```bash
# 无 Key：应见 fallback + errorCode=LLM_NOT_CONFIGURED
# 有 mock：应见 llm.chat.ok 与 totalTokens
npm run dev
# 另开终端触发 POST /api/reading 后在 dev 终端 grep：
# requestId|promptTokens|errorCode|art
```

### 10.4 限流 redis 运维速查

| 项 | 值 |
|----|-----|
| Key 前缀 | `rl:` |
| Key 形态 | `rl:{bucket}:{clientKey}`，bucket=`reading`\|`share` |
| 算法 | 固定窗口：`INCR`，首次 `PEXPIRE` 窗口毫秒 |
| 与分享 key | 分享为 `share:{token}`，**不冲突** |
| 清计数 | 删除对应 `rl:*` key，或等 TTL 过期 |
| 故障 | 凭证错误 → 限流路径抛错/500；修复 env 后 redeploy |
---

## 11. Docker 生产检查清单

### 11.1 镜像

- [ ] `docker build` 成功；
- [ ] 运行用户为 `nextjs`，不是 root；
- [ ] 镜像中不含 `.env*`、`data/`、Git 历史、测试输出和真实密钥；
- [ ] `/api/health` 通过；
- [ ] 容器收到终止信号后可正常退出。

### 11.2 配置

- [ ] `AUTH_SECRET` 为生产随机值；
- [ ] `AUTH_ALLOW_DEV_LOGIN` 未设置或为 `0`；
- [ ] `AUTH_URL` 为公网 HTTPS 地址；
- [ ] `DATABASE_URL` 指向生产 Postgres；
- [ ] `CLOUD_STORE_DRIVER=postgres`；
- [ ] 多副本时 `SHARE_STORE_DRIVER=upstash`、`RATE_LIMIT_DRIVER=redis`；
- [ ] LLM、Redis、数据库密钥通过平台 Secret 注入。

### 11.3 数据与发布

- [ ] 启动应用前已执行 `npm run db:migrate`；
- [ ] （建议）`DB_SKIP_ENSURE_SCHEMA=1`；
- [ ] `NODE_ENV=production npm run check:prod-env` 通过；
- [ ] 完成 Postgres 备份与恢复演练；
- [ ] 分享 TTL 和账号删除策略已确认；
- [ ] 反向代理限制请求体并配置 HTTPS；
- [ ] 发布镜像使用不可变 tag 或 digest；
- [ ] 已记录上一版本镜像并验证回滚。
