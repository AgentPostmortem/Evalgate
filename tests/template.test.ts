import { describe, it, expect } from "vitest";
import { renderTemplate, resolveCase } from "../src/template.js";
import { runSuite } from "../src/runner.js";
import type { EvalCase, EvalSuite } from "../src/types.js";

describe("renderTemplate", () => {
  it("substitutes known vars and leaves unknown ones", () => {
    expect(renderTemplate("hi {{name}} {{missing}}", { name: "Ada" })).toBe("hi Ada {{missing}}");
  });
  it("coerces non-string values", () => {
    expect(renderTemplate("n={{n}} b={{b}}", { n: 3, b: true })).toBe("n=3 b=true");
  });
});

describe("resolveCase", () => {
  const base: EvalCase = {
    id: "c",
    input: { prompt: "echo: {{word}}" },
    expected: "{{word}}",
    scorers: [{ type: "exact-match" }],
  };

  it("merges suite and case vars with case precedence", () => {
    const resolved = resolveCase({ ...base, vars: { word: "case" } }, { word: "suite" });
    expect(resolved.input.prompt).toBe("echo: case");
    expect(resolved.expected).toBe("case");
  });

  it("returns the same object when there are no vars", () => {
    expect(resolveCase(base, {})).toBe(base);
  });
});

describe("templating end-to-end", () => {
  it("resolves vars before running scorers", async () => {
    const suite: EvalSuite = {
      name: "vars",
      provider: "mock",
      model: "mock",
      vars: { word: "hello" },
      cases: [
        {
          id: "c",
          input: { prompt: "exactly: {{word}}" },
          expected: "{{word}}",
          scorers: [{ type: "exact-match" }],
        },
      ],
    };
    const res = await runSuite(suite);
    expect(res.cases[0]!.output).toBe("hello");
    expect(res.cases[0]!.passed).toBe(true);
  });
});

describe("concurrency preserves order and results", () => {
  const suite: EvalSuite = {
    name: "conc",
    provider: "mock",
    model: "mock",
    cases: Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`,
      input: { prompt: `exactly: v${i}` },
      expected: `v${i}`,
      scorers: [{ type: "exact-match" as const }],
    })),
  };

  it("gives identical results at concurrency 1 and 4", async () => {
    const seq = await runSuite(suite, { concurrency: 1 });
    const par = await runSuite(suite, { concurrency: 4 });
    expect(par.cases.map((c) => c.id)).toEqual(seq.cases.map((c) => c.id));
    expect(par.passedCount).toBe(seq.passedCount);
    expect(par.score).toBeCloseTo(seq.score);
  });
});
