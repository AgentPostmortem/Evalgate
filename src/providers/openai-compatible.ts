import type { Message, Provider, ProviderRequest, ProviderResponse } from "../types.js";
import { resolvePrompt } from "./mock.js";

/** Configuration for an OpenAI chat-completions compatible endpoint. */
export interface OpenAICompatibleConfig {
  /** Provider name for reporting. */
  name: string;
  /** Base URL, e.g. "https://api.openai.com/v1". */
  baseUrl: string;
  /** API key. When absent, calls throw a clear error. */
  apiKey?: string;
  /** Optional default model. */
  defaultModel?: string;
  /** Optional extra headers (e.g. OpenRouter referer). */
  headers?: Record<string, string>;
  /** Optional cost-per-1K-token estimate for cost budgeting. */
  costPer1kTokens?: number;
}

function toMessages(request: ProviderRequest): Message[] {
  if (request.messages && request.messages.length > 0) return request.messages;
  return [{ role: "user", content: resolvePrompt(request) }];
}

/**
 * An adapter for any provider that speaks the OpenAI `/chat/completions` API.
 * OpenAI, Groq, and OpenRouter all share this shape, so they are thin wrappers
 * around this class. Real network calls are made with the global `fetch`.
 */
export class OpenAICompatibleProvider implements Provider {
  readonly name: string;
  private readonly config: OpenAICompatibleConfig;

  constructor(config: OpenAICompatibleConfig) {
    this.name = config.name;
    this.config = config;
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    if (!this.config.apiKey) {
      throw new Error(
        `[evalgate] provider "${this.name}" is missing an API key. ` +
          `Set the appropriate environment variable, or use the "mock" provider.`,
      );
    }

    const model = request.model || this.config.defaultModel;
    if (!model) throw new Error(`[evalgate] provider "${this.name}" requires a model.`);

    const started = Date.now();
    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
        ...this.config.headers,
      },
      body: JSON.stringify({
        model,
        messages: toMessages(request),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      }),
    });
    const latencyMs = Date.now() - started;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[evalgate] ${this.name} request failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as any;
    const output: string = data?.choices?.[0]?.message?.content ?? "";
    const usage = data?.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        }
      : undefined;
    const costUsd =
      usage && this.config.costPer1kTokens
        ? (usage.totalTokens / 1000) * this.config.costPer1kTokens
        : undefined;

    return { output, latencyMs, model: data?.model ?? model, usage, costUsd, raw: data };
  }
}

/** OpenAI adapter. Reads `OPENAI_API_KEY`. */
export function openai(env: NodeJS.ProcessEnv = process.env): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    name: "openai",
    baseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    apiKey: env.OPENAI_API_KEY,
    defaultModel: "gpt-4o-mini",
    costPer1kTokens: 0.0006,
  });
}

/** Groq adapter. Reads `GROQ_API_KEY`. */
export function groq(env: NodeJS.ProcessEnv = process.env): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    name: "groq",
    baseUrl: env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
    apiKey: env.GROQ_API_KEY,
    defaultModel: "llama-3.1-8b-instant",
    costPer1kTokens: 0.0001,
  });
}

/** OpenRouter adapter. Reads `OPENROUTER_API_KEY`. */
export function openrouter(env: NodeJS.ProcessEnv = process.env): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    name: "openrouter",
    baseUrl: env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    apiKey: env.OPENROUTER_API_KEY,
    defaultModel: "openai/gpt-4o-mini",
    headers: {
      "http-referer": env.OPENROUTER_REFERER ?? "https://github.com/AgentPostmortem/evalgate",
      "x-title": "evalgate",
    },
    costPer1kTokens: 0.0006,
  });
}
