import * as THREE from 'three';
import inhalt from '../../content/milbinger-substanz.json';
import { baueBruchholz } from './bruchholz.js';
import type { LoD2Dachbruch } from './lod2dach.js';
import { verfeinereSandMaterial } from './oberflaechen.js';
import type { Weltdaten } from './osm.js';
import { imPolygon } from './osm.js';
import { mulberry, VARIANTEN } from './props.js';
import type { PropInstanz } from './props.js';

type Lage = [x: number, z: number];
type Punkt = [x: number, y: number, z: number];
type Hausverfall = { stufe: number; dach?: LoD2Dachbruch };

const [ax, az, tx, tz] = inhalt.achse;
const verfall = new Map<number, Hausverfall>(inhalt.haeuser.map(h => [h.index, h]));
export const istMilbingerRegion = (welt: Weltdaten) => welt.bbox.every((wert, i) => wert === inhalt.bbox[i]);
export const milbingerHausverfall = (index: number) => verfall.get(index);
export const milbingerQuerabstand = (x: number, z: number) => (x - ax) * -tz + (z - az) * tx;
export const milbingerStrassennormale: Lage = [-tz, tx];
const weltpunkt = (s: number, q: number): Lage => [ax + tx * s - tz * q, az + tz * s + tx * q];
const { sandkasten } = inhalt;
export const MILBINGER_SANDKASTEN = weltpunkt(sandkasten.station, sandkasten.quer);

/** Begrünte Säume aus der DOP20-Aufsicht. Bewuchs und Standjahre sind gestaltet. */
export function milbingerGartenprops(
  welt: Weltdaten, hoehe: (x: number, z: number) => number, freihalten: ((x: number, z: number) => boolean) | undefined,
  lod2: readonly Weltdaten['gebaeude'][number]['lod2'][] | null = null,
): PropInstanz[] {
  if (!istMilbingerRegion(welt)) return [];
  const [s, w, n, o] = welt.bbox;
  const mitteLat = (s + n) / 2;
  const meterJeLon = 111320 * Math.cos(mitteLat * Math.PI / 180);
  const nachWelt = ([lat, lon]: [number, number]): Lage => [(lon - (w + o) / 2) * meterJeLon, (mitteLat - lat) * 111320];
  const grundrisse = welt.gebaeude.flatMap((haus, i) => {
    const [x, z] = nachWelt(haus.punkte[0]);
    if (x < 1290 || x > 1430 || z < 360 || z > 510) return [];
    return (lod2?.[i]?.koerper?.map(k => k.grundriss) ?? [haus.punkte]).map(ring => ring.map(nachWelt));
  });
  const frei = (x: number, z: number, radius: number) =>
    ([[x,z],[x-radius,z],[x+radius,z],[x,z-radius],[x,z+radius]] as Lage[])
      .every(p => !freihalten?.(...p) && !grundrisse.some(ring => imPolygon(p, ring)));
  const props: PropInstanz[] = [];
  for (const garten of inhalt.gaerten) {
    const zufall = mulberry(347000 + garten.haus);
    const platziere = (s: number, q: number, art: 'busch' | 'farn', groesse: number) => {
      const [x, z] = weltpunkt(s, q);
      if (!frei(x, z, art === 'busch' ? groesse * .63 : .25)) return;
      if (Math.abs(s - sandkasten.station) < 1.10 && Math.abs(q - sandkasten.quer) < 1.16) return;
      props.push({ art, position: [x, hoehe(x, z), z], skalierung: groesse,
        variante: Math.floor(zufall() * VARIANTEN[art].length), drehung: zufall() * Math.PI * 2 });
    };
    for (let i = 1; i < garten.saum.length; i++) {
      const [s0, q0] = garten.saum[i - 1], [s1, q1] = garten.saum[i];
      const anzahl = Math.ceil(Math.hypot(s1 - s0, q1 - q0) / 1.24);
      for (let j = 0; j < anzahl; j++) {
        const t = (j + .21 + zufall() * .55) / anzahl;
        const s = s0 + (s1 - s0) * t, q = q0 + (q1 - q0) * t;
        if (zufall() > .16) platziere(s + (zufall() - .5) * .82, q, 'busch', .51 + zufall() * .74);
        for (let farn = 0; farn < 2; farn++) {
          platziere(s + (zufall() - .5) * garten.tiefe * 2, q + (zufall() - .5) * 1.58, 'farn', .45 + zufall() * .59);
        }
      }
    }
  }
  return props;
}

