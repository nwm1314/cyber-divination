# P0 修复报告（FIX_REPORT_P0）

> 本文档由独立复验者撰写。所有结论均基于**亲手执行的命令输出**与 **git 历史核实**，不做转述、不臆断。
> 凡无法核实的项，明确标注 **未验证**。

- 核实日期：2026-09-19
- 复验时 HEAD：`6c40d1a`（`docs: X-1 仲裁报告、文档债修正与 README 基线更新`）
- 项目：Next.js 16.2.10「赛博命理」
- 依据 commit：`8911b5e` / `1e20b04` / `146f075` / `69bba86`

## 0. 复验范围与工作区状态（重要前置）

复验时工作区**并非干净**，这一点直接影响 P0-01 的结论，故先声明：

```
$ git status --porcelain
 M scripts/validate-prod-env.mjs
 M src/lib/config/validate-prod.ts
?? src/lib/__verify__/

$ git diff HEAD --stat
 scripts/validate-prod-env.mjs   | 44 ++++++++++++++++++++++++++++++++
 src/lib/config/validate-prod.ts | 56 +++++++++++++++++++++++++++++++++
 2 files changed, 100 insertions(+)
```

含义：

1. `src/lib/config/validate-prod.ts` 在 commit `8911b5e` 之上还有 **+56 行未提交改动**（补充 `longestConsecutiveRun()` 与 `shannonEntropyPerChar()` 两道校验）；`scripts/validate-prod-env.mjs` 有 **+44 行未提交改动**，与之对齐。
2. `src/lib/__verify__/v1-adversarial.test.ts`（13 例攻击性测试）为**未跟踪文件**，是复验产物，不在任何 commit 中。
3. `HEAD` 已推进到 `6c40d1a`，四个修复 commit 之后另有 7 个 commit（`63f0e20`…`6c40d1a`）。

**结论**：下文「验证证据」一节的门禁数字，是**当前工作区（HEAD `6c40d1a` + 上述未提交改动）**的实测结果；而「P0-01 修复方案」一节的代码引用，会分别标明**哪个部分属于 commit `8911b5e`、哪个部分属于未提交改动**。

---

## P0-01 AUTH_SECRET 弱密钥可离线枚举伪造会话 → 账号接管

### 问题复述

生产环境仅校验 `AUTH_SECRET` 非空，攻击者可用弱密钥离线伪造任意用户的会话 Cookie，实现完全账号接管。

### 根因（精确定位）

修复前 `src/lib/config/validate-prod.ts` 生产分支只做非空判断：

```
$ git show 8911b5e^:src/lib/config/validate-prod.ts | Select-String -Pattern "AUTH_SECRET"
  if (!process.env.AUTH_SECRET?.trim()) {
    errors.push("AUTH_SECRET 为生产必填（签名会话 Cookie）");
```

- `src/lib/config/validate-prod.ts`（修复前）：仅 `!process.env.AUTH_SECRET?.trim()`，**无长度/熵/字典校验**。
- `src/lib/auth/session.ts:46-53` `getAuthSecret()`：生产仅判空后抛错，同样无强度校验。

```
46: export function getAuthSecret(): string {
47:   const fromEnv = process.env.AUTH_SECRET?.trim();
48:   if (fromEnv) return fromEnv;
49:   if (process.env.NODE_ENV === "production") {
50:     throw new Error("AUTH_SECRET is required in production");
51:   }
52:   return DEV_AUTH_SECRET_FALLBACK;
53: }
```

- 会话 token 构造于 `src/lib/auth/session.ts:86-89`：`base64url(payload)` + `HMAC-SHA256(body, secret)`。
- 校验于 `src/lib/auth/session.ts:110-129`：`safeEqual(sig, expected)` 通过后直接解析 payload 并返回，**只验签名、不查库**：

```
110:   const expected = sign(body, secret);
111:   if (!safeEqual(sig, expected)) return null;
```

因此：密钥一旦可枚举，攻击者即可离线签出合法 Cookie，服务端无从辨别。

### 修复方案

**文件：`src/lib/config/validate-prod.ts`**

- （commit `8911b5e`）新增导出常量 `AUTH_SECRET_MIN_LENGTH = 32`（`validate-prod.ts:34`），以及 `checkAuthSecretStrength(secret)`（`validate-prod.ts:98`）。校验层次：
  1. 空值 → `必填`；
  2. 长度 < 32 → `强度不足：长度 N`；
  3. 命中 `WEAK_AUTH_SECRETS` 全等字典（含 `DEV_AUTH_SECRET_FALLBACK`）→ 拒绝；
  4. 命中 `WEAK_AUTH_SECRET_SUBSTRINGS` 词根（按"包含"匹配）→ 拒绝；
  5. `/^(.)\1+$/` 单字符重复 → 拒绝；
  6. `isMonotonicSequence()` 全串单调 → 拒绝；
  7. `hasRepeatedBlock()` 整串为短片段重复 → 拒绝；
  8. 字符类 < 2 → 拒绝。
- （commit `8911b5e`）生产分支改为调用该函数（`validate-prod.ts:230`）：

```
230:   const authSecretError = checkAuthSecretStrength(process.env.AUTH_SECRET);
231:   if (authSecretError) {
232:     errors.push(authSecretError);
233:   }
```

**文件：`scripts/validate-prod-env.mjs`**（commit `8911b5e`）

按"纯 Node、无 TS 路径别名"的约束复刻了同一套 `checkAuthSecretStrength`，保证 `npm run check:prod-env` 与运行时 `instrumentation.ts` 的判定一致。

**为什么这样改**

- 判据放在**校验器层**而非 `getAuthSecret()`：`getAuthSecret()` 在每次签发/校验会话时都会被调用，把字典与熵计算放在热路径会带来无谓开销；且它需要保持"能读就返回"的纯粹语义。
- 词根按**包含**而非全等匹配：`ChangeMe-ChangeMe-…`、`prod-secret-prod-secret-…` 这类"短词重复凑长度"的构造，真实熵等于词根熵，仅看长度会全部放行。
- 强制生产 fail-fast 于 `src/instrumentation.ts:8-9` 触发，服务无法带弱密钥启动。

### ⚠️ 未提交的补救改动（复验发现）

