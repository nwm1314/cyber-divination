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
      {/*
        行长约束（P1）：解读正文是散文，桌面端容器为 max-w-6xl（1152px），
        14px 中文每行可达约 82 字，远超 40 字推荐上限，导致横向扫视疲劳。
        这里给正文单独限宽（约 38 个中文字宽），而**不**收窄页面容器，
        因为表格/雷达图等可视化仍需要宽度。
      */}
      <div className="text-sm leading-relaxed whitespace-pre-wrap max-w-[38rem]">
        {section.body}
      </div>
      {section.citations && section.citations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/40 max-w-[38rem]">
          <p className="text-[11px] text-muted/90">
            引用：{section.citations.join(" · ")}
          </p>
        </div>
      )}
    </Card>
  );
}
