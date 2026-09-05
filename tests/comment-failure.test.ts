import { afterAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdCompare } from "../src/cli/index.js";
import type { RunResult } from "../src/types.js";

function result(score: number): RunResult {
  return {
    version: "1",
    suite: "s",
    timestamp: "now",
    score,
    passed: true,
    total: 1,
    passedCount: 1,
    latencyMs: 0,
    costUsd: 0,
    cases: [
      {
        id: "c1",
        model: "mock",
        provider: "mock",
        output: "",
        latencyMs: 1,
        costUsd: 0,
        score,
        passed: true,
        scores: [],
      },
    ],
  };
}

const savedFetch = globalThis.fetch;
afterAll(() => {
  globalThis.fetch = savedFetch;
});

describe("cmdCompare comment side-effect", () => {
  it("exits 0 when the comment API returns 403 on a fork PR", async () => {
    const dir = await mkdtemp(join(tmpdir(), "evalgate-"));
    const base = join(dir, "base.json");
    const head = join(dir, "head.json");
    await writeFile(base, JSON.stringify(result(0.94)));
    await writeFile(head, JSON.stringify(result(0.94)));

    vi.stubEnv("GITHUB_TOKEN", "t");
    vi.stubEnv("GITHUB_REPOSITORY", "owner/repo");
    vi.stubEnv("EVALGATE_PR", "1");
    // Simulate the read-only fork token: every comment write gets 403.
    globalThis.fetch = vi.fn(async () => new Response("forbidden", { status: 403 }));

    const code = await cmdCompare({
      _: ["compare"],
      flags: { base, head, comment: "true" },
    });

    expect(code).toBe(0);
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });
});
