import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { CloverMark } from "@/components/mood-bean";
import { Button } from "@/components/ui/button";
import { usePlayground } from "@/lib/store";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function GameShell({ title, subtitle, extra, children, className }: Props) {
  const clovers = usePlayground((s) => s.clovers);

  return (
    <div className={cn("flex min-h-dvh flex-col bg-background text-foreground", className)}>
      <header className="flex items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Button variant="ghost" size="icon" className="shrink-0" asChild>
          <Link to="/" aria-label="놀이터로">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="inline-flex h-10 items-center gap-1 rounded-full bg-card px-3 text-sm font-medium tabular-nums shadow-soft">
          <CloverMark className="text-primary" />
          {clovers}
        </div>
        {extra}
      </header>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
}
