/** Zusammenhängender Hof der Scanprobe; Lage und Achse folgen dem echten Grundriss. */
import * as THREE from 'three';
import { baueHofbodenkontakt } from './hofbodenkontakt.js';
import type { Weltdaten } from './osm.js';
import { orientierteHuelle } from './terrain.js';
import { HOF_BODEN_AN, HOF_GRAS_AN, HOF_ORTSALTERUNG_AN, HOF_ZIELTREUE_AN } from './echt.js';
import { hofbodenRand, HOF_ZUGANG_MAX, rastereHofgras } from './hofboden.js';
import { bestimmeHofhaeuser } from './hofhaeuser.js';
import type { PropInstanz } from './props.js';

export interface Hof {
  mitte: [number, number];
  /** Längsachse (cos, sin); die Querrichtung zeigt zum Messblick. */
  achse: [number, number];
  halb: [number, number];
  gebaeudeIndex: number;
}
type Weltmass = { breiteMeter: number; tiefeMeter: number };
/** Nur Messkonfiguration, kein gespeicherter Gebäudegrundriss. */
const MESSZIEL: readonly [number, number] = [1433, 434];
const MESSBLICK: readonly [number, number] = [1441, 418];
const WOHNARTEN = new Set(['yes', 'house', 'detached', 'residential', 'apartments', 'farm', 'terrace', 'semidetached_house']);

const LEER_KONTAKT = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat);
LEER_KONTAKT.needsUpdate = true;
export const HOF_UNIFORM = {
  mitte: { value: new THREE.Vector2() },
  achse: { value: new THREE.Vector2(1, 0) },
  halb: { value: new THREE.Vector2() },
  bereit: { value: 0 },
  zugaenge: { value: Array.from({ length: HOF_ZUGANG_MAX }, () => new THREE.Vector4()) },
  zugangZahl: { value: 0 },
  kontakt: { value: LEER_KONTAKT as THREE.Texture },
  kontaktRahmen: { value: new THREE.Vector4() },
  gras: { value: LEER_KONTAKT as THREE.Texture },
  grasRahmen: { value: new THREE.Vector4() },
  zielVorfeld: { value: new THREE.Vector4() },
  zielHalb: { value: new THREE.Vector2() },
};

/** Dieselbe Adresse wie die lokale Einsturzspur. Ein Index allein ist in anderen Welten kein Bezug. */
export function istHofZielhaus(gebaeudeIndex: number, p: readonly [number, number][]): boolean {
  return HOF_ZIELTREUE_AN && gebaeudeIndex === 308 && p.length === 5
    && p.some(([x, z]) => Math.hypot(x - 1425.85, z - 408.90) < .15);
}

/** Reine Auswahl, auch für Tests ohne globale Uniform-Nebenwirkung. */
export function bestimmeHof(welt: Weltdaten, terrain: Weltmass): Hof | null {
  const [sued, west, nord, ost] = welt.bbox;
  let bester: Hof | null = null, abstand = Infinity;
  welt.gebaeude.forEach((haus, gebaeudeIndex) => {
    if (!WOHNARTEN.has(haus.art) || haus.punkte.length < 4) return;
    const p: [number, number][] = haus.punkte.map(([lat, lon]) => [
      ((lon - west) / (ost - west) - 0.5) * terrain.breiteMeter,
      ((nord - lat) / (nord - sued) - 0.5) * terrain.tiefeMeter,
    ]);
    const h = orientierteHuelle(p, haus.lod2?.w !== null && haus.lod2?.w !== undefined ? haus.lod2.w * Math.PI / 180 : undefined);
    const mitte = h.welt((h.minU + h.maxU) * 0.5, (h.minV + h.maxV) * 0.5);
    const halb: [number, number] = [(h.maxU - h.minU) * 0.5, (h.maxV - h.minV) * 0.5];
    if (halb[0] < 2 || halb[1] < 2) return;
    const d = Math.hypot(mitte[0] - MESSZIEL[0], mitte[1] - MESSZIEL[1]);
    if (d >= abstand || d > 50) return;
    // Beide Achsen umkehren: die Vorderseite liegt immer in positiver Querachse.
    const vorne = -(MESSBLICK[0] - mitte[0]) * h.sin + (MESSBLICK[1] - mitte[1]) * h.cos;
    const vorzeichen = vorne >= 0 ? 1 : -1;
    bester = { mitte, achse: [h.cos * vorzeichen, h.sin * vorzeichen], halb, gebaeudeIndex };
    abstand = d;
  });
  return bester;
}

