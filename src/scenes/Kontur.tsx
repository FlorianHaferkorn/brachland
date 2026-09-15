/**
 * BRACHLAND — Nachbearbeitung: Kontur (dunkle Linie an jeder Tiefenkante) und AO (Stufe 2)
 *
 * **Kontur.** Der eine Baustein, den kein Asset mitbringt und der den handgemalten
 * Eindruck der Stilreferenz traegt (G-126, Phase 1): Jedes Objekt bekommt an
 * seiner Silhouette eine dunkle Linie, gleich breit, egal woher es kommt —
 * Fels, Haus, Grasbueschel, Kreatur. Das ist der staerkste Vereinheitlicher
 * ueber Quellen hinweg, weil er *nach* allen Materialien kommt.
 *
 * **AO (ADR-0006, Stufe 2, D155).** Der Vergleich Spielbild gegen Blender-Render an derselben
 * Kamera (D154) ergab: Himmel, Licht und Dunst decken sich, aber der Hof ist im Spiel 6× heller,
 * weil die Engine keine Verdeckung kennt — im Render nimmt die Mauer dem Hof den Himmel. Deshalb
 * ein Verdeckungspass aus der Tiefe: Sichtraumposition aus Tiefe und Sichtfeld rekonstruiert,
 * Normale aus den Ableitungen, 12 Proben in der Halbkugel (Radius 8 m, je Pixel gedreht),
 * Abstandspruefung gegen Halos, danach ein 4-Punkte-Weichzeichner im Kompositpass. Das ist
 * Nahfeld-Verdeckung (Fugen, Mauerfuss, Blockschatten); die grosse Himmelsverdeckung des Hofs
 * kommt weiterhin aus dem **gebackenen** AO der Bauwerke (`tools/szenenexport.py`).
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
 * `?kontur=0` schaltet die Linie ab, `?kontur=1` an; `?ao=0` schaltet die Verdeckung ab,
 * `?ao=1.5` setzt ihre Staerke, `?aoRadius=4` die Reichweite in Metern — unabhängig von der Vorgabe, damit Bildtor und Vergleich
 * beide Zustaende an demselben Ort sehen. Der Pass selbst laeuft, sobald eines von beiden an
 * ist: Szene in ein Ziel mit Tiefe, AO in ein halb so grosses Ziel, ein Vollbild-Quad.
 *
 * ## Tone Mapping
 *
 * three.js wendet Tone Mapping und die sRGB-Wandlung nur beim Zeichnen auf
 * den Bildschirm an, nicht in ein Renderziel. Die Szene liegt im Ziel also
 * **linear und ungemappt** (deshalb HalfFloat), und das Quad holt beides mit
 * denselben Chunks nach, die auch jedes Material benutzt — dieselbe Falle,
 * in die G-105 beim Himmel gelaufen ist, nur hier bewusst behandelt. AO wird
 * im Linearen multipliziert, vor dem Mapping.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

const KONTUR_ADRESSE: boolean | null = (() => {
  if (typeof location === 'undefined') return null;
  const roh = new URLSearchParams(location.search).get('kontur');
  return roh === null ? null : roh !== '0';
})();

/** `?ao=0` aus, `?ao=1.5` Staerke; ohne Angabe die Vorgabe. */
const AO_ADRESSE: number | null = (() => {
  if (typeof location === 'undefined') return null;
  const roh = new URLSearchParams(location.search).get('ao');
  if (roh === null) return null;
  const n = Number(roh);
  return Number.isFinite(n) && n >= 0 ? n : null;
})();

/** `?aoRadius=8` Reichweite in Metern; ohne Angabe die Vorgabe. */
const AO_RADIUS_ADRESSE: number | null = (() => {
  if (typeof location === 'undefined') return null;
  const roh = new URLSearchParams(location.search).get('aoRadius');
  if (roh === null) return null;
  const n = Number(roh);
  return Number.isFinite(n) && n > 0 && n <= 32 ? n : null;
})();

/** Ist die Kontur an? Adresse schlaegt Vorgabe. */
export function konturAn(vorgabe: boolean): boolean {
  return KONTUR_ADRESSE ?? vorgabe;
}

/** Staerke der Verdeckung; 0 = aus. Adresse schlaegt Vorgabe. */
export function aoStaerke(vorgabe: number): number {
  return AO_ADRESSE ?? vorgabe;
}

/** Reichweite der Verdeckung in Metern; Adresse schlaegt Vorgabe. */
export function aoReichweite(vorgabe: number): number {
  return AO_RADIUS_ADRESSE ?? vorgabe;
}

