/**
 * BRACHLAND — Regionsszene
 *
 * Setzt die Art Direction um: Dämmerung, Nebel als Werkzeug, Silhouetten,
 * eine Signalfarbe für Befall. Alles Geometrie aus src/world, keine Texturen.
 *
 * Props laufen als InstancedMesh — 40.000 Bäume als Einzelobjekte würden jedes
 * Handy erledigen, als Instanzen sind es eine Handvoll Draw Calls.
 */
import { Suspense, useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Weltdaten } from '../world/osm.js';
import { imPolygon } from '../world/osm.js';
import { baueTerrain, baueGebaeude, GROESSE, type TerrainErgebnis } from '../world/terrain.js';
import { zerlegeBaender, baueWegKachel, baueWasserKachel, baueFallKachel, senkePegel, type Pegelsenke,
         baueGartenKachel, type Bandsatz } from '../world/baender.js';
import { useGLTF } from '@react-three/drei';
import { MIT_MODELL, reitsitz, kreaturGeometrie }
  from '../world/kreaturgestalt.js';
import { Kontur, konturAn, aoStaerke, aoReichweite } from './Kontur.js';
import { WasserUmgebung, WasserSzeneProbe, useWasserUmgebung, useHimmelKarte } from './WasserUmgebung.js';
import { EzBaumProbe, istEzProbeBereit, uebernimmtEzVariante } from './EzBaumProbe.js';
import { Rahmenkronen } from './Rahmenkronen.js';
import { TakramProbe } from './TakramProbe.js';
import { STIMMUNG, HEMI_BODEN, heileStimmung, type Stimmung } from '../world/stimmung.js';
export { STIMMUNG, HEMI_BODEN, HEMI_BODEN_TAG, type Stimmung, type StimmungsName } from '../world/stimmung.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { baueHoehenfeld, baueKachelraster, lodFuerAbstand, baueKachelGeometrie,
         hoeheAufFlaeche, spiegelAufFlaeche, aufsatzboden, type HoehenFeld, type Kachel } from '../world/lod.js';
import { benutzeSteuerung, type Stoecke } from '../spieler/steuerung.js';
import { aktionenVon } from '../spieler/eingabe.js';
import { peilung } from '../spieler/peilung.js';
import { baueKleinzeugGeometrie, streueKleinzeug, KLEIN_MAX, STREU_NACHZIEHEN } from '../world/streuung.js';
import { baueBodenMaterial, setzeBodenHimmel, BODEN_LOCH } from '../world/bodenmaterial.js';
import { baueWiesenbereich, baueWiesenHauskontakt, type Wiesenbereich } from '../world/wiesenbereich.js';
import { MILBINGER_TAGESLICHT, MILBINGER_WOLKENLICHT, milbingerLichtanteil } from '../world/milbingerlicht.js';
import { baueMilbingerSandkasten } from '../world/milbingersubstanz.js';
import { ersetzteGebaeude, hofbauLagen, ladeHofbauten } from '../world/hofbau.js';
import LOD2_ROH from '../../public/world/oental-lod2.json';
import { ORTE, FASSADEN, REGIONEN, nachMetern } from '../data/inhalte.js';
import { baueBaum } from '../world/baum.js';
import { baueHimmel, setzeHimmel, HIMMEL_PHYSIK_AN } from '../world/himmel.js';
import { koppleStimmung, mischeAtmosphaere, ATMOSPHAERE_VORGABE } from '../world/atmosphaere.js';
import { baueFernland, baueFernlandMaterial, stelleReliefLicht, type Fernland } from '../world/fernland.js';
import { baumRaster, streuBaeume, streuMatrizen, type StreuCache } from '../world/streukarten.js';
import { BODEN_NAH, bodenMaterial, bodenMatrizen, buschGeometrie, flachGeometrie, type BodenMatrizen, type BodenpflanzenCache } from '../world/bodenpflanzen.js';
import { efeuKartenMaterial, efeuKartenTiefe, kachelGeometrie, kartenMaterial, kartenMatrizen, setzeEfeuSammler, type EfeuKarte } from '../world/efeukarten.js';
import { baueWindMaterial, windAusHoehe, setzeHimmelStaerke, type RollenSlot, type RindenArt } from '../world/windmaterial.js';
import { BAUM_UEBERBLEND, UEBERBLEND_BAND, impostorGeometrie, impostorMaterial } from '../world/impostor.js';
import { PALETTE } from '../world/palette.js';
import { BAUWERKE, bauwerkPfad, sichtbareBauwerke, type Bauwerk } from '../world/bauwerke.js';
import { randSeite, type Seite } from '../spiel/region.js';
import { haengeAgxLookEin } from './tonwert.js';
import { haengeNebelEin } from './nebel.js';
import { findeKlippen, baueKlippenGeometrie, KLIPPEN_VARIANTEN, type Klippe } from '../world/klippen.js';
import { baueHausMaterial } from '../world/hausmaterial.js';
import { baueWasserMaterial, baueWegMaterial, type WasserReflexProbe } from '../world/bandmaterial.js';
import { baueStrassenkulissen } from '../world/strassenkulisse.js';
import { BODEN_AN, EFEUKARTEN_AN, HOFBAU_AN, STREU_AN, FERNHALB_AN, LOD2_AN, MILBINGERBODEN_AN, MILBINGERKLAR_AN, MILBINGERLICHT_AN, MILBINGERMASSE_AN, MILBINGERSUBSTANZ_AN, STRASSENVERFALL_AN, WOHNWEGQUERSCHNITT_AN } from '../world/echt.js';
import { baueQuerschnittGrasmaske, querschnittFreihaltung, type QuerschnittGrasmaske } from '../world/strassenquerschnitt.js';
import type { Strassenkulisse } from '../data/schema.js';
import { HUEFTE } from '../spieler/figur.js';
import { lagerTon } from '../ton/lagerton.js';
import { kameraZustand, ZEITLUPE } from '../kampf/kamerazustand.js';
import { armMitSicht, sichtFrei, ZIEL_RAND, type Versperrt } from '../kampf/sichtlinie.js';
import { klingeAb, neuerStoss, stosse, stossVersatz } from '../kampf/kamerastoss.js';
import { einstellungen } from '../spiel/einstellungen.js';
import { baueKollision, type Kollisionsfeld } from '../spieler/kollision.js';
import { propsWieSzene } from '../world/szenenprops.js';
import { BLENDER_BAEUME, chunkeProps, propGeometrie, attrappeGeometrie, propPfad, propTon,
         VARIANTEN, type PropArt, type PropChunk, type PropInstanz, blenderBaum, wegTest } from '../world/props.js';
import { baueLaubkarten, schrumpfeHuelle, kartenArtFuer, LAUBKARTEN_AN, bueschelTextur, type KartenArt } from '../world/laubkarten.js';
import { richteHofPropEin } from '../world/hofmaterial.js';
import { indexiereHausGeometrie } from '../world/hausindex.js';
import { aktualisiereKachelpuffer, bereiteKachelpuffer, geometrienAusKachelpuffern, sammleKachel } from '../world/kachelgruppen.js';
import type { Kachelpuffer, Kachelsammlung } from '../world/kachelgruppen.js';
import { baueKachelupload } from '../world/kachelupload.js';
import { bestimmeHof, waehleHof, HOF_UNIFORM } from '../world/hofplatz.js';
import { bestimmeHofhaeuser } from '../world/hofhaeuser.js';
import { teileHofBaeume, teileMilbingerBaeume, istHofBusch } from '../world/hofgruenwahl.js';
import { hofStrauchGeometrie, hofStrauchMaterial, setzeHofStrauchZeit } from '../world/hofstrauch.js';
import { FELS_BILDTAKT_AN, LOOK_FELS_AN, LOOK_FELS_DICHTE, LOOK_FELS_PROPWEITE, SCAN_BAEUME_AN, SCAN_BUESCHEL_AN } from '../world/echt.js';
import { HOF_AN, HOF_BILDFLUSS_AN, HOF_BILDRUHE_AN, HOF_BILDSPITZEN_AN, HOF_BILDTAKT_AN, HOF_GRUEN_AN, HOF_KACHELNACHLAUF_AN, HOF_STRAUCH_WEIT, REFERENZHAUS_AN, HOF_HAEUSER_AN, HAUS_KOMPAKT_AN, HOF_LICHT_AN, HOF_ZIELTREUE_AN, WESTVERFALL_AN } from '../world/echt.js';
import { STAMM_AN, WASSERREFLEX_AN, SCHATTEN_AUFLOESUNG, HDRI_AN, HDRI_STAERKE, UMLICHT_AN, UMLICHT_STAERKE } from '../world/echt.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { setzeStammfuss } from '../world/stammfuss.js';
import { baueGrasteppich, NAH_HALB, NAH_ZELLE, NAH_HALB_ECHT, NAH_ZELLE_ECHT, NAH_ZELLE_FEIN, TEPPICH_HALB, TEPPICH_ZELLE_FEIN, FERN_ZELLE, TEPPICH_FRIST_MS } from '../world/grasteppich.js';
import { GRAS_ECHT, GRAS_FEIN, WEIHER_AN, GEWAESSER_ECHT, LAUB_FEIN } from '../world/echt.js';
import { meldeSpiegelflaeche, Spiegelbild } from '../world/spiegelbild.js';
import { baueWeiher } from '../world/weiher.js';
import { istAus } from './abschalter.js';
import { Kampfplatz, type KampfFigur, type GegnerArt } from '../kampf/Kampfplatz.js';
import type { Kampfbericht } from '../kampf/kampfende.js';
import { WAFFE_AN_HAND, legeAnHeldHand, baueSpeer, gleiteAmStiel, AXT_URSPRUNG_VOR_D429 } from '../kampf/waffenhand.js';
import { useHeldWahl, gestaltPfad, HELD_CLIPS, HELD_KNOCHEN, legeWahlAn, begrenzeBewohner, bewohnerWahl, setzeFigurUmgebung, setzeFigurSaum } from '../spieler/held.js';
import { setzeFuesse, neuerFussZustand, type FussZustand } from '../spieler/fussik.js';
import { PosenTraegheit, Koerperfein, sammleKnochen, elternkarte, teileClip, messeGang, type FeinEingabe } from '../figur/laufzeit.js';
import { nachfahren, RIG_MENSCH } from '../figur/ebenen.js';
import { gangStufen, type Gang } from '../figur/fortbewegung.js';
import { hiebClipzeit, uebergangsDauer, type Bewegungsart, type Hiebmarken } from '../figur/kette.js';
import { leseClipmarken } from '../figur/clipmarken.js';
import { FIGUR } from '../figur/werte.js';
import { figurfeinAn } from '../figur/schalter.js';
import { landeClip, landungLaeuft, meldeLandung, neueLandung, type Landeart, type Landung } from '../figur/landung.js';
import { luftBild, luftClip, meldeLuft, neueLuft, type Luft } from '../figur/sprung.js';
import { neueWende, standVersatz, wendeSchritt } from '../figur/wende.js';
import { wegVomAngreifer } from '../kampf/gewicht.js';
import { KOMBO_AB } from '../kampf/echtzeit.js';
/**
 * D457: Clipmarken von D456 (`content/clipmarken.json`) — Kettenpose und Einstieg je Clip. Die Datei darf fehlen:
 * Dann ist die Karte leer und die Laufzeit kettet über Clipanfang und Clipende (`figur/kette.ts`).
 */
const CLIPMARKEN = leseClipmarken(Object.values(import.meta.glob('../../content/clipmarken.json', { eager: true, import: 'default' }))[0]);
const _feinV = new THREE.Vector3();
/** `?fuesse=0` schaltet die Fussanpassung ab (D214). */
/** Bis zu diesem Abstand bekommen Bewohner die Fussanpassung (D217). */
const BEWOHNER_FUSS_AB = 14;
const FUESSE_AN = typeof location === 'undefined' || new URLSearchParams(location.search).get('fuesse') !== '0';
import { clone as klonSkelett } from 'three/examples/jsm/utils/SkeletonUtils.js';
/** `?figur=alt`: die alte Wanderin statt der Figur aus dem Editor (Vergleich, D175). */
const ALTE_FIGUR = new URLSearchParams(location.search).get('figur') === 'alt';
const _meldeV = new THREE.Vector3();
/** `?eile=20`: Tagesroutine im Zeitraffer (Messlauf, D177). */
const EILE = Number(new URLSearchParams(location.search).get('eile') ?? 1) || 1;
/** `?bewohner=alt`: die Bewohner wie bis D175 (D176). */
const BEWOHNER_ALT = new URLSearchParams(location.search).get('bewohner') === 'alt';
/**
 * Bewohner → Gestalt der neuen Figuren (D176). Die alten Figurnamen stehen in den Inhalten; die
 * Zuordnung folgt ihrer Rolle (Arbeit → Landvolk, draussen → Waldläufer). Frisur und Haar aus der
 * Blickrichtung als Saat, Haarfarbe aus `farben.haar`, wenn der Inhalt eine setzt.
 */
const KEINE_CLIPS: THREE.AnimationClip[] = [];
import type { KampfStand } from '../ui/Kampfanzeige.js';
import { meldeFertig, ladezeit } from './ladezeit.js';
import { TERRAIN_SICHT, NEUAUFBAU_AB, WEITE_WEIT, ATTRAPPE_AB, PROP_NEUBEWERTUNG } from './sichtweiten.js';
import { buendleFernProps, propListenNeu, waehleProps, type PropAnkerCache, type PropStufe } from './propauswahl.js';
import { verteileKreaturen, rueckkehrVorkommen, type Vorkommen, type KreaturSpawn } from '../world/vorkommen.js';
import { neueAusdauer, reicht, verbrauche, schritt as ausdauerSchritt,
         KLETTERN_JE_SEK, SPRUNG_KOSTEN, type Ausdauer as Ausdauerzustand } from '../spieler/ausdauer.js';
import { REITEN_GEHEN, REITEN_RENNEN, REIT_MAX_GRAD } from '../spiel/reiten.js';
import { GEHEN, RENNEN, SCHWERKRAFT, ABSPRUNG, KLETTERN_TEMPO, BEWEGUNG } from '../spieler/tempo.js';
import { begrenzeFall, fallhoeheAus, fallschaden, gerolltBeiLandung, kaelteLeben, kaelteSchritt, neueKaelte } from '../spieler/bewegung.js';
import { GLEIT_TEMPO, bremse, gleitSchritt, neuerFall, type Fall } from '../spieler/gleiten.js';


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

