import type { Provider } from "../types.js";
import { MockProvider, type MockProviderOptions } from "./mock.js";
import { anthropic } from "./anthropic.js";
import { openai, groq, openrouter } from "./openai-compatible.js";

/** A factory that lazily constructs a provider from the environment. */
export type ProviderFactory = (env: NodeJS.ProcessEnv) => Provider;

/**
 * A registry of provider factories keyed by name. The runner resolves the
 * provider referenced by a suite/case through this registry.
 */
export class ProviderRegistry {
  private readonly factories = new Map<string, ProviderFactory>();
  private readonly cache = new Map<string, Provider>();

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  /** Register (or override) a provider factory. */
  register(name: string, factory: ProviderFactory): this {
    this.factories.set(name, factory);
    this.cache.delete(name);
    return this;
  }

  /** True when a provider is registered under `name`. */
  has(name: string): boolean {
    return this.factories.has(name);
  }

  /** Resolve a provider by name, constructing and caching it on first use. */
  get(name: string): Provider {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const factory = this.factories.get(name);
    if (!factory) {
      const known = [...this.factories.keys()].join(", ");
      throw new Error(`[evalgate] unknown provider "${name}". Registered: ${known}`);
    }
    const provider = factory(this.env);
    this.cache.set(name, provider);
    return provider;
  }
}

/**
 * Build the default registry with the mock provider plus adapter shells for the
 * real providers. Only the mock is guaranteed to work with no configuration.
 */
export function defaultRegistry(
  env: NodeJS.ProcessEnv = process.env,
  mockOptions: MockProviderOptions = {},
): ProviderRegistry {
  const registry = new ProviderRegistry(env);
  registry.register("mock", () => new MockProvider(mockOptions));
  registry.register("openai", (e) => openai(e));
  registry.register("anthropic", (e) => anthropic(e));
  registry.register("groq", (e) => groq(e));
  registry.register("openrouter", (e) => openrouter(e));
  return registry;
}
