# P2 修复报告 · 赛博命理

> 结论口径：本报告所有"实测"数字均由本文档作者在本机亲跑命令得到，命令与输出见各节及 §6。
> 凡无法核实者一律标注 **未验证**。所有代码引用带 `文件:行号`。

- 仓库：`E:\ai_project\cyber-divination`
- 核查基线：`HEAD = 6c40d1a0b96a3a53bc78f6964e59c7ea61778e49`（`git rev-parse HEAD`）
- 运行时：Node `v24.15.0` / npm `11.12.1` / Next.js `16.2.10 (Turbopack)`
- 覆盖 commit：`fd46c4e`（token/对比度）、`ac0153c`（静默失败/Button/文案）、`63f0e20`（术语统一/CTA）

---

## 0. 修复项总览

| ID | 问题 | 状态 |
|---|---|---|
| P2-01 | 死 token 清理 | 已修复 ✅ |
| P2-02 | 阴影 token 化 | **部分修复 ⚠️ 见 §2** |
| P2-03 | `shadow-[0_0_8px]` 非法 CSS | 已修复 ✅ |
| P2-04 | 雲端导出静默失败 | 已修复 ✅ |
| P2-05 | 云端同步静默失败 | 已修复 ✅ |
| P2-06 | `Button` 新增 `loading` prop | 已修复 ✅（已在 `charts/page.tsx:253` 启用；其余页面待迁移，见 §5.6） |
| P2-07 | 首页硬编码中文迁入 `zh.ts` | 已修复 ✅ |
| P2-08 | 三术数档案页术语统一 | **部分修复 ⚠️ 见 §5.8** |
| P2-09 | 解读失败态补 CTA | 已修复 ✅ |

---

## 1. Token 变更对照表

数据来源：`git show fd46c4e -- src/app/globals.css` 与构建产物 `.next/static/chunks/36epm5m8sbj2k.css`（60095 字节，UTF-8 读入）。

### 1.1 新增 token

| token 名 | 变更前 | 变更后 | 影响文件数 | 视觉是否等效 |
|---|---|---|---|---|
| `--shadow-glow-gold-sm` | 不存在（`.shadow-[0_0_8px_var(--gold-glow)]` 内联） | `0 0 8px var(--gold-glow)` | 1（`StarBadge.tsx:5`） | **等效 ✅** |
| `--shadow-glow-gold` | 不存在（`.shadow-[0_0_16px_var(--gold-glow)]` 内联） | `0 0 16px var(--gold-glow)` | 3（`page.tsx:47`、`DayunTimeline.tsx:53`、`CastForm.tsx:224`） | **等效 ✅** |
| `--shadow-glow-gold-inset` | 不存在（`.shadow-[inset_0_0_8px_var(--gold-glow)]` 内联） | `inset 0 0 8px var(--gold-glow)` | 2（`ViewToggle.tsx:31`、`ReportHeader.tsx:113`） | **等效 ✅** |
| `--shadow-glow-cyan-sm` | 不存在（`.shadow-[0_0_10px_var(--cyan-glow)]` 内联） | `0 0 10px var(--cyan-glow)` | 1（`YaoLine.tsx:84,93`） | **等效 ✅** |
| `--shadow-glow-cyan` | 不存在（`.shadow-[0_0_16px_var(--cyan-glow)]` 内联） | `0 0 16px var(--cyan-glow)` | 1（`Button.tsx:26`） | **等效 ✅** |

### 1.2 等效性核实方法（任务明确要求）

不能只看源码文本相等——Tailwind v4 对**任意值语法**和**主题 token 语法**走不同代码路径，必须比对**生成的 CSS**。我实测比对结果：

**新增 token 生成的规则**（构建产物）：

```css
.shadow-glow-gold-sm{--tw-shadow:0 0 8px var(--tw-shadow-color,var(--gold-glow));box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}
.shadow-glow-gold-inset{--tw-shadow:inset 0 0 8px var(--tw-shadow-color,var(--gold-glow));box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}
.shadow-glow-gold{--tw-shadow:0 0 16px var(--tw-shadow-color,var(--gold-glow));box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}
.shadow-glow-cyan-sm{--tw-shadow:0 0 10px var(--tw-shadow-color,var(--cyan-glow));box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}
.shadow-glow-cyan{--tw-shadow:0 0 16px var(--tw-shadow-color,var(--cyan-glow));box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}
```

**仍保留的任意值语法规则**（同文件，作为对照）：