commit `8911b5e` 的判定**存在一个可利用的逃逸值**。独立复验用例 `src/lib/__verify__/v1-adversarial.test.ts:83` 以

```
"abcdefghijklmnopqrstuvwxyz012345"
```

作为弱密钥候选，攻击 4 期望其在生产路径 fail-fast。**该用例在 commit `8911b5e` 的判定下失败**。

我用探针直接验证了该值的判定结果：

```
$ npx tsx .\_probe.tmp.ts
min: 32
"abcdefghijklmnopqrstuvwxyz012345"             len=32   -> null
```

`null` 即"通过校验"。原因：该串长度恰为 32、含小写字母与数字（字符类 = 2）、不含任何弱词根、**且不是全串单调**——它在 `m`→`0` 处断掉（`isMonotonicSequence` 只判整串），也不构成重复片段。于是它逐条穿过 1–8 全部检查。

我在生产配置路径上确认了该逃逸确实可达（工作区版本已修，故此处抛错）：

```
$ npx tsx .\_probe3.tmp.ts     # AUTH_SECRET=abcdefghijklmnopqrstuvwxyz012345
=> THREW: [validate-prod] 生产配置校验失败:
- AUTH_SECRET 强度不足：包含过长的连续顺序片段（如字母表或数字序列），熵不足
```

伪造可行性也已端到端演示（同一个被 validator 接受的值可直接签出受害者的 token，无需查库）：

```
accepted by validator: null
forged token (no DB lookup needed): eyJzdWIiOiJ1c2VyX3ZpY3RpbSIsIm...eyJ0eXBlIjoiQnVmZmVy...
```

未提交改动补充了两道校验（`validate-prod.ts`，+56 行）：

- `longestConsecutiveRun(value) >= 6`：按**最长连续 ±1 片段**判定，覆盖 `abcdefghij…`/`0123456789…` 这类"字母表/数字序列"构造（此前只判整串单调，故被绕过）；
- `shannonEntropyPerChar(value) < 3.0`：Shannon 熵兜底，拦截 `aabbccddee…` 这类周期短、字符集小的构造。

**复验处置建议**：这两道校验目前**仅存在于工作区，尚未提交**。若认为该逃逸属 P0-01 的组成部分，应先提交它，再引用本文档；否则 P0-01 应记为「部分修复」。

### 新增测试

**`src/lib/config/validate-prod.test.ts`**（由 12 例增至 27 例，commit `8911b5e` 新增 15 例）

新增块 `describe("checkAuthSecretStrength（P0 修复回归）")`：

| 测试名 | 断言要点 |
|---|---|
| `拒绝空值与未配置` | `undefined` / `""` / `"   "` 均匹配 `/必填/` |
| `拒绝长度不足的密钥（原缺陷可被利用的直接原因）` | `123`、`secret`、`abc`、`hunter2`、`1234567890` 均匹配 `/强度不足/` |
| `拒绝恰好低于最小长度的边界值` | 构造 `length === AUTH_SECRET_MIN_LENGTH - 1` 的值，断言被拒（下边界） |
| `接受恰好达到最小长度的合规密钥` | `Qw7Zx2Lm5Vb8Nc4Ry6Hj0Pa3Sg9Uh1Wk` → `toBeNull()` |
| `拒绝项目自带的开发占位密钥（会被复制到生产的值）` | `cyber-divination-dev-secret-change-me` 被拒 |
| `拒绝常见弱密钥字典成员（大小写不敏感）` | `ChangeMe-…`、`PASSWORD-…`、`prod-secret-…`、`TestTest…` 被拒 |
| `拒绝单一重复字符与单调序列（无熵）` | `"a".repeat(64)`、`"0".repeat(40)`、`abcdefghij…`、`zyxwvuts…` 被拒 |
| `拒绝字符类过少的密钥` | `qwertyuiopasdfghjklzxcvbnmqwerty` 被拒 |
| `接受随机生成的高熵密钥（base64url 形态，即推荐配置）` | 两条 base64url 形态密钥 → `toBeNull()`（防过度拦截） |
| `生产环境下弱 AUTH_SECRET 必须 fail-fast（端到端复现攻击前置条件）` | `AUTH_SECRET=123` + 合法 DB/限流配置 → `validateProductionConfig()` 抛 `/AUTH_SECRET/` |
| `生产环境下开发占位密钥必须 fail-fast` | 同上，占位密钥抛错 |

**`src/lib/__verify__/v1-adversarial.test.ts`**（未跟踪，13 例，独立复验产物）

其中 `攻击4：生产路径端到端——所有弱密钥必须 fail-fast`（`:77`）逐个把 7 个弱密钥（含 `"abcdefghijklmnopqrstuvwxyz012345"`、`"Ab1".repeat(11)`、`"secret-".repeat(6)`）塞进生产路径，断言全部抛 `/AUTH_SECRET/`；另有对照组 `:97` 断言强密钥必须放行。

### 验证证据

```
$ npx vitest run src/lib/config/validate-prod.test.ts
 ✓ src/lib/config/validate-prod.test.ts (27 tests) 26ms
 Test Files  1 passed (1)
      Tests  27 passed (27)
EXITCODE=0
```

```
$ npx vitest run src/lib/__verify__/v1-adversarial.test.ts
 ✓ src/lib/__verify__/v1-adversarial.test.ts (13 tests) 11ms
 Test Files  1 passed (1)
      Tests  13 passed (13)
ISOLATED_EXITCODE=0
```

生产路径脚本实测（`scripts/validate-prod-env.mjs`）：

```
$ node scripts/validate-prod-env.mjs      # SHARE_STORE_DRIVER 未设置
[check:prod-env] 生产配置校验失败:
  - 生产禁止以本地 JSON 文件作为分享快照存储（SHARE_STORE_DRIVER=(default: local)）。…
EXITCODE=1

$ node scripts/validate-prod-env.mjs      # SHARE_STORE_DRIVER=upstash
[check:prod-env] 生产配置校验通过
EXITCODE=0
```

