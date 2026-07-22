# 八字 Golden Fixtures

- 用例定义：`index.ts`（`goldenCases`）
- 断言：`golden.test.ts`
- 来源与版本：见 `docs/research/bazi-sources.md`

每条 case 的 `input` 经 `makeProfile` 补全后调用 `computeChart`。  
`expect.extra` 可含 flags、tenGod_*、dayun*、wuxingScores、liunianYears 等 diff 断言字段。

规则变更导致失败时：更新期望并记录 `ruleSetVersion` 差异说明，勿静默跳过。
