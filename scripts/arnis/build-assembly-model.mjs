// Hand model of Dewan Undangan Negeri Sarawak (the golden umbrella roof).
// Photogrammetry was not used: this VM has no GPU, and the Commons photographs
// are separate visitor views rather than an overlapping survey. Dimensions follow
// the OSM footprint (about 108 m across) and the tagged 9 storeys × 3.2 m.
// The roof form is interpretive, matched to CC BY-SA photographs.
import { writeFile } from "node:fs/promises";
import { Document, NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import { draco } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";

const RIBS = 9;
const STEPS = 90;
const PROFILE = [
  [0.8, 35.4], [2.2, 33.2], [4.5, 29.4], [8, 24.2], [13, 19.6],
  [19, 16.2], [26, 14.15], [33, 12.85], [39, 12.2], [43.5, 13.45],
];

function roofVertex(step, profileIndex) {
  const angle = (step / STEPS) * Math.PI * 2;
  const rib = (Math.PI * 2) / RIBS;
  const fold = Math.sin(((angle % rib) / rib) * Math.PI);
  const [radius, height] = PROFILE[profileIndex];
  const r = radius * (1 - fold * 0.04);
  const y = height - fold * 1.55 * Math.min(1, radius / 18);
  return [Math.cos(angle) * r, y, Math.sin(angle) * r];
}

function pushTri(indices, a, b, c) { indices.push(a, b, c); }

function addSurface(positions, indices, rings, wrap = true) {
  const base = positions.length / 3;
  const rows = rings.length;
  const cols = rings[0].length;
  for (const ring of rings) for (const p of ring) positions.push(p[0], p[1], p[2]);
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const c2 = wrap ? (c + 1) % cols : c + 1;
      if (!wrap && c === cols - 1) continue;
      const i00 = base + r * cols + c;
      const i01 = base + r * cols + c2;
      const i10 = base + (r + 1) * cols + c;
      const i11 = base + (r + 1) * cols + c2;
      pushTri(indices, i00, i10, i11);
      pushTri(indices, i00, i11, i01);
    }
  }
}

function annulus(y, r0, r1, segs = 48) {
  const inner = [], outer = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    inner.push([Math.cos(a) * r0, y, Math.sin(a) * r0]);
    outer.push([Math.cos(a) * r1, y, Math.sin(a) * r1]);
  }
  return [inner, outer];
}

function wall(y0, y1, radius, segs = 28) {
  const bottom = [], top = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    bottom.push([Math.cos(a) * radius, y0, Math.sin(a) * radius]);
    top.push([Math.cos(a) * radius, y1, Math.sin(a) * radius]);
  }
  return [bottom, top];
}

function column(cx, cz, radius, y0, y1, sides = 6) {
  return wall(y0, y1, radius, sides).map(ring => ring.map(([x, y, z]) => [x + cx, y, z + cz]));
}

function normalsFor(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3, ib = indices[i + 1] * 3, ic = indices[i + 2] * 3;
    const e1x = positions[ib] - positions[ia], e1y = positions[ib + 1] - positions[ia + 1], e1z = positions[ib + 2] - positions[ia + 2];
    const e2x = positions[ic] - positions[ia], e2y = positions[ic + 1] - positions[ia + 1], e2z = positions[ic + 2] - positions[ia + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    for (const k of [ia, ib, ic]) { normals[k] += nx; normals[k + 1] += ny; normals[k + 2] += nz; }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= len; normals[i + 1] /= len; normals[i + 2] /= len;
  }
  return normals;
}

function part() {
  return { positions: [], indices: [] };
}

const gold = part();
const stone = part();
const glass = part();
const water = part();

const roofRings = PROFILE.map((_, p) => Array.from({ length: STEPS }, (__, s) => roofVertex(s, p)));
addSurface(gold.positions, gold.indices, roofRings);
// Finial.
const finial = [[0, 41.2, 0]];
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2;
  finial.push([Math.cos(a) * 0.7, 35.6, Math.sin(a) * 0.7]);
}
{
  const base = gold.positions.length / 3;
  for (const p of finial) gold.positions.push(p[0], p[1], p[2]);
  for (let i = 0; i < 12; i++) pushTri(gold.indices, base, base + 1 + i, base + 1 + ((i + 1) % 12));
}

addSurface(stone.positions, stone.indices, wall(0, 0.45, 47, 40));
addSurface(stone.positions, stone.indices, wall(0.45, 1.7, 27, 24));
addSurface(stone.positions, stone.indices, wall(1.7, 11.8, 15.2, 24));
for (let i = 0; i < 18; i++) {
  const a = (i / 18) * Math.PI * 2;
  addSurface(stone.positions, stone.indices, column(Math.cos(a) * 20.5, Math.sin(a) * 20.5, 0.55, 1.7, 13.6));
}
addSurface(glass.positions, glass.indices, wall(5.2, 9.4, 15.55, 24));
addSurface(water.positions, water.indices, annulus(0.08, 47, 53, 40));

const doc = new Document();
doc.createExtension(KHRDracoMeshCompression).setRequired(true);
const buffer = doc.createBuffer();
const materials = {
  gold: doc.createMaterial("GoldRoof").setDoubleSided(true).setMetallicFactor(0.62).setRoughnessFactor(0.32)
    .setBaseColorFactor([0.93, 0.71, 0.22, 1]).setEmissiveFactor([0.28, 0.16, 0.03]),
  stone: doc.createMaterial("Stone").setDoubleSided(true).setMetallicFactor(0.04).setRoughnessFactor(0.72)
    .setBaseColorFactor([0.93, 0.91, 0.86, 1]),
  glass: doc.createMaterial("Glass").setDoubleSided(true).setMetallicFactor(0.15).setRoughnessFactor(0.18)
    .setBaseColorFactor([0.22, 0.30, 0.36, 1]),
  water: doc.createMaterial("Pool").setDoubleSided(true).setMetallicFactor(0.05).setRoughnessFactor(0.22)
    .setBaseColorFactor([0.42, 0.62, 0.68, 1]),
};
const mesh = doc.createMesh("DewanUndanganNegeri");
for (const [name, data] of Object.entries({ gold, stone, glass, water })) {
  const position = doc.createAccessor().setType("VEC3").setArray(new Float32Array(data.positions)).setBuffer(buffer);
  const normal = doc.createAccessor().setType("VEC3").setArray(normalsFor(data.positions, data.indices)).setBuffer(buffer);
  const index = doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(data.indices)).setBuffer(buffer);
  mesh.addPrimitive(doc.createPrimitive().setAttribute("POSITION", position).setAttribute("NORMAL", normal).setIndices(index).setMaterial(materials[name]));
}
const node = doc.createNode("DewanUndanganNegeri").setMesh(mesh);
doc.createScene("DUN").addChild(node);
const root = doc.getRoot();
root.setDefaultScene(root.listScenes()[0]);
root.getAsset().generator = "kuching-ioc hand model";
root.getAsset().copyright = "Form modelled for Kuching IOC from CC BY-SA 4.0 photographs and OSM way 1357531465. Not a survey.";

const io = new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({
  "draco3d.encoder": await draco3d.createEncoderModule(),
});
await doc.transform(draco({ method: "edgebreaker", encodeSpeed: 5, decodeSpeed: 5 }));
const glb = await io.writeBinary(doc);
const out = new URL("../../public/data/buildings/dun-sarawak.glb", import.meta.url);
await writeFile(out, glb);
console.log("glb bytes", glb.byteLength);
