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
import { baueTerrain, baueGewaesser, baueGebaeude, baueWege, GROESSE,
         type TerrainErgebnis } from '../world/terrain.js';
import { useGLTF } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { baueHoehenfeld, baueKachelraster, lodFuerAbstand, baueKachelGeometrie,
         hoeheAufFlaeche, type HoehenFeld, type Kachel } from '../world/lod.js';
import { benutzeSteuerung } from '../spieler/steuerung.js';
import { baueBueschelGeometrie, baueKleinzeugGeometrie, baueStreuMaterial,
         streueUmgebung, streueKleinzeug,
         STREU_MAX, KLEIN_MAX, STREU_NACHZIEHEN } from '../world/streuung.js';
import { baueBodenMaterial } from '../world/bodenmaterial.js';
import { baueWasserMaterial, baueWegMaterial } from '../world/bandmaterial.js';
import { baueSpielerTeile, HUEFTE, SCHULTER } from '../spieler/figur.js';
import { baueKollision, type Kollisionsfeld } from '../spieler/kollision.js';
import { verteileProps, chunkeProps, propGeometrie, attrappeGeometrie, propPfad, VARIANTEN, ZIELHOEHE,
         PROP_FARBE, type PropArt, type PropChunk, type PropInstanz } from '../world/props.js';
import { TERRAIN_SICHT, NEUAUFBAU_AB, ATTRAPPE_AB, PROP_NEUBEWERTUNG } from './sichtweiten.js';
import { verteileKreaturen, type Vorkommen, type KreaturSpawn } from '../world/vorkommen.js';

/** Tageszeiten. Der Look lebt von Dämmerung und Nebel — Mittagssonne verzeiht nichts. */
export const STIMMUNG = {
  daemmerung: {
    himmel: '#141d20', nebel: '#1b2a2b', nebelNah: 60, nebelFern: 420,
    sonne: '#c8b48a', sonneStaerke: 1.25, umgebung: '#38494c', umgebungStaerke: 0.85,
    sonnenstand: [-120, 55, -90] as const,
    belichtung: 2.15,
  },
  nebelmorgen: {
    himmel: '#20282a', nebel: '#2c3a39', nebelNah: 30, nebelFern: 240,
    sonne: '#d8d2c0', sonneStaerke: 0.9, umgebung: '#47585a', umgebungStaerke: 1.05,
    sonnenstand: [90, 40, -110] as const,
    belichtung: 1.45,
  },
  nacht: {
    himmel: '#0a0f12', nebel: '#101a1c', nebelNah: 25, nebelFern: 260,
    sonne: '#8fa9c4', sonneStaerke: 0.45, umgebung: '#162124', umgebungStaerke: 0.35,
    sonnenstand: [-80, 90, 60] as const,
    belichtung: 1.40,
  },
} as const;
export type StimmungsName = keyof typeof STIMMUNG;


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

