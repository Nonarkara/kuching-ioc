import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('reading surfaces override legacy mono faces with the requested Helvetica stack',async()=>{
  const css = await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/--font-sans: "Helvetica Neue", Helvetica, Arial/);
  assert.match(css,/--font-mono: "Helvetica Neue", Helvetica, Arial/);
  assert.match(css,/\.dashboard-shell \*.*\{[\s\S]*?font-family: var\(--font-sans\) !important/);
  assert.match(css,/PingFang SC/);
});
