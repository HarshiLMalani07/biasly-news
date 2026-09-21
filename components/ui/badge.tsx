import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

/**
 * biasly Design System v1.0 - Badge.
 * Small pill label. Semantic variants map to the framing palette.
 */
const badgeVariants = cva(
  "inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full border px-2 text-[11px] font-medium leading-none [&>svg]:size-3 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-text-primary text-bg-primary",
        secondary: "border-border bg-surface text-text-primary",
        outline: "border-border bg-bg-primary text-text-primary",
        left: "border-transparent bg-bias-left text-bg-primary",
        center: "border-transparent bg-bias-center text-text-primary",
        right: "border-transparent bg-bias-right text-bg-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
