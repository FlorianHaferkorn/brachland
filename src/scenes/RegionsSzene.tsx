/**
 * BRACHLAND — Regionsszene
 *
 * Setzt die Art Direction um: Dämmerung, Nebel als Werkzeug, Silhouetten,
 * eine Signalfarbe für Befall. Alles Geometrie aus src/world, keine Texturen.
 *
 * Props laufen als InstancedMesh — 40.000 Bäume als Einzelobjekte würden jedes
 * Handy erledigen, als Instanzen sind es eine Handvoll Draw Calls.
 */
import { Suspense, useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Weltdaten } from '../world/osm.js';
import { baueTerrain, baueGebaeude, GROESSE, type TerrainErgebnis } from '../world/terrain.js';
import { zerlegeBaender, baueWegKachel, baueWasserKachel, baueFallKachel,
         baueGartenKachel, type Bandsatz } from '../world/baender.js';
import { useGLTF } from '@react-three/drei';
import { MIT_MODELL, MIT_ANBAU, baueAnbau, saatAusId, reitsitz }
  from '../world/kreaturgestalt.js';
import { Kontur, konturAn, aoStaerke, aoReichweite } from './Kontur.js';
import { WasserUmgebung, useWasserUmgebung } from './WasserUmgebung.js';
import { PALETTE } from '../world/palette.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { baueHoehenfeld, baueKachelraster, lodFuerAbstand, baueKachelGeometrie,
         hoeheAufFlaeche, aufsatzboden, type HoehenFeld, type Kachel } from '../world/lod.js';
import { benutzeSteuerung, type Stoecke } from '../spieler/steuerung.js';
import { peilung } from '../spieler/peilung.js';
import { baueBueschelGeometrie, baueKleinzeugGeometrie, baueStreuMaterial,
         streueUmgebung, streueKleinzeug,
         STREU_MAX, KLEIN_MAX, STREU_NACHZIEHEN } from '../world/streuung.js';
import { baueBodenMaterial } from '../world/bodenmaterial.js';
import { baueBaum } from '../world/baum.js';
import { baueHimmel, setzeHimmel } from '../world/himmel.js';
import { baueFernland, baueFernlandMaterial, type Fernland } from '../world/fernland.js';
import { baueWindMaterial, windAusHoehe, type RollenSlot } from '../world/windmaterial.js';
import { BAUWERKE, bauwerkPfad, gesperrt, sichtbareBauwerke, type Bauwerk } from '../world/bauwerke.js';
import { haengeAgxLookEin } from './tonwert.js';
import { findeKlippen, baueKlippenGeometrie, KLIPPEN_VARIANTEN, type Klippe } from '../world/klippen.js';
import { baueHausMaterial } from '../world/hausmaterial.js';
import { baueWasserMaterial, baueWegMaterial } from '../world/bandmaterial.js';
import { HUEFTE } from '../spieler/figur.js';
import { baueKollision, type Kollisionsfeld } from '../spieler/kollision.js';
import { verteileProps, chunkeProps, propGeometrie, attrappeGeometrie, propPfad, propTon,
         VARIANTEN, type PropArt, type PropChunk, type PropInstanz, blenderBaum } from '../world/props.js';
import { istAus } from './abschalter.js';
import { Kampfplatz } from '../kampf/Kampfplatz.js';
import type { KampfStand } from '../ui/Kampfanzeige.js';
import { meldeFertig, ladezeit } from './ladezeit.js';
import { TERRAIN_SICHT, NEUAUFBAU_AB } from './sichtweiten.js';
import { buendleFernProps, propListenNeu, waehleProps, type PropStufe } from './propauswahl.js';
import { verteileKreaturen, type Vorkommen, type KreaturSpawn } from '../world/vorkommen.js';
import { neueAusdauer, reicht, verbrauche, schritt as ausdauerSchritt,
         KLETTERN_JE_SEK, SPRUNG_KOSTEN, type Ausdauer as Ausdauerzustand } from '../spieler/ausdauer.js';
import { REITEN_GEHEN, REITEN_RENNEN, REIT_MAX_GRAD } from '../spiel/reiten.js';
import { GEHEN, RENNEN, SCHWERKRAFT, ABSPRUNG } from '../spieler/tempo.js';
import { GLEIT_TEMPO, bremse, gleitSchritt, neuerFall, type Fall } from '../spieler/gleiten.js';

/**
 * Tageszeiten als Schlüsselbilder eines durchgehenden Laufs.
 *
 * Vorher waren es drei Knöpfe, und dazwischen gab es nichts. Ein Sprung von Nacht auf
 * Dämmerung ist aber kein Tageswechsel, sondern ein Schnitt — und die interessanten
 * Zustände liegen genau dazwischen, im Übergang.
 *
 * Der Lauf ist bewusst **kein voller Tag**: Es gibt keinen Mittag. Die Art Direction
 * steht auf Dämmerung, Nebel und Silhouetten; Mittagssonne verzeiht nichts und würde
 * jede Schwäche der Geometrie zeigen. Der Zyklus läuft deshalb
 * Nacht → Morgengrauen → Nebelmorgen → Abendrot → Nacht.
 *
 * **Farbvokabular.** Jeder Schlüssel benutzt dieselben vier Rollen und nichts
 * darüber hinaus: ein kaltes Blaugrün für den Zenit, einen warmen Ton am Horizont,
 * einen entsättigten Nebelton und **eine** Sonnenfarbe. Was daraus nicht ableitbar
 * ist, kommt nicht ins Bild — die Signalfarbe des Befalls bleibt die einzige
 * Ausnahme (ADR-0002).
 */
export interface Stimmung {
  himmel: string; nebel: string; nebelNah: number; nebelFern: number;
  sonne: string; sonneStaerke: number; umgebung: string; umgebungStaerke: number;
  sonnenstand: readonly [number, number, number];
  belichtung: number;
  /** Schattenstärke der Sonne 0…1 (`shadow.intensity`); ohne Angabe 1. */
  schatten?: number;
  /** Fensterglut 0…1 (D134): wie hell hinter den Fenstern Licht brennt; ohne Angabe 0. */
  fenster?: number;
  zenit: string; horizont: string; scheibe: number; hof: number;
  /** Silhouettenlicht: Farbe des Himmels, der die Umrisse zeichnet. */
  randFarbe: string;
  randStaerke: number;
}

/**
 * Zweite Farbe der Hemisphere-Lichtquelle — das Licht „von unten".
 *
 * War `#121a16` und damit praktisch schwarz. Wirkung: Alles, was zur Sonne
 * abgewandt oder im Schatten stand, landete unter der **Schwarzgrenze des Tone
 * Mappings**. Die liegt bei ACES nicht bei null, sondern bei einer linearen
 * Strahldichte von rund 0,002/Belichtung — darunter ist der Zähler des RRT-Fits
 * negativ und das Ergebnis wird auf 0 geklemmt. Es gibt dort kein „sehr dunkel",
 * nur „aus". Gemessen mit `npm run licht`.
 *
 * Als Farbe exportiert, damit das Messwerkzeug dieselbe Zahl liest wie die Szene.
 */
export const HEMI_BODEN = PALETTE.licht.hemiBoden;

/**
 * `?belichtung=3.2` überschreibt die Belichtung der laufenden Stimmung.
 *
 * Nur für Messläufe, dieselbe Begründung wie `?absetzen=` (D86), `?aus=` und
 * `?zeit=` (D101): Eine Belichtungsreihe über vier Orte braucht sechzehn
 * reproduzierbare Bilder, und ein Regler von Hand liefert sechzehn Zustände,
 * die niemand nachstellen kann. Ungültige Werte fallen still auf die Stimmung
 * zurück.
 */
const BELICHTUNG_MESSLAUF: number | null = (() => {
  if (typeof location === 'undefined') return null;
  const roh = Number(new URLSearchParams(location.search).get('belichtung'));
  return Number.isFinite(roh) && roh > 0 && roh <= 20 ? roh : null;
})();

/**
 * `?umgebung=4` überschreibt die Stärke des Fülllichts (`hemisphereLight`).
 *
 * Messparameter wie `?belichtung=` (D159): Die sonnenabgewandte Mauerfläche lebt allein vom
 * Fülllicht — im Render füllt sie der Himmelsverlauf, in der Engine ein Hemisphärenlicht, das
 * eine senkrechte Fläche mit dem Mittel aus Himmel und Boden beleuchtet. D154 hatte den Wert
 * für `zielbild` von 4,0 auf 2,0 halbiert, weil der Hof ohne Verdeckung zu hell war; seit die
 * Verdeckung gebacken **und** als SSAO da ist, ist das eine Notlösung ohne Not.
 */
const UMGEBUNG_MESSLAUF: number | null = (() => {
  if (typeof location === 'undefined') return null;
  // Erst auf `null` pruefen, dann rechnen: `Number(null)` ist 0, und 0 ist hier ein gueltiger Wert
  // (Fuelllicht aus). Dieselbe Falle wie bei `?schatten=` unten — hier im ersten Lauf hineingetappt:
  // jede Szene ohne Parameter stand ohne Fuelllicht da, Schatten #000000, Grashang 0,134 -> 0,064.
  const text = new URLSearchParams(location.search).get('umgebung');
  if (text === null) return null;
  const roh = Number(text);
  return Number.isFinite(roh) && roh >= 0 && roh <= 20 ? roh : null;
})();

/**
 * `?kurve=agxlook|agx|aces|neutral|linear` wechselt die Tonwertkurve — **Messparameter** (D161).
 *
 * Der Blender-Render legt den Look über `view_transform = 'AgX'` mit dem Look „Medium High Contrast"
 * fest (`tools/szenenbau.py`), die Engine rechnete seit jeher mit `ACESFilmic`. Das sind zwei
 * verschiedene Kurven: AgX rollt Lichter flacher ab und entsättigt sie, ACES verdichtet und sättigt.
 * Dieselbe Szene mit demselben Licht kann damit nicht dasselbe Bild ergeben — der Vergleich
 * Spiel gegen Render misst bis hierher **auch** den Unterschied der beiden Kurven.
 *
 * **Seit D164 ist `agxlook` die Vorgabe**, ACES nur noch per `?kurve=aces` für den Rückvergleich.
 * Die Entscheidung stand auf zwei Messungen an der Bogenkamera der Felsmulde (16:9, `zielbild`),
 * gegen den Render aus D162:
 *
 * ```
 *                  Median   Drittel o/m/u        dunkel   sat
 *   Render          0,018   0,222/0,123/0,046    53,1 %   0,39
 *   ACES  (vorher)  0,090   0,280/0,192/0,111    15,1 %   0,33
 *   AgX+Look        0,070   0,219/0,155/0,086    20,9 %   0,37
 * ```
 *
 * Jeder Wert geht in dieselbe Richtung, und das **obere Drittel trifft**: 0,219 gegen 0,222, wo
 * ACES mit 0,280 um ein Viertel danebenlag. Am Stauwehr dasselbe Bild — obere Leuchtdichte 0,219
 * → 0,174 bei einem Render von 0,174, Gesamtsättigung 0,43 → 0,48 bei 0,47.
 *
 * Die `belichtung`-Werte der Stimmungen sind weiter gegen ACES gesetzt und **nicht** nachgezogen:
 * AgX macht das Bild durchgehend dunkler, und das ist die Richtung zum Render. Wer sie nachzieht,
 * muss es messen, nicht schätzen.
 */
const KURVE_MESSLAUF: THREE.ToneMapping | null = (() => {
  if (typeof location === 'undefined') return null;
  const name = new URLSearchParams(location.search).get('kurve');
  if (name === null) return null;
  const tabelle: Record<string, THREE.ToneMapping> = {
    agx: THREE.AgXToneMapping, aces: THREE.ACESFilmicToneMapping,
    neutral: THREE.NeutralToneMapping, linear: THREE.LinearToneMapping,
    // `agxlook` ist AgX **plus** dem gemessenen Look des Renders (`tonwert.ts`).
    agxlook: THREE.CustomToneMapping,
  };
  return tabelle[name.toLowerCase()] ?? null;
})();

/**
 * Der Look-Baustein wird **immer** eingehängt, nicht nur wenn die Adresse ihn anfordert.
 *
 * `haengeAgxLookEin()` ersetzt einen Shader-Baustein von three.js. Das muss geschehen, **bevor das
 * erste Material übersetzt wird** — bis D161 stand der Aufruf deshalb im Auswerten der Adresse, wo
 * er als Nebenwirkung eines Tabelleneintrags mitlief. Als Vorgabe geht das nicht mehr: Ohne
 * `?kurve=` würde die Tabelle nie ausgewertet und der Baustein nie ersetzt, das Bild liefe auf
 * `CustomToneMapping` ohne Kurve — also stockdunkel.
 */
haengeAgxLookEin();

/** Kurve ohne Adresse: der Look des Renders (D164). */
const KURVE_VORGABE: THREE.ToneMapping = THREE.CustomToneMapping;

/**
 * `?schatten=0.6` überschreibt die Schattenstärke der Sonne (`shadow.intensity`,
 * 1 = voller Schlagschatten, 0 = keiner). Messparameter für G-127: Das Dorf
 * liegt im Kammschatten, und die Frage ist, wie viel Schatten die Szene
 * verträgt, bevor der Talboden blind wird.
 */
const SCHATTEN_MESSLAUF: number | null = (() => {
  if (typeof location === 'undefined') return null;
  const text = new URLSearchParams(location.search).get('schatten');
  // `Number(null)` ist 0 — und 0 ist hier ein gültiger Wert. Ohne diese Zeile
  // stand jede Szene ohne Parameter ohne Schatten da (gemessen: Dorf 0,248
  // statt 0,140, bevor es auffiel).
  if (text === null) return null;
  const roh = Number(text);
  return Number.isFinite(roh) && roh >= 0 && roh <= 1 ? roh : null;
})();

/**
 * `?normalmap=0|0.5|1` skaliert `normalScale` der gebackenen Bauwerksmaterialien — Messparameter (D166).
 *
 * Gebaut für eine Frage aus D164: Die sonnenabgewandte Mauer der Felsmulde hat im Spiel ein p99 von
 * 0,35, im Render 0,025 — ein Saum heller Steinkanten, den es dort nicht gibt. Zwei Verdächtige: die
 * gebackene Tangentenraum-Normalmap (bei streifendem Licht hebt sie Facetten an, die im Render echte
 * Geometrie mit echtem Schatten sind) und das Silhouettenlicht aus `windmaterial.ts` (`?saum=`), das
 * `Bauwerkteil` mit 0,6 auf jede Mauerfläche legt. Mit beiden Schaltern lassen sie sich trennen.
 */
const NORMAL_MESSLAUF: number | null = (() => {
  if (typeof location === 'undefined') return null;
  const text = new URLSearchParams(location.search).get('normalmap');
  if (text === null) return null;
  const roh = Number(text);
  return Number.isFinite(roh) && roh >= 0 && roh <= 2 ? roh : null;
})();

/**
 * `?hemiboden=3a463c` setzt die Bodenfarbe des Hemisphärenlichts — Messparameter (D166).
 *
 * `HEMI_BODEN` wurde (G-7, D114) von `#121a16` auf `#3a463c` angehoben, weil unter **ACES** alles
 * unterhalb einer linearen Strahldichte von rund 0,0035 auf exakt 0 klemmte. Seit D164 läuft die
 * Engine auf AgX, das erst bei 2^−12,5 ≈ 0,00018 abschneidet — zwanzigmal tiefer. Ob der Wert noch
 * gebraucht wird, sagt dieser Regler, nicht die Rechnung.
 */
const HEMIBODEN_MESSLAUF: string | null = (() => {
  if (typeof location === 'undefined') return null;
  const text = new URLSearchParams(location.search).get('hemiboden');
  return text !== null && /^[0-9a-f]{6}$/i.test(text) ? `#${text}` : null;
})();

/**
 * `?mikro=` setzt die Stärke des Mikroreliefs (Vorgabe 1,1) — Messparameter (D162).
 *
 * Gebaut, um eine Ursache auszuschliessen, nicht um am Gelände zu drehen: Das
 * Karo auf den Hängen liess sich weder dem Gras noch der AO noch dem Flat Shading
 * noch den Biomfarben zuordnen (alle vier einzeln abgeschaltet, Bild unverändert).
 * Übrig bleibt die Form selbst — `mikrorelief` ist Wertrauschen auf einem
 * **quadratischen Gitter**, und Wertrauschen hat an seinen Gitterpunkten
 * verschwindende Steigung. Mit `?mikro=0` steht das Gelände ohne dieses Rauschen
 * da; bleibt das Karo, liegt es nicht daran.
 */
const MIKRO_MESSLAUF: number | null = (() => {
  if (typeof location === 'undefined') return null;
  // Erst auf `null` prüfen, dann rechnen — `Number(null)` ist 0, und 0 ist hier
  // ein gültiger Wert. Dieselbe Falle wie bei `?schatten=` und `?umgebung=`.
  const text = new URLSearchParams(location.search).get('mikro');
  if (text === null) return null;
  const roh = Number(text);
  return Number.isFinite(roh) && roh >= 0 && roh <= 4 ? roh : null;
})();

/**
 * `?spiegel=1` stellt die Kamera **vor** die Figur statt hinter sie (D142).
 *
 * Nur für Messläufe, dieselbe Begründung wie `?absetzen=`: Die Spielerfigur wurde
 * seit D126 nie von vorn gesehen — Gesicht, Halstuch, Kapuzenrand sind gebaut,
 * aber ungeprüft, weil die Kamera im Spiel immer hinter ihr steht. Die Figur
 * dreht sich nicht; die Kamera wandert um 180° auf der Kugel.
 *
 * Seit D145 auch als Winkel: `?spiegel=90` stellt die Kamera **seitlich** — die
 * Sitzpose im Sattel (Knie, Hüfte) ist von vorn und hinten nicht zu beurteilen.
 * `1` bleibt 180° (Messskripte).
 */
const SPIEGEL_GRAD: number = (() => {
  if (typeof location === 'undefined') return 0;
  const roh = new URLSearchParams(location.search).get('spiegel');
  if (roh === null) return 0;
  if (roh === '1') return 180;
  const n = Number(roh);
  return Number.isFinite(n) ? n : 0;
})();

