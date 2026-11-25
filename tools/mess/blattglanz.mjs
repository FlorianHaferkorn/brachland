/** D301: Mattes EZ-Laub mit echtem Three-Phong-Renderer auf Grazing-Glanz prüfen.
 * node tools/mess/blattglanz.mjs
 * Schwarze Diffus-/Glanz-/Emissionsfarbe bei schräg gegenüberliegender Kamera und Sonne.
 * Der Produktionshook wird unverändert transpiliert und im Browser ausgeführt.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { playwright } from './pw.mjs';

const modul = ts.transpileModule(readFileSync('src/world/ezlaubmaterial.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const dateien = new Map([
  ['/three.module.js', readFileSync(resolve('node_modules/three/build/three.module.js'))],
  ['/three.core.js', readFileSync(resolve('node_modules/three/build/three.core.js'))],
  ['/ezlaubmaterial.js', modul],
]);
const { chromium } = await playwright();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const seite = await browser.newPage();
const fehler = [];
seite.on('pageerror', e => fehler.push(String(e)));
seite.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
await seite.route('http://blattprobe.invalid/**', route => {
  const pfad = new URL(route.request().url()).pathname;
  if (pfad === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><script type="importmap">{"imports":{"three":"/three.module.js"}}</script></html>' });
  if (dateien.has(pfad)) return route.fulfill({ contentType: 'text/javascript', body: dateien.get(pfad) });
  return route.fulfill({ status: 404, body: 'Nicht Teil der GPU-Probe.' });
});
try {
  await seite.goto('http://blattprobe.invalid/');
  const ergebnisse = await seite.evaluate(async () => {
    const THREE = await import('three');
    const { ergaenzeEzLaublicht } = await import('/ezlaubmaterial.js');
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(32, 32); renderer.setClearColor(0x000000, 1); renderer.toneMapping = THREE.NoToneMapping;
    const ziel = new THREE.WebGLRenderTarget(32, 32, { type: THREE.UnsignedByteType });
    const szene = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(20, 1, 0.1, 100);
    kamera.position.set(10, 0, 1); kamera.lookAt(0, 0, 0);
    const sonne = new THREE.DirectionalLight(0xffffff, 10);
    sonne.position.set(-10, 0, 1); szene.add(sonne, sonne.target);
    const geometrie = new THREE.PlaneGeometry(100, 100);
    const ergebnisse = [];
    for (const matt of [false, true]) {
      const material = new THREE.MeshPhongMaterial({ color: 0x000000, specular: 0x000000, emissive: 0x000000, shininess: 30 });
      ergaenzeEzLaublicht(material, matt);
      const mesh = new THREE.Mesh(geometrie, material); szene.add(mesh);
      renderer.setRenderTarget(ziel); renderer.render(szene, kamera);
      const pixel = new Uint8Array(4); renderer.readRenderTargetPixels(ziel, 16, 16, 1, 1, pixel);
      ergebnisse.push({ matt, pixel: Array.from(pixel), webglFehler: renderer.getContext().getError() });
      szene.remove(mesh); material.dispose();
    }
    geometrie.dispose(); ziel.dispose(); renderer.dispose();
    return ergebnisse;
  });
  console.log(JSON.stringify({ ergebnisse, fehler }, null, 2));
  assert.deepEqual(fehler, [], 'Keine Browser-/Shaderfehler');
  assert.ok(ergebnisse.every(e => e.webglFehler === 0), 'Keine WebGL-Fehler');
  assert.ok(ergebnisse[0].pixel.slice(0, 3).some(v => v > 0), 'Gegenprobe zeigt Fresnel-Glanz trotz schwarzer Glanzfarbe');
  assert.deepEqual(ergebnisse[1].pixel.slice(0, 3), [0, 0, 0], 'Mattes Blatt darf keinen Fresnel-Restglanz liefern');
  console.log('Phong-GPU-Probe bestanden: Gegenprobe hell, mattes Blatt schwarz.');
} finally { await browser.close(); }
