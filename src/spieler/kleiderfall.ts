/** Sekundärbewegung am freien Tunika-Saum der quantisierten Quaternius-Gestalten. */
import * as THREE from 'three';

const an = typeof location === 'undefined' || new URLSearchParams(location.search).get('kleiderfall') !== '0';
const formen = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
/** Maximale Auslenkung in der Bindepose für die bewegte Sicht- und Schattenhülle. */
export const saumRadius = new WeakMap<THREE.BufferGeometry, number>();

function saumGeometrie(original: THREE.BufferGeometry): THREE.BufferGeometry {
  const vorhanden = formen.get(original);
  if (vorhanden) return vorhanden;
  const geo = original.clone();
  geo.computeBoundingBox();
  const box = geo.boundingBox!, pos = geo.getAttribute('position'), normal = geo.getAttribute('normal');
  const h = box.max.y - box.min.y;
  const rueck = new THREE.Vector3(), seite = new THREE.Vector3(), punkt = new THREE.Vector3();
  const n = new THREE.Vector3(), t = new THREE.Vector3(), b = new THREE.Vector3();
  const u = new THREE.Vector3(), v = new THREE.Vector3();
  const mitteX = (box.max.x + box.min.x) * .5, mitteZ = (box.max.z + box.min.z) * .5;
  // Bindekoordinaten sind je GLB anders quantisiert. Das freie untere Drittel relativ zur
  // Kleidungsstückhöhe bemessen. Alle vier gerichteten Formen lassen die Gegenseite anliegen.
  const versatz = (p: THREE.Vector3, art: number, aus: THREE.Vector3) => {
    const frei = 1 - THREE.MathUtils.smoothstep((p.y - box.min.y) / h, 0, .34);
    const x = p.x - mitteX, z = p.z - mitteZ;
    if (art === 5) return aus.set(0, .065 * h * frei, 0);
    if (art === 4) return aus.set(.20 * z * frei, 0, -.20 * x * frei);
    const dx = art === 0 ? 1 : art === 1 ? -1 : 0;
    const dz = art === 2 ? 1 : art === 3 ? -1 : 0;
    const anteil = THREE.MathUtils.smoothstep((dx * x + dz * z) / h, -.10, .12);
    const f = frei * anteil * h;
    return aus.set(dx * .115 * f, .035 * f, dz * .115 * f);
  };
  geo.morphTargetsRelative = true;
  geo.morphAttributes.position = [];
  geo.morphAttributes.normal = [];
  const maxima = new Float32Array(6);
  for (let art = 0; art < 6; art++) {
    const xyz = new Float32Array(pos.count * 3), normalen = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      punkt.fromBufferAttribute(pos, i);
      versatz(punkt, art, rueck).toArray(xyz, i * 3);
      maxima[art] = Math.max(maxima[art], rueck.length());
      if (rueck.lengthSq() === 0) continue;
      // Die exportierten weichen Normalen entlang zweier Tangenten mitbiegen, UV-Nähte bleiben glatt.
      n.fromBufferAttribute(normal, i).normalize();
      t.set(Math.abs(n.y) > .8 ? 1 : 0, Math.abs(n.y) > .8 ? 0 : 1, 0).cross(n).normalize();
      b.crossVectors(n, t);
      const schritt = h * .001;
      versatz(seite.copy(punkt).addScaledVector(t, schritt), art, u).sub(rueck).addScaledVector(t, schritt);
      versatz(seite.copy(punkt).addScaledVector(b, schritt), art, v).sub(rueck).addScaledVector(b, schritt);
      u.cross(v).normalize().sub(n).toArray(normalen, i * 3);
    }
    geo.morphAttributes.position.push(new THREE.BufferAttribute(xyz, 3));
    geo.morphAttributes.normal.push(new THREE.BufferAttribute(normalen, 3));
  }
  // Je Achse ist nur eine Richtung aktiv; die Drehung darf mit beiden zusammenfallen.
  saumRadius.set(geo, Math.max(maxima[0], maxima[1]) + Math.max(maxima[2], maxima[3]) + maxima[4] + maxima[5]);
  formen.set(original, geo);
  original.addEventListener('dispose', () => { geo.dispose(); formen.delete(original); });
  return geo;
}

