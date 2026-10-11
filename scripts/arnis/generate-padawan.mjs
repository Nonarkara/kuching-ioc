import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PILOT, ARNIS } from "./pilot.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const binary = process.argv[2], archive = process.argv[3];
if (!binary || !archive) throw new Error("Usage: node scripts/arnis/generate-padawan.mjs <official-binary> <verified-release-archive>");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
if (sha(await readFile(archive)) !== ARNIS.archiveSha256) throw new Error("Arnis release checksum mismatch");
if (sha(await readFile(binary)) !== ARNIS.binarySha256) throw new Error("Arnis binary checksum mismatch");
const output = path.join(root, "scripts/arnis/.local/worlds");
const worldName = "Kota-Padawan-Pilot";
await mkdir(output, { recursive: true });
const b = PILOT.bounds;
const args = ["--one-world", "--world-name", worldName, "--output-dir", output,
  "--bbox", [b.south,b.west,b.north,b.east].join(","), "--scale", "1",
  "--mode", "geo-terrain", "--overture", "true", "--no-3d",
  "--mapillary-facades", "false", "--spawn-lat", String(PILOT.landmark.lat),
  "--spawn-lng", String(PILOT.landmark.lon)];
console.log("Generating pinned Arnis pilot", ARNIS.version, PILOT.bounds);
if (!process.argv.includes("--package-only")) await new Promise((resolve, reject) => {
  const run = spawn(binary, args, { stdio: "inherit", env: { ...process.env, MAPILLARY_TOKEN: "" } });
  run.on("error", reject);
  run.on("exit", code => code === 0 ? resolve() : reject(new Error("Arnis exit " + code)));
});
const world = path.join(output, worldName);
// Archive only an actual world. The structural verifier is separate from a play test.
await readFile(path.join(world, "level.dat"));
const metadata = JSON.parse(await readFile(path.join(world, "metadata.json"), "utf8"));
await writeFile(path.join(world,"README-IOC.txt"), [
  "Kota Padawan pilot — Greater Kuching IOC",
  "Generated with official Arnis 3.3.0. Exploratory Minecraft Java world, not a survey or flood simulation.",
  "Open the extracted world in a compatible Minecraft Java client. One World uses an extended-height data pack; keep the whole folder intact.",
  "File structure verified separately; in-game loading and walkthrough remain untested.",
  "Source and projection bounds: metadata.json. Do not assume this is complete Padawan municipal coverage.",
  "Building heights, facades and vegetation are rule-based representations, not field observations.",
  "Sources: Arnis (Apache-2.0), OpenStreetMap contributors (ODbL), Overture Maps Foundation, Microsoft ML Buildings, Google Open Buildings.",
  "Terrain and land cover: Mapterhorn, ESA WorldCover 2021, Meta/WRI canopy height.",
  "Attribution details: https://docs.overturemaps.org/attribution/ ; https://www.openstreetmap.org/copyright",
  "Generator: https://github.com/louis-e/arnis/releases/tag/v3.3.0",
  "Dashboard: https://kuching.nonarkara.org/",
].join("\n")+"\n");
const dir = path.join(root, "public/data/buildings");
await mkdir(dir, { recursive: true });
const zipPath = path.join(dir, "kota-padawan-arnis.zip");
execFileSync("ditto", ["-c", "-k", "--norsrc", "--noextattr", "--keepParent", world, zipPath]);
const zip = await readFile(zipPath);
const structural = JSON.parse(execFileSync("python3", [path.join(root, "scripts/arnis/verify-world.py"), zipPath], { encoding: "utf8" }));
if (zip.length > 24 * 1024 * 1024) throw new Error("World exceeds static asset budget; publish separately before wiring a download");
const manifest = { ...PILOT, generator: "Arnis", version: ARNIS.version,
  releaseArchiveSha256: ARNIS.archiveSha256, binarySha256: ARNIS.binarySha256,
  generatedAt: (await stat(path.join(world,"level.dat"))).mtime.toISOString(),
  packagedAt: new Date().toISOString(),
  generationArgs: args.map(a => a === output ? "<local-world-output>" : a),
  worldMetadata: metadata, archive: "kota-padawan-arnis.zip", bytes: zip.length, sha256: sha(zip),
  attribution: "Arnis (Apache-2.0); OpenStreetMap contributors; Overture Maps Foundation; Microsoft ML Buildings; Google Open Buildings; Mapterhorn terrain; ESA WorldCover 2021; Meta/WRI canopy height",
  terrainNote: "Arnis generation used Mapterhorn parent tiles after z16 coverage was absent. Exploratory terrain interpolation, not a survey.",
  verification: { generated: true, structurallyVerified: true, minecraftPlayTest: false,
    regions: structural.region_files, populatedChunks: structural.populated_chunks, sampledBlockTypes: structural.sampled_block_types,
    dataVersion: structural.data_version, spawn: structural.spawn },
  caveat: "Approximate exploratory world, not surveyed buildings or a flood simulation.",
};
await writeFile(path.join(dir, "world-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("Generated world archive bytes:", zip.length);
