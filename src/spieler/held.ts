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

/** Hautton: Die Texturen des Pakets sind der mittlere Ton; hell hebt über 1, dunkel senkt. */
export function hautFarbe(haut: number): THREE.Color {
  const hell = new THREE.Color(1.28, 1.18, 1.1), dunkel = new THREE.Color(0.52, 0.42, 0.36);
  return hell.lerp(dunkel, Math.max(0, Math.min(1, haut)));
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
      if (/Superhero|Regular/.test(mn)) mat.color.copy(haut);
      else if (/Hair/.test(mn)) mat.color.copy(haar);
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