> **逃逸值的复验记录（真实）**：在 commit `8911b5e` 的判定下，`abcdefghijklmnopqrstuvwxyz012345` 返回 `null`（放行），导致 `v1-adversarial.test.ts:77` 失败。我第一次运行全量 `npm test` 时捕获到该失败：
>
> ```
> FAIL  src/lib/__verify__/v1-adversarial.test.ts > V-1 复验 · P0-01 AUTH_SECRET 强度（尝试绕过） > 攻击4：…
> AssertionError: 弱密钥应被拒绝: "abcdefghijklmnopqrstuvwxyz012345": expected [Function] to throw an error
>  Test Files  1 failed | 74 passed (75)
>       Tests  1 failed | 623 passed (624)
> EXITCODE=1
> ```
>
> 随后的 5 次全量运行**连续通过**（624/624，exit=0），因为工作区的未提交改动已补上 `longestConsecutiveRun` / `shannonEntropyPerChar` 两道校验。**该失败是环境相关（依赖工作区是否含未提交改动），不是随机 flaky**——请务必连同未提交改动一起评审。

### 回滚方式

```
git revert 8911b5e
```

注意：该 revert 会一并回滚 P0-02 的校验（两者同一 commit），且**不会**回滚工作区那 +56 行未提交改动；若需完整回滚 P0-01，还需 `git checkout -- src/lib/config/validate-prod.ts`（会同时丢弃 P0-02 的未提交部分）。

---

## P0-02 分享存储生产默认落到无锁本地文件 → 多实例并发写静默丢数据

### 问题复述

分享存储 driver 缺省为 `local`，其实现全量读改写且无文件锁，两套 env 校验器均不读该变量，多实例并发写会静默覆盖丢失分享链接。

### 根因（精确定位）

- `src/lib/share/index.ts:20-27` `resolveDriver()` 缺省值即 `"local"`：

```
20: function resolveDriver(): ShareStoreDriver {
21:   const raw = (process.env.SHARE_STORE_DRIVER ?? "local").trim().toLowerCase();
22:   if (raw === "upstash") return "upstash";
23:   if (raw === "local" || raw === "") return "local";
```

- `src/lib/share/local-file.ts:41-45` `save()` 为 read-modify-write，`writeAll()`（`:36-39`）整体覆写文件，**全程无锁**：

```
41:   async save(snapshot: ShareSnapshot): Promise<void> {
42:     const all = await this.readAll();
43:     all[snapshot.token] = snapshot;
44:     await this.writeAll(all);
45:   }
```

- 修复前两套校验器（`src/lib/config/validate-prod.ts`、`scripts/validate-prod-env.mjs`）**都不读 `SHARE_STORE_DRIVER`**，故生产可静默使用该 driver。

对比参考：DB 与限流两处的 driver 降级均为 fail-fast 抛错，唯独分享存储缺失生产校验。

### 修复方案

**文件：`src/lib/config/validate-prod.ts`**（commit `8911b5e`）

新增导出函数 `isFileShareStoreForbiddenInProd()`（`validate-prod.ts:16-21`），仅当取值为 `upstash` 时放行：

```
16: export function isFileShareStoreForbiddenInProd(): boolean {
17:   const raw = (process.env.SHARE_STORE_DRIVER ?? "").trim().toLowerCase();
18:   if (raw === "upstash") return false;
19:   // "local"、"" 或任何非 upstash 取值都会落到 LocalFileShareStore
20:   return true;
21: }
```

并在 `validateProductionConfig()` 中接入（`validate-prod.ts:246-252`），报错文案显式区分 `(default: local)` 与实际取值，并给出修复指令。

**文件：`scripts/validate-prod-env.mjs`**（commit `8911b5e`）

新增同语义的 `isFileShareStoreForbiddenInProd()`，与 TS 侧对齐。

**为什么这样改**

- 采用**白名单**（仅 `upstash` 放行）而非黑名单：`share/index.ts:24-26` 对未知取值会抛错，但 `""`/`"local"`/`"LOCAL"` 等仍会落到本地文件，白名单能一次性覆盖全部降级路径。
- 大小写与空白容忍：`.trim().toLowerCase()`，避免 `"  UPSTASH  "` 被误判为禁止。
- fail-fast 于启动期而非写入期：分享存储不可用时服务不应启动，否则用户会在"分享成功"后才发现链接丢失。

### 新增测试

**`src/lib/config/validate-prod.test.ts`** — `describe("isFileShareStoreForbiddenInProd（P0 修复回归）")`：

| 测试名 | 断言要点 |
|---|---|
| `未设置 SHARE_STORE_DRIVER 时判定为禁止（默认落到 local）` | 删除变量后 `toBe(true)` |
| `显式 local 判定为禁止` | `"local"` → `true` |
| `upstash 判定为允许` | `"upstash"` → `false` |
| `大小写与空白容忍` | `"  UPSTASH  "` → `false` |
| `生产未配置分享存储时 fail-fast（复现静默丢数据的部署前置条件）` | 其余配置齐备但无 `SHARE_STORE_DRIVER` → 抛 `/SHARE_STORE_DRIVER/` |
| `生产显式 upstash 时通过` | 全量合法配置 → `not.toThrow()` |

同文件 `setValidRateLimitConfig()`（`:59-63`）被改造为**必须**同时设置 `SHARE_STORE_DRIVER=upstash`，使既有 12 例的夹具同步满足新校验（否则会误判为回归）。

**`src/lib/__verify__/v1-adversarial.test.ts:114`** `攻击：所有非 upstash 取值都必须被判为禁止`：遍历 `undefined`、`""`、`"   "`、`"local"`、`"LOCAL"`、`" local "`、`"file"`、`"memory"`、`"redis"`、`"upstash2"`、`"upstashx"`（共 11 个）断言全为 `true`；对照组 `:137` 断言 `upstash`/`UPSTASH`/`  UpStash  ` 放行。

### 验证证据

```
$ npx vitest run src/lib/config/validate-prod.test.ts
 ✓ src/lib/config/validate-prod.test.ts (27 tests) 26ms
 Test Files  1 passed (1)
      Tests  27 passed (27)
EXITCODE=0
```

生产路径端到端（真实退出码，见 P0-01 节）：未设 `SHARE_STORE_DRIVER` 时 `EXITCODE=1` 且报错指向该变量；设为 `upstash` 后 `EXITCODE=0`。

