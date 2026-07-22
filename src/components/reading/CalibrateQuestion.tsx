"use client";

import { useState } from "react";
import type { CalibratePrompt } from "@/lib/types";
import type { CalibrateAnswer, CalibrateAccuracy } from "@/lib/reading/calibrate";

type Props = {
  prompt: CalibratePrompt;
  index: number;
  value?: CalibrateAnswer;
  onChange: (answer: CalibrateAnswer) => void;
};

const OPTIONS: { key: CalibrateAccuracy; label: string; color: string }[] = [
  { key: "accurate", label: "准确", color: "text-green-400 border-green-400/50 hover:bg-green-400/10" },
  { key: "partial", label: "部分准确", color: "text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10" },
  { key: "inaccurate", label: "不准", color: "text-red-400 border-red-400/50 hover:bg-red-400/10" },
];

export function CalibrateQuestion({ prompt, index, value, onChange }: Props) {
  const [draftNote, setDraftNote] = useState(value?.note ?? "");

  return (
    <div className="rounded-lg bg-surface/50 border border-border/50 p-4 space-y-3">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xs font-semibold text-gold">时段 {index + 1}</span>
        <span className="text-xs text-muted">{prompt.ageRange}</span>
      </div>
      {prompt.yearHint && (
        <p className="text-xs text-muted/60">对应年份：{prompt.yearHint}</p>
      )}
      <p className="text-sm leading-relaxed">{prompt.nature}</p>

      <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="校准准确度">
        {OPTIONS.map((opt) => {
          const selected = value?.accuracy === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                onChange({
                  promptIndex: index,
                  accuracy: opt.key,
                  note: draftNote || value?.note,
                })
              }
              className={[
                "px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                selected
                  ? `${opt.color} bg-opacity-20`
                  : "text-muted border-border/40 hover:border-border",
                selected ? "ring-1" : "",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <textarea
        placeholder="可选备注（默认仅本机，不外发模型；请先选择吻合度）"
        rows={2}
        value={value?.note ?? draftNote}
        onChange={(e) => {
          const note = e.target.value;
          setDraftNote(note);
          if (value?.accuracy) {
            onChange({
              promptIndex: index,
              accuracy: value.accuracy,
              note,
              shareNoteExternally: value.shareNoteExternally,
            });
          }
        }}
        className="w-full text-xs bg-surface/80 border border-border/50 rounded-lg p-2 resize-none text-foreground placeholder:text-muted/40 focus:outline-none focus:border-cyan/50"
      />
      {value?.accuracy && (value.note || draftNote) ? (
        <label className="flex items-start gap-2 text-[11px] text-muted cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={Boolean(value.shareNoteExternally)}
            onChange={(e) =>
              onChange({
                promptIndex: index,
                accuracy: value.accuracy,
                note: value.note ?? draftNote,
                shareNoteExternally: e.target.checked,
              })
            }
          />
          <span>允许在本产品摘要中展示此备注（默认不发送外部模型）</span>
        </label>
      ) : null}
    </div>
  );
}