export const STIMMUNG: Record<string, Stimmung> = {
  nacht: {
    himmel: '#0a0f12', nebel: '#101a1c', nebelNah: 25, nebelFern: 260,
    // Umgebung von 0,35 auf 0,60: Bei 0,35 lag JEDE beschattete Fläche exakt bei
    // 0,000 — nicht dunkel, sondern aus. Nacht bleibt die dunkelste Stimmung, aber
    // mit Zeichnung statt mit Löchern.
    /**
     * Belichtung 1,40 → **2,60**: Bei 1,40 war am Hang fast die Hälfte des
     * Bildes nicht dunkel, sondern **aus** (G-116).
     *
     * Der Hinweis darüber stammt aus einem Test gegen eine ebene Fläche und hat
     * den Fall nie gesehen. Gemessen an vier echten Orten, Anteil der Pixel,
     * deren höchster Kanal **exakt 0** ist:
     *
     * | Ort | nacht | daemmerung | nebelmorgen | abendrot |
     * |---|---|---|---|---|
     * | Felsflanke | **42,7 %** | 2,8 % | 1,0 % | 0,1 % |
     * | Waldrand | **47,2 %** | 5,5 % | 4,9 % | 4,6 % |
     * | Talboden | 1,7 % | 0,0 % | 0,2 % | 1,4 % |
     * | Dorf | 1,1 % | 1,5 % | 1,3 % | 0,3 % |
     *
     * Nur `nacht`, und nur wo kein Himmel im Bild steht. Ein Spitzenwert bei
     * **genau 0** und nicht bei 1 oder 2 heisst: Es ist keine Fläche unbeleuchtet,
     * das Ergebnis fällt unter die 8-Bit-Schwelle. Genau deshalb halfen Umgebung
     * (0,80 → 1,05) und ein kleiner Belichtungsschritt (1,40 → 1,75) nichts.
     *
     * Die Reihe, die es entschieden hat — Anteil exakt schwarzer Pixel gegen
     * Belichtung: 1,40 → 42,7 % · 2,00 → 17,2 % · **2,60 → 3,6 %** · 3,20 →
     * 2,6 % · 4,00 → 2,0 %. Der Knick liegt bei 2,60; darüber kostet jeder
     * weitere Schritt Dunkelheit ohne Gewinn.
     *
     * Nacht bleibt mit Abstand die dunkelste Stimmung: Median-Leuchtdichte
     * **0,014** gegen 0,118 bei `daemmerung` und 0,156 bei `nebelmorgen`. Die
     * Lichtwerte sind unangetastet — Belichtung ist seit D22 genau der Regler
     * für „kommt die Szene auf einem Bildschirm an", getrennt von der
     * Kunstrichtung.
     */
    sonne: '#8fa9c4', sonneStaerke: 0.45, umgebung: '#22323a', umgebungStaerke: 0.80,
    sonnenstand: [-80, 90, 60] as const,
    belichtung: 2.60,
    schatten: 0.7,
    fenster: 1.0,    // nachts brennt Licht — das Dorf ist bewohnt (D134)
    // Mond: harte kleine Scheibe, fast kein Hof.
    zenit: '#05080d', horizont: '#131c22', scheibe: 0.0009, hof: 900,
    // Nachts trägt der Umriss fast das ganze Bild — deshalb hier am stärksten.
    randFarbe: '#4d6b82', randStaerke: 0.30,
  },
  daemmerung: {
    himmel: '#141d20', nebel: '#1b2a2b', nebelNah: 60, nebelFern: 420,
    sonne: '#c8b48a', sonneStaerke: 2.4, umgebung: '#4d5f64', umgebungStaerke: 4.0,
    sonnenstand: [-120, 110, -90] as const,
    belichtung: 2.7,
    /**
     * Schlagschatten auf 60 % (D122). Gemessen mit `?schatten=`: Bei 1,0 stand
     * beschatteter Boden bei 28 % des beleuchteten — die Stilreferenz liegt bei
     * etwa 60 %. 0,5 hob das Dorf von 0,102 auf 0,124, Felsflanke und
     * Stauwehr um 0,01; 0,6 ist der Kompromiss, der den Schatten als Form
     * behält.
     */
    schatten: 0.6,
    fenster: 0.15,   // erste Lampen in der Daemmerung
    // Tief stehende Sonne: kleine Scheibe, sehr weiter Hof. Der Hof IST die Stimmung.
    zenit: '#1b3550', horizont: '#4a4238', scheibe: 0.0016, hof: 190,
    randFarbe: '#6e7f86', randStaerke: 0.22,
  },
  nebelmorgen: {
    himmel: '#20282a', nebel: '#2c3a39', nebelNah: 30, nebelFern: 240,
    // Sonne 1,6 → 1,3 und Belichtung 2,2 → 2,05 (D118): Bei 1,6 lag an der
    // Felsflanke ein Viertel des Bildes über Leuchtdichte 0,30 — das Brennen kam
    // aus der Sonne, nicht aus der Belichtung. Jetzt 0,169 Median, 0,4 % hell.
    sonne: '#d8d2c0', sonneStaerke: 1.3, umgebung: '#5d7072', umgebungStaerke: 3.5,
    sonnenstand: [90, 90, -110] as const,
    belichtung: 2.05,
    schatten: 0.5,   // Dunst: weicher Schatten
    // Im Dunst gibt es keine Scheibe, nur einen breiten hellen Fleck.
    zenit: '#26333a', horizont: '#3e4a48', scheibe: 0.0, hof: 42,
    // Im Dunst streut das Licht ohnehin um jede Kante — Rand dezent.
    randFarbe: '#8a9a9c', randStaerke: 0.14,
  },
  abendrot: {
    himmel: '#1a1614', nebel: '#2a221d', nebelNah: 50, nebelFern: 380,
    // Die Sonne steht 20° über dem Horizont — flacher Einfall, also kaum
    // Direktlicht auf waagerechtem Boden. Was das Bild trägt, ist hier die
    // Umgebung: 3,0 → 4,5 und Belichtung 2,4 → 3,0 (D118) holen die Felsflanke
    // von Median 0,058 auf 0,108, ohne dass die Sonne angefasst wird.
    /**
     * Warme Sonne, **kaltes** Umgebungslicht — aus dem Grund, der übrig blieb.
     *
     * Bis zum 27.08.2026 stand hier `umgebung: '#4e433c'`, ein warmes Braun.
     * Am Abend kommt das Direktlicht von der tiefstehenden Sonne und ist warm,
     * das Licht in den Schatten kommt vom **Himmel** und ist blau — zwei warme
     * Quellen sind physikalisch einfach falsch. Gemessen an der Felsflanke
     * (`?absetzen=-1620,-1620,40`): Pixel unter Leuchtdichte 0,02 **29,8 % →
     * 20,6 %**, also ein Drittel weniger Loch, bei einem Messrauschen von 0,3
     * Punkten.
     *
     * **Wofür es NICHT gut war, und das gehört dazu (G-115):** Der Anlass war
     * die Beobachtung, abendrot sei monochrom — gemessen als
     * saettigungsgewichtete Bündelung des Farbwinkels **0,994**, wo dieselbe
     * Szene in `daemmerung` 0,529 und in `nebelmorgen` 0,738 ergibt. Die
     * Umstellung auf kaltes Umgebungslicht änderte daran **nichts** (0,994 →
     * 0,990), und der Nebel als zweiter Verdächtiger genauso wenig (Nebel
     * praktisch abgeschaltet: 0,990). Übrig bleibt die Sonnenfarbe selbst:
     * `#d98b5b` hat Sättigung 0,58 gegen 0,31 bei `daemmerung`, und ein stark
     * gesättigtes Licht zieht jede Fläche, die es trifft, auf seinen Ton. Das
     * ist keine Fehlfunktion — das **ist** Abendrot.
     */
    sonne: '#d98b5b', sonneStaerke: 1.8, umgebung: '#454f5e', umgebungStaerke: 4.5,
    sonnenstand: [130, 55, 70] as const,
    belichtung: 3.0,
    schatten: 0.7,   // lange Abendschatten sind die Stimmung
    fenster: 0.4,
    zenit: '#13202c', horizont: '#5c4030', scheibe: 0.0020, hof: 120,
    randFarbe: '#c07a4e', randStaerke: 0.26,
  },
  /**
   * Probe D152: warmer Dunst. **Nicht im Tageslauf**, nur per `?stimmung=goldnebel`.
   *
   * Referenz sind acht Landschafts-Pressebilder eines aktuellen Titels (Summer
   * Game Fest, 05.06.2026), gemessen mit demselben Mass wie das Bildtor
   * (`.cache/mess/stil.mjs`). Was die Bilder gemeinsam haben, und zwar alle:
   * - Licht **und** Schatten sind warm. Hellste 10 %: `#b7a995`…`#d7bca7`;
   *   dunkelste 2–12 %: `#191410`…`#302521`. Kein blauer Schatten.
   * - Der Dunst ist hell und traegt die Lichtfarbe: oberes Drittel `#7a756b`…
   *   `#9b7873`, Leuchtdichte 0,19–0,24; unteres Drittel 0,03–0,08. Das Bild
   *   faellt von oben nach unten um den Faktor 3–8.
   * - Saettigung nimmt zum Vordergrund **zu**: oben 0,19–0,28, unten 0,30–0,40.
   * - Median 0,06–0,14, dunkel 15–25 %, hell 8–17 %. Eine Blende dunkler als
   *   die D110-Ziele (>= 0,15 / <= 10 %) — deshalb Probe, nicht Tageslauf.
   * - Farbton: 80–95 % der Saettigung liegen in 0–60°, dazu eine Akzentfamilie.
   *
   * Uebernommen wird nur das: Lichtfarbe, Dunstfarbe, Wertestaffelung. Keine
   * Assets, keine Motive (ADR-0004). Erste Werte geschaetzt, dann gemessen und
   * nachgezogen — die Zahlen im Ledger D152.
   */
  goldnebel: {
    // Drei Wuerfe, gemessen (.cache/stil152*.txt):
    // 1. umgebung #6a5748/3,2, belichtung 2,4: Felsflanke traf die Referenz
    //    (Licht #d7c2ae gegen #d7bca7, Dunst oben 0,226), aber Dorf 0,074 und
    //    Grashang 0,099 bei Saettigung 0,53 — Schattenseiten Sepia statt Dunst.
    // 2. Dunst #7d6f63, umgebung #7b6e63/4,2, belichtung 2,9: Dorf 0,185, aber
    //    Felsflanke 0,362 mit 66 % hell — ausgebleicht. Der Dunst war zu hell.
    // 3. Dunst und Himmel von 1, nur das Fuelllicht entsaettigt und angehoben.
    himmel: '#5a4c43', nebel: '#5a4b40', nebelNah: 20, nebelFern: 230,
    sonne: '#e2c6a6', sonneStaerke: 1.4, umgebung: '#7b6e63', umgebungStaerke: 4.0,
    sonnenstand: [110, 38, -90] as const,
    belichtung: 2.5,
    schatten: 0.55,
    fenster: 0.2,
    zenit: '#4c4340', horizont: '#9c7f6c', scheibe: 0.0030, hof: 60,
    randFarbe: '#e8cba8', randStaerke: 0.32,
  },
};
export type StimmungsName = keyof typeof STIMMUNG;
/**
 * `zielbild` (Stufe 2): das Licht der Blender-Szene aus `tools/szenenbau.py` — Sonne 13° hoch im
 * Nordosten (Azimut 42°), warm; Dunst und Fuelllicht wie `goldnebel`. Nur per `?stimmung=zielbild`,
 * fuer den Vergleich Spielbild gegen Render an derselben Kamera (`?kamera=`).
 */
STIMMUNG.zielbild = {
  ...STIMMUNG.goldnebel,
  sonne: '#f2dcc0', sonneStaerke: 1.6,
  // 4,0 wie `goldnebel` (D159). D154 hatte hier halbiert, weil der Hof ohne Verdeckung 6x zu hell war —
  // das traf aber auch die **sonnenabgewandte Mauerfläche**, die allein vom Fülllicht lebt, und machte
  // sie schwarz. Seit die Verdeckung gebacken (Fuge) und als SSAO (8 m) vorliegt, darf das Licht zurück.
  // Gemessen an der Bogenkamera: Median 0,046 -> 0,099, dunkel 31,6 -> 16,2 % (Korridor 0,06–0,14 / 15–25 %).
  umgebungStaerke: 4.0,
  // Azimut 42° von Nord im Uhrzeigersinn, Hoehe 13°: (sin·cos, sin, −cos·cos)
  sonnenstand: [65.2, 22.5, -72.4] as const,
};

/**
 * `?stimmung=goldnebel` setzt eine Stimmung **ausserhalb** des Tageslaufs (D152).
 *
 * Messparameter wie `?zeit=`: Eine Probe-Stimmung soll an denselben Adressen wie
 * die vier Schluesselbilder gemessen werden koennen, ohne dass sie im Tageslauf
 * liegt und damit die Art Direction still verschiebt. Unbekannte Namen fallen
 * auf den Tageslauf zurueck.
 */
const STIMMUNG_MESSLAUF: Stimmung | null = (() => {
  if (typeof location === 'undefined') return null;
  const name = new URLSearchParams(location.search).get('stimmung');
  return name !== null && Object.prototype.hasOwnProperty.call(STIMMUNG, name) ? STIMMUNG[name] : null;
})();

/**
 * Schlüsselbilder auf der Zeitachse 0…1. Der Lauf ist zyklisch: 1 ist wieder 0.
 */
const TAGESLAUF: { zeit: number; name: string }[] = [
  { zeit: 0.00, name: 'nacht' },
  { zeit: 0.26, name: 'daemmerung' },
  { zeit: 0.52, name: 'nebelmorgen' },
  { zeit: 0.78, name: 'abendrot' },
];

function mischeFarbe(a: string, b: string, t: number): string {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

/**
 * Stimmung zu einem Zeitpunkt.
 *
 * Linear zwischen den Nachbarschlüsseln. Bewusst linear und nicht geglättet: Der
 * Regler ist ein Werkzeug zum Suchen eines Looks, und eine Kurve würde bestimmte
 * Zustände unerreichbar machen — genau die, die man sucht.
 */
export function stimmungBei(zeit: number): Stimmung {
  const t = ((zeit % 1) + 1) % 1;
  let i = 0;
  for (let k = 0; k < TAGESLAUF.length; k++) if (t >= TAGESLAUF[k].zeit) i = k;
  const a = TAGESLAUF[i];
  const b = TAGESLAUF[(i + 1) % TAGESLAUF.length];
  const spanne = (b.zeit > a.zeit ? b.zeit : b.zeit + 1) - a.zeit;
  const f = spanne > 0 ? (t - a.zeit) / spanne : 0;

  const A = STIMMUNG[a.name], B = STIMMUNG[b.name];
  const z = (x: number, y: number) => x + (y - x) * f;
  return {
    himmel: mischeFarbe(A.himmel, B.himmel, f),
    nebel: mischeFarbe(A.nebel, B.nebel, f),
    nebelNah: z(A.nebelNah, B.nebelNah),
    nebelFern: z(A.nebelFern, B.nebelFern),
    sonne: mischeFarbe(A.sonne, B.sonne, f),
    sonneStaerke: z(A.sonneStaerke, B.sonneStaerke),
    umgebung: mischeFarbe(A.umgebung, B.umgebung, f),
    umgebungStaerke: z(A.umgebungStaerke, B.umgebungStaerke),
    // Der Sonnenstand wandert mit — das ist der Teil, den man als Bewegung sieht.
    sonnenstand: [
      z(A.sonnenstand[0], B.sonnenstand[0]),
      z(A.sonnenstand[1], B.sonnenstand[1]),
      z(A.sonnenstand[2], B.sonnenstand[2]),
    ] as const,
    belichtung: z(A.belichtung, B.belichtung),
    schatten: z(A.schatten ?? 1, B.schatten ?? 1),
    fenster: z(A.fenster ?? 0, B.fenster ?? 0),
    zenit: mischeFarbe(A.zenit, B.zenit, f),
    horizont: mischeFarbe(A.horizont, B.horizont, f),
    scheibe: z(A.scheibe, B.scheibe),
    hof: z(A.hof, B.hof),
    randFarbe: mischeFarbe(A.randFarbe, B.randFarbe, f),
    randStaerke: z(A.randStaerke, B.randStaerke),
  };
}

/** Zeitpunkt eines Schlüsselbilds — für die Schnellwahl in der Oberfläche. */
export const TAGESZEITEN = TAGESLAUF.map(k => ({ name: k.name, zeit: k.zeit }));


/**
 * Terrain als LOD-Kacheln statt eines groben Rasters.
 *
 * Das alte 96×96-Raster über 4 km ergibt 41,8 m je Vertex — direkt vor dem Spieler
 * ist der Boden dann eine einzige Fläche ohne jede Kante. Hier wird je Kachel nach
 * Abstand aufgelöst: 2 m nah, 32 m fern.
 *
 * Zwei Dinge, die den Ausschlag geben:
 * - Kacheln derselben Stufe werden zu einer Geometrie zusammengefasst. Einzeln wären
 *   es ~180 Draw Calls; so sind es fünf.
 * - Gebaute Kacheln bleiben im Cache. Ein Neuaufbau pro Bild wäre unbezahlbar, und
 *   ohne Bewegung ändert sich die Zuordnung ohnehin nicht.
 */
function LodTerrain({ feld, kacheln, ziel }: {
  feld: HoehenFeld; kacheln: Kachel[]; ziel: React.RefObject<THREE.Object3D | null>;
}) {
  const cache = useRef(new Map<string, THREE.BufferGeometry>());
  const letzte = useRef(new THREE.Vector3(NaN, NaN, NaN));
  const [stufen, setStufen] = useState<THREE.BufferGeometry[]>([]);

  const material = useMemo(() => baueBodenMaterial(), []);

  useFrame(() => {
    const p = ziel.current?.position;
    if (!p) return;
    // Beim ersten Bild ist der Abstand NaN — der Vergleich schlägt fehl, also wird gebaut.
    if (letzte.current.distanceTo(p) < NEUAUFBAU_AB) return;
    letzte.current.copy(p);

    // Höchstens so viele Kacheln je Bild neu bauen. Alle 226 auf einmal kosten
    // gemessen 68 ms — ein sichtbarer Ruckler alle 32 m. Fehlende Kacheln werden im
    // nächsten Bild nachgezogen; bis dahin fehlt am Rand ein Stück, das im Nebel liegt.
    let budget = 12;
    const jeStufe = new Map<number, THREE.BufferGeometry[]>();
    for (const k of kacheln) {
      const d = Math.max(0, Math.hypot(k.mitte[0] - p.x, k.mitte[1] - p.z) - k.radius);
      if (d > TERRAIN_SICHT) continue;
      const lod = lodFuerAbstand(d);
      const schluessel = `${k.ix}:${k.iz}:${lod}`;
      let g = cache.current.get(schluessel);
      if (!g) {
        if (budget-- <= 0) { letzte.current.set(NaN, NaN, NaN); continue; }
        g = baueKachelGeometrie(feld, k, lod);
        cache.current.set(schluessel, g);
      }
      const liste = jeStufe.get(lod);
      if (liste) liste.push(g); else jeStufe.set(lod, [g]);
    }

    // Budget nicht ausgeschöpft: alle Kacheln in Sicht stehen — Ladezeit (D146).
    if (budget >= 0) meldeFertig('terrain');

    const zusammengefasst: THREE.BufferGeometry[] = [];
    for (const gs of jeStufe.values()) {
      const m = mergeGeometries(gs, false);
      if (m) zusammengefasst.push(m);
    }
    setStufen(vorher => { vorher.forEach(g => g.dispose()); return zusammengefasst; });
  });

  return <>{stufen.map((g, i) => (
    <mesh key={i} geometry={g} material={material} receiveShadow castShadow />
  ))}</>;
}

function Terrain({ welt, terrain, feld, kacheln, ziel, props, dichte, rand, fenster }: {
  welt: Weltdaten; terrain: TerrainErgebnis; feld: HoehenFeld;
  kacheln: Kachel[]; ziel: React.RefObject<THREE.Object3D | null>;
  props: PropInstanz[]; dichte: number;
  /** Silhouettenlicht — Farbe und Stärke kommen aus der Stimmung. */
  rand: { farbe: string; staerke: number };
  /** Fensterglut 0…1 aus der Stimmung (D134). */
  fenster: number;
}) {
  /**
   * Wege, Gewässer und Gebäude setzen auf dem Gelände auf — sie brauchen dieselbe
   * Höhenfunktion, die den sichtbaren Boden zeichnet, und dazu die Auskunft, wie
   * weit dieser Boden in der Ferne unter ihnen wegfallen kann.
   *
   * Beides liefert `aufsatzboden()`. Das handgebaute `{...terrain, hoeheAn: …}`,
   * das hier stand, war korrekt — aber es war eine zweite Quelle neben der, die
   * die Werkzeuge benutzten, und genau daran ist die erste Messung gescheitert
   * (G-73).
   */
  const aufBoden = useMemo(() => aufsatzboden(feld), [feld]);
  /* Wand, Holz, Fenster, Sockel, Gesims, Tür und Garten stecken als Vertexfarben
     in der Geometrie. Ein Material für alles davon bleibt es trotzdem. */
  const hausMaterial = useMemo(() => baueHausMaterial(), []);
  useEffect(() => { (hausMaterial.userData.glut as { value: number }).value = fenster; }, [hausMaterial, fenster]);
  const wasserMaterial = useMemo(() => baueWasserMaterial(false,
    typeof location !== 'undefined' && new URLSearchParams(location.search).get('wasser') === 'physikalisch'), []);
  useWasserUmgebung(wasserMaterial);
  const fallMaterial = useMemo(() => baueWasserMaterial(true), []);
  const wegMaterial = useMemo(() => baueWegMaterial(), []);
  const wind = useMemo(() => baueWindMaterial({
    amplitude: 0.55, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke,
  }), []);
  /**
   * Gras-Attrappen: derselbe Wind, aber **glatt** schattiert (D121). Die
   * Grasbüschel tragen seit D121 Normalen senkrecht nach oben wie die Streuung
   * — mit `flatShading` würde three.js sie ignorieren und die Flächennormale
   * aus den Ableitungen nehmen, und ein Halm stünde wieder halb im
   * Eigenschatten. Kleinere Amplitude: ein Büschel schwingt, es peitscht nicht.
   */
  const grasWind = useMemo(() => baueWindMaterial({
    amplitude: 0.25, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke * 0.5,
  }, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 1, metalness: 0 })), []);
  /**
   * Blender-Baeume (D155): derselbe Wind, aber glatt schattiert (die Blattmassen tragen Normalen),
   * Loecher im Laub (`COLOR_0.a` = Laubmaske) und Durchlass fuer das Gegenlicht — dasselbe Rezept
   * wie die Bauwerke, nur als Instanz. Der Saum bleibt schwach: Klumpen mit Loechern sind lauter Kanten.
   */
  const baumWind = useMemo(() => baueWindMaterial({
    amplitude: 0.55, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke * 0.2,
    // Schaerfe 3 -> 10 (D160): Auf Blattmassen aus kleinen Kugeln ist `1 - |N·V|` fast ueberall hoch,
    // der Saum lag deshalb als heller Flaum ueber der ganzen Krone statt als Kante — gemessen am
    // Stauwehr 30 % der Bildhelligkeit (Median 0,100 -> 0,069 ohne Saum). Kreaturen und Figur behalten
    // ihre weichen 1,6: dort ist die Flaeche gross und die Silhouette wirklich ein Rand.
    randSchaerfe: 10,
    loecher: 0.42, loecherSkala: 9, durchlass: 0.45,
  }, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.95, metalness: 0, side: THREE.DoubleSide })), []);
  useEffect(() => {
    wind.setzeRand(new THREE.Color(rand.farbe), rand.staerke);
    grasWind.setzeRand(new THREE.Color(rand.farbe), rand.staerke * 0.5);
    baumWind.setzeRand(new THREE.Color(rand.farbe), rand.staerke * 0.2);
  }, [wind, grasWind, baumWind, rand]);

  // Die Strömung braucht eine Uhr. Ein Uniform je Bild ist der billigste Weg — die
  // Alternative wäre, die Geometrie zu bewegen, und das wären 200.000 Vertices.
  /**
   * Klippen einmal je Welt suchen. Der Durchlauf tastet das Höhenfeld in 14-m-Schritten
   * ab — bei 4 km Kantenlänge rund 81.000 Prüfungen, einmalig beim Start.
   */
  const klippen = useMemo(() => findeKlippen(feld, (x, z) => hoeheAufFlaeche(feld, x, z)), [feld]);

  const uhr = useRef(0);
  useFrame((_, dt) => {
    uhr.current += dt;
    for (const m of [wasserMaterial, fallMaterial]) {
      const z = m.userData.zeit as { value: number } | undefined;
      if (z) z.value += dt;
    }
    wind.setzeZeit(uhr.current);
    grasWind.setzeZeit(uhr.current);
    baumWind.setzeZeit(uhr.current);
  });
  /**
   * Bänder einmal zerlegen, dann je Kachel bauen.
   *
   * Die Zerlegung kostet einen Durchlauf über 42.000 Wegteile und 9.000 Bachteile
   * und passiert genau einmal je Welt. Was danach je Kachel gebaut wird, ist ein
   * Bruchteil davon — und es fällt weg, sobald die Kachel außer Sicht gerät.
   */
  const satz = useMemo(() => zerlegeBaender(welt, feld), [welt, feld]);

  return (
    <group>
      <LodTerrain feld={feld} kacheln={kacheln} ziel={ziel} />

      <LodBaender welt={welt} feld={feld} satz={satz} kacheln={kacheln} ziel={ziel}
                  boden={aufBoden}
                  wegMaterial={wegMaterial} wasserMaterial={wasserMaterial}
                  fallMaterial={fallMaterial} hausMaterial={hausMaterial} />

      {!istAus('fels') && klippen.length > 0 && (
        <Klippen klippen={klippen} ziel={ziel} material={wind.material} />)}

      <Props props={props} wind={wind.material} grasWind={grasWind.material} baumWind={baumWind.material} baumTiefe={baumWind.tiefe} />
      <Streuschicht feld={feld} ziel={ziel} dichte={dichte} />
    </group>
  );
}

/**
 * Wege, Bäche, Wasserfälle, Häuser und Gärten je Kachel — dasselbe Verfahren wie
 * beim Gelände.
 *
 * Der Grund, warum das hier steht und nicht in einem `useMemo`: Ein Band muss auf
 * **derselben** LOD-Stufe gebaut werden wie die Kachel, auf der es liegt, und die
 * hängt an der Kameraentfernung. Ein einmal gebautes Band für die ganze Region
 * kann das nicht — es hing gemessen auf der gröbsten Stufe zu 26 % über einem
 * halben Meter in der Luft (G-70).
 *
 * Cache und Budget sind von `LodTerrain` übernommen, samt Begründung: Alle Kacheln
 * auf einmal neu zu bauen kostet einen sichtbaren Ruckler, fehlende werden im
 * nächsten Bild nachgezogen.
 */
