const API_BASE = 'https://api.github.com';

function tsToDate(ts) {
  if (typeof ts !== 'string') return '';
  const idx = ts.indexOf('T');
  return idx > 0 ? ts.slice(0, idx) : ts;
}

function normalizeEntries(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const e of arr) {
    if (!e || typeof e !== 'object') continue;
    const date = tsToDate(e.timestamp);
    if (!date) continue;
    out.push({
      date,
      count: Number.isFinite(e.count) ? e.count : 0,
      uniques: Number.isFinite(e.uniques) ? e.uniques : 0
    });
  }
  return out;
}

async function getJson({ url, token, fetchImpl }) {
  const res = await fetchImpl(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': token ? `Bearer ${token}` : '',
      'User-Agent': 'github-traffic-badge',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (res.status === 404) return { _missing: true };
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status} ${res.statusText} for ${url}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  return res.json();
}

/**
 * Fetch repository traffic (views and clones) from the GitHub Traffic API.
 *
 * Impure but thin: the `fetch` implementation is injected so tests can
 * substitute a fake. The two endpoints are called in parallel, timestamps are
 * normalised to YYYY-MM-DD date keys, and a 404 is treated as an empty result
 * (e.g. when the token lacks access to a specific repo) rather than an error.
 * Any other non-200 response is surfaced as a clear Error with status and body.
 *
 * @param {{ owner: string, repo: string, token?: string, fetch?: Function }} args
 * @returns {Promise<{ views: Array<{date:string,count:number,uniques:number}>, clones: Array<{date:string,count:number,uniques:number}> }>}
 * @throws {Error} on missing owner/repo, missing fetch, or non-200/non-404 response
 */
export async function fetchTraffic({ owner, repo, token, fetch: fetchImpl = globalThis.fetch }) {
  if (!owner || !repo) throw new Error('fetchTraffic: owner and repo are required');
  if (typeof fetchImpl !== 'function') throw new Error('fetchTraffic: a fetch implementation is required');

  const viewsUrl = `${API_BASE}/repos/${owner}/${repo}/traffic/views`;
  const clonesUrl = `${API_BASE}/repos/${owner}/${repo}/traffic/clones`;

  const [viewsRes, clonesRes] = await Promise.all([
    getJson({ url: viewsUrl, token, fetchImpl }),
    getJson({ url: clonesUrl, token, fetchImpl })
  ]);

  return {
    views: viewsRes._missing ? [] : normalizeEntries(viewsRes.views),
    clones: clonesRes._missing ? [] : normalizeEntries(clonesRes.clones)
  };
}

export const _internals = { API_BASE, tsToDate, normalizeEntries };
