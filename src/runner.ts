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
  /**
   * Maximum number of cases to execute at once. Defaults to 1 (sequential),
   * which keeps mock runs perfectly ordered and reproducible. Increase it to
   * parallelize slow network-bound providers.
   */
  concurrency?: number;
}

/** Run tasks with a bounded worker pool, preserving input order in the output. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const size = Math.max(1, Math.min(limit, items.length || 1));
  const workers = Array.from({ length: size }, async () => {
    let i = next++;
    while (i < items.length) {
      results[i] = await fn(items[i]!, i);
      i = next++;
    }
  });
  await Promise.all(workers);
  return results;
}

/** Turn a case into a provider request. */
function toRequest(c: EvalCase, suite: EvalSuite, model: string): ProviderRequest {
  return {
    model,
    prompt: c.input.prompt,
    messages: c.input.messages,
    // Deterministic regression runs remain the default when neither level opts in.
    temperature: c.temperature ?? suite.temperature ?? 0,
    maxTokens: c.maxTokens ?? suite.maxTokens,
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

  const response = await provider.complete(toRequest(c, suite, model));

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

  const concurrency = options.concurrency ?? 1;
  const caseResults = await mapPool(cases, concurrency, async (c) => {
    const res = await runCase(c, suite, { ...options, providers, scorers });
    options.onCase?.(res);
    return res;
  });

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
