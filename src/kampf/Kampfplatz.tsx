/**
 * BRACHLAND — Übungsplatz: der Echtzeitkampf in der Welt (ADR-0007, Stufe 1)
 *
 * `?kampf=1` stellt zwei Übungsgegner vor die Spielerin. Sonst ändert sich nichts: Das Rundensystem
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
 * J Schlag · K Rolle (Richtung aus WASD, ohne Taste rückwärts) · L Ziel auf/ab. Die Maus bleibt
 * beim Blick: Ziehen dreht die Kamera, und ein Klick, der vielleicht ein Ziehen werden sollte, darf
 * keinen Schlag auslösen. Touch folgt mit Stufe 2 (ADR-0006: das Handy ist nachrangig).
 *
 * ## Ausdauer
 *
 * Eine Kasse für Klettern, Springen und Kampf — der Ref aus `main.tsx`. Der Kampf **verbraucht**
 * daraus, erholen lässt ihn nur `Spieler`. Würde die Kampfsimulation ihre Erholung zurückschreiben,
 * erholte sich die Ausdauer doppelt so schnell, sobald ein Gegner in der Nähe steht.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  SPIELERIN, UEBUNGSGEGNER, ZIELEN,
  neuerKaempfer, setzeSchlagAn, setzeRolleAn, simuliere, waehleZiel, drehe, blickAuf, frei,
  WAFFEN, ruesteAus, wechsleZiel, type WaffenArt,
  type Kampfwelt, type Kaempfer, type Treffer,
} from './echtzeit.js';
import type { Ausdauer } from '../spieler/ausdauer.js';
import type { Kollisionsfeld } from '../spieler/kollision.js';
import { hoeheAufFlaeche, type HoehenFeld } from '../world/lod.js';
import type { KampfStand } from '../ui/Kampfanzeige.js';

/**
 * Was Figur und Kamera vom Kampf wissen müssen (D167). `Kampfplatz` schreibt es je Bild, die
 * Spielerfigur wählt daraus den Clip, die Kamera den Blick. Als Ref, wie `ausdauer`.
 */
export interface KampfFigur {
  phase: Kaempfer['phase'];
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
}

/** Nach so vielen Sekunden steht der Übungsplatz wieder — nach einem Sieg wie nach einer Niederlage. */
const NEUSTART = 3.5;

