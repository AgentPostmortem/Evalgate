# Contributing to evalgate

Thanks for your interest in improving evalgate. This project has one guiding rule
that shapes everything else:

> **Mock-first.** Every feature must run and be fully tested with no network access
> and no API keys. The deterministic `mock` provider is the contract.

## Getting started

```bash
git clone https://github.com/AgentPostmortem/evalgate
cd evalgate
npm install
npm run build
npm test
```

## Before you open a PR

Run the full gate locally:

```bash
npm run typecheck
npm run lint
npm test
node dist/cli/index.js run examples/support-agent.eval.yaml
```

## Adding a scorer

1. Create `src/scorers/<name>.ts` implementing the `Scorer` interface.
2. Register it in `src/scorers/registry.ts` (add it to `builtinScorers`).
3. Document it in the scorer catalog table in `README.md`.
4. Add a unit test in `tests/scorers.test.ts`.
5. If it needs a model or embeddings, provide a deterministic path for the `mock`
   provider so tests stay offline.

## Adding a provider adapter

1. Implement the `Provider` interface (see `src/providers/openai-compatible.ts`).
2. Register a factory in `src/providers/registry.ts`.
3. Read credentials from environment variables only; never hard-code keys.

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`,
`docs:`, `test:`, `chore:`, `refactor:`, `ci:`. Keep commits atomic.

## Code style

TypeScript strict mode, ESLint, two-space indentation. Prefer small, well-named
functions and document the public surface with doc comments.

## Claiming an issue

Want to pick something up? Just comment on the issue saying you'd like to work on
it. A workflow adds the `claimed` label so nobody else duplicates your effort.

Two small rules keep things fair:

- **Two open claims per person.** If you already hold two claimed issues, we'll ask
  you to finish one first so other people get a turn. Comment again once one lands
  and the next is yours.
- **Claims go stale after 14 days.** If a claimed issue sees no activity for two
  weeks, the label is removed and it goes back in the pool. No hard feelings, and
  you can always claim it again.

Link your pull request to the issue in the PR description (for example
`Closes #12`). When that PR is merged the issue closes itself, and if the PR is
closed without being merged the claim is released so someone else can pick it up.

No pressure on timelines otherwise. Ask questions in the issue thread any time.
