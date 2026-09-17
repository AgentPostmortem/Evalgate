import type { Scorer, ScoreContext, ScorerSpec } from "../types.js";
import { result } from "./util.js";

/**
 * Passes when the output's length is within word (and/or char) bounds.
 *
 * The score is full credit inside the bounds and falls off linearly to zero
 * outside them, mirroring {@link latencyScorer}'s curve: the farther past the
 * bound, the lower the credit, reaching 0 at `2x` the bound.
 *
 * Options:
 *  - `minWords`: minimum word count (optional)
 *  - `maxWords`: maximum word count (optional)
 *  - `minChars`: minimum character count (optional)
 *  - `maxChars`: maximum character count (optional)
 */
export const wordCountScorer: Scorer = {
  type: "word-count",
  score(spec: ScorerSpec, ctx: ScoreContext) {
    const bounds = readBounds(spec);
    if (!bounds) {
      return result(spec, {
        score: 0,
        passed: false,
        reason: "at least one of minWords/maxWords/minChars/maxChars required",
      });
    }
    const words = ctx.output.trim().split(/\s+/).filter(Boolean).length;
    const chars = [...ctx.output].length;

    const tests = [
      { kind: "words", value: words, min: bounds.minWords, max: bounds.maxWords },
      { kind: "chars", value: chars, min: bounds.minChars, max: bounds.maxChars },
    ];

    const offending = tests.find((t) => t.min != null || t.max != null)
      ? tests.filter((t) => t.min != null || t.max != null)
      : [];
    for (const t of offending) {
      if (t.min != null && t.value < t.min) return falloff(spec, t.kind, t.value, `below min ${t.min}`, t.min, false);
      if (t.max != null && t.value > t.max) return falloff(spec, t.kind, t.value, `above max ${t.max}`, t.max, true);
    }

    return result(spec, {
      score: 1,
      passed: true,
      reason: `${words} word(s), ${chars} char(s) within bounds`,
    });
  },
};

function falloff(
  spec: ScorerSpec,
  kind: string,
  value: number,
  detail: string,
  bound: number,
  isMax: boolean,
) {
  const damage = isMax ? (value - bound) / bound : (bound - value) / bound;
  const score = Math.max(0, 1 - damage);
  return result(spec, {
    score,
    passed: false,
    reason: `${kind}: ${value}, ${detail} (credit ${score.toFixed(2)})`,
  });
}

function readBounds(spec: ScorerSpec): { minWords?: number; maxWords?: number; minChars?: number; maxChars?: number } | null {
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
  const bounds = {
    minWords: num(spec.minWords),
    maxWords: num(spec.maxWords),
    minChars: num(spec.minChars),
    maxChars: num(spec.maxChars),
  };
  const any = bounds.minWords != null || bounds.maxWords != null || bounds.minChars != null || bounds.maxChars != null;
  if (!any) return null;
  if (bounds.minWords != null && bounds.maxWords != null && bounds.minWords > bounds.maxWords) return null;
  if (bounds.minChars != null && bounds.maxChars != null && bounds.minChars > bounds.maxChars) return null;
  return bounds;
}