/**
 * Writes the mock-mode fixtures to `fixtures/` (run from the repo root with
 * `npm run fixtures:generate`). Deterministic: running it twice gives no diff.
 * JSON files under `fixtures/` that the build no longer produces are removed.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { buildFixtures, serializeFixture } from './fixtures/build';

const root = join(process.cwd(), 'fixtures');

function jsonFilesUnder(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return jsonFilesUnder(path);
    return entry.name.endsWith('.json') ? [path] : [];
  });
}

const files = buildFixtures();
for (const [file, value] of files) {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeFixture(value));
}
for (const path of jsonFilesUnder(root)) {
  if (!files.has(relative(root, path).split('\\').join('/'))) rmSync(path);
}
console.log(`Wrote ${files.size} fixture files to ${relative(process.cwd(), root)}/`);
