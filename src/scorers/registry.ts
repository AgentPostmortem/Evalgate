import type { Scorer } from "../types.js";
import { exactMatchScorer } from "./exact-match.js";
import { regexScorer } from "./regex.js";
import { containsScorer, notContainsScorer } from "./contains.js";
import { jsonSchemaScorer } from "./json-schema.js";
import { embeddingSimilarityScorer } from "./embedding-similarity.js";
import { llmJudgeScorer } from "./llm-judge.js";
import { latencyScorer } from "./latency.js";
import { costScorer } from "./cost.js";
import { rubricScorer } from "./rubric.js";

/** A registry mapping scorer ids to their implementations. */
export class ScorerRegistry {
  private readonly scorers = new Map<string, Scorer>();

  /** Register (or override) a scorer. */
  register(scorer: Scorer): this {
    this.scorers.set(scorer.type, scorer);
    return this;
  }

  /** True when a scorer id is registered. */
  has(type: string): boolean {
    return this.scorers.has(type);
  }

  /** Resolve a scorer by id, throwing on unknown types. */
  get(type: string): Scorer {
    const scorer = this.scorers.get(type);
    if (!scorer) {
      const known = [...this.scorers.keys()].join(", ");
      throw new Error(`[evalgate] unknown scorer "${type}". Registered: ${known}`);
    }
    return scorer;
  }

  /** List all registered scorer ids. */
  list(): string[] {
    return [...this.scorers.keys()];
  }
}

/** The full set of built-in scorers. */
export const builtinScorers: Scorer[] = [
  exactMatchScorer,
  regexScorer,
  containsScorer,
  notContainsScorer,
  jsonSchemaScorer,
  embeddingSimilarityScorer,
  llmJudgeScorer,
  latencyScorer,
  costScorer,
  rubricScorer,
];

/** Build a registry preloaded with every built-in scorer. */
export function defaultScorerRegistry(): ScorerRegistry {
  const registry = new ScorerRegistry();
  for (const scorer of builtinScorers) registry.register(scorer);
  return registry;
}
