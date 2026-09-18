# 赛博命理 · 应用安全只读复审报告

> 复审对象：`E:\ai_project\cyber-divination`（Next.js 16.2.10 + React 19）
> 复审基线：`docs/PROJECT_REVIEW.md` §2.1 原始 P0 清单；README L22 / L95 声称「W22–W28 安全整改基本完成」
> 复审方式：**只读**源码审计 + 数据流追踪；**未修改任何文件，未执行 npm install**
> 复审立场：攻击者视角，验证整改是否**真实有效**，而非复述文档结论
> 行号引用均基于复审时的仓库状态

---

## 0. 复审方法与局限

- 本报告结论全部来自静态源码阅读与调用链追踪，每条判定均附 `文件:行号`。
- 标注「**需运行时验证**」的条目表示：静态可读范围内无法确定，必须实跑 PoC（并发请求、伪造 Origin、构造超长 body 等）才能定论。**不臆断**。
- 未执行任何构建、测试或服务启动，因此**未验证**运行时行为、环境变量实际取值、部署拓扑（反向代理是否覆写 `X-Real-IP`）。

---

## 1. 总表

| # | 漏洞 / 缺陷 | 攻击场景（可复现步骤） | 影响 | 严重度 | 证据（文件:行号） | 修复方案 |
|---|---|---|---|---|---|---|
| 1 | **生产环境 `AUTH_SECRET` 无强度校验**（仅校验非空） | 1) 运维在 `.env` 设 `AUTH_SECRET=123`；2) `validateProductionConfig()` 通过，服务正常启动（`validate-prod.ts:65-67` 只判空）；3) 攻击者离线暴力枚举弱密钥，对任意已知 `sub` 伪造 `${b64url(payload)}.${HMAC-SHA256(body, 弱密钥)}`；4) 携带该 cookie 请求 `/api/charts` 读取受害者全部命盘 | 完全账号接管 / 全量隐私泄露 | **P0** | `src/lib/config/validate-prod.ts:65-67`；`src/lib/auth/session.ts:46-53`（无长度/熵检查）；`src/lib/auth/constants.ts:15`（示例弱密钥常量）；`.env.example:45`（`AUTH_SECRET=` 无强度说明） | 在 `validateProductionConfig` 增加：长度 ≥32、非示例值、非全同字符、建议 base64 随机；同时校验 `DEV_AUTH_SECRET_FALLBACK` 黑名单 |
| 2 | **错误信息直出客户端，Postgres 原生错误泄露表名/约束/列名** | 1) 登录获取有效会话；2) 向 `POST /api/people` 发送 `{"name":"x","chartIds":["a"]}` 并诱发 DB 约束错误（如超长 id 或类型冲突）；3) 响应 `error.message` 为 `e.message` 原文；4) 攻击者据此枚举表结构、列名、约束名 | 内部结构泄露，辅助后续精确攻击 | **P1** | `src/app/api/people/route.ts:80`；`src/app/api/people/[id]/route.ts:118`；`src/app/api/ziwei-charts/route.ts:88`；`src/app/api/charts/route.ts:106`；`src/app/api/liuyao-charts/route.ts:87` | 统一错误映射层：仅在服务端 `logApi` 记录 `e.message`，对外返回固定文案 + 错误码 |
| 3 | **`x-forwarded-for` / `x-real-ip` 在「可信代理」模式下仍可被伪造（取决于代理配置）** | 1) 部署 `RATE_LIMIT_TRUSTED_PROXY=1`；2) 若边缘代理**追加**而非**覆写** `X-Forwarded-For`，攻击者先发 `X-Forwarded-For: 1.2.3.4`；3) `clientKeyFromRequest` 取 `x-real-ip` 优先，回退 `x-forwarded-for` 首段；4) 每请求轮换伪造 IP，限流被完全绕过 | 限流形同虚设；撞库 / 资源耗尽 / LLM 费用放大 | **P1**（依赖部署，**需运行时验证**） | `src/lib/api/rate-limit.ts:249-262`；`src/lib/api/rate-limit.ts:233-240`；`src/lib/config/validate-prod.ts:33-38` | 文档化强制要求代理**覆写**头；或在可信代理模式校验已知代理 CIDR 白名单后再采信 |
| 4 | **`checkBodySize` 覆盖率极低（仅 1 处），与 README 整改声明不符** | 1) 登录后向 `POST /api/people` / `POST /api/charts` / `POST /api/auth/callback` 等发送超大 body；2) 这些路由**从不调用** `checkBodySize`；3) 实际保护仅来自 `parseJsonBody` 默认 200KB | 声明与实现不一致；若未来某路由绕过 `parseJsonBody` 则无上限保护 | **P2** | `checkBodySize` 全仓仅 4 处命中：定义 `src/lib/api/validate.ts:22-27`、导出 `src/lib/api/index.ts:2`、唯一调用 `src/app/api/share/route.ts:21,150` | 废弃 `checkBodySize`，统一以 `parseJsonBody` 为准；或在文档中修正声明 |
| 5 | **限流仅覆盖 6 个路由，全部 `[id]` CRUD 与导出接口无限流** | 1) 登录后循环 `GET /api/charts/{id}` 遍历 id；2) `charts/[id]`、`people/[id]`、`ziwei-charts/[id]`、`liuyao-charts/[id]`、`account/export` **无** `checkRateLimit`；3) 可高频枚举 / 拖库 / 消耗 DB 连接 | 资源耗尽、批量数据抽取、DB 压力 | **P2** | `checkRateLimit` 命中仅：`share/route.ts:124`、`reading/route.ts:38`、`reading/ziwei/route.ts:45`、`reading/liuyao/route.ts:47`、`account/delete/route.ts:24`、`auth/login/route.ts:28`、`auth/callback/route.ts:28`、`auth/magic-link/route.ts:17`；缺失见 `charts/[id]/route.ts`（全文无）、`account/export/route.ts`（全文无） | 为读接口增加 `read` 桶限流；导出接口按用户维度限流 |
| 6 | **`assertSameOrigin` 未覆盖所有写路由** | 1) `PUT /api/people/[id]`、`POST /api/liuyao-charts` 等已覆盖；2) 但 `GET /api/account/export` 为**无 Origin 校验的导出**（GET 本就豁免，见 `origin.ts:48-50`）；3) 结合 Cookie `SameSite=Lax` 可缓解，但导出接口缺失限流与二次校验 | 数据外带面偏大（与 #5 叠加） | **P2** | `origin.ts:48-50`（GET/HEAD/OPTIONS 直接放行）；`account/export/route.ts:7`（GET，无 origin / 无限流） | 导出接口改为 POST + Origin 校验 + 最近认证（复用 `SESSION_REAUTH_MAX_AGE_SEC`） |
| 7 | **隐私政策未披露「分享快照」与本地存储的完整数据流细节**（披露基本充分，存在细节缺口） | 逐条核对见 §E；主要缺口：政策未说明 `data/*.json` 回退路径在无 `DATABASE_URL` 时可能落盘于应用目录 | 合规表述不完整 | **P2** | `src/content/privacy.ts:43-50`（已披露 LLM 第三方）；缺口见 `src/lib/storage/cloud-store.ts:39-64`（file 回退落盘） | 政策补一条：未配置托管数据库时数据以文件形式存于部署主机 |
| 8 | **`AUTH_ALLOW_DEV_LOGIN` 误开被拦截（此项已修复）** | — | — | 已修复 | `validate-prod.ts:69-71` + `magic-link.ts:251-254` | — |
| 9 | **Magic Link 发信失败仍返回链接（已修复）** | — | — | 已修复 | `magic-link.ts:179`；`magic-link/route.ts:80` | — |
| 10 | **Magic Link 消费非原子（PG 路径已修复；内存路径有已知竞态窗口）** | 内存路径 `while(memoryConsumeBusy)` 自旋锁在多进程/多实例下**不成立**；单进程内成立 | 多实例部署下可能重复消费 | **P2**（需运行时验证） | `magic-link.ts:199-219`（PG 原子 UPDATE…RETURNING）、`magic-link.ts:222-241`（内存自旋锁） | 生产强制 PG 路径；内存路径仅限单进程 dev |
| 11 | **账号删除二次确认 + 级联删除（已修复）** | — | — | 已修复 | `delete/route.ts:69-99`；`account.ts:76-91`；`cloud-hooks.ts:34-42`；`schema.ts:121,130,142,152` | — |
| 12 | **IDOR / 越权（已修复，逐文件核对通过）** | — | — | 已修复 | 见 §B 对照表 | — |
| 13 | **官方权威计算 / 客户端派生结果被忽略（已修复）** | — | — | 已修复 | `reading/route.ts:80-93`；`charts/route.ts:77-100`；`cloud-store.ts:127-151` | — |
| 14 | **SQL 注入（已修复，全参数化）** | — | — | 已修复 | 见 §D1 | — |
| 15 | **安全响应头 / CSP（已配置，但 CSP 含 `unsafe-inline`）** | — | — | 已修复（有保留项） | `next.config.ts:10-71` | 逐步引入 nonce 去除 `script-src 'unsafe-inline'` |

