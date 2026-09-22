"use client";

import * as React from "react";
import { cn } from "cn";
import { Tooltip as TooltipPrimitive } from "radix-ui";

/**
 * biasly Design System v1.0 - Tooltip.
 * Hover/focus explainer on a card surface. Each Tooltip carries its own
 * provider so any card can drop one in without app-level setup.
 *
 * Note: typography classes are left off the content shell on purpose - `cn`
 * merges `text-*` as one group, so a base `text-body-sm` here would be dropped
 * by a caller's `text-...` colour (and vice versa). Children carry their own.
 */
function TooltipProvider({
  delayDuration = 120,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger(
  props: React.ComponentProps<typeof TooltipPrimitive.Trigger>
) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 6,
  collisionPadding = 12,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "z-50 max-w-[280px] rounded-md border border-border bg-overlay px-3 py-2 shadow-md",
          "origin-[var(--radix-tooltip-content-transform-origin)]",
          "animate-in fade-in-0 zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
