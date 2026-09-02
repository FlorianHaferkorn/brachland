/**
 * BRACHLAND — Regionsszene
 *
 * Setzt die Art Direction um: Dämmerung, Nebel als Werkzeug, Silhouetten,
 * eine Signalfarbe für Befall. Alles Geometrie aus src/world, keine Texturen.
 *
 * Props laufen als InstancedMesh — 40.000 Bäume als Einzelobjekte würden jedes
 * Handy erledigen, als Instanzen sind es eine Handvoll Draw Calls.
 */
import { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Weltdaten } from '../world/osm.js';
import { baueTerrain, baueGebaeude, GROESSE, type TerrainErgebnis } from '../world/terrain.js';
import { zerlegeBaender, baueWegKachel, baueWasserKachel, baueFallKachel,
         baueGartenKachel, type Bandsatz } from '../world/baender.js';
import { useGLTF } from '@react-three/drei';
import { MIT_MODELL, MIT_GEHOERN, baueGehoern, widerristPunkt, saatAusId }
  from '../world/kreaturgestalt.js';
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
import { baueWindMaterial } from '../world/windmaterial.js';
import { findeKlippen, baueKlippenGeometrie, KLIPPEN_VARIANTEN, type Klippe } from '../world/klippen.js';
import { baueWasserMaterial, baueWegMaterial } from '../world/bandmaterial.js';
import { baueSpielerTeile, HUEFTE, SCHULTER } from '../spieler/figur.js';
import { baueKollision, type Kollisionsfeld } from '../spieler/kollision.js';
import { verteileProps, chunkeProps, propGeometrie, attrappeGeometrie, propPfad, propTon,
         VARIANTEN, type PropArt, type PropChunk, type PropInstanz } from '../world/props.js';
import { istAus } from './abschalter.js';
import { TERRAIN_SICHT, NEUAUFBAU_AB, PROP_NEUBEWERTUNG,
         FERN_NEUBEWERTUNG } from './sichtweiten.js';
import { waehleProps, type PropStufe } from './propauswahl.js';
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
export const HEMI_BODEN = '#2a352e';

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
    // Mond: harte kleine Scheibe, fast kein Hof.
    zenit: '#05080d', horizont: '#131c22', scheibe: 0.0009, hof: 900,
    // Nachts trägt der Umriss fast das ganze Bild — deshalb hier am stärksten.
    randFarbe: '#4d6b82', randStaerke: 0.30,
  },
  daemmerung: {
    himmel: '#141d20', nebel: '#1b2a2b', nebelNah: 60, nebelFern: 420,
    sonne: '#c8b48a', sonneStaerke: 1.25, umgebung: '#38494c', umgebungStaerke: 0.85,
    sonnenstand: [-120, 55, -90] as const,
    belichtung: 2.15,
    // Tief stehende Sonne: kleine Scheibe, sehr weiter Hof. Der Hof IST die Stimmung.
    zenit: '#0e1a24', horizont: '#3b3a34', scheibe: 0.0016, hof: 190,
    randFarbe: '#6e7f86', randStaerke: 0.22,
  },
  nebelmorgen: {
    himmel: '#20282a', nebel: '#2c3a39', nebelNah: 30, nebelFern: 240,
    sonne: '#d8d2c0', sonneStaerke: 0.9, umgebung: '#47585a', umgebungStaerke: 1.05,
    sonnenstand: [90, 40, -110] as const,
    belichtung: 1.45,
    // Im Dunst gibt es keine Scheibe, nur einen breiten hellen Fleck.
    zenit: '#26333a', horizont: '#3e4a48', scheibe: 0.0, hof: 42,
    // Im Dunst streut das Licht ohnehin um jede Kante — Rand dezent.
    randFarbe: '#8a9a9c', randStaerke: 0.14,
  },
  abendrot: {
    himmel: '#1a1614', nebel: '#2a221d', nebelNah: 50, nebelFern: 380,
    // Die Sonne steht bei 28 von 150 Einheiten Höhe — flacher Einfall, also kaum
    // Direktlicht auf waagerechtem Boden. Was das Bild trägt, ist hier die Umgebung.
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
    sonne: '#d98b5b', sonneStaerke: 1.15, umgebung: '#454f5e', umgebungStaerke: 0.95,
    sonnenstand: [130, 28, 70] as const,
    belichtung: 2.0,
    zenit: '#13202c', horizont: '#5c4030', scheibe: 0.0020, hof: 120,
    randFarbe: '#c07a4e', randStaerke: 0.26,
  },
};
export type StimmungsName = keyof typeof STIMMUNG;

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

