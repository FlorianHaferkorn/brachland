/** D302: echter Wechsel zwischen Chunk und Fernbündel, gleiche Kamera/Windphase je Bild.
 * node tools/mess/strauchlauf.mjs <neuer-name> <0|1>
 * Telekamera für die Detailprüfung; zusätzliche normale Spielprüfung bleibt nötig.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { playwright } from './pw.mjs';
const [name, probe, darstellung = 'vollstaendig'] = process.argv.slice(2);
if (!name || !/^[a-z0-9_-]+$/i.test(name) || !['0', '1'].includes(probe)) throw Error('Neuen Namen und0|1 angeben.');
if (!['vollstaendig', 'freigestellt'].includes(darstellung)) throw Error('Darstellung vollstaendig oder freigestellt angeben.');
const ziel = `.cache/mess/${name}`;
if (existsSync(ziel)) throw Error(`Ausgabe existiert: ${ziel}`);
mkdirSync(ziel, { recursive: true });
const { chromium } = await playwright();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: 960, height: 540 } });
await p.addInitScript(() => {
  const original = window.requestAnimationFrame.bind(window), abbruch = window.cancelAnimationFrame.bind(window);
  let pause = false, id = 1000000; const wartend = new Map();
  window.requestAnimationFrame = cb => { if (!pause) return original(cb); const n = id++; wartend.set(n, cb); return n; };
  window.cancelAnimationFrame = n => { if (!wartend.delete(n)) abbruch(n); };
  window.__strauchPause = () => { pause = true; };
  window.__strauchSchritt = () => { const a = [...wartend.values()]; wartend.clear(); for (const cb of a) cb(performance.now()); };
});
const fehler = [], proben = [];
p.on('pageerror', e => fehler.push(String(e)));
p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
try {
  await p.goto(`http://127.0.0.1:4173/?hofgruen=1&strauchweit=${probe}&absetzen=1441,418,0&zeit=0.26&stimmung=zielbild&kontur=0&kamera=1437.6501,99,189.8656,1437.6501,35.5,424.8656&fov=10`);
  await p.waitForFunction(() => window.__szene?.userData.ezKamera && document.body.textContent.includes('Ladezeit'), undefined, { timeout: 180000 });
  await p.waitForTimeout(15000);
  await p.evaluate(() => {
    for (const e of document.querySelectorAll('body *')) if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden';
  });
  await p.evaluate(freistellen => {
    const s = window.__szene, alt = s.onBeforeRender;
    window.__strauch = { index: 0, abstand: 235, ziele: [], fernMenge: 0 };
    s.onBeforeRender = function(gl, szene, kamera, ziel) {
      alt.call(this, gl, szene, kamera, ziel);
      const d = window.__strauch;
      kamera.position.set(1437.6501, 99, 424.8656 - d.abstand);
      kamera.lookAt(1437.6501, 35.5, 424.8656); kamera.updateMatrixWorld(true);
      d.ziele = []; d.fernMenge = 0;
      szene.traverse(o => {
        if (freistellen && /^(baum:|ezbaum:|ezlaub:|ezblend:|ezblendlaub:|ezwarten:|ezwartenlaub:)/.test(o.name)) o.visible = false;
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
          const u = m && gl.properties.get(m).uniforms;
          for (const k of ['uEzZeit', 'uZeit', 'uTime']) if (u?.[k]) u[k].value = 1000 + d.index / 24;
        }
        if (!o.isInstancedMesh || !o.name.startsWith('prop:busch:')) return;
        if (o.userData.hofStrauch && o.name.includes(':fern')) d.fernMenge += o.count;
        for (let i = 0; i < o.count; i++) {
          const a = o.instanceMatrix.array, k = i * 16;
          if (Math.abs(a[k + 12] - 1437.6501) > 0.02 || Math.abs(a[k + 14] - 424.8656) > 0.02) continue;
          let sichtbar = true; for (let q = o; q; q = q.parent) sichtbar &&= q.visible;
          if (!sichtbar) continue;
          d.ziele.push({ name: o.name, geo: o.geometry.uuid, material: o.material.uuid,
            karten: !!o.geometry.getAttribute('blatt'), dreiecke: o.geometry.index ? o.geometry.index.count / 3 : o.geometry.getAttribute('position').count / 3,
            schatten: o.receiveShadow, matrix: Array.from(a.slice(k, k + 16)),
            farbe: o.instanceColor ? Array.from(o.instanceColor.array.slice(i * 3, i * 3 + 3)) : null });
        }
      });
    };
  }, darstellung === 'freigestellt');
  await p.waitForTimeout(1000);
  await p.evaluate(() => window.__strauchPause()); await p.waitForTimeout(200);
  // Zwischen Einzelbildern darf React die neuen Chunk-/Bündellisten einhängen.
  for (let i = 0; i < 16; i++) { await p.evaluate(() => window.__strauchSchritt()); await p.waitForTimeout(10); }
  for (let i = 0; i < 120; i++) {
    const abstand = 235 - 135 * Math.sin(Math.PI * i / 119);
    await p.evaluate(({ i, abstand }) => { Object.assign(window.__strauch, { index: i, abstand }); window.__strauchSchritt(); }, { i, abstand });
    await p.waitForTimeout(10);
    await p.screenshot({ path: `${ziel}/${String(i).padStart(3, '0')}.png` });
    proben.push(await p.evaluate(() => structuredClone(window.__strauch)));
  }
  const stufen = [...new Set(proben.flatMap(b => b.ziele.map(z => z.name.split(':')[2])))];
  const luecken = proben.filter(b => b.ziele.length !== 1).map(b => ({ bild: b.index, anzahl: b.ziele.length }));
  const formen = [...new Set(proben.flatMap(b => b.ziele.map(z => z.geo)))];
  const eigenschaften = [...new Set(proben.flatMap(b => b.ziele.map(z => JSON.stringify([z.matrix, z.farbe, z.schatten]))))];
  const materialien = [...new Set(proben.flatMap(b => b.ziele.map(z => z.material)))];
  const bericht = { probe, darstellung, kamera: 'Erhöhte Telekamera10Grad, XZ235→100→235m,120Bilder mit24Schritten/s; keinFPS-Lauf',
    stufen, luecken, formen, materialien, eigenschaften: eigenschaften.length, maxFernMenge: Math.max(...proben.map(b => b.fernMenge)), proben, fehler };
  if (probe === '1' && (luecken.length || formen.length !== 1 || materialien.length !== 1 || eigenschaften.length !== 1 || !stufen.includes('fern') || !stufen.includes('mittel'))) fehler.push('Strauchform fehlt, wechselt oder beide Verwaltungen wurden nicht durchlaufen.');
  writeFileSync(`${ziel}/bericht.json`, JSON.stringify(bericht, null, 2));
  console.log(JSON.stringify({ ...bericht, proben: proben.length }));
  if (fehler.length) process.exitCode = 1;
} finally { await browser.close(); }
