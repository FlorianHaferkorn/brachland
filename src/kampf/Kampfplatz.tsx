/**
 * BRACHLAND — Übungsplatz: der Echtzeitkampf in der Welt (ADR-0007, Stufe 1 und 2)
 *
 * `?kampf=1` stellt zwei Wurzelkeiler vor die Spielerin (Stufe 2, D169), `?kampf=kapsel` die
 * Kapseln aus Stufe 1. Sonst ändert sich nichts: Das Rundensystem
 * läuft daneben weiter, die Kreaturen lösen weiter ihre Begegnungen aus (ADR-0007 §4 — Fassade
 * zuerst, Schnitt zuletzt).
 *
 * Die Regeln stehen in `kampf/echtzeit.ts` und sind dort getestet. Diese Datei tut drei Dinge:
 * Tasten in Absichten übersetzen, die Kampfwelt mit der Figur abgleichen, und zeichnen, was die
 * Regeln entschieden haben — **ohne ein einziges neues Asset**. Der Gegner ist eine Kapsel mit
 * Nase, sein Telegraf ein Bogen am Boden, der Schlag der Spielerin ein Fächer vor ihr. Das ist
 * Platzhalter mit Absicht: Stufe 1 soll zeigen, ob sich der Kampf richtig anfühlt, bevor ein Rig
 * gebaut wird, an dem sich das nicht mehr ändern lässt.
 *
 * ## Tasten
 *
 * U oder rechte Maustaste halten: Block/Parade (D173/D174) · J leicht (Kette je Waffe; im Lauf mit Shift der Laufangriff) · I schwer · K Rolle (Richtung aus
 * WASD, ohne Taste rückwärts) · L Ziel auf/ab. Alle drei werden **gepuffert** (D171): Wer im
 * Schwung schon den nächsten drückt, wird bedient, sobald es geht. Die Maus bleibt
 * beim Blick: Ziehen dreht die Kamera, und ein Klick, der vielleicht ein Ziehen werden sollte, darf
 * keinen Schlag auslösen. Touch folgt mit Stufe 2 (ADR-0006: das Handy ist nachrangig).
 *
 * ## Ausdauer
 *
 * Eine Kasse für Klettern, Springen und Kampf — der Ref aus `main.tsx`. Der Kampf **verbraucht**
 * daraus, erholen lässt ihn nur `Spieler` (`ausdauerFremd`). Würde die Kampfsimulation ihre Erholung
 * zurückschreiben, erholte sich die Ausdauer doppelt so schnell, sobald ein Gegner in der Nähe steht.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  SPIELERIN, UEBUNGSGEGNER, KEILER, GRATHORN, WOLF, FUCHS, GAMS, WEGELAGERER, SPEERMANN, AXTMANN, PARADE, naechtlich, ZIELEN, vorwaerts, type Linie, type KampfWerte, type Schlag,
  neuerKaempfer, puffere, setzeBlockAn, loeseBlock, naechsterSchlag, simuliere, waehleZiel, drehe, blickAuf, frei,
  WAFFEN, ruesteAus, wechsleZiel, type WaffenArt,
  type Kampfwelt, type Kaempfer, type Treffer,
} from './echtzeit.js';
import { reicht, type Ausdauer } from '../spieler/ausdauer.js';
import type { Kollisionsfeld } from '../spieler/kollision.js';
import { hoeheAufFlaeche, type HoehenFeld } from '../world/lod.js';
import type { KampfStand } from '../ui/Kampfanzeige.js';
import { kreaturGeometrie, baueAnbau, saatAusId } from '../world/kreaturgestalt.js';
import { clone as klonSkelett } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { baueWindMaterial } from '../world/windmaterial.js';
import { haengeAnHand, baueSpeer } from './waffenhand.js';
import { schadenFaktor } from '../spiel/schmiede.js';
import { gestaltPfad, HELD_CLIPS, legeWahlAn, type HeldWahl } from '../spieler/held.js';
/** Aussehen des Wegelagerers (D175). */
const WEGELAGERER_WAHL: HeldWahl = {
  name: 'Wegelagerer', geschlecht: 'm', koerper: 'm', kleid: 'bauer', haar: 'Buzzed', bart: true,
  haut: 0.55, haarfarbe: '#2a1d15',
  // D187: Bauernkleidung, rostrot getönt — als Waldläufer trug er dasselbe wie die Spielerin und war im
  // Getümmel nicht von ihr zu unterscheiden (im Bild gefunden, D186; die Tönung allein reichte nicht).
  kleidfarbe: '#a8452a',
};
/** D184: Speerfrau und Axtmann — andere Gestalt, damit die Waffe schon von Weitem zu lesen ist. */
const SPEERMANN_WAHL: HeldWahl = {
  name: 'Speerfrau', geschlecht: 'w', koerper: 'w', kleid: 'bauer', haar: 'Buns', bart: false,
  haut: 0.3, haarfarbe: '#6b4a2a', kleidfarbe: '#4a6a8f',
};
const AXTMANN_WAHL: HeldWahl = {
  name: 'Axtmann', geschlecht: 'm', koerper: 'm', kleid: 'bauer', haar: 'Kahl', bart: true,
  haut: 0.7, haarfarbe: '#1a1410',
};

/**
 * Wer auf dem Platz steht (D169). `keiler` ist Stufe 2: der Wurzelkeiler aus der Welt, mit
 * seinem Modell und dem Gang aus dem Shader (D138); `kapsel` der Platzhalter aus Stufe 1,
 * bleibt als Vergleich (`?kampf=kapsel`).
 */
export type GegnerArt = 'keiler' | 'grathorn' | 'wolf' | 'fuchs' | 'gams' | 'wegelagerer' | 'speermann' | 'axtmann' | 'kapsel';
export const GEGNER_ARTEN: readonly GegnerArt[] = ['keiler', 'grathorn', 'wolf', 'fuchs', 'gams', 'wegelagerer', 'speermann', 'axtmann', 'kapsel'];
const WERTE: Record<GegnerArt, KampfWerte> = { keiler: KEILER, grathorn: GRATHORN, wolf: WOLF, fuchs: FUCHS, gams: GAMS, wegelagerer: WEGELAGERER, speermann: SPEERMANN, axtmann: AXTMANN, kapsel: UEBUNGSGEGNER };
/** Modell je Art (D170). Die Kapsel hat keins. */
const MODELL: Partial<Record<GegnerArt, string>> = { keiler: 'wurzelkeiler', grathorn: 'grathorn', wolf: 'k7-wolf', fuchs: 'spuerfuchs', gams: 'nebelgams' };

/**
 * Tiere mit Rig (D172, `tools/kampftierbau.py`): dasselbe Modell wie in der Welt, an das Skelett
 * seiner Quelle gebunden, mit deren Clips. Scheitel und Durchzug des Angriffs in Clipsekunden —
 * gemessen am Weg des Kopfknochens (`.cache/tierclip.py`): Der Wolf holt bis Bild 6 aus und ist bei
 * Bild 10 vorn, der Hirsch senkt den Kopf ab Bild 2 und stösst bis Bild 6.
 */
