/**
 * Tests für die vier Zustände, die Narben und die neuen Kampfregeln.
 *
 * Anlass ist die Creature Design Bible v1.1: Sie nennt vier Zustände mit konkreten
 * Zahlen, der Code kannte drei ohne Narben. Beim Zusammenführen kamen drei Befunde
 * heraus, und dieser Test hält alle drei fest:
 *
 * 1. **Resistenz und Verteidigung wären derselbe Effekt gewesen.** Das Blatt nennt
 *    „+20 % Resistenz" und „+30 % Verteidigung" — beides wäre auf `ver` gelaufen.
 *    Deshalb stumpft `resistenz` jetzt den **Elementnachteil** ab und `panzer` hebt
 *    `ver`. Der Test prüft, dass sie sich unterschiedlich verhalten.
 * 2. **Krit gab es nicht.** Die Wildling-Narbe hätte auf nichts gezeigt.
 * 3. **Move-Effekte wurden nie angewendet.** `moveDef` warf sie weg — alle 49 Moves
 *    trugen Wirkungen, die die Engine nie gesehen hat.
 *
 * Seit G-56 kommen die fünf restlichen Effektarten dazu — Zehrung, Wechselsperre,
 * Heilung, Befall, Reinigung — und mit der Reinigung der einzige Weg zum vierten
 * Zustand. `mehrfachtreffer` bleibt offen; auch das steht als Test hier, damit die
 * Lücke auffällt, sobald ein Move sie nutzt.
 */
import { NARBE } from '../src/data/schema.js';
import {
  REGELN, darfWechseln, erstelle, fangbarImZustand, iniEff, reinige, rng, schlag,
  stufenFaktor, tickeWirkungen, trefferchance, waehleWechsel, wendeWirkungenAn,
  type Kaempfer, type MoveDef, type Zustand,
} from '../src/engine/battle.js';

let ok = 0, fehler = 0;
function pruefe(was: string, bedingung: boolean, notiz = '') {
  console.log(`  ${bedingung ? '✓' : '✗'} ${was.padEnd(52)} ${notiz}`);
  bedingung ? ok++ : fehler++;
}

const MOVE: MoveDef = { id: 'x', name: 'X', element: 'holz', band: 'normal' };
const HOLZ_HAU: MoveDef = { id: 'h', name: 'Holzhau', element: 'holz', band: 'normal' };

function kaempfer(zustand: Zustand, elemente: ('holz' | 'stein' | 'frost')[] = ['stein'],
                  narbe?: { art: 'krit' | 'resistenz' | 'panzer'; wert: number }): Kaempfer {
  return erstelle({
    id: 'k', name: 'K', elemente, zustand, narbe,
    maxKp: 200, ang: 60, ver: 60, ini: 50, moves: [MOVE],
  });
}

console.log('Zustände und Narben — Creature Design Bible v1.1\n');

// ---- Fangbarkeit -----------------------------------------------------------
{
  pruefe('rein ist fangbar', fangbarImZustand('rein'));
  pruefe('befallen ist fangbar', fangbarImZustand('befallen'));
  pruefe('rückgeführt ist fangbar', fangbarImZustand('rueckgefuehrt'));
  pruefe('verhärtet ist NICHT fangbar', !fangbarImZustand('verhaertet'));
}

// ---- Befall: die Zahlen des Blattes gegen die Engine -----------------------
{
  const rein = kaempfer('rein'), bef = kaempfer('befallen');
  pruefe('Befall hebt ANG um 15 %', bef.ang === Math.round(rein.ang * 1.15),
         `${rein.ang} → ${bef.ang}`);
  pruefe('Befall hebt VER um 15 %', bef.ver === Math.round(rein.ver * 1.15));
  // Der Punkt, den das Blatt mit „+20 % Rohwerte" verliert: INI profitiert WENIGER.
  pruefe('Befall hebt INI nur um 10 % — nicht 15', bef.ini === Math.round(rein.ini * 1.10),
         `${rein.ini} → ${bef.ini}`);
  pruefe('INI wächst schwächer als ANG', REGELN.BEFALL_INI < REGELN.BEFALL_ANG);
}

