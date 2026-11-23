/**
 * BRACHLAND — Bewegung der Tiere und Gegner (D458), ohne Renderer: was über ihren Clips geschieht.
 *
 *  1. **Rigplan Vierbeiner** (`figur/vierbeiner.ts`): Jeder Knochen des Plans steht in jeder Kampftier-Datei
 *     (`public/creatures/kampf/*.glb`), vier Läufe in zwei Paaren, Halskette von unten nach oben.
 *  2. **Rumpf je Beinpaar:** Schulter über den Vorderläufen, Becken über den Hinterläufen — die Gerade geht durch
 *     beide; am Hang nickt der Rumpf mit dem Hang, statt um den tiefsten Fuss aller Beine zu sinken (der offene
 *     Punkt aus D457). Am echten Wolfsskelett: Sohlen am Boden bei 20° bergauf und am Querhang.
 *  3. **Gang ans Tempo:** Gangart und Rate aus dem gemessenen Tempo, kein Gleiten im Bereich der Rate.
 *  4. **Ansage an die Phase gebunden** (`figur/ansage.ts`): nur in Vorlauf und Aktiv, stetig am Wechsel, Endwerte
 *     von Keiler, Grathorn, Wolf wie D169–D171, Seite der Linie, jeder Gegner hat ein Profil; die Clipzuordnung der
 *     Menschen (A-51 (1)) trägt dieselben Scheitel und Durchzüge wie zuvor.
 *  5. **Taumeln, Schütteln, Sturz, Wende.**
 *  6. **Landezustand** (`figur/landung.ts`): weich bis zur schadlosen Höhe (D412), hart darüber, Rolle (D413).
 */
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { beinRest, hangLage, paarHoehe, RIG_VIERBEINER, rumpfHoeheBei, rumpfLage, seitLage, tierGang } from '../src/figur/vierbeiner.js';
import { ansagePose, ansageSpannung, schuettelHz, schuettelPose, seitenZeichen, sturzVerlauf, taumelHz, taumelPose, wendeSchritt } from '../src/figur/ansage.js';
import { ansageProfil, GEGNERBILD } from '../src/figur/gegnerwerte.js';
import { landeArt, landeClip, landungLaeuft, meldeLandung, neueLandung } from '../src/figur/landung.js';
import { beckenSenkung } from '../src/figur/fussboden.js';
import { neueTrefferantwort, stosseGrad, trefferSchritt } from '../src/figur/trefferantwort.js';
import { uebergangsDauer } from '../src/figur/kette.js';
import { Koerperfein, PosenTraegheit, fussKnoten, messeGang, sammleKnochen, type FeinEingabe } from '../src/figur/laufzeit.js';
import { FIGUR, GRAD } from '../src/figur/werte.js';
import { Figurgegner, Figurlaufzeit } from '../src/data/schema.js';
import { BEWEGUNG } from '../src/spieler/tempo.js';
import { fallhoeheAus, fallschaden } from '../src/spieler/bewegung.js';
import CLIPMARKEN from '../content/clipmarken.json';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}
const nah = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e;
const vw = GEGNERBILD.vierbeiner;

pruefe('Daten gültig (Schema Figurgegner)', Figurgegner.safeParse(GEGNERBILD).success);
pruefe('Daten gültig (Schema Figurlaufzeit mit landung)', Figurlaufzeit.safeParse(FIGUR).success);

