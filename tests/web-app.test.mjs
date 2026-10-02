import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';

test('install manifest references real platform PNG icons with declared dimensions', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.json', import.meta.url)));
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const path = new URL(`../public${icon.src}`, import.meta.url);
    await access(path);
    const png = await readFile(path);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});

test('service worker leaves data requests alone and reports offline navigation honestly', async () => {
  const listeners = {};
  vm.runInNewContext(await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8'), {
    self: { addEventListener: (name, fn) => { listeners[name] = fn; } },
    fetch: async () => { throw new Error('offline'); }, Response
  });
  let intercepted = false;
  listeners.fetch({ request: { mode: 'cors' }, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false, 'Must not substitute cached measurements');
  let response;
  listeners.fetch({ request: { mode: 'navigate' }, respondWith: value => { response = value; } });
  const offline = await response;
  assert.equal(offline.status, 503);
  assert.equal(offline.headers.get('cache-control'), 'no-store');
  assert.match(await offline.text(), /You are offline/);
});
