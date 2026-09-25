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

test('operational controls and primary summaries keep a readable minimum scale', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const readingScale = css.slice(css.indexOf('Operational reading scale'));
  assert.match(readingScale, /html,\s*body\s*\{\s*font-size:\s*16px/);
  assert.match(readingScale, /\.ctrl-btn,[\s\S]*?min-height:\s*36px;\s*font-size:\s*14px/);
  assert.match(readingScale, /\.brief-item[^}]*font-size:\s*14px/);
  assert.match(readingScale, /@media \(max-width: 720px\)[\s\S]*?\.ctrl-btn,[\s\S]*?min-height:\s*48px;\s*font-size:\s*15px/);
});