// ---- Rückgeführt: keine Zehrung, kein Befall-Bonus, dafür Narbe ------------
{
  const rein = kaempfer('rein');
  const rueck = kaempfer('rueckgefuehrt', ['stein'], NARBE.wildling);
  pruefe('Rückgeführt hat keinen Befall-Bonus', rueck.ang === rein.ang);
  pruefe('Rückgeführt trägt die Narbe', rueck.narbe?.art === 'krit');
  // Eine Narbe an einem nicht-zurückgeführten Kämpfer wird verworfen: Sie entsteht
  // durch die Reinigung, nicht durch die Datenlage.
  const falsch = kaempfer('befallen', ['stein'], NARBE.wildling);
  pruefe('Narbe wirkt nur bei rückgeführt', falsch.narbe === undefined);
}

// ---- Die drei Narben müssen sich UNTERSCHEIDEN -----------------------------
{
  const ohne = kaempfer('rueckgefuehrt');
  const krit = kaempfer('rueckgefuehrt', ['stein'], NARBE.wildling);
  const resi = kaempfer('rueckgefuehrt', ['stein'], NARBE.zuchtlinie);
  const panz = kaempfer('rueckgefuehrt', ['stein'], NARBE.verwachsener);

  pruefe('Krit-Narbe hebt die Volltrefferchance',
         Math.abs(krit.krit - (REGELN.KRIT_BASIS + 0.15)) < 1e-9,
         `${(krit.krit * 100).toFixed(0)} %`);
  pruefe('Panzer-Narbe hebt VER um 30 %', panz.ver === Math.round(ohne.ver * 1.3),
         `${ohne.ver} → ${panz.ver}`);
  // Der eigentliche Befund: Resistenz darf NICHT dasselbe wie Panzer sein.
  pruefe('Resistenz-Narbe lässt VER unangetastet', resi.ver === ohne.ver,
         `${resi.ver} = ${ohne.ver}`);

  // Resistenz stumpft den Elementnachteil ab. Holz schlägt Stein (Faktor 2).
  const ang = kaempfer('rein', ['holz']);
  const zufall = () => 0.5;   // trifft, mittlere Streuung, kein Krit
  const gegenOhne = schlag(ang, ohne, HOLZ_HAU, zufall).wert;
  const gegenResi = schlag(ang, resi, HOLZ_HAU, zufall).wert;
  pruefe('Resistenz senkt den Elementnachteil', gegenResi < gegenOhne,
         `${gegenOhne} → ${gegenResi}`);
  // 2,0 wird zu 1,8 — also 10 % weniger Schaden, nicht 20 %. Das ist gewollt:
  // Die Narbe nimmt 20 % des ÜBERSCHUSSES, nicht 20 % des Schadens.
  pruefe('Genau der Überschuss wird gedämpft',
         Math.abs(gegenResi / gegenOhne - 1.8 / 2.0) < 0.02,
         `${(gegenResi / gegenOhne).toFixed(3)}`);
  // Und einen Vorteil des Verteidigers lässt sie in Ruhe.
  const frostGegner = kaempfer('rueckgefuehrt', ['frost'], NARBE.zuchtlinie);
  const frostOhne = kaempfer('rueckgefuehrt', ['frost']);
  pruefe('Vorteil des Verteidigers bleibt unangetastet',
         schlag(ang, frostGegner, HOLZ_HAU, zufall).wert === schlag(ang, frostOhne, HOLZ_HAU, zufall).wert);
}

// ---- Trefferwurf und Volltreffer ------------------------------------------
console.log('\nTrefferwurf und Volltreffer\n');
{
  const a = kaempfer('rein'), d = kaempfer('rein');
  pruefe('Grundgenauigkeit 95 %', Math.abs(trefferchance(a) - 0.95) < 1e-9);
  a.genauigkeit = -2;
  pruefe('Zwei Stufen Blendung → 70 %', Math.abs(trefferchance(a) - 0.70) < 1e-9,
         `${(trefferchance(a) * 100).toFixed(0)} %`);
  a.genauigkeit = -3;
  pruefe('Nie unter der Untergrenze', trefferchance(a) >= REGELN.TREFFER_MIN,
         `${(trefferchance(a) * 100).toFixed(0)} %`);
  a.genauigkeit = 3;
  pruefe('Nie über 100 %', trefferchance(a) <= 1);

  a.genauigkeit = 0;
  // Ein Wurf über der Trefferchance ist ein Fehlschlag — und der unterscheidet
  // sich von „0 Schaden": Utility trifft immer.
  const daneben = schlag(a, d, MOVE, () => 0.99);
  pruefe('Fehlschlag macht 0 Schaden', daneben.fehlschlag && daneben.wert === 0);
  const util: MoveDef = { id: 'u', name: 'U', element: 'holz', band: 'utility' };
  pruefe('Utility geht nie daneben', !schlag(a, d, util, () => 0.99).fehlschlag);

  // Volltreffer: dritter Wurf unter der Kritchance.
  const wuerfe = [0.1, 0.5, 0.001];
  let i = 0;
  const gezielt = schlag(a, d, MOVE, () => wuerfe[i++]);
  pruefe('Volltreffer wird erkannt', gezielt.kritisch);
  i = 0;
  const normal = schlag(a, d, MOVE, () => [0.1, 0.5, 0.9][i++]);
  pruefe('Volltreffer macht mehr Schaden', gezielt.wert > normal.wert,
         `${normal.wert} → ${gezielt.wert}`);
  pruefe('Und zwar um den Faktor aus den Regeln',
         Math.abs(gezielt.wert / normal.wert - REGELN.KRIT_SCHADEN) < 0.02);
}

