/**
 * BRACHLAND — Handwerksregeln der Bewegung, gemessen an der **ausgelieferten** Datei (D456, Auftrag D455).
 *
 * `public/figuren/held/held-clips.glb` wird mit three.js abgespielt wie im Spiel; die Marken kommen aus
 * `content/clipmarken.json`. Geprüft wird je Hieb und Stoss, was man im Standbild nicht sieht:
 *   1. **Eine Hut je Waffe:** Jeder Clip mit `beginn: hut` beginnt in Bild 1 der Hut, jeder mit `ende: hut` endet in
 *      ihr — Pose (jeder Knochen ≤ 2°) und Fusslage (≤ 1,5 cm). Damit kann die Laufzeit (D457) sauber überblenden.
 *   2. **Marken:** Einstieg < Scheitel < Durchzug < Kette ≤ Halt < Ende, alle auf Schlüsselbildern von
 *      `tools/waffenclips.py`; Scheitel und Durchzug wie `hieb` in `content/waffen/*.json`; Clipdauer = Bilder / 24.
 *   3. **Überlappung:** Becken, Brust, Hand und Waffenspitze erreichen ihr höchstes Tempo nacheinander (Hüfte → Rumpf →
 *      Arm → Waffe), das Becken vor der Spitze.
 *   4. **Bögen:** Die Hand läuft im Hieb auf einer Kurve, nicht auf der Sehne (grösster Abstand von der Sehne ≥ 6 %).
 *   5. **Ausholen lesbar:** Vor dem Schlag geht die Spitze erst gegen die Schlagrichtung (Gegenbewegung).
 *   6. **Kein gemeinsamer Halt:** Becken, Brust, Hand und Spitze fallen nach ihrer Tempospitze nicht im selben Bild
 *      unter ein Viertel davon.
 *   7. **Weich ein und aus:** Das erste Bild-Intervall ist langsamer als das zweite, das letzte langsamer als das
 *      vorletzte (aus der Ruhe beschleunigen, in die Ruhe bremsen).
 *   8. **Füsse:** Ein stehender Fuss gleitet nicht (≤ 2 cm je Bild), ein Schritt hebt ab (≥ 2 cm).
 *   9. **Blick:** Der Kopf bleibt bis zum Durchzug beim Ziel (≤ 25° neben geradeaus).
 *  10. **Freie Hand lebt** (Klinge): Sie bewegt sich gegen die Brust um ≥ 15 cm.
 *  11. **Schneide führt** (Langes Messer): im Scheitel und im Durchzug ≤ 20° neben der Bahn des Schlagpunkts.
 *  12. **Zwischenbilder treu** (alle Clips mit Marken): Zwischen zwei Bildern mischt three.js jede Knochendrehung für
 *      sich. Springt die Verdrehung eines Arms von einem Bild zum nächsten (und der Unterarm gleicht aus), stehen beide
 *      Bilder richtig, aber dazwischen fliegt die Hand aus der Bahn — bei 60 Bildern/s und im Trefferstopp sichtbar.
 *      Hand, Ellbogen und Waffenspitze liegen im halben Bild höchstens 3 cm weiter von der Sehne als ein Kreisbogen
 *      es erlaubt (0,6 × Sehne).
 *
 *  13. **Fortbewegung (D460):** Gang, Laufschritt und Sprint sind Schleifen (letztes Bild = erstes), decken ihr Tempo
 *      bei Rate 1 (Aufstandspunkt wandert im Raum der Figur mit dem Tempo zurück; dazu die Messung der Laufzeit,
 *      `natuerlichesTempo` aus `src/figur/fortbewegung.ts`), der **Standfuss gleitet nicht** (Aufstandspunkt — Fersenkante
 *      oder Ballen — weicht je Bild höchstens 1,5 cm von der geraden Bahn ab und taucht nicht unter den Boden), der Gang
 *      hat immer einen Fuss am Boden, Lauf und Sprint haben eine Flugphase, das Becken geht auf und ab, die Arme
 *      schwingen gegengleich zu den Beinen, die Schultern drehen gegen das Becken. `Run` und `Roll` der Laufzeit sind
 *      dieselben Daten wie `Koerper_Laufschritt` und `Koerper_Rolle`.
 *
 * Clips mit eigener `bildrate` in den Marken (D460) beginnen bei 0 s: Bild b liegt bei (b − 1) / bildrate.
 *
 * `GLB=<datei>` misst eine andere Datei (Vorher/Nachher), `BERICHT=1` druckt alle Messwerte.
 */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { legeAnHeldHand } from '../src/kampf/waffenhand.js';
import { WAFFEN } from '../src/kampf/echtzeit.js';
import { Clipmarken } from '../src/data/schema.js';
import { natuerlichesTempo, type Bahnpunkt } from '../src/figur/fortbewegung.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}
const DATEI = process.env.GLB ?? 'public/figuren/held/held-clips.glb';
const FREMD = !!process.env.GLB;          // eine andere Datei: nur messen, was sie trägt
const BERICHT = !!process.env.BERICHT;

const marken = Clipmarken.parse(JSON.parse(readFileSync('content/clipmarken.json', 'utf8')));
const RATE = marken.bildrate;

