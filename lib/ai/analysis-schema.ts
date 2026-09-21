import { z } from "zod";

/**
 * The shape one analysis must come back in (AGENTS.md section 19).
 *
 * This schema is both the contract sent to the model and the gate the answer
 * has to pass before anything is written - section 19: "Validate AI output with
 * Zod or equivalent before saving."
 *
 * Three rules shape it:
 *  - strict JSON schema mode does not support optional properties, so every
 *    field is required and `framingNotes` is `.nullable()` rather than
 *    `.optional()`;
 *  - `.describe()` on a property is the documented way to hand the model a
 *    per-field hint, so the rules live next to the fields they constrain;
 *  - the numeric bounds are here so strict mode constrains the answer as it is
 *    sampled, but they are re-checked in `lib/ai/analyze-article.ts` as well:
 *    the database has its own check constraints, and an out-of-range answer
 *    must become section 19's "invalid output" rather than a failed insert.
 *
 * `biasScore`, `disclaimer` and `model` are deliberately absent: the app
 * derives or supplies those, so the model is never asked for them.
 */

export const SENTIMENT_LABELS = ["positive", "neutral", "negative"] as const;

export const FRAMING_LABELS = [
  "left",
  "center",
  "right",
  "mixed",
  "unclear",
] as const;

export const AnalysisOutputSchema = z.object({
  neutralSummary: z
    .string()
    .describe(
      "A neutral, non-editorialising summary of what the article reports, in 3 to 5 short sentences. Describe the reporting; do not take a side and do not add facts the article does not contain."
    ),
  sentimentScore: z
    .number()
    .min(-1)
    .max(1)
    .describe(
      "Overall tone of the article's language from -1 (strongly negative) through 0 (neutral) to 1 (strongly positive)."
    ),
  sentimentLabel: z
    .enum(SENTIMENT_LABELS)
    .describe("The label matching sentimentScore."),
  politicalFramingLabel: z
    .enum(FRAMING_LABELS)
    .describe(
      "AI-estimated political framing of the article text. Match the strongest percentage unless confidence is low or the percentages are close, in which case use 'mixed'. If the evidence is weak, use 'unclear'."
    ),
  leftPercentage: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      "Whole number 0-100. How much of the framing leans left. leftPercentage + centerPercentage + rightPercentage must be exactly 100."
    ),
  centerPercentage: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      "Whole number 0-100. How much of the framing is centrist or neutral. The three percentages must total exactly 100."
    ),
  rightPercentage: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      "Whole number 0-100. How much of the framing leans right. The three percentages must total exactly 100."
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "How well the article text supports this framing estimate, from 0 to 1. Keep it low when the evidence is weak."
    ),
  framingNotes: z
    .string()
    .nullable()
    .describe(
      "One short paragraph naming the concrete choices in the article - emphasis, omission, sourcing, word choice - that led to the framing estimate. Null only when the article gives nothing to point at."
    ),
  loadedTerms: z
    .array(z.string())
    .describe(
      "Emotionally or politically loaded words and phrases quoted from the article text, at most 8. An empty array when the language is plain."
    ),
});

export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;
