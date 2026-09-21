import { AnalysisCard } from "@/components/analysis/analysis-card";
import { BiasBreakdownRow } from "@/components/analysis/bias-breakdown-row";
import { Button } from "@/components/ui/button";
import { normalizeBiasPercentages } from "@/lib/bias";
import type { ArticleDetail, SourceBias } from "@/lib/demo/article-detail";

export type SourceBreakdownCardProps = {
  article: ArticleDetail;
};

const sourceBiasTitle: Record<SourceBias, string> = {
  left: "Left",
  center: "Center",
  right: "Right",
};

const sourceBiasTone: Record<SourceBias, string> = {
  left: "text-bias-left",
  center: "text-text-secondary",
  right: "text-bias-right",
};

/**
 * Which outlets covered the story and how each one leans. Demo data: AGENTS.md
 * section 7 stores one source per article, not a per-story outlet roster.
 */
export function SourceBreakdownCard({ article }: SourceBreakdownCardProps) {
  const bias = normalizeBiasPercentages(article.bias);
  const { counts, topSources } = article.demoSourceBreakdown;

  return (
    <AnalysisCard
      title="Source Breakdown"
      infoLabel="The outlets covering this story, grouped by how each one leans."
      footer={
        <Button variant="secondary" className="w-full">
          View All Sources
        </Button>
      }
    >
      <p className="text-body-sm font-semibold text-text-primary">
        {article.sourceCount} Total Sources
      </p>

      <div className="flex flex-col gap-2">
        <BiasBreakdownRow
          label="Left"
          value={`${counts.left} (${bias.left}%)`}
          percent={bias.left}
          tone="left"
        />
        <BiasBreakdownRow
          label="Center"
          value={`${counts.center} (${bias.center}%)`}
          percent={bias.center}
          tone="center"
        />
        <BiasBreakdownRow
          label="Right"
          value={`${counts.right} (${bias.right}%)`}
          percent={bias.right}
          tone="right"
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <div className="text-caption flex items-center justify-between text-text-secondary">
          <span>Top Sources</span>
          <span>Bias</span>
        </div>

        <ul className="flex flex-col gap-2">
          {topSources.map((source) => (
            <li
              key={source.name}
              className="flex items-center justify-between gap-3"
            >
              <span className="text-body-sm truncate text-text-primary">
                {source.name}
              </span>
              <span className={`text-body-sm ${sourceBiasTone[source.bias]}`}>
                {sourceBiasTitle[source.bias]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </AnalysisCard>
  );
}
