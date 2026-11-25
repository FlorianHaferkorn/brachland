/**
 * BRACHLAND — Verfahren „Ort für Ort“ (D459): reine Logik, ohne Dateizugriff und ohne Browser.
 *
 * Ablauf und Regeln stehen in `docs/VERFAHREN_ORT.md`; die Eingaben je Ort sind eine Akte unter `tools/ort/<ort>.json`.
 * Hier liegt, was sich rechnen lässt: Akte prüfen, Blender-Kamera in die Spieladresse umrechnen (D445), Sonnenstand
 * als Vektor der Stimmung, Messwerte gegen das Zielbild abnehmen, Bildrate und Dateibudget prüfen, Schrittliste mit
 * ausgefüllten Befehlen. Der Aufruf mit Dateien ist `tools/ortverfahren.ts`; Test: `tests/ortverfahren.test.ts`.
 *
 * Die Toleranzen sind Messaufbau, keine Spielwerte — deshalb stehen sie in der Akte unter `tools/ort/` und nicht in
 * `content/` (gleiche Begründung wie die Rahmenkronen in D446).
 */
import { z } from 'zod';

const Punkt3 = z.tuple([z.number(), z.number(), z.number()]);

/** Die acht Grössen aus `tools/mess/messwerte.py` (Anteile als 0…1), dazu `magenta` (fehlende Textur, D448). */
export const GROESSEN = ['mittel', 'unter02', 'ueber07', 'rb_licht', 'rb_schatten', 'saett', 'himmel'] as const;
export type Groesse = typeof GROESSEN[number];
export type Messwerte = Record<Groesse, number> & { signal?: number; magenta?: number };

const Werte = z.object({
  mittel: z.number(), unter02: z.number(), ueber07: z.number(), rb_licht: z.number(), rb_schatten: z.number(),
  saett: z.number(), himmel: z.number(), signal: z.number().optional(), magenta: z.number().optional(),
});
const Toleranz = z.object({
  mittel: z.number().positive(), unter02: z.number().positive(), ueber07: z.number().positive(), rb_licht: z.number().positive(),
  rb_schatten: z.number().positive(), saett: z.number().positive(), himmel: z.number().positive(),
});

export const Akte = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  region: z.string().min(1),
  /** Weltpunkt des Blender-Ursprungs (`tools/terrainexport.ts`: x = cx + X, z = cz − Y) und Geländehöhe dort. */
  ursprung: z.object({ x: z.number(), z: z.number() }),
  h0: z.number(),
  /** Höhenzuschlag der Kamera zwischen Render und Spiel in Metern (Felsmulde D445: 0,2). */
  hoehenversatz: z.number().default(0),
  zielbild: z.object({
    /** Ledgerzeile, mit der Flo das Zielbild freigegeben hat. Ohne Freigabe läuft das Verfahren nicht an. */
    freigabe: z.string().regex(/^D\d+$/),
    werkzeug: z.string().min(1),
    modus: z.string().min(1),
    /** Das fertige Bild (mit Stil), relativ zum Repo. */
    bild: z.string().min(1),
    /** Gespeicherte Blender-Szene des Zielbilds (lokal am M1, nicht im Repo) und der Terrain-Ordner des Renders. */
    blend: z.string().min(1),
    terrain: z.string().min(1),
    hinweis: z.string().optional(),
  }),
  kameras: z.array(z.object({
    name: z.string().regex(/^[a-z0-9]+$/),
    /** Standort und Blickpunkt in Blender-Metern (X, Y, Z über der Terrasse), Brennweite auf `sensor` mm Breite. */
    ort: Punkt3, blick: Punkt3, brennweite: z.number().positive(), sensor: z.number().positive().default(36),
  })).min(1),
  /** Sonne des Renders: Azimut von Nord im Uhrzeigersinn, Höhe über dem Horizont, beides in Grad. */
  sonne: z.object({ azimut: z.number().min(0).max(360), hoehe: z.number().min(0).max(90) }),
  spiel: z.object({
    /** Messstimmung in `src/world/stimmung.ts`; ihr `sonnenstand` muss zur Sonne oben passen. */
    stimmung: z.string().regex(/^[a-z0-9]+$/),
    /** Schalter für das Messbild ohne die übertragene Szene (vorher) und mit ihr (nachher), ohne führendes `&`. */
    schalterVorher: z.array(z.string()),
    schalterNachher: z.array(z.string()),
    /** Ordner unter `public/`, in den die Szene exportiert wird. */
    ordner: z.string().min(1),
  }),
  bauteile: z.array(z.object({
    id: z.string().min(1), art: z.enum(['wand', 'fels', 'boden', 'wasser', 'pflanzen', 'kronen', 'streu', 'himmel', 'ferne']),
    /** Womit das Bauteil ins Spiel kommt; `hand` heisst: kein Werkzeug, Eskalation. */
    weg: z.enum(['szenenexport', 'bodenexport', 'pflanzenexport', 'engine', 'hand']),
    datei: z.string().optional(), hinweis: z.string().optional(),
  })).min(1),
  quellen: z.array(z.object({ name: z.string().min(1), lizenz: z.string().min(1), imSpiel: z.boolean() })).min(1),
  abnahme: z.object({
    toleranz: Toleranz,
    bildrate: z.object({ min: z.number().positive(), format: z.string().regex(/^\d+x\d+$/), dpr: z.number().positive() }),
    budget: z.object({ dateienMB: z.number().positive(), dreieckeMio: z.number().positive(), aufrufe: z.number().positive() }),
  }),
  /** Was bisher gemessen wurde (Ledger-Nummer, Stand, Werte) — Beleg, nicht Eingabe. */
  protokoll: z.array(z.object({ ledger: z.string(), stand: z.string(), werte: Werte.partial(), bildrate: z.number().optional() })).default([]),
});
export type Akte = z.infer<typeof Akte>;
export type Kamera = Akte['kameras'][number];