### 回滚方式

```
git revert 8911b5e
```

（P0-01 与 P0-02 同属该 commit，revert 会同时回滚两者。）

---

## P0-03 API 错误文案乱码（mojibake）

### 问题复述

5 处中文字符串为 UTF-8 被按 GBK 解码的 mojibake，且这些串会直接作为 `error.message` 返回给 API 调用方，用户看到的是乱码。

### 根因（精确定位）

修复前各点位的实际内容（`git show 1e20b04` 的 `-` 行）：

| 文件 | 修复前 | 修复后 |
|---|---|---|
| `src/lib/api/validate.ts:54` | `"Bazi璇锋眰浣撴棤鏁?"` | `"Bazi 请求体无效"` |
| `src/lib/api/validate.ts:68` | `"legacy 鐩樻棤鏈嶅姟绔潈濞佺敤鎴疯緭鍏ワ紝…"` | `"legacy 盘缺少服务端权威输入，请合并新版档案或改用模板解读"` |
| `src/lib/api/validate.ts:69` | `"Bazi 鐢熷嚭淇℃伅鏃犳晥"` | `"Bazi 出生信息无效"` |
| `src/lib/api/validate.ts:80` | `"Bazi 鍛界洏璁＄畻澶辫触"` | `"Bazi 命盘计算失败"` |
| `src/lib/contracts/charts.ts:152` | `"缂哄皯 Bazi 鐢熷嚭淇℃伅鎴栨湁鏁堢洏"` | `"缺少 Bazi 出生信息或有效命盘"` |

`charts.ts:152` 位于 `zod` 的 `ctx.addIssue({ message })`，即 `baziReadingRequestSchema` 的校验消息；`validate.ts:54` 取的是 `parsed.error.issues[0].message`——这正是 mojibake 会外泄到 API 响应体的链路。另 `src/lib/api/validate.test.ts:67` 的正则 `/legacy|妯℃澘/` 中也含同类乱码。

### 修复方案

**文件**：`src/lib/api/validate.ts`（4 处）、`src/lib/contracts/charts.ts`（1 处），另 `src/lib/api/validate.test.ts:67`（正则）

- 逐点将 mojibake 串替换回正确的简体中文，语义保持不变（均为用户可见的校验失败提示）。
- 为什么只改这 5 处：commit message 明确限定范围为"会作为 `error.message` 返回给 API 调用方"的字符串；复验确认全库已无残留（见下）。

### 新增测试

**`src/lib/api/validate.test.ts`**（由 3 例增至 5 例）：

| 测试名 | 断言要点 |
|---|---|
| `返回可读的中文错误信息（防乱码回归）`（`:70`） | `message` 含 `legacy`；匹配 `/[\u4e00-\u9fff]/`（含中文）；不含 `\uFFFD`（替换字符）；**不匹配 `/[\u9400-\u9fff]/u`**（GBK 误读 UTF-8 的典型码位区间） |
| `请求体非法时返回可读错误而非乱码`（`:86`） | 传 `{ nonsense: true }`，断言 `message` 不含 `\uFFFD` 且非空 |

同时修正既有用例 `:67` 的正则为 `/legacy|模板/`。

### 验证证据

```
$ npx vitest run src/lib/api/validate.test.ts
 ✓ src/lib/api/validate.test.ts (5 tests) 56ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
EXITCODE=0
```

全库残留扫描（精确匹配本次修复的乱码串，排除替换字符）：

```
$ grep -rE "鐩樻|璇锋眰|鐢熷嚭|鍛界洏|缂哄皯|妯℃澘|鐨剅ession|鏈嶅姟绔|浣撴棤鏁" src/   → No matches found
$ grep -r $'\uFFFD' .                                                            → No matches found
```

即修复后**两处均无残留**，无 U+FFFD 替换字符。

### 回滚方式

```
git revert 1e20b04
```

---

## P0-04 根布局读会话导致全站动态渲染（24 页失去静态预渲染）

### 问题复述

根布局 `await getServerSession()`（内部调用 `cookies()`）使全部页面退化为按请求 SSR，纯静态页（首页、隐私政策等）也无法被 CDN 缓存。

### 根因（精确定位）

修复前 `src/app/layout.tsx`：

```
$ git show 146f075^:src/app/layout.tsx | Select-String -Pattern "getServerSession|await"
import { getServerSession } from "@/lib/auth/get-session";
  const session = await getServerSession();
```

`getServerSession()` 内部经 `cookies()` 读运行时 API；`RootLayout` 是整棵路由树的祖先，其动态化会向上传染到**每一个**页面。commit message 记录的修复前实测：build 输出 49 条路由**全部为 `ƒ (Dynamic)`**，`prerender-manifest` 仅 2 条，业务静态页为 0。

### 修复方案

**文件：`src/app/layout.tsx`**（commit `146f075`）

- `RootLayout` 改回**同步**函数（当前 `layout.tsx:29`），删除 `await getServerSession()`，改为渲染 `<HeaderSlot />`（`layout.tsx:43`）。
- 新增注释（`layout.tsx:22-27`）明确警告：切勿在此处直接调用 `cookies()` / `getServerSession()`。

**文件：`src/components/auth/HeaderSlot.tsx`**（新增，commit `146f075`）

- `HeaderContent()` 为 async，内部 `await getServerSession()` 并渲染 `<AuthModeSync>` + `<SiteHeader>`。
- 导出 `HeaderSlot()` 用 `<Suspense fallback={<HeaderFallback />}>` 包裹之；`HeaderFallback` 保持与 `SiteHeader` 一致的高度与粘性定位，避免流式补入时布局跳动。
- 注释明确警示**不可**用 `<Suspense fallback={null}>` 包住整个 `<body>`——那会让整个应用推迟到请求时渲染，与目标相反。

**文件：`next.config.ts:90`**（commit `146f075`）

新增 `cacheComponents: true`。注释（`next.config.ts:82-88`）说明其依据：在无此开关的旧模型下，**仅加 `<Suspense>` 不足以产出静态外壳**，App Router 必须开启该开关才会把"不使用运行时 API 的部分"预渲染为静态 shell，其余流式补入。

**消除预渲染期非确定性来源**（同 commit）：

