# Changelog

本文件记录面向用户和运维的重要变化。应用版本和三术数引擎版本分别记录。

## [Unreleased]

### Added

- 项目审查结论、整改任务卡和执行指南。
- GitHub Issue/PR 模板、CODEOWNERS、CI 和 Dependabot 配置。
- Docker/Compose 部署准备文件和 liveness 接口。

### Changed

- 八字：历法边界策略、按位十神计量、分层用神、RuleEvidence 证据体系。
- 紫微：严格虚岁修正、流派 policy 命名空间、未知时辰多候选。
- 六爻：起卦方法分离标识、六神/月破/回头生克/伏神/用神类别。
- 解读：LLM 结构化 JSON + Zod Schema 校验、引擎证据透传、校准机制重构。
- 产品：专业模式 TrustPanel、Disclaimer 加强。

### Security

- Magic Link 原子消费（PG `UPDATE...RETURNING`）、生产禁泄漏 `devLink`。
- 账号删除强制确认 + 15min reauth + 失败不伪成功。
- API 全量 Zod 契约、`server-only` 隔离、Origin 校验、Body 统一限制。
- 限流扩展至 auth/account 桶。
- 生产配置启动 fail-fast（`instrumentation.ts` + `check:prod-env` 脚本）。
- Upstash Redis 缺凭证 fail-fast 禁止静默回落。

### DevOps

- `npm run db:migrate` 幂等迁移命令、`/api/health/ready` readiness 端点。
- nginx/Caddy 反向代理样例、Postgres 备份 PowerShell 脚本。
- DEPLOY.md 健康检查/备份恢复/回滚步骤完善、QA 冒烟清单更新。

## [0.1.0] - 2026-07-21

### Added

- 八字、紫微、六爻基础产品链路。
- 模板与可选 LLM 解读。
- 本地/云端档案、账号、分享和导出。
