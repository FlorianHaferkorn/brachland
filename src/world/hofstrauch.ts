/** D299: Mehrstämmige Sträucher mit Blattbüscheln statt bemalter Knollenkörper. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { baueWindMaterial } from './windmaterial.js';
import { bueschelTextur } from './laubkarten.js';
import { MSAA } from './echt.js';

function zufall(saat: number): () => number {
  let a = saat >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Einmal je Variante. Alle Karten sitzen an derselben verzweigten Quellform, auch in der Mittelstufe. */
export function baueHofStrauch(variante: number, hoehe: number): THREE.BufferGeometry {
  if (!Number.isFinite(hoehe) || hoehe <= 0) throw Error('Strauchhöhe muss positiv sein.');
  const rnd = zufall(3071 + variante * 137), teile: THREE.BufferGeometry[] = [];
  const farbe = new THREE.Color('#4a4033');
  const ast = (von: THREE.Vector3, bis: THREE.Vector3, dicke: number) => {
    const d = bis.clone().sub(von), g = new THREE.CylinderGeometry(dicke * 0.38, dicke, d.length(), 5, 1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
    g.translate(...von.clone().add(bis).multiplyScalar(0.5).toArray());
    const n = g.getAttribute('position').count;
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => farbe.toArray()).flat(), 3));
    g.setAttribute('blatt', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
    const wind = new Float32Array(n), p = g.getAttribute('position');
    for (let i = 0; i < n; i++) wind[i] = Math.max(0, p.getY(i)) ** 1.5;
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(wind, 1));
    teile.push(g.toNonIndexed()); g.dispose();
  };
  const karte = (mitte: THREE.Vector3, ursprung: THREE.Vector3) => {
    const g = new THREE.PlaneGeometry(0.24 + rnd() * 0.09, 0.22 + rnd() * 0.1);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * Math.PI, rnd() * Math.PI * 2, rnd() * Math.PI));
    g.applyQuaternion(q); g.translate(...mitte.toArray());
    // Glatte Hüllnormale des Zweigbüschels statt Lichtwechsel auf jeder einzelnen Karte.
    const normal = mitte.clone().sub(ursprung).normalize();
    normal.y = normal.y * 0.65 + 0.3; normal.normalize();
    const p = g.getAttribute('position'), n = p.count, normen: number[] = [], farben: number[] = [];
    const ton = 0.88 + rnd() * 0.18;
    for (let i = 0; i < n; i++) { normen.push(...normal.toArray()); farben.push(ton, ton, ton); }
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normen, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
    g.setAttribute('blatt', new THREE.Float32BufferAttribute(new Float32Array(n).fill(1), 1));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(Array.from({ length: n }, (_, i) => Math.max(0, p.getY(i)) ** 1.5), 1));
    const uv = g.getAttribute('uv'), kachel = Math.floor(rnd() * 16);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (0.005 + uv.getX(i) * 0.99 + kachel % 4) / 4,
      (0.005 + uv.getY(i) * 0.99 + Math.floor(kachel / 4)) / 4);
    teile.push(g.toNonIndexed()); g.dispose();
  };
  // Ungleich hohe Stämme und seitliche Endzweige lassen Zwischenräume statt einer Kugelhülle.
  for (let stamm = 0; stamm < 5; stamm++) {
    const winkel = rnd() * Math.PI * 2, laenge = 0.3 + rnd() * 0.2;
    const fuss = new THREE.Vector3(Math.cos(winkel) * 0.08, 0, Math.sin(winkel) * 0.08);
    const gabel = new THREE.Vector3(Math.cos(winkel) * laenge * 0.6, 0.3 + rnd() * 0.26, Math.sin(winkel) * laenge * 0.6);
    ast(fuss, gabel, 0.018 + rnd() * 0.007);
    for (let zweig = 0; zweig < 3; zweig++) {
      const a = winkel + (rnd() - 0.5) * 2.6;
      const ende = new THREE.Vector3(Math.cos(a) * laenge, gabel.y + 0.08 + rnd() * 0.24, Math.sin(a) * laenge);
      ast(gabel, ende, 0.008);
      for (let blatt = 0; blatt < 12; blatt++) {
        const az = rnd() * Math.PI * 2, z = rnd() * 2 - 1, r = Math.sqrt(Math.max(0, 1 - z * z));
        const mitte = ende.clone().add(new THREE.Vector3(Math.cos(az) * r * 0.19, z * 0.18, Math.sin(az) * r * 0.19));
        karte(mitte, ende);
      }
    }
  }
  const g = mergeGeometries(teile, false)!;
  teile.forEach(t => t.dispose());
  g.computeBoundingBox();
  const faktor = hoehe / (g.boundingBox!.max.y - g.boundingBox!.min.y);
  g.translate(0, -g.boundingBox!.min.y, 0); g.scale(faktor, faktor, faktor);
  g.computeBoundingBox(); g.computeBoundingSphere();
  g.boundingSphere!.radius += 0.25; // Reserve für Wind; kein Abschneiden am Bildrand.
  return g;
}

const geometrien = new Map<string, THREE.BufferGeometry>();
export function hofStrauchGeometrie(variante: number, hoehe: number): THREE.BufferGeometry {
  const k = `${variante}:${hoehe}`;
  let g = geometrien.get(k);
  if (!g) { g = baueHofStrauch(variante, hoehe); geometrien.set(k, g); }
  return g;
}

let material: ReturnType<typeof baueWindMaterial> | null = null;
export function hofStrauchMaterial(): THREE.MeshStandardMaterial {
  if (!material) {
    const m = new THREE.MeshStandardMaterial({ map: bueschelTextur('laub'), vertexColors: true,
      side: THREE.DoubleSide, roughness: 0.95, metalness: 0, alphaTest: 0.45, alphaToCoverage: MSAA > 0 });
    // Der Windbau muss den Karten-/Zweighook vor Material.clone() sichern (D298).
    m.userData.hofProbe = true;
    m.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float blatt; varying float vStrauchBlatt;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStrauchBlatt = blatt;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vStrauchBlatt;')
        .replace('#include <map_fragment>', 'diffuseColor *= mix(vec4(1.0), texture2D(map, vMapUv), vStrauchBlatt);')
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(mix(normal, normalize(vNormal), vStrauchBlatt));');
    };
    m.customProgramCacheKey = () => 'hofstrauch-karten-v1';
    material = baueWindMaterial({ amplitude: 0.12, randFarbe: new THREE.Color(0, 0, 0), randStaerke: 0, durchlass: 0.22 }, m);
    m.dispose();
  }
  return material.material;
}
export function setzeHofStrauchZeit(zeit: number): void { material?.setzeZeit(zeit); }
