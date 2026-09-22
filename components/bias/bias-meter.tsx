import { cn } from "cn";
import { normalizeBiasPercentages, type BiasPercentages } from "@/lib/bias";

export type BiasMeterProps = BiasPercentages & {
  /** "full" adds the 0% / 50% / 100% scale row beneath the bar. */
  variant?: "full" | "compact";
  /** Overrides the variant's default scale row without changing bar height or labels. */
  showScale?: boolean;
  className?: string;
};

type Segment = {
  key: keyof BiasPercentages;
  label: string;
  value: number;
  className: string;
};

/**
 * biasly Design System v1.0 - Bias meter.
 * A single bar split into Left / Center / Right segments sized by percentage.
 */
export function BiasMeter({
  left,
  center,
  right,
  variant = "full",
  showScale,
  className,
}: BiasMeterProps) {
  const pct = normalizeBiasPercentages({ left, center, right });

  const isFull = variant === "full";
  const withScale = showScale ?? isFull;

  const segments: Segment[] = [
    {
      key: "left",
      // The compact bar is only ~370px wide in the feed grid, so a narrow left
      // segment cannot fit the full word. Visual only - the aria-label below
      // still spells all three out.
      label: `${isFull ? "Left" : "L"} ${pct.left}%`,
      value: pct.left,
      className: "bg-bias-left text-bias-foreground",
    },
    {
      key: "center",
      label: `Center ${pct.center}%`,
      value: pct.center,
      className: "bg-bias-center text-text-primary",
    },
    {
      key: "right",
      label: `Right ${pct.right}%`,
      value: pct.right,
      className: "bg-bias-right text-bias-foreground",
    },
  ];

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "flex w-full overflow-hidden rounded-sm",
          isFull ? "h-8" : "h-[22px]"
        )}
        role="img"
        aria-label={`AI-estimated political framing: left ${pct.left}%, center ${pct.center}%, right ${pct.right}%`}
      >
        {segments.map((segment) =>
          segment.value === 0 ? null : (
            <div
              key={segment.key}
              style={{ width: `${segment.value}%` }}
              className={cn(
                "flex min-w-0 items-center justify-center overflow-hidden",
                isFull ? "px-2" : "px-0.5",
                segment.className
              )}
            >
              <span className="truncate text-caption font-medium">
                {segment.label}
              </span>
            </div>
          )
        )}
      </div>

      {withScale ? (
        <div className="mt-2 flex items-center justify-between text-caption text-text-secondary">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      ) : null}
    </div>
  );
}
