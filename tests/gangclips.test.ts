/**
 * BRACHLAND — Fortbewegungs-Clips in der Laufzeit (D461), gemessen an der **ausgelieferten** Datei
 * `public/figuren/held/held-clips.glb` mit den Funktionen, die das Spiel benutzt (`src/figur/`).
 *
 *  1. **Tempo am Aufstandspunkt** (`aufstandsTempo`, `messeGang` mit Sohle): Gang, Laufschritt und Sprint lesen sich
 *     auf ±2 % wie in `docs/design/BRACHLAND_Waffenbewegungen_v1.md` §10.2 gemessen (1,40 / 4,19 / 8,49 m/s); die alte
 *     Messung (Mittel der Knöchelbahn) liest den Gang 12 % zu langsam — das bleibt als Befund stehen.
 *  2. **Drei Gangarten** (`gangStufen`): Bei den Spieltempi (`content/bewegung.json`: 4,2 und 8,5 m/s) spielt der
 *     passende Clip allein, bei Rate ≈ 1 und Weite ≈ 1, ohne Gleiten; dazwischen mischen zwei Nachbarn, und
 *     Rate × Weite × Strecke deckt das Tempo. Vorher (zwei Clips `Walk`/`Run`, Knöchelmessung) zum Vergleich.
 *  3. **Schrittabgleich:** Die Kontaktmitten der drei Clips (`kontaktMitte`) ergeben einen Versatz, mit dem derselbe
 *     Fuss in allen drei Clips zur selben Phase mitten im Kontakt steht.
 *  4. **Sprung und Lande-Rolle** (`sprung.ts`, `landung.ts`): Absprung → Flug, Kante ohne Absprung erst nach
 *     `fallAb`; die Lande-Rolle steigt bei `rolleAb` in `Koerper_Rolle` ein; die Clips liegen in der Datei.
 *  5. **Wenden im Stand** (`wende.ts`): löst erst ab `abGrad` aus, dreht um genau den Winkel des Clips, die Standmitte
 *     bleibt liegen; die Drehkette hält die Hüfte im Stand und holt danach ohne Sprung auf. **Am echten Skelett,
 *     verdrahtet wie in der Szene** (Gruppe → Versatz → Skelett, Mixer, `PosenTraegheit`, `Koerperfein.schritt`): Der
 *     Körper endet um 90° / 180° gedreht, die Hüftlinie springt in keinem Bild, ein stehender Fuss bewegt sich nicht.
 *
 * `BERICHT=1` druckt die Messwerte (auch vorher/nachher bei 1,4 / 4,2 / 8,5 m/s), `SPUR=1` jedes Bild, in dem ein
 * stehender Fuss mehr als 3 mm wandert.
 */
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import {
  aufstandsTempo, drehSchritt, gangMischung, gangStufen, kontaktMitte, neueDrehkette, sohlenpunkte,
  type Bahnpunkt, type Gang, type Sohlenbahn,
} from '../src/figur/fortbewegung.js';
import { Koerperfein, PosenTraegheit, elternkarte, messeGang, sammleKnochen, type FeinEingabe } from '../src/figur/laufzeit.js';
import { nachfahren, RIG_MENSCH } from '../src/figur/ebenen.js';
import { falte } from '../src/figur/feder.js';
import { uebergangsDauer } from '../src/figur/kette.js';
import { landeClip } from '../src/figur/landung.js';
import { luftBild, luftClip, meldeLuft, neueLuft } from '../src/figur/sprung.js';
import { dreheUmHoch, neueWende, standVersatz, wendeSchritt } from '../src/figur/wende.js';
import { FIGUR, GRAD } from '../src/figur/werte.js';
import { BEWEGUNG } from '../src/spieler/tempo.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}
const BERICHT = !!process.env.BERICHT;
const DATEI = 'public/figuren/held/held-clips.glb';