// ---- Schlüsselbilder aus waffenclips.py
const py = readFileSync('tools/waffenclips.py', 'utf8');
const schluessel = new Map<string, number[]>();
/** D460: Clips, deren Pose je Bild aus einer Funktion kommt (`_melde`, `_gang`) — sie haben keine Schlüsselbilder. */
const gerechnet = new Set([...py.matchAll(/^_(?:melde|gang)\('(\w+)'/gm)].map(x => x[1]));
{
  let jetzt: string | null = null;
  for (const z of py.split('\n')) {
    const kopf = z.match(/^ {4}'(\w+)': \((?:'\w+'|KLINGE_BASIS|HIRSCH_BASIS), '(\w+)', \[/);
    if (kopf) { jetzt = kopf[1]; schluessel.set(jetzt, []); continue; }
    const bild = z.match(/^ {8}\((\d+), /);
    if (bild && jetzt) schluessel.get(jetzt)!.push(Number(bild[1]));
    if (/^\}/.test(z)) jetzt = null;
  }
}

// ---- Datei lesen, Skelett und Clips als three-Objekte (wie `tests/axtgriff.test.ts`)
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc: Document = await io.read(DATEI);
const objekte = new Map<string, THREE.Object3D>();
const wurzel = new THREE.Group();
for (const n of doc.getRoot().listNodes()) {
  const o = new THREE.Object3D();
  o.name = n.getName();
  o.position.fromArray(n.getTranslation()); o.quaternion.fromArray(n.getRotation()); o.scale.fromArray(n.getScale());
  objekte.set(n.getName(), o);
}
for (const n of doc.getRoot().listNodes()) for (const c of n.listChildren()) objekte.get(n.getName())!.add(objekte.get(c.getName())!);
for (const o of objekte.values()) if (!o.parent) wurzel.add(o);
const lies = (a: { getCount(): number; getElementSize(): number; getElement(i: number, t: number[]): number[] }) => {
  const n = a.getCount(), g = a.getElementSize(), f = new Float32Array(n * g), e: number[] = [];
  for (let i = 0; i < n; i++) { a.getElement(i, e); for (let j = 0; j < g; j++) f[i * g + j] = e[j]; }
  return f;
};
const clips = new Map<string, THREE.AnimationClip>();
for (const a of doc.getRoot().listAnimations()) {
  const spuren: THREE.KeyframeTrack[] = [];
  for (const c of a.listChannels()) {
    const s = c.getSampler()!, ziel = c.getTargetNode()!.getName(), pfad = c.getTargetPath();
    const zeit = lies(s.getInput()!), wert = lies(s.getOutput()!);
    if (pfad === 'rotation') spuren.push(new THREE.QuaternionKeyframeTrack(`${ziel}.quaternion`, zeit, wert));
    else if (pfad === 'translation') spuren.push(new THREE.VectorKeyframeTrack(`${ziel}.position`, zeit, wert));
  }
  clips.set(a.getName(), new THREE.AnimationClip(a.getName(), -1, spuren));
}
const handR = objekte.get('hand_r')!;
const waffe = new THREE.Group();
handR.add(waffe); legeAnHeldHand(waffe);
const mixer = new THREE.AnimationMixer(wurzel);
const KNOCHEN = ['pelvis', 'spine_03', 'Head', 'hand_r', 'hand_l', 'foot_l', 'foot_r', 'ball_l', 'ball_r', 'thigh_l', 'thigh_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r'] as const;
type Lage = Record<(typeof KNOCHEN)[number] | 'spitze' | 'schlagpunkt', THREE.Vector3> & {
  kopfQ: THREE.Quaternion; alle: Map<string, THREE.Quaternion>; schneide: THREE.Vector3; achse: THREE.Vector3;
};
/** Spitze und Schlagpunkt vor der rechten Hand, Meter entlang der Waffe (`content/gewicht.json`, `tools/waffenclips.py`). */
const WAFFE_MASS: Record<string, { spitze: number; schlag: number }> = {
  klinge: { spitze: 0.75, schlag: 0.5 }, kriegsmesser: { spitze: 0.92, schlag: 0.6 }, axt: { spitze: 0.35, schlag: 0.3 },
  speer: { spitze: 1.81, schlag: 1.81 }, hirschfaenger: { spitze: 0.55, schlag: 0.35 }, koerper: { spitze: 0.1, schlag: 0.1 },
};
/** Clipzeit eines Bilds: Bild / 24, bei Clips mit eigener `bildrate` (D460) (Bild − 1) / bildrate. */
const zeitVon = (bild: number, rate?: number) => rate ? (bild - 1) / rate : bild / RATE;
function stelle(clip: THREE.AnimationClip, bild: number, mass: { spitze: number; schlag: number }, rate?: number): Lage {
  mixer.stopAllAction();
  const a = mixer.clipAction(clip);
  a.reset().play(); a.timeScale = 0; a.time = Math.min(zeitVon(bild, rate), clip.duration); mixer.update(0);
  wurzel.updateMatrixWorld(true);
  const aus = {} as Lage;
  for (const k of KNOCHEN) aus[k] = objekte.get(k)!.getWorldPosition(new THREE.Vector3());
  aus.spitze = waffe.localToWorld(new THREE.Vector3(0, -mass.spitze, 0));
  aus.schlagpunkt = waffe.localToWorld(new THREE.Vector3(0, -mass.schlag, 0));
  aus.schneide = new THREE.Vector3(-1, 0, 0).transformDirection(waffe.matrixWorld);
  aus.achse = new THREE.Vector3(0, -1, 0).transformDirection(waffe.matrixWorld);
  aus.kopfQ = objekte.get('Head')!.getWorldQuaternion(new THREE.Quaternion());
  aus.alle = new Map([...objekte].map(([n, o]) => [n, o.quaternion.clone()]));
  return aus;
}
const OBEN = new THREE.Vector3(0, 1, 0);
const flach = (v: THREE.Vector3) => new THREE.Vector3(v.x, 0, v.z);

// Blickrichtung der Figur: aus dem Stand (Idle), quer zur Schulterlinie.
const idle = clips.get('Idle');
pruefe('Datei trägt Idle', !!idle);
const ruhe = stelle(idle!, 1, WAFFE_MASS.koerper);
const RECHTS = flach(ruhe.upperarm_r.clone().sub(ruhe.upperarm_l)).normalize();
const VORN = OBEN.clone().cross(RECHTS).normalize();
const BODEN = Math.min(ruhe.foot_l.y, ruhe.foot_r.y);

// ---- 1./2. Hut und Marken
for (const [waffeId, hut] of Object.entries(marken.hut)) {
  pruefe(`Hut ${waffeId}: ${hut} ist als Hut-Clip (Schleife) eingetragen`, marken.clips[hut]?.art === 'hut' && marken.clips[hut]?.ende === 'schleife');
  if (!FREMD) pruefe(`Hut ${waffeId}: ${hut} ausgeliefert`, clips.has(hut));
}
if (!FREMD) for (const n of Object.keys(marken.clips)) pruefe(`${n}: ausgeliefert`, clips.has(n));
for (const [art, w] of Object.entries(WAFFEN)) {
  pruefe(`Regel ${art}: Haltung ${w.haltung} ist die Hut aus clipmarken.json`, marken.hut[art] === w.haltung, `${marken.hut[art]}`);
  for (const s of [...w.leicht, w.schwer, w.lauf]) {
    const m = s.clip ? marken.clips[s.clip] : undefined;
    pruefe(`Regel ${art}/${s.name}: Clip ${s.clip} trägt Marken`, !!m);
    if (!m || !s.hieb) continue;
    pruefe(`Regel ${art}/${s.name}: Scheitel/Durchzug der Marken = hieb (${m.scheitel}/${m.durchzug})`,
      Math.abs(s.hieb.scheitel * RATE - (m.scheitel ?? -1)) < 1e-6 && Math.abs(s.hieb.durchzug * RATE - (m.durchzug ?? -1)) < 1e-6,
      `${s.hieb.scheitel * RATE}/${s.hieb.durchzug * RATE}`);
  }
}

const grad = (r: number) => THREE.MathUtils.radToDeg(r);
const zeilen: string[] = [];
for (const [name, m] of Object.entries(marken.clips)) {
  const clip = clips.get(name);
  if (!clip) continue;
  const mass = WAFFE_MASS[m.waffe] ?? WAFFE_MASS.koerper;
  const bilder = gerechnet.has(name) ? undefined : schluessel.get(name);
  pruefe(`${name}: aus Schlüsselbildern oder gerechnet in waffenclips.py`, !!bilder || gerechnet.has(name));
  if (bilder) pruefe(`${name}: bilder ${m.bilder} = letztes Schlüsselbild`, Math.max(...bilder) === m.bilder, `${Math.max(...bilder)}`);
  pruefe(`${name}: gerechnete Clips tragen ihre bildrate und beginnen bei 0 s`, gerechnet.has(name) === (m.bildrate !== undefined));
  const dauer = zeitVon(m.bilder, m.bildrate);
  pruefe(`${name}: Clipdauer ${dauer.toFixed(3)} s`, Math.abs(clip.duration - dauer) < 1e-3, `${clip.duration.toFixed(3)}`);
  const hutName = m.waffe === 'koerper' ? 'Idle' : marken.hut[m.waffe];   // ohne Waffe ist die „Hut“ der Stand aus dem Paket
  const hut = hutName && clips.get(hutName) ? stelle(clips.get(hutName)!, 1, mass) : null;
  const L = new Map<number, Lage>();
  const bei = (f: number) => { if (!L.has(f)) L.set(f, stelle(clip, f, mass, m.bildrate)); return L.get(f)!; };
  const gleich = (a: Lage, b: Lage) => {
    let w = 0, wo = '';
    for (const [k, q] of a.alle) { const x = grad(q.angleTo(b.alle.get(k)!)); if (x > w) { w = x; wo = k; } }
    const fuss = Math.max(a.foot_l.distanceTo(b.foot_l), a.foot_r.distanceTo(b.foot_r), a.pelvis.distanceTo(b.pelvis));
    return { w, wo, fuss };
  };
  if (m.art === 'hut') {
    // Linker Fuss vor in jeder Hut (Liechtenauer, Lecküchner, Meyer; Waffenbewegungen §5 Nr. 6) — gemessen, nicht
    // aus dem Schlüssel gelesen: Der Stand des Pakets steht selbst im Schritt (rechts vor).
    const vor = bei(1).foot_l.clone().sub(bei(1).foot_r).dot(VORN);
    pruefe(`${name}: linker Fuss vor (${(vor * 100).toFixed(0)} cm ≥ 15)`, vor >= 0.15);
    zeilen.push(`${name}: linker Fuss ${(vor * 100).toFixed(0)} cm vor`);
  }
  if (hut && m.beginn === 'hut') {
    const g = gleich(bei(1), hut);
    pruefe(`${name}: beginnt in der Hut ${hutName} (Knochen ≤ 2°, Füsse und Becken ≤ 1,5 cm)`, g.w <= 2 && g.fuss <= 0.015, `${g.w.toFixed(1)}° ${g.wo}, ${(g.fuss * 100).toFixed(1)} cm`);
  }
  if (hut && (m.ende === 'hut' || m.ende === 'schleife' && m.art === 'hut')) {
    const g = gleich(bei(m.bilder), hut);
    pruefe(`${name}: endet in der Hut ${hutName} (Knochen ≤ 2°, Füsse und Becken ≤ 1,5 cm)`, g.w <= 2 && g.fuss <= 0.015, `${g.w.toFixed(1)}° ${g.wo}, ${(g.fuss * 100).toFixed(1)} cm`);
  }
  if (m.ende === 'schleife' && m.art === 'koerper') {
    const g = gleich(bei(m.bilder), bei(1));
    pruefe(`${name}: Schleife schliesst (Knochen ≤ 1°, Füsse und Becken ≤ 0,5 cm)`, g.w <= 1 && g.fuss <= 0.005, `${g.w.toFixed(1)}° ${g.wo}, ${(g.fuss * 100).toFixed(1)} cm`);
  }
  // 12. Zwischenbilder
  {
    let schlimm = 0, wo = '';
    for (let f = 1; f < m.bilder; f++) for (const k of ['hand_r', 'hand_l', 'lowerarm_r', 'lowerarm_l', 'spitze'] as const) {
      const a = bei(f)[k], b = bei(f + 1)[k], h = bei(f + 0.5)[k];
      // die Spitze einer langen Waffe hängt an einem langen Hebel: Grenze im Verhältnis zur Klinge (0,75 m)
      const ab = (h.distanceTo(a.clone().add(b).multiplyScalar(0.5)) - 0.6 * a.distanceTo(b)) / (k === 'spitze' ? Math.max(1, mass.spitze / 0.75) : 1);
      if (ab > schlimm) { schlimm = ab; wo = `${k} Bild ${f}→${f + 1}`; }
    }
    pruefe(`${name}: Zwischenbilder treu (grösster Ausreisser ${(schlimm * 100).toFixed(1)} cm ≤ 3)`, schlimm <= 0.03, wo);
  }
  if (m.art !== 'hieb' && m.art !== 'stoss') continue;
  const E = m.einstieg!, S = m.scheitel!, D = m.durchzug!, K = m.kette!, H = m.halt!;
  pruefe(`${name}: Marken geordnet (Einstieg ${E} < Scheitel ${S} < Durchzug ${D} < Kette ${K} ≤ Halt ${H} < Ende ${m.bilder})`,
    E < S && S < D && D < K && K <= H && H < m.bilder && (m.beginn === 'anlauf' ? E === 1 : E > 1));
  if (bilder) pruefe(`${name}: alle Marken liegen auf Schlüsselbildern`, [E, S, D, K, H].every(x => bilder.includes(x)), bilder.join(','));
  if (bilder) pruefe(`${name}: Kette ist das erste Schlüsselbild nach dem Durchzug, Halt das letzte vor dem Ende`,
    Math.min(...bilder.filter(b => b > D)) === K && Math.max(...bilder.filter(b => b < m.bilder)) === H);

  // Tempo je Viertelbild (zwischen den Bildern mischt three.js linear — wie im Spiel)
  const T = 0.25;
  const tempo = (k: keyof Lage, f: number) => (bei(f + T)[k] as THREE.Vector3).distanceTo(bei(f - T)[k] as THREE.Vector3) / (2 * T) * RATE;
  const spitzeBei = (k: keyof Lage, von: number, bis: number) => {
    let best = -1, wo = von;
    for (let f = von; f <= bis + 1e-9; f += T) { const v = tempo(k, f); if (v > best + 1e-9) { best = v; wo = f; } }
    return { wo, v: best };
  };
  // 3. Überlappung im Schlag: Fenster vom Scheitel (zwei Bilder davor: die Hüfte beginnt früher) bis kurz nach dem Durchzug
  const von = Math.max(1 + T, S - 2), bis = Math.min(m.bilder - T, D + 1);
  const pB = spitzeBei('pelvis', von, bis), pR = spitzeBei('spine_03', von, bis), pH = spitzeBei('hand_r', von, bis), pW = spitzeBei('spitze', von, bis);
  pruefe(`${name}: Überlappung — Becken (${pB.wo}) vor der Spitze (${pW.wo}), nicht nach der Hand (${pH.wo}); Brust (${pR.wo}) nicht nach der Spitze`,
    pB.wo < pW.wo && pB.wo <= pH.wo && pR.wo <= pW.wo);
  // 4. Bögen (nur Hiebe; ein Stoss ist gerade)
  const sehne = bei(D).hand_r.clone().sub(bei(S).hand_r);
  let bogen = 0;
  for (let f = S; f <= D; f += T) {
    const d = bei(f).hand_r.clone().sub(bei(S).hand_r);
    bogen = Math.max(bogen, d.clone().addScaledVector(sehne.clone().normalize(), -d.dot(sehne.clone().normalize())).length());
  }
  const bogenAnteil = bogen / Math.max(1e-6, sehne.length());
  if (m.art === 'hieb') pruefe(`${name}: Handbahn ist ein Bogen (${(bogenAnteil * 100).toFixed(0)} % der Sehne ≥ 6 %)`, bogenAnteil >= 0.06);
  // 5. Gegenbewegung: Die Spitze geht vor dem Schlag gegen die Schlagrichtung
  const schlag = bei(D).spitze.clone().sub(bei(S).spitze).normalize();
  const gegen = -bei(S).spitze.clone().sub(bei(1).spitze).dot(schlag);
  if (m.beginn === 'hut') pruefe(`${name}: Ausholen als Gegenbewegung (Spitze ${(gegen * 100).toFixed(0)} cm gegen den Schlag ≥ 15)`, gegen >= 0.15);
  // 6. Kein gemeinsamer Halt: erstes Viertelbild nach der eigenen Tempospitze unter 25 % davon
  const ruht = (k: keyof Lage, p: { wo: number; v: number }) => {
    for (let f = p.wo; f <= H; f += T) if (tempo(k, f) < 0.25 * p.v) return f;
    return H;
  };
  const hB = ruht('pelvis', pB), hR = ruht('spine_03', pR), hH = ruht('hand_r', pH), hW = ruht('spitze', pW);
  const spanne = Math.max(hB, hR, hH, hW) - Math.min(hB, hR, hH, hW);
  pruefe(`${name}: kein gemeinsamer Halt (Becken ${hB}, Brust ${hR}, Hand ${hH}, Spitze ${hW}: Spanne ${spanne} ≥ 0,5 Bilder)`, spanne >= 0.5);
  // 7. Weich ein und aus
  let weg = 0;
  for (let f = 1; f < m.bilder; f++) weg += bei(f + 1).hand_r.distanceTo(bei(f).hand_r);
  const mittel = weg / (m.bilder - 1);
  // Gemessen gegen das Nachbarintervall, nicht gegen das Mittel: Die Regel streckt und staucht jede Phase auf ihre
  // Zeit (ein Klingenhieb holt in 0,18 s aus) — was zählt, ist die Form: aus der Ruhe beschleunigen, in die Ruhe bremsen.
  const ein = bei(2).hand_r.distanceTo(bei(1).hand_r) / Math.max(1e-6, bei(3).hand_r.distanceTo(bei(2).hand_r));
  const ausl = bei(m.bilder).hand_r.distanceTo(bei(m.bilder - 1).hand_r) / Math.max(1e-6, bei(m.bilder - 1).hand_r.distanceTo(bei(m.bilder - 2).hand_r));
  void mittel;
  if (m.beginn === 'hut') pruefe(`${name}: weich ein (erstes Intervall ${(ein * 100).toFixed(0)} % des zweiten ≤ 75 %)`, ein <= 0.75);
  pruefe(`${name}: weich aus (letztes Intervall ${(ausl * 100).toFixed(0)} % des vorletzten ≤ 75 %)`, ausl <= 0.75);
  // 8. Füsse
  let gleiten = 0, hub = 0, schritt = 0;
  for (const fuss of ['foot_l', 'foot_r'] as const) {
    const tief = Math.min(...Array.from({ length: m.bilder }, (_, i) => bei(i + 1)[fuss].y));
    for (let f = 1; f < m.bilder; f++) {
      const a = bei(f)[fuss], b = bei(f + 1)[fuss];
      if (a.y <= tief + 0.012 && b.y <= tief + 0.012) gleiten = Math.max(gleiten, flach(b.clone().sub(a)).length());
    }
    const s = flach(bei(S)[fuss].clone().sub(bei(1)[fuss])).length();
    if (s > schritt) { schritt = s; hub = Math.max(...Array.from({ length: S }, (_, i) => bei(i + 1)[fuss].y)) - tief; }
  }
  pruefe(`${name}: stehender Fuss gleitet nicht (${(gleiten * 100).toFixed(1)} cm je Bild ≤ 2)`, gleiten <= 0.02);
  if (schritt >= 0.15) pruefe(`${name}: der Schritt (${(schritt * 100).toFixed(0)} cm) hebt den Fuss (${(hub * 100).toFixed(1)} cm ≥ 2)`, hub >= 0.02);
  let stand = 0;
  for (let f = S; f < D; f++) for (const fuss of ['foot_l', 'foot_r'] as const) stand = Math.max(stand, bei(f + 1)[fuss].distanceTo(bei(f)[fuss]));
  pruefe(`${name}: beide Füsse stehen vom Scheitel bis zum Durchzug (${(stand * 100).toFixed(1)} cm je Bild ≤ 1,5)`, stand <= 0.015);
  // 9. Blick
  const blickLokal = VORN.clone().applyQuaternion(ruhe.kopfQ.clone().invert());
  let blick = 0;
  for (let f = 1; f <= D; f++) {
    const b = flach(blickLokal.clone().applyQuaternion(bei(f).kopfQ));
    blick = Math.max(blick, grad(b.angleTo(VORN)));
  }
  pruefe(`${name}: Blick bleibt beim Ziel (Kopf höchstens ${blick.toFixed(0)}° neben geradeaus ≤ 25°)`, blick <= 25);
  // 10. Freie Hand
  let frei = 0;
  if (m.waffe === 'klinge' || m.waffe === 'hirschfaenger') {
    const rel = (f: number) => bei(f).hand_l.clone().sub(bei(f).spine_03);
    for (let f = 2; f <= m.bilder; f++) frei = Math.max(frei, rel(f).distanceTo(rel(1)));
    pruefe(`${name}: freie Hand lebt (${(frei * 100).toFixed(0)} cm gegen die Brust ≥ 15)`, frei >= 0.15);
  }
  // 11. Schneide (einschneidige Klingen; die Axt prüft `tests/axtgriff.test.ts` mit ihrem Gleiten am Stiel)
  const schneide = (von_: number, nach: number, f: number) => {
    const bahn = bei(nach).schlagpunkt.clone().sub(bei(von_).schlagpunkt);
    bahn.addScaledVector(bei(f).achse, -bahn.dot(bei(f).achse));
    return grad(bahn.angleTo(bei(f).schneide));
  };
  const wS = schneide(S, S + 1, S), wD = schneide(D - 1, D, D);
  if (m.waffe === 'kriegsmesser' && m.art === 'hieb') {
    pruefe(`${name}: Schneide im Scheitel ${wS.toFixed(0)}° neben der Bahn (≤ 20°)`, wS <= 20);
    pruefe(`${name}: Schneide im Durchzug ${wD.toFixed(0)}° neben der Bahn (≤ 20°)`, wD <= 20);
  }
  // Kettenpose: welcher Fuss vorn
  const vor = bei(K).foot_r.clone().sub(bei(K).foot_l).dot(VORN);
  const vorn = vor > 0.1 ? 'rechts' : vor < -0.1 ? 'links' : 'gleich';   // unter 10 cm Versatz stehen die Füsse nebeneinander
  pruefe(`${name}: in der Kettenpose steht ${m.vorn} vorn (gemessen ${vorn}, ${(vor * 100).toFixed(0)} cm)`, vorn === m.vorn);
  // Becken: Gewicht nach vorn und nach unten
  const vorB = bei(D).pelvis.clone().sub(bei(S).pelvis).dot(VORN);
  const tiefB = bei(1).pelvis.y - Math.min(...Array.from({ length: m.bilder }, (_, i) => bei(i + 1).pelvis.y));
  zeilen.push(`${name}: Spitzen Becken/Brust/Hand/Waffe ${pB.wo}/${pR.wo}/${pH.wo}/${pW.wo}, Bogen ${(bogenAnteil * 100).toFixed(0)} %, ` +
    `Gegenbewegung ${(gegen * 100).toFixed(0)} cm, Halt ${hB}/${hR}/${hH}/${hW}, ein/aus ${(ein * 100).toFixed(0)}/${(ausl * 100).toFixed(0)} %, ` +
    `Gleiten ${(gleiten * 100).toFixed(1)} cm, Schritt ${(schritt * 100).toFixed(0)} cm Hub ${(hub * 100).toFixed(1)} cm, Blick ${blick.toFixed(0)}°, ` +
    `Becken vor ${(vorB * 100).toFixed(0)} cm tiefer ${(tiefB * 100).toFixed(0)} cm, Spitze ${pW.v.toFixed(1)} m/s` +
    (frei ? `, freie Hand ${(frei * 100).toFixed(0)} cm` : '') + `, Schneide ${wS.toFixed(0)}°/${wD.toFixed(0)}°`);
}

// `TIEF=<Clip>` druckt je Bild den tiefsten Knochen über dem Boden des Stands (Rolle, Landung: liegt der Körper auf?).
if (process.env.TIEF && clips.get(process.env.TIEF)) {
  const c = clips.get(process.env.TIEF)!, m = marken.clips[process.env.TIEF];
  for (let b = 1; b <= (m?.bilder ?? Math.round(c.duration * RATE)); b++) {
    stelle(c, b, WAFFE_MASS.koerper, m?.bildrate);
    let tief = Infinity, wo = '';
    for (const [n, o] of objekte) { const y = o.getWorldPosition(new THREE.Vector3()).y; if (n && n !== 'root' && n !== 'Held' && !/leaf|index|middle|ring|pinky|thumb/.test(n) && y < tief) { tief = y; wo = n; } }
    const p = objekte.get('pelvis')!.getWorldPosition(new THREE.Vector3()), k = objekte.get('Head')!.getWorldPosition(new THREE.Vector3());
    console.log(`    TIEF ${c.name} ${String(b).padStart(2)}: ${((tief - BODEN) * 100).toFixed(0).padStart(4)} cm (${wo}), Becken hoch ${(p.y * 100).toFixed(0)} vor ${(p.dot(VORN) * 100).toFixed(0)}, Kopf hoch ${(k.y * 100).toFixed(0)} vor ${(k.dot(VORN) * 100).toFixed(0)}`);
  }
}

// ---- 13. Fortbewegung (D460): Gang, Laufschritt, Sprint — gemessen wie die Laufzeit misst, dazu am Aufstandspunkt
const STANDHOEHE = (JSON.parse(readFileSync('content/figurlaufzeit.json', 'utf8')) as { gang: { standHoehe: number } }).gang.standHoehe;
const LAUFEN = (JSON.parse(readFileSync('content/bewegung.json', 'utf8')) as { laufen: { gehen: number; rennen: number } }).laufen;
// Fuss der Hauptfigur im Rahmen Knöchel → Ballen (e1) und senkrecht dazu nach oben (e2), Meter — wie `tools/waffenclips.py`
// (`FUSS_VOR` 0,14, `SOHLE` 0,08, `FERSE_HINTER` 0,05; der Ballenknochen liegt 0,056 unter dem Knöchel).
const FERSE = { e1: -0.0167, e2: -0.0928 }, BALLEN = { e1: 0.0089, e2: -0.0223 };
function aufstand(l: Lage, seite: 'l' | 'r') {
  const kn = l[`foot_${seite}`], ba = l[`ball_${seite}`];
  const e1 = ba.clone().sub(kn).normalize();
  const e2 = OBEN.clone().addScaledVector(e1, -OBEN.dot(e1)).normalize();
  return {
    ferse: kn.clone().addScaledVector(e1, FERSE.e1).addScaledVector(e2, FERSE.e2),
    ballen: ba.clone().addScaledVector(e1, BALLEN.e1).addScaledVector(e2, BALLEN.e2),
  };
}
interface Gangmessung {
  tempo: number; gleiten: number; laufzeit: number | null; schritt: number; jeMin: number; kontakt: number; flug: number;
  immerBoden: boolean; hub: number; seit: number; arme: number; schultern: number; tiefster: number;
}
const korrelation = (a: number[], b: number[]) => {
  const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { ab += (a[i] - ma) * (b[i] - mb); aa += (a[i] - ma) ** 2; bb += (b[i] - mb) ** 2; }
  return ab / Math.max(1e-12, Math.sqrt(aa * bb));
};
/** Ein Gangzyklus, abgetastet in `n` gleichen Schritten (das letzte Bild ist das erste und zählt nicht doppelt). */
function messeGangclip(clip: THREE.AnimationClip, n: number): Gangmessung {
  const dt = clip.duration / n;
  const rate = 1 / dt;
  const L: Lage[] = Array.from({ length: n + 1 }, (_, i) => stelle(clip, i + 1, WAFFE_MASS.koerper, rate));
  const pkt = L.map(l => ({ l: aufstand(l, 'l'), r: aufstand(l, 'r') }));
  const boden = Math.min(...pkt.flatMap(p => [p.l.ferse.y, p.l.ballen.y, p.r.ferse.y, p.r.ballen.y]));
  const TOL = 0.006;
  if (process.env.SPUR === clip.name) for (let i = 0; i <= n; i++) {
    const z = (v: number) => (v * 100).toFixed(1).padStart(6);
    console.log(`    SPUR ${clip.name} ${String(i + 1).padStart(2)}: Knöchel l vor ${z(L[i].foot_l.dot(VORN))} hoch ${z(L[i].foot_l.y)}  Ferse ${z(pkt[i].l.ferse.y - boden)} Ballen ${z(pkt[i].l.ballen.y - boden)} Ballen vor ${z(pkt[i].l.ballen.dot(VORN))} | Becken hoch ${z(L[i].pelvis.y)} seit ${z(L[i].pelvis.dot(RECHTS))}`);
  }
  const weg: number[] = [], quer: number[] = [];
  const steht = (i: number, s: 'l' | 'r') => Math.min(pkt[i][s].ferse.y, pkt[i][s].ballen.y) <= boden + TOL;
  for (const s of ['l', 'r'] as const) for (let i = 0; i < n; i++) {
    // derselbe Punkt muss in beiden Bildern aufliegen: der Ballen, sonst die Ferse
    for (const punkt of ['ballen', 'ferse'] as const) {
      const a = pkt[i][s][punkt], b = pkt[i + 1][s][punkt];
      if (a.y > boden + TOL || b.y > boden + TOL) continue;
      const d = b.clone().sub(a);
      weg.push(-d.dot(VORN)); quer.push(Math.abs(d.dot(RECHTS)));
      break;
    }
  }
  const mittel = weg.reduce((x, v) => x + v, 0) / Math.max(1, weg.length);
  const gleiten = Math.max(0, ...weg.map(w => Math.abs(w - mittel)), ...quer);
  let kontakt = 0, flug = 0, immer = true;
  for (let i = 0; i < n; i++) {
    const l = steht(i, 'l'), r = steht(i, 'r');
    if (l) kontakt++;
    if (!l && !r) { flug++; immer = false; }
  }
  // wie `messeGang` in `src/figur/laufzeit.ts`: Knöchelbahn im Raum der Figur, 32 Proben
  const proben = 32, werte: number[] = [];
  for (const k of ['foot_l', 'foot_r'] as const) {
    const bahn: Bahnpunkt[] = [];
    for (let i = 0; i <= proben; i++) {
      const p = stelle(clip, 1 + (Math.min(clip.duration * 0.9999, clip.duration * i / proben)) * rate, WAFFE_MASS.koerper, rate)[k];
      bahn.push({ t: clip.duration * i / proben, x: p.x, y: p.y, z: p.z });
    }
    const v = natuerlichesTempo(bahn, STANDHOEHE);
    if (v !== null) werte.push(v);
  }
  const reihe = (f: (l: Lage) => number) => L.slice(0, n).map(f);
  const gier = (a: THREE.Vector3, b: THREE.Vector3) => { const d = flach(a.clone().sub(b)); return Math.atan2(d.dot(VORN), d.dot(RECHTS)); };
  const beckenY = reihe(l => l.pelvis.y), beckenX = reihe(l => l.pelvis.dot(RECHTS));
  return {
    tempo: mittel * rate, gleiten, laufzeit: werte.length ? werte.reduce((x, v) => x + v, 0) / werte.length : null,
    schritt: mittel * rate * clip.duration / 2, jeMin: 120 / clip.duration, kontakt: kontakt * dt, flug: flug * dt / 2, immerBoden: immer,
    hub: Math.max(...beckenY) - Math.min(...beckenY), seit: Math.max(...beckenX) - Math.min(...beckenX),
    arme: korrelation(reihe(l => l.hand_r.clone().sub(l.hand_l).dot(VORN)), reihe(l => l.foot_l.clone().sub(l.foot_r).dot(VORN))),
    schultern: korrelation(reihe(l => gier(l.upperarm_r, l.upperarm_l)), reihe(l => gier(l.thigh_r, l.thigh_l))),
    tiefster: Math.min(...L.flatMap(l => [l.ball_l.y, l.ball_r.y])) - boden,
  };
}
const zeigeGang = (name: string, g: Gangmessung) => `${name}: deckt ${g.tempo.toFixed(2)} m/s bei Rate 1 (Laufzeit-Messung ${g.laufzeit?.toFixed(2) ?? '—'}), ` +
  `Schritt ${g.schritt.toFixed(2)} m, ${g.jeMin.toFixed(0)} Schritte/min, Kontakt ${g.kontakt.toFixed(3)} s, Flug ${g.flug.toFixed(3)} s, ` +
  `Fussgleiten ${(g.gleiten * 100).toFixed(1)} cm je Bild, Beckenhub ${(g.hub * 100).toFixed(1)} cm, seitlich ${(g.seit * 100).toFixed(1)} cm, ` +
  `Arme↔Beine r=${g.arme.toFixed(2)}, Schultern↔Becken r=${g.schultern.toFixed(2)}`;
// Soll: Tempo (Gehen 1,4 m/s — Perry & Burnfield; Laufschritt und Rennen sind die Spielwerte aus `content/bewegung.json`),
// Flugphase, Beckenhub von–bis in Metern (Gehen 4–5 cm; Laufen Feder + Flug, siehe `tools/waffenclips.py`).
// `laufzeit`: wie weit die Messung der Laufzeit (Mittel der Knöchelbahn, solange der Knöchel tief steht) vom Tempo am
// Aufstandspunkt abweichen darf. Lauf und Sprint setzen fast flach auf — sie liest sie auf 4 % genau. Der Gang rollt über
// die Ferse ab und drückt über den Ballen ab; dabei läuft der Knöchel dem Boden ein Stück voraus, das Mittel liest
// 12 % zu wenig (1,23 statt 1,40 m/s). Wer `Koerper_Gang` verdrahtet, misst am Median oder am Aufstandspunkt (D460).
const GAENGE: Record<string, { tempo: number; flug: boolean; hub: [number, number]; laufzeit: number }> = {
  Koerper_Gang: { tempo: 1.4, flug: false, hub: [0.025, 0.06], laufzeit: 0.15 },
  Koerper_Laufschritt: { tempo: LAUFEN.gehen, flug: true, hub: [0.04, 0.11], laufzeit: 0.06 },
  Koerper_Sprint: { tempo: LAUFEN.rennen, flug: true, hub: [0.025, 0.08], laufzeit: 0.06 },
};
for (const [name, soll] of Object.entries(GAENGE)) {
  const clip = clips.get(name), m = marken.clips[name];
  if (!FREMD) pruefe(`${name}: ausgeliefert und mit Marken`, !!clip && !!m);
  if (!clip || !m) continue;
  pruefe(`${name}: Schleife`, m.ende === 'schleife');
  const g = messeGangclip(clip, m.bilder - 1);
  zeilen.push(zeigeGang(name, g));
  pruefe(`${name}: deckt ${soll.tempo} m/s bei Rate 1 (Aufstandspunkt ${g.tempo.toFixed(2)} m/s, ±4 %)`, Math.abs(g.tempo / soll.tempo - 1) <= 0.04);
  pruefe(`${name}: die Laufzeit misst ${g.laufzeit?.toFixed(2)} m/s (±${soll.laufzeit * 100} %)`,
    g.laufzeit !== null && Math.abs(g.laufzeit / soll.tempo - 1) <= soll.laufzeit);
  pruefe(`${name}: Standfuss gleitet nicht (${(g.gleiten * 100).toFixed(1)} cm je Bild ≤ 1,5)`, g.gleiten <= 0.015);
  pruefe(`${name}: Ballen taucht nicht unter den Boden (${(g.tiefster * 100).toFixed(1)} cm über der Sohle ≥ 1)`, g.tiefster >= 0.01);
  if (soll.flug) pruefe(`${name}: Flugphase (${g.flug.toFixed(3)} s je Schritt ≥ 0,06)`, g.flug >= 0.06);
  else pruefe(`${name}: immer ein Fuss am Boden`, g.immerBoden);
  pruefe(`${name}: Beckenhub ${(g.hub * 100).toFixed(1)} cm in ${soll.hub[0] * 100}–${soll.hub[1] * 100}`, g.hub >= soll.hub[0] && g.hub <= soll.hub[1]);
  pruefe(`${name}: Becken pendelt seitlich (${(g.seit * 100).toFixed(1)} cm ≥ 1)`, g.seit >= 0.01);
  pruefe(`${name}: Arme schwingen gegengleich zu den Beinen (r = ${g.arme.toFixed(2)} ≥ 0,6)`, g.arme >= 0.6);
  pruefe(`${name}: Schultern drehen gegen das Becken (r = ${g.schultern.toFixed(2)} ≤ −0,5)`, g.schultern <= -0.5);
}
// Zum Vergleich die Paketclips (nur Bericht): 40 und 24 Bilder bei 24/s.
for (const [name, n] of [['Walk', 40], ['Run_Paket', 24], ['Run', 24]] as const) {
  const clip = clips.get(name);
  if (clip && BERICHT && (name !== 'Run' || !clips.has('Run_Paket'))) zeilen.push('(Bestand) ' + zeigeGang(name, messeGangclip(clip, n)));
}
// Was die Laufzeit heute unter Bestandsnamen spielt, sind dieselben Daten wie die neuen Clips.
if (!FREMD) for (const [alt, neu] of [['Run', 'Koerper_Laufschritt'], ['Roll', 'Koerper_Rolle']] as const) {
  const a = clips.get(alt), b = clips.get(neu);
  pruefe(`${alt} ist ${neu}`, !!a && !!b && Math.abs(a.duration - b.duration) < 1e-6 && [0.1, 0.45, 0.8].every(u => {
    const rate = marken.clips[neu].bildrate!, bild = 1 + u * b.duration * rate;
    const x = stelle(a, bild, WAFFE_MASS.koerper, rate), y = stelle(b, bild, WAFFE_MASS.koerper, rate);
    return [...x.alle].every(([k, q]) => q.angleTo(y.alle.get(k)!) < 1e-3) && x.pelvis.distanceTo(y.pelvis) < 1e-4;
  }));
}
if (BERICHT) console.log('  ' + zeilen.join('\n  '));
void BODEN;

console.log(`\nBewegung — ${Object.keys(marken.clips).length} Clips mit Marken (${DATEI})`);
console.log(`${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
