/**
 * BRACHLAND — Vierbeiner in der Laufzeit der Bewegung (D458), rein, ohne three.js.
 *
 * D457 hat die Laufzeit gegen einen `Rigplan` gebaut und einen Punkt offen gelassen: „das Becken senkt sich um
 * den tiefsten Fuss **aller** Beine“. Für einen Menschen stimmt das, für ein Tier am Hang nicht — dort trägt
 * **jedes Beinpaar seinen Gürtel**: Die Schulter steht über den Vorderläufen, das Becken über den Hinterläufen,
 * und der Rumpf liegt als Gerade dazwischen. Bergauf steht das Tier vorn höher, die Läufe bleiben lotrecht
 * unter ihm (die Schwerkraft zieht nach unten, nicht senkrecht zum Hang — D398).
 *
 * Dieses Modul rechnet:
 *
 * - `paarHoehe`: wie hoch ein Gürtel über seinen zwei Füssen steht (Mittel, aber nie höher, als der tiefere Lauf
 *   gestreckt noch reicht);
 * - `rumpfLage`: aus Vorder- und Hinterhand Hub und Nicken des Rumpfs (und, geklemmt, den Rest fürs Mittel);
 * - `seitLage`: Anteil der Querneigung, den der Rumpf mitgeht — den Rest gleichen die Läufe aus;
 * - `hangLage`: dasselbe für einen **starren** Leib ohne Skelett (der Wurzelkeiler geht im Shader, D138) — er
 *   kann nur als Ganzes auf dem Hang liegen, **benannte Abweichung**: seine Läufe stehen dann senkrecht zum Hang;
 * - `tierGang`: Schritt oder Galopp nach Tempo, Abspielrate aus dem **gemessenen** Tempo des Clips (wie D457 es
 *   für `Walk`/`Run` der Spielfigur tat). Schritt und Galopp sind verschiedene Gangarten mit verschiedener
 *   Fussfolge und werden **nicht gemischt** — eine Mischung wäre keine Gangart. Ein Trab fehlt als Clip (benannt).
 *
 * Achsen wie überall in `src/figur/`: vorn ist −Z, rechts +X; **Nicken positiv = vorn hoch**, Rollen positiv =
 * nach links geneigt (rechte Seite hoch).
 */
import { klemme } from './feder.js';
import { GRAD } from './werte.js';
import type { Gang } from './fortbewegung.js';
import type { Rigplan } from './ebenen.js';

/**
 * Skelett der Tiere aus dem Quaternius Animated Animal Pack (D172, `tools/kampftierbau.py`): Wolf, Fuchs, Hirsch
 * (Grathorn) und Reh (Nebelgams) teilen diese Namen. **Ohne Punkt**: three.js streicht `.` beim Laden aus
 * Knotennamen (`FrontUpperLeg.L` → `FrontUpperLegL`); `tests/gegnerbewegung.test.ts` prüft die Namen gegen die
 * Dateien.
 *
 * Die Läufe enden ohne Fussknochen: `…LowerLeg` reicht bis zur Sohle. Der Plan nennt deshalb als `fuss` einen
 * **Hilfspunkt** am Ende von `unter` (`spitze`), den `laufzeit.ts` beim Bau anlegt. Vorn geht die Kette
 * Oberarm → Unterlauf, hinten Unterschenkel → Hintermittelfuss; Schulterblatt und Oberschenkel bleiben dem Clip.
 */
export const RIG_VIERBEINER: Rigplan = {
  becken: 'Back',
  wirbel: ['Torso', 'Torso2', 'Torso3'],
  hals: 'Neck1',
  halsKette: ['Neck1', 'Neck2', 'Neck3'],
  kopf: 'Head',
  beine: [
    { ober: 'FrontUpperLegL', unter: 'FrontLowerLegL', fuss: 'FrontLowerLegL_Sohle', paar: 'vorn', spitze: true },
    { ober: 'FrontUpperLegR', unter: 'FrontLowerLegR', fuss: 'FrontLowerLegR_Sohle', paar: 'vorn', spitze: true },
    { ober: 'BackUpperLegL', unter: 'BackLowerLegL', fuss: 'BackLowerLegL_Sohle', paar: 'hinten', spitze: true },
    { ober: 'BackUpperLegR', unter: 'BackLowerLegR', fuss: 'BackLowerLegR_Sohle', paar: 'hinten', spitze: true },
  ],
  oberAb: 'Torso',
};