function Terrain({ welt, terrain, feld, kacheln, ziel, props, dichte, rand }: {
  welt: Weltdaten; terrain: TerrainErgebnis; feld: HoehenFeld;
  kacheln: Kachel[]; ziel: React.RefObject<THREE.Object3D | null>;
  props: PropInstanz[]; dichte: number;
  /** Silhouettenlicht — Farbe und Stärke kommen aus der Stimmung. */
  rand: { farbe: string; staerke: number };
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
  const hausMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.88, flatShading: true,
  }), []);
  const wasserMaterial = useMemo(() => baueWasserMaterial(), []);
  const fallMaterial = useMemo(() => baueWasserMaterial(true), []);
  const wegMaterial = useMemo(() => baueWegMaterial(), []);
  const wind = useMemo(() => baueWindMaterial({
    amplitude: 0.55, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke,
  }), []);
  useEffect(() => {
    wind.setzeRand(new THREE.Color(rand.farbe), rand.staerke);
  }, [wind, rand]);

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

      <Props props={props} wind={wind.material} />
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
function Props({ props, wind }: { props: PropInstanz[]; wind: THREE.MeshStandardMaterial }) {
  const chunks = useMemo(() => chunkeProps(props), [props]);
  const [sichtbar, setSichtbar] = useState<{ c: PropChunk; stufe: PropStufe; id: string }[]>([]);
  const [fern, setFern] = useState<{ art: PropArt; instanzen: PropInstanz[] }[]>([]);
  const letzte = useRef(new THREE.Vector3(NaN, NaN, NaN));
  const letzteFern = useRef(new THREE.Vector3(NaN, NaN, NaN));

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
    const nahNeu = !(letzte.current.distanceTo(p) < PROP_NEUBEWERTUNG);
    const fernNeu = !(letzteFern.current.distanceTo(p) < FERN_NEUBEWERTUNG);
    if (!nahNeu && !fernNeu) return;

    // Der Anker ist der Punkt, an dem das Bündel zuletzt gebaut wurde. Warum die
    // Zugehörigkeit daran hängt und nicht an der Kamera, steht in `propauswahl.ts`.
    if (fernNeu || Number.isNaN(letzteFern.current.x)) letzteFern.current.copy(p);
    const anker: [number, number] = [letzteFern.current.x, letzteFern.current.z];
    const { nah, buendel } = waehleProps(chunks, [p.x, p.z], anker, fernNeu);

    if (nahNeu) {
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
      setFern([...buendel].map(([art, teile]) => ({
        art, instanzen: teile.flatMap(c => c.instanzen),
      })));
    }
  });

  return (
    <>
      {sichtbar.map(({ c, stufe, id }) =>
        <PropChunkMesh key={id} chunk={c} stufe={stufe} wind={wind} />)}
      {fern.map(({ art, instanzen }) =>
        <PropFernMesh key={art} art={art} instanzen={instanzen} />)}
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
function PropFernMesh({ art, instanzen }: { art: PropArt; instanzen: PropInstanz[] }) {
  const geo = useMemo(() => attrappeGeometrie(art), [art]);
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
      geometry={geo} material={FERN_MATERIAL}
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
  // Der Hook läuft unbedingt, auch für Bäume: Hooks dürfen nicht bedingt laufen.
  // Bäume sind prozedural (D40) und haben deshalb keine Varianten — sie bekommen
  // einen beliebigen, ohnehin geladenen Pfad, damit die Hook-Reihenfolge steht.
  const pfad = propPfad((liste[variante] ?? liste[0])?.datei ?? VARIANTEN.busch[0].datei);
  const { scene } = useGLTF(pfad);
  const eigen = art === 'nadelbaum' ? 'fichte' : art === 'laubbaum' ? 'buche' : null;
  return useMemo(() => {
    if (eigen) return { geo: baueBaum(eigen, variante, stufe === 'nah' ? 'voll' : 'mittel') };
    let geo: THREE.BufferGeometry | null = null;
    scene.traverse(o => {
      if (!geo && (o as THREE.Mesh).isMesh) geo = (o as THREE.Mesh).geometry.clone();
    });
    // Keine Normierung mehr. Die Höhe steht in `VARIANTEN` und ist beim Bauen in
    // die Datei eingerechnet — sie hier erneut auf eine Zielhöhe je Art zu ziehen,
    // hätte alle sechs Grasvarianten wieder auf dieselben 0,35 m gestreckt.
    return { geo: (geo ?? propGeometrie(art)) as THREE.BufferGeometry };
  }, [scene, art, eigen, variante, stufe]);
}

const LEER: ReadonlySet<string> = new Set();

/** Welche Auflösung ein Chunk gerade zeigt. */
function PropChunkMesh({ chunk, stufe, wind }: {
  chunk: PropChunk; stufe: PropStufe; wind: THREE.MeshStandardMaterial;
}) {
  const fern = stufe === 'fern';
  const { geo } = useNormiertesPropMesh(chunk.art, chunk.variante, stufe);
  const fernGeo = useMemo(() => attrappeGeometrie(chunk.art), [chunk.art]);
  // Nur was sich biegen kann, bekommt das Windmaterial. Findlinge und Totholz
  // schwingen nicht, und ein wackelnder Findling zerstört mehr Glaubwürdigkeit,
  // als bewegtes Laub aufbaut.
  const biegsam = chunk.art === 'nadelbaum' || chunk.art === 'laubbaum' || chunk.art === 'busch';
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
      geometry={fern ? fernGeo : geo}
      material={fern ? FERN_MATERIAL : (biegsam ? wind : PROP_MATERIAL)}
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

function Kreaturen({ vorkommen, gestalt, ziel, gier, naehe, onBegegnung, verbraucht, rand }: {
  vorkommen: Vorkommen[];
  gestalt: (kreatur: string, mutation?: number) => THREE.BufferGeometry;
  ziel: React.RefObject<THREE.Object3D | null>;
  gier: React.RefObject<number>;
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
  const naechste = useRef<{ x: number; z: number; kreatur: string } | null>(null);

  // Kreaturen sind das, wonach der Spieler sucht — ihr Umriss muss vom Hang
  // wegstehen. Wind bekommen sie keinen (Amplitude 0): Ein schwingendes Tier
  // sieht nicht nach Wind aus, sondern nach kaputter Animation.
  const { material, setzeRand } = useMemo(() => baueWindMaterial({
    amplitude: 0, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke * 1.4,
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

  useFrame(() => {
    const p = ziel.current?.position;
    if (!p) return;

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
      let beste = Infinity, bx = 0, bz = 0, art = '';
      for (const v of uebrig) {
        const d = Math.hypot(v.position[0] - p.x, v.position[2] - p.z);
        if (d >= beste) continue;
        beste = d; bx = v.position[0]; bz = v.position[2]; art = v.kreatur;
      }
      naechste.current = beste < Infinity ? { x: bx, z: bz, kreatur: art } : null;
    }

    // Abstand und Richtung dagegen jedes Bild: Der Pfeil muss sich beim Drehen
    // mitdrehen, sonst zeigt er nach dem ersten Blickwechsel ins Leere.
    if (naehe?.current) {
      const n = naehe.current;
      const z = naechste.current;
      if (!z) { n.abstand = Infinity; n.winkel = 0; n.kreatur = ''; }
      else {
        n.abstand = Math.hypot(z.x - p.x, z.z - p.z);
        n.kreatur = z.kreatur;
        n.winkel = peilung(p.x, p.z, z.x, z.z, gier.current);
      }
    }

    if (!onBegegnung) return;
    if (sperre.current) {
      if (sperre.current.distanceTo(p) < SPERRE_BIS) return;
      sperre.current = null;
    }
    for (const v of nah) {
      const d = Math.hypot(v.position[0] - p.x, v.position[2] - p.z);
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
          ? <KreaturModell key={v.id} kreatur={v.kreatur} material={material}
                           position={v.position} drehung={v.drehung} mutation={v.mutation}
                           // Stufe 2 ist 15–25 % groesser, Stufe 3 nochmal — aus der Stilreferenz.
                           skalierung={1 + v.mutation * 0.2} />
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
function KreaturModell({ kreatur, material, position, drehung, mutation, skalierung }: {
  kreatur: string;
  material: THREE.Material;
  position: [number, number, number];
  drehung: number;
  mutation: number;
  skalierung: number;
}) {
  const { scene } = useGLTF(`/creatures/${kreatur}.glb`);
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
  const geo = useMemo(() => {
    let g: THREE.BufferGeometry | null = null;
    scene.traverse(o => { if (!g && (o as THREE.Mesh).isMesh) g = (o as THREE.Mesh).geometry; });
    if (!g || !MIT_GEHOERN.has(kreatur)) return g;
    const koerper = g as THREE.BufferGeometry;
    const anker = widerristPunkt(koerper);
    const gehoern = baueGehoern(anker, anker.y, mutation, 'wildling', saatAusId(kreatur));
    // `mergeGeometries` verlangt gleiche Attribute. Das Modell kommt ohne
    // Normalen (D107), der Anbau bringt welche mit — also fliegen sie hier weg,
    // statt sie am Modell zu erfinden.
    gehoern.deleteAttribute('normal');
    gehoern.deleteAttribute('uv');
    const roh = koerper.index ? koerper.toNonIndexed() : koerper;
    return mergeGeometries([roh, gehoern], false) ?? koerper;
  }, [scene, kreatur, mutation]);
  if (!geo) return null;
  return (
    <mesh geometry={geo} material={material} position={position}
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

export type OrtsArt = 'zuflucht' | 'bewohner';
export interface Ortsmarke { id: string; art: OrtsArt; position: [number, number, number] }

function Orte({ orte, ziel, onNah }: {
  orte: Ortsmarke[];
  ziel: React.RefObject<THREE.Object3D | null>;
  /** Der nächste Ort in Reichweite, oder null. Wird nur bei Wechsel gerufen. */
  onNah?: (id: string | null) => void;
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
          ) : (
            <mesh geometry={figur} material={tuch} castShadow receiveShadow />
          )}
          <mesh geometry={punkt} position={[0, o.art === 'zuflucht' ? 2.35 : 1.85, 0]}
                material={punktMat} />
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
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = s.belichtung;
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
      <hemisphereLight args={[s.umgebung, HEMI_BODEN, s.umgebungStaerke]} />
      <directionalLight
        ref={sonne}
        position={s.sonnenstand as unknown as [number, number, number]}
        color={s.sonne} intensity={s.sonneStaerke}
        castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-250} shadow-camera-right={250}
        shadow-camera-top={250} shadow-camera-bottom={-250}
        shadow-camera-far={700} shadow-bias={-0.0008}
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
                   gleiterFrei, onGleiten, meldeRand, stoecke }: {
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
    const e = eingabe.current;

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
 * Sichtbare Figur am Spieleranker — die Größenreferenz für alles andere.
 *
 * Dreht sich mit `gier` und **geht**: Beine und Arme schwingen gegenläufig um Hüfte
 * und Schulter, der Rumpf hebt sich zweimal je Schritt. Kein Rig, kein Skinning —
 * vier Rotationen und ein Versatz je Bild. Der Unterschied zum vorherigen Zustand
 * ist trotzdem der zwischen „gleitet über den Boden" und „läuft".
 */
function SpielerFigur({ gier, schritt, rand, reittier }: {
  gier: React.RefObject<number>;
  schritt: React.RefObject<{ phase: number; tempo: number }>;
  rand: { farbe: string; staerke: number };
  /**
   * Silhouette und Widerristhöhe des Reittiers, oder null.
   *
   * Der Reiter wird um die Widerristhöhe angehoben und hört auf zu gehen — die
   * Beine schwingen im Sattel nicht. Was sich stattdessen bewegt, ist das Tier,
   * und zwar mit derselben Schrittphase: Ein Reittier mit eigener Frequenz sähe
   * aus, als rutschte der Reiter darauf herum.
   */
  reittier?: { geometrie: THREE.BufferGeometry; hoehe: number } | null;
}) {
  const teile = useMemo(() => baueSpielerTeile(), []);
  const { material, setzeRand } = useMemo(() => baueWindMaterial({
    amplitude: 0, randFarbe: new THREE.Color(rand.farbe), randStaerke: rand.staerke,
  }), []);
  useEffect(() => {
    setzeRand(new THREE.Color(rand.farbe), rand.staerke);
  }, [setzeRand, rand]);
  const gruppe = useRef<THREE.Group>(null);
  const rumpf = useRef<THREE.Group>(null);
  const beinL = useRef<THREE.Mesh>(null);
  const beinR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);

  const reiter = useRef<THREE.Group>(null);
  const tier = useRef<THREE.Group>(null);

  useFrame(() => {
    if (gruppe.current) gruppe.current.rotation.y = gier.current;
    const { phase, tempo } = schritt.current;
    // Ausschlag wächst mit dem Tempo und läuft bei Stillstand aus, statt hart
    // einzurasten — sonst zuckt die Figur bei jedem Loslassen.
    const stark = Math.min(1, tempo / RENNEN);
    // Im Sattel schwingen die Beine nicht. Sie hängen, und der Reiter wippt.
    const schwung = reittier ? 0 : Math.sin(phase) * (0.35 + 0.45 * stark);
    if (beinL.current) beinL.current.rotation.x = reittier ? 0.9 : schwung;
    if (beinR.current) beinR.current.rotation.x = reittier ? 0.9 : -schwung;
    if (armL.current) armL.current.rotation.x = reittier ? 0.5 : -schwung * 0.7;
    if (armR.current) armR.current.rotation.x = reittier ? 0.5 : schwung * 0.7;
    // Zweimal je Schritt auf und ab — einmal je Fuß.
    if (rumpf.current) rumpf.current.position.y = Math.abs(Math.cos(phase)) * 0.055 * stark;

    if (reittier) {
      // Reiter und Tier teilen sich die Phase. Der Reiter wippt in halber
      // Frequenz und mit größerem Ausschlag — das ist der Unterschied zwischen
      // „sitzt auf etwas" und „steht daneben".
      /**
       * **Minus `HUEFTE`.** Der Ursprung der Spielerfigur sind ihre Füße; wer sie
       * um die Widerristhöhe anhebt, stellt sie auf den Rücken des Tieres statt
       * sie daraufzusetzen — eine ganze Hüfthöhe zu hoch, und im Bild schwebt der
       * Reiter über seinem Reittier. Genau das war am 26.08.2026 zu sehen.
       * Gesetzt wird die **Hüfte** auf den Widerrist; die Beine hängen von dort.
       */
      if (reiter.current) {
        reiter.current.position.y =
          reittier.hoehe - HUEFTE + Math.sin(phase * 0.5) * 0.06 * stark;
      }
      if (tier.current) {
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
          <mesh geometry={reittier.geometrie} material={material} castShadow receiveShadow />
        </group>
      )}
      <group ref={reiter}>
      <group ref={rumpf}>
        <mesh geometry={teile.rumpf} material={material} castShadow receiveShadow />
        <mesh ref={armL} geometry={teile.arm} material={material}
              position={[-0.28, SCHULTER, 0]} castShadow />
        <mesh ref={armR} geometry={teile.arm} material={material}
              position={[0.28, SCHULTER, 0]} castShadow />
      </group>
      <mesh ref={beinL} geometry={teile.bein} material={material}
            position={[-0.11, HUEFTE, 0]} castShadow />
      <mesh ref={beinR} geometry={teile.bein} material={material}
            position={[0.11, HUEFTE, 0]} castShadow />
      </group>
    </group>
  );
}

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
    const g = gier.current;
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
    camera.position.copy(geglaettet.current);
    camera.lookAt(p.x, blickY, p.z);
  });
  return null;
}

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
  orte?: { id: string; art: OrtsArt; ort: [number, number] }[];
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
  reittier?: { geometrie: THREE.BufferGeometry; hoehe: number } | null;
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
}

export function RegionsSzene({
  welt, tageszeit = 0.26, spielerRef, onMessung,
  qualitaet = QUALITAET_STANDARD, kreaturen, gestalt, verbraucht, onBegegnung, naehe,
  regent, onRegentNah, gleiterFrei, onGleiten, fundstellen, gelesen, onFund, orte, onOrtNah,
  startPosition, startBlick = 0, ausdauer, reittier = null, angehalten = false,
  fernland = null, meldeRand, stoecke,
}: RegionsSzeneProps) {
  const eigenerRef = useRef<THREE.Object3D>(null);
  const ref = spielerRef ?? eigenerRef;
  const eigeneAusdauer = useRef<Ausdauerzustand>(neueAusdauer());
  const kraft = ausdauer ?? eigeneAusdauer;
  const gier = useRef(startBlick);
  // Einmal je Zeitpunkt mischen, nicht je Bild: Farbmischung ist billig, aber sie
  // hängt an einem Regler und nicht an der Bildrate.
  const s = useMemo(() => stimmungBei(tageszeit), [tageszeit]);
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
  const feld = useMemo(() => baueHoehenfeld(welt), [welt]);
  const kacheln = useMemo(() => baueKachelraster(feld), [feld]);

  // Props einmal zentral: Die Szene zeichnet sie, die Kollision braucht dieselben
  // Positionen. Zweimal verteilen hieße, gegen unsichtbare Bäume zu laufen.
  const props = useMemo(() => {
    const roh = verteileProps(welt, { ...terrain, hoeheAn: feld.hoehe }, 1);
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
      id: o.id, art: o.art,
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
      <Beleuchtung s={s} ziel={ref} />
      {!istAus('kulisse') && fernGeo && (
        <mesh geometry={fernGeo} material={fernMaterial} frustumCulled={false} renderOrder={-500} />
      )}
      <Terrain welt={welt} terrain={terrain} feld={feld} kacheln={kacheln} ziel={ref}
               props={istAus('baeume') ? LEERE_PROPS : props}
               dichte={istAus('gras') ? 0 : qualitaet.gras}
               rand={{ farbe: s.randFarbe, staerke: s.randStaerke }} />
      <object3D ref={ref} position={start}>
        <SpielerFigur gier={gier} schritt={schritt} reittier={reittier}
                      rand={{ farbe: s.randFarbe, staerke: s.randStaerke }} />
      </object3D>
      <Spieler feld={feld} ziel={ref} gier={gier} neigung={neigung}
               schritt={schritt} kollision={kollision} ausdauer={kraft}
               reitet={reitetRef} gleiterFrei={gleiterRef} onGleiten={onGleiten}
               meldeRand={meldeRand} stoecke={stoecke} />
      {funde.length > 0 && (
        <Fundstellen orte={funde} ziel={ref} gelesen={gelesen ?? LEER} onFund={onFund} />
      )}
      {ortsmarken.length > 0 && (
        <Orte orte={ortsmarken} ziel={ref} onNah={onOrtNah} />
      )}
      {regent && regentOrt && (
        <Regentenort ort={regentOrt} gestalt={regent.gestalt} ziel={ref} onNah={onRegentNah} />
      )}
      {vorkommen.length > 0 && gestalt && (
        <Kreaturen vorkommen={vorkommen} gestalt={gestalt} ziel={ref} gier={gier}
                   naehe={naehe} onBegegnung={onBegegnung} verbraucht={verbraucht}
                   rand={{ farbe: s.randFarbe, staerke: s.randStaerke }} />
      )}
      <Kamera ziel={ref} gier={gier} neigung={neigung} feld={feld} kollision={kollision} />
      <Messung melde={onMessung} />
    </Canvas>
  );
}