/** Zahl für eine Adresse: höchstens `stellen` Nachkommastellen, ohne angehängte Nullen. */
export function kurz(n: number, stellen = 2): string {
  const t = n.toFixed(stellen).replace(/\.?0+$/, '');
  return t === '-0' ? '0' : t;
}

/** Blender-Punkt (X, Y, Z über der Terrasse) → Weltpunkt des Spiels (x, y, z). Abbildung von `tools/terrainexport.ts`. */
export function weltpunkt(a: Pick<Akte, 'ursprung' | 'h0' | 'hoehenversatz'>, p: readonly [number, number, number]): [number, number, number] {
  return [a.ursprung.x + p[0], a.h0 + a.hoehenversatz + p[2], a.ursprung.z - p[1]];
}

/** Senkrechter Bildwinkel in Grad für Brennweite auf `sensor` mm Bildbreite und Seitenverhältnis b : h. */
export function bildwinkel(brennweite: number, sensor = 36, verhaeltnis = 16 / 9): number {
  return 2 * Math.atan(sensor / verhaeltnis / 2 / brennweite) * 180 / Math.PI;
}

/** Sonnenstand als Vektor der Stimmung: (sin az · cos el, sin el, −cos az · cos el) · 100. */
export function sonnenstand(azimut: number, hoehe: number): [number, number, number] {
  const az = azimut * Math.PI / 180, el = hoehe * Math.PI / 180;
  return [Math.sin(az) * Math.cos(el) * 100, Math.sin(el) * 100, -Math.cos(az) * Math.cos(el) * 100];
}

export interface Adresse { kamera: string; fov: string; absetzen: string; zusatz: (schalter: readonly string[]) => string; }

/**
 * Spieladresse der Zielbild-Kamera (D445): `kamera=x,y,z,tx,ty,tz`, `fov`, dazu die Figur `abstand` Meter hinter der
 * Kamera mit Blick in Kamerarichtung (sonst steht ihre Waffe im Bild). Blick der Absetzadresse: vorwärts = (−sin g, −cos g).
 */
export function adresse(a: Akte, k: Kamera, abstand = 3): Adresse {
  const o = weltpunkt(a, k.ort), t = weltpunkt(a, k.blick);
  const dx = t[0] - o[0], dz = t[2] - o[2], l = Math.hypot(dx, dz);
  if (l < 1e-6) throw new Error(`Kamera ${k.name}: Standort und Blickpunkt liegen übereinander`);
  const grad = Math.atan2(-dx / l, -dz / l) * 180 / Math.PI;
  const kamera = [...o, ...t].map(n => kurz(n)).join(',');
  const fov = kurz(bildwinkel(k.brennweite, k.sensor));
  const absetzen = [kurz(o[0] - dx / l * abstand, 1), kurz(o[2] - dz / l * abstand, 1), kurz(grad, 0)].join(',');
  return { kamera, fov, absetzen, zusatz: schalter => `&stimmung=${a.spiel.stimmung}${schalter.map(s => '&' + s).join('')}&kamera=${kamera}&fov=${fov}` };
}

