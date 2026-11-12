/**
 * BRACHLAND — WebGPU-Probe Stauwehr (Weg C der Gegenüberstellung, D265, ADR-0015)
 *
 * Frage von Flo (12.11.2026): Wie sähe das Stauwehr aus, wenn wir die fertigen Bausteine von
 * three.js nehmen, wie es die Ein-Prompt-Demos tun? Antwort als Bild, nicht als Tabelle.
 *
 * Eigene Seite (`/probe-webgpu.html`), das Spiel bleibt unberührt. Dieselben Daten wie das Spiel:
 * Höhenfeld und Bäche aus `oental.json`, die Blender-Set-Pieces des Stauwehrs, Laubkarten (D261),
 * dieselbe Kamera wie das Bildtor. Neu und **nur aus three.js**, nicht selbst gebaut:
 * - `WebGPURenderer` mit Node-Materialien,
 * - Himmelsfoto (HDRI, CC0) als Umgebungslicht und Hintergrund,
 * - GTAO (Umgebungsverdeckung), SSR (Spiegelung im Wasser), TRAA (zeitliche Kantenglättung).
 *
 * Was fehlt und das Bild vom Spiel unterscheidet: der Grasteppich (GLSL, hier ein einfacher
 * Halmersatz), Wind, Nebelshader, Kontur, die gerechnete Dämmerung. Die Probe zeigt die Plattform,
 * nicht ein fertiges Spiel. Schalter: `?ssr=0`, `?ao=0`, `?traa=0`, `?hdri=0`, `?echt=1` (Querbett,
 * grünes Ufer, Laubkarten wie im Spiel).
 */
import * as THREE from 'three/webgpu';
import {
  pass, mrt, output, normalView, directionToColor, colorToDirection, metalness, roughness,
  velocity, vec2, vec4, sample, blendColor, texture, positionWorld, vertexColor, uv, mix, color,
} from 'three/tsl';
import { ao } from 'three/examples/jsm/tsl/display/GTAONode.js';
import { ssr } from 'three/examples/jsm/tsl/display/SSRNode.js';
import { traa } from 'three/examples/jsm/tsl/display/TRAANode.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { entpackeWelt } from '../world/osm.js';
import { baueHoehenfeld, baueKachelraster } from '../world/lod.js';
import { zerlegeBaender, baueWasserKachel } from '../world/baender.js';
import { BAUWERKE, bauwerkPfad, gesperrt } from '../world/bauwerke.js';
import { baueLaubkarten, schrumpfeHuelle, kartenArtFuer } from '../world/laubkarten.js';
import { STIMMUNG } from '../world/stimmung.js';

const suche = new URLSearchParams(location.search);
const aus = (n: string) => suche.get(n) === '0';
const hud = document.getElementById('hud')!;
const start = performance.now();

/** Kamera des Bildtors am Stauwehr (D255): Augpunkt, Ziel, Brennweite. */
const KAMERA = { auge: new THREE.Vector3(1068, 48.25, 867), ziel: new THREE.Vector3(1105, 44.19, 842), fov: 42.6 };
/** Halbe Kante des Geländeausschnitts und Raster in Metern. */
const GELAENDE_HALB = 220, GELAENDE_RASTER = 1;
/** Halmersatz: Radius um den Blickpunkt am Boden, Zahl der Halme. */
const HALM_RADIUS = 32, HALM_ZAHL = 220_000;