// ---- 1. Rigplan Vierbeiner -------------------------------------------------------------------------------------
const TIERE = ['k7-wolf', 'grathorn', 'spuerfuchs', 'nebelgams'];
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const plan = RIG_VIERBEINER;
  pruefe('vier Läufe, zwei vorn, zwei hinten', plan.beine.length === 4 && plan.beine.filter(b => b.paar === 'vorn').length === 2 && plan.beine.filter(b => b.paar === 'hinten').length === 2);
  pruefe('jeder Lauf endet an einem Sohlenpunkt (kein Fussknochen in der Datei)', plan.beine.every(b => b.spitze && b.fuss === `${b.unter}_Sohle`));
  for (const tier of TIERE) {
    const doc = await io.read(`public/creatures/kampf/${tier}.glb`);
    // three.js streicht den Punkt aus Knotennamen (`FrontUpperLeg.L` → `FrontUpperLegL`).
    const eltern = new Map<string, string | null>();
    for (const skin of doc.getRoot().listSkins()) for (const j of skin.listJoints()) eltern.set(j.getName().replace(/\./g, ''), j.getParentNode()?.getName().replace(/\./g, '') ?? null);
    const knochen = [plan.becken, ...plan.wirbel, ...(plan.halsKette ?? [plan.hals]), plan.kopf, ...plan.beine.flatMap(b => [b.ober, b.unter])];
    const fehlt = knochen.filter(k => !eltern.has(k));
    pruefe(`${tier}: jeder Knochen des Plans steht in der Datei`, fehlt.length === 0, fehlt.join(', '));
    pruefe(`${tier}: Unterlauf hängt am Oberlauf`, plan.beine.every(b => eltern.get(b.unter) === b.ober));
    const kette = [...plan.wirbel, ...(plan.halsKette ?? []), plan.kopf];
    // Zwischen Hals und Kopf dürfen Hilfsknochen liegen; jeder ist Nachfahre des vorigen.
    const nachfahre = (kind: string, ahn: string) => { let k: string | null | undefined = kind; for (let i = 0; k && i < 40; i++) { if (k === ahn) return true; k = eltern.get(k); } return false; };
    pruefe(`${tier}: Wirbel → Hals → Kopf in einer Kette`, kette.every((k, i) => i === 0 || nachfahre(k, kette[i - 1])));
    const clips = doc.getRoot().listAnimations().map(a => a.getName());
    pruefe(`${tier}: Walk, Gallop, Idle, Death, Trefferreaktionen vorhanden`, ['Walk', 'Gallop', 'Idle', 'Death', 'Idle_HitReact_Left', 'Idle_HitReact_Right'].every(c => clips.includes(c)), clips.join(', '));
  }
}

// ---- 2. Rumpf je Beinpaar --------------------------------------------------------------------------------------
{
  // Gürtel bei z = −0,55 (vorn) und +0,35 (hinten); Hang steigt nach vorn mit Winkel a.
  const zV = -0.55, zH = 0.35;
  for (const grad of [-20, -8, 0, 5, 15, 25]) {
    const t = Math.tan(grad * GRAD), vorn = -zV * t, hinten = -zH * t;
    const l = rumpfLage(vorn, hinten, zV, zH, vw);
    pruefe(`Hang ${grad}°: Rumpf nickt mit dem Hang`, nah(l.nick, grad * GRAD, 1e-9), `${(l.nick / GRAD).toFixed(2)}°`);
    pruefe(`Hang ${grad}°: Gerade geht durch Schulter und Becken`, nah(rumpfHoeheBei(l, zV), vorn, 1e-9) && nah(rumpfHoeheBei(l, zH), hinten, 1e-9));
    pruefe(`Hang ${grad}°: kein Lauf muss ausgleichen`, nah(beinRest(vorn, zV, l), 0, 1e-9) && nah(beinRest(hinten, zH, l), 0, 1e-9));
  }
  // Der offene Punkt aus D457: Am Hang bergauf steht die Vorhand HÖHER — „tiefster Fuss aller Beine“ senkte alles.
  const t = Math.tan(15 * GRAD), vorn = 0.55 * t, hinten = -0.35 * t, l = rumpfLage(vorn, hinten, zV, zH, vw);
  pruefe('bergauf: Schulter über der Mitte, Becken darunter (nicht alles auf den tiefsten Fuss)',
    rumpfHoeheBei(l, zV) > 0.1 && rumpfHoeheBei(l, zH) < -0.05 && beckenSenkung([vorn, vorn, hinten, hinten], 0.35) < 0 && rumpfHoeheBei(l, zV) > beckenSenkung([vorn, vorn, hinten, hinten], 0.35));
  // Steiler als die Grenze: Nicken bleibt stehen, der Rumpf folgt dem tieferen Paar, das andere beugt sich.
  const steil = Math.tan(40 * GRAD), l2 = rumpfLage(0.55 * steil, -0.35 * steil, zV, zH, vw);
  pruefe('über der Grenze: Nicken geklemmt', nah(l2.nick, vw.nickMaxGrad * GRAD, 1e-9));
  pruefe('über der Grenze: kein Lauf muss sich strecken (Rest ≥ 0), einer beugt sich',
    beinRest(0.55 * steil, zV, l2) >= -1e-9 && beinRest(-0.35 * steil, zH, l2) >= -1e-9 && beinRest(0.55 * steil, zV, l2) + beinRest(-0.35 * steil, zH, l2) > 0.05);
  pruefe('Hub geklemmt', Math.abs(rumpfLage(3, 3, zV, zH, vw).hub) <= vw.hubMax + 1e-12);
  pruefe('Paar: Mittel, aber nie mehr als die Reserve über dem tieferen Lauf',
    nah(paarHoehe([0.01, -0.01], 0.02), 0) && nah(paarHoehe([0.2, -0.2], 0.02), -0.18) && nah(paarHoehe([0.3], 0.02), 0.3) && paarHoehe([], 0.02) === 0);
  pruefe('Querhang: rechts höher → nach links geneigt (positiv), Anteil und Grenze',
    seitLage(-0.05, 0.05, 0.3, vw) > 0 && seitLage(0.05, -0.05, 0.3, vw) < 0
    && nah(seitLage(-0.01, 0.01, 0.3, vw), Math.atan2(0.02, 0.3) * vw.rollAnteil, 1e-12)
    && nah(seitLage(-1, 1, 0.3, vw), vw.rollMaxGrad * GRAD, 1e-12));
  // Starrer Leib (Keiler): liegt auf der Geraden Bug–Heck.
  const ebene = (a: number, b: number) => (x: number, z: number) => a * x + b * z + 3;
  const h1 = hangLage(ebene(0, -Math.tan(12 * GRAD)), 5, 7, 0, 0.55, 0.35, vw);
  pruefe('starrer Leib bergauf (Blick −Z): nickt 12°, kein Hub, kein Rollen', nah(h1.nick, 12 * GRAD, 1e-9) && nah(h1.hub, 0, 1e-9) && nah(h1.roll, 0, 1e-9));
  const h2 = hangLage(ebene(0, -Math.tan(12 * GRAD)), 5, 7, Math.PI, 0.55, 0.35, vw);
  pruefe('starrer Leib bergab (umgedreht): nickt −12°', nah(h2.nick, -12 * GRAD, 1e-9));
  const h3 = hangLage(ebene(Math.tan(10 * GRAD), 0), 5, 7, 0, 0.55, 0.35, vw);
  pruefe('starrer Leib am Querhang (rechts höher): rollt nach links, voll', nah(h3.roll, 10 * GRAD, 1e-9) && nah(h3.nick, 0, 1e-9));
  const h4 = hangLage(ebene(0, -Math.tan(12 * GRAD)), 5, 7, Math.PI / 2, 0.55, 0.35, vw);
  pruefe('starrer Leib quer zum Hang (Blick −X, Hang steigt nach −Z = rechts): rollt, nickt nicht', nah(h4.nick, 0, 1e-9) && nah(h4.roll, 12 * GRAD, 1e-9));
}

