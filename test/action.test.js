import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const actionYml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'action.yml'),
  'utf8'
);

test('commit step does not pass COMMIT_MESSAGE through "-m" (shell-injection vector)', () => {
  // `git commit -m "$COMMIT_MESSAGE"` still expands $(...) and backticks inside
  // double quotes, so a user-supplied commit-message could execute arbitrary
  // shell. The message must be passed via a file or stdin (-F).
  assert.ok(
    !/git\s+commit\b[^\n]*-m\s+"\$COMMIT_MESSAGE"/.test(actionYml),
    'action.yml must not invoke `git commit -m "$COMMIT_MESSAGE"`'
  );
});

test('commit step passes the message via -F (file or stdin)', () => {
  // Either `git commit -F -` (stdin) or `git commit -F <file>` is acceptable;
  // both bypass shell expansion of the message body.
  assert.ok(
    /git\s+commit\b[^\n]*-F\b/.test(actionYml),
    'action.yml must pass commit-message to git via -F to avoid shell expansion'
  );
});
