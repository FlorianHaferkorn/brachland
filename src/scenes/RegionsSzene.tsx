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
import { baueTerrain, baueGewaesser, baueGebaeude, baueWege, baueWasserfaelle, GROESSE,
         type TerrainErgebnis } from '../world/terrain.js';
import { useGLTF } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { baueHoehenfeld, baueKachelraster, lodFuerAbstand, baueKachelGeometrie,
         hoeheAufFlaeche, type HoehenFeld, type Kachel } from '../world/lod.js';
import { benutzeSteuerung } from '../spieler/steuerung.js';
import { peilung } from '../spieler/peilung.js';
import { baueBueschelGeometrie, baueKleinzeugGeometrie, baueStreuMaterial,
         streueUmgebung, streueKleinzeug,
         STREU_MAX, KLEIN_MAX, STREU_NACHZIEHEN } from '../world/streuung.js';
import { baueBodenMaterial } from '../world/bodenmaterial.js';
import { baueBaum } from '../world/baum.js';
import { baueHimmel, setzeHimmel } from '../world/himmel.js';
import { baueWindMaterial } from '../world/windmaterial.js';
import { findeKlippen, baueKlippenGeometrie, type Klippe } from '../world/klippen.js';
import { baueWasserMaterial, baueWegMaterial } from '../world/bandmaterial.js';
import { baueSpielerTeile, HUEFTE, SCHULTER } from '../spieler/figur.js';
import { baueKollision, type Kollisionsfeld } from '../spieler/kollision.js';
import { verteileProps, chunkeProps, propGeometrie, attrappeGeometrie, propPfad, VARIANTEN, ZIELHOEHE,
         PROP_FARBE, type PropArt, type PropChunk, type PropInstanz } from '../world/props.js';
import { TERRAIN_SICHT, NEUAUFBAU_AB, ATTRAPPE_AB, MITTEL_AB, PROP_NEUBEWERTUNG } from './sichtweiten.js';
import { verteileKreaturen, type Vorkommen, type KreaturSpawn } from '../world/vorkommen.js';

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