```css
.shadow-\[0_0_20px_var\(--gold-glow\)\]{--tw-shadow:0 0 20px var(--tw-shadow-color,var(--gold-glow));box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}
.shadow-\[0_0_8px_currentColor\]{--tw-shadow:0 0 8px var(--tw-shadow-color,currentColor);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}
.shadow-\[0_0_32px_var\(--gold-glow\)\]{--tw-shadow:0 0 32px var(--tw-shadow-color,var(--gold-glow));box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}
```

**逐字符比对结论**：

- 两者的 `box-shadow` 收尾链**完全一致**：`var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)`；
- 两者的 `--tw-shadow` 值**除 `var(--tw-shadow-color,` 这一层包裹外逐字符一致**。任意值语法写作 `0 0 16px var(--tw-shadow-color,var(--gold-glow))`，token 语法写作 `0 0 16px var(--tw-shadow-color,var(--gold-glow))` —— **同一形式**（Tailwind v4 对任意值中的 `var(--xx)` 也会自动注入 `--tw-shadow-color` 兜底，见上面对照规则的实测输出）。

**因此：视觉零变化成立 ✅**，且因为 `--tw-shadow-color` 兜底一致，**使用 `shadow-gold/50` 之类的颜色修饰符行为也不变**。

### 1.3 删除的 token

| token 名 | 变更前 | 变更后 | 影响文件数 | 核实方式 |
|---|---|---|---|---|
| `--cyan-dim` | `#1a9e94` | 删除 | 0 | 全仓 `cyan-dim` 命中 1 处，**仅 `globals.css:50` 的说明注释** |
| `--color-cyan-dim` | `var(--cyan-dim)` | 删除 | 0 | 同上（`@theme inline` 内已移除） |
| `--font-display` | `"PingFang SC", "Microsoft YaHei", system-ui, sans-serif` | 删除 | 0 | 全仓 `font-display` 命中 1 处，**仅 `globals.css:36` 的说明注释**；与 `--font-body`（`globals.css:37`）值逐字符相同 |
| `--shadow-glow-gold-lg` | **从未定义** | — | 见 §2 | **重点问题** |

> 三个死 token 删除后有**零个真实引用**，仅有解释性注释保留，核实通过 ✅。

---

## 2. ⚠️ P2-02 阴影 token 化：一处未定义的 token 造成视觉回归

这是本次核查**发现的真实缺陷**，必须在报告中显式记录。

### 2.1 事实

`fd46c4e` 把首页术数卡片的悬停光晕改写为 token（`git show fd46c4e` 逐行确认）：

```diff
-          className="!p-4 h-full border-gold/20 group-hover:border-gold/45 group-hover:shadow-[0_0_24px_var(--gold-glow)] transition-all"
+          className="!p-4 h-full border-gold/20 group-hover:border-gold/45 group-hover:shadow-glow-gold-lg transition-all"
```

当前位置：`src/app/page.tsx:63`。

**但 `--shadow-glow-gold-lg` 从未被定义**：

| 检查项 | 结果 |
|---|---|
| `src/` 下 `glow-gold-lg` 引用 | **1 处** — 仅 `src/app/page.tsx:63` 的使用点 |
| `globals.css` 中 `--shadow-glow-gold-lg` 声明 | **不存在** |
| 构建产物中 `.shadow-glow-gold-lg{` 规则 | **不存在（False）** |
| 构建产物中 `--shadow-glow-gold-lg:` 声明 | **不存在（False）** |

`globals.css:70-74` 实际只定义了 5 个 token：`-gold-sm` / `-gold` / `-gold-inset` / `-cyan-sm` / `-cyan`。**没有 `-gold-lg`**。

对照实测（同一次扫描）：

```
shadow-glow-gold-lg      classRule=False   ← 未定义
shadow-glow-gold-sm      classRule=True
shadow-glow-gold-inset   classRule=True
shadow-glow-cyan-sm      classRule=True
shadow-glow-cyan         classRule=True
shadow-glow-gold         classRule=True
```

### 2.2 影响

- **修复前**：首页卡片悬停有 `0 0 24px var(--gold-glow)` 金色光晕；
- **修复后**：`group-hover:shadow-glow-gold-lg` 是**未定义 utility**，Tailwind 不生成任何规则，**悬停光晕完全消失**；
- `fd46c4e` 的 commit message 称"已核对生成 CSS，每个 token 的 box-shadow 值与替换前的内联写法逐字符一致（视觉零变化）"——**该断言对其他 4 个 token 成立（我已在 §1.2 复核），但对 `-gold-lg` 不成立**。

### 2.3 建议

二选一：

- **补齐**：在 `globals.css:70-74` 增加 `--shadow-glow-gold-lg: 0 0 24px var(--gold-glow);`（恢复原 24px 视觉）；
- **回退**：把 `src/app/page.tsx:63` 改回 `group-hover:shadow-[0_0_24px_var(--gold-glow)]`。

