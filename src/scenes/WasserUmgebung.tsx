/** Wasserhimmel und optionaler lokaler Szenenreflex am Stauwehr. */
import { createContext, useContext, useEffect, useState, type ReactNode, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { baueHimmel, type HimmelWerte } from '../world/himmel.js';
import type { WasserReflexProbe } from '../world/bandmaterial.js';

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

/**
 * Opt-in-Probe fuer einen begrenzten Abschnitt: Sechs lineare, gedrosselte
 * Szenenansichten direkt ueber dem Wasserspiegel, ohne scene.environment.
 * Es ist eine punktfoermige Umgebungskarte, kein parallaxenkorrekter Spiegel.
 */
export function WasserSzeneProbe({ probe, mitte, ziel }: {
  probe: WasserReflexProbe; mitte: THREE.Vector3; ziel: RefObject<THREE.Object3D | null>;
}) {
  const { gl, scene } = useThree();
  const [daten] = useState(() => {
    const target = new THREE.WebGLCubeRenderTarget(128, {
      type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace,
      generateMipmaps: false, depthBuffer: true,
    });
    return { target, kamera: new THREE.CubeCamera(0.5, 500, target),
      viewport: new THREE.Vector4(), scissor: new THREE.Vector4(), position: new THREE.Vector3(),
      naechster: 0, gesperrt: false, statistik: { aufnahmen: 0, letzteCpuMs: 0, aufrufe: 0, dreiecke: 0 } };
  });
  useEffect(() => {
    probe.mitte.value.copy(mitte);
    scene.userData.wasserReflexMessung = daten.statistik;
    return () => {
      if (scene.userData.wasserReflexMessung === daten.statistik) delete scene.userData.wasserReflexMessung;
      probe.bereit.value = 0; probe.karte.value = null; daten.target.dispose();
    };
  }, [daten, mitte, probe, scene]);

  useFrame(({ clock }) => {
    if (daten.gesperrt || !ziel.current) return;
    ziel.current.getWorldPosition(daten.position);
    if (daten.position.distanceToSquared(mitte) > 150 * 150) { probe.bereit.value = 0; return; }
    const jetzt = clock.elapsedTime;
    if (jetzt < daten.naechster) return;
    daten.naechster = jetzt + 1.5;
    daten.kamera.position.copy(mitte); daten.kamera.position.y += 0.3;

    // Auch spaeter geladene Becken und Wasserfaelle nicht mit aufnehmen.
    const wasser = new Map<THREE.Material, boolean>();
    scene.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.userData.istWasser && !wasser.has(m)) wasser.set(m, m.visible);
      }
    });
    const vorher = gl.getRenderTarget(), seite = gl.getActiveCubeFace(), stufe = gl.getActiveMipmapLevel();
    const xr = gl.xr.enabled, schatten = gl.shadowMap.autoUpdate, schattenUpdate = gl.shadowMap.needsUpdate;
    const autoClear = gl.autoClear, scissorTest = gl.getScissorTest(), infoReset = gl.info.autoReset;
    gl.getViewport(daten.viewport); gl.getScissor(daten.scissor);
    const beginn = performance.now(), aufrufe = gl.info.render.calls, dreiecke = gl.info.render.triangles;
    try {
      for (const m of wasser.keys()) m.visible = false;
      gl.xr.enabled = false; gl.shadowMap.autoUpdate = false; gl.shadowMap.needsUpdate = false;
      gl.info.autoReset = false; gl.autoClear = true; gl.setScissorTest(false);
      daten.kamera.update(gl, scene);
      daten.statistik.aufnahmen++;
      daten.statistik.letzteCpuMs = performance.now() - beginn;
      daten.statistik.aufrufe = gl.info.render.calls - aufrufe;
      daten.statistik.dreiecke = gl.info.render.triangles - dreiecke;
      probe.karte.value = daten.target.texture; probe.bereit.value = 1;
    } catch (fehler) {
      // Ein fehlgeschlagener Capture darf weder Wasser noch Renderer lahmlegen.
      daten.gesperrt = true; probe.bereit.value = 0;
      console.error('Wasserreflex-Probe:', fehler);
    } finally {
      for (const [m, sichtbar] of wasser) m.visible = sichtbar;
      gl.setRenderTarget(vorher, seite, stufe);
      gl.setViewport(daten.viewport); gl.setScissor(daten.scissor); gl.setScissorTest(scissorTest);
      gl.xr.enabled = xr; gl.shadowMap.autoUpdate = schatten; gl.shadowMap.needsUpdate = schattenUpdate;
      gl.autoClear = autoClear; gl.info.autoReset = infoReset;
    }
  });
  return null;
}
