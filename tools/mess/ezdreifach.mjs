/**
 * Deterministischer Dreifach-LOD-Wechsel im echten, spielbaren Renderer (D254).
 * node tools/mess/ezdreifach.mjs <neuer-name>
 * Preview auf 127.0.0.1:4173. Eine temporaere, zusaetzliche Bauminstanz wird in
 * der laufenden Szene erzeugt und per Mesh-Austausch schnell umgeschaltet.
 * Original-Spielstand und Quelldateien bleiben unberuehrt. Ausgabe ist append-only.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { playwright } from './pw.mjs';

const [name] = process.argv.slice(2);
if (!name || !/^[a-z0-9_-]+$/i.test(name)) throw new Error('Neuen einfachen Namen angeben.');
const ziel = `.cache/mess/${name}`;
if (existsSync(ziel)) throw new Error(`Ausgabe existiert bereits: ${ziel}`);
mkdirSync(ziel, { recursive: true });
const { chromium } = await playwright();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const kontext = await browser.newContext({ viewport: { width: 960, height: 540 },
  recordVideo: { dir: ziel, size: { width: 960, height: 540 } } });
const seite = await kontext.newPage();
const fehler = [], abschnitte = [];
seite.on('pageerror', e => fehler.push(String(e)));
seite.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
try {
  await seite.goto('http://127.0.0.1:4173/?absetzen=0,0,310&zeit=0.26&kontur=0&ezbaum=1&ezdiagnose=1', { waitUntil: 'domcontentloaded' });
  await seite.waitForSelector('button[aria-label="Menü"]', { timeout: 240000 });
  await seite.waitForFunction(() => document.body.textContent.includes('Ladezeit') && window.__szene?.userData.ezKamera, undefined, { timeout: 120000 });
  await seite.waitForTimeout(12000);
  const baum = await seite.evaluate(() => {
    const szene = window.__szene, kamera = szene.userData.ezKamera;
    szene.updateMatrixWorld(true); kamera.updateMatrixWorld(true);
    let bester = null;
    szene.traverse(o => {
      if (!o.isInstancedMesh || !o.name.startsWith('baum:') || !o.count || !o.instanceColor) return;
      const lokal = o.matrix.clone(), welt = o.matrix.clone();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, lokal); welt.multiplyMatrices(o.matrixWorld, lokal);
        const punkt = kamera.position.clone().setFromMatrixPosition(welt);
        const abstand = punkt.distanceTo(kamera.position), bild = punkt.clone().project(kamera);
        if (abstand < 12 || abstand > 85 || bild.z < -1 || bild.z > 1 || Math.abs(bild.x) > 0.55 || Math.abs(bild.y) > 0.65) continue;
        const wert = Math.abs(bild.x) * 40 + Math.abs(bild.y) * 20 + Math.abs(abstand - 35);
        if (!bester || wert < bester.wert) bester = { quelle: o, index: i, matrix: welt.clone(), wert, bild: bild.toArray(), abstand };
      }
    });
    if (!bester) throw new Error('Kein Baum im Kamerabild fuer den Test gefunden.');
    // Neben den gewaehlten Baum setzen, damit keine echte Instanz dieselbe ID traegt.
    bester.matrix.elements[12] += 2.5;
    bester.matrix.elements[14] += 2.5;
    // Instanzmatrizen werden als Float32 gespeichert; die ID muss denselben
    // gerundeten Wert wie die spaeter gelesene GPU-Instanzmatrix verwenden.
    for (const k of [12, 13, 14]) bester.matrix.elements[k] = Math.fround(bester.matrix.elements[k]);
    const [, art, variante] = bester.quelle.name.split(':'), mm = v => Math.round(v * 1000);
    const id = `${art}:${variante}:${mm(bester.matrix.elements[12])},${mm(bester.matrix.elements[13])},${mm(bester.matrix.elements[14])}`;
    let quelle = null;
    function wechseln(stufe) {
      const neu = bester.quelle.clone();
      neu.name = `baum:${art}:${variante}:${stufe}`;
      neu.position.set(0, 0, 0); neu.quaternion.identity(); neu.scale.set(1, 1, 1);
      neu.matrix.identity(); neu.matrixWorld.identity();
      neu.count = 1; neu.visible = false; neu.frustumCulled = false;
      neu.setMatrixAt(0, bester.matrix); neu.instanceMatrix.needsUpdate = true;
      const c = bester.quelle.instanceColor;
      neu.instanceColor.setXYZ(0, c.getX(bester.index), c.getY(bester.index), c.getZ(bester.index));
      neu.instanceColor.needsUpdate = true;
      if (quelle) szene.remove(quelle);
      quelle = neu; szene.add(neu);
    }
    function probe() {
      const gefunden = [];
      szene.updateMatrixWorld(true);
      szene.traverse(o => {
        if (!o.isInstancedMesh || !o.count || !o.visible || !/^(ezbaum|ezblend|ezwarten):/.test(o.name)) return;
        const [, a, v, stufe] = o.name.split(':');
        if (a !== art || v !== variante) return;
        const m = o.matrix.clone();
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m); m.premultiply(o.matrixWorld);
          const e = m.elements, key = `${a}:${v}:${mm(e[12])},${mm(e[13])},${mm(e[14])}`;
          if (key !== id) continue;
          const blende = o.geometry.getAttribute('aEzBlende');
          const intervall = o.geometry.getAttribute('aEzIntervall');
          gefunden.push({ name: o.name, stufe, teil: o.name.split(':')[0],
            blende: blende?.getX(i) ?? null,
            intervall: intervall ? [intervall.getX(i), intervall.getY(i), intervall.getZ(i), intervall.getW(i)] : null,
            schatten: o.castShadow, tiefe: !!o.customDepthMaterial });
        }
      });
      return { ms: performance.now(), gefunden };
    }
    window.__ezDreifach = { id, wechseln, probe,
      trennen: () => { if (quelle) { szene.remove(quelle); quelle = null; } },
      ende: () => { if (quelle) szene.remove(quelle); } };
    return { id, bild: bester.bild, abstand: bester.abstand };
  });
  async function setze(stufe) {
    await seite.evaluate(s => window.__ezDreifach.wechseln(s), stufe);
    await seite.waitForFunction(s => window.__ezDreifach.probe().gefunden.some(x => x.teil === 'ezbaum' && x.stufe === s), stufe, { timeout: 30000, polling: 'raf' });
    return seite.evaluate(() => window.__ezDreifach.probe());
  }
  // In einem langen Frame kann der Renderprozess selbst mehr als 800 ms
  // benoetigen. Deshalb die echten Browserzeiten und alle Zustandsproben sichern.
  abschnitte.push({ schritt: 'fern', ...(await setze('fern')) });
  await seite.waitForTimeout(1000);
  abschnitte.push({ schritt: 'mittel', ...(await setze('mittel')) });
  await seite.waitForTimeout(100);
  abschnitte.push({ schritt: 'nah', ...(await setze('nah')) });
  await seite.screenshot({ path: `${ziel}/dreifach.png` });
  await seite.waitForTimeout(1100);
  abschnitte.push({ schritt: 'nah-ausgelaufen', ...(await seite.evaluate(() => window.__ezDreifach.probe())) });
  abschnitte.push({ schritt: 'fern-rueck', ...(await setze('fern')) });
  await seite.waitForTimeout(100);
  abschnitte.push({ schritt: 'nah-rueck', ...(await setze('nah')) });
  await seite.waitForTimeout(1100);
  abschnitte.push({ schritt: 'rueck-ausgelaufen', ...(await seite.evaluate(() => window.__ezDreifach.probe())) });
  abschnitte.push({ schritt: 'luecke-fern', ...(await setze('fern')) });
  await seite.waitForTimeout(100);
  await seite.evaluate(() => window.__ezDreifach.trennen());
  await seite.waitForFunction(() => window.__ezDreifach.probe().gefunden.some(x => x.teil === 'ezwarten'), undefined, { timeout: 30000, polling: 'raf' });
  abschnitte.push({ schritt: 'luecke-wartend', ...(await seite.evaluate(() => window.__ezDreifach.probe())) });
  await seite.waitForTimeout(100);
  abschnitte.push({ schritt: 'luecke-mittel', ...(await setze('mittel')) });
  await seite.waitForTimeout(1100);
  abschnitte.push({ schritt: 'luecke-ausgelaufen', ...(await seite.evaluate(() => window.__ezDreifach.probe())) });
  const diagnose = await seite.evaluate(() => {
    const t = window.__ezDreifach, d = window.__szene.userData.ezDiagnose;
    const ereignisse = d?.ereignisse.filter(e => e.id === t.id) ?? [];
    t.ende(); return ereignisse;
  });
  const zustand = name => abschnitte.find(a => a.schritt === name);
  const istStufe = (name, stufe) => zustand(name).gefunden.some(x => x.teil === 'ezbaum' && x.stufe === stufe);
  const zerlegt = name => {
    const teile = zustand(name).gefunden;
    if (!teile.length || teile.some(t => !t.intervall || t.blende == null)) return false;
    for (const anteil of [0, 0.25, 0.5, 0.75, 1]) {
      const segmente = teile.map(t => {
        const iv = t.blende === 0 ? [0, 1, 0, 1] : t.intervall;
        return [iv[0] + (iv[2]-iv[0])*anteil, iv[1] + (iv[3]-iv[1])*anteil];
      // Leere Intervalle am selben Startpunkt muessen vor vollen stehen.
      }).sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
      let ende = 0;
      for (const [links, rechts] of segmente) {
        if (Math.abs(links - ende) > 0.001 || rechts < links - 0.001) return false;
        ende = rechts;
      }
      if (Math.abs(ende - 1) > 0.001) return false;
    }
    return true;
  };
  const pruefungen = {
    dreifachRechtzeitig: zustand('nah').ms - zustand('mittel').ms < 800,
    dreiStufen: ['fern', 'mittel', 'nah'].every(s => zustand('nah').gefunden.some(t => t.stufe === s)),
    dreifachIntervalle: zerlegt('nah'),
    richtungswechsel: istStufe('nah-rueck', 'nah') && zerlegt('nah-rueck'),
    nurNahNachAblauf: zustand('rueck-ausgelaufen').gefunden.length === 1 && istStufe('rueck-ausgelaufen', 'nah'),
    wartestufeDa: zustand('luecke-wartend').gefunden.some(t => t.teil === 'ezwarten'),
    wartestufeNichtDoppelt: !zustand('luecke-wartend').gefunden.some(t => t.teil === 'ezbaum'),
    lueckeInnerhalbBlenddauer: zustand('luecke-mittel').ms - zustand('luecke-fern').ms < 800,
    nachLueckeMittel: istStufe('luecke-mittel', 'mittel') && zerlegt('luecke-mittel'),
    nurMittelNachAblauf: zustand('luecke-ausgelaufen').gefunden.length === 1 && istStufe('luecke-ausgelaufen', 'mittel'),
    schattenpasse: abschnitte.every(a => a.gefunden.every(t => t.tiefe)),
  };
  const bericht = { baum, abschnitte, diagnose, pruefungen, fehler };
  writeFileSync(`${ziel}/bericht.json`, JSON.stringify(bericht, null, 2));
  console.log(JSON.stringify(bericht, null, 2));
  if (fehler.length || Object.values(pruefungen).some(v => !v)) process.exitCode = 1;
} finally {
  await kontext.close(); await browser.close();
}