// ---- Statusstufen ---------------------------------------------------------
console.log('\nMove-Wirkungen — vorher wurden sie verworfen\n');
{
  pruefe('Stufe 0 ist neutral', stufenFaktor(0) === 1);
  pruefe('+2 Stufen sind +40 %', Math.abs(stufenFaktor(2) - 1.4) < 1e-9);
  pruefe('-2 Stufen sind der Kehrwert', Math.abs(stufenFaktor(-2) - 1 / 1.4) < 1e-9);
  pruefe('Nie null, auch bei -3', stufenFaktor(-3) > 0.3);
  pruefe('Gedeckelt bei ±3', stufenFaktor(9) === stufenFaktor(3));

  const a = kaempfer('rein'), d = kaempfer('rein');
  const blend: MoveDef = {
    id: 'blendlinse', name: 'Blendlinse', element: 'alt-tech', band: 'utility',
    effekte: [{ art: 'genauigkeit', stufen: -2, ziel: 'gegner' }],
  };
  const gemeldet = wendeWirkungenAn(a, d, blend);
  pruefe('Blendlinse senkt die Genauigkeit des GEGNERS', d.genauigkeit === -2 && a.genauigkeit === 0);
  pruefe('Die Änderung wird gemeldet', gemeldet.length === 1 && gemeldet[0].includes('Genauigkeit'),
         gemeldet[0] ?? '');

  // Drei Blendungen können nicht tiefer als -3 — sonst wäre ein Kämpfer wehrlos.
  wendeWirkungenAn(a, d, blend);
  wendeWirkungenAn(a, d, blend);
  pruefe('Stufen sind gedeckelt, nicht kumulativ ohne Ende', d.genauigkeit === -3,
         `${d.genauigkeit}`);
  pruefe('Keine Meldung, wenn nichts mehr passiert',
         wendeWirkungenAn(a, d, blend).length === 0);

  // Statuswert auf sich selbst.
  const b = kaempfer('rein'), c = kaempfer('rein');
  const flucht: MoveDef = {
    id: 'steilflucht', name: 'Steilflucht', element: 'stein', band: 'utility',
    effekte: [{ art: 'statuswert', wert: 'ini', stufen: 2, ziel: 'selbst' }],
  };
  const iniVor = iniEff(b);
  wendeWirkungenAn(b, c, flucht);
  pruefe('Steilflucht hebt die eigene INI', iniEff(b) > iniVor,
         `${iniVor.toFixed(0)} → ${iniEff(b).toFixed(0)}`);
  pruefe('Der Grundwert bleibt unangetastet', b.ini === c.ini,
         'Stufen werden beim Lesen angewandt, nicht eingerechnet');
}