function LodBaender({ welt, feld, satz, kacheln, ziel, boden,
                     wegMaterial, wasserMaterial, fallMaterial, hausMaterial }: {
  welt: Weltdaten; feld: HoehenFeld; satz: Bandsatz; kacheln: Kachel[];
  ziel: React.RefObject<THREE.Object3D | null>;
  boden: ReturnType<typeof aufsatzboden>;
  wegMaterial: THREE.Material; wasserMaterial: THREE.Material;
  fallMaterial: THREE.Material; hausMaterial: THREE.Material;
}) {
  const cache = useRef(new Map<string, THREE.BufferGeometry | null>());
  const letzte = useRef(new THREE.Vector3(NaN, NaN, NaN));
  const [teile, setTeile] = useState<{ weg: THREE.BufferGeometry[];
                                       wasser: THREE.BufferGeometry[];
                                       fall: THREE.BufferGeometry[];
                                       haus: THREE.BufferGeometry[] }>(
    { weg: [], wasser: [], fall: [], haus: [] });

  /**
   * Häuser einer Kachel. Sie hängen nicht an der LOD-Stufe — ein Haus ist ein
   * Körper, kein Aufsatz — aber sie fallen mit der Entfernung weg, und genau
   * darum geht es: 214.000 Dreiecke lagen vorher in einem Mesh, das gezeichnet
   * wurde, sobald ein Zipfel der Region im Bild war.
   */
  const hausKachel = useMemo(() => (
    _feld: HoehenFeld, s: Bandsatz, k: Kachel, _lod: number,
  ) => {
    if (istAus('haeuser')) return null;
    const indizes = s.gebaeude.get(`${k.ix}:${k.iz}`);
    if (!indizes?.length) return null;
    return baueGebaeude(welt, boden, indizes.map(i => welt.gebaeude[i]));
  }, [welt, boden]);

  useFrame(() => {
    const p = ziel.current?.position;
    if (!p) return;
    if (letzte.current.distanceTo(p) < NEUAUFBAU_AB) return;
    letzte.current.copy(p);

    let budget = 12;
    const sammeln = { weg: [] as THREE.BufferGeometry[],
                      wasser: [] as THREE.BufferGeometry[],
                      fall: [] as THREE.BufferGeometry[],
                      haus: [] as THREE.BufferGeometry[] };
    for (const k of kacheln) {
      const d = Math.max(0, Math.hypot(k.mitte[0] - p.x, k.mitte[1] - p.z) - k.radius);
      if (d > TERRAIN_SICHT) continue;
      const lod = lodFuerAbstand(d);
      for (const [art, bauen] of [
        ['weg', baueWegKachel], ['wasser', baueWasserKachel], ['fall', baueFallKachel],
        ['haus', hausKachel], ['garten', baueGartenKachel],
      ] as const) {
        const schluessel = `${art}:${k.ix}:${k.iz}:${lod}`;
        let g = cache.current.get(schluessel);
        if (g === undefined) {
          // `null` heißt „hier liegt nichts" und wird genauso gemerkt wie eine
          // Geometrie — sonst probiert jede Neubewertung die leeren Kacheln erneut,
          // und das sind die meisten.
          if (budget-- <= 0) { letzte.current.set(NaN, NaN, NaN); continue; }
          g = bauen(feld, satz, k, lod);
          cache.current.set(schluessel, g);
        }
        // Gärten teilen sich das Material mit den Häusern: beides Vertexfarbe,
        // beides undurchsichtig, beides derselbe Draw Call je Kachelgruppe.
        if (g) sammeln[art === 'garten' ? 'haus' : art].push(g);
      }
    }

    if (budget >= 0) meldeFertig('baender');

    const fassen = (gs: THREE.BufferGeometry[]) =>
      gs.length ? [mergeGeometries(gs, false)].filter(Boolean) as THREE.BufferGeometry[] : [];
    const neu = { weg: fassen(sammeln.weg), wasser: fassen(sammeln.wasser),
                  fall: fassen(sammeln.fall), haus: fassen(sammeln.haus) };
    setTeile(vorher => {
      for (const liste of [vorher.weg, vorher.wasser, vorher.fall, vorher.haus])
        liste.forEach(g => g.dispose());
      return neu;
    });
  });

  return <>
    {teile.weg.map((g, i) => <mesh key={`w${i}`} geometry={g} material={wegMaterial} receiveShadow />)}
    {teile.wasser.map((g, i) => <mesh key={`b${i}`} geometry={g} material={wasserMaterial} />)}
    {teile.fall.map((g, i) => <mesh key={`f${i}`} geometry={g} material={fallMaterial} />)}
    {teile.haus.map((g, i) => (
      <mesh key={`h${i}`} geometry={g} material={hausMaterial} castShadow receiveShadow />
    ))}
  </>;
}

/**
 * Verwaltet die Prop-Chunks.
 *
 * Der Kern: Von 16.663 Chunks sind je Standort rund 400 sichtbar. Früher war **jeder**
 * Chunk eine montierte Komponente mit eigenem `useFrame` — 16.663 Callbacks je Bild
 * plus ebenso viele Objekte, die three.js jedes Bild durchläuft. Das war der Grund,
 * warum die Bildrate auch mit allen Grafikschaltern auf Minimum nicht stieg: Die Last
 * lag in JavaScript, nicht auf der GPU.
 *
 * Jetzt hält eine einzige Schleife die Liste, und montiert werden nur die sichtbaren.
 * Neu bestimmt wird erst, wenn sich der Spieler PROP_NEUBEWERTUNG Meter bewegt hat.
 */
function Props({ props, wind, grasWind, baumWind, baumTiefe }: { props: PropInstanz[]; wind: THREE.MeshStandardMaterial; grasWind: THREE.MeshStandardMaterial; baumWind: THREE.MeshStandardMaterial; baumTiefe?: THREE.MeshDepthMaterial }) {
  const chunks = useMemo(() => chunkeProps(props), [props]);
  const [sichtbar, setSichtbar] = useState<{ c: PropChunk; stufe: PropStufe; id: string }[]>([]);
  const [fern, setFern] = useState<{ art: PropArt; variante: number; instanzen: PropInstanz[] }[]>([]);
  const letzte = useRef(new THREE.Vector3(NaN, NaN, NaN));
  const letzteFern = useRef(new THREE.Vector3(NaN, NaN, NaN));
  /** Kacheln, die im vorigen Durchlauf Attrappen waren — siehe `waehleProps` (D164). */
  const vorigeAttrappen = useRef<ReadonlySet<string> | undefined>(undefined);

  useFrame(({ camera }) => {
    const p = camera.position;
    /**
     * `!(abstand < schwelle)` und **nicht** `abstand >= schwelle`.
     *
     * Beide Refs starten als `(NaN, NaN, NaN)`, damit der erste Durchlauf immer
     * baut. `NaN >= 8` ist aber `false`, `NaN < 8` ebenfalls — die beiden Formen
     * sind für NaN nicht gleichwertig. Mit `>=` blieb die Szene am 26.08.2026
     * still ohne jeden Prop stehen: kein Fehler, keine Ausnahme, nur 19 statt
     * 194 Draw Calls. Die alte Fassung schrieb `if (abstand < schwelle) return`
     * und war deshalb richtig, ohne dass es jemandem auffiel.
     */
    const { nah: nahNeu, fern: fernNeu } = propListenNeu(
      letzte.current.distanceTo(p), letzteFern.current.distanceTo(p));
    if (!nahNeu && !fernNeu) return;

    // Der Anker ist der Punkt, an dem das Bündel zuletzt gebaut wurde. Warum die
    // Zugehörigkeit daran hängt und nicht an der Kamera, steht in `propauswahl.ts`.
    if (fernNeu || Number.isNaN(letzteFern.current.x)) letzteFern.current.copy(p);
    const anker: [number, number] = [letzteFern.current.x, letzteFern.current.z];
    // `vorigeAttrappen` sind die Kacheln, die beim **letzten** Durchlauf Attrappen waren.
    // Sie zwingen die Kette über die Mittelstufe, statt vom Kegel aufs volle Modell zu
    // springen — gemessen 6 solcher Sprünge in 24 s Lauf (D164, `propauswahl.ts`).
    const { nah, buendel, buendelKacheln } = waehleProps(
      chunks, [p.x, p.z], anker, fernNeu, vorigeAttrappen.current);
    vorigeAttrappen.current = buendelKacheln;

    // Ein neuer Fernanker verschiebt auch die Grenze zwischen Chunk und Bündel.
    // Deshalb beide Listen gemeinsam ersetzen, selbst wenn die letzte 8-m-
    // Nahbewertung erst ein Bild zuvor lief; sonst steht ein Randchunk kurz doppelt.
    if (nahNeu || fernNeu) {
      letzte.current.copy(p);
      setSichtbar(nah.map(({ c, stufe }) => ({
        // Die Stufe gehört in den Schlüssel: Seit die Mittelstufe ihre Varianten
        // zusammenlegt (D100), tragen alle zusammengelegten Chunks `variante 0`,
        // und ohne die Stufe könnte ein Nahchunk derselben Kachel mit Variante 0
        // denselben Schlüssel bekommen.
        c, stufe, id: `${c.art}:${c.variante}:${stufe}:${c.mitte[0]}:${c.mitte[1]}`,
      })));
    }
    if (fernNeu) {
      setFern(buendleFernProps(buendel));
    }
  });

  return (
    <>
      {sichtbar.map(({ c, stufe, id }) =>
        <PropChunkMesh key={id} chunk={c} stufe={stufe} wind={wind} grasWind={grasWind} baumWind={baumWind} baumTiefe={baumTiefe} />)}
      {fern.map(({ art, variante, instanzen }) =>
        <PropFernMesh key={`${art}:${variante}`} art={art} variante={variante} instanzen={instanzen} baumWind={baumWind} />)}
    </>
  );
}

/**
 * Alle Attrappen **einer Art** in einem einzigen Aufruf.
 *
 * ## Warum
 *
 * Am 26.08.2026 auf dem iPhone gemessen, gleicher Ort, gleicher Bau, nur die
 * Bäume unterschiedlich: 175 Draw Calls kosten **2 ms**, die 50.000 Dreiecke im
 * selben Bild kosten fast nichts — 11 µs je Aufruf gegen 40 ns je Dreieck, und
 * die 40 ns sind für einen Kachel-Renderer um Größenordnungen zu viel (G-111).
 * Der Engpass sind also die Aufrufe, und die kommen aus der Zerlegung in
 * 70-m-Kacheln: Bei 420 m Sichtweite für Bäume liegen rund 900 Attrappen-Chunks
 * in Reichweite, jeder ein eigenes `InstancedMesh`.
 *
 * Attrappen aller Chunks einer Art teilen sich **Geometrie und Material** — die
 * Trennung nach Kachel und Variante bringt dort nichts als Aufrufe. Gebündelt
 * sind es sechs statt neunhundert.
 *
 * ## Was es kostet
 *
 * Das Frustum-Culling je Kachel entfällt: Gezeichnet wird der ganze Ring, nicht
 * nur der Ausschnitt im Blickfeld. Gemessen über vier Standorte sind das 32.000
 * bis 89.000 Dreiecke statt rund einem Drittel davon — nach der Messung oben der
 * gute Tausch.
 *
 * Zweiter Preis: Beim Neubündeln müssen 3.000 bis 7.500 Matrizen geschrieben
 * werden. Deshalb hat die Attrappenstufe ihre **eigene** Neubewertungsschwelle
 * (`FERN_NEUBEWERTUNG`), deutlich gröber als die 8 m der Nahstufe: Ein Primitiv
 * jenseits von 110 m ändert sein Aussehen über 60 m Bewegung nicht.
 *
 * Die Kapazität wächst nur nach oben. Ein `args`-Wechsel baut das
 * `InstancedMesh` neu auf, und das ist genau der Fall, den `PropChunkMesh` im
 * Kommentar als teuer beschreibt.
 */
function PropFernMesh({ art, variante, instanzen, baumWind }: { art: PropArt; variante: number; instanzen: PropInstanz[]; baumWind: THREE.MeshStandardMaterial }) {
  // Dieselbe Baumvariante in allen Stufen; die Fernstufe reduziert nur Dreiecke.
  const eigen = art === 'nadelbaum' ? 'fichte' : art === 'laubbaum' ? 'buche' : null;
  const blender = eigen ? blenderBaum(eigen, variante, 'fern') : null;
  const { scene } = useGLTF(propPfad(blender ? blender.datei : VARIANTEN.busch[0].datei));
  const geo = useMemo(() => {
    if (!blender) return attrappeGeometrie(art);
    let g: THREE.BufferGeometry | null = null;
    scene.updateMatrixWorld(true);
    scene.traverse(o => {
      if (!g && (o as THREE.Mesh).isMesh) g = (o as THREE.Mesh).geometry.clone().applyMatrix4(o.matrixWorld);
    });
    if (g) {
      const geometrie = g as THREE.BufferGeometry;
      const gewicht = geometrie.getAttribute('_wind');
      if (gewicht) geometrie.setAttribute('aWind', gewicht);
    }
    return (g ?? attrappeGeometrie(art)) as THREE.BufferGeometry;
  }, [art, blender, scene]);
  const ref = useRef<THREE.InstancedMesh>(null);
  const [kapazitaet, setKapazitaet] = useState(() => Math.ceil(instanzen.length * 1.4) + 64);

  useEffect(() => {
    if (instanzen.length > kapazitaet) {
      setKapazitaet(Math.ceil(instanzen.length * 1.4) + 64);
      return;
    }
    const m = ref.current;
    if (!m) return;
    const hilfe = new THREE.Object3D();
    const ton = new THREE.Color();
    instanzen.forEach((p, i) => {
      hilfe.position.set(...p.position);
      hilfe.rotation.y = p.drehung;
      hilfe.scale.setScalar(p.skalierung);
      hilfe.updateMatrix();
      m.setMatrixAt(i, hilfe.matrix);
      const [r, g, b] = propTon(p.art, p.variante, p.drehung);
      m.setColorAt(i, ton.setRGB(r, g, b));
    });
    m.count = instanzen.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [instanzen, kapazitaet]);

  return (
    <instancedMesh
      ref={ref} args={[undefined, undefined, kapazitaet]}
      name={blender ? `baum:${art}:${variante}:fern` : `prop:${art}:fern`}
      geometry={geo} material={blender ? baumWind : FERN_MATERIAL}
      // Der Bündel umspannt den ganzen Sichtring; ein Frustum-Test daran wäre
      // immer wahr und damit verlorene Zeit.
      frustumCulled={false}
    />
  );
}

/**
 * Lädt das Modell der Variante und normiert es auf die reale Zielhöhe.
 * useGLTF cached pro Pfad — 23 Dateien werden einmal geladen, egal wie viele Chunks.
 */
/**
 * Ein Material für alle Props, die kein Laub sind.
 *
 * Seit `npm run props:bau` tragen die Modelle ihre Farbe als Vertexattribut. Vorher
 * kam sie aus dem GLB-Material — und das war Kenneys Palette: Gras `#73eddd` Minze,
 * Rinde `#f2be9e` Pfirsich. Dieselben Modelle in der Ferne benutzten `PROP_FARBE`
 * (Grau, Oliv). Ein Findling wechselte beim Näherkommen die Farbe (G-76).
 */
const PROP_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: true, roughness: 1, metalness: 0,
});
const FERN_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: true, roughness: 1, metalness: 0,
});
function useNormiertesPropMesh(art: PropArt, variante: number, stufe: PropStufe = 'nah') {
  const liste = VARIANTEN[art];
  // Auch der prozedurale Fallback braucht einen unbedingten Lade-Hook.
  const eigen = art === 'nadelbaum' ? 'fichte' : art === 'laubbaum' ? 'buche' : null;
  // Blender-Baum (D155), wenn das Register einen hat — sonst der prozedurale (D40)
  const blender = eigen ? blenderBaum(eigen, variante, stufe) : null;
  const pfad = propPfad(blender ? blender.datei : ((liste[variante] ?? liste[0])?.datei ?? VARIANTEN.busch[0].datei));
  const { scene } = useGLTF(pfad);
  return useMemo(() => {
    if (eigen && !blender) return { geo: baueBaum(eigen, variante, stufe === 'nah' ? 'voll' : 'mittel'), blender: false };
    let geo: THREE.BufferGeometry | null = null;
    // Der Blender-Ursprung kann am Kronenzentrum liegen. Beim Herausloesen
    // muss die Knotenmatrix mit: sonst versinkt etwa Fichte 0 um 10,25 m.
    scene.updateMatrixWorld(true);
    scene.traverse(o => {
      if (!geo && (o as THREE.Mesh).isMesh) geo = (o as THREE.Mesh).geometry.clone().applyMatrix4(o.matrixWorld);
    });
    if (eigen && geo) {
      // Windgewicht aus der Datei (`_WIND` → `_wind`), sonst aus der Hoehe; Laubmaske steht in COLOR_0.a
      const g = geo as THREE.BufferGeometry;
      const w = g.getAttribute('_wind');
      if (w) g.setAttribute('aWind', w); else windAusHoehe(g, g.boundingBox?.max.y ?? 20);
    }
    // Keine Normierung mehr. Die Höhe steht in `VARIANTEN` und ist beim Bauen in
    // die Datei eingerechnet — sie hier erneut auf eine Zielhöhe je Art zu ziehen,
    // hätte alle sechs Grasvarianten wieder auf dieselben 0,35 m gestreckt.
    return { geo: (geo ?? propGeometrie(art)) as THREE.BufferGeometry, blender: !!(eigen && blender) };
  }, [scene, art, eigen, blender, variante, stufe]);
}

const LEER: ReadonlySet<string> = new Set();

