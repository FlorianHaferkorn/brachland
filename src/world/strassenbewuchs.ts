import * as THREE from 'three';
import { WEG_UEBER_GRUND } from './baender.js';
import { ladeHorstAtlas, leereHorstTextur, HORST_SCHWELLE } from './grashorst.js';
import { mulberry } from './props.js';
import { WEG_TEILUNG } from './terrain.js';

export interface StrassenbewuchsWeg {
  /** Linienverlauf in Weltmetern. Breite ist die volle Breite des Wegbandes. */
  punkte: readonly (readonly [number, number])[];
  breite: number;
  saat: number;
  /** Bewuchs und Frostschäden zwischen 0 und 1. */
  verfall?: number;
  /** Auf ungebundenem Belag entstehen Rinnen und Pflanzeninseln ohne Asphaltrisse. */
  gebundenerBelag?: boolean;
}

type Bodenhoehe = (x: number, z: number) => number;
type FreierBoden = (x: number, z: number) => boolean;
type Punkt = readonly [x: number, y: number, z: number];

interface Stueck {
  x: number;
  z: number;
  dx: number;
  dz: number;
  laenge: number;
  halb: number;
  /** Geländehöhen der vier Bandvertices. */
  hoehen: readonly [number, number, number, number];
}

interface Bewuchs {
  ort: Punkt;
  groesse: number;
  drehung: number;
  ton: number;
  auswahl: number;
}

const MOOS = new THREE.Color('#495340');
const ERDE = new THREE.Color('#605746');
const SPLITT = new THREE.Color('#6a6559');
const RISS = new THREE.Color('#24271f');
const TAU = Math.PI * 2;

function punktAmBand(st: Stueck, laengs: number, quer: number, boden: Bodenhoehe, hub = 0): Punkt {
  const x = st.x + st.dx * laengs - st.dz * quer;
  const z = st.z + st.dz * laengs + st.dx * quer;
  const u = THREE.MathUtils.clamp((quer / st.halb + 1) * .5, 0, 1);
  const v = THREE.MathUtils.clamp(laengs / st.laenge, 0, 1);
  const [al, ar, bl, br] = st.hoehen;
  // Derselbe Diagonalschnitt wie liegendesBand in baender.ts. Dadurch liegt
  // die Auflage auch über Quergefälle und kurzen Kuppen am gezeichneten Belag.
  const y = u + v <= 1
    ? al + (ar - al) * u + (bl - al) * v
    : br + (bl - br) * (1 - u) + (ar - br) * (1 - v);
  const anschluss = Math.abs(quer) - st.halb;
  const hoehe = anschluss <= 0
    ? y + WEG_UEBER_GRUND
    : THREE.MathUtils.lerp(y + WEG_UEBER_GRUND, boden(x, z), Math.min(1, anschluss * 5));
  return [x, hoehe + hub, z];
}

function atlasKarten(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    -.5, 0, 0, .5, 0, 0, -.5, 1, 0, .5, 1, 0,
    0, 0, -.5, 0, 0, .5, 0, 1, -.5, 0, 1, .5,
  ], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1, 0,0,1,0,0,1,1,1], 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: 8 }, () => [0,1,0]).flat(), 3));
  geo.setIndex([0,1,2, 2,1,3, 4,5,6, 6,5,7]);
  return geo;
}

