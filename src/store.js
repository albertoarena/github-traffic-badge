export async function readState({ path, readFile }) {
  if (!path) throw new Error('readState: path is required');
  if (typeof readFile !== 'function') throw new Error('readState: readFile is required');
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return null;
    throw err;
  }
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`store: invalid JSON in ${path}: ${err.message}`);
  }
}

export async function writeState({ path, writeFile, state }) {
  if (!path) throw new Error('writeState: path is required');
  if (typeof writeFile !== 'function') throw new Error('writeState: writeFile is required');
  const json = JSON.stringify(state, null, 2) + '\n';
  await writeFile(path, json, 'utf8');
}