**统计：P0 = 1 项，P1 = 2 项，P2 = 7 项。**

---

## 2. 分节详细判定

### A. 认证与账号

#### A1. Magic Link 发信失败是否仍返回有效登录链接

**判定：已修复。**

证据：
- `src/lib/auth/magic-link.ts:164-180`：`emailed` 由 `sendEmail` 返回值决定，异常也被 catch 为 `false`；`devLink` 仅在 `process.env.NODE_ENV !== "production"` 时注入（`:179`）。
- `src/lib/auth/magic-link/route.ts:75-86`：响应体的 `devLink` 来自 `result.devLink` 条件展开（`:80`）。生产环境 `result.devLink` 为 `undefined`，响应不含链接。
- 兜底文案正确：`emailed=false` 且无 `devLink` 时返回模糊文案「若该邮箱可接收邮件…」（`:85`），不泄露账号是否存在。

**残留观察（非缺陷）**：`sendEmail` 在无 `RESEND_API_KEY` 时恒返回 `false`（`magic-link.ts:106-107`），生产未配置邮件服务时功能不可用但不泄露链接，行为安全。

#### A2. token 消费是否原子

**判定：Postgres 路径已修复；内存路径存在多实例竞态（P2）。**

- **PG 路径（生产推荐）：原子。** `src/lib/auth/magic-link.ts:199-206` 使用单条 `UPDATE ... SET used_at = now WHERE token_hash = ? AND used_at IS NULL AND expires_at > now RETURNING ...`。这是标准的 compare-and-swap：并发请求中只有一个能拿到 `RETURNING` 行，其余返回空数组 → `null`（`:214`）。**这是真实有效的原子消费。**
- **内存路径：单进程内有效，多实例无效。** `:222-241` 用 `memoryConsumeBusy` 布尔自旋锁串行化「读-判-写」。该锁是**进程内**变量（`:37`），在 Node 多 worker / 多容器下不共享，并发仍可能双成功。生产由 `validate-prod.ts:73-78` 强制 `DATABASE_URL` + postgres，因此该路径不应在生产出现。

#### A3. token 一次性 / TTL / 绑定邮箱

**判定：已修复。**

- **一次性**：`used_at IS NULL` 条件 + PG 原子更新（`:203`）；消费后 `used_at` 立即写入。
- **TTL**：`MAGIC_TTL_MS = 15 * 60 * 1000`（`:14`），`expiresAt` 在创建时计算（`:122`），消费时校验 `expires_at > now`（`:204`）。
- **绑定邮箱**：token 是 `randomBytes(32).toString("base64url")`（`:119`），仅存 SHA-256 哈希（`:43-45`、`:120`）；邮箱在创建时写入该行（`:131-141`），消费时从行内取回（`:216`）——**邮箱由服务端存储决定，客户端无法指定**，无邮箱注入面。
- 会话建立：`auth/callback/route.ts:84-87` 用 `consumed.email` 调 `findOrCreateUserByEmail`，链路完整。

#### A4. AUTH_SECRET 强度校验

**判定：仍存在（P0）。**

- `src/lib/config/validate-prod.ts:65-67`：**仅**判断 `AUTH_SECRET` 是否非空。
- `src/lib/auth/session.ts:46-53`：`getAuthSecret()` 只要非空即返回，**无长度、无熵、无黑名单校验**。
- `src/lib/auth/constants.ts:15`：存在明文示例密钥 `cyber-divination-dev-secret-change-me`；`.env.example:45` 未提示强度要求。
- 攻击影响：会话 token 为 `base64url(payload).HMAC-SHA256(body, secret)`（`session.ts:86-89`）。密钥弱则离线可枚举伪造任意 `sub`，且 `verifySessionToken` 只校验签名与 `exp`/`iat`（`:110-129`），**不查库确认用户是否仍存在**，伪造即通过。

**这是本次复审最严重的发现**：整改补齐了「必填」但**未补齐「强度」**，而强度才是防伪造成本的决定因素。

#### A5. Cookie 安全属性

**判定：已修复。**

- `src/lib/auth/session.ts:162-172`：`httpOnly: true`、`secure: NODE_ENV === "production"`、`sameSite: "lax"`、`path: "/"`、`maxAge: 7 天`（`constants.ts:7`）。
- 清除时 `maxAge: 0`（`:174-179`）。
- 会话有效期 7 天，敏感操作另设 15 分钟近期认证窗口（`constants.ts:12`）。

#### A6. `AUTH_ALLOW_DEV_LOGIN` 生产误开

**判定：已修复（双重拦截）。**

- 第一重：`validate-prod.ts:69-71` —— `NODE_ENV=production` 且 `AUTH_ALLOW_DEV_LOGIN=1` 时抛错，服务 fail-fast。
- 第二重：`magic-link.ts:251-254` —— `allowDevCredentialsLogin()` 生产环境默认 `false`，即使绕过启动校验，`auth/login/route.ts:57-67` 也直接 403。
- 该函数用严格 `=== "1"` 判定（`validate-prod.ts:10-12`、`magic-link.ts:253`），`true` / `yes` 等不生效，无误开面。

#### A7. 账号删除：二次确认

**判定：已修复。**

- 请求体必须含 `confirm: "DELETE"`：`src/lib/contracts/auth.ts:47-51` 用 `z.literal("DELETE")`，**不可省略**。
- `src/app/api/account/delete/route.ts:85-99`：解析失败返回 400/413，文案明确要求 `confirm`。
- 近期认证：`:69-83` 强制 `now - payload.iat <= SESSION_REAUTH_MAX_AGE_SEC`（15 分钟），超出则 403 要求重新登录。
- 身份绑定：`:57-67` 未登录 401；`:101-114` 用户不存在返回 404 并清 cookie。

#### A8. 云端删除异常是否被吞掉

**判定：已修复。**