interface RigCfg {
  datei: string; angriff: string; scheitel: number; durchzug: number;
  /** Haltung im Stand (D184); ohne Angabe die der Klinge. */
  stand?: string;
  /** Mensch (D174): Clip je Linie, Scheitel/Durchzug in Clipsekunden, wie bei der Spielerin. */
  linien?: Record<Linie, { clip: string; scheitel: number; durchzug: number }>;
}
const RIG: Partial<Record<GegnerArt, RigCfg>> = {
  // D174: der Wegelagerer — Figur `wanderer`, die Klingenclips der Wanderin (gleiches Rig).
  wegelagerer: { datei: 'wanderer', angriff: 'Klinge_U_A', scheitel: 6 / 24, durchzug: 9 / 24, linien: {
    rechts: { clip: 'Klinge_U_A', scheitel: 6 / 24, durchzug: 9 / 24 },
    links: { clip: 'Klinge_U_B', scheitel: 6 / 24, durchzug: 9 / 24 },
    oben: { clip: 'Klinge_U_C', scheitel: 14 / 24, durchzug: 18 / 24 },
    unten: { clip: 'Klinge_Stich', scheitel: 9 / 24, durchzug: 13 / 24 },
  } },
  // D184: Speerfrau und Axtmann mit den Clips ihrer Waffe (gleiches Skelett wie die Hauptfigur).
  speermann: { datei: 'wanderer', angriff: 'Speer_Stoss', scheitel: 9 / 24, durchzug: 13 / 24, stand: 'Speer_Stand', linien: {
    rechts: { clip: 'Speer_Stoss', scheitel: 9 / 24, durchzug: 13 / 24 },
    links: { clip: 'Speer_Stoss', scheitel: 9 / 24, durchzug: 13 / 24 },
    oben: { clip: 'Speer_Weit', scheitel: 14 / 24, durchzug: 18 / 24 },
    unten: { clip: 'Speer_Stoss', scheitel: 9 / 24, durchzug: 13 / 24 },
  } },
  axtmann: { datei: 'wanderer', angriff: 'Axt_Schwer', scheitel: 20 / 24, durchzug: 25 / 24, stand: 'Axt_Stand', linien: {
    rechts: { clip: 'Axt_Quer', scheitel: 10 / 24, durchzug: 15 / 24 },
    links: { clip: 'Axt_Quer', scheitel: 10 / 24, durchzug: 15 / 24 },
    oben: { clip: 'Axt_Schwer', scheitel: 20 / 24, durchzug: 25 / 24 },
    unten: { clip: 'Axt_Lauf', scheitel: 7 / 24, durchzug: 11 / 24 },
  } },
  wolf: { datei: 'k7-wolf', angriff: 'Attack', scheitel: 6 / 24, durchzug: 10 / 24 },
  grathorn: { datei: 'grathorn', angriff: 'Attack_Headbutt', scheitel: 2 / 24, durchzug: 6 / 24 },
  // D173: Fuchs zieht den Kopf bis Bild 4 zurück und ist bei 8 vorn; das Reh stösst von 1 bis 4.
  fuchs: { datei: 'spuerfuchs', angriff: 'Attack', scheitel: 4 / 24, durchzug: 8 / 24 },
  gams: { datei: 'nebelgams', angriff: 'Attack_Headbutt', scheitel: 1 / 24, durchzug: 4 / 24 },
};
interface RigVorlage {
  scene: THREE.Object3D; clips: THREE.AnimationClip[];
  /** Mensch (D174): eigenes Material behalten, diese Waffe an die Hand. */
  waffe?: THREE.Object3D;
  /** Aussehen der Gestalt (D175). */
  wahl?: HeldWahl;
}
interface Rig {
  mixer: THREE.AnimationMixer;
  aktion(name: string): THREE.AnimationAction | null;
  aktiv: THREE.AnimationAction | null;
  /** Zuletzt gesehener Schwung — ein neuer startet den Angriff von vorn. */
  schwung: number;
  treffer: number;
}

/** Ein Körper aus der Welt: Geometrie plus ein Material je Tier (der Gang ist ein Uniform). */
interface Leib {
  geometrie: THREE.BufferGeometry;
  baue(): { material: THREE.MeshStandardMaterial; setzeZeit(t: number): void; setzeGang(g: number): void };
}

/**
 * Was Figur und Kamera vom Kampf wissen müssen (D167). `Kampfplatz` schreibt es je Bild, die
 * Spielerfigur wählt daraus den Clip, die Kamera den Blick. Als Ref, wie `ausdauer`.
 */
export interface KampfFigur {
  phase: Kaempfer['phase'];
  /** D188: Kernfunke und Ladung 0…1 (Anzeige, Leuchten der Waffe). */
  element?: 'wasser';
  ladung?: number;
  /** Zählt Schläge und Rollen — ein neuer Wert heisst: Clip von vorn, auch mitten im alten. */
  schwung: number;
  rollen: number;
  /** Zählt erlittene Treffer (nicht ausgewichene). */
  getroffen: number;
  /** Gesamtdauer von Schlag und Rolle in Sekunden — daran wird der Clip gestreckt. */
  schlagDauer: number;
  rolleDauer: number;
  /** Blickrichtung der laufenden Rolle, oder null für eine Rolle auf der Stelle. */
  rolleBlick: number | null;
  /** Das aufgeschaltete Ziel (Brusthöhe), oder null. Die Kamera rahmt danach. */
  fokus: { x: number; y: number; z: number } | null;
  /** Sekunden in der aktuellen Phase und die Phasen des laufenden Schlags — die Figur legt den Clip darauf (D168). */
  zeit: number;
  vorlauf: number; aktiv: number; erholung: number;
  waffe: WaffenArt;
  /** Clip des laufenden Schlags und wo darin Scheitel und Durchzug liegen, Clipsekunden (D171). */
  clip: string;
  hieb: { scheitel: number; durchzug: number } | null;
  /** Kampfhaltung im Stand (Clip der Waffe). */
  haltung: string;
  /** Zählt Treffer, die die Spielerin gesetzt hat — die Kamera ruckt mit (D171). */
  gesetzt: number;
}

/** Nach so vielen Sekunden steht der Übungsplatz wieder — nach einem Sieg wie nach einer Niederlage. */
const NEUSTART = 3.5;

const FARBE = {
  koerper: new THREE.Color('#5d5145'),
  telegraf: new THREE.Color('#e0762c'),
  /** Undurchdringlich (ADR-0009 Stufe 3, D175): Blocken hilft nicht — tiefrot statt orange. */
  durch: new THREE.Color('#c01818'),
  taumeln: new THREE.Color('#6d8fb0'),
  treffer: new THREE.Color('#f2ece0'),
  faecher: new THREE.Color('#d9d2c2'),
};

/** Ein Kreisausschnitt flach am Boden, Spitze im Ursprung, Mitte in Blickrichtung (−Z). */
function faecher(radius: number, halbwinkel: number): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(radius, 28, Math.PI / 2 - halbwinkel, 2 * halbwinkel);
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * Der Fächer eines bestimmten Schlags (D171): Stich schmal und lang, Querhieb breit. Je Schlag
 * einmal gebaut; bis zum Kapselrand eines Menschen gezeichnet, wie das Tor misst.
 */
const FAECHER = new WeakMap<Schlag, THREE.BufferGeometry>();
function faecherFuer(s: Schlag): THREE.BufferGeometry {
  let g = FAECHER.get(s);
  if (!g) { g = faecher(s.reichweite + SPIELERIN.radius, s.halbwinkel); FAECHER.set(s, g); }
  return g;
}

/** Was je Gegner gezeichnet wird. */
interface Puppe {
  gruppe: THREE.Group;
  /** Der Körper unter `gruppe`: Ausfall, Neigen und Taumeln bewegen nur ihn, Bogen und Kranz bleiben stehen. */
  leib: THREE.Group;
  koerper: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  bogen: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  /** Drei Rauten über dem Kopf, solange er taumelt — lesbar auch bei Tag, wo Blau untergeht (D169). */
  kranz: THREE.Group;
  /** Wann zuletzt getroffen — für das Aufblitzen. */
  blitz: number;
  /** Von welcher Seite der letzte Treffer kam (D173) — wählt `Idle_HitReact_Left`/`_Right`. */
  seite: 'Left' | 'Right';
  art: GegnerArt;
  rig?: Rig;
  gang?: (g: number) => void;
  zeit?: (t: number) => void;
  vorher: { x: number; z: number };
}

