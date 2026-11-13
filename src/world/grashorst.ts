/**
 * BRACHLAND — Grashorst-Atlas: Foto-Büschel statt gezeichneter Halme (D272, `?gras=3`)
 *
 * Flo 13.11.2026: „die Grashalme sind so unrealistisch, zu gross und nicht dicht genug … gibt es nicht
 * schon fertige Assets?“ — Ja: Poly Haven (CC0) `grass_medium_01` und `grass_medium_02` sind Foto-Scans
 * einzelner Büschel (0,12–0,36 m), als Blattkarten mit der Silhouette der Halme geschnitten. Roh sind sie
 * bis 25.000 Dreiecke je Büschel — zu schwer für 20–100 Büschel je m². Sie wurden deshalb einmal je Netz
 * seitlich mit orthografischer Kamera in ein Bild gerendert (`tools/grashorste.mjs`) und zu einem Atlas
 * gepackt: 19 Kacheln à 384² (7 grün, 5 trocken, 4 Kraut, 3 Blüten), Alpha aus der Silhouette, Farbe unter dem Rand nach aussen gefüllt (keine
 * dunklen Säume). `public/material/gras-horste.json` hält je Kachel das Rechteck im Atlas und die Kantenlänge
 * der Kachel in Metern; Herkunft in `assets/HERKUNFT.md`.
 *
 * Laufzeit: Atlas laden, Mip-Kette von Hand mit Deckungserhalt (`alphamips.ts`, D273) — dünne Halme verschwinden beim Verkleinern
 * sonst im Alpha-Test (ein Büschel auf 8 m ~25 Pixel gegen 384 Texel). Jede Stufe wird so skaliert, dass
 * dieselbe Fläche den Schwellwert übersteigt wie bei voller Auflösung. Nur 6 Stufen, damit Nachbarkacheln
 * nicht ineinander laufen.
 */
import * as THREE from 'three';
import { ladeRgba, leereKarte, setzeAlphaMips } from './alphamips.js';

/** Alpha-Schwelle, die der Material-Alpha-Test benutzt (und die Mip-Kette erhält). */
export const HORST_SCHWELLE = 0.3;
/** Kacheln je Art im Atlas (Reihenfolge: grün, trocken, Kraut, Blume); wird beim Laden gegen die JSON geprüft. */
export const HORST_GRUEN = 7;
export const HORST_STROH = 5;
export const HORST_KRAUT = 4;
export const HORST_BLUME = 3;
export const HORST_ZAHL = HORST_GRUEN + HORST_STROH + HORST_KRAUT + HORST_BLUME;
const MIP_STUFEN = 6;

export interface HorstKachel {
  art: 'gruen' | 'stroh' | 'kraut' | 'blume';
  /** Rechteck im Atlas in UV (x, y, Breite, Höhe), unten links. */
  rect: [number, number, number, number];
  /** Kantenlänge der quadratischen Kachel in Metern. */
  groesse: number;
}
export interface HorstAtlas {
  textur: THREE.DataTexture;
  kacheln: HorstKachel[];
}

/** Durchsichtiger 1×1-Platzhalter, bis der Atlas da ist: der Teppich bleibt kurz leer, statt zu brechen. */
export const leereHorstTextur = leereKarte;

let atlas: Promise<HorstAtlas> | null = null;

/** Atlas und Kachelliste laden (einmal, geteilt von allen Ringen); ohne Browser nie erfüllt. */
export function ladeHorstAtlas(): Promise<HorstAtlas> {
  if (atlas) return atlas;
  if (typeof document === 'undefined' || typeof fetch === 'undefined') return (atlas = new Promise(() => {}));
  atlas = (async () => {
    const [daten, bild] = await Promise.all([
      fetch('/material/gras-horste.json').then((r) => r.json()) as Promise<{ kacheln: HorstKachel[] }>,
      ladeRgba('/material/gras-horste.webp'),
    ]);
    const zahl = (a: string) => daten.kacheln.filter((k) => k.art === a).length;
    if (zahl('gruen') !== HORST_GRUEN || zahl('stroh') !== HORST_STROH || zahl('kraut') !== HORST_KRAUT || zahl('blume') !== HORST_BLUME)
      console.warn(`[grashorst] Atlas hat ${zahl('gruen')}/${zahl('stroh')}/${zahl('kraut')}/${zahl('blume')} Kacheln, erwartet ${HORST_GRUEN}/${HORST_STROH}/${HORST_KRAUT}/${HORST_BLUME}`);
    const t = leereKarte();
    setzeAlphaMips(t, bild.data, bild.b, bild.h, { schwelle: HORST_SCHWELLE, stufen: MIP_STUFEN });
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 4;
    t.flipY = false;
    return { textur: t, kacheln: daten.kacheln };
  })();
  return atlas;
}
