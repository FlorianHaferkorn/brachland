import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface Standort {
  x: number;
  z: number;
  /** Blickrichtung der Vorderseite bzw. des Lampenarms, 0° = Norden (−Z). */
  richtung: number;
  verfall?: number;
}

export type Strassenmobiliar = Standort & (
  | { art: 'strassenname'; text: string; ruecktext?: string }
  | { art: 'tempo'; tempo: number }
  | { art: 'ortstafel'; text: string; ruecktext?: string }
  | { art: 'laterne' }
);

type Art = Strassenmobiliar['art'];
type Schildart = Exclude<Art, 'laterne'>;
const SCHILDER = {
  strassenname: { breite: .92, hoehe: .20, mitte: 2.35, tiefe: .03 },
  tempo: { breite: .60, hoehe: .60, mitte: 2.36, tiefe: .024 },
  ortstafel: { breite: .90, hoehe: .60, mitte: 2.28, tiefe: .034 },
} satisfies Record<Schildart, { breite: number; hoehe: number; mitte: number; tiefe: number }>;
const RAHMEN_Z = .061;
const KACHEL_B = 384, KACHEL_H = 256;
const BILD_B = 256, BILD_H = 128, SPALTEN = 4, ZEILEN = 4, RAND = 8;

type Punkt = [number, number, number];
interface Schildseite {
  art: Schildart;
  text: string;
  rueck: boolean;
  matrix: THREE.Matrix4;
  verfall: number;
}

function koerper(art: Art): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [];
  const teil = (geo: THREE.BufferGeometry, farbe: string) => {
    const c = new THREE.Color(farbe), anzahl = geo.getAttribute('position').count;
    const rgb = new Float32Array(anzahl * 3);
    for (let i = 0; i < anzahl; i++) c.toArray(rgb, i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    teile.push(geo);
  };
  const kasten = (b: number, h: number, t: number, ort: Punkt, farbe: string) =>
    teil(new THREE.BoxGeometry(b, h, t).translate(...ort), farbe);
  const rohr = (von: Punkt, nach: Punkt, rUnten: number, rOben: number, farbe: string) => {
    const a = new THREE.Vector3(...von), b = new THREE.Vector3(...nach);
    const entlang = new THREE.Vector3().subVectors(b, a);
    const drehung = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), entlang.clone().normalize());
    const mitte = a.add(b).multiplyScalar(.5);
    teil(new THREE.CylinderGeometry(rOben, rUnten, entlang.length(), 8)
      .applyQuaternion(drehung).translate(...mitte.toArray()), farbe);
  };

  if (art === 'laterne') {
    rohr([0, -.07, 0], [0, .48, 0], .096, .086, '#41463a');
    rohr([0, .42, 0], [0, 5.18, 0], .081, .045, '#646c63');
    rohr([0, 5.18, 0], [0, 5.64, .23], .045, .036, '#61695f');
    rohr([0, 5.64, .23], [0, 5.74, .84], .036, .026, '#61695f');
    kasten(.24, .102, .47, [0, 5.73, .99], '#3f4741');
    kasten(.195, .024, .341, [0, 5.671, 1.024], '#9c9b81');
    kasten(.081, .29, .014, [0, .64, .084], '#484b40');
  } else {
    const { breite, hoehe, mitte, tiefe } = SCHILDER[art];
    const hoch = mitte + hoehe * .41;
    rohr([0, -.08, 0], [0, .23, 0], .038, .035, '#55564a');
    rohr([0, .21, 0], [0, hoch, 0], .031, .029, '#767b71');
    if (art === 'tempo') {
      teil(new THREE.CylinderGeometry(breite / 2, breite / 2, tiefe, 32)
        .rotateX(Math.PI / 2).translate(0, mitte, RAHMEN_Z), '#66695d');
    } else {
      kasten(breite, hoehe, tiefe, [0, mitte, RAHMEN_Z], '#626962');
    }
    kasten(.118, .036, .065, [0, mitte - hoehe * .29, .017], '#545a53');
  }

  const geo = mergeGeometries(teile);
  teile.forEach(teil => teil.dispose());
  if (!geo) throw new Error(`Straßenmobiliar-Geometrie unvollständig (${art}).`);
  return geo;
}

