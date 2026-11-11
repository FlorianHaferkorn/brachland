/**
 * LOD in Bewegung pruefen: Video, sichtbare Instanzen, Wechsel und Bildzeiten.
 * node tools/mess/lodlauf.mjs <neuer-name> [x,z,grad] [sekunden] [url-parameter] [intervall-sekunden] [schwenk|schwenk-dialog]
 * Preview auf 127.0.0.1:4173; neue Ausgabe unter .cache/mess/<name>.
 * Video und regelmaessige Szenensonden beeinflussen die Bildzeiten: fuer
 * Performancemessungen ohne Video/Instanzsonden zusaetzlich vergleich.mjs nutzen.
 */
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { playwright } from './pw.mjs';

const [name, ort = '0,0,310', dauer = '24', extra = '', abstand = '0.5', schwenk = ''] = process.argv.slice(2);
if (!name || !/^[a-z0-9_-]+$/i.test(name)) throw new Error('Neuen einfachen Laufnamen angeben.');
const sekunden = Number(dauer), intervall = Number(abstand);
if (!Number.isFinite(sekunden) || sekunden < 4 || sekunden > 120) throw new Error('Dauer: 4 bis 120 Sekunden.');
if (!Number.isFinite(intervall) || intervall < 0.25 || intervall > 5) throw new Error('Intervall: 0.25 bis 5 Sekunden.');
const ziel = `.cache/mess/${name}`;
if (existsSync(ziel)) throw new Error(`Ausgabe existiert bereits: ${ziel}`);
mkdirSync(ziel, { recursive: true });
const { chromium } = await playwright();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const kontext = await browser.newContext({ viewport: { width: 960, height: 540 },
  recordVideo: { dir: ziel, size: { width: 960, height: 540 } } });
const seite = await kontext.newPage();
const fehler = [];
seite.on('pageerror', e => fehler.push(String(e)));
seite.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
const proben = [], wechsel = {};
let vorher = new Map(), doppelt = 0, blendfehler = 0, wartefehler = 0, zeiten = [], diagnose = null;

