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

/** Volles Ortslicht am Straßenraum, weicher Auslauf zur übrigen Region und bei Nacht. */
export function milbingerLichtanteil(rahmen: THREE.Vector4, x: number, z: number, sonnenstaerke: number): number {
  const dx = Math.max(0, rahmen.x - x, x - rahmen.z), dz = Math.max(0, rahmen.y - z, z - rahmen.w);
  return (1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dz), 11, 56))
    * THREE.MathUtils.smoothstep(sonnenstaerke, .85, 1.8);
}
