# 应期 / 空亡（T180）

> 实现：`analyze/kongwang.ts`、`analyze/yingqi.ts`。学习向简表，**禁止恐吓断语**。

## 1. 前置

- 盘面需 `castAt`（占时）；时间起卦可用 `datetime` 兼作占时。
- 日柱 / 月支：复用 `bazi/calendar/solar.computeRawPillars`（节气月、夜子时日柱）。

## 2. 旬空

甲子旬空戌亥，甲戌旬空申酉，甲申旬空午未，甲午旬空辰巳，甲辰旬空寅卯，甲寅旬空子丑。

对照爻 `branch` / 用神支 → `yongShenKong`。

## 3. 应期提示

- `yingQiHint`：中性节奏说明（出空/填实、动爻落空偏缓等）。
- 无占时：明确提示未算日辰，不编造。

## 4. 版本

`LIUYAO_ENGINE_VERSION` → **0.4.0**。
