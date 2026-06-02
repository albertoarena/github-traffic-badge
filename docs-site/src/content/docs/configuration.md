---
title: Configuration
description: Every input and output of the github-traffic-badge action, with defaults and validation rules.
---

All inputs are optional. Invalid values fall back to the default and emit a
warning in the Action log — the run never fails because of bad configuration.

## Inputs

| Input            | Required | Default                  | Description |
|------------------|----------|--------------------------|-------------|
| `token`          | **yes**  | —                        | Personal Access Token used for the Traffic API. The default `GITHUB_TOKEN` does **not** work — Traffic endpoints require push/admin access. Use a classic PAT with `repo` scope, or a fine-grained PAT with `Administration: read`. |
| `metric`         | no       | `views`                  | One of `views`, `clones`, `views-unique`, `clones-unique`. |
| `color`          | no       | `blue`                   | Named color, or a 6-character hex (no leading `#`). Named colors: `blue`, `green`, `brightgreen`, `yellow`, `orange`, `red`, `grey`, `lightgrey`, `blueviolet`. |
| `label`          | no       | `Repo views`             | Left-side text. Special characters are XML-escaped automatically. |
| `font-size`      | no       | `11`                     | Font size in pixels. Clamped to the range 8–24. |
| `style`          | no       | `flat`                   | One of `flat`, `flat-square`, `plastic`, `for-the-badge`. |
| `abbreviated`    | no       | `false`                  | Abbreviate large numbers (`12345` → `12.3K`). |
| `lowercase`      | no       | `false`                  | Render the label in lowercase (matches the style of most shields.io badges). No effect with the `for-the-badge` style, which is inherently uppercase. |
| `base`           | no       | `0`                      | Non-negative integer offset added to the displayed total. Useful when migrating from another counter. |
| `output`         | no       | `badge.svg`              | Filename of the badge committed to the data branch. |
| `repos`          | no       | current repo             | Comma/space separated `owner/repo` list. Multi-repo aggregation is not yet implemented; falls back to the current repository with a warning. |
| `branch`         | no       | `traffic-data`           | Dedicated branch where `totals.json` and the badge are stored. |
| `commit-message` | no       | `chore: update traffic badge` | Commit message used when the badge or totals change. |

## Outputs

| Output       | Description |
|--------------|-------------|
| `total`      | The displayed total (after applying `base`). |
| `badge-path` | Path to the rendered SVG inside the data branch. |

## Validation rules

The `options` module is pure and never throws on bad input. Each field has a
specific rule:

- **`metric`** — must be exactly one of the four allowed values. Anything else
  falls back to `views`.
- **`color`** — checked against the named-color map first (case-insensitive),
  then against the regex `^[0-9a-fA-F]{6}$`. A leading `#` is rejected.
- **`font-size`** — must be an integer. Values outside `[8, 24]` are clamped
  to the nearest bound. Non-integer or non-numeric input falls back to `11`.
- **`style`** — must be one of the four allowed styles, case-insensitive.
- **`abbreviated`** — accepts a boolean or the strings `"true"`/`"false"`,
  case-insensitive.
- **`lowercase`** — accepts a boolean or the strings `"true"`/`"false"`,
  case-insensitive. The `for-the-badge` style always uppercases its label
  (shields.io convention), so `lowercase: true` has no visible effect there.
- **`base`** — must be a non-negative integer. Negative or non-integer input
  falls back to `0`.
- **`repos`** — accepts a comma/space separated string, an array of strings,
  or the keyword `all`. `all` and multi-entry lists currently fall back to
  the current repository.

## Required permissions

The consuming workflow must grant write access to repository contents:

```yaml
permissions:
  contents: write
```

This is the minimum the built-in `GITHUB_TOKEN` needs to push the badge and
`totals.json` to the data branch.

## Source of truth

Inputs and defaults are defined in
[`action.yml`](https://github.com/albertoarena/github-traffic-badge/blob/main/action.yml).
This page mirrors them.
