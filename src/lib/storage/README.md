# 本地与云端存储（T82 / T107 / T121）

## 本地（未登录 / 默认）

- 入口：`src/lib/storage/index.ts`、`person.ts`、`liuyao.ts`
- 介质：`localStorage` + IndexedDB 后备（`idb.ts`）
- 键前缀：`bd_profile_` / `bd_chart_` / `bd_report_` / `bd_calibrate_` / `bd_list_` / `bd_ziwei_` / `bd_person_` / `bd_liuyao_*`
- **不依赖**登录态；换浏览器数据不会自动带走

## 云端（已登录）

| 域 | 服务端 | 文件 |
|----|--------|------|
| 八字 | `cloud-store.ts` | `data/cloud-charts.json` |
| 紫微 | `cloud-ziwei-store.ts` | `data/cloud-ziwei.json` |
| Person | `cloud-person-store.ts` | `data/cloud-people.json` |

- 浏览器客户端：`cloud-client.ts`；同步：`sync.ts`
- 账号导出/删号：`cloud-hooks.ts`（八字 + 紫微 + Person）

### 同步策略（客户端）

| 场景 | 行为 |
|------|------|
| 未登录 | 只读写本地，不调云端 API |
| 已登录 · 日常排盘 | 仍写本地；可选推送云端 |
| 八字 push/pull | `pushLocalChartsToCloud` / `pullCloudChartsToLocal` |
| 紫微 push/pull | `pushLocalZiweiToCloud` / `pullCloudZiweiToLocal`（`/ziwei` 列表页按钮） |
| 换浏览器 | 登录同一账号 → 拉取 → 本机可见同一档案 |
| 权限 | 无 session → **401**；仅本人 `userId` 分区 |

### 首次合并（T83 · 八字）

- 逻辑：`migrate.ts`；API：`POST /api/charts/migrate`；UI：`/charts` 引导条

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/charts` | 八字列表 / 保存 |
| GET/DELETE | `/api/charts/[id]` | 八字详情 / 删除 |
| POST | `/api/charts/migrate` | 本地→云端合并（T83） |
| GET/POST | `/api/ziwei-charts` | 紫微列表 / 保存（T107） |
| GET/DELETE | `/api/ziwei-charts/[id]` | 紫微详情 / 删除 |
| GET/POST | `/api/people` | Person 列表 / 创建（T121） |
| GET/PUT/DELETE | `/api/people/[id]` | Person 详情 / 更新 / 删除 |

## 权限

- Cookie `cyber_session` 无效或缺失 → **401** `AUTH_REQUIRED`
- 所有读写仅限 `session.userId` 分区；无法通过 body 伪造他人 `userId`
