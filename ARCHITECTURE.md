# ARCHITECTURE.md

**Project:** `github-traffic-badge` — a GitHub Action that renders a customisable SVG
traffic **badge** from real repository traffic data.

## Goal

Show a **trustworthy, fully-tested** traffic badge on a GitHub profile/repo README,
shareable as open source with **zero hosting and zero cost** for both maintainer and user.

## Why not "profile views"

GitHub exposes **no profile-views API**, and the popular badge-image approach
(`![](https://host/?user=X)`) is unreliable: GitHub's Camo proxy caches the image, so
view counts are undercounted and effectively unverifiable. We therefore count **repository
traffic** (views/clones), which the GitHub Traffic API reports as real, verifiable data.
This is an honest, defensible metric. The README must say so plainly.

## Why a GitHub Action (not a hosted service)

| Model | User effort | Maintainer burden | Cost |
|-------|-------------|-------------------|------|
| Hosted badge endpoint | 1 Markdown line | Runs a server forever, owns abuse/uptime | Pays at scale |
| **GitHub Action (chosen)** | 1 workflow file + 1 README line | Publishes code only | **$0** || Fork-and-deploy | High (deploy infra) | None | User pays |

The Action runs in the **user's own account** on free Actions minutes, using the built-in
`GITHUB_TOKEN`. The maintainer hosts nothing. This is the decisive trade-off: marginally
more user setup than a one-liner, but no infrastructure, cost, or liability — which is what
keeps a side project alive.

## Data flow

```
daily cron (in user's repo)
        │
        ▼
   [fetcher]  ── GitHub Traffic API ──►  last 14 days of {date, count, uniques}
        │
        ▼
  [accumulator] (PURE)  ── merge by date key into persisted date→count map (upsert, dedup)
        │
        ▼
   [renderer] (PURE)  ── total + options ──►  SVG string
        │
        ▼
    [store] + git commit ──►  totals.json + badge.svg  on the `traffic-data` branch
```

## Purity boundary

This is the central design principle and the reason the project can be "fully tested"
without flaky network/git mocks bleeding into core logic.

- **Pure (no I/O, exhaustively unit-tested):** `accumulator`, `renderer`, `options`.
  Deterministic functions: same input → same output. These hold all branching logic.
- **Impure (thin, injected, lightly tested):** `fetcher`, `store`, and `index`.
  I/O is passed in (e.g. `fetch` and a file-reader are arguments), so tests substitute fakes.

If logic creeps into an impure module, move it into a pure one. The impure layer should be
boring glue.

## Persistence: why a committed date-map on a dedicated branch

- **14-day API window** forces us to accumulate beyond it → we must persist.
- **A single running number double-counts** the overlapping days on each daily run.
  Solution: persist a **date → {count, uniques}** map and **upsert by date**; total = sum.
  This makes runs **idempotent** (re-running on the same data is a no-op).
- **Committed JSON** (not Actions cache): transparent, user-owned, auditable, no eviction.
  Committed to a **dedicated `traffic-data` branch** so the user's main history stays clean.

## Customisation surface

Inputs are parsed and validated in the pure `options` module (invalid input → default +
warning, never a throw). The renderer consumes the validated options object only.
Supported: `metric`, `color` (named or hex), `label`, `font-size`, `style`, `abbreviated`,
`base`, `output`, `repos`, `token`. See `CLAUDE.md` for the table and validation rules.

`font-size` is the one input that couples to layout: badge **width must scale** with
`text length × font-size`, or text overflows the colored rect. Width computation is pure
and is unit-tested.

## SVG strategy

Hand-written string templating — **no SVG library** (zero-dep constraint). One base
template; `style` branches corner radius / gradient / shape. Char width approximated as
`~0.6 × fontSize`. Text is XML-escaped. Output is standalone valid SVG served via
`raw.githubusercontent.com`.

## Testing strategy

Unit tests on the three pure modules carry the suite; impure modules get thin tests with
injected fakes. CI (`node --test`) runs on every push/PR — the visible green check is the
trust signal the original project lacks. Key properties to assert: dedup/upsert,
idempotency, width-scales-with-font-size, color validation/fallback, abbreviation
thresholds.

## Non-goals

- No profile-view counting (impossible/untrustworthy).
- No hosted service, database, or external account.
- No detailed analytics/dashboards — minimalist single badge only.
- No runtime dependencies.
