/**
 * Dreiecke, Aufrufe und Objekte an einem Ort, mit und ohne einzelne Gruppen.
 *
 * Läuft gegen den Vorschau-Server auf demselben Rechner. Gelesen wird die
 * Anzeige, die die App selbst führt (`gl.info.render`) — dieselbe Zahl, die auf
 * dem Handy im HUD steht.
 *
 * **Was das misst und was nicht.** Dreiecke, Aufrufe und Objekte sind
 * geräteunabhängig: Sie stehen fest, sobald die Kacheln gebaut sind. Die
 * Bildzeit ist es nicht — hier rendert eine CPU, auf dem Handy ein Tiler. Für
 * p95 gibt es keinen Ersatz für das Gerät.
 *
 * ## Gebrauch
 *
 * ```
 * npm run preview -- --host 0.0.0.0 --port 4173     # in einem zweiten Fenster
 * npm run zaehlen -- "-1620,-1620"                   # Ort in Weltmetern
 * npm run zaehlen -- "350,900" ",gras,haeuser"       # eigene Läufe
 * ```
 *
 * Braucht Playwright, das **nicht** im Projekt hängt: `npx playwright install
 * chromium` holt den Browser, das Paket selbst kommt über `npx playwright`.
 * Bewusst keine Abhängigkeit im Manifest — ein Messwerkzeug, das jeder Clone
 * mitschleppt, ist 300 MB für etwas, das man dreimal im Monat braucht.
 */
import { chromium } from 'playwright';

const ORT = process.argv[2] ?? '-1620,-1620';
const LAEUFE = (process.argv[3] ?? ',gras,fels,baeume,gras+fels+baeume').split(',');
const BASIS = 'http://127.0.0.1:4173/';
/** So lange stehenbleiben, bis die Kachel- und Prop-Aufbauten durch sind. */
const WARTEN = 14_000;

/**
 * Die Anzeige der App auslesen.
 *
 * Als **Funktion**, nicht als Zeichenkette: Playwright wertet in Node eine
 * Zeichenkette als Ausdruck aus und liefert damit die Funktion selbst zurück
 * statt ihres Ergebnisses. Der erste Lauf gab deshalb überall Nullen — und die
 * sahen aus wie ein Messergebnis.
 */
const lies = () => {
  const t = document.body.innerText;
  const z = (re) => {
    const m = t.match(re);
    return m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : null;
  };
  return {
    dreiecke: z(/([\d.,]+)\s*Dreiecke/), aufrufe: z(/([\d.,]+)\s*Aufrufe/),
    objekte: z(/([\d.,]+)\s*Objekte/),
  };
};

const browser = await chromium.launch();
const ergebnisse = [];
for (const gruppen of LAEUFE) {
  const seite = await browser.newContext({ viewport: { width: 430, height: 860 } }).then(c => c.newPage());
  const url = BASIS + '?absetzen=' + ORT + (gruppen ? '&aus=' + gruppen.replace(/\+/g, ',') : '');
  await seite.goto(url, { waitUntil: 'domcontentloaded' });
  await seite.waitForSelector('button[aria-label="Menü"]', { timeout: 240_000 });
  await seite.waitForTimeout(WARTEN);
  const m = await seite.evaluate(lies);
  ergebnisse.push({ ohne: gruppen || '—', ...m });
  await seite.context().close();
}
await browser.close();

const f = (v) => (v ?? 0).toLocaleString('de-DE');
const grund = ergebnisse[0];
console.log(`\n  Ort ${ORT}\n`);
console.log(`  ${'ohne'.padEnd(20)}${'Dreiecke'.padStart(11)}${'Δ'.padStart(11)}${'Aufrufe'.padStart(9)}${'Δ'.padStart(7)}${'Objekte'.padStart(9)}`);
for (const e of ergebnisse) {
  const dD = e === grund ? '' : (e.dreiecke - grund.dreiecke).toLocaleString('de-DE');
  const dA = e === grund ? '' : (e.aufrufe - grund.aufrufe).toLocaleString('de-DE');
  console.log(`  ${e.ohne.padEnd(20)}${f(e.dreiecke).padStart(11)}${dD.padStart(11)}`
    + `${f(e.aufrufe).padStart(9)}${dA.padStart(7)}${f(e.objekte).padStart(9)}`);
}
