import type { Scorer, ScoreContext, ScorerSpec } from "../types.js";
import { result } from "./util.js";

/**
 * Passes when the estimated call cost is within a budget.
 *
 * Options:
 *  - `budgetUsd`: the maximum acceptable cost in USD (required)
 */
export const costScorer: Scorer = {
  type: "cost",
  score(spec: ScorerSpec, ctx: ScoreContext) {
    const budgetUsd = Number(spec.budgetUsd);
    if (!Number.isFinite(budgetUsd) || budgetUsd <= 0) {
      return result(spec, { score: 0, passed: false, reason: "invalid or missing budgetUsd" });
    }
    const actual = ctx.response.costUsd ?? 0;
    const passed = actual <= budgetUsd;
    const score = actual <= budgetUsd ? 1 : Math.max(0, 1 - (actual - budgetUsd) / budgetUsd);
    return result(spec, {
      score,
      passed,
      reason: `$${actual.toFixed(6)} vs budget $${budgetUsd.toFixed(6)}`,
    });
  },
};
