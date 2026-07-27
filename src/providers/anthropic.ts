import type { Message, Provider, ProviderRequest, ProviderResponse } from "../types.js";
import { resolvePrompt } from "./mock.js";

/** Configuration for the Anthropic Messages API adapter. */
export interface AnthropicConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  version?: string;
  costPer1kTokens?: number;
}

function splitMessages(request: ProviderRequest): { system?: string; messages: Message[] } {
  const all = request.messages ?? [{ role: "user" as const, content: resolvePrompt(request) }];
  const system = all
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const messages = all.filter((m) => m.role !== "system");
  return { system: system || undefined, messages };
}

/**
 * Adapter for Anthropic's `/v1/messages` API. Reads `ANTHROPIC_API_KEY`. Uses
 * the global `fetch`; no SDK dependency.
 */
export class AnthropicProvider implements Provider {
  readonly name = "anthropic";
  private readonly config: AnthropicConfig;

  constructor(config: AnthropicConfig = {}) {
    this.config = config;
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    if (!this.config.apiKey) {
      throw new Error(
        `[evalgate] provider "anthropic" is missing an API key. ` +
          `Set ANTHROPIC_API_KEY, or use the "mock" provider.`,
      );
    }
    const model = request.model || this.config.defaultModel || "claude-3-5-haiku-latest";
    const { system, messages } = splitMessages(request);

    const started = Date.now();
    const res = await fetch(`${this.config.baseUrl ?? "https://api.anthropic.com"}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": this.config.version ?? "2023-06-01",
      },
      body: JSON.stringify({
        model,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature,
      }),
    });
    const latencyMs = Date.now() - started;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[evalgate] anthropic request failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as any;
    const output: string = (data?.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");
    const usage = data?.usage
      ? {
          promptTokens: data.usage.input_tokens ?? 0,
          completionTokens: data.usage.output_tokens ?? 0,
          totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
        }
      : undefined;
    const costUsd =
      usage && this.config.costPer1kTokens
        ? (usage.totalTokens / 1000) * this.config.costPer1kTokens
        : undefined;

    return { output, latencyMs, model: data?.model ?? model, usage, costUsd, raw: data };
  }
}

/** Anthropic adapter factory. Reads `ANTHROPIC_API_KEY`. */
export function anthropic(env: NodeJS.ProcessEnv = process.env): AnthropicProvider {
  return new AnthropicProvider({
    apiKey: env.ANTHROPIC_API_KEY,
    baseUrl: env.ANTHROPIC_BASE_URL,
    defaultModel: "claude-3-5-haiku-latest",
    costPer1kTokens: 0.0008,
  });
}
