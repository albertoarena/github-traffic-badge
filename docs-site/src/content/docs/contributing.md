---
title: Contributing
description: Local development, project structure, and how to run tests for github-traffic-badge.
---

## Local development

```bash
git clone https://github.com/albertoarena/github-traffic-badge
cd github-traffic-badge
node --test
```

That is the whole loop. Node 20+ is required (the project uses the built-in
`fetch` and `node:test`). There are **zero runtime dependencies** — this is
enforced in CI.

## Project structure

```
.
├── action.yml                      Composite GitHub Action definition
├── src/
│   ├── index.js                    Orchestration (impure, thin)
│   ├── fetcher.js                  GitHub Traffic API (impure, injectable fetch)
│   ├── store.js                    JSON read/write (impure, injectable fs)
│   ├── options.js                  Input parsing and validation (PURE)
│   ├── accumulator.js              Date-keyed upsert and totals (PURE)
│   └── renderer.js                 SVG rendering (PURE)
├── test/
│   ├── options.test.js
│   ├── accumulator.test.js
│   ├── renderer.test.js
│   ├── fetcher.test.js
│   ├── store.test.js
│   └── index.test.js
├── docs-site/                      This documentation site (Astro + Starlight)
└── .github/workflows/              CI, release, and docs deploy
```

## Purity boundary

The three pure modules — `options`, `accumulator`, `renderer` — hold all the
branching logic and are exhaustively unit-tested. The impure modules —
`fetcher`, `store`, `index` — accept their I/O as injected arguments
(`fetch`, `readFile`, `writeFile`), so the integration is testable without
network or filesystem.

If you find yourself adding a branch inside an impure module, move it into a
pure one.

## Running tests

```bash
node --test
```

Tests use only `node:test` and `node:assert` — no test framework to install.
A single `node --test` runs every test file under `test/`.

## Pull requests

- Match the existing code style. No new runtime dependencies.
- Add unit tests for any new pure behaviour. For the accumulator in
  particular, the dedup and idempotency properties are explicit tests; any
  change that touches `mergeTraffic` must preserve them.
- Update the README, the relevant docs page on this site, and JSDoc in the
  affected source files. Important changes must update all three.

## Reporting bugs and requesting features

Open an issue on GitHub:
<https://github.com/albertoarena/github-traffic-badge/issues>
