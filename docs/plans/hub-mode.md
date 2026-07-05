# Design: Hub mode (centralised token + single cron)

**Status:** proposal — not yet implemented (key decisions made: see Decisions)
**Date:** 2026-07-05
**Author:** Alberto Arena

## Decisions

- **Badge hosting: Option 1 (centralised, public hub).** Badges live in the hub;
  project READMEs point at the hub's `raw.githubusercontent.com` URL. The hub repo
  is public so raw serving needs no auth; the App key stays an encrypted secret and
  is safe in a public repo.
- **Packaging: Option A (monorepo).** The hub lives inside `github-traffic-badge`
  as a second entrypoint (`src/hub.js`), reusing the pure core via direct imports.
  It is **not** wired into `action.yml`, so the published Action's interface is
  unchanged and Marketplace users never see hub mode.

## Problem

The badge Action is used across several private repos, each running its own daily
cron and each holding its own copy of a Personal Access Token (PAT) as an Actions
secret:

- `github-traffic-badge`
- `laravel-event-sourcing-generator`
- `laravel-netsons-deploy`
- `envaudit`
- `filament-event-sourcing`
- `filament-event-sourcing-demo`
- `llm-review-panel`
- `deskhand`

Every time the PAT expires it must be regenerated and updated in **all** repos.
The token is duplicated N times (larger leak blast radius) and there are N crons
and N workflows to maintain. Adding a new project repeats the whole setup.

The Traffic API requires an elevated credential (`Administration: read`); the
built-in `GITHUB_TOKEN` returns 403, which is why a PAT is used today.

## Goals

- **One credential**, stored in **one** place, that **never needs rotation**.
- **One** cron / workflow to maintain.
- Adding a repo is a **one-line** change.
- Preserve the existing per-repo accumulator dedup/idempotency guarantees.
- Do not lose historical totals during migration.
- Stay within existing constraints: zero runtime deps, pure core untouched, KISS,
  TDD for any new logic.

## Solution overview

Introduce a dedicated **`traffic-hub`** repo. A single daily cron there:

1. Mints a short-lived **GitHub App** installation token (covers all source repos).
2. Loops a config file of repos.
3. For each repo: fetch traffic → accumulate (pure) → render (pure) → write.
4. Commits all updated badges + state in one commit.

The GitHub App's private key **does not expire**, eliminating the rotation
treadmill. The 8 project repos end up with **no workflow, no secret, nothing to
rotate** — they only carry a README line pointing at the rendered badge.

```
                          ┌─────────────────────────────┐
   daily cron  ─────────► │        traffic-hub          │
                          │  (one workflow, one App key) │
                          └──────────────┬──────────────┘
                                         │ mint installation token (App)
                                         │ Administration:read on all repos
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
            Traffic API           Traffic API           Traffic API
          (repo 1)               (repo 2)              (repo N)
                    │                    │                    │
                    └──────────── accumulate (pure) ──────────┘
                                         │  per-repo totals.json (upsert/dedup)
                                         ▼
                                  render (pure) → one SVG per repo
                                         │
                                         ▼
                          commit to traffic-hub `traffic-data` branch
                                         │
         project READMEs ◄──── raw.githubusercontent.com/.../badges/<repo>.svg
```

## GitHub App

- **Cost:** free. **Account:** works on a free personal account (owned by
  `albertoarena`). A GitHub App — *not* an OAuth App — is required for
  fine-grained permissions and short-lived installation tokens.
- **Permissions:**
  - Repository → **Administration: Read** (Traffic API — the reason `GITHUB_TOKEN`
    fails today).
  - Repository → **Contents: Read and write** (only needed for the write-back
    hosting option, below).
- **Installation:** "Only on this account", installed on all source repos (or
  "All repositories").
- **Secrets:** after registering, generate a private key (`.pem`, downloaded once)
  and note the App ID. These become two secrets **in the hub only**:
  `TRAFFIC_APP_ID`, `TRAFFIC_APP_KEY`.
- The private key never expires ⇒ no scheduled rotation. If it is ever manually
  rotated, only the single hub secret changes.

## Hub repo layout

