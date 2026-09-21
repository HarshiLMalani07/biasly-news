import "server-only";

import { openai } from "@ai-sdk/openai";
import {
  generateText,
  JSONParseError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  TypeValidationError,
} from "ai";

import {
  AnalysisOutputSchema,
  type AnalysisOutput,
} from "@/lib/ai/analysis-schema";
import {
  ANALYSIS_MODEL,
  ANALYSIS_REASONING_EFFORT,
  PERCENTAGE_TOTAL_TOLERANCE,
} from "@/lib/ai/limits";
import {
  ANALYSIS_DISCLAIMER,
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisPrompt,
  type PromptArticle,
} from "@/lib/ai/prompt";
import { normalizeBiasPercentages } from "@/lib/bias";
import { deriveBiasScore } from "@/lib/supabase/queries/analyses";
import type {
  ArticleAnalysisInsert,
  BiasLabel,
  SentimentLabel,
} from "@/lib/supabase/types";

/**
 * One article in, one validated analysis row out (AGENTS.md section 19).
 *
 * `server-only`: this module calls OpenAI. The API key is read from the
 * environment by the provider itself and is never referenced here, logged, or
 * returned (section 21).
 *
 * Structured output follows the installed AI SDK (`ai` 7.0.107), where
 * `generateObject` no longer exists: `generateText` with `Output.object` both
 * hands the schema to the model and validates the answer against it.
 */

export type AnalyzeArticleInput = PromptArticle & { articleId: string };

export type AnalyzeArticleResult =
  | { ok: true; analysis: ArticleAnalysisInsert; repairedPercentages: boolean }
  | { ok: false; reason: "invalid_output" | "model_error"; message: string };

/** The model, built once - the provider reads `OPENAI_API_KEY` itself. */
const model = openai(ANALYSIS_MODEL);

type Checked =
  | { ok: true; analysis: ArticleAnalysisInsert; repairedPercentages: boolean }
  | { ok: false; message: string };

/** True when `value` is a real number inside `[min, max]`. */
function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/**
 * Every check the emitted schema does not carry: numeric ranges (kept out of
 * the JSON schema, see `analysis-schema.ts`), a summary that is blank once
 * trimmed, and three percentages that do not total 100.
 *
 * A total within `PERCENTAGE_TOTAL_TOLERANCE` is rounding drift (33/34/34) and
 * is repaired to exactly 100 with the same largest-remainder helper the UI
 * uses. Anything further off is bad output, not drift, and is rejected so the
 * caller can retry - the database check constraint would refuse it anyway.
 */
function toAnalysisRow(output: AnalysisOutput, articleId: string): Checked {
  const summary = output.neutralSummary.trim();

  if (summary.length === 0) {
    return { ok: false, message: "the summary was empty" };
  }

  if (!inRange(output.sentimentScore, -1, 1)) {
    return {
      ok: false,
      message: `sentimentScore was ${output.sentimentScore}, outside -1 to 1`,
    };
  }

  if (!inRange(output.confidence, 0, 1)) {
    return {
      ok: false,
      message: `confidence was ${output.confidence}, outside 0 to 1`,
    };
  }

  const percentages = [
    output.leftPercentage,
    output.centerPercentage,
    output.rightPercentage,
  ];

  if (percentages.some((value) => !inRange(value, 0, 100))) {
    return {
      ok: false,
      message: `the framing percentages ${percentages.join("/")} are not all between 0 and 100`,
    };
  }

  const total =
    output.leftPercentage + output.centerPercentage + output.rightPercentage;
  const drift = Math.abs(total - 100);

  if (drift > PERCENTAGE_TOTAL_TOLERANCE) {
    return {
      ok: false,
      message: `the three framing percentages totalled ${total}, not 100`,
    };
  }

  const bias =
    total === 100
      ? {
          left: output.leftPercentage,
          center: output.centerPercentage,
          right: output.rightPercentage,
        }
      : normalizeBiasPercentages({
          left: output.leftPercentage,
          center: output.centerPercentage,
          right: output.rightPercentage,
        });

  const framingNotes = output.framingNotes?.trim();

  return {
    ok: true,
    repairedPercentages: total !== 100,
    analysis: {
      article_id: articleId,
      summary,
      sentiment_score: output.sentimentScore,
      sentiment_label: output.sentimentLabel satisfies SentimentLabel,
      bias_score: deriveBiasScore(bias.left, bias.right),
      bias_label: output.politicalFramingLabel satisfies BiasLabel,
      left_percentage: bias.left,
      center_percentage: bias.center,
      right_percentage: bias.right,
      confidence: output.confidence,
      framing_notes: framingNotes && framingNotes.length > 0 ? framingNotes : null,
      loaded_terms: output.loadedTerms.map((term) => term.trim()).filter(Boolean),
      disclaimer: ANALYSIS_DISCLAIMER,
      model: ANALYSIS_MODEL,
    },
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * True when the model answered but the answer was unusable - no object, bad
 * JSON, or a shape the schema rejected. Those are section 19's "invalid
 * output", so they earn the one retry. A transport or API failure (rate limit,
 * timeout, auth) is a different thing and is not retried here.
 */
function isOutputFailure(error: unknown): boolean {
  return (
    NoObjectGeneratedError.isInstance(error) ||
    NoOutputGeneratedError.isInstance(error) ||
    TypeValidationError.isInstance(error) ||
    JSONParseError.isInstance(error)
  );
}

/**
 * Analyses one article, retrying once when the *output* is invalid (AGENTS.md
 * section 19). A thrown provider error is not retried here: the AI SDK's own
 * `maxRetries` already covers the transport layer, and a failed article simply
 * stays pending for the next run.
 */
export async function analyzeArticle(
  article: AnalyzeArticleInput
): Promise<AnalyzeArticleResult> {
  let previousError: string | undefined;

  // Two attempts: the first, and section 19's single retry.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let output: AnalysisOutput;

    try {
      const result = await generateText({
        model,
        // The one setting deviating from a provider default: see limits.ts.
        reasoning: ANALYSIS_REASONING_EFFORT,
        system: ANALYSIS_SYSTEM_PROMPT,
        prompt: buildAnalysisPrompt(article, previousError),
        output: Output.object({
          name: "article_analysis",
          description:
            "Neutral summary, sentiment, and AI-estimated political framing of one news article.",
          schema: AnalysisOutputSchema,
        }),
      });

      output = result.output;
    } catch (error) {
      const message = messageOf(error);

      if (isOutputFailure(error)) {
        if (attempt === 0) {
          previousError = "it did not match the required output schema";
          continue;
        }

        return { ok: false, reason: "invalid_output", message };
      }

      // A provider or transport failure: the AI SDK has already retried it at
      // that layer, so stop and leave the article pending.
      return { ok: false, reason: "model_error", message };
    }

    const checked = toAnalysisRow(output, article.articleId);

    if (checked.ok) {
      return {
        ok: true,
        analysis: checked.analysis,
        repairedPercentages: checked.repairedPercentages,
      };
    }

    if (attempt === 0) {
      previousError = checked.message;
      continue;
    }

    return { ok: false, reason: "invalid_output", message: checked.message };
  }

  // Unreachable: the loop returns on its second attempt.
  return {
    ok: false,
    reason: "invalid_output",
    message: "no valid output after one retry",
  };
}
