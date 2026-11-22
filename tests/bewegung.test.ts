/**
 * Tests für Fall, Aufprall, Kälte und die Bewegungswerte aus D411/D412.
 *
 * Festgehalten wird, was die Physik-Prüfung (`docs/design/BRACHLAND_Physik-Pruefung_v1.md`) zur Regel
 * gemacht hat und was beim nächsten Drehen an einer Zahl unbemerkt kippen würde:
 *
 * 1. **Fallschaden am Aufprall.** Schadlos bis 4,5 m, tödlich ab 15 m, Rolle halbiert darunter. Ein
 *    Sprung (1,49 m) und eine Gleiterlandung (4 m/s) kosten nie etwas.
 * 2. **Endgeschwindigkeit** 53 m/s, nur nach unten.
 * 3. **Kälteuhr**: voll bis 4 min, leer nach 10 min, Ufer setzt zurück, Anzug hält an.
 * 4. **Tempi**: Rennen 8,5 unter dem 100-m-Weltrekord, Reiten 5 / 13 schneller als Rennen, der
 *    Schalter `?renntempo=` lässt nur die Probewerte zu.
 */
import {
  FALL_MAX, begrenzeFall, fallhoeheAus, fallschaden, kaelteLeben, kaelteSchritt, neueKaelte, type Kaelte,
} from '../src/spieler/bewegung.js';
import { ABSPRUNG, BEWEGUNG, GEHEN, KLETTERN_TEMPO, RENNEN, SCHWERKRAFT, SPRUNGHOEHE, renntempoAusAdresse } from '../src/spieler/tempo.js';
import { GLEIT_SINKEN, GLEIT_TEMPO } from '../src/spieler/gleiten.js';
import { REITEN_GEHEN, REITEN_RENNEN } from '../src/spiel/reiten.js';
import { Bewegung } from '../src/data/schema.js';

let ok = 0, fehler = 0;
function pruefe(was: string, bedingung: boolean, notiz = '') {
  console.log(`  ${bedingung ? '✓' : '✗'} ${was.padEnd(58)} ${notiz}`);
  bedingung ? ok++ : fehler++;
}

/** Aufprallgeschwindigkeit aus einer Fallhöhe, m/s (ohne Endgeschwindigkeit, für kleine Höhen). */
const aus = (meter: number) => Math.sqrt(2 * SCHWERKRAFT * meter);

console.log('Bewegung — Fall, Kälte, Tempi (D412)\n');

// ---- Die Daten selbst ---------------------------------------------------------
{
  const r = Bewegung.safeParse(BEWEGUNG);
  pruefe('content/bewegung.json passt zum Schema', r.success,
         r.success ? '' : r.error.issues.map(i => i.path.join('.')).join(', '));
  pruefe('Tauchen und Tragtier sind als Entwurf markiert',
         BEWEGUNG.tauchen.status === 'entwurf' && BEWEGUNG.tragtier.status === 'entwurf');
  pruefe('Tragtier hat keine Kampfwerte', BEWEGUNG.tragtier.kampfwerte === null);
  const t = BEWEGUNG.tragtier;
  pruefe('Das leichteste Tragtier trägt den Reiter bei 20 %', t.masse.min * t.traglastAnteil >= t.reiterLast,
         `${t.masse.min} kg × ${t.traglastAnteil} = ${(t.masse.min * t.traglastAnteil).toFixed(0)} kg`);
  // Gegenprobe: Der Keiler aus D391 (140 kg) hätte es nicht getan.
  pruefe('… der Keiler aus D391 nicht', 140 * t.traglastAnteil < t.reiterLast, `${140 * t.traglastAnteil} kg`);
}

// ---- Fallschaden --------------------------------------------------------------
{
  pruefe('Gleichwertige Fallhöhe ist v²/2g', Math.abs(fallhoeheAus(aus(10)) - 10) < 1e-9);
  pruefe('Ein Sprung kostet nichts', fallschaden(ABSPRUNG) === 0, `${SPRUNGHOEHE.toFixed(2)} m`);
  pruefe('Gleiterlandung kostet nichts', fallschaden(GLEIT_SINKEN) === 0,
         `${GLEIT_SINKEN} m/s = ${fallhoeheAus(GLEIT_SINKEN).toFixed(2)} m`);
  pruefe('4,5 m sind gerade noch schadlos', fallschaden(aus(4.5) - 1e-9) === 0);
  pruefe('Knapp darüber beginnt der Schaden', fallschaden(aus(4.6)) > 0, `${fallschaden(aus(4.6)).toFixed(3)}`);
  const mitte = fallschaden(aus(9.75));
  pruefe('Auf halbem Weg (9,75 m) die Hälfte', Math.abs(mitte - 0.5) < 1e-9, `${mitte.toFixed(3)}`);
  pruefe('Rolle halbiert', Math.abs(fallschaden(aus(9.75), true) - 0.25) < 1e-9);
  pruefe('Ab 15 m tödlich', fallschaden(aus(15)) === 1);
  pruefe('Ab 15 m hilft auch die Rolle nicht', fallschaden(aus(15), true) === 1);
  pruefe('Schaden wächst mit der Höhe', fallschaden(aus(8)) < fallschaden(aus(12)));
  // Die Folge, die die Prüfung genannt hat: Wer in 13 m Höhe an der Wand erschöpft, fällt fast tödlich.
  pruefe('Erschöpft in 13 m Höhe ist fast tödlich', fallschaden(aus(13)) > 0.8, `${fallschaden(aus(13)).toFixed(2)}`);
  pruefe('Negative Geschwindigkeit ist kein Aufprall', fallschaden(-20) === 0);
}

