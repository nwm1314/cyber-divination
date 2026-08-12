# TASK-014 冷启动文件系统调查记录

## 结论

本次工作区无法提供稳定、可重复的开发服务器 cold/warm 对照：第一次
`next dev` 启动后，首次 `/api/health` 请求约 2.25 秒，但连续请求期间服务进程
退出，5 次 warm 样本中只有首个请求成功；第二次启动与进程回收实验直接返回
Windows `PermissionDenied`。这不足以证明应用代码或生产配置存在性能回归，当前
不修改 `next.config.ts`、文件系统策略或生产参数。

## 环境与方法

| 项目 | 值 |
|---|---|
| OS / shell | Windows PowerShell，工作区 `E:\ai_project\cyber-divination` |
| Node / Next | 项目锁定 Next.js 16.2.10；Node 版本由本机 npm 运行时提供 |
| 目标 | `http://127.0.0.1:<port>/api/health` |
| 冷启动方法 | `npm run dev -- --hostname 127.0.0.1 --port <port>` 后轮询健康接口，记录首个成功响应 |
| warm 方法 | 同一进程连续请求 5 次，记录每次耗时与错误 |

## 观测

1. 端口 3197：开发服务首次成功响应后，单次测量约 `2245.6 ms`；随后 5 次
   总耗时约 `10238.3 ms`，期间出现“无法连接到远程服务器”，说明服务生命周期
   已不稳定，不能把总耗时当作应用 warm latency。
2. 端口 3198：启动/回收实验被 Windows 返回 `PermissionDenied`，未取得有效样本。
3. 进程回收也受到权限/父子进程关系影响；已针对实验产生的明确 PID 做清理，未使用
   广泛进程终止命令。

## 判定与后续

- 当前证据只能说明本机工作区上的 `next dev` 冷编译和进程控制实验不稳定，不能区分
  文件系统、Next 编译、依赖扫描还是应用代码贡献。
- 不以一次本机测量调整生产配置；优先在本地 SSD、网络/同步盘和 CI runner 上用同一
  Node/依赖锁定版本分别采集 cold、warm、生产 `next start` 三组样本。
- 若后续能稳定复现，记录编译日志、首次请求、连续 warm 请求和 `next start` 对照后
  再创建针对性优化卡；在此之前保持 no-action。

## 验证

- 相关代码未修改；该记录不引入运行时行为变化。
- 完整 lint / test / build 由主 Agent 在所有并行任务合并后统一执行。