/** Liest `sonnenstand: [x, y, z]` der Stimmung `name` aus dem Quelltext von `src/world/stimmung.ts`; null, wenn nicht da. */
export function sonnenstandImQuelltext(quelltext: string, name: string): [number, number, number] | null {
  const start = quelltext.indexOf(`STIMMUNG.${name} = {`);
  if (start < 0) return null;
  const ende = quelltext.indexOf('\n};', start);
  const block = quelltext.slice(start, ende < 0 ? undefined : ende);
  const m = /sonnenstand:\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/.exec(block);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Die vier Zeilen, die eine Messstimmung mit eigener Sonnenrichtung anlegen (D445, vor dem Look-Durchgang). */
export function stimmungsVorlage(a: Akte): string {
  const s = sonnenstand(a.sonne.azimut, a.sonne.hoehe).map(n => n.toFixed(1)).join(', ');
  return `/** ${a.zielbild.freigabe}/D459: Messstimmung ${a.name} — wie \`zielbild\`, Sonne des Renders (Azimut ${kurz(a.sonne.azimut, 1)}°, Höhe ${kurz(a.sonne.hoehe, 1)}°). */\n`
    + `STIMMUNG.${a.spiel.stimmung} = {\n  ...STIMMUNG.zielbild,\n  sonnenstand: [${s}] as const,\n};`;
}

// ── Abnahme ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export const NAME: Record<Groesse, string> = {
  mittel: 'mittlere Helligkeit', unter02: 'Fläche unter 0,2', ueber07: 'Fläche über 0,7', rb_licht: 'R−B Lichter',
  rb_schatten: 'R−B Schatten', saett: 'Sättigung', himmel: 'Himmel (Flutfüllung)',
};
/**
 * Welcher Hebel zu welcher Grösse gehört — Reihenfolge und Zuordnung aus dem Messbild D445 (ADR-0012 Punkt 3) und A-46.
 * Das ist eine Sortierhilfe für die Rückmeldung, keine Anweisung zum Nachstellen.
 */
export const HEBEL: Record<Groesse, string> = {
  mittel: '1 Licht und Tonwert (Belichtung, Sonne gegen Fülllicht)',
  ueber07: '1 Licht und Tonwert (Himmelsfenster, Belichtung)',
  rb_licht: '1 Licht und Tonwert (Sonnenfarbe; prüfen, ob die hellsten 10 % Himmel sind)',
  rb_schatten: '1 Licht und Tonwert (Fülllichtfarbe)',
  saett: '1 Licht und Tonwert (Sonnenfarbe, Dunst)',
  unter02: '1 Licht in den Schatten (Fülllicht/Himmelslicht, A-46 Punkt 1) — nicht Belichtung',
  himmel: '2 Kronen und Himmel (Rahmenkronen, Kamerahöhe)',
};
/** Regelbereich für Zielbilder aus `docs/referenz/REFERENZ_SPIELE.md`, Regeln 1 und 3 (nur diese sind dort Zahlen). */
export const REGELBEREICH: Partial<Record<Groesse, [number, number]>> = {
  mittel: [0.25, 0.35], unter02: [0.30, 0.50], ueber07: [0, 0.05], rb_licht: [0.10, 0.20], rb_schatten: [0, 0.05],
};
/** Ab diesem Anteil reinen Magentas gilt eine Textur als nicht gefunden (D448: „erste Mauern magenta“). */
export const MAGENTA_GRENZE = 0.002;

export interface Zeile { groesse: Groesse; name: string; ziel: number; spiel: number; abstand: number; toleranz: number; bestanden: boolean; hebel: string; }
export interface Abnahme { bestanden: boolean; zeilen: Zeile[]; magenta: boolean; leer: boolean; }

