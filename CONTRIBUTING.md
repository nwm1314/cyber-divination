# 贡献指南

## 开始之前

1. 阅读 `AGENTS.md`。本项目使用 Next.js 16.2.10，写代码前必须阅读 `node_modules/next/dist/docs/` 中对应指南。
2. 阅读 `docs/PROJECT_REVIEW.md`、`docs/REMEDIATION_TASKS.md` 和 `docs/EXECUTION_GUIDE.md`。
3. 不要在 Issue、PR、fixture 或日志中提交真实邮箱、生辰、命盘、问卦正文、Token 或密钥。

## 本地检查

```bash
npm ci
npm run lint -- --max-warnings=8
npm test
npm run build
```

当前 warning 基线为 8，只允许减少、不允许增加。完成清理任务后将门禁改为 0。

## 分支与提交

- 默认分支：`main`；
- 分支：`codex/t<任务号>-<主题>`；
- 一个 PR 原则上对应一张任务卡；
- Commit 建议使用 `feat:`、`fix:`、`test:`、`docs:`、`chore:`。

## 命理规则变更

规则变更 PR 必须包含：

- 流派和规则 ID；
- 采用的资料版本；
- 修改前后的计算差异；
- 新增金标准；
- 是否升级 `engineVersion`/`ruleSetVersion`；
- 对已保存盘和报告的兼容策略。

不得以“网上普遍如此”或 LLM 回答作为唯一规则来源。

## 安全和后端变更

认证、授权、数据库、分享、日志、限流和 Docker 变更必须说明威胁模型、失败行为、配置策略、迁移与回滚。

## PR 验收

使用仓库 PR 模板，所有 CI 通过并取得 CODEOWNERS 审查后才可合并。