- `src/lib/auth/account.ts:82`：`await deleteCloudDataForUser(userId)` **未** try/catch —— 异常向上冒泡。
- `src/lib/auth/account.ts:72-75` 注释明确「云端删除失败时抛错，禁止伪成功」。
- `delete/route.ts:138-148`：catch 后返回 **500** 且文案为「删除账号失败，云端数据未完全清理，请稍后重试」，**不返回成功**。原缺陷「返回成功但数据未删净」已消除。
- 顺序正确：先删云端（`:82`）再删用户（`:84`），若云端失败则用户保留，可重试。

#### A9. 级联删除：逐表核对

**判定：已修复（PG 双保险 + 应用层显式删除）。**

`src/lib/storage/cloud-hooks.ts:34-42` 依次删除四类云端数据：

| 表 | 应用层删除函数 | 证据 | PG 外键级联 |
|---|---|---|---|
| `bazi_charts`（命盘/报告/校准） | `deleteAllCloudChartsForUser` | `cloud-hooks.ts:37`；`pg-bazi-store.ts:158-167`（`DELETE ... WHERE user_id = $1`） | ✅ `schema.ts:130` `ON DELETE CASCADE` |
| `ziwei_charts` | `deleteAllCloudZiweiForUser` | `cloud-hooks.ts:38`；`cloud-ziwei-store.ts:144-155` | ✅ `schema.ts:142` |
| `people` | `deleteAllCloudPeopleForUser` | `cloud-hooks.ts:39`；`cloud-person-store.ts:144-155` | ✅ `schema.ts:121` |
| `liuyao_charts` | `deleteAllCloudLiuyaoForUser` | `cloud-hooks.ts:40`；`cloud-liuyao-store.ts:209` | ✅ `schema.ts:152` |

- 返回值相加为 `cloudDeleted`（`cloud-hooks.ts:41`），回传客户端（`delete/route.ts:133`）。
- 用户表 `users` 由 `deleteUserById` 删除（`account.ts:84`；`users.ts:161-172`）。
- `magic_links`：**无** `user_id` 外键、**无**删除逻辑（`schema.ts:108-117`）。但它只存 `token_hash`/`email`/`expires_at`，不含 userId；token 一次性 + 15 分钟 TTL，不构成持久残留风险。**判定为可接受，非缺陷。**
- 分享快照 `shares.json` / Upstash：**不随账号删除**。已由隐私政策披露（`privacy.ts:58`「删除账号不一定自动清除已发出的分享链接」）—— **披露与实现一致，非缺陷。**

---

### B. 授权与越权（IDOR）

#### B1. `[id]` 动态路由逐文件对照表

| 文件 | Handler | 会话校验 | 归属校验 | 判定 |
|---|---|---|---|---|
| `src/app/api/charts/[id]/route.ts` | `GET` | ✅ `:26-30` | ✅ `getCloudChart(session.userId, id)` `:45` | 已修复 |
| 同上 | `DELETE` | ✅ `:76-80`（且 `assertSameOrigin` `:63`） | ✅ `deleteCloudChart(session.userId, id)` `:95` | 已修复 |
| `src/app/api/people/[id]/route.ts` | `GET` | ✅ `:28-32` | ✅ `getCloudPerson(session.userId, id)` `:47` | 已修复 |
| 同上 | `PUT` | ✅ `:78-82`（且 `assertSameOrigin` `:65`） | ✅ `upsertCloudPerson(session.userId, {...parsed.data, id})` `:111-115` | 已修复 |
| 同上 | `DELETE` | ✅ `:146-150`（且 `assertSameOrigin` `:133`） | ✅ `deleteCloudPerson(session.userId, id)` `:165` | 已修复 |
| `src/app/api/ziwei-charts/[id]/route.ts` | `GET` | ✅ `:26-30` | ✅ `getCloudZiwei(session.userId, id)` `:45` | 已修复 |
| 同上 | `DELETE` | ✅ `:76-80`（且 `assertSameOrigin` `:63`） | ✅ `deleteCloudZiwei(session.userId, id)` `:95` | 已修复 |
| `src/app/api/liuyao-charts/[id]/route.ts` | `GET` | ✅ `:26-30` | ✅ `getCloudLiuyao(session.userId, id)` `:32` | 已修复 |
| 同上 | `DELETE` | ✅ `:62-66`（且 `assertSameOrigin` `:49`） | ✅ `deleteCloudLiuyao(session.userId, id)` `:79` | 已修复 |

**存储层二次确认**（关键：归属过滤下沉到 SQL / 数据结构，而非仅靠路由层）：

- `src/lib/storage/pg-bazi-store.ts:64`：`WHERE user_id = ${userId} AND id = ${profileId}`
- `src/lib/storage/pg-bazi-store.ts:141`：`DELETE FROM bazi_charts WHERE user_id = ${userId} AND id = ${profileId} RETURNING id`
- 内存/file 路径同样是双层 Map：`memory.users[userId][recordId]`（`cloud-store.ts:95`、`cloud-ziwei-store.ts:90`、`cloud-person-store.ts:101`）
- 删他人在 PG 路径返回 `rows.length === 0` → `false` → 路由返回 404（`charts/[id]/route.ts:96-106`），**不泄露资源是否存在**。

#### B2. 未登录用户能否猜 id 读取他人命盘

**判定：不能（已修复）。**

- 四个 `[id]` 路由的 `GET` 第一段逻辑均为 `sessionFromToken` → 未认证直接 401（如 `charts/[id]/route.ts:28-30`）。
- 即便已登录，查询键为 `(session.userId, id)` 复合键，跨用户 id 猜中亦返回 404。
- `verifySessionToken` 拒绝 `anon_` 前缀 sub（`session.ts:117`），游客身份无法伪造为登录态。

#### B3. 分享 token 的权限边界

**判定：边界清晰，设计合理（已修复）。**

- 分享**必须登录**：`src/app/api/share/route.ts:101-122`，未登录 401 并提示「游客可导出图片/PDF」。
- 快照**不是原始档案**：`share/route.ts:233-292` 仅写入裁剪后的摘要字段（八字：`pillars`/`dayMaster`；紫微：`buildZiweiSummary`；六爻：卦名/世应/用神），**不落盘完整 chart/profile**。
- 脱敏默认开启：`doMask = body.maskName !== false`（`:216`，默认 `true`）；姓名 `maskName` 保留首尾（`:33-39`）；六爻问题取首字 + `***`（`:254`）。
- token 为 `randomUUID()`（`:211`），不可枚举。
- 快照无归属用户字段，仅靠 token 作 bearer 凭证；`share/[token]/page.tsx:56-63` 对类型不匹配返回 `notFound()`。
- TTL 由 `SHARE_TTL_SECONDS` 控制（`share/index.ts:29-39`），**未设置时无过期**（`:31` 无值返回 `undefined`）。这属配置默认值偏宽松，但隐私政策已披露「以部署配置为准」（`privacy.ts:58`）。
- **注意**：分享快照存于 `LocalFileShareStore` 时是 `data/shares.json`（`local-file.ts:17-19`），`share/index.ts:50` 默认 driver 为 `local`。生产应设 `SHARE_STORE_DRIVER=upstash`（README L68 已说明）。

#### B4. `charts/[id]` 的越权写 / 越权删

**判定：无越权写；DELETE 归属校验正确。**

- 该文件**只有 `GET` 与 `DELETE`，不存在 `PUT`**（全文 109 行）。写操作走 `POST /api/charts`（集合路由，userId 强制来自 session，见 §C2）。**任务描述中假设的 PUT 不存在，此处以代码为准。**
- `DELETE`：`assertSameOrigin`（`:63-74`）→ 会话校验（`:76-80`）→ `deleteCloudChart(session.userId, id)`（`:95`）。跨用户 id 返回 404（`:96-106`）。**无越权。**
- `people/[id]` 的 `PUT` 同样安全：`assertSameOrigin`（`:65`）+ 会话（`:78-82`）+ `upsertCloudPerson(session.userId, {...parsed.data, id})`（`:111-115`）。注意 `personInputSchema` 允许客户端传 `userId`（`contracts/charts.ts:230`），但 `cloud-person-store.ts:113-123` 的 `normalize()` 强制 `userId` 覆盖为 session 值（`:52-53`），**伪造被清洗**。