/** Welche Auflösung ein Chunk gerade zeigt. */
function PropChunkMesh({ chunk, stufe, wind, grasWind, baumWind, baumTiefe }: {
  chunk: PropChunk; stufe: PropStufe; wind: THREE.MeshStandardMaterial; grasWind: THREE.MeshStandardMaterial;
  baumWind: THREE.MeshStandardMaterial; baumTiefe?: THREE.MeshDepthMaterial;
}) {
  const fern = stufe === 'fern';
  const { geo, blender } = useNormiertesPropMesh(chunk.art, chunk.variante, stufe);
  const fernGeo = useMemo(() => attrappeGeometrie(chunk.art), [chunk.art]);
  // Nur was sich biegen kann, bekommt das Windmaterial. Findlinge und Totholz
  // schwingen nicht, und ein wackelnder Findling zerstört mehr Glaubwürdigkeit,
  // als bewegtes Laub aufbaut.
  const biegsam = chunk.art === 'nadelbaum' || chunk.art === 'laubbaum' || chunk.art === 'busch';
  const gras = chunk.art === 'grasbuschel';
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Object3D();
    const ton = new THREE.Color();
    chunk.instanzen.forEach((p, i) => {
      m.position.set(...p.position);
      m.rotation.y = p.drehung;
      m.scale.setScalar(p.skalierung);
      m.updateMatrix();
      ref.current!.setMatrixAt(i, m.matrix);
      // Farbe je Instanz (D79). `setRGB` ohne Farbraum schreibt direkt in den
      // Arbeitsraum — die Werte sind Faktoren um 1,0, keine Farben, und dürfen
      // deshalb nicht durch die sRGB-Umrechnung.
      const [r, g, b] = propTon(p.art, p.variante, p.drehung);
      ref.current!.setColorAt(i, ton.setRGB(r, g, b));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [chunk]);

  // Der Umriss ändert sich beim Wechsel auf die Attrappe; ohne Neuberechnung
  // schneidet das Frustum-Culling falsch.
  useEffect(() => { ref.current?.computeBoundingSphere(); }, [fern]);

  // Kein useFrame mehr in dieser Komponente. Sichtbarkeit und Attrappen-Entscheidung
  // trifft die Verwaltung — bei 16.663 Chunks wären 16.663 Callbacks je Bild der
  // teuerste Posten der ganzen Szene, unabhängig von jeder Grafikeinstellung.
  //
  // Wichtig: Geometrie und Material laufen als Attribute, nicht über `args`. Eine
  // Änderung an `args` lässt R3F das InstancedMesh neu bauen — die Instanzmatrizen
  // wären weg und der Chunk stünde beim Attrappenwechsel als Klumpen im Nullpunkt.
  const grossesTeil = chunk.art === 'nadelbaum' || chunk.art === 'laubbaum' || chunk.art === 'findling';

  return (
    <instancedMesh
      ref={ref} args={[undefined, undefined, chunk.instanzen.length]}
      name={blender ? `baum:${chunk.art}:${chunk.variante}:${stufe}` : `prop:${chunk.art}:${stufe}`}
      geometry={fern && !blender ? fernGeo : geo}
      material={blender ? baumWind : fern ? FERN_MATERIAL : gras ? grasWind : (biegsam ? wind : PROP_MATERIAL)}
      customDepthMaterial={blender && !fern ? baumTiefe : undefined}
      castShadow={grossesTeil && !fern} receiveShadow={grossesTeil && !fern}
    />
  );
}

/**
 * Kreaturen in der Welt.
 *
 * Gezeichnet wird nur der Nahbereich: Von rund tausend Vorkommen in der Region sind
 * je Standort ein paar Dutzend in Reichweite. Die Auswahl läuft — wie bei den Props —
 * in **einer** Schleife und wird erst nach einigen Metern Bewegung neu bestimmt.
 *
 * Die Begegnung dagegen wird jedes Bild geprüft: Sie hängt an wenigen Objekten, und
 * eine verzögerte Prüfung hieße, durch eine Kreatur hindurchzulaufen.
 */
const KREATUR_SICHT = 140;
const KREATUR_NEUBEWERTUNG = 12;
/** Ab diesem Abstand beginnt der Kampf. Etwa zwei Schritte — nah genug, dass es
 *  gewollt wirkt, weit genug, dass man nicht in der Kreatur steht. */
export const BEGEGNUNG_AB = 4.5;

/**
 * Was die Witterungsanzeige braucht.
 *
 * Der Anlass ist eine Messung, kein Gefühl: Im Schnitt stehen 3,7 Kreaturen in
 * Sichtweite und die nächste ist 62 m weg. Eine 0,9 m hohe Silhouette ist auf 62 m
 * bei 55° Sichtfeld aber nur **zwölf Pixel** hoch — im Dämmerlicht und im Nebel
 * findet die niemand durch Hinsehen. Das Problem ist nicht die Dichte, sondern die
 * Auflösung des menschlichen Auges gegen einen 4 km breiten Hang.
 */
export interface Naehe {
  /** Meter zur nächsten Kreatur, Infinity wenn keine in Reichweite. */
  abstand: number;
  /** Richtung relativ zum Blick in Radiant. 0 = geradeaus, positiv = rechts. */
  winkel: number;
  kreatur: string;
}
/** So weit muss man sich nach einer Begegnung entfernen, bevor die nächste zählt. */
const SPERRE_BIS = 14;

/**
 * Bewegung einer Kreatur im Raum (D138): ein langsamer Zufallsgang um den
 * Spawn, mit Stehen dazwischen. Der Zustand lebt ausserhalb von React — er
 * aendert sich jedes Bild, und ein Re-Render je Bild fuer 40 Tiere ist genau
 * das, was `nah` als State vermeiden soll.
 */
interface Lauf {
  x: number; y: number; z: number;
  /** Blickrichtung um die Hochachse; das Modell schaut nach −Z. */
  kurs: number;
  /** 1 = geht, 0 = steht; `gang` blendet weich dazwischen. */
  tempo: number;
  gang: number;
  /** Zeitpunkt (Uhr der Szene), an dem der aktuelle Zustand endet. */
  bis: number;
  /** Spawn — weiter als `LAUF_RADIUS` entfernt sich das Tier nicht. */
  x0: number; z0: number;
}
/** Umkreis um den Spawn, in dem ein Tier umhergeht. */
const LAUF_RADIUS = 10;
/** Schrittgeschwindigkeit in m/s — ein Tier, das aest, nicht eines, das flieht. */
const LAUF_TEMPO = 0.5;
/** Naeher als das steht das Tier still und sieht her: Es hat den Spieler bemerkt. */
const LAUF_AUFMERKEN = 9;
/** Arten, die an ihrem Ort bleiben — der Biber im Bach. */
const BLEIBT_STEHEN = new Set(['kiemenbiber']);
/** Deterministischer Wuerfel je Kreatur, damit Laeufe reproduzierbar sind. */
function laufWuerfel(id: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

function Kreaturen({ vorkommen, gestalt, ziel, gier, naehe, onBegegnung, verbraucht, rand, hoeheAn, kollision }: {
  vorkommen: Vorkommen[];
  gestalt: (kreatur: string, mutation?: number) => THREE.BufferGeometry;
  ziel: React.RefObject<THREE.Object3D | null>;
  gier: React.RefObject<number>;
  /** Hoehe der gezeichneten Flaeche — ein gehendes Tier bleibt auf dem Boden (D138). */
  hoeheAn: (x: number, z: number) => number;
  /** Dasselbe Feld wie fuer Spieler und Kamera: Staemme und Grundrisse (D141). */
  kollision: Kollisionsfeld;
  /** Wird jedes Bild beschrieben: nächste Kreatur, Abstand und Richtung relativ zum Blick. */
  naehe?: React.RefObject<Naehe>;
  onBegegnung?: (v: Vorkommen) => void;
  /** Bereits gefangen oder besiegt — steht nicht mehr in der Welt. */
  verbraucht?: ReadonlySet<string>;
  rand: { farbe: string; staerke: number };
}) {
  const uebrig = useMemo(
    () => (verbraucht?.size ? vorkommen.filter(v => !verbraucht.has(v.id)) : vorkommen),
    [vorkommen, verbraucht],
  );
  const [nah, setNah] = useState<Vorkommen[]>([]);
  const letzte = useRef(new THREE.Vector3(NaN, NaN, NaN));
  // Sperre nach einer Begegnung: Nach einem Rückzug steht der Spieler noch neben der
  // Kreatur. Ohne Abstandssperre startet der Kampf im nächsten Bild erneut.
  const sperre = useRef<THREE.Vector3 | null>(null);
  const naechste = useRef<{ id: string; x: number; z: number; kreatur: string } | null>(null);
  const laeufe = useRef(new Map<string, Lauf>());
  const wuerfel = useRef(new Map<string, () => number>());
  const laufVon = (v: Vorkommen): Lauf => {
    let l = laeufe.current.get(v.id);
    if (!l) {
      l = { x: v.position[0], y: v.position[1], z: v.position[2], kurs: v.drehung,
            tempo: 0, gang: 0, bis: 0, x0: v.position[0], z0: v.position[2] };
      laeufe.current.set(v.id, l);
      wuerfel.current.set(v.id, laufWuerfel(v.id));
    }
    return l;
  };

  // Kreaturen sind das, wonach der Spieler sucht — ihr Umriss muss vom Hang
  // wegstehen. Wind bekommen sie keinen (Amplitude 0): Ein schwingendes Tier
  // sieht nicht nach Wind aus, sondern nach kaputter Animation.
  const { material, setzeRand, setzeZeit } = useMemo(() => baueWindMaterial({
    amplitude: 0, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke * 1.4,
    // Atmen und Kopfwenden statt Wind (D136) — die Bewegung, die ein Tier vom
    // Prop unterscheidet, ohne Rig.
    atmen: true,
    // Breiterer Saum als der Rest der Welt (3,0): Seit Kreaturen Modelle mit 2.000
    // bis 3.000 Flaechen sind, steht fast jede Facette frontal zur Kamera, und ein
    // schmaler Fresnel-Saum trifft davon nichts — dasselbe, was G-118 an der
    // Fichtenkrone gemessen hat. Mehr Staerke hilft dort nicht, ein kleinerer
    // Exponent schon.
    randSchaerfe: 1.6,
  }), []);
  useEffect(() => {
    setzeRand(new THREE.Color(rand.farbe), rand.staerke * 1.4);
  }, [setzeRand, rand]);

  useFrame((state, dt) => {
    setzeZeit(state.clock.elapsedTime);
    const p = ziel.current?.position;
    if (!p) return;

    /**
     * Gang (D138): Jedes nahe Tier mit Modell wechselt zwischen Gehen (2–6 s) und
     * Stehen (3–9 s), Ziel ist ein Punkt im `LAUF_RADIUS` um den Spawn. Sieht es
     * den Spieler naeher als `LAUF_AUFMERKEN`, bleibt es stehen und dreht sich
     * ihm zu — das ist die Begegnung, die man sucht, nicht ein Tier, das einem
     * in den Ruecken laeuft. Hoehe jedes Bild vom Boden; kein Kollisionstest
     * gegen Baeume (offen).
     */
    const t = state.clock.elapsedTime;
    const schritt = Math.min(dt, 0.1);
    for (const v of nah) {
      if (!MIT_MODELL.has(v.kreatur)) continue;
      const l = laufVon(v);
      const w = wuerfel.current.get(v.id)!;
      const dSpieler = Math.hypot(p.x - l.x, p.z - l.z);
      if (BLEIBT_STEHEN.has(v.kreatur)) { l.tempo = 0; }
      else if (dSpieler < LAUF_AUFMERKEN) {
        l.tempo = 0;
        const zielKurs = Math.atan2(-(p.x - l.x), -(p.z - l.z));
        let dk = zielKurs - l.kurs;
        dk = Math.atan2(Math.sin(dk), Math.cos(dk));
        l.kurs += dk * Math.min(1, schritt * 1.5);
        l.bis = t + 2;
      } else if (t >= l.bis) {
        if (l.tempo > 0) { l.tempo = 0; l.bis = t + 3 + w() * 6; }
        else {
          const weit = Math.hypot(l.x - l.x0, l.z - l.z0);
          const winkel = w() * Math.PI * 2, r = w() * LAUF_RADIUS;
          const zx = weit > LAUF_RADIUS ? l.x0 : l.x0 + Math.cos(winkel) * r;
          const zz = weit > LAUF_RADIUS ? l.z0 : l.z0 + Math.sin(winkel) * r;
          l.kurs = Math.atan2(-(zx - l.x), -(zz - l.z));
          l.tempo = 1; l.bis = t + 2 + w() * 4;
        }
      }
      if (l.tempo > 0) {
        l.x += -Math.sin(l.kurs) * LAUF_TEMPO * schritt;
        l.z += -Math.cos(l.kurs) * LAUF_TEMPO * schritt;
        // Kollision (D141): dasselbe Rasterfeld wie Spieler und Kamera. Wer an
        // einen Stamm oder eine Hauswand stoesst, wird herausgeschoben, bleibt
        // stehen und sucht sich beim naechsten Aufbruch ein anderes Ziel.
        const [kx, kz] = kollision.schiebeRaus(l.x, l.z);
        if (kx !== l.x || kz !== l.z) { l.x = kx; l.z = kz; l.tempo = 0; l.bis = t + 2 + w() * 3; }
        l.y = hoeheAn(l.x, l.z);
      }
      l.gang += (l.tempo - l.gang) * Math.min(1, schritt * 3);
    }

    // Bewusst als Ausschluss formuliert, nicht als Einschluss: Beim ersten Bild ist
    // `letzte` NaN, und `NaN >= x` ist false — die Liste waere nie gefuellt worden.
    // `NaN < x` ist ebenfalls false, hier fuehrt das zum richtigen Ergebnis.
    if (!(letzte.current.distanceTo(p) < KREATUR_NEUBEWERTUNG)) {
      letzte.current.copy(p);
      setNah(uebrig.filter(v =>
        Math.hypot(v.position[0] - p.x, v.position[2] - p.z) <= KREATUR_SICHT));

      // Nächste Kreatur über die GANZE Liste, nicht nur über die sichtbaren: Die
      // Witterung soll auch dorthin zeigen, wo noch nichts gezeichnet wird — sonst
      // hilft sie genau dann nicht, wenn man sie braucht. 1.000 Abstände alle 12 m
      // sind billiger als 40 Abstände je Bild.
      let beste = Infinity, bx = 0, bz = 0, art = '', id = '';
      for (const v of uebrig) {
        // Laufposition, wo es eine gibt (D141): Die Witterung zeigt auf das Tier,
        // nicht auf die Stelle, an der es vor einer Minute stand.
        const l = laeufe.current.get(v.id);
        const vx = l ? l.x : v.position[0], vz = l ? l.z : v.position[2];
        const d = Math.hypot(vx - p.x, vz - p.z);
        if (d >= beste) continue;
        beste = d; bx = vx; bz = vz; art = v.kreatur; id = v.id;
      }
      naechste.current = beste < Infinity ? { id, x: bx, z: bz, kreatur: art } : null;
    }

    // Abstand und Richtung dagegen jedes Bild: Der Pfeil muss sich beim Drehen
    // mitdrehen, sonst zeigt er nach dem ersten Blickwechsel ins Leere.
    if (naehe?.current) {
      const n = naehe.current;
      const z = naechste.current;
      if (!z) { n.abstand = Infinity; n.winkel = 0; n.kreatur = ''; }
      else {
        const l = laeufe.current.get(z.id);
        const zx = l ? l.x : z.x, zz = l ? l.z : z.z;
        n.abstand = Math.hypot(zx - p.x, zz - p.z);
        n.kreatur = z.kreatur;
        n.winkel = peilung(p.x, p.z, zx, zz, gier.current);
      }
    }

    if (!onBegegnung) return;
    if (sperre.current) {
      if (sperre.current.distanceTo(p) < SPERRE_BIS) return;
      sperre.current = null;
    }
    for (const v of nah) {
      const l = laeufe.current.get(v.id);
      const d = l ? Math.hypot(l.x - p.x, l.z - p.z) : Math.hypot(v.position[0] - p.x, v.position[2] - p.z);
      if (d > BEGEGNUNG_AB) continue;
      sperre.current = p.clone();
      onBegegnung(v);
      break;
    }
  });

  return (
    <>
      {nah.map(v => (
        MIT_MODELL.has(v.kreatur)
          // Eigene Suspense-Grenze je Tier (G-134): Bis die Datei da ist, steht
          // nichts — aber die uebrige Szene laeuft weiter, statt neu aufzubauen.
          ? <Suspense key={v.id} fallback={null}>
              <KreaturModell kreatur={v.kreatur} rand={rand} lauf={laufVon(v)}
                             position={v.position} drehung={v.drehung} mutation={v.mutation}
                             // Stufe 2 ist 15–25 % groesser, Stufe 3 nochmal — aus der Stilreferenz.
                             skalierung={1 + v.mutation * 0.2} />
            </Suspense>
          : <mesh key={v.id} geometry={gestalt(v.kreatur, v.mutation)} material={material}
                  position={v.position} rotation={[0, v.drehung, 0]}
                  scale={1 + v.mutation * 0.2}
                  castShadow receiveShadow />
      ))}
    </>
  );
}

/**
 * Eine Kreatur, für die ein Modell vorliegt.
 *
 * Geometrie statt Silhouette, aber **dasselbe Material** wie alle anderen: Der
 * Silhouettenrand (`randStaerke`) ist das, was eine Kreatur vom Hang abhebt, und
 * ein Modell braucht ihn genauso. Die Vertexfarbe kommt aus der Datei; das
 * Material liest sie über `vertexColors`.
 *
 * Die Datei ist auf Widerristhöhe und Ursprung zwischen den Füßen genormt
 * (`tools/kreaturbau.py`) — hier bleibt deshalb nur die Mutationsskalierung.
 */
function KreaturModell({ kreatur, rand, lauf, position, drehung, mutation, skalierung }: {
  kreatur: string;
  rand: { farbe: string; staerke: number };
  /** Laufzustand (D138), jedes Bild von `Kreaturen` fortgeschrieben. */
  lauf: Lauf;
  position: [number, number, number];
  drehung: number;
  mutation: number;
  skalierung: number;
}) {
  const { scene } = useGLTF(`/creatures/${kreatur}.glb`);
  /**
   * Ein Material **je Tier**, nicht eines fuer alle (D138): Die Gangstaerke ist
   * ein Uniform, und ein Uniform gilt je Material. Das Programm bleibt eines —
   * derselbe `customProgramCacheKey` —, nur der Uniform-Satz ist je Tier.
   * Atmen, Kopfwenden und Gang sitzen im selben Shader (`windmaterial.ts`).
   */
  const { material, setzeRand, setzeZeit, setzeGang } = useMemo(() => baueWindMaterial({
    amplitude: 0, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke * 1.4,
    randSchaerfe: 1.6, atmen: true,
  }), []);
  useEffect(() => { setzeRand(new THREE.Color(rand.farbe), rand.staerke * 1.4); }, [setzeRand, rand]);
  useEffect(() => () => { material.dispose(); }, [material]);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    setzeZeit(state.clock.elapsedTime);
    setzeGang(lauf.gang);
    const m = mesh.current;
    if (!m) return;
    m.position.set(lauf.x, lauf.y, lauf.z);
    m.rotation.y = lauf.kurs;
  });
  /**
   * Grundkörper und Anbau werden **zusammengelegt**, nicht nebeneinander
   * gezeichnet.
   *
   * Ein zweites Mesh je Kreatur wäre ein zweiter Draw Call, und Draw Calls sind
   * auf dem Zielgerät die teure Größe (11 µs je Aufruf, G-111) — Dreiecke fast
   * gratis. Zusammengelegt bleibt es bei einem Aufruf je Tier, und der Cache
   * greift über (Art, Mutationsstufe): fünf Modelle mal drei Stufen sind
   * höchstens fünfzehn Geometrien für die ganze Welt.
   */
  const geo = useMemo(() => kreaturGeometrie(scene, kreatur, mutation), [scene, kreatur, mutation]);
  if (!geo) return null;
  return (
    <mesh ref={mesh} geometry={geo} material={material} position={position}
          rotation={[0, drehung, 0]} scale={skalierung} castShadow receiveShadow />
  );
}

/** Koerper plus Anbau aus der geladenen Datei — fuer die Welt und das Reittier (D145). */
function kreaturGeometrie(scene: THREE.Object3D, kreatur: string, mutation: number): THREE.BufferGeometry | null {
  let g: THREE.BufferGeometry | null = null;
  scene.traverse(o => { if (!g && (o as THREE.Mesh).isMesh) g = (o as THREE.Mesh).geometry; });
  if (!g || !MIT_ANBAU.has(kreatur)) return g;
  const koerper = g as THREE.BufferGeometry;
  // Der Anbau kommt ohne Normalen und UV (D107: das Modell hat keine), sonst
  // verweigert `mergeGeometries` — gleiche Attribute sind Pflicht. Seit D128
  // für zehn Arten, gemessen an den Ankern des jeweiligen Modells.
  const anbau = baueAnbau(kreatur, koerper, mutation, saatAusId(kreatur));
  if (!anbau) return koerper;
  const roh = koerper.index ? koerper.toNonIndexed() : koerper;
  const zusammen = mergeGeometries([roh, anbau], false);
  if (!zusammen) {
    // **Laut, nicht still** (G-131): Der stille Rueckfall `?? koerper` hat
    // neun von zehn Anbauten verschluckt — die Poly-Modelle trugen ein UV-
    // Attribut, der Anbau nicht, und nichts hat es gemeldet.
    console.error(`Anbau ${kreatur}: Attribute passen nicht — Koerper `
      + `${Object.keys(roh.attributes).join('+')}, Anbau ${Object.keys(anbau.attributes).join('+')}`);
    return koerper;
  }
  return zusammen;
}

/**
 * Fundstellen in der Welt.
 *
 * Ein Fragment ist kein Gegenstand, den man aufhebt — es ist ein Ort, an dem etwas
 * steht. Gezeichnet wird deshalb kein Symbol, sondern ein schmaler Steinsetzer mit
 * einem Signalpunkt darauf: aus der Entfernung erkennbar, aus der Nähe unauffällig.
 *
 * Gelesene Fundstellen bleiben stehen, verlieren aber den Punkt. Die Welt vergisst
 * nicht, dass man da war — sie hört nur auf, danach zu rufen.
 */
const FUND_AB = 9;

function Fundstellen({ orte, ziel, gelesen, onFund }: {
  orte: { id: string; position: [number, number, number] }[];
  ziel: React.RefObject<THREE.Object3D | null>;
  gelesen: ReadonlySet<string>;
  onFund?: (id: string) => void;
}) {
  const stein = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.16, 0.26, 1.5, 5);
    g.translate(0, 0.75, 0);
    return g;
  }, []);
  const punkt = useMemo(() => new THREE.OctahedronGeometry(0.11, 0), []);
  const steinMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#7a7c78', roughness: 0.95, flatShading: true,
  }), []);
  const punktMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#cfe9f2' }), []);

  const [nah, setNah] = useState<typeof orte>([]);
  const letzte = useRef(new THREE.Vector3(NaN, NaN, NaN));

  useFrame(() => {
    const p = ziel.current?.position;
    if (!p) return;
    if (!(letzte.current.distanceTo(p) < 25)) {
      letzte.current.copy(p);
      setNah(orte.filter(o => Math.hypot(o.position[0] - p.x, o.position[2] - p.z) < 260));
    }
    if (!onFund) return;
    for (const o of nah) {
      if (gelesen.has(o.id)) continue;
      if (Math.hypot(o.position[0] - p.x, o.position[2] - p.z) > FUND_AB) continue;
      onFund(o.id);
      break;
    }
  });

  return (
    <>
      {nah.map(o => (
        <group key={o.id} position={o.position}>
          <mesh geometry={stein} material={steinMat} castShadow receiveShadow />
          {!gelesen.has(o.id) && (
            <mesh geometry={punkt} material={punktMat} position={[0, 1.62, 0]} />
          )}
        </group>
      ))}
    </>
  );
}

/**
 * Zufluchten und Bewohner.
 *
 * Anders als eine Fundstelle löst ein Ort **nicht von selbst** aus: Es gibt ein
 * Zeichen, wenn man nah genug ist, und der Knopf liegt in der Oberfläche. Der
 * Unterschied ist beabsichtigt. Ein Fundstück will gefunden werden; ein Rastplatz,
 * der einen im Vorbeigehen heilt, nimmt der Entscheidung ihren Wert — und ein NPC,
 * der ungefragt anspricht, ist die unangenehmste Sorte NPC.
 *
 * Die Marke ist bewusst karg: ein Pfahl mit Querbalken für die Zuflucht, eine
 * stehende Silhouette für den Bewohner. Beide tragen einen Signalpunkt, weil sie
 * sonst zwischen 2.033 OSM-Gebäuden nicht auffindbar sind.
 */
export const ORT_AB = 7;

/** Näher als das winkt ein Bewohner — einmal, dann steht er wieder. */
const WINK_AB = 8;
/** Gehtempo eines Bewohners in m/s und die Abspielrate des Walk-Clips dafür. */
const MENSCH_TEMPO = 1.0, MENSCH_WALK_RATE = 0.7;
/** Pausen an den Enden des Wegstücks: gleichverteilt zwischen den beiden. */
const MENSCH_PAUSE: [number, number] = [6, 14];

/**
 * Ein Bewohner mit Figur aus der Menschenkette (D143): SkinnedMesh, Idle im
 * Stand, ein Winken, wenn der Spieler in `WINK_AB` kommt — einmal je
 * Annäherung, nicht bei jedem Bild.
 *
 * Seit D146 mit **Leben im Stand**: Idle und Idle_Neutral wechseln sich ab, und
 * wer ein `gang` hat, geht das Wegstück entlang `blick` (vom Haus zur Strasse)
 * und zurück, mit Pausen an beiden Enden, auf der Bodenhöhe des Geländes. Das
 * Winken unterbricht den Gang; danach geht es weiter. Und **Laufzeitfarben**
 * (`farben`, Slots in `COLOR_0.a`) — dieselbe Datei, andere Haar-, Jacken-,
 * Hosenfarbe aus dem Inhalt.
 *
 * Dasselbe Wind-/Randmaterial wie Kreaturen und Spielerin, ein Material je
 * Figur (eigene Uniforms), ein Draw Call.
 */
function Mensch({ figur, blick, gang = 0, farben, ziel, rand, hoeheAn, marke }: {
  figur: string; blick: number;
  /** Der Signalpunkt — wandert mit der Figur, nicht mit dem Ort. */
  marke: { geometry: THREE.BufferGeometry; material: THREE.Material };
  /** Länge des Wegstücks entlang `blick` in Metern; 0 = steht. */
  gang?: number;
  farben?: Partial<Record<RollenSlot, string>>;
  ziel: React.RefObject<THREE.Object3D | null>;
  rand: { farbe: string; staerke: number };
  hoeheAn: (x: number, z: number) => number;
}) {
  const { scene, animations } = useGLTF(`/figuren/${figur}.glb`);
  const { material, setzeRand, setzeRollen } = useMemo(() => baueWindMaterial({
    amplitude: 0, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke,
  }), []);
  useEffect(() => { setzeRand(new THREE.Color(rand.farbe), rand.staerke); }, [setzeRand, rand]);
  useEffect(() => { setzeRollen(farben ?? null); }, [setzeRollen, farben]);
  useEffect(() => {
    scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.material = material; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
    });
  }, [scene, material]);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const clips = useMemo(() => {
    const finde = (n: string) => animations.find(c => c.name === n) ?? animations[0];
    const idle = mixer.clipAction(finde('Idle')), ruhig = mixer.clipAction(finde('Idle_Neutral'));
    const wink = mixer.clipAction(finde('Wave')), walk = mixer.clipAction(finde('Walk'));
    idle.play();
    wink.setLoop(THREE.LoopOnce, 1); wink.clampWhenFinished = false;
    walk.timeScale = MENSCH_WALK_RATE;
    return { idle, ruhig, wink, walk, aktiv: idle as THREE.AnimationAction };
  }, [mixer, animations]);
  useEffect(() => () => { mixer.stopAllAction(); }, [mixer]);
  /** Weich zu einem Clip wechseln (G-133: einblenden mit Gewicht 1, nicht 0). */
  const wechsle = (ziel: THREE.AnimationAction, dauer: number) => {
    if (ziel === clips.aktiv) return;
    ziel.reset().setEffectiveWeight(1).play();
    clips.aktiv.crossFadeTo(ziel, dauer, false);
    clips.aktiv = ziel;
  };
  const gruppe = useRef<THREE.Group>(null);
  const gewinkt = useRef(false);
  /**
   * Zustand des Wegstücks: `t` ist die Lage auf dem Stück (0 = am Haus, `gang`
   * = an der Strasse), `richtung` +1 hin, −1 zurück, `pause` die Restzeit im
   * Stand. Beginnt am Haus mit einer Pause, damit nicht alle Bewohner der
   * Region im selben Takt losgehen (Saat aus der Blickrichtung).
   */
  const weg = useRef({ t: 0, richtung: 1, pause: 4 + ((blick * 7919) % 100) / 100 * 8, winkt: false, ruhig: false });
  const wurzelY = useRef<number | null>(null);
  useFrame((_, dt) => {
    const g = gruppe.current, p = ziel.current?.position;
    const w = weg.current;
    if (g && p) {
      const wp = g.getWorldPosition(new THREE.Vector3());
      const d = Math.hypot(p.x - wp.x, p.z - wp.z);
      if (d < WINK_AB && !gewinkt.current) {
        gewinkt.current = true; w.winkt = true;
        clips.wink.reset().play();
        clips.aktiv.crossFadeTo(clips.wink, 0.2, false);
        clips.aktiv = clips.wink;
        // Nach dem Winken zurueck ins Stehen — der Mixer meldet das Ende.
        const zurueck = () => {
          w.winkt = false; w.pause = Math.max(w.pause, 3);
          clips.aktiv = clips.idle; clips.wink.crossFadeTo(clips.idle.reset().play(), 0.3, false);
          mixer.removeEventListener('finished', zurueck);
        };
        mixer.addEventListener('finished', zurueck);
      }
      if (d > WINK_AB * 2) gewinkt.current = false;

      // Wegstück: stehen (Pause) → gehen → stehen, das Winken hält an.
      if (!w.winkt) {
        if (w.pause > 0) {
          w.pause -= dt;
          if (w.pause <= 0 && gang > 0) wechsle(clips.walk, 0.3);
          else if (w.pause > 0 && clips.aktiv === clips.walk) wechsle(clips.idle, 0.3);
        } else if (gang > 0) {
          w.t += w.richtung * MENSCH_TEMPO * dt;
          if (w.t >= gang || w.t <= 0) {
            w.t = Math.max(0, Math.min(gang, w.t));
            w.richtung = -w.richtung;
            w.pause = MENSCH_PAUSE[0] + Math.random() * (MENSCH_PAUSE[1] - MENSCH_PAUSE[0]);
            // Im Stand abwechselnd Idle und Idle_Neutral — zwei Haltungen statt einer.
            w.ruhig = !w.ruhig;
            wechsle(w.ruhig ? clips.ruhig : clips.idle, 0.4);
          }
        }
      }
      if (gang > 0) {
        // Lage entlang `blick` (0° = Nord = −Z, positiv nach links), Bodenhöhe aus dem Gelände.
        const b = THREE.MathUtils.degToRad(blick);
        const dx = -Math.sin(b) * w.t, dz = -Math.cos(b) * w.t;
        const eltern = g.parent!;
        const ep = eltern.getWorldPosition(new THREE.Vector3());
        if (wurzelY.current === null) wurzelY.current = ep.y;
        g.position.set(dx, hoeheAn(ep.x + dx, ep.z + dz) - wurzelY.current, dz);
        // Blick in Gehrichtung; im Stand zur Strasse (hin) bzw. zum Haus (zurück).
        g.rotation.y = b + (w.richtung < 0 && clips.aktiv === clips.walk ? Math.PI : 0);
      }
    }
    mixer.update(Math.min(dt, 0.1));
  });
  return (
    <group ref={gruppe} rotation={[0, THREE.MathUtils.degToRad(blick), 0]}>
      <primitive object={scene} />
      <mesh geometry={marke.geometry} material={marke.material} position={[0, 1.85, 0]} />
    </group>
  );
}

