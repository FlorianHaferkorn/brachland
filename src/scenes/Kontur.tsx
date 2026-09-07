/**
 * BRACHLAND — Kontur: eine dunkle Linie an jeder Tiefenkante
 *
 * Der eine Baustein, den kein Asset mitbringt und der den handgemalten
 * Eindruck der Stilreferenz traegt (G-126, Phase 1): Jedes Objekt bekommt an
 * seiner Silhouette eine dunkle Linie, gleich breit, egal woher es kommt —
 * Fels, Haus, Grasbueschel, Kreatur. Das ist der staerkste Vereinheitlicher
 * ueber Quellen hinweg, weil er *nach* allen Materialien kommt.
 *
 * ## Warum ein Vollbildpass und keine Rueckseitenhuelle
 *
 * Die Huelle (das Objekt ein zweites Mal, leicht aufgeblasen, nur Rueckseiten)
 * braucht Normalen zum Aufblasen — die Kreaturen kommen seit D107 ohne —, und
 * sie ist ein zweiter Draw Call je Objekt, also auf dem Zielgeraet die teure
 * Groesse (G-111). Ein Tiefenpass ist genau **ein** Aufruf fuer das ganze
 * Bild und trifft auch Instanzen, Kacheln und den Himmel.
 *
 * ## Wie gemessen wird
 *
 * `?kontur=0` schaltet den Pass ab, `?kontur=1` an — unabhaengig von der
 * Vorgabe, damit `npm run zaehlen` und das Bildtor beide Zustaende an
 * demselben Ort vergleichen koennen. Die Kosten sind ein Vollbild-Render in
 * ein Ziel plus ein Vollbild-Quad; auf dem Mac nicht messbar, auf dem Handy
 * ⚠️ UNKLAR und der erste Messpunkt am Geraet.
 *
 * ## Tone Mapping
 *
 * three.js wendet Tone Mapping und die sRGB-Wandlung nur beim Zeichnen auf
 * den Bildschirm an, nicht in ein Renderziel. Die Szene liegt im Ziel also
 * **linear und ungemappt** (deshalb HalfFloat), und das Quad holt beides mit
 * denselben Chunks nach, die auch jedes Material benutzt — dieselbe Falle,
 * in die G-105 beim Himmel gelaufen ist, nur hier bewusst behandelt.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

const KONTUR_ADRESSE: boolean | null = (() => {
  if (typeof location === 'undefined') return null;
  const roh = new URLSearchParams(location.search).get('kontur');
  return roh === null ? null : roh !== '0';
})();

/** Ist die Kontur an? Adresse schlaegt Vorgabe. */
export function konturAn(vorgabe: boolean): boolean {
  return KONTUR_ADRESSE ?? vorgabe;
}

const SCHEITEL = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAGMENT = /* glsl */`
  #include <common>
  uniform sampler2D tFarbe;
  uniform sampler2D tTiefe;
  uniform vec2 uTexel;
  uniform float uNah, uFern;
  uniform float uStaerke;
  uniform float uSchwelle;
  varying vec2 vUv;

  // Perspektivische Tiefe zurueck in Meter, damit die Schwelle in Prozent des
  // Abstands gilt und nicht in Puffereinheiten — sonst gibt es vorn Linien an
  // jeder Grasfacette und hinten gar keine.
  float meter(vec2 uv) {
    float d = texture2D(tTiefe, uv).x;
    float z = d * 2.0 - 1.0;
    return (2.0 * uNah * uFern) / (uFern + uNah - z * (uFern - uNah));
  }

  void main() {
    vec4 farbe = texture2D(tFarbe, vUv);
    float z = meter(vUv);
    float zl = meter(vUv - vec2(uTexel.x, 0.0));
    float zr = meter(vUv + vec2(uTexel.x, 0.0));
    float zu = meter(vUv - vec2(0.0, uTexel.y));
    float zo = meter(vUv + vec2(0.0, uTexel.y));
    // Nur Kanten, an denen der Nachbar **weiter weg** ist: die Linie liegt am
    // vorderen Objekt, nicht am Hintergrund, und ein Hang vor dem Himmel
    // bekommt sie an der Hangkante.
    float sprung = max(max(zl - z, zr - z), max(zu - z, zo - z)) / z;
    float kante = smoothstep(uSchwelle, uSchwelle * 3.0, sprung);
    gl_FragColor = vec4(farbe.rgb * (1.0 - uStaerke * kante), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function Kontur({ an, staerke = 0.6, schwelle = 0.03 }: {
  an: boolean; staerke?: number; schwelle?: number;
}) {
  const { gl, scene, camera, size } = useThree();
  const dpr = gl.getPixelRatio();

  const ziel = useMemo(() => {
    const b = Math.max(1, Math.round(size.width * dpr)), h = Math.max(1, Math.round(size.height * dpr));
    const rt = new THREE.WebGLRenderTarget(b, h, {
      type: THREE.HalfFloatType,
      depthTexture: new THREE.DepthTexture(b, h, THREE.UnsignedIntType),
      samples: 0,
    });
    return rt;
  }, [size, dpr]);
  useEffect(() => () => { ziel.depthTexture?.dispose(); ziel.dispose(); }, [ziel]);

  const quad = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader: SCHEITEL, fragmentShader: FRAGMENT,
      uniforms: {
        tFarbe: { value: null }, tTiefe: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uNah: { value: 0.2 }, uFern: { value: 1000 },
        uStaerke: { value: staerke }, uSchwelle: { value: schwelle },
      },
      depthTest: false, depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false;
    const bild = new THREE.Scene(); bild.add(mesh);
    const kam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { material, bild, kam };
  }, [staerke, schwelle]);
  useEffect(() => () => { quad.material.dispose(); }, [quad]);

  // Prioritaet 1 uebernimmt das Zeichnen von fiber — auch wenn `an` falsch ist,
  // damit der Vergleich A/B denselben Weg nimmt und nur der Pass fehlt.
  // fiber setzt `gl.info` je `render()` zurueck — nach dem Quad staende im HUD
  // „2 Dreiecke, 1 Aufruf". Deshalb von Hand: einmal je Bild, vor der Szene.
  useEffect(() => { gl.info.autoReset = false; return () => { gl.info.autoReset = true; }; }, [gl]);
  useFrame(() => {
    gl.info.reset();
    if (!an) { gl.setRenderTarget(null); gl.render(scene, camera); return; }
    const k = camera as THREE.PerspectiveCamera;
    gl.setRenderTarget(ziel);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    const u = quad.material.uniforms;
    u.tFarbe.value = ziel.texture;
    u.tTiefe.value = ziel.depthTexture;
    u.uTexel.value.set(1 / ziel.width, 1 / ziel.height);
    u.uNah.value = k.near; u.uFern.value = k.far;
    gl.render(quad.bild, quad.kam);
  }, 1);

  return null;
}
