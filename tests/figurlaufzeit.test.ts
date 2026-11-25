/**
 * BRACHLAND — Laufzeit der Bewegung (D457), renderfrei: alles in `src/figur/`, was zwischen und über den Clips
 * geschieht. Kein three.js, kein Mixer — geprüft werden die Formeln, an denen das Bild hängt.
 *
 *  1. **Inertialisierung** (`inertial.ts`): Die Kurve erfüllt ihre sechs Randbedingungen; die Pose ist beim
 *     Wechsel stetig in Lage **und** Geschwindigkeit; sie schwingt nicht über; nach der Dauer ist sie der Zielclip.
 *  2. **Kette** (`kette.ts`): Ohne Marken die Zuordnung von D168/D171; mit Marken steht die Figur bei `KOMBO_AB`
 *     in der Kettenpose und der nächste Hieb steigt dort ein; Dauern je Übergangsart aus den Daten.
 *  3. **Ebenen** (`ebenen.ts`): Oberkörper ab `spine_01`, jede Spur in genau einer Ebene.
 *  4. **Fuss am Boden** (`fussboden.ts`): Normale am Hang, Klemmung, Standfuss hält und löst, Zwei-Gelenk-Dreieck.
 *  5. **Fortbewegung** (`fortbewegung.ts`): Tempo am Clip gemessen, Rate × Weite × Strecke = Tempo (kein Gleiten),
 *     Kurvenlage, Drehkette (Kopf vor Schultern vor Hüfte), Blickgrenzen, Atem.
 *  6. **Treffer** (`trefferantwort.ts`): Scheitel nach Schaden, Richtung vom Angreifer weg, klingt aus.
 *  7. **Kosten:** die reinen Teile je Bild, auf diesem Rechner gemessen (nur Ausgabe, kein Tor).
 */
import { abklingKurve, abklingTempo, abklingWert, neueTraegheit, starteUebergang, wendeAn } from '../src/figur/inertial.js';
import { falte, federSchritt, neueFeder, schwingSchritt } from '../src/figur/feder.js';
import { hiebClipzeit, uebergangsDauer, type Bewegungsart, type Hiebmarken } from '../src/figur/kette.js';
import { leseClipmarken } from '../src/figur/clipmarken.js';
import { nachfahren, RIG_MENSCH, spurKnochen, teileSpuren } from '../src/figur/ebenen.js';
import { beckenSenkung, begrenzeNormale, bodenNormale, fuehreStandfuss, neuerStandfuss, zweiGelenk } from '../src/figur/fussboden.js';
import {
  atemSchritt, blickWinkel, drehSchritt, gangMischung, kurvenNeigung, natuerlichesTempo, neueDrehkette, neuerAtem, schubNeigung, standMitte,
  type Bahnpunkt,
} from '../src/figur/fortbewegung.js';
import { neueTrefferantwort, stosseFigur, trefferKippung, trefferSchritt } from '../src/figur/trefferantwort.js';
import { FIGUR, GRAD } from '../src/figur/werte.js';
import { erzeugeSpeicher } from '../src/spiel/einstellungen.js';
import { Figurlaufzeit } from '../src/data/schema.js';
import { KOMBO_AB, WAFFEN } from '../src/kampf/echtzeit.js';
import CLIPMARKEN_ROH from '../content/clipmarken.json';
import { BEWEGUNG } from '../src/spieler/tempo.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, ok: boolean, hinweis = '') {
  if (ok) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}
const nah = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e;

pruefe('Daten gültig (Schema Figurlaufzeit)', Figurlaufzeit.safeParse(FIGUR).success);
pruefe('Schalter: Einstellung figurfein, Standard an, ?figurfein=0 schaltet ab',
  erzeugeSpeicher({ speicher: null }).wert('figurfein') === true
  && erzeugeSpeicher({ speicher: null, adresse: new URLSearchParams('figurfein=0') }).wert('figurfein') === false);

