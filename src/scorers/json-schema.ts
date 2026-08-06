import type { Scorer, ScoreContext, ScorerSpec } from "../types.js";
import { result } from "./util.js";

/** A minimal subset of JSON Schema supported by the validator below. */
export interface JsonSchema {
  type?: "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean;
}

/**
 * A small, dependency-free JSON Schema validator. It supports the common
 * keywords needed for structured-output evals. Returns a list of error strings;
 * an empty list means the value is valid.
 */
export function validate(value: unknown, schema: JsonSchema, path = "$"): string[] {
  const errors: string[] = [];

  if (schema.enum && !schema.enum.some((e) => deepEqual(e, value))) {
    errors.push(`${path}: value not in enum`);
  }

  const t = schema.type;
  if (t) {
    const ok =
      (t === "object" && isPlainObject(value)) ||
      (t === "array" && Array.isArray(value)) ||
      (t === "string" && typeof value === "string") ||
      (t === "number" && typeof value === "number") ||
      (t === "integer" && typeof value === "number" && Number.isInteger(value)) ||
      (t === "boolean" && typeof value === "boolean") ||
      (t === "null" && value === null);
    if (!ok) {
      errors.push(`${path}: expected ${t}`);
      return errors; // Further checks are meaningless on the wrong type.
    }
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum)
      errors.push(`${path}: ${value} < minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum)
      errors.push(`${path}: ${value} > maximum ${schema.maximum}`);
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength)
      errors.push(`${path}: shorter than minLength ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength)
      errors.push(`${path}: longer than maxLength ${schema.maxLength}`);
    if (schema.pattern) {
      try {
        if (!new RegExp(schema.pattern).test(value))
          errors.push(`${path}: does not match pattern ${schema.pattern}`);
      } catch (err) {
        errors.push(`${path}: invalid pattern ${schema.pattern}: ${(err as Error).message}`);
      }
    }
  }

  if (isPlainObject(value)) {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}.${key}: required`);
    }
    if (schema.properties) {
      for (const [key, sub] of Object.entries(schema.properties)) {
        if (key in value) errors.push(...validate((value as any)[key], sub, `${path}.${key}`));
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) errors.push(`${path}.${key}: additional property not allowed`);
      }
    }
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) => errors.push(...validate(item, schema.items!, `${path}[${i}]`)));
  }

  return errors;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Passes when the output parses as JSON and (optionally) validates against a
 * provided schema.
 *
 * Options:
 *  - `schema`: a JSON Schema object to validate against (optional)
 */
export const jsonSchemaScorer: Scorer = {
  type: "json-schema",
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
    if (!schema) {
      return result(spec, { score: 1, passed: true, reason: "output is valid JSON" });
    }
    const errors = validate(parsed, schema);
    const passed = errors.length === 0;
    return result(spec, {
      score: passed ? 1 : 0,
      passed,
      reason: passed ? "output validates against schema" : errors.join("; "),
    });
  },
};
