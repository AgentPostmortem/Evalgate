# Contributing to evalgate

Thanks for your interest in improving evalgate. This project has one guiding rule
that shapes everything else:

> **Mock-first.** Every feature must run and be fully tested with no network access
> and no API keys. The deterministic `mock` provider is the contract.

## Getting started

```bash
git clone https://github.com/royalpinto007/evalgate
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