// ---- Zehrung: die erste Wirkung mit Gedächtnis ----------------------------
console.log('\nLaufende Wirkungen — G-56\n');
{
  const wunde: MoveDef = {
    id: 'wundriss', name: 'Wundriss', element: 'holz', band: 'normal',
    effekte: [{ art: 'schaden_ueber_zeit', proRunde: 0.06, runden: 3 }],
  };
  const a = kaempfer('rein'), d = kaempfer('rein');
  wendeWirkungenAn(a, d, wunde);
  pruefe('Zehrung landet beim GEGNER, nicht beim Anwender',
         d.laufend.length === 1 && a.laufend.length === 0);

  // 6 % von 200 KP = 12 je Runde. Der Wert steht am Kämpfer, nicht am Move —
  // deshalb überlebt er einen Wechsel.
  const vorher = d.kp;
  const meldung = tickeWirkungen(d);
  pruefe('Eine Runde zehrt 6 % der maximalen KP', vorher - d.kp === 12, `${vorher} → ${d.kp}`);
  pruefe('Und meldet es', meldung.length === 1 && meldung[0].includes('Wunde'));
  pruefe('Die Restlaufzeit sinkt', d.laufend[0].runden === 2);

  tickeWirkungen(d); tickeWirkungen(d);
  pruefe('Nach drei Runden ist die Wunde weg', d.laufend.length === 0, `${d.kp} KP`);
  pruefe('Danach zehrt nichts mehr', tickeWirkungen(d).length === 0);

  // Nicht stapeln: Zwei Aufgüsse verlängern, statt zu verdoppeln. Sonst wäre ein
  // billiger Utility-Move der stärkste Angriff im Spiel.
  const e = kaempfer('rein');
  wendeWirkungenAn(a, e, wunde);
  wendeWirkungenAn(a, e, wunde);
  pruefe('Zwei Aufgüsse stapeln nicht', e.laufend.length === 1 && e.laufend[0].runden === 3);
  const einRunde = e.kp; tickeWirkungen(e);
  pruefe('Der Schaden bleibt einfach', einRunde - e.kp === 12);

  // Eine schwächere zweite Wunde darf die stärkere nicht ersetzen.
  const schwach: MoveDef = { ...wunde, effekte: [{ art: 'schaden_ueber_zeit', proRunde: 0.01, runden: 1 }] };
  wendeWirkungenAn(a, e, schwach);
  pruefe('Die stärkere Wunde gewinnt', e.laufend[0].proRunde === 0.06 && e.laufend[0].runden === 2);

  // Ein sehr kleiner Anteil darf nicht auf 0 runden — sonst ist die Wunde folgenlos.
  const winzig = kaempfer('rein');
  wendeWirkungenAn(a, winzig, { ...wunde, effekte: [{ art: 'schaden_ueber_zeit', proRunde: 0.001, runden: 1 }] });
  const kpVor = winzig.kp; tickeWirkungen(winzig);
  pruefe('Mindestens 1 Schaden je Runde', kpVor - winzig.kp === 1);

  // Ein Ausgefallener zehrt nicht weiter — sonst rutschten die KP ins Negative.
  const tot = kaempfer('rein');
  wendeWirkungenAn(a, tot, wunde);
  tot.kp = 0;
  pruefe('Ausgefallene zehren nicht weiter', tickeWirkungen(tot).length === 0 && tot.kp === 0);
}

// ---- Wechselsperre --------------------------------------------------------
{
  const halt: MoveDef = {
    id: 'wurzelgriff', name: 'Wurzelgriff', element: 'holz', band: 'utility',
    effekte: [{ art: 'wechselsperre', runden: 2 }],
  };
  const a = kaempfer('rein'), d = kaempfer('rein');
  pruefe('Ohne Wirkung darf jeder wechseln', darfWechseln(d));
  wendeWirkungenAn(a, d, halt);
  pruefe('Der Wurzelgriff hält fest', !darfWechseln(d));
  tickeWirkungen(d);
  pruefe('Nach einer Runde noch gesperrt', !darfWechseln(d));
  tickeWirkungen(d);
  pruefe('Nach zwei Runden wieder frei', darfWechseln(d));
  pruefe('Die Sperre macht keinen Schaden', d.kp === d.maxKp);

  // Und sie bindet die KI genauso. Ohne diese Zeile wäre die Sperre eine Regel,
  // die nur für den Spieler gilt.
  const gefangen = kaempfer('rein', ['stein']);
  const ersatz = kaempfer('rein', ['frost']);
  const gegner = kaempfer('rein', ['holz']);   // Holz schlägt Stein: klarer Nachteil
  gefangen.kp = 20;                             // und dazu sterbend
  const team = { kaempfer: [gefangen, ersatz], aktiv: 0 };
  pruefe('Ohne Sperre würde die KI wechseln', waehleWechsel(team, gegner) === 1);
  wendeWirkungenAn(gegner, gefangen, halt);
  pruefe('Mit Sperre bleibt die KI stehen', waehleWechsel(team, gegner) === null);
}

