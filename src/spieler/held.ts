/**
 * Die Hauptfigur (D175): Wahl aus dem Charakter-Editor und wie sie auf das Modell kommt.
 *
 * Modelle aus `tools/heldbau.py` (Quaternius Universal Base Characters + Modular Outfits, CC0):
 * eine Datei je Gestalt (Körper × Kleidung) unter `/figuren/held/`, alle Frisuren darin als
 * versteckte Netze `Haar_*`, die Clips gemeinsam in `held-clips.glb`.
 *
 * **Geschlecht und Körper sind getrennt.** Das Paket hat zwei Körper; wer „neutral" wählt, wählt den
 * Körper frei, und das Spiel spricht die Figur ohne Pronomen an. Männlich/weiblich setzen nur die
 * Vorgabe für den Körper — umstellen darf man ihn trotzdem.
 */
import * as THREE from 'three';
import { saumRadius } from './kleiderfall.js';
import { useSyncExternalStore } from 'react';

export type Geschlecht = 'm' | 'w' | 'n';
export type Koerper = 'm' | 'w';
export type Kleid = 'waldlaeufer' | 'bauer';
export const HAARE = ['Buzzed', 'BuzzedFemale', 'SimpleParted', 'Long', 'Buns', 'Kahl'] as const;
export type Haar = typeof HAARE[number];

export interface HeldWahl {
  name: string;
  geschlecht: Geschlecht;
  koerper: Koerper;
  kleid: Kleid;
  haar: Haar;
  bart: boolean;
  /** 0 = hell … 1 = dunkel. */
  haut: number;
  /** Haarfarbe als CSS-Farbe. */
  haarfarbe: string;
  /** Tönung der Kleidung (D177, Bewohner aus `farben.oberteil`); ohne Angabe die Textur. */
  kleidfarbe?: string;
}

export const HAARNAMEN: Record<Haar, string> = {
  Buzzed: 'kurz geschoren', BuzzedFemale: 'kurz, weich', SimpleParted: 'gescheitelt', Long: 'lang',
  Buns: 'hochgesteckt', Kahl: 'kahl',
};
export const KLEIDNAMEN: Record<Kleid, string> = { waldlaeufer: 'Waldläufer', bauer: 'Landvolk' };
export const HAARFARBEN = ['#2a1d15', '#4a3020', '#7a5230', '#a8763f', '#c9a36a', '#8a8580', '#6b2a1c'];

const BEWOHNER_GESTALT: Record<string, { koerper: 'm' | 'w'; kleid: 'waldlaeufer' | 'bauer'; alt?: boolean }> = {
  alte: { koerper: 'w', kleid: 'bauer', alt: true }, arbeiter: { koerper: 'm', kleid: 'bauer' },
  baeuerin: { koerper: 'w', kleid: 'bauer' }, bauer: { koerper: 'm', kleid: 'bauer' },
  bursche: { koerper: 'm', kleid: 'waldlaeufer' }, foerster: { koerper: 'm', kleid: 'waldlaeufer' },
  magd: { koerper: 'w', kleid: 'bauer' }, wanderer: { koerper: 'm', kleid: 'waldlaeufer' },
  werkfrau: { koerper: 'w', kleid: 'waldlaeufer' }, wirt: { koerper: 'm', kleid: 'bauer' },
};
/**
 * Bewohner als leichte Gestalt (D176): Körper und Kleid je Figur, Haar und Hautton aus einer Saat
 * aus Figur und Blick — dieselbe Person draussen (`RegionsSzene`) und drinnen (`ui/Stube`, D242).
 */
export function bewohnerWahl(figur: string, blick: number, farben?: Partial<Record<string, string>>): HeldWahl | null {
  const g = BEWOHNER_GESTALT[figur];
  if (!g) return null;
  const saat = Math.abs(Math.round(blick * 7919 + figur.length * 104729));
  const haare: Haar[] = g.koerper === 'm' ? ['Buzzed', 'SimpleParted', 'Kahl', 'Long'] : ['Long', 'Buns', 'BuzzedFemale', 'SimpleParted'];
  return {
    name: figur, geschlecht: g.koerper, koerper: g.koerper, kleid: g.kleid,
    haar: haare[saat % haare.length], bart: g.koerper === 'm' && saat % 3 === 0,
    haut: ((saat >> 3) % 10) / 12, haarfarbe: g.alt ? '#8a8580' : farben?.haar ?? HAARFARBEN[(saat >> 5) % 5],
    // D177: die Jackenfarbe aus dem Inhalt tönt die Kleidung — jeder Bewohner bleibt erkennbar.
    kleidfarbe: farben?.oberteil,
  };
}

