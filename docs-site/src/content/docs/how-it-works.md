---
title: How it works
description: The data flow, the dedup invariant, and the dedicated traffic-data branch.
---

## Data flow

```
daily cron (in your repo)
        │
        ▼
   fetcher  ── GitHub Traffic API ──► last 14 days of {date, count, uniques}
        │
        ▼
 accumulator (PURE)  ── upsert by date key, dedup, never sum overlapping days
        │
        ▼
   renderer (PURE)   ── total + options ──► SVG string
        │
        ▼
  store + git commit ── totals.json + badge.svg on the `traffic-data` branch
```

## The 14-day overlap problem

The GitHub Traffic API returns the **last 14 days** of data, each as
`{ timestamp, count, uniques }`. If the Action ran daily and simply added the
new `count` total to a running number, it would re-count the 13 overlapping
days on every run — turning a small repository's "views" badge into a
wildly inflated number within a couple of weeks.

The accumulator solves this by storing a **date → { count, uniques }** map
and **upserting by date key** on every run. When the API reports a fresh
value for a day already in the map, the entry is **overwritten**, never
summed. The displayed total is the sum of the map's values, plus the
optional `base` offset.

This makes the pipeline **idempotent**: running it twice on the same input
changes nothing. There are explicit unit tests proving this property.

## Persisted shape

`totals.json` looks like this:

```json
{
  "schema": 1,
  "updatedAt": "2026-06-02T03:00:00Z",
  "views":  {
    "2026-05-20": { "count": 12, "uniques": 4 },
    "2026-05-21": { "count": 8,  "uniques": 3 }
  },
  "clones": {
    "2026-05-20": { "count": 2, "uniques": 1 }
  }
}
```

It is plain JSON committed to a branch in your own repository, so you can
inspect, edit, or audit it at any time.

## The dedicated `traffic-data` branch

The Action commits the badge and `totals.json` to a dedicated branch
(default name `traffic-data`). On first run, the branch is created as an
**orphan** — its history is independent of `main`. No badge updates ever
land on your main branch.

The branch contains only:

- `totals.json` — the persisted date-keyed map
- `badge.svg` (or whatever you set `output` to) — the rendered badge

Embedding the badge in a README uses `raw.githubusercontent.com`:

```markdown
![Traffic](https://raw.githubusercontent.com/OWNER/REPO/traffic-data/badge.svg)
```

## Pure vs impure modules

The project keeps a strict purity boundary so all the branching logic is
unit-testable without network or filesystem mocks bleeding into the core:

- **Pure (exhaustively tested):**
  - `options` — parse and validate inputs
  - `accumulator` — merge fresh data into the persisted map (the dedup
    invariant lives here)
  - `renderer` — produce the SVG string from a total and options
- **Impure (thin, injected I/O):**
  - `fetcher` — calls the GitHub API; takes `fetch` as an argument
  - `store` — reads and writes `totals.json`; takes `readFile`/`writeFile`
  - `index` — orchestrates everything; takes all of the above as arguments

If logic ever creeps into an impure module, it gets moved into a pure one.

## Source

- [`src/accumulator.js`](https://github.com/albertoarena/github-traffic-badge/blob/main/src/accumulator.js)
- [`src/renderer.js`](https://github.com/albertoarena/github-traffic-badge/blob/main/src/renderer.js)
- [`src/options.js`](https://github.com/albertoarena/github-traffic-badge/blob/main/src/options.js)
- [`src/fetcher.js`](https://github.com/albertoarena/github-traffic-badge/blob/main/src/fetcher.js)
- [`src/store.js`](https://github.com/albertoarena/github-traffic-badge/blob/main/src/store.js)
- [`src/index.js`](https://github.com/albertoarena/github-traffic-badge/blob/main/src/index.js)