function baueWelt(x: number, z: number, blick: number, aufstellung: readonly GegnerArt[], nacht = false): Kampfwelt {
  const spielerin = neuerKaempfer('spielerin', SPIELERIN, x, z, blick);
  // Zwei Gegner vor der Spielerin, versetzt — der zweite kommt etwas später an, damit man den
  // ersten Telegraf allein lesen kann, bevor es eng wird.
  const vor = (weite: number, seite: number): [number, number] => [
    x - Math.sin(blick) * weite + Math.cos(blick) * seite,
    z - Math.cos(blick) * weite - Math.sin(blick) * seite,
  ];
  // Bis zu drei Plätze (D172: das Rudel). Alle unter 11 m — weiter weg wacht keiner auf.
  const plaetze: [number, number][] = [[9, -2.5], [10.5, 3], [10, 0.5]];
  return {
    spielerin,
    gegner: aufstellung.slice(0, 3).map((art, i) => {
      const [gx, gz] = vor(...plaetze[i]);
      return neuerKaempfer(`${art}-${i + 1}`, nacht ? naechtlich(WERTE[art]) : WERTE[art], gx, gz, blickAuf(gx, gz, x, z));
    }),
    ziel: null,
  };
}

type PlatzProps = {
  ziel: React.RefObject<THREE.Object3D | null>;
  gier: React.RefObject<number>;
  feld: HoehenFeld;
  kollision: Kollisionsfeld;
  ausdauer: React.RefObject<Ausdauer>;
  /** `Spieler` liest ihn: Solange die Spielerin schlägt, rollt oder taumelt, gehen die Tasten ins Leere. */
  gesperrt: React.RefObject<boolean>;
  /** Für die Anzeige im DOM. */
  stand?: React.RefObject<KampfStand | null>;
  /** Für Spielerfigur und Kamera. */
  figur?: React.RefObject<KampfFigur | null>;
  /** Ist ein Ziel aufgeschaltet? Dann dreht `Spieler` nicht selbst — Q/E wechseln das Ziel (D168). */
  zielt?: React.RefObject<boolean>;
  /** Wer auf dem Platz steht, zwei oder drei Plätze (D169–D172). Vorgabe: ein Keiler, ein Grathorn. */
  aufstellung?: readonly GegnerArt[];
  /**
   * Begegnung in der Welt (D175): kein Übungsplatz — es beginnt sofort (ohne erste Taste) und endet
   * einmal. Statt neu aufzustellen, meldet der Platz den Ausgang.
   */
  onEnde?: (sieg: boolean) => void;
  /** Stufen aus der Schmiede (D177). */
  waffenStufen?: { klinge: number; axt: number; speer?: number; funke?: 'wasser' };
  /** Nachts stärker (D179, `naechtlich`). */
  nacht?: boolean;
};

const VORGABE: readonly GegnerArt[] = ['keiler', 'grathorn'];

/** Der Platz. Mit Tieren lädt er die Modelle — deshalb unter `Suspense` einhängen. */
export function Kampfplatz(props: PlatzProps) {
  const auf = props.aufstellung ?? VORGABE;
  return auf.some(a => MODELL[a] || RIG[a]) ? <KampfplatzMitModellen {...props} aufstellung={auf} />
    : <KampfplatzKern {...props} aufstellung={auf} leiber={{}} rigs={{}} />;
}

function leibAus(scene: THREE.Object3D, kreatur: string): Leib | null {
  const geometrie = kreaturGeometrie(scene, kreatur, 1);
  if (!geometrie) return null;
  return {
    geometrie,
    baue: () => {
      const w = baueWindMaterial({
        amplitude: 0, randFarbe: new THREE.Color('#8a9a9c'), randStaerke: 0.2, randSchaerfe: 1.6, atmen: true,
      });
      return { material: w.material as THREE.MeshStandardMaterial, setzeZeit: w.setzeZeit, setzeGang: w.setzeGang };
    },
  };
}

/** Alle Modelle werden immer geladen — Hooks dürfen nicht von der Aufstellung abhängen. */
function KampfplatzMitModellen(props: PlatzProps) {
  const keiler = useGLTF('/creatures/wurzelkeiler.glb').scene;
  const grathorn = useGLTF('/creatures/grathorn.glb').scene;
  const wolf = useGLTF('/creatures/k7-wolf.glb').scene;
  // Die Kampfvarianten mit Rig (D172). Die statischen bleiben geladen: Sie tragen den Anbau.
  const wolfRig = useGLTF('/creatures/kampf/k7-wolf.glb');
  const grathornRig = useGLTF('/creatures/kampf/grathorn.glb');
  const fuchs = useGLTF('/creatures/spuerfuchs.glb').scene, gams = useGLTF('/creatures/nebelgams.glb').scene;
  const fuchsRig = useGLTF('/creatures/kampf/spuerfuchs.glb'), gamsRig = useGLTF('/creatures/kampf/nebelgams.glb');
  // D174: der Wegelagerer; seit D175 eine Gestalt aus `heldbau.py` (Waldläufer, Bart) mit den
  // Clips der Hauptfigur — gleiches Skelett, keine Übertragung zur Laufzeit.
  const wanderer = useGLTF(gestaltPfad(WEGELAGERER_WAHL));
  const bauerW = useGLTF(gestaltPfad(SPEERMANN_WAHL)), bauerM = useGLTF(gestaltPfad(AXTMANN_WAHL));
  const speer = useMemo(() => baueSpeer(), []);
  const waffenClips = useGLTF(HELD_CLIPS);
  const waffenModelle = useGLTF('/figuren/kampf/waffen.glb');
  const leiber = useMemo<Partial<Record<GegnerArt, Leib | null>>>(() => ({
    keiler: leibAus(keiler, 'wurzelkeiler'), grathorn: leibAus(grathorn, 'grathorn'), wolf: leibAus(wolf, 'k7-wolf'),
    fuchs: leibAus(fuchs, 'spuerfuchs'), gams: leibAus(gams, 'nebelgams'),
  }), [keiler, grathorn, wolf, fuchs, gams]);
  const rigs = useMemo<Partial<Record<GegnerArt, RigVorlage>>>(() => (RIG_AUS ? {} : {
    wolf: { scene: wolfRig.scene, clips: wolfRig.animations },
    grathorn: { scene: grathornRig.scene, clips: grathornRig.animations },
    fuchs: { scene: fuchsRig.scene, clips: fuchsRig.animations },
    gams: { scene: gamsRig.scene, clips: gamsRig.animations },
    wegelagerer: { scene: wanderer.scene, clips: waffenClips.animations,
                   waffe: waffenModelle.scene.getObjectByName('Klinge') ?? undefined, wahl: WEGELAGERER_WAHL },
    speermann: { scene: bauerW.scene, clips: waffenClips.animations, waffe: speer, wahl: SPEERMANN_WAHL },
    axtmann: { scene: bauerM.scene, clips: waffenClips.animations,
               waffe: waffenModelle.scene.getObjectByName('Axt') ?? undefined, wahl: AXTMANN_WAHL },
  }), [wolfRig, grathornRig, fuchsRig, gamsRig, wanderer, bauerW, bauerM, speer, waffenClips, waffenModelle]);
  return <KampfplatzKern {...props} leiber={leiber} rigs={rigs} />;
}

/**
 * D187: Galerie (`?galerie=1`, aus dem Figureneditor): Übungsplatz, auf dem die Gegner nur stehen und
 * nicht fallen. Die Figur führt sich selbst vor — je Waffe Kette, schwerer Schlag, Block, dann die
 * vier Kameras (C). Jede Taste des Spielers funktioniert weiter; die Vorführung läuft nebenher.
 */
/** D188: Vorführung an/aus — die Galerie-Leiste schaltet sie. */
export const galerieAuto = { an: true };
export const GALERIE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('galerie');
const GALERIE_ABLAUF: [string, number, number?][] = [
  // [Taste, Wartezeit danach in ms, gehalten in ms]
  ['KeyX', 1000], ['KeyL', 800],
  ...(['Digit1', 'Digit2', 'Digit3'] as const).flatMap(d => [
    [d, 1300], ['KeyJ', 1300], ['KeyJ', 1500], ['KeyI', 2300], ['KeyU', 600, 900],
    ['KeyC', 2400], ['KeyC', 2200], ['KeyC', 2800], ['KeyC', 900],
  ] as [string, number, number?][]),
];