/** Einmal beim Weltaufbau; ohne passendes Haus bleibt die Probe vollständig aus. */
export function waehleHof(welt: Weltdaten, terrain: Weltmass): Hof | null {
  const hof = bestimmeHof(welt, terrain);
  HOF_UNIFORM.bereit.value = hof ? 1 : 0;
  if (hof) {
    HOF_UNIFORM.mitte.value.set(...hof.mitte);
    HOF_UNIFORM.achse.value.set(...hof.achse);
    HOF_UNIFORM.halb.value.set(...hof.halb);
  }
  const haeuser = HOF_BODEN_AN ? bestimmeHofhaeuser(welt, terrain, hof).filter(h => h.eingang).slice(0, HOF_ZUGANG_MAX) : [];
  HOF_UNIFORM.zugangZahl.value = haeuser.length;
  haeuser.forEach((h,i) => HOF_UNIFORM.zugaenge.value[i].set(...h.eingang!, ...h.vorne));
  HOF_UNIFORM.zielHalb.value.set(0, 0);
  if (HOF_ZIELTREUE_AN) {
    const zielhaus = haeuser.find(h => h.gebaeudeIndex === 308);
    if (zielhaus) {
      const [sued, west, nord, ost] = welt.bbox;
      const umriss = welt.gebaeude[zielhaus.gebaeudeIndex].punkte.map(([lat, lon]): [number, number] => [
        ((lon - west) / (ost - west) - .5) * terrain.breiteMeter,
        ((nord - lat) / (nord - sued) - .5) * terrain.tiefeMeter,
      ]);
      if (istHofZielhaus(zielhaus.gebaeudeIndex, umriss)) {
        const [nx, nz] = zielhaus.vorne;
        const halbU = Math.max(...umriss.map(([x, z]) => Math.abs((x - zielhaus.mitte[0]) * nz - (z - zielhaus.mitte[1]) * nx)));
        const halbV = Math.max(...umriss.map(([x, z]) => Math.abs((x - zielhaus.mitte[0]) * nx + (z - zielhaus.mitte[1]) * nz)));
        HOF_UNIFORM.zielVorfeld.value.set(...zielhaus.mitte, nx, nz);
        HOF_UNIFORM.zielHalb.value.set(halbU, halbV);
      }
    }
  }
  const alt = HOF_UNIFORM.kontakt.value;
  HOF_UNIFORM.kontakt.value = LEER_KONTAKT;
  HOF_UNIFORM.kontaktRahmen.value.set(0, 0, 0, 0);
  if (HOF_BODEN_AN && hof) {
    const k = baueHofbodenkontakt(welt, terrain, haeuser, hof.mitte);
    const t = new THREE.DataTexture(k.daten, k.breite, k.breite, THREE.RedFormat);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    HOF_UNIFORM.kontakt.value = t;
    HOF_UNIFORM.kontaktRahmen.value.set(...k.rahmen);
  }
  if (alt !== LEER_KONTAKT) alt.dispose();
  const altesGras = HOF_UNIFORM.gras.value;
  HOF_UNIFORM.gras.value = LEER_KONTAKT;
  HOF_UNIFORM.grasRahmen.value.set(0, 0, 0, 0);
  if (HOF_GRAS_AN && hof && haeuser.length) {
    const raster = rastereHofgras(hof.mitte, haeuser.map(h => ({ eingang: h.eingang!, vorne: h.vorne })));
    if (HOF_ORTSALTERUNG_AN && HOF_UNIFORM.zielHalb.value.x > 0) zeichneVorfeldPfade(raster);
    const t = new THREE.DataTexture(raster.daten, raster.breite, raster.breite, THREE.RedFormat);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    HOF_UNIFORM.gras.value = t;
    HOF_UNIFORM.grasRahmen.value.set(...raster.rahmen);
  }
  if (altesGras !== LEER_KONTAKT) altesGras.dispose();
  return hof;
}
const glatt = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Ausgetretener Zugang zur Traufe und ein schmalerer Pfad um den Giebel. */
export function hofVorfeldPfad(x: number, z: number): number {
  const { x: cx, y: cz, z: nx, w: nz } = HOF_UNIFORM.zielVorfeld.value;
  const { x: halbU, y: halbV } = HOF_UNIFORM.zielHalb.value;
  const dx = x - cx, dz = z - cz;
  if (halbU <= 0 || dx * dx + dz * dz > 19 * 19) return 0;
  const u = dx * nz - dz * nx, v = dx * nx + dz * nz;
  const vor = v - halbV, neben = u - halbU;
  const haupt = -0.68 * Math.sin(vor * 0.66) * glatt(.95, 3.0, vor);
  const rand = hofbodenRand(u, v) * 0.44;
  const zugang = glatt(.72, 1.85, vor) * (1 - glatt(6.0, 7.7, vor))
    * (1 - glatt(.30, .95, Math.abs(u - haupt) + rand));
  const seitlich = halbV - 1.48 + .58 * Math.sin(neben * .83);
  const giebelseite = glatt(.30, 1.7, neben) * (1 - glatt(5.0, 7.5, neben))
    * (1 - glatt(.20, .81, Math.abs(v - seitlich) - rand));
  return Math.max(zugang, giebelseite * .90);
}