> **未验证**：未在浏览器中肉眼比对悬停效果（需运行 dev server 与真实交互）；结论基于"类名无对应 CSS 规则 ⇒ 无生效样式"这一 CSS 层面的事实推导，以及构建产物的字节级扫描。

---

## 3. P2-03 `shadow-[0_0_8px]` 非法 CSS 修复

**问题**：`src/components/chart/WuxingBars.tsx` 原写法 `shadow-[0_0_8px]` 缺少颜色值，是无效 CSS，五行柱的"旺"态高亮不生效。

**修复**：改为 `shadow-[0_0_8px_currentColor]`，使光晕跟随该五行自身配色。

- 修复位置：`src/components/chart/WuxingBars.tsx:80`（修复后，实测读到 `isDominant ? "shadow-[0_0_8px_currentColor]" : ""`）

**量化对比（构建产物实测）**：

| 写法 | 生成规则 | `--tw-shadow` 值 | 有效 |
|---|---|---|---|
| `shadow-[0_0_8px]`（前） | `.shadow-\[0_0_8px\]{...}` | `0 0 8px var(--tw-shadow-color,currentcolor)` | **否**（无颜色源，`currentcolor` 兜底但语义不明） |
| `shadow-[0_0_8px_currentColor]`（后） | `.shadow-\[0_0_8px_currentColor\]{...}` | `0 0 8px var(--tw-shadow-color,currentColor)` | **是 ✅** |

两条规则的 `--tw-shadow` 在**小写化后完全相同**（`currentcolor` vs `currentColor`），说明 Tailwind 对裸 `shadow-[0_0_8px]` 也做了 `currentcolor` 兜底。因此**最终渲染等效**，改动的价值在于**语义显式化 + 消除构建期非法 CSS 警告来源**，而非改变视觉效果。

> **诚实说明**：这意味着 `WuxingBars` 这一处**并非"不生效"**，而是"隐式依赖兜底"。commit message 称其为"无效 CSS"——从 CSS 语法看该声明确实语法不全，但 Tailwind 的 `currentcolor` 兜底使其实际生效。两种表述都对，但**"修复了不生效的光晕"是不准确的**。

---

## 4. 对比度修正前后数值表

方法：WCAG 2.1 相对亮度公式，`L = 0.2126·R + 0.7152·G + 0.0722·B`（每通道先做 sRGB 反 gamma），`contrast = (L_max + 0.05) / (L_min + 0.05)`。语义色叠加背景按 `composited = round(fg×α + bg×(1-α))` 计算。**由本报告作者独立复算**，未引用 commit message。

背景 `--background: #07080c`（`globals.css:4`），前景 `--muted: #8b8680`（`globals.css:6`）。

### 4.1 `text-muted/NN` 系列（P2 主体）

| 组合 | 合成后 RGB | 修正前比值 | 修正后比值 | 是否达标（AA 4.5:1） |
|---|---|---|---|---|
| `text-muted/40` | `rgb(60,58,58)` | **1.77** | 提升为 `/90` → **4.65** | 修正后 ✅ |
| `text-muted/50` | `rgb(73,71,70)` | **2.17** | 提升为 `/90` → **4.65** | 修正后 ✅ |
| `text-muted/60` | `rgb(86,84,82)` | **2.66** | 提升为 `/90` → **4.65** | 修正后 ✅ |
| `text-muted/70` | `rgb(99,96,93)` | **3.20** | 提升为 `/90` → **4.65** | 修正后 ✅ |
| `text-muted/80` | `rgb(113,109,105)` | **3.90** | 提升为 `/90` → **4.65** | 修正后 ✅ |
| `text-muted/90`（新基线） | `rgb(126,121,116)` | — | **4.65** | ✅ |
| `text-muted/100` | `rgb(139,134,128)` | **5.55** | 5.55（未动） | ✅ |

**关键结论**：α ≤ 0.80 的**全部 5 档均不达 AA**，α = 0.90 是**最小可通过值**（4.65 ≥ 4.5）。这就是统一收敛到 `/90` 的依据。

### 4.2 其他 token（未改动，作为基线记录）

| token | 值 | 对比度 vs `#07080c` | 是否达标 |
|---|---|---|---|
| `--foreground` | `#e8e6e0` | **16.04** | ✅ |
| `--muted`（不透明） | `#8b8680` | **5.55** | ✅ |
| `--gold` | `#d4a84b` | **9.06** | ✅ |
| `--cyan` | `#2ee6d6` | **12.78** | ✅ |
| `--danger` | `#e85d5d` | **5.87** | ✅ |
| `--border` | `#2a2e3a` | **1.48** | ❌ 有意保留，见 §5 |

