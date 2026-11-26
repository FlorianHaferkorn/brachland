import * as THREE from 'three';

/** Das Licht folgt der hellen Wolkenöffnung des vorhandenen Alpen-HDRIs. */
export const MILBINGER_TAGESLICHT = {
  sonnenstand: new THREE.Vector3(45.4, 66.9, -58.1),
  sonne: new THREE.Color('#fff0dc'),
  himmel: new THREE.Color('#bacbd6'),
  erde: new THREE.Color('#837769'),
  dunst: new THREE.Color('#a6b2af'),
  nebelNah: 27,
  nebelFern: 210,
  direkt: 2.45,
  hemisphaere: 1.32,
  umfeld: .66,
  belichtung: 1.65,
  schatten: .90,
  wolkenDrehung: 88 / 360,
} as const;

/** Bedecktes Œntal vor der Heilung. Die hellste Wolkenpartie gibt die Lichtrichtung vor. */
export const MILBINGER_WOLKENLICHT = {
  sonnenstand: new THREE.Vector3(47, 59, -60),
  sonne: new THREE.Color('#fff2df'),
  himmel: new THREE.Color('#abb5ba'),
  erde: new THREE.Color('#776d5f'),
  dunst: new THREE.Color('#999f9b'),
  nebelNah: 23,
  nebelFern: 198,
  direkt: 1.42,
  hemisphaere: 1.63,
  umfeld: .60,
  belichtung: 1.52,
  schatten: .65,
  wolkenDrehung: 42 / 360,
} as const;

/** Einfirsthof 708, Sonne aus hausframe.py (Azimut 195°, Höhe 14°).
 * Blender Y zeigt nach Norden, die Spielwelt hat Süden auf +Z. */
export const MODELLHOF_LICHT = {
  sonnenstand: new THREE.Vector3(-25.11, 24.19, 93.73),
  sonne: new THREE.Color(1, .66, .38),
  himmel: new THREE.Color('#a7a29a'), erde: new THREE.Color('#82786a'),
  dunst: new THREE.Color('#a69c8b'), nebelNah: 57, nebelFern: 600,
  direkt: 3.8, hemisphaere: 1.85, umfeld: .65,
  belichtung: 1.95, schatten: .96,
} as const;

/** Volles Ortslicht am Straßenraum, weicher Auslauf zur übrigen Region und bei Nacht. */
export function milbingerLichtanteil(rahmen: THREE.Vector4, x: number, z: number, sonnenstaerke: number): number {
  const dx = Math.max(0, rahmen.x - x, x - rahmen.z), dz = Math.max(0, rahmen.y - z, z - rahmen.w);
  return (1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dz), 11, 56))
    * THREE.MathUtils.smoothstep(sonnenstaerke, .85, 1.8);
}
