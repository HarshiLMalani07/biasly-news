import { Plus } from "lucide-react";
import { cn } from "cn";

export type ChipProps = {
  label: string;
  className?: string;
};

/**
 * biasly Design System v1.0 - Chip / Category.
 * Pill with a trailing "+" affordance. Presentational only.
 */
export function Chip({ label, className }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full border border-border bg-surface px-3 text-text-primary",
        className
      )}
    >
      <span className="text-body-sm">{label}</span>
      <Plus size={14} strokeWidth={2} aria-hidden />
    </span>
  );
}