/** `?sonne=3.2` überschreibt die Sonnenstärke (D172, Messparameter) — für das Verhältnis Sonne zu Fülllicht. */
const SONNE_MESSLAUF: number | null = (() => {
  if (typeof location === 'undefined') return null;
  const text = new URLSearchParams(location.search).get('sonne');
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
haengeAgxLookEin(typeof location !== 'undefined'
  && ['hofziel','hofdachbruch'].includes(new URLSearchParams(location.search).get('stimmung') ?? ''), HOF_ZIELTREUE_AN);
// D204: Nebel mit Auslauf und Höhendunst — wie der Look vor dem ersten Material einhängen.
haengeNebelEin();

/** Nur die Sonnenkamera sieht die grobe Ersatzgeometrie (three r187, WebGLShadowMap). */
const SCHATTENHUELLEN_EBENE = 1;

/** Kurve ohne Adresse: der Look des Renders (D164). */
const KURVE_VORGABE: THREE.ToneMapping = THREE.CustomToneMapping;

/**
 * Schattenkarte (D172, Messparameter): `?schattenkarte=4096,120` setzt Auflösung und halbe Kantenlänge
 * in Metern. Vorgabe 2048 über ±250 m = 24 cm je Texel — ein Blattloch der Kronen ist kleiner, die
 * Sprenkel des Renders verschwimmen darin.
 */
const SCHATTENKARTE = (() => {
  const roh = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('schattenkarte');
  const [a, h] = (roh ?? '').split(',').map(Number);
  return { aufloesung: Number.isFinite(a) && a >= 512 ? a : SCHATTEN_AUFLOESUNG, halb: Number.isFinite(h) && h >= 20 ? h : 250 };
})();

/** `?schattenart=basic|percentage|soft|variance` — Messparameter für den Schattenfilter (D464); Vorgabe `percentage`. */
const SCHATTENART: 'basic' | 'percentage' | 'soft' | 'variance' = (() => {
  const roh = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('schattenart');
  return roh === 'basic' || roh === 'soft' || roh === 'variance' ? roh : 'percentage';
})();

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


/**
 * `?stimmung=goldnebel` setzt eine Stimmung **ausserhalb** des Tageslaufs (D152).
 *
 * Messparameter wie `?zeit=`: Eine Probe-Stimmung soll an denselben Adressen wie
 * die vier Schluesselbilder gemessen werden koennen, ohne dass sie im Tageslauf
 * liegt und damit die Art Direction still verschiebt. Unbekannte Namen fallen
 * auf den Tageslauf zurueck.
 */
/** `?geheilt=1` zeigt die Region im Zustand nach der Heilung (D240) — zum Ansehen ohne Spielstand. */
const GEHEILT_ANSICHT = typeof location !== 'undefined'
  && new URLSearchParams(location.search).get('geheilt') === '1';

const STIMMUNG_MESSLAUF: Stimmung | null = (() => {
  if (typeof location === 'undefined') return null;
  if (HOF_ZIELTREUE_AN) return STIMMUNG.hofbild;
  const name = new URLSearchParams(location.search).get('stimmung');
  return name !== null && Object.prototype.hasOwnProperty.call(STIMMUNG, name) ? STIMMUNG[name] : null;
})();

/**
 * Schlüsselbilder auf der Zeitachse 0…1. Der Lauf ist zyklisch: 1 ist wieder 0.
 */
const TAGESLAUF: { zeit: number; name: string }[] = [
  { zeit: 0.00, name: 'nacht' },
  { zeit: 0.26, name: 'daemmerung' },
  // D168: das Licht des Renders als eigener Schlüssel im Tageslauf (ADR-0006 Stufe 3). Sonne
  // 13° hoch im Nordosten — ein Vormittag, deshalb zwischen Dämmerung und Nebelmorgen.
  { zeit: 0.39, name: 'tag' },
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
    hemiBoden: mischeFarbe(A.hemiBoden ?? HEMI_BODEN, B.hemiBoden ?? HEMI_BODEN, f),
    himmelAnteil: z(A.himmelAnteil ?? 0.7, B.himmelAnteil ?? 0.7),
    // D368: die Luft wandert mit (nur `?himmel=physik` liest sie).
    atmosphaere: mischeAtmosphaere(A.atmosphaere ?? ATMOSPHAERE_VORGABE, B.atmosphaere ?? ATMOSPHAERE_VORGABE, f),
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
const KACHELPUFFER_AN = (HOF_AN || FELS_BILDTAKT_AN) && typeof location !== 'undefined'
  && new URLSearchParams(location.search).get('kachelpuffer') !== '0';
const KACHELNACHLAUF_AN = KACHELPUFFER_AN && (HOF_KACHELNACHLAUF_AN || FELS_BILDTAKT_AN);
const KACHEL_FRIST_MS = 3;

type Sichtkachel = { kachel: Kachel; lod: number };
type Kachelbau = Generator<void, () => void>;
type KachelVorladen = (geometrie: THREE.BufferGeometry) => boolean;
type BereiteKacheln = (auswahl: readonly Sichtkachel[], gestaffelt: boolean, anker: THREE.Vector3,
  vorladen?: KachelVorladen) => Kachelbau;
type Kachelnachlauf = {
  bodenFertig: boolean;
  baenderFertig: boolean;
  pegelNeu: boolean;
  baender?: BereiteKacheln;
};

function kachelauswahl(kacheln: Kachel[], p: THREE.Vector3): Sichtkachel[] {
  const distanz = (k: Kachel) => Math.hypot(k.mitte[0] - p.x, k.mitte[1] - p.z);
  const quelle = KACHELNACHLAUF_AN ? kacheln : [...kacheln].sort((a, b) => distanz(a) - distanz(b));
  const auswahl = [];
  for (const kachel of quelle) {
    const abstand = distanz(kachel);
    const d = Math.max(0, abstand - kachel.radius);
    if (d <= TERRAIN_SICHT) auswahl.push({ kachel, lod: lodFuerAbstand(d), abstand });
  }
  if (KACHELNACHLAUF_AN) auswahl.sort((a, b) => a.abstand - b.abstand);
  return auswahl;
}

function fülleKachelbau(arbeit: Kachelbau, frist: number): (() => void) | undefined {
  do {
    const schritt = arbeit.next();
    if (schritt.done) return schritt.value;
  } while (performance.now() < frist);
}

function entsorgeErsetzteKacheln(vorher: readonly THREE.BufferGeometry[], nachher: readonly THREE.BufferGeometry[]): void {
  const erhalten = new Set(nachher);
  for (const g of vorher) if (!erhalten.has(g)) g.dispose();
}

function LodTerrain({ feld, kacheln, ziel, nachlauf, wiesenbereich }: {
  feld: HoehenFeld; kacheln: Kachel[]; ziel: React.RefObject<THREE.Object3D | null>;
  nachlauf: Kachelnachlauf;
  wiesenbereich?: Wiesenbereich;
}) {
  const cache = useRef(new Map<string, THREE.BufferGeometry>());
  const letzte = useRef(new THREE.Vector3(NaN, NaN, NaN));
  const puffer = useRef<Kachelpuffer>(new Map());
  const [stufen, setStufen] = useState<THREE.BufferGeometry[]>([]);
  const angezeigt = useRef(stufen);
  const lauf = useRef<{ anker: THREE.Vector3; arbeit: Kachelbau; vorgeladen: THREE.BufferGeometry[] } | null>(null);
  const gl = useThree(s => s.gl);
  const upload = useRef<ReturnType<typeof baueKachelupload> | null>(null);
  useEffect(() => {
    if (!KACHELNACHLAUF_AN) return;
    const vorbereitung = baueKachelupload(gl);
    upload.current = vorbereitung;
    return () => {
      for (const g of lauf.current?.vorgeladen ?? []) g.dispose();
      lauf.current = null;
      upload.current = null;
      vorbereitung.dispose();
    };
  }, [gl, nachlauf]);
  useEffect(() => {
    if (!KACHELNACHLAUF_AN) return;
    entsorgeErsetzteKacheln(angezeigt.current, stufen);
    angezeigt.current = stufen;
  }, [stufen]);

  const material = useMemo(() => baueBodenMaterial(wiesenbereich), [wiesenbereich]);
  useEffect(() => () => material.dispose(), [material]);

  const baue: BereiteKacheln = function* (auswahl, gestaffelt, anker, vorladen) {
    // Höchstens so viele Kacheln je Bild neu bauen. Alle 226 auf einmal kosten
    // gemessen 68 ms — ein sichtbarer Ruckler alle 32 m. Fehlende Kacheln werden im
    // nächsten Bild nachgezogen; bis dahin fehlt am Rand ein Stück, das im Nebel liegt.
    let budget = 12;
    const jeStufe = new Map<number, THREE.BufferGeometry[]>();
    const kachelgruppen: Kachelsammlung = new Map();
    // D289: nächste Kacheln zuerst (siehe Bänder) — sonst fehlt bei wenigen Bildern je Sekunde der Boden am Spieler.
    for (const { kachel: k, lod } of auswahl) {
      const schluessel = `${k.ix}:${k.iz}:${lod}`;
      let g = cache.current.get(schluessel);
      if (!g) {
        if (!gestaffelt && budget-- <= 0) continue;
        g = baueKachelGeometrie(feld, k, lod, undefined, HOF_BILDFLUSS_AN || FELS_BILDTAKT_AN);
        cache.current.set(schluessel, g);
        if (gestaffelt) yield;
      }
      if (KACHELPUFFER_AN) sammleKachel(kachelgruppen, k, g, String(lod));
      else {
        const liste = jeStufe.get(lod);
        if (liste) liste.push(g); else jeStufe.set(lod, [g]);
      }
    }

    // Budget nicht ausgeschöpft: alle Kacheln in Sicht stehen — Ladezeit (D146).
    if (budget >= 0) { meldeFertig('terrain'); nachlauf.bodenFertig = true; }

    if (KACHELPUFFER_AN) {
      const neu = gestaffelt ? yield* bereiteKachelpuffer(puffer.current, kachelgruppen, vorladen, HOF_BILDSPITZEN_AN || FELS_BILDTAKT_AN)
        : aktualisiereKachelpuffer(puffer.current, kachelgruppen);
      const geometrien = geometrienAusKachelpuffern(neu);
      return () => {
        letzte.current.copy(anker);
        if (budget < 0) letzte.current.set(NaN, NaN, NaN);
        puffer.current = neu;
        if (KACHELNACHLAUF_AN) setStufen(geometrien);
        else setStufen(vorher => {
          entsorgeErsetzteKacheln(vorher, geometrien);
          return geometrien;
        });
      };
    }
    const zusammengefasst: THREE.BufferGeometry[] = [];
    for (const gs of jeStufe.values()) {
      const m = mergeGeometries(gs, false);
      if (m) zusammengefasst.push(m);
    }
    return () => {
      letzte.current.copy(anker);
      if (budget < 0) letzte.current.set(NaN, NaN, NaN);
      setStufen(vorher => { vorher.forEach(g => g.dispose()); return zusammengefasst; });
    };
  };

  useFrame(() => {
    const p = ziel.current?.position;
    if (!p) return;
    const nah = sichtbareBauwerke(p.x, p.z)
      .sort((a, b) => Math.hypot(a.ursprung.x - p.x, a.ursprung.z - p.z) - Math.hypot(b.ursprung.x - p.x, b.ursprung.z - p.z))[0];
    setzeBodenHimmel(nah?.name ?? null);
    const baender = nachlauf.baender;
    if (KACHELNACHLAUF_AN && nachlauf.bodenFertig && nachlauf.baenderFertig && baender) {
      // Boden und Aufsätze bleiben bis zur gemeinsamen Freigabe auf ihrer alten Höhe.
      // Ein Sprung oder geänderter Pegel ersetzt einen noch nicht freigegebenen Auftrag.
      if (lauf.current && (nachlauf.pegelNeu || p.distanceTo(lauf.current.anker) >= NEUAUFBAU_AB)) {
        for (const g of lauf.current.vorgeladen) g.dispose();
        lauf.current = null;
      }
      const frist = performance.now() + KACHEL_FRIST_MS;
      if (!lauf.current) {
        if (!nachlauf.pegelNeu && letzte.current.distanceTo(p) < NEUAUFBAU_AB) return;
        nachlauf.pegelNeu = false;
        const anker = p.clone();
        const auswahl = kachelauswahl(kacheln, anker);
        const vorgeladen: THREE.BufferGeometry[] = [];
        const vorladen: KachelVorladen = g => {
          if (!upload.current?.ladeGrossenPuffer(g)) return false;
          vorgeladen.push(g);
          return true;
        };
        const arbeit = (function* (): Kachelbau {
          const bodenFreigeben = yield* baue(auswahl, true, anker, vorladen);
          const baenderFreigeben = yield* baender(auswahl, true, anker, vorladen);
          return () => { bodenFreigeben(); baenderFreigeben(); };
        })();
        lauf.current = { anker, arbeit, vorgeladen };
      }
      const freigeben = fülleKachelbau(lauf.current.arbeit, frist);
      if (freigeben) { lauf.current = null; freigeben(); }
      return;
    }
    if (letzte.current.distanceTo(p) < NEUAUFBAU_AB) return;
    fülleKachelbau(baue(kachelauswahl(kacheln, p), false, p), Infinity)?.();
  });

  return <>{stufen.map((g, i) => (
    <mesh key={i} geometry={g} material={material} receiveShadow castShadow />
  ))}</>;
}

function Terrain({ welt, terrain, feld, kacheln, ziel, props, dichte, weite, rand, fenster, senke, strassen, strassenmaske, wiesenbereich }: {
  welt: Weltdaten; terrain: TerrainErgebnis; feld: HoehenFeld;
  strassen?: readonly Strassenkulisse[];
  strassenmaske?: QuerschnittGrasmaske;
  wiesenbereich?: Wiesenbereich;
  /** Gesunkener Pegel am Regentenort nach der Heilung (D241). */
  senke?: Pegelsenke | null;
  kacheln: Kachel[]; ziel: React.RefObject<THREE.Object3D | null>;
  props: PropInstanz[]; dichte: number;
  /** Sichtweitenfaktor (D247, `Qualitaet.weite`). */
  weite: number;
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
  const hofBaeume = useMemo(() => {
    const globalEz = typeof location !== 'undefined' && new URLSearchParams(location.search).get('ezbaum') === '1';
    const rahmen = MILBINGERLICHT_AN && !globalEz ? wiesenbereich?.rahmen : undefined;
    const milbinger = rahmen ? teileMilbingerBaeume(props, [rahmen.x, rahmen.y, rahmen.z, rahmen.w])
      : { rest: props, lokaleBaeume: [] };
    const hof = HOF_GRUEN_AN && !globalEz
      ? teileHofBaeume(milbinger.rest, HOF_UNIFORM.bereit.value ? [HOF_UNIFORM.mitte.value.x, HOF_UNIFORM.mitte.value.y] : null)
      : { rest: milbinger.rest, lokaleBaeume: [] };
    return { ...hof, milbingerBaeume: milbinger.lokaleBaeume };
  }, [props, wiesenbereich]);
  /* Wand, Holz, Fenster, Sockel, Gesims, Tür und Garten stecken als Vertexfarben
     in der Geometrie. Ein Material für alles davon bleibt es trotzdem. */
  const hausMaterial = useMemo(() => baueHausMaterial(wiesenbereich), [wiesenbereich]);
  useEffect(() => () => hausMaterial.dispose(), [hausMaterial]);
  useEffect(() => { (hausMaterial.userData.glut as { value: number }).value = fenster; }, [hausMaterial, fenster]);
  const wasserProbe = useMemo<WasserReflexProbe | null>(() => {
    if (typeof location === 'undefined') return null;
    const parameter = new URLSearchParams(location.search), region = parameter.get('region');
    if (!WASSERREFLEX_AN || (region && region !== 'oental')) return null;
    return { karte: { value: null }, mitte: { value: new THREE.Vector3() }, bereit: { value: 0 } };
  }, []);
  const wasserMaterial = useMemo(() => baueWasserMaterial(false,
    typeof location !== 'undefined' && new URLSearchParams(location.search).get('wasser') === 'physikalisch',
    'band', wasserProbe), [wasserProbe]);
  useWasserUmgebung(wasserMaterial);
  const fallMaterial = useMemo(() => baueWasserMaterial(true), []);
  const wegMaterial = useMemo(() => baueWegMaterial(), []);
  const wind = useMemo(() => baueWindMaterial({
    amplitude: 0.55, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke,
  }), []);
  /**
   * Farn (D212): eigener Wind ohne Saum. Mit Normalen nach oben ist `1 - |N·V|` kein Rand, sondern
   * nur der Blickwinkel — auf dem dunklen Farn lag der Saum als grauer Schleier über der ganzen
   * Pflanze (Render 08.10.2026). Dafür Durchlass: Wedel leuchten im Gegenlicht.
   *
   * D229: Seit den Scan-Farnen texturiert — `farn-farbe.webp` ist Modulation (Mittel 0,5) mit Alpha,
   * der Farbton kommt als `color` aus der Palette (×2 hebt das Mittel 0,5 auf 1), keine Vertexfarben.
   */
  const farnWind = useMemo(() => baueWindMaterial({
    amplitude: 0.2, randFarbe: new THREE.Color(0, 0, 0), randStaerke: 0, durchlass: 0.35,
  }, scanBasis('farn', 'farn', true)), []);

  /**
   * Blender-Baeume (D155): derselbe Wind, aber glatt schattiert (die Blattmassen tragen Normalen),
   * Loecher im Laub (`COLOR_0.a` = Laubmaske) und Durchlass fuer das Gegenlicht — dasselbe Rezept
   * wie die Bauwerke, nur als Instanz. Der Saum bleibt schwach: Klumpen mit Loechern sind lauter Kanten.
   */
  // D364: Rinde je Art (Scan-Albedo, Normale, Rauheit, Moos) — Buche und Fichte darum immer zwei Materialien.
  // D367: `ueberblend` gibt die Mittelstufe im Band vor der Impostor-Grenze nach einem Raster ab.
  const baumWerte = (bueschel: THREE.Texture | undefined, rinde: RindenArt) => ({
    amplitude: 0.55, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke * 0.2,
    // Schaerfe 3 -> 10 (D160): Auf Blattmassen aus kleinen Kugeln ist `1 - |N·V|` fast ueberall hoch,
    // der Saum lag deshalb als heller Flaum ueber der ganzen Krone statt als Kante — gemessen am
    // Stauwehr 30 % der Bildhelligkeit (Median 0,100 -> 0,069 ohne Saum). Kreaturen und Figur behalten
    // ihre weichen 1,6: dort ist die Flaeche gross und die Silhouette wirklich ein Rand.
    randSchaerfe: 10,
    loecher: 0.42, loecherSkala: 9, durchlass: 0.45, rinde, bueschel, ueberblend: BAUM_UEBERBLEND,
  });
  const baumBasis = () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  // D283 (`?laub=2`): Buchen bekommen den Laub-, Fichten den Nadel-Büschelatlas — darum zwei Materialien.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  /**
   * D289: Büsche mit Büschelatlas (D283) — eigenes Material ohne Löcher. Auf dem Baum-Material (Löcher für die ganze
   * Fläche, weil Büsche keine Laubmaske tragen) verschwand der Busch im Dorf-Prüfbild fast ganz (D285).
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const buschWind = useMemo(() => LAUB_FEIN ? baueWindMaterial({
    amplitude: 0.55, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke * 0.5, durchlass: 0.3,
    bueschel: bueschelTextur('laub'),
  }, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.9, metalness: 0 })) : null, []);
  const baumWind = useMemo(() => baueWindMaterial(baumWerte(LAUB_FEIN ? bueschelTextur('laub') : undefined, 'buche'), baumBasis()), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const baumWindNadel = useMemo(() => baueWindMaterial(baumWerte(LAUB_FEIN ? bueschelTextur('nadel') : undefined, 'fichte'), baumBasis()), []);
  useEffect(() => {
    wind.setzeRand(new THREE.Color(rand.farbe), rand.staerke);
    baumWind.setzeRand(new THREE.Color(rand.farbe), rand.staerke * 0.2);
    if (baumWindNadel !== baumWind) baumWindNadel.setzeRand(new THREE.Color(rand.farbe), rand.staerke * 0.2);
    buschWind?.setzeRand(new THREE.Color(rand.farbe), rand.staerke * 0.5);
  }, [wind, baumWind, baumWindNadel, buschWind, rand]);

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
    farnWind.setzeZeit(uhr.current);
    if (HOF_GRUEN_AN) setzeHofStrauchZeit(uhr.current);
    baumWind.setzeZeit(uhr.current);
    if (baumWindNadel !== baumWind) baumWindNadel.setzeZeit(uhr.current);
    buschWind?.setzeZeit(uhr.current);
  });
  /**
   * Bänder einmal zerlegen, dann je Kachel bauen.
   *
   * Die Zerlegung kostet einen Durchlauf über 42.000 Wegteile und 9.000 Bachteile
   * und passiert genau einmal je Welt. Was danach je Kachel gebaut wird, ist ein
   * Bruchteil davon — und es fällt weg, sobald die Kachel außer Sicht gerät.
   */
  const satz = useMemo(() => {
    const zustand = strassen && new Map(strassen.flatMap(s => s.wege.map(w => [w.osmWeg, w] as const)));
    return zerlegeBaender(welt, feld, zustand);
  }, [welt, feld, strassen]);
  const nachlauf = useMemo<Kachelnachlauf>(() => ({ bodenFertig: false, baenderFertig: false, pegelNeu: false }), [feld, satz]);
  const reflexMitte = useMemo(() => {
    if (!wasserProbe) return null;
    // Naechster wirklicher liegender Bachabschnitt zur registrierten Wehrmitte;
    // hoehe folgt dem real erzeugten Wasserspiegel, nicht dem Bauwerksursprung.
    let beste = 100 * 100, x = 0, z = 0, gefunden = false;
    for (const teile of satz.baeche.values()) for (const b of teile) {
      const dx = b.bx - b.ax, dz = b.bz - b.az, laengeQ = dx * dx + dz * dz;
      const t = laengeQ ? THREE.MathUtils.clamp(((1110 - b.ax) * dx + (871 - b.az) * dz) / laengeQ, 0, 1) : 0;
      const px = b.ax + t * dx, pz = b.az + t * dz;
      const abstandQ = (px - 1110) ** 2 + (pz - 871) ** 2;
      if (abstandQ < beste) { beste = abstandQ; x = px; z = pz; gefunden = true; }
    }
    return gefunden ? new THREE.Vector3(x, spiegelAufFlaeche(feld, x, z) + 0.06, z) : null;
  }, [feld, satz, wasserProbe]);

  return (
    <group>
      {wasserProbe && reflexMitte && <WasserSzeneProbe probe={wasserProbe} mitte={reflexMitte} ziel={ziel} />}
      <LodTerrain feld={feld} kacheln={kacheln} ziel={ziel} nachlauf={nachlauf} wiesenbereich={wiesenbereich} />
      {STREU_AN && <StreuSchicht hoeheAn={aufBoden.hoeheAn} biomAn={terrain.biomAn} ziel={ziel} props={props} />}
      {BODEN_AN && <BodenSchicht hoeheAn={aufBoden.hoeheAn} biomAn={terrain.biomAn} ziel={ziel} props={props} />}

      <LodBaender welt={welt} feld={feld} satz={satz} kacheln={kacheln} ziel={ziel} nachlauf={nachlauf}
                  boden={aufBoden}
                  wegMaterial={wegMaterial} wasserMaterial={wasserMaterial}
                  fallMaterial={fallMaterial} hausMaterial={hausMaterial} senke={senke ?? null} />
      {strassen && <Strassenkulissen welt={welt} feld={feld} abschnitte={strassen} />}

      {!istAus('fels') && klippen.length > 0 && (
        <Klippen klippen={klippen} ziel={ziel} material={wind.material} />)}

      {[{ props: hofBaeume.rest, hofBaum: false, milbingerBaum: false }, { props: hofBaeume.lokaleBaeume, hofBaum: true, milbingerBaum: false },
        { props: hofBaeume.milbingerBaeume, hofBaum: true, milbingerBaum: true }]
        .filter(g => g.props.length > 0).map(g => <Props key={g.milbingerBaum ? 'milbinger' : String(g.hofBaum)}
          props={g.props} hofBaum={g.hofBaum} milbingerBaum={g.milbingerBaum}
          wind={wind.material} farnWind={farnWind.material}
          baumWind={baumWind.material} baumTiefe={baumWind.tiefe} baumWindNadel={baumWindNadel.material}
          baumTiefeNadel={baumWindNadel.tiefe} buschWind={buschWind?.material} weite={LOOK_FELS_AN ? Math.min(weite, LOOK_FELS_PROPWEITE) : weite} />)}
      <Streuschicht feld={feld} ziel={ziel} dichte={dichte} />
      {!istAus('teppich') && <Grasteppich welt={welt} feld={feld} ziel={ziel} dichte={dichte} weite={weite}
        strassenmaske={strassenmaske} wiesenbereich={wiesenbereich} />}
      {GEWAESSER_ECHT && <Spiegelung feld={feld} />}
    </group>
  );
}

function Strassenkulissen({ welt, feld, abschnitte }: {
  welt: Weltdaten; feld: HoehenFeld; abschnitte: readonly Strassenkulisse[];
}) {
  const kulissen = useMemo(() => baueStrassenkulissen(welt, feld, abschnitte), [welt, feld, abschnitte]);
  useEffect(() => () => { for (const s of kulissen) s.entsorge(); }, [kulissen]);
  useFrame(({ camera }) => {
    const { x, z } = camera.position;
    for (const { gruppe, grenzen } of kulissen) {
      const dx = Math.max(0, grenzen.min.x - x, x - grenzen.max.x);
      const dz = Math.max(0, grenzen.min.z - z, z - grenzen.max.z);
      gruppe.visible = dx * dx + dz * dz < 240 * 240;
    }
  });
  return <>{kulissen.map(({ gruppe }) => <primitive key={gruppe.uuid} object={gruppe} />)}</>;
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
                     wegMaterial, wasserMaterial, fallMaterial, hausMaterial, senke, nachlauf }: {
  senke: Pegelsenke | null;
  welt: Weltdaten; feld: HoehenFeld; satz: Bandsatz; kacheln: Kachel[];
  ziel: React.RefObject<THREE.Object3D | null>;
  boden: ReturnType<typeof aufsatzboden>;
  wegMaterial: THREE.Material; wasserMaterial: THREE.Material;
  fallMaterial: THREE.Material; hausMaterial: THREE.Material;
  nachlauf: Kachelnachlauf;
}) {
  const cache = useRef(new Map<string, THREE.BufferGeometry | null>());
  const letzte = useRef(new THREE.Vector3(NaN, NaN, NaN));
  const hausPuffer = useRef<Kachelpuffer>(new Map());
  /** D358: Efeukarten je Hauskachel; `stand` zählt Änderungen, die Schicht baut danach neu. */
  const efeuKarten = useRef({ je: new Map<string, EfeuKarte[]>(), stand: 0 });
  const bandPuffer = useRef(new Map<string, { quellen: THREE.BufferGeometry[]; geometrien: THREE.BufferGeometry[] }>());
  const [teile, setTeile] = useState<{ weg: THREE.BufferGeometry[];
                                       wasser: THREE.BufferGeometry[];
                                       fall: THREE.BufferGeometry[];
                                       haus: THREE.BufferGeometry[] }>(
    { weg: [], wasser: [], fall: [], haus: [] });
  const angezeigt = useRef(teile);
  useEffect(() => {
    if (!KACHELNACHLAUF_AN) return;
    entsorgeErsetzteKacheln(Object.values(angezeigt.current).flat(), Object.values(teile).flat());
    angezeigt.current = teile;
  }, [teile]);

  /**
   * Häuser einer Kachel. Sie hängen nicht an der LOD-Stufe — ein Haus ist ein
   * Körper, kein Aufsatz — aber sie fallen mit der Entfernung weg, und genau
   * darum geht es: 214.000 Dreiecke lagen vorher in einem Mesh, das gezeichnet
   * wurde, sobald ein Zipfel der Region im Bild war.
   */
  /**
   * D289: Bewohnte Orte (Bewohner und Zufluchten aus `content/orte`) in Weltmetern — um sie herum stehen die Häuser
   * in Verfallsstufe 0 (Bauwelt D287). Aus den Inhalten, nicht hartkodiert.
   */
  const bewohnt = useMemo(() => [...ORTE.values()]
    .filter(o => o.art === 'bewohner' || o.art === 'zuflucht')
    .map(o => nachMetern(o.ort, welt.bbox)), [welt]);
  const fassaden = useMemo(() => [...FASSADEN.values()].filter(f => f.region === 'oental'), []);
  const hausnutzung = useMemo(() => WESTVERFALL_AN
    ? [...REGIONEN.values()].find(r => r.bbox.every((wert, i) => wert === welt.bbox[i]))?.hausnutzung
    : undefined, [welt]);
  const hofHaeuser = useMemo(() => HOF_HAEUSER_AN
    ? bestimmeHofhaeuser(welt, boden, bestimmeHof(welt, boden)) : null, [welt, boden]);
  const hofbauRegion = useMemo(() => HOFBAU_AN
    ? [...REGIONEN.values()].find(r => r.bbox.every((wert, i) => wert === welt.bbox[i]))?.id : undefined, [welt]);
  const hofbauErsetzt = useMemo(() => hofbauRegion ? ersetzteGebaeude(hofbauRegion) : new Set<number>(), [hofbauRegion]);
  const hausKachel = useMemo(() => (
    _feld: HoehenFeld, s: Bandsatz, k: Kachel, _lod: number,
  ) => {
    if (istAus('haeuser')) return null;
    const alle = s.gebaeude.get(`${k.ix}:${k.iz}`);
    // D363: Gebäude mit Hof-Baukasten-Modell baut das Spiel nicht selbst.
    const indizes = hofbauErsetzt.size ? alle?.filter(i => !hofbauErsetzt.has(i)) : alle;
    if (!indizes?.length) return null;
    // D290: LoD2-Silhouette je Gebäude (gleiche Reihenfolge wie `welt.gebaeude`; nur für die Region, zu der die Datei passt).
    const lod2 = LOD2_DATEN.length === welt.gebaeude.length ? LOD2_DATEN : null;
    const karten: EfeuKarte[] = [];
    if (EFEUKARTEN_AN) setzeEfeuSammler(kk => { karten.push(kk); });
    const geb = baueGebaeude(welt, boden, indizes.map(i => {
      const g = welt.gebaeude[i];
      // D291: Fassaden-Steckbrief, dessen Punkt im Grundriss liegt.
      const fassade = fassaden.find(f => imPolygon(f.ort, g.punkte)) ?? null;
      const nutzung = hausnutzung?.find(n => imPolygon(n.ort, g.punkte));
      return lod2 || fassade || nutzung ? { ...g, lod2: lod2 ? lod2[i] : g.lod2, fassade, hausnutzung: nutzung } : g;
    }), bewohnt, hofHaeuser ?? (REFERENZHAUS_AN && HOF_UNIFORM.bereit.value ? {
      mitte: HOF_UNIFORM.mitte.value.toArray(),
      vorne: [-HOF_UNIFORM.achse.value.y, HOF_UNIFORM.achse.value.x],
    } : undefined));
    if (EFEUKARTEN_AN) {
      setzeEfeuSammler(null);
      efeuKarten.current.je.set(`${k.ix}:${k.iz}`, karten);
      efeuKarten.current.stand++;
    }
    return geb;
  }, [welt, boden, bewohnt, fassaden, hausnutzung, hofHaeuser, hofbauErsetzt]);

  /** Wasser mit gesunkenem Pegel (D241); der Zustand steht im Cache-Schlüssel. */
  const wasserKachel = useMemo(() => (
    f: HoehenFeld, s: Bandsatz, k: Kachel, lod: number,
  ) => {
    const g = baueWasserKachel(f, s, k, lod);
    return g && senke ? senkePegel(g, senke) : g;
  }, [senke]);
  const pegel = senke ? `:${senke.x}:${senke.z}` : '';
  // Pegel gewechselt (Heilung): sofort neu sammeln, nicht erst nach dem nächsten Schritt.
  useEffect(() => {
    letzte.current.set(NaN, NaN, NaN);
    if (nachlauf.baenderFertig) nachlauf.pegelNeu = true;
  }, [pegel, nachlauf]);

  const baue: BereiteKacheln = function* (auswahl, gestaffelt, anker, vorladen) {
    let budget = 12;
    const hausGruppen: Kachelsammlung = new Map();
    const sammeln = { weg: [] as THREE.BufferGeometry[],
                      wasser: [] as THREE.BufferGeometry[],
                      fall: [] as THREE.BufferGeometry[],
                      haus: [] as THREE.BufferGeometry[] };
    // D289: nächste Kacheln zuerst. In Rasterreihenfolge kamen die Kacheln am Spieler bei wenigen Bildern je Sekunde
    // als letzte an die Reihe (Budget 12 je Bild) — Häuser und Wege vor der Nase fehlten minutenlang, ferne standen.
    const arten = [
      ['weg', baueWegKachel], ['wasser', wasserKachel], ['fall', baueFallKachel],
      ['haus', hausKachel], ['garten', baueGartenKachel],
    ] as const;
    const ohneWasser = istAus('wasser'), ohneWege = istAus('wege');
    for (const { kachel: k, lod } of auswahl) {
      const id = `${k.ix}:${k.iz}`;
      for (const [art, bauen] of arten) {
        if (art === 'wasser' && ohneWasser) continue;
        if (art === 'weg' && ohneWege) continue;
        const stufe = KACHELPUFFER_AN && art === 'haus' ? 0 : lod;
        const schluessel = `${art}:${id}:${stufe}${art === 'wasser' ? pegel : ''}`;
        let g = cache.current.get(schluessel);
        if (g === undefined) {
          // `null` heißt „hier liegt nichts" und wird genauso gemerkt wie eine
          // Geometrie — sonst probiert jede Neubewertung die leeren Kacheln erneut,
          // und das sind die meisten.
          if (gestaffelt) {
            const hatQuelle = art === 'weg' ? satz.wege.has(id)
              : art === 'wasser' ? satz.baeche.has(id) || satz.teiche.has(id)
              : art === 'fall' ? satz.faelle.has(id)
              : art === 'haus' ? satz.gebaeude.has(id) : satz.gaerten.has(id);
            if (!hatQuelle) continue;
          } else if (budget-- <= 0) continue;
          g = bauen(feld, satz, k, lod);
          // Vor dem Cache, auch für Gärten: mergeGeometries verlangt einheitliche Indizes.
          // Normalen sind bereits fertig; nur vollständig identische Eckattribute teilen Speicher.
          if (g && HAUS_KOMPAKT_AN && (art === 'haus' || art === 'garten')) {
            const roh=g;g=indexiereHausGeometrie(roh);if(g!==roh)roh.dispose();
          }
          cache.current.set(schluessel, g);
          if (gestaffelt && g) yield;
        }
        // Gärten teilen sich das Material mit den Häusern: beides Vertexfarbe,
        // beides undurchsichtig, beides derselbe Draw Call je Kachelgruppe.
        if (!g) continue;
        // Gartenhöhen wechseln mit dem Gelände-LOD. Feste Häuser behalten ihren
        // GPU-Puffer auch dann, wenn nur die Zaun- und Beetgeometrie ersetzt wird.
        if (KACHELPUFFER_AN && (art === 'haus' || art === 'garten')) {
          sammleKachel(hausGruppen, k, g, HOF_BILDFLUSS_AN || FELS_BILDTAKT_AN ? art : 'haus');
        }
        else sammeln[art === 'garten' ? 'haus' : art].push(g);
      }
    }

    if (budget >= 0) { meldeFertig('baender'); nachlauf.baenderFertig = true; }

    const fassen = (gs: THREE.BufferGeometry[]) =>
      gs.length ? [mergeGeometries(gs, false)].filter(Boolean) as THREE.BufferGeometry[] : [];
    const hausNeu = !KACHELPUFFER_AN ? hausPuffer.current
      : gestaffelt ? yield* bereiteKachelpuffer(hausPuffer.current, hausGruppen, vorladen, HOF_BILDSPITZEN_AN || FELS_BILDTAKT_AN)
      : aktualisiereKachelpuffer(hausPuffer.current, hausGruppen);
    const haus = KACHELPUFFER_AN ? geometrienAusKachelpuffern(hausNeu) : fassen(sammeln.haus);
    const baenderNeu = new Map<string, { quellen: THREE.BufferGeometry[]; geometrien: THREE.BufferGeometry[] }>();
    const neu = { weg: [] as THREE.BufferGeometry[], wasser: [] as THREE.BufferGeometry[],
                  fall: [] as THREE.BufferGeometry[], haus };
    for (const art of ['weg', 'wasser', 'fall'] as const) {
      const quellen = sammeln[art];
      const alt = bandPuffer.current.get(art);
      // Die Reihenfolge gehört zum Puffer: Transparente Bänder behalten die bisherige Dreieckfolge.
      const gleich = KACHELNACHLAUF_AN && alt && alt.quellen.length === quellen.length
        && quellen.every((g, i) => g === alt.quellen[i]);
      const geometrien = gleich ? alt.geometrien : fassen(quellen);
      neu[art] = geometrien;
      baenderNeu.set(art, { quellen, geometrien });
      if (gestaffelt && !gleich && geometrien.length) {
        yield;
        if (vorladen?.(geometrien[0])) yield;
      }
    }
    return () => {
      letzte.current.copy(anker);
      if (budget < 0) letzte.current.set(NaN, NaN, NaN);
      hausPuffer.current = hausNeu;
      bandPuffer.current = baenderNeu;
      if (KACHELNACHLAUF_AN) setTeile(neu);
      else setTeile(vorher => {
        entsorgeErsetzteKacheln(Object.values(vorher).flat(), Object.values(neu).flat());
        return neu;
      });
    };
  };
  useEffect(() => {
    if (!KACHELNACHLAUF_AN) return;
    nachlauf.baender = baue;
    return () => { if (nachlauf.baender === baue) nachlauf.baender = undefined; };
  }, [nachlauf, baue]);

  useFrame(() => {
    if (KACHELNACHLAUF_AN && nachlauf.bodenFertig && nachlauf.baenderFertig && nachlauf.baender) return;
    const p = ziel.current?.position;
    if (!p || letzte.current.distanceTo(p) < NEUAUFBAU_AB) return;
    fülleKachelbau(baue(kachelauswahl(kacheln, p), false, p), Infinity)?.();
  });

  return <>
    {teile.weg.map((g, i) => <mesh key={`w${i}`} geometry={g} material={wegMaterial} receiveShadow />)}
    {teile.wasser.map((g, i) => <mesh key={`b${i}`} geometry={g} material={wasserMaterial} />)}
    {teile.fall.map((g, i) => <mesh key={`f${i}`} geometry={g} material={fallMaterial} />)}
    {teile.haus.map((g, i) => (
      <mesh key={`h${i}`} geometry={g} material={hausMaterial} castShadow receiveShadow />
    ))}
    {EFEUKARTEN_AN && <EfeuKartenSchicht quelle={efeuKarten} />}
    {hofbauRegion && <HofbauSchicht region={hofbauRegion} welt={welt} boden={boden} />}
  </>;
}

/** D363: Höfe aus dem Hof-Baukasten (`content/hofbauten.json`) an ihren Grundrissen. */
function HofbauSchicht({ region, welt, boden }: { region: string; welt: Weltdaten; boden: ReturnType<typeof aufsatzboden> }) {
  const gruppe = useRef<THREE.Group>(null);
  useEffect(() => {
    if (!gruppe.current) return;
    return ladeHofbauten(hofbauLagen(region, welt, boden), gruppe.current);
  }, [region, welt, boden]);
  return <group ref={gruppe} />;
}

/** D361: Bodenstreu-Karten im Umkreis von 45 m; neu gelegt, wenn die Figur 15 m gewandert ist. */
const STREU_RADIUS = 45, STREU_NEU_AB = 15;
let streuMaterial: THREE.MeshStandardMaterial | null = null;

function StreuSchicht({ hoeheAn, biomAn, ziel, props }: {
  hoeheAn: (x: number, z: number) => number; biomAn: TerrainErgebnis['biomAn'];
  ziel: React.RefObject<THREE.Object3D | null>; props: PropInstanz[];
}) {
  // D362/D366: Bäume legen unter ihrer Krone eine geschlossene Decke ihrer Art.
  const baeume = useMemo(() => baumRaster(streuBaeume(props)), [props]);
  const cache = useMemo<StreuCache | undefined>(() => FELS_BILDTAKT_AN ? {} : undefined, [baeume, biomAn, hoeheAn]);
  const [matrizen, setMatrizen] = useState<THREE.Matrix4[][]>([[], [], [], []]);
  const mitte = useRef<THREE.Vector2 | null>(null), zuletzt = useRef(0);
  const geometrien = useMemo(() => [0, 1, 2, 3].map(kachelGeometrie), []);
  useEffect(() => () => geometrien.forEach(g => g.dispose()), [geometrien]);
  if (!streuMaterial) {
    streuMaterial = kartenMaterial('streu', 0.55, true);
    // D362: weicher Rand statt Ausstanzkante — mit MSAA wird die Deckung über die Abtastpunkte verteilt.
    streuMaterial.alphaToCoverage = true;
  }
  useFrame(() => {
    const p = ziel.current?.position, jetzt = performance.now();
    if (!p || jetzt - zuletzt.current < 500) return;
    zuletzt.current = jetzt;
    if (mitte.current && mitte.current.distanceTo(new THREE.Vector2(p.x, p.z)) < STREU_NEU_AB) return;
    mitte.current = new THREE.Vector2(p.x, p.z);
    setMatrizen(streuMatrizen(p.x, p.z, STREU_RADIUS, hoeheAn, biomAn, baeume, cache));
  });
  return <>{matrizen.map((liste, i) => liste.length > 0 && (
    <instancedMesh key={`${i}:${liste.length}:${liste[0].elements[12].toFixed(1)}`} args={[geometrien[i], streuMaterial!, liste.length]}
      receiveShadow frustumCulled={false}
      ref={m => { if (m) { liste.forEach((mat, j) => m.setMatrixAt(j, mat)); m.instanceMatrix.needsUpdate = true; } }} />
  ))}</>;
}

/**
 * D366: Bodenpflanzen-Karten (Sauerklee, Waldmeister, Moos, Kräuter liegend; Brombeere, Jungwuchs stehend) im
 * Nahbereich. Gebaut bis `BODEN_NAH` + 8 m, neu gelegt nach 8 m Weg — die Ausblendung im Shader (ab 75 % von
 * `BODEN_NAH`) liegt damit immer innerhalb des gebauten Kreises.
 */
let bodenFlachMaterial: THREE.MeshStandardMaterial | null = null;
let bodenBuschMaterial: THREE.MeshStandardMaterial | null = null;

function BodenSchicht({ hoeheAn, biomAn, ziel, props }: {
  hoeheAn: (x: number, z: number) => number; biomAn: TerrainErgebnis['biomAn'];
  ziel: React.RefObject<THREE.Object3D | null>; props: PropInstanz[];
}) {
  const baeume = useMemo(() => baumRaster(streuBaeume(props)), [props]);
  const zellcache = useMemo(() => FELS_BILDTAKT_AN ? new Map() as BodenpflanzenCache : undefined,
    [baeume, biomAn, hoeheAn]);
  const [matrizen, setMatrizen] = useState<BodenMatrizen>({ flach: [[], [], [], []], busch: [[], [], [], []] });
  const mitte = useRef<THREE.Vector2 | null>(null), zuletzt = useRef(0);
  const geometrien = useMemo(() => ({ flach: [0, 1, 2, 3].map(flachGeometrie), busch: [0, 1, 2, 3].map(buschGeometrie) }), []);
  useEffect(() => () => [...geometrien.flach, ...geometrien.busch].forEach(g => g.dispose()), [geometrien]);
  bodenFlachMaterial ??= bodenMaterial('bodenflach');
  bodenBuschMaterial ??= bodenMaterial('bodenbusch');
  useFrame(() => {
    const p = ziel.current?.position, jetzt = performance.now();
    if (!p || jetzt - zuletzt.current < 500) return;
    zuletzt.current = jetzt;
    if (mitte.current && mitte.current.distanceTo(new THREE.Vector2(p.x, p.z)) < 8) return;
    mitte.current = new THREE.Vector2(p.x, p.z);
    setMatrizen(bodenMatrizen(p.x, p.z, BODEN_NAH + 8, hoeheAn, biomAn, baeume, zellcache));
  });
  const schicht = (art: 'flach' | 'busch', material: THREE.MeshStandardMaterial) => matrizen[art].map((liste, i) => liste.length > 0 && (
    <instancedMesh key={`${art}${i}:${liste.length}:${liste[0].elements[12].toFixed(1)}`} args={[geometrien[art][i], material, liste.length]}
      receiveShadow frustumCulled={false}
      ref={m => { if (m) { liste.forEach((mat, j) => m.setMatrixAt(j, mat)); m.instanceMatrix.needsUpdate = true; } }} />
  ));
  return <>{schicht('flach', bodenFlachMaterial)}{schicht('busch', bodenBuschMaterial)}</>;
}

/**
 * D358: Efeukarten aller gebauten Hauskacheln als vier InstancedMesh (eine je Atlas-Kachel). Neu gebaut wird nur,
 * wenn eine Hauskachel Karten gemeldet hat — geprüft alle 0,5 s (nach Zeit, nicht nach Bildern: bei niedriger
 * Bildrate kam eine Bildzählung zu spät).
 */