// Am echten Skelett (three.js ohne Renderer): Wolf am Hang.
const gemessen: string[] = [];
{
  (globalThis as unknown as { self: unknown }).self = globalThis;
  const lade = async (f: string) => {
    const b = readFileSync(f);
    const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
    return await new Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }>((ok, err) =>
      l.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, '', g => ok(g as never), err));
  };
  const v = new THREE.Vector3();
  for (const tier of TIERE) {
    const g = await lade(`public/creatures/kampf/${tier}.glb`);
    const gruppe = new THREE.Group(), leib = new THREE.Group(); gruppe.add(leib); leib.add(g.scene);
    const fuesse = fussKnoten(g.scene, RIG_VIERBEINER) as THREE.Object3D[];
    pruefe(`${tier}: vier Sohlenpunkte, in der Ruhe am Boden`, fuesse.length === 4 && fuesse.every(f => !!f && Math.abs(f.getWorldPosition(v).y) < 1e-3));
    const walk = g.animations.find(c => c.name === 'Walk')!, gal = g.animations.find(c => c.name === 'Gallop')!;
    const mw = messeGang(g.scene, walk, fuesse, vw.gang.standHoehe), mg = messeGang(g.scene, gal, fuesse, vw.gang.standHoehe);
    pruefe(`${tier}: Schritt und Galopp messbar, Galopp schneller`, mw.tempo !== null && mg.tempo !== null && mw.tempo > 0.5 && mg.tempo > mw.tempo * 2, `${mw.tempo} / ${mg.tempo}`);
    gemessen.push(`${tier} Schritt ${mw.tempo?.toFixed(2)} / Galopp ${mg.tempo?.toFixed(2)} m/s`);
    const fein = new Koerperfein(g.scene, RIG_VIERBEINER, fuesse.map(() => 0), { drehen: vw.drehen, vier: vw });
    const tr = new PosenTraegheit(sammleKnochen(g.scene));
    const mixer = new THREE.AnimationMixer(g.scene);
    mixer.clipAction(g.animations.find(c => c.name === 'Idle')!).play();
    const stelle = (hoehe: (x: number, z: number) => number, zusatz?: FeinEingabe['zusatz']) => {
      const e: FeinEingabe = { gier: 0, tempo: 0, rennen: 4, straff: 0, fokus: null, steht: true, hoeheAn: hoehe, fuesse: true, halten: false, staerke: 1, weite: 1, zusatz };
      fein.ruhe(); mixer.setTime(0); // die Trägheit bleibt: sie kennt die rohe Pose der Knochen, die der Mixer nicht neu schreibt
      for (let i = 0; i < 90; i++) {
        mixer.update(1 / 60); tr.nachMixer(1 / 60);
        leib.rotation.y = fein.schritt(1 / 60, e).huefte;
        fein.knochen(1 / 60, e); tr.ende();
      }
      gruppe.updateMatrixWorld(true);
      return fuesse.map(f => { f.getWorldPosition(v); return { x: v.x, z: v.z, ueber: v.y - hoehe(v.x, v.z) }; });
    };
    const eben = stelle(() => 0);
    pruefe(`${tier}: eben bleibt der Rumpf, wie der Clip ihn stellt`, Math.abs(fein.rumpf.nick) < 1e-6 && Math.abs(fein.rumpf.hub) < 1e-6);
    const auf = stelle((_x, z) => -z * Math.tan(20 * GRAD));
    pruefe(`${tier}: 20° bergauf — Rumpf nickt 17…23°`, fein.rumpf.nick > 17 * GRAD && fein.rumpf.nick < 23 * GRAD, `${(fein.rumpf.nick / GRAD).toFixed(1)}°`);
    pruefe(`${tier}: 20° bergauf — alle Sohlen am Boden (±2 cm)`, auf.every(f => Math.abs(f.ueber) < 0.02), auf.map(f => (f.ueber * 100).toFixed(1)).join(' '));
    pruefe(`${tier}: 20° bergauf — Läufe bleiben, wo der Clip sie hinsetzt (±1 cm waagerecht)`, auf.every((f, i) => Math.hypot(f.x - eben[i].x, f.z - eben[i].z) < 0.01), auf.map((f, i) => (Math.hypot(f.x - eben[i].x, f.z - eben[i].z) * 100).toFixed(1)).join(' '));
    const quer = stelle((x) => x * Math.tan(12 * GRAD));
    pruefe(`${tier}: 12° Querhang — Rumpf rollt nur einen Teil, Sohlen am Boden (±2,5 cm)`,
      fein.rumpf.roll > 2 * GRAD && fein.rumpf.roll <= vw.rollMaxGrad * GRAD + 1e-9 && quer.every(f => Math.abs(f.ueber) < 0.025), quer.map(f => (f.ueber * 100).toFixed(1)).join(' '));
    // Ansage: Gewicht zurück — der Rumpf wandert, die Läufe stehen.
    const p = ansageProfil('wolf');
    const becken = g.scene.getObjectByName('Back')!;
    stelle(() => 0); const z0 = becken.getWorldPosition(v).z;
    const zu = ansagePose(p, 'vorlauf', 0.5, { vorlauf: 0.5, aktiv: 0.1 }, undefined);
    const gespannt = stelle(() => 0, zu); const z1 = becken.getWorldPosition(v).z;
    // Der Rumpf nickt um den Punkt am Boden: das Becken (Höhe h) wandert um zurueck + h·sin(nick).
    const soll = p.zurueck + becken.getWorldPosition(v).y * Math.sin(p.nickGrad * GRAD);
    pruefe(`${tier}: Ansage — Becken wandert zurück (${(soll * 100).toFixed(0)} cm ± 3), Läufe bleiben stehen (±2 cm)`,
      Math.abs(z1 - z0 - soll) < 0.03 && gespannt.every((f, i) => Math.hypot(f.x - eben[i].x, f.z - eben[i].z) < 0.02 && Math.abs(f.ueber) < 0.02),
      `Becken ${((z1 - z0) * 100).toFixed(1)} cm; Läufe ${gespannt.map((f, i) => (Math.hypot(f.x - eben[i].x, f.z - eben[i].z) * 100).toFixed(1)).join(' ')}; Höhe ${gespannt.map(f => (f.ueber * 100).toFixed(1)).join(' ')}`);
  }
}