// ---- 1. Inertialisierung -------------------------------------------------------------------------------------
{
  let schlimm = 0, ueber = 0, ende = 0;
  for (const x0 of [0.01, 0.3, 1.2, 3.0]) for (const v0 of [-40, -6, -1, 0, 2, 30]) for (const dauer of [0.1, 0.2, 0.3]) {
    const k = abklingKurve(x0, v0, dauer);
    const v = Math.min(0, v0), h = 1e-6;
    schlimm = Math.max(schlimm, Math.abs(abklingWert(k, 0) - x0), Math.abs(abklingTempo(k, 0) - v));
    // Am Ende: Lage, Tempo und Beschleunigung null (Tempo und Beschleunigung als Differenz kurz vor t1).
    const e0 = abklingWert(k, k.t1 - h), e1 = abklingTempo(k, k.t1 - h), e2 = (abklingTempo(k, k.t1 - h) - abklingTempo(k, k.t1 - 2 * h)) / h;
    ende = Math.max(ende, Math.abs(e0) / x0, Math.abs(e1) * dauer / x0 * 1e-3, Math.abs(e2) * dauer * dauer / x0 * 1e-3);
    for (let i = 0; i <= 200; i++) {
      const w = abklingWert(k, (k.t1 * i) / 200);
      if (w < -1e-9 * x0 - 1e-12 || w > x0 * (1 + 1e-9)) ueber++;
    }
    if (k.t1 > dauer + 1e-12) ueber++;
  }
  pruefe('Kurve: beginnt bei x0 mit v0 (weglaufendes v0 zählt 0)', schlimm < 1e-9, `${schlimm}`);
  pruefe('Kurve: endet mit Lage, Tempo und Beschleunigung null', ende < 1e-5, `${ende}`);
  pruefe('Kurve: schwingt nie über das Ziel und nie über x0 hinaus, nie länger als die Dauer', ueber === 0, `${ueber} Verstösse`);
  pruefe('Kurve: kein Versatz → nichts', abklingKurve(0, -3, 0.2).t1 === 0 && abklingWert(abklingKurve(0, 0, 0.2), 0.05) === 0);
}
{
  // Ein Knochen dreht mit 4 rad/s um Y aufs Ziel zu (alter Clip); der neue Clip steht 0,9 rad daneben still.
  const q = (w: number, achse: [number, number, number] = [0, 1, 0]) => [achse[0] * Math.sin(w / 2), achse[1] * Math.sin(w / 2), achse[2] * Math.sin(w / 2), Math.cos(w / 2)];
  const winkelY = (p: ArrayLike<number>, o = 0) => 2 * Math.atan2(p[o + 1], p[o + 3]);
  const dt = 1 / 60, tempo = -4, start = 1.2, ziel = 0.3;
  const z = neueTraegheit(2);
  const fest = q(0.5, [1, 0, 0]);
  const zielPose = [...q(ziel), ...fest];
  const lv = [0, 1.0, 0, 0, 0, 0], ld = [0, 1.0 + 0.6 * dt, 0, 0, 0, 0], lz = [0, 0.9, 0, 0, 0, 0];
  starteUebergang(z, [...q(start), ...fest], [...q(start - tempo * dt), ...fest], zielPose, dt, 0.2, lv, ld, lz);
  // Bild 0 des neuen Clips (dt = 0): genau die alte Pose.
  let pose = [...zielPose], lage = [...lz];
  wendeAn(z, pose, 0, lage);
  pruefe('Pose stetig: erstes Bild nach dem Wechsel = letzte gezeigte Pose', nah(winkelY(pose), start, 1e-6) && nah(lage[1], 1.0, 1e-6), `${winkelY(pose)} ${lage[1]}`);
  // Ein Bild später: weitergedreht mit (fast) dem alten Tempo — nicht stehengeblieben, nicht gesprungen.
  pose = [...zielPose]; lage = [...lz];
  wendeAn(z, pose, dt, lage);
  const v1 = (winkelY(pose) - start) / dt, lv1 = (lage[1] - 1.0) / dt;
  pruefe('Geschwindigkeit stetig: der Knochen dreht im ersten Bild mit dem alten Tempo weiter', v1 < tempo * 0.8 && v1 > tempo * 1.2, `${v1.toFixed(2)} rad/s statt ${tempo}`);
  pruefe('Geschwindigkeit stetig auch in der Lage (Becken)', lv1 < -0.6 * 0.8 && lv1 > -0.6 * 1.2, `${lv1.toFixed(3)} m/s statt −0.6`);
  pruefe('Knochen ohne Versatz bleibt unberührt', nah(pose[4], zielPose[4], 1e-9) && nah(pose[7], zielPose[7], 1e-9));
  // Verlauf: ohne Ruck (das Tempo ändert sich von Bild zu Bild nur wenig), nie über das Ziel hinaus, endet im Ziel.
  let wVor = winkelY(pose), vVor = v1, ruck = 0, tiefst = wVor, laeuft = true, t = dt;
  while (laeuft && t < 1) {
    const p = [...zielPose];
    laeuft = wendeAn(z, p, dt); t += dt;
    const w = winkelY(p), v = (w - wVor) / dt;
    ruck = Math.max(ruck, Math.abs(v - vVor));
    wVor = w; vVor = v; tiefst = Math.min(tiefst, w); pose = p;
  }
  pruefe('Verlauf ohne Ruck: Tempo ändert sich je Bild um weniger als die Hälfte des Anfangstempos', ruck < Math.abs(tempo) / 2, `${ruck.toFixed(2)} rad/s je Bild`);
  pruefe('Nach der Dauer ist die Pose der Zielclip, die Trägheit ruht', !z.laeuft && nah(winkelY(pose), ziel, 1e-6) && t <= 0.2 + 2 * dt + 1e-9, `t=${t.toFixed(3)}`);
  pruefe('Schwingt nicht über das Ziel hinaus', tiefst >= ziel - 1e-9, `${tiefst}`);
  // Gegenprobe: Ein harter Wechsel spränge im ersten Bild um den ganzen Versatz (54 rad/s bei 60 Bildern/s).
  pruefe('Gegenprobe: harter Wechsel wäre ein Sprung von 0,9 rad in einem Bild', Math.abs((ziel - start) / dt) > 10 * Math.abs(v1));
  // Läuft die alte Bewegung vom Ziel weg, hält der Versatz an (Sicherung gegen Überschwingen) — er wächst nie.
  const zw = neueTraegheit(1);
  starteUebergang(zw, q(start), q(start - 4 * dt), q(ziel), dt, 0.2);
  const weg = q(ziel); wendeAn(zw, weg, dt);
  pruefe('Bewegung vom Ziel weg: der Versatz wächst nicht über die alte Pose hinaus', winkelY(weg) <= start + 1e-9 && winkelY(weg) > start - 0.02, `${winkelY(weg)}`);
  // Wechsel mitten im Abklingen: wieder stetig.
  const z2 = neueTraegheit(1);
  starteUebergang(z2, q(1.0), q(1.0), q(0), dt, 0.2);
  const a = q(0), b = q(0);
  wendeAn(z2, a, dt); const zwischen = [...a];
  wendeAn(z2, b, dt);
  starteUebergang(z2, b, zwischen, q(-0.4), dt, 0.15);
  const c = q(-0.4); wendeAn(z2, c, 0);
  pruefe('Wechsel im Wechsel: stetig', nah(winkelY(c), winkelY(b), 1e-6));
  // Der kürzere Weg: 350° Versatz ist 10° in die andere Richtung.
  const z3 = neueTraegheit(1);
  starteUebergang(z3, q(350 * GRAD), q(350 * GRAD), q(0), 0, 0.2);
  pruefe('Versatz nimmt den kurzen Weg (350° = −10°)', nah(z3.kurve[0], 10 * GRAD, 1e-6), `${z3.kurve[0] / GRAD}`);
}
{
  const f = neueFeder(0);
  let ueber = false;
  for (let i = 0; i < 240; i++) { federSchritt(f, 1, 0.1, 1 / 60); if (f.x > 1 + 1e-9) ueber = true; }
  pruefe('Feder kritisch: erreicht das Ziel ohne Überschwingen', !ueber && nah(f.x, 1, 1e-3));
  const a = neueFeder(0), b = neueFeder(0);
  for (let i = 0; i < 60; i++) federSchritt(a, 1, 0.1, 1 / 60);
  for (let i = 0; i < 20; i++) federSchritt(b, 1, 0.1, 1 / 20);
  pruefe('Feder unabhängig von der Bildrate (60 gegen 20 Bilder/s)', nah(a.x, b.x, 1e-9) && nah(a.v, b.v, 1e-9));
  const s = neueFeder(0), s2 = neueFeder(0); s.v = 1; s2.v = 1;
  for (let i = 0; i < 60; i++) schwingSchritt(s, 2.6, 0.55, 1 / 60);
  for (let i = 0; i < 15; i++) schwingSchritt(s2, 2.6, 0.55, 1 / 15);
  pruefe('Schwingung unabhängig von der Bildrate', nah(s.x, s2.x, 1e-9));
  pruefe('falte: 370° → 10°, −190° → 170°', nah(falte(370 * GRAD), 10 * GRAD, 1e-9) && nah(falte(-190 * GRAD), 170 * GRAD, 1e-9));
}

