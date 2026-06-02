/**
 * Read and parse persisted state from disk.
 *
 * Thin and impure: `readFile` is injected so tests substitute a fake. A missing
 * file (ENOENT) or empty file returns `null` rather than throwing, so the
 * first-ever run starts from an empty state. Invalid JSON throws with the
 * offending path for easier debugging.
 *
 * @param {{ path: string, readFile: Function }} args
 * @returns {Promise<Object|null>} parsed state, or null if the file does not exist
 */
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

/**
 * Serialise state to JSON and write it to disk.
 *
 * Thin and impure: `writeFile` is injected. Always appends a trailing newline
 * for clean diffs when the file is committed back to the data branch.
 *
 * @param {{ path: string, writeFile: Function, state: Object }} args
 * @returns {Promise<void>}
 */
export async function writeState({ path, writeFile, state }) {
  if (!path) throw new Error('writeState: path is required');
  if (typeof writeFile !== 'function') throw new Error('writeState: writeFile is required');
  const json = JSON.stringify(state, null, 2) + '\n';
  await writeFile(path, json, 'utf8');
}