// ---- 3. Gang ans Tempo -----------------------------------------------------------------------------------------
{
  const schritt = { tempo: 1.39, dauer: 1.04 }, galopp = { tempo: 4.38, dauer: 0.54 }, gw = vw.gang;
  const schwelle = Math.sqrt(1.39 * 4.38);
  pruefe('Schwelle = geometrisches Mittel der gemessenen Tempi', nah(tierGang(1, schritt, galopp, false, gw).schwelle, schwelle, 1e-12));
  pruefe('unter der Schwelle Schritt, darüber Galopp', !tierGang(schwelle * 0.8, schritt, galopp, false, gw).galopp && tierGang(schwelle * 1.2, schritt, galopp, false, gw).galopp);
  pruefe('Hysterese: an der Schwelle bleibt die Gangart, wie sie ist',
    !tierGang(schwelle * 1.05, schritt, galopp, false, gw).galopp && tierGang(schwelle * 0.95, schritt, galopp, true, gw).galopp);
  let gleitet = 0;
  for (let v = 0.8; v <= 6.5; v += 0.1) {
    const g = tierGang(v, schritt, galopp, v > schwelle, gw);
    if (Math.abs(g.gleiten) > 1e-9) gleitet++;
    if (!nah(g.rate * (g.galopp ? galopp : schritt).tempo + g.gleiten * v, v, 1e-9)) gleitet += 100;
  }
  pruefe('0,8…6,5 m/s: Rate × Cliptempo = Tempo, kein Gleiten', gleitet === 0, String(gleitet));
  const zu = tierGang(12, schritt, galopp, true, gw);
  pruefe('zu schnell für den Clip: Rate schlägt an, Gleiten wird genannt statt versteckt', nah(zu.rate, gw.rateMax) && zu.gleiten > 0.3);
  pruefe('ohne Galopp-Clip bleibt es der Schritt', !tierGang(9, schritt, null, false, gw).galopp);
  pruefe('rückwärts/kein Tempo: Rate an der unteren Grenze, nie negativ', tierGang(0, schritt, galopp, false, gw).rate === gw.rateMin);
}

