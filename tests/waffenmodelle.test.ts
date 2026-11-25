/**
 * BRACHLAND — Waffenmodelle in `public/figuren/kampf/waffen.glb` (D414, D421).
 *
 * D421 ersetzt die Fantasy-Formen des Pakets durch eigene, realistische Modelle — **ohne die Kampfwerte zu
 * berühren**: Die Reichweite hängt an der Modelllänge (D403 §1), der Griff an der Lage an der Hand. Also müssen
 * Spitze und Ende auf der Waffenachse (three −Y) bleiben, wo die alten Modelle sie hatten (±1 cm), und der
 * Ursprung (die Hand) muss im Griff liegen. Gelesen wird nur das JSON der Datei: POSITION-Grenzen × Knoten-TRS,
 * ohne Meshopt zu entpacken. Dazu: Gewicht (Knoten-Extras aus `tools/waffenmodelle.py`) im Anker, kein Gold.
 */
import { readFileSync } from 'node:fs';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}

interface Knoten {
  name: string; mesh?: number; scale?: number[]; translation?: number[]; rotation?: number[];
  extras?: { masse_kg?: number; masse_kopf_kg?: number; masse_stiel_kg?: number; griff_rechts?: number; griff_links?: number };
}
const buf = readFileSync('public/figuren/kampf/waffen.glb');
const g = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8')) as {
  nodes: Knoten[]; meshes: { primitives: { attributes: { POSITION: number }; material: number }[] }[];
  accessors: { min: number[]; max: number[]; normalized?: boolean; componentType: number }[]; materials: { name: string }[];
};
const TEILER: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535, 5126: 1 };

/** Grenzen je Primitive in Metern (Raum der Waffe = Raum des Knotens samt TRS, ohne Drehung). */
function grenzen(k: Knoten) {
  const s = k.scale ?? [1, 1, 1], t = k.translation ?? [0, 0, 0];
  return g.meshes[k.mesh!].primitives.map(p => {
    const a = g.accessors[p.attributes.POSITION];
    const d = a.normalized ? TEILER[a.componentType] : 1;
    return { mat: g.materials[p.material]?.name ?? '', lo: a.min.map((v, i) => v / d * s[i] + t[i]), hi: a.max.map((v, i) => v / d * s[i] + t[i]) };
  });
}

// Alte Lage auf der Achse, vor D421 gemessen: Klinge/Axt/Stufe 3 aus der Paketdatei (Medieval Weapons Pack,
// `tools/waffenbau.py`), der Speer aus `baueSpeer` (`src/kampf/waffenhand.ts`: Schaft −1,55…0,45, Spitze bis −1,81;
// meisterlich Blatt bis −2,10, Schuh bis 0,55).
// D429: Die Axt ist eine Zweihand-Fällaxt — der Ursprung (rechte Hand) liegt an der vorderen Griffstelle, ¾ den Stiel
// hinauf; die Länge bleibt (vor D429: Axt −0,920…0,080 = 1,000 m, Axt3 −0,938…0,112 = 1,050 m).
const ALT: Record<string, [number, number]> = {
  Klinge: [-0.765, 0.135], Klinge3: [-0.851, 0.099], Axt: [-0.350, 0.650], Axt3: [-0.400, 0.650],
  Speer: [-1.81, 0.45], Speer3: [-2.10, 0.55],
};
const LAENGE_VOR_D429: Record<string, number> = { Axt: 1.0, Axt3: 1.05 };
// Gewicht kg: Spanne mit Quelle (tools/waffenmodelle.py `ANKER`).
const ANKER: Record<string, [number, number]> = {
  Klinge: [0.9, 1.3], Klinge3: [0.9, 1.35], Axt: [1.8, 2.6], Axt3: [1.8, 2.7], Speer: [1.3, 2.2], Speer3: [1.5, 2.6],
  Hirschfaenger: [0.4, 0.6], Messer: [1.2, 1.6], Raeucherkanne: [0.6, 0.9],
};
const GRIFF = /^(Leder|LederNeu|Esche|EscheGeoelt|Hickory|HickoryGeoelt|DarkWood|LightWood|Hirschhorn|Blech)$/;

