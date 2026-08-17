/**
 * Tests für das Gleiten — der letzte der sechs Traversal-Verben (G-44).
 *
 * Die Zahlen kommen aus `npm run gleit`: 9.600 simulierte Flüge über das echte
 * Höhenfeld, in drei Gleitverhältnissen. 3:1 hat gewonnen, weil 2:1 gegen die
 * 11,0 m/s Rennen nur 0,7 s spart und 4:1 mit 2,9 km Spitzenweite den Rest der
 * Karte zur Kulisse macht.
 *
 * Geprüft wird hier nicht die Weite — die hängt am Gelände und misst das Werkzeug.
 * Geprüft wird die **Regel**: wann der Gleiter aufgeht, wann nicht, und dass er
 * bremst statt zu ziehen.
 */
import {
  GLEIT_AB, GLEIT_SINKEN, GLEIT_TEMPO, GLEIT_VERHAELTNIS,
  bremse, fallgeschwindigkeit, flugdauer, gleitSchritt, gleiterFrei, neuerFall, reichweite,
} from '../src/spieler/gleiten.js';
import { ABSPRUNG, RENNEN, SPRUNGHOEHE, fussweg } from '../src/spieler/tempo.js';

let ok = 0, fehler = 0;
function pruefe(was: string, bedingung: boolean, notiz = '') {
  console.log(`  ${bedingung ? '✓' : '✗'} ${was.padEnd(54)} ${notiz}`);
  bedingung ? ok++ : fehler++;
}

/** Ein Fall aus `hoehe` Metern, Bild für Bild. Gibt zurück, was dabei passiert. */
function falle(hoehe: number, frei: boolean, faltenBei = -1) {
  let fall = neuerFall(hoehe);
  let y = hoehe, steigen = 0, t = 0, gleitBilder = 0, strecke = 0;
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 120 && y > 0; i++) {
    steigen -= 9.81 * dt;
    const s = gleitSchritt(fall, {
      y, steigen, amBoden: false, gesperrt: false, frei,
      falten: faltenBei >= 0 && t >= faltenBei && t < faltenBei + dt,
    });
    fall = s.fall;
    if (s.gleitet) { steigen = bremse(steigen); gleitBilder++; strecke += GLEIT_TEMPO * dt; }
    y += steigen * dt;
    t += dt;
  }
  return { dauer: t, aufschlag: -steigen, gleitBilder, strecke };
}

console.log('Gleiten — Regel, nicht Reichweite\n');

// ---- Freischaltung --------------------------------------------------------
{
  pruefe('Ohne besiegten Regenten kein Gleiter', !gleiterFrei([]));
  pruefe('Mit dem Flussvater ist er frei', gleiterFrei(['flussvater']));
}

// ---- Wann geht er auf? ----------------------------------------------------
{
  const e = { y: 100, steigen: -5, amBoden: false, gesperrt: false, frei: true, falten: false };

  pruefe('Am Boden nie', !gleitSchritt(neuerFall(100), { ...e, amBoden: true }).gleitet);
  pruefe('Ohne Gleiter nie', !gleitSchritt(neuerFall(100), { ...e, frei: false }).gleitet);
  pruefe('Gesperrt nie', !gleitSchritt(neuerFall(100), { ...e, gesperrt: true }).gleitet);
  // Im Steigflug darf nichts aufgehen — sonst bremst der Gleiter den Sprung ab.
  pruefe('Beim Steigen nie', !gleitSchritt(neuerFall(100), { ...e, steigen: 3 }).gleitet);

  // Der Scheitel wird nachgeführt, die Fallhöhe daran gemessen.
  const knappDrunter = gleitSchritt({ scheitel: 100, gefaltet: false },
    { ...e, y: 100 - GLEIT_AB + 0.1 });
  const knappDrueber = gleitSchritt({ scheitel: 100, gefaltet: false },
    { ...e, y: 100 - GLEIT_AB - 0.1 });
  pruefe(`Unter ${GLEIT_AB} m Fallhöhe noch nicht`, !knappDrunter.gleitet,
         `${knappDrunter.fallhoehe.toFixed(1)} m`);
  pruefe('Darüber schon', knappDrueber.gleitet, `${knappDrueber.fallhoehe.toFixed(1)} m`);
}

// ---- Ein Sprung darf kein Flug werden ------------------------------------
{
  // Der eigentliche Grund für GLEIT_AB: Ein Sprung erreicht 1,49 m Scheitel und
  // fällt genau so tief zurück. Läge die Schwelle darunter, schwebte man über
  // jede Geländestufe — und das Gelände ist voll davon.
  pruefe('Die Schwelle liegt über der Sprunghöhe', GLEIT_AB > SPRUNGHOEHE,
         `${GLEIT_AB} m gegen ${SPRUNGHOEHE.toFixed(2)} m`);
  let fall = neuerFall(0);
  let y = 0, steigen = ABSPRUNG, offen = false;
  for (let i = 0; i < 200 && (i === 0 || y > 0); i++) {
    steigen -= 9.81 / 60;
    const s = gleitSchritt(fall, { y, steigen, amBoden: false, gesperrt: false, frei: true, falten: false });
    fall = s.fall;
    if (s.gleitet) offen = true;
    y += steigen / 60;
  }
  pruefe('Ein Sprung auf ebener Fläche öffnet ihn NICHT', !offen);
}

