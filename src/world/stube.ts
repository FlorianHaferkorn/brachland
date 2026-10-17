/**
 * BRACHLAND — Häuser von innen (D242, G-36)
 *
 * Die Häuser der Welt sind Körper ohne Innenleben: Die Tür ist aufgemalt, die Kollision ein
 * volles Rechteck, und D151 sagt, dass sich Welthäuser nicht als Innenraum eignen. Deshalb kein
 * Betreten, sondern ein **eigener kleiner Raum** hinter dem Ortsfenster — wie Kampfbühne und
 * Heldeneditor ein eigener Canvas. Die Welt steht still, solange er offen ist.
 *
 * Der Raum folgt aus Daten: `Ort.innen` nennt die Art (Stube, Wirtsstube, Stadel, Schuppen,
 * Werkstatt), die Ort-Id ist die Saat. Gebaut wird aus Kisten mit Vertexfarbe, ohne Normalen und
 * UV (D107, flach schattiert) — dieselbe Bauweise wie die Attrappen. Die Vorderwand fehlt: Dort
 * steht die Kamera, in der Tür.
 *
 * Reines three.js ohne React; `tests/stube.test.ts` baut jede Art und prüft Masse und Anker.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from './palette.js';
import { mulberry } from './props.js';

export type InnenArt = 'stube' | 'wirtsstube' | 'stadel' | 'schuppen' | 'werkstatt';

/** Breite (x), Tiefe (z), Höhe — in Metern. Eine Stube ist eng, ein Stadel hoch. */
export const RAUM: Record<InnenArt, { b: number; t: number; h: number }> = {
  stube: { b: 5.2, t: 4.4, h: 2.4 },
  wirtsstube: { b: 8, t: 6, h: 2.8 },
  stadel: { b: 7, t: 5.5, h: 3.6 },
  schuppen: { b: 4.2, t: 3.4, h: 2.4 },
  werkstatt: { b: 6, t: 4.6, h: 3 },
};

export interface Stubenbau {
  geometrie: THREE.BufferGeometry;
  /** Fensteröffnung in der Rückwand: Mitte und Grösse. Die Scheibe zeichnet die Szene. */
  fenster: { mitte: [number, number, number]; breite: number; hoehe: number };
  /** Glutpunkt (Ofen, Esse, Laterne) — dort sitzt das flackernde Licht. */
  glut: [number, number, number];
  /** Wo der Bewohner steht und wohin er schaut (Radiant um y, 0 = zur Tür). */
  figur: { ort: [number, number, number]; drehung: number };
  /** Kamera in der Tür und ihr Blickpunkt. */
  kamera: { ort: [number, number, number]; ziel: [number, number, number] };
}

const S = PALETTE.stube;

