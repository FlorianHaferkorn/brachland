/**
 * Laubbüschel-Atlas, Schritt 1 (D282): Poly-Haven-Baum (CC0) laden und Ausschnitte der Aussenkrone rendern.
 *   node tools/laubbueschel/bake.mjs tree_small_02 [n=16] [kante_m=0.5] [px=1024]
 * Schreibt `.cache/laubbueschel/out/<id>_<nr>.png` (Hintergrund Magenta) und `<id>.json`.
 * Schritt 2: `python3 tools/laubbueschel/pack.py` packt die gewählten Ausschnitte zu `public/material/laub-bueschel.webp`.
 * Braucht Playwright (global → `PLAYWRIGHT=/opt/node22/lib/node_modules/playwright/index.mjs`) und Netz zu
 * api.polyhaven.com; die Rohdateien (50–100 MB je Baum, glTF 1K) bleiben in `.cache/` (gitignored).
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const [id, n = '16', s = '0.5', px = '1024'] = process.argv.slice(2);
if (!id) { console.error('Aufruf: node tools/laubbueschel/bake.mjs <poly-haven-id> [n] [kante_m] [px]'); process.exit(1); }
const muster = process.env.MUSTER ?? 'leaf|leaves|twig';
const wurzel = resolve('.cache/laubbueschel');
const modell = join(wurzel, 'modelle', id), out = join(wurzel, 'out');
mkdirSync(join(modell, 'textures'), { recursive: true }); mkdirSync(out, { recursive: true });

if (!existsSync(join(modell, `${id}.gltf`))) {
  const f = (await (await fetch(`https://api.polyhaven.com/files/${id}`)).json()).gltf['1k'].gltf;
  const hol = async (url, ziel) => writeFileSync(ziel, Buffer.from(await (await fetch(url)).arrayBuffer()));
  await hol(f.url, join(modell, `${id}.gltf`));
  for (const [rel, v] of Object.entries(f.include)) await hol(v.url, join(modell, rel));
}

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.gltf': 'application/json', '.bin': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png' };
const abbilden = (u) => {
  if (u === '/bake.html') return resolve('tools/laubbueschel/bake.html');
  if (u.startsWith('/three/')) return join(resolve('node_modules/three'), u.slice(7));
  if (u.startsWith('/modelle/')) return join(wurzel, 'modelle', u.slice(9));
  return null;
};
const srv = createServer((q, r) => {
  const p = abbilden(decodeURIComponent(q.url.split('?')[0]));
  if (!p || !existsSync(p) || statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': mime[extname(p)] ?? 'application/octet-stream' }); r.end(readFileSync(p));
}).listen(5198);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('Seitenfehler', e.message.slice(0, 300)));
p.on('console', (m) => console.log('[seite]', m.text().slice(0, 200)));
await p.goto(`http://127.0.0.1:5198/bake.html?id=${id}&n=${n}&s=${s}&px=${px}&muster=${encodeURIComponent(muster)}`);
await p.waitForFunction(() => document.title === 'fertig', null, { timeout: 1200000, polling: 2000 });
const res = await p.evaluate(() => window.__ergebnis);
const meta = res.bilder.map((r) => {
  const f = `${id}_${String(r.nr).padStart(2, '0')}.png`;
  writeFileSync(join(out, f), Buffer.from(r.png.split(',')[1], 'base64'));
  return { file: f, s: r.s };
});
writeFileSync(join(out, `${id}.json`), JSON.stringify({ blatt: res.blatt, groesse: res.groesse, bilder: meta }, null, 1));
console.log(id, 'Blattnetze:', res.blatt.length, res.blatt.slice(0, 6), 'Krone m:', res.groesse.map((x) => x.toFixed(1)), 'Bilder:', meta.length);
await b.close(); srv.close();
