"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "cn";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type InfoTooltipProps = {
  /** Short description read by screen readers, and the fallback tooltip body. */
  label: string;
  /** The hover/focus body. Falls back to `label`. */
  children?: ReactNode;
  size?: number;
  className?: string;
  contentClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /**
   * A focusable button trigger is the default. Markers that sit inside a link
   * (the feed card badge) pass false: a button nested in an anchor is invalid,
   * so those open on hover only and rely on `label` for assistive tech.
   */
  focusable?: boolean;
};

/**
 * The little "i" marker beside a card title. Hovering it explains what the
 * card is showing, so a reader never has to guess what a figure means.
 */
export function InfoTooltip({
  label,
  children,
  size = 16,
  className,
  contentClassName,
  side = "top",
  align = "end",
  focusable = true,
}: InfoTooltipProps) {
  const icon = <Info size={size} strokeWidth={2} aria-hidden />;

  const triggerClassName = cn(
    "inline-flex shrink-0 cursor-help items-center justify-center rounded-full text-text-secondary transition-colors hover:text-text-primary",
    className
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {focusable ? (
          <button
            type="button"
            aria-label={label}
            className={cn(
              triggerClassName,
              "outline-none focus-visible:ring-2 focus-visible:ring-text-primary/30"
            )}
          >
            {icon}
          </button>
        ) : (
          <span role="img" aria-label={label} className={triggerClassName}>
            {icon}
          </span>
        )}
      </TooltipTrigger>

      <TooltipContent side={side} align={align} className={contentClassName}>
        {children === undefined || typeof children === "string" ? (
          <p className="text-body-sm text-text-secondary">{children ?? label}</p>
        ) : (
          children
        )}
      </TooltipContent>
    </Tooltip>
  );
}
