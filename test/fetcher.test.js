import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchTraffic, _internals } from '../src/fetcher.js';

function fakeFetch(routes) {
  return async (url) => {
    const route = routes[url];
    if (!route) throw new Error(`unexpected URL: ${url}`);
    return {
      status: route.status,
      statusText: route.statusText || '',
      ok: route.status >= 200 && route.status < 300,
      json: async () => route.body,
      text: async () => (typeof route.body === 'string' ? route.body : JSON.stringify(route.body))
    };
  };
}

test('normalizes timestamps to date keys and counts', async () => {
  const url1 = `${_internals.API_BASE}/repos/o/r/traffic/views`;
  const url2 = `${_internals.API_BASE}/repos/o/r/traffic/clones`;
  const result = await fetchTraffic({
    owner: 'o', repo: 'r', token: 't',
    fetch: fakeFetch({
      [url1]: { status: 200, body: { count: 20, uniques: 7, views: [
        { timestamp: '2026-05-20T00:00:00Z', count: 12, uniques: 4 },
        { timestamp: '2026-05-21T00:00:00Z', count: 8, uniques: 3 }
      ] } },
      [url2]: { status: 200, body: { count: 5, uniques: 3, clones: [
        { timestamp: '2026-05-20T00:00:00Z', count: 2, uniques: 1 }
      ] } }
    })
  });
  assert.deepEqual(result.views, [
    { date: '2026-05-20', count: 12, uniques: 4 },
    { date: '2026-05-21', count: 8, uniques: 3 }
  ]);
  assert.deepEqual(result.clones, [
    { date: '2026-05-20', count: 2, uniques: 1 }
  ]);
});

test('404 produces empty arrays, does not throw', async () => {
  const url1 = `${_internals.API_BASE}/repos/o/r/traffic/views`;
  const url2 = `${_internals.API_BASE}/repos/o/r/traffic/clones`;
  const result = await fetchTraffic({
    owner: 'o', repo: 'r', token: 't',
    fetch: fakeFetch({
      [url1]: { status: 404, statusText: 'Not Found', body: { message: 'Not Found' } },
      [url2]: { status: 404, statusText: 'Not Found', body: { message: 'Not Found' } }
    })
  });
  assert.deepEqual(result, { views: [], clones: [] });
});

test('non-200, non-404 surfaces a clear error', async () => {
  const url1 = `${_internals.API_BASE}/repos/o/r/traffic/views`;
  const url2 = `${_internals.API_BASE}/repos/o/r/traffic/clones`;
  await assert.rejects(
    fetchTraffic({
      owner: 'o', repo: 'r', token: 't',
      fetch: fakeFetch({
        [url1]: { status: 500, statusText: 'server error', body: { message: 'boom' } },
        [url2]: { status: 200, body: { clones: [] } }
      })
    }),
    /500/
  );
});

test('403/401 surfaces a PAT-permission hint', async () => {
  const url1 = `${_internals.API_BASE}/repos/o/r/traffic/views`;
  const url2 = `${_internals.API_BASE}/repos/o/r/traffic/clones`;
  await assert.rejects(
    fetchTraffic({
      owner: 'o', repo: 'r', token: 't',
      fetch: fakeFetch({
        [url1]: { status: 403, statusText: 'Forbidden', body: { message: 'Resource not accessible by integration' } },
        [url2]: { status: 200, body: { clones: [] } }
      })
    }),
    /Personal Access Token|Administration: read/
  );
});

test('empty arrays from the API are preserved', async () => {
  const url1 = `${_internals.API_BASE}/repos/o/r/traffic/views`;
  const url2 = `${_internals.API_BASE}/repos/o/r/traffic/clones`;
  const result = await fetchTraffic({
    owner: 'o', repo: 'r', token: 't',
    fetch: fakeFetch({
      [url1]: { status: 200, body: { views: [] } },
      [url2]: { status: 200, body: { clones: [] } }
    })
  });
  assert.deepEqual(result, { views: [], clones: [] });
});

test('malformed entries (missing timestamp) are skipped', async () => {
  const url1 = `${_internals.API_BASE}/repos/o/r/traffic/views`;
  const url2 = `${_internals.API_BASE}/repos/o/r/traffic/clones`;
  const result = await fetchTraffic({
    owner: 'o', repo: 'r', token: 't',
    fetch: fakeFetch({
      [url1]: { status: 200, body: { views: [
        { timestamp: '2026-05-20T00:00:00Z', count: 5, uniques: 2 },
        { count: 99, uniques: 9 },
        { timestamp: '', count: 1, uniques: 1 }
      ] } },
      [url2]: { status: 200, body: { clones: [] } }
    })
  });
  assert.equal(result.views.length, 1);
  assert.equal(result.views[0].date, '2026-05-20');
});

test('owner and repo are required', async () => {
  await assert.rejects(fetchTraffic({ owner: '', repo: 'r', fetch: async () => {} }), /owner/);
  await assert.rejects(fetchTraffic({ owner: 'o', repo: '', fetch: async () => {} }), /repo/);
});

test('a fetch implementation is required', async () => {
  await assert.rejects(fetchTraffic({ owner: 'o', repo: 'r', fetch: null }), /fetch/);
});

test('Authorization header is set when token is provided', async () => {
  let seenAuth;
  const fakeFetchSpy = async (url, init) => {
    seenAuth = init.headers.Authorization;
    return {
      status: 200, ok: true,
      json: async () => (url.endsWith('/views') ? { views: [] } : { clones: [] }),
      text: async () => ''
    };
  };
  await fetchTraffic({ owner: 'o', repo: 'r', token: 'abc', fetch: fakeFetchSpy });
  assert.equal(seenAuth, 'Bearer abc');
});