export const STANDARD_HELD: HeldWahl = {
  name: 'Wanderin', geschlecht: 'w', koerper: 'w', kleid: 'waldlaeufer', haar: 'Long', bart: false,
  haut: 0.4, haarfarbe: '#4a3020',
};

export function gestaltPfad(w: Pick<HeldWahl, 'koerper' | 'kleid'>): string {
  return `/figuren/held/${w.koerper}-${w.kleid}.glb`;
}
export const HELD_CLIPS = '/figuren/held/held-clips.glb';

/** Anrede ohne Pronomen für „neutral" — die Texte des Spiels nehmen den Namen. */
export function pronomen(g: Geschlecht): { er: string; sein: string } {
  return g === 'm' ? { er: 'er', sein: 'sein' } : g === 'w' ? { er: 'sie', sein: 'ihr' } : { er: '', sein: '' };
}

/** Knochen des neuen Skeletts für Sitzpose und Waffen (UE-Mannequin). */
export const HELD_KNOCHEN = {
  hand: 'hand_r',
  // D429: die linke Hand — an der Fällaxt hält sie das Stielende (`gleiteAmStiel`, `src/kampf/waffenhand.ts`).
  handL: 'hand_l',
  ol: 'thigh_l', or: 'thigh_r', ul: 'calf_l', ur: 'calf_r', fl: 'foot_l', fr: 'foot_r',
  al: 'upperarm_l', ar: 'upperarm_r', el: 'lowerarm_l', er: 'lowerarm_r',
} as const;

/**
 * Hautton (D176): nicht mehr als Tönung (die mittlere Textur liess sich nur abdunkeln — helle Töne
 * wurden flau), sondern im Shader: Die Helligkeit der Textur bleibt als Zeichnung, der Farbton kommt
 * von hier. Farben linear, von hell (#e8bda0) bis dunkel (#4e3224).
 */
export function hautFarbe(haut: number): THREE.Color {
  const hell = new THREE.Color('#e8bda0'), dunkel = new THREE.Color('#4e3224');
  return hell.lerp(dunkel, Math.max(0, Math.min(1, haut)));
}
/** Mittlere Leuchtdichte der Hauttexturen (linear), gemessen im Editorbild — die Zeichnung um 1. */
const HAUT_MITTEL = 0.22;

/**
 * Licht, das alle Figuren teilen (D213): Saum aus der Stimmung (dieselbe Randfarbe, die Kreaturen
 * und die alte Figur über `windmaterial.ts` tragen — die neuen Gestalten hatten ihn nie, ihr Pfad
 * kehrte vor dem Materialtausch zurück). Die Szene setzt die Werte, die Materialien lesen sie.
 */
export const FIGUR_LICHT = {
  saum: { value: new THREE.Color(0, 0, 0) },
  saumStaerke: { value: 0 },
};
export function setzeFigurSaum(farbe: THREE.ColorRepresentation, staerke: number): void {
  FIGUR_LICHT.saum.value.set(farbe);
  FIGUR_LICHT.saumStaerke.value = staerke;
}

/** Stoffanteil, Erdsaum. Die Metallic-Karte schützt Schnallen und Beschläge. */
function kleiderwerte(name: string): THREE.Vector2 {
  if (name.includes('_Feet')) return new THREE.Vector2(.12, 1);
  if (name.includes('_Legs')) return new THREE.Vector2(1, .42);
  if (/_Belt_|_Bracer|_Pauldron/.test(name)) return new THREE.Vector2(.08, 0);
  return new THREE.Vector2(1, 0);
}