### 4.3 修正覆盖度（实测）

| 指标 | 修复前 | 修复后 |
|---|---|---|
| `text-muted/NN`（NN≤80）命中数 | 26 处（commit 口径） | **0** ✅ |
| `text-muted/90` 命中数 | 0 | **22** |
| 其他 `muted/NN` 变体 | — | **无**（仅 `/90`） |

> **口径差异说明**：commit 称修改 26 处，当前实测 `/90` 现存 22 处。差异源于 `fd46c4e` 之后 `ac0153c` 对 `src/app/page.tsx`、`src/app/liuyao/page.tsx` 的进一步改写（新增/移动了部分行）。"改动 26 处"与"现存 22 处"是两个口径，均成立；**26 这一数字本身未被本报告独立复现**。

---

## 5. 逐项详情

### 5.1 / 5.2 / 5.3 见 §1、§2、§3

### 5.4 P2-04 云端导出静默失败

**问题复述**：`buildAccountExport` 用空 `catch` 吞掉云端导出异常，失败时返回 `cloud: []`，用户会误以为「云端没有数据」。删除路径早已明确禁止伪成功，导出路径标准不一致。

**根因**：`src/lib/auth/account.ts` 中 `exportCloudDataForUser` 调用处为：

```ts
} catch {
  // 钩子失败不阻断账号字段导出
}
```

**修复方案**（`git show ac0153c -- src/lib/auth/account.ts` 确认）：

- 新增可选字段 `cloudExportError?: string`（带完整说明注释）；
- `catch (err)` 捕获后填充固定中文文案：`"云端数据导出失败，本次结果仅含账号字段。请稍后重试，或联系支持。"`；
- 原始错误经 `console.error(JSON.stringify({...}))` **只进服务端日志**，字段名 `account.export.cloud_failed`；
- 返回体条件展开：`...(cloudExportError ? { cloudExportError } : {})`。

**量化对比**：

| 指标 | 修复前 | 修复后 |
|---|---|---|
| 空 `catch {}` 吞异常 | 1 | **0**（改为 `catch (err)`） |
| 失败时返回给前端的失败信号字段 | 0 | **1（`cloudExportError`）** |
| 失败时服务端日志事件 | 0 | **1（`account.export.cloud_failed`）** |
| 原始错误泄露到响应体 | 无（但也没信号） | **无** ✅ |

**验证证据**：`git show ac0153c -- src/lib/auth/account.ts` 输出中可见 `-  } catch {` → `+  } catch (err) {` 与 `+    cloudExportError =` 及 `+    ...(cloudExportError ? { cloudExportError } : {}),`。

---

### 5.5 P2-05 云端同步静默失败

**问题复述**：`src/app/liuyao/page.tsx` 的推送/拉取云端使用空 `catch` + `// ignore` 完全忽略异常，用户点击按钮失败时界面毫无反馈。

**修复方案**（`git show ac0153c -- src/app/liuyao/page.tsx` 确认）：

- 新增 `const [syncMsg, setSyncMsg] = useState<string | null>(null);`；
- 操作前 `setSyncMsg(null)` 清空；
- 成功分支读取返回值并给出条数反馈：`已从云端拉取 ${r.pulled} 条`（含失败条数）/ `已推送 ${r.pushed} 条到云端`；
- 失败分支给出可操作提示：`拉取云端失败，请确认已登录后重试` / `推送云端失败，请确认已登录后重试`；
- 渲染层补 `role="status" aria-live="polite"`。

**量化对比**：

| 指标 | 修复前 | 修复后 |
|---|---|---|
| `// ignore` 静默吞异常点 | 2 | **0** ✅ |
| 同步结果状态变量 | 0 | **1（`syncMsg`）** |
| 失败时的用户可见文案 | **0** | **2**（推送/拉取各一） |
| 成功时的条数反馈 | **0** | **2** |
| 屏幕阅读器播报（`aria-live`） | 0 | **1** ✅ |

当前落点：`src/app/liuyao/page.tsx:138-139`（`role="status"` + `aria-live="polite"`）。

---

### 5.6 P2-06 `Button` 新增 `loading` prop

**问题复述**：全项目多处按钮是「busy 时 disabled」，但无任何加载指示，用户不知道操作是否在进行中。

**修复方案**（`src/components/ui/Button.tsx`）：

- `ButtonProps` 新增 `loading?: boolean`（`:16`）与 `loadingText?: string`（`:18`）；
- `disabled={disabled || loading}`（`:53`）；
- `aria-busy={loading || undefined}`（`:54`）；
- `loading` 时渲染 spinner（`w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin`，`aria-hidden`，`:67-70`）+ 文案 `loadingText ?? children`（`:71`）。