- 8 个 `useParams` 客户端页补 `<Suspense>` 边界；`/account`（`src/app/account/page.tsx:13,53`）与 `/auth/login` 的会话 / `searchParams` 移入 Suspense 岛；3 个 `share/[token]` 页的快照读取移入 Suspense 岛。
- `src/components/form/BirthWizard.tsx` 与 `src/components/liuyao/CastForm.tsx`：`new Date()` 改用 `useSyncExternalStore`（`BirthWizard.tsx:161`），使预渲染期取固定值、水合后取真实值，避免水合不匹配。
- `src/components/chart/LiunianStrip.tsx`：删除 `?? new Date().getFullYear()` 回落（改为 `const hy = highlightYear;`），`highlightYear` 变为必传，避免静态外壳中出现非确定内容。

### 新增测试

**本项 P0 无新增单元测试**（`146f075` 的 `--stat` 中无 `.test.ts` 文件）。其验证手段是 **build 产物指标**（静态路由数、prerender-manifest 条数、路由类型标记），属集成层证据，无法由 vitest 单测覆盖。

> 说明：这是本项修复的证据强度短板——目前**没有自动化门禁**锁住"静态路由数 ≥ N"这一指标，回归只能靠人工比对 build 输出。建议后续补一条解析 `.next/prerender-manifest.json` 的构建后置断言。

### 验证证据

```
$ npm run build
 ✓ Compiled successfully in 7.0s
 ✓ Generating static pages using 11 workers (46/46) in 1811ms
BUILD_EXIT=0

路由统计（解析 build 输出的 Route (app) 表）：
Partial=25  Dynamic=23  Static=1   Total=49

prerender-manifest routes: 17
--- HTML shells ---
26
```

对照修复前（commit message 记录，**未由我复现**，故标注为**未验证**）：静态路由 2、HTML 外壳 1。

修复后 `prerender-manifest.json` 的 17 条路由（真实枚举）：

```
/
/_global-error
/_not-found
/account
/api/reading/status
/auth/callback
/auth/login
/chart/new
/charts
/favicon.ico
/liuyao
/liuyao/new
/people
/privacy
/settings
/ziwei
/ziwei/new
```

**静态路由数 = 17**，达到任务预期的 ≥17。同时 49 条路由中已无 `ƒ (Dynamic)` 的业务页面——23 条 Dynamic 全部为 `/api/*` 路由（Route Handler 本就应动态），25 条业务页面均为 `◐ (Partial Prerender)`。

### 回滚方式

```
git revert 146f075
```

注意：`HeaderSlot.tsx` 为该 commit 新增文件，revert 会一并删除；回滚后 `layout.tsx` 将恢复为 `await getServerSession()` 的动态形态，全站静态化收益同时消失。

---

## P0-05 六爻云端 store 驱动判定与其他三术数不一致 → 数据分裂

### 问题复述

`cloud-liuyao-store.ts` 的 `isPostgresDriver()` 多一个 `&& isDatabaseConfigured()`，与另外三个 store 不一致，会导致同一部署下三术数数据分裂到 Postgres 与 JSON 两个介质。

### 根因（精确定位）

```
$ git show 69bba86^:src/lib/storage/cloud-liuyao-store.ts | Select-String -Pattern "isPostgresDriver" -Context 0,2
> function isPostgresDriver(): boolean {
    return getCloudStoreDriver() === "postgres" && isDatabaseConfigured();
```

对照另三处（`cloud-store.ts:30`、`cloud-ziwei-store.ts:27`、`cloud-person-store.ts:19`）在修复前即已是：

```
    return getCloudStoreDriver() === "postgres";
```

后果：当 `CLOUD_STORE_DRIVER=postgres` 但 `isDatabaseConfigured()` 瞬时为假时，六爻走 JSON 文件而八字/紫微/人物走 Postgres，导出、删号、迁移会读到混合状态。

### 修复方案

**文件：`src/lib/storage/cloud-liuyao-store.ts`**（commit `69bba86`）

- `isPostgresDriver()`（当前 `cloud-liuyao-store.ts:67-69`，返回语句在 `:68`）改为与另三个 store 一致：

```
67: function isPostgresDriver(): boolean {
68:   return getCloudStoreDriver() === "postgres";
69: }
```

- 同步移除已不再使用的 `isDatabaseConfigured` 导入（`import { ensureSchema, getSql } from "@/lib/db";`）。
- 新增注释（`cloud-liuyao-store.ts:57-65`）说明**该二次判断本身冗余**：`driver.ts` 在 `CLOUD_STORE_DRIVER=postgres` 且无 `DATABASE_URL` 时已 fail-fast 抛错，故驱动层已保证 `postgres ⇒ 数据库可用`。

**为什么这样改**：四个 store 的驱动判定必须**同源**，否则同一部署下的介质选择会随调用点而异。以驱动层作为唯一事实来源（single source of truth），而非在消费侧重复判断。

### 新增测试

**本项 P0 无新增测试**（`69bba86` 仅新增了 `client.test.ts` 的 4 例，均针对 P0-06）。

> 说明：这是本项修复的证据短板——"四个 store 判定一致"目前**没有断言守护**。虽然 `npx tsc --noEmit` 会因移除未使用的 `isDatabaseConfigured` 导入而保证类型层清洁，但若将来有人给其中一个 store 重新加回二次判断，不会被任何测试捕获。建议后续补一条"四份 `isPostgresDriver` 实现文本一致"的元测试。

### 验证证据

四份实现的一致性核查（当前工作区实测）：

```
src\lib\storage\cloud-store.ts:30: function isPostgresDriver(): boolean {  ||  return getCloudStoreDriver() === "postgres";
src\lib\storage\cloud-ziwei-store.ts:27: function isPostgresDriver(): boolean {  ||  return getCloudStoreDriver() === "postgres";
src\lib\storage\cloud-person-store.ts:19: function isPostgresDriver(): boolean {  ||  return getCloudStoreDriver() === "postgres";
src\lib\storage\cloud-liuyao-store.ts:67: function isPostgresDriver(): boolean {  ||  return getCloudStoreDriver() === "postgres";
```

四者现已完全一致。类型门禁 `npx tsc --noEmit` → `EXITCODE=0`（证明移除的导入确无残留引用）。

