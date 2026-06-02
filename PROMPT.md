# PROMPT.md

Paste this as your first message in Claude Code, in an empty repo containing
`CLAUDE.md` and `ARCHITECTURE.md`.

---

Read `CLAUDE.md` and `ARCHITECTURE.md` fully before writing anything. Then build the
`github-traffic-badge` GitHub Action end to end, following the workflow section in
`CLAUDE.md` step by step.

Non-negotiable constraints:
- Zero runtime dependencies. Node 20+, ES modules, built-in `fetch`, `node:test` + `node:assert`.
- Pure core (`accumulator`, `renderer`, `options`) with no I/O; all I/O injected into impure modules.
- Build and test incrementally: write each pure module, then its tests, then run `node --test`
  and show me the result before moving on. Do not write all modules then test at the end.
- Prove the accumulator's dedup and idempotency properties with explicit tests before
  implementing the renderer.

Start by scaffolding `package.json` and `options.js` with its tests, run the tests, and
show me the output. Then pause for my confirmation before continuing to the accumulator.

After all code and tests are green, write the `README.md` last, including: the plain
statement that this counts repo traffic (not profile views), the one-workflow-file setup,
the full customisation table, and the `raw.githubusercontent.com` badge URL.