**量化对比**：

| 指标 | 修复前 | 修复后 |
|---|---|---|
| `Button` 加载态 prop | 0 | **2（`loading` / `loadingText`）** |
| `aria-busy` 全站出现处 | 1（`BirthWizard`、`ZiweiWizard` 手工实现） | **3** |

**实测调用点**（全仓 `loading={` 扫描）：

| 位置 | 代码 | 来源 |
|---|---|---|
| `src/app/charts/page.tsx:253` | `loading={syncBusy}` | `ac0153c` 新增（`git show` 确认） |

其余 3 个 `*Loading=` 命中（`LiuyaoShareSheet.tsx:106`、`ShareSheet.tsx:97`、`ZiweiShareSheet.tsx:143`）是 `shareLoading={shareLoading}`，属分享组件的**同名字段传递**，不是 `Button` 的 `loading` prop，不计入。

**结论**：commit message 所称"已在 charts 页同步按钮上启用"**属实 ✅**。

> **勘误记录**：本报告初稿曾误判为"零调用点"。原因是首次核查时 grep 模式过窄，漏掉了 `charts/page.tsx:253`。经复核（`Select-String -Pattern 'loading=\{'` + `git show ac0153c -- src/app/charts/page.tsx` 双向确认）后更正。`charts/page.tsx:249-257` 同时保留 `disabled={syncBusy}` 与 `loading={syncBusy}`，两者叠加无副作用（`Button.tsx:53` 内部已是 `disabled || loading`），属冗余但无害。

**仍存在的改进空间**：`AccountPanel` 的导出/删除、`liuyao/page.tsx` 的推送/拉取等按钮仍沿用旧的 `disabled={busy}` 写法，未迁移。建议后续统一。

---

### 5.7 P2-07 首页硬编码中文迁入 `src/content/zh.ts`

**修复方案**：

- `zh.ts` 新增 `A11Y` 常量（`:82-89`：`skipToContent` / `mainNavLabel` / `loading` / `saving` / `syncing` / `deleting`）；
- `zh.ts` 新增 `MESSAGES` 常量（`:92-101`：`saveFailed` / `saveFailedRetry` / `rateLimited` / `cloudFailed` / `notFoundChart` / `readingFailed` / `disclaimerTitle` / `disclaimerSubtitle`）；
- `HOME` 补充 `available` / `peopleLink` / `privacyLink` / `accountLink`（`:73-78`）；
- 首页改为引用 content 常量（commit 称 8 处）；
- 6 处 API 错误文案改为引用 `MESSAGES`。

**量化对比**：

| 指标 | 修复前 | 修复后 |
|---|---|---|
| `src/app/page.tsx` 中直接含中文的行 | 8（commit 口径） | **0** ✅ |

**验证证据**（实测逐行扫描 `src/app/page.tsx`，匹配 `[\u4e00-\u9fff]`）：

```
=== P2-07: home page hardcoded Chinese remaining ===
（无输出）
```

即 `src/app/page.tsx` 当前**不含任何中文字符**，全部经 content 引用 ✅。

`src/content/zh.ts` 当前共 116 行，导出 `DISCLAIMER` / `BRAND` / `ARTS` / `HOME` / `A11Y` / `MESSAGES` / `ARCHIVES` 七组常量。

**MESSAGES 复用证据**（`grep` 实测）：

```
src\app\api\charts\route.ts:114         MESSAGES.saveFailedRetry,
src\app\api\liuyao-charts\route.ts:95   MESSAGES.saveFailedRetry,
src\app\api\ziwei-charts\route.ts:96    MESSAGES.saveFailedRetry,
src\app\api\people\route.ts:89          toSafeErrorMessage(   ← 兜底文案在同处
src\lib\api\rate-limit.ts:322           message: MESSAGES.rateLimited,
```

---

### 5.8 P2-08 三术数档案页术语统一 ⚠️ 部分完成

**问题复述**：三术数同类档案页标题互不相同——「我的档案」/「紫微命盘」/「问卦历史」，用户难以建立一致心智。

**修复方案**：新增 `ARCHIVES` 常量（`zh.ts:110-116`）：

```ts
export const ARCHIVES = {
  baziTitle: "八字档案",
  ziweiTitle: "紫微档案",
  liuyaoTitle: "六爻档案",
  backToArchives: "返回档案",
} as const;
```

**量化对比**：

