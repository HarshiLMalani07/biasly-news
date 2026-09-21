import { Bookmark, MoreHorizontal, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ArticleDetail } from "@/lib/articles/view-models";

export type ArticleHeaderProps = {
  article: ArticleDetail;
};

/** Eyebrow, headline, byline and the Save / Share / more actions row. */
export function ArticleHeader({ article }: ArticleHeaderProps) {
  return (
    <header>
      {/* Category and country are not stored yet, so the eyebrow falls back
          to the outlet that published the piece. */}
      <p className="text-caption">
        <span className="text-text-primary">
          {article.category ?? article.sourceName}
        </span>
        {article.category && article.country ? (
          <span className="text-text-secondary">
            {" · "}
            {article.country}
          </span>
        ) : null}
      </p>

      <h1 className="text-h1 mt-2 text-text-primary">{article.title}</h1>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="text-body-sm flex items-center gap-3 text-text-secondary">
          {/* No byline is stored; the outlet stands in its place. */}
          <span>{article.authorName ? `By ${article.authorName}` : article.sourceName}</span>
          <span aria-hidden className="text-border">
            |
          </span>
          <time dateTime={article.publishedIso}>{article.publishedLabel}</time>
          <span aria-hidden className="text-border">
            |
          </span>
          <span>{article.readTimeLabel}</span>
        </div>

        {/* Presentational until saving and sharing exist. */}
        <div className="flex items-center gap-1">
          <Button variant="text" size="sm" aria-label="Save this article">
            <span className="hidden sm:inline">Save</span>
            <Bookmark size={16} strokeWidth={2} aria-hidden />
          </Button>
          <Button variant="text" size="sm" aria-label="Share this article">
            <span className="hidden sm:inline">Share</span>
            <Share2 size={16} strokeWidth={2} aria-hidden />
          </Button>
          <Button variant="text" size="sm" aria-label="More options">
            <MoreHorizontal size={16} strokeWidth={2} aria-hidden />
          </Button>
        </div>
      </div>
    </header>
  );
}
