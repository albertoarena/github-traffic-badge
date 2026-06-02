# CLAUDE.md

Build instructions for Claude Code. Read `ARCHITECTURE.md` before writing any code.

## Project identity

- **Repo / package name:** `github-traffic-badge`
- **Action name** (in `action.yml`): `github-traffic-badge`
- **Framing:** lead with "traffic **badge**" (the rendered SVG the user gets), never
  "counter". Avoid the word "counter" in user-facing docs — it re-inherits the unreliable
  framing of the project this improves on. Internal code identifiers may use neutral terms
  (e.g. `total`, `accumulate`).
- **Visibility:** developed as a **private** repo, made **public** once done. Write all docs
  as if already public (no internal-only notes, no placeholder secrets).

## What this project is

A **GitHub Action** that counts real **repository traffic** (views + clones from the
GitHub Traffic API) and renders a customisable SVG badge committed back to the user's
repo. It runs entirely inside the user's own GitHub account via a daily cron — there is
**no hosted service**, no server, no external account, no cost to maintainer or user.

It is **not** a profile-views counter. Profile views are not exposed by any GitHub API.
This counts repo traffic, which is real and verifiable. Be explicit about this everywhere.
It produces a **badge** (SVG), not a hosted service.

## Hard constraints (do not violate)

- **Zero runtime dependencies.** Use Node's built-in `fetch` and `node:test` + `node:assert`.
  No axios, no node-fetch, no vitest, no SVG libraries. If you think you need a dependency,
  stop and reconsider — you almost certainly don't.
- **Node 20+** (built-in `fetch`, stable test runner). Set in `package.json` engines.
- **KISS.** Smallest thing that works. No config frameworks, no plugin systems, no premature
  abstraction. Four small modules, not fourteen.
- **Pure core.** All logic (accumulate, render) lives in pure functions with no I/O.
  All I/O (fetch, file read/write, git) lives in thin impure modules that are injected,
  so the pure core is tested without network or filesystem.
- **Fully tested.** Every pure function has unit tests. Target: accumulator and renderer
  at or near 100% branch coverage. CI runs tests on every push and PR.
- **English** for all code, comments, docs, and identifiers.

## Module responsibilities

| File | Purity | Responsibility |
|------|--------|----------------|
| `src/index.js` | impure (thin) | Orchestrate: read inputs → fetch → accumulate → render → write. No logic. |
| `src/fetcher.js` | impure (injected) | Call GitHub Traffic API. Return normalised data. Handle 404/empty/rate-limit. |
| `src/accumulator.js` | **PURE** | Merge new traffic into a date→count map. Dedup. Idempotent. |
| `src/renderer.js` | **PURE** | Turn a total + options into an SVG string. |
| `src/store.js` | impure (injected) | Read/write `totals.json`. JSON (de)serialisation only. |
| `src/options.js` | **PURE** | Parse + validate + default action inputs into a typed options object. |

## The one hard problem: dedup (read carefully)

The Traffic API returns the **last 14 days**, each as `{ timestamp, count, uniques }`.
If you run daily and add each pull's total to a running number, you double-count the 13
overlapping days every run. **Do not store a single number.**

