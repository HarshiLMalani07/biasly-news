import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

/**
 * biasly Design System v1.0 - Buttons.
 *
 * Every variant carries its hover styles twice: once as `hover:` for real
 * pointer interaction, and once as `data-[hover=true]:` so the design-system
 * sheet can render the hover appearance statically.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    // Tailwind v4 preflight sets buttons to cursor-default; a control that
    // looks clickable should read as clickable. disabled: wins on specificity.
    "cursor-pointer rounded-md font-medium transition-colors outline-none select-none",
    "focus-visible:ring-2 focus-visible:ring-text-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
    "disabled:pointer-events-none disabled:cursor-not-allowed",
    "disabled:border-border disabled:bg-bg-secondary disabled:text-text-secondary/60 disabled:shadow-none",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary: [
          "border border-transparent bg-text-primary text-bg-primary",
          "hover:bg-button-primary-hover hover:shadow-sm",
          "data-[hover=true]:bg-button-primary-hover data-[hover=true]:shadow-sm",
        ],
        secondary: [
          "border border-border bg-bg-primary text-text-primary",
          "hover:bg-surface",
          "data-[hover=true]:bg-surface",
        ],
        outline: [
          "border border-border bg-bg-primary text-text-primary",
          "hover:bg-surface",
          "data-[hover=true]:bg-surface",
        ],
        text: [
          "border border-transparent bg-transparent text-text-primary",
          "hover:text-bias-right",
          "data-[hover=true]:text-bias-right",
          "disabled:bg-transparent disabled:border-transparent",
        ],
      },
      size: {
        default: "h-10 px-4 text-[14px] leading-none",
        sm: "h-8 px-3 text-[13px] leading-none",
        lg: "h-12 px-6 text-[16px] leading-none",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "primary",
  size = "default",
  asChild = false,
  forceHover = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Renders the hover appearance without a pointer (design-system sheet only). */
    forceHover?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-hover={forceHover ? "true" : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