export const STIMMUNG: Record<string, Stimmung> = {
  nacht: {
    himmel: '#0a0f12', nebel: '#101a1c', nebelNah: 25, nebelFern: 260,
    sonne: '#8fa9c4', sonneStaerke: 0.45, umgebung: '#162124', umgebungStaerke: 0.35,
    sonnenstand: [-80, 90, 60] as const,
    belichtung: 1.40,
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
    sonne: '#d98b5b', sonneStaerke: 1.15, umgebung: '#463a35', umgebungStaerke: 0.7,
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
   * Wege, Gewässer und Gebäude setzen auf dem Gelände auf — sie brauchen deshalb
   * dieselbe Höhenfunktion, die den sichtbaren Boden zeichnet.
   *
   * `terrain.hoeheAn` tastet das 41,8-m-Raster stufig ab, `feld.hoehe` interpoliert
   * und legt Mikrorelief darüber. Gemessen weichen die beiden im Mittel um 2,35 m
   * ab, auf Steilhängen bis 24 m — genau die Flächen, die dann in der Luft hängen
   * oder im Berg verschwinden.
   */
  const aufBoden = useMemo(() => ({ ...terrain, hoeheAn: feld.hoehe }), [terrain, feld]);
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
  const { gewaesser, gebaeude, wege, wasserfaelle } = useMemo(() => ({
    gewaesser: baueGewaesser(welt, aufBoden),
    gebaeude: baueGebaeude(welt, aufBoden),
    wege: baueWege(welt, aufBoden),
    wasserfaelle: baueWasserfaelle(welt, aufBoden),
  }), [welt, aufBoden]);

  return (
    <group>
      <LodTerrain feld={feld} kacheln={kacheln} ziel={ziel} />

      {wege && <mesh geometry={wege} material={wegMaterial} receiveShadow />}
      {gewaesser && <mesh geometry={gewaesser} material={wasserMaterial} />}
      {wasserfaelle && <mesh geometry={wasserfaelle} material={fallMaterial} />}

      {klippen.length > 0 && <Klippen klippen={klippen} ziel={ziel} material={wind.material} />}

      {gebaeude && (
        <mesh geometry={gebaeude} castShadow receiveShadow>
          {/* Wand, Holz und Fenster stecken jetzt als Vertex-Farben in der Geometrie.
              Ein einziges Material für 2.033 Häuser bleibt es trotzdem. */}
          <meshStandardMaterial vertexColors roughness={0.88} flatShading />
        </mesh>
      )}

      <Props props={props} wind={wind.material} />
      <Streuschicht feld={feld} ziel={ziel} dichte={dichte} />
    </group>
  );
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
  const letzte = useRef(new THREE.Vector3(NaN, NaN, NaN));

  useFrame(({ camera }) => {
    const p = camera.position;
    if (letzte.current.distanceTo(p) < PROP_NEUBEWERTUNG) return;
    letzte.current.copy(p);

    const liste: { c: PropChunk; stufe: PropStufe; id: string }[] = [];
    for (const c of chunks) {
      const mitte = Math.hypot(p.x - c.mitte[0], p.z - c.mitte[1]);
      // Sichtbarkeit über den **nächsten Rand** des Chunks: Ein Chunk, von dem eine
      // Ecke in Reichweite ragt, muss gezeichnet werden.
      if (mitte - c.radius > c.sichtweite) continue;
      /**
       * Die Attrappen-Entscheidung dagegen über die **Mitte**.
       *
       * Vorher stand hier ebenfalls `mitte - radius`. Bei 120-m-Chunks sind das 90 m
       * Radius, das Nahfeld reichte also bis 165 m statt bis 75 — und weil ein Chunk
       * nur ganz oder gar nicht umschaltet, wurden rund tausend Fichten in voller
       * Auflösung gezeichnet. Gemessen 537.000 Dreiecke, wo 200.000 erwartet waren.
       *
       * Über die Mitte gerechnet ist die Entscheidung im Mittel richtig: Der halbe
       * Chunk liegt näher, der halbe ferner, und der Fehler hebt sich auf, statt
       * sich immer zugunsten der teuren Variante zu entscheiden.
       */
      const stufe: PropStufe = mitte > ATTRAPPE_AB ? 'fern' : mitte > MITTEL_AB ? 'mittel' : 'nah';
      liste.push({ c, stufe, id: `${c.art}:${c.variante}:${c.mitte[0]}:${c.mitte[1]}` });
    }
    setSichtbar(liste);
  });

  return (
    <>
      {sichtbar.map(({ c, stufe, id }) =>
        <PropChunkMesh key={id} chunk={c} stufe={stufe} wind={wind} />)}
    </>
  );
}

/**
 * Lädt das Modell der Variante und normiert es auf die reale Zielhöhe.
 * useGLTF cached pro Pfad — 23 Dateien werden einmal geladen, egal wie viele Chunks.
 */
function useNormiertesPropMesh(art: PropArt, variante: number, stufe: PropStufe = 'nah') {
  const pfad = propPfad(VARIANTEN[art][variante] ?? VARIANTEN[art][0]);
  // Der Hook wird unbedingt aufgerufen, auch wenn das Ergebnis für Bäume verworfen
  // wird: Hooks dürfen nicht bedingt laufen. Der Ladevorgang ist gecacht und kostet
  // beim zweiten Mal nichts; die GLB verschwinden, sobald alle Arten prozedural sind.
  const { scene } = useGLTF(pfad);
  const eigen = art === 'nadelbaum' ? 'fichte' : art === 'laubbaum' ? 'buche' : null;
  return useMemo(() => {
    if (eigen) return { geo: baueBaum(eigen, variante, stufe === 'nah' ? 'voll' : 'mittel'), mat: null };
    let geo: THREE.BufferGeometry | null = null;
    let mat: THREE.Material | null = null;
    scene.traverse(o => {
      if (!geo && (o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        geo = m.geometry.clone();
        mat = Array.isArray(m.material) ? m.material[0] : m.material;
      }
    });
    if (!geo) return { geo: propGeometrie(art), mat: null };
    const g = geo as THREE.BufferGeometry;
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const hoehe = bb.max.y - bb.min.y || 1;
    const faktor = ZIELHOEHE[art] / hoehe;
    // auf den Boden setzen und auf reale Meter skalieren
    g.translate(0, -bb.min.y, 0);
    g.scale(faktor, faktor, faktor);
    return { geo: g, mat: mat as THREE.Material | null };
  }, [scene, art, eigen, variante, stufe]);
}

/** Welche Auflösung ein Chunk gerade zeigt. */
export type PropStufe = 'nah' | 'mittel' | 'fern';

function PropChunkMesh({ chunk, stufe, wind }: {
  chunk: PropChunk; stufe: PropStufe; wind: THREE.MeshStandardMaterial;
}) {
  const fern = stufe === 'fern';
  const { geo, mat } = useNormiertesPropMesh(chunk.art, chunk.variante, stufe);
  const fernGeo = useMemo(() => attrappeGeometrie(chunk.art), [chunk.art]);
  const fernMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 1, metalness: 0,
  }), []);
  // Nur was sich biegen kann, bekommt das Windmaterial. Findlinge und Totholz
  // schwingen nicht, und ein wackelnder Findling zerstört mehr Glaubwürdigkeit,
  // als bewegtes Laub aufbaut.
  const biegsam = chunk.art === 'nadelbaum' || chunk.art === 'laubbaum' || chunk.art === 'busch';
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Object3D();
    chunk.instanzen.forEach((p, i) => {
      m.position.set(...p.position);
      m.rotation.y = p.drehung;
      m.scale.setScalar(p.skalierung);
      m.updateMatrix();
      ref.current!.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
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
  const rueckfall = useMemo(() => new THREE.MeshStandardMaterial({
    color: PROP_FARBE[chunk.art], flatShading: true, roughness: 0.95,
  }), [chunk.art]);
  const grossesTeil = chunk.art === 'nadelbaum' || chunk.art === 'laubbaum' || chunk.art === 'findling';

  return (
    <instancedMesh
      ref={ref} args={[undefined, undefined, chunk.instanzen.length]}
      geometry={fern ? fernGeo : geo}
      material={fern ? fernMaterial : (biegsam ? wind : (mat ?? rueckfall))}
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
  gestalt: (kreatur: string) => THREE.BufferGeometry;
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
        <mesh key={v.id} geometry={gestalt(v.kreatur)} material={material}
              position={v.position} rotation={[0, v.drehung, 0]}
              scale={1 + v.stufe * 0.18}
              castShadow receiveShadow />
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
  const geometrien = useMemo(() => [0, 1, 2].map(v => baueKlippenGeometrie(v)), []);
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
      <hemisphereLight args={[s.umgebung, '#121a16', s.umgebungStaerke]} />
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
 * Gehen und Rennen in m/s.
 *
 * Bewusst **nicht** realistisch: 1,4 m/s ist echtes Gehtempo und fühlt sich im Spiel
 * zäh an — die Region ist 4 km breit. Der Maßstab bleibt 1:1 (begründete Entscheidung,
 * ADR-0001), das Tempo wird überhöht. Querung rennend ~9,5 min, gehend ~22 min.
 */
/**
 * Gehen und Rennen in Metern je Sekunde.
 *
 * 4,2 und 11,0 sind schneller als der Mensch. Das ist eine bewusste Abweichung vom
 * 1:1-Maßstab an genau einer Stelle: Die Region ist 4 km breit, und bis es Traversal
 * gibt (Reitkreatur, Pfade, Schnellreise) ist der Weg sonst reine Wartezeit. Ledger
 * G-27 — die Zahl geht zurück, sobald Traversal da ist.
 */
const GEHEN = 4.2;
const RENNEN = 11.0;

/** Eine halbe Schrittlänge in Metern — bestimmt die Frequenz der Laufanimation. */
const SCHRITTLAENGE = 0.9;

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
function Spieler({ feld, ziel, gier, neigung, schritt, kollision }: {
  feld: HoehenFeld;
  ziel: React.RefObject<THREE.Object3D | null>;
  gier: React.RefObject<number>;
  neigung: React.RefObject<number>;
  /** Laufphase in Radiant und aktuelles Tempo — die Figur hängt daran. */
  schritt: React.RefObject<{ phase: number; tempo: number }>;
  kollision: Kollisionsfeld;
}) {
  const { gl } = useThree();
  const eingabe = benutzeSteuerung(gl.domElement);

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
    const tempo = e.rennen ? RENNEN : GEHEN;
    // Blickrichtung ist -Z, um `gier` um die Y-Achse gedreht.
    const dx = (-Math.sin(g) * e.vor + Math.cos(g) * e.seit) * tempo * dt;
    const dz = (-Math.cos(g) * e.vor - Math.sin(g) * e.seit) * tempo * dt;

    if (dx !== 0 || dz !== 0) {
      const halbB = feld.breiteMeter / 2 - 8;
      const halbT = feld.tiefeMeter / 2 - 8;
      const [kx, kz] = kollision.schiebeRaus(p.x + dx, p.z + dz);
      p.x = Math.max(-halbB, Math.min(halbB, kx));
      p.z = Math.max(-halbT, Math.min(halbT, kz));
    }
    // Auf der GEZEICHNETEN Fläche stehen, nicht auf der stetigen Funktion —
    // sonst schwebt die Figur auf Kuppen sichtbar über dem Boden.
    p.y = hoeheAufFlaeche(feld, p.x, p.z);

    // Schrittfrequenz aus der tatsächlichen Geschwindigkeit: Wer rennt, macht
    // schnellere Schritte, nicht dieselben Schritte schneller hintereinander.
    const strecke = Math.hypot(dx, dz);
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
function SpielerFigur({ gier, schritt, rand }: {
  gier: React.RefObject<number>;
  schritt: React.RefObject<{ phase: number; tempo: number }>;
  rand: { farbe: string; staerke: number };
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

  useFrame(() => {
    if (gruppe.current) gruppe.current.rotation.y = gier.current;
    const { phase, tempo } = schritt.current;
    // Ausschlag wächst mit dem Tempo und läuft bei Stillstand aus, statt hart
    // einzurasten — sonst zuckt die Figur bei jedem Loslassen.
    const stark = Math.min(1, tempo / RENNEN);
    const schwung = Math.sin(phase) * (0.35 + 0.45 * stark);
    if (beinL.current) beinL.current.rotation.x = schwung;
    if (beinR.current) beinR.current.rotation.x = -schwung;
    if (armL.current) armL.current.rotation.x = -schwung * 0.7;
    if (armR.current) armR.current.rotation.x = schwung * 0.7;
    // Zweimal je Schritt auf und ab — einmal je Fuß.
    if (rumpf.current) rumpf.current.position.y = Math.abs(Math.cos(phase)) * 0.055 * stark;
  });

  return (
    <group ref={gruppe}>
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
  );
}

/** Third-Person-Kamera, die dem Spieler folgt. */
function Kamera({ ziel, gier, neigung }: {
  ziel: React.RefObject<THREE.Object3D | null>;
  gier: React.RefObject<number>;
  neigung: React.RefObject<number>;
}) {
  const { camera } = useThree();
  // Abstände in echten Metern — der Spieler ist 1,8 m hoch und soll auch so wirken.
  const geglaettet = useRef(new THREE.Vector3(0, GROESSE.kameraHoehe, GROESSE.kameraAbstand));
  const gesetzt = useRef(false);
  useFrame((_, dt) => {
    const p = ziel.current?.position ?? new THREE.Vector3();
    // Die Kamera kreist auf einer Kugel um den Blickpunkt auf Brusthöhe: `gier`
    // dreht herum, `neigung` hebt und senkt. Bei Neigung 0 steht sie waagerecht
    // hinter dem Spieler, bei NEIGUNG_MAX fast senkrecht darüber.
    const g = gier.current;
    const n = neigung.current;
    const r = GROESSE.kameraAbstand;
    const wunsch = new THREE.Vector3(
      p.x + Math.sin(g) * Math.cos(n) * r,
      p.y + GROESSE.kameraBlickHoehe + Math.sin(n) * r,
      p.z + Math.cos(g) * Math.cos(n) * r,
    );
    // Erstes Bild hart setzen: sonst fliegt die Kamera aus dem Ursprung (y=0) zum
    // Startpunkt hoch — bei 170 m Geländehöhe eine sichtbare Sekunde durch den Berg.
    if (!gesetzt.current) { geglaettet.current.copy(wunsch); gesetzt.current = true; }
    geglaettet.current.lerp(wunsch, Math.min(1, dt * 4));
    camera.position.copy(geglaettet.current);
    camera.lookAt(p.x, p.y + GROESSE.kameraBlickHoehe, p.z);
  });
  return null;
}

// Alle Prop-Modelle vorladen — sonst poppen sie im ersten Bild nach.
for (const varianten of Object.values(VARIANTEN))
  for (const v of varianten) useGLTF.preload(propPfad(v));

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
  /** Silhouette je Kreatur-ID. Kommt von aussen, damit die Szene keine Inhalte kennt. */
  gestalt?: (kreatur: string) => THREE.BufferGeometry;
  /** Bereits gefangene oder besiegte Vorkommen. */
  verbraucht?: ReadonlySet<string>;
  onBegegnung?: (v: Vorkommen) => void;
  /** Wird jedes Bild mit der nächsten Kreatur beschrieben — Grundlage der Anzeige. */
  naehe?: React.RefObject<Naehe>;
  /** Ort des Regenten in Weltkoordinaten (x, z) plus seine Silhouette. */
  regent?: { ort: [number, number]; gestalt: THREE.BufferGeometry };
  /** Wird gerufen, wenn der Spieler den Regentenort betritt oder verlässt. */
  onRegentNah?: (nah: boolean) => void;
  /** Startposition; ohne Angabe die Regionsmitte. Der Spielstand setzt sie. */
  startPosition?: [number, number];
  /**
   * Hält die Bildschleife an, ohne die Szene abzubauen.
   *
   * Während eines Kampfes ist die Welt unsichtbar, aber sie darf nicht neu gebaut
   * werden: Terrain, Höhenfeld, 155.000 Props und die Kollision kosten zusammen
   * mehrere Sekunden. `frameloop="never"` lässt alles stehen und zeichnet nichts.
   */
  angehalten?: boolean;
}

export function RegionsSzene({
  welt, tageszeit = 0.26, spielerRef, onMessung,
  qualitaet = QUALITAET_STANDARD, kreaturen, gestalt, verbraucht, onBegegnung, naehe,
  regent, onRegentNah, startPosition, angehalten = false,
}: RegionsSzeneProps) {
  const eigenerRef = useRef<THREE.Object3D>(null);
  const ref = spielerRef ?? eigenerRef;
  const gier = useRef(0);
  // Einmal je Zeitpunkt mischen, nicht je Bild: Farbmischung ist billig, aber sie
  // hängt an einem Regler und nicht an der Bildrate.
  const s = useMemo(() => stimmungBei(tageszeit), [tageszeit]);
  const neigung = useRef(NEIGUNG_START);
  const schritt = useRef({ phase: 0, tempo: 0 });

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

  const start = useMemo<[number, number, number]>(() => {
    const [x, z] = startPosition ?? [0, 0];
    return [x, hoeheAufFlaeche(feld, x, z), z];
  }, [feld, startPosition]);

  return (
    <Canvas
      shadows={qualitaet.schatten}
      frameloop={angehalten ? 'never' : 'always'}
      dpr={[1, qualitaet.dpr]}
      camera={{ fov: 55, near: 0.2, far: 1500, position: [0, GROESSE.kameraHoehe, GROESSE.kameraAbstand] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <Beleuchtung s={s} ziel={ref} />
      <Terrain welt={welt} terrain={terrain} feld={feld} kacheln={kacheln} ziel={ref}
               props={props} dichte={qualitaet.gras}
               rand={{ farbe: s.randFarbe, staerke: s.randStaerke }} />
      <object3D ref={ref} position={start}>
        <SpielerFigur gier={gier} schritt={schritt}
                      rand={{ farbe: s.randFarbe, staerke: s.randStaerke }} />
      </object3D>
      <Spieler feld={feld} ziel={ref} gier={gier} neigung={neigung}
               schritt={schritt} kollision={kollision} />
      {regent && regentOrt && (
        <Regentenort ort={regentOrt} gestalt={regent.gestalt} ziel={ref} onNah={onRegentNah} />
      )}
      {vorkommen.length > 0 && gestalt && (
        <Kreaturen vorkommen={vorkommen} gestalt={gestalt} ziel={ref} gier={gier}
                   naehe={naehe} onBegegnung={onBegegnung} verbraucht={verbraucht}
                   rand={{ farbe: s.randFarbe, staerke: s.randStaerke }} />
      )}
      <Kamera ziel={ref} gier={gier} neigung={neigung} />
      <Messung melde={onMessung} />
    </Canvas>
  );
}