// ---- 2. Kette --------------------------------------------------------------------------------------------------
{
  const s = { vorlauf: 0.18, aktiv: 0.12, erholung: 0.32 };
  const ohne: Hiebmarken = { scheitel: 6 / 24, durchzug: 9 / 24, dauer: 30 / 24 };
  const alt = (phase: 'vorlauf' | 'aktiv' | 'erholung', zeit: number) => Math.min(
    phase === 'vorlauf' ? ohne.scheitel * Math.min(1, zeit / s.vorlauf)
      : phase === 'aktiv' ? ohne.scheitel + (ohne.durchzug - ohne.scheitel) * Math.min(1, zeit / s.aktiv)
      : ohne.durchzug + (ohne.dauer - ohne.durchzug) * Math.min(1, zeit / s.erholung), ohne.dauer * 0.999);
  let gleich = true;
  for (const ph of ['vorlauf', 'aktiv', 'erholung'] as const) for (let i = 0; i <= 12; i++) {
    const t = (s[ph] * 1.2 * i) / 12;
    if (!nah(hiebClipzeit(ph, t, s, ohne, false, KOMBO_AB), alt(ph, t), 1e-12)) gleich = false;
    if (!nah(hiebClipzeit(ph, t, s, ohne, true, KOMBO_AB), alt(ph, t), 1e-12)) gleich = false;
  }
  pruefe('Ohne Marken: Clipzeit genau wie vor D457 (Rückfall auf Clipanfang und -ende), auch in der Kette', gleich);
  const mit: Hiebmarken = { ...ohne, einstieg: 3 / 24, kettenpose: 14 / 24 };
  pruefe('Kettenpose: bei KOMBO_AB der Erholung steht der Clip genau in ihr',
    nah(hiebClipzeit('erholung', s.erholung * KOMBO_AB, s, mit, false, KOMBO_AB), 14 / 24, 1e-12));
  pruefe('Kettenstart: der gekettete Hieb steigt am Einstieg ein, der erste bei 0',
    nah(hiebClipzeit('vorlauf', 0, s, mit, true, KOMBO_AB), 3 / 24) && hiebClipzeit('vorlauf', 0, s, mit, false, KOMBO_AB) === 0);
  pruefe('Regel unberührt: Scheitel am Ende des Vorlaufs, Durchzug am Ende des Aktiven — mit und ohne Kette',
    [true, false].every(k => nah(hiebClipzeit('vorlauf', s.vorlauf, s, mit, k, KOMBO_AB), mit.scheitel)
      && nah(hiebClipzeit('aktiv', 0, s, mit, k, KOMBO_AB), mit.scheitel) && nah(hiebClipzeit('aktiv', s.aktiv, s, mit, k, KOMBO_AB), mit.durchzug)));
  let monoton = true, vor = -1;
  for (const [ph, d] of [['vorlauf', s.vorlauf], ['aktiv', s.aktiv], ['erholung', s.erholung]] as const) for (let i = 0; i <= 40; i++) {
    const c = hiebClipzeit(ph, (d * i) / 40, s, mit, true, KOMBO_AB);
    if (c < vor - 1e-12) monoton = false;
    vor = c;
  }
  pruefe('Clipzeit läuft nie rückwärts, endet vor dem Clipende', monoton && vor < mit.dauer && vor > mit.dauer * 0.99);
  pruefe('Unsinnige Marken werden übergangen (Einstieg hinter dem Scheitel, Kettenpose vor dem Durchzug)',
    hiebClipzeit('vorlauf', 0, s, { ...ohne, einstieg: 0.4 }, true, KOMBO_AB) === 0
    && nah(hiebClipzeit('erholung', s.erholung * 0.5, s, { ...ohne, kettenpose: 0.1 }, false, KOMBO_AB), alt('erholung', s.erholung * 0.5)));

  const u = FIGUR.uebergang;
  const d = (a: Bewegungsart, b: Bewegungsart) => uebergangsDauer(a, b, u);
  pruefe('Dauern je Übergangsart aus den Daten: Hut → Hieb, Kette, Hieb → Hut, Hieb → Rolle, Treffer → Hut',
    d('hut', 'hieb') === u.hutHieb && d('hieb', 'hieb') === u.kette && d('hieb', 'hut') === u.hiebHut
    && d('hieb', 'rolle') === u.rolle && d('treffer', 'hut') === u.trefferEnde && d('rolle', 'gang') === u.rolleEnde
    && d('stand', 'gang') === u.gang && d('gang', 'fall') === u.fall && d('block', 'hut') === u.abbruch && d('hut', 'block') === u.block);
  pruefe('Alle Dauern im Fenster 0,1–0,3 s (Auftrag)', Object.values(u).every(x => x >= 0.1 - 1e-9 && x <= 0.3 + 1e-9));

  // Clipmarken (D456): ohne Datei nichts; mit der ausgelieferten Datei für jeden Schlag jeder Waffe brauchbare Marken.
  pruefe('Clipmarken: ohne Datei leer — die Laufzeit fällt auf Clipanfang/-ende zurück', leseClipmarken(undefined).size === 0 && leseClipmarken(null).size === 0 && leseClipmarken('x').size === 0);
  const marken = leseClipmarken(CLIPMARKEN_ROH);
  const a1 = marken.get('Klinge_Hieb_A');
  pruefe('Clipmarken D456 gelesen: Klinge_Hieb_A Einstieg Bild 3, Kette Bild 12 bei 24 Bildern/s', !!a1 && nah(a1!.einstieg!, 3 / 24) && nah(a1!.kettenpose!, 12 / 24) && nah(a1!.halt!, 18 / 24));
  pruefe('Clipmarken: Huten und Deckungen tragen keine Kettenmarke', !marken.has('Klinge_Stand') && !marken.has('Axt_Block'));
  // Jeder Schlag der drei Waffen im Spiel: Die Marken liegen so, dass `hiebClipzeit` sie nimmt (Einstieg vor dem
  // Scheitel, Kettenpose zwischen Durchzug und Clipende), und die Regel bleibt, wo sie ist.
  const fehlt: string[] = [];
  for (const [art, w] of Object.entries(WAFFEN)) for (const sl of [...w.leicht, w.schwer, w.lauf]) {
    const m = sl.clip ? marken.get(sl.clip) : undefined, roh = sl.clip ? CLIPMARKEN_ROH.clips[sl.clip as keyof typeof CLIPMARKEN_ROH.clips] : undefined;
    if (!sl.clip || !sl.hieb || !m || !roh) { fehlt.push(`${art}/${sl.name}: keine Marke`); continue; }
    const hm: Hiebmarken = { scheitel: sl.hieb.scheitel, durchzug: sl.hieb.durchzug, dauer: roh.bilder / CLIPMARKEN_ROH.bildrate, ...m };
    const gut = m.einstieg! < hm.scheitel && m.kettenpose! > hm.durchzug && m.kettenpose! < hm.dauer
      && nah(hiebClipzeit('erholung', sl.erholung * KOMBO_AB, sl, hm, false, KOMBO_AB), m.kettenpose!, 1e-9)
      && nah(hiebClipzeit('vorlauf', 0, sl, hm, true, KOMBO_AB), m.einstieg!, 1e-9)
      && nah(hiebClipzeit('vorlauf', sl.vorlauf, sl, hm, true, KOMBO_AB), hm.scheitel, 1e-9)
      && nah(hiebClipzeit('aktiv', sl.aktiv, sl, hm, true, KOMBO_AB), hm.durchzug, 1e-9);
    if (!gut) fehlt.push(`${art}/${sl.name} (${sl.clip})`);
  }
  pruefe('Jeder Schlag von Klinge, Axt und Saufeder kettet über seine Marken: Kettenpose bei KOMBO_AB, Einstieg im Ausholen, Scheitel und Durchzug unberührt', fehlt.length === 0, fehlt.join('; '));
}

