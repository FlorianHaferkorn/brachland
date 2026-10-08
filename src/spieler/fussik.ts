/**
 * BRACHLAND — Füsse auf dem Boden (D214, ADR-0012)
 *
 * Die Clips laufen auf ebenem Grund. Am Hang stand deshalb ein Fuss in der Luft und der andere im
 * Boden — der eine Fehler, an dem man eine Spielfigur sofort von Elden Ring unterscheidet. Hier,
 * nach dem Mixer und vor dem Zeichnen:
 *
 * 1. Für jeden Fuss die Bodenhöhe unter ihm gegen die Höhe unter der Figurmitte.
 * 2. Die Hüfte sinkt um den tieferen der beiden Versätze (nur abwärts) — sonst reicht das Bein
 *    hangabwärts nicht hinunter.
 * 3. Jedes Bein wird mit einer analytischen Zwei-Knochen-IK auf seinen Zielpunkt gebeugt: Fuss
 *    bleibt so hoch über **seinem** Boden, wie der Clip ihn über dem ebenen Boden hält (Schritt-
 *    hub bleibt erhalten). Die Fussdrehung in Weltlage bleibt die des Clips.
 *
 * Keine Physik, kein Strahl gegen Modelle: `hoeheAn` ist dieselbe Höhe, auf der die Figur steht.
 * In der Luft (Sprung, Gleiten), im Sattel oder ohne Knochen tut die Funktion nichts.
 */
import * as THREE from 'three';

export interface BeinKnochen {
  ol: THREE.Object3D | null; ul: THREE.Object3D | null; fl: THREE.Object3D | null;
  or: THREE.Object3D | null; ur: THREE.Object3D | null; fr: THREE.Object3D | null;
}

export interface FussZustand {
  /** Geglättete Hüftsenkung in Metern (≤ 0). */
  becken: number;
  /** Geglättete Bodenversätze je Fuss. */
  links: number;
  rechts: number;
  /** Wirkung 0…1, blendet beim Abheben und Landen weich. */
  an: number;
}

export const neuerFussZustand = (): FussZustand => ({ becken: 0, links: 0, rechts: 0, an: 0 });

/** Tiefer als das senkt sich die Hüfte nicht — darunter wäre es Knien, kein Stehen am Hang. */
const BECKEN_MAX = 0.35;
/** Steht die Figur höher als das über dem Boden, ist sie in der Luft. */
const LUFT = 0.18;

const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), vt = new THREE.Vector3();
const ab = new THREE.Vector3(), ac = new THREE.Vector3(), at = new THREE.Vector3(), ba = new THREE.Vector3(), bc = new THREE.Vector3();
const achse0 = new THREE.Vector3(), achse1 = new THREE.Vector3(), lokal = new THREE.Vector3();
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qf = new THREE.Quaternion(), qp = new THREE.Quaternion();
const dreh = new THREE.Quaternion();
const vor = new THREE.Vector3();

const winkel = (u: THREE.Vector3, v: THREE.Vector3) => Math.acos(THREE.MathUtils.clamp(u.dot(v), -1, 1));

/**
 * Zwei-Knochen-IK nach Holden („Simple Two Joint IK“): erst das Knie auf den richtigen Winkel,
 * dann das ganze Bein zum Ziel drehen. `vorne` ist die Blickrichtung der Figur — die Kniebeuge-
 * Achse, falls das Bein ganz gestreckt ist und sich keine Ebene ergibt.
 */