const SCHEITEL = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const TIEFE_GLSL = /* glsl */`
  uniform sampler2D tTiefe;
  uniform float uNah, uFern;
  // Perspektivische Tiefe zurueck in Meter, damit Schwellen in Metern und Prozent
  // gelten und nicht in Puffereinheiten.
  float meter(vec2 uv) {
    float d = texture2D(tTiefe, uv).x;
    float z = d * 2.0 - 1.0;
    return (2.0 * uNah * uFern) / (uFern + uNah - z * (uFern - uNah));
  }
`;

/** Verdeckung aus der Tiefe, in ein halb so grosses Ziel. */
const AO_FRAGMENT = /* glsl */`
  #include <common>
  __TIEFE__
  uniform vec2 uTanHalb;
  uniform float uRadius;
  varying vec2 vUv;

  // Sichtraumposition: uv → Sichtstrahl mal Tiefe. z zeigt nach hinten (negativ).
  vec3 sicht(vec2 uv) {
    float z = meter(uv);
    return vec3((uv * 2.0 - 1.0) * uTanHalb * z, -z);
  }

  void main() {
    vec3 P = sicht(vUv);
    if (-P.z > uFern * 0.95) { gl_FragColor = vec4(1.0); return; }   // Himmel
    vec3 N = normalize(cross(dFdx(P), dFdy(P)));
    // Halbkugel um N: Basis aus einem je Pixel gedrehten Zufallsvektor
    float w = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 zufall = vec3(cos(w * 6.2832), sin(w * 6.2832), 0.37);
    vec3 T = normalize(zufall - N * dot(zufall, N));
    vec3 B = cross(N, T);
    float verdeckt = 0.0;
    for (int i = 0; i < 12; i++) {
      float t = (float(i) + 0.5) / 12.0;
      float a = t * 6.2832 * 2.4 + w * 6.2832;
      float r = uRadius * (0.15 + 0.85 * t * t);
      // Proben in der Halbkugel, zur Normale hin gewichtet
      vec3 h = (T * cos(a) + B * sin(a)) * r * (1.0 - t * 0.5) + N * r * (0.3 + 0.7 * t);
      vec3 S = P + h;
      vec2 suv = (S.xy / -S.z) / uTanHalb * 0.5 + 0.5;
      if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;
      float zs = meter(suv);
      float dz = (-S.z) - zs;                       // > 0: Szene liegt vor der Probe → verdeckt
      float reichweite = smoothstep(0.0, 1.0, uRadius / max(1e-3, abs(-P.z - zs)));
      verdeckt += (dz > 0.03 ? 1.0 : 0.0) * reichweite;
    }
    float ao = 1.0 - verdeckt / 12.0;
    // In der Ferne ausblenden: Dort ist die Tiefe zu grob, und die Verdeckung wird zu Streifen
    // (gesehen an der Kulisse, D155). Verdeckung ist ohnehin ein Nahfeld-Mass.
    ao = mix(ao, 1.0, smoothstep(120.0, 350.0, -P.z));
    gl_FragColor = vec4(vec3(ao), 1.0);
  }
`;

