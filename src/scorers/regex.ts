import type { Scorer, ScoreContext, ScorerSpec } from "../types.js";
import { result } from "./util.js";

/**
 * Passes when the output matches a regular expression.
 *
 * Options:
 *  - `pattern`: the regex source string (required)
 *  - `flags`: regex flags, default "" (e.g. "i", "m", "s")
 *  - `expectMatch`: when false, passes only if the pattern does NOT match
 */
export const regexScorer: Scorer = {
  type: "regex",
  score(spec: ScorerSpec, ctx: ScoreContext) {
    const pattern = spec.pattern as string | undefined;
    if (!pattern) {
      return result(spec, { score: 0, passed: false, reason: "no pattern provided" });
    }
    const expectMatch = spec.expectMatch !== false;
    let re: RegExp;
    try {
      re = new RegExp(pattern, (spec.flags as string) ?? "");
    } catch (err) {
      return result(spec, {
        score: 0,
        passed: false,
        reason: `invalid regex: ${(err as Error).message}`,
      });
    }
    const matched = re.test(ctx.output);
    const passed = matched === expectMatch;
    return result(spec, {
      score: passed ? 1 : 0,
      passed,
      reason: passed
        ? `pattern /${pattern}/ ${expectMatch ? "matched" : "did not match"} as expected`
        : `pattern /${pattern}/ ${matched ? "matched" : "did not match"}, expected the opposite`,
    });
  },
};