// ---- 3. Ebenen -------------------------------------------------------------------------------------------------
{
  const eltern = new Map<string, string | null>([
    ['root', null], ['pelvis', 'root'], ['spine_01', 'pelvis'], ['spine_02', 'spine_01'], ['spine_03', 'spine_02'],
    ['neck_01', 'spine_03'], ['Head', 'neck_01'], ['clavicle_r', 'spine_03'], ['upperarm_r', 'clavicle_r'], ['hand_r', 'upperarm_r'],
    ['thigh_l', 'pelvis'], ['calf_l', 'thigh_l'], ['foot_l', 'calf_l'], ['thigh_r', 'pelvis'], ['calf_r', 'thigh_r'], ['foot_r', 'calf_r'],
  ]);
  const ober = nachfahren(eltern, RIG_MENSCH.oberAb);
  pruefe('Oberkörper: Wirbel, Hals, Kopf, Arme — nicht Becken, Wurzel, Beine',
    ['spine_01', 'spine_03', 'Head', 'hand_r'].every(n => ober.has(n)) && ['root', 'pelvis', 'thigh_l', 'foot_r'].every(n => !ober.has(n)) && ober.size === 8);
  const spuren = ['pelvis.position', 'pelvis.quaternion', 'spine_01.quaternion', 'thigh_l.quaternion', 'hand_r.quaternion', 'Head.quaternion', 'root.position'];
  const t = teileSpuren(spuren, ober);
  pruefe('Jede Spur in genau einer Ebene', t.ober.length + t.unter.length === spuren.length && t.ober.join() === '2,4,5' && t.unter.join() === '0,1,3,6');
  pruefe('Spurname → Knochen', spurKnochen('spine_01.quaternion') === 'spine_01' && spurKnochen('Head') === 'Head');
  pruefe('Unbekannter Knochen: leere Ebene statt Fehler', nachfahren(eltern, 'gibtsnicht').size === 0);
  pruefe('Rigplan Mensch: zwei Beine, drei Wirbel', RIG_MENSCH.beine.length === 2 && RIG_MENSCH.wirbel.length === 3);
}