const FRAGMENT = /* glsl */`
  #include <common>
  __TIEFE__
  uniform sampler2D tFarbe;
  uniform sampler2D tAO;
  uniform vec2 uTexel;
  uniform vec2 uTexelAO;
  uniform float uStaerke;
  uniform float uSchwelle;
  uniform float uAO;
  varying vec2 vUv;

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
    // AO: vier Proben um den Pixel weichgezeichnet — das Rauschen des Passes verschwindet,
    // die Verdeckung bleibt. Potenz statt Faktor, damit 0,5 sichtbar dunkler ist als 0,8.
    float ao = 1.0;
    if (uAO > 0.0) {
      ao = 0.25 * (texture2D(tAO, vUv + vec2(uTexelAO.x, uTexelAO.y) * 0.5).r
                 + texture2D(tAO, vUv + vec2(-uTexelAO.x, uTexelAO.y) * 0.5).r
                 + texture2D(tAO, vUv + vec2(uTexelAO.x, -uTexelAO.y) * 0.5).r
                 + texture2D(tAO, vUv + vec2(-uTexelAO.x, -uTexelAO.y) * 0.5).r);
      ao = pow(clamp(ao, 0.0, 1.0), uAO);
    }
    gl_FragColor = vec4(farbe.rgb * ao * (1.0 - uStaerke * kante), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function Kontur({ an, staerke = 0.6, schwelle = 0.03, ao = 1.4, aoRadius = 8 }: {
  an: boolean; staerke?: number; schwelle?: number;
  /** Verdeckungsstaerke als Exponent; 0 = aus. */
  ao?: number; aoRadius?: number;
}) {
  const { gl, scene, camera, size } = useThree();
  const dpr = gl.getPixelRatio();
  const aoAn = ao > 0;
  const passAn = an || aoAn;

  const ziel = useMemo(() => {
    const b = Math.max(1, Math.round(size.width * dpr)), h = Math.max(1, Math.round(size.height * dpr));
    const rt = new THREE.WebGLRenderTarget(b, h, {
      type: THREE.HalfFloatType,
      depthTexture: new THREE.DepthTexture(b, h, THREE.UnsignedIntType),
      samples: 0,
    });
    const aoZiel = new THREE.WebGLRenderTarget(Math.max(1, Math.round(b / 2)), Math.max(1, Math.round(h / 2)), { depthBuffer: false });
    return { rt, aoZiel };
  }, [size, dpr]);
  useEffect(() => () => { ziel.rt.depthTexture?.dispose(); ziel.rt.dispose(); ziel.aoZiel.dispose(); }, [ziel]);

  const quad = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader: SCHEITEL, fragmentShader: FRAGMENT.replace('__TIEFE__', TIEFE_GLSL),
      uniforms: {
        tFarbe: { value: null }, tTiefe: { value: null }, tAO: { value: null },
        uTexel: { value: new THREE.Vector2() }, uTexelAO: { value: new THREE.Vector2() },
        uNah: { value: 0.2 }, uFern: { value: 1000 },
        uStaerke: { value: an ? staerke : 0 }, uSchwelle: { value: schwelle }, uAO: { value: ao },
      },
      depthTest: false, depthWrite: false,
    });
    const aoMaterial = new THREE.ShaderMaterial({
      vertexShader: SCHEITEL, fragmentShader: AO_FRAGMENT.replace('__TIEFE__', TIEFE_GLSL),
      uniforms: {
        tTiefe: { value: null }, uNah: { value: 0.2 }, uFern: { value: 1000 },
        uTanHalb: { value: new THREE.Vector2(1, 1) }, uRadius: { value: aoRadius },
      },
      depthTest: false, depthWrite: false,
    });
    const bild = new THREE.Scene(); const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material); mesh.frustumCulled = false; bild.add(mesh);
    const aoBild = new THREE.Scene(); const aoMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), aoMaterial); aoMesh.frustumCulled = false; aoBild.add(aoMesh);
    const kam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { material, aoMaterial, bild, aoBild, kam };
  }, [an, staerke, schwelle, ao, aoRadius]);
  useEffect(() => () => { quad.material.dispose(); quad.aoMaterial.dispose(); }, [quad]);

  // Prioritaet 1 uebernimmt das Zeichnen von fiber — auch wenn der Pass aus ist,
  // damit der Vergleich A/B denselben Weg nimmt und nur der Pass fehlt.
  // fiber setzt `gl.info` je `render()` zurueck — nach dem Quad staende im HUD
  // „2 Dreiecke, 1 Aufruf". Deshalb von Hand: einmal je Bild, vor der Szene.
  useEffect(() => { gl.info.autoReset = false; return () => { gl.info.autoReset = true; }; }, [gl]);
  useFrame(() => {
    gl.info.reset();
    if (!passAn) { gl.setRenderTarget(null); gl.render(scene, camera); return; }
    const k = camera as THREE.PerspectiveCamera;
    gl.setRenderTarget(ziel.rt);
    gl.render(scene, camera);
    if (aoAn) {
      const ua = quad.aoMaterial.uniforms;
      ua.tTiefe.value = ziel.rt.depthTexture;
      ua.uNah.value = k.near; ua.uFern.value = k.far;
      const th = Math.tan(k.fov * Math.PI / 360);
      ua.uTanHalb.value.set(th * k.aspect, th);
      gl.setRenderTarget(ziel.aoZiel);
      gl.render(quad.aoBild, quad.kam);
    }
    gl.setRenderTarget(null);
    const u = quad.material.uniforms;
    u.tFarbe.value = ziel.rt.texture;
    u.tTiefe.value = ziel.rt.depthTexture;
    u.tAO.value = aoAn ? ziel.aoZiel.texture : null;
    u.uAO.value = aoAn ? ao : 0;
    u.uTexel.value.set(1 / ziel.rt.width, 1 / ziel.rt.height);
    u.uTexelAO.value.set(1 / ziel.aoZiel.width, 1 / ziel.aoZiel.height);
    u.uNah.value = k.near; u.uFern.value = k.far;
    gl.render(quad.bild, quad.kam);
  }, 1);

  return null;
}
