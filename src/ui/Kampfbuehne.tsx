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
import { RIG_HOEHE, ELEMENT_FARBE, type BasisRig } from '../world/kreaturgestalt.js';
import type { Element } from '../data/schema.js';

export interface KaempferBild {
  basisRig: string;
  elemente: Element[];
  /** Stufe 0-basiert — höhere Stufen sind sichtbar größer. */
  stufe: number;
}

/** Wie lange ein Treffer nachwirkt, in Sekunden. */
const TREFFER_DAUER = 0.32;
/** Wie lange die Kamera auf einen Zug hält, in Sekunden. */
const ZUG_DAUER = 0.85;
/** Dauer des Ausfallschritts beim Angriff. */
const AUSFALL_DAUER = 0.34;

/**
 * Was gerade passiert. Als Ref, weil die Bühne ihre eigene Bildschleife hat und ein
 * Re-Render je Zug nichts beiträgt.
 */
export interface Buehnenzug {
  /** Zeitstempel in Sekunden (`performance.now() / 1000`). 0 = nichts. */
  zeit: number;
  /** Wer angreift: -1 Spieler, +1 Gegner. */
  seite: number;
  /** Element des Moves — färbt den Einschlag. */
  element?: Element;
  /** Elementfaktor: über 1 sehr effektiv, unter 1 kaum wirksam. */
  faktor?: number;
}

/**
 * Einschlag als Partikel.
 *
 * Ein Treffer war bisher eine Zahl im Protokoll und ein Zucken. Was fehlt, ist der
 * Moment dazwischen — die halbe Sekunde, in der etwas passiert.
 *
 * Bewusst **ein** InstancedMesh mit fester Teilchenzahl, keine Partikel-Bibliothek:
 * Die Bühne ist eine 300-Pixel-Leinwand auf einem Handy, das gleichzeitig eine
 * 4-km-Landschaft im Speicher hält. Vierzig Splitter, die aus einem Punkt fliegen
 * und schrumpfen, sind alles, was hier gebraucht wird.
 *
 * Die Farbe kommt aus dem Element des Moves — damit sieht man, **womit** getroffen
 * wurde, nicht nur dass. Bei sehr effektiv fliegen sie weiter und heller.
 */
const SPLITTER = 40;
const EINSCHLAG_DAUER = 0.55;

