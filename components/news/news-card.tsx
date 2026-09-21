import Image from "next/image";
import { Info } from "lucide-react";
import { cn } from "cn";
import { BiasMeter } from "@/components/bias/bias-meter";
import type { HomeArticle } from "@/lib/demo/top-news";

export type NewsCardProps = {
  article: HomeArticle;
  /** Set on above-the-fold cards so their images are not lazy-loaded. */
  priority?: boolean;
  className?: string;
};

/**
 * The vertical feed card: image, eyebrow, headline, bias meter, source row.
 * Presentational only - it renders the article passed to it and never reads
 * from the database or triggers pipeline work (AGENTS.md section 5).
 */
export function NewsCard({ article, priority = false, className }: NewsCardProps) {
  const confidencePercent = Math.round(article.confidence * 100);

  const analysisSummary = `AI-estimated framing: ${article.framingLabel} · Sentiment: ${article.sentimentLabel} · Confidence ${confidencePercent}%`;

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-lg border border-border bg-bg-primary shadow-sm",
        className
      )}
    >
      <div className="relative aspect-[16/9] w-full shrink-0">
        <Image
          src={article.imageUrl}
          alt={article.imageAlt}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 395px, (min-width: 1024px) 31vw, (min-width: 640px) 47vw, 100vw"
          className="object-cover"
        />
        <span
          title={analysisSummary}
          aria-label={analysisSummary}
          role="img"
          className="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-full bg-bg-primary/95 text-text-primary shadow-sm"
        >
          <Info size={14} strokeWidth={2} aria-hidden />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-caption truncate">
          <span className="text-text-primary">{article.category}</span>
          <span className="text-text-secondary">
            {" · "}
            {article.country}
          </span>
        </p>

        <h3 className="text-card-title mt-2 line-clamp-3 text-text-primary">
          {article.title}
        </h3>

        {/* mt-auto pins the meter and source row to the card's bottom, so every
            card in a grid row shares the same two baselines regardless of how
            many lines its headline runs to. */}
        <BiasMeter
          left={article.bias.left}
          center={article.bias.center}
          right={article.bias.right}
          variant="compact"
          className="mt-auto pt-4"
        />

        <div className="text-caption mt-2 flex items-center justify-between gap-2 text-text-secondary">
          <span className="shrink-0">{article.sourceCount} sources</span>
          <span className="truncate">
            {article.sourceName} &middot; {article.publishedLabel}
          </span>
        </div>
      </div>
    </article>
  );
}
