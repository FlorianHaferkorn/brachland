/**
 * Grashorst-Atlas, Schritt 1 (D272): Poly-Haven-Scans (CC0) laden und jedes Netz seitlich in ein Bild rendern.
 *   node tools/grashorste/bake.mjs grass_medium_01 384   (und grass_medium_02)
 * Schreibt `.cache/grashorste/out/<id>_0_<nr>.png` (Hintergrund Magenta) und `<id>_0.json` (Mass in Metern).
 * Schritt 2: `python3 tools/grashorste/pack.py` packt die gewählten Kacheln zu `public/material/gras-horste.webp`.
 * Braucht Playwright (Chromium, WebGL) und Netz zu api.polyhaven.com; die Rohdateien (~10 MB) bleiben in
 * `.cache/` (gitignored). Herkunft: `assets/HERKUNFT.md`.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const [id, h = '384', az = '0'] = process.argv.slice(2);
if (!id) { console.error('Aufruf: node tools/grashorste/bake.mjs <poly-haven-id> [Pixelhöhe] [Azimut]'); process.exit(1); }
const wurzel = resolve('.cache/grashorste');
const modell = join(wurzel, 'modelle', id), out = join(wurzel, 'out');
mkdirSync(join(modell, 'textures'), { recursive: true }); mkdirSync(out, { recursive: true });

// Laden (einmal): glTF 2K mit Dateien aus der Poly-Haven-API.
if (!existsSync(join(modell, `${id}.gltf`))) {
  const f = (await (await fetch(`https://api.polyhaven.com/files/${id}`)).json()).gltf['2k'].gltf;
  const hol = async (url, ziel) => writeFileSync(ziel, Buffer.from(await (await fetch(url)).arrayBuffer()));
  await hol(f.url, join(modell, `${id}.gltf`));
  for (const [rel, v] of Object.entries(f.include)) await hol(v.url, join(modell, rel));
}

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.gltf': 'application/json', '.bin': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png' };
const abbilden = (u) => {
  if (u === '/bake.html') return resolve('tools/grashorste/bake.html');
  if (u.startsWith('/three/')) return join(resolve('node_modules/three'), u.slice(7));
  if (u.startsWith('/modelle/')) return join(wurzel, 'modelle', u.slice(9));
  return null;
};
const srv = createServer((q, r) => {
  const p = abbilden(decodeURIComponent(q.url.split('?')[0]));
  if (!p || !existsSync(p) || statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': mime[extname(p)] ?? 'application/octet-stream' }); r.end(readFileSync(p));
}).listen(5199);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('Seitenfehler', e.message.slice(0, 300)));
await p.goto(`http://127.0.0.1:5199/bake.html?id=${id}&h=${h}&az=${az}`);
await p.waitForFunction(() => document.title === 'fertig', null, { timeout: 300000 });
const res = await p.evaluate(() => window.__ergebnis);
const meta = res.map((r, i) => {
  const f = `${id}_${az}_${String(i).padStart(2, '0')}.png`;
  writeFileSync(join(out, f), Buffer.from(r.png.split(',')[1], 'base64'));
  return { file: f, name: r.name, w: r.w, h: r.h, pxW: r.pxW, pxH: r.pxH, tris: r.tris };
});
writeFileSync(join(out, `${id}_${az}.json`), JSON.stringify(meta, null, 1));
console.log(id, 'Netze:', res.length);
await b.close(); srv.close();