```
traffic-hub/
├── .github/workflows/traffic.yml     # the single daily cron
├── traffic-repos.json                # config: repos + per-repo badge options
└── (traffic-data branch)
    ├── data/
    │   ├── laravel-event-sourcing-generator/totals.json
    │   ├── envaudit/totals.json
    │   └── …one per repo
    └── badges/
        ├── laravel-event-sourcing-generator.svg
        ├── envaudit.svg
        └── …one per repo
```

State is namespaced per source repo, so the accumulator's upsert-by-date dedup
stays **per-repo**. Idempotency is preserved exactly as today: re-running on the
same API data changes nothing.

## Config file (`traffic-repos.json`)

The single place edited to add/remove/customise a project:

```json
[
  { "repo": "laravel-event-sourcing-generator", "label": "Repo views", "metric": "views",  "color": "blue" },
  { "repo": "envaudit",                          "label": "Views",      "metric": "views",  "color": "green" },
  { "repo": "deskhand",                          "label": "Traffic",    "metric": "clones", "color": "orange" }
]
```

Each entry accepts the **same option keys** the Action already validates in
`src/options.js` (`metric`, `color`, `label`, `font-size`, `style`,
`abbreviated`, `base`, `output`). No new validation code — the entry is passed
straight into `parseOptions`.

## Workflow (`traffic-hub/.github/workflows/traffic.yml`)

```yaml
on:
  schedule: [{ cron: "0 3 * * *" }]
  workflow_dispatch:
permissions:
  contents: write            # commit into traffic-hub itself
jobs:
  traffic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/create-github-app-token@v1
        id: app-token
        with:
          app-id: ${{ secrets.TRAFFIC_APP_ID }}
          private-key: ${{ secrets.TRAFFIC_APP_KEY }}
          owner: albertoarena     # omit `repositories:` → token covers the whole installation
      - uses: actions/checkout@v4
        with: { ref: traffic-data }
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: node src/hub.js
        env:
          INPUT_TOKEN: ${{ steps.app-token.outputs.token }}
      - name: Commit if changed
        run: |
          git add -A
          git diff --cached --quiet || (git commit -m "chore: update traffic badges" && git push)
```

Two secrets, one repo. Same idempotent no-empty-commit behaviour as the current
single-repo Action.

## Code changes to the Action

The pure core (`accumulator.js`, `renderer.js`, `options.js`) is **reused
unchanged**. Only one new thin impure module is added.

### New: `src/hub.js` (impure, thin orchestrator)

Reads `traffic-repos.json`; for each entry, inside a `try/catch`:

1. `fetcher.js` → pull views/clones for that repo (token from `INPUT_TOKEN`).
2. `store.js` → `readState({ path: data/<repo>/totals.json })`.
3. `accumulator.js` (pure) → upsert by date.
4. `renderer.js` (pure) → SVG from that repo's parsed options.
5. `store.js` → write `data/<repo>/totals.json` and `badges/<repo>.svg`.

A 404 / empty-traffic / transient failure on one repo **logs and continues** —
it must never abort the other repos (per-repo failure isolation).

### `src/store.js`

Already takes an injected `path` argument (`readState({ path, readFile })`), so
it is effectively hub-ready. Any change is limited to path construction in the
orchestrator, not the store's contract.

### Testing (TDD applies)

- `hub.js`: config parsing, per-repo path construction, failure isolation
  (one repo throwing does not stop others), aggregation of write results.
- The pure modules keep their existing coverage; no new branches there.
- `index.test.js`-style wiring: assert `INPUT_TOKEN` reaches the fetcher and a
  badge file is produced per config entry.

## Badge hosting — one decision

### Option 1 — centralised (recommended)

Badges live in the hub; project READMEs point at the hub raw URL:

```markdown
![Repo views](https://raw.githubusercontent.com/albertoarena/traffic-hub/traffic-data/badges/envaudit.svg)
```

- **Pros:** simplest git (one checkout, one commit). App needs only
  `Administration: read`.
- **Cons:** the hub repo must be **public** so `raw.githubusercontent.com` serves
  without auth. Badges are just numbers, so this is fine; the App key remains an
  encrypted secret and is safe in a public repo. README badge URLs change from the
  current per-repo URLs (a one-time edit).

