import { promises as fs } from 'node:fs';
import { parseOptions } from './options.js';
import { mergeTraffic, totalFor } from './accumulator.js';
import { render } from './renderer.js';
import { fetchTraffic } from './fetcher.js';
import { readState, writeState } from './store.js';

const STATE_FILE = 'totals.json';

function readInput(env, name) {
  return env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`];
}

function parseRepoSlug(slug) {
  if (typeof slug !== 'string') return null;
  const parts = slug.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], repo: parts[1] };
}

function resolveRepos(reposOption, env, log) {
  const fallback = parseRepoSlug(env.GITHUB_REPOSITORY);
  if (!reposOption || (Array.isArray(reposOption) && reposOption.length === 0)) {
    return fallback ? [fallback] : [];
  }
  if (reposOption === 'all' || (Array.isArray(reposOption) && reposOption.length > 1)) {
    log.warn('multi-repo aggregation is not yet supported; using current repository only.');
    return fallback ? [fallback] : [];
  }
  const slug = Array.isArray(reposOption) ? reposOption[0] : reposOption;
  const parsed = parseRepoSlug(slug);
  return parsed ? [parsed] : (fallback ? [fallback] : []);
}

async function appendOutput(path, lines, writeFile) {
  if (!path) return;
  await writeFile(path, lines.map(l => `${l}\n`).join(''), { flag: 'a' });
}

/**
 * Orchestrate one run of the badge pipeline: read inputs, load existing state,
 * fetch fresh Traffic-API data, merge with upsert/dedup, render the SVG, and
 * persist totals.json and the badge file.
 *
 * The impure layer (filesystem, network, clock, logger) is fully injected so
 * the wire-up itself is testable without disk or network. Inputs are read from
 * `env` using the GitHub Actions `INPUT_<NAME>` convention. If `GITHUB_OUTPUT`
 * is set, the action's outputs (`total`, `badge-path`) are appended to it.
 *
 * Multi-repo aggregation (`repos: all` or a list with more than one entry) is
 * not yet implemented; in that case the run warns and falls back to the
 * current repository identified by `GITHUB_REPOSITORY`.
 *
 * @param {Object} [deps] dependency injection seam (defaults wire real I/O)
 * @returns {Promise<{ total: number, badgePath: string, state: Object, svg: string }>}
 * @throws {Error} when no repository can be resolved or the API call fails
 */
export async function runAction({
  env = process.env,
  readFile = fs.readFile,
  writeFile = fs.writeFile,
  fetch: fetchImpl = globalThis.fetch,
  log = console,
  now = () => new Date().toISOString()
} = {}) {
  const rawInputs = {
    metric: readInput(env, 'metric'),
    color: readInput(env, 'color'),
    label: readInput(env, 'label'),
    'font-size': readInput(env, 'font-size'),
    style: readInput(env, 'style'),
    abbreviated: readInput(env, 'abbreviated'),
    lowercase: readInput(env, 'lowercase'),
    base: readInput(env, 'base'),
    output: readInput(env, 'output'),
    token: readInput(env, 'token'),
    repos: readInput(env, 'repos')
  };

  const { options, warnings } = parseOptions(rawInputs);
  for (const w of warnings) log.warn(w);

  const repos = resolveRepos(options.repos, env, log);
  if (repos.length === 0) {
    throw new Error('no repository to query: set GITHUB_REPOSITORY or pass repos input as owner/repo');
  }
  const { owner, repo } = repos[0];

  const existing = await readState({ path: STATE_FILE, readFile });
  const fresh = await fetchTraffic({ owner, repo, token: options.token, fetch: fetchImpl });
  const next = mergeTraffic(existing, fresh, { now: now() });

  await writeState({ path: STATE_FILE, writeFile, state: next });

  const total = totalFor(next, options.metric, options.base);
  const svg = render(total, options);
  await writeFile(options.output, svg, 'utf8');

  await appendOutput(env.GITHUB_OUTPUT, [
    `total=${total}`,
    `badge-path=${options.output}`
  ], writeFile);

  log.log?.(`github-traffic-badge: ${owner}/${repo} metric=${options.metric} total=${total} → ${options.output}`);

  return { total, badgePath: options.output, state: next, svg };
}

const isDirectEntry = (() => {
  try {
    const argvUrl = new URL(`file://${process.argv[1]}`).href;
    return import.meta.url === argvUrl;
  } catch {
    return false;
  }
})();

if (isDirectEntry) {
  runAction().catch(err => {
    console.error(err.stack || err.message || String(err));
    process.exit(1);
  });
}
