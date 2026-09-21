import * as React from "react";
import { cn } from "cn";

/**
 * biasly Design System v1.0 - Text input.
 * Token-level border, radius and height, matching Button's focus ring.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full rounded-md border border-border bg-bg-primary px-3 text-[14px] text-text-primary outline-none transition-colors",
        "placeholder:text-text-secondary",
        "focus-visible:ring-2 focus-visible:ring-text-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
        "disabled:cursor-not-allowed disabled:bg-bg-secondary",
        className
      )}
      {...props}
    />
  );
}

export { Input };
