import type {
  CaseResult,
  EvalCase,
  EvalSuite,
  Provider,
  ProviderRequest,
  RunResult,
  ScoreResult,
} from "./types.js";
import { defaultRegistry, ProviderRegistry } from "./providers/registry.js";
import { defaultScorerRegistry, ScorerRegistry } from "./scorers/registry.js";
import { resolveCase } from "./template.js";

/** The result-artifact schema version emitted by the runner. */
export const RESULT_VERSION = "1";

/** Options controlling a run. */
export interface RunOptions {
  /** Provider registry to resolve providers from. Defaults to the built-ins. */
  providers?: ProviderRegistry;
  /** Scorer registry to resolve scorers from. Defaults to the built-ins. */
  scorers?: ScorerRegistry;
  /** Default provider when neither the case nor the suite specifies one. */
  defaultProvider?: string;
  /** Default model when neither the case nor the suite specifies one. */
  defaultModel?: string;
  /** Only run cases containing at least one of these tags. */
  filterTags?: string[];
  /** Optional callback fired after each case completes (for progress UIs). */
  onCase?: (result: CaseResult) => void;
}

/** Turn a case into a provider request. */
function toRequest(c: EvalCase, model: string): ProviderRequest {
  return {
    model,
    prompt: c.input.prompt,
    messages: c.input.messages,
    temperature: 0,
  };
}

/** Weighted aggregate of a set of scorer results in [0, 1]. */
export function aggregateScore(scores: ScoreResult[]): number {
  const totalWeight = scores.reduce((s, r) => s + r.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = scores.reduce((s, r) => s + r.score * r.weight, 0);
  return weighted / totalWeight;
}

/** Execute a single case and produce its {@link CaseResult}. */
export async function runCase(
  rawCase: EvalCase,
  suite: EvalSuite,
  options: RunOptions = {},
): Promise<CaseResult> {
  const providers = options.providers ?? defaultRegistry();
  const scorers = options.scorers ?? defaultScorerRegistry();
  const c = resolveCase(rawCase, suite.vars);

  const providerName =
    c.provider ?? suite.provider ?? options.defaultProvider ?? "mock";
  const model = c.model ?? suite.model ?? options.defaultModel ?? "mock";
  const provider: Provider = providers.get(providerName);

  const response = await provider.complete(toRequest(c, model));

  const scoreResults: ScoreResult[] = [];
  for (const spec of c.scorers) {
    const scorer = scorers.get(spec.type);
    const res = await scorer.score(spec, {
      output: response.output,
      response,
      case: c,
      provider,
    });
    scoreResults.push(res);
  }

  return {
    id: c.id,
    description: c.description,
    model: response.model,
    provider: providerName,
    output: response.output,
    latencyMs: response.latencyMs,
    costUsd: response.costUsd ?? 0,
    score: aggregateScore(scoreResults),
    passed: scoreResults.every((r) => r.passed),
    scores: scoreResults,
    tags: c.tags,
  };
}

/** Execute an entire suite and produce a {@link RunResult} artifact. */
export async function runSuite(suite: EvalSuite, options: RunOptions = {}): Promise<RunResult> {
  const providers = options.providers ?? defaultRegistry();
  const scorers = options.scorers ?? defaultScorerRegistry();

  let cases = suite.cases;
  if (options.filterTags && options.filterTags.length > 0) {
    const wanted = new Set(options.filterTags);
    cases = cases.filter((c) => (c.tags ?? []).some((t) => wanted.has(t)));
  }

  const caseResults: CaseResult[] = [];
  for (const c of cases) {
    const res = await runCase(c, suite, { ...options, providers, scorers });
    caseResults.push(res);
    options.onCase?.(res);
  }

  const total = caseResults.length;
  const passedCount = caseResults.filter((r) => r.passed).length;
  const meanScore =
    total === 0 ? 0 : caseResults.reduce((s, r) => s + r.score, 0) / total;
  const latencyMs = caseResults.reduce((s, r) => s + r.latencyMs, 0);
  const costUsd = caseResults.reduce((s, r) => s + r.costUsd, 0);

  const thresholdMet = suite.threshold === undefined || meanScore >= suite.threshold;
  const passed = thresholdMet && passedCount === total;

  return {
    version: RESULT_VERSION,
    suite: suite.name,
    timestamp: new Date().toISOString(),
    threshold: suite.threshold,
    score: meanScore,
    passed,
    total,
    passedCount,
    latencyMs,
    costUsd,
    cases: caseResults,
  };
}