// ---- 4. Fuss am Boden ------------------------------------------------------------------------------------------
{
  // Hang: steigt 0,3 m je Meter nach +x (16,7°), eben in z.
  const hang = (x: number, _z: number) => 0.3 * x;
  const n = bodenNormale(hang, 2, 5);
  const kipp = Math.acos(n[1]) / GRAD;
  pruefe('Normale am Hang: 16,7° gekippt, hangabwärts (−x), Einheitslänge', nah(kipp, Math.atan(0.3) / GRAD, 1e-6) && n[0] < 0 && nah(n[2], 0, 1e-9) && nah(Math.hypot(...n), 1, 1e-12));
  const eben = bodenNormale(() => 3, 0, 0);
  pruefe('Ebener Boden: Normale senkrecht', nah(eben[1], 1, 1e-12));
  const steil = begrenzeNormale(bodenNormale((x) => 2 * x, 0, 0), 22 * GRAD);
  pruefe('Klemmung: steiler Fels kippt den Fuss höchstens 22°, Richtung bleibt', nah(Math.acos(steil[1]) / GRAD, 22, 1e-6) && steil[0] < 0 && nah(Math.hypot(...steil), 1, 1e-9));
  pruefe('Klemmung lässt flache Hänge unverändert', begrenzeNormale(n, 22 * GRAD).every((v, i) => nah(v, n[i], 1e-12)));
  pruefe('Becken sinkt um den tiefsten Fuss, nie aufwärts, höchstens 0,35 m',
    beckenSenkung([-0.12, 0.08], 0.35) === -0.12 && beckenSenkung([0.1, 0.2], 0.35) === 0 && beckenSenkung([-0.9, 0], 0.35) === -0.35);

  // Zwei-Gelenk: das Dreieck schliesst sich (Abstand aus den Winkeln zurückgerechnet).
  let schliesst = true;
  for (const d of [0.3, 0.5, 0.7, 0.85]) {
    const g = zweiGelenk(0.45, 0.42, d);
    const zurueck = Math.sqrt(0.45 * 0.45 + 0.42 * 0.42 - 2 * 0.45 * 0.42 * Math.cos(g.knie));
    const fussX = 0.45 * Math.sin(g.huefte) - 0.42 * Math.sin(Math.PI - g.knie - g.huefte);
    if (!nah(zurueck, d, 1e-9) || Math.abs(fussX) > 1e-9 || !g.erreicht) schliesst = false;
  }
  pruefe('Zwei-Gelenk-IK: Fuss liegt genau im Zielabstand auf der Linie Hüfte → Ziel', schliesst);
  const zuWeit = zweiGelenk(0.45, 0.42, 1.2);
  pruefe('Ziel ausser Reichweite: Bein streckt sich, meldet es, kein NaN', !zuWeit.erreicht && zuWeit.knie > 3.1 && Number.isFinite(zuWeit.huefte));

  // Standfuss: Der Körper geht mit 1 m/s über den stehenden Fuss; der Clip schöbe ihn nur mit 0,8 m/s zurück.
  const w = FIGUR.fuss, s = neuerStandfuss(), dt = 1 / 60;
  let maxRutsch = 0, maxSprung = 0, vorX = 0, geloest = false, wieder = false;
  for (let i = 0; i < 90; i++) {
    const t = i * dt, hub = i < 55 ? 0.01 : i < 70 ? 0.12 : 0.01;   // steht, hebt ab, setzt wieder auf
    const fx = 0.1 * t;                                            // Clip-Fuss rutscht mit 0,1 m/s in der Welt
    fuehreStandfuss(s, fx, 0, hub, dt, w);
    const weltX = fx + s.ox;
    if (i > 0 && i < 55 && s.fest) maxRutsch = Math.max(maxRutsch, Math.abs(weltX - 0));
    if (i > 0) maxSprung = Math.max(maxSprung, Math.abs(weltX - vorX));
    if (i >= 55 && i < 70 && !s.fest) geloest = true;
    if (i >= 80 && s.fest) wieder = true;
    vorX = weltX;
  }
  pruefe('Standfuss: steht in der Welt still, solange er laut Clip steht (Rutschen 0 statt 0,1 m/s)', maxRutsch < 1e-9, `${maxRutsch}`);
  pruefe('Standfuss: löst beim Abheben und fasst nach dem Aufsetzen neu', geloest && wieder);
  pruefe('Standfuss: kein Sprung beim Lösen und Fassen (höchstens 2,5 cm je Bild)', maxSprung < 0.025, `${(maxSprung * 100).toFixed(2)} cm`);
  const s2 = neuerStandfuss();
  let groesster = 0;
  for (let i = 0; i < 120; i++) { fuehreStandfuss(s2, 1.5 * i * dt, 0, 0.01, dt, w); groesster = Math.max(groesster, Math.hypot(s2.ox, s2.oz)); }
  pruefe('Standfuss: hält nie weiter als haltMax fest (Bein wird nicht überstreckt)', groesster <= w.haltMax + 1e-9, `${groesster}`);
  const s3 = neuerStandfuss();
  fuehreStandfuss(s3, 0, 0, 0.01, dt, w); fuehreStandfuss(s3, 0.05, 0, 0.01, dt, w);
  fuehreStandfuss(s3, 0.06, 0, 0.01, dt, w, false);
  pruefe('Standfuss: in der Luft/Rolle (nicht erlaubt) sofort gelöst', !s3.fest);
}

