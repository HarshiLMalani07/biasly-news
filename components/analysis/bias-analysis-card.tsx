import { AnalysisCard } from "@/components/analysis/analysis-card";
import { BiasBreakdownRow } from "@/components/analysis/bias-breakdown-row";
import { BiasExplainer } from "@/components/bias/bias-explainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { normalizeBiasPercentages } from "@/lib/bias";
import type {
  ArticleDetail,
  FramingLabel,
  SentimentLabel,
} from "@/lib/articles/view-models";

export type BiasAnalysisCardProps = {
  article: ArticleDetail;
};

const framingTitle: Record<FramingLabel, string> = {
  left: "Left",
  center: "Center",
  right: "Right",
  mixed: "Mixed",
  unclear: "Unclear",
};

/** Only a clear lean is coloured; mixed and unclear stay neutral. */
const framingTone: Record<FramingLabel, string> = {
  left: "text-bias-left",
  center: "text-text-primary",
  right: "text-bias-right",
  mixed: "text-text-primary",
  unclear: "text-text-primary",
};

const sentimentTitle: Record<SentimentLabel, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

/**
 * The headline framing figure, the per-side split, and the caveats AGENTS.md
 * section 19 requires alongside it. Framing is shown as AI-estimated, never as
 * objective truth.
 */
export function BiasAnalysisCard({ article }: BiasAnalysisCardProps) {
  const bias = normalizeBiasPercentages(article.bias);

  const headlinePercent =
    article.framingLabel === "left"
      ? bias.left
      : article.framingLabel === "right"
        ? bias.right
        : article.framingLabel === "center"
          ? bias.center
          : Math.max(bias.left, bias.center, bias.right);

  return (
    <AnalysisCard
      title="Bias Analysis"
      infoLabel="How the sources covering this story lean, estimated by AI from the article text."
      infoContent={<BiasExplainer />}
      footer={
        <Button variant="secondary" className="w-full">
          How We Analyze Bias
        </Button>
      }
    >
      <div className="flex flex-col gap-1">
        <p className="text-caption font-semibold text-text-primary">
          Overall Bias
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-h2 ${framingTone[article.framingLabel]}`}>
            {framingTitle[article.framingLabel]} {headlinePercent}%
          </p>
          <Badge variant="secondary">AI-estimated</Badge>
        </div>

        <p className="text-body-sm text-bias-right">
          {article.sourceCount
            ? `Based on ${article.sourceCount} balanced sources`
            : "Estimated from this article's text"}
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <BiasBreakdownRow
          label="Left"
          value={`${bias.left}%`}
          percent={bias.left}
          tone="left"
        />
        <BiasBreakdownRow
          label="Center"
          value={`${bias.center}%`}
          percent={bias.center}
          tone="center"
        />
        <BiasBreakdownRow
          label="Right"
          value={`${bias.right}%`}
          percent={bias.right}
          tone="right"
        />

        <p className="text-caption mt-1 text-text-secondary">
          Sentiment: {sentimentTitle[article.sentimentLabel]} &middot; Confidence{" "}
          {Math.round(article.confidence * 100)}%
        </p>
      </div>

      {article.framingNotes ? (
        <p className="text-body-sm border-t border-border pt-4 text-text-secondary">
          {article.framingNotes}
        </p>
      ) : null}

      {article.loadedTerms.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-caption font-semibold text-text-primary">
            Loaded Terms
          </p>
          <div className="flex flex-wrap gap-2">
            {article.loadedTerms.map((term) => (
              <Badge key={term} variant="secondary">
                {term}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </AnalysisCard>
  );
}
