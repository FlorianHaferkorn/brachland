/**
 * BRACHLAND — der Raum hinter dem Ortsfenster (D242, G-36)
 *
 * Ein eigener kleiner Canvas wie Kampfbühne und Heldeneditor: Der Raum aus `world/stube.ts`, der
 * Bewohner in derselben Gestalt wie draussen (`bewohnerWahl`, gleiche Saat), Licht von zwei
 * Seiten — kalt oder golden durchs Fenster je nach Tageszeit, warm und flackernd von der Glut.
 * Dämmerung und eine Lichtquelle, die man sieht: dieselbe Regel wie draussen (ADR-0012).
 *
 * Die Welt steht still, solange der Raum offen ist (`angehalten`) — zwei Canvas gleichzeitig
 * wären auf dem Zielgerät ein halber Frame zu viel.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as klonSkelett } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Ort } from '../data/schema.js';
import { baueStube, type InnenArt } from '../world/stube.js';
import { PALETTE } from '../world/palette.js';
import { bewohnerWahl, HELD_CLIPS, legeWahlAn } from '../spieler/held.js';

const S = PALETTE.stube;

/** Fensterlicht über den Tag: Morgen und Abend golden, Mittag kühl, Nacht ein Rest Mond. */
function fensterLicht(tageszeit: number): { farbe: THREE.Color; staerke: number } {
  const nacht = tageszeit >= 0.86 || tageszeit < 0.2;
  if (nacht) return { farbe: new THREE.Color(S.fensterNacht), staerke: 0.35 };
  const rand = Math.min(Math.abs(tageszeit - 0.25), Math.abs(tageszeit - 0.8)) < 0.08;
  return rand ? { farbe: new THREE.Color(S.fensterAbend), staerke: 2.2 } : { farbe: new THREE.Color(S.fensterTag), staerke: 2.6 };
}

type Bewohnerbild = { figur: string; blick: number; farben?: Ort['farben'] };

function Raum({ art, id, tageszeit, bewohner }: {
  art: InnenArt; id: string; tageszeit: number;
  /** Wer hier wohnt; `null` bei einer Zuflucht — die ist leer. */
  bewohner: Bewohnerbild | null;
}) {
  const bau = useMemo(() => baueStube(art, id), [art, id]);
  useEffect(() => () => bau.geometrie.dispose(), [bau]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0,
  }), []);
  const licht = useMemo(() => fensterLicht(tageszeit), [tageszeit]);
  const glut = useRef<THREE.PointLight>(null);
  const uhr = useRef(0);
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(...bau.kamera.ort);
    camera.lookAt(...bau.kamera.ziel);
    // Die Karte des Ortsfensters steht rechts: Bild per Lens-Shift nach links schieben, statt die
    // Kamera zu drehen — so bleibt die Perspektive die aus der Tür.
    const cam = camera as THREE.PerspectiveCamera;
    cam.filmOffset = 9;
    cam.updateProjectionMatrix();
  }, [camera, bau]);

  useFrame((_, dt) => {
    uhr.current += dt;
    // Flackern aus zwei Sinus mit krummem Verhältnis — kein Takt, den man mitzählt.
    if (glut.current) glut.current.intensity = 2.4 + Math.sin(uhr.current * 7.3) * 0.25 + Math.sin(uhr.current * 2.9) * 0.4;
    // Die Kamera atmet: Man steht in der Tür, man ist kein Stativ.
    camera.position.x = bau.kamera.ort[0] + Math.sin(uhr.current * 0.3) * 0.05;
    camera.position.y = bau.kamera.ort[1] + Math.sin(uhr.current * 0.47) * 0.02;
    camera.lookAt(...bau.kamera.ziel);
  });

  const [fx, fy, fz] = bau.fenster.mitte;
  return (
    <>
      <mesh geometry={bau.geometrie} material={material} castShadow receiveShadow />
      {/* Die Scheibe: hell, nicht beleuchtet — das Draussen. */}
      <mesh position={[fx, fy, fz - 0.02]}>
        <planeGeometry args={[bau.fenster.breite, bau.fenster.hoehe]} />
        <meshBasicMaterial color={licht.farbe} toneMapped={false} />
      </mesh>
      <spotLight position={[fx, fy + 0.8, fz - 3]} target-position={[fx * 0.5, 0, 0]}
                 angle={0.55} penumbra={0.8} decay={1.2} distance={14}
                 color={licht.farbe} intensity={licht.staerke * 6} castShadow
                 shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight ref={glut} position={bau.glut} color={S.glut} intensity={2.4} distance={6} decay={1.8} castShadow />
      <hemisphereLight args={[S.fensterTag, S.erde, 0.45]} />
      {bewohner && (
        <Suspense fallback={null}>
          <Bewohner {...bewohner} ort={bau.figur.ort} drehung={bau.figur.drehung} />
        </Suspense>
      )}
    </>
  );
}

function Bewohner({ figur, blick, farben, ort, drehung }: {
  figur: string; blick: number; farben?: Ort['farben'];
  ort: [number, number, number]; drehung: number;
}) {
  const wahl = useMemo(() => bewohnerWahl(figur, blick, farben), [figur, blick, farben]);
  // Dieselbe leichte Gestalt wie draussen (D176) — wer drinnen steht, ist der von der Strasse.
  const g1 = useGLTF(wahl ? `/figuren/held/${wahl.koerper}-${wahl.kleid}-leicht.glb` : `/figuren/${figur}.glb`);
  const g2 = useGLTF(wahl ? HELD_CLIPS : `/figuren/${figur}.glb`);
  const scene = useMemo(() => klonSkelett(g1.scene), [g1.scene]);
  useEffect(() => {
    if (wahl) legeWahlAn(scene, wahl);
    scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
    });
  }, [scene, wahl]);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  useEffect(() => {
    const clips = wahl ? g2.animations : g1.animations;
    const c = clips.find(a => a.name === (wahl ? 'Idle_Ruhig' : 'Idle_Neutral')) ?? clips.find(a => a.name === 'Idle') ?? clips[0];
    if (c) mixer.clipAction(c).play();
    return () => { mixer.stopAllAction(); };
  }, [mixer, g1.animations, g2.animations, wahl]);
  useFrame((_, dt) => mixer.update(dt));
  // Die Gestalten schauen nach −z; `drehung` 0 heisst im Raum: zur Tür, also +π.
  return <primitive object={scene} position={ort} rotation={[0, drehung + Math.PI, 0]} />;
}

export function Stube({ ort, tageszeit }: { ort: Ort; tageszeit: number }) {
  const bewohner = useMemo<Bewohnerbild | null>(() => (ort.art === 'bewohner' && ort.figur
    ? { figur: ort.figur, blick: ort.blick ?? 0, farben: ort.farben } : null), [ort]);
  if (!ort.innen) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 29, background: '#0b0d0c' }}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 52, near: 0.05, far: 40 }}
              gl={{ antialias: true }}
              onCreated={({ scene }) => { scene.fog = new THREE.Fog(S.dunst, 4, 14); scene.background = new THREE.Color('#0b0d0c'); }}>
        <Raum art={ort.innen} id={ort.id} tageszeit={tageszeit} bewohner={bewohner} />
      </Canvas>
    </div>
  );
}