function EfeuKartenSchicht({ quelle }: { quelle: React.RefObject<{ je: Map<string, EfeuKarte[]>; stand: number }> }) {
  const [matrizen, setMatrizen] = useState<THREE.Matrix4[][]>([[], [], [], []]);
  const gesehen = useRef(-1), zuletzt = useRef(0);
  const geometrien = useMemo(() => [0, 1, 2, 3].map(kachelGeometrie), []);
  useEffect(() => () => geometrien.forEach(g => g.dispose()), [geometrien]);
  useFrame(() => {
    const jetzt = performance.now();
    if (jetzt - zuletzt.current < 500 || !quelle.current || quelle.current.stand === gesehen.current) return;
    zuletzt.current = jetzt;
    gesehen.current = quelle.current.stand;
    setMatrizen(kartenMatrizen([...quelle.current.je.values()].flat()));
  });
  return <>{matrizen.map((liste, i) => liste.length > 0 && (
    <instancedMesh key={`${i}:${liste.length}`} args={[geometrien[i], efeuKartenMaterial(), liste.length]} receiveShadow
      castShadow customDepthMaterial={efeuKartenTiefe()} frustumCulled={false}
      ref={m => { if (m) { liste.forEach((mat, j) => m.setMatrixAt(j, mat)); m.instanceMatrix.needsUpdate = true; } }} />
  ))}</>;
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
type FernGruppe = { art: PropArt; variante: number; instanzen: PropInstanz[]; zelle?: string; hofStrauch?: boolean; hofSchatten?: boolean };

/** EZ-Test: Fernbaeume raeumlich gruppieren, damit Frustum-Culling sie nicht alle zeichnet. */
function zellteileFern(gruppen: FernGruppe[]): FernGruppe[] {
  const ergebnis: FernGruppe[] = [];
  for (const gruppe of gruppen) {
    if (gruppe.art !== 'nadelbaum' && gruppe.art !== 'laubbaum') { ergebnis.push(gruppe); continue; }
    const zellen = new Map<string, PropInstanz[]>();
    for (const instanz of gruppe.instanzen) {
      const id = `${Math.floor(instanz.position[0] / 256)}:${Math.floor(instanz.position[2] / 256)}`;
      const liste = zellen.get(id);
      if (liste) liste.push(instanz); else zellen.set(id, [instanz]);
    }
    for (const [zelle, instanzen] of zellen) ergebnis.push({ ...gruppe, zelle, instanzen });
  }
  return ergebnis;
}

function Props({ props, hofBaum = false, milbingerBaum = false, wind, farnWind, baumWind, baumTiefe, baumWindNadel, baumTiefeNadel, buschWind, weite }: { props: PropInstanz[]; hofBaum?: boolean; milbingerBaum?: boolean; wind: THREE.MeshStandardMaterial; farnWind: THREE.MeshStandardMaterial; baumWind: THREE.MeshStandardMaterial; baumTiefe?: THREE.MeshDepthMaterial; baumWindNadel: THREE.MeshStandardMaterial; baumTiefeNadel?: THREE.MeshDepthMaterial; buschWind?: THREE.MeshStandardMaterial; weite: number }) {
  const chunks = useMemo(() => chunkeProps(props), [props]);
  const [sichtbar, setSichtbar] = useState<{ c: PropChunk; stufe: PropStufe; id: string; ohneSchatten: boolean }[]>([]);
  const [fern, setFern] = useState<FernGruppe[]>([]);
  /** D367: Mittelstufen-Bäume im Übergabeband — stehen zusätzlich als Impostor (komplementäres Raster). */
  const [band, setBand] = useState<FernGruppe[]>([]);
  useEffect(() => { BAUM_UEBERBLEND.value.set(ATTRAPPE_AB * weite, UEBERBLEND_BAND); }, [weite]);
  // Messbarer Standard der EZ-Probe; ?ezcluster=0 erhaelt den A/B-Rueckweg.
  const ezZellen = typeof location !== 'undefined' && (new URLSearchParams(location.search).get('ezbaum') === '1' || (HOF_GRUEN_AN && hofBaum)) && new URLSearchParams(location.search).get('ezcluster') !== '0';
  const letzte = useRef(new THREE.Vector3(NaN, NaN, NaN));
  const letzteFern = useRef(new THREE.Vector3(NaN, NaN, NaN));
  /** Kacheln, die im vorigen Durchlauf Attrappen waren — siehe `waehleProps` (D164). */
  const vorigeAttrappen = useRef<ReadonlySet<string> | undefined>(undefined);
  const propAnker = useRef<PropAnkerCache>({ fernschluesselBeiBedarf: HOF_KACHELNACHLAUF_AN || FELS_BILDTAKT_AN });
  // Neue Sichtweite (D247): beide Listen sofort neu, statt auf die nächsten 8/60 m Lauf zu warten.
  useEffect(() => { letzte.current.set(NaN, NaN, NaN); letzteFern.current.set(NaN, NaN, NaN); }, [weite]);

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
    const auswahl = waehleProps(chunks, [p.x, p.z], anker, fernNeu,
      HOF_KACHELNACHLAUF_AN ? undefined : vorigeAttrappen.current, weite,
      HOF_BILDRUHE_AN || FELS_BILDTAKT_AN ? propAnker.current : undefined);
    const { nah, buendel } = auswahl;
    if (!HOF_KACHELNACHLAUF_AN) vorigeAttrappen.current = auswahl.buendelKacheln;

    // Ein neuer Fernanker verschiebt auch die Grenze zwischen Chunk und Bündel.
    // Deshalb beide Listen gemeinsam ersetzen, selbst wenn die letzte 8-m-
    // Nahbewertung erst ein Bild zuvor lief; sonst steht ein Randchunk kurz doppelt.
    if (nahNeu || fernNeu) {
      letzte.current.copy(p);
      // Band: alle Bäume der Mittelstufe, die bis zur nächsten Neubewertung ins Band laufen können.
      const bandAb = ATTRAPPE_AB * weite - UEBERBLEND_BAND - PROP_NEUBEWERTUNG;
      const jeVariante = new Map<string, FernGruppe>();
      for (const { c, stufe } of nah) {
        if (stufe !== 'mittel' || (c.art !== 'laubbaum' && c.art !== 'nadelbaum')) continue;
        for (const q of c.instanzen) {
          if (Math.hypot(q.position[0] - p.x, q.position[2] - p.z) < bandAb) continue;
          const k = `${c.art}:${c.variante}`;
          let g = jeVariante.get(k);
          if (!g) jeVariante.set(k, g = { art: c.art, variante: c.variante, instanzen: [] });
          g.instanzen.push(q);
        }
      }
      setBand([...jeVariante.values()]);
      setSichtbar(nah.map(({ c, stufe }) => ({
        // Die Stufe gehört in den Schlüssel: Seit die Mittelstufe ihre Varianten
        // zusammenlegt (D100), tragen alle zusammengelegten Chunks `variante 0`,
        // und ohne die Stufe könnte ein Nahchunk derselben Kachel mit Variante 0
        // denselben Schlüssel bekommen.
        c, stufe, id: `${c.art}:${c.variante}:${stufe}:${c.mitte[0]}:${c.mitte[1]}`,
        // D464 (`?lookfels=1`): Mittelstufe jenseits von 110 m wirft keinen Schatten — an der Zielbild-Felsmulde waren das
        // 0,58 Mio. Dreiecke im Schattenpass für Schatten hinter Mauern und Kronen. Hysterese über die 8-m-Neubewertung.
        ohneSchatten: LOOK_FELS_AN && stufe !== 'nah' && Math.hypot(c.mitte[0] - p.x, c.mitte[1] - p.z) > ATTRAPPE_AB,
      })));
    }
    if (fernNeu) {
      const gruppen = buendleFernProps(buendel);
      if (!ezZellen) setFern(gruppen);
      else setFern(alt => {
        const vorher = new Map(alt.map(g => [`${g.art}:${g.variante}:${g.zelle ?? ''}:${!!g.hofStrauch}:${!!g.hofSchatten}`, g]));
        return zellteileFern(gruppen).map(g => {
          const v = vorher.get(`${g.art}:${g.variante}:${g.zelle ?? ''}:${!!g.hofStrauch}:${!!g.hofSchatten}`);
          return v && v.instanzen.length === g.instanzen.length && v.instanzen.every((p, i) => p === g.instanzen[i]) ? v : g;
        });
      });
    }
  });

  return (
    <>
      {/* Blender-Baumstufen werden bei Bedarf geladen. Eine eigene Grenze je
          Gruppe verhindert, dass React waehrenddessen Licht und ganze Szene
          ausblendet. Bereits geladene Gruppen bleiben sichtbar. */}
      {sichtbar.map(({ c, stufe, id, ohneSchatten }) =>
        <Suspense key={id} fallback={null}>
          <PropChunkMesh chunk={c} stufe={stufe} ohneSchatten={ohneSchatten} hofBaum={hofBaum} milbingerBaum={milbingerBaum} wind={wind} farnWind={farnWind} baumWind={c.art === 'nadelbaum' ? baumWindNadel : baumWind} baumTiefe={c.art === 'nadelbaum' ? baumTiefeNadel : baumTiefe} buschWind={buschWind} />
        </Suspense>)}
      {fern.map(({ art, variante, instanzen, zelle, hofStrauch, hofSchatten }) =>
        <Suspense key={`${art}:${variante}:${zelle ?? ''}:${hofStrauch ? 'hof' : ''}:${hofSchatten ? 'schatten' : ''}`} fallback={null}>
          <PropFernMesh art={art} variante={variante} hofBaum={hofBaum} milbingerBaum={milbingerBaum} hofStrauch={hofStrauch} hofSchatten={hofSchatten} instanzen={instanzen} zellCulling={zelle !== undefined} />
        </Suspense>)}
      {band.map(({ art, variante, instanzen }) =>
        <Suspense key={`band:${art}:${variante}`} fallback={null}>
          <PropFernMesh art={art} variante={variante} hofBaum={hofBaum} milbingerBaum={milbingerBaum} instanzen={instanzen} zellCulling={false} band />
        </Suspense>)}
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
function PropFernMesh({ art, variante, instanzen, zellCulling, hofBaum = false, milbingerBaum = false, hofStrauch = false, hofSchatten = false, band = false }: { art: PropArt; variante: number; instanzen: PropInstanz[]; zellCulling: boolean; hofBaum?: boolean; milbingerBaum?: boolean; hofStrauch?: boolean; hofSchatten?: boolean; band?: boolean }) {
  // D367: Die Fernstufe der Blender-Bäume ist ein Impostor desselben Nahbaums (acht gebackene Ansichten, zwei
  // Dreiecke je Baum) statt der dezimierten Krone; ohne Registereintrag bleibt die Attrappe.
  const eigen = art === 'nadelbaum' ? 'fichte' : art === 'laubbaum' ? 'buche' : null;
  const blender = eigen ? blenderBaum(eigen, variante, 'fern') : null;
  const rahmen = blender?.impostor ?? null;
  const geo = useMemo(() => {
    if (hofStrauch) return hofStrauchGeometrie(variante, VARIANTEN.busch[variante]?.hoehe ?? 1.2);
    if (!rahmen) return attrappeGeometrie(art);
    return impostorGeometrie(rahmen);
  }, [art, rahmen, hofStrauch, variante]);
  useEffect(() => () => { if (rahmen) geo.dispose(); }, [geo, rahmen]);
  const impMaterial = useMemo(() => blender && rahmen ? impostorMaterial(blender.datei, rahmen, BAUM_UEBERBLEND) : null, [blender, rahmen]);
  const strauchMaterial = useMemo(() => hofStrauch ? hofStrauchMaterial() : null, [hofStrauch]);
  const ref = useRef<THREE.InstancedMesh>(null);
  const [kapazitaet, setKapazitaet] = useState(() => Math.ceil(instanzen.length * 1.4) + 64);
  const setzeMesh = useCallback((mesh: THREE.InstancedMesh | null) => {
    ref.current = mesh;
    if (mesh && !mesh.instanceColor) {
      mesh.count = 0;
      // Auch bei count=0 wählt three.js ein Shaderprogramm. Ein leeres Bündel
      // würde dabei die Variante ohne Instanzfarben erstmals kompilieren.
      if (HOF_BILDFLUSS_AN) mesh.visible = false;
    }
    if (mesh) { mesh.userData.hofGruen = hofBaum; mesh.userData.milbingerBaum = milbingerBaum; mesh.userData.hofStrauch = hofStrauch; mesh.userData.strauchVariante = variante; }
    if (mesh && blender && istEzProbeBereit(hofBaum)) mesh.visible = false;
  }, [blender, hofBaum, milbingerBaum, hofStrauch, variante]);

  useEffect(() => {
    if (instanzen.length > kapazitaet) {
      setKapazitaet(Math.ceil(instanzen.length * 1.4) + 64);
      return;
    }
    const m = ref.current;
    if (!m) return;
    const ezErsetzt = blender && istEzProbeBereit(hofBaum);
    const anfang = !m.instanceColor;
    if (ezErsetzt) m.visible = false;
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
    if (rahmen) {
      // D367: 1 = Instanz im Übergabeband (zeichnet nur das Gegenraster zur Mittelstufe)
      let a = geo.getAttribute('aUeberblend') as THREE.InstancedBufferAttribute | undefined;
      if (!a || a.count < kapazitaet) geo.setAttribute('aUeberblend', a = new THREE.InstancedBufferAttribute(new Float32Array(kapazitaet), 1));
      (a.array as Float32Array).fill(band ? 1 : 0);
      a.needsUpdate = true;
    }
    if (zellCulling || hofStrauch) m.computeBoundingSphere();
    if (HOF_BILDFLUSS_AN && anfang && m.count > 0 && !ezErsetzt) m.visible = true;
  }, [instanzen, kapazitaet, zellCulling, hofBaum, hofStrauch, rahmen, geo, band]);

  return (
    <instancedMesh
      ref={setzeMesh} args={[undefined, undefined, kapazitaet]}
      name={blender ? `baum:${art}:${variante}:fern${band ? ':band' : ''}` : `prop:${art}:fern${hofStrauch ? `:hof:${variante}` : ''}`}
      geometry={geo} material={impMaterial ?? strauchMaterial ?? FERN_MATERIAL}
      receiveShadow={hofStrauch && hofSchatten}
      // Der Bündel umspannt den ganzen Sichtring; ein Frustum-Test daran wäre
      // immer wahr und damit verlorene Zeit.
      frustumCulled={zellCulling || hofStrauch}
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
/**
 * Basis der Scan-Props (D229/D230): Karte und Normale aus `public/material/<textur>-…`. Die Karte ist
 * Modulation (Mittel 0,5) — `color` ist der Palettenton der Art ×2. Mit `alpha` als Ausschnitt und
 * beidseitig (Blattkarten). `?detail=0` lässt die Karten weg — Palettenfläche (Vergleichsschalter).
 */
function scanBasis(textur: string, art: PropArt, alpha: boolean): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.attrappe[art as keyof typeof PALETTE.attrappe]).multiplyScalar(2), roughness: 1, metalness: 0,
    side: alpha ? THREE.DoubleSide : THREE.FrontSide, alphaTest: alpha ? 0.5 : 0, flatShading: false,
  });
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('detail') === '0') {
    m.color.multiplyScalar(0.5);
    return m;
  }
  const lader = new THREE.TextureLoader();
  const karte = (datei: string) => {
    const t = lader.load(`/material/${datei}.webp`);
    t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; t.flipY = false;
    return t;
  };
  m.map = karte(`${textur}-farbe`);
  m.normalMap = karte(`${textur}-normal`);
  if (HOF_AN && ['fels-moos-1', 'fels-moos-2', 'farn'].includes(textur)) richteHofPropEin(m, textur);
  return m;
}

/** Ein Felsen am identischen Platz: existierender Scan oder TripoSR-Ergebnis (D250). */
function FelsVergleich({ art, position }: { art: 'scan' | 'ki'; position: [number, number, number] }) {
  const { scene } = useGLTF(art === 'ki' ? '/vergleich/triposr-fels-d250.glb' : '/props/findling_scan_e.glb');
  const material = useMemo(() => art === 'ki'
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
    : scanBasis('fels-moos-1', 'findling', false), [art]);
  useEffect(() => () => { material.map?.dispose(); material.normalMap?.dispose(); material.dispose(); }, [material]);
  const objekt = useMemo(() => {
    const kopie = scene.clone(true);
    kopie.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry = o.geometry.clone();
      if (!o.geometry.getAttribute('normal')) o.geometry.computeVertexNormals();
      o.material = material; o.castShadow = true; o.receiveShadow = true;
    });
    const box = new THREE.Box3().setFromObject(kopie);
    const mitte = box.getCenter(new THREE.Vector3());
    const faktor = 1.7 / Math.max(0.001, box.max.y - box.min.y);
    kopie.scale.setScalar(faktor);
    kopie.position.set(-mitte.x * faktor, -box.min.y * faktor, -mitte.z * faktor);
    return kopie;
  }, [scene, material]);
  useEffect(() => () => { objekt.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); }, [objekt]);
  return <group position={position}><primitive object={objekt} /></group>;
}

/** Statische Scan-Props (Fels, Holz): ein Material je Textursatz, geteilt über alle Chunks. */
const SCAN_STATISCH = new Map<string, THREE.MeshStandardMaterial>();
function statischesScanMaterial(textur: string, art: PropArt): THREE.MeshStandardMaterial {
  let m = SCAN_STATISCH.get(textur);
  if (!m) { m = scanBasis(textur, art, false); SCAN_STATISCH.set(textur, m); }
  return m;
}

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
  // D367: Die Fernstufe ist ein Impostor ohne Netz; ein Chunk in Fernstufe zeigt die Mittelstufe.
  const blender = eigen ? blenderBaum(eigen, variante, stufe === 'fern' ? 'mittel' : stufe) : null;
  const pfad = propPfad(blender ? blender.datei : ((liste[variante] ?? liste[0])?.datei ?? VARIANTEN.busch[0].datei));
  const { scene } = useGLTF(pfad);
  const normalisiert = useMemo(() => {
    let geo: THREE.BufferGeometry | null = null;
    return () => {
      if (geo) return geo;
      if (eigen && !blender) return geo = baueBaum(eigen, variante, stufe === 'nah' ? 'voll' : 'mittel');
      // Der Blender-Ursprung kann am Kronenzentrum liegen. Beim Herausloesen
      // muss die Knotenmatrix mit: sonst versinkt etwa Fichte 0 um 10,25 m.
      scene.updateMatrixWorld(true);
      const mesh = scene.getObjectByProperty('isMesh', true) as THREE.Mesh | undefined;
      if (!mesh) return geo = propGeometrie(art);
      geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      // Scan-Props und Blender-Bäume bringen ihr Windgewicht als `_WIND` mit.
      const w = geo.getAttribute('_wind');
      if (w) geo.setAttribute('aWind', w);
      else if (eigen) windAusHoehe(geo, geo.boundingBox?.max.y ?? 20);
      // Die Höhe steht in VARIANTEN und ist bereits in die Datei eingerechnet.
      return geo;
    };
  }, [scene, art, eigen, blender, variante, stufe]);
  return { normalisiert, blender: !!(eigen && blender) };
}

const LEER: ReadonlySet<string> = new Set();
const LEERES_PROP_NETZ = new THREE.BufferGeometry();

/** Welche Auflösung ein Chunk gerade zeigt. */
function PropChunkMesh({ chunk, stufe, ohneSchatten = false, hofBaum = false, milbingerBaum = false, wind, farnWind, baumWind, baumTiefe, buschWind }: {
  chunk: PropChunk; stufe: PropStufe; ohneSchatten?: boolean; hofBaum?: boolean; milbingerBaum?: boolean; wind: THREE.MeshStandardMaterial;
  farnWind: THREE.MeshStandardMaterial;
  baumWind: THREE.MeshStandardMaterial; baumTiefe?: THREE.MeshDepthMaterial; buschWind?: THREE.MeshStandardMaterial;
}) {
  const fern = stufe === 'fern';
  const { normalisiert, blender } = useNormiertesPropMesh(chunk.art, chunk.variante, stufe);
  const ezOriginal = HOF_BILDSPITZEN_AN && blender && uebernimmtEzVariante(chunk.variante, hofBaum) ? normalisiert : undefined;
  const hofStrauch = HOF_GRUEN_AN && chunk.art === 'busch' && istHofBusch(chunk.mitte, chunk.radius);
  const strauchBleibt = HOF_STRAUCH_WEIT && hofStrauch;
  const strauchGeo = useMemo(() => hofStrauch ? hofStrauchGeometrie(chunk.variante, VARIANTEN.busch[chunk.variante]?.hoehe ?? 1.2) : null, [hofStrauch, chunk.variante]);
  const strauchMaterial = useMemo(() => hofStrauch ? hofStrauchMaterial() : null, [hofStrauch]);
  const attrappe = fern && !blender && !strauchBleibt;
  const fernGeo = useMemo(() => !HOF_BILDSPITZEN_AN || attrappe ? attrappeGeometrie(chunk.art) : null, [attrappe, chunk.art]);
  const geo = ezOriginal ? LEERES_PROP_NETZ : normalisiert();
  const netz = strauchBleibt ? strauchGeo! : attrappe ? fernGeo! : strauchGeo ?? geo;
  // Nur was sich biegen kann, bekommt das Windmaterial. Findlinge und Totholz
  // schwingen nicht, und ein wackelnder Findling zerstört mehr Glaubwürdigkeit,
  // als bewegtes Laub aufbaut.
  const biegsam = chunk.art === 'nadelbaum' || chunk.art === 'laubbaum' || chunk.art === 'busch';
  /** D230: Scan-Props tragen ihren Textursatz in `VARIANTEN`. */
  const textur = VARIANTEN[chunk.art][chunk.variante]?.textur;
  const ref = useRef<THREE.InstancedMesh>(null);
  const setzeMesh = useCallback((mesh: THREE.InstancedMesh | null) => {
    ref.current = mesh;
    if (mesh && !mesh.instanceColor) {
      mesh.count = 0;
      if (HOF_BILDFLUSS_AN) mesh.visible = false;
    }
    if (mesh) {
      mesh.userData.hofGruen = hofBaum; mesh.userData.milbingerBaum = milbingerBaum; mesh.userData.hofStrauch = hofStrauch; mesh.userData.strauchVariante = chunk.variante;
      mesh.userData.ezOriginalGeometrie = ezOriginal;
    }
    if (mesh && blender && istEzProbeBereit(hofBaum)) mesh.visible = false;
  }, [blender, ezOriginal, hofBaum, milbingerBaum, hofStrauch, chunk.variante]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const ezErsetzt = blender && istEzProbeBereit(hofBaum);
    const anfang = !mesh.instanceColor;
    if (ezErsetzt) mesh.visible = false;
    const m = new THREE.Object3D();
    const ton = new THREE.Color();
    chunk.instanzen.forEach((p, i) => {
      m.position.set(...p.position);
      m.rotation.y = p.drehung;
      m.scale.setScalar(p.skalierung);
      m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);
      // Farbe je Instanz (D79). `setRGB` ohne Farbraum schreibt direkt in den
      // Arbeitsraum — die Werte sind Faktoren um 1,0, keine Farben, und dürfen
      // deshalb nicht durch die sRGB-Umrechnung.
      const [r, g, b] = propTon(p.art, p.variante, p.drehung);
      mesh.setColorAt(i, ton.setRGB(r, g, b));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = chunk.instanzen.length;
    if (!HOF_BILDSPITZEN_AN) mesh.computeBoundingSphere();
    if (HOF_BILDFLUSS_AN && anfang && mesh.count > 0 && !ezErsetzt) mesh.visible = true;
  }, [chunk, hofBaum]);

  // Der Umriss ändert sich beim Wechsel auf die Attrappe; ohne Neuberechnung
  // schneidet das Frustum-Culling falsch.
  useEffect(() => {
    if (!HOF_BILDSPITZEN_AN) ref.current?.computeBoundingSphere();
  }, [fern]);
  useEffect(() => {
    if (HOF_BILDSPITZEN_AN && !ezOriginal) ref.current?.computeBoundingSphere();
  }, [chunk, ezOriginal, netz]);

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
      ref={setzeMesh} args={[undefined, undefined, chunk.instanzen.length]}
      name={blender ? `baum:${chunk.art}:${chunk.variante}:${stufe}` : `prop:${chunk.art}:${stufe}`}
      geometry={netz}
      material={blender ? baumWind : strauchMaterial && (!fern || strauchBleibt) ? strauchMaterial : buschWind && chunk.art === 'busch' && !fern ? buschWind : fern ? FERN_MATERIAL : chunk.art === 'farn' ? farnWind
        : textur ? statischesScanMaterial(textur, chunk.art)
        : (biegsam ? wind : PROP_MATERIAL)}
      customDepthMaterial={blender && !fern ? baumTiefe : undefined}
      castShadow={grossesTeil && !fern && !ohneSchatten} receiveShadow={(!fern || strauchBleibt) && (grossesTeil || (HOF_AN && HOF_UNIFORM.bereit.value > 0 && Math.hypot(chunk.mitte[0] - HOF_UNIFORM.mitte.value.x, chunk.mitte[1] - HOF_UNIFORM.mitte.value.y) < 60))}
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
function Mensch({ figur, blick, gang = 0, farben, ziel, rand, hoeheAn, marke, ausflug, unterwegs = false, melde }: {
  figur: string; blick: number;
  /** Meldet die Weltlage der Figur (D178) — für das Ansprechen. */
  melde?: (x: number, z: number) => void;
  /** Tagesroutine (D177): Weltpunkt, zu dem der Bewohner geht, solange `unterwegs`. */
  ausflug?: [number, number];
  unterwegs?: boolean;
  /** Der Signalpunkt — wandert mit der Figur, nicht mit dem Ort. */
  marke: { geometry: THREE.BufferGeometry; material: THREE.Material };
  /** Länge des Wegstücks entlang `blick` in Metern; 0 = steht. */
  gang?: number;
  farben?: Partial<Record<RollenSlot, string>>;
  ziel: React.RefObject<THREE.Object3D | null>;
  rand: { farbe: string; staerke: number };
  hoeheAn: (x: number, z: number) => number;
}) {
  // D176: Bewohner als leichte Gestalten der neuen Figuren (`*-leicht.glb`), geklont — mehrere
  // Bewohner teilen eine Datei. `?bewohner=alt` zeigt die alten Figuren.
  const hg = BEWOHNER_ALT ? null : bewohnerWahl(figur, blick, farben);
  const g1 = useGLTF(hg ? `/figuren/held/${hg.koerper}-${hg.kleid}-leicht.glb` : `/figuren/${figur}.glb`);
  const g2 = useGLTF(hg ? HELD_CLIPS : `/figuren/${figur}.glb`);
  const scene = useMemo(() => (hg ? klonSkelett(g1.scene) : g1.scene), [g1.scene, !!hg]);
  const animations = hg ? g2.animations : g1.animations;
  const { material, setzeRand, setzeRollen } = useMemo(() => baueWindMaterial({
    amplitude: 0, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke,
  }), []);
  useEffect(() => { setzeRand(new THREE.Color(rand.farbe), rand.staerke); }, [setzeRand, rand]);
  useEffect(() => { setzeRollen(farben ?? null); }, [setzeRollen, farben]);
  const himmelKarte = useHimmelKarte();
  useEffect(() => {
    if (hg) {
      legeWahlAn(scene, hg); setzeFigurUmgebung(scene, himmelKarte);
      return FELS_BILDTAKT_AN ? begrenzeBewohner(scene) : undefined;
    }
    scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.material = material; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
    });
  }, [scene, material, himmelKarte]);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const clips = useMemo(() => {
    const finde = (n: string) => animations.find(c => c.name === n) ?? animations[0];
    // Neue Figuren: Arme verschränkt statt Idle_Neutral, ein Nicken statt Winken (UAL2).
    const idle = mixer.clipAction(finde('Idle')), ruhig = mixer.clipAction(finde(hg ? 'Idle_Ruhig' : 'Idle_Neutral'));
    const wink = mixer.clipAction(finde(hg ? 'Gruss' : 'Wave')), walk = mixer.clipAction(finde('Walk'));
    wink.setLoop(THREE.LoopOnce, 1); wink.clampWhenFinished = false;
    walk.timeScale = MENSCH_WALK_RATE;
    return { idle, ruhig, wink, walk, aktiv: idle as THREE.AnimationAction };
  }, [mixer, animations]);
  // G-137: Idle im Effekt starten, nicht im useMemo — siehe `SpielerFigur`.
  useEffect(() => {
    clips.idle.reset().play(); clips.aktiv = clips.idle;
    return () => { mixer.stopAllAction(); };
  }, [mixer, clips]);
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
  const ausflugRef = useRef({ t: 0 });
  // D217: Füsse auf den Boden auch für Bewohner — nur in der Nähe (Kosten je Figur und Bild).
  const fuss = useRef<FussZustand>(neuerFussZustand());
  const fussBeine = useMemo(() => {
    if (!hg) return null;
    const h = (n: keyof typeof HELD_KNOCHEN) => scene.getObjectByName(HELD_KNOCHEN[n]) ?? null;
    return { ol: h('ol'), ul: h('ul'), fl: h('fl'), or: h('or'), ur: h('ur'), fr: h('fr') };
  }, [scene, !!hg]);
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

      // Tagesroutine (D177): Anteil des Weges zum Ausflugsziel, 0 = zu Hause, 1 = dort.
      const aus = ausflugRef.current;
      if (ausflug && g.parent) {
        const heim = g.parent.getWorldPosition(new THREE.Vector3());
        const dx = ausflug[0] - heim.x, dz = ausflug[1] - heim.z, weite = Math.hypot(dx, dz) || 1;
        const soll = unterwegs ? 1 : 0;
        if (aus.t !== soll) {
          const alt = aus.t;
          aus.t += Math.sign(soll - aus.t) * Math.min(Math.abs(soll - aus.t), MENSCH_TEMPO * EILE * dt / weite);
          if (!w.winkt && clips.aktiv !== clips.walk) wechsle(clips.walk, 0.3);
          if (wurzelY.current === null) wurzelY.current = heim.y;
          const x = dx * aus.t, z = dz * aus.t;
          g.position.set(x, hoeheAn(heim.x + x, heim.z + z) - wurzelY.current, z);
          g.rotation.y = Math.atan2(-(dx * Math.sign(aus.t - alt)), -(dz * Math.sign(aus.t - alt)));
          if (aus.t === soll && !w.winkt) {
            wechsle(clips.idle, 0.4);
            if (soll === 0) g.rotation.y = THREE.MathUtils.degToRad(blick);
          }
        } else if (aus.t === 1 && !w.winkt) {
          // Dort angekommen: zum Wirt gedreht, ruhig stehen.
          if (clips.aktiv === clips.walk) wechsle(clips.ruhig, 0.4);
        }
      }
      // Wegstück: stehen (Pause) → gehen → stehen, das Winken hält an.
      if (!w.winkt && aus.t === 0) {
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
      if (gang > 0 && aus.t === 0) {
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
    if (fussBeine && FUESSE_AN && g && p) {
      const wp = g.getWorldPosition(_meldeV);
      const nah = Math.hypot(p.x - wp.x, p.z - wp.z) < BEWOHNER_FUSS_AB;
      if (nah || fuss.current.an > 0) setzeFuesse(fussBeine, scene, hoeheAn, fuss.current, dt, nah);
    }
    if (melde && g) { const wp = g.getWorldPosition(_meldeV); melde(wp.x, wp.z); }
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
  /** Tagesroutine (D177/D375): ID des Orts, zu dem der Bewohner abends geht. */
  abends?: string;
}

/**
 * D285 (`?umlicht=1`): Umgebungslicht aus dem eigenen Himmel. Eine Kopie der Himmelskugel und eine Bodenscheibe
 * im Hemisphären-Bodenton (Gegenlicht vom Gelände statt Himmel von unten) werden einmal je Stimmung in eine
 * PMREM-Karte gerendert und als `scene.environment` gesetzt. Die Hemisphäre bleibt mit 35 % für die eigenen
 * Shader, die keine Umgebungskarte lesen.
 */
function HimmelLicht({ s }: { s: Stimmung }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const werte = {
      zenit: s.zenit, horizont: s.horizont, dunst: s.nebel, sonne: s.sonne,
      sonnenstand: s.sonnenstand, scheibe: s.scheibe, hof: s.hof, wolken: s.wolken,
      atmosphaere: s.atmosphaere,
    };
    const himmel = baueHimmel(werte);
    setzeHimmel(himmel, werte);
    const boden = new THREE.Mesh(new THREE.CircleGeometry(400, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(HEMIBODEN_MESSLAUF ?? s.hemiBoden ?? HEMI_BODEN).multiplyScalar(0.6), fog: false }));
    boden.position.y = -2;
    const fang = new THREE.Scene();
    fang.add(himmel, boden);
    const pmrem = new THREE.PMREMGenerator(gl);
    const karte = pmrem.fromScene(fang, 0.02, 0.1, 2000).texture;
    scene.environment = karte;
    scene.environmentIntensity = UMLICHT_STAERKE;
    console.info('[umlicht] Himmel als Umgebungslicht, Stärke', UMLICHT_STAERKE);
    return () => {
      if (scene.environment === karte) scene.environment = null;
      karte.dispose(); pmrem.dispose();
      himmel.geometry.dispose(); (himmel.material as THREE.Material).dispose();
      boden.geometry.dispose(); (boden.material as THREE.Material).dispose();
    };
  }, [gl, scene, s]);
  return null;
}

