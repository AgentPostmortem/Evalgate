# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-08-06

### Changed

- Repository moved to the `AgentPostmortem` GitHub organization; package metadata
  (`repository`, `bugs`, `homepage`) now points at the new location. The package
  name and scope are unchanged.

## [0.1.0] - Unreleased

### Added

- Declarative eval suite format (YAML and JSON) with strict validation.
- Deterministic `mock` provider with offline embeddings, plus adapter shells for
  OpenAI, Anthropic, Groq, and OpenRouter.
- Scorers: `exact-match`, `regex`, `contains`, `not-contains`, `json-schema`,
  `embedding-similarity`, `llm-judge`, `latency`, `cost`, and `rubric`.
- Runner with weighted score aggregation, tag filtering, bounded concurrency, and
  a machine-readable JSON result artifact.
- Baseline and delta compare engine with per-case regression detection and
  configurable tolerance.
- Reporters: terminal, Markdown, and JUnit XML.
- `{{variable}}` templating with suite- and case-level variables.
- CLI: `run`, `baseline`, `compare`, `init`, and `list`.
- Reusable GitHub Action that runs a suite, compares to a baseline, and upserts a
  PR comment with the delta table.
- Vitest test suite covering scorers, providers, runner, compare engine, loader,
  reporters, templating, and the example suites.
