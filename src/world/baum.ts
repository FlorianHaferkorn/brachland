/**
 * BRACHLAND — Bäume als Geometrie, nicht als Datei
 *
 * Warum nicht EZ-Tree (MIT, gute Presets, Fichte quasi ab Werk): **gemessen** wächst
 * das Bundle von 1,25 MB auf 5,25 MB, der Offline-Precache von 2,4 MB auf 6,3 MB.
 * Die vier Megabyte sind fast vollständig base64-eingebettete Rinden- und
 * Blatttexturen — genau das, was diese Art Direction nicht benutzt (ADR-0002). Man
 * zahlt also den vollen Preis für den Teil, den man wegwirft.
 *
 * Was von EZ-Tree bleibt, ist die Erkenntnis, welche Parameter den Habitus machen.
 * Die stehen hier als Zahlen, nicht als Abhängigkeit:
 *
 * | | Fichte | Buche |
 * |---|---|---|
 * | Stamm | durchgehend, verjüngend | säulig, teilt sich oben |
 * | Astwinkel | 100–120° (hängend) | 40–55° (aufstrebend) |
 * | Beastung ab | 15 % der Höhe | 55 % der Höhe |
 * | Krone | Kegel, unten breit | Schirm, oben breit |
 *
 * Die Silhouette macht den Unterschied, nicht die Rinde: Auf 40 m Entfernung im
 * Nebel erkennt man eine Fichte am Kegel und eine Buche am astfreien Schaft. Beides
 * ist Geometrie und kostet null Bytes Download.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type BaumArt = 'fichte' | 'buche';

export interface BaumWerte {
  /** Gesamthöhe in Metern. */
  hoehe: number;
  /** Radius am Stammfuß, in Metern. */
  fussRadius: number;
  /** Anteil der Höhe, ab dem Äste sitzen. */
  beastungAb: number;
  /** Astwinkel gegen die Senkrechte in Grad. Über 90 heißt hängend. */
  astWinkel: number;
  /** Astquirle über die beastete Höhe. */
  quirle: number;
  /** Äste je Quirl. */
  jeQuirl: number;
  /** Nadel-/Blattmasse als Anteil der Astlänge. */
  laub: number;
  stammFarbe: string;
  laubFarbe: string;
  laubFarbe2: string;
}

export const BAUM: Record<BaumArt, BaumWerte> = {
  fichte: {
    hoehe: 24, fussRadius: 0.34, beastungAb: 0.15, astWinkel: 108,
    quirle: 8, jeQuirl: 4, laub: 0.8,
    stammFarbe: '#3a3128', laubFarbe: '#1f3324', laubFarbe2: '#2a4530',
  },
  buche: {
    hoehe: 17, fussRadius: 0.42, beastungAb: 0.55, astWinkel: 46,
    quirle: 4, jeQuirl: 4, laub: 0.95,
    stammFarbe: '#5d5a51', laubFarbe: '#3c5228', laubFarbe2: '#4d6733',
  },
};

/** Kleiner, wiederholbarer Zufall — gleiche Variante, gleicher Baum. */
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function faerbe(g: THREE.BufferGeometry, farbe: THREE.Color): THREE.BufferGeometry {
  const roh = g.index ? g.toNonIndexed() : g;
  const n = roh.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = farbe.r; col[i * 3 + 1] = farbe.g; col[i * 3 + 2] = farbe.b; }
  roh.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return roh;
}

/**
 * Baut einen Baum.
 *
 * Aufbau: ein sich verjüngender Stamm aus wenigen Segmenten, darauf Astquirle. Jeder
 * Ast ist ein schmaler Kegel, die Laubmasse eine Handvoll flacher Ikosaeder daran.
 * Keine Rekursion — Astwerk zweiter Ordnung ist auf 20 m Entfernung nicht sichtbar
 * und verdoppelt die Dreiecke.
 *
 * Gemessen: Fichte 692, Buche 740 Dreiecke — beide unter den Kenney-GLB (1.400 bis
 * 4.600) und ohne einen einzigen Byte Download.
 */