### Option 2 — write-back (preserves current badge URLs)

The hub fetches centrally but commits each badge into its **own source repo's**
`traffic-data` branch (App token has `Contents: write` there).

- **Pros:** project README URLs stay exactly as they are today; source repos can
  stay **private**.
- **Cons:** the hub checks out/commits to N repos instead of 1 (more git
  plumbing); source repos still receive daily commits — but still no secret or
  workflow of their own. App needs `Contents: write`.

**Decision:** Option 1 (public hub). The hub repo is public so
`raw.githubusercontent.com` serves badges without auth; per-project READMEs move
to the hub badge URL as part of migration.

## Packaging — how the hub code and deployment live

### Option A — Monorepo (decided)

The hub lives inside `github-traffic-badge`: a second entrypoint `src/hub.js`
next to `src/index.js`, plus `traffic-repos.json` and the cron workflow, with this
repo's own `traffic-data` branch holding `data/` + `badges/`.

- `src/hub.js` imports `./accumulator.js`, `./renderer.js`, `./options.js`,
  `./fetcher.js`, `./store.js` directly — zero duplication, one `npm test`.
- Crucially, `src/hub.js` is **not** referenced by `action.yml`. The published
  Action's composite steps still expose only the single-repo interface, so
  Marketplace users never see or invoke hub mode. The product stays minimal; the
  hub is an internal deployment detail sharing the codebase.
- New pure-core behaviour benefits the hub for free (no cross-repo sync).
- Cost: the personal `traffic-repos.json` and rendered badges are visible in the
  public product repo — cosmetic, and contained by keeping hub files together
  (e.g. a `hub/` directory or clearly named files).

### Option B — Separate `traffic-hub` repo (rejected)

Keep the Action pristine and put config + state + cron in a second repo that
consumes the Action. Rejected because either sub-path adds cost without benefit
for a solo, personal deployment:

- **B1:** ship hub mode as a first-class Action feature (multi-repo config input,
  multiple outputs) — bloats the public Action surface, fighting KISS.
- **B2:** `traffic-hub` vendors/pins the internal script — duplication and
  version-drift across two repos.

Option B's only real advantage (isolating personal config) is cosmetic here, so
the extra repo and its drift risk are not worth it.

## Migration (do not reset counts)

The Traffic API only returns the **last 14 days**; the accumulated history lives
in each repo's current `traffic-data` branch. Before disabling the per-repo
workflows:

1. Register + install the App; add `TRAFFIC_APP_ID` / `TRAFFIC_APP_KEY` to the hub.
2. **Seed** the hub once: copy each repo's existing `totals.json` into
   `traffic-hub/data/<repo>/totals.json`. This preserves per-day detail and keeps
   dedup correct (better than the `base` input, which only offsets the displayed
   total).
3. Add `traffic-repos.json`, `src/hub.js`, and the workflow; run once via
   `workflow_dispatch`; verify badges render.
4. Switch project READMEs to the new badge URLs (Option 1) — or leave them as-is
   (Option 2).
5. Delete the per-repo workflows and their `TRAFFIC_TOKEN` secrets.

## Outcome

| | Before | After |
|---|---|---|
| Secrets to rotate | N (a PAT each) | 0 (App key never expires) |
| Workflows to maintain | N | 1 |
| Crons running | N | 1 |
| Add a repo | new secret + workflow | one line in `traffic-repos.json` |
| Token leak blast radius | N copies | 1 copy (short-lived) |

## Open questions

- Keep hub state on a `traffic-data` branch (consistent with the Action today) or
  on `main` of the hub? Branch keeps history tidy and mirrors current behaviour.
  Leaning `traffic-data` branch.
- Serial in-process loop (recommended for ~8 repos, one commit) vs a job matrix
  (parallel, but commit contention / N commits). Start serial; revisit only if the
  repo count grows large.
- Layout of hub files within the repo (e.g. a `hub/` directory for
  `traffic-repos.json` and the workflow) to keep the personal deployment visually
  separate from the product.