// ---- Datei lesen: Skelett und Clips als three-Objekte (wie `tests/clipguete.test.ts`)
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(DATEI);
const objekte = new Map<string, THREE.Object3D>();
const wurzel = new THREE.Group();
for (const n of doc.getRoot().listNodes()) {
  const o = new THREE.Bone();
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
const fuesse = RIG_MENSCH.beine.map(b => objekte.get(b.fuss)!);
const ballen = RIG_MENSCH.beine.map(b => objekte.get(b.ballen!)!);
pruefe('Rigplan nennt die Ballenknochen, die Datei trägt sie', fuesse.every(Boolean) && ballen.every(Boolean));

// ---- 1. Tempo am Aufstandspunkt --------------------------------------------------------------------------------
const g = FIGUR.gang;
const sohle = { ballen, mass: g.sohle };
/** Soll aus §10.2 (Aufstandspunkt, `BERICHT=1 npx tsx tests/clipguete.test.ts`) und die Knöchelmessung von D457 daneben. */
const SOLL: Record<string, { tempo: number; knoechel: number }> = {
  Koerper_Gang: { tempo: 1.40, knoechel: 1.23 }, Koerper_Laufschritt: { tempo: 4.19, knoechel: 4.04 }, Koerper_Sprint: { tempo: 8.49, knoechel: 8.19 },
};
const gemessen = new Map<string, ReturnType<typeof messeGang>>();
for (const [name, soll] of Object.entries(SOLL)) {
  const clip = clips.get(name);
  pruefe(`${name}: in der Datei`, !!clip);
  if (!clip) continue;
  const m = messeGang(wurzel, clip, fuesse, g.standHoehe, 64, sohle);
  gemessen.set(name, m);
  if (BERICHT) console.log(`  ${name}: Aufstandspunkt ${m.tempo?.toFixed(3)} m/s, Knöchel ${m.tempoKnoechel?.toFixed(3)} m/s, Kontaktmitte ${m.standMitte?.toFixed(3)}, Dauer ${clip.duration.toFixed(3)} s`);
  pruefe(`${name}: am Aufstandspunkt gemessen ${m.tempo?.toFixed(2)} m/s = ${soll.tempo} (±2 %)`, m.amAufstand && m.tempo !== null && Math.abs(m.tempo / soll.tempo - 1) <= 0.02);
  pruefe(`${name}: die Knöchelmessung von D457 liest ${m.tempoKnoechel?.toFixed(2)} m/s (§10.2: ${soll.knoechel}, ±3 %)`,
    m.tempoKnoechel !== null && Math.abs(m.tempoKnoechel / soll.knoechel - 1) <= 0.03);
}

// ---- 2. Drei Gangarten -----------------------------------------------------------------------------------------
const namen = g.stufen.map(s => s.clip);
pruefe('Daten: die Gangarten sind die Clips von D460', namen.join() === 'Koerper_Gang,Koerper_Laufschritt,Koerper_Sprint');
const gaenge: Gang[] = namen.map(n => ({ tempo: gemessen.get(n)?.tempo ?? 0, dauer: clips.get(n)?.duration ?? 1 }));
pruefe('Rückfallwerte in den Daten = Messung am Aufstandspunkt (±1 %)', g.stufen.every((s, i) => Math.abs(s.tempo / gaenge[i].tempo - 1) <= 0.01),
  gaenge.map(x => x.tempo.toFixed(3)).join(' / '));
const GEHEN = BEWEGUNG.laufen.gehen, RENNEN = BEWEGUNG.laufen.rennen;
/** Abspielrate gegen den Clip, der am meisten trägt (1 = wie gebaut). */
const clipRate = (m: ReturnType<typeof gangStufen>) => m.rate * gaenge[m.rennen >= 0.5 ? m.stufe + 1 : m.stufe].dauer;
{
  const lauf = gangStufen(GEHEN, gaenge, g), renn = gangStufen(RENNEN, gaenge, g), geh = gangStufen(gaenge[0].tempo, gaenge, g);
  pruefe(`Laufschritt ${GEHEN} m/s: der Laufschritt-Clip allein (Anteil ≥ 99 %), Rate ${clipRate(lauf).toFixed(3)} und Weite ${lauf.weite.toFixed(3)} auf 2 % bei 1, kein Gleiten`,
    lauf.stufe + lauf.rennen > 0.99 && lauf.stufe + lauf.rennen < 1.01 && Math.abs(clipRate(lauf) - 1) < 0.02 && Math.abs(lauf.weite - 1) < 0.02 && Math.abs(lauf.gleiten) < 1e-9);
  pruefe(`Rennen ${RENNEN} m/s: der Sprint-Clip allein, Rate ${clipRate(renn).toFixed(3)} und Weite ${renn.weite.toFixed(3)} auf 2 % bei 1, kein Gleiten`,
    renn.stufe === 1 && renn.rennen === 1 && Math.abs(clipRate(renn) - 1) < 0.02 && Math.abs(renn.weite - 1) < 0.02 && Math.abs(renn.gleiten) < 1e-9);
  pruefe('Gehen 1,4 m/s: der Gang-Clip allein bei Rate 1', geh.stufe === 0 && geh.rennen === 0 && Math.abs(clipRate(geh) - 1) < 1e-9 && Math.abs(geh.weite - 1) < 1e-9);
  pruefe('Rennen: 250–280 Schritte/min wie ein Mensch im Sprint (§10.1)', renn.rate * 120 > 250 && renn.rate * 120 < 280, `${(renn.rate * 120).toFixed(0)}`);
  let stetig = true, ohne = true, deckt = true, vor = gangStufen(0.5, gaenge, g);
  for (let v = 0.5; v <= 9.5; v += 0.02) {
    const m = gangStufen(v, gaenge, g);
    if (Math.abs(m.rate - vor.rate) > 0.03 || Math.abs(m.weite - vor.weite) > 0.03) stetig = false;
    if (v >= 0.6 && Math.abs(m.gleiten) > 1e-9) ohne = false;
    if (Math.abs(m.rate * m.weite * m.strecke - v * (1 - m.gleiten)) > 1e-9) deckt = false;
    vor = m;
  }
  pruefe('Rate und Weite über das Tempo stetig, auch an den Gangarten (kein Sprung)', stetig);
  pruefe('Von 0,6 bis 9,5 m/s kein Gleiten: Rate × Weite × Strecke = Tempo', ohne && deckt);
  pruefe('Stufe und Anteil: unter dem Gang Stufe 0, zwischen Laufschritt und Sprint Stufe 1, darüber Sprint allein',
    gangStufen(0.3, gaenge, g).stufe === 0 && gangStufen(0.3, gaenge, g).rennen === 0 && gangStufen(6, gaenge, g).stufe === 1
    && gangStufen(6, gaenge, g).rennen > 0.3 && gangStufen(6, gaenge, g).rennen < 0.6 && gangStufen(12, gaenge, g).rennen === 1);
  pruefe('Zwei Gangarten: wie gangMischung (Rückweg Walk/Run)', JSON.stringify({ ...gangMischung(3, gaenge[0], gaenge[1], g), stufe: 0 }) === JSON.stringify(gangStufen(3, gaenge.slice(0, 2), g)));

  // Vorher (Stand D460, vor D461): `Walk` + `Run`, beide an der Knöchelbahn gemessen. `Run` deckt in Wahrheit, was der
  // Aufstandspunkt sagt — die Rate war um die Messabweichung zu hoch, die Füsse liefen dem Boden voraus.
  const walk = clips.get('Walk'), run = clips.get('Run');
  if (walk && run) {
    const mw = messeGang(wurzel, walk, fuesse, g.standHoehe), mr = messeGang(wurzel, run, fuesse, g.standHoehe);
    const alt: [Gang, Gang] = [{ tempo: mw.tempo ?? g.gehen, dauer: walk.duration }, { tempo: mr.tempo ?? g.rennen, dauer: run.duration }];
    pruefe('Rückfall `gang.rennen` = Knöchelmessung von `Run` (±2 %)', mr.tempo !== null && Math.abs(g.rennen / mr.tempo - 1) <= 0.02, `${mr.tempo}`);
    const wahr = gaenge[1].tempo * run.duration;       // Strecke je Zyklus, die `Run` wirklich deckt
    const zeile = (v: number) => {
      const a = gangMischung(v, alt[0], alt[1], g), n = gangStufen(v, gaenge, g);
      const rateAlt = a.rate * (a.rennen >= 0.5 ? run.duration : walk.duration);
      // Restgleiten vorher: nur für den reinen `Run` bestimmbar (bei `Walk` ist der Aufstandspunkt nicht bestimmbar).
      const rest = a.rennen === 1 ? `${(((v - a.rate * a.weite * wahr) / v) * 100).toFixed(1)} %` : 'nicht bestimmbar (Walk-Anteil)';
      return `  ${v.toFixed(1)} m/s — vorher: ${a.rennen === 1 ? 'Run' : `Walk/Run ${(a.rennen * 100).toFixed(0)} %`}, Rate ×${rateAlt.toFixed(2)}, Weite ×${a.weite.toFixed(2)}, Restgleiten ${rest}`
        + ` | nachher: ${namen[n.rennen >= 0.5 ? n.stufe + 1 : n.stufe]}, Rate ×${clipRate(n).toFixed(3)}, Weite ×${n.weite.toFixed(3)}, Restgleiten ${(n.gleiten * 100).toFixed(1)} %`;
    };
    if (BERICHT) console.log([1.4, GEHEN, RENNEN].map(zeile).join('\n'));
    const a = gangMischung(RENNEN, alt[0], alt[1], g);
    pruefe('Vorher bei 8,5 m/s: der Laufschritt um die Hälfte beschleunigt und die Schrittweite am Anschlag gestreckt', a.rate * run.duration > 1.4 && a.weite > 1.39);
  }
}

// ---- 3. Schrittabgleich ----------------------------------------------------------------------------------------
{
  const mixer = new THREE.AnimationMixer(wurzel), v = new THREE.Vector3();
  /** Höhe der Sohle (tieferer Aufstandspunkt) beider Füsse zur Phase `phase` eines Clips. */
  const sohlen = (clip: THREE.AnimationClip, phase: number) => {
    mixer.stopAllAction();
    const a = mixer.clipAction(clip); a.reset().play(); a.timeScale = 0; a.time = (phase % 1) * clip.duration * 0.9999; mixer.update(0);
    wurzel.updateMatrixWorld(true);
    return fuesse.map((f, i) => {
      const p = (o: THREE.Object3D): Bahnpunkt => { wurzel.worldToLocal(o.getWorldPosition(v)); return { t: 0, x: v.x, y: v.y, z: v.z }; };
      const s = sohlenpunkte(p(f), p(ballen[i]), g.sohle);
      return Math.min(s.ferse.y, s.ballen.y);
    });
  };
  const m0 = gemessen.get(namen[0])?.standMitte ?? null;
  let gleich = m0 !== null;
  const zeilen: string[] = [];
  for (const n of namen) {
    const clip = clips.get(n), m = gemessen.get(n);
    if (!clip || !m || m.standMitte === null || m0 === null) { gleich = false; continue; }
    const versatz = (m.standMitte - m0 + 1) % 1;
    // Der Boden des Clips: tiefste Sohle über den Zyklus.
    let boden = Infinity;
    for (let i = 0; i < 48; i++) boden = Math.min(boden, ...sohlen(clip, i / 48));
    const [erster, zweiter] = sohlen(clip, m0 + versatz);
    zeilen.push(`${n}: Versatz ${versatz.toFixed(3)}, erster Fuss ${((erster - boden) * 100).toFixed(1)} cm, zweiter ${((zweiter - boden) * 100).toFixed(1)} cm über dem Boden`);
    // Derselbe Fuss steht; im Laufschritt und im Sprint ist der andere dabei in der Luft.
    if (erster - boden > g.sohle.toleranz + 0.004) gleich = false;
    if (n !== namen[0] && zweiter - boden < 0.05) gleich = false;
  }
  mixer.stopAllAction(); mixer.uncacheRoot(wurzel);
  if (BERICHT) console.log('  ' + zeilen.join('\n  '));
  pruefe('Schrittabgleich: zur Kontaktmitte des Gangs steht in allen drei Clips derselbe Fuss, im Lauf der andere in der Luft', gleich, zeilen.join('; '));
}
// Synthetisch: ein Fuss, der abrollt — der Ballen bleibt liegen, der Knöchel läuft weiter. Die Knöchelbahn liest zu langsam.
{
  const ferse: Bahnpunkt[] = [], ball: Bahnpunkt[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, steht = t <= 0.6, z = steht ? 0.3 - 1.0 * t : -0.3 + 1.5 * (t - 0.6), hoch = steht ? 0 : 0.1 * Math.sin((t - 0.6) / 0.4 * Math.PI);
    // Ferse liegt bis t = 0,3 auf, dann hebt sie ab; der Ballen liegt die ganze Standphase.
    ferse.push({ t, x: 0, y: hoch + (steht && t > 0.3 ? (t - 0.3) * 0.3 : 0), z: z + 0.2 });
    ball.push({ t, x: 0, y: hoch, z });
  }
  const bahn: Sohlenbahn = { ferse, ballen: ball };
  const v = aufstandsTempo([bahn], 0.006);
  pruefe('aufstandsTempo: der aufliegende Punkt wandert mit 1,0 m/s zurück', v !== null && Math.abs(v - 1) < 1e-6, `${v}`);
  const km = kontaktMitte(bahn, 0.006);
  pruefe('kontaktMitte: Kontakt von Phase 0 bis 0,6 → Mitte 0,3', km !== null && Math.abs(km - 0.3) < 0.02, `${km}`);
  pruefe('aufstandsTempo: Stand (nichts wandert) → null, Rückfall auf die Knöchelmessung',
    aufstandsTempo([{ ferse: ferse.map(p => ({ ...p, y: 0, z: 0 })), ballen: ball.map(p => ({ ...p, y: 0, z: 0 })) }], 0.006) === null);
  const k = { t: 0, x: 0, y: 0.1, z: 0 }, b = { t: 0, x: 0, y: 0.044, z: -0.13 };
  const s = sohlenpunkte(k, b, g.sohle);
  pruefe('sohlenpunkte: im flachen Stand liegen Ferse und Ballen auf einer Höhe unter den Knochen, die Ferse hinter dem Knöchel',
    s.ferse.y < k.y - 0.07 && s.ballen.y < b.y - 0.02 && s.ferse.z > k.z + 0.03 && Math.abs(s.ferse.y - s.ballen.y) < 0.005, JSON.stringify(s));
}

// ---- 4. Sprung und Lande-Rolle ---------------------------------------------------------------------------------
{
  const sw = FIGUR.sprung, lw = FIGUR.landung;
  pruefe('Sprung-Clips und Lande-Rolle liegen in der Datei', [sw.clipAb, sw.clipFlug, lw.clipRolle, lw.clipWeich, lw.clipHart].every(n => clips.has(n)));
  const ab = clips.get(sw.clipAb)?.duration ?? 0.3;
  const l = neueLuft();
  pruefe('am Boden: kein Luftbild', luftBild(l, ab, sw) === null);
  meldeLuft(l, true, true, 1 / 60);
  pruefe('Absprung: sofort der Abdruck, ein neuer Zähler', luftBild(l, ab, sw) === 'ab' && l.nr === 1 && luftClip('ab', sw) === sw.clipAb);
  let wechsel = -1;
  for (let i = 1; i <= 60; i++) { meldeLuft(l, true, false, 1 / 60); if (wechsel < 0 && luftBild(l, ab, sw) === 'flug') wechsel = i / 60; }
  pruefe(`nach der Länge des Abdrucks (${ab.toFixed(2)} s) die Flughaltung, derselbe Flug`, Math.abs(wechsel - ab) < 0.02 && l.nr === 1 && luftClip('flug', sw) === sw.clipFlug, `${wechsel}`);
  meldeLuft(l, false, false, 1 / 60);
  pruefe('aufgesetzt: kein Luftbild mehr', luftBild(l, ab, sw) === null && !l.inLuft);
  // Kante ohne Absprung
  meldeLuft(l, true, false, 1 / 60);
  const frueh = luftBild(l, ab, sw);
  for (let i = 0; i < Math.ceil(sw.fallAb * 60) + 1; i++) meldeLuft(l, true, false, 1 / 60);
  pruefe('Kante ohne Absprung: erst nach fallAb die Flughaltung, nie der Abdruck', frueh === null && luftBild(l, ab, sw) === 'flug' && l.nr === 2);
  meldeLuft(l, false, false, 1 / 60); meldeLuft(l, true, false, 1 / 60); meldeLuft(l, false, false, 1 / 60);
  pruefe('Absatz (ein Bild in der Luft): nichts', luftBild(l, ab, sw) === null);
  pruefe('Übergang in die Luft und heraus aus den Daten', uebergangsDauer('gang', 'luft', FIGUR.uebergang) === FIGUR.uebergang.luft
    && uebergangsDauer('luft', 'luft', FIGUR.uebergang) === FIGUR.uebergang.luft && uebergangsDauer('luft', 'stand', FIGUR.uebergang) === FIGUR.uebergang.luft
    && uebergangsDauer('luft', 'landung', FIGUR.uebergang) === FIGUR.uebergang.treffer);
  const rolle = clips.get(lw.clipRolle);
  pruefe('Lande-Rolle: `Koerper_Rolle` ab Bild 5 (4/24 s), der Rest 0,58 s bei Rate 1', landeClip('rolle', lw) === 'Koerper_Rolle'
    && Math.abs(lw.rolleAb - 4 / 24) < 1e-3 && !!rolle && Math.abs(rolle.duration - lw.rolleAb - 14 / 24) < 0.01);
}

// ---- 5. Wenden im Stand ----------------------------------------------------------------------------------------
{
  const ww = FIGUR.wenden, dauern = { wenden: clips.get(ww.clips.wendenLinks)?.duration ?? 0.5, kehrt: clips.get(ww.clips.kehrtLinks)?.duration ?? 0.75 };
  pruefe('Wendeclips liegen in der Datei, links und rechts gleich lang', Object.values(ww.clips).every(n => clips.has(n))
    && clips.get(ww.clips.wendenRechts)?.duration === dauern.wenden && clips.get(ww.clips.kehrtRechts)?.duration === dauern.kehrt);
  const dt = 1 / 60;
  // Reiner Ablauf: Blick dreht 50° → nichts; 70° → 90° links; Rest −20° bleibt im Rumpf.
  let w = neueWende();
  wendeSchritt(w, 0, dt, true, true, dauern, ww);
  pruefe('unter abGrad: die Hüfte bleibt stehen', wendeSchritt(w, 50 * GRAD, dt, true, true, dauern, ww) === 0 && w.richtung === 0 && w.clip === null);
  const s1 = wendeSchritt(w, 70 * GRAD, dt, true, true, dauern, ww);
  pruefe('ab abGrad: 90° nach links, die Hüfte springt um genau den Winkel des Clips', Math.abs(s1 - Math.PI / 2) < 1e-12 && w.clip === 'wendenLinks' && Math.abs(w.richtung - Math.PI / 2) < 1e-12 && w.nr === 1);
  let waehrend = 0;
  for (let t = 0; t < dauern.wenden - 2 * dt; t += dt) waehrend += Math.abs(wendeSchritt(w, 170 * GRAD, dt, true, true, dauern, ww));
  pruefe('während des Clips löst keine zweite Wende aus', waehrend === 0 && w.nr === 1);
  for (let i = 0; i < 4; i++) wendeSchritt(w, 170 * GRAD, dt, true, false, dauern, ww);
  pruefe('solange ein Übergang abklingt (nicht ruhig), beginnt keine Wende', w.clip === null && w.nr === 1);
  pruefe('danach: der Rest (80°) reicht für die nächste Wende', Math.abs(wendeSchritt(w, 170 * GRAD, dt, true, true, dauern, ww) - Math.PI / 2) < 1e-12 && w.nr === 2);
  w = neueWende(); wendeSchritt(w, 0, dt, true, true, dauern, ww);
  pruefe('rechts herum und kehrt: Seite nach Vorzeichen, ab kehrtAbGrad 180°',
    Math.abs(wendeSchritt(w, -150 * GRAD, dt, true, true, dauern, ww) + Math.PI) < 1e-12 && w.clip === 'kehrtRechts' && w.dauer === dauern.kehrt);
  w = neueWende(); wendeSchritt(w, 0, dt, true, true, dauern, ww);
  pruefe('über 180° hinweg läuft der Blick nicht um (abgewickelt)', (() => {
    for (let a = 0; a <= 100; a += 20) wendeSchritt(w, a * GRAD, dt, true, false, dauern, ww);
    for (let a = 100; a <= 200; a += 20) wendeSchritt(w, a * GRAD, dt, true, false, dauern, ww);
    return Math.abs(w.ziel - 200 * GRAD) < 1e-9 && wendeSchritt(w, 200 * GRAD, dt, true, true, dauern, ww) === Math.PI;
  })());
  w = neueWende(); wendeSchritt(w, 0, dt, true, true, dauern, ww);
  wendeSchritt(w, 80 * GRAD, dt, false, true, dauern, ww);
  pruefe('nicht frei (Gang, Kampf, Sattel): keine Wende, die Standrichtung folgt dem Blick', w.clip === null && w.nr === 0 && Math.abs(w.richtung - 80 * GRAD) < 1e-12);
  pruefe('abgeschaltet in den Daten: nie', wendeSchritt(neueWende(), 3, dt, true, true, dauern, { ...ww, an: false }) === 0);

  // Standmitte bleibt liegen: beliebige Hüftrichtungen, auch gesprungen.
  w = neueWende(); wendeSchritt(w, 0.3, dt, true, true, dauern, ww);
  const mitte: [number, number] = [-0.019, 0.061];
  let liegt = true, groesster = 0;
  const anker = dreheUmHoch(mitte[0], mitte[1], 0.3);
  for (const h of [0.3, 0.5, 0.3 + Math.PI / 2, 0.3 + Math.PI, -2]) {
    const [vx, vz] = standVersatz(w, h, mitte, dt, ww.versatzHalbwert);
    const [x, z] = dreheUmHoch(mitte[0] + vx, mitte[1] + vz, h);
    if (Math.hypot(x - anker[0], z - anker[1]) > 1e-12) liegt = false;
    groesster = Math.max(groesster, Math.hypot(vx, vz));
  }
  pruefe('freier Stand: die Standmitte bleibt in der Welt liegen, der Versatz höchstens der doppelte Abstand', liegt && groesster <= 2 * Math.hypot(...mitte) + 1e-12);
  w.frei = false;
  let rest = 1;
  for (let i = 0; i < 60; i++) rest = Math.hypot(...standVersatz(w, -2, mitte, dt, ww.versatzHalbwert));
  pruefe('losgegangen: der Versatz klingt in einer Sekunde ab', rest < 1e-3);

  // Drehkette im Stand: Hüfte hält, Rumpf und Kopf teilen den Winkel; danach holt die Hüfte ohne Sprung auf.
  const k = neueDrehkette(), d = FIGUR.drehen;
  const stand = { abstand: 0, koerper: 0, blickMax: FIGUR.blick.gierMaxGrad * GRAD, rumpfAnteil: ww.rumpfAnteil };
  drehSchritt(k, 0, dt, d, 0, stand);
  let r = { huefte: 0, schulter: 0, kopf: 0 };
  stand.abstand = 50 * GRAD;
  for (let i = 0; i < 120; i++) r = drehSchritt(k, 50 * GRAD, dt, d, 0, stand);
  pruefe('Stand, Blick 50° links: Hüfte steht, Wirbelsäule trägt den Rumpfanteil, der Hals den Rest',
    Math.abs(r.huefte) < 1e-3 && Math.abs(r.schulter - 50 * GRAD * ww.rumpfAnteil) < 1e-3 && Math.abs(r.kopf - 50 * GRAD * (1 - ww.rumpfAnteil)) < 1e-3);
  let sprung = 0, vorH = r.huefte;
  for (let i = 0; i < 120; i++) { r = drehSchritt(k, 50 * GRAD, dt, d); sprung = Math.max(sprung, Math.abs(r.huefte - vorH)); vorH = r.huefte; }
  pruefe('Losgehen aus dem verdrehten Stand: die Hüfte holt den Blick ein, ohne zu springen (≤ 6° je Bild)', sprung < 6 * GRAD && Math.abs(r.huefte - 50 * GRAD) < 1e-2 && k.weit === 0,
    `${(sprung / GRAD).toFixed(1)}°`);

  // ---- Am echten Skelett, verdrahtet wie in der Szene (`SpielerFigur`): Gruppe (Hüftrichtung) → Versatz → Skelett.
  const gruppe = new THREE.Group(), reiter = new THREE.Group();
  gruppe.add(reiter); reiter.add(wurzel);
  const mixer = new THREE.AnimationMixer(wurzel);
  const aktion = (n: string, schleife: boolean) => { const a = mixer.clipAction(clips.get(n)!); if (!schleife) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } return a; };
  const idle = aktion(ww.stand, true);
  const v = new THREE.Vector3();
  // Standmitte wie in der Szene: Mittel der Füsse im Stand, im Raum über dem Skelett.
  idle.play(); mixer.update(0); gruppe.updateMatrixWorld(true);
  const mitteS: [number, number] = [0, 0];
  for (const f of fuesse) { reiter.worldToLocal(f.getWorldPosition(v)); mitteS[0] += v.x / 2; mitteS[1] += v.z / 2; }
  mixer.stopAllAction();
  const ober = nachfahren(elternkarte(wurzel), RIG_MENSCH.oberAb);
  const knochen = sammleKnochen(wurzel), unter = new Set(knochen.map(o => o.name).filter(n => !ober.has(n)));
  pruefe('Skelett: Knochen gefunden, Wurzel und Beine gehören nicht zum Oberkörper', knochen.length > 50 && unter.has('pelvis') && unter.has('foot_l') && !unter.has('spine_02'));
  const ruhe = messeGang(wurzel, clips.get(namen[0])!, fuesse, g.standHoehe).tief;
  // Höhe der Knöchel im Stand: Ein Fuss steht, solange er dort ist (±2 mm).
  idle.play(); mixer.update(0); gruppe.updateMatrixWorld(true);
  const standHoch = fuesse.map(f => f.getWorldPosition(new THREE.Vector3()).y);
  mixer.stopAllAction();
  const hueftWelt = () => {
    const l = objekte.get('thigh_l')!.getWorldPosition(new THREE.Vector3()), rr = objekte.get('thigh_r')!.getWorldPosition(new THREE.Vector3());
    return Math.atan2(-(rr.z - l.z), rr.x - l.x);
  };
  /** Ablauf: `blick(t)` in rad. Zurück: grösstes Gleiten eines stehenden Fusses je Bild (m), grösster Sprung der Hüftlinie je Bild (rad), Endrichtung, Wenden. */
  const laufe = (blick: (t: number) => number, sekunden: number) => {
    mixer.stopAllAction();
    const tr = new PosenTraegheit(knochen), fein = new Koerperfein(wurzel, RIG_MENSCH, ruhe), wd = neueWende();
    const e: FeinEingabe = { gier: 0, tempo: 0, rennen: RENNEN, straff: 0, fokus: null, steht: true, hoeheAn: () => 0, fuesse: true, halten: true, staerke: 1, weite: 1 };
    let jetzt: THREE.AnimationAction = idle, art: 'stand' | 'wende' = 'stand';
    idle.reset().play();
    let gleiten = 0, dreh = 0, richtung = 0, vorG = 0, erst = true;
    const vorF = fuesse.map(() => new THREE.Vector3()), vorB = ballen.map(() => new THREE.Vector3());
    for (let t = 0; t < sekunden; t += dt) {
      const gier = blick(t);
      const winkel = wendeSchritt(wd, gier, dt, true, !tr.laeuft && art === 'stand', dauern, ww);
      const soll = wd.clip ? aktion(ww.clips[wd.clip], false) : idle, artNeu = wd.clip ? 'wende' : 'stand';
      if (soll !== jetzt || winkel !== 0) {
        tr.wechsel(FIGUR.uebergang.standard, winkel !== 0 ? unter : undefined);
        if (soll !== jetzt) jetzt.stop();
        soll.reset().play(); jetzt = soll;
      }
      art = artNeu;
      mixer.update(dt);
      tr.nachMixer(dt);
      e.gier = gier; e.standAbstand = wd.frei ? wd.ziel - wd.richtung : undefined;
      if (winkel !== 0) fein.dreheHuefte(winkel);
      const lage = fein.schritt(dt, e);
      gruppe.rotation.y = lage.huefte;
      const [vx, vz] = standVersatz(wd, lage.huefte, mitteS, dt, ww.versatzHalbwert);
      reiter.position.x = vx; reiter.position.z = vz;
      // Ohne die Knochenschicht (Verdrehung von Rumpf und Kopf, Fuss-IK): gemessen wird, was Clip, Gruppe und Versatz tun.
      tr.ende();
      gruppe.updateMatrixWorld(true);
      const hw = hueftWelt();
      fuesse.forEach((f, i) => {
        const p = f.getWorldPosition(new THREE.Vector3()), b = ballen[i].getWorldPosition(new THREE.Vector3());
        // Ein Fuss steht, wenn sein Knöchel in beiden Bildern auf Standhöhe ist — dann darf er sich nicht bewegen.
        if (!erst && p.y < standHoch[i] + 0.002 && vorF[i].y < standHoch[i] + 0.002) {
          const gl = Math.max(Math.hypot(p.x - vorF[i].x, p.z - vorF[i].z), Math.hypot(b.x - vorB[i].x, b.z - vorB[i].z));
          if (process.env.SPUR && gl > 0.003) console.log(`    SPUR t=${t.toFixed(3)} Fuss ${i} ${(gl * 1000).toFixed(1)} mm, Knöchel ${(Math.hypot(p.x - vorF[i].x, p.z - vorF[i].z) * 1000).toFixed(1)}, hoch ${(p.y * 100).toFixed(2)}/${(vorF[i].y * 100).toFixed(2)} clip=${wd.clip} seit=${wd.seit.toFixed(3)} winkel=${winkel} tr=${tr.laeuft}`);
          gleiten = Math.max(gleiten, gl);
        }
        vorF[i].copy(p); vorB[i].copy(b);
      });
      if (!erst) dreh = Math.max(dreh, Math.abs(falte(hw - vorG)));
      vorG = hw; richtung = hw; erst = false;
    }
    mixer.stopAllAction();
    return { gleiten, dreh, richtung, wenden: wd.nr, versatz: Math.hypot(reiter.position.x, reiter.position.z) };
  };
  const rampe = (ziel: number, ueber: number) => (t: number) => ziel * Math.min(1, Math.max(0, (t - 0.3) / ueber));
  const faelle: [string, (t: number) => number, number, number][] = [
    ['Blick 70° nach links in 0,2 s', rampe(70 * GRAD, 0.2), 90, 1],
    ['Blick 70° nach rechts in 0,2 s', rampe(-70 * GRAD, 0.2), -90, 1],
    ['Blick springt 170° nach links', rampe(170 * GRAD, 0.001), 180, 1],
    ['Blick springt 170° nach rechts', rampe(-170 * GRAD, 0.001), -180, 1],
    ['Blick 170° nach links in 0,3 s (zwei Wenden statt Kehrt)', rampe(170 * GRAD, 0.3), 180, 2],
    ['Blick 40° nach links', rampe(40 * GRAD, 0.2), 0, 0],
    ['Blick einmal ganz herum in 2 s', rampe(360 * GRAD, 2), 0, -1],
  ];
  for (const [name, blick, soll, wenden] of faelle) {
    const m = laufe(blick, 4.5);
    if (BERICHT) console.log(`  Wende — ${name}: ${m.wenden} Wende(n), Standfuss gleitet höchstens ${(m.gleiten * 1000).toFixed(1)} mm je Bild, Hüftlinie dreht höchstens ${(m.dreh / GRAD).toFixed(1)}° je Bild, Ende ${(m.richtung / GRAD).toFixed(1)}°, Versatz ${(m.versatz * 100).toFixed(1)} cm`);
    pruefe(`${name}: ${wenden < 0 ? 'mehrere Wenden, Körper endet näher als abGrad am Blick' : `${wenden} Wende(n), Körper endet bei ${soll}°`}`, (wenden < 0 ? m.wenden >= 3 && Math.abs(falte(m.richtung)) < (ww.abGrad + 1) * GRAD : m.wenden === wenden && Math.abs(falte(m.richtung - soll * GRAD)) < 2 * GRAD),
      `${m.wenden} Wenden, Ende ${(m.richtung / GRAD).toFixed(1)}°`);
    // Grenze 5 mm je Bild (ein Drittel dessen, was `clipguete.test.ts` einem Standfuss im Gang zugesteht). Gemessen 3,3 mm,
    // einmal je Wende im Bild des Wechsels: Der Stand (`Idle`) wiegt, der Wendeclip beginnt in dessen erstem Bild, und die
    // Beine wechseln hart. Im Spiel hält der Standfuss der Fuss-IK (`fussboden.ts`) den Fuss darüber fest.
    pruefe(`${name}: der Standfuss gleitet nicht (${(m.gleiten * 1000).toFixed(1)} mm je Bild ≤ 5)`, m.gleiten <= 0.005);
    pruefe(`${name}: der Körper springt nicht (Hüftlinie ${(m.dreh / GRAD).toFixed(1)}° je Bild ≤ 8)`, m.dreh <= 8 * GRAD);
  }
  gruppe.remove(reiter); reiter.remove(wurzel);
}

console.log(`\nGangclips — am Aufstandspunkt gemessen: ${[...gemessen].map(([n, m]) => `${n} ${m.tempo?.toFixed(2)} m/s`).join(', ')}`);
console.log(`${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
