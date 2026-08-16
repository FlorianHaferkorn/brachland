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
         type HoehenFeld, type Kachel } from '../world/lod.js';
import { verteileProps, chunkeProps, propGeometrie, propPfad, VARIANTEN, ZIELHOEHE,
         PROP_FARBE, type PropArt, type PropChunk, type PropInstanz } from '../world/props.js';

/** Tageszeiten. Der Look lebt von Dämmerung und Nebel — Mittagssonne verzeiht nichts. */
export const STIMMUNG = {
  daemmerung: {
    himmel: '#141d20', nebel: '#1b2a2b', nebelNah: 60, nebelFern: 420,
    sonne: '#c8b48a', sonneStaerke: 1.1, umgebung: '#2b3a3d', umgebungStaerke: 0.55,
    sonnenstand: [-120, 55, -90] as const,
  },
  nebelmorgen: {
    himmel: '#20282a', nebel: '#2c3a39', nebelNah: 30, nebelFern: 240,
    sonne: '#d8d2c0', sonneStaerke: 0.75, umgebung: '#39484a', umgebungStaerke: 0.8,
    sonnenstand: [90, 40, -110] as const,
  },
  nacht: {
    himmel: '#0a0f12', nebel: '#101a1c', nebelNah: 25, nebelFern: 260,
    sonne: '#8fa9c4', sonneStaerke: 0.45, umgebung: '#162124', umgebungStaerke: 0.35,
    sonnenstand: [-80, 90, 60] as const,
  },
} as const;
export type StimmungsName = keyof typeof STIMMUNG;

/**
 * Sichtweite des Terrains. Der Nebel endet je nach Stimmung bei 240–420 m;
 * 500 m deckt alle drei ab, alles dahinter wäre gezeichnete Nebelfarbe.
 */
const TERRAIN_SICHT = 500;