/**
 * Weg B (D265, `?hdri=1`): Himmelsfoto als Umgebungslicht. PMREM gefiltert, als `scene.environment`
 * für jedes Standardmaterial; die Hemisphäre bleibt mit einem Viertel als Grundlicht für die
 * eigenen Shader, die keine Umgebungskarte lesen. Sonne und Schatten bleiben, wie sie sind.
 */
function HdriLicht() {
  const { gl, scene } = useThree();
  useEffect(() => {
    let weg = false;
    const pmrem = new THREE.PMREMGenerator(gl);
    let karte: THREE.Texture | null = null;
    new HDRLoader().load('/himmel/alps_field_1k.hdr', (t) => {
      if (weg) { t.dispose(); return; }
      karte = pmrem.fromEquirectangular(t).texture;
      t.dispose();
      scene.environment = karte;
      scene.environmentIntensity = HDRI_STAERKE;
      console.info('[hdri] alps_field aktiv, Stärke', HDRI_STAERKE);
    });
    return () => { weg = true; if (scene.environment === karte) scene.environment = null; karte?.dispose(); pmrem.dispose(); };
  }, [gl, scene]);
  return null;
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
const FERNHANG_AN = typeof location === 'undefined' || new URLSearchParams(location.search).get('fernhang') !== '0';

function Bauwerke({ rand, ziel, hoeheAn }: {
  rand: { farbe: string; staerke: number };
  /** Sichtbares Gelände (Weltmeter) — für den Stammfuss (D262). */
  hoeheAn: (x: number, z: number) => number;
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
        <group key={b.name} position={[b.ursprung.x, bauwerkHoehe(b, hoeheAn), b.ursprung.z]}>
          {WEIHER_AN && b.dateien.includes('bauten') && (
            <Suspense fallback={null}><BauwerkWeiher bauwerk={b} hoeheAn={hoeheAn} /></Suspense>
          )}
          {b.dateien.map(teil => (
            <Suspense key={teil} fallback={null}>
              {teil === 'wasser'
                ? (istAus('becken') ? null : <BauwerkWasser bauwerk={b} />)
                : teil === 'bergruecken' || teil === 'fernhang' ? (STIMMUNG_MESSLAUF === STIMMUNG.zielbildfels
                  && teil === (FERNHANG_AN && b.dateien.includes('fernhang') ? 'fernhang' : 'bergruecken')
                  && <BauwerkFernruecken bauwerk={b} teil={teil} />)
                : teil === 'boden' ? <BauwerkBoden bauwerk={b} />
                : teil === 'schatten' ? <BauwerkSchatten bauwerk={b} />
                : teil === 'bueschel' || teil === 'baeume' ? (SCAN_BAEUME_AN && !istAus('kronen') && teil === (SCAN_BUESCHEL_AN && b.dateien.includes('bueschel') ? 'bueschel' : 'baeume') && <BauwerkBaeume bauwerk={b} teil={teil} />)
                : teil === 'pflanzen' ? (istAus('pflanzen') ? null : <BauwerkPflanzen bauwerk={b} />)
                : <Bauwerkteil bauwerk={b} teil={teil} rand={rand} hoeheAn={hoeheAn} />}
            </Suspense>
          ))}
        </group>
      ))}
    </>
  );
}

/**
 * Höhe der Bauwerksgruppe. Szenenbau: `h0` aus dem Terrainexport. Zielbild-Szene (D448): so, dass die Terrasse des
 * Renders (`boden.zt`) auf der Terrasse des Spiels liegt — beide Gelände kommen aus verschiedenen Exporten, und eine
 * Mauer, die 20 cm schwebt oder versinkt, ist im Spiel sofort zu sehen.
 */
function bauwerkHoehe(b: Bauwerk, hoeheAn: (x: number, z: number) => number): number {
  if (!b.boden) return b.h0;
  return hoeheAn(b.ursprung.x + b.boden.mitte.x, b.ursprung.z - b.boden.mitte.y) - b.boden.zt;
}

/** Die vier komponierten Horizonte des Blender-Bilds stehen in ihren Szenenmetern.
 * Außerhalb des Hofs blenden sie vor Erreichen der Kulissen in das echte Fernland über. */
function BauwerkFernruecken({ bauwerk, teil }: { bauwerk: Bauwerk; teil: 'bergruecken' | 'fernhang' }) {
  const { scene } = useGLTF(bauwerkPfad(bauwerk, teil));
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    vertexColors: true, toneMapped: false, fog: false, transparent: true,
    // Der Szenenabgleich und ACES wirken im Schlussbild auch auf die gebackenen Farbtöne.
    color: new THREE.Color(.70, .61, .53),
  }), []);
  const objekt = useMemo(() => {
    const klon = scene.clone(true);
    klon.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      material.map = (o.material as THREE.MeshStandardMaterial).map ?? null;
      o.material = material;
    });
    return klon;
  }, [scene, material]);
  useFrame(({ camera }) => {
    const abstand = Math.hypot(camera.position.x - bauwerk.ursprung.x, camera.position.z - bauwerk.ursprung.z);
    material.opacity = 1 - THREE.MathUtils.smoothstep(abstand, 55, 125);
    objekt.visible = material.opacity > 0;
  });
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={objekt} />;
}

/**
 * Boden aus dem Zielbild (D448, `tools/bodenexport.py`): Scan-Mischmaterial des Renders als Farbe, Normale und
 * Rauheit gebacken, auf einem 25-cm-Raster. Darunter schneidet `BODEN_LOCH` den Spielboden aus; die äusseren 6 m
 * blenden mit Rauschtransparenz (alphaHash, keine Sortierung) über dem Spielboden aus, 2 cm darüber.
 */
function BauwerkBoden({ bauwerk }: { bauwerk: Bauwerk }) {
  const { scene } = useGLTF(bauwerkPfad(bauwerk, 'boden'));
  const b = bauwerk.boden!;
  const objekt = useMemo(() => {
    const klon = scene.clone(true);
    klon.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      o.receiveShadow = true; o.castShadow = false;
      const m = (o.material as THREE.MeshStandardMaterial).clone();
      m.alphaHash = true; m.metalness = 0;
      if (bauwerk.name === 'felsmulde' && STIMMUNG_MESSLAUF === STIMMUNG.zielbildfels) {
        // Im Scan-Boden sind grüne Halme und Moos gelbbraun unter dem tiefen warmen Sonnenlicht.
        m.color.multiply(new THREE.Color(.91, 1.08, .96));
      }
      const innen = 1 - 6 / b.radius;
      m.onBeforeCompile = sh => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>',
          `#include <map_fragment>\n  diffuseColor.a *= 1.0 - smoothstep(${innen.toFixed(4)}, 1.0, length(vMapUv * 2.0 - 1.0));`);
      };
      o.material = m;
    });
    klon.position.y = 0.02;
    return klon;
  }, [scene, b.radius, bauwerk.name]);
  useEffect(() => {
    // Loch: so weit, wie der Boden deckend ist (Rand 6 m bleibt über dem Spielboden)
    BODEN_LOCH.value.set(bauwerk.ursprung.x + b.mitte.x, bauwerk.ursprung.z - b.mitte.y, b.radius - 6, 0);
    return () => { BODEN_LOCH.value.set(0, 0, 0, 0); };
  }, [bauwerk, b]);
  return <primitive object={objekt} />;
}

/** Scan-Büschel fassen viele unterschiedlich geneigte Blätter auf einer Fläche zusammen.
 * Gegen- und Streulicht kommen aus derselben Sonne wie die übrige Szene. Der Schattendurchlass
 * wird je Büschel im Atlas gewählt und bleibt so bei Kamerabewegung ortsfest. */
function scanBlattlicht(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        normal = normalize(vNormal);`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
          vec3 sonne = directionalLights[0].direction;
          float ruecklicht = max(-dot(normal, sonne), 0.0);
          float streiflicht = 1.0 - abs(dot(normal, sonne));
          vec2 kachel = floor(vMapUv * 16.0);
          float streuung = 0.62 + 0.26 * fract(dot(kachel, vec2(0.361, 0.723)));
          float durchlass = streuung * (0.11 + 0.28 * ruecklicht + 0.17 * streiflicht);
          reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[0].color * durchlass;
        #endif`);
  };
  material.customProgramCacheKey = () => 'fels-scan-bueschel-licht';
  const tiefe = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: material.map });
  tiefe.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `
      #include <alphatest_fragment>
      vec2 gruppe = floor(vMapUv * 16.0);
      if (fract(0.7548777 * gruppe.x + 0.5698403 * gruppe.y) > 0.46) discard;`);
  };
  tiefe.customProgramCacheKey = () => 'fels-scan-bueschel-schatten';
  return tiefe;
}

/** Die Scan-Stämme und -Kronen teilen Netze und Texturen über alle Lagen des Zielbilds. */
function BauwerkBaeume({ bauwerk, teil }: { bauwerk: Bauwerk; teil: 'bueschel' | 'baeume' }) {
  const { scene } = useGLTF(bauwerkPfad(bauwerk, teil));
  const bueschel = teil === 'bueschel';
  const { objekt, tiefen } = useMemo(() => {
    const klon = scene.clone(true);
    const tiefen = new Map<THREE.Material, THREE.MeshDepthMaterial>();
    klon.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (o instanceof THREE.InstancedMesh) o.computeBoundingSphere();
      for (const m of (Array.isArray(o.material) ? o.material : [o.material]) as THREE.MeshStandardMaterial[]) {
        if (m.transparent || m.alphaTest > 0 || /leaves/i.test(m.name)) {
          m.transparent = false;
          m.alphaTest = Math.max(m.alphaTest, 0.5);
          m.depthWrite = true;
          m.side = THREE.DoubleSide;
          if (bueschel) {
            const tiefe = tiefen.get(m) ?? scanBlattlicht(m);
            tiefen.set(m, tiefe);
            o.customDepthMaterial = tiefe;
          }
        }
      }
    });
    return { objekt: klon, tiefen };
  }, [scene, bueschel]);
  useEffect(() => () => { for (const tiefe of tiefen.values()) tiefe.dispose(); }, [tiefen]);
  return <primitive object={objekt} />;
}

/**
 * Schattenhülle (D464, `tools/schattenhuelle.mjs`): grobe Kopie der grossen Körper, die an ihrer Stelle den Schatten
 * wirft. Die eigene Ebene hält die Hülle aus Hauptbild, Tiefenpass und Spiegelung heraus.
 */
function BauwerkSchatten({ bauwerk }: { bauwerk: Bauwerk }) {
  const { scene } = useGLTF(bauwerkPfad(bauwerk, 'schatten'));
  const objekt = useMemo(() => {
    const klon = scene.clone(true);
    klon.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      o.layers.set(SCHATTENHUELLEN_EBENE);
      o.castShadow = true; o.receiveShadow = false;
    });
    return klon;
  }, [scene]);
  return <primitive object={objekt} />;
}

/**
 * Pflanzen des Zielbilds (D448, `tools/pflanzenexport.py`): Poly-Haven-Scans (Gras, Kraut, Farn, Nessel, Efeu …) mit
 * ihren Lagen als GPU-Instanzen (`EXT_mesh_gpu_instancing` → `InstancedMesh`). Blätter mit Alphatest und beidseitig,
 * Schatten werfend; ein Klon je Szene, Materialien geteilt.
 */
function BauwerkPflanzen({ bauwerk }: { bauwerk: Bauwerk }) {
  const { scene } = useGLTF(bauwerkPfad(bauwerk, 'pflanzen'));
  const camera = useThree(st => st.camera);
  const { objekt, felder } = useMemo(() => {
    const gruppe = new THREE.Group();
    const fertig = new Set<THREE.Material>();
    const felder: { mesh: THREE.InstancedMesh; mitte: THREE.Vector3; kugeln: THREE.Sphere[]; anzahl: number; basis: THREE.Matrix4[]; reihenfolge: number[]; abstand2: Float64Array; sortiert: boolean }[] = [];
    scene.updateMatrixWorld(true);
    const m4 = new THREE.Matrix4(), p = new THREE.Vector3();
    scene.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material]) as THREE.MeshStandardMaterial[]) {
        if (fertig.has(m)) continue; fertig.add(m);
        m.side = THREE.DoubleSide;
        if (m.transparent || m.alphaTest > 0 || m.map) { m.transparent = false; m.alphaTest = Math.max(m.alphaTest, 0.5); m.depthWrite = true; }
      }
      if (!(o instanceof THREE.InstancedMesh)) {   // Efeu und Laubstreu: ein Netz, keine Lagen
        const k = o.clone(); k.matrixAutoUpdate = false; k.matrix.copy(o.matrixWorld); k.castShadow = false; k.receiveShadow = true; gruppe.add(k); return;
      }
      // D450: Lagen in 12-m-Felder teilen — ein InstancedMesh über 60 m wird nie verworfen, Felder ausserhalb des Bildes schon
      const je = new Map<string, number[]>();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m4); p.setFromMatrixPosition(m4.premultiply(o.matrixWorld));
        const schl = `${Math.floor(p.x / FELD_PFLANZEN)},${Math.floor(p.z / FELD_PFLANZEN)}`;
        (je.get(schl) ?? je.set(schl, []).get(schl)!).push(i);
      }
      for (const idx of je.values()) {
        // gemischt, damit eine gekürzte Anzahl (Ferne) gleichmässig ausdünnt statt eine Ecke zu leeren
        for (let k = idx.length - 1; k > 0; k--) { const j = (k * 7919 + 13) % (k + 1); [idx[k], idx[j]] = [idx[j], idx[k]]; }
        const feld = new THREE.InstancedMesh(o.geometry, o.material, idx.length);
        const basis = idx.map(i => { o.getMatrixAt(i, m4); return m4.premultiply(o.matrixWorld).clone(); });
        basis.forEach((b, k) => feld.setMatrixAt(k, b));
        feld.computeBoundingSphere(); feld.castShadow = false; feld.receiveShadow = true;   // kleine Pflanzen werfen keinen Schatten (Schattenpass ×2)
        const kugeln = [feld.boundingSphere!];
        if (FELS_BILDTAKT_AN) {
          // Die gekürzten Stufen zeichnen jeweils den Anfang der gemischten Basisfolge.
          for (const teiler of [3, 8]) {
            feld.count = Math.ceil(idx.length / teiler);
            feld.boundingSphere = new THREE.Sphere();
            feld.computeBoundingSphere();
            kugeln.push(feld.boundingSphere);
          }
          feld.count = idx.length;
          feld.boundingSphere = kugeln[0]!;
        }
        gruppe.add(feld); felder.push({ mesh: feld, kugeln, mitte: feld.boundingSphere!.center.clone(), anzahl: idx.length, basis, reihenfolge: basis.map((_, i) => i), abstand2: new Float64Array(basis.length), sortiert: false });
      }
    });
    return { objekt: gruppe, felder };
  }, [scene]);
  // Ferne: ab 18 m auf ein Drittel ausgedünnt, ab 35 m ein Achtel — Halme sind dort kleiner als ein Pixel
  const letzte = useRef(new THREE.Vector3(Infinity, 0, 0));
  const welt = useRef(new THREE.Vector3());
  const ort = useRef(new THREE.Vector3());
  const invers = useRef(new THREE.Matrix4());
  useFrame(() => {
    if (letzte.current.distanceToSquared(camera.position) < 1) return;
    letzte.current.copy(camera.position);
    // D464: Überdeckung sparen — Pflanzen nach Mauern und Boden zeichnen (renderOrder), Felder von nah nach fern, und in
    // den vollen Nahfeldern die Lagen von vorn nach hinten. Verdeckte Pixel fallen dann am Tiefentest, vor dem Shader.
    const lokal = welt.current.copy(camera.position).applyMatrix4(invers.current.copy(objekt.matrixWorld).invert()).clone();
    const nachAbstand: { f: typeof felder[number]; d: number }[] = [];
    for (const f of felder) {
      const d = f.mitte.distanceTo(lokal);
      const voll = d < 18;
      f.mesh.count = voll ? f.anzahl : d < 35 ? Math.ceil(f.anzahl / 3) : Math.ceil(f.anzahl / 8);
      if (FELS_BILDTAKT_AN) f.mesh.boundingSphere = f.kugeln[voll ? 0 : d < 35 ? 1 : 2]!;
      if (voll) {
        for (let i = 0; i < f.anzahl; i++) f.abstand2[i] = ort.current.setFromMatrixPosition(f.basis[i]).distanceToSquared(lokal);
        f.reihenfolge.sort((x, y) => f.abstand2[x] - f.abstand2[y] || x - y);
        f.reihenfolge.forEach((q, z) => f.mesh.setMatrixAt(z, f.basis[q]));
        f.mesh.instanceMatrix.needsUpdate = true; f.sortiert = true;
      } else if (f.sortiert) {   // gemischte Ordnung zurück, sonst dünnt die Ferne eine Ecke aus
        f.basis.forEach((b, z) => f.mesh.setMatrixAt(z, b)); f.mesh.instanceMatrix.needsUpdate = true; f.sortiert = false;
      }
      nachAbstand.push({ f, d });
    }
    nachAbstand.sort((x, y) => x.d - y.d).forEach(({ f }, i) => { f.mesh.renderOrder = 1 + i * 1e-4; });
  });
  return <primitive object={objekt} />;
}
/** Kantenlänge der Pflanzenfelder in Metern (D450). */
const FELD_PFLANZEN = 12;

/**
 * Stauweiher (D268, `world/weiher.ts`): nur für Bauwerke mit einem Objekt `Wehr`. Teilt sich die
 * geladene `bauten`-Datei mit `Bauwerkteil` (drei cached je Pfad) und verändert sie nicht.
 */
function BauwerkWeiher({ bauwerk, hoeheAn }: { bauwerk: Bauwerk; hoeheAn: (x: number, z: number) => number }) {
  const { scene } = useGLTF(bauwerkPfad(bauwerk, 'bauten'));
  const material = useMemo(() => baueWasserMaterial(false, false, 'weiher'), []);
  useWasserUmgebung(material);
  const weiher = useMemo(() => {
    scene.updateMatrixWorld(true);
    const wehr = scene.getObjectByName('Wehr');
    if (!wehr) return null;
    const box = new THREE.Box3().setFromObject(wehr);
    const { x: ox, z: oz } = bauwerk.ursprung;
    // Gruppenraum: Welt minus Ursprung und `h0` (die Gruppe steht dort, siehe `Bauwerke`).
    const w = baueWeiher(box, (x, z) => hoeheAn(x + ox, z + oz) - bauwerk.h0);
    if (w) console.info(`[weiher] ${bauwerk.name}: Spiegel ${(w.spiegel + bauwerk.h0).toFixed(2)} m, ${w.zellen} Zellen`);
    return w;
  }, [scene, bauwerk, hoeheAn]);
  useEffect(() => () => { weiher?.geometrie.dispose(); material.dispose(); }, [weiher, material]);
  // D280: Spiegelebene anmelden (Welt: Gruppenraum + Ursprung + h0).
  useEffect(() => {
    if (!weiher || !GEWAESSER_ECHT) return;
    weiher.geometrie.computeBoundingSphere();
    const k = weiher.geometrie.boundingSphere!;
    return meldeSpiegelflaeche({ x: k.center.x + bauwerk.ursprung.x, z: k.center.z + bauwerk.ursprung.z,
      hoehe: weiher.spiegel + bauwerk.h0, radius: k.radius });
  }, [weiher, bauwerk]);
  return weiher ? <mesh geometry={weiher.geometrie} material={material} renderOrder={1} /> : null;
}

function Bauwerkteil({ bauwerk, teil, rand, hoeheAn }: {
  bauwerk: Bauwerk; teil: 'bauten' | 'gruen'; rand: { farbe: string; staerke: number };
  hoeheAn: (x: number, z: number) => number;
}) {
  const { scene } = useGLTF(bauwerkPfad(bauwerk, teil));
  const { objekt, materialien, karten, kerne } = useMemo(() => {
    const klon = scene.clone(true);
    const huellen: { o: THREE.Mesh; art: KartenArt; w: ReturnType<typeof baueWindMaterial> }[] = [];
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
    // Vertikalschnitt (`?stamm=1`, D262): Weltlage jedes Netzes für Rindenmass und Stammfuss.
    klon.updateMatrixWorld(true);
    const skalaVon = (o: THREE.Object3D) => { const v = new THREE.Vector3(); o.getWorldScale(v); return Math.cbrt(Math.abs(v.x * v.y * v.z)) || 1; };
    let fussEcken = 0;
    klon.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      // D450: In der Zielbild-Szene werfen nur grosse Körper Schatten — Streu, Kiesel, Moos und Schutt sind 2 Mio. Dreiecke
      // im Schattenpass und werfen Schatten unter einem Pixel der Schattenkarte (24 cm je Texel)
      // D464: Bringt das Bauwerk eine Schattenhülle mit (`-schatten.glb`, 78 000 statt 981 000 Dreiecke), wirft nur sie.
      o.castShadow = !bauwerk.dateien.includes('schatten') && (bauwerk.ordner !== 'bauten-ziel' || /^(Mauer[ABC]|Stuetzmauer|Fels|Hof|Becken|Stein|Versturz|Wurzel|Stubben|Balken)(?!.*_Schutt)/.test(o.name)); o.receiveShadow = true;
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
      // Himmelsanteil (D170, `tools/himmel.ts`): nur, wo die Datei ihn mitbringt.
      const himmel = !!(o.geometry as THREE.BufferGeometry).getAttribute('_himmel');
      // Holz der Szene: vereinigte Waldstämme (`WaldHolz`, nur Vertexfarbe) und Weidenstämme.
      const holz = STAMM_AN && /Holz/.test(o.name);
      let fuss = false;
      if (holz) {
        const g = o.geometry as THREE.BufferGeometry;
        if (!g.getAttribute('_fuss')) fussEcken += setzeStammfuss(g, o.matrixWorld, { x: bauwerk.ursprung.x, y: bauwerk.h0, z: bauwerk.ursprung.z }, hoeheAn);
        fuss = true;
      }
      // Rinden-Scan nur, wo keine gebackene Textur liegt (die Weiden bringen ihre eigene mit).
      const rinde = holz && !basis.map ? { rinde: 'ganz' as const, rindeMeter: skalaVon(o) } : {};
      // Gebackene, starre Einzelnetze ohne Zusatzattribute verwenden das glTF-Material direkt.
      // Hier sind Wind, Rollen, Durchlass und Saum null; die Instanz-Farbvariation ist exakt eins.
      if (bauwerk.ordner === 'bauten-ziel' && teil === 'bauten' && !holz && !himmel
        && !(o instanceof THREE.InstancedMesh) && basis instanceof THREE.MeshStandardMaterial && !laub) {
        o.material = basis;
        if (NORMAL_MESSLAUF !== null && basis.normalMap) {
          const probe = basis.clone();
          probe.normalScale.setScalar(NORMAL_MESSLAUF);
          o.material = probe;
        }
        return;
      }
      const w = baueWindMaterial(laub
        ? { amplitude: 0, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke * anteil, randSchaerfe: 10, loecher: 0.42, loecherSkala: 9, durchlass: 0.55, himmel }
        : { amplitude: 0, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke * anteil, himmel, fuss, ...rinde }, basis);
      if (laub) { w.material.side = THREE.DoubleSide; if (w.tiefe) o.customDepthMaterial = w.tiefe; }
      if (NORMAL_MESSLAUF !== null && w.material.normalMap) w.material.normalScale.setScalar(NORMAL_MESSLAUF);
      o.material = w.material; materialien.push({ w, anteil });
      if (LAUBKARTEN_AN && teil === 'gruen') {
        const art = kartenArtFuer(o.name);
        if (art) huellen.push({ o, art, w });
      }
    });
    // Vertikalschnitt (`?laubkarten=1`): Kronen bekommen Foto-Blattkarten, der Klumpen wird zum
    // dunklen Kern 40 cm innen. Nach dem Durchlauf, damit `traverse` die neuen Kinder nicht besucht.
    const karten: ReturnType<typeof baueLaubkarten>[] = [];
    const kerne: THREE.Material[] = [];
    if (fussEcken) console.info(`[stamm] ${bauwerk.name}/${teil}: ${fussEcken} Ecken an Stammfüssen`);
    huellen.forEach(({ o, art, w }, i) => {
      const skala = skalaVon(o);
      const k = baueLaubkarten(o.geometry as THREE.BufferGeometry, art, i + 1, 1, skala);
      o.geometry = schrumpfeHuelle(o.geometry as THREE.BufferGeometry, 0.4, skala);
      /**
       * D266: Der Kern bekommt ein eigenes, mattes Material. Mit dem Laubmaterial behielt er Saum,
       * Durchlicht und Löcher — im Gegenlicht leuchtete er durch die Kartenlücken als graue Fläche
       * (Weide vorn links, Stauwehr 12.11.2026).
       */
      const basis = w.material;
      // Weide ohne Kern: Sie ist von Natur aus durchsichtig, und durch die lockeren Hängekarten sah
      // man auf die flachen, sonnenbeschienenen Facetten des Kerns (graue Flecken, Weide5 8 m vor der
      // Bildtor-Kamera). `visible: false` am Material blendet nur den Kern aus, die Karten (Kinder) bleiben.
      const kern = new THREE.MeshStandardMaterial({
        vertexColors: basis.vertexColors, color: basis.color.clone().multiplyScalar(0.25),
        roughness: 1, metalness: 0, side: THREE.FrontSide, visible: art !== 'weide',
      });
      o.material = kern;
      o.customDepthMaterial = undefined;
      kerne.push(kern);
      o.add(k.mesh); karten.push(k);
    });
    if (karten.length) console.info(`[laubkarten] ${bauwerk.name}: ${karten.length} Hüllen, ${karten.reduce((s, k) => s + k.anzahl, 0)} Karten auf ${Math.round(karten.reduce((s, k) => s + k.flaeche, 0))} m² (${karten.map(k => `${k.mesh.name.split(':')[1]} ${k.anzahl}/${Math.round(k.flaeche)}`).join(', ')})`);
    return { objekt: klon, materialien, karten, kerne };
  }, [scene, teil, rand.farbe, rand.staerke]);
  useEffect(() => {
    materialien.forEach(({ w, anteil }) => w.setzeRand(new THREE.Color(rand.farbe), rand.staerke * anteil));
  }, [materialien, rand.farbe, rand.staerke]);
  useEffect(() => () => {
    materialien.forEach(({ w }) => { w.material.dispose(); w.tiefe?.dispose(); });
    karten.forEach(k => k.dispose());
    kerne.forEach(m => m.dispose());
  }, [materialien, karten, kerne]);
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

