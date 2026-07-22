"use client";

import { useState, useCallback } from "react";
import type { CalibratePrompt } from "@/lib/types";
import type { CalibrateAnswer, CalibrationData } from "@/lib/reading/calibrate";
import { Card } from "@/components/ui";
import { CalibrateQuestion } from "./CalibrateQuestion";

type Props = {
  prompts: CalibratePrompt[];
  chartId: string;
  initialAnswers?: CalibrateAnswer[];
  onCalibrated?: (data: CalibrationData) => void;
};

export function CalibrateBox({
  prompts,
  chartId,
  initialAnswers,
  onCalibrated,
}: Props) {
  const [answers, setAnswers] = useState<CalibrateAnswer[]>(
    () => initialAnswers ?? [],
  );

  const handleChange = useCallback(
    (answer: CalibrateAnswer) => {
      setAnswers((prev) => {
        const idx = prev.findIndex((a) => a.promptIndex === answer.promptIndex);
        const next =
          idx >= 0
            ? prev.map((a, i) => (i === idx ? answer : a))
            : [...prev, answer];

        const data: CalibrationData = { chartId, answers: next };
        onCalibrated?.(data);
        return next;
      });
    },
    [chartId, onCalibrated],
  );

  const answeredCount = answers.filter((a) => a.accuracy != null).length;

  return (
    <Card
      title="经历反馈"
      subtitle={
        answeredCount > 0
          ? `已反馈 ${answeredCount}/${prompts.length} 题`
          : "请回忆以下时段是否与命盘叙述相符；反馈只调整阅读文案侧重，不重算排盘、不改核心规则"
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-muted leading-relaxed border border-border/40 rounded-lg p-3 bg-surface/40">
          反馈不会提高或降低命盘「准确率」，也不会改写四柱/大运/用神规则。敏感备注默认仅保存在本机，不会发送给外部模型。
        </p>
        {prompts.map((p, i) => (
          <CalibrateQuestion
            key={i}
            prompt={p}
            index={i}
            value={answers.find((a) => a.promptIndex === i)}
            onChange={handleChange}
          />
        ))}
      </div>
    </Card>
  );
}
