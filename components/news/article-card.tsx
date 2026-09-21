import Image from "next/image";
import { Bookmark, Clock, Info } from "lucide-react";
import { cn } from "cn";
import { BiasMeter } from "@/components/bias/bias-meter";
import { Card } from "@/components/ui/card";
import type { BiasPercentages } from "@/lib/bias";

export type ArticleCardProps = {
  title: string;
  description: string;
  category: string;
  country: string;
  imageUrl: string;
  imageAlt: string;
  publishedLabel: string;
  readTimeLabel: string;
  bias: BiasPercentages;
  className?: string;
};

/**
 * biasly Design System v1.0 - Article card.
 * Presentational only: it renders stored article data passed in as props and
 * never reads from the database or triggers pipeline work.
 */
export function ArticleCard({
  title,
  description,
  category,
  country,
  imageUrl,
  imageAlt,
  publishedLabel,
  readTimeLabel,
  bias,
  className,
}: ArticleCardProps) {
  return (
    <Card className={cn("gap-0 md:flex-row md:gap-6", className)}>
      <div className="relative w-full shrink-0 overflow-hidden rounded-md md:w-40">
        <Image
          src={imageUrl}
          alt={imageAlt}
          width={416}
          height={312}
          className="h-44 w-full object-cover sm:h-56 md:h-full md:min-h-40"
        />
        <span className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-full bg-bg-primary text-text-primary shadow-sm">
          <Info size={14} strokeWidth={2} aria-hidden />
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-4 md:pt-0">
        <p className="text-caption text-text-secondary">
          {category} &middot; {country}
        </p>

        <h3 className="text-h3 line-clamp-2 text-text-primary">{title}</h3>

        <p className="text-body-md line-clamp-2 text-text-secondary">
          {description}
        </p>

        <BiasMeter
          left={bias.left}
          center={bias.center}
          right={bias.right}
          variant="compact"
          className="mt-1"
        />

        <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-2 text-body-sm text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={16} strokeWidth={2} aria-hidden />
            {publishedLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Bookmark size={16} strokeWidth={2} aria-hidden />
            {readTimeLabel}
          </span>
        </div>
      </div>
    </Card>
  );
}
