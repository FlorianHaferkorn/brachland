/**
 * BRACHLAND — Zweihand-Fällaxt (D429): Griff, Gleiten und Schneide, gemessen an den **ausgelieferten** Dateien.
 *
 * Das Skelett der Hauptfigur und die Axtclips kommen aus `public/figuren/held/held-clips.glb`, das Modell aus
 * `public/figuren/kampf/waffen.glb`. Abgespielt wird mit three.js wie im Spiel (AnimationMixer, Waffe an `hand_r` mit
 * `legeAnHeldHand`, danach `gleiteAmStiel`). Geprüft wird:
 *   1. Trefferfenster unverändert: Clipdauer, Scheitel und Durchzug jedes Axtschlags wie vor D429.
 *   2. Zwei Hände: Die linke liegt am Stielende (quer zur Achse ≤ 3,5 cm), die rechte gleitet — im Scheitel vorn am
 *      Stiel, im Durchzug beide Hände am Ende (USDA Forest Service, *An Ax to Grind*, 1999).
 *   3. Die Schneide führt: Im Scheitel (Richtung des beginnenden Schlags) und im Durchzug (Richtung, aus der er kommt)
 *      steht die Schneide höchstens 20° neben der Bahn des Kopfs, quer zum Stiel gemessen — nie der Nacken zuerst.
 */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { GLEITEN, gleiteAmStiel, legeAnHeldHand } from '../src/kampf/waffenhand.js';
import { WAFFEN } from '../src/kampf/echtzeit.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}

// ---- 1. Trefferfenster: Werte vor D429 (Clipdauer aus held-clips.glb, Bilder aus content/waffen/axt.json).
const VOR_D429: Record<string, { dauer: number; scheitel?: number; durchzug?: number; ersetzt?: string }> = {
  Axt_Hieb: { dauer: 34 / 24, scheitel: 12, durchzug: 16, ersetzt: 'Axe_Overhead' },
  Axt_Quer: { dauer: 30 / 24, scheitel: 10, durchzug: 15 },
  Axt_Schwer: { dauer: 40 / 24, scheitel: 20, durchzug: 25 },
  Axt_Lauf: { dauer: 26 / 24, scheitel: 7, durchzug: 11 },
  Axt_Block: { dauer: 8 / 24 },
  Axt_Stand: { dauer: 49 / 24 },
};
const axt = WAFFEN.axt;
const schlaege = [...axt.leicht, axt.schwer, axt.lauf];
pruefe('Axthieb spielt den neuen Zweihandclip Axt_Hieb (statt Axe_Overhead)', axt.leicht[0].clip === 'Axt_Hieb', axt.leicht[0].clip);
for (const s of schlaege) {
  const v = s.clip ? VOR_D429[s.clip] : undefined;
  pruefe(`${s.name}: Clip ${s.clip} ist ein Axtclip aus D429`, !!v);
  if (!v || !s.hieb) continue;
  pruefe(`${s.name}: Scheitel ${v.scheitel} wie vor D429`, Math.abs(s.hieb.scheitel * 24 - v.scheitel!) < 1e-9, `${s.hieb.scheitel * 24}`);
  pruefe(`${s.name}: Durchzug ${v.durchzug} wie vor D429`, Math.abs(s.hieb.durchzug * 24 - v.durchzug!) < 1e-9, `${s.hieb.durchzug * 24}`);
}

// ---- Dateien lesen
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc: Document = await io.read('public/figuren/held/held-clips.glb');
const modell = (() => {
  const b = readFileSync('public/figuren/kampf/waffen.glb');
  const g = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) as { nodes: { name: string; extras?: Record<string, number> }[] };
  return g.nodes.find(n => n.name === 'Axt');
})();
const GRIFF_LINKS = modell?.extras?.griff_links ?? NaN;
const ENDE = 0.65;    // Stielende auf der Waffenachse (`tests/waffenmodelle.test.ts`)
const KOPF = -0.30;   // Mitte des Kopfs auf der Waffenachse (Spitze −0,35, Höhe an der Schneide 9,5 cm)
pruefe('waffen.glb: Axt trägt den linken Griffpunkt', Number.isFinite(GRIFF_LINKS), JSON.stringify(modell?.extras));