/** Werte der Rumpflage (aus `content/figurgegner.json` `vierbeiner`). */
export interface RumpfWerte {
  /** Grösstes Nicken des Rumpfs am Hang, Grad. */
  nickMaxGrad: number;
  /** Anteil der Querneigung des Geländes, den der Rumpf mitgeht (0 = bleibt waagerecht). */
  rollAnteil: number;
  rollMaxGrad: number;
  /** Grösster Hub des Rumpfs gegen die Höhe unter seiner Mitte, m. */
  hubMax: number;
  /** So viel darf der tiefere Lauf eines Paars unter dem Mittel des Paars stehen, bevor der Gürtel nachgibt, m. */
  streckReserve: number;
}

/**
 * Höhe eines Gürtels (Schulter oder Becken) über der Bezugshöhe, aus den Bodenversätzen seiner Füsse: das Mittel,
 * aber höchstens `reserve` über dem tiefsten Fuss — sonst hinge der talseitige Lauf in der Luft. Ein Bein allein
 * gibt seinen Versatz zurück, keines 0.
 */
export function paarHoehe(versaetze: readonly number[], reserve: number): number {
  if (!versaetze.length) return 0;
  let summe = 0, tief = Infinity;
  for (const v of versaetze) { summe += v; if (v < tief) tief = v; }
  return Math.min(summe / versaetze.length, tief + Math.max(0, reserve));
}

export interface Rumpflage {
  /** Hub des Rumpfs an seinem Ursprung (z = 0), m. */
  hub: number;
  /** Nicken um die Querachse durch den Ursprung, rad, positiv = vorn hoch. */
  nick: number;
}

/**
 * Lage des Rumpfs aus den Höhen von Vorder- und Hinterhand. `zVorn`/`zHinten`: Lage der Gürtel längs im Raum der
 * Figur (vorn negativ). Ungeklemmt geht die Gerade genau durch beide Gürtel: Höhe bei z = `hub − z·tan(nick)`.
 * Ist der Hang steiler als `nickMaxGrad`, bleibt das Nicken stehen und der Hub folgt dem **tieferen**
 * Gürtel — ein Lauf kann sich beugen, aber kaum strecken; das andere Paar gleicht den Rest aus (`beinRest`).
 */
export function rumpfLage(vorn: number, hinten: number, zVorn: number, zHinten: number, w: Pick<RumpfWerte, 'nickMaxGrad' | 'hubMax'>, aus: Rumpflage = { hub: 0, nick: 0 }): Rumpflage {
  const lang = zHinten - zVorn;
  if (!(lang > 1e-4)) { aus.hub = klemme((vorn + hinten) / 2, -w.hubMax, w.hubMax); aus.nick = 0; return aus; }
  const max = w.nickMaxGrad * GRAD;
  const nick = klemme(Math.atan2(vorn - hinten, lang), -max, max);
  // Ungeklemmt sind beide Werte gleich. Geklemmt gewinnt der tiefere: Ein Lauf kann sich beugen, aber kaum strecken.
  const t = Math.tan(nick), hub = Math.min(vorn + t * zVorn, hinten + t * zHinten);
  aus.hub = klemme(hub, -w.hubMax, w.hubMax); aus.nick = nick;
  return aus;
}

/** Höhe der Rumpfgeraden an der Stelle `z` (für Tests und für den Rest, den ein Lauf ausgleicht). */
export const rumpfHoeheBei = (l: Rumpflage, z: number): number => l.hub - z * Math.tan(l.nick);

/** Was ein Lauf bei `z` über die Rumpflage hinaus heben (+) oder strecken (−) muss, m. */
export const beinRest = (versatz: number, z: number, l: Rumpflage): number => versatz - rumpfHoeheBei(l, z);

/**
 * Rollen des Rumpfs am Querhang, rad, positiv = nach links geneigt. `links`/`rechts`: mittlerer Bodenversatz der
 * linken und rechten Füsse, `breite`: Spurweite. Ein Tier steht am Querhang fast lotrecht und streckt die
 * talseitigen Läufe — der Rumpf geht nur `rollAnteil` der Hangneigung mit.
 */
