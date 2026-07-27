import type { Scorer, ScoreContext, ScorerSpec } from "../types.js";
import { result } from "./util.js";

/**
 * Passes when the call latency is within a budget.
 *
 * The score degrades linearly: full credit at or under budget, zero credit at
 * or above `2 x budget`.
 *
 * Options:
 *  - `budgetMs`: the maximum acceptable latency in milliseconds (required)
 */
export const latencyScorer: Scorer = {
  type: "latency",
  score(spec: ScorerSpec, ctx: ScoreContext) {
    const budgetMs = Number(spec.budgetMs);
    if (!Number.isFinite(budgetMs) || budgetMs <= 0) {
      return result(spec, { score: 0, passed: false, reason: "invalid or missing budgetMs" });
    }
    const actual = ctx.response.latencyMs;
    const passed = actual <= budgetMs;
    // Linear falloff from budget to 2x budget.
    const score = actual <= budgetMs ? 1 : Math.max(0, 1 - (actual - budgetMs) / budgetMs);
    return result(spec, {
      score,
      passed,
      reason: `${actual}ms vs budget ${budgetMs}ms`,
    });
  },
};