function Terrain({ welt, terrain, feld, kacheln, ziel, props, dichte }: {
  welt: Weltdaten; terrain: TerrainErgebnis; feld: HoehenFeld;
  kacheln: Kachel[]; ziel: React.RefObject<THREE.Object3D | null>;
  props: PropInstanz[]; dichte: number;
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
  const wegMaterial = useMemo(() => baueWegMaterial(), []);

  // Die Strömung braucht eine Uhr. Ein Uniform je Bild ist der billigste Weg — die
  // Alternative wäre, die Geometrie zu bewegen, und das wären 200.000 Vertices.
  useFrame((_, dt) => {
    const z = wasserMaterial.userData.zeit as { value: number } | undefined;
    if (z) z.value += dt;
  });
  const { gewaesser, gebaeude, wege } = useMemo(() => ({
    gewaesser: baueGewaesser(welt, aufBoden),
    gebaeude: baueGebaeude(welt, aufBoden),
    wege: baueWege(welt, aufBoden),
  }), [welt, aufBoden]);

  return (
    <group>
      <LodTerrain feld={feld} kacheln={kacheln} ziel={ziel} />

      {wege && <mesh geometry={wege} material={wegMaterial} receiveShadow />}
      {gewaesser && <mesh geometry={gewaesser} material={wasserMaterial} />}

      {gebaeude && (
        <mesh geometry={gebaeude} castShadow receiveShadow>
          <meshStandardMaterial color="#565049" roughness={0.9} flatShading />
        </mesh>
      )}

      <Props props={props} />
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
function Props({ props }: { props: PropInstanz[] }) {
  const chunks = useMemo(() => chunkeProps(props), [props]);
  const [sichtbar, setSichtbar] = useState<{ c: PropChunk; fern: boolean; id: string }[]>([]);
  const letzte = useRef(new THREE.Vector3(NaN, NaN, NaN));

  useFrame(({ camera }) => {
    const p = camera.position;
    if (letzte.current.distanceTo(p) < PROP_NEUBEWERTUNG) return;
    letzte.current.copy(p);

    const liste: { c: PropChunk; fern: boolean; id: string }[] = [];
    for (const c of chunks) {
      const d = Math.hypot(p.x - c.mitte[0], p.z - c.mitte[1]) - c.radius;
      if (d > c.sichtweite) continue;
      liste.push({ c, fern: d > ATTRAPPE_AB, id: `${c.art}:${c.variante}:${c.mitte[0]}:${c.mitte[1]}` });
    }
    setSichtbar(liste);
  });

  return (
    <>
      {sichtbar.map(({ c, fern, id }) => <PropChunkMesh key={id} chunk={c} fern={fern} />)}
    </>
  );
}

/**
 * Lädt das Modell der Variante und normiert es auf die reale Zielhöhe.
 * useGLTF cached pro Pfad — 23 Dateien werden einmal geladen, egal wie viele Chunks.
 */
function useNormiertesPropMesh(art: PropArt, variante: number) {
  const pfad = propPfad(VARIANTEN[art][variante] ?? VARIANTEN[art][0]);
  const { scene } = useGLTF(pfad);
  return useMemo(() => {
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
  }, [scene, art]);
}

function PropChunkMesh({ chunk, fern }: { chunk: PropChunk; fern: boolean }) {
  const { geo, mat } = useNormiertesPropMesh(chunk.art, chunk.variante);
  const fernGeo = useMemo(() => attrappeGeometrie(chunk.art), [chunk.art]);
  const fernMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 1, metalness: 0,
  }), []);
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
      material={fern ? fernMaterial : (mat ?? rueckfall)}
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
/** So weit muss man sich nach einer Begegnung entfernen, bevor die nächste zählt. */
const SPERRE_BIS = 14;

function Kreaturen({ vorkommen, gestalt, ziel, onBegegnung, verbraucht }: {
  vorkommen: Vorkommen[];
  gestalt: (kreatur: string) => THREE.BufferGeometry;
  ziel: React.RefObject<THREE.Object3D | null>;
  onBegegnung?: (v: Vorkommen) => void;
  /** Bereits gefangen oder besiegt — steht nicht mehr in der Welt. */
  verbraucht?: ReadonlySet<string>;
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

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0,
  }), []);

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

function Beleuchtung({ stimmung, ziel }: {
  stimmung: StimmungsName; ziel: React.RefObject<THREE.Object3D | null>;
}) {
  const s = STIMMUNG[stimmung];
  const { scene, gl } = useThree();
  const sonne = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    scene.fog = new THREE.Fog(s.nebel, s.nebelNah, s.nebelFern);
    scene.background = new THREE.Color(s.himmel);
    return () => { scene.fog = null; };
  }, [scene, s]);

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
  useFrame(() => {
    const p = ziel.current?.position;
    const l = sonne.current;
    if (!p || !l) return;
    l.position.set(p.x + s.sonnenstand[0], p.y + s.sonnenstand[1], p.z + s.sonnenstand[2]);
    l.target.position.copy(p);
    l.target.updateMatrixWorld();
  });

  return (
    <>
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
function SpielerFigur({ gier, schritt }: {
  gier: React.RefObject<number>;
  schritt: React.RefObject<{ phase: number; tempo: number }>;
}) {
  const teile = useMemo(() => baueSpielerTeile(), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0,
  }), []);
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
  stimmung?: StimmungsName;
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
  welt, stimmung = 'daemmerung', spielerRef, onMessung,
  qualitaet = QUALITAET_STANDARD, kreaturen, gestalt, verbraucht, onBegegnung, startPosition,
  angehalten = false,
}: RegionsSzeneProps) {
  const eigenerRef = useRef<THREE.Object3D>(null);
  const ref = spielerRef ?? eigenerRef;
  const gier = useRef(0);
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
      <Beleuchtung stimmung={stimmung} ziel={ref} />
      <Terrain welt={welt} terrain={terrain} feld={feld} kacheln={kacheln} ziel={ref} props={props} dichte={qualitaet.gras} />
      <object3D ref={ref} position={start}>
        <SpielerFigur gier={gier} schritt={schritt} />
      </object3D>
      <Spieler feld={feld} ziel={ref} gier={gier} neigung={neigung}
               schritt={schritt} kollision={kollision} />
      {vorkommen.length > 0 && gestalt && (
        <Kreaturen vorkommen={vorkommen} gestalt={gestalt} ziel={ref}
                   onBegegnung={onBegegnung} verbraucht={verbraucht} />
      )}
      <Kamera ziel={ref} gier={gier} neigung={neigung} />
      <Messung melde={onMessung} />
    </Canvas>
  );
}