// Skelett als three-Objekte, Clips als three-Spuren — so, wie GLTFLoader sie baut.
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
    else if (pfad === 'scale') spuren.push(new THREE.VectorKeyframeTrack(`${ziel}.scale`, zeit, wert));
  }
  clips.set(a.getName(), new THREE.AnimationClip(a.getName(), -1, spuren));
}
pruefe('held-clips.glb: Axe_Overhead ist durch Axt_Hieb ersetzt', clips.has('Axt_Hieb') && !clips.has('Axe_Overhead'));
for (const [n, v] of Object.entries(VOR_D429)) {
  const c = clips.get(n);
  pruefe(`${n}: Clipdauer ${(v.dauer).toFixed(3)} s wie vor D429${v.ersetzt ? ` (${v.ersetzt})` : ''}`, !!c && Math.abs(c.duration - v.dauer) < 1e-3, `${c?.duration}`);
}

const handR = objekte.get('hand_r')!, handL = objekte.get('hand_l')!;
const waffe = new THREE.Group();
handR.add(waffe); legeAnHeldHand(waffe);
const mixer = new THREE.AnimationMixer(wurzel);

interface Bild { kopf: THREE.Vector3; schneide: THREE.Vector3; achse: THREE.Vector3; t: number; quer: number; entlang: number }
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function stelle(clip: THREE.AnimationClip, bild: number): Bild {
  mixer.stopAllAction();
  const a = mixer.clipAction(clip);
  a.reset().play(); a.timeScale = 0; a.time = Math.min(bild / 24, clip.duration); mixer.update(0);
  wurzel.updateMatrixWorld(true);
  const t = gleiteAmStiel(waffe, handR, handL, GRIFF_LINKS);
  waffe.updateMatrixWorld(true);
  const r = waffe.worldToLocal(handR.getWorldPosition(_a)).clone(), l = waffe.worldToLocal(handL.getWorldPosition(_b)).clone();
  return {
    kopf: waffe.localToWorld(new THREE.Vector3(0, KOPF, 0)),
    schneide: new THREE.Vector3(-1, 0, 0).transformDirection(waffe.matrixWorld),
    achse: new THREE.Vector3(0, -1, 0).transformDirection(waffe.matrixWorld),
    t, quer: Math.hypot(l.x - r.x, l.z - r.z), entlang: l.y - r.y,
  };
}
/** Winkel zwischen Schneide und Bahn des Kopfs, quer zum Stiel. */
function schneidenWinkel(von: Bild, nach: Bild, bei: Bild): number {
  const bahn = nach.kopf.clone().sub(von.kopf);
  bahn.addScaledVector(bei.achse, -bahn.dot(bei.achse));
  return THREE.MathUtils.radToDeg(bahn.angleTo(bei.schneide));
}

// ---- gleiteAmStiel für sich: linke Hand weg vom Stiel → nichts verschoben.
{
  const c = clips.get('Roll') ?? clips.get('Idle')!;
  const b = stelle(c, 6);
  pruefe(`gleiteAmStiel: ohne linke Hand am Stiel (${c.name}) bleibt die Waffe an der rechten (quer ${(b.quer * 100).toFixed(0)} cm)`,
    b.quer < GLEITEN.los || b.t === 0, `t ${b.t}`);
}

