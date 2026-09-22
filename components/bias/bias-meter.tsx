"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { normalizeBiasPercentages, type BiasPercentages } from "@/lib/bias";

export type BiasMeterProps = BiasPercentages & {
  /** "full" adds the 0% / 50% / 100% scale row beneath the bar. */
  variant?: "full" | "compact";
  /** Overrides the variant's default scale row without changing bar height or labels. */
  showScale?: boolean;
  className?: string;
};

type SegmentKey = keyof BiasPercentages;

type Segment = {
  key: SegmentKey;
  /** Printed inside the segment while it fits, and always shown on hover. */
  label: string;
  value: number;
  className: string;
};

type FitMap = Record<SegmentKey, boolean>;

const segmentKeys: SegmentKey[] = ["left", "center", "right"];

/**
 * biasly Design System v1.0 - Bias meter.
 * A single bar split into Left / Center / Right segments sized by percentage.
 *
 * A narrow segment cannot hold its label, and a half-cut "Righ..." reads worse
 * than nothing, so each label is measured against the room its segment gives it
 * and hidden when it does not fit. Every segment carries a tooltip with the
 * spelled-out figure, so a hidden label is always one hover away.
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

  const barRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Partial<Record<SegmentKey, HTMLSpanElement | null>>>(
    {}
  );

  // null until the browser has measured. Labels stay hidden until then, so a
  // clipped one is never painted on the way to being hidden.
  const [fits, setFits] = useState<FitMap | null>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const measure = () => {
      const next: FitMap = { left: false, center: false, right: false };

      for (const key of segmentKeys) {
        const label = labelRefs.current[key];
        // scrollWidth is the untruncated text width; clientWidth is the room
        // the segment gives it. Equal still fits.
        next[key] = label ? label.scrollWidth <= label.clientWidth : false;
      }

      setFits((previous) =>
        previous && segmentKeys.every((key) => previous[key] === next[key])
          ? previous
          : next
      );
    };

    measure();

    // The bar is fluid (feed grid, article column, sidebar), so a viewport
    // change can turn a fitting label into a clipped one and back.
    const observer = new ResizeObserver(measure);
    observer.observe(bar);

    // Poppins can land after the first measurement and shifts text widths.
    let cancelled = false;
    if ("fonts" in document) {
      document.fonts.ready
        .then(() => {
          if (!cancelled) measure();
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [pct.left, pct.center, pct.right, isFull]);

  // Both variants spell the side out. The compact bar is only ~370px wide in
  // the feed grid, but a label that cannot fit is hidden rather than shortened,
  // so there is no reason to abbreviate the ones that do fit.
  const segments: Segment[] = [
    {
      key: "left",
      label: `Left ${pct.left}%`,
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
        ref={barRef}
        className={cn(
          "flex w-full overflow-hidden rounded-sm",
          isFull ? "h-8" : "h-[22px]"
        )}
        role="img"
        aria-label={`AI-estimated political framing: left ${pct.left}%, center ${pct.center}%, right ${pct.right}%`}
      >
        {segments.map((segment) =>
          segment.value === 0 ? null : (
            <Tooltip key={segment.key}>
              <TooltipTrigger asChild>
                <div
                  style={{ width: `${segment.value}%` }}
                  className={cn(
                    "flex min-w-0 items-center justify-center overflow-hidden",
                    isFull ? "px-2" : "px-0.5",
                    segment.className
                  )}
                >
                  <span
                    ref={(node) => {
                      labelRefs.current[segment.key] = node;
                    }}
                    aria-hidden
                    className={cn(
                      "block w-full overflow-hidden text-center text-caption font-medium whitespace-nowrap",
                      fits?.[segment.key] ? "opacity-100" : "opacity-0"
                    )}
                  >
                    {segment.label}
                  </span>
                </div>
              </TooltipTrigger>

              <TooltipContent sideOffset={8}>
                <p className="text-body-sm text-text-primary">
                  {segment.label}
                </p>
              </TooltipContent>
            </Tooltip>
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
