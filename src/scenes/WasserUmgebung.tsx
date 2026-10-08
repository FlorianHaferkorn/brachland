/** Derselbe Himmel wie im Spiel, als Wasserreflexion; keine Vegetationsreflexion. */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { baueHimmel, type HimmelWerte } from '../world/himmel.js';

const WasserHimmel = createContext<THREE.Texture | null>(null);

/**
 * Sechs kleine Ansichten enthalten nur die vorhandene Himmelskugel. Kein
 * Welt-Render und keine globale scene.environment. Die Aufnahme bleibt linear:
 * Belichtung und Tone Mapping erfolgen erst beim Zeichnen der Wasseroberflaeche.
 * Der Aufrufer besitzt das Ergebnis und muss es mit dispose() freigeben.
 */
export function baueWasserUmgebung(renderer: THREE.WebGLRenderer, werte: HimmelWerte): THREE.WebGLRenderTarget {
  const himmel = baueHimmel(werte);
  const material = himmel.material as THREE.ShaderMaterial;
  material.toneMapped = false;
  const szene = new THREE.Scene();
  szene.add(himmel);
  const wuerfel = new THREE.WebGLCubeRenderTarget(128, {
    type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace,
    generateMipmaps: false, depthBuffer: false,
  });
  const kamera = new THREE.CubeCamera(0.1, 10, wuerfel);
  const filter = new THREE.PMREMGenerator(renderer);
  const vorher = renderer.getRenderTarget();
  const seite = renderer.getActiveCubeFace();
  const stufe = renderer.getActiveMipmapLevel();
  const xr = renderer.xr.enabled;
  const automatischLoeschen = renderer.autoClear;
  try {
    kamera.update(renderer, szene);
    // fromScene() ist in three r169 fest 256px; fromCubemap erhaelt die 128px.
    const ergebnis = filter.fromCubemap(wuerfel.texture);
    ergebnis.texture.name = 'BRACHLAND Wasserhimmel';
    return ergebnis;
  } finally {
    renderer.setRenderTarget(vorher, seite, stufe);
    renderer.xr.enabled = xr;
    renderer.autoClear = automatischLoeschen;
    filter.dispose();
    wuerfel.dispose();
    himmel.geometry.dispose();
    material.dispose();
  }
}

/** Einmal beim Lichtwechsel erzeugen und mit allen Wasser-Materialien teilen. */
export function WasserUmgebung({ werte, children }: { werte: HimmelWerte; children: ReactNode }) {
  const { gl } = useThree();
  const [textur, setzeTextur] = useState<THREE.Texture | null>(null);
  const { zenit, horizont, dunst, sonne, sonnenstand: [x, y, z], scheibe, hof } = werte;
  useEffect(() => {
    const ziel = baueWasserUmgebung(gl, {
      zenit, horizont, dunst, sonne, sonnenstand: [x, y, z], scheibe, hof,
    });
    setzeTextur(ziel.texture);
    return () => ziel.dispose();
  }, [gl, zenit, horizont, dunst, sonne, x, y, z, scheibe, hof]);
  return <WasserHimmel.Provider value={textur}>{children}</WasserHimmel.Provider>;
}

/** Die aktuelle Himmelsaufnahme (D213: auch für die Figuren). */
export function useHimmelKarte(): THREE.Texture | null {
  return useContext(WasserHimmel);
}

/** Auch spaeter geladene Wasserflaechen bekommen die aktuelle Aufnahme. */
export function useWasserUmgebung(material: THREE.MeshStandardMaterial): void {
  const textur = useContext(WasserHimmel);
  useEffect(() => {
    const vorher = material.envMap;
    material.envMap = textur;
    material.needsUpdate = true;
    return () => {
      if (material.envMap === textur) {
        material.envMap = vorher;
        material.needsUpdate = true;
      }
    };
  }, [material, textur]);
}
