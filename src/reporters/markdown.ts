import type { RunResult } from "../types.js";
import type { CaseDelta, CompareResult } from "../compare.js";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const pp = (d: number) => `${d > 0 ? "+" : ""}${(d * 100).toFixed(1)}pp`;

/** Render a run result as a standalone Markdown report. */
export function renderRunMarkdown(run: RunResult): string {
  const verdict = run.passed ? "PASSED" : "FAILED";
  const lines: string[] = [];
  lines.push(`## evalgate report: ${run.suite}`);
  lines.push("");
  lines.push(`**${verdict}** - ${run.passedCount}/${run.total} cases passed, mean score **${pct(run.score)}**`);
  lines.push("");
  lines.push("| Case | Score | Result | Notes |");
  lines.push("| --- | --- | --- | --- |");
  for (const cse of run.cases) {
    const failing = cse.scores.filter((s) => !s.passed).map((s) => s.name);
    const notes = failing.length ? `failed: ${failing.join(", ")}` : "all scorers passed";
    lines.push(`| \`${cse.id}\` | ${pct(cse.score)} | ${cse.passed ? "pass" : "fail"} | ${notes} |`);
  }
  lines.push("");
  lines.push(
    `_latency ${run.latencyMs}ms total, cost $${run.costUsd.toFixed(6)} total_`,
  );
  return lines.join("\n");
}

function changeBadge(change: CaseDelta["change"]): string {
  switch (change) {
    case "regressed":
      return "down";
    case "improved":
      return "up";
    case "added":
      return "new";
    case "removed":
      return "gone";
    default:
      return "flat";
  }
}

/**
 * Render a comparison as Markdown suitable for a PR comment. Includes a summary
 * line, an overall delta, and a per-case table sorted worst-first.
 */
export function renderCompareMarkdown(cmp: CompareResult, suiteName?: string): string {
  const lines: string[] = [];
  const title = suiteName ? `evalgate: ${suiteName}` : "evalgate report";
  const headline = cmp.regressed
    ? `Quality regressed. ${cmp.regressions.length} case(s) got worse.`
    : "No regressions detected.";

  lines.push(`### ${title}`);
  lines.push("");
  lines.push(`${cmp.regressed ? "**FAIL**" : "**PASS**"} - ${headline}`);
  lines.push("");
  lines.push(
    `Overall score: **${pct(cmp.baseScore)}** (base) -> **${pct(cmp.headScore)}** (head) = **${pp(cmp.overallDelta)}**`,
  );
  lines.push("");
  lines.push("| Case | Base | Head | Delta | Change |");
  lines.push("| --- | --- | --- | --- | --- |");

  const shown = cmp.cases.filter((c) => c.change !== "unchanged");
  const rows = shown.length > 0 ? shown : cmp.cases;
  for (const d of rows) {
    const b = d.baseScore === null ? "-" : pct(d.baseScore);
    const h = d.headScore === null ? "-" : pct(d.headScore);
    lines.push(`| \`${d.id}\` | ${b} | ${h} | ${pp(d.delta)} | ${changeBadge(d.change)} |`);
  }

  if (shown.length === 0) {
    lines.push("");
    lines.push("_All cases unchanged._");
  }

  lines.push("");
  lines.push(`_tolerance ${pct(cmp.tolerance)} - worst case ${pp(cmp.worstRegression)}_`);
  lines.push("");
  lines.push("<sub>Posted by evalgate - the build fails when your prompt gets dumber.</sub>");
  return lines.join("\n");
}
