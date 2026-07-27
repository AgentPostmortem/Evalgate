import type { RunResult } from "../types.js";

/** Escape a string for safe inclusion in XML attributes and text. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Render a run result as JUnit XML. Each case becomes a `<testcase>`; failed
 * scorers are reported as `<failure>` entries. Many CI systems render this in a
 * dedicated test tab, so evals show up next to unit tests.
 */
export function renderRunJUnit(run: RunResult): string {
  const failures = run.total - run.passedCount;
  const time = (run.latencyMs / 1000).toFixed(3);
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<testsuite name="${xmlEscape(run.suite)}" tests="${run.total}" failures="${failures}" time="${time}">`,
  );
  for (const c of run.cases) {
    const t = (c.latencyMs / 1000).toFixed(3);
    lines.push(`  <testcase name="${xmlEscape(c.id)}" classname="evalgate" time="${t}">`);
    if (!c.passed) {
      const failed = c.scores.filter((s) => !s.passed);
      const message = failed.map((s) => `${s.name}: ${s.reason}`).join(" | ");
      lines.push(`    <failure message="${xmlEscape(message)}">score ${c.score.toFixed(3)}</failure>`);
    }
    lines.push("  </testcase>");
  }
  lines.push("</testsuite>");
  return lines.join("\n");
}