/** Erst ab dieser Bewegung wird die LOD-Zuordnung neu bestimmt. */
const NEUAUFBAU_AB = 32;

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

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0,
  }), []);

  useFrame(() => {
    const p = ziel.current?.position;
    if (!p) return;
    // Beim ersten Bild ist der Abstand NaN — der Vergleich schlägt fehl, also wird gebaut.
    if (letzte.current.distanceTo(p) < NEUAUFBAU_AB) return;
    letzte.current.copy(p);

    const jeStufe = new Map<number, THREE.BufferGeometry[]>();
    for (const k of kacheln) {
      const d = Math.max(0, Math.hypot(k.mitte[0] - p.x, k.mitte[1] - p.z) - k.radius);
      if (d > TERRAIN_SICHT) continue;
      const lod = lodFuerAbstand(d);
      const schluessel = `${k.ix}:${k.iz}:${lod}`;
      let g = cache.current.get(schluessel);
      if (!g) { g = baueKachelGeometrie(feld, k, lod); cache.current.set(schluessel, g); }
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

function Terrain({ welt, terrain, feld, kacheln, ziel }: {
  welt: Weltdaten; terrain: TerrainErgebnis; feld: HoehenFeld;
  kacheln: Kachel[]; ziel: React.RefObject<THREE.Object3D | null>;
}) {
  const { gewaesser, gebaeude, wege } = useMemo(() => ({
    gewaesser: baueGewaesser(welt, terrain),
    gebaeude: baueGebaeude(welt, terrain),
    wege: baueWege(welt, terrain),
  }), [welt, terrain]);

  return (
    <group>
      <LodTerrain feld={feld} kacheln={kacheln} ziel={ziel} />

      {wege && (
        <mesh geometry={wege} receiveShadow>
          <meshStandardMaterial color="#4a4740" roughness={1} flatShading />
        </mesh>
      )}

      {gewaesser && (
        <mesh geometry={gewaesser}>
          {/* leicht durchscheinend und schwach leuchtend — Wasser soll das Auge führen */}
          <meshStandardMaterial
            color="#2e5560" roughness={0.15} metalness={0.35}
            transparent opacity={0.88} emissive="#12303a" emissiveIntensity={0.35}
          />
        </mesh>
      )}

      {gebaeude && (
        <mesh geometry={gebaeude} castShadow receiveShadow>
          <meshStandardMaterial color="#565049" roughness={0.9} flatShading />
        </mesh>
      )}

      <Props welt={welt} terrain={terrain} feld={feld} />
    </group>
  );
}

function Props({ welt, terrain, feld }: {
  welt: Weltdaten; terrain: ReturnType<typeof baueTerrain>; feld: HoehenFeld;
}) {
  // Chunks statt einer Riesen-Instanz je Art: nur so lässt sich nach Entfernung ausblenden.
  // Ohne Culling wären es ~485.000 Dreiecke, mit ~115.000–265.000 je nach Standort.
  //
  // Die Y-Koordinate kommt aus dem Höhenfeld, nicht aus dem groben Raster: Der Boden
  // wird als LOD-Kachel mit Mikrorelief gezeichnet, und wer auf dem Raster platziert,
  // lässt seine Bäume um bis zu ~1,2 m schweben oder versinken.
  const chunks = useMemo(() => {
    const roh = verteileProps(welt, terrain, 1);
    const aufBoden: PropInstanz[] = roh.map(p => ({
      ...p,
      position: [p.position[0], feld.hoehe(p.position[0], p.position[2]), p.position[2]],
    }));
    return chunkeProps(aufBoden);
  }, [welt, terrain, feld]);
  return (
    <>
      {chunks.map((c, i) => <PropChunkMesh key={i} chunk={c} />)}
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

function PropChunkMesh({ chunk }: { chunk: PropChunk }) {
  const { geo, mat } = useNormiertesPropMesh(chunk.art, chunk.variante);
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

  // Entfernungs-Culling je Bild. Billiger als jede Alternative: eine Distanz pro Chunk.
  useFrame(({ camera }) => {
    if (!ref.current) return;
    const dx = camera.position.x - chunk.mitte[0];
    const dz = camera.position.z - chunk.mitte[1];
    ref.current.visible = Math.hypot(dx, dz) - chunk.radius <= chunk.sichtweite;
  });

  // Kleinzeug wirft keine Schatten — der Unterschied ist unsichtbar, die Kosten nicht.
  const grossesTeil = chunk.art === 'nadelbaum' || chunk.art === 'laubbaum' || chunk.art === 'findling';

  return (
    <instancedMesh
      ref={ref} args={[geo, mat ?? undefined, chunk.instanzen.length]}
      castShadow={grossesTeil} receiveShadow={grossesTeil}
    >
      {/* Kenney-Modelle bringen eigene Materialien mit; nur ohne greift der Rückfall. */}
      {!mat && <meshStandardMaterial color={PROP_FARBE[chunk.art]} flatShading roughness={0.95} />}
    </instancedMesh>
  );
}

function Beleuchtung({ stimmung, ziel }: {
  stimmung: StimmungsName; ziel: React.RefObject<THREE.Object3D | null>;
}) {
  const s = STIMMUNG[stimmung];
  const { scene } = useThree();
  const sonne = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    scene.fog = new THREE.Fog(s.nebel, s.nebelNah, s.nebelFern);
    scene.background = new THREE.Color(s.himmel);
    return () => { scene.fog = null; };
  }, [scene, s]);

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

/** Third-Person-Kamera, die dem Spieler folgt. */
function Kamera({ ziel }: { ziel: React.RefObject<THREE.Object3D | null> }) {
  const { camera } = useThree();
  // Abstände in echten Metern — der Spieler ist 1,8 m hoch und soll auch so wirken.
  const geglaettet = useRef(new THREE.Vector3(0, GROESSE.kameraHoehe, GROESSE.kameraAbstand));
  const gesetzt = useRef(false);
  useFrame((_, dt) => {
    const p = ziel.current?.position ?? new THREE.Vector3();
    const wunsch = new THREE.Vector3(p.x, p.y + GROESSE.kameraHoehe, p.z + GROESSE.kameraAbstand);
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

export interface RegionsSzeneProps {
  welt: Weltdaten;
  stimmung?: StimmungsName;
  spielerRef?: React.RefObject<THREE.Object3D | null>;
}

export function RegionsSzene({ welt, stimmung = 'daemmerung', spielerRef }: RegionsSzeneProps) {
  const eigenerRef = useRef<THREE.Object3D>(null);
  const ref = spielerRef ?? eigenerRef;

  // Grobes Terrain: liefert weiterhin Wege, Gewässer, Gebäude und die XZ-Verteilung
  // der Props. Der sichtbare Boden kommt aus den LOD-Kacheln.
  const terrain = useMemo(() => baueTerrain(welt), [welt]);

  // Höhenfeld mit Mikrorelief — die gemeinsame Wahrheit für Boden, Props und Spawn.
  const feld = useMemo(() => baueHoehenfeld(welt), [welt]);
  const kacheln = useMemo(() => baueKachelraster(feld), [feld]);

  // Ohne Startposition steht der Spieler im Ursprung (y = 0) — im Œntal sind das
  // ~170 m unter der Geländeoberfläche, die Kamera schaut dann von innen durch den
  // Berg. Bis es echte Bewegung gibt, ist die Regionsmitte der Startpunkt.
  const start = useMemo<[number, number, number]>(
    () => [0, feld.hoehe(0, 0), 0],
    [feld],
  );

  return (
    <Canvas
      shadows
      dpr={[1, 2]}                       // auf dem Handy nicht über 2 — kostet nur Bildrate
      camera={{ fov: 55, near: 0.2, far: 1500, position: [0, GROESSE.kameraHoehe, GROESSE.kameraAbstand] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <Beleuchtung stimmung={stimmung} ziel={ref} />
      <Terrain welt={welt} terrain={terrain} feld={feld} kacheln={kacheln} ziel={ref} />
      <object3D ref={ref} position={start} />
      <Kamera ziel={ref} />
    </Canvas>
  );
}