Store a **date → { count, uniques }** map. On each run, **upsert by date key** (overwrite
the day's entry with the latest API value, never add to it). The displayed total is the
**sum of the map**. This makes re-runs idempotent: running twice on the same data changes
nothing. Write tests that prove this property explicitly.

Persisted shape (`totals.json`):

```json
{
  "schema": 1,
  "updatedAt": "2026-06-02T03:00:00Z",
  "views":  { "2026-05-20": { "count": 12, "uniques": 4 }, "2026-05-21": { "count": 8, "uniques": 3 } },
  "clones": { "2026-05-20": { "count": 2,  "uniques": 1 } }
}
```

## Customisation (must support)

Action inputs, all optional, parsed/validated in `src/options.js`:

| Input | Default | Notes |
|-------|---------|-------|
| `metric` | `views` | `views`, `clones`, `views-unique`, `clones-unique` |
| `color` | `blue` | named color OR hex without `#`. Validate hex `^[0-9a-fA-F]{6}$`. Reject invalid → fall back to default + warn. |
| `label` | `Repo views` | left-side text. |
| `font-size` | `11` | integer px. Clamp to a sane range (e.g. 8–24). |
| `style` | `flat` | `flat`, `flat-square`, `plastic`, `for-the-badge`. |
| `abbreviated` | `false` | `12345` → `12.3K`. |
| `base` | `0` | integer added to total (migration from another counter). |
| `output` | `badge.svg` | committed badge filename. |
| `token` | `${{ github.token }}` | built-in token by default; PAT optional for org/all-repos. |
| `repos` | current repo | optional list/`all` to aggregate multiple repos. Keep default = single repo. |

**Named colors** → maintain a small map (`blue`, `green`, `brightgreen`, `yellow`,
`orange`, `red`, `grey`, `lightgrey`, `blueviolet`). Hex passes through after validation.

**font-size** affects SVG text size AND the computed badge width (width must scale with
text length × font-size, or text overflows). Width computation is pure and must be tested.

## SVG rendering rules

- Hand-write the SVG string. No libraries.
- Badge = two rounded rects (label bg grey, value bg colored) + two `<text>` elements.
- Width = padding + approx text width. Approximate char width as `~0.6 × fontSize` per char
  (good enough; document the heuristic). Test that longer labels produce wider badges.
- `style` changes corner radius / gradient / shape only. Keep one base template, branch on style.
- Escape text content (label could contain `&`, `<`, `>`).
- Output must be valid standalone SVG (`<svg xmlns=...>`), renderable via raw.githubusercontent.

## Action packaging

- **Composite action** in `action.yml` (not Docker — no container build, instant start).
  Set `name: github-traffic-badge` and a one-line `description` in `action.yml`.
  Steps: checkout → `setup-node` → `node src/index.js` → commit changed files.
- Commit `totals.json` + the badge to a **dedicated branch** (`traffic-data`) so the
  user's main branch history stays clean. Use the built-in token; set
  `permissions: contents: write` in the consuming workflow (document this).
- If nothing changed, do not commit (idempotent — no empty commits).

## Test plan (write these)

`test/accumulator.test.js`
- new days merge in
- overlapping days upsert, NOT summed (the core property)
- running twice on identical input is a no-op (idempotency)
- empty API response → unchanged map
- out-of-order / unsorted days handled
- total === sum of map values
- `base` is added to the displayed total

`test/renderer.test.js`
- produces valid `<svg ...>` markup
- each named color resolves; valid hex passes; invalid hex falls back
- label override appears, and is XML-escaped
- font-size changes text size AND badge width
- each style branch renders
- abbreviation: 999 → `999`, 1000 → `1K`, 12345 → `12.3K`, 1_500_000 → `1.5M`
- zero state renders `0`

`test/options.test.js`
- defaults applied when inputs absent
- invalid color/font-size/style rejected → default + warning, never throws
- metric validation

`test/fetcher.test.js`
- inject a fake `fetch`; parse the documented API shape
- 404 → empty result, no throw
- rate-limit / non-200 → clear error surfaced to index

## Workflow you should follow

1. Read `ARCHITECTURE.md`.
2. Scaffold `package.json` (Node 20, `"type": "module"`, `test` script = `node --test`).
3. Write `options.js` + its tests. Run tests.
4. Write `accumulator.js` + its tests. Run tests. (Prove the dedup property first.)
5. Write `renderer.js` + its tests. Run tests.
6. Write `fetcher.js` + `store.js` with injectable I/O + tests.
7. Write `index.js` to wire them (keep it dumb).
8. Write `action.yml` (composite) + `.github/workflows/test.yml` (CI) + `release.yml`.
9. Write `README.md`: what it is (a **traffic badge**), the honesty caveat, one-file setup
   (example consuming workflow named `github-traffic-badge.yml`), customisation table, and the
   badge URL pointing at the `traffic-data` branch.
10. Run full suite; confirm green; confirm zero deps in `package.json`.

## Definition of done

- `node --test` passes, zero dependencies in `package.json`.
- Accumulator dedup + idempotency proven by tests.
- All customisation inputs work and are validated.
- README lets a stranger set it up with one workflow file and one README line.
- README states plainly: this counts repo traffic, not profile views.

## Git Commit Conventions

## Format
- type: short subject line (max 50 chars)
- Detailed body paragraph explaining what and why (not how).

## Rules
- No Claude attribution - NEVER include "Generated with Claude Code" or "Co-Authored-By: Claude"
- Keep first line under 50 characters
- Use heredoc for multi-line commit messages