export type OrtsArt = 'zuflucht' | 'bewohner';
export interface Ortsmarke {
  id: string; art: OrtsArt; position: [number, number, number];
  /** Figur aus der Menschenkette (D143) — Bewohner mit Modell statt Silhouette. */
  figur?: string;
  /** Blickrichtung in Grad wie `?absetzen=`. */
  blick?: number;
  /** Wegstück entlang `blick` in Metern (D146). */
  gang?: number;
  /** Laufzeitfarben je Slot (D146). */
  farben?: Partial<Record<RollenSlot, string>>;
}

/**
 * Bauwerke aus der Blender-Szene (ADR-0006, Stufe 2).
 *
 * `tools/szenenexport.py` backt die prozeduralen Materialien und schreibt je Bauwerk bis zu
 * drei Dateien: `bauten` (Stein und Holz mit Grundfarbe, Rauheit, Normale als Bild), `gruen`
 * (Blattmassen mit Vertexfarbe; die Loecher rechnet der Shader mit demselben Rauschen wie
 * Blender) und `wasser`. Die Gruppe steht am Ursprung der Szene auf der Gelaendehoehe **vor**
 * der Terrasse (`h0`), weil der Export alle Hoehen darauf bezogen hat; die Terrasse selbst
 * kennt das Hoehenfeld ueber das Register (`bauwerke.ts`).
 *
 * Silhouettenlicht wie alles andere; Wind nicht (die Dateien sind keine Instanzen, und das
 * Windattribut fehlt). Jede Datei hat ihre eigene Suspense-Grenze (G-134).
 */
const BAUWERK_NEUBEWERTUNG = 100;

function Bauwerke({ rand, ziel }: {
  rand: { farbe: string; staerke: number };
  ziel: React.RefObject<THREE.Object3D | null>;
}) {
  const [sichtbar, setzeSichtbar] = useState<Bauwerk[]>([]);
  const letzte = useRef(new THREE.Vector2(NaN, NaN));
  useFrame(() => {
    const p = ziel.current?.position;
    if (!p || Math.hypot(letzte.current.x - p.x, letzte.current.y - p.z) < BAUWERK_NEUBEWERTUNG) return;
    letzte.current.set(p.x, p.z);
    setzeSichtbar(sichtbareBauwerke(p.x, p.z));
  });
  return (
    <>
      {sichtbar.map(b => (
        <group key={b.name} position={[b.ursprung.x, b.h0, b.ursprung.z]}>
          {b.dateien.map(teil => (
            <Suspense key={teil} fallback={null}>
              {teil === 'wasser'
                ? <BauwerkWasser bauwerk={b} />
                : <Bauwerkteil bauwerk={b} teil={teil} rand={rand} />}
            </Suspense>
          ))}
        </group>
      ))}
    </>
  );
}

function Bauwerkteil({ bauwerk, teil, rand }: {
  bauwerk: Bauwerk; teil: 'bauten' | 'gruen'; rand: { farbe: string; staerke: number };
}) {
  const { scene } = useGLTF(bauwerkPfad(bauwerk, teil));
  const { objekt, materialien } = useMemo(() => {
    const klon = scene.clone(true);
    /**
     * Jedes Material mit **seinem** Saumanteil (D166).
     *
     * Bis hierher lag nur das Material in der Liste, und der Effekt unten rief `setzeRand` mit dem
     * vollen `rand.staerke` für alle — gleich nach dem Einhängen, denn ein `useEffect` läuft auch
     * beim ersten Mal. `setzeRand` setzt die Stärke absolut. Die Anteile, die hier beim Bau
     * vergeben wurden (Stein 0,6, Laub 0,15 „gegen weisse Wolken"), lebten also genau ein Bild
     * lang; gezeichnet wurde überall der volle Saum.
     */
    const materialien: { w: ReturnType<typeof baueWindMaterial>; anteil: number }[] = [];
    klon.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = true; o.receiveShadow = true;
      // Ein vereinigtes Netz kann mit einem Material-Array kommen (erster Stauwehr-Export: 105 Kronen,
      // 105 Materialien). Alle Teile tragen dieselbe Vertexfarbe — das erste Material reicht als Basis,
      // und ein einzelnes Material zeichnet das ganze Netz. Vorher war die Basis das Array selbst: weiss.
      const basis = (Array.isArray(o.material) ? o.material[0] : o.material) as THREE.MeshStandardMaterial;
      // Loecher nur im Blattwerk — Waldstaemme kommen mit Vertexfarbe in derselben Datei
      const laub = teil === 'gruen' && /Krone|Nadeln|Farn|Efeu|Laub/.test(o.name);
      /**
       * Saumanteil: Laub 0,15, **Stein und Holz 0** (D166).
       *
       * Laub: Klumpen mit Löchern bestehen aus lauter Kanten, bei voller Stärke lasen sie als weisse
       * Wolken (gemessen am ersten Durchstich).
       *
       * Stein: Dasselbe gilt für eine Bruchsteinmauer, nur war es dort nicht aufgefallen. Jeder Stein
       * ist eine Silhouette, also bekam jeder Stein einen hellen Rand. An der sonnenabgewandten Mauer
       * der Felsmulde war das der Befund aus D164 — p99 0,35 gegen 0,025 im Render, 5 % der Pixel über
       * 0,15, im Render keiner. Getrennt gemessen mit `?saum=0` und `?normalmap=0`: Die Normalmap
       * ändert nichts (p99 0,276 → 0,278), der Saum alles (0,276 → 0,097, über 0,15: 3,8 → 0 %).
       * Der Render hat an Mauern keinen Saum; die Engine jetzt auch nicht.
       */
      const anteil = laub ? 0.15 : 0;
      const w = baueWindMaterial(laub
        ? { amplitude: 0, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke * anteil, randSchaerfe: 10, loecher: 0.42, loecherSkala: 9, durchlass: 0.55 }
        : { amplitude: 0, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke * anteil }, basis);
      if (laub) { w.material.side = THREE.DoubleSide; if (w.tiefe) o.customDepthMaterial = w.tiefe; }
      if (NORMAL_MESSLAUF !== null && w.material.normalMap) w.material.normalScale.setScalar(NORMAL_MESSLAUF);
      o.material = w.material; materialien.push({ w, anteil });
    });
    return { objekt: klon, materialien };
  }, [scene, teil, rand.farbe, rand.staerke]);
  useEffect(() => {
    materialien.forEach(({ w, anteil }) => w.setzeRand(new THREE.Color(rand.farbe), rand.staerke * anteil));
  }, [materialien, rand.farbe, rand.staerke]);
  useEffect(() => () => {
    materialien.forEach(({ w }) => { w.material.dispose(); w.tiefe?.dispose(); });
  }, [materialien]);
  return <primitive object={objekt} />;
}

/** Exportierte Becken benutzen dieselbe Wasserphysik und denselben Himmel wie Flussbaender. */
function BauwerkWasser({ bauwerk }: { bauwerk: Bauwerk }) {
  const { scene } = useGLTF(bauwerkPfad(bauwerk, 'wasser'));
  const material = useMemo(() => baueWasserMaterial(false,
    typeof location !== 'undefined' && new URLSearchParams(location.search).get('wasser') === 'physikalisch',
    'becken'), []);
  useWasserUmgebung(material);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, dt) => {
    const zeit = material.userData.zeit as { value: number } | undefined;
    if (zeit) zeit.value += dt;
  });
  const objekt = useMemo(() => {
    const klon = scene.clone(true);
    klon.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = false; o.receiveShadow = true; o.material = material;
    });
    return klon;
  }, [scene, material]);
  return <primitive object={objekt} />;
}

function Orte({ orte, ziel, onNah, rand, hoeheAn }: {
  orte: Ortsmarke[];
  ziel: React.RefObject<THREE.Object3D | null>;
  /** Der nächste Ort in Reichweite, oder null. Wird nur bei Wechsel gerufen. */
  onNah?: (id: string | null) => void;
  rand: { farbe: string; staerke: number };
  hoeheAn: (x: number, z: number) => number;
}) {
  const pfahl = useMemo(() => {
    const g = new THREE.BoxGeometry(0.14, 2.2, 0.14);
    g.translate(0, 1.1, 0);
    return g;
  }, []);
  const balken = useMemo(() => {
    const g = new THREE.BoxGeometry(1.3, 0.13, 0.13);
    g.translate(0, 1.95, 0);
    return g;
  }, []);
  const figur = useMemo(() => {
    const g = new THREE.CapsuleGeometry(0.28, 1.1, 3, 6);
    g.translate(0, 0.95, 0);
    return g;
  }, []);
  const punkt = useMemo(() => new THREE.OctahedronGeometry(0.13, 0), []);
  const holz = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#6b5a44', roughness: 0.95, flatShading: true,
  }), []);
  const tuch = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#7a7f6c', roughness: 1, flatShading: true,
  }), []);
  const punktMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#cfe9f2' }), []);

  const gemeldet = useRef<string | null>(null);

  useFrame(() => {
    const p = ziel.current?.position;
    if (!p || !onNah) return;
    let naechster: string | null = null, beste = ORT_AB;
    for (const o of orte) {
      const d = Math.hypot(o.position[0] - p.x, o.position[2] - p.z);
      if (d < beste) { beste = d; naechster = o.id; }
    }
    // Nur bei Wechsel melden: sonst ein setState je Bild, solange man dasteht.
    if (naechster !== gemeldet.current) { gemeldet.current = naechster; onNah(naechster); }
  });

  return (
    <>
      {orte.map(o => (
        <group key={o.id} position={o.position}>
          {o.art === 'zuflucht' ? (
            <>
              <mesh geometry={pfahl} material={holz} castShadow receiveShadow />
              <mesh geometry={balken} material={holz} castShadow />
            </>
          ) : o.figur && !istAus('menschen') ? (
            <Suspense fallback={null}>
              <Mensch figur={o.figur} blick={o.blick ?? 0} gang={o.gang} farben={o.farben}
                      ziel={ziel} rand={rand} hoeheAn={hoeheAn} marke={{ geometry: punkt, material: punktMat }} />
            </Suspense>
          ) : (
            <mesh geometry={figur} material={tuch} castShadow receiveShadow />
          )}
          {/* Der Punkt eines gehenden Bewohners haengt an der Figur (in `Mensch`). */}
          {!(o.figur && !istAus('menschen')) && (
            <mesh geometry={punkt} position={[0, o.art === 'zuflucht' ? 2.35 : 1.85, 0]}
                  material={punktMat} />
          )}
        </group>
      ))}
    </>
  );
}

/**
 * Klippen als Instanzen.
 *
 * Eine Instanz je Wand, ein Draw Call je Variante. Gezeichnet wird nur, was in
 * Reichweite ist — Fels steht auf Entfernung ohnehin als Silhouette, und die
 * liefert schon das Terrain.
 */
const KLIPPEN_SICHT = 320;

function Klippen({ klippen, ziel, material }: {
  klippen: Klippe[];
  ziel: React.RefObject<THREE.Object3D | null>;
  material: THREE.MeshStandardMaterial;
}) {
  const geometrien = useMemo(
    () => Array.from({ length: KLIPPEN_VARIANTEN }, (_, v) => baueKlippenGeometrie(v)), []);
  const gruppen = useMemo(
    () => geometrien.map((_, v) => klippen.filter(k => k.variante === v)),
    [klippen, geometrien],
  );
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const letzte = useRef(new THREE.Vector3(NaN, NaN, NaN));

  useFrame(() => {
    const p = ziel.current?.position;
    if (!p) return;
    if (letzte.current.distanceTo(p) < 40) return;
    letzte.current.copy(p);

    const hilfe = new THREE.Object3D();
    gruppen.forEach((liste, v) => {
      const m = refs.current[v];
      if (!m) return;
      let n = 0;
      for (const k of liste) {
        if (Math.hypot(k.position[0] - p.x, k.position[2] - p.z) > KLIPPEN_SICHT) continue;
        hilfe.position.set(...k.position);
        hilfe.rotation.set(0, k.drehung, 0);
        hilfe.scale.set(k.breite, k.hoehe, k.breite * 0.6);
        hilfe.updateMatrix();
        m.setMatrixAt(n++, hilfe.matrix);
        if (n >= liste.length) break;
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    });
  });

  return (
    <>
      {gruppen.map((liste, v) => liste.length > 0 && (
        <instancedMesh key={v}
          ref={(el: THREE.InstancedMesh | null) => { refs.current[v] = el; }}
          args={[geometrien[v], material, liste.length]}
          castShadow receiveShadow />
      ))}
    </>
  );
}

/**
 * Der Regent an seinem festen Ort.
 *
 * Bewusst anders gebaut als eine Begegnung mit einem Wildling. Ein Regent ist kein
 * Zufall, dem man in den Weg läuft — er ist ein Ort, den man findet. Deshalb:
 * immer sichtbar (kein Entfernungs-Culling, es ist genau **ein** Objekt), doppelt so
 * groß wie jede Kreatur, und der Kampf beginnt nicht von selbst. Ein Bosskampf, der
 * einen im Vorbeigehen erwischt, ist ein Unfall, kein Höhepunkt.
 */
const REGENT_HOEHE = 4.2;
/** Ab hier wird gefragt, ob man ihn stellen will. */
export const REGENT_AB = 18;

function Regentenort({ ort, gestalt, ziel, onNah }: {
  ort: [number, number, number];
  gestalt: THREE.BufferGeometry;
  ziel: React.RefObject<THREE.Object3D | null>;
  onNah?: (nah: boolean) => void;
}) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.75, metalness: 0.1,
    emissive: new THREE.Color('#1d3a34'), emissiveIntensity: 0.45,
  }), []);
  const gruppe = useRef<THREE.Group>(null);
  const war = useRef(false);
  const uhr = useRef(0);

  useFrame((_, dt) => {
    uhr.current += dt;
    // Schweres, langsames Heben — ein Wels im Stauwasser, kein Tier an Land.
    if (gruppe.current) {
      gruppe.current.position.y = ort[1] + Math.sin(uhr.current * 0.5) * 0.22;
      gruppe.current.rotation.y = Math.sin(uhr.current * 0.22) * 0.28;
    }
    const p = ziel.current?.position;
    if (!p || !onNah) return;
    const nah = Math.hypot(ort[0] - p.x, ort[2] - p.z) <= REGENT_AB;
    if (nah !== war.current) { war.current = nah; onNah(nah); }
  });

  return (
    <group ref={gruppe} position={ort}>
      <mesh geometry={gestalt} material={material} scale={REGENT_HOEHE} castShadow receiveShadow />
    </group>
  );
}

function Beleuchtung({ s, ziel }: {
  s: Stimmung; ziel: React.RefObject<THREE.Object3D | null>;
}) {
  const { scene, gl } = useThree();
  const sonne = useRef<THREE.DirectionalLight>(null);

  /**
   * Nebel und Himmel gehören zusammen.
   *
   * Der Dunst am Horizont trägt dieselbe Farbe wie der Nebel — nur dann geht fernes
   * Gelände in den Himmel über, statt als Silhouette davor zu kleben. Deshalb steht
   * `dunst` hier nicht als eigener Wert in der Stimmung, sondern kommt aus `nebel`.
   */
  useEffect(() => {
    scene.fog = new THREE.Fog(s.nebel, s.nebelNah, s.nebelFern);
    scene.background = null;
    return () => { scene.fog = null; };
  }, [scene, s]);

  const himmel = useMemo(() => baueHimmel({
    zenit: s.zenit, horizont: s.horizont, dunst: s.nebel, sonne: s.sonne,
    sonnenstand: s.sonnenstand, scheibe: s.scheibe, hof: s.hof,
  }), [s]);
  useEffect(() => {
    setzeHimmel(himmel, {
      zenit: s.zenit, horizont: s.horizont, dunst: s.nebel, sonne: s.sonne,
      sonnenstand: s.sonnenstand, scheibe: s.scheibe, hof: s.hof,
    });
  }, [himmel, s]);

  /**
   * Belichtung je Stimmung.
   *
   * Die Lichtwerte selbst bleiben unangetastet — sie sind Art Direction. Was fehlte,
   * war der Regler danach: `daemmerung` war auf einem Laptop-Display praktisch
   * schwarz, während dasselbe Bild auf dem Handy lesbar aussah. Tone Mapping mit
   * eigener Belichtung trennt „wie hell ist die Szene gemeint" von „wie hell kommt
   * sie auf diesem Bildschirm an".
   *
   * Die Werte sind gegen ein MacBook-Display gesetzt und ausdrücklich vorläufig.
   */
  useEffect(() => {
    gl.toneMapping = KURVE_MESSLAUF ?? KURVE_VORGABE;
    gl.toneMappingExposure = BELICHTUNG_MESSLAUF ?? s.belichtung;
  }, [gl, s]);

  /**
   * Die Sonne wandert mit dem Spieler.
   *
   * `sonnenstand` ist ein fester Weltpunkt auf Höhe ~55 m. Das Œntal liegt aber
   * zwischen 0 und 775 m über dem Bezugspunkt — der Spieler startet auf 199 m.
   * Eine ortsfeste Lichtquelle hätte ihre Schattenkamera damit unter dem Gelände,
   * und die Schattenberechnung liefert grobe Rechtecke statt Schatten. Als Versatz
   * relativ zum Spieler bleibt die Sonnenrichtung erhalten, die Schattenkamera
   * bleibt aber immer über der Szene.
   */
  useFrame(({ camera }) => {
    // Die Himmelskugel wandert mit der Kamera. Der Shader zwingt sie ohnehin auf die
    // ferne Ebene; sie muss die Kamera nur umschliessen, damit sie das Bild fuellt.
    himmel.position.copy(camera.position);

    const p = ziel.current?.position;
    const l = sonne.current;
    if (!p || !l) return;
    l.position.set(p.x + s.sonnenstand[0], p.y + s.sonnenstand[1], p.z + s.sonnenstand[2]);
    l.target.position.copy(p);
    l.target.updateMatrixWorld();
  });

  return (
    <>
      {/* Der Himmel hängt an der Kamera: keine Ausdehnung im Spielraum, kein Nebel,
          kein Schatten. Er ist Hintergrund, kein Objekt. */}
      <primitive object={himmel} />
      <hemisphereLight args={[s.umgebung, HEMIBODEN_MESSLAUF ?? HEMI_BODEN, UMGEBUNG_MESSLAUF ?? s.umgebungStaerke]} />
      <directionalLight
        ref={sonne}
        position={s.sonnenstand as unknown as [number, number, number]}
        color={s.sonne} intensity={s.sonneStaerke}
        castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-250} shadow-camera-right={250}
        shadow-camera-top={250} shadow-camera-bottom={-250}
        shadow-camera-far={700} shadow-bias={-0.0008}
        shadow-intensity={SCHATTEN_MESSLAUF ?? s.schatten ?? 1}
      />
    </>
  );
}

/**
 * Bodendecker im Nahbereich.
 *
 * Wird beim Gehen nachgezogen statt einmalig verteilt: 30.000 Props über 16 km²
 * lassen den Boden direkt vor dem Spieler leer, und genau dort schaut man hin.
 */
function Streuschicht({ feld, ziel, dichte }: {
  feld: HoehenFeld; ziel: React.RefObject<THREE.Object3D | null>; dichte: number;
}) {
  const grasGeo = useMemo(() => baueBueschelGeometrie(), []);
  const kleinGeo = useMemo(() => baueKleinzeugGeometrie(), []);
  const gras = useMemo(() => baueStreuMaterial(), []);
  // Steine und Äste bewegen sich nicht — eigenes Material ohne Wind.
  const kleinMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 1, metalness: 0,
  }), []);

  // Kein Schattenwurf und kein Schattenempfang: Ein Shadow-Texel ist bei ±250 m
  // Schattenkamera und 2048² rund 24 cm — die Büschel sind kleiner als ein Texel.
  // Sie würden sich selbst beschatten und schwarz rendern.
  const grasMesh = useRef<THREE.InstancedMesh>(null);
  const kleinMesh = useRef<THREE.InstancedMesh>(null);
  const letzte = useRef(new THREE.Vector3(NaN, NaN, NaN));

  // Dichteänderung erzwingt ein Nachziehen beim nächsten Bild.
  useEffect(() => { letzte.current.set(NaN, NaN, NaN); }, [dichte]);

  useFrame(({ clock }) => {
    gras.setzeZeit(clock.elapsedTime);

    const p = ziel.current?.position;
    if (!p) return;
    if (letzte.current.distanceTo(p) < STREU_NACHZIEHEN) return;
    letzte.current.copy(p);

    const g = grasMesh.current;
    if (g) {
      g.count = streueUmgebung(feld, p.x, p.z, g, dichte);
      g.instanceMatrix.needsUpdate = true;
      g.computeBoundingSphere();
    }
    const k = kleinMesh.current;
    if (k) {
      k.count = streueKleinzeug(feld, p.x, p.z, k, dichte);
      k.instanceMatrix.needsUpdate = true;
      k.computeBoundingSphere();
    }
  });

  return (
    <>
      <instancedMesh
        ref={grasMesh} args={[grasGeo, gras.material, STREU_MAX]}
        frustumCulled={false} receiveShadow={false} castShadow={false}
      />
      <instancedMesh
        ref={kleinMesh} args={[kleinGeo, kleinMaterial, KLEIN_MAX]}
        frustumCulled={false} receiveShadow={false} castShadow={false}
      />
    </>
  );
}