function Orte({ orte, ziel, onNah, rand, hoeheAn, tageszeit = 0.39 }: {
  orte: Ortsmarke[];
  /** Für die Tagesroutine der Dorfbewohner (D177). */
  tageszeit?: number;
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
  /** Wo die Bewohner gerade stehen (D178) — Ansprechen folgt der Figur, auch ins Wirtshaus. */
  const lage = useRef(new Map<string, [number, number]>());
  // D177, Tagesroutine: Abends (Abendrot bis vor der Dämmerung) gehen Bewohner ins Wirtshaus und
  // stehen im Halbkreis vor dem Tresen; morgens gehen sie zurück. Wer geht und wohin, steht seit
  // D375 im Ort (`abends`) statt im Namen — die Enklave liegt über die Terrasse verteilt, und der
  // Weg ist eine Gerade: Die Wache am Abstieg und der Förster bleiben, wo sie sind.
  const abends = tageszeit >= 0.74 || tageszeit < 0.2;
  const abendZiel = (o: Ortsmarke): [number, number] | undefined => {
    const wirt = o.abends ? orte.find(z => z.id === o.abends) : undefined;
    if (!wirt) return undefined;
    const gaeste = orte.filter(g => g.abends === wirt.id && g.figur);
    const i = gaeste.indexOf(o);
    if (i < 0) return undefined;
    const w = THREE.MathUtils.degToRad(wirt.blick ?? 0) + (i - (gaeste.length - 1) / 2) * 0.55;
    // Vor dem Wirt, 3 m in seiner Blickrichtung, im Bogen verteilt.
    return [wirt.position[0] - Math.sin(w) * 3.2, wirt.position[2] - Math.cos(w) * 3.2];
  };

  useFrame(() => {
    const p = ziel.current?.position;
    if (!p || !onNah) return;
    let naechster: string | null = null, beste = ORT_AB;
    for (const o of orte) {
      const [ox, oz] = lage.current.get(o.id) ?? [o.position[0], o.position[2]];
      const d = Math.hypot(ox - p.x, oz - p.z);
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
                      ziel={ziel} rand={rand} hoeheAn={hoeheAn} marke={{ geometry: punkt, material: punktMat }}
                      ausflug={abendZiel(o)} unterwegs={abends}
                      melde={(x, z) => lage.current.set(o.id, [x, z])} />
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
      // Außerhalb der Reichweite bleiben manche Varianten leer. Kein erster
      // Shader-Einsatz beim Schwenk auf ein leeres Instanz-Mesh.
      if (HOF_BILDFLUSS_AN) m.visible = n > 0;
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
/** D290: LoD2-Silhouetten (`tools/lod2import.py`), Reihenfolge wie `welt.gebaeude` des Œntals. */
const LOD2_DATEN = LOD2_ROH as (NonNullable<Weltdaten['gebaeude'][number]['lod2']> | null)[];
const REGENT_HOEHE = 4.2;
/**
 * Das Modell (D241) ist 1,6 Einheiten lang statt der 1,2 der Silhouette: 3,8 ergibt gut sechs
 * Meter Wels, zwei Meter hoch — doppelt so groß wie jede Kreatur, wie oben verlangt.
 */
const REGENT_MODELL_MASS = 3.8;
/**
 * Pegel nach der Heilung (D241): 0,35 m tiefer im Umkreis von 45 m. Der Bach ist in der Mitte
 * 0,85 m tief — mehr als die Hälfte, und er läge streckenweise trocken; das wäre ein anderer Ort.
 */
const HEIL_PEGEL = { radius: 45, tiefe: 0.35 };
/** Ab hier wird gefragt, ob man ihn stellen will. */
export const REGENT_AB = 18;
/**
 * Auftauchen des Regenten (D243), vorläufig — zu beurteilen am M1 in Bewegung, nicht am Standbild.
 * Dafür `?auftauchen=tiefe,blick,schraeg` (z. B. `?auftauchen=1.6,80,0.6`): überschreibt die drei
 * Werte für diesen Lauf, damit man sie am Zielgerät stellen kann, ohne neu zu bauen (D244).
 */
const AUFTAUCHEN_MESSLAUF: [number, number, number] | null = (() => {
  if (typeof location === 'undefined') return null;
  const roh = new URLSearchParams(location.search).get('auftauchen')?.split(',').map(Number);
  if (!roh || roh.length !== 3 || roh.some(n => !Number.isFinite(n))) return null;
  const [tiefe, blick, schraeg] = roh;
  return tiefe >= 0 && tiefe <= 5 && blick > REGENT_AB && blick <= 200 && Math.abs(schraeg) <= Math.PI
    ? [tiefe, blick, schraeg] : null;
})();
/** So tief liegt er von weitem — beim Wels bleiben Rücken und Rohre über Wasser. */
const REGENT_TAUCHTIEFE = AUFTAUCHEN_MESSLAUF?.[0] ?? 1.2;
/** Ab hier taucht der Regent auf und wendet sich dem Spieler zu. */
const REGENT_BLICK = AUFTAUCHEN_MESSLAUF?.[1] ?? 60;
/** Dreiviertel statt frontal: Frontal zeigt ein Wels nur Maul und Barteln. */
const REGENT_SCHRAEG = AUFTAUCHEN_MESSLAUF?.[2] ?? 0.85;

/** Der Regent als Modell (D241), sobald `public/creatures/<id>.glb` im Register steht. */
function RegentModell({ kreatur, material }: { kreatur: string; material: THREE.Material }) {
  const { scene } = useGLTF(`/creatures/${kreatur}.glb`);
  const geo = useMemo(() => kreaturGeometrie(scene, kreatur, 2), [scene, kreatur]);
  return geo ? <mesh geometry={geo} material={material} scale={REGENT_MODELL_MASS} castShadow receiveShadow /> : null;
}

function Regentenort({ ort, kreatur, gestalt, ziel, onNah }: {
  ort: [number, number, number];
  kreatur: string;
  /** Silhouette; `null` heisst: besiegt, der Ort bleibt leer (D240). */
  gestalt: THREE.BufferGeometry | null;
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

  const tauchen = useRef(1);
  const blick = useRef<number | null>(null);

  useFrame((_, dt) => {
    uhr.current += dt;
    const p = ziel.current?.position;
    const abstand = p ? Math.hypot(ort[0] - p.x, ort[2] - p.z) : Infinity;
    if (gruppe.current) {
      // Auftauchen (D243): Von weitem liegt er tief, nur Rücken und Rohre über dem Wasser — man
      // sieht etwas Grosses, nicht was. Erst beim Herankommen hebt er sich. Gedämpft, damit ein
      // Schritt vor und zurück kein Wippen erzeugt.
      const soll = 1 - Math.min(1, Math.max(0, (abstand - REGENT_AB) / (REGENT_BLICK - REGENT_AB)));
      tauchen.current += (soll - tauchen.current) * Math.min(1, dt * 0.6);
      gruppe.current.position.y = ort[1] - (1 - tauchen.current) * REGENT_TAUCHTIEFE
        + Math.sin(uhr.current * 0.5) * 0.22;
      // Zuwenden: Innerhalb der Blickweite dreht er den Kopf (−Z) zum Spieler, aber schräg —
      // drei Viertel, damit die Flanke mit den Rohren im Bild bleibt. Schwer und langsam.
      if (p && abstand < REGENT_BLICK) {
        const richtung = Math.atan2(-(p.x - ort[0]), -(p.z - ort[2])) + REGENT_SCHRAEG;
        blick.current ??= gruppe.current.rotation.y;
        let d = richtung - blick.current;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        blick.current += d * Math.min(1, dt * 0.35);
      }
      gruppe.current.rotation.y = (blick.current ?? 0) + Math.sin(uhr.current * 0.22) * 0.12;
    }
    if (!p || !onNah) return;
    const nah = abstand <= REGENT_AB;
    if (nah !== war.current) { war.current = nah; onNah(nah); }
  });

  return (
    <group ref={gruppe} position={ort}>
      {gestalt && (MIT_MODELL.has(kreatur)
        ? (
          <Suspense fallback={<mesh geometry={gestalt} material={material} scale={REGENT_HOEHE} />}>
            <RegentModell kreatur={kreatur} material={material} />
          </Suspense>
        )
        : <mesh geometry={gestalt} material={material} scale={REGENT_HOEHE} castShadow receiveShadow />)}
    </group>
  );
}

function Beleuchtung({ s, ziel, wiesenbereich, fernMaterial, geheilt }: {
  s: Stimmung; ziel: React.RefObject<THREE.Object3D | null>; wiesenbereich?: Wiesenbereich;
  fernMaterial: THREE.ShaderMaterial; geheilt: boolean;
}) {
  const { scene, gl } = useThree();
  const sonne = useRef<THREE.DirectionalLight>(null);
  const halbkugel = useRef<THREE.HemisphereLight>(null);
  const ortslicht = MILBINGERLICHT_AN && wiesenbereich;
  const wolkendecke = !geheilt && !MILBINGERKLAR_AN;
  const tageslicht = wolkendecke ? MILBINGER_WOLKENLICHT : MILBINGER_TAGESLICHT;
  const ortsfoto = ortslicht ? (wolkendecke ? 'bedeckt' : 'klar') : undefined;
  const bodenfarbe = HEMIBODEN_MESSLAUF ?? s.hemiBoden ?? HEMI_BODEN;
  const fuelllicht = (UMGEBUNG_MESSLAUF ?? s.umgebungStaerke) * (HDRI_AN ? .25 : UMLICHT_AN ? .35 : 1);
  const direktlicht = SONNE_MESSLAUF ?? s.sonneStaerke;
  const umfeldlicht = HDRI_AN ? HDRI_STAERKE : UMLICHT_STAERKE;
  const schatten = SCHATTEN_MESSLAUF ?? s.schatten ?? 1;
  const belichtung = BELICHTUNG_MESSLAUF ?? s.belichtung;
  const lichtbasis = useMemo(() => ortslicht ? {
    sonne: new THREE.Color(s.sonne), himmel: new THREE.Color(s.umgebung),
    erde: new THREE.Color(bodenfarbe), nebel: new THREE.Color(s.nebel),
    horizont: new THREE.Color(s.horizont), zenit: new THREE.Color(s.zenit),
  } : null, [ortslicht, s, bodenfarbe]);
  const [takramBereit, setzeTakramBereit] = useState(false);
  const takramAn = typeof location !== 'undefined' && new URLSearchParams(location.search).get('takram') === '1';

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
    sonnenstand: s.sonnenstand, scheibe: s.scheibe, hof: s.hof, wolken: s.wolken,
    atmosphaere: s.atmosphaere,
  }, ortsfoto), [s, ortsfoto]);
  useEffect(() => {
    setzeHimmel(himmel, {
      zenit: s.zenit, horizont: s.horizont, dunst: s.nebel, sonne: s.sonne,
      sonnenstand: s.sonnenstand, scheibe: s.scheibe, hof: s.hof, wolken: s.wolken,
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
    gl.toneMappingExposure = belichtung;
  }, [gl, belichtung]);
  // Himmelsanteil im Fülllicht je Stimmung (D170) — ein Uniform für alle Set-Pieces.
  useEffect(() => { setzeHimmelStaerke(s.himmelAnteil ?? 0.7); }, [s.himmelAnteil]);

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
    const ort = ortslicht ? milbingerLichtanteil(ortslicht.rahmen, p.x, p.z, s.sonneStaerke) : 0;
    const misch = THREE.MathUtils.lerp;
    l.position.set(p.x + misch(s.sonnenstand[0], tageslicht.sonnenstand.x, ort),
      p.y + misch(s.sonnenstand[1], tageslicht.sonnenstand.y, ort), p.z + misch(s.sonnenstand[2], tageslicht.sonnenstand.z, ort));
    l.target.position.copy(p);
    l.target.updateMatrixWorld();
    if (HOF_LICHT_AN) {
      const mitte = HOF_UNIFORM.mitte.value;
      const hofAnteil = HOF_UNIFORM.bereit.value
        * (1 - THREE.MathUtils.smoothstep(Math.hypot(p.x - mitte.x, p.z - mitte.y), 44, 65));
      l.shadow.radius = misch(1 + 1.9 * hofAnteil, wolkendecke ? 2.7 : 1.75, ort);
    }
    if (lichtbasis) {
      // Licht, Horizont und Nebel folgen demselben ortsfesten Übergang. Keine
      // Lichtquellen oder Renderpässe wechseln beim Überschreiten einer Kachel.
      const h = halbkugel.current;
      if (h) {
        h.color.lerpColors(lichtbasis.himmel, tageslicht.himmel, ort);
        h.groundColor.lerpColors(lichtbasis.erde, tageslicht.erde, ort);
        h.intensity = misch(fuelllicht, tageslicht.hemisphaere, ort);
      }
      l.color.lerpColors(lichtbasis.sonne, tageslicht.sonne, ort);
      l.intensity = misch(direktlicht, tageslicht.direkt, ort);
      l.shadow.intensity = misch(schatten, tageslicht.schatten, ort);
      l.shadow.normalBias = .035 * ort;
      const zoom = misch(1, 1.56, ort);
      if (l.shadow.camera.zoom !== zoom) {
        l.shadow.camera.zoom = zoom;
        l.shadow.camera.updateProjectionMatrix();
      }
      gl.toneMappingExposure = misch(belichtung, tageslicht.belichtung, ort);
      if (HDRI_AN || UMLICHT_AN) scene.environmentIntensity = misch(umfeldlicht, tageslicht.umfeld, ort);
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.lerpColors(lichtbasis.nebel, tageslicht.dunst, ort);
        scene.fog.near = misch(s.nebelNah, tageslicht.nebelNah, ort);
        scene.fog.far = misch(s.nebelFern, tageslicht.nebelFern, ort);
      }
      const u = (himmel.material as THREE.ShaderMaterial).uniforms;
      const richtung: THREE.Vector3 = u.sonnenrichtung.value;
      richtung.copy(l.position).sub(p).normalize();
      u.sonnenfarbe.value.copy(l.color);
      u.zenit.value.lerpColors(lichtbasis.zenit, tageslicht.himmel, ort);
      u.horizont.value.lerpColors(lichtbasis.horizont, tageslicht.dunst, ort);
      u.dunst.value.lerpColors(lichtbasis.nebel, tageslicht.dunst, ort);
      const versatz: THREE.Vector3 | undefined = fernMaterial.uniforms.uDunstversatz?.value;
      versatz?.set(tageslicht.dunst.r - lichtbasis.horizont.r, tageslicht.dunst.g - lichtbasis.horizont.g,
        tageslicht.dunst.b - lichtbasis.horizont.b).multiplyScalar(ort);
      const fern = fernMaterial.uniforms;
      if (fern.uFernDunst) {
        fern.uFernDunst.value.copy(u.horizont.value);
        fern.uFernSonne.value.copy(richtung);
        fern.uFernDirekt.value.copy(l.color).multiplyScalar(l.intensity / Math.PI);
        if (h) fern.uFernUmfeld.value.copy(h.color).multiplyScalar(h.intensity / Math.PI);
      }
      himmel.userData.ortsfotoAnteil = ort;
    }
  });

  return (
    <>
      {/* Der Himmel hängt an der Kamera: keine Ausdehnung im Spielraum, kein Nebel,
          kein Schatten. Er ist Hintergrund, kein Objekt. */}
      {!takramBereit && <primitive object={himmel} />}
      {takramAn && <TakramProbe sonnenstand={s.sonnenstand} meldeBereit={setzeTakramBereit} />}
      <hemisphereLight ref={halbkugel} args={[s.umgebung, bodenfarbe, fuelllicht]} />
      {HDRI_AN && <HdriLicht />}
      {UMLICHT_AN && <HimmelLicht s={s} />}
      <directionalLight
        ref={sonne}
        position={s.sonnenstand as unknown as [number, number, number]}
        color={s.sonne} intensity={direktlicht}
        castShadow shadow-mapSize={[SCHATTENKARTE.aufloesung, SCHATTENKARTE.aufloesung]}
        shadow-camera-left={-SCHATTENKARTE.halb} shadow-camera-right={SCHATTENKARTE.halb}
        shadow-camera-top={SCHATTENKARTE.halb} shadow-camera-bottom={-SCHATTENKARTE.halb}
        shadow-camera-layers-mask={1 | (1 << SCHATTENHUELLEN_EBENE)}
        shadow-camera-far={700} shadow-bias={-0.0008}
        shadow-intensity={schatten}
      />
    </>
  );
}

/**
 * Einzelhalme im Nahbereich, auf der GPU (D211, `world/grasteppich.ts`). `?aus=teppich` schaltet ab.
 */
/**
 * Spiegelbild auf stillem Wasser (D280, `world/spiegelbild.ts`): meldet die Teiche des Höhenfelds als
 * Spiegelebenen an und rechnet je Bild das Spiegelbild des nächsten — vor dem Hauptbild (Priorität 0,5,
 * `Kontur` zeichnet mit 1).
 */
function Spiegelung({ feld }: { feld: HoehenFeld }) {
  const { gl, scene, camera } = useThree();
  const spiegel = useMemo(() => new Spiegelbild(), []);
  useEffect(() => () => spiegel.dispose(), [spiegel]);
  useEffect(() => {
    const ab = feld.teiche.map((t) => {
      let x = 0, z = 0, hoehe = Infinity;
      // Dieselbe Höhe wie die gezeichnete Teichfläche (`baender.ts`: tiefster Uferpunkt auf dem Netz).
      for (const [px, pz] of t.punkte) { x += px; z += pz; hoehe = Math.min(hoehe, spiegelAufFlaeche(feld, px, pz)); }
      x /= t.punkte.length; z /= t.punkte.length;
      const radius = Math.max(...t.punkte.map(([px, pz]) => Math.hypot(px - x, pz - z)));
      return meldeSpiegelflaeche({ x, z, hoehe, radius });
    });
    return () => ab.forEach((f) => f());
  }, [feld]);
  useFrame(() => spiegel.aktualisiere(gl, scene, camera as THREE.PerspectiveCamera), 0.5);
  return null;
}

function Grasteppich({ welt, feld, ziel, dichte, weite, strassenmaske, wiesenbereich }: {
  welt: Weltdaten; feld: HoehenFeld; ziel: React.RefObject<THREE.Object3D | null>; dichte: number; weite: number;
  strassenmaske?: QuerschnittGrasmaske;
  wiesenbereich?: Wiesenbereich;
}) {
  const aufWeg = useMemo(() => wegTest(welt, feld), [welt, feld]);
  const lokal = GRAS_FEIN ? undefined : wiesenbereich;
  const fotoWeg = useMemo(() => lokal?.kontakt
    ? wegTest(welt, feld, undefined, lokal.kontakt.freigabe) : aufWeg, [welt, feld, lokal, aufWeg]);
  const teppich = useMemo(() => baueGrasteppich(feld, aufWeg, dichte, undefined, undefined, 0, 1, strassenmaske, lokal),
    [feld, aufWeg, dichte, strassenmaske, lokal]);
  // D235: dichte Wiese im Nahfeld, nur auf voller Qualität; `?aus=nahgras` schaltet sie ab.
  const nah = useMemo(() => (dichte >= 1 && !istAus('nahgras')
    ? (GRAS_FEIN ? baueGrasteppich(feld, aufWeg, dichte, NAH_HALB_ECHT, NAH_ZELLE_FEIN, 0, 1, strassenmaske)
      : GRAS_ECHT ? baueGrasteppich(feld, aufWeg, dichte, NAH_HALB_ECHT, NAH_ZELLE_ECHT, 0, 1, strassenmaske, lokal)
      : baueGrasteppich(feld, aufWeg, dichte, NAH_HALB, NAH_ZELLE, 0, 1, strassenmaske, lokal)) : null),
    [feld, aufWeg, dichte, strassenmaske, lokal]);
  // D247: Fernring hinter dem Teppich, nur bei Sichtweite „weit“; `?aus=ferngras` schaltet ab.
  const fern = useMemo(() => (weite > 1 && dichte > 0 && !istAus('ferngras')
    ? baueGrasteppich(feld, aufWeg, dichte, Math.round(TEPPICH_HALB * 1.5 * weite), FERN_ZELLE, TEPPICH_HALB, 3, strassenmaske)
    : null), [feld, aufWeg, dichte, weite, strassenmaske]);
  const fotoWiese = useMemo(() => lokal && dichte > 0
    ? baueGrasteppich(feld, fotoWeg, dichte, TEPPICH_HALB, TEPPICH_ZELLE_FEIN, 0, 1, strassenmaske, lokal, true)
    : null, [feld, fotoWeg, dichte, strassenmaske, lokal]);
  useEffect(() => () => { teppich.dispose(); nah?.dispose(); fern?.dispose(); fotoWiese?.dispose(); },
    [teppich, nah, fern, fotoWiese]);
  useEffect(() => {
    for (const ring of [teppich, nah, fern, fotoWiese]) {
      const vorlauf = ring?.vorlauf;
      if (vorlauf) vorlauf.onAfterRender = () => {
      // Licht, Nebel und Tonwertkurve können während des Aufbaus wechseln.
        if (ladezeit() !== null) vorlauf.visible = false;
      };
    }
  }, [teppich, nah, fern, fotoWiese]);
  const erstesBild = useRef(true);
  useEffect(() => { erstesBild.current = true; }, [teppich, nah, fern, fotoWiese]);
  useFrame(({ clock }) => {
    teppich.setzeZeit(clock.elapsedTime);
    nah?.setzeZeit(clock.elapsedTime);
    fern?.setzeZeit(clock.elapsedTime);
    fotoWiese?.setzeZeit(clock.elapsedTime);
    const p = ziel.current?.position;
    // G-141: Alle drei Ringe teilen sich je Bild eine Frist für das Nachziehen, statt ~55 + ~30 ms
    // in einem Bild (D247). Das allererste Füllen läuft ohne Frist, sonst fehlt der Rasen anfangs.
    if (p) {
      const frist = erstesBild.current ? Infinity : performance.now() + TEPPICH_FRIST_MS;
      erstesBild.current = false;
      teppich.ziehNach(p.x, p.z, frist); nah?.ziehNach(p.x, p.z, frist); fern?.ziehNach(p.x, p.z, frist);
      if (fotoWiese && lokal) {
        const r = lokal.rahmen;
        fotoWiese.mesh.visible = p.x > r.x - TEPPICH_HALB && p.x < r.z + TEPPICH_HALB
          && p.z > r.y - TEPPICH_HALB && p.z < r.w + TEPPICH_HALB;
        if (fotoWiese.mesh.visible) fotoWiese.ziehNach(p.x, p.z, frist);
      }
    }
  });
  return <>{<primitive object={teppich.mesh} />}{nah && <primitive object={nah.mesh} />}{fern && <primitive object={fern.mesh} />}
    {fotoWiese && <primitive object={fotoWiese.mesh} />}
    {[teppich, nah, fern, fotoWiese].map(r => r?.vorlauf && <primitive key={r.vorlauf.uuid} object={r.vorlauf} />)}</>;
}

/**
 * Steine und Äste im Nahbereich.
 *
 * Wird beim Gehen nachgezogen statt einmalig verteilt: 30.000 Props über 16 km²
 * lassen den Boden direkt vor dem Spieler leer, und genau dort schaut man hin.
 * D366: Die Grasbüschel dieser Schicht sind entfernt (siehe `streuung.ts`).
 */
function Streuschicht({ feld, ziel, dichte }: {
  feld: HoehenFeld; ziel: React.RefObject<THREE.Object3D | null>; dichte: number;
}) {
  const kleinGeo = useMemo(() => baueKleinzeugGeometrie(), []);
  // Steine und Äste bewegen sich nicht — eigenes Material ohne Wind.
  const kleinMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 1, metalness: 0,
  }), []);

  // Kein Schattenwurf und kein Schattenempfang: Ein Shadow-Texel ist bei ±250 m
  // Schattenkamera und 2048² rund 24 cm — Steine und Äste sind kleiner als ein Texel.
  // Sie würden sich selbst beschatten und schwarz rendern.
  const kleinMesh = useRef<THREE.InstancedMesh>(null);
  const letzte = useRef(new THREE.Vector3(NaN, NaN, NaN));

  // Dichteänderung erzwingt ein Nachziehen beim nächsten Bild.
  useEffect(() => { letzte.current.set(NaN, NaN, NaN); }, [dichte]);

  useFrame(() => {
    const p = ziel.current?.position;
    if (!p) return;
    if (letzte.current.distanceTo(p) < STREU_NACHZIEHEN) return;
    letzte.current.copy(p);

    const k = kleinMesh.current;
    if (k) {
      k.count = streueKleinzeug(feld, p.x, p.z, k, dichte);
      k.instanceMatrix.needsUpdate = true;
      if (k.instanceColor) k.instanceColor.needsUpdate = true;
      k.computeBoundingSphere();
    }
  });

  return (
    <instancedMesh
      ref={kleinMesh} args={[kleinGeo, kleinMaterial, KLEIN_MAX]}
      frustumCulled={false} receiveShadow={false} castShadow={false}
    />
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
 * 4,2 und 8,5 m/s (bis D412 11,0; seither `content/bewegung.json`) sind schneller als
 * der Mensch: eine bewusste Abweichung vom 1:1-Maßstab an genau einer Stelle (Ledger
 * G-27, D18). 9,81 m/s² und 5,4 m/s
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
 *
 * Das Klettertempo (`KLETTERN_TEMPO`) stand hier bis D412 als 2,2 m/s; seither 1,0 m/s
 * aus `content/bewegung.json`, gelesen über `spieler/tempo.ts`.
 */
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
                   gleiterFrei, onGleiten, meldeRand, stoecke, kampfSperre, kampfZielt, sprung, anzug, onKoerper, landung, luft }: {
  /** D458: Landezustand für die Figur (`figur/landung.ts`) — nur Bild, die Regel des Fallschadens bleibt D412. */
  landung?: React.RefObject<Landung>;
  /** D461: Luftzustand für die Figur (`figur/sprung.ts`) — nur Bild; Absprung und Schwerkraft bleiben, wie sie sind. */
  luft?: React.RefObject<Luft>;
  feld: HoehenFeld;
  /** Versetzen (D179): Liegt hier ein Punkt, steht die Figur im nächsten Bild dort, auf dem Boden. */
  /** Versetzen (D179), optional mit Blick (D183: Aufwachen schaut zur Zuflucht). */
  sprung?: React.RefObject<[number, number, number?] | null>;
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
  /** D412: Trägt die Figur einen Anzug (Tauchzeug)? Dann läuft die Kälteuhr nicht. */
  anzug?: React.RefObject<boolean>;
  /**
   * D412: Sturz und Kälte (`spieler/bewegung.ts`). `leben` ist, was davon übrig bleibt (0 … 1).
   * Sturz bei jedem Aufprall mit Schaden, Kälte nur beim Übergang „sinkt“ und „aufgebraucht“.
   */
  onKoerper?: (art: 'sturz' | 'kaelte', leben: number) => void;
  /** Wird in jedem Bild gerufen, in dem an der Regionsgrenze geklemmt wird. */
  meldeRand?: (seite: Seite | null) => void;
  /** Zustand der beiden Daumenknüppel — die Anzeige liegt im DOM und liest ihn. */
  stoecke?: React.RefObject<Stoecke>;
  /** Hält die Laufeingabe an, solange der Kampf die Figur führt (Schlag, Rolle). */
  kampfSperre?: React.RefObject<boolean>;
  /** Ein Ziel ist aufgeschaltet: Der Blick gehört dem Ziel, Q/E und Ziehen drehen nicht (D168). */
  kampfZielt?: React.RefObject<boolean>;
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
  /** D412: Kälteuhr im tiefen Wasser und die zuletzt gemeldete Stufe (0 warm, 1 sinkt, 2 leer). */
  const kaelte = useRef(neueKaelte());
  const kaelteStufe = useRef(0);

  useFrame((_, rohDt) => {
    const p = ziel.current?.position;
    if (!p) return;
    if (sprung?.current) {
      const [sx, sz, sb] = sprung.current;
      sprung.current = null;
      if (sb !== undefined) gier.current = sb;
      p.set(sx, hoeheAufFlaeche(feld, sx, sz), sz);
      steigen.current = 0; fall.current = neuerFall(p.y);
      kaelte.current = neueKaelte(); kaelteStufe.current = 0;
    }
    // Nach einem Tab-Wechsel kommt ein riesiges dt — sonst teleportiert man.
    const dt = Math.min(rohDt, 0.1);
    // Im Kampf gehört die Figur während Schlag und Rolle dem Kampf (ADR-0007):
    // keine Laufeingabe, kein Sprung. Eine Kopie statt die Eingabe zu
    // überschreiben — `vor`/`seit` werden nur bei Tastenereignissen neu
    // berechnet, ein genulltes Feld bliebe nach der Rolle stehen.
    const e0 = eingabe.current;
    const sperre = kampfSperre?.current ?? false;
    const zielt = kampfZielt?.current ?? false;
    let e = sperre ? { ...e0, vor: 0, seit: 0, springen: false, rennen: false } : e0;
    if (sperre) { e0.springen = false; e0.drehDelta = 0; e0.neigDelta = 0; }
    if (zielt) { e = { ...e, drehRate: 0, drehDelta: 0 }; e0.drehDelta = 0; }

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
      // Welche Kante, sagt der Übergang zur Nachbarregion (ADR-0014).
      if (gx !== kx || gz !== kz) meldeRand?.(randSeite(kx, kz, halbB, halbT));
      p.x = gx;
      p.z = gz;
    }
    // Der Boden unter dem Spieler. Auf der GEZEICHNETEN Fläche, nicht auf der
    // stetigen Funktion — sonst schwebt die Figur auf Kuppen sichtbar darüber.
    const boden = hoeheAufFlaeche(feld, p.x, p.z);

    // D461: für das Bild der Figur — ist sie in diesem Bild abgesprungen, hängt sie danach in der Luft?
    let abgesprungen = false, inLuft = false;
    if (e.springen) {
      e.springen = false;
      // Kein Sprung im Wasser. Das ist die eigentliche Wirkung des Watens: Ein
      // Bach wird zum Hindernis, weil man nicht mittendrin abspringen kann.
      if (amBoden && !watet && reicht(ausdauer.current, SPRUNG_KOSTEN)) {
        abgesprungen = true;
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
      // D412: höchstens mit Endgeschwindigkeit (53 m/s) — bis dahin ohne Grenze.
      steigen.current = begrenzeFall(steigen.current - SCHWERKRAFT * dt);
      // Erst fallen lassen, dann bremsen — sonst frisst die Schwerkraft des
      // nächsten Bildes die Bremsung wieder auf und die Sinkrate driftet nach oben.
      if (gleitet) steigen.current = bremse(steigen.current);
      p.y += steigen.current * dt;
      if (p.y <= boden) {
        // D412: Fallschaden am Aufprall, nicht an der Höhe — der Gleiter landet mit 4 m/s
        // schadlos. D413: Rolltaste K kurz vor dem Aufsetzen halbiert ihn (ohne Clip).
        const gerollt = gerolltBeiLandung(e0.rolleUm, performance.now());
        const schaden = fallschaden(-steigen.current, gerollt);
        if (schaden > 0) onKoerper?.('sturz', 1 - schaden);
        // D458: Landezustand aus demselben Aufprall — weich unter der schadlosen Höhe, hart darüber, Rolle mit der
        // Rolltaste (D413). Die Figur liest ihn (`SpielerFigur`); ins Wasser landet niemand hart.
        if (landung?.current && !watet) meldeLandung(landung.current, fallhoeheAus(-steigen.current), BEWEGUNG.fall.schadlosBis, gerollt, FIGUR.landung);
        p.y = boden; steigen.current = 0;
      } else inLuft = !gleitet && !reitet.current;
    }
    // D461: Luftzustand an die Figur (Sprung-Clips). Am Gleiter, im Wasser, am Fels und im Sattel ist sie nicht „in der Luft“.
    if (luft?.current) meldeLuft(luft.current, inLuft, abgesprungen, dt);
    // Nie unter das Gelände: Beim Klettern über eine Kante liegt der Boden am
    // neuen Standort sonst über der Figur. Beim Schwimmen gilt das nicht — dort
    // IST die Figur über der Sohle, nur eben im Wasser.
    if (!schwimmt && p.y < boden) p.y = boden;

    // D412: Kälteuhr. Läuft nur im tiefen Wasser (ab Schwimmtiefe), steht am Ufer wieder
    // auf null, hält mit Anzug an. Gemeldet wird nur der Übergang, nicht jedes Bild.
    kaelte.current = kaelteSchritt(kaelte.current, dt, schwimmt, anzug?.current ?? false);
    const warm = kaelteLeben(kaelte.current);
    const stufeK = warm <= 0 ? 2 : warm < 1 ? 1 : 0;
    if (stufeK !== kaelteStufe.current) {
      kaelteStufe.current = stufeK;
      if (stufeK > 0) onKoerper?.('kaelte', warm);
      // Wer ausgekühlt aufwacht, fängt warm an — das Versetzen setzt die Uhr ohnehin zurück.
      if (stufeK === 2) kaelte.current = neueKaelte();
    }

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
 * Wo `Sword_Slash` ausholt und durchzieht, als Anteil der Cliplänge (1,29 s) — gemessen an der
 * Winkelgeschwindigkeit von Oberarm, Unterarm, Handgelenk, Rumpf (`.cache/hiebzeit.mjs`, D168):
 * erster Buckel bis 0,23 (Ausholen), Ruhe am Scheitel 0,23–0,29, Durchzug 0,29–0,52 mit Spitze bei
 * 0,37, dann Auslaufen. Die drei Phasen der Regel werden **einzeln** auf diese Abschnitte gelegt —
 * die Axt holt dadurch sichtbar lange aus und zieht schnell durch, die Klinge ist durchweg schnell.
 */
const HIEB = { scheitel: 0.29, durchzug: 0.52 };
/**
 * Der Axthieb (D169, `tools/axthieb.py`) als Zeiten in Sekunden: Scheitel Bild 12, Durchzug bis
 * Bild 16, bei 24 Bildern je Sekunde — Clipzeit ist Bild/24 (gemessen: Bild 34 endet bei 1,417 s).
 * Als Zeit statt Anteil; der Anteil wird zur Laufzeit aus der echten Länge gerechnet.
 */
const HIEB_AXT_S = { scheitel: 12 / 24, durchzug: 16 / 24 };

/**
 * Die Waffenclips (D171, `tools/waffenclips.py`) liegen in einer eigenen Datei ohne Netz: nur die
 * Knochen und ihre Animationen. Die Wanderin trüge sie über ihr Budget (250 KB), und gebraucht
 * werden sie nur im Kampf. Gebunden wird über die Knotennamen — dieselben in beiden Dateien.
 *
 * Geladen ohne Suspense: Fehlt die Datei, spielt die Figur weiter `Sword_Slash`/`Axe_Overhead`.
 */
const WAFFENCLIPS = '/figuren/kampf/wanderin-waffen.glb';
const WAFFENMODELLE = '/figuren/kampf/waffen.glb';
function useWaffenClips(): THREE.AnimationClip[] {
  const [clips, setzeClips] = useState<THREE.AnimationClip[]>([]);
  useEffect(() => {
    let lebt = true;
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(WAFFENCLIPS)
      .then(g => { if (lebt) setzeClips(g.animations); })
      .catch(() => { /* ohne Datei: Rückfall auf die zwei Hiebe der Figur */ });
    return () => { lebt = false; };
  }, []);
  return clips;
}

/**
 * Waffen als Geometrie an der rechten Hand (ADR-0008). Kein Asset: ein paar Kästen und Zylinder,
 * in Metern, Klinge entlang −Y wie das Schwert im Quaternius-Paket. Lage aus derselben Datei:
 * `Sword` hängt an `Middle1.R` (0, 0,00091, −0,00025) mit −90° um Z, `Middle1.R` an `Wrist.R`
 * (0, 0,00027, 0). Die Finger sind in der Wanderin entfernt, also direkt an `Wrist.R`.
 */
// D174: `WAFFE_AN_HAND` liegt in `src/kampf/waffenhand.ts` — der Wegelagerer trägt dieselbe Klinge.

/**
 * D184: Waffen am Körper tragen. Kopien der Kastenmodelle, in der Ruhepose im Raum der Figur gelegt
 * (Meter; Blick −Z, rechts = +X, Rücken = +Z) und dann mit `attach` an den Knochen gehängt — `attach`
 * behält die Weltlage, der Knochen trägt sie danach mit. Speer und Axt über Kreuz am oberen Rücken
 * (`spine_03`), die Klinge schräg an der linken Hüfte (`pelvis`). Die Waffenachse zeigt in der Gruppe
 * nach −Y; `dir` ist, wohin sie am Körper zeigen soll, `mitte` der Punkt auf der Achse, der dort sitzt.
 */
function trageAmKoerper(scene: THREE.Object3D, w: Record<'klinge' | 'axt' | 'speer', THREE.Group>) {
  const aus: Partial<Record<'klinge' | 'axt' | 'speer', THREE.Object3D>> = {};
  const lagen = {
    speer: { knochen: ['spine_03', 'Chest'], dir: [-0.36, 0.93, 0], mitte: [0.0, 1.28, 0.16], auf: 0.55 },
    axt: { knochen: ['spine_03', 'Chest'], dir: [0.42, 0.9, 0], mitte: [0.0, 1.22, 0.2], auf: 0.36 },
    klinge: { knochen: ['pelvis', 'Hips'], dir: [0.1, -0.94, 0.32], mitte: [-0.2, 0.86, 0.06], auf: 0.25 },
  } as const;
  scene.updateMatrixWorld(true);
  const wurzel = new THREE.Matrix4().copy(scene.matrixWorld);
  for (const art of ['speer', 'axt', 'klinge'] as const) {
    const l = lagen[art];
    const knochen = l.knochen.map(n => scene.getObjectByName(n)).find(Boolean);
    if (!knochen) continue;
    // Reste einer früheren Figur an derselben (geteilten) Szene abnehmen — sonst hängen zwei Sätze.
    const alt: THREE.Object3D[] = [];
    scene.traverse(o => { if (o.name === `Koerper_${art}`) alt.push(o); });
    for (const o of alt) o.removeFromParent();
    const kopie = new THREE.Group();
    kopie.name = `Koerper_${art}`;
    for (const c of w[art].children) kopie.add(c.clone());
    const dir = new THREE.Vector3(...l.dir).normalize();
    kopie.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    kopie.position.set(l.mitte[0], l.mitte[1], l.mitte[2]).addScaledVector(dir, -l.auf);
    // In den Weltraum der Figurwurzel, dann an den Knochen — Lage bleibt.
    kopie.applyMatrix4(wurzel);
    scene.parent ? scene.parent.add(kopie) : scene.add(kopie);
    knochen.attach(kopie);
    aus[art] = kopie;
  }
  return aus;
}

/** D188: `?pose=Clip,Anteil,Waffe` friert die Figur in einem Clip ein (Bildprüfung von Griff und Klinge). */
const POSE_PROBE: [string, number, 'klinge' | 'axt' | 'speer'] | null = (() => {
  if (typeof location === 'undefined') return null;
  const r = new URLSearchParams(location.search).get('pose');
  if (!r) return null;
  const [c, t, w] = r.split(',');
  return [c, Math.min(0.999, Math.max(0, Number(t) || 0)), (w === 'axt' || w === 'speer' ? w : 'klinge')];
})();

/** Block-Clip je Waffe (D173/D174/D184). */
// D458 (A-51 (1)): Die Deckung der Klinge ist `Klinge_Block` (D456, beginnt in der Hut) — der UAL2-Clip
// `Klinge_U_Block` wird nicht mehr gebraucht; `BLOCKCLIP_HUT` aus D457 ist damit überflüssig.
const BLOCKCLIP = { klinge: 'Klinge_Block', axt: 'Axt_Block', speer: 'Speer_Block' } as const;
/** D456/D457: Der Markengriff (D417) hat einen eigenen Clip; fehlt er, steht die Figur wie bisher in der Deckung. */
const GRIFFCLIP = 'Koerper_Griff';

function baueWaffen(): Record<'klinge' | 'axt' | 'speer', THREE.Group> {
  const metall = new THREE.MeshStandardMaterial({ color: '#77736b', roughness: 0.45, metalness: 0.6 });
  const holz = new THREE.MeshStandardMaterial({ color: '#5a4431', roughness: 0.8 });
  const teil = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number, x = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, 0); m.castShadow = true; return m;
  };
  const klinge = new THREE.Group();
  klinge.add(teil(new THREE.CylinderGeometry(0.018, 0.02, 0.2, 8), holz, 0));
  klinge.add(teil(new THREE.BoxGeometry(0.17, 0.03, 0.045), metall, -0.11));
  klinge.add(teil(new THREE.BoxGeometry(0.045, 0.6, 0.012), metall, -0.42));
  // Die Axt: langer Stiel, der Kopf am Ende, Schneide quer zum Stiel. Die Schneide liegt auf −X der
  // Gruppe, das ist +Y des Handgelenks — dieselbe Richtung wie die Finger (D171). Bis D170 lag sie
  // auf +X und schlug mit dem Rücken zu; gesehen erst, als `waffenclips.py` die Schneide in
  // Bewegungsrichtung legte.
  const axt = new THREE.Group();
  axt.add(teil(new THREE.CylinderGeometry(0.02, 0.024, 0.95, 8), holz, -0.36));
  axt.add(teil(new THREE.BoxGeometry(0.2, 0.12, 0.045), metall, -0.76, -0.05));
  axt.add(teil(new THREE.BoxGeometry(0.03, 0.2, 0.05), metall, -0.76, -0.16));
  // D183: Der Speer — Eschenschaft 2 m, die Hand sitzt im hinteren Drittel, Spitze auf −Y wie die Klinge.
  const speer = baueSpeer();
  for (const g of [klinge, axt, speer]) {
    g.position.copy(WAFFE_AN_HAND.position);
    g.quaternion.copy(WAFFE_AN_HAND.drehung);
    g.scale.setScalar(WAFFE_AN_HAND.massstab);
    g.visible = false;
  }
  return { klinge, axt, speer };
}

/**
 * Die Spielerfigur — seit D143 ein **SkinnedMesh** aus der Menschenkette
 * (`tools/menschbau.py`, Quaternius CC0), nicht mehr die geloftete Figur aus
 * Teilen (D139, `figur.ts` bleibt als Rueckfall und fuer die Masse HUEFTE/SCHULTER).
 *
 * Ein Tier atmet und geht im Shader; ein Mensch braucht Huefte, Knie und
 * Ellbogen, und die liefert das Rig des Pakets billiger als jede Formel: ein
 * Draw Call, 24 Knochen, acht Clips (Idle, Walk, Run; seit D167 dazu Sword_Slash, seit D169 Axe_Overhead,
 * Roll, HitRecieve, Death für den Kampf, gestreckt auf die Dauer der Regel). Der
 * `AnimationMixer` blendet nach Tempo: steht → Idle, geht → Walk, rennt → Run;
 * die Abspielgeschwindigkeit folgt dem Tempo, damit die Fuesse nicht rutschen.
 * Das Material ist dasselbe Wind-/Randmaterial wie bei den Kreaturen —
 * three.js setzt USE_SKINNING selbst, die Injektionen laufen vor dem Skinning.
 *
 * Reiten (D93, D145): Im Sattel spielt die Figur Idle, wird um den Widerrist
 * angehoben und bekommt die Sitzpose ueber drei Winkel je Bein (`sitzpose`).
 */
function SpielerFigur({ gier, schritt, rand, reittier, kampf, waffenStufen, hoeheAn, landung, luft }: {
  gier: React.RefObject<number>;
  /** D461: Luftzustand aus der Bewegung (`Spieler` schreibt ihn je Bild) — Absprung, Flughaltung. */
  luft?: React.RefObject<Luft>;
  /** D458: Landezustand aus der Bewegung (`Spieler` schreibt ihn beim Aufsetzen). */
  landung?: React.RefObject<Landung>;
  /** Geländehöhe für die Füsse (D214). Ohne sie bleiben die Füsse, wo der Clip sie hinsetzt. */
  hoeheAn?: (x: number, z: number) => number;
  /** Schmiedestufen (D178): Stufe 1–2 heller geschliffen, Stufe 3 ein anderes Modell. */
  waffenStufen?: { klinge: number; axt: number; speer?: number; funke?: 'wasser' | 'stein' };
  /** Kampfzustand (D167): Schlag, Rolle, Treffer, Fall als Clip. Ohne Kampf null. */
  kampf?: React.RefObject<KampfFigur | null>;
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
  // D175: die Hauptfigur aus dem Charakter-Editor (Universal Base Characters, `tools/heldbau.py`).
  // `?figur=alt` zeigt die alte Wanderin zum Vergleich.
  const wahl = useHeldWahl();
  const held = !!wahl && !ALTE_FIGUR;
  const { scene, animations: eigeneClips } = useGLTF(held ? gestaltPfad(wahl!) : '/figuren/wanderin.glb');
  const heldClips = useGLTF(held ? HELD_CLIPS : '/figuren/wanderin.glb').animations;
  const animations = held ? heldClips : eigeneClips;
  const alteWaffenClips = useWaffenClips();
  const waffenClips = held ? KEINE_CLIPS : alteWaffenClips;
  /** Sitzhoehe aus dem Modell (`ReittierModell` schreibt sie), sonst aus der Silhouette. */
  const sitzHoehe = useRef<{ hoehe: number; breite: number } | null>(null);
  const mitModell = !!reittier && MIT_MODELL.has(reittier.kreatur);
  const { material, setzeRand } = useMemo(() => baueWindMaterial({
    amplitude: 0, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke,
  }), []);
  useEffect(() => {
    setzeRand(new THREE.Color(rand.farbe), rand.staerke);
  }, [setzeRand, rand]);
  // Material tauschen und Schatten setzen — einmal je Szene. Die neue Figur behält ihre Texturen
  // und bekommt die Wahl aus dem Editor (Frisur, Haut, Haar).
  const fuss = useRef<FussZustand>(neuerFussZustand());
  const himmelKarte = useHimmelKarte();
  // D213: Saum für die neuen Gestalten aus derselben Randfarbe wie Kreaturen und alte Figur.
  useEffect(() => { setzeFigurSaum(rand.farbe, rand.staerke); }, [rand]);
  useEffect(() => {
    if (held) { legeWahlAn(scene, wahl!, MILBINGERLICHT_AN); setzeFigurUmgebung(scene, himmelKarte); return; }
    scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.material = material; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
    });
  }, [scene, material, held, wahl, himmelKarte]);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const clips = useMemo(() => {
    const finde = (n: string) => animations.find(c => c.name === n) ?? animations[0];
    const clip = (n: string) => mixer.clipAction(finde(n));
    const idle = clip('Idle'), walk = clip('Walk'), run = clip('Run');
    // Kampfclips (D167) — einmal gespielt. Fehlen sie in der Datei, fällt `finde` auf den ersten
    // Clip zurück; dann steht die Figur im Kampf eben still statt in T-Pose.
    const einmal = (n: string, halten = false) => {
      const a = clip(n);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = halten;
      return a;
    };
    const schlag = einmal('Sword_Slash'), rolle = einmal('Roll');
    // Fehlt der Axthieb in der Datei (alter Stand), schlägt die Axt mit dem Schwerthieb.
    const axt = animations.some(c => c.name === 'Axe_Overhead') ? einmal('Axe_Overhead') : schlag;
    const treffer = einmal('HitRecieve'), tod = einmal('Death', true);
    // Nur Idle laeuft; Walk und Run werden beim Wechsel eingeblendet.
    // **Nicht** mit `setEffectiveWeight(0)` vorhalten (G-133): Das Gewicht ist
    // der Faktor, mit dem `fadeIn` multipliziert — 0 mal Einblendung bleibt 0,
    // und die Figur lief bis D145 als T-Pose, weil Idle ausblendete und nichts
    // einblendete. Gesehen wurde das erst, als der Gang im Lauf gemessen wurde.
    // Gestartet wird Idle im Effekt unten, nicht hier (G-137).
    return { idle, walk, run, schlag, axt, rolle, treffer, tod, aktiv: idle as THREE.AnimationAction };
  }, [mixer, animations]);
  /**
   * D457: Laufzeit der Bewegung (`src/figur/`) — Inertialisierung der Wechsel, Gang ans Tempo gekoppelt, Ebenen,
   * Körper über den Clips. Nur für die Gestalten mit dem Skelett `RIG_MENSCH`; die alte Wanderin (`?figur=alt`)
   * und alles mit `figurfein` aus läuft den Weg von vor D457 weiter unten unverändert.
   */
  const lz = useMemo(() => {
    if (!held) return null;
    const fuesse = RIG_MENSCH.beine.map(b => scene.getObjectByName(b.fuss)).filter((o): o is THREE.Object3D => !!o);
    if (fuesse.length !== RIG_MENSCH.beine.length) return null;
    // D461: Gangarten der Spielfigur aus den Daten (`gang.stufen`: Gang, Laufschritt, Sprint — die Clips von D460). Fehlt
    // einer in der Datei, gilt das Paar `Walk`/`Run` von D457. `Walk` bleibt, wie es ist: Gegner und Bewohner spielen ihn.
    const g = FIGUR.gang;
    const neueClips = g.stufen.map(s => animations.find(c => c.name === s.clip));
    const mitStufen = neueClips.every(c => !!c);
    const gangClips = (mitStufen ? neueClips : ['Walk', 'Run'].map(n => animations.find(c => c.name === n))) as (THREE.AnimationClip | undefined)[];
    if (gangClips.some(c => !c)) return null;
    // Wie schnell jeder Gangclip wirklich über den Boden kommt: am Clip gemessen, nicht geschätzt — die Clips von D460
    // am **Aufstandspunkt** (Fersenkante/Ballen; sie rollen ab, der Knöchel läuft dem Boden voraus), 64 Proben, weil
    // der Sprint nur 0,10 s am Boden steht.
    const ballen = RIG_MENSCH.beine.map(b => (b.ballen ? scene.getObjectByName(b.ballen) : null)).filter((o): o is THREE.Object3D => !!o);
    const sohle = mitStufen && ballen.length === fuesse.length ? { ballen, mass: g.sohle } : undefined;
    const mess = gangClips.map(c => messeGang(scene, c!, fuesse, g.standHoehe, sohle ? 64 : 32, sohle));
    const rueckfall = mitStufen ? g.stufen.map(s => s.tempo) : [g.gehen, g.rennen];
    const ober = nachfahren(elternkarte(scene), RIG_MENSCH.oberAb);
    const teile = new Map<string, { ober: THREE.AnimationAction; unter: THREE.AnimationAction } | null>();
    /** Ober- und Unterkörper eines Clips als eigene Aktionen (Ebenen). `halten`: einmal spielen und stehen bleiben. */
    const teil = (name: string, halten = false) => {
      if (!teile.has(name)) {
        const c = animations.find(x => x.name === name);
        if (!c) teile.set(name, null);
        else {
          const t = teileClip(c, ober);
          const a = { ober: mixer.clipAction(t.ober), unter: mixer.clipAction(t.unter) };
          if (halten) for (const x of [a.ober, a.unter]) { x.setLoop(THREE.LoopOnce, 1); x.clampWhenFinished = true; }
          teile.set(name, a);
        }
      }
      return teile.get(name)!;
    };
    // Aufsteigend nach Tempo (`gangStufen` verlangt es): eine Messung, die das umkehrte, wird auf Abstand gehalten.
    const gaenge: Gang[] = [];
    gangClips.forEach((c, i) => {
      const v = mess[i].tempo ?? rueckfall[i];
      gaenge.push({ tempo: i ? Math.max(v, gaenge[i - 1].tempo + 0.5) : v, dauer: c!.duration });
    });
    // Alle Gangarten im selben Schritt: Versatz der Kontaktmitten des ersten Fusses gegen die langsamste (die Clips
    // beginnen nicht an derselben Stelle des Schritts).
    const m0 = mess[0].standMitte;
    const stufen = gangClips.map((c, i) => {
      const t = teil(c!.name)!, mi = mess[i].standMitte;
      return { unter: t.unter, ober: t.ober, dauer: c!.duration, versatz: m0 !== null && mi !== null ? (mi - m0 + 1) % 1 : 0 };
    });
    const eingabe: FeinEingabe = { gier: 0, tempo: 0, rennen: RENNEN, straff: 0, fokus: null, steht: true, hoeheAn: undefined, fuesse: true, halten: true, staerke: 1, weite: 1 };
    // `gehen`/`rennen`/`versatz` bleiben für die Konsole von D457 stehen: langsamste und schnellste Gangart, Versatz der zweiten.
    const messung = {
      bilder: 0, ms: 0, msMittel: 0, gehen: gaenge[0].tempo, rennen: gaenge[gaenge.length - 1].tempo, versatz: stufen[1].versatz,
      gemessen: mess.every(m => m.tempo !== null), rate: 0, weite: 1, gleiten: 0,
      // D461: je Gangart Clip, gemessenes Tempo (m/s bei Rate 1), ob am Aufstandspunkt gemessen, die Knöchelmessung daneben;
      // im Bild: Stufe, Anteil der nächsten, Abspielrate gegen den Clip (1 = wie gebaut).
      clips: gangClips.map(c => c!.name), tempi: gaenge.map(x => x.tempo), amAufstand: mess.map(m => m.amAufstand),
      knoechel: mess.map(m => m.tempoKnoechel), stufe: 0, anteil: 0, clipRate: 1, wenden: 0,
    };
    if (typeof window !== 'undefined') (window as unknown as { __figurfein?: typeof messung }).__figurfein = messung;
    // D461, Wenden im Stand: Mitte des Stands im Raum der Figurgruppe (dort drehen die Wendeclips), am Standclip gelesen.
    const mitte: [number, number] = [0, 0];
    const fein = new Koerperfein(scene, RIG_MENSCH, mess[0].tief);
    const standClip = animations.find(c => c.name === FIGUR.wenden.stand);
    if (standClip) {
      const mx = new THREE.AnimationMixer(scene), a = mx.clipAction(standClip), v = new THREE.Vector3();
      a.play(); mx.update(0);
      scene.updateMatrixWorld(true);
      const eltern = scene.parent;
      for (const f of fuesse) {
        f.getWorldPosition(v);
        if (eltern) eltern.worldToLocal(v); else v.applyMatrix4(scene.matrixWorld.clone().invert()).applyMatrix4(scene.matrix);
        mitte[0] += v.x / fuesse.length; mitte[1] += v.z / fuesse.length;
      }
      // Die Hüftlinie des Stands ist der Nullpunkt, gegen den der Winkel eines Wendeclips gelesen wird.
      fein.eicheHuefte();
      mx.stopAllAction(); mx.uncacheRoot(scene);
    }
    const wendeClips = FIGUR.wenden.clips;
    const wd = (n: string) => animations.find(c => c.name === n)?.duration ?? 0;
    const wendeDauern = { wenden: Math.min(wd(wendeClips.wendenLinks), wd(wendeClips.wendenRechts)), kehrt: Math.min(wd(wendeClips.kehrtLinks), wd(wendeClips.kehrtRechts)) };
    // Knochen unter dem Oberkörper (Wurzel, Becken, Beine): Sie wechseln in den Wendeclip hart (`PosenTraegheit.wechsel`).
    const unterKnochen = new Set(sammleKnochen(scene).map(k => k.name).filter(n => !ober.has(n)));
    return {
      traegheit: new PosenTraegheit(sammleKnochen(scene)), fein,
      gaenge, stufen, teil,
      wende: neueWende(), mitte, wendeDauern, wendeDa: wendeDauern.wenden > 0 && wendeDauern.kehrt > 0 && !!standClip, unterKnochen,
      phase: 0, gangLage: 0, schluessel: '', art: 'stand' as Bewegungsart, ausKette: false, an: null as boolean | null,
      aktiv: new Set<THREE.AnimationAction>(), sollA: [] as THREE.AnimationAction[], sollW: [] as number[],
      marke: { scheitel: 0, durchzug: 0, dauer: 0 } as Hiebmarken, eingabe, messung,
    };
  }, [held, scene, mixer, animations]);
  /**
   * Clip je Name, aus der Figur oder aus den Waffenclips (D171), einmal angelegt. `null`, wenn es
   * ihn nicht gibt — dann entscheidet der Aufrufer über den Rückfall.
   */
  const aktionen = useMemo(() => {
    const cache = new Map<string, THREE.AnimationAction | null>();
    return (name: string, einmal = true): THREE.AnimationAction | null => {
      if (cache.has(name)) return cache.get(name)!;
      const c = waffenClips.find(x => x.name === name) ?? animations.find(x => x.name === name);
      let a: THREE.AnimationAction | null = null;
      if (c) {
        a = mixer.clipAction(c);
        if (einmal) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; }
      }
      cache.set(name, a);
      return a;
    };
  }, [mixer, animations, waffenClips]);
  /** Welche Aktionen Hiebe sind — deren Zeit wird gesetzt, nicht abgespielt. */
  const hiebe = useRef(new Set<THREE.AnimationAction>());
  /** Was zuletzt aus dem Kampf gesehen wurde — ein neuer Zählerstand startet den Clip neu. */
  const kampfVor = useRef({ schwung: -1, rollen: -1, getroffen: -1, trefferBis: 0, uhr: 0 });
  /** D458: zuletzt gesehene Landung — ein neuer Zählerstand startet den Landeclip. */
  const landVor = useRef({ nr: -1, art: null as Landeart | null, seit: 1e9 });
  /** D461: zuletzt gesehener Flug — ein neuer Zählerstand startet den Abdruck von vorn. */
  const luftVor = useRef(-1);
  /** Klinge und Axt an `Wrist.R`; sichtbar nur mit Kampf (D168). */
  const waffen = useMemo(() => {
    const w = baueWaffen();
    const hand = scene.getObjectByName('WristR') ?? scene.getObjectByName('Wrist.R');
    if (hand) { hand.add(w.klinge); hand.add(w.axt); hand.add(w.speer); }
    else {
      // D175: neues Skelett — `hand_r` mit eigener Lage (`waffenhand.ts`).
      const h = scene.getObjectByName(HELD_KNOCHEN.hand);
      if (h) for (const g of [w.klinge, w.axt, w.speer]) { h.add(g); legeAnHeldHand(g); }
    }
    return { ...w, ruecken: trageAmKoerper(scene, w) };
  }, [scene]);
  // D173: die Modelle aus `waffen.glb` ersetzen die Kästen, sobald die Datei geladen ist. Ohne Datei bleiben die
  // Kästen. D421: eigene, realistische Modelle (`tools/waffenmodelle.py`) statt des Medieval Weapons Pack, und der
  // Speer kommt jetzt auch aus der Datei (Saufeder, `Speer`/`Speer3`) statt aus `baueSpeer` — Länge und Griff gleich.
  useEffect(() => {
    let lebt = true;
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(WAFFENMODELLE).then(g => {
      if (!lebt) return;
      for (const [name, gruppe] of [['Klinge', waffen.klinge], ['Axt', waffen.axt], ['Speer', waffen.speer]] as const) {
        const m = g.scene.getObjectByName(name);
        if (!m) continue;
        gruppe.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
        gruppe.clear();
        // D178: Stufe 3 („meisterlich“) ist ein eigenes Modell — beide hängen in der Gruppe, eins sichtbar.
        for (const teil of [m, g.scene.getObjectByName(name + '3')]) {
          if (!teil) continue;
          // D188: Die Lage aus der Datei bleibt — `waffenbau.py` legt den Griff in den Ursprung (Klinge −0,315,
          // Axt −0,42). Das frühere Nullsetzen schob die Modelle um diese Strecke: Die Hand hielt die Klinge
          // mitten auf dem Blatt und die Axt am Kopf (im Standbild `?pose=` gefunden).
          teil.traverse(o => {
            if (!(o instanceof THREE.Mesh)) return;
            o.castShadow = true;
            o.material = (o.material as THREE.Material).clone();
          });
          gruppe.add(teil);
        }
        // D429: Zweihand-Fällaxt — der Ursprung liegt an der vorderen Griffstelle, die linke Hand hält das Stielende
        // (`griff_links` aus `tools/waffenmodelle.py`); die Szene lässt den Stiel je Bild durch die rechte Hand gleiten.
        // Die alte Wanderin spielt noch die alten Clips (rechte Hand am Ende): ihr Modell sitzt wie vor D429.
        const griffLinks = (m.userData as { griff_links?: number }).griff_links;
        if (name === 'Axt' && typeof griffLinks === 'number') {
          if (held) gruppe.userData.griffLinks = griffLinks;
          else for (const c of gruppe.children) c.position.y += AXT_URSPRUNG_VOR_D429;
        }
        // D185: Die Kopie am Körper bekommt dasselbe Modell (Materialien geteilt — die Schmiedestufe
        // färbt beide), statt der Kästen. D429: Die Axt am Rücken sitzt wie vor D429 (Versatz des Ursprungs).
        const koerper = waffen.ruecken[name === 'Klinge' ? 'klinge' : name === 'Axt' ? 'axt' : 'speer'];
        if (koerper) {
          koerper.clear();
          for (const c of gruppe.children) {
            const k = c.clone();
            if (name === 'Axt' && held && typeof griffLinks === 'number') k.position.y += AXT_URSPRUNG_VOR_D429;
            koerper.add(k);
          }
        }
      }
      setWaffenGeladen(true);
    }).catch(() => { /* Rückfall: Kästen */ });
    return () => { lebt = false; };
  }, [waffen, held]);
  /** D429: Die Fällaxt gleitet durch die rechte Hand, die linke hält das Stielende — nach jedem Mixer-Schritt. */
  const stielHaende = useMemo(() => {
    const r = scene.getObjectByName(HELD_KNOCHEN.hand), l = scene.getObjectByName(HELD_KNOCHEN.handL);
    return r && l ? { r, l } : null;
  }, [scene]);
  const gleiteAxt = () => {
    const links = waffen.axt.userData.griffLinks as number | undefined;
    if (held && stielHaende && waffen.axt.visible && typeof links === 'number') gleiteAmStiel(waffen.axt, stielHaende.r, stielHaende.l, links);
  };
  // D178: Aussehen nach Schmiedestufe. Stufe 1/2: Stahl heller und glänzender (geschliffen, gehärtet),
  // Stufe 3: das meisterliche Modell statt des einfachen.
  const [waffenGeladen, setWaffenGeladen] = useState(false);
  useEffect(() => {
    for (const [art, gruppe] of [['klinge', waffen.klinge], ['axt', waffen.axt], ['speer', waffen.speer]] as const) {
      const stufe = waffenStufen?.[art] ?? 0;
      // D186: auch der Speer hat ein Meistermodell (`baueSpeer`).
      const [einfach, meister] = gruppe.children;
      if (meister) { einfach.visible = stufe < 3; meister.visible = stufe >= 3; }
      const [ke, km] = waffen.ruecken[art]?.children ?? [];
      if (km) { ke.visible = stufe < 3; km.visible = stufe >= 3; }
      einfach?.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        const mat = o.material as THREE.MeshStandardMaterial;
        if (!/Steel/.test(mat.name)) return;
        mat.userData.grund ??= mat.color.clone();
        mat.color.copy(mat.userData.grund as THREE.Color).multiplyScalar(1 + 0.35 * Math.min(2, stufe));
        mat.metalness = Math.min(1, 0.5 + 0.2 * stufe);
        mat.roughness = Math.max(0.2, 0.6 - 0.15 * stufe);
      });
    }
  }, [waffen, waffenStufen, waffenGeladen]);
  useEffect(() => () => {
    for (const g of [waffen.klinge, waffen.axt, waffen.speer]) {
      g.removeFromParent();
      g.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
    }
    // D184: Die Körperkopien hängen an Knochen der geteilten (useGLTF-)Szene — ohne Abnehmen trüge die
    // nächste Figur die alten mit (im Bild gefunden: Speer zugleich in der Hand und am Rücken).
    for (const r of Object.values(waffen.ruecken)) r?.removeFromParent();
  }, [waffen]);
  /**
   * G-137: Idle hier starten, nicht im `useMemo`. `main.tsx` rendert in `<StrictMode>`, und im
   * Dev-Server hängt React jede Komponente einmal ab und wieder an: Die Aufräumfunktion stoppt alle
   * Clips, das `useMemo` läuft aber nicht noch einmal. Idle blieb gestoppt (`isRunning() === false`
   * bei Gewicht 1), und weil die Clipwahl nur bei einem **Wechsel** neu startet, stand die Figur
   * im Stand in der Ruhepose des Skeletts — T-Pose —, bis sie einmal ging. Gemessen 07.10.2026
   * per Laufzeitsonde im Headless-Browser; der Produktions-Build war nicht betroffen.
   */
  useEffect(() => {
    clips.idle.reset().play(); clips.aktiv = clips.idle;
    return () => { mixer.stopAllAction(); };
  }, [mixer, clips]);
  // Die Beinknochen fuer die Sitzpose (D145). GLTFLoader streicht den Punkt aus
  // den Namen (`UpperLeg.L` → `UpperLegL`); beide Schreibweisen werden gesucht.
  const beine = useMemo(() => {
    const k = (n: string) => scene.getObjectByName(n.replace('.', '')) ?? scene.getObjectByName(n) ?? null;
    if (scene.getObjectByName('pelvis')) {
      const h = (n: keyof typeof HELD_KNOCHEN) => scene.getObjectByName(HELD_KNOCHEN[n]) ?? null;
      return { ol: h('ol'), or: h('or'), ul: h('ul'), ur: h('ur'), fl: h('fl'), fr: h('fr'),
               al: h('al'), ar: h('ar'), el: h('el'), er: h('er') } as SitzKnochen;
    }
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
    if (POSE_PROBE) {
      // D188: Standbild eines Clips mit Waffe — zum Prüfen von Griff und Klingenlage.
      const [clip, anteil, waffe] = POSE_PROBE;
      const a = aktionen(clip, false);
      waffen.klinge.visible = waffe === 'klinge'; waffen.axt.visible = waffe === 'axt'; waffen.speer.visible = waffe === 'speer';
      for (const art of ['klinge', 'axt', 'speer'] as const) { const r = waffen.ruecken[art]; if (r) r.visible = false; }
      if (a) {
        if (!a.isRunning()) { mixer.stopAllAction(); a.play(); }
        a.paused = false; a.time = a.getClip().duration * anteil; a.timeScale = 0; a.weight = 1;
        mixer.update(0);
        gleiteAxt();
      }
      if (gruppe.current) gruppe.current.rotation.y = gier.current;
      return;
    }
    const k = reittier ? null : kampf?.current ?? null;
    // In der Rolle schaut die Figur dorthin, wohin sie rollt — rückwärts ausweichen heisst
    // umdrehen und vorwärts rollen, nicht rückwärts purzeln.
    if (gruppe.current) {
      gruppe.current.rotation.y = k?.phase === 'rolle' && k.rolleBlick !== null ? k.rolleBlick : gier.current;
    }
    waffen.klinge.visible = !!k && k.waffe === 'klinge';
    waffen.axt.visible = !!k && k.waffe === 'axt';
    waffen.speer.visible = !!k && k.waffe === 'speer';
    // D188: Kernfunke — die Waffe in der Hand schimmert mit der Ladung, voll pulsiert sie wasserblau.
    if (k?.waffe) {
      const l = k.element ? k.ladung ?? 0 : 0;
      const staerke = l >= 1 ? 0.55 + 0.35 * Math.sin(performance.now() / 140) : l * 0.25;
      waffen[k.waffe].traverse(o => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!m || !('emissive' in m)) return;
        if (k.element === 'stein') m.emissive.setRGB(0.85, 0.6, 0.3); else m.emissive.setRGB(0.15, 0.55, 1.0);
        m.emissiveIntensity = staerke;
      });
    }
    // D184: Was nicht in der Hand ist, hängt am Körper — Speer und Axt über Kreuz am Rücken, Klinge am Gürtel.
    for (const art of ['klinge', 'axt', 'speer'] as const) {
      const r = waffen.ruecken[art];
      if (r) r.visible = !reittier && !(k && k.waffe === art);
    }
    const { phase, tempo } = schritt.current;
    const stark = Math.min(1, tempo / RENNEN);
    // Clip nach Tempo, weich ueberblendet; im Sattel immer Idle.
    // D217: Schwelle mit Abstand — bei 5,5 m/s flackerte die Figur zwischen Gehen und Laufen,
    // wenn das Tempo um die Grenze pendelte (Hang, Ausdauer). Hoch bei 5,5, zurück bei 4,8.
    const laeuft = clips.aktiv === clips.run;
    let ziel = reittier || tempo < 0.15 ? clips.idle : tempo < (laeuft ? 4.8 : 5.5) ? clips.walk : clips.run;
    // D457: was die Figur zeigt — daraus die Dauer des Übergangs (`figur/kette.ts`); der alte Weg braucht es nicht.
    let art: Bewegungsart = ziel === clips.idle ? 'stand' : 'gang';
    let hScheitel = -1, hDurchzug = -1, neuGetroffen = false;
    // Im Kampf steht sie in der Haltung ihrer Waffe (D171), nicht in der Ruhe des Wanderns.
    if (k && k.phase === 'bereit' && ziel === clips.idle) { ziel = aktionen(k.haltung, false) ?? clips.idle; art = ziel === clips.idle ? 'stand' : 'hut'; }
    // ---- Kampf (D167): Clip nach Phase, gestreckt auf die Dauer der Regel. Die Regel ist die
    // Wahrheit (`echtzeit.ts`, Kampftor); der Clip folgt ihr, nie umgekehrt.
    let neu = false, blende = 0.25;
    const kv = kampfVor.current;
    kv.uhr += dt;
    if (k) {
      if (k.getroffen !== kv.getroffen) {
        if (kv.getroffen >= 0 && k.getroffen > kv.getroffen) { kv.trefferBis = kv.uhr + 0.35; neuGetroffen = true; }
        kv.getroffen = k.getroffen;
      }
      if (k.phase === 'gefallen') {
        ziel = clips.tod; blende = 0.15; art = 'fall';
      } else if ((k.phase === 'block' || k.phase === 'reinigen') && aktionen(BLOCKCLIP[k.waffe ?? 'klinge'], true)) {
        // D173: Deckung heben und halten — der Clip bleibt auf seinem letzten Bild stehen. D174: die Axt
        // hat ihren eigenen (Stiel quer, `waffenclips.py`). D417: Auch der Markengriff steht so — es gibt
        // keinen Griff-Clip (offen, D414); der gehobene Arm ist die nächste vorhandene Haltung.
        const w = k.waffe ?? 'klinge';
        const griff = k.phase === 'reinigen' ? aktionen(GRIFFCLIP, true) : null;
        const b = griff ?? aktionen(BLOCKCLIP[w], true)!;
        // Die Deckung hebt doppelt so schnell, wie der Clip sie zeigt (D173); der Griff läuft, wie er gebaut ist.
        b.clampWhenFinished = true; b.timeScale = griff ? 1 : 2;
        ziel = b; blende = 0.06; art = 'block';
      } else if (k.phase === 'rolle') {
        ziel = clips.rolle; blende = 0.06; art = 'rolle';
        neu = k.rollen !== kv.rollen;
        // Der Clip ist 1,67 s lang, die Rolle 0,55 s. Voll gestreckt wäre das ein Wischer; also
        // läuft er 0,2 s über die Rolle hinaus aus und wird dabei in die Fortbewegung überblendet.
        clips.rolle.timeScale = clips.rolle.getClip().duration / (k.rolleDauer + 0.2);
      } else if (k.phase === 'vorlauf' || k.phase === 'aktiv' || k.phase === 'erholung') {
        // Der Clip des Schlags (D171), sonst der Hieb der Waffe aus der Figur.
        let hieb = aktionen(k.clip);
        let h = hieb ? k.hieb : null;
        if (!hieb || !h) {
          hieb = k.waffe === 'axt' ? clips.axt : clips.schlag;
          const d = hieb.getClip().duration;
          h = hieb === clips.axt && clips.axt !== clips.schlag ? HIEB_AXT_S
            : { scheitel: HIEB.scheitel * d, durchzug: HIEB.durchzug * d };
        }
        hiebe.current.add(hieb);
        // Aus einem Hieb in den nächsten (Kette) weicher als aus dem Stand: Die Arme kommen aus
        // dem Durchzug des vorigen, nicht aus der Ruhe.
        blende = hiebe.current.has(clips.aktiv) && clips.aktiv !== hieb ? 0.12 : 0.06;
        ziel = hieb;
        neu = k.schwung !== kv.schwung;
        // Die Clipzeit wird je Bild gesetzt, nicht abgespielt: Jede Phase der Regel liegt auf
        // ihrem eigenen Abschnitt des Clips (Scheitel, Durchzug in Clipsekunden).
        const dauer = hieb.getClip().duration;
        const sek = k.phase === 'vorlauf' ? h.scheitel * Math.min(1, k.zeit / k.vorlauf)
          : k.phase === 'aktiv' ? h.scheitel + (h.durchzug - h.scheitel) * Math.min(1, k.zeit / k.aktiv)
          : h.durchzug + (dauer - h.durchzug) * Math.min(1, k.zeit / k.erholung);
        hieb.timeScale = 0;
        hieb.time = Math.min(sek, dauer * 0.999);
        art = 'hieb'; hScheitel = h.scheitel; hDurchzug = h.durchzug;
      } else if (k.phase === 'betaeubt' || k.phase === 'zucken' || kv.uhr < kv.trefferBis) {
        // D173: betäubt taumelt (UAL2 `Kampf_Taumeln`), sonst der Rückstoß; ohne Waffendatei HitRecieve.
        const t = (k.phase === 'betaeubt' ? aktionen('Kampf_Taumeln') : aktionen('Kampf_Rueckstoss')) ?? clips.treffer;
        ziel = t; blende = 0.08; art = 'treffer';
        neu = clips.aktiv !== t;
      }
      kv.schwung = k.schwung; kv.rollen = k.rollen;
    }
    const fein = !!lz && figurfeinAn();
    // ---- D458: Landung (`figur/landung.ts`). Der Zustand kommt aus der Bewegung (Aufprall, D412/D413); gespielt
    // wird er nur, wo der Kampf die Figur nicht führt. Im Stand der ganze Clip; in Bewegung federt nur der
    // Oberkörper nach, die Beine laufen weiter (die Landung sperrt keine Eingabe — sie ist kein Spielwert).
    let landOben: string | null = null, landNeu = false, landRolle = -1;
    {
      const ld = landung?.current, lv = landVor.current;
      lv.seit += Math.min(dt, 0.1) * ZEITLUPE;
      if (ld && ld.nr !== lv.nr) {
        // Der erste Stand zählt nicht (die Figur wird aufgestellt, nicht gelandet).
        if (lv.nr >= 0 && ld.nr > lv.nr) { lv.art = ld.art; lv.seit = 0; landNeu = true; }
        lv.nr = ld.nr;
      }
      if (fein && lv.art && !reittier && (!k || k.phase === 'bereit')) {
        const lw = FIGUR.landung, rolle = lv.art === 'rolle', bewegt = tempo >= 0.15;
        const a = aktionen(landeClip(lv.art, lw), true) ?? (rolle ? clips.rolle : null);
        // D461: Die Lande-Rolle ist die Hechtrolle von D460 ab `rolleAb` (Bild 5: gestreckt in der Luft), bei Rate 1 bis
        // zu ihrem Ende. Der Einstieg wird unten gesetzt, wo der Clip neu beginnt (`landRolle`).
        const ab = rolle && a ? Math.min(lw.rolleAb, a.getClip().duration * 0.5) : 0;
        if (a && landungLaeuft(lv.seit, a.getClip().duration - ab, bewegt && !rolle, lw)) {
          if (rolle) {
            a.timeScale = 1;
            ziel = a; art = 'rolle'; neu = landNeu; blende = 0.06; landRolle = ab;
          } else if (bewegt) landOben = a.getClip().name;
          else { a.timeScale = 1; ziel = a; art = 'landung'; neu = landNeu; blende = lw.uebergang; }
        } else if (!landNeu) lv.art = null;
      }
    }
    // ---- D461: Sprung (`figur/sprung.ts`). In der Luft — nach einem Absprung oder über eine Kante — gehört der Körper
    // dem Abdruck und dann der Flughaltung, wo der Kampf die Figur nicht führt. Das Aufsetzen ist die Landung oben.
    if (fein && luft?.current && !reittier && (!k || k.phase === 'bereit')) {
      const sw = FIGUR.sprung, abClip = aktionen(sw.clipAb, true);
      const bild = luftBild(luft.current, abClip?.getClip().duration ?? 0, sw);
      const a = bild ? (bild === 'ab' ? abClip : aktionen(luftClip(bild, sw), false)) : null;
      if (a) {
        if (bild === 'ab') { a.clampWhenFinished = true; neu = luft.current.nr !== luftVor.current; }
        a.timeScale = 1;
        ziel = a; art = 'luft'; blende = FIGUR.uebergang.luft; landOben = null; landRolle = -1;
        luftVor.current = luft.current.nr;
      }
    }
    // ---- D461: Wenden im freien Stand (`figur/wende.ts`). Die Hüfte hält ihre Richtung, bis der Blick ihr um `abGrad`
    // davongelaufen ist; dann tritt die Figur mit einem Wendeclip um genau dessen Winkel um. Nur wo nichts anderes die
    // Figur führt: kein Kampf, kein Tempo, nicht im Sattel, keine Landung.
    let wendeWinkel = 0, standFrei = false;
    if (fein) {
      const L = lz!, w = L.wende;
      standFrei = L.wendeDa && !k && !reittier && art === 'stand' && sitz.current < 0.01;
      wendeWinkel = wendeSchritt(w, gier.current, Math.min(dt, 0.1) * ZEITLUPE, standFrei, !L.traegheit.laeuft && L.art === 'stand', L.wendeDauern, FIGUR.wenden);
      const wa = w.clip ? aktionen(FIGUR.wenden.clips[w.clip], true) : null;
      if (wa) {
        wa.clampWhenFinished = true; wa.timeScale = 1;
        ziel = wa; art = 'wende'; neu = wendeWinkel !== 0;
      }
    }
    if (!fein) {
      if (lz?.an) {
        // Schalter gerade umgelegt: die Aktionen der feinen Laufzeit anhalten, Figur gerade stellen, Idle wie beim Start.
        lz.an = false; mixer.stopAllAction(); lz.aktiv.clear(); lz.schluessel = ''; lz.traegheit.ruhe(); lz.fein.ruhe();
        if (reiter.current) { reiter.current.rotation.set(0, 0, 0); reiter.current.position.x = 0; reiter.current.position.z = 0; }
        lz.wende = neueWende();
        clips.idle.reset().play(); clips.aktiv = clips.idle;
      }
      const hiebZeit = ziel.time;
      if (ziel !== clips.aktiv || neu) {
        // Ein ausgeblendeter Clip ist `enabled = false` — `reset()` schaltet ihn
        // wieder an (und beginnt bei 0, was beim Gangwechsel nicht auffaellt).
        const vorher = clips.aktiv;
        ziel.reset().setEffectiveWeight(1).play();
        if (hiebe.current.has(ziel)) { ziel.time = hiebZeit; ziel.timeScale = 0; }
        // D217: Gehen ↔ Laufen im selben Schritt fortsetzen statt bei Bild 0 — sonst setzt der neue
        // Clip mit dem falschen Fuss auf, und die Überblendung zeigt einen Hüpfer. Beide Clips beginnen
        // mit demselben Fuss (UAL2), also reicht der Anteil am Zyklus. Länger überblendet als sonst.
        const gang = (a: THREE.AnimationAction) => a === clips.walk || a === clips.run;
        if (gang(vorher) && gang(ziel) && vorher !== ziel) {
          ziel.time = (vorher.time / vorher.getClip().duration) * ziel.getClip().duration;
          blende = 0.4;
        }
        if (clips.aktiv !== ziel) clips.aktiv.crossFadeTo(ziel, blende, false);
        clips.aktiv = ziel;
      }
      // Abspielgeschwindigkeit an das Tempo koppeln: Walk ist bei 1,0 etwa 1,5 m/s,
      // Run etwa 6 m/s — darunter rutschen die Fuesse, darueber trippeln sie.
      clips.walk.timeScale = Math.max(0.8, Math.min(2.4, tempo / 1.7));
      clips.run.timeScale = Math.max(0.8, Math.min(1.8, tempo / 6.5));
      // D457: `?zeitlupe=` (Messadresse, D427) verlangsamt auch die Figur — ohne Schalter Faktor 1, nichts anders.
      mixer.update(Math.min(dt, 0.1) * ZEITLUPE);
    } else {
      // ---- D457: Laufzeit der Bewegung. Die Wahl oben (Clip nach Phase und Tempo) bleibt; anders ist, **wie**
      // gewechselt und gemischt wird: harter Wechsel + abklingender Versatz statt Kreuzblende, Gehen und Rennen
      // nach Tempo gemischt im selben Schritt, Waffenhaltung über dem Gang.
      const L = lz!, dtK = Math.min(dt, 0.1) * ZEITLUPE;
      if (L.an !== true) {
        L.an = true; mixer.stopAllAction(); L.aktiv.clear(); L.schluessel = ''; L.traegheit.ruhe(); L.fein.ruhe();
      }
      // D461: drei Gangarten (Gang, Laufschritt, Sprint), je zwei Nachbarn nach Tempo gemischt — bei den Spieltempi
      // spielt ein Clip allein und bei Rate 1.
      const gm = gangStufen(tempo, L.gaenge, FIGUR.gang);
      L.phase = (L.phase + gm.rate * dtK) % 1;
      const sollA = L.sollA, sollW = L.sollW, st = L.stufen;
      const gewicht = (i: number) => (i === gm.stufe ? 1 - gm.rennen : i === gm.stufe + 1 ? gm.rennen : 0);
      sollA.length = 0; sollW.length = 0;
      // Ebenen: Wo die Regel Bewegung erlaubt (`frei()`: nur `bereit`), gehen die Beine, und der Oberkörper bleibt in der
      // Hut der Waffe. Im Schlag, in der Rolle und in der Deckung sperrt die Regel das Gehen (`gesperrt`) — dort gehört
      // der ganze Körper dem Clip. Der Zweig für die Deckung greift erst, falls die Regel das Gehen dort je erlaubt.
      let oben: THREE.AnimationAction | null = null;
      if (art === 'block' && tempo >= 0.15) oben = L.teil(ziel.getClip().name, true)?.ober ?? null;
      else if (art === 'gang' && landOben) oben = L.teil(landOben, true)?.ober ?? null; // D458: Landung über dem Gang
      else if (art === 'gang' && k && k.phase === 'bereit') oben = L.teil(k.haltung)?.ober ?? null;
      const obenNeu = landNeu && !!oben && oben.getClip().name.startsWith(landOben ?? '\u0000');
      let schluessel: string;
      if (art === 'gang' || oben) {
        st.forEach((s, i) => { sollA.push(s.unter); sollW.push(gewicht(i)); });
        if (oben) { sollA.push(oben); sollW.push(1); schluessel = `gang+${oben.getClip().name}`; }
        else { st.forEach((s, i) => { sollA.push(s.ober); sollW.push(gewicht(i)); }); schluessel = 'gang'; }
      } else { sollA.push(ziel); sollW.push(1); schluessel = ziel.getClip().name; }
      if (schluessel !== L.schluessel || neu || obenNeu) {
        // D461, Wende: Der Clip beginnt um seinen Winkel zurückgedreht, die Hüfte springt gegenläufig (unten) — in der
        // Welt steht das Bild. Wurzel, Becken und Beine wechseln deshalb hart; nur der Oberkörper klingt aus.
        L.traegheit.wechsel(obenNeu ? FIGUR.landung.uebergang : uebergangsDauer(L.art, art, FIGUR.uebergang), wendeWinkel !== 0 ? L.unterKnochen : undefined);
        for (const a of L.aktiv) if (!sollA.includes(a)) { a.stop(); L.aktiv.delete(a); }
        for (const a of sollA) {
          if (L.aktiv.has(a) && !(neu && a === ziel) && !(obenNeu && a === oben)) continue;
          a.reset().play(); L.aktiv.add(a);
          // Die Deckung stand schon (Stand ↔ Gehen mit gehobener Waffe): am Ende einsteigen, nicht neu heben.
          if (art === 'block' && L.art === 'block' && (a === oben || a === ziel)) a.time = a.getClip().duration * 0.999;
          // D461: Die Lande-Rolle steigt bei `rolleAb` ein — das Tiefgehen und der Abdruck davor entfallen.
          if (landRolle > 0 && a === ziel) a.time = landRolle;
        }
        // Kette: Dieser Hieb folgt unmittelbar auf einen Hieb — er steigt an der Kettenmarke ein (`figur/kette.ts`).
        if (art === 'hieb') { if (neu) L.ausKette = L.art === 'hieb'; } else L.ausKette = false;
        L.schluessel = schluessel; L.art = art;
      }
      // D461: Die Regel setzt das Tempo ohne Anlauf — von Laufschritt auf Rennen springt die Mischung in einem Bild von
      // einem Clip auf den anderen. Ohne Übergang wäre das ein harter Posenwechsel; so klingt der Versatz ab wie Stand → Gang.
      const gangLage = gm.stufe + gm.rennen;
      if ((art === 'gang' || oben) && Math.abs(gangLage - L.gangLage) > FIGUR.gang.wechselAb) L.traegheit.wechsel(FIGUR.uebergang.gang);
      L.gangLage = gangLage;
      // Der Start-Effekt (G-137) spielt Idle an — und er kann **nach** dem ersten Bild laufen. Dann liefe Idle neben allem
      // mit vollem Gewicht mit, und der Mixer mittelte jede Pose zur Hälfte mit dem Stand (gemessen 23.11.2026: Becken im
      // Ausfall 0,71 statt 0,52 m). Was nicht im Soll steht, läuft nicht.
      if (clips.idle.isScheduled() && !L.aktiv.has(clips.idle)) clips.idle.stop();
      // `isScheduled`: Im Dev-Server hängt React die Figur einmal ab und wieder an (G-137) — der Aufräumer stoppt alle Clips.
      for (let i = 0; i < sollA.length; i++) { const a = sollA[i]; if (!a.isScheduled()) a.play(); a.enabled = true; a.weight = sollW[i]; }
      if (oben && art === 'block') oben.timeScale = 2;
      // Gang: Die Phase folgt der Strecke (kein Gleiten), beide Clips stehen an derselben Stelle des Schritts.
      L.eingabe.weite = art === 'gang' || oben ? gm.weite : 1;
      const mm = L.messung;
      mm.rate = gm.rate; mm.weite = gm.weite; mm.gleiten = gm.gleiten; mm.stufe = gm.stufe; mm.anteil = gm.rennen;
      // Abspielrate gegen den Clip, der gerade am meisten trägt (1 = wie gebaut).
      mm.clipRate = gm.rate * st[gm.rennen >= 0.5 ? Math.min(gm.stufe + 1, st.length - 1) : gm.stufe].dauer;
      for (const s of st) {
        s.unter.timeScale = s.ober.timeScale = 0;
        s.unter.time = s.ober.time = ((L.phase + s.versatz) % 1) * s.dauer;
      }
      if (art === 'hieb' && k && hScheitel >= 0 && (k.phase === 'vorlauf' || k.phase === 'aktiv' || k.phase === 'erholung')) {
        const m = L.marke, marke = CLIPMARKEN.get(ziel.getClip().name);
        m.scheitel = hScheitel; m.durchzug = hDurchzug; m.dauer = ziel.getClip().duration;
        m.einstieg = marke?.einstieg; m.kettenpose = marke?.kettenpose;
        ziel.timeScale = 0;
        ziel.time = hiebClipzeit(k.phase, k.zeit, k, m, L.ausKette, KOMBO_AB);
      }
      clips.aktiv = ziel;
      mixer.update(dtK);
      const t0 = performance.now();
      L.traegheit.nachMixer(dtK);
      L.messung.ms += performance.now() - t0;
    }

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
    // D214: Füsse auf den Boden, nach Clip und Sitzpose. `?fuesse=0` zum Vergleich.
    if (fein) {
      // D457: Körper über den Clips — Drehkette, Neigen, Blick, Atem, Trefferantwort, Füsse (`figur/laufzeit.ts`).
      const L = lz!, t0 = performance.now();
      if (reittier) {
        // Im Sattel: keine Lage, keine Beckensenkung vom letzten Hang — die Sitzpose stellt die Beine.
        if (reiter.current) { reiter.current.rotation.set(0, 0, 0); reiter.current.position.x = 0; reiter.current.position.z = 0; }
        scene.position.y = 0;
      } else {
        const e = L.eingabe;
        e.gier = k?.phase === 'rolle' && k.rolleBlick !== null ? k.rolleBlick : gier.current;
        e.tempo = tempo;
        // Im Schlag, in der Rolle und im Fall zeigt die Figur genau dorthin, wohin die Regel zeigt.
        e.straff = !k ? 0 : art === 'hieb' || art === 'rolle' || art === 'fall' ? 1 : 0.5;
        e.fokus = k?.fokus ?? null;
        e.steht = art === 'stand' || art === 'hut';
        // (D458: in der Landung steht sie nicht ruhig — kein Atemhub über dem Federn.)
        e.hoeheAn = FUESSE_AN ? hoeheAn : undefined;
        e.fuesse = sitz.current < 0.01;
        // Standfüsse halten nicht, wo die Füsse das Tempo nicht abdecken (Rennen ohne Sprintclip): Halten und Loslassen
        // im Wechsel wäre ein Stottern, schlimmer als das Gleiten.
        e.halten = art !== 'rolle' && art !== 'fall' && art !== 'treffer' && art !== 'luft' && Math.abs(L.messung.gleiten) < 0.05;
        // D461: Im freien Stand hält die Hüfte ihre Richtung (Blick − Standrichtung geht in Rumpf und Kopf); beginnt in
        // diesem Bild ein Wendeclip, springt sie um seinen Winkel.
        e.standAbstand = standFrei && L.wende.frei ? L.wende.ziel - L.wende.richtung : undefined;
        if (wendeWinkel !== 0) { L.fein.dreheHuefte(wendeWinkel); L.messung.wenden = L.wende.nr; }
        if (neuGetroffen && k?.trefferVon && gruppe.current) {
          const p = gruppe.current.getWorldPosition(_feinV);
          const [wx, wz] = wegVomAngreifer(p.x - k.trefferVon.x, p.z - k.trefferVon.z, gruppe.current.rotation.y);
          L.fein.stoss(wx, wz, k.trefferVon.schaden);
        }
        const dtK = Math.min(dt, 0.1) * ZEITLUPE;
        const lage = L.fein.schritt(dtK, e);
        if (gruppe.current) gruppe.current.rotation.y = lage.huefte;
        if (reiter.current) {
          reiter.current.rotation.set(lage.nicken, 0, lage.rollen);
          // D461: Im freien Stand bleibt die Mitte des Stands in der Welt liegen (die Wendeclips drehen um sie, die
          // Gruppe um ihren Ursprung); beim Losgehen klingt der Versatz ab.
          const [vx, vz] = standVersatz(L.wende, lage.huefte, L.mitte, dtK, FIGUR.wenden.versatzHalbwert);
          reiter.current.position.x = vx; reiter.current.position.z = vz;
        }
        L.fein.knochen(dtK, e);
      }
      L.traegheit.ende();
      const m = L.messung;
      m.ms += performance.now() - t0; m.bilder++;
      if (m.bilder >= 120) { m.msMittel = m.ms / m.bilder; m.ms = 0; m.bilder = 0; }
    } else if (hoeheAn && FUESSE_AN) setzeFuesse(beine, scene, hoeheAn, fuss.current, dt, held && sitz.current < 0.01);
    gleiteAxt();

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

