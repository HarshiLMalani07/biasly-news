import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiSummaryCard } from "@/components/analysis/ai-summary-card";
import { BiasAnalysisCard } from "@/components/analysis/bias-analysis-card";
import { SourceBreakdownCard } from "@/components/analysis/source-breakdown-card";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { UtilityBar } from "@/components/layout/utility-bar";
import { NewsletterCta } from "@/components/marketing/newsletter-cta";
import { ArticleBody } from "@/components/news/article-body";
import { ArticleHeader } from "@/components/news/article-header";
import { ArticleHero } from "@/components/news/article-hero";
import { BiasDistributionCard } from "@/components/news/bias-distribution-card";
import { RelatedStories } from "@/components/news/related-stories";
import {
  getArticleDetail,
  getArticleDetailIds,
  getRelatedArticles,
} from "@/lib/demo/article-detail";

export function generateStaticParams() {
  return getArticleDetailIds().map((id) => ({ id }));
}

export async function generateMetadata(
  props: PageProps<"/news/[id]">
): Promise<Metadata> {
  const { id } = await props.params;
  const article = getArticleDetail(id);

  if (!article) {
    return { title: "Article not found — biasly" };
  }

  return {
    title: `${article.title} — biasly`,
    description: article.summaryBullets[0],
  };
}

export default async function NewsDetailPage(props: PageProps<"/news/[id]">) {
  const { id } = await props.params;
  const article = getArticleDetail(id);

  if (!article) {
    notFound();
  }

  const relatedArticles = getRelatedArticles(article.id);

  return (
    <>
      <UtilityBar />
      <SiteHeader />

      <main className="flex-1 bg-surface">
        <div className="container-biasly py-8">
          <div className="grid-biasly">
            <article className="col-span-12 lg:col-span-8">
              <ArticleHeader article={article} />

              <ArticleHero
                imageUrl={article.imageUrl}
                imageAlt={article.imageAlt}
                caption={article.heroCaption}
                credit={article.heroCredit}
              />

              {/* Before the body on purpose: the reader sees how the story is
                  framed before reading it. */}
              <BiasDistributionCard
                bias={article.bias}
                sourceCount={article.sourceCount}
              />

              <ArticleBody paragraphs={article.paragraphs} />

              <RelatedStories articles={relatedArticles} />
            </article>

            <aside className="col-span-12 flex flex-col gap-6 self-start lg:col-span-4 lg:sticky lg:top-6">
              <BiasAnalysisCard article={article} />
              <AiSummaryCard article={article} />
              <SourceBreakdownCard article={article} />
            </aside>
          </div>

          <NewsletterCta />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
