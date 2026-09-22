import "server-only";

import { openai } from "@ai-sdk/openai";
import { embed } from "ai";

import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  MAX_EMBEDDING_CHARS,
} from "@/lib/ai/limits";

/**
 * One article in, one 1536-dimension embedding out (AGENTS.md section 20).
 *
 * `server-only`: this module calls OpenAI. The API key is read from the
 * environment by the provider itself and is never referenced here, logged, or
 * returned (section 21).
 *
 * `maxRetries` is deliberately not set - the AI SDK already defaults to 2, and
 * the ai-sdk skill asks for only the options that differ from a default.
 */

export type EmbedArticleInput = {
  title: string;
  text: string;
};

export type EmbedArticleResult =
  | { ok: true; embedding: number[] }
  | { ok: false; message: string };

/** The model, built once - the provider reads `OPENAI_API_KEY` itself. */
const model = openai.embedding(EMBEDDING_MODEL);

/** Title first: it is the densest description of the story in the article. */
function buildValue(article: EmbedArticleInput): string {
  const value = `${article.title.trim()}\n\n${article.text.trim()}`;

  return value.length <= MAX_EMBEDDING_CHARS
    ? value
    : value.slice(0, MAX_EMBEDDING_CHARS);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Embeds one article. Never throws: the caller treats a failure as "this
 * article keeps its analysis but stays unstamped", so a run is never taken
 * down by one embedding call.
 *
 * A vector of the wrong width, or one holding a non-finite number, is rejected
 * here rather than at insert time: `vector(1536)` would refuse it anyway, and
 * the reason is clearer from this side.
 */
export async function embedArticle(
  article: EmbedArticleInput
): Promise<EmbedArticleResult> {
  try {
    const { embedding } = await embed({ model, value: buildValue(article) });

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      return {
        ok: false,
        message: `the embedding had ${embedding.length} dimensions, not ${EMBEDDING_DIMENSIONS}`,
      };
    }

    if (!embedding.every((value) => Number.isFinite(value))) {
      return { ok: false, message: "the embedding held a non-finite number" };
    }

    return { ok: true, embedding };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}
