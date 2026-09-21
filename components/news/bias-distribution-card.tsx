import { Info } from "lucide-react";
import { BiasMeter } from "@/components/bias/bias-meter";
import { Card } from "@/components/ui/card";
import type { BiasPercentages } from "@/lib/bias";

export type BiasDistributionCardProps = {
  bias: BiasPercentages;
  /** Absent until biasly tracks a story across outlets (AGENTS.md section 7). */
  sourceCount?: number | null;
};

/**
 * The in-body framing bar, placed between the photograph and the first
 * paragraph so the reader sees how the story is framed before reading it.
 */
export function BiasDistributionCard({
  bias,
  sourceCount,
}: BiasDistributionCardProps) {
  const infoLabel =
    "AI-estimated political framing across the sources covering this story.";

  return (
    <Card className="mt-6 gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-body-sm font-semibold text-text-primary">
          Bias Distribution
        </h2>
        <span
          role="img"
          aria-label={infoLabel}
          title={infoLabel}
          className="text-text-secondary"
        >
          <Info size={14} strokeWidth={2} aria-hidden />
        </span>
      </div>

      <BiasMeter
        left={bias.left}
        center={bias.center}
        right={bias.right}
        variant="full"
        showScale={false}
      />

      <p className="text-caption text-text-secondary">
        {sourceCount ? `${sourceCount} sources` : "Estimated from this article's text"}
      </p>
    </Card>
  );
}
