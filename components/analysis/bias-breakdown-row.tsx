import { cn } from "cn";
import type { SourceBias } from "@/lib/demo/article-detail";

export type BiasBreakdownRowProps = {
  label: "Left" | "Center" | "Right";
  /** The figure beside the label, e.g. "20%" or "2 (20%)". */
  value: string;
  /** 0 to 100; clamped here so a bad value can never render a broken bar. */
  percent: number;
  tone: SourceBias;
};

/**
 * The centre fill is deliberately not `bg-bias-center` - that token is also the
 * track colour, so the centre bar would disappear against it.
 */
const fillByTone: Record<SourceBias, string> = {
  left: "bg-bias-left",
  center: "bg-text-secondary/30",
  right: "bg-bias-right",
};

export function BiasBreakdownRow({
  label,
  value,
  percent,
  tone,
}: BiasBreakdownRowProps) {
  const width = Math.min(100, Math.max(0, percent));

  return (
    <div className="flex items-center gap-3">
      <span className="text-body-sm w-14 shrink-0 text-text-primary">
        {label}
      </span>
      <span className="text-body-sm w-16 shrink-0 text-text-secondary">
        {value}
      </span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-bias-center">
        <span
          style={{ width: `${width}%` }}
          className={cn("block h-full rounded-full", fillByTone[tone])}
        />
      </span>
    </div>
  );
}
