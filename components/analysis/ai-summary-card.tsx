import { AnalysisCard } from "@/components/analysis/analysis-card";
import { Button } from "@/components/ui/button";
import type { ArticleDetail } from "@/lib/demo/article-detail";

export type AiSummaryCardProps = {
  article: ArticleDetail;
};

/** The neutral summary, with its disclaimer and the model that produced it. */
export function AiSummaryCard({ article }: AiSummaryCardProps) {
  return (
    <AnalysisCard
      title="AI Summary"
      infoLabel="A neutral summary of this article, generated from its text."
      footer={
        <Button variant="secondary" size="sm">
          Provide Feedback
        </Button>
      }
    >
      <p className="text-caption text-text-secondary">
        Generated {article.summaryGeneratedLabel} &middot;{" "}
        {article.summaryReadTimeLabel}
      </p>

      <ul className="flex list-disc flex-col gap-3 pl-4">
        {article.summaryBullets.map((bullet) => (
          <li key={bullet} className="text-body-sm text-text-primary">
            {bullet}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1">
        <p className="text-caption text-text-secondary">{article.disclaimer}</p>
        <p className="text-caption text-text-secondary">
          Analysed by {article.model}
        </p>
      </div>
    </AnalysisCard>
  );
}