// ---- 5. Fortbewegung -------------------------------------------------------------------------------------------
{
  // Fussbahn eines Gangclips: 0,5 s Stand (Fuss wandert mit 1,6 m/s nach hinten), 0,5 s Schwung nach vorn in der Luft.
  const bahn: Bahnpunkt[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, steht = t <= 0.5;
    bahn.push({ t, x: 0.1, y: steht ? 0.08 : 0.08 + 0.15 * Math.sin((t - 0.5) * 2 * Math.PI), z: steht ? 0.4 - 1.6 * t : -0.4 + 1.6 * (t - 0.5) });
  }
  const v = natuerlichesTempo(bahn, FIGUR.gang.standHoehe);
  pruefe('Tempo am Clip gemessen: 1,6 m/s aus der Standphase der Fussbahn', v !== null && nah(v!, 1.6, 0.02), `${v}`);
  pruefe('Stand-Clip (Fuss bewegt sich nicht): kein Tempo, Rückfall auf die Daten', natuerlichesTempo(bahn.map(p => ({ ...p, z: 0, y: 0.08 })), 0.04) === null);

  const mitte = standMitte(bahn, FIGUR.gang.standHoehe);
  pruefe('Standmitte: Fuss steht von Phase 0 bis 0,5 → Mitte 0,25', mitte !== null && nah(mitte!, 0.25, 0.02), `${mitte}`);
  const spaeter = standMitte(bahn.map((p, i, alle) => ({ ...p, y: alle[(i + 30) % 40].y })), FIGUR.gang.standHoehe);
  pruefe('Standmitte: über das Clipende hinweg (Kreismittel), verschobener Clip → verschobene Mitte', spaeter !== null && nah(spaeter!, 0.5, 0.03), `${spaeter}`);

  // Die Clips, wie sie am 23.11.2026 gemessen wurden (`held-clips.glb`): Walk 1,03 m/s bei 1,667 s, Run 2,07 m/s bei 1,0 s.
  const gehen = { tempo: 1.03, dauer: 1.667 }, rennen = { tempo: 2.07, dauer: 1.0 };
  const g = FIGUR.gang;
  const lauf = gangMischung(BEWEGUNG.laufen.gehen, gehen, rennen, g), renn = gangMischung(BEWEGUNG.laufen.rennen, gehen, rennen, g);
  const fuss = (m: typeof lauf) => m.rate * m.weite * m.strecke;
  pruefe('Kein Gleiten im Laufschritt 4,2 m/s: Rate × Weite × Strecke je Zyklus = Tempo', Math.abs(lauf.gleiten) < 1e-9 && nah(fuss(lauf), BEWEGUNG.laufen.gehen, 1e-9), `${fuss(lauf)}`);
  pruefe('Laufschritt: Frequenz und Weite teilen sich den Faktor (rund 1,45 × 1,4), 170–180 Schritte/min wie ein Mensch bei 4,2 m/s',
    lauf.rennen === 1 && lauf.weite <= g.weiteMax + 1e-9 && lauf.rate * 120 > 165 && lauf.rate * 120 < 185, `Rate ${lauf.rate.toFixed(2)}/s, Weite ${lauf.weite.toFixed(2)}`);
  pruefe('Rennen 8,5 m/s: beide am Anschlag, das Gleiten wird beziffert statt versteckt (Sprintclip fehlt)',
    nah(renn.rate, g.rateMax, 1e-9) && nah(renn.weite, g.weiteMax, 1e-9) && renn.gleiten > 0.15 && renn.gleiten < 0.35, `gleitet ${(renn.gleiten * 100).toFixed(0)} %`);
  pruefe('Zum Vergleich vor D457: Walk ×2,4 bei 4,2 m/s deckte 2,5 m/s — 41 % Gleiten', nah(1 - (2.4 * 1.03) / 4.2, 0.41, 0.01));
  pruefe('Bei genau dem Clip-Tempo: Rate und Weite 1', [1.03, 2.07].every(v => { const m = gangMischung(v, gehen, rennen, g); return nah(m.weite, 1, 1e-9) && nah(m.gleiten, 0, 1e-9); })
    && nah(gangMischung(1.03, gehen, rennen, g).rate, 1 / 1.667, 1e-9) && nah(gangMischung(2.07, gehen, rennen, g).rate, 1, 1e-9));
  let stetig = true, ohneGleiten = true, vorM = gangMischung(0.5, gehen, rennen, g);
  for (let x = 0.5; x <= 9; x += 0.05) {
    const m = gangMischung(x, gehen, rennen, g);
    if (Math.abs(m.rate - vorM.rate) > 0.06 || Math.abs(m.weite - vorM.weite) > 0.06) stetig = false;
    if (x <= 5.5 && Math.abs(m.gleiten) > 1e-9) ohneGleiten = false;
    vorM = m;
  }
  pruefe('Rate und Weite über das Tempo stetig (kein Sprung an einer Gangschwelle)', stetig);
  pruefe('Von 0,5 bis 5,5 m/s kein Gleiten', ohneGleiten);
  pruefe('Stand: nichts gleitet, nichts teilt durch null', gangMischung(0, gehen, rennen, g).gleiten === 0 && Number.isFinite(gangMischung(0, gehen, rennen, g).rate));

  const n = FIGUR.neigen;
  pruefe('Kurvenlage: Linkskurve lehnt links, Rechtskurve rechts, Stand gar nicht',
    kurvenNeigung(8.5, 0.8, n) > 0 && kurvenNeigung(8.5, -0.8, n) < 0 && kurvenNeigung(0, 3, n) === 0);
  pruefe('Kurvenlage: Anteil der Physik atan(v·ω/g), geklemmt', nah(kurvenNeigung(4.2, 0.3, n), Math.atan(4.2 * 0.3 / 9.81) * n.kurve, 1e-12)
    && nah(kurvenNeigung(8.5, 20, n), n.kurveMaxGrad * GRAD, 1e-12));
  pruefe('Anlaufen lehnt vor, Abstoppen zurück, geklemmt', schubNeigung(6, n) > 0 && schubNeigung(-6, n) < 0 && nah(schubNeigung(500, n), n.schubMaxGrad * GRAD, 1e-12));

  // Drehkette: Blick springt um 90° nach links.
  const k = neueDrehkette(), d = FIGUR.drehen, dt = 1 / 60;
  drehSchritt(k, 0, dt, d);
  let ordnung = true, grenze = true, maxKopf = 0;
  for (let i = 0; i < 120; i++) {
    const r = drehSchritt(k, Math.PI / 2, dt, d);
    if (r.schulter < -1e-9 || r.kopf < -1e-9) ordnung = false;
    if (Math.PI / 2 - r.huefte > d.maxGrad * GRAD + 1e-9) grenze = false;
    maxKopf = Math.max(maxKopf, r.kopf + r.schulter);
  }
  const ende = drehSchritt(k, Math.PI / 2, dt, d);
  pruefe('Drehkette: Kopf vor Schultern vor Hüfte, zu jeder Zeit', ordnung);
  pruefe('Drehkette: Hüfte hängt nie weiter zurück als maxGrad', grenze && maxKopf > 0.05 && maxKopf <= d.maxGrad * GRAD + 1e-9, `Kopf vor Hüfte bis ${(maxKopf / GRAD).toFixed(1)}°`);
  pruefe('Drehkette: kommt an und steht gerade', nah(ende.huefte, Math.PI / 2, 1e-3) && Math.abs(ende.schulter) < 1e-3 && Math.abs(ende.kopf) < 1e-3);
  const k2 = neueDrehkette(); drehSchritt(k2, 3.1, dt, d);
  const um = drehSchritt(k2, -3.1, dt, d);
  pruefe('Drehkette: über ±180° den kurzen Weg (kein Kreisel)', um.huefte > 3.1 - 1e-9 && um.huefte < 3.2);
  const k3 = neueDrehkette(); drehSchritt(k3, 0, dt, d);
  const straff = drehSchritt(k3, 1, dt, d, 1);
  pruefe('Drehkette straff (im Schlag): ohne Verzögerung, die Figur zeigt, wohin die Regel schlägt', nah(straff.huefte, 1, 1e-12) && straff.schulter === 0 && straff.kopf === 0);

  // Blick: Figur schaut nach Norden (−Z), Gier 0.
  const b = FIGUR.blick, kopf = [0, 1.6, 0] as const;
  const vorn = blickWinkel(kopf, [0, 1.6, -5], 0, b), links = blickWinkel(kopf, [-5, 1.6, -5], 0, b);
  pruefe('Blick: Ziel geradeaus → 0; Ziel links vorn → +45°', vorn.gilt && nah(vorn.gier, 0, 1e-9) && nah(links.gier, 45 * GRAD, 1e-9));
  const seit = blickWinkel(kopf, [5, 1.6, 0.5], 0, b);
  pruefe('Blick: Grenze 70° — der Kopf dreht nicht über die Schulter', seit.gilt && nah(seit.gier, -b.gierMaxGrad * GRAD, 1e-9));
  pruefe('Blick: Ziel im Rücken → aufgegeben statt am Anschlag', !blickWinkel(kopf, [0.5, 1.6, 5], 0, b).gilt);
  const hoch = blickWinkel(kopf, [0, 9, -2], 0, b), tief = blickWinkel(kopf, [0, 0.6, -3], 0, b);
  pruefe('Blick: Nick geklemmt auf ±30°, tief = negativ', nah(hoch.nick, b.nickMaxGrad * GRAD, 1e-9) && tief.nick < 0 && tief.nick > -b.nickMaxGrad * GRAD);
  pruefe('Blick: relativ zur Körperrichtung', nah(blickWinkel(kopf, [-5, 1.6, -5], 45 * GRAD, b).gier, 0, 1e-9));

  const a = neuerAtem(), aw = FIGUR.atem;
  let max = 0, wechsel = 0, vorH = 0;
  for (let i = 0; i < 600; i++) { const h = atemSchritt(a, 0, 1 / 60, aw); max = Math.max(max, Math.abs(h)); if (i && Math.sign(h) !== Math.sign(vorH)) wechsel++; vorH = h; }
  pruefe('Atem in Ruhe: 0,25 Hz (15 Züge/min), Hub unter 1°', wechsel >= 4 && wechsel <= 6 && max <= aw.hubGrad * GRAD + 1e-9 && max > aw.hubGrad * GRAD * 0.9, `${wechsel} Nulldurchgänge in 10 s`);
  for (let i = 0; i < 600; i++) atemSchritt(a, 1, 1 / 60, aw);
  const last = a.last;
  for (let i = 0; i < 600; i++) atemSchritt(a, 0, 1 / 60, aw);
  pruefe('Atem: nach 10 s Rennen schwer, 10 s später erholt er sich, ist aber noch nicht ruhig', last > 0.9 && a.last < last * 0.5 && a.last > 0.1, `${last.toFixed(2)} → ${a.last.toFixed(2)}`);
}

