import type { Scorer, ScoreContext, ScorerSpec } from "../types.js";
import { result } from "./util.js";
import { validate, type JsonSchema } from "./json-schema.js";

/**
 * Passes when the output parses as JSON, validates against an optional schema,
 * and carries at least one non-empty leaf value.
 *
 * Catches models gaming structured-output evals with vacuous payloads like
 * `{}`, `{"answer": ""}`, or all-null objects that still validate against the
 * schema.
 *
 * Options:
 *  - `schema`: a JSON Schema object to validate against (optional)
 *  - `minKeys`: minimum number of non-empty leaf values required (default 1)
 *  - `rejectBlankStrings`: treat `""` and whitespace-only strings as empty values (default true)
 *  - `rejectNulls`: treat `null` as an empty value (default true)
 */
export const jsonNonemptyScorer: Scorer = {
  type: "json-nonempty",
  score(spec: ScorerSpec, ctx: ScoreContext) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(ctx.output);
    } catch (err) {
      return result(spec, {
        score: 0,
        passed: false,
        reason: `output is not valid JSON: ${(err as Error).message}`,
      });
    }
    const schema = spec.schema as JsonSchema | undefined;
    if (schema) {
      const errors = validate(parsed, schema);
      if (errors.length > 0) {
        return result(spec, {
          score: 0,
          passed: false,
          reason: errors.join("; "),
        });
      }
    }

    const minKeys = typeof spec.minKeys === "number" ? spec.minKeys : 1;
    const rejectBlankStrings = spec.rejectBlankStrings !== false;
    const rejectNulls = spec.rejectNulls !== false;
    const nonEmpty = countNonEmptyLeaves(parsed, rejectBlankStrings, rejectNulls);

    if (nonEmpty < minKeys) {
      return result(spec, {
        score: 0,
        passed: false,
        reason: `output has ${nonEmpty} non-empty value(s), need at least ${minKeys}`,
      });
    }
    return result(spec, {
      score: 1,
      passed: true,
      reason: "output is non-empty JSON",
    });
  },
};

function countNonEmptyLeaves(value: unknown, rejectBlankStrings: boolean, rejectNulls: boolean): number {
  if (typeof value === "string") {
    const blank = rejectBlankStrings ? value.trim().length === 0 : false;
    return blank ? 0 : 1;
  }
  if (value === null) return rejectNulls ? 0 : 1;
  if (Array.isArray(value)) {
    return value.reduce((n, item) => n + countNonEmptyLeaves(item, rejectBlankStrings, rejectNulls), 0);
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return 0;
    return keys.reduce(
      (n, key) => n + countNonEmptyLeaves(obj[key], rejectBlankStrings, rejectNulls),
      0,
    );
  }
  return 1; // booleans and numbers are non-empty
}