| 页面 | 修复前标题 | 修复后标题 | 是否用 `ARCHIVES` 常量 |
|---|---|---|---|
| 紫微档案页 | 「紫微命盘」 | 「紫微档案」 | **是** ✅（`src/app/ziwei/page.tsx:108`） |
| 六爻档案页 | 「问卦历史」 | 「六爻档案」 | **是** ✅（`src/app/liuyao/page.tsx:116`） |
| 八字档案页 | 「我的档案」 | 「八字档案」 | **否** ⚠️ |

**⚠️ 实测发现**：`ARCHIVES` 常量的落点**只有 2 处**（实测全仓 `ARCHIVES\.` 命中）：

```
src\app\liuyao\page.tsx:116: {ARCHIVES.liuyaoTitle}
src\app\ziwei\page.tsx:108:  {ARCHIVES.ziweiTitle}
```

而 `src/app/charts/page.tsx:185` **仍硬编码**「我的档案」，`:296` 硬编码「八字档案」。即：

- `ARCHIVES.baziTitle`（`zh.ts:111`）**已定义但零引用**；
- `ARCHIVES.backToArchives`（`zh.ts:115`）**已定义但零引用**；
- 「三术数标题统一」目标**完成度 2/3**。

**建议**：把 `src/app/charts/page.tsx:185` 与 `:296` 改为引用 `ARCHIVES.baziTitle`；并决定 `backToArchives` 是接入还是删除（当前是新增的第二个死 token——与 P2-01「清理死 token」的目标取向矛盾）。

---

### 5.9 P2-09 解读失败态补 CTA

**问题复述**：解读失败时只显示一行裸文本，没有恢复路径。

**修复方案**（`git show 63f0e20 -- src/app/chart/[id]/reading/page.tsx` 确认）：

```diff
-      <div className="flex flex-1 flex-col cyber-grid min-h-dvh items-center justify-center">
-        <p className="text-danger">{error ?? "模板渲染失败"}</p>
+      <div className="flex flex-1 flex-col cyber-grid min-h-dvh">
+        <div className="safe-pad flex flex-1 flex-col max-w-lg mx-auto w-full items-center justify-center gap-4 text-center">
+          <h1 className="text-lg font-bold text-gold tracking-wide">解读报告</h1>
+          <p className="text-danger" role="alert" aria-live="assertive">
+            {error ?? "解读生成失败，请稍后重试。"}
+          </p>
+          <div className="flex flex-wrap gap-3 justify-center">
+            <Link href={`/chart/${chartId}`}><Button variant="secondary">返回命盘</Button></Link>
+            <Link href="/charts"><Button variant="ghost">我的档案</Button></Link>
+          </div>
+        </div>
```

**量化对比**：

| 指标 | 修复前 | 修复后 |
|---|---|---|
| 失败态可操作 CTA 数量 | **0** | **2**（返回命盘 / 我的档案） |
| 失败态 `role="alert"` | 0 | **1** ✅ |
| 失败态 `aria-live` | 0 | **1（`assertive`）** ✅ |
| 失败页 `<h1>` | 0 | **1** ✅ |
| 失败态文案 | `模板渲染失败`（实现细节外露） | `解读生成失败，请稍后重试。`（用户语言） |

当前落点：`src/app/chart/[id]/reading/page.tsx:255-264`。

同时解读 loading 态补 `role="status" aria-live="polite"`（该文件 `:240` 附近）。

---

## 6. 门禁复验

以下四项均由本报告作者在本机亲跑，核查基线 `HEAD = 6c40d1a`。

> **并发写入提示**：本次核查期间，仓库有**另一个 agent 并行提交**（在我完成核查后 `HEAD` 前进到 `0093abd`）。已核实 `6c40d1a` 是当前 HEAD 的祖先（`git merge-base --is-ancestor 6c40d1a HEAD` 退出码 0），六个 P1/P2 commit 全部完好。§6.1–6.4 为 **`6c40d1a` 时点**的真实结果；§6.5 为 `0093abd` 时点的复跑结果。

### 6.1 `npm run lint -- --max-warnings=0`

```
> cyber-divination@0.1.0 lint
> eslint --max-warnings=0

LINT_EXIT=0
```

**退出码：0**

### 6.2 `npx tsc --noEmit`

```
===== GATE 2: npx tsc --noEmit =====

TSC_EXIT=0
```

**退出码：0**

### 6.3 `npm test`

```
> cyber-divination@0.1.0 test
> vitest run

 Test Files  74 passed (74)
      Tests  611 passed (611)
   Start at  02:12:44
   Duration  12.98s (transform 9.53s, setup 0ms, collect 42.63s, tests 13.17s, environment 30ms, prepare 25.20s)

TEST_EXIT=0
```

**退出码：0**（74 文件 / 611 测试全通过）

### 6.4 `npm run build`