// ---- Heilung -------------------------------------------------------------
{
  const rast: MoveDef = {
    id: 'moosbett', name: 'Moosbett', element: 'holz', band: 'utility',
    effekte: [{ art: 'heilung', anteil: 0.25 }],
  };
  const a = kaempfer('rein'), d = kaempfer('rein');
  a.kp = 100;
  const m = wendeWirkungenAn(a, d, rast);
  pruefe('Heilung heilt den ANWENDER', a.kp === 150 && d.kp === d.maxKp, `${a.kp} KP`);
  pruefe('Und meldet den Betrag', m[0]?.includes('50 KP') === true, m[0] ?? '');

  a.kp = 190;
  wendeWirkungenAn(a, d, rast);
  pruefe('Nie über die Höchst-KP', a.kp === 200);
  pruefe('Bei voller Leiste keine Meldung', wendeWirkungenAn(a, d, rast).length === 0);

  // Ein Ausgefallener heilt nicht — dafür gibt es die Wiederbelebung.
  const tot = kaempfer('rein'); tot.kp = 0;
  wendeWirkungenAn(tot, d, rast);
  pruefe('Ausgefallene heilen sich nicht', tot.kp === 0);
}

// ---- Befall als Move-Wirkung ---------------------------------------------
{
  const sporen: MoveDef = {
    id: 'sporenstoss', name: 'Sporenstoß', element: 'holz', band: 'normal',
    effekte: [{ art: 'befall', chance: 0.3 }],
  };
  const a = kaempfer('rein');

  const d = kaempfer('rein');
  const rohAng = d.ang;
  wendeWirkungenAn(a, d, sporen, () => 0.1);
  pruefe('Wurf unter der Chance steckt an', d.zustand === 'befallen');
  pruefe('Und hebt die Rohwerte wie beim Erstellen', d.ang === Math.round(rohAng * REGELN.BEFALL_ANG),
         `${rohAng} → ${d.ang}`);

  const e = kaempfer('rein');
  wendeWirkungenAn(a, e, sporen, () => 0.9);
  pruefe('Wurf über der Chance tut nichts', e.zustand === 'rein');

  // Ohne Zufallsquelle bleibt der Befall aus — so kann die KI trocken rechnen,
  // ohne den Kampfzufall zu verschieben.
  const f = kaempfer('rein');
  wendeWirkungenAn(a, f, sporen);
  pruefe('Ohne Zufallsquelle kein Befall', f.zustand === 'rein');

  // Die beiden Endzustände sind immun.
  const hart = kaempfer('verhaertet');
  wendeWirkungenAn(a, hart, sporen, () => 0.01);
  pruefe('Verhärtet lässt sich nicht anstecken', hart.zustand === 'verhaertet');
  const rueck = kaempfer('rueckgefuehrt', ['stein'], NARBE.wildling);
  wendeWirkungenAn(a, rueck, sporen, () => 0.01);
  pruefe('Zurückgeführt lässt sich nicht neu anstecken', rueck.zustand === 'rueckgefuehrt');
  // Und ein zweiter Treffer verdoppelt den Bonus nicht.
  const angNach = d.ang;
  wendeWirkungenAn(a, d, sporen, () => 0.01);
  pruefe('Befall stapelt nicht', d.ang === angNach);
}