/** Ein gestaltetes Gartenrelikt auf der Grünfläche. Die Aufsicht belegt nur die Lage des Gartens. */
export function baueMilbingerSandkasten(
  welt: Weltdaten, hoehe: (x: number, z: number) => number, freihalten?: (x: number, z: number) => boolean,
) {
  if (!istMilbingerRegion(welt)) return undefined;
  const { station, quer, breite, tiefe } = sandkasten;
  const weltXz = (u: number, v: number) => weltpunkt(station + v, quer + u);
  const punkt = (u: number, v: number, y: number): Punkt => {
    const [x, z] = weltXz(u, v);
    return [x, hoehe(x, z) + y, z];
  };
  const u = breite * .5, v = tiefe * .5;
  if ([-u, 0, u].some(a => [-v, 0, v].some(b => freihalten?.(...weltXz(a, b))))) return undefined;
  const sand = new THREE.BufferGeometry();
  const sandPositionen: number[] = [], sandIndices: number[] = [];
  const raster = 12;
  for (let j = 0; j <= raster; j++) for (let i = 0; i <= raster; i++) {
    const x = i / raster * 2 - 1, z = j / raster * 2 - 1;
    const mulde = 1 - Math.max(Math.abs(x), Math.abs(z));
    const hoehenprofil = .082 + .022 * Math.sin(x * 5.9 + z * 3.1) + .017 * Math.cos(z * 9.2 - x * 5.1) - .034 * mulde;
    sandPositionen.push(...punkt(x * (u - .045 + .016 * Math.sin(z * 9)), z * (v - .05), hoehenprofil));
    if (i === raster || j === raster) continue;
    const k = j * (raster + 1) + i;
    sandIndices.push(k, k + 1, k + raster + 1, k + 1, k + raster + 2, k + raster + 1);
  }
  sand.setAttribute('position', new THREE.Float32BufferAttribute(sandPositionen, 3));
  sand.setIndex(sandIndices);
  sand.computeVertexNormals();
  const sandMaterial = new THREE.MeshStandardMaterial({ color: '#a0987d', roughness: .96 });
  verfeinereSandMaterial(sandMaterial);

  const holz = new THREE.BufferGeometry(), positionen: number[] = [], farben: number[] = [], holzUv: number[] = [];
  const strecken = [
    [punkt(-u,-v,.15),punkt(u,-v,.13)],
    [punkt(u,-v,.15),punkt(u,v,.11)],
    [punkt(-u,-v,.15),punkt(-u,v*.23,.08)],
    [punkt(-u*.88,v*.93,.065),punkt(-u*.39,v*1.12,.04)],
    [punkt(-u*.21,v*.92,.095),punkt(u,v,.15)],
  ] as const;
  strecken.forEach(([a,b], i) => {
    const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz);
    baueBruchholz((p, q, r, farbe) => {
      for (const [x,y,z] of [p,q,r]) {
        positionen.push(x,y,z);
        farben.push(farbe.r, farbe.g, farbe.b);
        holzUv.push(((x-a[0])*dx + (z-a[2])*dz) / l + i * 1.93,
          ((x-a[0])*dz - (z-a[2])*dx) / l + y-a[1]);
      }
    }, a, b, .12, .18, 347660 + i * 37, true, i >= 2);
  });
  holz.setAttribute('position', new THREE.Float32BufferAttribute(positionen, 3));
  holz.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  holz.setAttribute('uv', new THREE.Float32BufferAttribute(holzUv, 2));
  holz.computeVertexNormals();
  const holzMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  holzMaterial.onBeforeCompile = shader => {
    const varying = 'varying vec2 vSandholz;\n';
    shader.vertexShader = varying + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvSandholz = uv;');
    shader.fragmentShader = varying + shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float sandholzFaser = sin(173.0 * vSandholz.y + 2.1 * sin(7.2*vSandholz.x + 17.0 * vSandholz.y));
      float sandholzPoren = smoothstep(.6, .94, sin(vSandholz.y*361.0+sin(vSandholz.x*21.7)*1.09));
      diffuseColor.rgb *= .91 + .085 * sandholzFaser - .10 * sandholzPoren;
    `);
  };
  const sandMesh = new THREE.Mesh(sand, sandMaterial), holzMesh = new THREE.Mesh(holz, holzMaterial);
  sandMesh.receiveShadow = holzMesh.receiveShadow = holzMesh.castShadow = true;
  const gruppe = new THREE.Group();
  gruppe.name = 'Milbinger-Sandkasten';
  gruppe.add(sandMesh, holzMesh);
  return { gruppe, entsorge() { sand.dispose(); holz.dispose(); sandMaterial.dispose(); holzMaterial.dispose(); } };
}