/**
 * Tempo, Schwerkraft und Sprung stehen in `src/spieler/tempo.ts`.
 *
 * Sie standen hier — und dieselben Zahlen gleichzeitig in `tools/masstab.ts` (1,4
 * und 5,0) und im Ledger D18 (3,0 und 7,0). Drei Orte, drei Werte; `npm run
 * masstab` beschrieb dadurch einen Fußgänger, den es im Spiel nicht gibt. Ein
 * reines Modul können die Werkzeuge importieren, eine `.tsx` mit React nicht.
 *
 * 4,2 und 11,0 m/s sind schneller als der Mensch: eine bewusste Abweichung vom
 * 1:1-Maßstab an genau einer Stelle (Ledger G-27, D18). 9,81 m/s² und 5,4 m/s
 * Absprung ergeben knapp 1,5 m Sprunghöhe und 1,1 s in der Luft — genug für
 * Geländestufen, zu wenig für Felswände. Genau so gemeint.
 */

/** Eine halbe Schrittlänge in Metern — bestimmt die Frequenz der Laufanimation. */
const SCHRITTLAENGE = 0.9;
/**
 * Bis zu dieser Höhe über dem Boden gilt man noch als stehend.
 *
 * Ohne Toleranz verliert man auf jeder Geländekante den Bodenkontakt und kann für
 * ein paar Bilder nicht springen — was sich anfühlt, als würde die Taste klemmen.
 */
const BODEN_TOLERANZ = 0.12;

/**
 * Klettern.
 *
 * Erkannt wird nicht an den Klippenplatten, sondern am **Höhenfeld**: Wer nach
 * vorne drückt und dort eine Stufe über Brusthöhe vorfindet, greift. Das ist der
 * robustere Weg, weil die Platten aus genau demselben Steilheitskriterium erzeugt
 * werden — die Wand ist immer da, wo das Feld steil ist, und das Feld kennt jeder
 * Frame ohnehin. Eine Prüfung gegen 4.031 Plattengeometrien je Bild wäre teurer
 * und würde an den Rändern danebengreifen.
 *
 * Was das Klettern begrenzt, ist die Ausdauer (`src/spieler/ausdauer.ts`), nicht
 * eine Regel darüber, wo geklettert werden darf. Deshalb gibt es keine
 * ausgewiesenen Kletterstellen: Jede Wand geht, solange der Vorrat reicht.
 */
const KLETTERN_TEMPO = 2.2;
/** Vortrieb in die Wand beim Klettern. Trägt am Ende über die Kante. */
const KLETTERN_VOR = 0.55;
/**
 * So weit voraus wird der Boden getastet — für die Steigung UND fürs Klettern.
 *
 * Nicht über den Schritt eines Bildes messen: Bei 4,2 m/s und 60 Bildern sind das
 * 7 cm, und auf 7 cm ist jede Mikrorelief-Beule ein Steilhang. Über 1,4 m mittelt
 * sich das Rauschen heraus und übrig bleibt die Geländeform.
 */
const TAST_WEITE = 1.4;
/** Erst ab dieser Stufenhöhe wird geklettert — darunter steigt man einfach hoch. */
const KLETTER_STUFE = 0.9;
/**
 * Steiler als das geht zu Fuß nicht mehr.
 *
 * **Das ist der Teil, ohne den Klettern folgenlos wäre.** Bis hierher gab es keine
 * Steigungsgrenze: Die Figur setzte ihre Höhe jedes Bild auf den Boden, also lief
 * sie jede Felswand senkrecht hoch — schneller als jede Kletteranimation es je
 * könnte. Eine Kletterfähigkeit einzubauen, ohne das zu ändern, hätte eine Taste
 * für etwas ergänzt, das man ohnehin schon konnte.
 *
 * 40° liegt knapp unter `KLIPPE_AB_GRAD` (41°). Damit gilt: Wo eine Felsplatte
 * steht, muss geklettert werden — und nur da.
 */
const GEHEN_MAX_GRAD = 40;
const STEIGUNG_MAX = Math.tan(GEHEN_MAX_GRAD * Math.PI / 180);
const REIT_STEIGUNG_MAX = Math.tan(REIT_MAX_GRAD * Math.PI / 180);

/**
 * Waten.
 *
 * Waten greift auf 39,5 km Bachlauf — jeden Bach der Region, denn ein Gebirgsbach
 * ist mit 4 m Breite und 85 cm Tiefe genau das: watbar, nicht schwimmbar. Für
 * schwimmbar sorgen die Weiher (`SCHWIMMEN_AB`).
 *
 * Was Waten kostet, ist genau das, was
 * einen Bach zu einem Hindernis macht: Tempo, ein bisschen Ausdauer, und **kein
 * Sprung**. Wer über den Bach will, sucht die schmale Stelle oder springt vorher ab.
 */
const WATEN_AB = 0.30;
const WATEN_TEMPO = 1.9;
const WATEN_JE_SEK = 7;

/**
 * Schwimmen — **Korrektur einer falschen Messung.**
 *
 * Die erste Fassung dieser Datei hielt fest, Schwimmen habe im Œntal keinen Ort.
 * Das war falsch, und der Fehler steckte nicht im Schluss, sondern in den Daten:
 * Gemessen wurden nur `welt.linien` (Bäche). Die elf `natural=water`-Flächen der
 * Region standen in `welt.flaechen` und wurden übersehen — der größte Weiher misst
 * 62 × 71 m. Darin schwimmt man.
 *
 * Ab Brusttiefe verliert man den Boden. Der Kopf bleibt knapp unter dem Spiegel,
 * die Schwerkraft ist ausgesetzt, und die Ausdauer läuft — wer sie aufbraucht,
 * treibt langsamer, ertrinkt aber nicht. Ertrinken bestraft Erkundung.
 */
const SCHWIMMEN_AB = 1.35;
const SCHWIMMEN_TEMPO = 1.6;
const SCHWIMMEN_JE_SEK = 9;
/** Wie tief der Kopf unter dem Wasserspiegel liegt. */
const SCHWIMM_TIEFGANG = 1.15;

/**
 * Weite Ebene der Kamera. War 1500 — das reichte für die Region und für nichts sonst.
 *
 * Die Zahl ist **gemessen, nicht geschätzt**: Die entfernteste Ecke der
 * Fernlandgeometrie liegt 8.460 m von der Regionsmitte (`.cache/fernzaehl.ts`),
 * und der Spieler kann sich davon noch einmal bis zu 2.800 m entfernen — also
 * 11,3 km im schlechtesten Fall. Mein erster Wert war 9.000 und hätte die
 * Diagonale abgeschnitten; ein abgeschnittener Bergzug ist genau der Fehler,
 * den diese Kulisse beheben soll.
 *
 * Der Preis ist Tiefenpufferauflösung: `far/near` steigt von 7.500 auf 60.000.
 * Der Verlust trifft die Ferne, und dort steht ein einziges, überschneidungs-
 * freies Blatt Geometrie. Wenn hier je Z-Fighting auftaucht, ist `near` der
 * Hebel, nicht `far`.
 */
const KAMERA_FERN = 12000;

/** Blickneigung: knapp unter die Waagerechte bis steil nach oben. */
const NEIGUNG_MIN = -0.30;
const NEIGUNG_MAX = 1.05;
/** Neigung im Ruhezustand — entspricht der alten festen Kamerahöhe. */
export const NEIGUNG_START = 0.32;

/**
 * Bewegt den Spieler über das Gelände.
 *
 * Die Höhe kommt aus demselben Höhenfeld, das den Boden zeichnet — sonst läuft man
 * durch das Mikrorelief hindurch. Eine Kollisionsprüfung gibt es nicht: Bäume und
 * Gebäude sind derzeit durchlässig, das ist bewusst, weil dieser Schritt nur den
 * Look beurteilbar machen soll.
 */
function Spieler({ feld, ziel, gier, neigung, schritt, kollision, ausdauer, reitet,
                   gleiterFrei, onGleiten, meldeRand, stoecke, kampfSperre }: {
  feld: HoehenFeld;
  ziel: React.RefObject<THREE.Object3D | null>;
  gier: React.RefObject<number>;
  neigung: React.RefObject<number>;
  /** Laufphase in Radiant und aktuelles Tempo — die Figur hängt daran. */
  schritt: React.RefObject<{ phase: number; tempo: number }>;
  kollision: Kollisionsfeld;
  /** Ausdauerzustand. Der Balken liest ihn, deshalb liegt er außerhalb. */
  ausdauer: React.RefObject<Ausdauerzustand>;
  /** Sitzt der Spieler auf? Als Ref, damit ein Umschalten kein Neuaufsetzen auslöst. */
  reitet: React.RefObject<boolean>;
  /** Ist der Gleiter frei? Abgeleitet aus dem Weltzustand, siehe `spieler/gleiten.ts`. */
  gleiterFrei?: React.RefObject<boolean>;
  /** Meldet, ob gerade geglitten wird — für die Anzeige. Nur bei Änderung. */
  onGleiten?: (gleitet: boolean) => void;
  /** Wird in jedem Bild gerufen, in dem an der Regionsgrenze geklemmt wird. */
  meldeRand?: () => void;
  /** Zustand der beiden Daumenknüppel — die Anzeige liegt im DOM und liest ihn. */
  stoecke?: React.RefObject<Stoecke>;
  /** Hält die Laufeingabe an, solange der Kampf die Figur führt (Schlag, Rolle). */
  kampfSperre?: React.RefObject<boolean>;
}) {
  const { gl } = useThree();
  const eingabe = benutzeSteuerung(gl.domElement, stoecke);
  /** Senkrechte Geschwindigkeit in m/s. Positiv heißt aufwärts. */
  const steigen = useRef(0);
  /** Klettert der Spieler gerade? Nur für die Anzeige und die Zehrung. */
  const klettert = useRef(false);
  /** Laufender Fall: Scheitel und ob der Gleiter von Hand eingeklappt wurde. */
  const fall = useRef<Fall>(neuerFall(0));
  /** Letzter gemeldeter Gleitzustand — damit nur Änderungen nach oben gehen. */
  const gleitetVor = useRef(false);

  useFrame((_, rohDt) => {
    const p = ziel.current?.position;
    if (!p) return;
    // Nach einem Tab-Wechsel kommt ein riesiges dt — sonst teleportiert man.
    const dt = Math.min(rohDt, 0.1);
    // Im Kampf gehört die Figur während Schlag und Rolle dem Kampf (ADR-0007):
    // keine Laufeingabe, kein Sprung. Eine Kopie statt die Eingabe zu
    // überschreiben — `vor`/`seit` werden nur bei Tastenereignissen neu
    // berechnet, ein genulltes Feld bliebe nach der Rolle stehen.
    const e0 = eingabe.current;
    const sperre = kampfSperre?.current ?? false;
    const e = sperre ? { ...e0, vor: 0, seit: 0, springen: false, rennen: false } : e0;
    if (sperre) { e0.springen = false; e0.drehDelta = 0; e0.neigDelta = 0; }

    gier.current += e.drehRate * dt + e.drehDelta;
    e.drehDelta = 0;

    neigung.current = Math.max(NEIGUNG_MIN, Math.min(NEIGUNG_MAX,
      neigung.current + e.neigRate * dt + e.neigDelta));
    e.neigDelta = 0;

    const g = gier.current;
    // Blickrichtung ist -Z, um `gier` um die Y-Achse gedreht.
    const blickX = -Math.sin(g), blickZ = -Math.cos(g);

    // Zustand VOR der Bewegung. Die Steigungsprüfung braucht den Ausgangsboden,
    // und ob man springen darf, entscheidet sich am Standort, nicht am Ziel.
    const bodenAlt = hoeheAufFlaeche(feld, p.x, p.z);
    const amBoden = p.y <= bodenAlt + BODEN_TOLERANZ && steigen.current <= 0;

    // Bewegungsrichtung in der Ebene, normiert. Getastet wird dorthin, wohin man
    // geht — beim Seitwärtsgehen an einer Wand entlang ist das nicht der Blick.
    const rohX = blickX * e.vor + Math.cos(g) * e.seit;
    const rohZ = blickZ * e.vor - Math.sin(g) * e.seit;
    const laenge = Math.hypot(rohX, rohZ);
    const richtX = laenge > 0 ? rohX / laenge : blickX;
    const richtZ = laenge > 0 ? rohZ / laenge : blickZ;

    // ---- Was liegt voraus? -------------------------------------------------
    const vorausBoden = hoeheAufFlaeche(feld, p.x + richtX * TAST_WEITE, p.z + richtZ * TAST_WEITE);
    const steigung = (vorausBoden - bodenAlt) / TAST_WEITE;
    const stufe = vorausBoden - p.y;

    // Wasser am Standort. Ein Reittier ist hoch genug, dass ein 85-cm-Bach es
    // nicht bremst — im Sattel bleibt ein Bach ein Bach. Tiefes Wasser wirft
    // allerdings auch den Reiter ab: Ein Steinbock schwimmt nicht mit Last.
    const tiefe = feld.wasserTiefe(p.x, p.z);
    const schwimmt = tiefe >= SCHWIMMEN_AB;
    const watet = !schwimmt && !reitet.current && tiefe >= WATEN_AB;

    const grenze = reitet.current ? REIT_STEIGUNG_MAX : STEIGUNG_MAX;

    // Klettern: nach vorne drücken, eine Wand vor sich, Ausdauer übrig. Der
    // Schwellwert ist beim Weiterklettern niedriger als beim Ansetzen — sonst
    // bricht der Aufstieg an jedem Absatz ab und die Figur fällt zurück.
    //
    // Im Sattel und im Wasser wird nicht geklettert: Beides sind Zustände, in
    // denen man keine Hand frei hat.
    const schwelle = klettert.current ? -0.25 : KLETTER_STUFE;
    klettert.current = !reitet.current && !watet && !schwimmt
      && laenge > 0.3 && e.vor > 0.3 && stufe > schwelle
      && steigung > STEIGUNG_MAX && reicht(ausdauer.current);

    // ---- Gleiten -----------------------------------------------------------
    // Muss VOR der waagerechten Bewegung stehen: Am Gleiter gilt ein eigenes
    // Vorwärtstempo, und der Sprungwunsch dieses Bildes faltet ihn zusammen,
    // statt einen Sprung auszulösen (in der Luft springt ohnehin niemand).
    const g0 = gleitSchritt(fall.current, {
      y: p.y,
      steigen: steigen.current,
      amBoden,
      // Am Fels, im Wasser und im Sattel geht kein Gleiter auf. Beim Klettern
      // hängt man an der Wand; wer aus dem Sattel fällt, fällt.
      gesperrt: klettert.current || schwimmt || watet || reitet.current,
      frei: gleiterFrei?.current ?? false,
      falten: !amBoden && e.springen,
    });
    fall.current = g0.fall;
    const gleitet = g0.gleitet;
    if (gleitet) e.springen = false;   // in der Luft ist die Taste das Falten
    if (gleitet !== gleitetVor.current) { gleitetVor.current = gleitet; onGleiten?.(gleitet); }

    const tempo = klettert.current ? KLETTERN_VOR
      // Erschöpft treibt man nur noch, statt zu schwimmen — spürbar langsamer,
      // aber nie null. Wer im Teich stehenbleibt, kommt sonst nie wieder heraus.
      : schwimmt ? SCHWIMMEN_TEMPO * (reicht(ausdauer.current) ? 1 : 0.45)
      : watet ? WATEN_TEMPO
      // Am Gleiter zieht die Luft: Man fliegt in Blickrichtung, auch ohne zu
      // drücken. Steuern heißt hier drehen, nicht schieben.
      : gleitet ? GLEIT_TEMPO
      : reitet.current ? (e.rennen ? REITEN_RENNEN : REITEN_GEHEN)
      : e.rennen ? RENNEN : GEHEN;
    // Am Gleiter trägt es einen auch ohne Eingabe nach vorn — ein Gleiter, der
    // stehenbleibt, wenn man den Finger hebt, ist ein Fallschirm. Gesteuert wird
    // über den Blick; deshalb die Blickrichtung als Rückfall, nicht null.
    const [fahrX, fahrZ] = gleitet && laenge < 0.05
      ? [blickX, blickZ]
      : [rohX / Math.max(1, laenge), rohZ / Math.max(1, laenge)];
    const dx = fahrX * tempo * dt;
    const dz = fahrZ * tempo * dt;

    // Zu steil heißt: der Schritt findet nicht statt. Nur bergauf und nur mit
    // Bodenkontakt — in der Luft steuert man frei, und bergab rutscht man eben.
    const zuSteil = amBoden && !klettert.current && steigung > grenze;

    if ((dx !== 0 || dz !== 0) && !zuSteil) {
      /**
       * Der Regionsrand.
       *
       * Bis 20.08.2026 stand hier eine unsichtbare Wand **8 m vor** der
       * Geländekante, ohne jede Rückmeldung: Die Figur blieb mitten auf offener
       * Wiese stehen, die Laufanimation lief weiter, und dahinter war leerer
       * Dunst (G-101). Zwei Dinge sind jetzt anders.
       *
       * **Das Fernland** zeichnet echtes Gelände bis 6 km hinaus (D85). Damit
       * liest sich das Anhalten nicht mehr als „die Welt hört auf", sondern als
       * „weiter geht es nicht" — dasselbe, was eine Bergflanke im echten Inntal
       * auch tut.
       *
       * **Der Rand liegt jetzt an der Kante**, nicht 8 m davor. Die 8 m stammten
       * aus der Zeit, als das Gelände dort im Nichts endete und man nicht
       * hinuntersehen sollte. `RAND` von 1,5 m bleibt, damit die Figur nicht
       * halb über der Schürze steht.
       *
       * Gemeldet wird es einmal, nicht dauernd: `amRand` wird gesetzt, sobald
       * die Klemmung wirklich greift, und die Szene reicht es nach oben. Eine
       * Meldung bei jedem Bild wäre schlimmer als keine.
       */
      const RAND = 1.5;
      const halbB = feld.breiteMeter / 2 - RAND;
      const halbT = feld.tiefeMeter / 2 - RAND;
      const [kx, kz] = kollision.schiebeRaus(p.x + dx, p.z + dz);
      const gx = Math.max(-halbB, Math.min(halbB, kx));
      const gz = Math.max(-halbT, Math.min(halbT, kz));
      if (gx !== kx || gz !== kz) meldeRand?.();
      p.x = gx;
      p.z = gz;
    }
    // Der Boden unter dem Spieler. Auf der GEZEICHNETEN Fläche, nicht auf der
    // stetigen Funktion — sonst schwebt die Figur auf Kuppen sichtbar darüber.
    const boden = hoeheAufFlaeche(feld, p.x, p.z);

    if (e.springen) {
      e.springen = false;
      // Kein Sprung im Wasser. Das ist die eigentliche Wirkung des Watens: Ein
      // Bach wird zum Hindernis, weil man nicht mittendrin abspringen kann.
      if (amBoden && !watet && reicht(ausdauer.current, SPRUNG_KOSTEN)) {
        steigen.current = ABSPRUNG;
        ausdauer.current = verbrauche(ausdauer.current, SPRUNG_KOSTEN);
      }
    }

    // Auftrieb: Im tiefen Wasser hängt die Figur am Spiegel statt an der Sohle.
    // Der Spiegel ist Sohle + Tiefe (das Bett ist ja aus dem Gelände geschnitten),
    // und der Tiefgang zieht sie so weit hinunter, dass nur Kopf und Schultern
    // herausschauen. Weich nachgeführt, sonst schnellt sie am Ufer hoch.
    const tiefeHier = feld.wasserTiefe(p.x, p.z);
    const spiegel = boden + tiefeHier;

    if (schwimmt) {
      steigen.current = 0;
      const ziel = spiegel - SCHWIMM_TIEFGANG;
      p.y += (ziel - p.y) * Math.min(1, dt * 6);
    } else if (klettert.current) {
      // Am Fels zieht die Schwerkraft nicht. Der Aufstieg endet, wenn die Ausdauer
      // leer ist — dann fällt man, und zwar aus der erreichten Höhe.
      steigen.current = 0;
      p.y += KLETTERN_TEMPO * dt;
    } else if (amBoden && steigen.current <= 0) {
      // Am Boden der Kontur folgen, statt bei jedem Absatz kurz zu fallen.
      p.y = boden;
      steigen.current = 0;
    } else {
      steigen.current -= SCHWERKRAFT * dt;
      // Erst fallen lassen, dann bremsen — sonst frisst die Schwerkraft des
      // nächsten Bildes die Bremsung wieder auf und die Sinkrate driftet nach oben.
      if (gleitet) steigen.current = bremse(steigen.current);
      p.y += steigen.current * dt;
      if (p.y <= boden) { p.y = boden; steigen.current = 0; }
    }
    // Nie unter das Gelände: Beim Klettern über eine Kante liegt der Boden am
    // neuen Standort sonst über der Figur. Beim Schwimmen gilt das nicht — dort
    // IST die Figur über der Sohle, nur eben im Wasser.
    if (!schwimmt && p.y < boden) p.y = boden;

    // Waten zehrt nur, wenn man sich auch bewegt: Im Bach zu stehen ist keine
    // Anstrengung, gegen die Strömung zu gehen schon. Schwimmen zehrt immer —
    // sich über Wasser zu halten ist Arbeit, auch ohne vorwärtszukommen.
    ausdauer.current = ausdauerSchritt(ausdauer.current, dt,
      klettert.current ? KLETTERN_JE_SEK
      : schwimmt ? SCHWIMMEN_JE_SEK
      : watet && laenge > 0.1 ? WATEN_JE_SEK
      : 0);

    // Schrittfrequenz aus der tatsächlichen Geschwindigkeit: Wer rennt, macht
    // schnellere Schritte, nicht dieselben Schritte schneller hintereinander.
    const strecke = klettert.current ? 0 : Math.hypot(dx, dz) * (zuSteil ? 0 : 1);
    const sw = schritt.current;
    sw.tempo = dt > 0 ? strecke / dt : 0;
    // Die Phase folgt der zurückgelegten STRECKE, nicht der Zeit. Nur so bleibt der
    // Fuß am Boden statt zu rutschen, egal bei welcher Bildrate.
    sw.phase += (strecke / SCHRITTLAENGE) * Math.PI;
  });

  return null;
}

/**
 * Sitzpose im Sattel (D145, neu in D147): **Zielrichtungen** je Knochen statt
 * Winkel um lokale Achsen.
 *
 * Der erste Bau drehte um die lokale X-Achse jedes Knochens (`quaternion.multiply`)
 * — und die Achsen des Quaternius-Rigs haben je Knochen einen anderen Roll: Der
 * Unterschenkel bog nicht nach hinten, sondern schräg durch den Bauch des Tiers
 * und kam als dünner schwarzer Stab unter ihm wieder heraus (Bild
 * `.cache/bilder/beine_45.png`). Jetzt bekommt jeder Knochen eine Richtung im
 * Raum der Figur (nach −Z schaut sie), gemessen wird die tatsächliche Richtung
 * des Knochens (+Y im Knochenraum, wie Blender exportiert) nach dem Mixer, und
 * die Drehung dazwischen wird in den Elternraum zurückgerechnet. Roll bleibt
 * von der Animation. Kein eigener Clip — das Paket hat keinen, das Tier trägt
 * die Bewegung (D93).
 */