/** Vergleicht das Spielbild mit dem Zielbild: jede Grösse muss innerhalb ihrer Toleranz liegen. */
export function abnahme(ziel: Messwerte, spiel: Messwerte, toleranz: Record<Groesse, number>): Abnahme {
  const zeilen = GROESSEN.map(g => {
    const abstand = spiel[g] - ziel[g];
    return { groesse: g, name: NAME[g], ziel: ziel[g], spiel: spiel[g], abstand, toleranz: toleranz[g], bestanden: Math.abs(abstand) <= toleranz[g] + 1e-9, hebel: HEBEL[g] };
  });
  const magenta = (spiel.magenta ?? 0) > MAGENTA_GRENZE;
  const leer = spiel.mittel < 0.02;   // schwarzes Bild: Szene nicht geladen
  return { bestanden: zeilen.every(z => z.bestanden) && !magenta && !leer, zeilen, magenta, leer };
}

/** Liegt das Zielbild selbst im Regelbereich? Ein Verfehlen ist ein Hinweis an Flo, kein Fehler des Ortes. */
export function regelpruefung(ziel: Messwerte): { groesse: Groesse; name: string; wert: number; von: number; bis: number; drin: boolean }[] {
  return (Object.keys(REGELBEREICH) as Groesse[]).map(g => {
    const [von, bis] = REGELBEREICH[g]!;
    return { groesse: g, name: NAME[g], wert: ziel[g], von, bis, drin: ziel[g] >= von - 1e-9 && ziel[g] <= bis + 1e-9 };
  });
}

const PROZENT: ReadonlySet<Groesse> = new Set(['unter02', 'ueber07', 'himmel']);
export function zeige(g: Groesse, n: number, vorzeichen = false): string {
  const v = vorzeichen || g === 'rb_licht' || g === 'rb_schatten';
  const t = PROZENT.has(g) ? (n * 100).toFixed(1) + ' %' : n.toFixed(2);
  return ((v && n >= 0 ? '+' : '') + t).replace('.', ',').replace('-', '−');
}

/** Abnahme als Markdown-Tabelle mit Urteil je Zeile — so geht sie in die Ledgerzeile und in die Rückmeldung. */
export function abnahmeTabelle(a: Abnahme): string {
  const kopf = '| Grösse | Zielbild | Spiel | Abstand | Toleranz | Urteil |\n|---|---|---|---|---|---|\n';
  const zeilen = a.zeilen.map(z => `| ${z.name} | ${zeige(z.groesse, z.ziel)} | ${zeige(z.groesse, z.spiel)} | ${zeige(z.groesse, z.abstand, true)} | ±${zeige(z.groesse, z.toleranz).replace('+', '')} | ${z.bestanden ? 'bestanden' : 'NICHT BESTANDEN → Hebel ' + z.hebel} |`);
  if (a.magenta) zeilen.push('| Magenta | — | über der Grenze | — | — | NICHT BESTANDEN → Textur fehlt (Bildpfade der .blend prüfen, D448) |');
  if (a.leer) zeilen.push('| Bild | — | fast schwarz | — | — | NICHT BESTANDEN → Szene nicht geladen (Server, Adresse, Wartezeit) |');
  return kopf + zeilen.join('\n') + `\n\nABNAHME: ${a.bestanden ? 'BESTANDEN' : 'NICHT BESTANDEN'}`;
}

// ── Bildrate und Budget ──────────────────────────────────────────────────────────────────────────────────────────────

export interface Ratenzeile { name: string; bps: number; dreieckeMio: number; aufrufe: number; }

/** Liest die Ausgabe von `tools/mess/bildrate.mjs` („<name>  26 B/s    1.18 Mio. Dreiecke   412 Aufrufe“). */
export function leseBildrate(text: string): Ratenzeile[] {
  const zeilen: Ratenzeile[] = [];
  for (const z of text.split('\n')) {
    const m = /^(\S+)\s+(\d+) B\/s\s+([\d.]+) Mio\. Dreiecke\s+(\d+) Aufrufe/.exec(z.trim());
    if (m) zeilen.push({ name: m[1], bps: Number(m[2]), dreieckeMio: Number(m[3]), aufrufe: Number(m[4]) });
  }
  return zeilen;
}

export interface Ratenurteil { bestanden: boolean; voll: Ratenzeile | null; engpass: string; meldungen: string[]; }

