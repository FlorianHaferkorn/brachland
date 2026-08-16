/**
 * BRACHLAND — Kreaturen im Kampfbild
 *
 * Der Kampf war bis hierher eine Tabelle mit Knöpfen. Was fehlte, war das, wofür das
 * Spiel überhaupt 3D ist: dass man sieht, wogegen man kämpft.
 *
 * Bewusst **eine** kleine Leinwand für beide Seiten statt zwei: ein WebGL-Kontext
 * weniger, ein Renderdurchgang weniger. Sie zeichnet nur bei Bedarf
 * (`frameloop="demand"` wäre zu wenig — es gibt eine Leerlaufbewegung), bleibt aber
 * winzig: zwei Silhouetten unter 500 Dreiecken, kein Schatten, kein Nebel.
 *
 * Die Treffer-Rückmeldung ist der zweite Teil: Ohne sie ist ein Angriff eine Zahl im
 * Protokoll. Getroffene zucken zurück und blitzen kurz auf — 300 ms, mehr braucht es
 * nicht, damit ein Schlag sich wie ein Schlag anfühlt.
 */
import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { baueKreaturGeometrie } from '../world/kreaturgestalt.js';
import { RIG_HOEHE, type BasisRig } from '../world/kreaturgestalt.js';
import type { Element } from '../data/schema.js';

export interface KaempferBild {
  basisRig: string;
  elemente: Element[];
  /** Stufe 0-basiert — höhere Stufen sind sichtbar größer. */
  stufe: number;
}

/** Wie lange ein Treffer nachwirkt, in Sekunden. */
const TREFFER_DAUER = 0.32;

/** Höhe, auf die jede Kreatur fürs Porträt normiert wird. */
const BILDHOEHE = 0.95;

function Gestalt({ bild, seite, treffer }: {
  bild: KaempferBild;
  /** -1 links (Spieler), +1 rechts (Gegner). */
  seite: number;
  treffer: React.RefObject<number>;
}) {
  const geometrie = useMemo(
    () => baueKreaturGeometrie(bild.basisRig, bild.elemente),
    [bild.basisRig, bild.elemente],
  );
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0,
    // Der Treffer-Blitz läuft über die Emissionsstärke, nicht über die Farbe:
    // vertexColors bleibt so unangetastet und jede Art blitzt gleich.
    emissive: new THREE.Color('#c4553f'), emissiveIntensity: 0,
  }), []);
  const gruppe = useRef<THREE.Group>(null);
  const uhr = useRef(0);

  // Auf eine gemeinsame Bildhöhe normieren: Ein Molch von 0,4 m und ein Nadelbaum
  // hoher Keiler von 1,0 m sollen beide das Bild füllen. Das Größenverhältnis
  // gehört in die Welt, nicht in ein Porträt.
  const rig = (bild.basisRig in RIG_HOEHE ? bild.basisRig : 'quadruped') as BasisRig;
  const norm = BILDHOEHE / RIG_HOEHE[rig];

  useFrame((_, dt) => {
    const g = gruppe.current;
    if (!g) return;
    uhr.current += dt;
    // Leerlauf: langsames Atmen, gegenläufig je Seite, damit es nicht im Gleichtakt wirkt.
    const atem = Math.sin(uhr.current * 1.6 + (seite > 0 ? 1.7 : 0));
    const seitTreffer = performance.now() / 1000 - treffer.current;
    const zuck = treffer.current > 0
      ? Math.max(0, 1 - seitTreffer / TREFFER_DAUER)
      : 0;
    // Der Ruhewert muss hier stehen, nicht nur im JSX: Diese Zuweisung läuft jedes
    // Bild und würde einen dort gesetzten Versatz sonst überschreiben. Genau das ist
    // passiert — die Tiere standen einen halben Meter zu hoch und wurden oben
    // angeschnitten, obwohl das JSX sie mittig setzte.
    g.position.y = -BILDHOEHE / 2 + atem * 0.014;
    g.position.x = seite * (0.62 + zuck * 0.18);
    g.rotation.z = zuck * seite * 0.22;
    material.emissiveIntensity = zuck;
  });

  return (
    <group ref={gruppe} position={[seite * 0.62, -BILDHOEHE / 2, 0]}
           scale={norm * (1 + bild.stufe * 0.12)}>
      {/* Der Gegner schaut zum Spieler, der Spieler vom Betrachter weg — wie im
          klassischen Aufbau: eigene Kreatur von hinten, gegnerische von vorn. */}
      <group rotation={[0, seite > 0 ? Math.PI : 0, 0]}>
        <mesh geometry={geometrie} material={material} />
      </group>
    </group>
  );
}

export interface KampfbuehneProps {
  spieler: KaempferBild;
  gegner: KaempferBild;
  /** Zeitstempel des letzten Treffers je Seite, in Sekunden (performance.now()/1000). */
  trefferSpieler: React.RefObject<number>;
  trefferGegner: React.RefObject<number>;
  hintergrund: string;
}

export function Kampfbuehne({
  spieler, gegner, trefferSpieler, trefferGegner, hintergrund,
}: KampfbuehneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      /* Kamera auf y = 0 und die Tiere um ihre halbe Höhe nach unten versetzt.
         Der Grund ist eine Eigenheit von R3F: Die Standardkamera wird auf den
         Ursprung ausgerichtet. Eine Kamera auf Brusthöhe kippt dadurch nach unten,
         und die Tiere rutschen an den oberen Rand — genau das war zu sehen. Statt
         gegen die Ausrichtung zu arbeiten, liegt der Bildmittelpunkt jetzt dort,
         wohin die Kamera ohnehin schaut. */
      camera={{ fov: 34, position: [0, 0, 2.5], near: 0.1, far: 20 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: hintergrund, display: 'block', width: '100%', height: '100%' }}
      onCreated={({ scene }) => { scene.background = new THREE.Color(hintergrund); }}
    >
      {/* Drei Lichter, jedes mit einer Aufgabe: Grundhelligkeit, Form, Kontur.
          Die eigene Kreatur steht mit dem Rücken zum Betrachter — ohne das
          Gegenlicht von hinten bleibt sie eine schwarze Fläche. */}
      <hemisphereLight args={['#9db4bb', '#28323a', 1.6]} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.5} color="#d8d2c0" />
      <directionalLight position={[-2.5, 2.5, -3]} intensity={1.1} color="#6fa8b8" />
      <Gestalt bild={spieler} seite={-1} treffer={trefferSpieler} />
      <Gestalt bild={gegner} seite={1} treffer={trefferGegner} />
    </Canvas>
  );
}
