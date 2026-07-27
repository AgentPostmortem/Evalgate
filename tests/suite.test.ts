import { describe, it, expect } from "vitest";
import { parseSuite, validateSuite, SuiteValidationError } from "../src/suite.js";

describe("suite parsing", () => {
  it("parses a minimal YAML suite", () => {
    const yaml = `
name: demo
cases:
  - id: c1
    input:
      prompt: "hi"
    scorers:
      - type: exact-match
        expected: hi
`;
    const suite = parseSuite(yaml, "demo.yaml");
    expect(suite.name).toBe("demo");
    expect(suite.cases).toHaveLength(1);
    expect(suite.cases[0]!.scorers[0]!.type).toBe("exact-match");
  });

  it("parses JSON suites", () => {
    const json = JSON.stringify({
      name: "j",
      cases: [{ id: "a", input: { prompt: "x" }, scorers: [{ type: "regex", pattern: "x" }] }],
    });
    const suite = parseSuite(json, "s.json");
    expect(suite.cases[0]!.id).toBe("a");
  });

  it("rejects a suite without a name", () => {
    expect(() => validateSuite({ cases: [] })).toThrow(SuiteValidationError);
  });

  it("rejects duplicate case ids", () => {
    expect(() =>
      validateSuite({
        name: "d",
        cases: [
          { id: "x", input: { prompt: "a" }, scorers: [{ type: "regex" }] },
          { id: "x", input: { prompt: "b" }, scorers: [{ type: "regex" }] },
        ],
      }),
    ).toThrow(/duplicate case id/);
  });

  it("rejects a case with no scorers", () => {
    expect(() =>
      validateSuite({ name: "d", cases: [{ id: "x", input: { prompt: "a" }, scorers: [] }] }),
    ).toThrow(/at least one scorer/);
  });

  it("rejects an out-of-range threshold", () => {
    expect(() =>
      validateSuite({
        name: "d",
        threshold: 2,
        cases: [{ id: "x", input: { prompt: "a" }, scorers: [{ type: "regex" }] }],
      }),
    ).toThrow(/threshold/);
  });
});