export function baueKleiderfall(figur: THREE.Object3D) {
  if (!an) return null;
  const rock = figur.getObjectByName('Female_Ranger_Body') ?? figur.getObjectByName('Male_Ranger_Body')
    ?? figur.getObjectByName('Female_Peasant_Body') ?? figur.getObjectByName('Male_Peasant_Body');
  if (!(rock instanceof THREE.SkinnedMesh)) return null;
  const original = rock.geometry;
  if (original.morphAttributes.position?.length) return null;
  rock.geometry = saumGeometrie(original);
  rock.updateMorphTargets();
  const gewicht = rock.morphTargetInfluences!;
  const links = figur.getObjectByName('thigh_l')?.quaternion, rechts = figur.getObjectByName('thigh_r')?.quaternion;
  let altX = NaN, altY = 0, altZ = 0, altGier = 0, altHubtempo = 0;
  const lage = [0, 0, 0, 0], tempo = [0, 0, 0, 0];
  return {
    schritt(dt: number, ort: THREE.Vector3, gier: number) {
      const { x, y, z } = ort;
      const dx = x - altX, dy = y - altY, dz = z - altZ, dreh = gier - altGier;
      altX = x; altY = y; altZ = z; altGier = gier;
      const weg = Math.hypot(dx, dz);
      if (!Number.isFinite(weg) || dt <= 0 || dt > .25 || weg > 2.5 || Math.abs(dy) > 2.5) {
        gewicht.fill(0); lage.fill(0); tempo.fill(0); altHubtempo = 0; return;
      }
      if (weg === 0 && dy === 0 && dreh === 0 && !altHubtempo && !lage[0] && !lage[1] && !lage[2] && !lage[3]) return;
      const c = Math.cos(gier), s = Math.sin(gier);
      const druck = Math.min(1, weg / dt / 4);
      // Z-Komponente der beiden animierten Knochenachsen (lokal +Y). Damit kommt der seitliche
      // Impuls direkt vom vorgezogenen Bein, auch wenn der Mixer während eines Schritts überblendet.
      const schere = links && rechts ? 2 * (links.x * links.w + links.y * links.z - rechts.x * rechts.w - rechts.y * rechts.z) : 0;
      const quer = -(dx * c - dz * s) / (dt * 4) + druck * .32 * schere;
      const laengs = -(dx * s + dz * c) / (dt * 4);
      // Beim schlagartigen Wenden wirkt der ganze Winkel als Impuls. Bei der Landung trägt
      // das Gewand sein letztes Falltempo noch kurz weiter, während der Körper schon bremst.
      tempo[2] -= 19 * Math.atan2(Math.sin(dreh), Math.cos(dreh));
      const hubtempo = dy / dt;
      tempo[3] -= 2.6 * THREE.MathUtils.clamp(hubtempo - altHubtempo, -8, 8);
      altHubtempo = hubtempo;
      // Gedämpfte Feder analytisch fortschreiben: gleicher Fall bei 30/60/120 Hz, Nachlauf beim Anhalten.
      const omega = 13, abfall = Math.exp(-omega * dt);
      for (let i = 0; i < 4; i++) {
        const ziel = THREE.MathUtils.clamp(i === 0 ? quer : i === 1 ? laengs : i === 3 ? -hubtempo * .12 : 0, -1, 1);
        const abstand = lage[i] - ziel, impuls = tempo[i] + omega * abstand;
        lage[i] = ziel + (abstand + impuls * dt) * abfall;
        tempo[i] = (tempo[i] - omega * impuls * dt) * abfall;
        if (!ziel && Math.abs(lage[i]) < .0001 && Math.abs(tempo[i]) < .001) lage[i] = tempo[i] = 0;
      }
      gewicht[0] = Math.max(0, lage[0]); gewicht[1] = Math.max(0, -lage[0]);
      gewicht[2] = Math.max(0, lage[1]); gewicht[3] = Math.max(0, -lage[1]);
      gewicht[4] = THREE.MathUtils.clamp(lage[2], -1, 1); gewicht[5] = THREE.MathUtils.clamp(lage[3], -1, 1);
    },
    loese() {
      rock.geometry = original;
      rock.morphTargetInfluences = undefined;
      rock.morphTargetDictionary = undefined;
    },
  };
}