const KLEIDER_GLSL = /* glsl */ `
varying vec3 vKleiderPos;
uniform vec2 uKleiderwerte;

float kleiderFleck(vec3 p) {
  p = sin(p * vec3(2.11, 2.73, 1.93) + p.yzx * vec3(.87, .56, 1.31));
  return .5 + .5 * p.x * p.y * p.z;
}
`;

const KLEIDER_ALTERUNG_GLSL = /* glsl */ `
  float faser = uKleiderwerte.x;
  float lederStoff = 1.0 - smoothstep(.06, .42, metalnessFactor);
  float fleck = kleiderFleck(vKleiderPos * 6.3);
  float aufgeraut = smoothstep(.46, .86, fleck * .76 + .24 * kleiderFleck(vKleiderPos * 19.0));
  // Die eingebettete Albedo behält die Konturen von Nähten, Säumen und Schnallen.
  vec3 getragen = diffuseColor.rgb * mix(vec3(1.10, 1.09, 1.06), vec3(.76, .78, .74), fleck);
  getragen = mix(getragen, vec3(dot(getragen, vec3(.2126, .7152, .0722))), .16 + .13 * aufgeraut);
  #ifdef USE_MAP
    // Fadenkreuzung im Stoff. Vor der Subpixelgrenze ausblenden.
    vec2 fadenuv = vMapUv * 248.0;
    vec2 faden = cos(fadenuv * 6.2831853);
    float fadendeckung = 1.0 - smoothstep(.22, .58, max(fwidth(fadenuv.x), fwidth(fadenuv.y)));
    getragen *= 1.0 + faser * fadendeckung * (.034 * faden.x + .022 * faden.y + .014 * faden.x * faden.y);
  #endif
  // Im Modell jedes Schuhs bzw. Hosenbeins liegt der Saum am unteren Rand der Bindepose.
  float erde = (1.0 - smoothstep(-.84, -.27 + .38 * fleck, vKleiderPos.y)) * uKleiderwerte.y;
  vec3 staubig = mix(getragen * vec3(.78, .74, .65), vec3(.15, .107, .067), .37 + .11 * aufgeraut);
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(getragen, staubig, erde * (.50 + .48 * fleck)), lederStoff);
  roughnessFactor = mix(roughnessFactor, max(roughnessFactor, .69 + .20 * faser + .08 * aufgeraut), lederStoff);
`;

/**
 * Figurshader (D213, ADR-0012): ein Eingriff für alle Materialien einer Gestalt.
 * - **Saum:** Fresnel an der Silhouette in der Randfarbe der Stimmung — löst die Figur im
 *   Gegenlicht und im Dunst vom Hintergrund (die stärkste Einzelwirkung in Soulframe-Bildern).
 * - **Haut** (nur mit `ton`): Farbton aus der Wahl (D176), dazu eine weiche, rötliche Lichtkante —
 *   Licht dringt in Haut ein und tritt hinter dem Terminator wieder aus. Ohne das wirkt Haut wie
 *   bemalter Kunststoff. Eine Näherung (Wrap-Lighting), keine Streuung.
 */
