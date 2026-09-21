import type { ReactNode } from "react";
import { cn } from "cn";
import { Separator } from "@/components/ui/separator";

export type PanelProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

/** A single panel of the design system sheet. */
export function Panel({ title, children, className }: PanelProps) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-bg-primary p-6 shadow-sm",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <h2 className="text-caption font-semibold uppercase tracking-[0.12em] text-text-primary">
          {title}
        </h2>
        <Separator className="bg-divider" />
      </div>
      {children}
    </section>
  );
}

export type SubheadProps = {
  children: ReactNode;
  className?: string;
};

/** Small uppercase group label used inside panels. */
export function Subhead({ children, className }: SubheadProps) {
  return (
    <h3
      className={cn(
        "text-caption font-medium uppercase tracking-[0.1em] text-text-secondary",
        className
      )}
    >
      {children}
    </h3>
  );
}