function schrift(ctx: CanvasRenderingContext2D, text: string, hoehe: number, y: number) {
  ctx.font = `700 ${hoehe}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, KACHEL_B * .5, y, KACHEL_B * .84);
}

function zeichneSchild(ctx: CanvasRenderingContext2D, seite: Schildseite, x: number, y: number): void {
  const b = KACHEL_B, h = KACHEL_H;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(BILD_B / b, BILD_H / h);
  ctx.beginPath();
  ctx.rect(0, 0, b, h);
  ctx.clip();
  switch (seite.art) {
    case 'tempo': {
      ctx.fillStyle = '#9e2e27';
      ctx.fillRect(0, 0, b, h);
      ctx.fillStyle = '#dbdaca';
      ctx.beginPath();
      ctx.ellipse(b / 2, h / 2, b * .386, h * .386, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#252820';
      schrift(ctx, seite.text, 126, h * .52);
      break;
    }
    case 'ortstafel': {
      ctx.fillStyle = '#d8ab38';
      ctx.fillRect(0, 0, b, h);
      ctx.strokeStyle = '#262a20';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(12, 11, b - 24, h - 22, 12);
      ctx.stroke();
      ctx.fillStyle = '#282a21';
      const zeilen = seite.text.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 3);
      for (const [i, zeile] of zeilen.entries()) {
        schrift(ctx, zeile, i === 0 ? 62 : 31, h * (.52 + (i - (zeilen.length - 1) / 2) * .21));
      }
      if (seite.rueck) {
        ctx.strokeStyle = '#a94235';
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(23, h - 27);
        ctx.lineTo(b - 23, 27);
        ctx.stroke();
      }
      break;
    }
    case 'strassenname': {
      ctx.fillStyle = '#254253';
      ctx.fillRect(0, 0, b, h);
      ctx.strokeStyle = '#b9c1b8';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(7, 13, b - 14, h - 26, 11);
      ctx.stroke();
      ctx.fillStyle = '#e0e2d1';
      schrift(ctx, seite.text, 100, h * .53);
      break;
    }
  }

  // Regenläufer und abgeplatzte Beschichtung bleiben in der Schriftzone zurückhaltend.
  let saat = 9277;
  for (const c of seite.text) saat = Math.imul(saat ^ c.charCodeAt(0), 16777619);
  const zufall = () => {
    saat = (Math.imul(saat, 1664525) + 1013904223) | 0;
    return (saat >>> 0) / 4294967296;
  };
  for (let i = 0; i < 230; i++) {
    const u = zufall() * b, v = zufall() * h;
    const mitte = u > 34 && u < b - 34 && v > h * .28 && v < h * .74;
    const alpha = ((mitte ? .13 : .38) * seite.verfall * (.35 + zufall() * .65)).toFixed(3);
    ctx.fillStyle = i % 4 === 0 ? `rgba(218,207,172,${alpha})` : `rgba(65,58,37,${alpha})`;
    ctx.fillRect(u, v, .6 + zufall() * 6, .5 + zufall() * (mitte ? 4 : 18));
  }
  ctx.restore();
}

function schildbogen(vorlagen: readonly (readonly Schildseite[])[]) {
  const c = document.createElement('canvas');
  // Eine Kachel pro eindeutiger Vorlage. Randpixel schützen die Vorlage
  // beim Minifizieren vor Farben aus den benachbarten Kacheln.
  const spalten = Math.min(SPALTEN, vorlagen.length);
  c.width = spalten * (BILD_B + RAND * 2);
  c.height = Math.ceil(vorlagen.length / spalten) * (BILD_H + RAND * 2);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Straßenschilder benötigen einen Canvas-2D-Kontext.');
  const flaechen = vorlagen.flatMap((seiten, i) => {
    const x = (i % spalten) * (BILD_B + RAND * 2) + RAND;
    const y = Math.floor(i / spalten) * (BILD_H + RAND * 2) + RAND;
    zeichneSchild(ctx, seiten[0], x, y);
    const breitMitRand = BILD_B + RAND * 2;
    ctx.drawImage(c, x, y, 1, BILD_H, x - RAND, y, RAND, BILD_H);
    ctx.drawImage(c, x + BILD_B - 1, y, 1, BILD_H, x + BILD_B, y, RAND, BILD_H);
    ctx.drawImage(c, x - RAND, y, breitMitRand, 1, x - RAND, y - RAND, breitMitRand, RAND);
    ctx.drawImage(c, x - RAND, y + BILD_H - 1, breitMitRand, 1,
      x - RAND, y + BILD_H, breitMitRand, RAND);
    return seiten.map(seite => {
      const { breite, hoehe, mitte, tiefe } = SCHILDER[seite.art];
      const geo = seite.art === 'tempo' ? new THREE.CircleGeometry(breite * .5, 32) : new THREE.PlaneGeometry(breite, hoehe);
      const uv = geo.getAttribute('uv');
      for (let j = 0; j < uv.count; j++) {
        uv.setXY(j, (x + uv.getX(j) * BILD_B) / c.width, 1 - (y + (1 - uv.getY(j)) * BILD_H) / c.height);
      }
      if (seite.rueck) geo.rotateY(Math.PI);
      geo.translate(0, mitte, RAHMEN_Z + (seite.rueck ? -1 : 1) * (tiefe * .5 + .001));
      return geo.applyMatrix4(seite.matrix);
    });
  });
  const geo = mergeGeometries(flaechen);
  flaechen.forEach(flaeche => flaeche.dispose());
  if (!geo) throw new Error('Schildflächen konnten nicht zusammengeführt werden.');
  const atlas = new THREE.CanvasTexture(c);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({
    map: atlas, roughness: .84, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  });
  return { netz: new THREE.Mesh(geo, material), atlas };
}

export function baueStrassenmobiliar(
  eintraege: readonly Strassenmobiliar[],
  bodenHoehe: (x: number, z: number) => number,
): { gruppe: THREE.Group; freigeben: () => void } {
  const gruppe = new THREE.Group();
  gruppe.name = 'Straßenmobiliar';
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88, metalness: .10 });
  const koerperNachArt = new Map<Art, THREE.Matrix4[]>();
  const seitenNachVorlage = new Map<string, Schildseite[]>();
  const meldeSchildseite = (seite: Schildseite) => {
    const schluessel = JSON.stringify([seite.art, seite.text, seite.rueck, seite.verfall]);
    const stapel = seitenNachVorlage.get(schluessel) ?? [];
    stapel.push(seite);
    seitenNachVorlage.set(schluessel, stapel);
  };
  const haltung = new THREE.Object3D();
  for (const e of eintraege) {
    if (![e.x, e.z, e.richtung].every(Number.isFinite)) continue;
    const y = bodenHoehe(e.x, e.z);
    if (!Number.isFinite(y)) continue;
    const verfall = e.verfall !== undefined && Number.isFinite(e.verfall) ? THREE.MathUtils.clamp(e.verfall, 0, 1) : .65;
    const taumeln = Math.sin(e.x * 18.419 + e.z * 3.716) * verfall;
    haltung.position.set(e.x, y, e.z);
    haltung.rotation.set(.016 * taumeln, Math.PI - THREE.MathUtils.degToRad(e.richtung), -.042 * taumeln, 'YXZ');
    haltung.updateMatrix();
    const matrix = haltung.matrix.clone();
    const stapel = koerperNachArt.get(e.art) ?? [];
    stapel.push(matrix);
    koerperNachArt.set(e.art, stapel);
    if (e.art === 'laterne') continue;
    meldeSchildseite({ art: e.art, text: e.art === 'tempo' ? String(e.tempo) : e.text, rueck: false, matrix, verfall });
    if (e.art !== 'tempo' && e.ruecktext) meldeSchildseite({ art: e.art, text: e.ruecktext, rueck: true, matrix, verfall });
  }

  const koerperNetze: THREE.InstancedMesh[] = [];
  for (const [art, matrizen] of koerperNachArt) {
    const netz = new THREE.InstancedMesh(koerper(art), material, matrizen.length);
    matrizen.forEach((m, i) => netz.setMatrixAt(i, m));
    netz.instanceMatrix.needsUpdate = true;
    netz.castShadow = netz.receiveShadow = true;
    netz.name = `Straßenmobiliar ${art}`;
    gruppe.add(netz);
    koerperNetze.push(netz);
  }
  gruppe.userData.strassenmobiliar = koerperNetze.reduce((summe, netz) => summe + netz.count, 0);
  const boegen: ReturnType<typeof schildbogen>[] = [];
  const vorlagen = Array.from(seitenNachVorlage.values());
  if (typeof document !== 'undefined') for (let i = 0; i < vorlagen.length; i += SPALTEN * ZEILEN) {
    const bogen = schildbogen(vorlagen.slice(i, i + SPALTEN * ZEILEN));
    bogen.netz.receiveShadow = true;
    bogen.netz.name = 'Schildflächen';
    gruppe.add(bogen.netz);
    boegen.push(bogen);
  }
  return {
    gruppe,
    freigeben: () => {
      for (const netz of koerperNetze) {
        netz.geometry.dispose();
        netz.dispose();
      }
      for (const { netz, atlas } of boegen) {
        netz.geometry.dispose();
        netz.material.dispose();
        atlas.dispose();
      }
      material.dispose();
    },
  };
}