function figurShader(mat: THREE.MeshStandardMaterial, ton: THREE.Color | null, kleid: THREE.Vector2 | null = null): void {
  if (ton) {
    const u = (mat.userData.haut ??= { value: ton.clone() }) as { value: THREE.Color };
    u.value.copy(ton);
    mat.color.set(1, 1, 1);
  }
  const haut = !!ton;
  const schluessel = haut ? 'brachland-figur-haut-v1' : kleid ? 'brachland-figur-kleidung-v1' : 'brachland-figur-v1';
  if (mat.userData.figurShader === schluessel) return;
  mat.userData.figurShader = schluessel;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uSaum = FIGUR_LICHT.saum;
    sh.uniforms.uSaumStaerke = FIGUR_LICHT.saumStaerke;
    let f = 'uniform vec3 uSaum;\nuniform float uSaumStaerke;\n' + sh.fragmentShader;
    if (kleid) {
      sh.uniforms.uKleiderwerte = { value: kleid };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vKleiderPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvKleiderPos = position;');
      f = f.replace('#include <common>', '#include <common>\n' + KLEIDER_GLSL)
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + KLEIDER_ALTERUNG_GLSL);
    }
    if (haut) {
      sh.uniforms.hautTon = mat.userData.haut;
      f = 'uniform vec3 hautTon;\n' + f.replace('#include <map_fragment>', `#include <map_fragment>
      float hautL = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.rgb = hautTon * clamp(hautL / ${HAUT_MITTEL.toFixed(3)}, 0.35, 1.8);`);
    }
    f = f.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      ${haut ? `#if NUM_DIR_LIGHTS > 0
      {
        float nl = dot(geometryNormal, directionalLights[0].direction);
        float wickel = max(0.0, (nl + 0.5) / 1.5) - max(0.0, nl);
        reflectedLight.directDiffuse += BRDF_Lambert(diffuseColor.rgb) * vec3(1.0, 0.42, 0.3)
          * directionalLights[0].color * wickel * 0.55;
      }
      #endif` : ''}
      {
        float saumKante = 1.0 - abs(dot(geometryNormal, geometryViewDir));
        reflectedLight.indirectSpecular += uSaum * pow(saumKante, 3.0) * uSaumStaerke${kleid ? ' * mix(1.0, .65 - .30 * faser, lederStoff)' : ''};
      }`);
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => schluessel;
  mat.needsUpdate = true;
}

/**
 * Umgebungskarte auf alle Materialien einer Gestalt (D213): Bis hierher hatte keine Figur eine —
 * die PBR-Texturen (Rauheit, Metall an Gürtel und Schnallen) hatten nichts zu spiegeln und lasen
 * sich stumpf. Schwach (`staerke`), weil die Karte nur Himmel enthält und das Fülllicht schon da ist.
 */
export function setzeFigurUmgebung(obj: THREE.Object3D, karte: THREE.Texture | null, staerke = 0.35): void {
  obj.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
      if (!('envMap' in mat) || mat.envMap === karte) continue;
      mat.envMap = karte;
      mat.envMapIntensity = staerke;
      mat.needsUpdate = true;
    }
  });
}

/** Konservative Hülle der gerade gespielten Skelettpose (D481). Jeder gewichtete Eckpunkt
 * liegt in der konvexen Hülle seiner Knochenbeiträge. So dürfen Haupt- und Schattenkamera
 * dieselbe Figur unabhängig prüfen; Tagesroutine, Mixer und Fußsetzung laufen weiter. */
export function begrenzeBewohner(obj: THREE.Object3D): () => void {
  const ecke = new THREE.Vector3(), box = new THREE.Box3();
  const minima = new Float64Array(3), maxima = new Float64Array(3);
  const teile: { mesh: THREE.SkinnedMesh; alt: THREE.Sphere; pruefte: boolean; knochen: { index: number; radius: number }[] }[] = [];
  obj.traverse(o => {
    if (!(o instanceof THREE.SkinnedMesh) || !o.visible) return;
    const saum = saumRadius.get(o.geometry) ?? 0;
    if (o.geometry.morphAttributes.position?.length && !saum) return;
    const pos = o.geometry.getAttribute('position'), ind = o.geometry.getAttribute('skinIndex');
    const gew = o.geometry.getAttribute('skinWeight');
    if (!pos || !ind || !gew) return;
    const radien = new Map<number, number>();
    for (let i = 0; i < pos.count; i++) {
      for (let j = 0; j < 4; j++) {
        if (gew.getComponent(i, j) <= 0) continue;
        const k = ind.getComponent(i, j);
        ecke.fromBufferAttribute(pos, i).applyMatrix4(o.bindMatrix).applyMatrix4(o.skeleton.boneInverses[k]);
        // Saumformen werden vor dem Skinning addiert; die maximale Binderaum-Auslenkung
        // bleibt auch bei voller Drehung am Frustumrand in der Knochenhülle.
        const radius = saum ? ecke.length() + saum * o.bindMatrix.getMaxScaleOnAxis() * o.skeleton.boneInverses[k].getMaxScaleOnAxis() : 0;
        radien.set(k, Math.max(radien.get(k) ?? 0, saum ? radius * radius : ecke.lengthSq()));
      }
    }
    if (!radien.size) return;
    teile.push({ mesh: o, alt: o.boundingSphere, pruefte: o.frustumCulled, knochen: [...radien].map(([index, r]) => ({ index, radius: Math.sqrt(r) })) });
    o.boundingSphere = new THREE.Sphere();
    o.frustumCulled = true;
  });
  const fortschreiben = obj.updateMatrixWorld;
  obj.updateMatrixWorld = function (force) {
    fortschreiben.call(this, force);
    // Nach den Kindmatrizen rechnen: Die Füße können im laufenden Bild bereits aufgesetzt haben.
    for (const { mesh, knochen } of teile) {
      minima.fill(Infinity); maxima.fill(-Infinity);
      const bind = mesh.bindMatrixInverse.elements;
      for (let i = 0; i < knochen.length; i++) {
        const { index, radius } = knochen[i];
        const welt = mesh.skeleton.bones[index].matrixWorld.elements;
        // Affine Zeile von Bindinverse × Knochenwelt: Translation ist die Mitte,
        // die Länge der ersten drei Komponenten die Ausdehnung je Radius.
        for (let achse = 0; achse < 3; achse++) {
          const a = bind[achse], b = bind[achse + 4], c = bind[achse + 8];
          const x = a * welt[0] + b * welt[1] + c * welt[2];
          const y = a * welt[4] + b * welt[5] + c * welt[6];
          const z = a * welt[8] + b * welt[9] + c * welt[10];
          const mitte = a * welt[12] + b * welt[13] + c * welt[14] + bind[achse + 12];
          const halb = radius * Math.sqrt(x * x + y * y + z * z);
          minima[achse] = Math.min(minima[achse], mitte - halb);
          maxima[achse] = Math.max(maxima[achse], mitte + halb);
        }
      }
      box.min.fromArray(minima); box.max.fromArray(maxima);
      box.getBoundingSphere(mesh.boundingSphere!);
    }
  };
  return () => {
    obj.updateMatrixWorld = fortschreiben;
    for (const { mesh, alt, pruefte } of teile) { mesh.frustumCulled = pruefte; mesh.boundingSphere = alt; }
  };
}

/**
 * Wahl auf ein geladenes Gestalt-Modell legen: Frisur/Bart sichtbar, Haut und Haar getönt. Klont
 * die Materialien beim ersten Mal — mehrere Figuren aus derselben Datei teilen sonst die Farbe.
 */
export function legeWahlAn(obj: THREE.Object3D, w: HeldWahl, mitKleiderdetail = false): void {
  const haut = hautFarbe(w.haut), haar = new THREE.Color(w.haarfarbe);
  obj.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (!m.userData.heldEigen) {
      m.material = Array.isArray(m.material) ? m.material.map(x => x.clone()) : m.material.clone();
      m.userData.heldEigen = true;
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    }
    const n = m.name.replace(/_\d+$/, '');
    if (n.startsWith('Haar_')) {
      const art = n.slice(5);
      m.visible = art === 'Beard' ? w.bart : art === w.haar;
    }
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
      const mn = mat.name;
      if (/Superhero|Regular/.test(mn)) { figurShader(mat, haut); continue; }
      if (/Hair/.test(mn)) mat.color.copy(haar);
      const kleidung = /Peasant|Ranger/.test(mn);
      if (kleidung) mat.color.set(1, 1, 1).lerp(new THREE.Color(w.kleidfarbe ?? '#ffffff'), w.kleidfarbe ? 0.45 : 0).multiplyScalar(w.kleidfarbe ? 1.25 : 1);
      figurShader(mat, null, kleidung && mitKleiderdetail ? kleiderwerte(n) : null);
    }
  });
}

// ---- Ein kleiner Speicher, damit Szene und Editor dieselbe Wahl sehen, ohne sie durchzureichen.
let aktuell: HeldWahl | null = null;
const hoerer = new Set<() => void>();
export function setzeHeldWahl(w: HeldWahl): void { aktuell = w; hoerer.forEach(f => f()); }
export function heldWahl(): HeldWahl | null { return aktuell; }
export function abonniereHeld(f: () => void): () => void { hoerer.add(f); return () => { hoerer.delete(f); }; }
export function useHeldWahl(): HeldWahl | null {
  return useSyncExternalStore(abonniereHeld, heldWahl);
}
