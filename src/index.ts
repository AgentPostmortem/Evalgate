/**
 * evalgate - prompt/agent regression CI.
 *
 * This is the public library surface. Everything here is stable API; the CLI is
 * a thin wrapper over these exports.
 */
export * from "./types.js";
export * from "./suite.js";
export * from "./runner.js";
export * from "./compare.js";

export { ProviderRegistry, defaultRegistry } from "./providers/registry.js";
export { MockProvider, localEmbedding, estimateTokens } from "./providers/mock.js";
export { OpenAICompatibleProvider, openai, groq, openrouter } from "./providers/openai-compatible.js";
export { AnthropicProvider, anthropic } from "./providers/anthropic.js";

export { ScorerRegistry, defaultScorerRegistry, builtinScorers } from "./scorers/registry.js";
export { cosineSimilarity } from "./scorers/embedding-similarity.js";
export { validate as validateJsonSchema } from "./scorers/json-schema.js";

export { renderRunTerminal, renderCompareTerminal } from "./reporters/terminal.js";
export { renderRunMarkdown, renderCompareMarkdown } from "./reporters/markdown.js";
export { renderRunJUnit } from "./reporters/junit.js";
export { renderTemplate, resolveCase, type Vars } from "./template.js";

export {
  contextFromEnv,
  upsertComment,
  findExistingComment,
  COMMENT_MARKER,
  type GitHubContext,
} from "./github.js";