export function seitLage(links: number, rechts: number, breite: number, w: Pick<RumpfWerte, 'rollAnteil' | 'rollMaxGrad'>): number {
  if (!(breite > 1e-4)) return 0;
  const max = w.rollMaxGrad * GRAD;
  // Rechts höher als links → die rechte Seite steht höher → nach links geneigt (positiv).
  return klemme(Math.atan2(rechts - links, breite) * w.rollAnteil, -max, max);
}

/**
 * Starrer Leib am Hang (kein Skelett): vier Höhen unter Bug, Heck und den Flanken. Der Leib liegt auf der Geraden
 * Bug–Heck (volles Nicken bis `nickMaxGrad` — seine Läufe sind Teil des Netzes und können nichts ausgleichen) und
 * rollt mit `rollAnteil`. `blick` wie überall (0 = −Z, positiv links); `halbLaenge`/`halbBreite` des Leibs.
 */
export function hangLage(
  hoeheAn: (x: number, z: number) => number, x: number, z: number, blick: number, halbLaenge: number, halbBreite: number, w: RumpfWerte,
  aus: Rumpflage & { roll: number } = { hub: 0, nick: 0, roll: 0 },
): Rumpflage & { roll: number } {
  const vx = -Math.sin(blick), vz = -Math.cos(blick), rx = Math.cos(blick), rz = -Math.sin(blick);
  const mitte = hoeheAn(x, z), l = Math.max(0.05, halbLaenge), b = Math.max(0.05, halbBreite);
  const vorn = hoeheAn(x + vx * l, z + vz * l) - mitte, hinten = hoeheAn(x - vx * l, z - vz * l) - mitte;
  const rechts = hoeheAn(x + rx * b, z + rz * b) - mitte, links = hoeheAn(x - rx * b, z - rz * b) - mitte;
  rumpfLage(vorn, hinten, -l, l, w, aus);
  // Ein starrer Leib kann nichts ausgleichen: Er rollt mit dem ganzen Querhang, bis zur selben Grenze wie das Nicken.
  ROLL_STARR.rollMaxGrad = w.nickMaxGrad;
  aus.roll = seitLage(links, rechts, 2 * b, ROLL_STARR);
  return aus;
}

const ROLL_STARR = { rollAnteil: 1, rollMaxGrad: 45 };

// ---- Gang -----------------------------------------------------------------------------------------------------

export interface TierGangWerte {
  /** Abspielrate gegen den Clip: darunter schleicht, darüber trippelt er. */
  rateMin: number; rateMax: number;
  /** Anteil um die Schwelle, in dem die Gangart bleibt, wie sie ist (gegen Flackern). */
  hysterese: number;
}

export interface TierGang {
  galopp: boolean;
  /** Abspielrate des gewählten Clips (1 = wie aufgenommen). */
  rate: number;
  /** Anteil des Tempos, den die Füsse nicht abdecken (positiv = das Tier ist schneller als seine Füsse). */
  gleiten: number;
  /** Tempo, bei dem die Gangart wechselt, m/s. */
  schwelle: number;
}

/**
 * Gangart und Abspielrate bei Tempo `v`. `schritt`/`galopp`: gemessenes Tempo der Clips bei Rate 1.
 * Die Schwelle ist das geometrische Mittel beider Tempi — dort verlangt der Schritt dieselbe Überdrehung, wie der
 * Galopp Untersetzung verlangt. `warGalopp` hält die Gangart innerhalb der Hysterese. Schlägt die Rate an, gleitet
 * das Tier; `gleiten` sagt, um wie viel.
 */
export function tierGang(v: number, schritt: Gang, galopp: Gang | null, warGalopp: boolean, w: TierGangWerte): TierGang {
  const tempo = Math.max(0, v);
  const schwelle = galopp && galopp.tempo > schritt.tempo ? Math.sqrt(schritt.tempo * galopp.tempo) : Infinity;
  const imGalopp = galopp !== null && Number.isFinite(schwelle)
    && tempo > schwelle * (warGalopp ? 1 - w.hysterese : 1 + w.hysterese);
  const clip = imGalopp ? galopp! : schritt;
  const rate = klemme(clip.tempo > 0 ? tempo / clip.tempo : 1, w.rateMin, w.rateMax);
  return { galopp: imGalopp, rate, gleiten: tempo > 1e-6 ? (tempo - rate * clip.tempo) / tempo : 0, schwelle };
}