### 回滚方式

```
git revert 69bba86
```

注意：该 commit 同时包含 P0-06 的修复，revert 会一并回滚 LLM 超时保护。

---

## P0-06 LLM 请求无超时 → 上游挂起永久占用连接

### 问题复述

`chatCompletion` 直接 `await fetch(...)`，无 `signal` / 超时，上游挂起时请求会永久占用连接与函数实例。

### 根因（精确定位）

```
$ git show 69bba86^:src/lib/reading/llm/client.ts | Select-String -Pattern "await fetch|signal"
    const res = await fetch(`${baseURL.replace(/\/+$/, "")}/chat/completions`, {
```

`await fetch(...)` 无第二参数的 `signal`；且 commit message 记录**全库无任何 `AbortSignal` 使用**（修复后全库仅 7 处命中，全部位于 `client.ts` 与该测试文件内——见下）。

### 修复方案

**文件：`src/lib/reading/llm/client.ts`**（commit `69bba86`）

- 新增 `getLlmTimeoutMs()`（`client.ts:58-64`）：读 `LLM_TIMEOUT_MS`，缺省 `60_000`；非有限数或 `<= 0` 一律回落 60s。
- 在 `chatCompletion` 内取 `timeoutMs`，并在 fetch 时传入（`client.ts:114`）：

```
      signal: AbortSignal.timeout(timeoutMs),
```

- 新增错误码 `"LLM_TIMEOUT"` 至 `LlmChatErrorCode` 联合类型（`client.ts:34`）。
- `catch` 分支区分超时（`client.ts:183-187`）：`AbortSignal.timeout()` 触发时抛 `DOMException` 且 `name === "TimeoutError"`（部分运行时为 `AbortError`），据此归为 `LLM_TIMEOUT`，否则仍为 `LLM_NETWORK`；日志中追加 `timeoutMs` 字段，并抛出对应短码（`client.ts:202`）。
- `llmErrorCode()` 增加 `LLM_TIMEOUT` 分支（`client.ts:213`）。

**为什么这样改**

- 用 `AbortSignal.timeout()` 而非手写 `AbortController` + `setTimeout`：前者由运行时管理定时器，无需手工 `clearTimeout`，避免泄漏。
- 超时值走环境变量且做**健壮性回落**：`LLM_TIMEOUT_MS` 被设为非法值时不应退化为"无超时"（那正是本 P0 的缺陷形态），故一律回落 60s。
- 新增独立错误码而非复用 `LLM_NETWORK`：便于在日志与监控中区分"上游不可达"与"上游挂起"，前者通常瞬时重试即可，后者需排查上游健康度。

### 新增测试

**`src/lib/reading/llm/client.test.ts`**（由 5 例增至 7 例，commit `69bba86` 新增 3 例 + 既有用例扩展 1 处断言）

| 测试名 | 断言要点 |
|---|---|
| `上游挂起时按超时中断并归类为 LLM_TIMEOUT`（`:119`） | 以 `vi.stubGlobal("fetch", …)` 模拟**黑洞上游**（仅在该请求携带 `signal` 时才 reject，否则永不 settle——若不传 signal，测试将超时失败）；设 `LLM_TIMEOUT_MS=50`；断言 `chatCompletion` rejects 匹配 `/LLM_TIMEOUT/`；并解析捕获的 `console.error` JSON 行，断言 `errorCode === "LLM_TIMEOUT"`、`fallback === true` |
| `必须向上游传入 AbortSignal（无 signal 则视为回归）`（`:176`） | 捕获 fetch 的 `init.signal`，断言 `capturedSignal` 是 `AbortSignal` 实例 |
| `getLlmTimeoutMs 对非法值回落默认 60s`（`:200`） | 未设置 → `60_000`；`"abc"` → `60_000`；`"-5"` → `60_000`；`"1500"` → `1500` |
| 既有用例扩展 | `llmErrorCode(new Error("LLM_TIMEOUT"))` → `"LLM_TIMEOUT"` |

**`src/lib/__verify__/v1-adversarial.test.ts`**（未跟踪）：`攻击：超时值必须被强制为正有限数，不可被环境变量绕过`（`:195`）遍历 `"0"`/`"-1"`/`"abc"`/`""`/`"Infinity"`/`"NaN"` 断言全回落 `60000`；`:218` 断言未设置时必须回落 60s（而非无超时）。

### 验证证据

```
$ npx vitest run src/lib/reading/llm/client.test.ts
stdout | … > 必须向上游传入 AbortSignal（无 signal 则视为回归）
{"ts":"2026-09-18T18:13:05.208Z","level":"info","event":"llm.chat.ok","requestId":"llm-local","route":"llm.chat","art":"bazi","model":"m","durationMs":0,"fallback":false,…}

 ✓ src/lib/reading/llm/client.test.ts (7 tests) 83ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
EXITCODE=0
```

全库 `AbortSignal` 使用核查（证明修复后引入了信号，且未过度扩散）：

```
src\lib\reading\llm\client.ts:71,72,114,183
src\lib\reading\llm\client.test.ts:132,176,199
共 7 处，无其他文件使用
```

### 回滚方式

```
git revert 69bba86
```

注意：该 commit 同时包含 P0-05 的修复，revert 会一并回滚驱动判定统一。

---

# 汇总

## P0 修复汇总表

| ID | commit | 涉及文件数 | 新增测试数 | 状态 |
|---|---|---|---|---|
| P0-01 AUTH_SECRET 强度 | `8911b5e`（另有 **+56 行未提交**） | 3（`validate-prod.ts`、`validate-prod-env.mjs`、`validate-prod.test.ts`） | 11（+ 复验 6） | ⚠️ **部分修复**：commit 版存在逃逸值 `abcdefghijklmnopqrstuvwxyz012345`，靠未提交改动补齐 |
| P0-02 分享存储生产校验 | `8911b5e` | 3（同上，同一 commit） | 6 | ✅ 已修复 |
| P0-03 API 错误文案乱码 | `1e20b04` | 3（`validate.ts`、`charts.ts`、`validate.test.ts`） | 2（+ 修正 1 处既有正则） | ✅ 已修复 |
| P0-04 全站动态渲染 | `146f075` | 19（1 新增组件 + 18 改动） | 0 | ✅ 已修复（静态路由 2 → 17） |
| P0-05 六爻驱动判定不一致 | `69bba86` | 1（`cloud-liuyao-store.ts`） | 0 | ✅ 已修复 |
| P0-06 LLM 请求超时 | `69bba86` | 2（`client.ts`、`client.test.ts`） | 3 | ✅ 已修复 |
| **合计** | 4 个 commit | **31 个文件变更** | **22 例**（已提交） | — |