/** Lage des Sitzes auf dem Tier: Anteil der Koerperlaenge von der Nase aus (D146). */
const SITZ_LAGE = 0.6;
/**
 * Zielrichtungen im Figurraum (x nach rechts der Figur, y hoch, −z nach vorn),
 * je Seite gespiegelt — nach der Reitlehre (D148), nicht nach Gefühl:
 * Ohr, Schulter, Hüfte und **Ferse auf einer Senkrechten**; Oberschenkel lang
 * und flach am Tier (≈ 50° unter der Waagerechten), Unterschenkel dahinter
 * zurück, damit die Ferse unter der Hüfte steht (Kniewinkel ≈ 105°, Sitz 100–120°,
 * Springen 90°); **Fersen tief, Zehen hoch**, Fussspitzen nach vorn, höchstens
 * 15° nach aussen; Oberarme hängen senkrecht mit dem Ellbogen knapp vor dem
 * Körper, Unterarme bilden die Gerade zum Maul, Hände knapp über dem Widerrist;
 * Oberkörper aufrecht (Springen 30° vor). Mit Oberschenkel 0,47 m und
 * Unterschenkel 0,53 m der Wanderin: 0,47·cos 50° = 0,53·sin 35° — die Ferse
 * steht unter der Hüfte.
 */
const SITZ_RICHTUNG = {
  oberschenkel: new THREE.Vector3(0.20, -0.766, -0.643), // 50° unter der Waagerechten, 11° gespreizt
  unterschenkel: new THREE.Vector3(0.03, -0.82, 0.57),   // 35° zurück: Ferse unter der Hüfte
  fuss: new THREE.Vector3(0.25, 0.17, -0.95),            // Ferse tief, Zehen 10° hoch, 15° aussen
  oberarm: new THREE.Vector3(0.0, -0.96, -0.26),         // hängt, Ellbogen knapp vor dem Körper
  unterarm: new THREE.Vector3(-0.15, -0.30, -0.94),      // zur Hand über dem Widerrist
};
type SitzKnochen = Record<'ol' | 'or' | 'ul' | 'ur' | 'fl' | 'fr' | 'al' | 'ar' | 'el' | 'er', THREE.Object3D | null>;
const _q = new THREE.Quaternion(), _qe = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _qs = new THREE.Quaternion();
const _v = new THREE.Vector3(), _z = new THREE.Vector3(), _hoch = new THREE.Vector3(0, 1, 0);
const _ident = new THREE.Quaternion();
/**
 * Richtet einen Knochen auf `ziel` (im Raum von `figur`) aus, um `anteil` interpoliert.
 * Erwartet aktuelle Weltmatrizen (der Aufrufer ruft `updateMatrixWorld`).
 */
function richte(k: THREE.Object3D | null, figur: THREE.Object3D, ziel: THREE.Vector3, spiegel: boolean, anteil: number) {
  if (!k || !k.parent) return;
  _z.set(spiegel ? -ziel.x : ziel.x, ziel.y, ziel.z).normalize();
  _z.applyQuaternion(figur.getWorldQuaternion(_q));           // Ziel in Weltrichtung
  k.getWorldQuaternion(_q);
  _v.copy(_hoch).applyQuaternion(_q);                          // Knochenrichtung heute
  _qs.setFromUnitVectors(_v, _z);                              // Welt-Drehung dahin
  _ident.identity(); _qs.slerpQuaternions(_ident, _qs, anteil);
  k.parent.getWorldQuaternion(_qe); _qi.copy(_qe).invert();
  // lokal' = P⁻¹ · r · P · lokal
  k.quaternion.premultiply(_qe).premultiply(_qs).premultiply(_qi);
  k.updateMatrixWorld(true);
}
/** Hueftgelenk-Abstand von der Mitte und Oberschenkellaenge der Wanderin (aus dem Rig gelesen). */
const HUEFTE_HALB = 0.11, OBERSCHENKEL = 0.47;
/** Schritt unter dem Hueftgelenk (Wanderin: 1,02 − 0,80 m). */
const SCHRITT_UNTER_HUEFTE = 0.22;
const _ober = new THREE.Vector3();
/**
 * @param breite halbe Rumpfbreite des Tiers am Sitz — die Knie muessen aussen
 *   daran vorbei (D149: die Beine verschwanden im Tier, weil 11° Spreizung fuer
 *   jedes Tier galten). Die Spreizung folgt daraus: Knie bei `breite` + 7 cm.
 */
function sitzpose(b: SitzKnochen, figur: THREE.Object3D, anteil: number, breite: number) {
  figur.updateMatrixWorld(true);
  const R = SITZ_RICHTUNG;
  // Oberschenkel: Neigung aus der Reitlehre, Spreizung aus der Breite des Tiers.
  const sx = Math.min(0.7, Math.max(0.15, (breite + 0.07 - HUEFTE_HALB) / OBERSCHENKEL));
  const k = Math.sqrt(1 - sx * sx) / Math.hypot(R.oberschenkel.y, R.oberschenkel.z);
  _ober.set(sx, R.oberschenkel.y * k, R.oberschenkel.z * k);
  // Richtungen gelten fuer die rechte Seite (+X ist rechts, wenn man nach −Z schaut); links gespiegelt.
  richte(b.or, figur, _ober, false, anteil); richte(b.ol, figur, _ober, true, anteil);
  richte(b.ur, figur, R.unterschenkel, false, anteil); richte(b.ul, figur, R.unterschenkel, true, anteil);
  richte(b.fr, figur, R.fuss, false, anteil); richte(b.fl, figur, R.fuss, true, anteil);
  richte(b.ar, figur, R.oberarm, false, anteil); richte(b.al, figur, R.oberarm, true, anteil);
  richte(b.er, figur, R.unterarm, false, anteil); richte(b.el, figur, R.unterarm, true, anteil);
}

/**
 * Was die Szene ueber das Reittier wissen muss (D93, D145).
 *
 * `geometrie`/`hoehe` sind die Silhouette und ihre Sitzhoehe — der Rueckfall fuer
 * Arten ohne Modell. Mit `kreatur` und `mutation` laedt `ReittierModell` dieselbe
 * Datei wie die Welt und liest die Sitzhoehe aus dem Modell.
 */
export interface Reittier {
  geometrie: THREE.BufferGeometry;
  hoehe: number;
  kreatur: string;
  mutation: number;
}

/**
 * Das Reittier als Modell (D145): dieselbe Datei und derselbe Shader wie
 * `KreaturModell` in der Welt. Atmen und Gang laufen im Shader, der Gang mit dem
 * Tempo des Spielers. Bis D144 ritt man auf der Silhouette aus `kreaturgestalt.ts`
 * — die Tiere in der Welt hatten seit D124 Modelle, das Reittier nicht.
 */
function ReittierModell({ kreatur, mutation, rand, schritt, sitzHoehe }: {
  kreatur: string;
  mutation: number;
  rand: { farbe: string; staerke: number };
  schritt: React.RefObject<{ phase: number; tempo: number }>;
  sitzHoehe: React.MutableRefObject<{ hoehe: number; breite: number } | null>;
}) {
  const { scene } = useGLTF(`/creatures/${kreatur}.glb`);
  const geo = useMemo(() => kreaturGeometrie(scene, kreatur, mutation), [scene, kreatur, mutation]);
  const skala = 1 + mutation * 0.2;
  // Sitzhoehe aus dem **Koerper ohne Anbau** (`reitsitz`: hoechster Punkt des
  // mittleren Fuenftels), mal Mutationsskalierung. Mit Anbau gemessen sass die
  // Reiterin 0,5 m ueber dem Ruecken — das Gehoern des Grathorns waechst aus dem
  // Widerrist und war der hoechste Punkt.
  //
  // Und **hinter dem Widerrist**, nicht darauf: Der Sitz liegt bei 60 % der
  // Koerperlaenge von der Nase (Nase nach −Z), das Tier wird um diesen Betrag
  // nach vorn geschoben, damit der Reiter am Ursprung sitzt. Auf dem Widerrist
  // sass sie beim Grathorn der Stufe 3 **im Gehoern** — das waechst genau dort.
  const sitz = useMemo(() => {
    let koerper: THREE.BufferGeometry | null = null;
    scene.traverse(o => { if (!koerper && (o as THREE.Mesh).isMesh) koerper = (o as THREE.Mesh).geometry; });
    if (!koerper) return { hoehe: 1, z: 0, breite: 0.2 };
    const g = koerper as THREE.BufferGeometry;
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const laenge = bb.max.z - bb.min.z, breite = bb.max.x - bb.min.x, mx = (bb.min.x + bb.max.x) / 2;
    const z = bb.min.z + laenge * SITZ_LAGE;
    const pos = g.getAttribute('position');
    let hoehe = 0, halb = 0;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getZ(i) - z) > laenge * 0.12) continue;
      // Halbe Breite des Rumpfs am Sitz (D149): so weit muessen die Knie auseinander.
      halb = Math.max(halb, Math.abs(pos.getX(i) - mx));
      if (Math.abs(pos.getX(i) - mx) > breite * 0.2 || Math.abs(pos.getZ(i) - z) > laenge * 0.08) continue;
      hoehe = Math.max(hoehe, pos.getY(i));
    }
    return { hoehe: hoehe > 0 ? hoehe : reitsitz(g).hoehe, z, breite: halb };
  }, [scene]);
  useEffect(() => {
    sitzHoehe.current = { hoehe: sitz.hoehe * skala, breite: sitz.breite * skala };
    return () => { sitzHoehe.current = null; };
  }, [sitz, skala, sitzHoehe]);
  const { material, setzeRand, setzeZeit, setzeGang } = useMemo(() => baueWindMaterial({
    amplitude: 0, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke * 1.4,
    randSchaerfe: 1.6, atmen: true,
  }), []);
  useEffect(() => { setzeRand(new THREE.Color(rand.farbe), rand.staerke * 1.4); }, [setzeRand, rand]);
  useEffect(() => () => { material.dispose(); }, [material]);
  useFrame((state) => {
    setzeZeit(state.clock.elapsedTime);
    setzeGang(Math.min(1, schritt.current.tempo / RENNEN));
  });
  if (!geo) return null;
  return <mesh geometry={geo} material={material} scale={skala} position={[0, 0, -sitz.z * skala]} castShadow receiveShadow />;
}

/**
 * Die Spielerfigur — seit D143 ein **SkinnedMesh** aus der Menschenkette
 * (`tools/menschbau.py`, Quaternius CC0), nicht mehr die geloftete Figur aus
 * Teilen (D139, `figur.ts` bleibt als Rueckfall und fuer die Masse HUEFTE/SCHULTER).
 *
 * Ein Tier atmet und geht im Shader; ein Mensch braucht Huefte, Knie und
 * Ellbogen, und die liefert das Rig des Pakets billiger als jede Formel: ein
 * Draw Call, 24 Knochen, vier Clips (Idle, Idle_Neutral, Walk, Run). Der
 * `AnimationMixer` blendet nach Tempo: steht → Idle, geht → Walk, rennt → Run;
 * die Abspielgeschwindigkeit folgt dem Tempo, damit die Fuesse nicht rutschen.
 * Das Material ist dasselbe Wind-/Randmaterial wie bei den Kreaturen —
 * three.js setzt USE_SKINNING selbst, die Injektionen laufen vor dem Skinning.
 *
 * Reiten (D93, D145): Im Sattel spielt die Figur Idle, wird um den Widerrist
 * angehoben und bekommt die Sitzpose ueber drei Winkel je Bein (`sitzpose`).
 */
function SpielerFigur({ gier, schritt, rand, reittier }: {
  gier: React.RefObject<number>;
  schritt: React.RefObject<{ phase: number; tempo: number }>;
  rand: { farbe: string; staerke: number };
  /**
   * Silhouette und Widerristhöhe des Reittiers, oder null.
   *
   * Der Reiter wird um die Widerristhöhe angehoben; was sich bewegt, ist das
   * Tier, mit derselben Schrittphase wie bisher.
   */
  reittier?: Reittier | null;
}) {
  const { scene, animations } = useGLTF('/figuren/wanderin.glb');
  /** Sitzhoehe aus dem Modell (`ReittierModell` schreibt sie), sonst aus der Silhouette. */
  const sitzHoehe = useRef<{ hoehe: number; breite: number } | null>(null);
  const mitModell = !!reittier && MIT_MODELL.has(reittier.kreatur);
  const { material, setzeRand } = useMemo(() => baueWindMaterial({
    amplitude: 0, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke,
  }), []);
  useEffect(() => {
    setzeRand(new THREE.Color(rand.farbe), rand.staerke);
  }, [setzeRand, rand]);
  // Material tauschen und Schatten setzen — einmal je Szene.
  useEffect(() => {
    scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.material = material; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
    });
  }, [scene, material]);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const clips = useMemo(() => {
    const finde = (n: string) => animations.find(c => c.name === n) ?? animations[0];
    const clip = (n: string) => mixer.clipAction(finde(n));
    const idle = clip('Idle'), walk = clip('Walk'), run = clip('Run');
    // Nur Idle laeuft; Walk und Run werden beim Wechsel eingeblendet.
    // **Nicht** mit `setEffectiveWeight(0)` vorhalten (G-133): Das Gewicht ist
    // der Faktor, mit dem `fadeIn` multipliziert — 0 mal Einblendung bleibt 0,
    // und die Figur lief bis D145 als T-Pose, weil Idle ausblendete und nichts
    // einblendete. Gesehen wurde das erst, als der Gang im Lauf gemessen wurde.
    idle.play();
    return { idle, walk, run, aktiv: idle as THREE.AnimationAction };
  }, [mixer, animations]);
  useEffect(() => () => { mixer.stopAllAction(); }, [mixer]);
  // Die Beinknochen fuer die Sitzpose (D145). GLTFLoader streicht den Punkt aus
  // den Namen (`UpperLeg.L` → `UpperLegL`); beide Schreibweisen werden gesucht.
  const beine = useMemo(() => {
    const k = (n: string) => scene.getObjectByName(n.replace('.', '')) ?? scene.getObjectByName(n) ?? null;
    return { ol: k('UpperLeg.L'), or: k('UpperLeg.R'), ul: k('LowerLeg.L'), ur: k('LowerLeg.R'), fl: k('Foot.L'), fr: k('Foot.R'),
             al: k('UpperArm.L'), ar: k('UpperArm.R'), el: k('LowerArm.L'), er: k('LowerArm.R') } as SitzKnochen;
  }, [scene]);
  /**
   * Hoehe des Hueftgelenks in der Ruhepose, aus dem Modell gelesen (Wanderin:
   * 1,02 m), nicht aus `HUEFTE` (0,85, die alte Figur). Der Sitz ist der
   * **Schritt**, und der liegt in der Datei 0,22 m unter dem Gelenk (tiefster
   * Punkt der Mittellinie zwischen den Beinen: 0,80 m, gemessen mit
   * gltf-transform) — so weit wird die Figur im Sattel abgesenkt. Bis D149
   * waren es 0,10: Die Reiterin steckte bis zum Guertel im Tier, und die
   * Oberschenkel begannen in seinem Rumpf.
   */
  const sitzTiefe = useMemo(() => {
    scene.updateMatrixWorld(true);
    const y = beine.ol ? beine.ol.getWorldPosition(new THREE.Vector3()).y - scene.getWorldPosition(new THREE.Vector3()).y : HUEFTE;
    return y - SCHRITT_UNTER_HUEFTE;
  }, [scene, beine]);
  /** 0 = steht, 1 = sitzt; wird in 0,3 s ueberblendet. */
  const sitz = useRef(0);

  const gruppe = useRef<THREE.Group>(null);
  const reiter = useRef<THREE.Group>(null);
  const tier = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (gruppe.current) gruppe.current.rotation.y = gier.current;
    const { phase, tempo } = schritt.current;
    const stark = Math.min(1, tempo / RENNEN);
    // Clip nach Tempo, weich ueberblendet; im Sattel immer Idle.
    const ziel = reittier || tempo < 0.15 ? clips.idle : tempo < 5.5 ? clips.walk : clips.run;
    if (ziel !== clips.aktiv) {
      // Ein ausgeblendeter Clip ist `enabled = false` — `reset()` schaltet ihn
      // wieder an (und beginnt bei 0, was beim Gangwechsel nicht auffaellt).
      ziel.reset().setEffectiveWeight(1).play();
      clips.aktiv.crossFadeTo(ziel, 0.25, false);
      clips.aktiv = ziel;
    }
    // Abspielgeschwindigkeit an das Tempo koppeln: Walk ist bei 1,0 etwa 1,5 m/s,
    // Run etwa 6 m/s — darunter rutschen die Fuesse, darueber trippeln sie.
    clips.walk.timeScale = Math.max(0.8, Math.min(2.4, tempo / 1.7));
    clips.run.timeScale = Math.max(0.8, Math.min(1.8, tempo / 6.5));
    mixer.update(Math.min(dt, 0.1));

    // Sitzpose ueber die Knochen, nach dem Mixer: Oberschenkel nach vorn und
    // etwas nach aussen (der Reiter sitzt rittlings), Knie zurueck, Fuss gestreckt.
    // Kein eigener Clip — das Paket hat keinen, und drei Winkel reichen.
    sitz.current += ((reittier ? 1 : 0) - sitz.current) * Math.min(1, dt / 0.3);
    if (sitz.current > 0.001) {
      // Halbe Rumpfbreite des Tiers: aus dem Modell, sonst aus der Silhouette.
      let breite = mitModell ? sitzHoehe.current?.breite : undefined;
      if (breite === undefined && reittier) {
        reittier.geometrie.computeBoundingBox();
        const bb = reittier.geometrie.boundingBox!;
        breite = (bb.max.x - bb.min.x) / 2;
      }
      sitzpose(beine, scene, sitz.current, breite ?? 0.2);
    }

    if (reittier) {
      const hoehe = (mitModell ? sitzHoehe.current?.hoehe : null) ?? reittier.hoehe;
      if (reiter.current) {
        reiter.current.position.y = hoehe - sitzTiefe + Math.sin(phase * 0.5) * 0.06 * stark;
      }
      // Die Silhouette wippt als Ganzes; das Modell geht im Shader (D138).
      if (tier.current && !mitModell) {
        tier.current.position.y = Math.abs(Math.cos(phase)) * 0.05 * stark;
        tier.current.rotation.z = Math.sin(phase) * 0.045 * stark;
      }
    } else if (reiter.current) {
      reiter.current.position.y = 0;
    }
  });

  return (
    <group ref={gruppe}>
      {reittier && (
        <group ref={tier}>
          {mitModell
            ? <Suspense fallback={<mesh geometry={reittier.geometrie} material={material} castShadow receiveShadow />}>
                <ReittierModell kreatur={reittier.kreatur} mutation={reittier.mutation} rand={rand}
                                schritt={schritt} sitzHoehe={sitzHoehe} />
              </Suspense>
            : <mesh geometry={reittier.geometrie} material={material} castShadow receiveShadow />}
        </group>
      )}
      <group ref={reiter}>
        <primitive object={scene} />
      </group>
    </group>
  );
}
useGLTF.preload('/figuren/wanderin.glb');

/** Näher als das kommt die Kamera nicht — darunter steckt sie in der Figur. */
const KAMERA_MIN = 1.3;
/** Wie viele Punkte auf der Sichtlinie geprüft werden. */
const SICHT_PROBEN = 10;
/** Abstand, den die Kamera vor einem Hindernis hält. */
const SICHT_PUFFER = 0.35;

function Kamera({ ziel, gier, neigung, feld, kollision }: {
  ziel: React.RefObject<THREE.Object3D | null>;
  gier: React.RefObject<number>;
  neigung: React.RefObject<number>;
  feld: HoehenFeld;
  kollision: Kollisionsfeld;
}) {
  const { camera } = useThree();
  // Abstände in echten Metern — der Spieler ist 1,8 m hoch und soll auch so wirken.
  const geglaettet = useRef(new THREE.Vector3(0, GROESSE.kameraHoehe, GROESSE.kameraAbstand));
  const gesetzt = useRef(false);
  /** Aktueller Kameraabstand. Ausdrücklich `number` — `GROESSE` ist `as const`. */
  const abstand = useRef<number>(GROESSE.kameraAbstand);
  useFrame((_, dt) => {
    const p = ziel.current?.position ?? new THREE.Vector3();
    // Die Kamera kreist auf einer Kugel um den Blickpunkt auf Brusthöhe: `gier`
    // dreht herum, `neigung` hebt und senkt. Bei Neigung 0 steht sie waagerecht
    // hinter dem Spieler, bei NEIGUNG_MAX fast senkrecht darüber.
    const g = gier.current + SPIEGEL_GRAD * Math.PI / 180;
    const n = neigung.current;
    const blickY = p.y + GROESSE.kameraBlickHoehe;
    const rx = Math.sin(g) * Math.cos(n);
    const ry = Math.sin(n);
    const rz = Math.cos(g) * Math.cos(n);

    /**
     * Die Kamera zieht ein, wenn zwischen ihr und der Figur etwas steht.
     *
     * ## Warum das dazugekommen ist
     *
     * Rückmeldung vom Gerät: „mitten zwischen Bäumen sehe ich auch nichts“. Der
     * Grund war nicht Nebel und nicht die Dunkelheit, sondern dass die Kamera
     * **gar keine Kollision hatte**: Sie stand stur `kameraAbstand` hinter der
     * Figur, und in einem Wald mit 72.153 Bäumen liegt dieser Punkt regelmäßig
     * in einem Stamm oder in einem Laubballen. Von innen sieht man bei
     * `side: FrontSide` durch die Rückseiten hindurch — also nichts als das, was
     * zufällig noch dahinter liegt. Dasselbe passierte am Fuß eines Hangs, wo die
     * Kamera im Gelände steckte.
     *
     * ## Wie geprüft wird
     *
     * Zehn Punkte auf der Sichtlinie, gegen **dasselbe** Kollisionsfeld, das auch
     * die Figur benutzt (Stammradien 0,55–0,65 m, plus Gebäude), und gegen die
     * gezeichnete Geländefläche. Kein Raycast gegen die Szene: Der wäre bei 155.000
     * Props je Bild unbezahlbar, und das Rasterfeld beantwortet dieselbe Frage in
     * konstanter Zeit.
     *
     * ## Warum Einziehen hart ist und Ausfahren weich
     *
     * Ein weiches Einziehen heißt, dass man einen Sekundenbruchteil lang durch den
     * Stamm schaut — genau der Fehler, der behoben werden soll. Umgekehrt wäre ein
     * hartes Ausfahren ein Sprung, sobald man an einem Baum vorbei ist. Also:
     * sofort näher, langsam wieder weiter.
     */
    // Ausdrücklich `number`: `GROESSE` ist `as const`, sonst erbt `frei` den Literaltyp 6.
    let frei: number = GROESSE.kameraAbstand;
    for (let i = 1; i <= SICHT_PROBEN; i++) {
      const d = (GROESSE.kameraAbstand * i) / SICHT_PROBEN;
      const x = p.x + rx * d, y = blickY + ry * d, z = p.z + rz * d;
      const [kx, kz] = kollision.schiebeRaus(x, z);
      const versperrt = kx !== x || kz !== z
        || y < hoeheAufFlaeche(feld, x, z) + 0.45;
      if (versperrt) { frei = d - SICHT_PUFFER; break; }
    }
    const ziel_ = Math.max(KAMERA_MIN, Math.min(GROESSE.kameraAbstand, frei));
    abstand.current = ziel_ < abstand.current
      ? ziel_
      : abstand.current + (ziel_ - abstand.current) * Math.min(1, dt * 2.5);

    const r = abstand.current;
    const wunsch = new THREE.Vector3(p.x + rx * r, blickY + ry * r, p.z + rz * r);
    // Erstes Bild hart setzen: sonst fliegt die Kamera aus dem Ursprung (y=0) zum
    // Startpunkt hoch — bei 170 m Geländehöhe eine sichtbare Sekunde durch den Berg.
    if (!gesetzt.current) { geglaettet.current.copy(wunsch); gesetzt.current = true; }
    // Der Glättungsfaktor folgt dem Einziehen: Wo die Sichtlinie frei ist, darf die
    // Kamera weich nachlaufen; beim Einziehen muss sie sofort da sein.
    geglaettet.current.lerp(wunsch, ziel_ < r - 0.01 ? 1 : Math.min(1, dt * 4));
    if (KAMERA_MESSLAUF) {
      // Feste Kamera (Stufe 2): dieselbe Position und Brennweite wie die Blender-Szene, sonst
      // vergleicht man zwei Bilder von zwei Standpunkten.
      const k = KAMERA_MESSLAUF;
      camera.position.set(k[0], k[1], k[2]); camera.lookAt(k[3], k[4], k[5]);
      const pc = camera as THREE.PerspectiveCamera;
      if (FOV_MESSLAUF && pc.fov !== FOV_MESSLAUF) { pc.fov = FOV_MESSLAUF; pc.updateProjectionMatrix(); }
      return;
    }
    camera.position.copy(geglaettet.current);
    camera.lookAt(p.x, blickY, p.z);
  });
  return null;
}

