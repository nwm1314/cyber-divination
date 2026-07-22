# 飞星飞宫（T190）

> 实现：`tables/feixing.ts`、`feixing.ts`。**禁止 LLM 补全。**

## 1. 范围（学习向 v1）

- **十二宫各以宫干** 查四化表（与生年干表同源 `SIHUA_BY_YEAR_STEM`）。
- 四化目标星落在哪宫，即该宫干「飞入」该宫；边写入 `FeixingFlight`。
- 目标星 `sihua` 叠标记：`{源宫名}·化{禄|权|科|忌}`。
- 源宫=目标宫 → `self: true`（与 T181「自化X」并存，语义双轨可对照）。
- **不**替换三合主星安法；`meta.school` 仍 `sanhe`；`flags` 含 `feixing_palace_flights`。

## 2. 运限叠盘（T200/T201）

- 大限宫干 / 流年干飞出：见 `daxian-liunian.md` §2.1；**不**写回本命星。
- API：`sihuaFlightsFromStem`。

## 3. 仍不实现

- 流月流日飞星、飞星派改安星、迭化多轮。

## 4. 版本

本命飞宫 **0.5.0**；运限叠盘 **0.6.0**。
