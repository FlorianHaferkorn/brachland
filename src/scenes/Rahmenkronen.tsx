/**
 * BRACHLAND — Rahmenkronen an der Felsmulde (D443, Look-Durchgang nach dem Messbild D442), `?lookfels=1`.
 *
 * Befund D442: Im Spiel ist ein Viertel des Bildes flacher Himmel (28,9 %), im Zielbild 4,9 % — dort schliessen
 * breite, tief ansetzende Kronen den Himmel links und rechts, über dem Bogen bleibt ein Fenster. Die Bäume des
 * Spiels sind hochstämmige Waldbuchen mit der Krone weit oben; an der Felsmulde stehen davon nur Stangen im Bild.
 *
 * Hier stehen dieselben 13 Bäume wie im Render (`tools/stilframes.py` `baeume3`, Runde 4: Art, Lage, Höhe) als
 * Kronenmassen aus Blattkarten: Büschelatlas `laub-bueschel.webp` (gebacken aus Poly-Haven-Bäumen, CC0, D282),
 * Karten auf einer Kronenhülle, nach aussen gerichtet (dann schattiert die Krone wie ein Körper: Licht- und
 * Schattenseite statt Rauschen), Stamm und zwei Äste, Schattenwurf an. Ein Draw Call für alle Karten.
 * Lage im Render (X, Y) → Spiel: x = −800 + X, z = 600 − Y (`tools/terrainexport.ts`).
 *
 * Werte sind Messaufbau aus dem Render, keine Spielwerte — deshalb hier und nicht in `content/`; bevor das
 * zur Vorgabe wird, gehören die Kronen als Bauminhalt in die Daten (ADR-0004).
 */
import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';

type Art = 'a' | 'b' | 'k';
/** (Art, X, Y, Höhe in m) aus `baeume3`, Runde 4 (Höhen 0/2/3/4/5 überschrieben). */
const BAEUME: [Art, number, number, number][] = [
  ['a', -6.5, 7.4, 16.0], ['b', -1.0, 11.6, 12.0], ['a', 8.5, 10.5, 19.0], ['a', 15.0, 5.0, 18.0], ['b', 10.5, -7.8, 13.5],
  ['a', 9.5, -11.8, 17.5], ['k', 6.6, -10.2, 7.0], ['b', -14.5, -12.0, 11.0], ['a', -9.6, -9.4, 9.5],
  ['k', 7.2, 2.8, 5.5], ['k', -9.8, 9.8, 5.0], ['k', 2.8, 9.9, 4.5], ['k', 12.5, 0.5, 6.0],
];
/** Kronenform je Art: Ansatz und Breite als Anteil der Höhe (island_tree_01 breit und tief, 02 schlanker). */
const FORM: Record<Art, { ansatz: number; breite: number }> = { a: { ansatz: 0.32, breite: 0.46 }, b: { ansatz: 0.40, breite: 0.34 }, k: { ansatz: 0.30, breite: 0.40 } };

