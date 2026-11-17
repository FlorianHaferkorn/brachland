/** D299: lokale EZ-Auswahl im echten Renderer prüfen, insbesondere Sichtbarkeit der Außengruppen.
 * node tools/mess/hofgruen.mjs <neuer-name> <0|1>
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { playwright } from './pw.mjs';
const [name, probe, extra = ''] = process.argv.slice(2);
if (!name || !/^[a-z0-9_-]+$/i.test(name) || !['0', '1'].includes(probe)) throw Error('Name und 0|1 angeben.');
const ziel = `.cache/mess/${name}`;
if (existsSync(ziel)) throw Error(`Ausgabe existiert: ${ziel}`);
mkdirSync(ziel, { recursive: true });
const { chromium } = await playwright();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const seite = await browser.newPage({ viewport: { width: 960, height: 540 } });
const fehler = [];
seite.on('pageerror', e => fehler.push(String(e)));
seite.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
try {
  const parameter = new URLSearchParams(`absetzen=1441,418,0&zeit=0.26&stimmung=zielbild&scanhof=1&hofgruen=${probe}&kontur=0&kamera=1440,36.8,421,1433,37.8,434&fov=60&umgebung=6&sonne=0.8&umlichtstaerke=1.2&schatten=0.4`);
  for (const [k, v] of new URLSearchParams(extra)) parameter.set(k, v);
  await seite.goto(`http://127.0.0.1:4173/?${parameter}`);
  await seite.waitForSelector('button[aria-label="Menü"]', { timeout: 120000 });
  await seite.waitForFunction(() => document.body.textContent.includes('Ladezeit'), undefined, { timeout: 120000 });
  await seite.waitForTimeout(15000);
  const daten = await seite.evaluate(() => {
    const d = { innen: 0, innenVersteckt: 0, aussen: 0, aussenVersteckt: 0, ez: 0, blattkarten: [] };
    window.__szene.traverse(o => {
      if (!o.isInstancedMesh || !o.count) return;
      if (o.name.startsWith('baum:')) {
        if (o.userData.hofGruen) { d.innen += o.count; if (!o.visible) d.innenVersteckt += o.count; }
        else { d.aussen += o.count; if (!o.visible) d.aussenVersteckt += o.count; }
      }
      if (o.name.startsWith('ezbaum:')) d.ez += o.count;
      if (o.name.startsWith('ezlaub:')) d.blattkarten.push({ name: o.name,
        breite: o.material.map?.image?.width, mipStufen: o.material.map?.mipmaps?.length,
        alphaToCoverage: o.material.alphaToCoverage, tiefenAlphaToCoverage: o.customDepthMaterial?.alphaToCoverage,
        tiefenkarteGleich: o.customDepthMaterial?.map === o.material.map,
        alphaGleich: o.customDepthMaterial?.alphaTest === o.material.alphaTest });
    });
    return { ...d, hud: document.body.textContent };
  });
  if (probe === '1') {
    if (!daten.innen || daten.innenVersteckt !== daten.innen || daten.ez !== daten.innen) fehler.push('Lokale Bäume nicht genau einmal ersetzt.');
    if (!daten.aussen || daten.aussenVersteckt) fehler.push('Außengruppen fehlen oder sind verborgen.');
    if (!daten.blattkarten.length || daten.blattkarten.some(b => !(b.breite > 1 && b.mipStufen >= 2 && b.tiefenkarteGleich && b.alphaGleich))) fehler.push('Blatt-/Tiefenkarten oder Mips nicht bereit.');
    const deckung = parameter.get('blattruhe') !== '0' && parameter.get('msaa') !== '0';
    if (daten.blattkarten.some(b => b.alphaToCoverage !== deckung || b.tiefenAlphaToCoverage)) fehler.push('EZ-Blattränder nutzen nicht die erwartete MSAA-Deckung oder verändern Schatten.');
  } else if (daten.ez || daten.aussenVersteckt) fehler.push('Gegenlauf verändert Originalbäume.');
  await seite.screenshot({ path: `${ziel}/bild.png` });
  const bericht = { probe, ...daten, fehler };
  writeFileSync(`${ziel}/bericht.json`, JSON.stringify(bericht, null, 2));
  console.log(JSON.stringify({ ...bericht, hud: undefined, blattkarten: bericht.blattkarten.length }, null, 2));
  if (fehler.length) process.exitCode = 1;
} finally { await browser.close(); }