---

### C. API 边界

#### C1. 请求体上限覆盖率

**判定：声明与实现不符（P2）。**

`checkBodySize` 全仓命中仅 4 处：
- 定义：`src/lib/api/validate.ts:22-27`
- 导出：`src/lib/api/index.ts:2`
- **唯一实际调用**：`src/app/api/share/route.ts:21,150`

**未调用 `checkBodySize` 的写路由清单**（全部依赖 `parseJsonBody` 的隐式 200KB 上限）：

| 路由 | 体量读取方式 | 证据 |
|---|---|---|
| `POST /api/auth/login` | `parseJsonBody` | `auth/login/route.ts:69` |
| `POST /api/auth/magic-link` | `parseJsonBody` | `auth/magic-link/route.ts:46` |
| `POST /api/auth/callback` | `parseJsonBody` | `auth/callback/route.ts:57` |
| `POST /api/account/delete` | `parseJsonBody` | `account/delete/route.ts:85` |
| `POST /api/charts` | `parseJsonBody` | `charts/route.ts:59` |
| `POST /api/charts/migrate` | `parseJsonBody` | `charts/migrate/route.ts:57` |
| `POST /api/people` | `parseJsonBody` | `people/route.ts:57` |
| `PUT /api/people/[id]` | `parseJsonBody` | `people/[id]/route.ts:97` |
| `POST /api/ziwei-charts` | `parseJsonBody` | `ziwei-charts/route.ts:57` |
| `POST /api/liuyao-charts` | `parseJsonBody` | `liuyao-charts/route.ts:56` |
| `POST /api/reading` | `parseJsonBody` | `reading/route.ts:63` |
| `POST /api/reading/ziwei` | `parseJsonBody` | `reading/ziwei/route.ts:70` |
| `POST /api/reading/liuyao` | `parseJsonBody` | `reading/liuyao/route.ts:72` |

**实际风险被低估**：`parseJsonBody` → `readBodyWithLimit`（`parse-body.ts:31-72`）实现了真正的**流式字节上限**（`:54-57` 超限即 `reader.cancel()`），且同时校验 `Content-Length`（`:35-37`，用字符串比较规避整数溢出，`:17-29`）。因此**上限实际是被统一应用的**，只是经由 `parseJsonBody` 而非 `checkBodySize`。`checkBodySize` 已成死代码（仅 share 用，因 share 手写 `request.text()` 于 `:149`）。

**结论**：安全上无实质缺口，但**代码层面存在两套并存机制**，README 的「统一请求体上限」表述与实现路径不一致。建议删除 `checkBodySize`，统一走 `parseJsonBody`。

#### C2. Origin 校验覆盖

**判定：所有写路由均已覆盖；导出接口（GET）豁免。**

已覆盖（`assertSameOrigin` 调用点）：
`charts/route.ts:40`、`charts/[id]/route.ts:63`、`charts/migrate/route.ts:30`、`people/route.ts:38`、`people/[id]/route.ts:65,133`、`ziwei-charts/route.ts:38`、`ziwei-charts/[id]/route.ts:63`、`liuyao-charts/route.ts:37`、`liuyao-charts/[id]/route.ts:49`、`reading/route.ts:25`、`reading/ziwei/route.ts:32`、`reading/liuyao/route.ts:34`、`share/route.ts:88`、`account/delete/route.ts:40`、`auth/login/route.ts:44`、`auth/magic-link/route.ts:33`、`auth/callback/route.ts:44`、`auth/logout/route.ts:11`

**缺失（均为 GET，按设计豁免）**：
- `GET /api/account/export`（`account/export/route.ts:7`）—— 无 `assertSameOrigin`、无限流。导出属于数据外带操作，建议改为 POST + Origin + 近期认证（见总表 #6）。
- `GET /api/charts`、`GET /api/people`、`GET /api/ziwei-charts`、`GET /api/liuyao-charts` 及各 `[id]` GET —— 纯读，`origin.ts:48-50` 对 GET 直接放行，符合设计。

**Origin 实现质量**：`origin.ts:42-45` 明确**不信任** `X-Forwarded-Host`（注释说明只有可信代理会重写才可用），改用 `host` 头 + 配置的 `AUTH_URL`/`NEXT_PUBLIC_APP_URL`（`:23-32,66`）。生产环境无 Origin 且无 Referer 时**拒绝**（`:52-58`）。这是一个**高于平均水平的实现**，避免了常见的 `X-Forwarded-Host` 欺骗绕过。

#### C3. 限流覆盖与 `clientKeyFromRequest`

**判定：限流覆盖有限（P2）；IP 信任模型已整改但依赖代理正确性（P1，需运行时验证）。**

限流桶与覆盖（`checkRateLimit` 调用点）：
| 桶 | 路由 | 行号 |
|---|---|---|
| `auth` | `POST /api/auth/login` | `auth/login/route.ts:28` |
| `auth` | `POST /api/auth/magic-link` | `auth/magic-link/route.ts:17` |
| `auth` | `POST /api/auth/callback` | `auth/callback/route.ts:28` |
| `account` | `POST /api/account/delete` | `account/delete/route.ts:24` |
| `reading` | `POST /api/reading` | `reading/route.ts:38` |
| `reading` | `POST /api/reading/ziwei` | `reading/ziwei/route.ts:45` |
| `reading` | `POST /api/reading/liuyao` | `reading/liuyao/route.ts:47` |
| `share` | `POST /api/share` | `share/route.ts:124` |

**无限流的路由**：全部 `GET` 列表/详情、`POST/PUT/DELETE` 的 charts/people/ziwei/liuyao CRUD、`GET /api/account/export`。默认额度：auth 10/分、account 5/分、reading 15/分、share 30/分（`rate-limit.ts:56-79`）。

`clientKeyFromRequest` 的信任模型（`rate-limit.ts:249-262`）：
- `getRateLimitIdentityMode()`（`:233-240`）读取 `RATE_LIMIT_TRUSTED_PROXY`：未设或 `"0"` → `direct`，`"1"` → `trusted-proxy`，其他值**抛错**。
- **`direct` 模式直接返回常量 `"anon"`（`:250`），完全不读转发头** —— 这是对原缺陷「直接信任 `x-forwarded-for`」的**真实修复**。代价是 direct 模式下所有客户端共用一个桶（易被单点打满，但不可绕过）。
- `trusted-proxy` 模式：优先 `x-real-ip`（`:255-256`），回退 `x-forwarded-for` 首段（`:258-260`）。
- `normalizeIp`（`:242-246`）拒绝含逗号、超 64 字符、非法 IP 的值 → 不合法则回落 `"anon"`。**攻击者无法注入任意字符串作为 key。**

**残留风险（P1，需运行时验证）**：`trusted-proxy` 模式的正确性**完全取决于边缘代理是否覆写而非追加**这两个头。代码注释（`:252-254`）也承认这一前提。若代理采用追加语义，攻击者可轮换伪造 IP 绕过限流。生产强制要求显式设置该变量（`validate-prod.ts:33-38`），降低了误配概率，但**无法在应用层保证代理行为**。建议：文档化强制覆写，或校验代理 CIDR。

