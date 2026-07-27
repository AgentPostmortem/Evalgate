import { describe, it, expect } from "vitest";
import { runSuite } from "../src/runner.js";
import { compareRuns } from "../src/compare.js";
import { renderRunMarkdown, renderCompareMarkdown } from "../src/reporters/markdown.js";
import { renderRunTerminal, renderCompareTerminal } from "../src/reporters/terminal.js";
import { COMMENT_MARKER, contextFromEnv } from "../src/github.js";
import type { EvalSuite } from "../src/types.js";

const suite: EvalSuite = {
  name: "rep",
  provider: "mock",
  model: "mock",
  cases: [
    { id: "ok", input: { prompt: "exactly: hi" }, expected: "hi", scorers: [{ type: "exact-match" }] },
    { id: "bad", input: { prompt: "exactly: no" }, expected: "yes", scorers: [{ type: "exact-match" }] },
  ],
};

describe("reporters", () => {
  it("markdown run report includes a table and verdict", async () => {
    const run = await runSuite(suite);
    const md = renderRunMarkdown(run);
    expect(md).toContain("| Case | Score | Result | Notes |");
    expect(md).toContain("`ok`");
    expect(md).toContain("FAILED");
  });

  it("markdown compare report includes deltas and the marker-free body", async () => {
    const base = await runSuite(suite);
    const head = await runSuite(suite);
    const cmp = compareRuns(base, head);
    const md = renderCompareMarkdown(cmp, "rep");
    expect(md).toContain("evalgate: rep");
    expect(md).toContain("| Case | Base | Head | Delta | Change |");
  });

  it("terminal reports render without throwing", async () => {
    const run = await runSuite(suite);
    expect(renderRunTerminal(run)).toContain("evalgate");
    const cmp = compareRuns(run, run);
    expect(renderCompareTerminal(cmp)).toContain("comparison");
  });
});

describe("github context", () => {
  it("returns null without env", () => {
    expect(contextFromEnv({})).toBeNull();
  });
  it("parses owner/repo and PR number", () => {
    const ctx = contextFromEnv({
      GITHUB_TOKEN: "t",
      GITHUB_REPOSITORY: "acme/widgets",
      GITHUB_REF: "refs/pull/42/merge",
    });
    expect(ctx).not.toBeNull();
    expect(ctx!.owner).toBe("acme");
    expect(ctx!.repo).toBe("widgets");
    expect(ctx!.prNumber).toBe(42);
  });
  it("exposes a stable comment marker", () => {
    expect(COMMENT_MARKER).toContain("evalgate");
  });
});
