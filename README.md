# Traffic Badge

![Repo views](https://raw.githubusercontent.com/albertoarena/github-traffic-badge/traffic-data/badge.svg)

A GitHub Action that renders a customisable SVG **traffic badge** from real
repository traffic data (views and clones reported by the GitHub Traffic API),
and commits it to a dedicated branch in your repo so you can embed it in any
README.

- **Repository:** <https://github.com/albertoarena/github-traffic-badge>
- **Documentation:** <https://albertoarena.github.io/github-traffic-badge/>

> **What this counts:** real **repository traffic** — views and clones — from
> the official GitHub Traffic API.
>
> **What this does not count:** **profile views.** GitHub does not expose any
> profile-views API, and image-based "profile views" badges (proxied through
> GitHub's Camo image cache) are systematically undercounted and effectively
> unverifiable. If you've seen those, this is the honest alternative for
> repositories.

## Why use it

- **Trustworthy.** Numbers come from the official GitHub Traffic API, not from
  a server you can't audit. Persisted data lives in your own repo as plain
  JSON, on a dedicated branch you can inspect at any time.
- **Zero cost, zero hosting.** Runs entirely inside your own GitHub account on
  the free Actions runner.
- **Idempotent.** Traffic data is stored as a date-keyed map and upserted on
  each run, so the 13 overlapping days returned by the API on every daily run
  never double-count. Re-running on the same data is a no-op.
- **Zero runtime dependencies.** Node 20+, built-in `fetch`, built-in test
  runner. Just code you can read end to end.

## Token

> **The default `GITHUB_TOKEN` does not work.** The GitHub Traffic API
> requires push/admin access, which the default token does not have, and
> the Action will fail with `403 Resource not accessible by integration`.

You must provide a **Personal Access Token** stored as a repository secret:

- **Classic PAT** with the `repo` scope, **or**
- **Fine-grained PAT** with `Administration: read` on the target repository.

Create the token at <https://github.com/settings/tokens>, store it as a
repository secret (e.g. `TRAFFIC_TOKEN`), and pass it to the Action via the
`token:` input.

## Quick start

Add a single workflow file to your repository — for example
`.github/workflows/github-traffic-badge.yml`:

```yaml
name: Traffic Badge

on:
  schedule:
    - cron: '0 3 * * *'   # daily at 03:00 UTC
  workflow_dispatch:

permissions:
  contents: write           # required to push the badge to the data branch

jobs:
  update-badge:
    runs-on: ubuntu-latest
    steps:
      - uses: albertoarena/github-traffic-badge@v1
        with:
          token: ${{ secrets.TRAFFIC_TOKEN }}
          metric: views
          color: blue
          label: 'Repo views'
```

Then add one line to any README — replace `OWNER` and `REPO` with your repo:

```markdown
![Traffic](https://raw.githubusercontent.com/OWNER/REPO/traffic-data/badge.svg)
```

That's it. The action runs on its cron, refreshes traffic data, regenerates
the badge, and pushes the changes to a dedicated `traffic-data` branch (kept
separate from `main`).

## Inputs

All inputs except `token` are optional. Invalid values fall back to the
default and emit a warning in the Action log.

| Input            | Required | Default                  | Description |
|------------------|----------|--------------------------|-------------|
| `token`          | **yes**  | —                        | PAT with `repo` (classic) or `Administration: read` (fine-grained). See [Token](#token). |
| `metric`         | no       | `views`                  | One of `views`, `clones`, `views-unique`, `clones-unique`. |
| `color`          | no       | `blue`                   | Named color or a 6-character hex (no leading `#`). Named: `blue`, `green`, `brightgreen`, `yellow`, `orange`, `red`, `grey`, `lightgrey`, `blueviolet`. |
| `label`          | no       | `Repo views`             | Left-side text. XML-escaped automatically. |
| `font-size`      | no       | `11`                     | Font size in pixels. Clamped to 8–24. |
| `style`          | no       | `flat`                   | One of `flat`, `flat-square`, `plastic`, `for-the-badge`. |
| `abbreviated`    | no       | `false`                  | Abbreviate large numbers (`12345` → `12.3K`). |
| `lowercase`      | no       | `false`                  | Render the label in lowercase (matches the style of most shields.io badges). No effect with the `for-the-badge` style, which is inherently uppercase. |
| `base`           | no       | `0`                      | Non-negative integer offset added to the displayed total. |
| `output`         | no       | `badge.svg`              | Filename of the badge committed to the data branch. |
| `repos`          | no       | current repo             | Comma/space separated `owner/repo` list. Multi-repo aggregation is not yet implemented; falls back to the current repository with a warning. |
| `branch`         | no       | `traffic-data`           | Dedicated branch where `totals.json` and the badge are stored. |
| `commit-message` | no       | `chore: update traffic badge` | Commit message used when the badge or totals change. |

## Outputs

| Output       | Description |
|--------------|-------------|
| `total`      | The displayed total (after applying `base`). |
| `badge-path` | Path to the rendered SVG inside the data branch. |

## How it works

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

The API returns the **last 14 days** every time. The accumulator stores a
**date → { count, uniques }** map and **upserts by date**, so the 13
overlapping days never double-count. The displayed total is the sum of the
map (plus the optional `base`).

The `traffic-data` branch is **orphan** on first run, so its history is
independent of your `main` branch.

## Examples

```yaml
# Show unique daily visitors instead of raw views
- uses: albertoarena/github-traffic-badge@v1
  with:
    token: ${{ secrets.TRAFFIC_TOKEN }}
    metric: views-unique
    label: 'Unique visitors'
    color: brightgreen

# Custom hex color and a for-the-badge style
- uses: albertoarena/github-traffic-badge@v1
  with:
    token: ${{ secrets.TRAFFIC_TOKEN }}
    color: ff66cc
    style: for-the-badge
    abbreviated: true

# Migrating from another counter that was already at 5000
- uses: albertoarena/github-traffic-badge@v1
  with:
    token: ${{ secrets.TRAFFIC_TOKEN }}
    base: 5000
```

## Documentation

Full documentation — quick start, configuration reference, how it works,
examples, and contributing — is published at
<https://albertoarena.github.io/github-traffic-badge/>.

## Contributing

```bash
git clone https://github.com/albertoarena/github-traffic-badge
cd github-traffic-badge
node --test
```

Node 20+ is required. The project has **zero runtime dependencies** — this
is enforced in CI.

## License

[MIT](./LICENSE) © 2026 Alberto Arena