// ---- 4. Ansage an die Phase gebunden ---------------------------------------------------------------------------
{
  const gegner = readdirSync('content/gegner').filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
  pruefe('jeder Gegner hat ein Ansageprofil', gegner.every(id => !!GEGNERBILD.ansage.profile[id]), gegner.filter(id => !GEGNERBILD.ansage.profile[id]).join(', '));
  for (const id of gegner) {
    const d = JSON.parse(readFileSync(`content/gegner/${id}.json`, 'utf8')) as { schlag: { vorlauf: number; aktiv: number; erholung: number }; kette?: { vorlauf: number; aktiv: number }[] };
    const p = ansageProfil(id);
    for (const s of [d.schlag, ...(d.kette ?? [])]) {
      let monoton = true, vor = -1;
      for (let i = 0; i <= 50; i++) { const k = ansageSpannung('vorlauf', (s.vorlauf * i) / 50, s.vorlauf, s.aktiv, p.anstieg); if (k < vor - 1e-12) monoton = false; vor = k; }
      pruefe(`${id}: Spannung steigt im Vorlauf (${s.vorlauf} s) monoton von 0 auf 1`, monoton && ansageSpannung('vorlauf', 0, s.vorlauf, s.aktiv, p.anstieg) === 0 && nah(vor, 1));
      pruefe(`${id}: steht nach ${p.anstieg} des Vorlaufs und hält bis zum Schlag`, nah(ansageSpannung('vorlauf', s.vorlauf * p.anstieg, s.vorlauf, s.aktiv, p.anstieg), 1) && nah(ansageSpannung('vorlauf', s.vorlauf * 0.99, s.vorlauf, s.aktiv, p.anstieg), 1));
      pruefe(`${id}: stetig am Wechsel Vorlauf → Aktiv, entladen am Ende des Aktivs`,
        nah(ansageSpannung('aktiv', 0, s.vorlauf, s.aktiv, p.anstieg), 1) && nah(ansageSpannung('aktiv', s.aktiv, s.vorlauf, s.aktiv, p.anstieg), 0));
    }
    for (const phase of ['bereit', 'erholung', 'betaeubt', 'gefallen', 'zucken', 'block', 'rolle']) {
      const a = ansagePose(p, phase, 0.2, d.schlag, 'rechts');
      if (a.spannung !== 0 || a.rumpfZ !== 0 || a.kopfNick !== 0 || a.rumpfGier !== 0) { pruefe(`${id}: keine Ansage in Phase ${phase}`, false); }
    }
    bestanden++;
    // Dieselbe Regelzeit → dieselbe Pose (kein eigener Zeitgeber).
    const a1 = { ...ansagePose(p, 'vorlauf', d.schlag.vorlauf * 0.4, d.schlag, 'links') }, a2 = ansagePose(p, 'vorlauf', d.schlag.vorlauf * 0.4, d.schlag, 'links');
    pruefe(`${id}: Pose hängt nur an Phase und Zeit der Regel`, JSON.stringify(a1) === JSON.stringify(a2));
  }
  // Endwerte der drei von Hand gebauten Ansagen (D169–D171) — die Daten tragen dieselben Zahlen.
  const ende = (id: string, linie?: 'links' | 'rechts' | 'oben' | 'unten') => {
    const p = ansageProfil(id), v = 0.5;
    // Am Ende des Vorlaufs, zu einer Zeit ohne Scharren und Zittern (ganze Perioden gibt es nicht für beide — Hub und Roll getrennt geprüft).
    return ansagePose(p, 'vorlauf', v, { vorlauf: v, aktiv: 0.1 }, linie);
  };
  const k = ende('keiler'), h = ende('grathorn'), w = ende('wolf');
  pruefe('Keiler: 0,30 m zurück, Kopf 0,16 rad runter (D169)', nah(k.rumpfZ, 0.3) && nah(k.rumpfNick, -0.16, 1e-3) && k.rumpfY >= 0 && k.rumpfY <= 0.035 + 1e-9);
  pruefe('Grathorn: steigt 0,32 rad, 0,12 m hoch, 0,25 m zurück (D170)', nah(h.rumpfZ, 0.25) && nah(h.rumpfY, 0.12) && nah(h.rumpfNick, 0.32, 1e-3));
  pruefe('Wolf: duckt 0,10 m, 0,22 m zurück, 0,10 rad vorn runter (D171)', nah(w.rumpfZ, 0.22) && nah(w.rumpfY, -0.1) && nah(w.rumpfNick, -0.1, 1e-3));
  // Seite: `rechts` ist rechts im Bild der Spielerin = die Linke des Angreifers (Gier positiv).
  pruefe('Seitenzeichen: rechts +1, links −1, oben/unten 0', seitenZeichen('rechts') === 1 && seitenZeichen('links') === -1 && seitenZeichen('oben') === 0 && seitenZeichen('unten') === 0 && seitenZeichen(undefined) === 0);
  const wr = ende('wolf', 'rechts'), wl = ende('wolf', 'links');
  pruefe('Wolf: Linie rechts/links dreht Kopf und Schultern auf verschiedene Seiten, gleich weit', wr.kopfGier > 0.2 && nah(wr.kopfGier, -wl.kopfGier) && wr.rumpfGier > 0 && nah(wr.rumpfGier, -wl.rumpfGier));
  const mr = ende('wegelagerer', 'rechts'), ml = ende('wegelagerer', 'links'), mo = ende('wegelagerer', 'oben'), mu = ende('wegelagerer', 'unten');
  pruefe('Mensch: Rumpf dreht ins Ausholen, nach der Seite der Linie', mr.rumpfGier > 0.15 && nah(mr.rumpfGier, -ml.rumpfGier) && mo.rumpfGier === 0);
  pruefe('Mensch: oben hebt den Kopf, unten senkt ihn', mo.kopfNick < mu.kopfNick);
  pruefe('Menschen ohne Rumpfversatz (ihre Clips tragen das Ausholen)', ['wegelagerer', 'speermann', 'axtmann'].every(id => ansageProfil(id).zurueck === 0 && ansageProfil(id).hoch === 0));
  const halb = ansagePose(ansageProfil('wolf'), 'vorlauf', 0.5, { vorlauf: 0.5, aktiv: 0.1 }, undefined, 0.4);
  pruefe('Folgeschlag: kleinere Ansage', nah(halb.rumpfZ, 0.22 * 0.4) && nah(halb.spannung, 0.4));
  // A-51 (1): Nur die Clipzuordnung ändert sich — die neuen Clips tragen dieselben Scheitel/Durchzüge wie die alten.
  const m = (CLIPMARKEN as { clips: Record<string, { scheitel?: number; durchzug?: number } | undefined> }).clips;
  const gleich = (clip: string, s: number, d: number) => m[clip]?.scheitel === s && m[clip]?.durchzug === d;
  pruefe('Wegelagerer: Klinge_Hieb_A/B 6/9, Klinge_Schwer 14/18, Klinge_Stich 9/13 — wie Klinge_U_A/B/C zuvor',
    gleich('Klinge_Hieb_A', 6, 9) && gleich('Klinge_Hieb_B', 6, 9) && gleich('Klinge_Schwer', 14, 18) && gleich('Klinge_Stich', 9, 13));
  const kampfplatz = readFileSync('src/kampf/Kampfplatz.tsx', 'utf8'), szene = readFileSync('src/scenes/RegionsSzene.tsx', 'utf8');
  const spielt = (quelle: string) => /['"]Klinge_U_(A|B|C|Lauf|Block)['"]/.test(quelle);
  pruefe('kein Gegner und keine Deckung spielt mehr einen UAL2-Klingenclip (A-51 (1))', !spielt(kampfplatz) && !spielt(szene));
  pruefe('der Kampfplatz ändert keine Zeit der Regel: liest Vorlauf/Aktiv/Erholung, schreibt sie nie',
    !/\b(s|sch|sl|schlag)\.(vorlauf|aktiv|erholung)\s*[-+*\/]?=[^=]/.test(kampfplatz));
}

// ---- 5. Taumeln, Schütteln, Sturz, Wende -----------------------------------------------------------------------
{
  const tw = GEGNERBILD.taumel;
  pruefe('Taumeln: der Grössere schwankt langsamer (Pendel, f ∝ 1/√h)', taumelHz(1.8, tw) < taumelHz(0.9, tw) && nah(taumelHz(1.8, tw) / taumelHz(0.9, tw), Math.sqrt(0.5), 1e-9));
  pruefe('Taumeln: Mensch unter 1 Hz, vorher 1,43 Hz für alle', taumelHz(1.8, tw) < 1 && taumelHz(1.8, tw) > 0.5);
  let max = 0, rest = 0;
  for (let t = 0; t <= 0.9; t += 0.005) max = Math.max(max, Math.abs(taumelPose(t, 0.9, 0.3, 1.8, tw).roll));
  for (let t = 0.9; t <= 3; t += 0.005) rest = Math.max(rest, Math.abs(taumelPose(t, 0.9, 0.3, 1.8, tw).roll));
  pruefe('Taumeln: Ausschlag höchstens der genannte, klingt bis auf den Rest ab und steht nicht still', max <= 0.3 + 1e-9 && max > 0.15 && nah(rest, 0.3 * tw.rest, 0.01));
  const T = taumelPose(0.3, 0.9, 0.3, 1.8, tw);
  pruefe('Taumeln: Schwerpunkt wandert mit dem Schwanken, die Beine geben nach, der Kopf hängt', Math.sign(T.seit) === Math.sign(T.roll) && T.sinken < 0 && T.kopfNick > 0);
  pruefe('Taumeln: Seitweg bleibt unter dem Hebel × Höhe', Math.abs(T.seit) <= 1.8 * tw.hebel);

  const sw = GEGNERBILD.schuetteln;
  pruefe('Schütteln: schwere Tiere langsamer (Keiler < Wolf < Fuchs)', schuettelHz(100, sw) < schuettelHz(40, sw) && schuettelHz(40, sw) < schuettelHz(7, sw) && nah(schuettelHz(30, sw), sw.hzBei30kg));
  pruefe('Schütteln: nur im Fenster, vorher und nachher still',
    schuettelPose(0, 40, sw).kopfRoll === 0 && schuettelPose(sw.beginn + sw.dauer + 0.01, 40, sw).rumpfRoll === 0 && schuettelPose(sw.beginn + sw.dauer / 2 + 0.03, 40, sw).kopfRoll !== 0);
  pruefe('Schütteln endet, bevor das Tier abgeht (0,9 s, D417)', sw.beginn + sw.dauer <= 0.9);
  let kopfMax = 0, rumpfMax = 0;
  for (let t = 0; t < 1; t += 0.002) { const s = schuettelPose(t, 40, sw); kopfMax = Math.max(kopfMax, Math.abs(s.kopfRoll)); rumpfMax = Math.max(rumpfMax, Math.abs(s.rumpfRoll)); }
  pruefe('Schütteln: der Kopf schlägt weiter aus als der Rumpf', kopfMax > rumpfMax && kopfMax <= sw.kopfGrad * GRAD + 1e-9);

  const st = GEGNERBILD.sturz;
  let mono = true, vor = 0;
  for (let t = 0; t <= st.dauer; t += 0.01) { const s = sturzVerlauf(t, st.dauer, st.prall, st.nach); if (s < vor - 1e-12) mono = false; vor = s; }
  pruefe('Sturz: beschleunigt (Hälfte der Zeit = ein Viertel des Wegs), monoton bis zum Aufsetzen', mono && nah(sturzVerlauf(st.dauer / 2, st.dauer), 0.25) && sturzVerlauf(0, st.dauer) === 0);
  pruefe('Sturz: federt einmal nach und liegt dann genau', sturzVerlauf(st.dauer + st.nach / 2, st.dauer, st.prall, st.nach) < 1 && sturzVerlauf(st.dauer + st.nach, st.dauer, st.prall, st.nach) === 1 && sturzVerlauf(99, st.dauer, st.prall, st.nach) === 1);

  let w = 0, schritte = 0;
  const rate = GEGNERBILD.abgang.wendeGradJeS * GRAD;
  while (w !== Math.PI && schritte < 1000) { const n = wendeSchritt(w, Math.PI, rate, 1 / 60); if (Math.abs(n - w) > rate / 60 + 1e-12) schritte += 1e6; w = n; schritte++; }
  pruefe('Wende: dreht mit begrenzter Rate bis genau ans Ziel (Kehre unter 1 s)', w === Math.PI && schritte > 30 && schritte < 60, String(schritte));
  pruefe('Wende: kürzester Weg über die Naht', wendeSchritt(3.1, -3.1, 1, 0.01) > 3.1 && wendeSchritt(-3.1, 3.1, 1, 0.01) < -3.1);

  // Trefferfeder in Grad (D427 rechnet die Neigung aus dem Impuls).
  const a = neueTrefferantwort();
  stosseGrad(a, 0, 1, 12, FIGUR.treffer);
  let scheitel = 0;
  for (let i = 0; i < 400; i++) scheitel = Math.max(scheitel, trefferSchritt(a, 1 / 240, FIGUR.treffer)[1]);
  pruefe('Trefferfeder: Stoss in Grad erreicht genau diesen Scheitel und klingt aus', nah(scheitel, 12 * GRAD, 12 * GRAD * 0.01) && trefferSchritt(a, 3, FIGUR.treffer)[1] === 0);
}

// ---- 6. Landezustand -------------------------------------------------------------------------------------------
{
  const lw = FIGUR.landung, schadlos = BEWEGUNG.fall.schadlosBis;
  pruefe('ein Absatz ist keine Landung', landeArt(0.2, schadlos, false, lw) === null && landeArt(lw.merklichAb - 0.01, schadlos, false, lw) === null);
  pruefe('der eigene Sprung (1,49 m) landet weich', landeArt(1.49, schadlos, false, lw) === 'weich');
  pruefe('bis zur schadlosen Höhe weich, darüber hart', landeArt(schadlos, schadlos, false, lw) === 'weich' && landeArt(schadlos + 0.05, schadlos, false, lw) === 'hart');
  // Dieselbe Grenze wie der Fallschaden (D412): hart genau dort, wo Schaden beginnt.
  let gleich = true;
  for (let v = 2; v <= 20; v += 0.25) { const h = fallhoeheAus(v), art = landeArt(h, schadlos, false, lw); if (art && (art === 'hart') !== (fallschaden(v) > 0)) gleich = false; }
  pruefe('hart genau dann, wenn der Aufprall Schaden macht (D412)', gleich);
  pruefe('Rolltaste (D413): Rolle statt Hocke — nur bei merklichem Fall', landeArt(6, schadlos, true, lw) === 'rolle' && landeArt(1.5, schadlos, true, lw) === 'rolle' && landeArt(0.2, schadlos, true, lw) === null);
  pruefe('Clips: weich/hart von D456, Rolle bis zu einem eigenen Clip die vorhandene',
    landeClip('weich', lw) === 'Koerper_Landung_Weich' && landeClip('hart', lw) === 'Koerper_Landung_Hart' && landeClip('rolle', lw) === 'Roll');
  const marken = (CLIPMARKEN as { clips: Record<string, unknown> }).clips;
  pruefe('die Landeclips stehen in den Clipmarken von D456', !!marken[lw.clipWeich] && !!marken[lw.clipHart]);
  const l = neueLandung(), nr = () => l.nr;
  pruefe('melden: unmerklich zählt nicht, jede Landung zählt einmal',
    meldeLandung(l, 0.1, schadlos, false, lw) === null && nr() === 0 && meldeLandung(l, 2, schadlos, false, lw) === 'weich' && nr() === 1
    && meldeLandung(l, 9, schadlos, false, lw) === 'hart' && nr() === 2 && l.art === 'hart' && l.fallhoehe === 9);
  pruefe('im Stand läuft der ganze Clip, in Bewegung nur der Anfang', landungLaeuft(0.6, 0.667, false, lw) && !landungLaeuft(0.6, 0.667, true, lw) && landungLaeuft(0.2, 0.667, true, lw) && !landungLaeuft(0.7, 0.667, false, lw));
  pruefe('Übergang: in die Landung schnell wie in einen Treffer, heraus wie aus ihm',
    uebergangsDauer('gang', 'landung', FIGUR.uebergang) === FIGUR.uebergang.treffer && uebergangsDauer('landung', 'stand', FIGUR.uebergang) === FIGUR.uebergang.trefferEnde);
}

console.log(`\nGegnerbewegung — am Clip gemessen: ${gemessen.join('; ')}`);
console.log(`${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
