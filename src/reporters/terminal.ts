import type { RunResult } from "../types.js";
import type { CompareResult } from "../compare.js";

// Minimal ANSI helpers; disabled automatically when not a TTY or NO_COLOR set.
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: number, s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = (s: string) => c(32, s);
const red = (s: string) => c(31, s);
const yellow = (s: string) => c(33, s);
const dim = (s: string) => c(2, s);
const bold = (s: string) => c(1, s);

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Render a run result as a colorized terminal report. */
export function renderRunTerminal(run: RunResult): string {
  const lines: string[] = [];
  lines.push(bold(`\nevalgate - ${run.suite}`));
  lines.push(dim(`${run.timestamp}`));
  lines.push("");

  for (const cse of run.cases) {
    const mark = cse.passed ? green("PASS") : red("FAIL");
    lines.push(`${mark} ${bold(cse.id)} ${dim(`score ${pct(cse.score)}`)}`);
    for (const s of cse.scores) {
      const smark = s.passed ? green("ok") : red("x");
      lines.push(`   ${smark} ${s.name} ${dim(`(${pct(s.score)})`)} - ${s.reason}`);
    }
  }

  lines.push("");
  const verdict = run.passed ? green("PASSED") : red("FAILED");
  const thr = run.threshold !== undefined ? ` (threshold ${pct(run.threshold)})` : "";
  lines.push(
    `${verdict} ${run.passedCount}/${run.total} cases | mean score ${bold(pct(run.score))}${thr}`,
  );
  lines.push(
    dim(`latency ${run.latencyMs}ms total | cost $${run.costUsd.toFixed(6)} total`),
  );
  return lines.join("\n");
}

const arrow = (d: number) => (d > 0 ? "+" : "") + (d * 100).toFixed(1) + "pp";

/** Render a comparison as a colorized terminal report. */
export function renderCompareTerminal(cmp: CompareResult): string {
  const lines: string[] = [];
  lines.push(bold("\nevalgate - baseline comparison"));
  lines.push(
    `base ${pct(cmp.baseScore)} -> head ${pct(cmp.headScore)} (${arrow(cmp.overallDelta)})`,
  );
  lines.push("");

  for (const d of cmp.cases) {
    if (d.change === "unchanged") continue;
    const color =
      d.change === "regressed" ? red : d.change === "improved" ? green : yellow;
    const b = d.baseScore === null ? "-" : pct(d.baseScore);
    const h = d.headScore === null ? "-" : pct(d.headScore);
    lines.push(`${color(d.change.toUpperCase().padEnd(10))} ${bold(d.id)} ${dim(`${b} -> ${h} (${arrow(d.delta)})`)}`);
  }

  lines.push("");
  if (cmp.regressed) {
    lines.push(red(`REGRESSION: ${cmp.regressions.length} case(s) got worse. Build should fail.`));
  } else {
    lines.push(green("No regressions beyond tolerance."));
  }
  return lines.join("\n");
}
