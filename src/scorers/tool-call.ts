import type { Scorer, ScoreContext, ScorerSpec } from "../types.js";
import { result } from "./util.js";
import { validate, type JsonSchema } from "./json-schema.js";

/**
 * Passes when the output parses as JSON describing a callable tool action,
 * with a `name` on an allowlist and an `arguments` plain object.
 *
 * Options:
 *  - `allowedTools`: list of tool names the model may call (required)
 *  - `schemas`: per-tool JSON Schema applied to `arguments` (optional)
 */
export const toolCallScorer: Scorer = {
  type: "tool-call",
  score(spec: ScorerSpec, ctx: ScoreContext) {
    const allowedTools = spec.allowedTools as string[] | undefined;
    if (!Array.isArray(allowedTools) || allowedTools.length === 0) {
      return result(spec, {
        score: 0,
        passed: false,
        reason: "allowedTools must be a non-empty list",
      });
    }

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

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return result(spec, {
        score: 0,
        passed: false,
        reason: "output must be a JSON object with name and arguments",
      });
    }

    const call = parsed as Record<string, unknown>;
    const name = call.name;
    if (typeof name !== "string") {
      return result(spec, {
        score: 0,
        passed: false,
        reason: "output must have a string name",
      });
    }
    if (!allowedTools.includes(name)) {
      return result(spec, {
        score: 0,
        passed: false,
        reason: `tool "${name}" is not in allowedTools`,
      });
    }

    const args = call.arguments;
    if (typeof args !== "object" || args === null || Array.isArray(args)) {
      return result(spec, {
        score: 0,
        passed: false,
        reason: "arguments must be a plain object",
      });
    }

    const schemas = (spec.schemas ?? {}) as Record<string, JsonSchema>;
    const schema = schemas[name];
    if (schema) {
      const errors = validate(args, schema);
      if (errors.length > 0) {
        return result(spec, {
          score: 0,
          passed: false,
          reason: errors.join("; "),
        });
      }
    }

    return result(spec, {
      score: 1,
      passed: true,
      reason: `calls allowed tool "${name}"`,
    });
  },
};