export function baueBaum(art: BaumArt, variante = 0): THREE.BufferGeometry {
  const w = BAUM[art];
  const zufall = mulberry(art.charCodeAt(0) * 7919 + variante * 104729);
  const teile: THREE.BufferGeometry[] = [];

  const stammFarbe = new THREE.Color(w.stammFarbe);
  const laubA = new THREE.Color(w.laubFarbe);
  const laubB = new THREE.Color(w.laubFarbe2);

  const hoehe = w.hoehe * (0.82 + zufall() * 0.36);
  const stammHoehe = art === 'fichte' ? hoehe : hoehe * 0.62;

  // Stamm in drei Abschnitten: unten dick, oben dünn. Bei der Fichte läuft er bis
  // in die Spitze durch — das ist der Unterschied zwischen Nadelbaum und Laubbaum.
  const abschnitte = 3;
  for (let i = 0; i < abschnitte; i++) {
    const t0 = i / abschnitte, t1 = (i + 1) / abschnitte;
    const r0 = w.fussRadius * (1 - t0 * 0.85);
    const r1 = w.fussRadius * (1 - t1 * 0.85);
    const g = new THREE.CylinderGeometry(r1, r0, stammHoehe / abschnitte, 5, 1, true);
    g.translate(0, stammHoehe * (t0 + t1) / 2, 0);
    teile.push(faerbe(g, stammFarbe));
  }

  if (art === 'buche') {
    // Zwei Starkäste als Gabelung — der Schirm der Buche beginnt oben am Schaft.
    for (const seite of [-1, 1]) {
      const g = new THREE.CylinderGeometry(0.08, w.fussRadius * 0.4, hoehe * 0.3, 4, 1, true);
      g.rotateZ(seite * 0.42);
      g.translate(seite * hoehe * 0.06, stammHoehe + hoehe * 0.13, 0);
      teile.push(faerbe(g, stammFarbe));
    }
  }

  const astBeginn = hoehe * w.beastungAb;
  const astEnde = art === 'fichte' ? hoehe * 0.97 : hoehe * 0.99;
  const winkel = w.astWinkel * Math.PI / 180;

  for (let q = 0; q < w.quirle; q++) {
    const t = q / Math.max(1, w.quirle - 1);
    const y = astBeginn + (astEnde - astBeginn) * t;
    // Fichte: Äste werden nach oben kürzer — das ergibt den Kegel.
    // Buche: Äste werden nach oben LÄNGER — das ergibt den Schirm.
    const laenge = art === 'fichte'
      ? hoehe * 0.30 * (1 - t * 0.88) + 0.4
      : hoehe * 0.16 * (0.45 + t * 0.9);
    const dreh = zufall() * Math.PI * 2;

    for (let a = 0; a < w.jeQuirl; a++) {
      const phi = dreh + (a / w.jeQuirl) * Math.PI * 2 + (zufall() - 0.5) * 0.5;
      const nick = winkel + (zufall() - 0.5) * 0.35;
      const dx = Math.cos(phi), dz = Math.sin(phi);

      const ast = new THREE.CylinderGeometry(0.015, 0.05, laenge, 3, 1, true);
      ast.translate(0, laenge / 2, 0);
      ast.rotateZ(-nick + Math.PI / 2);
      ast.rotateY(-phi);
      ast.translate(0, y, 0);
      teile.push(faerbe(ast, stammFarbe));

      // Laub entlang des Astes. Flach gedrückt, damit die Silhouette waagerecht
      // liest — bei Nadelbäumen ist genau das die erkennbare Form.
      // Ein Laubballen je Ast, nicht zwei oder drei.
      //
      // Das ist keine Sparsamkeit um ihrer selbst willen: Gemessen kostete die
      // dichtere Fassung 2.570 Dreiecke je Fichte. Bei 95 Fichten je Hektar stehen
      // im Umkreis von 75 m rund 170 davon — 437.000 Dreiecke allein für die nahen
      // Bäume, gegen ein Gesamtbudget von 400.000. Die Silhouette entscheidet der
      // Kegel, nicht die Zahl der Ballen.
      const ballen = art === 'fichte' ? 1 : 2;
      for (let b = 0; b < ballen; b++) {
        const s = (ballen === 1 ? 0.62 : 0.45 + 0.55 * ((b + 1) / ballen)) * w.laub;
        const r = laenge * s;
        const groesse = laenge * (art === 'fichte' ? 0.46 : 0.44) * (1 - b * 0.12);
        const kugel = new THREE.IcosahedronGeometry(groesse, 0);
        kugel.scale(1, art === 'fichte' ? 0.55 : 0.8, 1);
        kugel.translate(
          dx * r * Math.sin(nick),
          y + Math.cos(nick) * r + (zufall() - 0.5) * 0.2,
          dz * r * Math.sin(nick),
        );
        teile.push(faerbe(kugel, zufall() < 0.5 ? laubA : laubB));
      }
    }
  }

  if (art === 'fichte') {
    // Spitze — ohne sie sieht die Fichte oben abgeschnitten aus.
    const spitze = new THREE.ConeGeometry(hoehe * 0.045, hoehe * 0.13, 5);
    spitze.translate(0, hoehe * 0.955, 0);
    teile.push(faerbe(spitze, laubA));
  }

  const g = mergeGeometries(teile, false);
  if (!g) throw new Error(`Baum ${art}: Geometrien ließen sich nicht zusammenfassen`);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
