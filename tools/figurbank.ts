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

// ---- D458: sechs Gegner gleichzeitig — vier Tiere (echte Skelette aus `public/creatures/kampf/`) und zwei Menschen
// (Skelett aus `held-clips.glb`). Je Bild und Gegner: Clip im Mixer, Trägheit (alle 12 Bilder ein Wechsel),
// Drehkette, Blick, Atem, Trefferfeder, Ansage als Zusatz, Füsse am Hang — Tiere mit Rumpflage je Beinpaar.
{
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('meshoptimizer');
  const { readFileSync } = await import('node:fs');
  const { fussKnoten, messeGang } = await import('../src/figur/laufzeit.js');
  const { RIG_VIERBEINER } = await import('../src/figur/vierbeiner.js');
  const { GEGNERBILD, ansageProfil } = await import('../src/figur/gegnerwerte.js');
  const { ansagePose, neuerZusatz } = await import('../src/figur/ansage.js');
  (globalThis as unknown as { self: unknown }).self = globalThis;
  const lade = async (f: string) => {
    const b = readFileSync(f);
    const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
    return await new Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }>((ok, err) =>
      l.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, '', g => ok(g as never), err));
  };
  const vw = GEGNERBILD.vierbeiner;
  const hang = (x: number, z: number) => 0.25 * x - 0.2 * z + 0.05 * Math.sin(z * 2);
  type Eingabe = Parameters<Koerperfein['schritt']>[1];
  const gegner = [] as { name: string; mixer: THREE.AnimationMixer; tr: PosenTraegheit; fein: Koerperfein; leib: THREE.Group; e: Eingabe; profil: ReturnType<typeof ansageProfil>; knochen: number }[];
  for (const [datei, art, mensch] of [['creatures/kampf/k7-wolf', 'wolf', false], ['creatures/kampf/k7-wolf', 'wolf', false], ['creatures/kampf/spuerfuchs', 'fuchs', false],
    ['creatures/kampf/grathorn', 'grathorn', false], ['figuren/held/held-clips', 'wegelagerer', true], ['figuren/held/held-clips', 'axtmann', true]] as const) {
    const g = await lade(`public/${datei}.glb`);
    const gr = new THREE.Group(), leib = new THREE.Group(); gr.add(leib); leib.add(g.scene); gr.position.set(gegner.length * 2, 0, 0);
    const plan = mensch ? RIG_MENSCH : RIG_VIERBEINER;
    const fuesse = fussKnoten(g.scene, plan) as THREE.Object3D[];
    const walk = g.animations.find(c => c.name === 'Walk')!;
    const mg = messeGang(g.scene, walk, fuesse, 0.04);
    const fein = mensch ? new Koerperfein(g.scene, plan, mg.tief) : new Koerperfein(g.scene, plan, fuesse.map(() => 0), { drehen: vw.drehen, vier: vw });
    const mixer = new THREE.AnimationMixer(g.scene);
    mixer.clipAction(walk).play();
    // `held-clips.glb` trägt das Skelett ohne Haut — seine Knoten sind dort keine `Bone`; für die Messung zählen alle.
    let kn = sammleKnochen(g.scene);
    if (!kn.length) g.scene.traverse(o => { if (o !== g.scene && o.name) kn.push(o); });
    gegner.push({ name: art, mixer, tr: new PosenTraegheit(kn), fein, leib, profil: ansageProfil(art), knochen: kn.length,
      e: { gier: 0, tempo: 2, rennen: 4, straff: 0, fokus: { x: 0, y: 1.2, z: -6 }, steht: false, hoeheAn: hang, fuesse: true, halten: true, staerke: 1, weite: 1, zusatz: neuerZusatz() } });
  }
  const n = 4000;
  let nurMixer = 0, laufzeit = 0;
  for (let r = 0; r < n; r++) {
    for (const g of gegner) {
      let a = performance.now();
      g.mixer.update(dt);
      nurMixer += performance.now() - a;
      a = performance.now();
      if (r % 12 === 0) g.tr.wechsel(0.2);
      g.tr.nachMixer(dt);
      ansagePose(g.profil, 'vorlauf', (r % 60) / 60 * 0.5, { vorlauf: 0.5, aktiv: 0.1 }, 'rechts', 1, g.e.zusatz);
      if (r % 90 === 0) g.fein.stossGrad(0.6, 0.8, 10);
      g.e.gier = Math.sin(r * 0.01) * 0.8;
      g.leib.rotation.y = g.fein.schritt(dt, g.e).huefte;
      g.fein.knochen(dt, g.e);
      g.tr.ende();
      laufzeit += performance.now() - a;
    }
  }
  console.log(`\nD458 — ${gegner.length} Gegner gleichzeitig (${gegner.map(g => `${g.name} ${g.knochen}`).join(', ')} Knochen), ${n} Bilder:`);
  console.log(`  Laufzeit der Bewegung: ${(laufzeit / n * 1000).toFixed(0)} µs je Bild für alle ${gegner.length} (${(laufzeit / n / gegner.length * 1000).toFixed(0)} µs je Gegner)`);
  console.log(`  zum Vergleich der Mixer allein (ein Clip je Gegner): ${(nurMixer / n * 1000).toFixed(0)} µs je Bild`);
}
