import { describe, it, expect } from "vitest";
import { runSuite } from "../src/runner.js";
import { renderRunJUnit } from "../src/reporters/junit.js";
import type { EvalSuite } from "../src/types.js";

const suite: EvalSuite = {
  name: "junit & <friends>",
  provider: "mock",
  model: "mock",
  cases: [
    { id: "ok", input: { prompt: "exactly: hi" }, expected: "hi", scorers: [{ type: "exact-match" }] },
    { id: "bad", input: { prompt: "exactly: no" }, expected: "yes", scorers: [{ type: "exact-match" }] },
  ],
};

describe("renderRunJUnit", () => {
  it("emits a testsuite with per-case testcases and failures", async () => {
    const run = await runSuite(suite);
    const xml = renderRunJUnit(run);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('tests="2"');
    expect(xml).toContain('failures="1"');
    expect(xml).toContain('name="ok"');
    expect(xml).toContain("<failure");
  });

  it("escapes XML-sensitive characters", async () => {
    const run = await runSuite(suite);
    const xml = renderRunJUnit(run);
    expect(xml).toContain("junit &amp; &lt;friends&gt;");
    expect(xml).not.toContain("<friends>");
  });
});