/** D188: `?funke=wasser` — mit Kernfunke in den Kampf (Prüfung). */
const FUNKE_PROBE: 'wasser' | undefined = typeof location !== 'undefined' && new URLSearchParams(location.search).get('funke') === 'wasser' ? 'wasser' : undefined;

const WAFFE_START: WaffenArt = (() => {
  const w = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('waffe') : null;
  return w === 'axt' || w === 'speer' ? w : 'klinge';
})();

/** `?rig=0`: Tiere wie bis D171 als bewegte Körper — zum Vergleich. */
const RIG_AUS = typeof location !== 'undefined' && new URLSearchParams(location.search).get('rig') === '0';

/** Ein Tier mit Rig bauen: Skelett geklont, Material je Tier, Anbau am nächsten Knochen. */
function baueRigLeib(v: RigVorlage, kreatur: string, statisch: THREE.BufferGeometry | undefined) {
  const obj = klonSkelett(v.scene);
  if (v.waffe) {
    // Mensch (D174): Farben der Figur (Vertexfarben) behalten — ein Material je Puppe fürs Aufblitzen.
    // D175: Texturierte Gestalt — jedes Netz behält sein Material (`legeWahlAn` klont sie); fürs
    // Aufblitzen nimmt die Puppe das Material des grössten Netzes (Kleidung).
    if (v.wahl) legeWahlAn(obj, v.wahl);
    let material: THREE.MeshStandardMaterial | null = null, koerper: THREE.SkinnedMesh | null = null, groesse = 0;
    obj.traverse(o => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh || !m.visible) return;
      if (!v.wahl) { material ??= (m.material as THREE.MeshStandardMaterial).clone(); m.material = material; }
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      const n = m.geometry.attributes.position.count;
      if (n > groesse) { groesse = n; koerper = m; if (v.wahl) material = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial; }
    });
    haengeAnHand(obj, v.waffe.clone());
    const mixer = new THREE.AnimationMixer(obj);
    const cache = new Map<string, THREE.AnimationAction | null>();
    const rig: Rig = { mixer, aktiv: null, schwung: -1, treffer: -1, aktion(name) {
      if (!cache.has(name)) { const c = v.clips.find(x => x.name === name); cache.set(name, c ? mixer.clipAction(c) : null); }
      return cache.get(name)!;
    } };
    return { obj, koerper: koerper as THREE.SkinnedMesh | null, material: material!, rig, setzeZeit: (_t: number) => {} };
  }
  const w = baueWindMaterial({ amplitude: 0, randFarbe: new THREE.Color('#8a9a9c'), randStaerke: 0.2, randSchaerfe: 1.6 });
  const material = w.material as THREE.MeshStandardMaterial;
  let koerper: THREE.SkinnedMesh | null = null;
  obj.traverse(o => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
      const m = o as THREE.SkinnedMesh;
      m.material = material; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      koerper ??= m;
    }
  });
  // Anbau (Rückenmodul, Gehörn …): dieselbe Geometrie wie in der Welt, an den Knochen gehängt,
  // dessen Kopf ihm am nächsten liegt — in der Ruhelage, bevor der Mixer läuft.
  const anbau = statisch ? baueAnbau(kreatur, statisch, 1, saatAusId(kreatur)) : null;
  if (anbau && koerper) {
    obj.updateMatrixWorld(true);
    anbau.computeBoundingBox();
    const mitte = anbau.boundingBox!.getCenter(new THREE.Vector3());
    let beste: THREE.Bone | null = null, besteD = Infinity;
    const p = new THREE.Vector3();
    for (const b of (koerper as THREE.SkinnedMesh).skeleton.bones) {
      const d = b.getWorldPosition(p).distanceTo(mitte);
      if (d < besteD) { besteD = d; beste = b; }
    }
    if (beste) {
      const m = new THREE.Mesh(anbau, material);
      m.castShadow = true;
      m.applyMatrix4(beste.matrixWorld.clone().invert().multiply(obj.matrixWorld));
      beste.add(m);
    }
  }
  const mixer = new THREE.AnimationMixer(obj);
  const cache = new Map<string, THREE.AnimationAction | null>();
  const rig: Rig = {
    mixer, aktiv: null, schwung: -1, treffer: -1,
    aktion(name) {
      if (!cache.has(name)) {
        const c = v.clips.find(x => x.name === name);
        cache.set(name, c ? mixer.clipAction(c) : null);
      }
      return cache.get(name)!;
    },
  };
  return { obj, koerper: koerper as THREE.SkinnedMesh | null, material, rig, setzeZeit: w.setzeZeit };
}