/**
 * Urteil über die Bildrate und, wenn sie fehlt, die Zerlegung nach D450: Welt allein, halbe Auflösung, Gruppen aus.
 * Erwartete Variantennamen: `voll`, `halb` (halbe Auflösung), `ohnebauwerke`, `ohnepflanzen`, `ohneschatten`.
 */
export function bildratenUrteil(zeilen: readonly Ratenzeile[], min: number, budget: { dreieckeMio: number; aufrufe: number }): Ratenurteil {
  const finde = (n: string) => zeilen.find(z => z.name === n) ?? null;
  const voll = finde('voll'), halb = finde('halb'), welt = finde('ohnebauwerke'), ohnePfl = finde('ohnepflanzen'), ohneSch = finde('ohneschatten');
  const meldungen: string[] = [];
  if (!voll) return { bestanden: false, voll: null, engpass: 'unbekannt', meldungen: ['Variante `voll` fehlt in der Ausgabe von bildrate.mjs'] };
  if (voll.bps >= min) return { bestanden: true, voll, engpass: 'keiner', meldungen: [`voll ${voll.bps} B/s ≥ ${min}`] };
  let engpass = 'unbekannt';
  if (welt && welt.bps < min) { engpass = 'welt'; meldungen.push(`Die Spielwelt allein (ohne Bauwerke) schafft ${welt.bps} B/s < ${min}: kein Fehler dieses Ortes → Eskalation (D450, A-46 Punkt 3).`); }
  else if (halb && halb.bps >= voll.bps * 1.4) { engpass = 'pixel'; meldungen.push(`Halbe Auflösung bringt ${halb.bps} statt ${voll.bps} B/s: pixelgebunden → Eskalation (MSAA, AO, Pixeldichte sind Engine-Werte).`); }
  else { engpass = 'geometrie'; meldungen.push('Halbe Auflösung hilft kaum: Geometrie oder Aufrufe sind der Engpass.'); }
  if (voll.aufrufe > budget.aufrufe) meldungen.push(`Aufrufe ${voll.aufrufe} > ${budget.aufrufe}: Nachstellschritt A — Pflanzen mit \`bautenpack.ts --instanz\` neu packen (D450).`);
  if (welt && voll.dreieckeMio - welt.dreieckeMio > budget.dreieckeMio) meldungen.push(`Bauwerke ${(voll.dreieckeMio - welt.dreieckeMio).toFixed(2)} Mio. Dreiecke > ${budget.dreieckeMio}: Nachstellschritt B — \`szenenexport.py\` mit \`SZENE_NIEDRIG=0.12\` neu laufen lassen (D450).`);
  if (ohnePfl && ohnePfl.bps - voll.bps >= 4) meldungen.push(`Pflanzen kosten ${ohnePfl.bps - voll.bps} B/s.`);
  if (ohneSch && ohneSch.bps - voll.bps >= 4) meldungen.push(`Schattenwurf kostet ${ohneSch.bps - voll.bps} B/s.`);
  return { bestanden: false, voll, engpass, meldungen };
}

/** Die fünf festen Varianten für `bildrate.mjs` (Namen ohne `=`). */
export function ratenVarianten(): string[] {
  return ['voll=', 'ohnebauwerke=&aus=bauwerke', 'ohnepflanzen=&aus=pflanzen', 'ohneschatten=&aus=schatten', 'ohnekronen=&aus=kronen'];
}

export function budgetUrteil(bytes: number, grenzeMB: number): { bestanden: boolean; mb: number } {
  const mb = bytes / 1048576;
  return { bestanden: mb <= grenzeMB, mb };
}

// ── Schrittliste ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Schritt {
  nr: number; titel: string; zweck: string;
  /** Wo der Schritt läuft: `cloud` geht überall, `m1` braucht GPU bzw. die lokalen Scans. */
  wo: 'cloud' | 'm1';
  /** Wer ihn trägt: `guenstig` = Sonnet/Haiku nach Vorschrift, `stark` = Rückgabe an ein stärkeres Modell oder Flo. */
  wer: 'guenstig' | 'stark';
  befehle: string[]; ausgabe: string; abnahme: string; beiVerfehlen: string[];
}

const BLENDER = '$BLENDER';   // am M1: /Applications/Blender.app/Contents/MacOS/Blender, Cloud: /opt/blender/blender-5.3.0-linux-x64/blender

