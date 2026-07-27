import type { EvalCase } from "./types.js";

/** A flat map of template variables. */
export type Vars = Record<string, string | number | boolean>;

/**
 * Substitute `{{name}}` placeholders in a string with values from `vars`.
 * Unknown placeholders are left untouched so mistakes are visible in reports.
 */
export function renderTemplate(text: string, vars: Vars): string {
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (whole, key: string) => {
    const v = vars[key];
    return v === undefined ? whole : String(v);
  });
}

/**
 * Return a copy of a case with all `{{var}}` placeholders in its prompt,
 * messages, and expected value resolved against the merged variable map.
 * Case-level vars override suite-level vars.
 */
export function resolveCase(c: EvalCase, suiteVars: Vars = {}): EvalCase {
  const vars: Vars = { ...suiteVars, ...(c.vars ?? {}) };
  if (Object.keys(vars).length === 0) return c;

  return {
    ...c,
    input: {
      prompt: c.input.prompt !== undefined ? renderTemplate(c.input.prompt, vars) : undefined,
      messages: c.input.messages?.map((m) => ({ ...m, content: renderTemplate(m.content, vars) })),
    },
    expected: c.expected !== undefined ? renderTemplate(c.expected, vars) : undefined,
  };
}
