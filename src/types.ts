/**
 * Core type definitions for evalgate.
 *
 * These types describe the shape of an eval suite, the provider layer, the
 * scorers, and the result artifacts produced by a run. Everything else in the
 * codebase is built on top of these contracts.
 */

/** A single message in a chat-style prompt. */
export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

/** A request handed to a provider adapter. */
export interface ProviderRequest {
  /** The model identifier, e.g. "gpt-4o-mini" or "mock". */
  model: string;
  /** Chat messages. Either this or `prompt` must be supplied. */
  messages?: Message[];
  /** A convenience single-string prompt (converted to a user message). */
  prompt?: string;
  /** Sampling temperature, if the provider supports it. */
  temperature?: number;
  /** Maximum tokens to generate. */
  maxTokens?: number;
}

/** The normalized response returned by every provider adapter. */
export interface ProviderResponse {
  /** The generated text output. */
  output: string;
  /** Wall-clock latency in milliseconds for the call. */
  latencyMs: number;
  /** Token accounting, when the provider reports it. */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Estimated cost of the call in USD, when computable. */
  costUsd?: number;
  /** The model that actually served the request. */
  model: string;
  /** Arbitrary provider-specific metadata. */
  raw?: unknown;
}

/** A provider adapter turns a request into a normalized response. */
export interface Provider {
  /** Stable name, e.g. "mock", "openai". */
  readonly name: string;
  /** Produce a completion for the given request. */
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  /** Optional embedding hook used by the embedding-similarity scorer. */
  embed?(text: string): Promise<number[]>;
}

/** The declarative configuration for a single scorer on a case. */
export interface ScorerSpec {
  /** The registered scorer id, e.g. "exact-match". */
  type: string;
  /** Optional human label used in reports. */
  name?: string;
  /**
   * Weight of this scorer when aggregating the case score.
   * Defaults to 1. Must be >= 0.
   */
  weight?: number;
  /** Scorer-specific options. */
  [key: string]: unknown;
}

/** Context passed to a scorer at evaluation time. */
export interface ScoreContext {
  /** The model output being scored. */
  output: string;
  /** The full provider response, for latency/cost aware scorers. */
  response: ProviderResponse;
  /** The originating case. */
  case: EvalCase;
  /** The provider used, exposed for scorers that need embeddings. */
  provider: Provider;
}

/** The outcome of a single scorer. */
export interface ScoreResult {
  /** The scorer id. */
  type: string;
  /** Human label. */
  name: string;
  /** Normalized score in [0, 1]. */
  score: number;
  /** Whether the scorer considers this a pass. */
  passed: boolean;
  /** The weight applied during aggregation. */
  weight: number;
  /** Human-readable explanation of the outcome. */
  reason: string;
}

/** A scorer implementation. */
export interface Scorer {
  /** The registered id, matched against `ScorerSpec.type`. */
  readonly type: string;
  /** Evaluate a single output and return a normalized result. */
  score(spec: ScorerSpec, ctx: ScoreContext): Promise<ScoreResult> | ScoreResult;
}

/** A single eval case. */
export interface EvalCase {
  /** Stable, unique id within the suite. */
  id: string;
  /** Optional description. */
  description?: string;
  /** The prompt template or messages under test. */
  input: {
    prompt?: string;
    messages?: Message[];
  };
  /** Optional per-case model override. */
  model?: string;
  /** Optional per-case provider override. */
  provider?: string;
  /** Optional expected value, shared by many scorers. */
  expected?: string;
  /** One or more scorers applied to the output. */
  scorers: ScorerSpec[];
  /** Arbitrary tags for filtering. */
  tags?: string[];
  /** Case-level template variables, override suite-level `vars`. */
  vars?: Record<string, string | number | boolean>;
}

/** The full suite definition loaded from YAML/JSON. */
export interface EvalSuite {
  /** Suite name, surfaced in reports. */
  name: string;
  /** Optional description. */
  description?: string;
  /** Default model applied to cases that do not override it. */
  model?: string;
  /** Default provider applied to cases that do not override it. */
  provider?: string;
  /** Global pass threshold in [0, 1] for the aggregate score. */
  threshold?: number;
  /** Suite-level template variables applied to every case. */
  vars?: Record<string, string | number | boolean>;
  /** The cases. */
  cases: EvalCase[];
}

/** The result of scoring one case. */
export interface CaseResult {
  id: string;
  description?: string;
  model: string;
  provider: string;
  output: string;
  latencyMs: number;
  costUsd: number;
  /** Weighted aggregate of all scorers in [0, 1]. */
  score: number;
  /** Whether every scorer passed. */
  passed: boolean;
  scores: ScoreResult[];
  tags?: string[];
}

/** The machine-readable artifact produced by a run. */
export interface RunResult {
  /** Result schema version. */
  version: string;
  /** Suite name. */
  suite: string;
  /** ISO timestamp of the run. */
  timestamp: string;
  /** The configured aggregate threshold, if any. */
  threshold?: number;
  /** Mean aggregate score across all cases in [0, 1]. */
  score: number;
  /** Whether the run met the threshold and every case passed. */
  passed: boolean;
  /** Total number of cases. */
  total: number;
  /** Number of cases that passed. */
  passedCount: number;
  /** Aggregate latency in ms across all cases. */
  latencyMs: number;
  /** Aggregate cost in USD across all cases. */
  costUsd: number;
  /** Per-case results. */
  cases: CaseResult[];
}
