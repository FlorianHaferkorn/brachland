/** D492: W-Anlauf auf Hof 708. Liest den linearen Bloom-Quellpass vor der Unschärfe.
 * GPU-Rücklesen beeinflusst die Bildrate. Dieser Lauf misst ausschließlich Bildfehler.
 * node tools/mess/hofblitz.mjs <Preview-Port> <Ausgabeordner>
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataUtils, HalfFloatType } from 'three';
import { playwright } from './pw.mjs';

const [port, ausgabe] = process.argv.slice(2);
if (!ausgabe || !/^\d+$/.test(port) || +port < 1 || +port > 65535) throw Error('Preview-Port und Ausgabeordner angeben.');
mkdirSync(ausgabe, { recursive: true });
const url = 'http://127.0.0.1:' + port + '/?absetzen=189,231,-94&zeit=.26&hofbau=1&echt=1';
const { chromium } = await playwright();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
try {
  const seite = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const fehler = [];
  seite.on('pageerror', e => fehler.push(String(e)));
  seite.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  await seite.goto(url, { waitUntil: 'domcontentloaded' });
  await seite.waitForFunction(() => window.__szene && document.body.textContent.includes('Ladezeit'), null, { timeout: 150000 });
  await seite.waitForTimeout(6500);
  await seite.evaluate(halbformat => {
    const szene = window.__szene;
    const spur = window.__hofblitz = { aktiv: false, bilder: 0, spitze: 0, ausreisser: 0, start: null, ende: null, gras: {}, lesekontrolle: false };
    szene.traverse(objekt => {
      if (!objekt.isMesh || !objekt.name.startsWith('Grasteppich')) return;
      const vorher = objekt.onBeforeRender;
      objekt.onBeforeRender = function (...args) {
        vorher.apply(this, args);
        if (spur.aktiv) spur.gras[objekt.name] = (spur.gras[objekt.name] ?? 0) + 1;
      };
    });
    const vorher = szene.onBeforeRender;
    szene.onBeforeRender = function (renderer, ...args) {
      vorher.call(this, renderer, ...args);
      szene.onBeforeRender = vorher;
      const zeichne = renderer.render.bind(renderer);
      let daten;
      renderer.render = (sz, kamera) => {
        zeichne(sz, kamera);
        if (!spur.aktiv) return;
        const ziel = renderer.getRenderTarget();
        if (sz === szene) {
          spur.ende = [kamera.position.x, kamera.position.z];
          spur.start ??= spur.ende;
          if (!spur.lesekontrolle && ziel) {
            // RGB-Mitte des Hauptbilds muss belegt sein. Ein defekter Readback
            // würde andernfalls mit ausschliesslich Nullen den Test bestehen.
            const probe = new Uint16Array(4);
            renderer.readRenderTargetPixels(ziel, ziel.width >> 1, ziel.height >> 1, 1, 1, probe);
            spur.lesekontrolle = probe.subarray(0, 3).some(v => v > 0 && v < 0x7c00);
          }
        }
        const u = sz.children[0]?.material?.uniforms;
        if (!u?.uSchwelleHell || !ziel) return;
        pruefeQuellformat(ziel);
        const zeilen = Math.floor(ziel.height * .65);
        daten ??= new Uint16Array(ziel.width * zeilen * 4);
        renderer.readRenderTargetPixels(ziel, 0, 0, ziel.width, zeilen, daten);
        // Das diffuse Gras war gelbgrün. Alle drei linearen Kanäle prüfen.
        // Bei positiven IEEE-Halbzahlen folgt die Bitfolge der Wertreihenfolge.
        let spitze = 0;
        for (let i = 0; i < daten.length; i += 4) {
          for (let k = i; k < i + 3; k++) if (!(daten[k] & 0x8000)) spitze = Math.max(spitze, daten[k]);
        }
        spur.spitze = Math.max(spur.spitze, spitze);
        if (spitze > 0x4800) spur.ausreisser++; // linear 8 nach der Schwelle 1,2
        spur.bilder++;
      };
      function pruefeQuellformat(ziel) {
        if (ziel.width !== 320 || ziel.height !== 180 || !ziel.texture.isRenderTargetTexture || ziel.texture.type !== halbformat) {
          throw Error('Bloom-Quellpass erwartet RGBA16F mit 320 × 180 Bildpunkten.');
        }
      }
    };
  }, HalfFloatType);
  await seite.evaluate(() => { window.__hofblitz.aktiv = true; });
  await seite.keyboard.down('w');
  await seite.waitForTimeout(13300);
  await seite.keyboard.up('w');
  const spur = await seite.evaluate(() => { window.__hofblitz.aktiv = false; return window.__hofblitz; });
  const wert = DataUtils.fromHalfFloat(spur.spitze);
  const maximum = Number.isFinite(wert) ? wert : String(wert);
  const strecke = spur.start && spur.ende ? Math.hypot(spur.ende[0] - spur.start[0], spur.ende[1] - spur.start[1]) : 0;
  const bericht = { url, ...spur, strecke, maximum, schwelle: 8, fehler };
  writeFileSync(join(ausgabe, 'hofblitz.json'), JSON.stringify(bericht, null, 2));
  assert.deepEqual(fehler, []);
  assert.ok(spur.lesekontrolle && spur.bilder >= 100 && strecke >= 25, 'Zu wenig gültige Bewegungsbilder.');
  assert.ok(spur.gras.Grasteppich && spur.gras['Grasteppich-fern'], 'Beide Grasteppiche müssen im Lauf zeichnen.');
  assert.equal(spur.ausreisser, 0, 'Lokale HDR-Lichtspitzen im Hofanlauf: ' + spur.ausreisser + ', Maximum ' + maximum);
  console.log('Hofblitz:', spur.bilder, 'Bilder,', strecke.toFixed(1), 'm, Maximum', maximum);
} finally {
  await browser.close();
}