/**
 * `?kamera=x,y,z,tx,ty,tz` stellt die Kamera fest (Weltmeter, y absolut) und `?fov=42.6`
 * setzt das senkrechte Sichtfeld — Messparameter fuer den Vergleich Spielbild gegen
 * Blender-Render (ADR-0006, Stufe 2). Die Figur steht weiter am `?absetzen=`-Punkt;
 * die Kamera schaut nur nicht mehr auf sie.
 */
const KAMERA_MESSLAUF: number[] | null = (() => {
  if (typeof location === 'undefined') return null;
  const roh = new URLSearchParams(location.search).get('kamera');
  if (!roh) return null;
  const n = roh.split(',').map(Number);
  return n.length === 6 && n.every(Number.isFinite) ? n : null;
})();
const FOV_MESSLAUF: number | null = (() => {
  if (typeof location === 'undefined') return null;
  const roh = Number(new URLSearchParams(location.search).get('fov'));
  return Number.isFinite(roh) && roh > 5 && roh < 150 ? roh : null;
})();

// Alle Prop-Modelle vorladen — sonst poppen sie im ersten Bild nach.
for (const varianten of Object.values(VARIANTEN))
  for (const v of varianten) useGLTF.preload(propPfad(v.datei));

/** Was die Szene je halbe Sekunde über sich meldet. */
export interface Messwerte {
  /** Bilder je Sekunde. */
  bps: number;
  /** Tatsächlich gezeichnete Dreiecke im letzten Bild. */
  dreiecke: number;
  /** Draw Calls im letzten Bild. */
  aufrufe: number;
  /** Objekte im Szenengraph — three.js läuft sie jedes Bild durch. */
  objekte: number;
  /** Sekunden bis Gelände und Bänder erstmals vollständig standen (D146); null solange es lädt. */
  ladezeit: number | null;
}

/**
 * Meldet, was wirklich gezeichnet wird.
 *
 * Der Grund für diese Komponente: Das Dreiecksbudget von 400.000 stammt aus einem
 * einzigen hartkodierten Literal in `tools/scenecheck.ts` mit dem Kommentar „Handy
 * verträgt ~400k" — nie gemessen, nie belegt. Alle Entscheidungen zu Dichte und
 * Attrappen hängen daran. Mit dieser Anzeige wird aus der Annahme eine Messung auf
 * dem echten Gerät.
 */
function Messung({ melde }: { melde?: (m: Messwerte) => void }) {
  const { gl, scene } = useThree();
  const stand = useRef({ bilder: 0, zeit: 0 });
  // Messlauf-Sonde (D155): der Szenengraph fuer `.cache/mess/sonde.mjs` — welche Instanzbuendel zeichnen
  // mit welcher Geometrie und welchem Material. Ohne das ist „welcher Baum ist das im Bild" Raten.
  useEffect(() => { (window as unknown as { __szene?: THREE.Scene }).__szene = scene; }, [scene]);
  useFrame((_, dt) => {
    if (!melde) return;
    const s = stand.current;
    s.bilder++; s.zeit += dt;
    if (s.zeit < 0.5) return;
    // Die Objektzahl ist der zweite Messwert neben der Bildrate: Sie zeigt, ob die
    // Last in JavaScript liegt. Der Durchlauf kostet bei einigen hundert Objekten
    // nichts und läuft ohnehin nur zweimal je Sekunde.
    let objekte = 0;
    scene.traverse(() => { objekte++; });
    melde({
      bps: s.bilder / s.zeit,
      dreiecke: gl.info.render.triangles,
      aufrufe: gl.info.render.calls,
      objekte,
      ladezeit: ladezeit(),
    });
    s.bilder = 0; s.zeit = 0;
  });
  return null;
}

/**
 * Schalter zum Eingrenzen des Engpasses auf dem echten Gerät.
 *
 * Gemessen wurden 23–45 B/s bei nur ~210.000 Dreiecken. Ein Handy von 2026 zeichnet
 * das mühelos — der Engpass liegt also woanders. Die drei wahrscheinlichen Kandidaten
 * sind Füllrate (Pixelauflösung), Überzeichnung (Gras) und der zweite Renderdurchgang
 * für Schatten. Statt zu raten, macht man sie einzeln abschaltbar.
 */
export interface Qualitaet {
  /** Obergrenze der Pixelverhältnisses. 2 heißt vierfache Pixelzahl gegenüber 1. */
  dpr: number;
  schatten: boolean;
  /** Faktor auf die Streudichte. 0 schaltet Gras und Kleinzeug ab. */
  gras: number;
}

/**
 * Leere Prop-Liste für den Messlauf `?aus=baeume`.
 *
 * Als Konstante und nicht als `[]` an der Verwendungsstelle: Ein neues Array je
 * Bild würde jede `useMemo`, die daran hängt, in jedem Bild neu auswerten — und
 * damit genau das messen, was der Schalter ausschalten soll.
 */
const LEERE_PROPS: PropInstanz[] = [];

export const QUALITAET_STANDARD: Qualitaet = { dpr: 2, schatten: true, gras: 1 };

export interface RegionsSzeneProps {
  welt: Weltdaten;
  /** Tageszeit 0…1, zyklisch. Ersetzt die frühere Auswahl aus drei festen Stimmungen. */
  tageszeit?: number;
  spielerRef?: React.RefObject<THREE.Object3D | null>;
  /** Wird je halbe Sekunde mit den echten Renderzahlen aufgerufen. */
  onMessung?: (m: Messwerte) => void;
  qualitaet?: Qualitaet;
  /**
   * Kreaturen der Region als Daten. Weglassen heisst: reine Erkundung.
   *
   * Die Szene bekommt die Spawn-Regeln, nicht die fertigen Positionen: Die Höhe
   * muss aus demselben Höhenfeld kommen, aus dem die Kacheln gebaut werden, sonst
   * schweben die Kreaturen — derselbe Fehler wie einst bei den Props.
   */
  kreaturen?: KreaturSpawn[];
  /** Silhouette je Kreatur-ID und Mutation. Von aussen, damit die Szene keine Inhalte kennt. */
  gestalt?: (kreatur: string, mutation?: number) => THREE.BufferGeometry;
  /** Bereits gefangene oder besiegte Vorkommen. */
  verbraucht?: ReadonlySet<string>;
  onBegegnung?: (v: Vorkommen) => void;
  /** Wird jedes Bild mit der nächsten Kreatur beschrieben — Grundlage der Anzeige. */
  naehe?: React.RefObject<Naehe>;
  /** Ort des Regenten in Weltkoordinaten (x, z) plus seine Silhouette. */
  regent?: { ort: [number, number]; gestalt: THREE.BufferGeometry };
  /** Wird gerufen, wenn der Spieler den Regentenort betritt oder verlässt. */
  onRegentNah?: (nah: boolean) => void;
  /**
   * Ist der Gleiter frei? Abgeleitet aus dem Weltzustand (Regent besiegt), nicht
   * gespeichert — siehe `spieler/gleiten.ts`.
   */
  gleiterFrei?: boolean;
  /** Meldet den Wechsel in den und aus dem Gleitflug. Für die Anzeige. */
  onGleiten?: (gleitet: boolean) => void;
  /** Fundstellen in Weltkoordinaten (x, z) — die Szene kennt keine Texte. */
  fundstellen?: { id: string; ort: [number, number] }[];
  gelesen?: ReadonlySet<string>;
  onFund?: (id: string) => void;
  /** Zufluchten und Bewohner in Weltkoordinaten (x, z). */
  orte?: { id: string; art: OrtsArt; ort: [number, number]; figur?: string; blick?: number;
           gang?: number; farben?: Partial<Record<RollenSlot, string>> }[];
  /** ID des nächsten Ortes in Reichweite, oder null. Nur bei Wechsel gerufen. */
  onOrtNah?: (id: string | null) => void;
  /** Startposition; ohne Angabe die Regionsmitte. Der Spielstand setzt sie. */
  startPosition?: [number, number];
  /**
   * Anfängliche Blickrichtung in Radiant. 0 heisst Norden, positiv dreht nach links.
   *
   * Nur für Messläufe gesetzt (`?absetzen=x,z,grad`). Der Grund ist derselbe wie
   * beim Absetzpunkt: Der Simulationsschritt ist auf 0,1 s geklemmt, in
   * SwiftShader läuft die Szene mit 2 Bildern je Sekunde, und eine Vierteldrehung
   * dauert damit nicht 0,9 sondern 4,5 Sekunden Wanduhr. Eine Kamerarichtung
   * „erdrücken" heisst raten; als Zahl ist sie reproduzierbar.
   */
  startBlick?: number;
  /**
   * Ausdauer nach außen reichen — die Anzeige liegt im DOM, nicht in der Szene.
   *
   * Als Ref, nicht als Callback: Der Wert ändert sich jedes Bild, und ein
   * `setState` je Bild wäre für einen Balken der teuerste denkbare Weg.
   */
  ausdauer?: React.RefObject<Ausdauerzustand>;
  /**
   * Reittier: Silhouette und Widerristhöhe, oder nichts.
   *
   * Ob überhaupt geritten werden darf, entscheidet `spiel/reiten.ts` — die Szene
   * bekommt nur das Ergebnis. Sie kennt keine Kreaturen und keine Mutationsstufen.
   */
  reittier?: Reittier | null;
  /**
   * Hält die Bildschleife an, ohne die Szene abzubauen.
   *
   * Während eines Kampfes ist die Welt unsichtbar, aber sie darf nicht neu gebaut
   * werden: Terrain, Höhenfeld, 155.000 Props und die Kollision kosten zusammen
   * mehrere Sekunden. `frameloop="never"` lässt alles stehen und zeichnet nichts.
   */
  angehalten?: boolean;
  /**
   * Grobes Gelände jenseits der Region — die Kulisse am Kartenrand.
   *
   * Optional, weil eine Region auch ohne auskommen muss: Die Datei entsteht aus
   * einem eigenen Lauf (`npm run fernland`) und kostet 93 API-Aufrufe. Fehlt sie,
   * sieht es aus wie bisher, statt dass die Szene nicht startet.
   */
  fernland?: Fernland | null;
  /**
   * Meldet, dass der Spieler an die Regionsgrenze gestossen ist.
   *
   * Die Grenze selbst bleibt eine harte Klemmung — nur so kann man nicht aus dem
   * Höhenfeld laufen. Was fehlte, war die **Rückmeldung**: Bisher blieb man
   * wortlos stehen und hielt es für einen Fehler. Der Aufruf kommt in jedem Bild,
   * in dem geklemmt wird; das Entprellen macht die Anzeige.
   */
  meldeRand?: () => void;
  /**
   * Zustand der Daumenknüppel nach außen reichen — wie `ausdauer` als Ref.
   *
   * Die Szene zeichnet sie nicht: Ein Bedienelement gehört ins DOM, nicht in die
   * 3D-Szene. Dort wäre es an die Bildrate der Szene gebunden, müsste in
   * Weltkoordinaten umgerechnet werden und läge im Nebel.
   */
  stoecke?: React.RefObject<Stoecke>;
  /**
   * Kampf Stufe 1 (ADR-0007): zwei Übungsgegner vor dem Startpunkt. Nur hinter
   * `?kampf=1` — Platzhalter ohne Asset, bis die Fassade steht.
   */
  kampfplatz?: boolean;
  /** Stand für die Kampfanzeige im DOM, wie `ausdauer` als Ref. */
  kampfStand?: React.RefObject<KampfStand | null>;
}

export function RegionsSzene({
  welt, tageszeit = 0.26, spielerRef, onMessung,
  qualitaet = QUALITAET_STANDARD, kreaturen, gestalt, verbraucht, onBegegnung, naehe,
  regent, onRegentNah, gleiterFrei, onGleiten, fundstellen, gelesen, onFund, orte, onOrtNah,
  startPosition, startBlick = 0, ausdauer, reittier = null, angehalten = false,
  fernland = null, meldeRand, stoecke, kampfplatz = false, kampfStand,
}: RegionsSzeneProps) {
  const eigenerRef = useRef<THREE.Object3D>(null);
  /** Führt der Kampf gerade die Figur? `Kampfplatz` schreibt, `Spieler` liest. */
  const kampfSperre = useRef(false);
  const ref = spielerRef ?? eigenerRef;
  const eigeneAusdauer = useRef<Ausdauerzustand>(neueAusdauer());
  const kraft = ausdauer ?? eigeneAusdauer;
  const gier = useRef(startBlick);
  // Einmal je Zeitpunkt mischen, nicht je Bild: Farbmischung ist billig, aber sie
  // hängt an einem Regler und nicht an der Bildrate.
  const s = useMemo(() => STIMMUNG_MESSLAUF ?? stimmungBei(tageszeit), [tageszeit]);
  const neigung = useRef(NEIGUNG_START);
  const schritt = useRef({ phase: 0, tempo: 0 });
  // Als Ref gespiegelt: Die Bewegungsschleife liest jedes Bild, und ein Prop-Wechsel
  // soll nicht durch den Callback-Baum von `Spieler` laufen.
  const reitetRef = useRef(false);
  reitetRef.current = reittier !== null;
  // Der Gleiter als Ref und nicht als Prop im Frame: Ein Weltzustand, der sich
  // einmal je Spielstand ändert, soll keine Bildschleife neu aufsetzen.
  const gleiterRef = useRef(false);
  gleiterRef.current = gleiterFrei ?? false;

  // Grobes Terrain: liefert weiterhin Wege, Gewässer, Gebäude und die XZ-Verteilung
  // der Props. Der sichtbare Boden kommt aus den LOD-Kacheln.
  const terrain = useMemo(() => baueTerrain(welt), [welt]);

  // Höhenfeld mit Mikrorelief — die gemeinsame Wahrheit für Boden, Props und Spawn.
  const feld = useMemo(() => baueHoehenfeld(welt, MIKRO_MESSLAUF ?? undefined), [welt]);
  const kacheln = useMemo(() => baueKachelraster(feld), [feld]);

  // Props einmal zentral: Die Szene zeichnet sie, die Kollision braucht dieselben
  // Positionen. Zweimal verteilen hieße, gegen unsichtbare Bäume zu laufen.
  const props = useMemo(() => {
    // Freihaltung der Bauwerke (ADR-0006): Die Blender-Szene bringt ihren eigenen Wald mit.
    const roh = verteileProps(welt, { ...terrain, hoeheAn: feld.hoehe }, 1)
      .filter(p => !gesperrt(p.position[0], p.position[2], 'props'));
    return roh.map(p => ({
      ...p,
      position: [p.position[0], feld.hoehe(p.position[0], p.position[2]), p.position[2]],
    })) as PropInstanz[];
  }, [welt, terrain, feld]);
  const kollision = useMemo(
    () => baueKollision(props, welt, feld.breiteMeter, feld.tiefeMeter),
    [props, welt, feld],
  );


  // Ohne Startposition steht der Spieler im Ursprung (y = 0) — im Œntal sind das
  // ~170 m unter der Geländeoberfläche, die Kamera schaut dann von innen durch den
  // Berg. Bis es echte Bewegung gibt, ist die Regionsmitte der Startpunkt.
  // Kreaturen auf derselben Fläche wie der Spieler — hoeheAufFlaeche liest die
  // gezeichnete LOD-Oberfläche, feld.hoehe nur das grobe Raster.
  const vorkommen = useMemo(
    () => (kreaturen?.length
      ? verteileKreaturen(welt, kreaturen,
          (i, j) => [(j / (welt.aufloesung - 1) - 0.5) * feld.breiteMeter,
                     (i / (welt.aufloesung - 1) - 0.5) * feld.tiefeMeter],
          (x, z) => hoeheAufFlaeche(feld, x, z),
          feld.breiteMeter, feld.tiefeMeter)
      : []),
    [welt, kreaturen, feld],
  );

  const regentOrt = useMemo<[number, number, number] | null>(
    () => (regent
      ? [regent.ort[0], hoeheAufFlaeche(feld, regent.ort[0], regent.ort[1]) + 1.1, regent.ort[1]]
      : null),
    [regent, feld],
  );

  const funde = useMemo(
    () => (fundstellen ?? []).map(f => ({
      id: f.id,
      position: [f.ort[0], hoeheAufFlaeche(feld, f.ort[0], f.ort[1]), f.ort[1]] as [number, number, number],
    })),
    [fundstellen, feld],
  );

  const ortsmarken = useMemo<Ortsmarke[]>(
    () => (orte ?? []).map(o => ({
      id: o.id, art: o.art, figur: o.figur, blick: o.blick, gang: o.gang, farben: o.farben,
      position: [o.ort[0], hoeheAufFlaeche(feld, o.ort[0], o.ort[1]), o.ort[1]],
    })),
    [orte, feld],
  );

  const start = useMemo<[number, number, number]>(() => {
    const [x, z] = startPosition ?? [0, 0];
    return [x, hoeheAufFlaeche(feld, x, z), z];
  }, [feld, startPosition]);

  /**
   * Die Kulisse wird je Stimmung **neu gebaut**, weil Dunst und Beleuchtung in
   * ihren Farben stecken statt im Material (siehe `world/fernland.ts`).
   *
   * Der Preis ist ein Neubau, wenn `stimmungBei` einen neuen Wert liefert — also
   * bei jeder Bewegung des Tageszeitreglers. Gemessen: 19.192 Dreiecke, das ist
   * eine Grössenordnung unter dem, was `LodTerrain` je Bild an Kacheln baut.
   * Ein Regler ist ausserdem ein Werkzeug, kein Spielzustand: Im Spiel steht die
   * Zeit, und dann läuft das hier genau einmal.
   */
  const fernGeo = useMemo(
    () => (fernland ? baueFernland(fernland, welt, {
      dunst: s.horizont, sonne: s.sonne, sonneStaerke: s.sonneStaerke,
      umgebung: s.umgebung, umgebungStaerke: s.umgebungStaerke,
      sonnenstand: s.sonnenstand,
    }) : null),
    [fernland, welt, s],
  );
  const fernMaterial = useMemo(() => baueFernlandMaterial(), []);
  useEffect(() => () => { fernGeo?.dispose(); }, [fernGeo]);

  return (
    <Canvas
      shadows={qualitaet.schatten}
      frameloop={angehalten ? 'never' : 'always'}
      dpr={[1, qualitaet.dpr]}
      camera={{ fov: 55, near: 0.2, far: KAMERA_FERN, position: [0, GROESSE.kameraHoehe, GROESSE.kameraAbstand] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <WasserUmgebung werte={{ zenit: s.zenit, horizont: s.horizont, dunst: s.nebel,
        sonne: s.sonne, sonnenstand: s.sonnenstand, scheibe: s.scheibe, hof: s.hof }}>
      <Beleuchtung s={s} ziel={ref} />
      {!istAus('kulisse') && fernGeo && (
        <mesh geometry={fernGeo} material={fernMaterial} frustumCulled={false} renderOrder={-500} />
      )}
      <Terrain welt={welt} terrain={terrain} feld={feld} kacheln={kacheln} ziel={ref}
               props={istAus('baeume') ? LEERE_PROPS : props}
               dichte={istAus('gras') ? 0 : qualitaet.gras}
               rand={{ farbe: s.randFarbe, staerke: s.randStaerke }}
               fenster={s.fenster ?? 0} />
      <object3D ref={ref} position={start}>
        {/* Eigene Suspense-Grenze (G-134): Ein ladendes GLB darf nicht die ganze Szene
            aufhalten — ohne Grenze verwirft React beim ersten Aufbau den gesamten
            Baum samt allen `useMemo` (Klippen, Baender, Kacheln) und rechnet ihn nach
            jedem geladenen Modell neu. */}
        <Suspense fallback={null}>
          <SpielerFigur gier={gier} schritt={schritt} reittier={reittier}
                        rand={{ farbe: s.randFarbe, staerke: s.randStaerke }} />
        </Suspense>
      </object3D>
      <Spieler feld={feld} ziel={ref} gier={gier} neigung={neigung}
               schritt={schritt} kollision={kollision} ausdauer={kraft}
               reitet={reitetRef} gleiterFrei={gleiterRef} onGleiten={onGleiten}
               meldeRand={meldeRand} stoecke={stoecke} kampfSperre={kampfSperre} />
      {kampfplatz && (
        <Kampfplatz ziel={ref} gier={gier} feld={feld} kollision={kollision}
                    ausdauer={kraft} gesperrt={kampfSperre} stand={kampfStand} />
      )}
      {funde.length > 0 && (
        <Fundstellen orte={funde} ziel={ref} gelesen={gelesen ?? LEER} onFund={onFund} />
      )}
      {ortsmarken.length > 0 && (
        <Orte orte={ortsmarken} ziel={ref} onNah={onOrtNah} rand={{ farbe: s.randFarbe, staerke: s.randStaerke }}
              hoeheAn={(x, z) => hoeheAufFlaeche(feld, x, z)} />
      )}
      {regent && regentOrt && (
        <Regentenort ort={regentOrt} gestalt={regent.gestalt} ziel={ref} onNah={onRegentNah} />
      )}
      {!istAus('bauwerke') && BAUWERKE.length > 0 && (
        <Bauwerke ziel={ref} rand={{ farbe: s.randFarbe, staerke: s.randStaerke }} />
      )}
      {vorkommen.length > 0 && gestalt && (
        <Kreaturen vorkommen={vorkommen} gestalt={gestalt} ziel={ref} gier={gier}
                   naehe={naehe} onBegegnung={onBegegnung} verbraucht={verbraucht}
                   rand={{ farbe: s.randFarbe, staerke: s.randStaerke }}
                   hoeheAn={(x, z) => hoeheAufFlaeche(feld, x, z)} kollision={kollision} />
      )}
      <Kamera ziel={ref} gier={gier} neigung={neigung} feld={feld} kollision={kollision} />
      <Kontur an={konturAn(true)} ao={aoStaerke(1.4)} aoRadius={aoReichweite(8)} />
      <Messung melde={onMessung} />
      </WasserUmgebung>
    </Canvas>
  );
}
