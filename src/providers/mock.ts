import type { Provider, ProviderRequest, ProviderResponse } from "../types.js";
import { fnv1a, mulberry32 } from "./hash.js";

/** Options for constructing a {@link MockProvider}. */
export interface MockProviderOptions {
  /**
   * Optional canned responses. Keys are matched as case-insensitive substrings
   * against the resolved prompt text; the first match wins. This lets tests and
   * example suites pin exact outputs without any network dependency.
   */
  fixtures?: Record<string, string>;
  /** Cost per 1K tokens, used to compute a deterministic mock cost. */
  costPer1kTokens?: number;
  /** A regression toggle used by examples to simulate a "dumber" model. */
  degrade?: boolean;
}

/** Collapse a request down to a single prompt string. */
export function resolvePrompt(request: ProviderRequest): string {
  if (request.prompt !== undefined) return request.prompt;
  if (request.messages && request.messages.length > 0) {
    return request.messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  }
  return "";
}

/**
 * A fully deterministic provider that requires no API key and no network.
 *
 * The mock understands a handful of instruction verbs so that example suites can
 * exercise real scorer behavior:
 *
 *  - `exactly: <text>`   -> returns `<text>` verbatim
 *  - `echo: <text>`      -> returns `<text>`
 *  - `uppercase: <text>` -> returns `<text>` upper-cased
 *  - `lowercase: <text>` -> returns `<text>` lower-cased
 *  - `reverse: <text>`   -> returns `<text>` reversed
 *  - `json: <text>`      -> returns `<text>` (expected to be valid JSON)
 *
 * Anything else yields a stable pseudo-response derived from a hash of the
 * prompt, so repeated runs are always identical.
 */
export class MockProvider implements Provider {
  readonly name = "mock";
  private readonly fixtures: Record<string, string>;
  private readonly costPer1kTokens: number;
  private readonly degrade: boolean;

  constructor(options: MockProviderOptions = {}) {
    this.fixtures = options.fixtures ?? {};
    this.costPer1kTokens = options.costPer1kTokens ?? 0.002;
    this.degrade = options.degrade ?? false;
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const prompt = resolvePrompt(request);
    const output = this.generate(prompt);
    const seed = fnv1a(prompt);
    const rand = mulberry32(seed);

    // Deterministic latency in the 5-55ms range.
    const latencyMs = Math.round(5 + rand() * 50);

    const promptTokens = estimateTokens(prompt);
    const completionTokens = estimateTokens(output);
    const totalTokens = promptTokens + completionTokens;
    const costUsd = (totalTokens / 1000) * this.costPer1kTokens;

    return {
      output,
      latencyMs,
      model: request.model || "mock",
      usage: { promptTokens, completionTokens, totalTokens },
      costUsd,
      raw: { seed },
    };
  }

  async embed(text: string): Promise<number[]> {
    return localEmbedding(text);
  }

  private generate(prompt: string): string {
    for (const [needle, response] of Object.entries(this.fixtures)) {
      if (prompt.toLowerCase().includes(needle.toLowerCase())) return response;
    }

    const directive = lastDirective(prompt);
    if (directive) {
      const { verb, body } = directive;
      const payload = this.degrade ? corrupt(body) : body;
      switch (verb) {
        case "exactly":
        case "echo":
        case "json":
          return payload;
        case "uppercase":
          return payload.toUpperCase();
        case "lowercase":
          return payload.toLowerCase();
        case "reverse":
          return [...payload].reverse().join("");
        default:
          break;
      }
    }

    // Fall back to a stable pseudo-response.
    const base = `mock response for prompt hash ${fnv1a(prompt)}`;
    return this.degrade ? corrupt(base) : base;
  }
}

/** Find the last `verb: body` directive in a prompt, if any. */
function lastDirective(prompt: string): { verb: string; body: string } | null {
  const lines = prompt.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    const match = /^\s*(exactly|echo|uppercase|lowercase|reverse|json)\s*:\s*([\s\S]*)$/i.exec(
      line,
    );
    if (match) {
      return { verb: match[1]!.toLowerCase(), body: match[2]! };
    }
  }
  return null;
}

/** Deterministically "corrupt" text to simulate a regression. */
function corrupt(text: string): string {
  if (text.length === 0) return "?";
  // Drop the last character and append a marker; enough to break exact match
  // while keeping partial similarity.
  return text.slice(0, Math.max(1, text.length - 1)) + " [oops]";
}

/** Rough token estimate (~4 chars per token). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * A deterministic, offline embedding: a fixed-width bag-of-hashed-words vector.
 * This is intentionally simple but stable, so embedding-similarity scoring works
 * with zero network access.
 */
export function localEmbedding(text: string, dims = 64): number[] {
  const vec = new Array<number>(dims).fill(0);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  for (const word of words) {
    const idx = fnv1a(word) % dims;
    vec[idx] = (vec[idx] ?? 0) + 1;
  }
  // L2 normalize so cosine similarity is well behaved.
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}