const FARBE = {
  koerper: new THREE.Color('#5d5145'),
  telegraf: new THREE.Color('#e0762c'),
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

/** Was je Gegner gezeichnet wird. */
interface Puppe {
  gruppe: THREE.Group;
  koerper: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  bogen: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  /** Wann zuletzt getroffen — für das Aufblitzen. */
  blitz: number;
}

function baueWelt(x: number, z: number, blick: number): Kampfwelt {
  const spielerin = neuerKaempfer('spielerin', SPIELERIN, x, z, blick);
  // Zwei Gegner vor der Spielerin, versetzt — der zweite kommt etwas später an, damit man den
  // ersten Telegraf allein lesen kann, bevor es eng wird.
  const vor = (weite: number, seite: number): [number, number] => [
    x - Math.sin(blick) * weite + Math.cos(blick) * seite,
    z - Math.cos(blick) * weite - Math.sin(blick) * seite,
  ];
  const [ax, az] = vor(9, -2.5), [bx, bz] = vor(10.5, 3);
  return {
    spielerin,
    gegner: [
      neuerKaempfer('uebung-1', UEBUNGSGEGNER, ax, az, blickAuf(ax, az, x, z)),
      neuerKaempfer('uebung-2', UEBUNGSGEGNER, bx, bz, blickAuf(bx, bz, x, z)),
    ],
    ziel: null,
  };
}

export function Kampfplatz({ ziel, gier, feld, kollision, ausdauer, gesperrt, stand, figur, zielt }: {
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
}) {
  const welt = useRef<Kampfwelt | null>(null);
  const zaehler = useRef({ rollen: 0, getroffen: 0, phase: 'bereit' as Kaempfer['phase'] });
  useEffect(() => () => { if (figur) figur.current = null; }, [figur]);
  const ende = useRef<number | null>(null);
  const absicht = useRef({ schlag: false, rolle: false, zielen: false, wechsel: 0 as -1 | 0 | 1,
                           waffe: null as WaffenArt | 'tausch' | null });
  /**
   * Der Übungsplatz wartet auf die erste Eingabe (D168). Vorher lief er schon während des Ladens,
   * und man stand mit halbem Leben auf — die Gegner stehen jetzt da, aber still.
   */
  const los = useRef(false);
  /** Die gewählte Waffe überlebt die neue Runde. */
  const waffeWahl = useRef<WaffenArt>('klinge');
  useEffect(() => () => { if (zielt) zielt.current = false; }, [zielt]);
  const tasten = useRef(new Set<string>());
  const meldung = useRef({ text: '', seit: 0 });

  useEffect(() => {
    const runter = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.repeat) {
        if (!ev.repeat) return;
      }
      tasten.current.add(ev.code);
      if (ev.repeat) return;
      los.current = true;
      const a = absicht.current;
      if (ev.code === 'KeyJ') a.schlag = true;
      if (ev.code === 'KeyK') a.rolle = true;
      if (ev.code === 'KeyL') a.zielen = true;
      if (ev.code === 'KeyQ') a.wechsel = -1;
      if (ev.code === 'KeyE') a.wechsel = 1;
      if (ev.code === 'Digit1') a.waffe = 'klinge';
      if (ev.code === 'Digit2') a.waffe = 'axt';
      if (ev.code === 'Tab') { a.waffe = 'tausch'; ev.preventDefault(); }
    };
    const beruehrt = () => { los.current = true; };
    const hoch = (ev: KeyboardEvent) => { tasten.current.delete(ev.code); };
    const weg = () => tasten.current.clear();
    window.addEventListener('keydown', runter);
    window.addEventListener('keyup', hoch);
    window.addEventListener('blur', weg);
    window.addEventListener('pointerdown', beruehrt);
    return () => {
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
    const bogenGeo = faecher(UEBUNGSGEGNER.schlag.reichweite + SPIELERIN.radius, UEBUNGSGEGNER.schlag.halbwinkel);
    for (let i = 0; i < 2; i++) {
      const gruppe = new THREE.Group();
      const koerper = new THREE.Mesh(koerperGeo, new THREE.MeshStandardMaterial({
        color: FARBE.koerper, roughness: 0.85, emissive: new THREE.Color(0, 0, 0),
      }));
      koerper.castShadow = true; koerper.receiveShadow = true;
      const nase = new THREE.Mesh(naseGeo, koerper.material);
      nase.castShadow = true;
      const bogen = new THREE.Mesh(bogenGeo, new THREE.MeshBasicMaterial({
        color: FARBE.telegraf, transparent: true, opacity: 0, depthWrite: false,
      }));
      bogen.position.y = 0.06;
      bogen.renderOrder = 2;
      gruppe.add(koerper, nase, bogen);
      wurzel.add(gruppe);
      puppen.push({ gruppe, koerper, bogen, blitz: -1 });
    }
    // Der Fächer der Spielerin: sichtbar im Vorlauf blass, im Aktiven hell.
    const schwung = new THREE.Mesh(
      faecher(SPIELERIN.schlag.reichweite + UEBUNGSGEGNER.radius, SPIELERIN.schlag.halbwinkel),
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
  }, []);

  useEffect(() => () => {
    zeichnung.wurzel.traverse(o => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
    });
  }, [zeichnung]);

  useFrame((_, rohDt) => {
    const p = ziel.current?.position;
    if (!p) return;
    const dt = Math.min(rohDt, 0.1);
    const jetzt = performance.now();
    if (!welt.current) welt.current = baueWelt(p.x, p.z, gier.current);
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
      const art: WaffenArt = a.waffe === 'tausch' ? (s.waffe === 'axt' ? 'klinge' : 'axt') : a.waffe;
      a.waffe = null;
      if (art !== (s.waffe ?? 'klinge')) {
        if (ruesteAus(s, art)) { waffeWahl.current = art; melde(WAFFEN[art].name); }
        else melde('erst ausschwingen');
      }
    }
    if (zielt) zielt.current = w.ziel !== null;
    if (a.schlag) {
      a.schlag = false;
      if (!setzeSchlagAn(s) && frei(s)) melde('zu erschöpft');
    }
    if (a.rolle) {
      a.rolle = false;
      const t = tasten.current;
      const vor = (t.has('KeyW') ? 1 : 0) - (t.has('KeyS') ? 1 : 0);
      const seit = (t.has('KeyD') ? 1 : 0) - (t.has('KeyA') ? 1 : 0);
      const g = s.blick;
      // Ohne Richtung rückwärts — der Schritt aus der Gefahr, nicht in sie hinein.
      const [v, sv] = vor === 0 && seit === 0 ? [-1, 0] : [vor, seit];
      const rx = -Math.sin(g) * v + Math.cos(g) * sv;
      const rz = -Math.cos(g) * v - Math.sin(g) * sv;
      if (!setzeRolleAn(s, rx, rz) && (s.phase === 'bereit' || s.phase === 'erholung')) melde('zu erschöpft');
    }
    // Was die Absichten gekostet haben, geht in die gemeinsame Kasse. Nur das.
    ausdauer.current = s.ausdauer;

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
    const ausdauerVorher = ausdauer.current;
    const ereignisse: Treffer[] = los.current ? simuliere(w, dt, schiebe) : [];
    // Die Simulation erholt die Ausdauer mit — verworfen, siehe Kopfkommentar.
    s.ausdauer = ausdauerVorher;
    p.x = s.x; p.z = s.z;
    gesperrt.current = !frei(s) || s.phase === 'gefallen';

    for (const e of ereignisse) {
      if (e.auf === 'spielerin') {
        if (!e.ausgewichen && e.schaden > 0) zaehler.current.getroffen++;
        if (e.ausgewichen) melde('ausgewichen');
        else if (e.toedlich) melde('gefallen');
        else if (e.gebrochen) melde('Haltung gebrochen');
      } else {
        const i = w.gegner.findIndex(g => g.id === e.auf);
        if (i >= 0 && !e.ausgewichen) zeichnung.puppen[i].blitz = jetzt;
        if (e.toedlich) melde('besiegt');
        else if (e.gebrochen) melde('er taumelt');
      }
    }

    // ---- Übungsplatz neu aufstellen
    const vorbei = s.phase === 'gefallen' || w.gegner.every(g => g.phase === 'gefallen');
    if (vorbei && ende.current === null) ende.current = jetzt;
    if (ende.current !== null && jetzt - ende.current > NEUSTART * 1000) {
      welt.current = baueWelt(p.x, p.z, gier.current);
      ruesteAus(welt.current.spielerin, waffeWahl.current);
      ende.current = null;
      melde('neue Runde');
    }

    // ---- Zeichnen
    w.gegner.forEach((g, i) => zeichnePuppe(zeichnung.puppen[i], g, feld, jetzt));
    const sw = zeichnung.schwung;
    sw.position.set(s.x, hoeheAufFlaeche(feld, s.x, s.z) + 0.05, s.z);
    sw.rotation.y = s.blick;
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
      const sw = s.werte;
      figur.current = {
        phase: s.phase, schwung: s.schwung, rollen: z.rollen, getroffen: z.getroffen,
        schlagDauer: sw.schlag.vorlauf + sw.schlag.aktiv + sw.schlag.erholung,
        rolleDauer: sw.rolle.dauer,
        rolleBlick: s.rolleX !== 0 || s.rolleZ !== 0 ? Math.atan2(-s.rolleX, -s.rolleZ) : null,
        // Gefallen gibt es nichts mehr zu rahmen — die Kamera geht zurück hinter die Figur.
        fokus: zk && s.phase !== 'gefallen' ? { x: zk.x, y: zk.y + zk.werte.hoehe * 0.7, z: zk.z } : null,
        zeit: s.zeit,
        vorlauf: sw.schlag.vorlauf, aktiv: sw.schlag.aktiv, erholung: sw.schlag.erholung,
        waffe: s.waffe ?? 'klinge',
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
        protokoll: w.gegner.map(g => `${g.id === w.recht ? '*' : ''}${g.phase}@${Math.hypot(g.x - s.x, g.z - s.z).toFixed(1)}`).join(' '),
        meldung: los.current ? meldung.current.text : 'eine Taste — die Übung beginnt',
        meldungSeit: los.current ? meldung.current.seit : 0,
        waffe: WAFFEN[s.waffe ?? 'klinge'].name,
        ruhig: !los.current,
      };
    }
  });

  return <primitive object={zeichnung.wurzel} />;
}

