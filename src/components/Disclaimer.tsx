import { DISCLAIMER } from "@/content/zh";

type Props = {
  text?: string;
  className?: string;
};

export function Disclaimer({ text, className }: Props) {
  return (
    <p className={["text-sm text-muted leading-relaxed", className].filter(Boolean).join(" ")}>
      {text ?? DISCLAIMER}
    </p>
  );
}
