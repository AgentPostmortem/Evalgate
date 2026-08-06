import type { ScoreResult, ScorerSpec } from "../types.js";

/** Clamp a number into the [0, 1] range. */
export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Read the weight from a spec, defaulting to 1 and rejecting negatives. */
export function specWeight(spec: ScorerSpec): number {
  const w = typeof spec.weight === "number" ? spec.weight : 1;
  return w < 0 ? 0 : w;
}

/** Convenience builder that fills in the boilerplate of a {@link ScoreResult}. */
export function result(
  spec: ScorerSpec,
  fields: { score: number; passed: boolean; reason: string },
): ScoreResult {
  const score = clamp01(fields.score);
  return {
    type: spec.type,
    name: spec.name ?? spec.type,
    score,
    passed: fields.passed,
    weight: specWeight(spec),
    reason: fields.reason,
  };
}

/** Normalize text for lenient comparisons (trim + collapse whitespace). */
export function normalize(
  text: string,
  opts: { caseSensitive?: boolean; trim?: boolean; collapseWhitespace?: boolean } = {},
): string {
  let out = text;
  if (opts.trim !== false) out = out.trim();
  if (!opts.caseSensitive) out = out.toLowerCase();
  return opts.collapseWhitespace === false ? out : out.replace(/\s+/g, " ");
}
