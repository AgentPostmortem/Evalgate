import { describe, it, expect } from "vitest";
import { MockProvider, localEmbedding, estimateTokens } from "../src/providers/mock.js";
import { defaultRegistry, ProviderRegistry } from "../src/providers/registry.js";

describe("MockProvider", () => {
  const p = new MockProvider();

  it("is deterministic for the same prompt", async () => {
    const a = await p.complete({ model: "mock", prompt: "hello world" });
    const b = await p.complete({ model: "mock", prompt: "hello world" });
    expect(a.output).toBe(b.output);
    expect(a.latencyMs).toBe(b.latencyMs);
  });

  it("honors the exactly: directive", async () => {
    const r = await p.complete({ model: "mock", prompt: "exactly: PONG" });
    expect(r.output).toBe("PONG");
  });

  it("applies transforms", async () => {
    expect((await p.complete({ model: "mock", prompt: "uppercase: abc" })).output).toBe("ABC");
    expect((await p.complete({ model: "mock", prompt: "reverse: abc" })).output).toBe("cba");
  });

  it("reports usage and cost", async () => {
    const r = await p.complete({ model: "mock", prompt: "echo: hi" });
    expect(r.usage?.totalTokens).toBeGreaterThan(0);
    expect(r.costUsd).toBeGreaterThan(0);
  });

  it("degrade mode breaks exact output", async () => {
    const degraded = new MockProvider({ degrade: true });
    const r = await degraded.complete({ model: "mock", prompt: "exactly: hello" });
    expect(r.output).not.toBe("hello");
  });

  it("supports fixtures", async () => {
    const fixed = new MockProvider({ fixtures: { weather: "sunny" } });
    const r = await fixed.complete({ model: "mock", prompt: "what is the weather" });
    expect(r.output).toBe("sunny");
  });
});

describe("embedding + tokens", () => {
  it("localEmbedding is normalized and stable", () => {
    const v1 = localEmbedding("hello world");
    const v2 = localEmbedding("hello world");
    expect(v1).toEqual(v2);
    const norm = Math.sqrt(v1.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1);
  });
  it("estimateTokens grows with length", () => {
    expect(estimateTokens("a".repeat(40))).toBeGreaterThan(estimateTokens("a"));
  });
});

describe("ProviderRegistry", () => {
  it("resolves and caches the mock provider", () => {
    const reg = defaultRegistry();
    expect(reg.get("mock")).toBe(reg.get("mock"));
  });
  it("throws on unknown provider", () => {
    const reg = new ProviderRegistry();
    expect(() => reg.get("nope")).toThrow(/unknown provider/);
  });
  it("registers real adapters without keys", () => {
    const reg = defaultRegistry({});
    expect(reg.has("openai")).toBe(true);
    expect(reg.has("anthropic")).toBe(true);
  });
  it("lists built-in and custom providers", () => {
  const reg = defaultRegistry({});
  
  expect(reg.list().sort()).toEqual([
    "anthropic",
    "groq",
    "mock",
    "openai",
    "openrouter",
  ]);
  
  reg.register("custom", () => new MockProvider());
  expect(reg.list()).toContain("custom");
});
});
