import { cn } from "cn";

type LogoSize = "sm" | "md" | "lg";

const wordmarkSize: Record<LogoSize, string> = {
  sm: "text-[24px] leading-[1.05]",
  md: "text-[40px] leading-[1.05]",
  lg: "text-[56px] leading-[1.05]",
};

const subMarkSize: Record<LogoSize, string> = {
  sm: "text-[11px] leading-none",
  md: "text-[18px] leading-none",
  lg: "text-[26px] leading-none",
};

export type LogoProps = {
  size?: LogoSize;
  /** Treatment for the inverted bars (utility bar, footer), in both themes. */
  inverted?: boolean;
  className?: string;
};

/**
 * biasly wordmark lockup: "biasly" in Bold with "News" in SemiBold beneath,
 * right-aligned to the wordmark.
 */
export function Logo({ size = "md", inverted = false, className }: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex flex-col items-end",
        inverted ? "text-inverse-text" : "text-text-primary",
        className
      )}
    >
      <span className={cn("font-bold tracking-[-0.04em]", wordmarkSize[size])}>
        biasly
      </span>
      <span className={cn("font-semibold tracking-[-0.01em]", subMarkSize[size])}>
        News
      </span>
    </span>
  );
}
