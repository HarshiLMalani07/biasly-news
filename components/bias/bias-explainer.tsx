/**
 * The plain-language answer to "what does this bias split actually mean?".
 * Shared by every info marker that sits beside a framing figure so the caveat
 * AGENTS.md section 19 requires - AI-estimated, never objective truth - is
 * always one hover away.
 */
export function BiasExplainer() {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption font-semibold text-text-primary">
        What the bias split means
      </p>

      <p className="text-body-sm text-text-secondary">
        Left, Center and Right estimate how this article&apos;s wording and
        framing lean. AI reads it from the article text alone &mdash; it is not
        a rating of the outlet, and not a judgement of whether the reporting is
        accurate.
      </p>

      <p className="text-body-sm text-text-secondary">
        A bigger share means a stronger lean that way; Center is language that
        stays neutral. Confidence says how sure the model is, so treat a
        low-confidence split as a rough signal rather than a verdict.
      </p>
    </div>
  );
}
