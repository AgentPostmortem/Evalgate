import type { Scorer, ScoreContext, ScorerSpec } from "../types.js";
import { normalize, result } from "./util.js";

/**
 * Passes when the output equals the expected value. Supports case-insensitive
 * and whitespace-normalized comparison via options.
 *
 * Options:
 *  - `expected`: the value to match (falls back to `case.expected`)
 *  - `caseSensitive`: default false
 *  - `trim`: default true
 *  - `collapseWhitespace`: default true
 */
export const exactMatchScorer: Scorer = {
  type: "exact-match",
  score(spec: ScorerSpec, ctx: ScoreContext) {
    const expected = (spec.expected as string | undefined) ?? ctx.case.expected;
    if (expected === undefined) {
      return result(spec, {
        score: 0,
        passed: false,
        reason: "no expected value provided",
      });
    }
    const caseSensitive = spec.caseSensitive === true;
    const trim = spec.trim !== false;
    const collapseWhitespace = spec.collapseWhitespace !== false;
    const a = normalize(ctx.output, { caseSensitive, trim, collapseWhitespace });
    const b = normalize(expected, { caseSensitive, trim, collapseWhitespace });
    const passed = a === b;
    return result(spec, {
      score: passed ? 1 : 0,
      passed,
      reason: passed
        ? "output exactly matched expected"
        : `expected "${expected}" but got "${ctx.output}"`,
    });
  },
};
