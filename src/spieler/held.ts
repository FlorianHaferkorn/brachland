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

/**
 * Figurshader (D213, ADR-0012): ein Eingriff für alle Materialien einer Gestalt.
 * - **Saum:** Fresnel an der Silhouette in der Randfarbe der Stimmung — löst die Figur im
 *   Gegenlicht und im Dunst vom Hintergrund (die stärkste Einzelwirkung in Soulframe-Bildern).
 * - **Haut** (nur mit `ton`): Farbton aus der Wahl (D176), dazu eine weiche, rötliche Lichtkante —
 *   Licht dringt in Haut ein und tritt hinter dem Terminator wieder aus. Ohne das wirkt Haut wie
 *   bemalter Kunststoff. Eine Näherung (Wrap-Lighting), keine Streuung.
 */
function figurShader(mat: THREE.MeshStandardMaterial, ton: THREE.Color | null): void {
  if (ton) {
    const u = (mat.userData.haut ??= { value: ton.clone() }) as { value: THREE.Color };
    u.value.copy(ton);
    mat.color.set(1, 1, 1);
  }
  if (mat.userData.figurShader) return;
  mat.userData.figurShader = true;
  const haut = !!ton;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uSaum = FIGUR_LICHT.saum;
    sh.uniforms.uSaumStaerke = FIGUR_LICHT.saumStaerke;
    let f = 'uniform vec3 uSaum;\nuniform float uSaumStaerke;\n' + sh.fragmentShader;
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
        reflectedLight.indirectSpecular += uSaum * pow(saumKante, 3.0) * uSaumStaerke;
      }`);
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => (haut ? 'brachland-figur-haut-v1' : 'brachland-figur-v1');
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

/**
 * Wahl auf ein geladenes Gestalt-Modell legen: Frisur/Bart sichtbar, Haut und Haar getönt. Klont
 * die Materialien beim ersten Mal — mehrere Figuren aus derselben Datei teilen sonst die Farbe.
 */
export function legeWahlAn(obj: THREE.Object3D, w: HeldWahl): void {
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
      else if (/Peasant|Ranger/.test(mn)) mat.color.set(1, 1, 1).lerp(new THREE.Color(w.kleidfarbe ?? '#ffffff'), w.kleidfarbe ? 0.45 : 0).multiplyScalar(w.kleidfarbe ? 1.25 : 1);
      figurShader(mat, null);
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
