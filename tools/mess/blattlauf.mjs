/** D300: gleiche Subpixelbewegung im echten Renderer, ohne Wind-/TAA-Phasen als Störgrösse.
 * node tools/mess/blattlauf.mjs <neuer-name> <0|1>
 * 48 TAA-Bilder erfassen drei AO-Zyklen; die Bildfolgen sind keine FPS-Messung.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { playwright } from './pw.mjs';
const [name, probe, modus = 'subpixel', extra = '', ausschnitt = 'krone'] = process.argv.slice(2);
if (!name || !/^[a-z0-9_-]+$/i.test(name) || !['0', '1'].includes(probe)) throw Error('Neuen Namen und 0|1 angeben.');
if (!['subpixel', 'taa', 'fahrt'].includes(modus)) throw Error('Modus subpixel, taa oder fahrt angeben.');
const hof = ausschnitt === 'hof708';
if (!['krone', 'hof708'].includes(ausschnitt) || (hof && modus === 'fahrt')) throw Error('Hof 708 unterstützt Subpixel- und TAA-Probe.');
const anzahl = modus === 'fahrt' ? 96 : modus === 'taa' ? 48 : 24;
const ziel = `.cache/mess/${name}`;
if (existsSync(ziel)) throw Error(`Ausgabe existiert: ${ziel}`);
mkdirSync(ziel, { recursive: true });
const { chromium } = await playwright();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const seite = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
await seite.addInitScript(() => {
  const original = window.requestAnimationFrame.bind(window);
  let pause = false, zaehler = 1000000;
  const wartend = new Map();
  window.requestAnimationFrame = cb => {
    if (!pause) return original(cb);
    const id = zaehler++; wartend.set(id, cb); return id;
  };
  const abbruch = window.cancelAnimationFrame.bind(window);
  window.cancelAnimationFrame = id => { if (!wartend.delete(id)) abbruch(id); };
  window.__blattPause = () => { pause = true; };
  window.__blattSchritt = () => { const callbacks = [...wartend.values()]; wartend.clear(); for (const cb of callbacks) cb(performance.now()); };
});
const fehler = [], bilder = [];
seite.on('pageerror', e => fehler.push(String(e)));
seite.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
try {
  const parameter = new URLSearchParams(hof
    ? `absetzen=189,231,-94&zeit=.26&hofbau=1&echt=1&blattruhe=${probe}&taa=${modus === 'taa' ? 1 : 0}`
    : `absetzen=1441,418,0&zeit=0.26&kontur=0&stimmung=zielbild&hofgruen=1&blattruhe=${probe}&taa=${modus !== 'subpixel' ? 1 : 0}&kamera=1441,35.66,418,1441,39,462&fov=42.6`);
  for (const [k, v] of new URLSearchParams(extra)) parameter.set(k, v);
  await seite.goto(`http://127.0.0.1:4173/?${parameter}`);
  await seite.waitForFunction(hof => document.body.textContent.includes('Ladezeit') && (hof ? window.__szene : window.__szene?.userData.ezKamera), hof, { timeout: 180000 });
  await seite.waitForTimeout(15000);
  // Diagnose nur im Messbrowser: Geometrie, Spielcode und gespeicherte Materialien bleiben erhalten.
  if (parameter.get('messglanz') === '0') await seite.evaluate(() => {
    window.__szene.traverse(o => { if (o.name.startsWith('ezlaub:')) o.material.specular.setRGB(0, 0, 0); });
  });
  await seite.evaluate(modus => {
    const s = window.__szene, vorher = s.onBeforeRender;
    window.__blatt = { versatz: 0, index: 0, bild: 0, samples: null, deckung: [] };
    s.onBeforeRender = function(gl, szene, kamera, ziel) {
      vorher.call(this, gl, szene, kamera, ziel);
      const d = window.__blatt;
      d.samples = ziel?.samples ?? 0;
      if (modus === 'fahrt') {
        const fortschritt = d.index / 95;
        kamera.position.set(1441 + Math.sin(fortschritt * Math.PI) * 1.2, 35.66, 418 + fortschritt * 4);
        kamera.lookAt(1441, 39, 462); kamera.updateMatrixWorld(true);
      }
      if (modus === 'subpixel') {
        kamera.updateProjectionMatrix();
        kamera.projectionMatrix.elements[8] += d.versatz * 2 / 960;
        kamera.projectionMatrixInverse.copy(kamera.projectionMatrix).invert();
      }
      szene.traverse(o => {
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (!m) continue;
          const u = gl.properties.get(m).uniforms;
          // Hinter allen bisherigen Blendbeginn-Zeiten: keine abgeschlossene LOD-Blende zurückspulen.
          for (const k of ['uEzZeit', 'uZeit', 'uTime']) if (u?.[k]) u[k].value = 1000 + (modus === 'fahrt' ? d.index / 24 : 0);
        }
      });
      d.bild++;
    };
    s.traverse(o => { if (o.name.startsWith('ezlaub:')) window.__blatt.deckung.push(o.material.alphaToCoverage); });
    // HUD ist keine Blattkante und wird aus Bildern/Metrik ausgeschlossen.
    for (const e of document.querySelectorAll('body *')) if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden';
  }, modus);
  await seite.evaluate(async () => { for (let i = 0; i < 8; i++) await new Promise(r => requestAnimationFrame(r)); });
  await seite.evaluate(() => window.__blattPause());
  await seite.waitForTimeout(200);
  await seite.evaluate(() => { for (let i = 0; i < 96; i++) window.__blattSchritt(); });
  for (let i = 0; i < anzahl; i++) {
    const versatz = modus !== 'subpixel' ? 0 : i < 12 ? i / 12 : (24 - i) / 12;
    await seite.evaluate(({ v, i }) => {
      window.__blatt.versatz = v; window.__blatt.index = i;
      // Die Spielkamera baut ihre Projektionsmatrix ohne TAA nicht pro Frame neu.
      window.__blattSchritt();
    }, { v: versatz, i });
    const pfad = `${ziel}/${String(i).padStart(3, '0')}.png`;
    await seite.screenshot({ path: pfad });
    bilder.push({ pfad, versatz });
  }
  const lauf = await seite.evaluate(() => window.__blatt);
  const roh = await Promise.all(bilder.map(async b => ({ ...b, data: await sharp(b.pfad).removeAlpha().raw().toBuffer() })));
  // Bildfelder ohne Figur: links unten die Hofwiese, links oben die Krone.
  const roi = hof ? { x: 55, y: 340, b: 300, h: 145 } : { x: 20, y: 25, b: 550, h: 240 };
  let fehlerSumme = 0, proben = 0;
  const basis = roh[0].data;
  for (const bild of roh.slice(1)) for (let y = roi.y; y < roi.y + roi.h; y++) for (let x = roi.x; x < roi.x + roi.b; x++) {
    const sx = x + bild.versatz, links = Math.floor(sx), f = sx - links;
    for (let c = 0; c < 3; c++) {
      const erwartet = basis[(y * 960 + links) * 3 + c] * (1 - f) + basis[(y * 960 + links + 1) * 3 + c] * f;
      fehlerSumme += Math.abs(bild.data[(y * 960 + x) * 3 + c] - erwartet); proben++;
    }
  }
  let schwankung = 0;
  for (let y = roi.y; y < roi.y + roi.h; y++) for (let x = roi.x; x < roi.x + roi.b; x++) for (let c = 0; c < 3; c++) {
    const i = (y * 960 + x) * 3 + c, mittel = roh.reduce((s, b) => s + b.data[i], 0) / roh.length;
    schwankung += roh.reduce((s, b) => s + Math.abs(b.data[i] - mittel), 0) / roh.length;
  }
  const bericht = { probe, ausschnitt, methode: modus === 'fahrt' ? '96 TAA-Bilder mit gleicher Kamerafahrt und Windphase; 24 Schritte/s Spielzeit, keine FPS-Messung'
    : modus === 'taa' ? '48 aufeinanderfolgende TAA-Bilder, drei vollständige 16er-AO-Zyklen nach 96 Aufwärmbildern; Kamera und Winduniformen fest; kein FPS-Lauf'
    : '24 Subpixelstellungen 0…1…0 Pixel; Winduniformen fest, TAA aus; kein FPS-Lauf',
    modus, extra, parameter: parameter.toString(),
    programme: await seite.evaluate(() => [...document.scripts].map(s => s.src).filter(Boolean)),
    roi, bilinearRestfehler: modus === 'fahrt' ? null : fehlerSumme / proben,
    mittlereSchwankung: modus === 'fahrt' ? null : schwankung / (roi.b * roi.h * 3), samples: lauf.samples, deckung: lauf.deckung,
    bilder: bilder.length, fehler };
  writeFileSync(`${ziel}/bericht.json`, JSON.stringify(bericht, null, 2));
  console.log(JSON.stringify({ ...bericht, deckung: [...new Set(lauf.deckung)] }));
  if (fehler.length || lauf.samples !== 4) process.exitCode = 1;
} finally { await browser.close(); }