// ---- 2./3. je Schlag
const befund: string[] = [];
for (const s of schlaege) {
  const c = s.clip ? clips.get(s.clip) : undefined;
  if (!c || !s.hieb) continue;
  const S = Math.round(s.hieb.scheitel * 24), D = Math.round(s.hieb.durchzug * 24);
  const bilder = new Map<number, Bild>();
  const bei = (f: number) => { if (!bilder.has(f)) bilder.set(f, stelle(c, f)); return bilder.get(f)!; };
  const rechtsVomEnde = (b: Bild) => b.entlang + (ENDE - GRIFF_LINKS);   // Abstand rechte Hand – Stielende, m
  // linke Hand am Stiel über das ganze Aktivfenster
  let quer = 0;
  for (let f = S; f <= D; f++) quer = Math.max(quer, bei(f).quer);
  if (process.env.SPUR) for (let f = 1; f <= Math.round(c.duration * 24); f++) {
    const b = bei(f);
    console.log(`    ${c.name} ${f}: entlang ${b.entlang.toFixed(3)} quer ${b.quer.toFixed(3)} t ${b.t.toFixed(3)}`);
  }
  pruefe(`${c.name}: linke Hand am Stiel von Scheitel bis Durchzug (quer ≤ 3,5 cm)`, quer <= 0.035, `${(quer * 100).toFixed(1)} cm`);
  pruefe(`${c.name}: linke Hand hält das Stielende (gefasst im Scheitel und im Durchzug)`,
    bei(S).entlang > GLEITEN.faeuste && bei(D).entlang > GLEITEN.faeuste && bei(S).entlang <= GRIFF_LINKS + 0.01);
  // rechte Hand gleitet: im Scheitel vorn, im Durchzug am Ende bei der linken
  const rS = rechtsVomEnde(bei(S)), rD = rechtsVomEnde(bei(D));
  pruefe(`${c.name}: rechte Hand im Scheitel vorn am Stiel (${(rS * 100).toFixed(0)} cm vom Ende ≥ 40)`, rS >= 0.4);
  pruefe(`${c.name}: im Durchzug beide Hände am Ende (rechte ${(rD * 100).toFixed(0)} cm vom Ende ≤ 16)`, rD <= 0.16);
  // Schneide führt
  const wS = schneidenWinkel(bei(S), bei(S + 1), bei(S)), wD = schneidenWinkel(bei(D - 1), bei(D), bei(D));
  pruefe(`${c.name}: Schneide im Scheitel ${wS.toFixed(0)}° neben der Bahn (≤ 20°)`, wS <= 20);
  pruefe(`${c.name}: Schneide im Durchzug ${wD.toFixed(0)}° neben der Bahn (≤ 20°)`, wD <= 20);
  let groesster = 0, wo = S;
  for (let f = S + 1; f < D; f++) { const w = schneidenWinkel(bei(f - 1), bei(f + 1), bei(f)); if (w > groesster) { groesster = w; wo = f; } }
  pruefe(`${c.name}: nie der Nacken zuerst im Aktivfenster (${groesster.toFixed(0)}° bei Bild ${wo} < 90°)`, groesster < 90);
  befund.push(`${c.name} ${S}/${D}: Schneide ${wS.toFixed(0)}°/${wD.toFixed(0)}° (dazwischen bis ${groesster.toFixed(0)}°), rechte Hand ${(rS * 100).toFixed(0)} → ${(rD * 100).toFixed(0)} cm vom Ende, links quer ≤ ${(quer * 100).toFixed(1)} cm`);
}
// Block und Hut: linke Hand am Stielende
for (const [n, f] of [['Axt_Stand', 1], ['Axt_Stand', 25], ['Axt_Block', 8]] as const) {
  const b = stelle(clips.get(n)!, f);
  pruefe(`${n} Bild ${f}: beide Hände am Stiel (quer ${(b.quer * 100).toFixed(1)} cm ≤ 3,5)`, b.quer <= 0.035 && b.entlang > GLEITEN.faeuste);
}
console.log(`  ${befund.join('\n  ')}`);
console.log(`\nAxtgriff — ${schlaege.length} Schläge`);
console.log(`${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
