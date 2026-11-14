/**
 * BRACHLAND — Spiegelbild auf stillem Wasser (D280, `?gewaesser=1` / `?echt=1`)
 *
 * Teiche und Weiher spiegelten nur die Himmelskarte: Bei flachem Blick lag eine helle, glatte Fläche wie
 * Eis zwischen den Ufern, ohne das Spiegelbild der Bäume (Teich-Render 14.11.2026). Stilles Wasser wirkt
 * erst mit dem Spiegelbild der Umgebung echt. Hier: **eine** waagerechte Spiegelebene je Bild — die des
 * nächsten gemeldeten Stillgewässers —, ein Szenenpass aus der gespiegelten Kamera in ein halb so grosses
 * HalfFloat-Ziel, mit schräger Clip-Ebene (Lengyel), damit nichts unter dem Spiegel ins Bild kommt.
 * Das Wassermaterial (`bandmaterial.ts`) liest das Bild über `SPIEGELBILD.matrix` und ersetzt damit die
 * Himmelsstrahlung, wo die Fläche auf der Spiegelhöhe liegt; Fresnel und Wellen bleiben im Material.
 *
 * Kosten: ein zusätzlicher Szenenpass in halber Auflösung, nur solange ein Gewässer nahe ist (ADR-0016,
 * Stufe „Ultra“). Wasserflächen selbst werden für den Pass ausgeblendet (`userData.istWasser`).
 */
import * as THREE from 'three';

/** Uniforms, die jedes Wassermaterial teilt. `an` 0 = kein Spiegelbild in diesem Bild. */
export const SPIEGELBILD = {
  karte: { value: null as THREE.Texture | null },
  matrix: { value: new THREE.Matrix4() },
  hoehe: { value: 0 },
  an: { value: 0 },
};

export interface Spiegelflaeche { x: number; z: number; hoehe: number; radius: number }
const flaechen = new Set<Spiegelflaeche>();

/** Ein Stillgewässer anmelden; gibt die Abmeldung zurück. */
export function meldeSpiegelflaeche(f: Spiegelflaeche): () => void {
  flaechen.add(f);
  return () => { flaechen.delete(f); };
}

/** Wie weit ausserhalb des Gewässers das Spiegelbild noch gerechnet wird (Meter). */
const REICHWEITE = 160;

export class Spiegelbild {
  private ziel = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
  private kamera = new THREE.PerspectiveCamera();
  private wasser: THREE.Object3D[] = [];
  private bild = 0;
  private groesse = new THREE.Vector2();
  private v = new THREE.Vector3(); private ziel3 = new THREE.Vector3(); private blick = new THREE.Vector3();
  private dreh = new THREE.Matrix4(); private ebene = new THREE.Plane(); private clip = new THREE.Vector4();
  private q = new THREE.Vector4(); private oben = new THREE.Vector3(0, 1, 0);

  constructor() { SPIEGELBILD.karte.value = this.ziel.texture; }

  dispose(): void { this.ziel.dispose(); SPIEGELBILD.an.value = 0; SPIEGELBILD.karte.value = null; }

  /** Vor dem Hauptbild aufrufen. */
  aktualisiere(gl: THREE.WebGLRenderer, szene: THREE.Scene, kamera: THREE.PerspectiveCamera): void {
    const k = kamera.position;
    let beste: Spiegelflaeche | null = null, bestAbstand = Infinity;
    for (const f of flaechen) {
      if (k.y <= f.hoehe + 0.05) continue;   // unter Wasser: kein Spiegel von oben
      const d = Math.hypot(k.x - f.x, k.z - f.z) - f.radius;
      if (d < REICHWEITE && d < bestAbstand) { bestAbstand = d; beste = f; }
    }
    if (!beste) { SPIEGELBILD.an.value = 0; return; }
    const h = beste.hoehe;
    if (this.bild === 0) console.info(`[spiegel] Ebene ${h.toFixed(2)} m bei ${beste.x.toFixed(0)}/${beste.z.toFixed(0)}, ${flaechen.size} Flächen`);

    // Zielgrösse: halbe Zeichenfläche.
    gl.getDrawingBufferSize(this.groesse);
    const b = Math.max(2, Math.round(this.groesse.x / 2)), hh = Math.max(2, Math.round(this.groesse.y / 2));
    if (this.ziel.width !== b || this.ziel.height !== hh) this.ziel.setSize(b, hh);

    // Wasserflächen alle 60 Bilder neu sammeln (Kacheln kommen und gehen).
    if (this.bild++ % 60 === 0) {
      this.wasser = [];
      szene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        const ms = Array.isArray(m) ? m : m ? [m] : [];
        if (ms.some((x) => x.userData?.istWasser)) this.wasser.push(o);
      });
    }

    // Gespiegelte Kamera an der Ebene y = h (nach three.js `Reflector`).
    const r = this.kamera;
    r.copy(kamera, false);
    r.position.set(k.x, 2 * h - k.y, k.z);
    this.dreh.extractRotation(kamera.matrixWorld);
    this.blick.set(0, 0, -1).applyMatrix4(this.dreh).add(k);
    this.ziel3.set(this.blick.x, 2 * h - this.blick.y, this.blick.z);
    r.up.set(0, 1, 0).applyMatrix4(this.dreh); r.up.y = -r.up.y;
    r.lookAt(this.ziel3);
    r.updateMatrixWorld();
    r.projectionMatrix.copy(kamera.projectionMatrix);
    r.projectionMatrix.elements[8] *= -1; r.projectionMatrix.elements[12] *= -1;

    SPIEGELBILD.matrix.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(r.projectionMatrix).multiply(r.matrixWorldInverse);

    // Schräge Clip-Ebene: nur, was über dem Spiegel liegt.
    this.ebene.setFromNormalAndCoplanarPoint(this.oben, this.v.set(beste.x, h, beste.z)).applyMatrix4(r.matrixWorldInverse);
    this.clip.set(this.ebene.normal.x, this.ebene.normal.y, this.ebene.normal.z, this.ebene.constant);
    const p = r.projectionMatrix.elements;
    this.q.set((Math.sign(this.clip.x) + p[8]) / p[0], (Math.sign(this.clip.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14]);
    this.clip.multiplyScalar(2 / this.clip.dot(this.q));
    p[2] = this.clip.x; p[6] = this.clip.y; p[10] = this.clip.z + 1; p[14] = this.clip.w;
    r.projectionMatrixInverse.copy(r.projectionMatrix).invert();

    const sichtbar = this.wasser.map((o) => o.visible);
    this.wasser.forEach((o) => { o.visible = false; });
    const vorher = gl.getRenderTarget(), schatten = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    gl.setRenderTarget(this.ziel);
    gl.clear();
    gl.render(szene, r);
    gl.setRenderTarget(vorher);
    gl.shadowMap.autoUpdate = schatten;
    this.wasser.forEach((o, i) => { o.visible = sichtbar[i]; });

    SPIEGELBILD.hoehe.value = h;
    SPIEGELBILD.an.value = 1;
  }
}
