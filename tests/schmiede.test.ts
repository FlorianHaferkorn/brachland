/**
 * BRACHLAND — Schmiede (D177): Beute gegen Waffenstufe. Geprüft wird, dass die Stufen enden, dass
 * nur bezahlt wird, was im Beutel ist, und dass eine Stufe im Echtzeitkampf wirklich härter trifft.
 */
import { angebot, bezahlbar, bezahle, schadenFaktor, MAX_STUFE } from '../src/spiel/schmiede.js';
import { SPIELERIN, UEBUNGSGEGNER, SCHRITT, neuerKaempfer, setzeSchlagAn, schrittKaempfer, loeseTreffer, blickAuf,
  type Treffer } from '../src/kampf/echtzeit.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++; console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}
pruefe('Stufe 1 kostet einen Harzverband', JSON.stringify(angebot('klinge', 0)?.preis) === '{"harzverband":1}');
pruefe('nach der letzten Stufe kein Angebot', angebot('axt', MAX_STUFE) === null);
const a2 = angebot('axt', 1)!;
pruefe('ohne Herzfunke nicht bezahlbar', !bezahlbar(a2, { harzverband: 5 }));
pruefe('mit allem bezahlbar', bezahlbar(a2, { harzverband: 2, herzfunke: 1 }));
const rest = bezahle(a2, { harzverband: 3, herzfunke: 1, koeder: 2 });
pruefe('Bezahlen zieht genau den Preis ab', rest.harzverband === 1 && rest.herzfunke === 0 && rest.koeder === 2, JSON.stringify(rest));
pruefe('Faktor steigt je Stufe, gedeckelt', schadenFaktor(0) === 1 && schadenFaktor(3) > schadenFaktor(2) && schadenFaktor(9) === schadenFaktor(3));

function hieb(stufe: number): number {
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  s.schadenFaktor = schadenFaktor(stufe);
  const g = neuerKaempfer('g', UEBUNGSGEGNER, 0, -1.6, blickAuf(0, -1.6, 0, 0));
  setzeSchlagAn(s);
  let tr: Treffer[] = [];
  for (let t = 0; t < 1 && !tr.length; t += SCHRITT) { schrittKaempfer(s, SCHRITT); tr = loeseTreffer(s, [g]); }
  return tr[0]?.schaden ?? 0;
}
const h0 = hieb(0), h3 = hieb(3);
pruefe('geschmiedete Klinge trifft härter', h3 > h0 * 1.3, `${h0} → ${h3}`);
console.log(`  Klinge: ${h0} → ${h3.toFixed(1)} Schaden (Stufe 3)`);
console.log(`\n${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