/** Gleiche Pfadkontur im Bodenmaterial, ohne einen weiteren Textur-Sampler. */
export const HOF_VORFELD_PFAD_GLSL = /* glsl */ `
float hofVorfeldPfad(vec2 q, vec2 halb) {
  float vor = q.y - halb.y, neben = q.x - halb.x;
  float haupt = -0.68 * sin(vor * 0.66) * smoothstep(.95, 3.0, vor);
  float rand = hofBodenRand(q) * .44;
  float zugang = smoothstep(.72, 1.85, vor) * (1.0 - smoothstep(6.0, 7.7, vor))
    * (1.0 - smoothstep(.30, .95, abs(q.x - haupt) + rand));
  float seitlich = halb.y - 1.48 + .58 * sin(neben * .83);
  float giebelseite = smoothstep(.30, 1.7, neben) * (1.0 - smoothstep(5.0, 7.5, neben))
    * (1.0 - smoothstep(.20, .81, abs(q.y - seitlich) - rand));
  return max(zugang, giebelseite * .90);
}
`;

/** Gras und Erde beziehen ihre Pfadkontur aus derselben vorhandenen 8-Bit-Maske. */
function zeichneVorfeldPfade({ daten, breite, rahmen }: ReturnType<typeof rastereHofgras>): void {
  const { x: cx, y: cz } = HOF_UNIFORM.zielVorfeld.value;
  const [x0, z0, skala] = rahmen, schritt = 1 / (skala * breite);
  const links = Math.max(0, Math.floor((cx - 19 - x0) / schritt));
  const rechts = Math.min(breite, Math.ceil((cx + 19 - x0) / schritt));
  const oben = Math.max(0, Math.floor((cz - 19 - z0) / schritt));
  const unten = Math.min(breite, Math.ceil((cz + 19 - z0) / schritt));
  for (let j = oben; j < unten; j++) for (let i = links; i < rechts; i++) {
    const pfad = hofVorfeldPfad(x0 + (i + .5) * schritt, z0 + (j + .5) * schritt);
    const k = j * breite + i;
    daten[k] = Math.min(daten[k], Math.round(255 * (1 - pfad)));
  }
}