/**
 * Kamera bei Zielaufschaltung (D167): über die rechte Schulter statt genau dahinter.
 *
 * Die Aufschaltung dreht `gier` aufs Ziel — die Kamera hinter der Figur schaut dann genau durch
 * die Figur hindurch aufs Ziel, und im Bild (D166) stand der Gegner hinter dem eigenen Rücken.
 * Seitlich versetzt und mit dem Blickpunkt ein Stück Richtung Ziel sind beide zu sehen, und der
 * Bodenfächer des Gegners liegt frei. Eingeblendet über 0,35 s, damit L kein Schnitt ist.
 */
const SCHULTER = { seite: 0.85, hoch: 0.25, zumZiel: 0.4, blende: 0.35 };

function Kamera({ ziel, gier, neigung, feld, kollision, kampf }: {
  /** Kampfzustand; `fokus` ist das aufgeschaltete Ziel (D167). */
  kampf?: React.RefObject<KampfFigur | null>;
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
  /** 0 = frei, 1 = über der Schulter aufs Ziel. */
  const schulter = useRef(0);
  const blickZiel = useRef(new THREE.Vector3());
  /** Arm der Schulterkamera nach Sichtprüfung (D192): zieht hart ein, fährt weich aus. */
  const schulterArm = useRef<number>(GROESSE.kameraAbstand);
  /**
   * Ruck bei Treffern (D171), seit D427 nach Wucht: Stärke, Abklingen und Richtung je Treffer aus
   * `kampf/gewicht.ts` (über `KampfFigur.stoss`), skaliert mit der Einstellung `kamerawackeln`.
   */
  const ruck = useRef({ getroffen: -1, gesetzt: -1, stoss: neuerStoss() });
  const versatz = useRef(new THREE.Vector3());
  /**
   * Nahkamera (D179): V schaltet durch drei Abstände (voll, 60 %, 40 %), das Mausrad stellt stufenlos
   * zwischen 35 % und 100 %. Im Kampf liest man so Waffe, Pose und Linie; beim Wandern bleibt es aus.
   */
  const zoom = useRef(1);
  /**
   * Umschau (D185): C schaltet die Kamera um die Figur — hinten, von vorn, von der Seite. Nur der
   * Blick dreht; die Steuerung bleibt an der Figur. `?umschau=180` für die Bildprüfung (Grad).
   */
  const umschau = useRef(0);
  const umschauRoh = new URLSearchParams(location.search).get('umschau');
  const umschauZiel = useRef((Number(umschauRoh) || 0) * Math.PI / 180);
  /**
   * Gegneransicht (D186): vierte Stufe von C, nur im Kampf mit Ziel. Die Kamera steht 3,2 m vor dem
   * Gegner auf der Seite der Spielerin, leicht seitlich, und schaut ihm ins Gesicht — Waffe, Haltung
   * und Ausholen von vorn. `?umschau=gegner` für die Bildprüfung.
   */
  const gegnerSicht = useRef(umschauRoh === 'gegner');
  const gegnerKamera = useRef(new THREE.Vector3());
  const zoomZiel = useRef(Number(new URLSearchParams(location.search).get('zoom') ?? 1) || 1);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement) return;
      // D415: Aktionen `umschau` (C) und `ansicht` (V) aus `spieler/eingabe.ts`.
      const aktionen = aktionenVon(e.code);
      if (aktionen.includes('umschau')) {
        if (gegnerSicht.current) { gegnerSicht.current = false; umschauZiel.current = 0; return; }
        const stufen = [0, Math.PI, Math.PI / 2];
        const i = stufen.findIndex(x => Math.abs(x - umschauZiel.current) < 0.01);
        // Nach der Seite kommt der Gegner, wenn es einen gibt; sonst wieder hinten.
        if (i === 2 && kampf?.current?.fokus) { gegnerSicht.current = true; return; }
        umschauZiel.current = stufen[(i + 1) % stufen.length];
        return;
      }
      if (!aktionen.includes('ansicht')) return;
      zoomZiel.current = zoomZiel.current > 0.8 ? 0.6 : zoomZiel.current > 0.5 ? 0.4 : 1;
    };
    const rad = (e: WheelEvent) => {
      zoomZiel.current = Math.max(0.35, Math.min(1, zoomZiel.current * (e.deltaY > 0 ? 1.08 : 1 / 1.08)));
    };
    window.addEventListener('keydown', taste);
    window.addEventListener('wheel', rad, { passive: true });
    return () => { window.removeEventListener('keydown', taste); window.removeEventListener('wheel', rad); };
  }, []);
  useFrame((_, dt) => {
    const p = ziel.current?.position ?? new THREE.Vector3();
    const fokus = kampf?.current?.fokus ?? null;
    const kf = kampf?.current ?? null, rk = ruck.current;
    if (kf) {
      // Eingesteckt ruckt es stärker als ausgeteilt — der eigene Treffer soll Gewicht haben, der
      // fremde soll wehtun. D427: Stärke nach Wucht bzw. Schaden (`kf.stossGesetzt`/`stossErlitten`,
      // `kampf/gewicht.ts`), der eigene in Schlagrichtung; ohne Angabe die festen Werte von D171.
      const faktor = Number(einstellungen().wert('kamerawackeln')) / 100;
      if (rk.getroffen >= 0 && kf.getroffen > rk.getroffen)
        stosse(rk.stoss, kf.stossErlitten ?? { staerke: 0.09, abklingen: 0.12, richtung: null, anteil: 0 }, faktor);
      if (rk.gesetzt >= 0 && kf.gesetzt > rk.gesetzt)
        stosse(rk.stoss, kf.stossGesetzt ?? { staerke: 0.035, abklingen: 0.12, richtung: null, anteil: 0 }, faktor);
      rk.getroffen = kf.getroffen; rk.gesetzt = kf.gesetzt;
    }
    klingeAb(rk.stoss, ZEITLUPE === 1 ? dt : Math.min(dt, 0.1) * ZEITLUPE);
    const wackle = () => {
      const [x, y, z] = stossVersatz(rk.stoss);
      if (x === 0 && y === 0 && z === 0) return;
      // Kameraraum → Welt: x rechts, y oben, z vor (three.js schaut entlang −Z). Nach `lookAt`, damit die
      // Ausrichtung des Bildes gilt; der Blick selbst dreht nicht mit, nur die Kamera rückt.
      versatz.current.set(x, y, -z).applyQuaternion(camera.quaternion);
      camera.position.add(versatz.current);
    };
    schulter.current += ((fokus ? 1 : 0) - schulter.current) * Math.min(1, dt / SCHULTER.blende);
    if (fokus) blickZiel.current.set(fokus.x, fokus.y, fokus.z);
    // Die Kamera kreist auf einer Kugel um den Blickpunkt auf Brusthöhe: `gier`
    // dreht herum, `neigung` hebt und senkt. Bei Neigung 0 steht sie waagerecht
    // hinter dem Spieler, bei NEIGUNG_MAX fast senkrecht darüber.
    umschau.current += (umschauZiel.current - umschau.current) * Math.min(1, dt * 4);
    kameraZustand.vorn = gegnerSicht.current || Math.abs(umschau.current) > 0.6;
    const g = gier.current + SPIEGEL_GRAD * Math.PI / 180 + umschau.current;
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
    zoom.current += (zoomZiel.current - zoom.current) * Math.min(1, dt * 5);
    const weit = GROESSE.kameraAbstand * zoom.current;
    // Ausdrücklich `number`: `GROESSE` ist `as const`, sonst erbt `frei` den Literaltyp 6.
    let frei: number = weit;
    const versperrt: Versperrt = (x, y, z) => {
      const [kx, kz] = kollision.schiebeRaus(x, z);
      return kx !== x || kz !== z || y < hoeheAufFlaeche(feld, x, z) + 0.45;
    };
    for (let i = 1; i <= SICHT_PROBEN; i++) {
      const d = (weit * i) / SICHT_PROBEN;
      if (versperrt(p.x + rx * d, blickY + ry * d, p.z + rz * d)) { frei = d - SICHT_PUFFER; break; }
    }
    const ziel_ = Math.max(KAMERA_MIN, Math.min(weit, frei));
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
    const gf = gegnerSicht.current ? kf?.fokus : null;
    if (gf) {
      // Vom Gegner zur Spielerin, 3,2 m weit, 25° zur Seite gedreht, auf Augenhöhe des Gegners.
      const dx = p.x - gf.x, dz = p.z - gf.z, d = Math.hypot(dx, dz) || 1;
      // D192: Steht dort ein Stamm oder verdeckt einer den Gegner, erst die andere Seite, dann näher.
      const w0 = Math.atan2(dx / d, dz / d);
      const lagen: [number, number][] = [[0.45, 3.2], [-0.45, 3.2], [0.45, 2.4], [-0.45, 2.4], [0.45, 1.6]];
      const gp = [gf.x, gf.y, gf.z] as const;
      const [w, ab] = lagen.find(([dw, ab]) => {
        const k = [gf.x + Math.sin(w0 + dw) * ab, gf.y + 0.35, gf.z + Math.cos(w0 + dw) * ab] as const;
        return !versperrt(k[0], k[1], k[2]) && sichtFrei(k, gp, versperrt, ZIEL_RAND);
      }) ?? lagen[0];
      const soll = new THREE.Vector3(gf.x + Math.sin(w0 + w) * ab, gf.y + 0.35, gf.z + Math.cos(w0 + w) * ab);
      gegnerKamera.current.lerp(soll, gegnerKamera.current.lengthSq() === 0 ? 1 : Math.min(1, dt * 5));
      camera.position.copy(gegnerKamera.current);
      camera.lookAt(gf.x, gf.y - 0.1, gf.z);
      wackle();
      return;
    }
    gegnerKamera.current.set(0, 0, 0);
    camera.position.copy(geglaettet.current);
    const m = schulter.current;
    if (m < 0.001) { schulterArm.current = abstand.current; camera.lookAt(p.x, blickY, p.z); wackle(); return; }
    // Rechts der Blickrichtung (−sin g, −cos g) ist (cos g, −sin g) — dieselbe Achse wie `seit`.
    const sx = Math.cos(g) * SCHULTER.seite * m, sz = -Math.sin(g) * SCHULTER.seite * m;
    // D192: Mit Versatz und mit Ziel neu prüfen — der Versatz kann die Kamera in einen Stamm schieben,
    // und ein Stamm zwischen Kamera und Ziel verdeckt den Gegner, den man lesen soll. Einziehen hart,
    // Ausfahren weich, wie oben.
    const sollArm = armMitSicht({
      blick: [p.x, blickY, p.z], richtung: [rx, ry, rz], versatz: [sx, SCHULTER.hoch * m, sz],
      ziel: fokus ? [fokus.x, fokus.y, fokus.z] : null,
      min: KAMERA_MIN, max: abstand.current, versperrt,
    });
    schulterArm.current = sollArm < schulterArm.current
      ? sollArm
      : schulterArm.current + (sollArm - schulterArm.current) * Math.min(1, dt * 2.5);
    if (schulterArm.current < abstand.current - 0.01) {
      const ra = schulterArm.current;
      camera.position.set(p.x + rx * ra, blickY + ry * ra, p.z + rz * ra);
    }
    camera.position.x += sx; camera.position.z += sz; camera.position.y += SCHULTER.hoch * m;
    const f = blickZiel.current, a = SCHULTER.zumZiel * m;
    camera.lookAt(
      p.x + sx * 0.5 + (f.x - p.x) * a,
      blickY + (f.y - blickY) * a,
      p.z + sz * 0.5 + (f.z - p.z) * a,
    );
    wackle();
  });
  return null;
}