生产强制 Redis 限流：`validate-prod.ts:18-31`（`RATE_LIMIT_DRIVER != redis` 即报错），避免多实例下 memory 限流失效。

#### C4. `readBodyWithLimit` 细节（补充）

`parse-body.ts:17-29` 的 `contentLengthExceedsLimit` 用**字符串长度比较**而非 `parseInt`，规避了大整数溢出；`:23` 去掉前导零。设计稳健。

---

### C5. 服务端权威计算：`validateAuthoritativeBaziRequest` / `stripAuthorityInput`

**判定：已修复 —— 客户端派生结果被彻底忽略并重算。**

`src/lib/api/validate.ts:48-93` 数据流：

1. `:51` 用 `baziReadingRequestSchema` 解析（**该 schema 中 `chart` 为 `z.unknown()`**，见 `contracts/charts.ts:141-156` —— 客户端 chart **完全不进入类型系统**）。
2. `:57` 判定来源：有 `profile` → `"profile"`；否则 `"embedded"`。
3. `:58-62`：**若有 `profile`，走 `baziBirthProfileSchema`；否则才从 `chart.meta.authoritativeInput` 取权威输入**（`:36-41`）。
4. `:76` `chart = computeAuthoritativeChart(profile)` —— **服务端重算，客户端提交的 `chart` 对象整体丢弃**。
5. `:84-92` 返回服务端计算的 chart。

`reading/route.ts:93`：`const chart = stripAuthorityInput(resolved.data.chart)` —— 再次剥离 `meta.authoritativeInput` 后才送入 LLM（`:94`），避免把输入信封当作事实喂给模型。

**逐字段核对（哪些仍被信任）**：

| 字段 | 是否被信任 | 依据 |
|---|---|---|
| `chart`（整个派生对象） | ❌ **完全丢弃并重算** | `validate.ts:76` |
| 四柱 `pillars` | ❌ 重算 | 同上 |
| `dayMaster` / `wuxingScores` | ❌ 重算 | 同上 |
| `dayun` / `liunian` | ❌ 重算 | 同上 |
| `chart.evidence` / `warnings` / `meta` | ❌ 重算（`stripAuthorityInput` 剥离 authorityInput 后再取） | `reading/route.ts:93` |
| `profile.*`（出生资料） | ✅ **被信任，但这是设计上的输入**（出生年月日时是原始事实，必须来自用户） | `validate.ts:73` |
| `profile.id` | ⚠️ 被信任为**存储主键**，但**不决定归属**（`userId` 另由 session 强制） | `charts/route.ts:74-75` |
| `profile.gender` | ✅ 被信任（作为解读参数） | `validate.ts:96` |
| `viewMode` | ✅ 被信任（仅影响文案风格，`parseViewMode` 白名单收敛为 `plain`/`pro`） | `validate.ts:89,260-262` |

**写入路径同样权威**：
- `charts/route.ts:72-76`：`profile.userId = session.userId`（强制覆盖）；`:97` `chart: authoritativeChart`（用重算结果）。
- `cloud-store.ts:127-151` `prepareAuthoritativeUpsert`：**在选存储驱动之前再次重算**（`:143`），并校验 `report.chartId === profileId`（`:112-114`）、`report.engineVersion === chart.meta.engineVersion`（`:115-120`）、`report.school === chart.meta.school`（`:121-123`）。这阻止了「客户端自造报告并绑定到任一命盘」的伪造。
- `charts/migrate/route.ts:85-107` 同样强制 `userId` + 重算。

**结论**：原 P0「API 对客户端命盘只做最小字段校验，可接收伪造派生结果」**已实质修复**，且做了纵深防御（路由层 + 存储层双重权威化）。

**紫微/六爻路径的差异（需注意）**：
- 紫微 `ziwei-charts/route.ts:71-82`：**剥离**客户端 `chart.userId`，但**未重算紫微盘** —— 紫微 `chart` 主体（`palaces`/`majorStars`/`daxian`）仍由客户端提交并原样存储。`validateZiweiChartPayload`（`validate.ts:145-186`）只做**最小结构校验**（字段存在性、数组长度上限），不校验星曜排布是否符合出生数据。
- 六爻 `liuyao-charts/route.ts:70-77`：同样**强制 `userId = session`**，但 `lines`/`benGua` 由客户端提交，`validateLiuyaoChartPayload`（`validate.ts:189-258`）仅校验取值范围（`yao` 1–6、`value` 6/7/8/9、`lines.length === 6`）。
- **影响评估**：这**不构成越权**（归属由 session 强制），属**数据完整性问题**——用户可存储与出生信息不符的紫微/六爻盘。对用户自身数据而言是可接受的（自欺），但若下游 LLM 解读据此生成「事实」，则事实层被污染。**严重度 P2，属专业准确性范畴而非安全越权**，此处记录以备交叉验证。

#### C6. 日志脱敏

**判定：已修复 —— 未发现记录 IP/生日/姓名/email 原文。**

- `src/lib/api/logger.ts:27-47` `isSensitiveKey`：拦截 `api_key`/`authorization`/`password`/`secret`/`token`/`*token`/`prompt`/`bearer`；`:49-66` `scrub` 递归处理嵌套对象与数组；`:53` 额外用正则屏蔽 `sk-xxxx` 形态密钥；`:54` 截断超 500 字符字符串。
- **`clientKey` 的实际内容**：`rate-limit.ts:250` 在默认 `direct` 模式下恒为字符串 `"anon"`；`trusted-proxy` 模式下为**纯 IP 原文**（`:255-261`）。
  - ⚠️ **注意**：logger.ts:7 的注释声称 `clientKey` 是「已脱敏，如 IP 哈希前缀」，**但代码并未对其做哈希**（`rate-limit.ts:249-262` 直接返回 IP）。注释与实现不符。在 `trusted-proxy` 模式下，**原始 IP 会写入日志**。这属 P2 级隐私观察（IP 在多数法域属个人数据）。
- 未发现日志字段包含 `email` / `birthDate` / `name` / `solarDate`：`reading/route.ts:102-119` 仅记录 requestId/route/status/duration/clientKey/art/model/token 用量/`chartId`/mode。`chartId` 为内部标识，非 PII。
- LLM 客户端 `client.ts:104-117` 明确**不把上游响应体写入日志**（注释：「可能含敏感回显」）；`:144-154` 只记 token 用量。

#### C7. 错误泄露

**判定：部分仍存在（P1，见总表 #2）。**

- **已做对的部分**：
  - 所有 catch 块**均不返回 `err.stack`**（全仓 `grep .stack` 在 `src/app/api` 下 0 命中）。
  - `auth/*` 路由的 catch 统一返回固定文案（如 `login/route.ts:119-129`「登录失败，请稍后重试」、`callback/route.ts:120-130`），不泄露内部原因。
  - `reading/route.ts:131-152` catch 返回固定「解读服务异常」，原始 `err.message` 仅进日志（`:141`）。
  - `magic-link.ts`、`session.ts` 对未配密钥仅返回「服务端未配置 AUTH_SECRET」，属配置提示，无路径泄露。
- **仍存在的问题**：以下路由把 `e.message` **原文返回给客户端**：
  - `src/app/api/people/route.ts:80`
  - `src/app/api/people/[id]/route.ts:118`
  - `src/app/api/ziwei-charts/route.ts:88`
  - `src/app/api/charts/route.ts:106`
  - `src/app/api/liuyao-charts/route.ts:87`
  - `src/app/api/charts/route.ts:85`（`computeAuthoritativeChart` 的错误信息）

  这些 message 的来源包括（a）应用自定义校验消息（如「profile.id 与 chart.profileId 不一致」，`pg-bazi-store.ts:81`）—— 安全；（b）**Postgres 驱动原生错误**（`postgres` 包会抛出含表名、列名、约束名的错误，如 `null value in column "question" violates not-null constraint`）。路径 (b) 会泄露 schema 细节。
  - **需运行时验证**：Postgres 驱动抛出的具体 message 文本未在本次静态审计中实测，**无法确认泄露的确切字段名**。但代码路径（`e.message` 直出）客观存在，判定为 P1。