// ---- 6. Treffer ------------------------------------------------------------------------------------------------
{
  const w = FIGUR.treffer, dt = 1 / 120;
  const lauf = (schaden: number, wx: number, wz: number, faktor = 1) => {
    const a = neueTrefferantwort();
    stosseFigur(a, wx, wz, schaden, w, faktor);
    let scheitel = 0, sx = 0, sz = 0, nach = 0, ende: [number, number] = [0, 0];
    for (let i = 0; i < 360; i++) {
      const [x, z] = trefferSchritt(a, dt, w);
      const m = Math.hypot(x, z);
      if (m > scheitel) { scheitel = m; sx = x; sz = z; }
      if (i === 119) nach = m;
      ende = [x, z];
    }
    return { scheitel, sx, sz, nach, ende };
  };
  const leicht = lauf(10, 0, 1), schwer = lauf(30, 0, 1), riesig = lauf(500, 0, 1);
  pruefe('Treffer: Scheitel der Kippung = Grad je Schaden (10 → 3°, 30 → 9°)', nah(leicht.scheitel, trefferKippung(10, w), 0.02 * trefferKippung(10, w)) && nah(schwer.scheitel / GRAD, 9, 0.2), `${(leicht.scheitel / GRAD).toFixed(2)}° / ${(schwer.scheitel / GRAD).toFixed(2)}°`);
  pruefe('Treffer: geklemmt bei maxGrad', nah(riesig.scheitel / GRAD, w.maxGrad, 0.3));
  const schraeg = lauf(20, 0.6, -0.8);
  pruefe('Treffer: kippt vom Angreifer weg (Richtung bleibt)', schraeg.sx > 0 && schraeg.sz < 0 && nah(schraeg.sx / schraeg.sz, 0.6 / -0.8, 1e-6));
  pruefe('Treffer: nach 1 s unter einem Zehntel, nach 3 s Ruhe', schwer.nach < schwer.scheitel * 0.1 && schwer.ende[0] === 0 && schwer.ende[1] === 0, `${(schwer.nach / GRAD).toFixed(2)}°`);
  pruefe('Treffer: Einstellung 0 schaltet ab, 0,5 halbiert', lauf(30, 0, 1, 0).scheitel === 0 && nah(lauf(30, 0, 1, 0.5).scheitel, schwer.scheitel / 2, 1e-6));
}

