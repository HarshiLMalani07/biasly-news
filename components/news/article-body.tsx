export type ArticleBodyProps = {
  paragraphs: readonly string[];
};

/**
 * The article text. Paragraphs render as React children only - scraped article
 * text flows through here later, so this sink must never accept HTML.
 */
export function ArticleBody({ paragraphs }: ArticleBodyProps) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="text-body-lg text-text-primary">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