/** Die Schrittfolge für einen Ort mit ausgefüllten Befehlen. `d` ist die Ledger-Nummer der Runde (Bildordner). */
export function schritte(a: Akte, d = 'Dxxx', kamera?: string): Schritt[] {
  const k = a.kameras.find(x => x.name === kamera) ?? a.kameras[0];
  const adr = adresse(a, k);
  const ort = `npx tsx tools/ortverfahren.ts ${a.id}`;
  const aus = `.cache/bilder/${d}`;
  const ziel = `public/${a.spiel.ordner}`;
  const hat = (weg: string) => a.bauteile.some(b => b.weg === weg);
  const export_: string[] = [];
  if (hat('szenenexport')) export_.push(`SZENE_ZIEL=1 SZENE_TERRAIN=${a.zielbild.terrain}/terrain.json ${BLENDER} --background ${a.zielbild.blend} --python tools/szenenexport.py -- ${ziel} ${a.id} 1024`);   // Mauern werden doppelt so gross gebacken: 2048 (D448)
  if (hat('bodenexport')) export_.push(`SZENE_TERRAIN=${a.zielbild.terrain}/terrain.json ${BLENDER} --background ${a.zielbild.blend} --python tools/bodenexport.py -- ${ziel} ${a.id}`);
  if (hat('pflanzenexport')) export_.push(`${BLENDER} --background ${a.zielbild.blend} --python tools/pflanzenexport.py -- ${ziel} ${a.id}`);
  if (hat('szenenexport')) export_.push(`npx tsx tools/bautenpack.ts --kante 2048 ${ziel}/${a.id}-bauten.glb`);
  if (hat('bodenexport')) export_.push(`npx tsx tools/bautenpack.ts --kante 2048 ${ziel}/${a.id}-boden.glb`);
  if (hat('pflanzenexport')) export_.push(`npx tsx tools/bautenpack.ts --kante 1024 --instanz ${ziel}/${a.id}-pflanzen.glb`);
  const messbild = (stand: 'vorher' | 'nachher', schalter: readonly string[]) =>
    `node tools/mess/messbild.mjs ${aus}/${stand} "${adr.absetzen}" "${adr.zusatz(schalter)}" 1920x1080`;
  return [
    { nr: 1, titel: 'Akte prüfen', zweck: 'Sicherstellen, dass alle Eingaben des Ortes da sind und das Zielbild freigegeben ist.', wo: 'cloud', wer: 'guenstig',
      befehle: [`${ort} pruefe`], ausgabe: 'Zeile `AKTE GÜLTIG` und die Liste der Bauteile',
      abnahme: 'Ausgabe endet mit `AKTE GÜLTIG`; kein Bauteil mit Weg `hand`.',
      beiVerfehlen: ['Fehlendes Feld aus der genannten Ledgerzeile nachtragen.', 'Fehlt die Freigabe oder hat ein Bauteil den Weg `hand`: stoppen und melden.'] },
    { nr: 2, titel: 'Zielbild messen', zweck: 'Die Messlatte festhalten: die sieben Grössen des freigegebenen Zielbilds.', wo: 'cloud', wer: 'guenstig',
      befehle: [`${ort} zielwerte`], ausgabe: 'Tabelle der sieben Grössen mit Regelbereich (REFERENZ_SPIELE Regeln 1 und 3)',
      abnahme: 'Tabelle vorhanden. Liegt eine Grösse ausserhalb des Regelbereichs, wird das gemeldet, aber nicht geändert.',
      beiVerfehlen: ['Bilddatei fehlt: Pfad in der Akte gegen `docs/bilder/zielbild/` prüfen.', 'Sonst stoppen und melden — am Zielbild wird nichts gedreht.'] },
    { nr: 3, titel: 'Kamera und Sonne ins Spiel rechnen', zweck: 'Dieselbe Kamera und dieselbe Sonnenrichtung wie im Render als Spieladresse.', wo: 'cloud', wer: 'guenstig',
      befehle: [`${ort} adresse ${k.name}`], ausgabe: `Adresszusatz (\`kamera=${adr.kamera}\`, \`fov=${adr.fov}\`, \`absetzen=${adr.absetzen}\`) und Prüfung der Messstimmung \`${a.spiel.stimmung}\``,
      abnahme: 'Zeile `STIMMUNG PASST` (Sonnenstand der Stimmung weicht je Achse höchstens 0,5 vom gerechneten ab).',
      beiVerfehlen: ['Stimmung fehlt: den ausgegebenen Vier-Zeilen-Block unverändert in `src/world/stimmung.ts` hinter `STIMMUNG.zielbild` einfügen, `make check`.', 'Stimmung da, Sonnenstand anders: stoppen und melden — eine bestehende Stimmung wird nicht überschrieben.'] },
    { nr: 4, titel: 'Messbild vorher', zweck: 'Den Abstand Spiel │ Zielbild vor der Übertragung messen (Ausgangslage, Vorher-Bild des Paars).', wo: 'm1', wer: 'guenstig',
      befehle: ['npx vite build && npx vite preview --port 4173 --strictPort &', messbild('vorher', a.spiel.schalterVorher), `${ort} abnahme ${aus}/vorher/spiel-standbild.png`],
      ausgabe: `\`${aus}/vorher/spiel-standbild.png\`, \`spiel-bewegung.webm\`, \`bericht.json\`, Abnahmetabelle`,
      abnahme: 'Dateien vorhanden, `bericht.json` nennt Ladezeit und Dreiecke, Bild nicht schwarz, kein Magenta. Die Tabelle darf hier NICHT BESTANDEN zeigen — sie ist die Ausgangslage.',
      beiVerfehlen: ['Schwarzes Bild oder keine Dreieckszahl: prüfen, dass kein Blender-Render parallel läuft und der Server auf 4173 antwortet; einmal wiederholen.', 'Noch einmal fehlgeschlagen: stoppen und melden.'] },
    { nr: 5, titel: 'Look-Durchgang (Licht, Luft, Kronen)', zweck: 'Licht- und Tonwerte der Messstimmung an das Zielbild heranführen.', wo: 'm1', wer: 'stark',
      befehle: [`${ort} abnahme ${aus}/vorher/spiel-standbild.png   # Tabelle mit Hebeln in die Rückmeldung kopieren`],
      ausgabe: 'Rückmeldung nach Vorlage (Abschnitt 6 des Verfahrens)',
      abnahme: 'Kein Messwert, den das günstige Modell selbst einstellt: Sonnenfarbe, Fülllicht, Belichtung, Nebel und Kronen sind Art-Direction-Werte (D446).',
      beiVerfehlen: ['Nicht nachstellen. Tabelle und Hebel melden, mit Schritt 6 weitermachen.'] },
    { nr: 6, titel: 'Szene des Zielbilds exportieren', zweck: 'Wand, Fels, Boden, Wasser und Pflanzen kommen aus der Blender-Szene selbst, nicht als Nachbau.', wo: 'm1', wer: 'guenstig',
      befehle: [...export_, `${ort} budget`],
      ausgabe: `GLB-Dateien \`${ziel}/${a.id}-*.glb\` und \`${ziel}/register.json\` mit dem Eintrag \`${a.id}\``,
      abnahme: `\`BUDGET BESTANDEN\`: alle erwarteten Dateien da, zusammen ≤ ${a.abnahme.budget.dateienMB} MB.`,
      beiVerfehlen: ['Exit 137 (Speicher) oder Abbruch: prüfen, dass kein zweiter Blender läuft; denselben Befehl einmal wiederholen.', `Zu gross: \`szenenexport.py\` mit \`SZENE_NIEDRIG=0.12\` und \`pflanzenexport.py\` mit \`PFLANZE_MAX=600\` neu laufen lassen, neu packen. Danach stoppen und melden.`] },
    { nr: 7, titel: 'Messbild nachher und Abnahme', zweck: 'Prüfen, ob das Spielbild mit der übertragenen Szene innerhalb der Toleranz am Zielbild liegt.', wo: 'm1', wer: 'guenstig',
      befehle: ['npx vite build   # Vorschau-Server neu starten', messbild('nachher', a.spiel.schalterNachher), `${ort} abnahme ${aus}/nachher/spiel-standbild.png`],
      ausgabe: `\`${aus}/nachher/spiel-standbild.png\`, \`spiel-bewegung.webm\`, Abnahmetabelle`,
      abnahme: '`ABNAHME: BESTANDEN` — jede der sieben Grössen innerhalb der Toleranz der Akte, kein Magenta, Bild nicht schwarz.',
      beiVerfehlen: ['Magenta oder gleiche Dreieckszahl wie vorher: Die Szene ist nicht geladen — Dateien, Register und Schalter prüfen, Messbild einmal wiederholen.', 'Grössen ausserhalb der Toleranz: nicht an Licht, Material oder Belichtung drehen. Tabelle mit Hebeln melden (Eskalation), mit Schritt 8 weitermachen.'] },
    { nr: 8, titel: 'Bildrate', zweck: 'Prüfen, dass der Ort am M1 die Zielbildrate hält, und bei Verfehlen den Engpass benennen.', wo: 'm1', wer: 'guenstig',
      befehle: [`MESS_FORMAT=${a.abnahme.bildrate.format} MESS_DPR=${a.abnahme.bildrate.dpr} node tools/mess/bildrate.mjs "absetzen=${adr.absetzen}${adr.zusatz(a.spiel.schalterNachher)}" ${ratenVarianten().map(v => `"${v}"`).join(' ')} | tee ${aus}/bildrate.txt`,
        `MESS_FORMAT=${a.abnahme.bildrate.format.split('x').map(n => Math.round(Number(n) / 2)).join('x')} MESS_DPR=${a.abnahme.bildrate.dpr} node tools/mess/bildrate.mjs "absetzen=${adr.absetzen}${adr.zusatz(a.spiel.schalterNachher)}" "halb=" | tee -a ${aus}/bildrate.txt`,
        `${ort} bildrate ${aus}/bildrate.txt`],
      ausgabe: `\`${aus}/bildrate.txt\` und das Urteil`,
      abnahme: `\`BILDRATE BESTANDEN\`: Variante \`voll\` ≥ ${a.abnahme.bildrate.min} B/s bei ${a.abnahme.bildrate.format}, Pixeldichte ${a.abnahme.bildrate.dpr}; kein Blender-Render parallel.`,
      beiVerfehlen: ['Nachstellschritt A oder B ausführen, wenn das Urteil ihn nennt (Pflanzen mit `--instanz` packen; `SZENE_NIEDRIG=0.12`), dann einmal neu messen.', 'Engpass `welt` oder `pixel` oder immer noch unter dem Ziel: stoppen und melden.'] },
    { nr: 9, titel: 'Bildpaar', zweck: 'Vorher und Nachher neben dem Zielbild für Flo, gleiche Kamera, beschriftet.', wo: 'cloud', wer: 'guenstig',
      befehle: [`python3 tools/mess/bildpaar.py ${aus}/paar-${a.id}.jpg "Zielbild ${a.zielbild.freigabe}=${a.zielbild.bild}" "Spiel vorher=${aus}/vorher/spiel-standbild.png" "Spiel nachher ${d}=${aus}/nachher/spiel-standbild.png"`],
      ausgabe: `\`${aus}/paar-${a.id}.jpg\``,
      abnahme: 'Datei vorhanden, drei beschriftete Felder gleicher Höhe.',
      beiVerfehlen: ['Fehlt ein Bild: den zugehörigen Schritt (4 oder 7) nachholen.', 'Sonst stoppen und melden.'] },
    { nr: 10, titel: 'Ledger, Protokoll, Gate, Commit', zweck: 'Stand festhalten, damit die nächste Sitzung nichts neu ableitet.', wo: 'cloud', wer: 'guenstig',
      befehle: ['make ledger-ids   # nennt die nächste freie D-Nummer', `# Messwerte der Runde in tools/ort/${a.id}.json unter "protokoll" eintragen`, '# Ledgerzeile in docs/_INDEX.md Tabelle B nach Vorlage (Verfahren Abschnitt 7)', 'make check', 'git add <genaue Pfade> && git commit'],
      ausgabe: 'Ledgerzeile mit beiden Tabellen, Bildpfaden (relativ) und dem Satz „Standbild, keine Look-Abnahme“',
      abnahme: '`make check` endet ohne Fehler; Commit ohne `--no-verify`.',
      beiVerfehlen: ['`make check` rot wegen eigener Änderung: die gemeldete Zeile beheben, einmal wiederholen.', '`make check` rot aus fremdem Grund oder nach zwei Versuchen: nicht committen, stoppen und melden.'] },
  ];
}