// ---- 7. Kosten -------------------------------------------------------------------------------------------------
let kosten = '';
{
  // Hauptfigur: 65 Knochen. Ein Bild = Trägheit anwenden (schlimmster Fall: alle Knochen klingen ab) + Federn + Füsse.
  const n = 65, z = neueTraegheit(n);
  const a = new Float32Array(4 * n), b = new Float32Array(4 * n), c = new Float32Array(4 * n), la = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    const w = 0.3 + i * 0.01;
    a[i * 4 + 1] = Math.sin(w / 2); a[i * 4 + 3] = Math.cos(w / 2);
    b[i * 4 + 1] = Math.sin(w / 2 - 0.01); b[i * 4 + 3] = Math.cos(w / 2 - 0.01);
    c[i * 4 + 3] = 1;
  }
  const pose = new Float32Array(4 * n), lage = new Float32Array(3 * n);
  const kette = neueDrehkette(), atem = neuerAtem(), tr = neueTrefferantwort(), f1 = neuerStandfuss(), f2 = neuerStandfuss();
  const boden = (x: number, zz: number) => 0.2 * x + 0.1 * Math.sin(zz);
  const runden = 20000;
  let senke = 0;
  const t0 = performance.now();
  for (let r = 0; r < runden; r++) {
    if (r % 12 === 0) starteUebergang(z, a, b, c, 1 / 60, 0.2, la, la, la);
    pose.set(c); wendeAn(z, pose, 1 / 60, lage);
    const d = drehSchritt(kette, r * 0.01, 1 / 60, FIGUR.drehen);
    senke += d.kopf + atemSchritt(atem, 0.5, 1 / 60, FIGUR.atem) + trefferSchritt(tr, 1 / 60, FIGUR.treffer)[0];
    senke += kurvenNeigung(4.2, 0.5, FIGUR.neigen) + blickWinkel([0, 1.6, 0], [3, 1, -4], d.huefte, FIGUR.blick).gier;
    fuehreStandfuss(f1, r * 0.001, 0, 0.01, 1 / 60, FIGUR.fuss); fuehreStandfuss(f2, r * 0.001, 0.2, 0.1, 1 / 60, FIGUR.fuss);
    senke += bodenNormale(boden, r * 0.001, 0)[1] + bodenNormale(boden, r * 0.001, 0.2)[1] + zweiGelenk(0.45, 0.42, 0.8).knie;
    senke += gangMischung(4.2, { tempo: 1.03, dauer: 1.667 }, { tempo: 2.07, dauer: 1 }, FIGUR.gang).rate;
  }
  const je = (performance.now() - t0) / runden;
  kosten = `${(je * 1000).toFixed(1)} µs je Bild für die reinen Teile (65 Knochen, alle im Abklingen; dieser Rechner, Node ${process.version})`;
  pruefe('Kosten der reinen Teile weit unter dem Ziel 0,3 ms je Bild (hier Grenze 0,15 ms, grosszügig für CI)', je < 0.15 && Number.isFinite(senke), kosten);
}

console.log(`\nFigurlaufzeit — ${kosten}`);
console.log(`${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