---

### D. 注入与依赖

#### D1. SQL 拼接

**判定：已修复 —— 100% 参数化，未发现字符串拼接 SQL。**

全仓 grep `unsafe(` / `CREATE TABLE` / `${...}` 拼接模式，仅命中：
- `src/lib/db/client.ts:56`：`await db.unsafe(SCHEMA_SQL)` —— 唯一 `unsafe` 调用，入参是**模块内常量** `SCHEMA_SQL`（`schema.ts:97-159`），**不含任何用户输入**，安全。
- `src/lib/db/schema.ts:99-158`：静态 DDL 常量（`CREATE TABLE IF NOT EXISTS ...`）。
- `src/lib/storage/cloud-types.ts:8`：注释中的 DDL 说明。

所有数据查询均使用 `postgres` 库的**标签模板**（自动参数化）：
- `pg-bazi-store.ts:50-53`（SELECT）、`:63-66`（带 `userId` 与 `id` 的 SELECT）、`:100-120`（INSERT…ON CONFLICT）、`:140-143`（DELETE…RETURNING）、`:152-154`、`:163-166`
- `magic-link.ts:130-141`（INSERT）、`:199-206`（UPDATE…RETURNING）
- 所有 `WHERE user_id = ${userId}` 均为参数化占位，**无字符串插值**。

`sql.json(...)`（`pg-bazi-store.ts:106-109`）用于 JSONB 列，由驱动负责转义与类型绑定，非拼接。

#### D2. 数据库连接最小权限 & 请求期 DDL

**判定：请求期 DDL 仍存在但已提供规避开关（P2）；最小权限无法从代码确认。**

- **请求期 DDL：仍存在。** `ensureSchema()`（`client.ts:50-60`）在请求路径被调用：`pg-bazi-store.ts:48,61,75,138,150,161`、`magic-link.ts:128,196`、以及各 pg-store。
  - **缓解**：`:52` 支持 `DB_SKIP_ENSURE_SCHEMA=1` 跳过；`client.ts:43-49` 注释明确建议生产预跑 `npm run db:migrate`。
  - **风险**：默认**未跳过**。若生产忘记设置该变量，首次请求会执行 DDL。`:53-58` 用 `schemaReady` Promise 缓存做到**单进程内只执行一次**，但仍存在多实例并发 DDL 竞争窗口（`CREATE TABLE IF NOT EXISTS` 在 PG 中并非完全无锁无害，可能触发 `duplicate key value violates unique constraint "pg_type_typname_nsp_index"` 类竞争错误）。
  - **建议**：`validateProductionConfig` 中强制要求 `DB_SKIP_ENSURE_SCHEMA=1`（与 `RATE_LIMIT_DRIVER=redis` 同等对待）。
- **最小权限账号：无法从代码确定。** `client.ts:34-39` 直接使用 `DATABASE_URL`，无角色/权限声明。需检查实际部署的 `DATABASE_URL` 凭证权限（**需运行时/运维验证**）。`docs/DEPLOY.md` 未在本次审计中核对具体权限建议。
- 连接池：`max: 5`、`idle_timeout: 20`、`connect_timeout: 10`、`prepare: false`（`:35-39`）。`prepare: false` 适配 PgBouncer 类连接池，配置合理。

#### D3. LLM prompt injection 防护

**判定：结构上有隔离，但**无针对 prompt injection 的专门防护**。**

- `src/lib/reading/llm/safety.ts` **不处理 prompt injection**。它做的是**输出侧**合规审查：
  - `:7-27` 绝对断言/恐吓/医疗投资保证正则；
  - `:53-58` 伪造精确引用（卷/页/条）；
  - `:82-91` 未授权典籍书名。
  - 用途：`findSafetyViolation` 命中则整份报告回落规则模板（文件头 `:1-4` 注释说明）。