/** D350: Ringtiefe ab Regionskante, bis zu der das DGM1-Fernrelief mit ~31 m Linienabstand bleibt. */
const FERN_FEIN_BIS_M = 1000;

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
// Die Nahstufe verwendet das Blender-Register. Ohne Vorbereitung begann ihr
// Laden und Dekodieren am ersten LOD-Wechsel während der Hofroute.
if (HOF_BILDTAKT_AN) {
  for (const baum of BLENDER_BAEUME)
    if (baum.stufe === 'nah') useGLTF.preload(propPfad(baum.datei));
}

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
  useEffect(() => {
    (window as unknown as { __szene?: THREE.Scene }).__szene = scene;
    if (HOF_AN) scene.userData.hofProbe = HOF_UNIFORM;
  }, [scene]);
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
  /**
   * Sichtweite (D247): 1 = Schwellen aus dem Handybudget, `WEITE_WEIT` = Bäume, Büsche und Gras
   * weiter hinaus in voller Stufe, dazu der Fernring des Grasteppichs.
   */
  weite: number;
}

/**
 * Leere Prop-Liste für den Messlauf `?aus=baeume`.
 *
 * Als Konstante und nicht als `[]` an der Verwendungsstelle: Ein neues Array je
 * Bild würde jede `useMemo`, die daran hängt, in jedem Bild neu auswerten — und
 * damit genau das messen, was der Schalter ausschalten soll.
 */
