/**
 * Lizenzgeklaerte Ersatztexturen fuer EZ-Tree (D251).
 *
 * Der Build leitet nur `textures` aus EZ-Trees Quellordner auf dieses Modul um.
 * So werden die ungeklärt lizenzierten und im Originalbundle als Base64
 * eingebetteten Blattbilder weder geladen noch ausgeliefert. Die Blattkarten
 * stammen aus den CC0-Modell-Downloads von Poly Haven; Herkunft und Zuschnitt
 * stehen in `assets/HERKUNFT.md` und `tools/eztexturen.mjs`.
 */
import * as THREE from 'three';

type KartenArt = 'ao' | 'color' | 'normal' | 'roughness';
const lader = new THREE.TextureLoader();
const karten = new Map<string, THREE.Texture>();

function neutral(normal: boolean): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array(normal ? [128, 128, 255, 255] : [255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

/** API-kompatibel zu EZ-Tree; eigene Instanz je Typ und Wiederholung. */
export function getBarkTexture(art: string, karte: KartenArt, skala = { x: 1, y: 1 }): THREE.Texture {
  const schluessel = `${art}:${karte}:${skala.x}:${skala.y}`;
  let textur = karten.get(schluessel);
  if (!textur) {
    textur = karte === 'color' ? lader.load('/material/rinde-farbe.webp') : neutral(karte === 'normal');
    if (karte === 'color') textur.colorSpace = THREE.SRGBColorSpace;
    textur.wrapS = textur.wrapT = THREE.RepeatWrapping;
    textur.repeat.set(skala.x, 1 / skala.y);
    karten.set(schluessel, textur);
  }
  return textur;
}

/** Kiefer fuer `pine`, dieselbe freie Laubkarte fuer `oak`, `ash` und `aspen`. */
export function getLeafTexture(art: string): THREE.Texture {
  const schluessel = art === 'pine' ? 'nadel' : 'laub';
  let textur = karten.get(schluessel);
  if (!textur) {
    textur = lader.load(`/material/ez-${schluessel}-cc0-v5.webp`);
    textur.colorSpace = THREE.SRGBColorSpace;
    karten.set(schluessel, textur);
  }
  return textur;
}
