import Image from "next/image";
import Link from "next/link";
import type { RelatedArticle } from "@/lib/articles/view-models";

export type RelatedStoryCardProps = {
  article: RelatedArticle;
};

/** One row of the Related Stories grid: thumbnail, eyebrow, title, meta. */
export function RelatedStoryCard({ article }: RelatedStoryCardProps) {
  return (
    <Link
      href={`/news/${article.id}`}
      className="group flex gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-text-primary/30 focus-visible:ring-offset-2"
    >
      <div className="relative h-14 w-[72px] shrink-0 overflow-hidden rounded-sm">
        <Image
          src={article.imageUrl}
          alt={article.imageAlt}
          fill
          sizes="72px"
          className="object-cover"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        {article.category ? (
          <p className="text-caption truncate">
            <span className="text-text-primary">{article.category}</span>
            {article.country ? (
              <span className="text-text-secondary">
                {" · "}
                {article.country}
              </span>
            ) : null}
          </p>
        ) : null}

        <h3 className="text-body-sm line-clamp-2 font-semibold text-text-primary transition-colors group-hover:text-bias-right">
          {article.title}
        </h3>

        <p className="text-caption text-text-secondary">
          {article.publishedLabel} &middot; {article.readTimeLabel}
        </p>
      </div>
    </Link>
  );
}
