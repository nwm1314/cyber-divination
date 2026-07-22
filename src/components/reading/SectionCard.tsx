import { Card } from "@/components/ui";

type Props = {
  /** 兼容八字 / 紫微 / 六爻等章节结构 */
  section: {
    title: string;
    body: string;
    citations?: string[];
  };
  index?: number;
};

export function SectionCard({ section, index }: Props) {
  return (
    <Card title={`${index != null ? `${index}. ` : ""}${section.title}`} glow="gold">
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {section.body}
      </div>
      {section.citations && section.citations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/40">
          <p className="text-[11px] text-muted/60">
            引用：{section.citations.join(" · ")}
          </p>
        </div>
      )}
    </Card>
  );
}