function KampfplatzKern({ ziel, gier, feld, kollision, ausdauer, gesperrt, stand, figur, zielt, aufstellung = VORGABE, leiber, rigs, onEnde, waffenStufen, nacht }:
  PlatzProps & { leiber: Partial<Record<GegnerArt, Leib | null>>; rigs: Partial<Record<GegnerArt, RigVorlage>> }) {
  const aufKey = aufstellung.join(',');
  const welt = useRef<Kampfwelt | null>(null);
  const zaehler = useRef({ rollen: 0, getroffen: 0, gesetzt: 0, phase: 'bereit' as Kaempfer['phase'] });
  useEffect(() => () => { if (figur) figur.current = null; }, [figur]);
  const ende = useRef<number | null>(null);
  const absicht = useRef({ schlag: null as 'leicht' | 'schwer' | null, rolle: false, zielen: false, wechsel: 0 as -1 | 0 | 1,
                           waffe: null as WaffenArt | 'tausch' | null, linie: null as Linie | null });
  /**
   * Der Übungsplatz wartet auf die erste Eingabe (D168). Vorher lief er schon während des Ladens,
   * und man stand mit halbem Leben auf — die Gegner stehen jetzt da, aber still.
   */
  // Eine Begegnung in der Welt wartet nicht auf die erste Taste (D175).
  const los = useRef(!!onEnde);
  const gemeldet = useRef(false);
  /** Die gewählte Waffe überlebt die neue Runde. */
  // D184: Messadresse `?waffe=axt|speer` — mit dieser Waffe in den Kampf (Bildprüfung).
  const waffeWahl = useRef<WaffenArt>(WAFFE_START);
  useEffect(() => () => { if (zielt) zielt.current = false; }, [zielt]);
  const tasten = useRef(new Set<string>());
  const meldung = useRef({ text: '', seit: 0 });
  /** Ist ein Ziel aufgeschaltet? Die Maus wählt dann die Linie (D175). */
  const aufgeschaltet = useRef(false);

  // D187: Galerie-Vorführung — dieselben Tasten, die ein Mensch drückt (synthetische Ereignisse).
  useEffect(() => {
    if (!GALERIE) return;
    let lebt = true;
    const warte = (ms: number) => new Promise(r => setTimeout(r, ms));
    const druecke = (code: string, dauer = 70) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })), dauer);
    };
    void (async () => {
      await warte(2500);
      for (let runde = 0; lebt; runde++) {
        for (const [taste, pause, halten] of GALERIE_ABLAUF) {
          if (!lebt) return;
          while (lebt && !galerieAuto.an) await warte(300);
          if (runde > 0 && taste === 'KeyX') continue;
          druecke(taste, halten);
          await warte((halten ?? 0) + pause);
        }
      }
    })();
    return () => { lebt = false; };
  }, []);
  useEffect(() => {
    const runter = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.repeat) {
        if (!ev.repeat) return;
      }
      tasten.current.add(ev.code);
      if (ev.repeat) return;
      los.current = true;
      const a = absicht.current;
      if (ev.code === 'KeyJ') a.schlag = 'leicht';
      if (ev.code === 'KeyI') a.schlag = 'schwer';
      if (ev.code === 'KeyK') a.rolle = true;
      if (ev.code === 'KeyL') a.zielen = true;
      // D174: Pfeiltasten wählen die Linie für Angriff und Block (ADR-0009 Stufe 2).
      const linie = ({ ArrowUp: 'oben', ArrowDown: 'unten', ArrowLeft: 'links', ArrowRight: 'rechts' } as const)[ev.code as 'ArrowUp'];
      if (linie) { a.linie = linie; ev.preventDefault(); }
      if (ev.code === 'KeyQ') a.wechsel = -1;
      if (ev.code === 'KeyE') a.wechsel = 1;
      if (ev.code === 'Digit1') a.waffe = 'klinge';
      if (ev.code === 'Digit2') a.waffe = 'axt';
      if (ev.code === 'Digit3') a.waffe = 'speer';
      if (ev.code === 'Tab') { a.waffe = 'tausch'; ev.preventDefault(); }
    };
    const beruehrt = (ev: PointerEvent) => {
      los.current = true;
      // D174: rechte Maustaste halten = Block, wie U (ADR-0009, offene Frage 1: beides).
      if (ev.button === 2) tasten.current.add('Maus2');
    };
    const losgelassen = (ev: PointerEvent) => { if (ev.button === 2) tasten.current.delete('Maus2'); };
    // D175 (ADR-0009, Frage 1): Mit aufgeschaltetem Ziel wählt die Maus die Linie — ein Zug von
    // 40 px in eine Richtung, die stärkere Achse gewinnt. Die Kamera rahmt dann ohnehin das Ziel.
    const zug = { x: 0, y: 0 };
    const bewegt = (ev: PointerEvent) => {
      if (ev.pointerType !== 'mouse' || !aufgeschaltet.current) { zug.x = zug.y = 0; return; }
      zug.x += ev.movementX; zug.y += ev.movementY;
      if (Math.hypot(zug.x, zug.y) < 40) return;
      absicht.current.linie = Math.abs(zug.x) > Math.abs(zug.y) ? (zug.x > 0 ? 'rechts' : 'links') : (zug.y > 0 ? 'unten' : 'oben');
      zug.x = zug.y = 0;
    };
    window.addEventListener('pointermove', bewegt);
    const keinMenue = (ev: MouseEvent) => ev.preventDefault();
    const hoch = (ev: KeyboardEvent) => { tasten.current.delete(ev.code); };
    const weg = () => tasten.current.clear();
    window.addEventListener('keydown', runter);
    window.addEventListener('keyup', hoch);
    window.addEventListener('blur', weg);
    window.addEventListener('pointerdown', beruehrt);
    window.addEventListener('pointerup', losgelassen);
    window.addEventListener('contextmenu', keinMenue);
    return () => {
      window.removeEventListener('pointerup', losgelassen);
      window.removeEventListener('pointermove', bewegt);
      window.removeEventListener('contextmenu', keinMenue);
      window.removeEventListener('pointerdown', beruehrt);
      window.removeEventListener('keydown', runter);
      window.removeEventListener('keyup', hoch);
      window.removeEventListener('blur', weg);
    };
  }, []);

  const zeichnung = useMemo(() => {
    const wurzel = new THREE.Group();
    wurzel.name = 'kampfplatz';
    const puppen: Puppe[] = [];
    const koerperGeo = new THREE.CapsuleGeometry(UEBUNGSGEGNER.radius, UEBUNGSGEGNER.hoehe - 2 * UEBUNGSGEGNER.radius, 4, 12);
    koerperGeo.translate(0, UEBUNGSGEGNER.hoehe / 2, 0);
    const naseGeo = new THREE.BoxGeometry(0.22, 0.12, 0.3);
    naseGeo.translate(0, UEBUNGSGEGNER.hoehe * 0.8, -UEBUNGSGEGNER.radius - 0.08);
    // 0,1 m: kleiner gingen sie neben der Zielmarke unter (im Bild geprüft, D169).
    const rauteGeo = new THREE.OctahedronGeometry(0.1, 0);
    for (let i = 0; i < Math.min(3, aufstellung.length); i++) {
      const art = aufstellung[i] ?? 'kapsel';
      const werte = WERTE[art];
      const leib = leiber[art] ?? null;
      const vorlage = rigs[art];
      const bogenGeo = faecherFuer(werte.schlag);
      const gruppe = new THREE.Group();
      const leibGruppe = new THREE.Group();
      let koerper: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      let gang: ((g: number) => void) | undefined, zeit: ((t: number) => void) | undefined;
      let rig: Rig | undefined;
      const rl = vorlage && RIG[art] ? baueRigLeib(vorlage, RIG[art]!.datei, leib?.geometrie) : null;
      if (rl && rl.koerper) {
        koerper = rl.koerper as unknown as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
        leibGruppe.add(rl.obj);
        rig = rl.rig; zeit = rl.setzeZeit;
      } else if (leib) {
        const m = leib.baue();
        koerper = new THREE.Mesh(leib.geometrie, m.material);
        gang = m.setzeGang; zeit = m.setzeZeit;
      } else {
        koerper = new THREE.Mesh(koerperGeo, new THREE.MeshStandardMaterial({
          color: FARBE.koerper, roughness: 0.85, emissive: new THREE.Color(0, 0, 0),
        }));
        const nase = new THREE.Mesh(naseGeo, koerper.material);
        nase.castShadow = true;
        leibGruppe.add(nase);
      }
      koerper.castShadow = true; koerper.receiveShadow = true;
      if (!rig) leibGruppe.add(koerper);
      const bogen = new THREE.Mesh(bogenGeo, new THREE.MeshBasicMaterial({
        color: FARBE.telegraf, transparent: true, opacity: 0, depthWrite: false,
      }));
      bogen.position.y = 0.06;
      bogen.renderOrder = 2;
      const kranz = new THREE.Group();
      const rauteMat = new THREE.MeshBasicMaterial({ color: '#f3f0e6' });
      for (let k = 0; k < 3; k++) {
        const r = new THREE.Mesh(rauteGeo, rauteMat);
        const a = (k / 3) * Math.PI * 2;
        r.position.set(Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38);
        kranz.add(r);
      }
      kranz.position.y = werte.hoehe + 0.3;
      kranz.visible = false;
      gruppe.add(leibGruppe, bogen, kranz);
      wurzel.add(gruppe);
      puppen.push({ gruppe, leib: leibGruppe, koerper, bogen, kranz, blitz: -1, seite: 'Right', art, rig, gang, zeit, vorher: { x: NaN, z: NaN } });
    }
    // Der Fächer der Spielerin: sichtbar im Vorlauf blass, im Aktiven hell.
    const schwung = new THREE.Mesh(
      faecherFuer(WAFFEN.klinge.schlag),
      new THREE.MeshBasicMaterial({ color: FARBE.faecher, transparent: true, opacity: 0, depthWrite: false }),
    );
    schwung.renderOrder = 2;
    wurzel.add(schwung);
    // Die Zielmarke über dem aufgeschalteten Gegner.
    const marke = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0),
      new THREE.MeshBasicMaterial({ color: '#cfe9f2' }));
    marke.visible = false;
    wurzel.add(marke);
    return { wurzel, puppen, schwung, marke };
    // `aufKey` statt `aufstellung`: Ein neues Feld mit demselben Inhalt soll den Platz nicht neu bauen.
  }, [leiber, rigs, aufKey]);

  useEffect(() => () => {
    // Die Geometrie des Keilers gehört dem Modell-Cache (useGLTF), nicht dem Platz.
    zeichnung.wurzel.traverse(o => {
      if (o instanceof THREE.Mesh) {
        // Fächer sind je Schlag geteilt (D171) — `dispose` gibt nur den GPU-Speicher frei, beim
        // nächsten Zeichnen lädt three.js sie neu.
        const geteilt = Object.values(leiber).some(l => l?.geometrie === o.geometry) || (o as THREE.SkinnedMesh).isSkinnedMesh;
        if (!geteilt) o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }, [zeichnung, leiber]);

  useFrame((_, rohDt) => {
    const p = ziel.current?.position;
    if (!p) return;
    const dt = Math.min(rohDt, 0.1);
    const jetzt = performance.now();
    if (!welt.current) {
      welt.current = baueWelt(p.x, p.z, gier.current, aufstellung, nacht); welt.current.spielerin.ausdauerFremd = true;
      welt.current.friedlich = GALERIE;
      if (GALERIE) {
        // Die Gegner nah heran (3,5 m vor die Figur, nebeneinander), damit Gegneransicht und Treffer zu sehen sind.
        const sp = welt.current.spielerin, [fx, fz] = vorwaerts(sp.blick);
        welt.current.gegner.forEach((g, i) => {
          const q = (i - (welt.current!.gegner.length - 1) / 2) * 2.4;
          g.x = sp.x + fx * 3.5 - fz * q; g.z = sp.z + fz * 3.5 + fx * q;
          g.blick = blickAuf(g.x, g.z, sp.x, sp.z);
        });
      }
      if (waffeWahl.current !== 'klinge') ruesteAus(welt.current.spielerin, waffeWahl.current);
    }
    // Bis zur ersten Eingabe steht der Platz still — die Gegner folgen dem Absetzpunkt nicht,
    // sie stehen dort, wo sie zuerst hingestellt wurden.
    const w = welt.current;
    const s = w.spielerin;

    // ---- Abgleich: die Figur bewegt `Spieler`, der Kampf übernimmt nur, was er selbst tut.
    s.x = p.x; s.z = p.z; s.y = p.y;
    s.blick = gier.current;
    s.ausdauer = ausdauer.current;

    const melde = (text: string) => { meldung.current = { text, seit: jetzt }; };

    // ---- Absichten
    const a = absicht.current;
    if (a.zielen) {
      a.zielen = false;
      w.ziel = w.ziel ? null : (waehleZiel(s, w.gegner, w.recht ?? null)?.id ?? null);
      if (!w.ziel) melde('kein Ziel');
    }
    if (a.wechsel !== 0) {
      if (w.ziel) w.ziel = wechsleZiel(s, w.gegner, w.ziel, a.wechsel)?.id ?? w.ziel;
      a.wechsel = 0;
    }
    if (a.waffe) {
      const art: WaffenArt = a.waffe === 'tausch' ? (({ klinge: 'axt', axt: 'speer', speer: 'klinge' } as const)[s.waffe ?? 'klinge']) : a.waffe;
      a.waffe = null;
      if (art !== (s.waffe ?? 'klinge')) {
        if (ruesteAus(s, art)) { waffeWahl.current = art; melde(WAFFEN[art].name); }
        else melde('erst ausschwingen');
      }
    }
    if (zielt) zielt.current = w.ziel !== null;
    aufgeschaltet.current = w.ziel !== null;
    const t = tasten.current;
    const vor = (t.has('KeyW') ? 1 : 0) - (t.has('KeyS') ? 1 : 0);
    const seit = (t.has('KeyD') ? 1 : 0) - (t.has('KeyA') ? 1 : 0);
    // Rennen wie in `steuerung.ts`: Shift und eine Richtung. Dann wird J zum Laufangriff.
    s.rennt = (t.has('ShiftLeft') || t.has('ShiftRight')) && (vor !== 0 || seit !== 0);
    // Gepuffert (D171): ausgeführt im nächsten Teilschritt, in dem es geht — auch aus der Erholung.
    if (a.linie) { s.linie = a.linie; a.linie = null; }
    s.schadenFaktor = schadenFaktor(waffenStufen?.[s.waffe ?? 'klinge'] ?? 0);
    s.element = waffenStufen?.funke ?? FUNKE_PROBE;
    if (a.schlag) { puffere(s, a.schlag); a.schlag = null; }
    // Block (ADR-0009 Stufe 1, D173): U halten. Heben im ersten Moment vor dem Treffer pariert.
    if (t.has('KeyU') || t.has('Maus2')) { if (s.phase !== 'block') setzeBlockAn(s); } else loeseBlock(s);
    if (a.rolle) {
      a.rolle = false;
      const g = s.blick;
      // Ohne Richtung rückwärts — der Schritt aus der Gefahr, nicht in sie hinein.
      const [v, sv] = vor === 0 && seit === 0 ? [-1, 0] : [vor, seit];
      const rx = -Math.sin(g) * v + Math.cos(g) * sv;
      const rz = -Math.cos(g) * v - Math.sin(g) * sv;
      puffere(s, 'rolle', rx, rz);
    }

    // ---- Zielaufschaltung zieht den Blick
    const zielK = w.ziel ? w.gegner.find(g => g.id === w.ziel) : undefined;
    if (zielK) {
      const merk = s.blick;
      drehe(s, blickAuf(s.x, s.z, zielK.x, zielK.z), ZIELEN.drehrate, dt);
      gier.current += s.blick - merk;
      if (Math.hypot(zielK.x - s.x, zielK.z - s.z) > ZIELEN.reichweite * 1.3) w.ziel = null;
    }

    // ---- Rechnen
    const halbB = feld.breiteMeter / 2 - 1.5, halbT = feld.tiefeMeter / 2 - 1.5;
    const schiebe = (x: number, z: number): [number, number] => {
      const [kx, kz] = kollision.schiebeRaus(x, z);
      return [Math.max(-halbB, Math.min(halbB, kx)), Math.max(-halbT, Math.min(halbT, kz))];
    };
    const ereignisse: Treffer[] = los.current ? simuliere(w, dt, schiebe) : [];
    // Was die Schläge und Rollen gekostet haben, geht in die gemeinsame Kasse. Nur das — erholen
    // lässt sie `Spieler` (`ausdauerFremd`).
    ausdauer.current = s.ausdauer;
    // Eine Eingabe, die im Stand nicht ausgeführt wurde, scheitert an der Ausdauer.
    if (s.puffer && s.phase === 'bereit') {
      const kosten = s.puffer.art === 'rolle' ? s.werte.rolle.kosten : naechsterSchlag(s, s.puffer.art).schlag.kosten;
      if (!reicht(s.ausdauer, kosten)) { melde('zu erschöpft'); s.puffer = null; }
    }
    p.x = s.x; p.z = s.z;
    gesperrt.current = !frei(s) || s.phase === 'gefallen';

    for (const e of ereignisse) {
      if (e.auf === 'spielerin') {
        if (!e.ausgewichen && e.schaden > 0) zaehler.current.getroffen++;
        if (e.ausgewichen) melde('ausgewichen');
        else if (e.pariert) melde('pariert');
        else if (e.falscheLinie) melde('falsche Linie');
        else if (e.geblockt) melde(e.gebrochen ? 'Block gebrochen' : 'geblockt');
        else if (e.toedlich) melde('gefallen');
        else if (e.gebrochen) melde('Haltung gebrochen');
      } else {
        const i = w.gegner.findIndex(g => g.id === e.auf);
        if (e.element) melde('Flutstoss');
        if (i >= 0 && !e.ausgewichen) {
          zeichnung.puppen[i].blitz = jetzt;
          // Seite des Angreifers im Blick des Getroffenen: rechts ist (−vz, vx) zur Vorwärtsrichtung.
          const g = w.gegner[i], [fx, fz] = vorwaerts(g.blick);
          zeichnung.puppen[i].seite = (s.x - g.x) * -fz + (s.z - g.z) * fx > 0 ? 'Right' : 'Left';
        }
        if (e.von === 'spielerin' && e.schaden > 0) zaehler.current.gesetzt++;
        if (e.von === 'spielerin' && e.gedeckt) melde('gedeckt');
        if (e.toedlich) melde('besiegt');
        else if (e.gebrochen) melde('er taumelt');
      }
    }

    // ---- Übungsplatz neu aufstellen
    // D187: In der Galerie fällt niemand — Leben zurück, bevor das Ende zählt.
    if (GALERIE) { s.leben = s.werte.lebenMax; for (const g of w.gegner) g.leben = g.werte.lebenMax; }
    const vorbei = s.phase === 'gefallen' || w.gegner.every(g => g.phase === 'gefallen');
    if (vorbei && ende.current === null) ende.current = jetzt;
    if (onEnde && ende.current !== null && jetzt - ende.current > 1500 && !gemeldet.current) {
      gemeldet.current = true;
      onEnde(s.phase !== 'gefallen');
    }
    if (!onEnde && ende.current !== null && jetzt - ende.current > NEUSTART * 1000) {
      welt.current = baueWelt(p.x, p.z, gier.current, aufstellung, nacht);
      welt.current.spielerin.ausdauerFremd = true;
      ruesteAus(welt.current.spielerin, waffeWahl.current);
      ende.current = null;
      melde('neue Runde');
    }

    // ---- Zeichnen
    w.gegner.forEach((g, i) => zeichnePuppe(zeichnung.puppen[i], g, feld, jetzt, dt));
    const sw = zeichnung.schwung;
    sw.position.set(s.x, hoeheAufFlaeche(feld, s.x, s.z) + 0.05, s.z);
    sw.rotation.y = s.blick;
    if (sw.geometry !== faecherFuer(s.schlag)) sw.geometry = faecherFuer(s.schlag);
    sw.material.opacity = s.phase === 'aktiv' ? 0.3 : s.phase === 'vorlauf' ? 0.12 : 0;
    const mk = zeichnung.marke;
    const zk = w.ziel ? w.gegner.find(g => g.id === w.ziel) : undefined;
    mk.visible = !!zk;
    if (zk) {
      mk.position.set(zk.x, zk.y + zk.werte.hoehe + 0.45, zk.z);
      mk.rotation.y += dt * 2.5;
    }

    if (figur) {
      const z = zaehler.current;
      if (s.phase === 'rolle' && z.phase !== 'rolle') z.rollen++;
      z.phase = s.phase;
      const sw = s.werte, sl = s.schlag, waffe = WAFFEN[s.waffe ?? 'klinge'];
      figur.current = {
        phase: s.phase, schwung: s.schwung, rollen: z.rollen, getroffen: z.getroffen,
        element: s.element, ladung: s.ladung ?? 0,
        schlagDauer: sl.vorlauf + sl.aktiv + sl.erholung,
        rolleDauer: sw.rolle.dauer,
        rolleBlick: s.rolleX !== 0 || s.rolleZ !== 0 ? Math.atan2(-s.rolleX, -s.rolleZ) : null,
        // Gefallen gibt es nichts mehr zu rahmen — die Kamera geht zurück hinter die Figur.
        fokus: zk && s.phase !== 'gefallen' ? { x: zk.x, y: zk.y + zk.werte.hoehe * 0.7, z: zk.z } : null,
        zeit: s.zeit,
        vorlauf: sl.vorlauf, aktiv: sl.aktiv, erholung: sl.erholung,
        waffe: s.waffe ?? 'klinge',
        clip: sl.clip ?? 'Sword_Slash', hieb: sl.hieb ?? null, haltung: waffe.haltung, gesetzt: z.gesetzt,
      };
    }

    if (stand) {
      stand.current = {
        leben: s.leben, lebenMax: s.werte.lebenMax, phase: s.phase,
        ziel: zk ? {
          leben: zk.leben, lebenMax: zk.werte.lebenMax,
          haltung: zk.haltung, haltungMax: zk.werte.haltungMax, phase: zk.phase,
        } : null,
        gegnerUebrig: w.gegner.filter(g => g.phase !== 'gefallen').length,
        gegnerGesamt: w.gegner.length,
        protokoll: w.gegner.map(g => `${g.id === w.recht ? '*' : ''}${g.phase}`
          + `${g.phase === 'vorlauf' || g.phase === 'aktiv' ? `:${g.schlag.name ?? ''}` : ''}`
          + `@${Math.hypot(g.x - s.x, g.z - s.z).toFixed(1)}`).join(' '),
        meldung: los.current ? meldung.current.text : 'eine Taste — die Übung beginnt',
        meldungSeit: los.current ? meldung.current.seit : 0,
        waffe: WAFFEN[s.waffe ?? 'klinge'].name, ladung: s.element ? s.ladung ?? 0 : null,
        ruhig: !los.current,
        getroffen: zaehler.current.getroffen,
        schlag: s.phase === 'vorlauf' || s.phase === 'aktiv' || s.phase === 'erholung' ? s.schlag.name ?? '' : '',
        linien: zk?.werte.mensch || zk?.werte.linien ? {
          eigen: s.linie, deckung: zk.deckung,
          kommt: zk.phase === 'vorlauf' || zk.phase === 'aktiv' ? zk.schlagLinie : undefined,
          parade: zk.phase === 'vorlauf' && zk.schlag.vorlauf - zk.zeit <= PARADE,
        } : null,
      };
    }
  });

  return <primitive object={zeichnung.wurzel} />;
}

function zeichnePuppe(pu: Puppe, g: Kaempfer, feld: HoehenFeld, jetzt: number, dt: number): void {
  g.y = hoeheAufFlaeche(feld, g.x, g.z);
  pu.gruppe.position.set(g.x, g.y, g.z);
  pu.gruppe.rotation.y = g.blick;
  const m = pu.koerper.material;
  const s = g.schlag;
  if (pu.bogen.geometry !== faecherFuer(s)) pu.bogen.geometry = faecherFuer(s);
  m.emissive.setRGB(0, 0, 0);
  pu.bogen.material.opacity = 0;
  const l = pu.leib;
  l.position.set(0, 0, 0); l.rotation.set(0, 0, 0);
  pu.gruppe.visible = true;
  pu.kranz.visible = false;
  const uhr = jetzt / 1000;
  pu.zeit?.(uhr);
  // Gang aus der tatsächlichen Bewegung — der Shader-Gang (D138) läuft, solange er läuft.
  const v = Number.isNaN(pu.vorher.x) || dt <= 0 ? 0 : Math.hypot(g.x - pu.vorher.x, g.z - pu.vorher.z) / dt;
  pu.vorher.x = g.x; pu.vorher.z = g.z;
  pu.gang?.(g.phase === 'bereit' ? Math.min(1, v / 1.6) : 0);
  const keiler = pu.art === 'keiler';
  const horn = pu.art === 'grathorn';
  const wolf = pu.art === 'wolf';
  const tier = keiler || horn || wolf;
  /** Der zweite Biss einer Kette: kürzer, flacher, aus der Bewegung (D171). */
  const nachbiss = wolf && g.folge.length === 0 && s !== g.werte.schlag;

  if (g.phase === 'vorlauf') {
    // Das Telegraf: Der Bogen am Boden füllt sich, der Körper glüht auf. Beides wächst mit dem
    // Vorlauf — wer das Aufglühen sieht, weiss, wie viel Zeit bleibt.
    const t = Math.min(1, g.zeit / s.vorlauf);
    const farbe = s.durch ? FARBE.durch : FARBE.telegraf;
    pu.bogen.material.color.copy(farbe);
    // Undurchdringlich blinkt der Bogen — man soll es aus dem Augenwinkel sehen, nicht erst lesen.
    pu.bogen.material.opacity = (0.08 + 0.32 * t) * (s.durch ? 0.7 + 0.3 * Math.sin(g.zeit * 30) : 1);
    m.emissive.copy(farbe).multiplyScalar(0.15 + 0.6 * t * t);
    if (keiler) {
      // Kopf runter, Gewicht nach hinten, scharren: der Körper sagt es, bevor die Farbe es sagt.
      l.position.z = 0.3 * t;
      l.rotation.x = -0.16 * t;
      l.position.y = Math.abs(Math.sin(g.zeit * 16)) * 0.035 * t;
    } else if (horn) {
      // Der Grathorn steigt: Vorderteil hoch, Kopf zurück — das Gegenteil des Keilers. Wer beide
      // kennt, liest am Kopf, wer gleich kommt (D170).
      l.rotation.x = 0.32 * t;
      l.position.y = 0.12 * t;
      l.position.z = 0.25 * t;
    } else if (wolf) {
      // Der Wolf duckt sich: tief, Gewicht auf den Hinterläufen, Kopf vor. Beim Nachbiss kein
      // Ducken — er kommt aus dem ersten Satz heraus, nur der Kopf zieht zurück.
      if (nachbiss) { l.position.z = -0.35 + 0.1 * t; l.rotation.x = 0.06 * t; }
      else {
        l.position.y = -0.1 * t;
        l.position.z = 0.22 * t;
        l.rotation.x = -0.1 * t;
        l.rotation.z = Math.sin(g.zeit * 22) * 0.02 * t;
      }
    }
  } else if (g.phase === 'aktiv') {
    pu.bogen.material.opacity = 0.65;
    m.emissive.copy(s.durch ? FARBE.durch : FARBE.telegraf).multiplyScalar(1.0);
    if (keiler) {
      // Der Stoss: nach vorn werfen, Kopf hoch — die Hauer von unten nach oben.
      const u = Math.min(1, g.zeit / s.aktiv);
      l.position.z = 0.3 - 1.2 * u;
      l.rotation.x = -0.16 + 0.3 * u;
    } else if (horn) {
      // Herunterkrachen: aus dem Steigen schräg nach vorn unten, Gehörn voran.
      const u = Math.min(1, g.zeit / s.aktiv);
      l.rotation.x = 0.32 - 0.62 * u;
      l.position.y = 0.12 * (1 - u);
      l.position.z = 0.25 - 0.95 * u;
    } else if (wolf) {
      // Der Satz: flach nach vorn, Kopf hoch zum Zuschnappen. Der Nachbiss springt weiter.
      const u = Math.min(1, g.zeit / s.aktiv);
      const von = nachbiss ? -0.25 : 0.22;
      l.position.z = von - (nachbiss ? 0.6 : 0.8) * u;
      l.position.y = (nachbiss ? 0.1 : 0.14) * Math.sin(u * Math.PI);
      l.rotation.x = (nachbiss ? 0.06 : -0.1) + 0.22 * u;
    }
  } else if (g.phase === 'erholung' && tier) {
    const u = Math.min(1, g.zeit / s.erholung);
    const r = 1 - (1 - u) * (1 - u);
    // Der Wolf zwischen den Bissen: bleibt vorn, der Kopf kommt zurück — kein Zurückweichen.
    const zurueck = wolf ? (g.folge.length > 0 ? -0.58 : nachbiss ? -0.85 : -0.6) : keiler ? -0.9 : -0.7;
    l.position.z = wolf && g.folge.length > 0 ? zurueck + 0.23 * r : zurueck * (1 - r);
    l.rotation.x = (keiler ? 0.14 : wolf ? 0.12 : -0.3) * (1 - r);
  } else if (g.phase === 'betaeubt') {
    // Taumeln (D169): Blau allein ging bei Tag unter. Jetzt schwankt der Körper sichtbar, und drei
    // Rauten kreisen über dem Kopf — das liest man auf jedem Untergrund und in jeder Stimmung.
    const t = g.zeit;
    const abkling = Math.max(0.35, 1 - t / Math.max(0.01, g.werte.betaeubt));
    m.emissive.copy(FARBE.taumeln).multiplyScalar(0.35);
    l.rotation.z = Math.sin(t * 9) * 0.22 * abkling;
    l.rotation.x = tier ? 0.1 : 0.18;
    l.position.y = tier ? -0.06 : 0;
    pu.kranz.visible = true;
    pu.kranz.rotation.y = uhr * 4;
    pu.kranz.position.y = g.werte.hoehe + 0.3 + Math.sin(uhr * 6) * 0.04;
  } else if (g.phase === 'gefallen') {
    const t = Math.min(1, g.zeit / 0.6);
    if (tier) {
      l.rotation.z = t * Math.PI / 2;
      l.position.y = -t * 0.1;
      l.position.x = t * 0.35;
    } else {
      l.rotation.x = t * Math.PI / 2;
      l.position.y = -t * 0.35;
    }
  }
  // Aufblitzen beim Treffer — 120 ms, über allem anderen.
  if (jetzt - pu.blitz < 120) m.emissive.copy(FARBE.treffer).multiplyScalar(0.9);
  if (pu.rig) spieleRig(pu, g, v, jetzt, dt);
}

/**
 * Clip nach Phase (D172), wie bei der Spielerin: Der Angriff wird nicht abgespielt, sondern seine
 * Zeit je Bild gesetzt — Vorlauf auf 0…Scheitel, Aktiv auf Scheitel…Durchzug, Erholung auf den Rest.
 * Die Regel ist die Wahrheit, der Clip folgt ihr. Der Nachbiss (Kette) beginnt halb im Ausholen:
 * Er hat nur 0,1 s Vorlauf und kommt aus der Bewegung.
 */
function spieleRig(pu: Puppe, g: Kaempfer, v: number, jetzt: number, dt: number): void {
  const r = pu.rig!, cfg = RIG[pu.art]!;
  const s = g.schlag;
  let ziel: THREE.AnimationAction | null = null, blende = 0.2, neu = false, zeit: number | null = null;
  if (g.phase === 'gefallen') {
    ziel = r.aktion('Death') ?? r.aktion('Kampf_Taumeln'); blende = 0.12;
    if (ziel) { ziel.setLoop(THREE.LoopOnce, 1); ziel.clampWhenFinished = true; }
  } else if (g.phase === 'vorlauf' || g.phase === 'aktiv' || g.phase === 'erholung') {
    // Mensch (D174): der Clip der Linie, aus der er schlägt.
    const c = (g.schlagLinie && cfg.linien?.[g.schlagLinie]) || { clip: cfg.angriff, scheitel: cfg.scheitel, durchzug: cfg.durchzug };
    ziel = r.aktion(c.clip); blende = 0.1;
    if (ziel) {
      ziel.setLoop(THREE.LoopOnce, 1); ziel.clampWhenFinished = true;
      const d = ziel.getClip().duration;
      const start = s !== g.werte.schlag && !cfg.linien ? c.scheitel * 0.5 : 0;
      const u = g.phase === 'vorlauf' ? start + (c.scheitel - start) * Math.min(1, g.zeit / s.vorlauf)
        : g.phase === 'aktiv' ? c.scheitel + (c.durchzug - c.scheitel) * Math.min(1, g.zeit / s.aktiv)
        : c.durchzug + (d - c.durchzug) * Math.min(1, g.zeit / s.erholung);
      zeit = Math.min(u, d * 0.999);
      if (g.schwung !== r.schwung) { r.schwung = g.schwung; neu = true; }
    }
  } else if (g.phase === 'betaeubt') {
    ziel = r.aktion(`Idle_HitReact_${pu.seite}`) ?? r.aktion('Kampf_Taumeln');
    if (ziel) ziel.timeScale = 0.55;
  } else if (jetzt - pu.blitz < 450) {
    ziel = r.aktion(`Idle_HitReact_${pu.seite}`) ?? r.aktion('Kampf_Rueckstoss'); blende = 0.08;
    if (ziel && pu.blitz !== r.treffer) { r.treffer = pu.blitz; neu = true; ziel.setLoop(THREE.LoopOnce, 1); }
  } else {
    const stand = cfg.linien ? r.aktion(cfg.stand ?? 'Klinge_Stand') ?? r.aktion('Idle') : r.aktion('Idle');
    ziel = v < 0.15 ? stand : v < 2.6 ? r.aktion('Walk') : r.aktion('Gallop') ?? r.aktion('Walk');
    if (ziel && ziel === r.aktion('Walk')) ziel.timeScale = Math.max(0.6, Math.min(2, v / 1.1));
    if (ziel && ziel === r.aktion('Gallop')) ziel.timeScale = Math.max(0.7, Math.min(1.6, v / 4));
  }
  if (!ziel) return;
  if (ziel !== r.aktiv || neu) {
    ziel.reset().setEffectiveWeight(1).play();
    if (r.aktiv && r.aktiv !== ziel) r.aktiv.crossFadeTo(ziel, blende, false);
    r.aktiv = ziel;
  }
  if (zeit !== null) { ziel.timeScale = 0; ziel.time = zeit; }
  r.mixer.update(Math.min(dt, 0.1));
}
