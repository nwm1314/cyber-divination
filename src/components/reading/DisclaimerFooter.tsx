import { DISCLAIMER } from "@/content/zh";

type Props = {
  text?: string;
};

export function DisclaimerFooter({ text }: Props) {
  return (
    <footer className="border-t border-border/40 pt-8 pb-4 space-y-2">
      <p className="text-xs text-muted/50 leading-relaxed text-center max-w-xl mx-auto">
        {text ?? DISCLAIMER}
      </p>
      <p className="text-[11px] text-muted/40 leading-relaxed text-center max-w-xl mx-auto">
        关键限制：不提供医疗/投资/法律决策；边界与警告在通俗模式下同样可见；经历反馈仅调整文案侧重。
      </p>
    </footer>
  );
}