// ---- Bremsen, nicht ziehen ------------------------------------------------
{
  pruefe('Schneller Fall wird auf die Sinkrate gebremst', bremse(-40) === -GLEIT_SINKEN);
  pruefe('Langsamer Fall bleibt langsam', bremse(-1.2) === -1.2);
  pruefe('Aufwärts bleibt aufwärts', bremse(5) === 5);
  // Das ist die Aussage: Der Gleiter macht einen sanften Fall nicht schneller.
  pruefe('Er beschleunigt nie', bremse(-0.5) > -GLEIT_SINKEN);
}

// ---- Was ein Fall aus 200 m bedeutet -------------------------------------
{
  const ohne = falle(200, false);
  const mit = falle(200, true);
  pruefe('Ohne Gleiter schlägt man hart auf', ohne.aufschlag > 50,
         `${ohne.aufschlag.toFixed(0)} m/s`);
  pruefe('Mit Gleiter landet man mit Sinkrate', Math.abs(mit.aufschlag - GLEIT_SINKEN) < 0.2,
         `${mit.aufschlag.toFixed(1)} m/s`);
  pruefe('Der Flug dauert deutlich länger', mit.dauer > ohne.dauer * 5,
         `${ohne.dauer.toFixed(1)} s → ${mit.dauer.toFixed(1)} s`);
  // Die Weite muss zum Verhältnis passen — das ist die Probe auf GLEIT_TEMPO.
  const erwartet = reichweite(200);
  pruefe('Die Weite entspricht dem Verhältnis', Math.abs(mit.strecke - erwartet) / erwartet < 0.05,
         `${mit.strecke.toFixed(0)} m gegen ${erwartet.toFixed(0)} m`);
}

// ---- Einklappen -----------------------------------------------------------
{
  const durch = falle(300, true);
  const gefaltet = falle(300, true, 4.0);
  pruefe('Einklappen beendet den Flug', gefaltet.gleitBilder < durch.gleitBilder,
         `${durch.gleitBilder} → ${gefaltet.gleitBilder} Bilder`);
  pruefe('Danach fällt man wieder frei', gefaltet.aufschlag > 30,
         `${gefaltet.aufschlag.toFixed(0)} m/s`);
  // Und er geht im selben Fall nicht von allein wieder auf.
  const s = gleitSchritt({ scheitel: 300, gefaltet: true },
    { y: 100, steigen: -30, amBoden: false, gesperrt: false, frei: true, falten: false });
  pruefe('Ein gefalteter Gleiter bleibt gefaltet', !s.gleitet);
  // Bodenkontakt setzt zurück — sonst wäre er nach einem Einklappen für immer weg.
  const zurueck = gleitSchritt({ scheitel: 300, gefaltet: true },
    { y: 50, steigen: 0, amBoden: true, gesperrt: false, frei: true, falten: false });
  pruefe('Landen faltet ihn wieder auf', !zurueck.fall.gefaltet);
}

// ---- Lohnt es sich überhaupt? --------------------------------------------
{
  // Die Frage, die `npm run gleit` an der Region beantwortet hat — hier nur die
  // Rechnung dahinter, damit sie sich nicht unbemerkt umdreht.
  for (const h of [50, 200]) {
    const w = reichweite(h);
    const zuFuss = fussweg(w);
    pruefe(`Aus ${h} m ist Gleiten schneller als Rennen`, flugdauer(h) < zuFuss,
           `${flugdauer(h).toFixed(0)} s gegen ${zuFuss.toFixed(0)} s für ${w.toFixed(0)} m`);
  }
  pruefe('Vorwärtstempo liegt über dem Renntempo', GLEIT_TEMPO > RENNEN,
         `${GLEIT_TEMPO} gegen ${RENNEN} m/s`);
  pruefe('Verhältnis und Tempo passen zusammen',
         Math.abs(GLEIT_TEMPO / GLEIT_SINKEN - GLEIT_VERHAELTNIS) < 1e-9);
  pruefe('Aus 400 m wäre der Aufschlag tödlich', fallgeschwindigkeit(400) > 80,
         `${fallgeschwindigkeit(400).toFixed(0)} m/s`);
}

// ---- Robustheit -----------------------------------------------------------
{
  pruefe('Negative Höhe ergibt keine negative Weite', reichweite(-5) === 0);
  pruefe('Negative Höhe ergibt keine negative Dauer', flugdauer(-5) === 0);
  // Der Scheitel darf nur wachsen, nie schrumpfen — sonst misst ein Aufwind die
  // Fallhöhe klein und der Gleiter klappt mitten im Flug zu.
  const s1 = gleitSchritt({ scheitel: 100, gefaltet: false },
    { y: 120, steigen: 2, amBoden: false, gesperrt: false, frei: true, falten: false });
  pruefe('Der Scheitel folgt nach oben', s1.fall.scheitel === 120);
  const s2 = gleitSchritt({ scheitel: 120, gefaltet: false },
    { y: 90, steigen: -10, amBoden: false, gesperrt: false, frei: true, falten: false });
  pruefe('Und bleibt beim Fallen stehen', s2.fall.scheitel === 120 && s2.fallhoehe === 30);
}

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if (fehler > 0) process.exit(1);
