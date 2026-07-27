import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadSuite } from "../src/suite.js";
import { runSuite } from "../src/runner.js";
import { compareRuns } from "../src/compare.js";
import { defaultRegistry } from "../src/providers/registry.js";
import { MockProvider } from "../src/providers/mock.js";
import { renderCompareMarkdown } from "../src/reporters/markdown.js";

const here = dirname(fileURLToPath(import.meta.url));
const ex = (name: string) => resolve(here, "..", "examples", name);

describe("example suites (integration)", () => {
  it("support-agent passes on the mock provider", async () => {
    const suite = await loadSuite(ex("support-agent.eval.yaml"));
    const res = await runSuite(suite);
    expect(res.passed).toBe(true);
    expect(res.total).toBe(7);
  });

  it("summarizer passes on the mock provider", async () => {
    const suite = await loadSuite(ex("summarizer.eval.json"));
    const res = await runSuite(suite);
    expect(res.passed).toBe(true);
  });

  it("a degraded model regresses against the clean baseline", async () => {
    const suite = await loadSuite(ex("support-agent.eval.yaml"));
    const baseline = await runSuite(suite);

    const degraded = defaultRegistry();
    degraded.register("mock", () => new MockProvider({ degrade: true }));
    const head = await runSuite(suite, { providers: degraded });

    const cmp = compareRuns(baseline, head, { tolerance: 0.01 });
    expect(cmp.regressed).toBe(true);
    expect(cmp.headScore).toBeLessThan(cmp.baseScore);

    const md = renderCompareMarkdown(cmp, suite.name);
    expect(md).toContain("Quality regressed");
  });
});
