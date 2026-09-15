// Sonde: welche InstancedMeshes zeichnen Baeume, mit welcher Geometrie und welchem Material?
// node tools/mess/sonde.mjs "x,z,grad" "&zeit=0.26"
import { playwright } from './pw.mjs';
const { chromium } = await playwright();
const [ort, extra = ''] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 900, height: 620 } });
await p.goto(`http://127.0.0.1:4173/?absetzen=${ort}${extra}`, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('button[aria-label="Menü"]', { timeout: 240000 });
await p.waitForTimeout(12000);
const info = await p.evaluate(() => {
  const scene = window.__szene;
  if (!scene) return { fehler: 'keine Szene (window.__szene)' };
  const aus = [];
  scene.traverse(o => {
    if (!o.isInstancedMesh) return;
    const g = o.geometry; const idx = g.index; const tris = idx ? idx.count / 3 : g.getAttribute('position').count / 3;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    aus.push({ name: o.name, count: o.count, tris, flat: m?.flatShading, typ: m?.type, vc: m?.vertexColors, key: m?.customProgramCacheKey?.() ?? '', attrs: Object.keys(g.attributes).join(',') });
  });
  return aus;
});
console.log(JSON.stringify(info, null, 0));
await b.close();