```
▲ Next.js 16.2.10 (Turbopack)
- Cache Components enabled

  Creating an optimized production build ...
Found 2 warnings while optimizing generated CSS:

Issue #1:
│   .w-\[0_0_通配px_var(--通配-glow)\] {
│     width: 0 0 通配px var(--通配-glow);
┆                          ^-- Unexpected token Delim('*')

Issue #2:
│   .shadow-\[0_0_通配px_var(--通配-glow)\] {
│     --tw-shadow: 0 0 通配px var(--通配-glow);
┆                                ^-- Unexpected token Delim('*')

✓ Compiled successfully in 7.5s
  Running TypeScript ...
  Finished TypeScript in 11.1s ...
✓ Generating static pages using 11 workers (46/46) in 1480ms
  Finalizing page optimization ...

> cyber-divination@0.1.0 postbuild
> node scripts/copy-standalone-assets.mjs

BUILD_EXIT=0
```

**退出码：0**（46/46 静态页生成）

### 6.5 复跑（`HEAD = 0093abd`，并发 agent 提交后）

```
--- lint ---
> eslint --max-warnings=0
LINT_EXIT=0

--- tsc ---
TSC_EXIT=0

--- test ---
 Test Files  76 passed (76)
      Tests  627 passed (627)
   Duration  10.85s
TEST_EXIT=0
```

**退出码：全部 0 ✅**

> 测试数 **611 → 627**（74 → 76 文件）由并发 agent 新增测试文件导致，**与 P2 九项修复无关**。

### 6.6 关于 2 条 CSS 警告的确切根因

`fd46c4e` 的 commit message 称其为"既有问题，经 `git stash` 对照验证与本次改动无关（Tailwind v4 + Turbopack 上游交互）"。**我实测追到了确切来源**：

1. 构建产物 `.next/static/chunks/36epm5m8sbj2k.css` 中确实存在非法规则：
   ```css
   .shadow-\[0_0_通配px_var(--通配-glow)\]{box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}
   ```
2. 全仓搜索该字面量，唯一命中 **`docs/REVIEW_DESIGN_INVENTORY.md`**
   （`:300` 与 `:323`，原文为反引号包裹、方括号内含通配符的阴影任意值类名）。
3. 该文档**未被这 6 个 P1/P2 commit 触及**（`git log -- docs/REVIEW_DESIGN_INVENTORY.md` 仅显示 `8911b5e`）。

**结论**：根因是 **Tailwind v4 静态提取器扫描 `docs/` 下的 Markdown**，把文档里作为**说明文字**的反引号代码片段当成了真实工具类。这确实**不是这 6 个 commit 引入的**，但也不是"上游 Turbopack 交互"——而是**文档内含可被误提取的类名字面量**。

值得注意的是，`globals.css` 的注释已明确意识到同类风险，即**已在该文件内治理，但未治理 `docs/`**，属于治理不彻底。

**建议**：把 `docs/` 中相关文档里的此类类名字面量拆开书写（插入空格或改为行内描述）以避开提取器。

> **后续（第二轮已修复）**：`docs/` 与源码注释中的可被误提取的类名字面量已全部脱敏改写，
> 非法 CSS 规则不再生成，`npx playwright test` 恢复通过。
> 另更正一处：本条称"唯一命中 `docs/REVIEW_DESIGN_INVENTORY.md`"不准确——
> 本轮实测发现 `src/components/chart/WuxingBars.tsx` 的注释抄写了在同一构建日志中
> 出现的解析器报错原文，构成**第二个触发点**。两处均已修复。
> 详见 `docs/FIX_REPORT_ROUND2.md` §11。

> **未验证**：未实际修改该文档验证警告消失（禁止修改本报告之外的文件）。

---

## 7. 有意保留的偏差

### 7.1 `--border` 对比度 1.48:1（低于 WCAG 1.4.11 的 3:1）

**保留决定与理由**已写入代码注释 `src/app/globals.css:9-23`，原文要点：

```
--border 与 --background 的对比度为 1.48:1，低于 WCAG 1.4.11
对"非文本"元素要求的 3:1。

有意保留原值：把 --border 提到 3:1 需要换成约 #5a6076 的中灰，
那会显著改变整体的"低调描边"设计语言（面板/卡片的视觉重量会
明显变重），属于设计层面的改动而非无障碍修正。

缓解措施：所有**承载信息的**边界都有替代的表征——
卡片另有 bg-surface 底色差异、选中态走 gold/cyan 高亮环、
表单控件有 focus-visible outline。即视觉组织不依赖 --border 单独成立。

如需严格达标，可单独引入 --border-strong 用于需要可辨识的边界，
而不动 --border 的装饰用途。
```

