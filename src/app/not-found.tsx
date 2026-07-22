import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col cyber-grid min-h-dvh items-center justify-center safe-pad">
      <div className="max-w-md text-center space-y-4">
        <p className="text-xs tracking-widest text-cyan">404</p>
        <h1 className="text-xl font-bold text-gold">页面未找到</h1>
        <p className="text-sm text-muted leading-relaxed">
          链接可能已失效，或该分享快照不存在。请从首页重新排盘，或检查分享链接是否完整。
        </p>
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <Link href="/">
            <Button>返回首页</Button>
          </Link>
          <Link href="/chart/new">
            <Button variant="secondary">开始排盘</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