> 「新增测试数」按新增的 `it(...)` 计。P0-01/P0-02 的 11 + 6 = 17 例位于 `validate-prod.test.ts` 新增的两个 describe 块；表中 P0-01 记 11、P0-02 记 6，合计与该文件 12→27 的增量一致。`v1-adversarial.test.ts` 的 6 例（P0-01 五项 + P0-02 一项，另含 P0-03/P0-06 用例）为**未跟踪的复验产物**，不计入已提交测试数。

## 门禁复验

以下四项均由我在当前工作区（HEAD `6c40d1a` + 未提交改动）亲手执行，退出码为真实值：

| # | 命令 | 退出码 | 关键输出 |
|---|---|---|---|
| 1 | `npm run lint -- --max-warnings=0` | **0** | `> eslint --max-warnings=0`，无输出（零 warning、零 error） |
| 2 | `npx tsc --noEmit` | **0** | 无输出（零类型错误） |
| 3 | `npm test` | **0** | `Test Files 75 passed (75)` / `Tests 624 passed (624)`，`Duration 11.59s` |
| 4 | `npm run build` | **0** | `✓ Compiled successfully in 7.0s`；`✓ Generating static pages using 11 workers (46/46) in 1811ms` |

**build 静态路由数：17**（≥17 达标）。取自 `.next/prerender-manifest.json` 的 17 条路由，与 build 输出表中 25 条 `◐ (Partial Prerender)` + 1 条 `○ (Static)` 的分类一致；49 条路由中 23 条 `ƒ (Dynamic)` 全部为 `/api/*` Route Handler。

门禁补充说明：

- `npm test` 首次运行时**曾以 exit=1 失败**（1 failed / 623 passed），失败项为 `v1-adversarial.test.ts` 的 P0-01 攻击 4。该失败由工作区的未提交改动修复；其后连续 5 次全量运行均为 624/624、exit=0。详见 P0-01 节。
- 三项 P0 单测文件的合并实测：`npx vitest run src/lib/config/validate-prod.test.ts src/lib/api/validate.test.ts src/lib/reading/llm/client.test.ts` → `Test Files 3 passed`、`Tests 39 passed (39)`、`EXIT=0`。

## 遗留风险

按 P0 逐项列出修复后仍存在的残余风险。凡涉及未实际演练的场景，均标注 **未验证**。

### P0-01（AUTH_SECRET 强度）

1. **已提交版本的逃逸值仍可直达账号接管**（最高优先级）。`8911b5e` 的判定会放行 `abcdefghijklmnopqrstuvwxyz012345` 这类"长度与字符类达标、但含长连续序列"的值。该缺陷**只在工作区的未提交改动中修复**。若不提交，则任何读到 `8911b5e` 的部署都可被此值攻破。
2. **熵校验仍是启发式，非真实熵下界**。`hasRepeatedBlock()` 只检查"整串由某片段完整重复"，`longestConsecutiveRun() >= 6` 只覆盖步长恒为 ±1 的 ASCII 连续段。像 `a1b2c3d4e5f6...`（步长交替）、键盘行走 `qwertyuiop...`（`qwerty…` 恰好命中词根故被拒，但 `asdfghjkl;` 一类不命中）、或长度 32 的英文单词拼接，仍可能通过。Shannon 熵阈值 3.0 bit/char 对 32 字符的**唯一字符种类少但分布均匀**的构造也可能不够。
3. **未对 AUTH_SECRET 做密钥轮换支持**。文档未提及轮换流程；若密钥被判定弱而需更换，所有已签发会话会立即失效（`verifySessionToken` 无多密钥并验），可能造成全量用户被登出。
4. **字典与词根是静态列表**（`validate-prod.ts:41-56`、`72-90`）。其覆盖度**未验证**；未做与公开泄露口令字典（如 HaveIBeenPwned k-anonymity API）的比对。
5. **校验仅覆盖 `AUTH_SECRET`**。生产还有 `UPSTASH_REDIS_REST_TOKEN`、`LLM_API_KEY`、`DATABASE_URL` 中的口令等敏感项，本次未纳入强度校验。

### P0-02（分享存储）

1. **校验只强制 driver 取值，不验证 upstash 真实可用性**。`isFileShareStoreForbiddenInProd()` 仅比对字符串；`SHARE_STORE_DRIVER=upstash` 配了错误的 URL/Token 时，`createShareStore()`（`share/index.ts:53-59`）只检查**非空**，不做连通性探测——服务能启动，但分享写入会在运行期失败。
2. **本地文件存储的代码路径仍然保留**（`local-file.ts` 未删）。非生产环境（`NODE_ENV !== "production"`）仍会走无锁的 read-modify-write；多实例 **staging 环境**（若 `NODE_ENV=production` 未设）仍会静默丢数据。
3. **`SHARE_TTL_SECONDS` 未纳入生产校验**。若生产未设，分享链接永不过期；结合隐私政策（`src/content/privacy.ts:58`「删除账号不一定自动清除已发出的分享链接」），已发出的分享快照会成为长期孤儿数据。
4. **`LocalFileShareStore` 的并发缺陷本身未修**——本次是"在生产禁用"而非"修好锁"。若将来放开非生产多实例，问题原样存在。
5. **两套校验器的同步靠人工维护**。`validate-prod.ts` 与 `scripts/validate-prod-env.mjs` 是**逻辑复刻**而非共享代码，存在漂移风险；无测试断言二者行为一致（**未验证**是否存在此类元测试，从 `validate-prod.test.ts` 内容看没有）。

### P0-03（错误文案）

