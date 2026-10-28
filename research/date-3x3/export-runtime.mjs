// Lossless selected print and legal source-to-display routes; no runtime solver.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const root = dirname(new URL(import.meta.url).pathname);
const dest = resolve(process.argv[2] ?? 'work/calendar-runtime');
mkdirSync(dest, { recursive: true });
for (const [id, file] of [['de-a', 'witnesses/de-2.json'], ['en-3-zero', 'adjacent/witnesses/en-adjacent-3-zero.json'], ['en-3-unpadded', 'adjacent/witnesses/en-adjacent-3-unpadded.json']]) {
  const w = JSON.parse(readFileSync(resolve(root, file), 'utf8'));
  if (!w.complete || w.targets.length !== 2562) throw Error('Incomplete witness');
  const targets = w.targets.map(t => ({ weekday: t.weekday, day: t.day, month: t.month, cells: t.cells, word: [t.prelude, t.word, t.centerCorrection].filter(Boolean).join(' ') }));
  writeFileSync(resolve(dest, `${id}.json`), JSON.stringify({schema: 'cubistry.calendar-runtime', version: 1, id, printing: w.printing, targets})+'\n');
}