function zweiKnochen(a: THREE.Object3D, b: THREE.Object3D, c: THREE.Object3D, ziel: THREE.Vector3, vorne: THREE.Vector3): void {
  a.getWorldPosition(va); b.getWorldPosition(vb); c.getWorldPosition(vc);
  c.getWorldQuaternion(qf);
  const lab = vb.distanceTo(va), lcb = vc.distanceTo(vb);
  const lat = THREE.MathUtils.clamp(ziel.distanceTo(va), 0.01, lab + lcb - 0.001);
  ab.subVectors(vb, va).normalize(); ac.subVectors(vc, va).normalize(); at.subVectors(ziel, va).normalize();
  ba.subVectors(va, vb).normalize(); bc.subVectors(vc, vb).normalize();
  const acab0 = winkel(ac, ab), babc0 = winkel(ba, bc), acat0 = winkel(ac, at);
  const acab1 = Math.acos(THREE.MathUtils.clamp((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat), -1, 1));
  const babc1 = Math.acos(THREE.MathUtils.clamp((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb), -1, 1));
  achse0.crossVectors(ac, ab);
  if (achse0.lengthSq() < 1e-8) achse0.crossVectors(ac, vorne);
  achse0.normalize();
  achse1.crossVectors(ac, at);
  const mitDrehung = achse1.lengthSq() > 1e-10;
  if (mitDrehung) achse1.normalize();

  a.getWorldQuaternion(qa); b.getWorldQuaternion(qb);
  // Oberschenkel: Kniewinkel, dann zum Ziel.
  lokal.copy(achse0).applyQuaternion(qa.clone().invert());
  a.quaternion.multiply(dreh.setFromAxisAngle(lokal, acab1 - acab0));
  if (mitDrehung) {
    lokal.copy(achse1).applyQuaternion(qa.clone().invert());
    a.quaternion.multiply(dreh.setFromAxisAngle(lokal, acat0));
  }
  // Unterschenkel: Kniewinkel.
  lokal.copy(achse0).applyQuaternion(qb.clone().invert());
  b.quaternion.multiply(dreh.setFromAxisAngle(lokal, babc1 - babc0));
  // Fuss: Weltdrehung des Clips behalten.
  a.updateMatrixWorld(true);
  c.parent!.getWorldQuaternion(qp);
  c.quaternion.copy(qp.invert().multiply(qf));
  c.updateMatrixWorld(true);
}

/**
 * Füsse auf den Boden setzen. `figur` ist die Wurzel des Modells (wird um die Hüftsenkung
 * verschoben), `hoeheAn` die Geländehöhe, `aktiv` false im Sattel oder ohne Bodenkontakt.
 */
export function setzeFuesse(
  k: BeinKnochen, figur: THREE.Object3D, hoeheAn: (x: number, z: number) => number,
  z: FussZustand, dt: number, aktiv: boolean,
): void {
  if (!k.ol || !k.ul || !k.fl || !k.or || !k.ur || !k.fr) return;
  figur.position.y = 0;
  figur.updateMatrixWorld(true);
  figur.getWorldPosition(vt);
  const mitte = hoeheAn(vt.x, vt.z);
  const amBoden = aktiv && Math.abs(vt.y - mitte) < LUFT;
  const glatt = Math.min(1, dt * 12);
  z.an += ((amBoden ? 1 : 0) - z.an) * Math.min(1, dt * 6);
  if (z.an < 0.01) { z.an = 0; z.becken = 0; z.links = 0; z.rechts = 0; return; }

  k.fl.getWorldPosition(va); k.fr.getWorldPosition(vb);
  const zielL = THREE.MathUtils.clamp(hoeheAn(va.x, va.z) - mitte, -0.6, 0.6);
  const zielR = THREE.MathUtils.clamp(hoeheAn(vb.x, vb.z) - mitte, -0.6, 0.6);
  z.links += (zielL - z.links) * glatt;
  z.rechts += (zielR - z.rechts) * glatt;
  z.becken += (Math.max(-BECKEN_MAX, Math.min(0, z.links, z.rechts)) - z.becken) * glatt;

  const becken = z.becken * z.an;
  figur.position.y = becken;
  figur.updateMatrixWorld(true);
  vor.set(0, 0, 1).applyQuaternion(figur.getWorldQuaternion(qa));

  for (const [o, u, f, versatz] of [[k.ol, k.ul, k.fl, z.links], [k.or, k.ur, k.fr, z.rechts]] as const) {
    const hub = (versatz - z.becken) * z.an;
    if (Math.abs(hub) < 0.004) continue;
    f.getWorldPosition(vt);
    vt.y += hub;
    zweiKnochen(o, u, f, vt.clone(), vor);
  }
}