/** Berechnet die Auflagen des beprobten Straßenzugs einmal. Büschel und Splitt bleiben Instanzen. */
export function baueStrassenbewuchs(
  wege: readonly StrassenbewuchsWeg[],
  boden: Bodenhoehe,
  freierBoden: FreierBoden = () => true,
): { gruppe: THREE.Group; entsorge: () => void } {
  const gruppe = new THREE.Group();
  gruppe.name = 'Straßenbewuchs';
  const positionen: number[] = [], farben: number[] = [], indizes: number[] = [];
  const wildkraut: Bewuchs[] = [], splitt: Bewuchs[] = [];
  let risse = 0;

  const vertex = (p: Punkt, farbe: THREE.Color, deckung: number) => {
    const index = positionen.length / 3;
    positionen.push(...p);
    farben.push(farbe.r, farbe.g, farbe.b, deckung);
    return index;
  };
  const frei = ([x, , z]: Punkt) => freierBoden(x, z);
  const matrix = new THREE.Matrix4(), skalierung = new THREE.Vector3(), farbe = new THREE.Color();

  for (const weg of wege) {
    const zufall = mulberry(weg.saat);
    const verfall = THREE.MathUtils.clamp(weg.verfall ?? 1, 0, 1);
    const halb = weg.breite / 2;
    const freieSpur = Math.min(.90, halb * .70);
    if (halb < .45 || verfall === 0) continue;
    const phase = zufall() * TAU;
    let meter = 0;

    for (let i = 1; i < weg.punkte.length; i++) {
      const [x0, z0] = weg.punkte[i - 1];
      const [x1, z1] = weg.punkte[i];
      const distanz = Math.hypot(x1 - x0, z1 - z0);
      if (distanz < .05) continue;
      const teile = Math.ceil(distanz / WEG_TEILUNG), laenge = distanz / teile;
      const dx = (x1 - x0) / distanz, dz = (z1 - z0) / distanz;
      for (let j = 0; j < teile; j++, meter += laenge) {
        const x = x0 + dx * laenge * j, z = z0 + dz * laenge * j;
        const ex = x0 + dx * laenge * (j + 1), ez = z0 + dz * laenge * (j + 1);
        const nx = -dz * halb, nz = dx * halb;
        const st: Stueck = {
          x, z, dx, dz, laenge, halb,
          hoehen: [boden(x - nx, z - nz), boden(x + nx, z + nz), boden(ex - nx, ez - nz), boden(ex + nx, ez + nz)],
        };

        for (const seite of [-1, 1]) {
          const horst = .5 + .5 * Math.sin(meter * (seite < 0 ? .19 : .27) + phase + seite * 1.23);
          const drang = verfall * (.19 + .81 * horst ** 1.5);
          const mitte = halb - drang * (halb - freieSpur) * .68;
          const breite = Math.min(.29 + drang * .71, mitte - freieSpur);
          const laengs = laenge * (.42 + zufall() * .16);
          const radius = Math.min(laenge * .4, .55 + drang * 1.04);

          if (breite > .03 && zufall() < drang * 1.35) {
            const kern = punktAmBand(st, laengs, seite * mitte, boden, .023);
            const rand = Array.from({ length: 10 }, (_, k) => {
              const alpha = TAU * k / 10, f = .65 + zufall() * .35;
              return punktAmBand(st, laengs + Math.cos(alpha) * radius * f,
                seite * (mitte + Math.sin(alpha) * breite * f), boden, .023);
            });
            if (frei(kern) && rand.every(frei)) {
              farbe.copy(MOOS).lerp(ERDE, zufall() * .72).multiplyScalar(.83 + zufall() * .34);
              const a = vertex(kern, farbe, .68 + drang * .26);
              const b = rand.map(p => vertex(p, farbe, 0));
              for (let k = 0; k < b.length; k++) indizes.push(a, b[k], b[(k + 1) % b.length]);
            }
          }

          const anzahl = Math.round(laenge * (1.1 + 10.2 * drang) * verfall);
          for (let k = 0; k < anzahl; k++) {
            const groesse = .14 + (.09 + .34 * drang) * zufall();
            const quer = Math.max(freieSpur + groesse * .59, mitte + (zufall() - .42) * (.70 + drang * .74));
            const laengs = laenge * (.07 + zufall() * .86);
            const ort = punktAmBand(st, laengs, seite * quer, boden, -.012);
            if (!frei(ort)) continue;
            wildkraut.push({ ort, groesse, drehung: zufall() * TAU, ton: .64 + zufall() * .58, auswahl: zufall() });
            if (zufall() < .18) splitt.push({
              ort, groesse: .045 + zufall() * .135, drehung: zufall() * TAU, ton: .6 + zufall() * .59, auswahl: zufall(),
            });
          }
        }

        if (weg.gebundenerBelag === false || laenge < .8 || zufall() > laenge * .135 * verfall) continue;
        const seite = zufall() < .5 ? -1 : 1;
        const anfang = laenge * (.23 + zufall() * .4);
        const reichweite = halb * (.35 + zufall() * .57);
        const versatz = (zufall() - .5) * Math.min(.9, laenge * .28);
        // Unregelmäßige, auslaufende Bruchfläche vom Rand zur Fahrbahnmitte.
        const verlauf = Array.from({ length: 6 }, (_, k) => {
          const t = k / 5, zacke = (zufall() - .5) * .19;
          return {
            laengs: anfang + versatz * t + zacke, quer: seite * (halb * .83 - reichweite * t),
            breit: (.014 + .023 * zufall()) * (1 - t * .85),
          };
        });
        const kanten = verlauf.map(({ laengs, quer, breit }) =>
          [punktAmBand(st, laengs - breit, quer, boden, .028), punktAmBand(st, laengs + breit, quer, boden, .028)] as const);
        if (!kanten.every(paare => paare.every(frei))) continue;
        const risskanten = kanten.map((paare, k) => paare.map(p => vertex(p, RISS, 1 - k * .135)));
        for (let k = 1; k < risskanten.length; k++) {
          const [a, b] = risskanten[k - 1], [c, d] = risskanten[k];
          indizes.push(a, b, c, b, d, c);
        }
        risse++;
      }
    }
  }

  const geos: THREE.BufferGeometry[] = [], materialien: THREE.Material[] = [];
  let entsorgt = false, platzhalter: THREE.DataTexture | undefined;
  if (positionen.length) {
    const flaeche = new THREE.BufferGeometry();
    flaeche.setAttribute('position', new THREE.Float32BufferAttribute(positionen, 3));
    flaeche.setAttribute('color', new THREE.Float32BufferAttribute(farben, 4));
    flaeche.setIndex(indizes);
    // Auflagen übernehmen auf beiden Seiten die Normalenrichtung des Bodens.
    flaeche.setAttribute('normal', new THREE.Float32BufferAttribute(
      Float32Array.from({ length: positionen.length }, (_, i) => i % 3 === 1 ? 1 : 0), 3));
    flaeche.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, side: THREE.DoubleSide, transparent: true, forceSinglePass: true, depthWrite: false,
      roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vAuflage;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAuflage = position.xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec2 vAuflage;
float auflageKorn(vec2 p) {
  return fract(sin(dot(mod(p, 4096.0), vec2(83.2, 35.1))) * 43758.5453);
}
float auflageRauschen(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f *= f * (3.0 - 2.0 * f);
  return mix(mix(auflageKorn(i), auflageKorn(i + vec2(1,0)), f.x),
             mix(auflageKorn(i + vec2(0,1)), auflageKorn(i + vec2(1,1)), f.x), f.y);
}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
  float moos = auflageRauschen(vAuflage * 9.0);
  float korn = auflageRauschen(vAuflage * 36.0);
  diffuseColor.rgb *= 0.75 + 0.42 * moos + 0.18 * korn;
  diffuseColor.a *= smoothstep(0.05, 0.49, moos * 0.51 + diffuseColor.a * 0.64);`);
    };
    const mesh = new THREE.Mesh(flaeche, material);
    mesh.renderOrder = .5;
    mesh.receiveShadow = true;
    gruppe.add(mesh);
    geos.push(flaeche);
    materialien.push(material);
  }

  const instanzen = (geo: THREE.BufferGeometry, material: THREE.MeshStandardMaterial,
    eintraege: readonly Bewuchs[], istStein: boolean) => {
    const mesh = new THREE.InstancedMesh(geo, material, eintraege.length);
    eintraege.forEach(({ ort, groesse, drehung, ton, auswahl }, i) => {
      matrix.makeRotationY(drehung);
      matrix.scale(skalierung.set(groesse * (istStein ? 1.5 : 1), groesse * (istStein ? .48 : 1), groesse));
      matrix.setPosition(ort[0], ort[1] + (istStein ? groesse * .27 : 0), ort[2]);
      mesh.setMatrixAt(i, matrix);
      if (istStein) farbe.copy(SPLITT).lerp(ERDE, auswahl * .47).multiplyScalar(ton);
      else farbe.setRGB(1.38 * ton, 1.53 * ton, 1.25 * ton);
      mesh.setColorAt(i, farbe);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    gruppe.add(mesh);
    geos.push(geo);
    materialien.push(material);
    return mesh;
  };

  if (splitt.length) instanzen(new THREE.IcosahedronGeometry(.5, 0),
    new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), splitt, true);

  if (wildkraut.length) {
    const geo = atlasKarten();
    const kacheln = new THREE.InstancedBufferAttribute(new Float32Array(wildkraut.length * 4), 4);
    platzhalter = leereHorstTextur();
    geo.setAttribute('kartenfeld', kacheln);
    const mat = new THREE.MeshStandardMaterial({
      map: platzhalter, alphaTest: HORST_SCHWELLE, alphaToCoverage: true, side: THREE.DoubleSide, roughness: .9,
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 kartenfeld;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = kartenfeld.xy + uv * kartenfeld.zw;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>',
        '#include <normal_fragment_begin>\nnormal = normalize(vNormal);');
    };
    instanzen(geo, mat, wildkraut, false);
    if (typeof document !== 'undefined') {
      void ladeHorstAtlas().then(({ textur, kacheln: felder }) => {
        if (entsorgt) return;
        const gruen = felder.filter(k => k.art === 'gruen');
        const kraut = felder.filter(k => k.art === 'kraut');
        const trocken = felder.filter(k => k.art === 'stroh');
        const blume = felder.filter(k => k.art === 'blume');
        wildkraut.forEach((eintrag, i) => {
          const x = eintrag.auswahl;
          const art = x < .62 ? gruen : x < .81 ? kraut : x < .96 ? trocken : blume;
          const kachel = art[Math.floor((x * 37 % 1) * art.length)];
          if (kachel) kacheln.setXYZW(i, ...kachel.rect);
        });
        kacheln.needsUpdate = true;
        mat.map = textur;
        mat.needsUpdate = true;
        platzhalter?.dispose();
        platzhalter = undefined;
      }).catch((fehler: unknown) => console.warn('Straßenbewuchs: Grashorst-Atlas fehlt.', fehler));
    }
  }
  gruppe.userData.strassenbewuchs = { wildkraut: wildkraut.length, splitt: splitt.length, risse, auflageDreiecke: indizes.length / 3 };
  return {
    gruppe,
    entsorge: () => {
      entsorgt = true;
      platzhalter?.dispose();
      geos.forEach(g => g.dispose());
      materialien.forEach(m => m.dispose());
      for (const kind of gruppe.children) if (kind instanceof THREE.InstancedMesh) kind.dispose();
    },
  };
}