function zeichnePuppe(pu: Puppe, g: Kaempfer, feld: HoehenFeld, jetzt: number): void {
  g.y = hoeheAufFlaeche(feld, g.x, g.z);
  pu.gruppe.position.set(g.x, g.y, g.z);
  pu.gruppe.rotation.y = g.blick;
  const m = pu.koerper.material;
  const s = g.werte.schlag;
  m.emissive.setRGB(0, 0, 0);
  pu.bogen.material.opacity = 0;
  pu.gruppe.rotation.x = 0;
  pu.gruppe.visible = true;

  if (g.phase === 'vorlauf') {
    // Das Telegraf: Der Bogen am Boden füllt sich, der Körper glüht auf. Beides wächst mit dem
    // Vorlauf — wer das Aufglühen sieht, weiss, wie viel Zeit bleibt.
    const t = Math.min(1, g.zeit / s.vorlauf);
    pu.bogen.material.opacity = 0.08 + 0.32 * t;
    m.emissive.copy(FARBE.telegraf).multiplyScalar(0.15 + 0.6 * t * t);
  } else if (g.phase === 'aktiv') {
    pu.bogen.material.opacity = 0.65;
    m.emissive.copy(FARBE.telegraf).multiplyScalar(1.0);
  } else if (g.phase === 'betaeubt') {
    m.emissive.copy(FARBE.taumeln).multiplyScalar(0.5);
    pu.gruppe.rotation.x = 0.18;
  } else if (g.phase === 'gefallen') {
    const t = Math.min(1, g.zeit / 0.6);
    pu.gruppe.rotation.x = t * Math.PI / 2;
    pu.gruppe.position.y = g.y - t * 0.35;
  }
  // Aufblitzen beim Treffer — 120 ms, über allem anderen.
  if (jetzt - pu.blitz < 120) m.emissive.copy(FARBE.treffer).multiplyScalar(0.9);
}
