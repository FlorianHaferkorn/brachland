/** Betretene Erde am Modellhof. Die Linien stammen aus hausframe.py und
 * laufen in lokalen Blender-Metern zur Haustür und zum Tennentor. */
import { MathUtils, Vector4 } from 'three';

type HofwegLage = {
  ort: readonly number[]; drehung: number; querSpiegeln: boolean;
  trittwege?: readonly (readonly (readonly number[])[])[];
};

export function baueHoftrittweg(lagen: readonly HofwegLage[]) {
  const segmente: Vector4[] = [];
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const lage of lagen) {
    const c = Math.cos(lage.drehung), s = Math.sin(lage.drehung);
    for (const linie of lage.trittwege ?? []) {
      let vorher: [number, number] | undefined;
      for (const [u, v] of linie) {
        const quer = lage.querSpiegeln ? v : -v;
        const x = lage.ort[0] + c * u + s * quer, z = lage.ort[2] - s * u + c * quer;
        if (vorher && (x !== vorher[0] || z !== vorher[1])) segmente.push(new Vector4(vorher[0], vorher[1], x - vorher[0], z - vorher[1]));
        vorher = [x, z];
        minX = Math.min(minX, x); minZ = Math.min(minZ, z); maxX = Math.max(maxX, x); maxZ = Math.max(maxZ, z);
      }
    }
  }
  if (!segmente.length) return undefined;
  const rahmen = new Vector4(minX - 2, minZ - 2, maxX + 2, maxZ + 2);
  const deckung = (x: number, z: number) => {
    if (x < rahmen.x || z < rahmen.y || x > rahmen.z || z > rahmen.w) return 0;
    let d2 = Infinity;
    for (const k of segmente) {
      const dx = x - k.x, dz = z - k.y;
      const t = MathUtils.clamp((dx*k.z + dz*k.w) / (k.z*k.z + k.w*k.w), 0, 1);
      d2 = Math.min(d2, (dx - t*k.z)**2 + (dz - t*k.w)**2);
    }
    const breite = 1.3 + .2*Math.sin(.77*x + .41*z) + .1*Math.sin(2.1*z - .8*x);
    return MathUtils.clamp(1.15 - Math.sqrt(d2) / breite, 0, 1);
  };
  const uniforms = { uTrittwegRahmen: { value: rahmen }, uTrittwegSegmente: { value: segmente } };
  const glsl = /* glsl */ `
uniform vec4 uTrittwegRahmen;
uniform vec4 uTrittwegSegmente[${segmente.length}];
float hofTritt(vec2 p) {
  if (any(lessThan(p,uTrittwegRahmen.xy)) || any(greaterThan(p,uTrittwegRahmen.zw))) return 0.0;
  float d2 = 100.0;
  for (int i=0; i<${segmente.length}; ++i) {
    vec4 k = uTrittwegSegmente[i];
    vec2 delta = p-k.xy;
    delta -= k.zw*clamp(dot(delta,k.zw)/dot(k.zw,k.zw),0.0,1.0);
    d2 = min(d2,dot(delta,delta));
  }
  float breite = 1.3 + .2*sin(.77*p.x + .41*p.y) + .1*sin(2.1*p.y - .8*p.x);
  return clamp(1.15-sqrt(d2)/breite,0.0,1.0);
}`;
  return { deckung, glsl, uniforms, anzahl: segmente.length };
}
export type Hoftrittweg = NonNullable<ReturnType<typeof baueHoftrittweg>>;
