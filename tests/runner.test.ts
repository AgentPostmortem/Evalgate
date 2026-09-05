import { describe, it, expect } from "vitest";
import type { EvalSuite, ProviderRequest } from "../src/types.js";
import { runSuite, runCase, aggregateScore } from "../src/runner.js";
import { ProviderRegistry } from "../src/providers/registry.js";

const suite: EvalSuite = {
  name: "unit",
  provider: "mock",
  model: "mock",
  threshold: 0.9,
  cases: [
    {
      id: "ok",
      input: { prompt: "exactly: hello" },
      expected: "hello",
      scorers: [{ type: "exact-match" }],
      tags: ["smoke"],
    },
    {
      id: "weighted",
      input: { prompt: "echo: alpha beta" },
      scorers: [
        { type: "contains", value: "alpha", weight: 3 },
        { type: "contains", value: "zzz", weight: 1 },
      ],
    },
  ],
};

describe("aggregateScore", () => {
  it("computes a weighted mean", () => {
    const score = aggregateScore([
      { type: "a", name: "a", score: 1, passed: true, weight: 3, reason: "" },
      { type: "b", name: "b", score: 0, passed: false, weight: 1, reason: "" },
    ]);
    expect(score).toBeCloseTo(0.75);
  });
  it("returns 0 when all weights are zero", () => {
    expect(aggregateScore([{ type: "a", name: "a", score: 1, passed: true, weight: 0, reason: "" }])).toBe(0);
  });
});

describe("runSuite", () => {
  it("runs all cases and aggregates results", async () => {
    const res = await runSuite(suite);
    expect(res.total).toBe(2);
    expect(res.cases[0]!.passed).toBe(true);
    // Weighted case: 3/4 present -> passed false but partial score.
    const weighted = res.cases.find((c) => c.id === "weighted")!;
    expect(weighted.passed).toBe(false);
    expect(weighted.score).toBeCloseTo(0.75);
  });

  it("marks the run failed when a case fails", async () => {
    const res = await runSuite(suite);
    expect(res.passed).toBe(false);
    expect(res.passedCount).toBe(1);
  });

  it("filters by tag", async () => {
    const res = await runSuite(suite, { filterTags: ["smoke"] });
    expect(res.total).toBe(1);
    expect(res.cases[0]!.id).toBe("ok");
  });

  it("fires the onCase callback per case", async () => {
    const seen: string[] = [];
    await runSuite(suite, { onCase: (c) => seen.push(c.id) });
    expect(seen).toEqual(["ok", "weighted"]);
  });

  it("passes when every case passes and threshold met", async () => {
    const clean: EvalSuite = {
      name: "clean",
      provider: "mock",
      model: "mock",
      cases: [{ id: "a", input: { prompt: "exactly: hi" }, expected: "hi", scorers: [{ type: "exact-match" }] }],
    };
    const res = await runSuite(clean);
    expect(res.passed).toBe(true);
  });
});

describe("runCase", () => {
  it("resolves provider and model precedence", async () => {
    const res = await runCase(
      { id: "x", input: { prompt: "exactly: y" }, expected: "y", scorers: [{ type: "exact-match" }] },
      suite,
    );
    expect(res.provider).toBe("mock");
    expect(res.passed).toBe(true);
  });

  it("resolves case, suite, and default sampling options", async () => {
    const requests: ProviderRequest[] = [];
    const providers = new ProviderRegistry().register("capture", () => ({
      name: "capture",
      async complete(request) {
        requests.push(request);
        return { output: "y", latencyMs: 0, model: request.model };
      },
    }));
    const samplingSuite: EvalSuite = {
      name: "sampling",
      provider: "capture",
      model: "capture-model",
      temperature: 0.2,
      maxTokens: 128,
      cases: [],
    };
    const baseCase = {
      id: "x",
      input: { prompt: "exactly: y" },
      expected: "y",
      scorers: [{ type: "exact-match" }],
    };

    await runCase({ ...baseCase, temperature: 0.7, maxTokens: 64 }, samplingSuite, { providers });
    await runCase(baseCase, samplingSuite, { providers });
    await runCase(baseCase, { ...samplingSuite, temperature: undefined, maxTokens: undefined }, { providers });

    expect(requests.map(({ temperature, maxTokens }) => ({ temperature, maxTokens }))).toEqual([
      { temperature: 0.7, maxTokens: 64 },
      { temperature: 0.2, maxTokens: 128 },
      { temperature: 0, maxTokens: undefined },
    ]);
  });
});
