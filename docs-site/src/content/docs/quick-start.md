---
title: Quick start
description: Set up github-traffic-badge in your repository with one workflow file and one README line.
---

You need two things: a workflow file in your repo, and one Markdown line in
your README that points at the rendered badge.

## 1. Add the workflow

Create `.github/workflows/github-traffic-badge.yml` in your repository:

```yaml
name: github-traffic-badge

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
          metric: views
          color: blue
          label: 'Repo views'
```

The `permissions: contents: write` line is required so the Action can push the
generated badge and `totals.json` to the dedicated data branch.

## 2. Trigger the first run

Run the workflow once manually from the **Actions** tab (`Run workflow`) so it
doesn't have to wait for the next cron. On the first run, the Action creates
an **orphan** branch called `traffic-data` containing `totals.json` and the
rendered badge — no commits land on your `main` branch.

## 3. Embed the badge

Add one line to any README — replace `OWNER` and `REPO` with your repo:

```markdown
![Traffic](https://raw.githubusercontent.com/OWNER/REPO/traffic-data/badge.svg)
```

`raw.githubusercontent.com` serves the badge SVG directly from the data
branch, so each daily run that updates the file is reflected the next time
the image is loaded.

## What happens on every run

1. The Action checks out the `traffic-data` branch (or creates it the first
   time) into a temporary workspace.
2. It calls the GitHub Traffic API for views and clones (the API returns the
   last 14 days).
3. It merges fresh data into the persisted date-keyed map using **upsert** —
   never summing — so overlapping days never double-count.
4. It renders the SVG badge from the new total.
5. If `totals.json` or the badge actually changed, it commits and pushes
   them. Otherwise it exits cleanly without an empty commit.

## Next steps

- See [Configuration](/github-traffic-badge/configuration/) for every input.
- See [Examples](/github-traffic-badge/examples/) for common variations.