const LEERE_PROPS: PropInstanz[] = [];

export const QUALITAET_STANDARD: Qualitaet = { dpr: 2, schatten: true, gras: 1, weite: WEITE_WEIT };

export interface RegionsSzeneProps {
  welt: Weltdaten;
  /** Tageszeit 0…1, zyklisch. Ersetzt die frühere Auswahl aus drei festen Stimmungen. */
  tageszeit?: number;
  /** D180: besetzte Wegelager (x, z) — Feuerstelle immer, nachts Glut, Licht und zwei Fackeln. */
  lagerstellen?: readonly { x: number; z: number }[];
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
  /** `gestalt: null` nach dem Sieg: Der Ort bleibt (Heilung, D240), die Figur ist weg. */
  regent?: { ort: [number, number]; kreatur: string; gestalt: THREE.BufferGeometry | null;
            /** Rückkehrer nach der Heilung (D241, `regent.nachHeilung`). */
            rueckkehr?: readonly { kreatur: string; anzahl: number }[] };
  /** Region geheilt (D240): Stimmung mit `heileStimmung`. `?geheilt=1` zum Ansehen. */
  geheilt?: boolean;
  /** Wird gerufen, wenn der Spieler den Regentenort betritt oder verlässt. */
  onRegentNah?: (nah: boolean) => void;
  /**
   * Ist der Gleiter frei? Abgeleitet aus dem Weltzustand (Regent besiegt), nicht
   * gespeichert — siehe `spieler/gleiten.ts`.
   */
  gleiterFrei?: boolean;
  /** Meldet den Wechsel in den und aus dem Gleitflug. Für die Anzeige. */
  onGleiten?: (gleitet: boolean) => void;
  /** D412: Anzug an (das Tauchzeug im Beutel) — hält die Kälteuhr an. */
  anzug?: boolean;
  /** D412: Folgen von Sturz und Kälte, `leben` 0 … 1 (`spieler/bewegung.ts`). */
  onKoerper?: (art: 'sturz' | 'kaelte', leben: number) => void;
  /** Fundstellen in Weltkoordinaten (x, z) — die Szene kennt keine Texte. */
  fundstellen?: { id: string; ort: [number, number] }[];
  gelesen?: ReadonlySet<string>;
  onFund?: (id: string) => void;
  /** Zufluchten und Bewohner in Weltkoordinaten (x, z). */
  orte?: { id: string; art: OrtsArt; ort: [number, number]; figur?: string; blick?: number;
           gang?: number; farben?: Partial<Record<RollenSlot, string>>; abends?: string }[];
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
  meldeRand?: (seite: Seite | null) => void;
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
  /** Wer auf dem Platz steht (D169/D170): zwei Arten, je Platz eine. */
  kampfAufstellung?: readonly GegnerArt[];
  /** Begegnung in der Welt (D175): Ausgang melden statt neu aufstellen; seit D417 mit Bericht je Gegner. */
  kampfEnde?: (sieg: boolean, bericht: Kampfbericht) => void;
  /** D417: Marke aus dem Spielstand (Ladungen, Fassung, Reinkultur) — ohne Angabe eine volle (Übungsplatz). */
  kampfMarke?: { ladung: number; fassung: number; reinkultur?: boolean };
  /** Schmiedestufen der Waffen (D177). */
  waffenStufen?: { klinge: number; axt: number; speer?: number; funke?: 'wasser' | 'stein' };
  /** Begegnung bei Nacht (D179). */
  kampfNacht?: boolean;
  /** D355: Richtungskampf an/aus aus dem Spielstand. */
  kampfRichtung?: boolean;
  /** Spieler versetzen (D179, Aufwachen in der Zuflucht). */
  spielerSprung?: React.RefObject<[number, number, number?] | null>;
  /** Stand für die Kampfanzeige im DOM, wie `ausdauer` als Ref. */
  kampfStand?: React.RefObject<KampfStand | null>;
}

export function RegionsSzene({
  welt, tageszeit = 0.26, spielerRef, onMessung,
  qualitaet = QUALITAET_STANDARD, kreaturen, gestalt, verbraucht, onBegegnung, naehe,
  regent, geheilt, onRegentNah, gleiterFrei, onGleiten, anzug, onKoerper, fundstellen, gelesen, onFund, orte, onOrtNah,
  startPosition, startBlick = 0, ausdauer, reittier = null, angehalten = false,
  fernland = null, meldeRand, stoecke, kampfplatz = false, kampfAufstellung, kampfEnde, kampfMarke, waffenStufen, kampfNacht, kampfRichtung, spielerSprung, kampfStand, lagerstellen,
}: RegionsSzeneProps) {
  const eigenerRef = useRef<THREE.Object3D>(null);
  /** Führt der Kampf gerade die Figur? `Kampfplatz` schreibt, `Spieler` liest. */
  const kampfSperre = useRef(false);
  /** Kampfzustand für Figur und Kamera (D167). `Kampfplatz` schreibt, beide lesen. */
  const kampfFigur = useRef<KampfFigur | null>(null);
  /** Ist ein Ziel aufgeschaltet? Dann dreht `Spieler` nicht (D168). */
  const kampfZielt = useRef(false);
  const ref = spielerRef ?? eigenerRef;
  const eigeneAusdauer = useRef<Ausdauerzustand>(neueAusdauer());
  const kraft = ausdauer ?? eigeneAusdauer;
  const gier = useRef(startBlick);
  // Einmal je Zeitpunkt mischen, nicht je Bild: Farbmischung ist billig, aber sie
  // hängt an einem Regler und nicht an der Bildrate.
  const s = useMemo(() => {
    const basis = STIMMUNG_MESSLAUF ?? stimmungBei(tageszeit);
    const gemischt = geheilt || GEHEILT_ANSICHT ? heileStimmung(basis) : basis;
    // D368: Farben von Nebel, Fernland, Sonne und Fülllicht aus dem physikalischen Himmel; alle
    // Stärken bleiben die der Stimmung. Ohne `?himmel=physik` unverändert.
    return HIMMEL_PHYSIK_AN ? koppleStimmung(gemischt) : gemischt;
  }, [tageszeit, geheilt]);
  const neigung = useRef(NEIGUNG_START);
  const schritt = useRef({ phase: 0, tempo: 0 });
  /** D458: Landezustand — `Spieler` schreibt beim Aufsetzen, `SpielerFigur` spielt den Clip. */
  const landung = useRef<Landung>(neueLandung());
  /** D461: Luftzustand — `Spieler` schreibt je Bild, `SpielerFigur` spielt Abdruck und Flughaltung. */
  const luft = useRef<Luft>(neueLuft());
  // Als Ref gespiegelt: Die Bewegungsschleife liest jedes Bild, und ein Prop-Wechsel
  // soll nicht durch den Callback-Baum von `Spieler` laufen.
  const reitetRef = useRef(false);
  reitetRef.current = reittier !== null;
  // Der Gleiter als Ref und nicht als Prop im Frame: Ein Weltzustand, der sich
  // einmal je Spielstand ändert, soll keine Bildschleife neu aufsetzen.
  const gleiterRef = useRef(false);
  gleiterRef.current = gleiterFrei ?? false;
  const anzugRef = useRef(false);
  anzugRef.current = anzug ?? false;

  // Grobes Terrain: liefert weiterhin Wege, Gewässer, Gebäude und die XZ-Verteilung
  // der Props. Der sichtbare Boden kommt aus den LOD-Kacheln.
  const terrain = useMemo(() => baueTerrain(welt), [welt]);
  const regionsinhalt = useMemo(() => STRASSENVERFALL_AN || MILBINGERMASSE_AN
    ? [...REGIONEN.values()].find(r => r.bbox.every((wert, i) => wert === welt.bbox[i]))
    : undefined, [welt]);

  // Höhenfeld mit Mikrorelief — die gemeinsame Wahrheit für Boden, Props und Spawn.
  const nahhoehen = MILBINGERMASSE_AN ? regionsinhalt?.nahhoehen : undefined;
  const feld = useMemo(() => baueHoehenfeld(welt, MIKRO_MESSLAUF ?? undefined, undefined, nahhoehen), [welt, nahhoehen]);
  useMemo(() => { if (HOF_AN) waehleHof(welt, feld); }, [welt, feld]);
  const kacheln = useMemo(() => baueKachelraster(feld), [feld]);
  const strassen = STRASSENVERFALL_AN ? regionsinhalt?.strassenkulisse : undefined;
  const strassenmaske = useMemo(() => {
    if (!WOHNWEGQUERSCHNITT_AN || !strassen) return undefined;
    const masken = strassen.flatMap(abschnitt => abschnitt.wege.flatMap(({ osmWeg, querschnitt }) => {
      if (!querschnitt) return [];
      const weg = welt.wege.find(w => w.quelle?.osmId === osmWeg);
      return weg ? [querschnittFreihaltung(weg.punkte.map(p => nachMetern(p, welt.bbox)), querschnitt, weg.breite)] : [];
    }));
    return baueQuerschnittGrasmaske(masken);
  }, [welt, strassen]);
  useEffect(() => () => { strassenmaske?.textur.dispose(); }, [strassenmaske]);
  const wiesenbereich = useMemo(() => {
    if (!MILBINGERMASSE_AN || !strassenmaske) return undefined;
    const hofkarte = HOF_UNIFORM.kontakt.value;
    const kontakt = MILBINGERBODEN_AN && LOD2_AN && !istAus('haeuser') && LOD2_DATEN.length === welt.gebaeude.length
      ? baueWiesenHauskontakt(welt, LOD2_DATEN, ort => nachMetern(ort, welt.bbox),
        hofkarte instanceof THREE.DataTexture ? hofkarte : undefined) : undefined;
    return baueWiesenbereich(strassenmaske.rahmen, kontakt);
  }, [welt, strassenmaske, feld]);
  useEffect(() => () => { wiesenbereich?.kontakt?.textur.dispose(); }, [wiesenbereich]);
  const sandkasten = useMemo(() => MILBINGERSUBSTANZ_AN && strassenmaske
    ? baueMilbingerSandkasten(welt, (x, z) => hoeheAufFlaeche(feld, x, z), strassenmaske.enthaelt)
    : undefined, [welt, feld, strassenmaske]);
  useEffect(() => () => sandkasten?.entsorge(), [sandkasten]);

  // Props einmal zentral: Die Szene zeichnet sie, die Kollision braucht dieselben
  // Positionen. Zweimal verteilen hieße, gegen unsichtbare Bäume zu laufen.
  // D232: dieselbe Funktion wie die Werkzeuge (`szenenprops.ts`).
  const props = useMemo(() => propsWieSzene(welt, terrain, feld, strassenmaske?.enthaelt,
    LOD2_AN && LOD2_DATEN.length === welt.gebaeude.length ? LOD2_DATEN : undefined), [welt, terrain, feld, strassenmaske]);
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
        // Nach der Heilung kehren Arten an den Regentenort zurück (D241).
        .concat(regent?.rueckkehr && (geheilt || GEHEILT_ANSICHT)
          ? rueckkehrVorkommen(regent.rueckkehr, regent.ort,
              id => kreaturen.find(k => k.id === id)?.stufen.length ?? 1,
              (x, z) => hoeheAufFlaeche(feld, x, z))
          : [])
      : []),
    [welt, kreaturen, feld, regent, geheilt],
  );

  const senke = useMemo<Pegelsenke | null>(
    () => (regent && (geheilt || GEHEILT_ANSICHT) ? { x: regent.ort[0], z: regent.ort[1], ...HEIL_PEGEL } : null),
    [regent, geheilt],
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
      id: o.id, art: o.art, figur: o.figur, blick: o.blick, gang: o.gang, farben: o.farben, abends: o.abends,
      position: [o.ort[0], hoeheAufFlaeche(feld, o.ort[0], o.ort[1]), o.ort[1]],
    })),
    [orte, feld],
  );

  const start = useMemo<[number, number, number]>(() => {
    const [x, z] = startPosition ?? [0, 0];
    return [x, hoeheAufFlaeche(feld, x, z), z];
  }, [feld, startPosition]);
  const felsArt = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('felsprobe') : null;
  const felsX = start[0] - Math.sin(startBlick) * 8 + Math.cos(startBlick) * 2;
  const felsZ = start[2] - Math.cos(startBlick) * 8 - Math.sin(startBlick) * 2;

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
      beweglicherDunst: MILBINGERLICHT_AN,
      glattesFernlicht: LOOK_FELS_AN && STIMMUNG_MESSLAUF === STIMMUNG.zielbildfels,
    }, FERNHALB_AN ? FERN_FEIN_BIS_M : Infinity) : null),
    [fernland, welt, s],
  );
  const fernDetail = !!fernland?.detail;
  const fernMaterial = useMemo(() => baueFernlandMaterial(MILBINGERLICHT_AN, fernDetail), [fernDetail]);
  useEffect(() => stelleReliefLicht(fernMaterial, {
    dunst: s.horizont, sonne: s.sonne, sonneStaerke: s.sonneStaerke,
    umgebung: s.umgebung, umgebungStaerke: s.umgebungStaerke, sonnenstand: s.sonnenstand,
  }), [fernMaterial, s]);
  useEffect(() => () => fernMaterial.dispose(), [fernMaterial]);
  useEffect(() => () => { fernGeo?.dispose(); }, [fernGeo]);

  return (
    <Canvas
      // ADR-0015: three r18x hat PCFSoftShadowMap entfernt (R3F-Vorgabe bei `true`) und fiel mit
      // Warnung auf PCFShadowMap zurück — die filtert jetzt selbst weich (Vogel-Disk). Ausdrücklich.
      shadows={qualitaet.schatten && !istAus('schatten') ? SCHATTENART : false}
      frameloop={angehalten ? 'never' : 'always'}
      dpr={LOOK_FELS_DICHTE !== null ? LOOK_FELS_DICHTE : [1, qualitaet.dpr]}
      camera={{ fov: 55, near: 0.2, far: KAMERA_FERN, position: [0, GROESSE.kameraHoehe, GROESSE.kameraAbstand] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <WasserUmgebung werte={{ zenit: s.zenit, horizont: s.horizont, dunst: s.nebel,
        sonne: s.sonne, sonnenstand: s.sonnenstand, scheibe: s.scheibe, hof: s.hof,
        atmosphaere: s.atmosphaere }}>
      <Beleuchtung s={s} ziel={ref} wiesenbereich={wiesenbereich} fernMaterial={fernMaterial} geheilt={!!geheilt || GEHEILT_ANSICHT} />
      {!istAus('kulisse') && fernGeo && (
        <mesh geometry={fernGeo} material={fernMaterial} frustumCulled={false} renderOrder={-500} />
      )}
      <Terrain welt={welt} terrain={terrain} feld={feld} kacheln={kacheln} ziel={ref} senke={senke}
               strassen={strassen} strassenmaske={strassenmaske} wiesenbereich={wiesenbereich}
               props={istAus('baeume') ? LEERE_PROPS : props}
               dichte={istAus('gras') ? 0 : qualitaet.gras} weite={qualitaet.weite}
               rand={{ farbe: s.randFarbe, staerke: s.randStaerke }}
               fenster={s.fenster ?? 0} />
      {sandkasten && <primitive object={sandkasten.gruppe} />}
      {(felsArt === 'ki' || felsArt === 'scan') && <Suspense fallback={null}>
        <FelsVergleich art={felsArt} position={[felsX, hoeheAufFlaeche(feld, felsX, felsZ), felsZ]} />
      </Suspense>}
      <object3D ref={ref} position={start}>
        {/* Eigene Suspense-Grenze (G-134): Ein ladendes GLB darf nicht die ganze Szene
            aufhalten — ohne Grenze verwirft React beim ersten Aufbau den gesamten
            Baum samt allen `useMemo` (Klippen, Baender, Kacheln) und rechnet ihn nach
            jedem geladenen Modell neu. */}
        <Suspense fallback={null}>
          <SpielerFigur gier={gier} schritt={schritt} reittier={reittier} kampf={kampfFigur} waffenStufen={waffenStufen}
                        hoeheAn={feld.hoehe} landung={landung} luft={luft}
                        rand={{ farbe: s.randFarbe, staerke: s.randStaerke }} />
        </Suspense>
      </object3D>
      <Spieler feld={feld} ziel={ref} gier={gier} neigung={neigung}
               schritt={schritt} kollision={kollision} ausdauer={kraft}
               reitet={reitetRef} gleiterFrei={gleiterRef} onGleiten={onGleiten}
               anzug={anzugRef} onKoerper={onKoerper} landung={landung} luft={luft}
               meldeRand={meldeRand} stoecke={stoecke} kampfSperre={kampfSperre} kampfZielt={kampfZielt}
               sprung={spielerSprung} />
      {kampfplatz && (
        // Unter `Suspense`: Der Keiler lädt sein Modell. Ohne Grenze hielte das die ganze Szene an.
        <Suspense fallback={null}>
          <Kampfplatz ziel={ref} gier={gier} feld={feld} kollision={kollision}
                      ausdauer={kraft} gesperrt={kampfSperre} stand={kampfStand} figur={kampfFigur}
                      zielt={kampfZielt} aufstellung={kampfAufstellung} onEnde={kampfEnde} marke={kampfMarke} waffenStufen={waffenStufen} nacht={kampfNacht} richtung={kampfRichtung}
                      key={kampfEnde ? `welt-${kampfAufstellung?.join(',')}` : 'platz'} />
        </Suspense>
      )}
      {funde.length > 0 && (
        <Fundstellen orte={funde} ziel={ref} gelesen={gelesen ?? LEER} onFund={onFund} />
      )}
      {ortsmarken.length > 0 && (
        <Orte orte={ortsmarken} ziel={ref} onNah={onOrtNah} rand={{ farbe: s.randFarbe, staerke: s.randStaerke }}
              tageszeit={tageszeit}
              hoeheAn={(x, z) => hoeheAufFlaeche(feld, x, z)} />
      )}
      {lagerstellen && lagerstellen.length > 0 && (
        <Lagerstellen stellen={lagerstellen} nacht={tageszeit >= 0.86 || tageszeit < 0.2} ziel={ref}
                      hoeheAn={(x, z) => hoeheAufFlaeche(feld, x, z)} />
      )}
      {regent && regentOrt && (
        <Regentenort ort={regentOrt} kreatur={regent.kreatur} gestalt={regent.gestalt} ziel={ref} onNah={onRegentNah} />
      )}
      {!istAus('bauwerke') && BAUWERKE.length > 0 && (
        <Bauwerke ziel={ref} rand={{ farbe: s.randFarbe, staerke: s.randStaerke }} hoeheAn={feld.hoehe} />
      )}
      {vorkommen.length > 0 && gestalt && (
        <Kreaturen vorkommen={vorkommen} gestalt={gestalt} ziel={ref} gier={gier}
                   naehe={naehe} onBegegnung={onBegegnung} verbraucht={verbraucht}
                   rand={{ farbe: s.randFarbe, staerke: s.randStaerke }}
                   hoeheAn={(x, z) => hoeheAufFlaeche(feld, x, z)} kollision={kollision} />
      )}
      <Kamera ziel={ref} gier={gier} neigung={neigung} feld={feld} kollision={kollision} kampf={kampfFigur} />
      <EzBaumProbe ziel={ref} lokal={HOF_GRUEN_AN} milbinger={MILBINGERLICHT_AN && !!wiesenbereich} />
      {LOOK_FELS_AN && !istAus('kronen') && !(SCAN_BAEUME_AN && BAUWERKE.some(b => b.name === 'felsmulde' && (b.dateien.includes('baeume') || (SCAN_BUESCHEL_AN && b.dateien.includes('bueschel'))))) && <Suspense fallback={null}><Rahmenkronen hoeheAn={(x, z) => hoeheAufFlaeche(feld, x, z)} /></Suspense>}
      {/* D210: Bloom und Lichtschaechte (ADR-0012, Hebel 6); `?bloom=0`, `?schacht=0` zum Vergleich. */}
      <Kontur an={konturAn(true)} felsAtmosphaere={LOOK_FELS_AN && STIMMUNG_MESSLAUF === STIMMUNG.zielbildfels} ao={aoStaerke(1.4)} aoRadius={aoReichweite(8)}
              bloom={0.12} schacht={0.45} sonne={s.sonnenstand} sonnenFarbe={s.sonne} />
      <Messung melde={onMessung} />
      </WasserUmgebung>
    </Canvas>
  );
}

/**
 * D180: Wegelager sichtbar machen. Tags eine kalte Feuerstelle (Steinkreis, Scheite), nachts
 * Flamme, flackerndes Punktlicht und zwei Fackeln — die Gefahr ist von Weitem lesbar, bevor
 * die 22-m-Grenze greift. Nur Primitive, keine Assets.
 */
function Lagerstellen({ stellen, nacht, hoeheAn, ziel }: {
  stellen: readonly { x: number; z: number }[]; nacht: boolean; hoeheAn: (x: number, z: number) => number;
  ziel: React.RefObject<THREE.Object3D | null>;
}) {
  useEffect(() => () => lagerTon(Infinity, false), []);
  const lichter = useRef<(THREE.PointLight | null)[]>([]);
  const flammen = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const p = ziel.current?.position;
    lagerTon(p ? Math.min(...stellen.map(l => Math.hypot(l.x - p.x, l.z - p.z))) : Infinity, nacht);
    lichter.current.forEach((l, i) => { if (l) l.intensity = 14 + 5 * Math.sin(t * 9 + i) + 3 * Math.sin(t * 23 + i * 2); });
    flammen.current.forEach((f, i) => { if (f) f.scale.y = 1 + 0.18 * Math.sin(t * 11 + i * 3); });
  });
  return (
    <group>
      {stellen.map((l, i) => {
        const y = hoeheAn(l.x, l.z);
        return (
          <group key={i} position={[l.x, y, l.z]}>
            {Array.from({ length: 8 }, (_, k) => {
              const a = (k / 8) * Math.PI * 2;
              return <mesh key={k} position={[Math.cos(a) * 0.7, 0.1, Math.sin(a) * 0.7]} castShadow>
                <dodecahedronGeometry args={[0.18, 0]} /><meshStandardMaterial color="#6b675f" flatShading />
              </mesh>;
            })}
            {[0, 1, 2].map(k => (
              <mesh key={k} position={[0, 0.12, 0]} rotation={[0, (k / 3) * Math.PI, Math.PI / 2 - 0.25]}>
                <cylinderGeometry args={[0.06, 0.07, 1.0, 5]} /><meshStandardMaterial color={nacht ? '#3a2616' : '#4a3422'} flatShading />
              </mesh>
            ))}
            {nacht && <>
              <mesh ref={m => { flammen.current[i] = m; }} position={[0, 0.45, 0]}>
                <coneGeometry args={[0.3, 0.8, 6]} /><meshBasicMaterial color="#ffa640" toneMapped={false} />
              </mesh>
              <pointLight ref={p => { lichter.current[i] = p; }} position={[0, 1.2, 0]} color="#ff9a44" distance={22} decay={1.6} />
              {[[-3, 2], [3, -2]].map(([fx, fz], k) => (
                <group key={k} position={[fx, hoeheAn(l.x + fx, l.z + fz) - y, fz]}>
                  <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.04, 0.05, 1.8, 5]} /><meshStandardMaterial color="#3a2a1a" /></mesh>
                  <mesh position={[0, 1.9, 0]}><sphereGeometry args={[0.12, 6, 5]} /><meshBasicMaterial color="#ffb050" toneMapped={false} /></mesh>
                </group>
              ))}
            </>}
          </group>
        );
      })}
    </group>
  );
}