const knoten = new Map(g.nodes.filter(k => k.mesh !== undefined).map(k => [k.name, k]));
for (const [name, [spitze, ende]] of Object.entries(ALT)) {
  const k = knoten.get(name);
  pruefe(`${name}: Modell vorhanden`, !!k);
  if (!k) continue;
  pruefe(`${name}: ohne Drehung im Knoten (Achse = −Y)`, !k.rotation || Math.abs(Math.abs(k.rotation[3]) - 1) < 1e-6);
  const gr = grenzen(k);
  const lo = Math.min(...gr.map(p => p.lo[1])), hi = Math.max(...gr.map(p => p.hi[1]));
  pruefe(`${name}: Spitze bei ${spitze} m (±1 cm)`, Math.abs(lo - spitze) <= 0.01, lo.toFixed(3));
  pruefe(`${name}: Ende bei ${ende} m (±1 cm)`, Math.abs(hi - ende) <= 0.01, hi.toFixed(3));
  pruefe(`${name}: Länge ${(ende - spitze).toFixed(3)} m (±1 cm)`, Math.abs((hi - lo) - (ende - spitze)) <= 0.01, (hi - lo).toFixed(3));
  // Der Griffpunkt: Der Ursprung liegt in einem Griffteil (Leder, Holz) — dort sitzt die Hand.
  const imGriff = gr.some(p => GRIFF.test(p.mat) && p.lo.every((v, i) => v <= 0.01) && p.hi.every(v => v >= -0.01));
  pruefe(`${name}: Ursprung (Hand) liegt im Griff (±1 cm)`, imGriff, gr.map(p => p.mat).join(','));
  pruefe(`${name}: kein Gold, kein Fantasy-Material`, !gr.some(p => /gold/i.test(p.mat)), gr.map(p => p.mat).join(','));
}
for (const [name, [a, b]] of Object.entries(ANKER)) {
  const kg = knoten.get(name)?.extras?.masse_kg;
  pruefe(`${name}: Gewicht ${kg} kg im Anker ${a}–${b}`, kg !== undefined && kg >= a && kg <= b);
}
// Die Axt hat **eine** Schneide (−X, wie die Finger, D171): Der Kopf reicht weit nach −X, nach +X nur der Nacken.
for (const n of ['Axt', 'Axt3']) {
  const k = knoten.get(n);
  if (!k) continue;
  const gr = grenzen(k);
  const minX = Math.min(...gr.map(p => p.lo[0])), maxX = Math.max(...gr.map(p => p.hi[0]));
  pruefe(`${n}: eine Schneide nach −X (−${(-minX * 100).toFixed(0)} cm), Nacken kurz (+${(maxX * 100).toFixed(0)} cm)`, minX < -0.12 && maxX < 0.05);
}
// D429: Zweihand-Fällaxt — zwei Griffpunkte, Kopf und Stiel einzeln gewogen, schlanker Kopf, Länge wie vorher.
for (const n of ['Axt', 'Axt3']) {
  const k = knoten.get(n);
  if (!k) continue;
  const gr = grenzen(k), x = k.extras ?? {};
  const lo = Math.min(...gr.map(p => p.lo[1])), hi = Math.max(...gr.map(p => p.hi[1]));
  pruefe(`${n}: Länge ${(hi - lo).toFixed(3)} m wie vor D429 (${LAENGE_VOR_D429[n]} m, ±1 cm)`, Math.abs(hi - lo - LAENGE_VOR_D429[n]) <= 0.01);
  pruefe(`${n}: zwei Griffpunkte in den Extras (rechts, links)`, x.griff_rechts === 0 && typeof x.griff_links === 'number', JSON.stringify(x));
  const links = x.griff_links ?? NaN;
  pruefe(`${n}: rechte Hand (Ursprung) an der vorderen Griffstelle, ≥ 55 cm vor dem Stielende`, hi >= 0.55, hi.toFixed(3));
  pruefe(`${n}: linke Hand am Stielende (Abstand ${((hi - links) * 100).toFixed(1)} cm ≤ 3 cm)`, hi - links >= 0 && hi - links <= 0.03);
  const stiel = gr.find(p => /^Hickory/.test(p.mat));
  pruefe(`${n}: linker Griffpunkt liegt im Stiel`, !!stiel && links >= stiel.lo[1] && links <= stiel.hi[1] && stiel.lo[0] <= 0 && stiel.hi[0] >= 0);
  pruefe(`${n}: rechter Griffpunkt (Ursprung) liegt im Stiel`, !!stiel && stiel.lo[1] <= 0 && stiel.hi[1] >= 0);
  pruefe(`${n}: Kopf 1,3–1,55 kg (Vorbild Fällaxt 1,4 kg; vor D429 1,71 kg)`, (x.masse_kopf_kg ?? 0) >= 1.3 && (x.masse_kopf_kg ?? 9) <= 1.55, `${x.masse_kopf_kg}`);
  pruefe(`${n}: Stiel 0,6–0,85 kg (Hickory-Ersatzstiel 36 Zoll 0,61–0,68 kg)`, (x.masse_stiel_kg ?? 0) >= 0.6 && (x.masse_stiel_kg ?? 9) <= 0.85, `${x.masse_stiel_kg}`);
  pruefe(`${n}: gesamt 2,0–2,2 kg`, (x.masse_kg ?? 0) >= 2.0 && (x.masse_kg ?? 9) <= 2.2, `${x.masse_kg}`);
  // Kopf: der Stahl reicht über die Schneide; seine Ausdehnung auf der Waffenachse ist die Höhe an der Schneide.
  const kopf = gr.filter(p => /^(Steel|Blank|Schneide)$/.test(p.mat));
  const kh = Math.max(...kopf.map(p => p.hi[1])) - Math.min(...kopf.map(p => p.lo[1]));
  pruefe(`${n}: Kopf schlank — Höhe an der Schneide ${(kh * 100).toFixed(1)} cm in 9–10 cm (vor D429 11,5)`, kh >= 0.09 && kh <= 0.10);
  pruefe(`${n}: der Kopf sitzt am oberen Ende (Spitze)`, Math.abs(Math.min(...kopf.map(p => p.lo[1])) - lo) < 0.005);
}
// Stufe 1 tönt die Schmiede über Materialien mit `Steel` im Namen (`RegionsSzene`, D178) — die Klinge muss eins tragen.
for (const n of ['Klinge', 'Axt', 'Speer']) {
  const k = knoten.get(n);
  pruefe(`${n}: Stahl heisst „Steel“ (Schmiedestufe tönt ihn)`, !!k && grenzen(k).some(p => /Steel/.test(p.mat)));
}

console.log(`\nWaffenmodelle — ${knoten.size} Modelle`);
console.log(`${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