/** Bodenmaske: seitlich/hinten 2,4 m, vorne 6 m; weicher, ortsfester unregelmäßiger Rand. */
export function hofDeckung(x: number, z: number, hof: Hof | null): number {
  if (!hof || !Number.isFinite(x) || !Number.isFinite(z)) return 0;
  const dx = x - hof.mitte[0], dz = z - hof.mitte[1];
  const u = dx * hof.achse[0] + dz * hof.achse[1];
  const v = -dx * hof.achse[1] + dz * hof.achse[0];
  const innen = Math.max(Math.abs(u) - hof.halb[0], Math.abs(v) - hof.halb[1]);
  const rand = Math.max(Math.abs(u) - hof.halb[0] - 2.4, Math.abs(v - 1.8) - hof.halb[1] - 4.2);
  const fleck = HOF_BODEN_AN ? hofbodenRand(u, v) : Math.sin(u * 1.7 + v * 0.6) * Math.sin(v * 1.3 - u * 0.4) * 0.28;
  return (1 - glatt(HOF_BODEN_AN ? -1.4 : -0.85, HOF_BODEN_AN ? 0.65 : 0.25, rand + fleck)) * glatt(-0.05, 0.15, innen);
}

/** D303: der schmale Zugang zum neuen Eingang bleibt ohne niedrigen Bewuchs. */
export function hofEingangFrei(x: number, z: number, hof: Hof | null): boolean {
  if (!hof) return false;
  const dx=x-hof.mitte[0], dz=z-hof.mitte[1];
  const u=dx*hof.achse[0]+dz*hof.achse[1];
  const v=-dx*hof.achse[1]+dz*hof.achse[0]-hof.halb[1];
  return Math.abs(u)<1.15 && v>-.25 && v<3.2;
}

/** Kleine Scan-Gruppen am seitlichen Hofrand; gleicher Gebäudeseed, freie Wege und Grundrisse. */
export function hofRandProps(hof: Hof | null, hoehe: (x: number, z: number) => number,
  gesperrt: (x: number, z: number) => boolean): PropInstanz[] {
  if (!hof) return [];
  const props: PropInstanz[] = [];
  const zufall = (i: number) => {
    const q = Math.sin((hof.gebaeudeIndex + 1) * 78.233 + i * 12.9898) * 43758.5453;
    return q - Math.floor(q);
  };
  for (let i = 0; i < 9; i++) {
    const stein = i < 3, seite = i % 2 === 0 ? 1 : -1;
    const u = seite * (hof.halb[0] + 0.85 + zufall(i * 4) * 0.5);
    const v = hof.halb[1] - 0.8 + zufall(i * 4 + 1) * 2.6;
    const x = hof.mitte[0] + u * hof.achse[0] - v * hof.achse[1];
    const z = hof.mitte[1] + u * hof.achse[1] + v * hof.achse[0];
    if (gesperrt(x, z)) continue;
    props.push({ art: stein ? 'findling' : 'farn', variante: stein ? i : i % 4,
      position: [x, hoehe(x, z) - (stein ? (HOF_BODEN_AN ? 0.18 : 0.08) : 0), z],
      skalierung: stein ? 0.7 : 0.65, drehung: zufall(i * 4 + 2) * Math.PI * 2 });
  }
  return props;
}

/** Dieselben Achsen, Abstände und Polynome wie in der CPU-Maske; keine Zeitabhängigkeit. */
export const HOF_PARS = /* glsl */ `
uniform vec2 uHofMitte;
uniform vec2 uHofAchse;
uniform vec2 uHofHalb;
uniform float uHofBereit;
float hofDeckung(vec2 p) {
  vec2 d = p - uHofMitte;
  vec2 q = vec2(dot(d, uHofAchse), dot(d, vec2(-uHofAchse.y, uHofAchse.x)));
  float innen = max(abs(q.x) - uHofHalb.x, abs(q.y) - uHofHalb.y);
  float rand = max(abs(q.x) - uHofHalb.x - 2.4, abs(q.y - 1.8) - uHofHalb.y - 4.2);
  float fleck = ${HOF_BODEN_AN ? `0.44 * sin(q.x * 0.63 + q.y * 0.27) * sin(q.y * 0.91 - q.x * 0.19)
    + 0.26 * sin(q.x * 1.37 - q.y * 0.41 + 1.7) * sin(q.y * 1.13 + q.x * 0.35)` : 'sin(q.x * 1.7 + q.y * 0.6) * sin(q.y * 1.3 - q.x * 0.4) * 0.28'};
  return uHofBereit * (1.0 - smoothstep(${HOF_BODEN_AN ? '-1.4, 0.65' : '-0.85, 0.25'}, rand + fleck)) * smoothstep(-0.05, 0.15, innen);
}
`;