function zufall(saat: number) { let s = saat >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function Rahmenkronen({ hoeheAn }: { hoeheAn: (x: number, z: number) => number }) {
  const textur = useLoader(THREE.TextureLoader, '/material/laub-bueschel.webp');
  const { karten, staemme } = useMemo(() => {
    textur.colorSpace = THREE.SRGBColorSpace; textur.anisotropy = 4;
    const r = zufall(439);
    // Karte: Quadrat mit Atlas-Kachel als Attribut (4 × 4)
    const ebene = new THREE.PlaneGeometry(1, 1);
    const matrizen: THREE.Matrix4[] = []; const kachel: number[] = []; const ton: number[] = [];
    const stammGeo: THREE.BufferGeometry[] = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), n = new THREE.Vector3(), z0 = new THREE.Vector3(0, 0, 1);
    for (const [art, X, Y, h] of BAEUME) {
      const x = -800 + X, z = 600 - Y, y0 = hoeheAn(x, z);
      const f = FORM[art]; const rw = f.breite * h, rv = (1 - f.ansatz) * h * 0.5, cy = y0 + f.ansatz * h + rv;
      const anzahl = Math.round(rw * rw * 9);                    // Kartenzahl wächst mit der Kronenfläche
      for (let i = 0; i < anzahl; i++) {
        // Punkt nahe der Hülle (Hülle zählt fürs Bild, das Innere ist Schatten), Unterseite flacher
        const u = r() * 2 - 1, w = r() * Math.PI * 2, t = 0.72 + 0.28 * Math.cbrt(r());
        const rr = Math.sqrt(1 - u * u);
        n.set(rr * Math.cos(w), u, rr * Math.sin(w));
        p.set(x + n.x * rw * t, cy + n.y * rv * t * (n.y < 0 ? 0.7 : 1.0), z + n.z * rw * t);
        // nach aussen gerichtet, leicht gekippt und gedreht
        n.x += (r() - 0.5) * 0.6; n.y += (r() - 0.5) * 0.6 + 0.15; n.z += (r() - 0.5) * 0.6; n.normalize();
        q.setFromUnitVectors(z0, n); q.multiply(new THREE.Quaternion().setFromAxisAngle(z0, r() * Math.PI * 2));
        const g = (art === 'k' ? 1.0 : 1.5) * (0.8 + r() * 0.5); s.set(g, g, g);
        matrizen.push(m.compose(p, q, s).clone()); kachel.push(Math.floor(r() * 16)); ton.push(0.95 + r() * 0.4 + 0.25 * Math.max(0, n.y));   // Oberseite heller
      }
      // Stamm und zwei Hauptäste
      const st = new THREE.CylinderGeometry(0.018 * h, 0.03 * h, f.ansatz * h + rv * 0.6, 7);
      st.translate(0, (f.ansatz * h + rv * 0.6) / 2, 0); st.rotateZ((r() - 0.5) * 0.12); st.translate(x, y0, z); stammGeo.push(st);
      for (let k = 0; k < 2; k++) {
        const len = rw * 0.8, a = r() * Math.PI * 2;
        const ast = new THREE.CylinderGeometry(0.008 * h, 0.014 * h, len, 5); ast.translate(0, len / 2, 0);
        ast.rotateZ(-0.9); ast.rotateY(a); ast.translate(x, y0 + f.ansatz * h * 0.95, z); stammGeo.push(ast);
      }
    }
    const geo = ebene.clone();
    const karten = new THREE.InstancedMesh(geo, undefined as unknown as THREE.Material, matrizen.length);
    matrizen.forEach((mm, i) => karten.setMatrixAt(i, mm));
    geo.setAttribute('kachel', new THREE.InstancedBufferAttribute(new Float32Array(kachel), 1));
    geo.setAttribute('ton', new THREE.InstancedBufferAttribute(new Float32Array(ton), 1));
    const mat = new THREE.MeshStandardMaterial({ map: textur, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, emissive: new THREE.Color('#5a6a20'), emissiveIntensity: 0.35, emissiveMap: textur });
    // Lichtdurchlass (Blätter im Gegenlicht leuchten gelbgrün, Zielbild): Eigenleuchten aus der Blattfarbe statt Transmission
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float kachel;\nattribute float ton;\nvarying float vTon;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vMapUv = (uv + vec2(mod(kachel, 4.0), floor(kachel / 4.0))) / 4.0;\n  vTon = ton;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTon;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb *= vTon;');
    };
    const tiefe = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: textur, alphaTest: 0.45 });
    tiefe.onBeforeCompile = mat.onBeforeCompile;
    karten.material = mat; karten.customDepthMaterial = tiefe; karten.castShadow = true; karten.receiveShadow = false;   // Eigenschatten der Karten machte die Kronen schwarz (erste Probe)
    karten.frustumCulled = false;
    let stamm: THREE.BufferGeometry | null = null;
    // Stämme zusammenführen (ein Draw Call)
    const pos: number[] = [], nor: number[] = [], idx: number[] = []; let off = 0;
    for (const g of stammGeo) {
      const ng = g.index ? g.toNonIndexed() : g; ng.computeVertexNormals();
      const a = ng.getAttribute('position'), b = ng.getAttribute('normal');
      for (let i = 0; i < a.count; i++) { pos.push(a.getX(i), a.getY(i), a.getZ(i)); nor.push(b.getX(i), b.getY(i), b.getZ(i)); idx.push(off + i); }
      off += a.count;
    }
    stamm = new THREE.BufferGeometry(); stamm.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); stamm.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); stamm.setIndex(idx);
    const stMesh = new THREE.Mesh(stamm, new THREE.MeshStandardMaterial({ color: '#4a3f35', roughness: 0.95 }));
    stMesh.castShadow = true; stMesh.receiveShadow = true;
    return { karten, staemme: stMesh };
  }, [textur, hoeheAn]);
  return <group><primitive object={karten} /><primitive object={staemme} /></group>;
}