- **输入侧隔离（实际有效）**：
  - `reading/route.ts:80-93`：**LLM 只接收服务端重算的 chart**，客户端原始 `chart` 对象被整体丢弃。因此攻击者**无法**通过 `chart` 字段注入任意文本。
  - `stripAuthorityInput`（`reading/route.ts:93`）进一步剥离 `meta.authoritativeInput`。
  - `llm.ts:80-83`：chart 以 `JSON.stringify` 包在 ` ```json ` 代码块中作为 **system prompt 的一部分**，而非 user message。
  - `llm.ts:229`：user message **只含服务端计算出的四柱字符串**，不含自由文本。
- **残余注入面**：`validateAuthoritativeBaziRequest` 允许 `profile.name`（≤64 字符，`contracts/charts.ts:29`）与 `profile.birthPlace.province/city`（≤64）进入 `profile` 对象。**关键问题**：这些字段是否进入 prompt？
  - 追踪 `llm.ts:44` `buildSystemPrompt(chart, gender)`：`chart` 是 `computeAuthoritativeChart(profile)` 的产物（`validate.ts:76`）。若 `BaziChart` 内嵌了 `profile.name`，则用户可控文本将进入 system prompt（`llm.ts:81` 的 `JSON.stringify(chart)`），构成间接 prompt injection 面。
  - **需运行时验证**：本次未追踪 `computeAuthoritativeChart` 是否把 `profile.name` 写入 chart。从 `llm.ts:229` 的 user message 看，只显式使用了 `chart.dayMaster` 与 `chart.pillars`，**未使用姓名**。倾向判定：**姓名不进 prompt**，但**建议实跑确认**。
- **结论**：`safety.ts` 是**输出合规层，不是 injection 防护层**。当前架构下 reflection 型注入面**极小**（客户端无法直接控制 prompt 文本），但**缺少显式防护**（如分隔符转义、指令与数据分区标注）。若未来开放「备注/校准」等自由文本字段进入 prompt，风险将立即上升 —— 隐私政策 `privacy.ts:47` 已提示用户「请勿在校准或备注中填写不必要的敏感个人信息」，暗示此类字段存在。

#### D4. `next.config.ts` 安全响应头

**判定：已配置 —— 5 项要求全部覆盖，另有 2 项附加。**

`src/app/api` 之外，`next.config.ts:38-71` `getSecurityHeaderRules()` 返回规则，经 `:81-83` `headers()` 挂载。

基线头（`:41-54`，`source: "/:path*"`）：

| 头 | 值 | 证据 | 判定 |
|---|---|---|---|
| `Content-Security-Policy` | 见下 | `:42` | ✅ 已配置（有保留项） |
| `X-Content-Type-Options` | `nosniff` | `:43` | ✅ |
| `X-Frame-Options` | `DENY` | `:44` | ✅ |
| `X-XSS-Protection` | `0` | `:45` | ✅（正确：显式禁用有缺陷的旧过滤器） |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `:46-49` | ✅ |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | `:50-53` | ✅ 附加 |

- **HSTS**：`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`（`:3`），**仅在 production 且 `x-forwarded-proto: https` 时下发**（`:58-68`）。条件化设计正确 —— 避免本地 HTTP 开发被误锁。
- **CSP**（`:10-25`）：`default-src 'self'`；`script-src 'self' 'unsafe-inline'`（dev 追加 `'unsafe-eval'`）；`style-src 'self' 'unsafe-inline'`；`img-src 'self' data: blob:`；`font-src 'self'`；`connect-src 'self'`；`object-src 'none'`；`base-uri 'self'`；`form-action 'self'`；`frame-ancestors 'none'`。
  - **保留项**：生产 CSP 仍含 `script-src 'unsafe-inline'`（`:15`）—— 这显著削弱 XSS 防护（虽仍有 `default-src 'self'` 限制外链）。注释（`:5-9`）说明设计意图是「浏览器只与同源 route handler 通信，LLM/邮件/OG 字体是服务端到服务端连接」，因此 `connect-src 'self'` 合理。
  - **建议**：引入 nonce/hash 机制移除 `'unsafe-inline'`。当前状态为**可接受但不理想**。
  - 值得肯定的细节：`frame-ancestors 'none'`（`:23`）与 `X-Frame-Options: DENY` 双重防点击劫持；`object-src 'none'` 阻断插件；`base-uri 'self'` 防 base 标签劫持。
- `poweredByHeader: false`（`:75`）移除 `X-Powered-By`，减少指纹。

---

### E. 隐私

#### E1. 政策描述与代码实际行为逐条核对

| # | 政策原文 | 行号 | 代码实际行为 | 一致性 |
|---|---|---|---|---|
| 1 | 游客数据写 `sessionStorage`，关浏览器清空，不上传云端 | `privacy.ts:27` | 未在本次审计中核对客户端 storage 实现（`src/lib/storage/idb.ts`、`mode.ts`） | **需运行时验证** |
| 2 | 登录后档案可存 localStorage/IndexedDB 并同步云端 | `privacy.ts:28` | `cloud-store.ts` / `cloud-ziwei-store.ts` 等提供云端 upsert；客户端同步见 `storage/sync.ts` | ✅ 一致 |
| 3 | 保存账号标识（邮箱、显示名称）与会话 | `privacy.ts:37` | `users.ts:138-144`（email/displayName）；`session.ts:79-85`（会话含 email/name） | ✅ 一致 |
| 4 | 命盘/报告存服务端，「仅你本人可访问」 | `privacy.ts:38` | §B 逐文件核对确认归属过滤（路由 + SQL 双层） | ✅ **一致且已验证** |
| 5 | 可导出云端 JSON / 删除账号及数据 | `privacy.ts:39` | `account/export/route.ts`；`account/delete/route.ts` | ✅ 一致 |
| 6 | **LLM 解读时会把排盘结果与上下文发送至已配置的大模型服务方** | `privacy.ts:46` | `llm.ts:80-83,229` 构造 prompt 并经 `client.ts:87-99` 发往 `LLM_BASE_URL` | ✅ **已披露（这是常见缺失项，本项目做对了）** |
| 7 | 服务不可用时回落本地模板，不发送数据 | `privacy.ts:48` | `llm.ts:187-220`（未配置直接回落，未发起 fetch） | ✅ 一致 |
| 8 | 分享需登录，创建脱敏快照，持链接者可免登录查看 | `privacy.ts:56` | `share/route.ts:101-122`（需登录）、`:216`（默认脱敏）、`share/[token]/page.tsx:52-63`（免登录查看） | ✅ 一致 |
| 9 | 「分享快照存储与过期策略以部署配置为准；删除账号不一定自动清除分享链接」 | `privacy.ts:58` | `share/index.ts:29-39`（`SHARE_TTL_SECONDS` 未设为无过期）；`cloud-hooks.ts:34-42` **确实不含** share 删除 | ✅ **一致（诚实披露）** |
| 10 | 导出仅云端 + 账号字段；本地数据需另行导出 | `account.ts:25-26`（note）、`:60-62` | `buildAccountExport` 返回 `user` + `cloud`，`notes.localData` 明确告知本地数据不在内 | ✅ 一致 |

**发现的不一致 / 缺口**：

- **缺口 1（P2）**：政策 `privacy.ts:34-40` 称数据「存储在我们的服务端（或配置的云存储中）」，但**未说明**在未配置 `DATABASE_URL` 时数据会以 **JSON 明文文件**落盘于应用工作目录（`cloud-store.ts:39-64`、`users.ts:29-72`、`magic-link.ts:39-72`）。生产已被 `validate-prod.ts:73-78` 禁止此路径，但政策未提及该回退机制的存在。
- **缺口 2（P2）**：政策未说明**日志**中会记录客户端 IP（`trusted-proxy` 模式下 `rate-limit.ts:255-261` → `logger.ts:7` 字段）。**且 `logger.ts:7` 注释声称已哈希脱敏，实际未哈希** —— 注释与实现不符。
- **缺口 3（提示）**：政策 `privacy.ts:47` 提示勿填敏感信息，但**未明确**「当地时间/出生地」属可识别个人信息（结合姓名 + 精确出生时间，理论上可高精度定位个体）。

**总体评价**：隐私政策质量**高于平均水平** —— 特别是第 6 条主动披露第三方 LLM 接收命盘数据（这是此类产品最常见的合规缺口），第 9 条诚实披露删除账号不清分享链接。上述为细节补强项，非虚假陈述。

#### E2. 导出功能是否覆盖全部数据（GDPR 可携带权）

**判定：基本覆盖云端数据；本地数据以说明替代（设计取舍，非缺陷）。**

`buildAccountExport`（`src/lib/auth/account.ts:31-64`）导出内容：

| 数据类 | 是否导出 | 证据 |
|---|---|---|
| 账号字段（id/email/displayName/createdAt/updatedAt） | ✅ | `account.ts:52-58` |
| 八字 profiles | ✅ | `cloud-hooks.ts:49-59, 68` |
| 八字 charts | ✅ | `cloud-hooks.ts:56, 69` |
| 报告 reports | ✅ | `cloud-hooks.ts:57, 70` |
| 校准 calibrations | ✅ | `cloud-hooks.ts:58, 71` |
| 紫微 charts | ✅ | `cloud-hooks.ts:61-62, 72` |
| 人物 people | ✅ | `cloud-hooks.ts:63, 73` |
| 六爻 charts | ✅ | `cloud-hooks.ts:64-65, 74` |
| **分享快照** | ❌ 未导出 | 无对应函数；`share/index.ts` 只有 get/save/delete |
| 本地 localStorage / IndexedDB | ❌ 未导出（以 `notes.localData` 说明替代） | `account.ts:25-26, 60-62` |
| `magic_links` 记录 | ❌ 未导出 | 无查询接口 |

- **本地数据不导出**：属**合理设计取舍**（服务端无法访问浏览器存储），且客户端已提供「导出本机数据」入口（`account.ts:26` 文案指向）。**判定：可接受。**
- **分享快照不导出**：用户无法通过 API 取回自己创建过的分享链接列表。这构成**可携带权的部分缺口**（P2 级）。缓解因素：分享快照本身是用户从已有命盘主动派生的摘要，且创建时已返回 URL（`share/route.ts:318-327`）。
- **异常吞掉风险**：`account.ts:43-47` 用 try/catch 包裹 `exportCloudDataForUser`，**失败时静默返回空数组**（`:37-42` 的初始值）。这意味着**导出接口可能返回「成功」但 `cloud` 字段为空**，用户误以为没有数据。
  - **判定：这是一个真实缺陷（P2）** —— 与已被修复的删除路径（`account.ts:72-75` 明确禁止伪成功）相比，**导出路径仍保留了静默失败**，两者标准不一致。用户可能据此认为数据已丢失或不存在。建议：导出失败时返回 500 或显式在响应中标注 `cloudExportError`。

---

## 3. 必须修复清单（按严重度排序）

### P0（上线阻断）

1. **`AUTH_SECRET` 强度校验缺失** — `src/lib/config/validate-prod.ts:65-67`
   - 现状：仅校验非空；`session.ts:46-53` 无长度/熵校验。
   - 修复：在 `validateProductionConfig` 中要求长度 ≥32、拒绝 `DEV_AUTH_SECRET_FALLBACK`（`constants.ts:15`）及常见弱值；`verifySessionToken` 可增加密钥强度前置检查。
   - **这是唯一的上线阻断项。** 其余 P0 原缺陷均已实质修复。

### P1（尽快修复）

2. **错误信息直出客户端** — `people/route.ts:80`、`people/[id]/route.ts:118`、`ziwei-charts/route.ts:88`、`charts/route.ts:106`、`liuyao-charts/route.ts:87`、`charts/route.ts:85`
   - 修复：引入统一 `toSafeErrorMessage(e)` 映射，仅白名单业务消息外传，其余返回固定文案；原文进 `logApi`。
3. **可信代理模式下限流 IP 可伪造** — `rate-limit.ts:249-262`
   - 修复：文档强制要求代理**覆写**（而非追加）`X-Real-IP`/`X-Forwarded-For`；或在 `trusted-proxy` 模式校验来源代理 CIDR。**需运行时验证**当前部署代理行为。

### P2（计划修复）

4. **导出路径静默失败，与删除路径标准不一致** — `account.ts:43-47`
   - 修复：导出失败时返回 500 或响应中显式标注错误字段。
5. **请求期 DDL 默认开启** — `client.ts:50-60`
   - 修复：`validateProductionConfig` 强制 `DB_SKIP_ENSURE_SCHEMA=1`（参照 `RATE_LIMIT_DRIVER=redis` 的强制方式，`validate-prod.ts:18-31`）。
6. **限流覆盖不足（CRUD / 导出无限流）** — 缺失清单见 §C3
   - 修复：新增 `read` 桶，覆盖 `[id]` GET 与 `account/export`。
7. **`checkBodySize` 死代码 + 文档与实现不符** — `validate.ts:22-27`（唯一调用 `share/route.ts:150`）
   - 修复：删除 `checkBodySize`，统一 `parseJsonBody`；或修正 README 表述。
8. **`logger.ts:7` 注释称 `clientKey` 已哈希脱敏，实际未哈希** — `logger.ts:7` vs `rate-limit.ts:255-261`
   - 修复：要么真正做 IP 哈希，要么修正注释。
9. **`GET /api/account/export` 无 Origin 校验、无限流** — `account/export/route.ts:7`
   - 修复：改 POST + `assertSameOrigin` + 近期认证复用（`delete/route.ts:69-83` 模式）。
10. **隐私政策未披露 file 存储回退与 IP 日志** — `privacy.ts:34-40`
    - 修复：补两条说明。
11. **紫微/六爻盘不重算，客户端派生结果直接入库** — `ziwei-charts/route.ts:71-82`、`liuyao-charts/route.ts:70-77`
    - 说明：**非越权**（归属已由 session 强制），属数据完整性/专业准确性问题。若下游 LLM 将其作为事实，需评估事实层污染。
12. **生产 CSP 仍含 `script-src 'unsafe-inline'`** — `next.config.ts:15`
    - 修复：引入 nonce 机制。
13. **Magic Link 内存路径多实例竞态** — `magic-link.ts:222-241`
    - 修复：生产已强制 PG（`validate-prod.ts:73-78`），建议在内存路径加显式告警或直接禁用。

### 已确认修复（无需行动，供回归基线）

- Magic Link 发信失败不返回链接（`magic-link.ts:179`）
- Magic Link PG 路径原子消费（`magic-link.ts:199-206`）
- token 一次性 + 15 分钟 TTL + 邮箱服务端绑定（`magic-link.ts:14,119,203-204,216`）
- Cookie `httpOnly` / `secure`(prod) / `sameSite=lax`（`session.ts:162-172`）
- `AUTH_ALLOW_DEV_LOGIN` 生产双重拦截（`validate-prod.ts:69-71` + `magic-link.ts:251-254`）
- 账号删除二次确认 + 15 分钟近期认证（`contracts/auth.ts:47-51`；`delete/route.ts:69-99`）
- 云端删除异常不再被吞（`account.ts:82`；`delete/route.ts:138-148`）
- 四表级联删除（`cloud-hooks.ts:34-42` + `schema.ts:121,130,142,152`）
- **全部 `[id]` 路由 IDOR 防护**（§B 对照表，9 个 handler 全通过）
- 服务端权威重算 + `stripAuthorityInput`（`validate.ts:48-93`；`cloud-store.ts:127-151`）
- SQL 全参数化（§D1）
- CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy/Permissions-Policy（`next.config.ts:38-71`）
- 日志密钥/提示词脱敏（`logger.ts:27-66`）
- 无堆栈泄露（全仓 `src/app/api` 下 `.stack` 零命中）
- 分享快照脱敏 + 需登录 + 摘要化（`share/route.ts:101-122,216,233-292`）
- `assertSameOrigin` 不信任 `X-Forwarded-Host`（`origin.ts:42-45`）
- `parseJsonBody` 流式字节上限 + Content-Length 溢出安全比较（`parse-body.ts:17-72`）
- 隐私政策主动披露第三方 LLM 数据外发（`privacy.ts:46`）

---

## 4. 复审结论

对 `docs/PROJECT_REVIEW.md` §2.1 十条 P0 的验证结果：

| 原 P0 项 | 判定 |
|---|---|
| Magic Link 发信失败仍返回链接 → 账号接管 | **已修复** |
| Magic Link 消费非原子 | **已修复**（PG 路径；内存路径 P2 残留） |
| 账号删除确认可省略 / 云端异常被吞 / 数据未删净 | **已修复** |
| API 接收伪造派生结果 | **已修复**（纵深防御） |
| 缺统一请求体上限 / Schema 校验 / 限流 | **部分修复** —— Schema（`parseJsonBody`）与体上限已到位；**限流覆盖不足**（P2） |
| 限流信任 `x-forwarded-for`；日志记录未脱敏 IP | **大部分修复** —— direct 模式已不读转发头；trusted-proxy 模式依赖代理正确性（P1，需运行时验证）；IP 未哈希（P2） |
| 生产未配 Postgres 回落 JSON 文件 | **已修复**（`validate-prod.ts:73-78` 强制拦截） |
| 请求期执行建表 DDL | **部分修复** —— 提供 `DB_SKIP_ENSURE_SCHEMA=1` 但**默认未启用**，未强制（P2） |
| 仓库无 Git commit / CI / CODEOWNERS / SECURITY / Dockerfile / Compose | 本次未审计（**超出安全复审范围**，且属工程治理项） |

**整体判断**：W22–W28 的安全整改在**认证、授权/越权、服务端权威计算、SQL 注入、安全响应头**五个核心领域是**真实有效**的，代码质量高于同类项目平均水平（尤其 `assertSameOrigin` 的 `X-Forwarded-Host` 处理、`parseJsonBody` 的流式上限、IDOR 的存储层二次过滤）。

README 声称「基本完成」**基本属实但略有超前**：`checkBodySize` 覆盖率、限流覆盖率、请求期 DDL 默认值三处**存在声明与实现差距**，且新发现 **`AUTH_SECRET` 强度校验缺失（P0）**——这是原 P0 清单未列出、但影响等价于账号接管的缺陷。

**唯一上线阻断项为 P0-1（AUTH_SECRET 强度）**，修复成本极低（十余行校验代码）。

---

*本报告为只读审计产物，未修改仓库任何文件。*
