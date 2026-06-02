---
title: Examples
description: Common variations of the github-traffic-badge action.
---

## Unique visitors instead of raw views

```yaml
- uses: albertoarena/github-traffic-badge@v1
  with:
    token: ${{ secrets.TRAFFIC_TOKEN }}
    metric: views-unique
    label: 'Unique visitors'
    color: brightgreen
```

## Clones counter

```yaml
- uses: albertoarena/github-traffic-badge@v1
  with:
    token: ${{ secrets.TRAFFIC_TOKEN }}
    metric: clones
    label: 'Clones'
    color: orange
    output: clones.svg
```

Embed it:

```markdown
![Clones](https://raw.githubusercontent.com/OWNER/REPO/traffic-data/clones.svg)
```

## Custom hex color

A 6-character hex (no leading `#`):

```yaml
- uses: albertoarena/github-traffic-badge@v1
  with:
    token: ${{ secrets.TRAFFIC_TOKEN }}
    color: ff66cc
```

## Large flat style

```yaml
- uses: albertoarena/github-traffic-badge@v1
  with:
    token: ${{ secrets.TRAFFIC_TOKEN }}
    style: for-the-badge
    font-size: 14
    abbreviated: true
```

## Migrating from another counter

If you already had a counter showing 5,000, preserve the displayed total:

```yaml
- uses: albertoarena/github-traffic-badge@v1
  with:
    token: ${{ secrets.TRAFFIC_TOKEN }}
    base: 5000
```

The `base` is added on top of the real Traffic-API total.

## Multiple badges from one repo

Run the Action twice with different `output` filenames so the two badges live
side by side on the data branch:

```yaml
jobs:
  views-badge:
    runs-on: ubuntu-latest
    steps:
      - uses: albertoarena/github-traffic-badge@v1
        with:
          token: ${{ secrets.TRAFFIC_TOKEN }}
          metric: views
          output: views.svg
          color: blue
          label: 'Views'

  clones-badge:
    runs-on: ubuntu-latest
    steps:
      - uses: albertoarena/github-traffic-badge@v1
        with:
          token: ${{ secrets.TRAFFIC_TOKEN }}
          metric: clones
          output: clones.svg
          color: orange
          label: 'Clones'
```

## Custom branch name

If `traffic-data` collides with something in your repo, change it:

```yaml
- uses: albertoarena/github-traffic-badge@v1
  with:
    token: ${{ secrets.TRAFFIC_TOKEN }}
    branch: badge-data
```

Then point the README at the new branch:

```markdown
![Traffic](https://raw.githubusercontent.com/OWNER/REPO/badge-data/badge.svg)
```
