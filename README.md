# github-traffic-badge

A GitHub Action that renders a customisable SVG **traffic badge** from real repository
traffic data (views and clones reported by the GitHub Traffic API), and commits it back
to your repo so you can embed it in a README.

Repository: <https://github.com/albertoarena/github-traffic-badge>

> **What this counts:** real **repository traffic** — views and clones — from the
> GitHub Traffic API.
>
> **What this does not count:** **profile views.** GitHub does not expose any
> profile-views API, and image-based "profile views" counters are unreliable because
> GitHub's Camo proxy caches them. If you've seen those, this is the honest alternative
> for repos.

## Why

- **Trustworthy.** Numbers come from the official Traffic API, not a server you can't audit.
- **Zero cost, zero hosting.** Runs entirely inside your own GitHub account on the
  built-in Actions runner. No external service to sign up for, no server to keep alive.
- **Idempotent persistence.** Traffic data is stored as a date-keyed map on a dedicated
  `traffic-data` branch so re-runs never double-count and your `main` history stays clean.
- **Zero runtime dependencies.** Node 20+, built-in `fetch`, built-in test runner.

## Status

Work in progress. This README will be expanded with a full Quick Start, the
customisation table, and badge examples once the Action is feature-complete. A
documentation website (Astro + Starlight) will be published to GitHub Pages.

## License

[MIT](./LICENSE) © 2026 Alberto Arena