/** Saat aus der Ort-Id — derselbe Raum bei jedem Öffnen. */
function saat(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function baueStube(art: InnenArt, id: string): Stubenbau {
  const rnd = mulberry(saat(id));
  const { b, t, h } = RAUM[art];
  const teile: THREE.BufferGeometry[] = [];
  const c = new THREE.Color();

  /** Kiste mit Unterkante bei y, leicht gestreuter Farbe (kein Teil gleicht dem anderen). */
  const kiste = (bx: number, by: number, bz: number, x: number, y: number, z: number,
                 hex: string, dreh = 0, streu = 0.06) => {
    const g = new THREE.BoxGeometry(bx, by, bz).toNonIndexed();
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g.rotateY(dreh);
    g.translate(x, y + by / 2, z);
    c.set(hex).multiplyScalar(1 + (rnd() - 0.5) * streu);
    const n = g.getAttribute('position').count, f = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { f[i * 3] = c.r; f[i * 3 + 1] = c.g; f[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(f, 3));
    teile.push(g);
  };

  const holzwand = art === 'stadel' || art === 'schuppen';
  const D = 0.12;   // Wandstärke

  // ---- Boden: Dielen längs, im Stadel und Schuppen gestampfte Erde mit Brettern.
  if (holzwand) {
    kiste(b, 0.04, t, 0, -0.04, 0, S.erde, 0, 0);
    for (let x = -b / 2 + 0.6; x < b / 2 - 0.4; x += 1.1 + rnd() * 0.6)
      kiste(0.26, 0.03, t * (0.5 + rnd() * 0.3), x, 0, -t * 0.05, S.holzDunkel, (rnd() - 0.5) * 0.08);
  } else {
    for (let x = -b / 2; x < b / 2 - 0.01; x += 0.2)
      kiste(Math.min(0.2, b / 2 - x) - 0.008, 0.03, t, x + 0.1, -0.03, 0, rnd() < 0.5 ? S.diele : S.holzHell, 0, 0.1);
  }

  // ---- Wände: Rückwand mit Fenster, zwei Seitenwände. Unten Täfer, oben Putz — ausser im
  // Stadel und Schuppen, dort waagerechte Bretter bis unters Dach.
  const fb = art === 'wirtsstube' ? 1.3 : 0.95, fh = 0.85, fu = 1.05;
  const fx = b * 0.18;
  const wand = (lange: number, x: number, z: number, dreh: number, mitFenster: boolean) => {
    const stueck = (von: number, bis: number, unten: number, oben: number) => {
      const w = bis - von, m = (von + bis) / 2;
      if (w <= 0.01 || oben - unten <= 0.01) return;
      const ox = Math.cos(dreh) * m, oz = -Math.sin(dreh) * m;
      if (holzwand) {
        for (let y = unten; y < oben - 0.01; y += 0.24)
          kiste(w, Math.min(0.235, oben - y), D, x + ox, y, z + oz, rnd() < 0.5 ? S.holzDunkel : S.balken, dreh, 0.12);
      } else {
        const taefer = 1.0;
        if (unten < taefer) kiste(w, Math.min(oben, taefer) - unten, D, x + ox, unten, z + oz, S.holzHell, dreh);
        if (oben > taefer) kiste(w, oben - Math.max(unten, taefer), D, x + ox, Math.max(unten, taefer), z + oz, S.putz, dreh, 0.03);
      }
    };
    if (!mitFenster) { stueck(-lange / 2, lange / 2, 0, h); return; }
    stueck(-lange / 2, fx - fb / 2, 0, h);
    stueck(fx + fb / 2, lange / 2, 0, h);
    stueck(fx - fb / 2, fx + fb / 2, 0, fu);
    stueck(fx - fb / 2, fx + fb / 2, fu + fh, h);
    // Fensterrahmen und Kreuz.
    for (const [bx, by, x2, y2] of [[fb + 0.1, 0.07, 0, fu - 0.07], [fb + 0.1, 0.07, 0, fu + fh], [0.07, fh, -fb / 2 - 0.035, fu], [0.07, fh, fb / 2 + 0.035, fu],
                                    [0.04, fh, 0, fu], [fb, 0.04, 0, fu + fh / 2 - 0.02]] as const)
      kiste(bx, by, D + 0.04, x + Math.cos(dreh) * (fx + x2), y2, z - Math.sin(dreh) * (fx + x2), S.balken, dreh, 0);
  };
  wand(b + D, 0, -t / 2, 0, true);
  wand(t, -b / 2, 0, Math.PI / 2, false);
  wand(t, b / 2, 0, -Math.PI / 2, false);

  // ---- Decke: dunkle Fläche, darunter Balken quer. Der Stadel ist zum Dach offen: nur Balken.
  if (art !== 'stadel') kiste(b + D, 0.05, t, 0, h, 0, S.balken, 0, 0);
  for (let z = -t / 2 + 0.5; z < t / 2; z += art === 'stadel' ? 1.3 : 0.9)
    kiste(b, 0.16, 0.14, 0, h - 0.16, z, S.balken, 0, 0.1);

  // ---- Einrichtung je Art. `glut` und `figur` werden hier gesetzt.
  let glut: [number, number, number] = [-b / 2 + 0.6, 0.5, -t / 2 + 0.6];
  let figur: Stubenbau['figur'] = { ort: [b * 0.12, 0, -t * 0.05], drehung: 0 };

  const tisch = (x: number, z: number, lang = 1.4, tief = 0.8, dreh = 0) => {
    kiste(lang, 0.06, tief, x, 0.72, z, S.holzHell, dreh);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const lx = dx * (lang / 2 - 0.08), lz = dz * (tief / 2 - 0.08);
      kiste(0.07, 0.72, 0.07, x + Math.cos(dreh) * lx + Math.sin(dreh) * lz, 0, z - Math.sin(dreh) * lx + Math.cos(dreh) * lz, S.holzDunkel, dreh);
    }
  };
  const bank = (x: number, z: number, lang: number, dreh = 0) => {
    kiste(lang, 0.05, 0.3, x, 0.42, z, S.holzDunkel, dreh);
    kiste(0.05, 0.42, 0.26, x - Math.cos(dreh) * (lang / 2 - 0.1), 0, z + Math.sin(dreh) * (lang / 2 - 0.1), S.holzDunkel, dreh);
    kiste(0.05, 0.42, 0.26, x + Math.cos(dreh) * (lang / 2 - 0.1), 0, z - Math.sin(dreh) * (lang / 2 - 0.1), S.holzDunkel, dreh);
  };
  const ofen = (x: number, z: number) => {
    kiste(0.95, 0.25, 0.95, x, 0, z, S.stein);
    kiste(0.85, 0.95, 0.85, x, 0.25, z, S.kachel, 0, 0.04);
    kiste(0.95, 0.08, 0.95, x, 1.2, z, S.stein);
    kiste(0.22, h - 1.28, 0.22, x - 0.2, 1.28, z - 0.2, S.kachel);
    // Ofenloch zur Raummitte: die Glut.
    kiste(0.3, 0.22, 0.04, x + 0.2, 0.42, z + 0.43, S.glut, 0, 0);
    return [x + 0.2, 0.55, z + 0.6] as [number, number, number];
  };
  const regal = (x: number, z: number, dreh: number, tassen: number) => {
    for (const y of [1.1, 1.45]) kiste(1.0, 0.035, 0.24, x, y, z, S.holzHell, dreh);
    for (let i = 0; i < tassen; i++) {
      const u = -0.38 + i * (0.76 / Math.max(1, tassen - 1));
      kiste(0.07, 0.08, 0.07, x + Math.cos(dreh) * u, 1.135, z - Math.sin(dreh) * u, i % 3 ? S.ton : S.tuch, dreh, 0.15);
    }
    for (let i = 0; i < 3; i++) kiste(0.14, 0.18, 0.14, x + Math.cos(dreh) * (-0.3 + i * 0.28), 1.485, z - Math.sin(dreh) * (-0.3 + i * 0.28), S.ton, dreh, 0.2);
  };
  const fass = (x: number, z: number, liegend = false) => {
    const g = new THREE.CylinderGeometry(0.28, 0.28, 0.75, 9).toNonIndexed();
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    if (liegend) g.rotateZ(Math.PI / 2);
    g.translate(x, liegend ? 0.28 : 0.375, z);
    const p = g.getAttribute('position'), f = new Float32Array(p.count * 3);
    const holz = new THREE.Color(S.holzHell), reif = new THREE.Color(S.eisen);
    for (let i = 0; i < p.count; i++) {
      const v = liegend ? p.getX(i) - x : p.getY(i) - 0.375;
      const k = Math.abs(Math.abs(v) - 0.24) < 0.05 ? reif : holz;
      f[i * 3] = k.r; f[i * 3 + 1] = k.g; f[i * 3 + 2] = k.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(f, 3));
    teile.push(g);
  };
  const heu = (x: number, z: number, r: number, hoch: number) => {
    for (let i = 0; i < 4; i++)
      kiste(r * (1.6 - i * 0.3), hoch / 4, r * (1.3 - i * 0.22), x + (rnd() - 0.5) * 0.2, i * hoch / 4, z + (rnd() - 0.5) * 0.2,
            i % 2 ? S.heu : S.stroh, rnd() * 0.3, 0.1);
  };

  switch (art) {
    case 'stube': {
      glut = ofen(-b / 2 + 0.6, -t / 2 + 0.6);
      tisch(b * 0.12, -t * 0.12);
      bank(b * 0.12, -t * 0.12 - 0.62, 1.3);
      kiste(0.45, 0.45, 0.45, b * 0.12 + 0.95, 0, -t * 0.12, S.holzDunkel);   // Hocker
      // Bett an der rechten Wand: Gestell, Strohsack, Decke.
      kiste(0.95, 0.35, 1.9, b / 2 - 0.55, 0, -t / 2 + 1.1, S.holzDunkel);
      kiste(0.85, 0.12, 1.8, b / 2 - 0.55, 0.35, -t / 2 + 1.1, S.stroh);
      kiste(0.88, 0.05, 1.1, b / 2 - 0.55, 0.47, -t / 2 + 1.4, S.tuch);
      regal(-b * 0.18, -t / 2 + 0.2, 0, 6);
      figur = { ort: [1.3, 0, 0.35], drehung: -0.35 };   // zwischen Tisch und Bett
      break;
    }
    case 'wirtsstube': {
      glut = ofen(-b / 2 + 0.6, -t / 2 + 0.6);
      // Tresen an der rechten Wand, Fässer dahinter.
      kiste(0.6, 1.05, t * 0.55, b / 2 - 1.3, 0, -t * 0.12, S.holzDunkel);
      kiste(0.75, 0.06, t * 0.55 + 0.1, b / 2 - 1.3, 1.05, -t * 0.12, S.holzHell);
      for (let i = 0; i < 3; i++) fass(b / 2 - 0.4, -t / 2 + 0.7 + i * 0.75, true);
      regal(b / 2 - 0.15, t * 0.22, -Math.PI / 2, 5);
      for (const [x, z] of [[-b * 0.18, -t * 0.12], [-b * 0.18, t * 0.2], [b * 0.08, t * 0.05]]) {
        tisch(x, z, 1.5, 0.85);
        bank(x, z - 0.65, 1.4);
        bank(x, z + 0.65, 1.4);
      }
      figur = { ort: [b / 2 - 2.9, 0, -t * 0.3], drehung: -0.3 };
      break;
    }
    case 'stadel': {
      heu(-b * 0.25, -t * 0.22, 1.3, 1.4);
      heu(b * 0.22, -t * 0.28, 1.1, 1.0);
      heu(-b * 0.32, t * 0.1, 0.8, 0.6);
      // Stützen und eine Leiter zum Heuboden.
      for (const x of [-b * 0.32, b * 0.32]) kiste(0.18, h, 0.18, x, 0, -t * 0.02, S.balken);
      for (let i = 0; i < 2; i++) kiste(0.06, 2.6, 0.06, b * 0.38 + i * 0.4, 0, -t / 2 + 0.35, S.holzDunkel, 0, 0);
      for (let y = 0.3; y < 2.5; y += 0.32) kiste(0.46, 0.04, 0.05, b * 0.38 + 0.2, y, -t / 2 + 0.35, S.holzDunkel);
      // Laterne an der Stütze statt Ofen.
      kiste(0.14, 0.2, 0.14, -b * 0.32 + 0.17, 1.6, -t * 0.02, S.glut, 0, 0);
      glut = [-b * 0.32 + 0.3, 1.7, -t * 0.02 + 0.15];
      break;
    }
    case 'schuppen': {
      heu(-b * 0.22, -t * 0.18, 0.9, 0.45);   // das hereingetragene Stroh
      kiste(0.5, 0.4, 0.5, b * 0.28, 0, -t * 0.3, S.holzDunkel, 0.2);
      kiste(0.45, 0.35, 0.4, b * 0.3, 0.4, -t * 0.32, S.holzHell, -0.1);
      // Die ausgehängte Tür, an die Wand gelehnt.
      kiste(0.85, 1.9, 0.05, b / 2 - 0.2, 0, t * 0.1, S.holzDunkel, -Math.PI / 2 + 0.18);
      // Stiele an der Rückwand.
      for (let i = 0; i < 4; i++) kiste(0.04, 1.3 + rnd() * 0.3, 0.04, -b * 0.05 + i * 0.22, 0, -t / 2 + 0.12, S.holzHell, 0, 0.2);
      kiste(0.14, 0.2, 0.14, -b / 2 + 0.2, 1.5, -t / 2 + 0.25, S.glut, 0, 0);
      glut = [-b / 2 + 0.35, 1.6, -t / 2 + 0.4];
      figur = { ort: [0.2, 0, -t * 0.1], drehung: 0 };
      break;
    }
    case 'werkstatt': {
      // Esse in der Ecke, Amboss davor, Werkbank an der rechten Wand. „Die Esse ist kalt, der
      // Amboss nicht“ (Ortstext): Asche statt Glut, das Licht kommt von der Laterne auf der Bank.
      kiste(1.2, 0.8, 1.0, -b / 2 + 0.7, 0, -t / 2 + 0.6, S.stein);
      kiste(0.7, 0.06, 0.55, -b / 2 + 0.7, 0.8, -t / 2 + 0.6, S.erde, 0, 0);
      kiste(0.9, 1.0, 0.7, -b / 2 + 0.7, h - 1.0, -t / 2 + 0.5, S.stein);
      kiste(0.3, 0.6, 0.3, -b / 2 + 1.7, 0, -t / 2 + 1.5, S.holzDunkel);
      kiste(0.5, 0.18, 0.2, -b / 2 + 1.7, 0.6, -t / 2 + 1.5, S.eisen, 0, 0);
      kiste(0.7, 0.85, t * 0.5, b / 2 - 0.45, 0, -t * 0.1, S.holzDunkel);
      for (let i = 0; i < 5; i++) kiste(0.04, 0.35, 0.04, b / 2 - 0.1, 1.3, -t * 0.3 + i * 0.25, S.eisen, 0, 0.2);
      fass(b * 0.1, -t / 2 + 0.45);
      kiste(0.14, 0.2, 0.14, b / 2 - 0.45, 0.85, -t * 0.3, S.glut, 0, 0);
      glut = [b / 2 - 0.65, 1.15, -t * 0.3];
      figur = { ort: [-b / 2 + 1.75, 0, -t / 2 + 2.15], drehung: 0.3 };
      break;
    }
  }

  const geometrie = mergeGeometries(teile, false)!;
  return {
    geometrie,
    fenster: { mitte: [fx, fu + fh / 2, -t / 2], breite: fb, hoehe: fh },
    glut,
    figur,
    kamera: { ort: [b * 0.08, 1.6, t / 2 + 0.4], ziel: [-b * 0.04, 1.0, -t * 0.2] },
  };
}
