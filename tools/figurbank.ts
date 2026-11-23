/**
 * BRACHLAND — Kosten der Bewegungs-Laufzeit je Bild (D457), Messung, nicht im Gate: `npx tsx tools/figurbank.ts`.
 * Ein Skelett mit 63 Knochen wie die Hauptfigur, ohne Renderer: Trägheit dauernd im Abklingen, Drehkette, Blick,
 * Atem, Füsse mit IK und Neigung. Ziel < 0,3 ms je Bild für die Spielfigur.
 */
import * as THREE from 'three';
import { PosenTraegheit, Koerperfein, sammleKnochen } from '../src/figur/laufzeit.js';
import { RIG_MENSCH } from '../src/figur/ebenen.js';

const wurzel = new THREE.Group();
const k = (name: string, eltern: THREE.Object3D, y: number, x = 0) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, 0); eltern.add(b); return b; };
const root = k('root', wurzel, 0), pelvis = k('pelvis', root, 0.95);
const s1 = k('spine_01', pelvis, 0.1), s2 = k('spine_02', s1, 0.15), s3 = k('spine_03', s2, 0.15), hals = k('neck_01', s3, 0.15); k('Head', hals, 0.1);
for (const [seite, x] of [['l', -0.1], ['r', 0.1]] as const) {
  const o = k(`thigh_${seite}`, pelvis, -0.05, x), u = k(`calf_${seite}`, o, -0.42), f = k(`foot_${seite}`, u, -0.4); k(`ball_${seite}`, f, -0.05);
  const c = k(`clavicle_${seite}`, s3, 0.1, x), oa = k(`upperarm_${seite}`, c, 0, x), ua = k(`lowerarm_${seite}`, oa, -0.28), h = k(`hand_${seite}`, ua, -0.26);
  for (let i = 0; i < 20; i++) k(`finger_${seite}_${i}`, h, -0.03);
}
const gruppe = new THREE.Group(); gruppe.add(wurzel);
const knochen = sammleKnochen(wurzel);
const tr = new PosenTraegheit(knochen), fein = new Koerperfein(wurzel, RIG_MENSCH, [0.08, 0.08]);
const hoehe = (x: number, z: number) => 0.2 * x + 0.05 * Math.sin(z);
const e = { gier: 0, tempo: 4.2, rennen: 8.5, straff: 0, fokus: { x: 3, y: 1.2, z: -4 }, steht: false, hoeheAn: hoehe, fuesse: true, halten: true, staerke: 1, weite: 1.4 };
const q = new THREE.Quaternion(), achse = new THREE.Vector3(1, 0, 0);
const runden = 20000, dt = 1 / 60;
let t0 = performance.now(), summe = 0;
for (let r = 0; r < runden; r++) {
  // „Mixer“: jede Pose neu schreiben (wie ein laufender Clip), alle 12 Bilder ein Wechsel.
  for (let i = 0; i < knochen.length; i++) knochen[i].quaternion.copy(q.setFromAxisAngle(achse, 0.2 * Math.sin(r * 0.1 + i)));
  const a = performance.now();
  if (r % 12 === 0) tr.wechsel(0.2);
  tr.nachMixer(dt);
  e.gier = r * 0.01;
  const lage = fein.schritt(dt, e);
  gruppe.rotation.y = lage.huefte;
  fein.knochen(dt, e);
  tr.ende();
  summe += performance.now() - a;
}
console.log(`${knochen.length} Knochen, ${runden} Bilder: ${(summe / runden * 1000).toFixed(1)} µs je Bild (Trägheit dauernd im Abklingen, Drehkette, Blick, Atem, Füsse mit IK und Neigung); gesamt ${((performance.now() - t0) / runden * 1000).toFixed(1)} µs mit Posenschreiben`);
