/** Zusammenhängender Hof der Scanprobe; Lage und Achse folgen dem echten Grundriss. */
import * as THREE from 'three';
import type { Weltdaten } from './osm.js';
import { orientierteHuelle } from './terrain.js';
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

export const HOF_UNIFORM = {
  mitte: { value: new THREE.Vector2() },
  achse: { value: new THREE.Vector2(1, 0) },
  halb: { value: new THREE.Vector2() },
  bereit: { value: 0 },
};

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
  return hof;
}
const glatt = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Bodenmaske: seitlich/hinten 2,4 m, vorne 6 m; weicher, ortsfester unregelmäßiger Rand. */
export function hofDeckung(x: number, z: number, hof: Hof | null): number {
  if (!hof || !Number.isFinite(x) || !Number.isFinite(z)) return 0;
  const dx = x - hof.mitte[0], dz = z - hof.mitte[1];
  const u = dx * hof.achse[0] + dz * hof.achse[1];
  const v = -dx * hof.achse[1] + dz * hof.achse[0];
  const innen = Math.max(Math.abs(u) - hof.halb[0], Math.abs(v) - hof.halb[1]);
  const rand = Math.max(Math.abs(u) - hof.halb[0] - 2.4, Math.abs(v - 1.8) - hof.halb[1] - 4.2);
  const fleck = Math.sin(u * 1.7 + v * 0.6) * Math.sin(v * 1.3 - u * 0.4) * 0.28;
  return (1 - glatt(-0.85, 0.25, rand + fleck)) * glatt(-0.05, 0.15, innen);
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
      position: [x, hoehe(x, z) - (stein ? 0.08 : 0), z],
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
  float fleck = sin(q.x * 1.7 + q.y * 0.6) * sin(q.y * 1.3 - q.x * 0.4) * 0.28;
  return uHofBereit * (1.0 - smoothstep(-0.85, 0.25, rand + fleck)) * smoothstep(-0.05, 0.15, innen);
}
`;