function Einschlag({ zug }: { zug: React.RefObject<Buehnenzug> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.TetrahedronGeometry(0.045, 0), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);
  // Richtungen einmal würfeln und behalten: Ein Einschlag, der jedes Mal anders
  // aussieht, liest sich als Rauschen statt als Wirkung.
  const richtungen = useMemo(() => Array.from({ length: SPLITTER }, (_, i) => {
    const a = (i / SPLITTER) * Math.PI * 2 + (i % 3) * 0.7;
    const h = ((i * 37) % 100) / 100;
    return new THREE.Vector3(Math.cos(a) * (0.5 + h), h * 1.5 - 0.25, Math.sin(a) * (0.5 + h) * 0.4);
  }), []);
  const hilfe = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const m = ref.current;
    const z = zug.current;
    if (!m) return;
    const t = z ? klingt(z.zeit, EINSCHLAG_DAUER) : 0;
    m.visible = t > 0;
    if (t <= 0) return;

    const stark = z?.faktor && z.faktor > 1 ? 1.5 : z?.faktor && z.faktor < 1 ? 0.6 : 1;
    mat.color.set(ELEMENT_FARBE[z!.element ?? 'stein'] ?? '#c8b48a');
    mat.opacity = t * t;
    // Der Einschlag sitzt beim Getroffenen, also auf der Gegenseite des Angreifers.
    const ziel = -(z!.seite) * 0.62;
    const flug = (1 - t) * 0.9 * stark;

    for (let i = 0; i < SPLITTER; i++) {
      const r = richtungen[i];
      hilfe.position.set(ziel + r.x * flug, r.y * flug, r.z * flug);
      hilfe.scale.setScalar(t * stark);
      hilfe.rotation.set(r.x * 6 * (1 - t), r.y * 6 * (1 - t), 0);
      hilfe.updateMatrix();
      m.setMatrixAt(i, hilfe.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[geo, mat, SPLITTER]} frustumCulled={false} />;
}

/** Wie weit ein Wert nach `t` Sekunden abgeklungen ist, 1 → 0. */
function klingt(zeit: number, dauer: number): number {
  if (zeit <= 0) return 0;
  const t = (performance.now() / 1000 - zeit) / dauer;
  return t < 0 || t > 1 ? 0 : 1 - t;
}

/** Höhe, auf die jede Kreatur fürs Porträt normiert wird. */
const BILDHOEHE = 0.95;

function Gestalt({ bild, seite, treffer, zug }: {
  bild: KaempferBild;
  /** -1 links (Spieler), +1 rechts (Gegner). */
  seite: number;
  treffer: React.RefObject<number>;
  zug: React.RefObject<Buehnenzug>;
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
    // Ausfallschritt: Der Angreifer geht auf den Gegner zu und wieder zurück. Eine
    // halbe Sinuswelle — vorne am schnellsten, an den Enden ruhig.
    const meins = zug.current?.seite === seite ? klingt(zug.current.zeit, AUSFALL_DAUER) : 0;
    const ausfall = Math.sin((1 - meins) * Math.PI) * 0.34;

    g.position.y = -BILDHOEHE / 2 + atem * 0.014;
    g.position.x = seite * (0.62 + zuck * 0.18 - ausfall);
    g.rotation.z = zuck * seite * 0.22 - ausfall * seite * 0.12;
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

/**
 * Kameraführung.
 *
 * Der Kampf war eine Tabelle mit Knöpfen, dann zwei stehende Silhouetten. Was fehlt,
 * ist das, was jeder Kampf im Kino hat: dass die Kamera auf den Schlag geht.
 *
 * Drei Lagen, alle rein rechnerisch:
 * - **Ruhe:** eine sehr langsame Kreisbewegung. Ein völlig stehendes Bild wirkt wie
 *   ein Standbild, nicht wie eine Szene.
 * - **Zug:** Schub nach vorn und Schwenk auf den Getroffenen, dann zurück.
 * - **Aufschlag:** ein kurzes Rütteln in den ersten Zehntelsekunden.
 */
function Fuehrung({ zug }: { zug: React.RefObject<Buehnenzug> }) {
  const uhr = useRef(0);
  const ziel = useMemo(() => new THREE.Vector3(), []);
  const jetzt = useMemo(() => new THREE.Vector3(0, 0, 2.5), []);

  useFrame(({ camera }, dt) => {
    uhr.current += dt;
    const z = zug.current;
    const stark = z ? klingt(z.zeit, ZUG_DAUER) : 0;
    // Kurz und hart, nur am Anfang des Zugs.
    const schlag = z ? klingt(z.zeit, 0.16) : 0;
    const seite = z?.seite ?? 0;

    // Ruhe: langsames Kreisen, damit das Bild atmet.
    const rx = Math.sin(uhr.current * 0.21) * 0.10;
    const ry = Math.sin(uhr.current * 0.15 + 1.3) * 0.05;

    ziel.set(
      rx - seite * stark * 0.34 + (Math.random() - 0.5) * schlag * 0.035,
      ry + stark * 0.06 + (Math.random() - 0.5) * schlag * 0.035,
      2.5 - stark * 0.55,
    );
    // Nachziehen statt springen: Die Kamera folgt der Absicht, sie rastet nicht ein.
    jetzt.lerp(ziel, Math.min(1, dt * 7));
    camera.position.copy(jetzt);
    camera.lookAt(-seite * stark * 0.30, 0, 0);
  });

  return null;
}

export interface KampfbuehneProps {
  spieler: KaempferBild;
  gegner: KaempferBild;
  /** Zeitstempel des letzten Treffers je Seite, in Sekunden (performance.now()/1000). */
  trefferSpieler: React.RefObject<number>;
  trefferGegner: React.RefObject<number>;
  /** Der laufende Zug — steuert Ausfallschritt und Kamera. */
  zug: React.RefObject<Buehnenzug>;
  hintergrund: string;
}

export function Kampfbuehne({
  spieler, gegner, trefferSpieler, trefferGegner, zug, hintergrund,
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
      <Fuehrung zug={zug} />
      <Einschlag zug={zug} />
      <Gestalt bild={spieler} seite={-1} treffer={trefferSpieler} zug={zug} />
      <Gestalt bild={gegner} seite={1} treffer={trefferGegner} zug={zug} />
    </Canvas>
  );
}
