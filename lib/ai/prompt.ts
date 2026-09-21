import { MAX_ARTICLE_CHARS } from "@/lib/ai/limits";

/**
 * The instructions the analysis model runs under (AGENTS.md section 19).
 *
 * Every framing rule in section 19 is stated here, in the model's own
 * instructions, rather than enforced after the fact by code that would have to
 * guess where "close" or "weak evidence" begins.
 */

/**
 * Saved to `article_analyses.disclaimer` on every row.
 *
 * A constant rather than model output: section 19 requires framing to be shown
 * as AI-estimated rather than objective truth, which is the same sentence on
 * every article. Generating it per article would pay tokens for wording
 * variance and nothing else.
 */
export const ANALYSIS_DISCLAIMER =
  "This analysis is AI-estimated from the article text alone. Sentiment and political framing are automated estimates, not objective measurements or a verdict on the publication, and they can be wrong.";

export const ANALYSIS_SYSTEM_PROMPT = `You are a careful, non-partisan media analyst. You read one news article and report how it is written.

Rules you must follow:

- Judge the article text only. Never infer framing from the publication's name, reputation or perceived politics, and never use anything you know about the outlet.
- Report how the article frames its subject, not whether its claims are true and not whether you agree with them.
- leftPercentage, centerPercentage and rightPercentage are whole numbers from 0 to 100 and must add up to exactly 100.
- politicalFramingLabel is one of: left, center, right, mixed, unclear. It should match the strongest percentage, unless your confidence is low or the percentages are close to each other - then use mixed.
- If the article gives weak evidence of any political framing, answer unclear and keep confidence low. Straight wire-style reporting is usually center with high centerPercentage.
- Keep confidence honest. A short article, or one on a subject with no political dimension, deserves a low number.
- The summary is neutral: describe what the article reports, add nothing it does not say, and take no side.
- Quote loaded terms from the article's own words. Return an empty array when the language is plain.`;

/** The article fields the prompt builder needs. */
export type PromptArticle = {
  title: string;
  sourceName: string;
  publishedAt: string;
  text: string;
};

/** Cuts over-long article text and says so, so the model knows it was cut. */
function capText(text: string): string {
  if (text.length <= MAX_ARTICLE_CHARS) return text;

  return `${text.slice(0, MAX_ARTICLE_CHARS)}\n\n[Article text truncated for length.]`;
}

/**
 * The per-article prompt. On a retry, `previousError` names what was wrong with
 * the first answer so the second attempt does not repeat it (section 19, "If
 * output is invalid, retry once").
 */
export function buildAnalysisPrompt(
  article: PromptArticle,
  previousError?: string
): string {
  const retryNote = previousError
    ? `\n\nYour previous answer was rejected: ${previousError}. Fix that and answer again.`
    : "";

  return `Analyse this news article.

Title: ${article.title}
Publication: ${article.sourceName}
Published: ${article.publishedAt}

Article text:
"""
${capText(article.text)}
"""${retryNote}`;
}