**我的独立复核**：

| 项 | 实测值 | 说明 |
|---|---|---|
| `--border` 值 | `#2a2e3a`（`globals.css:24`） | 与注释一致 |
| 对比度 vs `#07080c` | **1.48** | ✅ 我复算得 1.48，与注释数字一致 |
| 注释提议的达标值 `#5a6076` | 复算对比度 **3.02** | ✅ 确实达到 3:1，注释的自洽性成立 |

**评估**：这是一个**有据可查、已文档化的有意偏差**，理由（设计语言成本 vs 无障碍收益）成立，且已给出缓解措施与后续路径（`--border-strong`）。**建议保留决定，但在产品文档中对用户/审计方显式披露该已知偏差。**

### 7.2 其他保留偏差

| 项 | 保留内容 | 依据 |
|---|---|---|
| 单次使用的阴影任意值 | `0 0 20px`（`Button.tsx:24`）、`0 0 32px`（`Card.tsx:20,22`）、`0 0 12px`（`LiunianStrip.tsx:29`）、`inset 0 0 20px`（`PalaceCell.tsx:20`） | `globals.css:63-64` 注释："只下沉出现 >=2 次的规格；单次使用的保留任意值语法，避免过度抽象" |
| `shadow-[...var(--gold-glow)]`（`LiunianStrip.tsx:29`） | 带 `rgba` 兜底 `var(--cyan-glow,rgba(0,255,255,0.2))` | 未在 P2 变更范围内 |
| 4 处页面级 `<main>` 嵌套于根 `<main>` | `chart/new:26`、`liuyao/new:31`、`ziwei/new:30`、`page.tsx:86` | P1-08 引入，本报告 §P1-08 已记录为回归风险 |

---

## 8. 遗留与建议

| 优先级 | 项 | 建议 |
|---|---|---|
| **高** | `--shadow-glow-gold-lg` 未定义致首页悬停光晕消失（§2） | 补 token 或回退内联写法 |
| **中** | `Button.loading` 仅 1 处调用（`charts/page.tsx:253`） | 迁移 AccountPanel / liuyao 的按钮 |
| **中** | `charts/page.tsx` 未用 `ARCHIVES.baziTitle`，术语统一仅 2/3（§5.8） | 接入常量 |
| **中** | `ARCHIVES.baziTitle` / `backToArchives` 零引用，成为新死 token | 接入或删除 |
| **中** | `docs/REVIEW_DESIGN_INVENTORY.md:300,323` 触发 CSS 提取警告 | 拆分类名字面量 |
| 低 | `--border` 1.48:1 已知偏差 | 已在代码注释文档化，建议同步至用户可见文档 |

---

## 9. 复现命令

```powershell
cd E:\ai_project\cyber-divination
git rev-parse HEAD                     # 6c40d1a0b96a3a53bc78f6964e59c7ea61778e49

# 门禁
npm run lint -- --max-warnings=0       # exit 0
npx tsc --noEmit                       # exit 0
npm test                               # exit 0, 74 files / 611 tests
npm run build                          # exit 0, 2 CSS warnings

# 对比度复算
node -e "
function srgb(c){c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
function lum(r,g,b){return 0.2126*srgb(r)+0.7152*srgb(g)+0.0722*srgb(b);}
function hex(h){h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function ratio(a,b){const L1=Math.max(a,b),L2=Math.min(a,b);return (L1+0.05)/(L2+0.05);}
const bgL=lum(...hex('07080c'));
for(const a of [0.4,0.5,0.6,0.7,0.8,0.9,1.0]){
  const f=hex('8b8680'),b=hex('07080c');
  const c=f.map((v,i)=>Math.round(v*a+b[i]*(1-a)));
  console.log(a, ratio(lum(...c),bgL).toFixed(2));
}"

# 阴影 token 等效性（比对生成 CSS）
$c=[System.IO.File]::ReadAllText("$PWD\.next\static\chunks\36epm5m8sbj2k.css",[System.Text.Encoding]::UTF8)
$c.Contains('.shadow-glow-gold-lg{')      # False  ← 未定义 token 的证据
$c.Contains('.shadow-glow-gold{')         # True
$c.Contains('.shadow-\[0_0_8px\]{')       # True

# 死 token / 使用点扫描
Select-String -Path (Get-ChildItem src -Recurse -File -Include *.tsx,*.ts,*.css).FullName -Pattern 'glow-gold-lg'
Select-String -Path (Get-ChildItem src -Recurse -File -Include *.tsx,*.ts).FullName -Pattern 'loading=\{'   # Button 使用点
```

---

*报告生成时间：2026-09-19 · 核查 HEAD：`6c40d1a`*
