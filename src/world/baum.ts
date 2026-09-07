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
import { PALETTE } from './palette.js';
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
    // Heller als der erste Wurf. #1f3324 war im Nebel eine schwarze Wand — ein
    // Nadelwald ist dunkel, aber er hat Binnenzeichnung. Die Spreizung zwischen den
    // beiden Tönen ist wichtiger als ihre Helligkeit: Sie macht aus der Fläche Volumen.
    stammFarbe: PALETTE.baum.fichteStamm, laubFarbe: PALETTE.baum.fichteLaub, laubFarbe2: PALETTE.baum.fichteLaub2,
  },
  /**
   * Buche — am 26.08.2026 neu gesetzt, weil sie im Spiel wie ein Mast aussah.
   *
   * Rückmeldung vom Gerät: „die Bäume sollen so aussehen?“, mit einem Bild von
   * einem 17 m hohen Stab, an dessen Spitze ein paar Klumpen ein V bildeten.
   * Zutreffend, und die Zahlen sagen warum: `astWinkel: 46` heißt gemessen von
   * der Senkrechten, die Äste stiegen also steiler als sie ausladeten
   * (sin 0,72 zu cos 0,69). Dazu Astlängen von 1,2 bis 2,3 m an einem 17-m-Baum
   * — eine Krone von gut 2 m Radius auf einem 10 m hohen Schaft.
   *
   * Eine freistehende Rotbuche ist ungefähr **so breit wie hoch**. Jetzt:
   * `astWinkel: 74` (die Äste laden aus, statt zu steigen), Beastung ab 48 %
   * statt 55 %, und 6 Quirle zu 5 Ästen statt 4 zu 4. Kostet 1.102 → rund 2.000
   * Dreiecke, also etwa so viel wie die Fichte mit 2.152 — und die stand nie zur
   * Debatte, weil sie ihre Form hatte.
   */
  buche: {
    hoehe: 17, fussRadius: 0.42, beastungAb: 0.48, astWinkel: 74,
    quirle: 6, jeQuirl: 5, laub: 0.95,
    stammFarbe: PALETTE.baum.bucheStamm, laubFarbe: PALETTE.baum.bucheLaub, laubFarbe2: PALETTE.baum.bucheLaub2,
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

/**
 * Helligkeit über die Baumhöhe.
 *
 * Ein Baum ist innen dunkel. Die unteren Äste stehen im Schatten der oberen, der
 * Stammfuß im Schatten von allem, und die Spitze bekommt den vollen Himmel — das
 * ist der stärkste Hinweis darauf, dass ein Baum ein Körper ist und keine grüne
 * Fläche. `baueBaum` hat bis hierher jedes Teil in **einer** flachen Farbe
 * eingefärbt: Eine Fichte war ein einfarbiger Kegel, und man sah es ihr an.
 *
 * Von 0,70 am Boden auf 1,12 an der Spitze. Deutlich mehr als der Verlauf an den
 * Kleinprops (0,88 → 1,06), weil ein 22-m-Baum diese Spanne wirklich hat, während
 * ein 30-cm-Grasbüschel sie nicht haben kann.
 */
const verlauf = (t: number) => 0.70 + 0.42 * Math.min(1, Math.max(0, t));

/**
 * Färbt ein Teil, legt fest, wie stark der Wind daran zieht, und dunkelt es nach
 * unten ab.
 *
 * `wind` ist der Grund, warum ein Baum sich bewegen kann, ohne dass der Stamm
 * mitwackelt: 0 am Stamm, 1 in der Krone. Das Attribut wandert durch die
 * Verschmelzung hindurch bis in den Vertex-Shader.
 *
 * `hoehe` ist die Gesamthöhe des Baums. Sie muss übergeben werden, weil jedes Teil
 * bereits an seinen Platz verschoben ist, wenn es hier ankommt — die y-Werte sind
 * damit schon Baumkoordinaten und brauchen nur den Bezug. Ohne `hoehe` bleibt die
 * Farbe flach, so dass ein Aufrufer, der keinen Verlauf will, keinen bekommt.
 */
function faerbe(
  g: THREE.BufferGeometry, farbe: THREE.Color, wind = 0, hoehe = 0,
): THREE.BufferGeometry {
  const roh = g.index ? g.toNonIndexed() : g;
  const pos = roh.getAttribute('position');
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const wnd = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = hoehe > 0 ? verlauf(pos.getY(i) / hoehe) : 1;
    col[i * 3] = farbe.r * s; col[i * 3 + 1] = farbe.g * s; col[i * 3 + 2] = farbe.b * s;
    wnd[i] = wind;
  }
  roh.setAttribute('color', new THREE.BufferAttribute(col, 3));
  roh.setAttribute('aWind', new THREE.BufferAttribute(wnd, 1));
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
/**
 * Detailstufen.
 *
 * Zwei Stufen reichten nicht. Voll gegen Attrappe ist ein Sprung von 872 auf 12
 * Dreiecke — dazwischen liegt der ganze Bereich von 40 bis 120 m, in dem ein Baum
 * noch als Baum zu erkennen sein muss, aber niemand seine Äste zählt. Ohne
 * Mittelstufe hat man die Wahl zwischen zu teuer und zu früh Kegel: Gemessen kostete
 * die volle Auflösung bis 75 m rund 350.000 Dreiecke allein an Vegetation.
 *
 * `mittel` halbiert Quirle und Äste und lässt den Stamm in einem Stück. Das kostet
 * ein Viertel und sieht auf 60 m identisch aus.
 */
export type BaumDetail = 'voll' | 'mittel';

export function baueBaum(
  art: BaumArt, variante = 0, detail: BaumDetail = 'voll',
): THREE.BufferGeometry {
  const roh = BAUM[art];
  const grob = detail === 'mittel';
  // Die Mittelstufe muss deutlich billiger sein, nicht nur etwas. Erster Versuch
  // (Quirle halbiert, ein Ast weniger) landete bei ~330 Dreiecken und war damit auf
  // dem Waldstandort der groesste Einzelposten. Jetzt drei Quirle zu zwei Aesten.
  // Die Mittelstufe muss deutlich billiger sein — aber nicht so billig, dass sie
  // die Form verliert. 3 Quirle zu 2 Ästen ergaben bei der Fichte **174 Dreiecke**,
  // und das ist im Bild ein Stab mit sechs Klumpen, kein Kegel. Sie deckt 45 bis
  // 110 m ab (`sichtweiten.ts`), und bei 45 m füllt eine 24-m-Fichte ein Drittel
  // der Bildhöhe. 4 zu 3 mit größerem Laub kostet etwa doppelt so viel und behält
  // die Silhouette, um die es in dieser Stufe allein geht.
  const w: BaumWerte = grob
    ? { ...roh, quirle: 4, jeQuirl: 3, laub: roh.laub * 1.35 }
    : roh;
  const zufall = mulberry(art.charCodeAt(0) * 7919 + variante * 104729);
  const teile: THREE.BufferGeometry[] = [];

  const stammFarbe = new THREE.Color(w.stammFarbe);
  const laubA = new THREE.Color(w.laubFarbe);
  const laubB = new THREE.Color(w.laubFarbe2);

  const hoehe = w.hoehe * (0.82 + zufall() * 0.36);
  const stammHoehe = art === 'fichte' ? hoehe : hoehe * 0.62;

  // Stamm in drei Abschnitten: unten dick, oben dünn. Bei der Fichte läuft er bis
  // in die Spitze durch — das ist der Unterschied zwischen Nadelbaum und Laubbaum.
  const abschnitte = grob ? 1 : 3;
  for (let i = 0; i < abschnitte; i++) {
    const t0 = i / abschnitte, t1 = (i + 1) / abschnitte;
    const r0 = w.fussRadius * (1 - t0 * 0.85);
    const r1 = w.fussRadius * (1 - t1 * 0.85);
    const g = new THREE.CylinderGeometry(r1, r0, stammHoehe / abschnitte, grob ? 4 : 5, 1, true);
    g.translate(0, stammHoehe * (t0 + t1) / 2, 0);
    // Der Stamm bewegt sich nicht — oben minimal, damit die Spitze nicht abknickt.
    teile.push(faerbe(g, stammFarbe, t1 * t1 * 0.12, hoehe));
  }

  if (art === 'buche') {
    // Zwei Starkäste als Gabelung — der Schirm der Buche beginnt oben am Schaft.
    for (const seite of [-1, 1]) {
      // 0,20 statt 0,30 der Baumhöhe und tiefer angesetzt: Mit den alten Werten
      // reichten die beiden Starkäste bis auf 102 % der Baumhöhe und standen als
      // zwei haardünne Striche über der Krone — im Bild die Antennen, die einen
      // Baum wie einen Mast aussehen lassen. Jetzt enden sie bei 86 %, also innen.
      const g = new THREE.CylinderGeometry(0.09, w.fussRadius * 0.4, hoehe * 0.20, 4, 1, true);
      g.rotateZ(seite * 0.42);
      g.translate(seite * hoehe * 0.05, stammHoehe + hoehe * 0.06, 0);
      teile.push(faerbe(g, stammFarbe, 0.3, hoehe));
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
    // Fichte: nach oben kürzer — Kegel. Buche: nach oben länger — Schirm.
    // Der Buchenfaktor war 0,16 und ergab an einem 17-m-Baum eine Krone von 2,3 m
    // Radius. Eine freistehende Buche trägt eine Krone von rund einem Drittel
    // ihrer Höhe je Seite; 0,34 trifft das, ohne dass die Äste sich kreuzen.
    const laenge = art === 'fichte'
      ? hoehe * 0.30 * (1 - t * 0.88) + 0.4
      // Kuppel statt Trichter: Die Länge kulminiert bei etwa 55 % der Krone und
      // fällt zur Spitze wieder ab. Eine monoton steigende Länge (erster Versuch,
      // `0.5 + t * 0.75`) macht die Krone oben am breitesten — im Bild ein
      // Trichter mit hohlem Kern, nicht die geschlossene Kuppel einer Buche.
      : hoehe * 0.34 * (0.45 + 0.75 * Math.sin(Math.PI * (0.25 + t * 0.7)));
    const dreh = zufall() * Math.PI * 2;

    for (let a = 0; a < w.jeQuirl; a++) {
      const phi = dreh + (a / w.jeQuirl) * Math.PI * 2 + (zufall() - 0.5) * 0.5;
      const nick = winkel + (zufall() - 0.5) * 0.35;
      const dx = Math.cos(phi), dz = Math.sin(phi);

      // Im groben Zustand tragen die Aeste kein eigenes Volumen mehr — nur das Laub
      // zaehlt auf Entfernung, und ein Ast ohne Laub ist ein Strich.
      /**
       * Der Ast zeigt dorthin, wo sein Laub liegt — mit **derselben** Rechnung.
       *
       * Bis zum 26.08.2026 standen hier zwei verschiedene Auslegungen desselben
       * Winkels: Der Ast wurde um `π/2 − nick` gekippt, das Laub aber über
       * `sin(nick)` waagerecht und `cos(nick)` senkrecht gesetzt. Das sind
       * komplementäre Winkel — sie stimmen nur bei genau 45° überein. Bei der
       * Fichte (108°) fiel es nicht auf, weil die flach gedrückten Laubballen die
       * Äste verdecken; bei der Buche standen die Äste fast senkrecht aus einer
       * waagerecht ausgebreiteten Krone heraus, als haardünne Antennen. Genau die
       * hat Flo im Bild gesehen.
       *
       * Statt den Winkel ein zweites Mal auszulegen, wird die Richtung einmal
       * gebildet und beides daraus abgeleitet. Zwei Auslegungen derselben Zahl
       * sind zwei Wahrheiten, und die driften.
       */
      const richtung = new THREE.Vector3(
        dx * Math.sin(nick), Math.cos(nick), dz * Math.sin(nick),
      ).normalize();
      const ast = new THREE.CylinderGeometry(0.015, 0.05, laenge, 3, 1, true);
      ast.translate(0, laenge / 2, 0);
      ast.applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), richtung));
      ast.translate(0, y, 0);
      // Äste biegen sich mit, aber weniger als das Laub an ihrem Ende.
      teile.push(faerbe(ast, stammFarbe, 0.45 + t * 0.3, hoehe));

      // Laub entlang des Astes. Flach gedrückt, damit die Silhouette waagerecht
      // liest — bei Nadelbäumen ist genau das die erkennbare Form.
      //
      // **Drei Ballen statt einem, aber nur in der Nahstufe.** Ein einzelner Ballen
      // je Ast liest als Silhouette gut und aus drei Metern Entfernung wie ein
      // Felsblock: Ein Ikosaeder mit 3 m Radius ist kein Zweig. Die alte Fassung
      // hatte diese Sparsamkeit begründet — gemessen kostete die dichte Variante
      // damals 2.570 Dreiecke je Fichte gegen ein Budget von 400.000, das selbst
      // nie gemessen war (G-18). Inzwischen läuft die Szene stabil bei 60 B/s und
      // liegt je Kamera zwischen 106.000 und 140.000 Dreiecken. Der Kopfraum gehört
      // dorthin, wo man ihn sieht.
      //
      // Drei kleinere statt einem großen, nicht drei große: Der Ballen schrumpft auf
      // 72 % und wandert über die Astlänge, mit seitlichem Versatz, damit keine
      // Perlenkette entsteht. Das Volumen bleibt ähnlich, die Silhouette wird
      // zerfranst statt glatt — genau der Unterschied zwischen Laub und Findling.
      // Die Mittelstufe behält den einen Ballen: Ab 90 m ist die Zerfransung kleiner
      // als ein Pixel und der Kegel entscheidet.
      const ballen = grob ? (art === 'fichte' ? 1 : 2) : 3;
      const quer = ballen > 1 ? laenge * 0.16 : 0;
      for (let b = 0; b < ballen; b++) {
        const s = (ballen === 1 ? 0.62 : 0.30 + 0.62 * (b / (ballen - 1))) * w.laub;
        const r = laenge * s;
        const groesse = laenge * (art === 'fichte' ? 0.46 : 0.44)
          * (ballen === 1 ? 1 : 0.72) * (1 - b * 0.14);
        const kugel = new THREE.IcosahedronGeometry(groesse, 0);
        kugel.scale(1, art === 'fichte' ? 0.55 : 0.8, 1);
        // Versatz quer zum Ast — sonst liegen die drei Ballen auf einer Linie und
        // die Krone bekommt Speichen statt Masse.
        const v = (zufall() - 0.5) * quer;
        kugel.translate(
          dx * r * Math.sin(nick) - dz * v,
          y + Math.cos(nick) * r + (zufall() - 0.5) * 0.2,
          dz * r * Math.sin(nick) + dx * v,
        );
        // Volles Windattribut: Laub ist das, was sich sichtbar bewegt.
        teile.push(faerbe(kugel, zufall() < 0.5 ? laubA : laubB, 0.85 + t * 0.15, hoehe));
      }
    }
  }

  if (art === 'fichte') {
    // Spitze — ohne sie sieht die Fichte oben abgeschnitten aus.
    const spitze = new THREE.ConeGeometry(hoehe * 0.045, hoehe * 0.13, 5);
    spitze.translate(0, hoehe * 0.955, 0);
    teile.push(faerbe(spitze, laubA, 1, hoehe));
  }

  const g = mergeGeometries(teile, false);
  if (!g) throw new Error(`Baum ${art}: Geometrien ließen sich nicht zusammenfassen`);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