1. **测试断言的是"不含典型 mojibake 码位"，而非"文案正确"**。`not.toMatch(/[\u9400-\u9fff]/u)` 只能捕获 GBK 误读 UTF-8 的**常见**产物；若乱码落在该码位区间之外，或为其他编码错误（如 UTF-16 误读），测试不会报警。
2. **防乱码门禁只覆盖 `validate.ts` 的 2 处文案**。另外 3 处（`validate.ts:69,80`、`charts.ts:152`）**未验证**有等价断言守护。
3. **无仓库级编码门禁**。缺少 `.gitattributes` 的 `working-tree-encoding` / 编辑器配置约束，也没有 CI 步骤扫描全库非法字符——同类问题可再次引入。本次修复后全库扫描无残留（已实测），但这是**一次性核查**，非持续保障。
4. **`error.message` 的脱敏边界**。`validate.ts:80` 在 catch 中直接透传 `error.message`；后续 commit `488b1c6`（`fix(security): API 错误信息不再直出内部异常`）另行收口，该收口**不属于本轮 P0 范围**，其充分性未在本次复验中验证。

### P0-04（静态预渲染）

1. **无自动化门禁锁住静态路由数**。本项 0 新增测试；"静态路由 ≥17"仅靠人工比对 build 输出。任何后续改动（如有人重新在布局里读 `cookies()`）都会静默回退到全站动态，**不会被 CI 拦截**。
2. **`cacheComponents: true` 的全局影响未充分验证**。该开关把 PPR 变为 App Router 默认行为，改变所有页面的渲染模型。我确认了构建通过、路由分类正确，但**运行时行为（流式补入时序、缓存语义、`export const dynamic` 等旧指令的交互）未做端到端验证**。
3. **`HeaderSlot` 的 Suspense 引入头部流式补入**。`HeaderFallback` 虽已对齐高度以减少跳动，但**在慢会话读取下的实际视觉表现未验证**（无 e2e / 视觉回归测试）。
4. **`useSyncExternalStore` 的 `getServerSnapshot` 返回 `""`**（`BirthWizard.tsx:161`、`CastForm.tsx:85`）。预渲染期该字段为空串，若某处逻辑依赖其非空，可能产生瞬时不一致；**未验证**下游对空串的处理是否完备。
5. **`LiunianStrip.highlightYear` 改为必传**是**破坏性变更**。类型层面由 `tsc` 保证所有调用点已更新，但该组件的**外部消费者（若作为库导出）未验证**。
6. **`/api/reading/status` 被标为 `○ (Static)`**。该路由出现在 prerender-manifest 中，若其响应内容依赖运行时状态（如 LLM 是否配置），静态化可能导致状态过期；**未验证**其语义是否允许静态。

### P0-05（驱动判定）

1. **无测试守护四份实现的一致性**。本项 0 新增测试；将来任一处重新加入二次判断不会被捕获。
2. **`isDatabaseConfigured()` 的瞬时为假仍可能导致运行期异常而非降级**。修复后六爻与其他三术数行为一致（都走 Postgres），但若数据库在运行期不可用，四个 store 会**同时失败**——这消除了数据分裂，却也让故障从"部分降级"变为"全部不可用"。这是正确的取舍（避免静默数据分裂），但**可用性影响未验证**（无故障注入测试）。
3. **既有数据的分裂残留未处理**。本次只统一了**判定逻辑**，未提供迁移脚本把历史上已分裂到 JSON 文件的六爻数据合并回 Postgres。存量分裂数据可能仍留在 `data/cloud-liuyao.json`（**未验证**实际是否存在此类文件及内容）。

### P0-06（LLM 超时）

1. **超时值无上限校验**。`getLlmTimeoutMs()` 只要求"正有限数"，`LLM_TIMEOUT_MS=1e10`（约 317 年）会被接受——复验用例 `v1-adversarial.test.ts:203` 明确把该情形记为"极大但对 `Number.isFinite` 成立，仍为正数（上游会拒绝而非静默无超时）"，即**已知不设上限**。误配置可导致超时保护实际失效。
2. **仅覆盖 fetch 阶段，不覆盖整体调用预算**。`AbortSignal.timeout()` 约束的是单次 HTTP 请求；若读取响应体（`res.json()`）之后仍有慢处理，或调用方做重试，总时长仍可能超出预期。上游 `LLMTIMEOUT` 的**总时长**无端到端预算。
3. **60s 默认值未经生产验证**。对长文本解读（八章报告）是否足够**未验证**；若上游常在 40–60s 返回，会频繁触发 `LLM_TIMEOUT` 并回落模板，影响体验。
4. **超时后无重试与熔断**。一次超时即回落规则模板（`fallback: true`），无退避重试，也无针对上游持续挂起的熔断——上游长时间不可用时会持续消耗 60s 连接资源，只是不再永久占用。
5. **`LLM_TIMEOUT` 未接入监控/告警**。日志字段已就位（`client.ts:196` 的 `timeoutMs`），但**未验证**是否有任何 dashboard、告警规则或 SLO 消费该错误码。
6. **`err.name` 判定的运行时差异**。`AbortSignal.timeout()` 在不同运行时可能抛 `TimeoutError` 或 `AbortError`，代码两者皆判（`client.ts:184-186`）；Node 24 下的行为已由测试覆盖（实测通过），但**边缘运行时（如 edge）未验证**。

### 跨项风险

1. **工作区有未提交改动**（`validate-prod.ts` +56 行、`validate-prod-env.mjs` +44 行）与**未跟踪文件**（`src/lib/__verify__/`）。本文档的门禁数字基于该状态；若这些改动被丢弃或改写，P0-01 结论与门禁结果都会变化。**建议先提交或明确处置这些改动，再引用本报告。**
2. **工作区存在并行活动的痕迹**。复验期间观察到：`docs/PROJECT_REVIEW.md` 的未提交修改在复验中途消失（被并行会话提交，HEAD 仍为 `6c40d1a`），同时出现新的未跟踪文件 `docs/REVIEW_VERIFICATION.md`（写于本报告前约 1 分钟，由并行会话产出，**非本报告作者所写**）。本报告的门禁四项是在这些并行写入发生**之后**、对当时工作区重新执行得到的，但**未验证**并行会话是否还会继续改动 P0 相关源文件；引用本报告前建议先 `git status` 与 `git log` 复核。
