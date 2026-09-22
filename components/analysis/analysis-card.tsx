import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";

export type AnalysisCardProps = {
  title: string;
  /** Describes what the card shows; carried by the card's info marker. */
  infoLabel: string;
  /** Richer hover explanation for the marker. Falls back to `infoLabel`. */
  infoContent?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * The shared sidebar card shell: title, info marker, body, and an optional
 * footer below a divider. The three analysis cards share it so the rail scans
 * as one instrument panel rather than three widgets.
 */
export function AnalysisCard({
  title,
  infoLabel,
  infoContent,
  children,
  footer,
}: AnalysisCardProps) {
  return (
    <Card className="gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-card-title text-text-primary">{title}</h2>
        <InfoTooltip label={infoLabel}>{infoContent}</InfoTooltip>
      </div>

      {children}

      {footer ? (
        <div className="border-t border-border pt-4">{footer}</div>
      ) : null}
    </Card>
  );
}
