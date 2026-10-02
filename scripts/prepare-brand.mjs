// Mechanical production sizing of the transparent extraction tool outputs.
// Run with the bundled sharp runtime: NODE_PATH=<bundled node_modules> node ...
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const [colourPath, monoPath, appPath] = process.argv.slice(2);
if (!appPath) throw new Error('Provide colour, monochrome and app extraction paths.');
const out = new URL('../public/assets/brand/', import.meta.url);
await mkdir(out, { recursive: true });
await sharp(colourPath).trim().resize(512, 512, { fit: 'contain', background: '#00000000' }).png().toFile(fileURLToPath(new URL('colour-mark.png', out)));
await sharp(monoPath).trim().resize({ width: 800 }).png().toFile(fileURLToPath(new URL('mono-lockup.png', out)));
// A single-colour compact variant keeps the skyline at small control sizes.
const { data, info } = await sharp(colourPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) { data[i] = 47; data[i + 1] = 73; data[i + 2] = 97; }
await sharp(data, { raw: info }).trim().resize(192, 192, { fit: 'contain', background: '#00000000' }).png().toFile(fileURLToPath(new URL('mono-mark.png', out)));
await sharp(appPath).trim().resize(512, 512, { fit: 'contain', background: '#00000000' }).png().toFile(fileURLToPath(new URL('app-mark.png', out)));
// Platform icon canvases are opaque by design. Transparent logo cutouts show
// this backing colour, just as the same mark shows the page through its gaps.
for (const [name, size, inset] of [['app-icon-192.png', 192, 12], ['app-icon-512.png', 512, 32], ['apple-touch-icon.png', 180, 12], ['app-maskable-512.png', 512, 72]]) {
  const tile = await sharp(appPath).trim().resize(size - 2 * inset, size - 2 * inset, { fit: 'contain', background: '#00000000' }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#c9d8e6' } }).composite([{ input: tile, left: inset, top: inset }]).png().toFile(fileURLToPath(new URL(name, out)));
}
console.log('Brand PNGs and platform icons prepared.');