async function main() {
  const renderer = new THREE.WebGPURenderer({ antialias: false });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);
  await renderer.init();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(KAMERA.fov, innerWidth / innerHeight, 0.2, 3000);
  camera.position.copy(KAMERA.auge);
  camera.lookAt(KAMERA.ziel);

  // Himmelsfoto: Licht und Hintergrund. SSR braucht die äquirektanguläre Karte mit CPU-Daten.
  let himmel: THREE.DataTexture | null = null;
  if (!aus('hdri')) {
    himmel = await new HDRLoader().loadAsync('/himmel/alps_field_1k.hdr');
    himmel.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = himmel;
    scene.background = himmel;
    scene.environmentIntensity = 0.9;
    scene.backgroundIntensity = 0.9;
  } else {
    scene.background = new THREE.Color('#9aa6ab');
  }
  scene.fog = new THREE.Fog('#b9c3c4', 90, 900);

  // Sonne aus `zielbild` (Azimut 42°, Höhe 13°), Farbe neutraler als die Goldnebel-Stimmung.
  const st = STIMMUNG.zielbild;
  const sonne = new THREE.DirectionalLight('#ffe7c4', 3.2);
  const [sx, sy, sz] = st.sonnenstand;
  sonne.position.set(KAMERA.ziel.x + sx * 3, KAMERA.ziel.y + sy * 3, KAMERA.ziel.z + sz * 3);
  sonne.target.position.copy(KAMERA.ziel);
  sonne.castShadow = true;
  sonne.shadow.mapSize.set(4096, 4096);
  const sc = sonne.shadow.camera as THREE.OrthographicCamera;
  sc.left = -120; sc.right = 120; sc.top = 120; sc.bottom = -120; sc.near = 1; sc.far = 800;
  sonne.shadow.bias = -0.0004;
  sonne.shadow.normalBias = 0.04;
  scene.add(sonne, sonne.target);

  // Welt wie im Spiel.
  hud.textContent = 'Welt …';
  const roh = await (await fetch('/world/oental.json')).json();
  const welt = entpackeWelt(roh.welt);
  const feld = baueHoehenfeld(welt);

  // Gelände: Raster um den Blickpunkt, Farbe aus `bodenfarbe`, Wiesen-Scan als Detail.
  hud.textContent = 'Gelände …';
  const mitte = new THREE.Vector2((KAMERA.auge.x + KAMERA.ziel.x) / 2, (KAMERA.auge.z + KAMERA.ziel.z) / 2);
  const n = Math.round(2 * GELAENDE_HALB / GELAENDE_RASTER) + 1;
  const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = mitte.x - GELAENDE_HALB + j * GELAENDE_RASTER, z = mitte.y - GELAENDE_HALB + i * GELAENDE_RASTER;
    const k = (i * n + j) * 3;
    pos[k] = x; pos[k + 1] = feld.hoehe(x, z); pos[k + 2] = z;
    feld.bodenfarbe(x, z, c);
    col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
    const a = i * n + j, b = a + 1, d = a + n, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const boden = new THREE.BufferGeometry();
  boden.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  boden.setAttribute('color', new THREE.BufferAttribute(col, 3));
  boden.setIndex(idx);
  boden.computeVertexNormals();
  const lader = new THREE.TextureLoader();
  const wiese = await lader.loadAsync('/material/wiese-farbe.webp');
  wiese.wrapS = wiese.wrapT = THREE.RepeatWrapping;
  wiese.colorSpace = THREE.NoColorSpace;
  const bodenMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0 });
  // Scan als Modulation (Mittel 0,5, linear — wie D223): ×2 hält die Grundhelligkeit.
  bodenMat.colorNode = vertexColor().rgb.mul(texture(wiese, positionWorld.xz.div(2.5)).rgb.mul(2.0));
  const bodenMesh = new THREE.Mesh(boden, bodenMat);
  bodenMesh.receiveShadow = true;
  scene.add(bodenMesh);

  // Bäche: dieselben Wasserkacheln wie im Spiel, Material für SSR glatt.
  hud.textContent = 'Wasser …';
  const satz = zerlegeBaender(welt, feld);
  const wasserMat = new THREE.MeshStandardNodeMaterial({ color: '#1d2622', roughness: 0.03, metalness: 0 });
  for (const k of baueKachelraster(feld)) {
    if (Math.hypot(k.mitte[0] - mitte.x, k.mitte[1] - mitte.y) - k.radius > GELAENDE_HALB) continue;
    const g = baueWasserKachel(feld, satz, k, 0);
    if (g) scene.add(new THREE.Mesh(g, wasserMat));
  }

  // Set-Pieces des Stauwehrs.
  hud.textContent = 'Stauwehr …';
  const b = BAUWERKE.find(w => w.name === 'stauwehr')!;
  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gruppe = new THREE.Group();
  gruppe.position.set(b.ursprung.x, b.h0, b.ursprung.z);
  scene.add(gruppe);
  let kartenZahl = 0;
  for (const teil of b.dateien) {
    if (teil === 'wasser') continue;
    const { scene: s } = await gltf.loadAsync(bauwerkPfad(b, teil));
    s.updateMatrixWorld(true);
    const huellen: THREE.Mesh[] = [];
    s.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = true; o.receiveShadow = true;
      if (Array.isArray(o.material)) o.material = o.material[0];
      if (teil === 'gruen' && kartenArtFuer(o.name)) huellen.push(o);
    });
    for (const [i, o] of huellen.entries()) {
      const art = kartenArtFuer(o.name)!;
      const sk = new THREE.Vector3(); o.getWorldScale(sk);
      const skala = Math.cbrt(Math.abs(sk.x * sk.y * sk.z)) || 1;
      const k = baueLaubkarten(o.geometry as THREE.BufferGeometry, art, i + 1, 1, skala);
      o.geometry = schrumpfeHuelle(o.geometry as THREE.BufferGeometry, 0.4, skala);
      (o.material as THREE.MeshStandardMaterial).color.multiplyScalar(0.4);
      o.add(k.mesh);
      kartenZahl += k.anzahl;
    }
    gruppe.add(s);
  }

  // Halmersatz: ein Halm, instanziert, Positionen aus einem Seed. Normale nach oben wie im
  // Spiel (D121), damit die Wiese als Fläche schattiert und nicht als Stoppeln.
  hud.textContent = 'Halme …';
  const halm = new THREE.BufferGeometry();
  const hp = [-0.5, 0, 0, 0.5, 0, 0, -0.35, 0.45, 0, 0.35, 0.45, 0, -0.15, 0.8, 0, 0.15, 0.8, 0, 0, 1, 0];
  halm.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
  halm.setAttribute('normal', new THREE.Float32BufferAttribute(hp.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  halm.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 0.45, 1, 0.45, 0, 0.8, 1, 0.8, 0.5, 1], 2));
  halm.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
  const halmMat = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, roughness: 0.85 });
  halmMat.colorNode = mix(color('#1f2a12'), color('#7d8f45'), uv().y).mul(vertexColor().rgb.mul(0).add(1));
  const halme = new THREE.InstancedMesh(halm, halmMat, HALM_ZAHL);
  const blick = new THREE.Vector2(KAMERA.auge.x + (KAMERA.ziel.x - KAMERA.auge.x) * 0.4, KAMERA.auge.z + (KAMERA.ziel.z - KAMERA.auge.z) * 0.4);
  let a = 12345;
  const zuf = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sk = new THREE.Vector3(), p = new THREE.Vector3(), achse = new THREE.Vector3();
  let gesetzt = 0;
  for (let i = 0; i < HALM_ZAHL * 3 && gesetzt < HALM_ZAHL; i++) {
    const r = HALM_RADIUS * Math.sqrt(zuf()), w = zuf() * Math.PI * 2;
    const x = blick.x + Math.cos(w) * r, z = blick.y + Math.sin(w) * r;
    const biom = feld.biom(x, z);
    if ((biom !== 'wiese' && biom !== 'gebuesch' && !(biom === 'wald' && zuf() < 0.25)) || feld.wasserTiefe(x, z) > 0.02 || gesperrt(x, z, 'streu') && zuf() < 0.5) continue;
    p.set(x, feld.hoehe(x, z), z);
    q.setFromAxisAngle(achse.set(0, 1, 0), zuf() * Math.PI * 2)
      .multiply(new THREE.Quaternion().setFromAxisAngle(achse.set(1, 0, 0), (zuf() - 0.5) * 0.6));
    const h = 0.25 + zuf() * 0.45;
    sk.set(0.035 + zuf() * 0.03, h, 1);
    m.compose(p, q, sk);
    halme.setMatrixAt(gesetzt, m);
    c.setHSL(0.2 + zuf() * 0.06, 0.45, 0.35 + zuf() * 0.2);
    halme.setColorAt(gesetzt, c);
    gesetzt++;
  }
  halme.count = gesetzt;
  halme.receiveShadow = true;
  halme.castShadow = false;
  halme.frustumCulled = false;
  scene.add(halme);

  // Nachbearbeitung, nur fertige Bausteine.
  const pipeline = new THREE.RenderPipeline(renderer);
  const szene = pass(scene, camera);
  szene.setMRT(mrt({
    output, normal: directionToColor(normalView), metalrough: vec2(metalness, roughness), velocity,
  }));
  const farbe = szene.getTextureNode('output');
  const tiefe = szene.getTextureNode('depth');
  const normalTex = szene.getTextureNode('normal');
  const mr = szene.getTextureNode('metalrough');
  const geschw = szene.getTextureNode('velocity');
  const normale = sample((u) => colorToDirection(normalTex.sample(u)));
  // SSR liest das Rohbild als Textur (`sample`), deshalb zuerst; die Verdeckung danach.
  let bild = vec4(farbe) as unknown as THREE.Node<'vec4'>;
  if (!aus('ssr')) {
    const r = ssr(farbe, tiefe, normale, {
      metalnessNode: mr.r, roughnessNode: mr.g, camera, reflectNonMetals: true,
      ...(himmel ? { environmentNode: himmel } : {}),
    });
    bild = blendColor(farbe, r) as unknown as THREE.Node<'vec4'>;
  }
  if (!aus('ao')) {
    const v = ao(tiefe, normale, camera);
    v.resolutionScale = 0.5;
    bild = vec4(bild.rgb.mul(v.getTextureNode().r), bild.a) as unknown as THREE.Node<'vec4'>;
  }
  pipeline.outputNode = aus('traa') ? bild : traa(bild, tiefe, geschw, camera);

  let bilder = 0, letzte = performance.now();
  const zeiten: number[] = [];
  renderer.setAnimationLoop(() => {
    const t = performance.now();
    zeiten.push(t - letzte); letzte = t;
    if (zeiten.length > 30) zeiten.shift();
    pipeline.render();
    bilder++;
    const ms = zeiten.reduce((s, x) => s + x, 0) / zeiten.length;
    const info = renderer.info.render;
    // „Ladezeit … s" erst nach 40 Bildern: TRAA braucht Verlauf, sonst misst man das erste, rohe Bild.
    hud.textContent = `WebGPU-Probe Stauwehr\n${info.triangles.toLocaleString('de-DE')} Dreiecke\n${info.drawCalls} Aufrufe\n${kartenZahl.toLocaleString('de-DE')} Karten, ${gesetzt.toLocaleString('de-DE')} Halme\n${ms.toFixed(1)} ms je Bild`
      + (bilder > 40 ? `\nLadezeit ${((t - start) / 1000).toFixed(1)} s` : '');
  });
}

main().catch(e => { hud.textContent = 'Fehler: ' + (e as Error).message; console.error(e); });