// ---- Endgeschwindigkeit -------------------------------------------------------
{
  pruefe('Endgeschwindigkeit 53 m/s', FALL_MAX === 53);
  pruefe('Schneller Fall wird begrenzt', begrenzeFall(-99) === -FALL_MAX);
  pruefe('Langsamer Fall bleibt', begrenzeFall(-20) === -20);
  pruefe('Nach oben wird nichts begrenzt', begrenzeFall(ABSPRUNG) === ABSPRUNG);
  // Bildschleife nachgestellt: 500 m frei, 60 Bilder je Sekunde.
  let y = 500, v = 0;
  const dt = 1 / 60;
  while (y > 0) { v = begrenzeFall(v - SCHWERKRAFT * dt); y += v * dt; }
  pruefe('Aus 500 m mit 53 statt 99 m/s', Math.abs(-v - FALL_MAX) < 1e-9, `${(-v).toFixed(0)} m/s`);
  pruefe('… und tödlich', fallschaden(-v) === 1);
}

// ---- Kälteuhr -----------------------------------------------------------------
{
  const k = BEWEGUNG.kaelte;
  /** `sek` Sekunden in Schritten von 1/60 s. */
  const lauf = (z: Kaelte, sek: number, tief = true, anzug = false) => {
    for (let t = 0; t < sek - 1e-9; t += 1 / 60) z = kaelteSchritt(z, 1 / 60, tief, anzug);
    return z;
  };
  pruefe('Werte: sinkt nach 4 min, leer nach 10 min', k.sinktNach === 240 && k.leerNach === 600);
  pruefe('Frisch im Wasser voll', kaelteLeben(neueKaelte()) === 1);
  pruefe('Nach 3 min noch voll', kaelteLeben(lauf(neueKaelte(), 180)) === 1);
  const sieben = kaelteLeben(lauf(neueKaelte(), 420));
  pruefe('Nach 7 min halb', Math.abs(sieben - 0.5) < 0.01, `${sieben.toFixed(3)}`);
  pruefe('Nach 10 min leer', kaelteLeben(lauf(neueKaelte(), 600.1)) === 0);
  pruefe('Am Ufer zurück auf null', kaelteSchritt(lauf(neueKaelte(), 300), 1 / 60, false, false).sekunden === 0);
  pruefe('Mit Anzug läuft sie nicht', lauf(neueKaelte(), 900, true, true).sekunden === 0);
  pruefe('Anzug hält an, wo sie steht', kaelteSchritt({ sekunden: 100 }, 5, true, true).sekunden === 100);
  const z = { sekunden: 50 };
  kaelteSchritt(z, 1, true, false);
  pruefe('Eingabezustand bleibt unverändert', z.sekunden === 50);
  // Die Folge aus der Prüfung (§4.4): Die Kapelle (380 m, 8,6 min heute) wird knapp, der Kirchturm
  // (447 m, 10,1 min) bleibt ohne Werkzeug ausser Reichweite.
  pruefe('Kapelle (8,6 min) ist knapp, nicht leer', kaelteLeben({ sekunden: 8.6 * 60 }) > 0
         && kaelteLeben({ sekunden: 8.6 * 60 }) < 0.3, `${kaelteLeben({ sekunden: 8.6 * 60 }).toFixed(2)}`);
  pruefe('Kirchturm (10,1 min) ohne Anzug nicht', kaelteLeben({ sekunden: 10.1 * 60 }) === 0);
  pruefe('Anzug ist das Tauchzeug', k.anzug === 'tauchzeug');
}

// ---- Tempi --------------------------------------------------------------------
{
  pruefe('Laufschritt 4,2 m/s bleibt', GEHEN === 4.2);
  pruefe('Rennen 8,5 m/s (ohne Adresse)', RENNEN === 8.5, `${RENNEN}`);
  pruefe('Rennen unter dem 100-m-Weltrekord (10,44 m/s)', RENNEN < 10.44);
  pruefe('Reiten 5 / 13 m/s', REITEN_GEHEN === 5 && REITEN_RENNEN === 13);
  pruefe('Reiten im Galopp schneller als Rennen', REITEN_RENNEN > RENNEN, `×${(REITEN_RENNEN / RENNEN).toFixed(2)}`);
  pruefe('Gleiten schneller als Rennen', GLEIT_TEMPO > RENNEN);
  pruefe('Klettern 1,0 m/s', KLETTERN_TEMPO === 1.0);
  // Sprung aus dem Rennen: Flugzeit 2·v/g, Weite = Renntempo × Flugzeit. War 12,1 m bei 11 m/s.
  const weite = RENNEN * (2 * ABSPRUNG / SCHWERKRAFT);
  pruefe('Sprung aus dem Rennen rund 9,4 statt 12,1 m', Math.abs(weite - 9.36) < 0.05, `${weite.toFixed(2)} m`);
  pruefe('Tauchtempo im Entwurf 2,25 statt 6 m/s', BEWEGUNG.tauchen.tempo === 2.25);
}

// ---- Schalter für den Vergleich am M1 -----------------------------------------
{
  pruefe('?renntempo=7 gibt 7,0', renntempoAusAdresse('?renntempo=7') === 7);
  pruefe('?renntempo=7,0 gibt 7,0', renntempoAusAdresse('?renntempo=7,0') === 7);
  pruefe('?renntempo=8.5 gibt 8,5', renntempoAusAdresse('?renntempo=8.5') === 8.5);
  pruefe('Ohne Schalter der Standard', renntempoAusAdresse('?echt=1') === 8.5);
  pruefe('Ein anderer Wert erfindet kein drittes Tempo', renntempoAusAdresse('?renntempo=11') === 8.5);
  pruefe('Unsinn gibt den Standard', renntempoAusAdresse('?renntempo=schnell') === 8.5);
}

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if (fehler > 0) process.exit(1);
