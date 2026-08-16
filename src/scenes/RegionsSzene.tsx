/**
 * BRACHLAND — Regionsszene
 *
 * Setzt die Art Direction um: Dämmerung, Nebel als Werkzeug, Silhouetten,
 * eine Signalfarbe für Befall. Alles Geometrie aus src/world, keine Texturen.
 *
 * Props laufen als InstancedMesh — 40.000 Bäume als Einzelobjekte würden jedes
 * Handy erledigen, als Instanzen sind es eine Handvoll Draw Calls.
 */
import { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Weltdaten } from '../world/osm.js';
import { baueTerrain, baueGewaesser, baueGebaeude, baueWege, GROESSE } from '../world/terrain.js';
import { useGLTF } from '@react-three/drei';
import { verteileProps, chunkeProps, propGeometrie, propPfad, VARIANTEN, ZIELHOEHE,
         PROP_FARBE, type PropArt, type PropChunk } from '../world/props.js';

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

function Terrain({ welt }: { welt: Weltdaten }) {
  const { terrain, gewaesser, gebaeude, wege } = useMemo(() => {
    const t = baueTerrain(welt);
    return {
      terrain: t,
      gewaesser: baueGewaesser(welt, t),
      gebaeude: baueGebaeude(welt, t),
      wege: baueWege(welt, t),
    };
  }, [welt]);

  return (
    <group>
      <mesh geometry={terrain.geometrie} receiveShadow castShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
      </mesh>

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

      <Props welt={welt} terrain={terrain} />
    </group>
  );
}

function Props({ welt, terrain }: { welt: Weltdaten; terrain: ReturnType<typeof baueTerrain> }) {
  // Chunks statt einer Riesen-Instanz je Art: nur so lässt sich nach Entfernung ausblenden.
  // Ohne Culling wären es ~485.000 Dreiecke, mit ~115.000–265.000 je nach Standort.
  const chunks = useMemo(
    () => chunkeProps(verteileProps(welt, terrain, 1)),
    [welt, terrain],
  );
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

function Beleuchtung({ stimmung }: { stimmung: StimmungsName }) {
  const s = STIMMUNG[stimmung];
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.Fog(s.nebel, s.nebelNah, s.nebelFern);
    scene.background = new THREE.Color(s.himmel);
    return () => { scene.fog = null; };
  }, [scene, s]);

  return (
    <>
      <hemisphereLight args={[s.umgebung, '#121a16', s.umgebungStaerke]} />
      <directionalLight
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
  useFrame((_, dt) => {
    const p = ziel.current?.position ?? new THREE.Vector3();
    const wunsch = new THREE.Vector3(p.x, p.y + GROESSE.kameraHoehe, p.z + GROESSE.kameraAbstand);
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
  return (
    <Canvas
      shadows
      dpr={[1, 2]}                       // auf dem Handy nicht über 2 — kostet nur Bildrate
      camera={{ fov: 55, near: 0.2, far: 1500, position: [0, GROESSE.kameraHoehe, GROESSE.kameraAbstand] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <Beleuchtung stimmung={stimmung} />
      <Terrain welt={welt} />
      <object3D ref={ref} />
      <Kamera ziel={ref} />
    </Canvas>
  );
}