try {
  await seite.goto(`http://127.0.0.1:4173/?absetzen=${ort}&zeit=0.26&kontur=0${extra}`, { waitUntil: 'domcontentloaded' });
  await seite.waitForSelector('button[aria-label="Menü"]', { timeout: 240000 });
  await seite.waitForFunction(() => document.body.textContent.includes('Ladezeit'), undefined, { timeout: 120000 });
  await seite.waitForTimeout(10000);
  await seite.screenshot({ path: `${ziel}/bild-start.png` });

  await seite.evaluate(() => {
    window.__lodBildzeit = { aktiv: true, werte: [] };
    let letzteZeit = performance.now();
    const schritt = jetzt => {
      const messung = window.__lodBildzeit;
      if (!messung?.aktiv) return;
      messung.werte.push(jetzt - letzteZeit);
      letzteZeit = jetzt;
      requestAnimationFrame(schritt);
    };
    requestAnimationFrame(schritt);
  });
  await seite.keyboard.down('Shift');
  await seite.keyboard.down('w');
  const start = performance.now();
  let naechsteProbe = start;
  let schwenks = 0;
  while (true) {
    // Fundstuecke verdunkeln die Szene bis zum Antippen; fuer Aufnahmen an
    // solchen Orten optional wie eine spielende Person direkt weiterschalten.
    if (schwenk.includes('dialog')) {
      const fund = seite.getByText('tippen zum Weitergehen', { exact: false });
      if (await fund.isVisible()) await fund.click();
    }
    if (schwenk.startsWith('schwenk') && schwenks < 2 && performance.now() - start >= (8 + schwenks * 8) * 1000) {
      await seite.mouse.move(700, 280); await seite.mouse.down();
      await seite.mouse.move(schwenks === 0 ? 940 : 490, 280, { steps: 12 });
      await seite.mouse.up(); schwenks++;
    }
    const rest = naechsteProbe - performance.now();
    if (rest > 0) await seite.waitForTimeout(rest);
    const probe = await seite.evaluate(() => {
      const beginn = performance.now(), instanzen = [], blendungen = [], wartende = [];
      let ezInstanzen = 0, originalInstanzen = 0;
      const sichtbar = o => {
        for (let p = o; p; p = p.parent) if (!p.visible) return false;
        return true;
      };
      const mm = n => Math.round(n * 1000);
      window.__szene.updateMatrixWorld(true);
      window.__szene.traverse(o => {
        if (!o.isInstancedMesh || !sichtbar(o)) return;
        const istEz = o.name === 'ezprobe-stamm' || o.name.startsWith('ezbaum:');
        const istBlende = o.name.startsWith('ezblend:') && o.userData.ezUebergang === true;
        const istWartend = o.name.startsWith('ezwarten:') && o.userData.ezWarten === true;
        const quelle = o.name === 'ezprobe-stamm' ? o.userData.ezQuelle : o.name;
        if (!quelle?.startsWith('baum:') && !quelle?.startsWith('ezbaum:') && !istBlende && !istWartend) return;
        const [, art, variante, stufe] = quelle.split(':');
        if (istEz) ezInstanzen += o.count; else if (!istBlende && !istWartend) originalInstanzen += o.count;
        const werte = o.instanceMatrix.array, welt = o.matrixWorld.elements;
        for (let i = 0; i < o.count; i++) {
          const k = i * 16, x = werte[k + 12], y = werte[k + 13], z = werte[k + 14];
          const wx = welt[0] * x + welt[4] * y + welt[8] * z + welt[12];
          const wy = welt[1] * x + welt[5] * y + welt[9] * z + welt[13];
          const wz = welt[2] * x + welt[6] * y + welt[10] * z + welt[14];
          (istBlende ? blendungen : istWartend ? wartende : instanzen).push([`${art}:${variante}:${mm(wx)},${mm(wy)},${mm(wz)}`, stufe, o.name]);
        }
      });
      const kamera = window.__szene.userData.ezKamera;
      const blick = kamera ? { welt: Array.from(kamera.matrixWorld.elements),
        sicht: Array.from(kamera.matrixWorldInverse.elements), projektion: Array.from(kamera.projectionMatrix.elements) } : null;
      const reflexion = window.__szene.userData.wasserReflexMessung;
      return { instanzen, blendungen, wartende, ezInstanzen, originalInstanzen, blick, browserMs: beginn,
        reflexion: reflexion ? { ...reflexion } : null,
        sondeMs: performance.now() - beginn, hud: document.body.textContent };
    });
    const haeufigkeit = new Map();
    for (const [id] of probe.instanzen) haeufigkeit.set(id, (haeufigkeit.get(id) ?? 0) + 1);
    const doppelte = [...haeufigkeit].filter(([, anzahl]) => anzahl > 1);
    const doppeltQuellen = doppelte.map(([id]) => [id, probe.instanzen.filter(e => e[0] === id).map(e => e[2])]);
    const jetzt = new Map(probe.instanzen), stufen = {};
    const blendHaeufigkeit = new Map(), blendStufen = new Map();
    for (const [id, stufe] of probe.blendungen) {
      blendHaeufigkeit.set(id, (blendHaeufigkeit.get(id) ?? 0) + 1);
      const schluessel = `${id}|${stufe}`;
      blendStufen.set(schluessel, (blendStufen.get(schluessel) ?? 0) + 1);
    }
    const warteStufen = new Map(probe.wartende);
    // Auch eine alte Blende darf zusammen mit dem wartenden Ersatz laufen;
    // sie muss dann eine andere Stufe desselben Baums sein.
    const ungueltigeBlendungen = probe.blendungen.filter(([id, stufe]) => {
      const zielStufe = jetzt.get(id) ?? warteStufen.get(id);
      // Bei einem Wechsel waehrend der Blende koennen beide alten Stufen
      // gleichzeitig erscheinen; dieselbe Stufe darf nie doppelt sein.
      return !zielStufe || zielStufe === stufe || blendHaeufigkeit.get(id) > 2 || blendStufen.get(`${id}|${stufe}`) !== 1;
    });
    blendfehler += ungueltigeBlendungen.length;
    const wartendeIds = new Set();
    const ungueltigeWartende = probe.wartende.filter(([id]) => {
      const ungueltig = jetzt.has(id) || wartendeIds.has(id);
      wartendeIds.add(id); return ungueltig;
    });
    wartefehler += ungueltigeWartende.length;
    doppelt += doppelte.reduce((summe, [, anzahl]) => summe + anzahl - 1, 0);
    const wechselSichtbar = { bis180: 0, von180bis420: 0, weiter: 0, geblendet: 0, ohneBlende: 0 };
    const sichtJetzt = new Map([...probe.instanzen, ...probe.wartende]);
    const wechselOhneBlende = [];
    for (const [id, stufe] of sichtJetzt) {
      stufen[stufe] = (stufen[stufe] ?? 0) + 1;
      const alte = vorher.get(id);
      if (alte && alte !== stufe) {
        wechsel[`${alte}→${stufe}`] = (wechsel[`${alte}→${stufe}`] ?? 0) + 1;
        if (probe.blick) {
          const [x, y, z] = id.split(':')[2].split(',').map(v => Number(v) / 1000);
          const { welt, sicht: m, projektion: p } = probe.blick;
          const vx = m[0]*x+m[4]*y+m[8]*z+m[12], vy = m[1]*x+m[5]*y+m[9]*z+m[13], vz = m[2]*x+m[6]*y+m[10]*z+m[14];
          const cx = p[0]*vx+p[4]*vy+p[8]*vz+p[12], cy = p[1]*vx+p[5]*vy+p[9]*vz+p[13], cw = p[3]*vx+p[7]*vy+p[11]*vz+p[15];
          // Mittelpunkt im Bild; ausgedehnte Kronen am Rand werden hier nicht mitgezaehlt.
          if (cw > 0 && Math.abs(cx) <= cw && Math.abs(cy) <= cw) {
            const abstand = Math.hypot(x-welt[12], y-welt[13], z-welt[14]);
            wechselSichtbar[abstand <= 180 ? 'bis180' : abstand <= 420 ? 'von180bis420' : 'weiter']++;
            wechselSichtbar[blendHaeufigkeit.has(id) ? 'geblendet' : 'ohneBlende']++;
            if (!blendHaeufigkeit.has(id)) wechselOhneBlende.push({ id, vorher: alte, nachher: stufe, abstand });
          }
        }
      }
    }
    vorher = sichtJetzt;
    proben.push({ sekunden: +(Math.max(0, performance.now() - start) / 1000).toFixed(3),
      stufen, ezInstanzen: probe.ezInstanzen, originalInstanzen: probe.originalInstanzen,
      blendungen: probe.blendungen.length, ungueltigeBlendungen,
      wartende: probe.wartende.length, ungueltigeWartende, wechselSichtbar, wechselOhneBlende, browserMs: probe.browserMs, reflexion: probe.reflexion,
      sondeMs: probe.sondeMs, doppelte, doppeltQuellen, hud: probe.hud });
    if (performance.now() - start >= sekunden * 1000) break;
    naechsteProbe += intervall * 1000;
    // Nach einer langsamen Sonde nicht mehrere alte Zeitpunkte nachholen.
    if (naechsteProbe < performance.now()) naechsteProbe = performance.now() + intervall * 1000;
  }
  await seite.keyboard.up('w');
  await seite.keyboard.up('Shift');
  zeiten = await seite.evaluate(() => { window.__lodBildzeit.aktiv = false; return window.__lodBildzeit.werte; });
  diagnose = await seite.evaluate(() => window.__szene.userData.ezDiagnose ?? null);
  await seite.screenshot({ path: `${ziel}/bild-ende.png` });
} finally {
  await seite.keyboard.up('w').catch(() => {});
  await seite.keyboard.up('Shift').catch(() => {});
  await kontext.close();
  await browser.close();
}
const sortiert = [...zeiten].sort((a, b) => a - b);
const quantil = p => sortiert[Math.min(sortiert.length - 1, Math.floor(sortiert.length * p))] ?? null;
const summe = zeiten.reduce((a, b) => a + b, 0);
const bildzeit = { bilder: zeiten.length, dauerMs: summe, fps: summe ? zeiten.length * 1000 / summe : null,
  medianMs: quantil(0.5), p95Ms: quantil(0.95), maxMs: quantil(1), ueber50ms: zeiten.filter(z => z > 50).length,
  hinweis: 'Videoaufzeichnung und Szenensonden laufen gleichzeitig; vergleich.mjs misst ohne diese Last.' };
const bericht = { ort, extra, intervall, proben, wechsel, doppelt, blendfehler, wartefehler, fehler, bildzeit, diagnose };
writeFileSync(`${ziel}/bericht.json`, JSON.stringify(bericht, null, 2));
console.log(JSON.stringify({ ziel, proben: proben.length, wechsel, doppelt, blendfehler, wartefehler, fehler, bildzeit }, null, 2));
if (fehler.length || doppelt || blendfehler || wartefehler || Object.keys(wechsel).length === 0 || zeiten.length < 10) process.exitCode = 1;