// ---- Rückführung: der Weg zum vierten Zustand ----------------------------
console.log('\nRückführung — reinigen ist eine Entscheidung, keine Reparatur\n');
{
  // Der Befund, der diese Funktion nötig gemacht hat: `rueckgefuehrt` stand im
  // Enum, und kein Weg führte dorthin. Der Gegenstand setzte auf `rein` zurück.
  const rein = kaempfer('rein');
  pruefe('Wer nie befallen war, lässt sich nicht reinigen',
         reinige(kaempfer('rein'), NARBE.wildling) === false);
  pruefe('Verhärtet auch nicht', reinige(kaempfer('verhaertet'), NARBE.wildling) === false);
  const schon = kaempfer('rueckgefuehrt', ['stein'], NARBE.wildling);
  pruefe('Und zweimal geht nicht', reinige(schon, NARBE.zuchtlinie) === false);
  pruefe('Die alte Narbe bleibt', schon.narbe?.art === 'krit');

  // Wildling: Krit. Die Rohwerte kehren zurück, der Befall-Bonus fällt weg.
  const wild = kaempfer('befallen');
  const kritVor = wild.krit;
  pruefe('Reinigen gelingt bei Befall', reinige(wild, NARBE.wildling));
  pruefe('Der Zustand wechselt', wild.zustand === 'rueckgefuehrt');
  pruefe('Der Befall-Bonus fällt weg', wild.ang === rein.ang && wild.ini === rein.ini,
         `ANG ${wild.ang} = ${rein.ang}`);
  pruefe('Die Krit-Narbe wirkt', Math.abs(wild.krit - (kritVor + 0.15)) < 1e-9,
         `${(wild.krit * 100).toFixed(0)} %`);
  pruefe('Ein Zurückgeführter bleibt fangbar', fangbarImZustand(wild.zustand));

  // Zuchtlinie: Resistenz. Sie ändert keine Zahl, nur eine Rechnung — deshalb
  // muss VER hier gleich bleiben und der Elementschaden sinken.
  const zucht = kaempfer('befallen');
  reinige(zucht, NARBE.zuchtlinie);
  pruefe('Resistenz lässt VER in Ruhe', zucht.ver === rein.ver, `${zucht.ver} = ${rein.ver}`);
  const holz = kaempfer('rein', ['holz']);
  const zufall = () => 0.5;
  pruefe('Aber sie senkt den Elementnachteil',
         schlag(holz, zucht, HOLZ_HAU, zufall).wert < schlag(holz, rein, HOLZ_HAU, zufall).wert);

  // Verwachsener: Panzer. Der hebt VER — und zwar auf die Rohwerte, nicht auf
  // die befallenen. Sonst würde der Befall-Bonus durch die Hintertür bleiben.
  const verw = kaempfer('befallen');
  reinige(verw, NARBE.verwachsener);
  pruefe('Panzer hebt VER um 30 % der ROHwerte', verw.ver === Math.round(rein.ver * 1.3),
         `${verw.ver} = ${Math.round(rein.ver * 1.3)}`);
  pruefe('Panzer lässt ANG unangetastet', verw.ang === rein.ang);

  // Als Move-Wirkung: Der `reinigung`-Effekt reinigt den ANWENDER, und ohne
  // übergebene Narbe passiert nichts — die Herkunft kennt die Engine nicht.
  const rmove: MoveDef = {
    // Heißt wie der Move im Bestand, nicht wie der gleichnamige Gegenstand:
    // `reinkultur` ist ein Beutel-Gegenstand, `sterilgang` der Move des K7.
    id: 'sterilgang', name: 'Sterilgang', element: 'alt-tech', band: 'utility',
    effekte: [{ art: 'reinigung' }],
  };
  const ohneNarbe = kaempfer('befallen');
  pruefe('Ohne Narbe reinigt der Move nicht',
         wendeWirkungenAn(ohneNarbe, kaempfer('rein'), rmove).length === 0
         && ohneNarbe.zustand === 'befallen');
  const mitNarbe = kaempfer('befallen');
  const gemeldet = wendeWirkungenAn(mitNarbe, kaempfer('rein'), rmove, undefined, NARBE.wildling);
  pruefe('Mit Narbe schon', mitNarbe.zustand === 'rueckgefuehrt' && gemeldet.length === 1,
         gemeldet[0] ?? '');
}

// ---- Mehrfachtreffer ist bewusst offen -----------------------------------
{
  // Kein Move im Bestand nutzt ihn (0 von 21 Effektnutzungen), und er greift in
  // `schlag` ein statt daneben: Jeder Teiltreffer bräuchte eigene Würfe. Der Test
  // hält fest, dass er *stillschweigend* nichts tut — nicht abstürzt, aber auch
  // nicht heimlich wirkt. Sobald ein Move ihn nutzt, muss dieser Test brechen.
  const mehr: MoveDef = {
    id: 'hagel', name: 'Hagel', element: 'frost', band: 'normal',
    effekte: [{ art: 'mehrfachtreffer', treffer: 3 }],
  };
  const a = kaempfer('rein'), d = kaempfer('rein');
  const vorher = JSON.stringify([a.kp, d.kp, d.laufend, d.zustand]);
  pruefe('Mehrfachtreffer meldet nichts', wendeWirkungenAn(a, d, mehr, () => 0.1).length === 0);
  pruefe('Und ändert nichts', JSON.stringify([a.kp, d.kp, d.laufend, d.zustand]) === vorher);
}

// ---- Determinismus bleibt -------------------------------------------------
{
  const lauf = () => {
    const z = rng(7);
    const a = kaempfer('rein'), d = kaempfer('rein');
    return [0, 1, 2, 3, 4].map(() => schlag(a, d, MOVE, z).wert).join(',');
  };
  pruefe('Gleicher Seed, gleiche Schläge', lauf() === lauf(), lauf());
}

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if (fehler > 0) process.exit(1);
