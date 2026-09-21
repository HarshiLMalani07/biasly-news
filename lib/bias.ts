export type BiasPercentages = {
  left: number;
  center: number;
  right: number;
};

const clamp = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, 100);
};

/**
 * AGENTS.md section 19 requires left + center + right to equal 100.
 * Rendering must never throw, so out-of-range or non-summing input is clamped
 * and rescaled here instead. Rounding uses largest-remainder so the three
 * integers still total exactly 100.
 */
export function normalizeBiasPercentages(input: BiasPercentages): BiasPercentages {
  const raw: BiasPercentages = {
    left: clamp(input.left),
    center: clamp(input.center),
    right: clamp(input.right),
  };

  const total = raw.left + raw.center + raw.right;

  if (total === 0) {
    return { left: 0, center: 100, right: 0 };
  }

  const scaled = [
    { key: "left" as const, value: (raw.left / total) * 100 },
    { key: "center" as const, value: (raw.center / total) * 100 },
    { key: "right" as const, value: (raw.right / total) * 100 },
  ];

  const result: BiasPercentages = { left: 0, center: 0, right: 0 };
  for (const part of scaled) {
    result[part.key] = Math.floor(part.value);
  }

  let remainder = 100 - (result.left + result.center + result.right);
  const byRemainder = [...scaled].sort(
    (a, b) => (b.value % 1) - (a.value % 1)
  );

  let index = 0;
  while (remainder > 0) {
    result[byRemainder[index % byRemainder.length].key] += 1;
    remainder -= 1;
    index += 1;
  }

  return result;
}
