/** EZ-Tree-Vergleich: dieselben Baumpositionen und dieselbe LOD-Auswahl wie die Welt. */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Tree } from '@dgreenheck/ez-tree';
import { blenderBaum } from '../world/props.js';
import { EZ_BLEND_DAUER, EZ_STUFEN, ezIntervall, ezWechsel } from './ezlod.js';
import type { EzIntervall, EzVerlauf } from './ezlod.js';
import { ergaenzeEzLaublicht } from '../world/ezlaubmaterial.js';

type Stufe = 'nah' | 'mittel' | 'fern';
type BaumArt = 'nadelbaum' | 'laubbaum';
type GeometriePaar = { stamm: THREE.BufferGeometry; laub: THREE.BufferGeometry };
type BaumSatz = { baum: Tree; hoehe: number; tiefe: THREE.MeshDepthMaterial; stammTiefe: THREE.MeshDepthMaterial; stufen: Record<Stufe, GeometriePaar> };
type Ersatz = {
  original: THREE.InstancedMesh; stamm: THREE.InstancedMesh; laub: THREE.InstancedMesh;
  version: number; farbversion: number; anzahl: number; welt: THREE.Matrix4;
  blende: THREE.InstancedBufferAttribute; intervall: THREE.InstancedBufferAttribute; eintraege: Eintrag[];
};
type Historie = { id: string; art: BaumArt; variante: number; stufe: Stufe; satz: BaumSatz;
  matrix: THREE.Matrix4; farbe: THREE.Color; blendenbeginn: number; blendIntervall: EzIntervall; schatten: boolean; empfaengt: boolean };
type Eintrag = Historie & { index: number; paar: Ersatz };
type Ausblendung = { verlauf: EzVerlauf; historien: Partial<Record<Stufe, Historie>> };
type BlendInstanz = { eintrag: Historie; beginn: number; intervall: EzIntervall };
type WartenderBaum = { eintrag: Historie; bis: number };
type UebergangsMesh = { stamm: THREE.InstancedMesh; laub: THREE.InstancedMesh; kapazitaet: number; stammBlende: THREE.InstancedBufferAttribute; laubBlende: THREE.InstancedBufferAttribute; stammIntervall: THREE.InstancedBufferAttribute; laubIntervall: THREE.InstancedBufferAttribute };
type DiagnoseEreignis = { art: 'wechsel' | 'entfernt' | 'neu'; id: string; ms: number; bild: number;
  vorher: Stufe | null; nachher: Stufe | null; grund: string; abstand: number; sichtbar: boolean };
type Diagnose = { ereignisse: DiagnoseEreignis[]; naechster: number; gesamt: number };

// Neue React-Gruppen koennen erst nach einem leeren Frame befuellt sein.
const REGISTERPUFFER = 1;
// Nur wechselnde Baeume im Blickfeld ueberblenden; 420 m entspricht dem
// weitesten Nebelende der vorhandenen Stimmungen. Darueber bleibt der Wechsel
// direkt. Die Entfernung ist eine Messhypothese, kein visueller Grenzbeweis.
const BLEND_WEITE = 420;
const BAUM_SICHTRADIUS = 22;

/** Historie haelt keine komplette, bereits entfernte Instanzgruppe am Leben. */
function baumHistorie(e: Historie): Historie {
  return { id: e.id, art: e.art, variante: e.variante, stufe: e.stufe, satz: e.satz,
    matrix: e.matrix, farbe: e.farbe, blendenbeginn: e.blendenbeginn, blendIntervall: e.blendIntervall, schatten: e.schatten, empfaengt: e.empfaengt };
}

// React kann Original-Chunks zwischen zwei Frames montieren. Nach Abschluss der
// EZ-Vorbereitung muessen ihre Refs bereits beim Anhaengen unsichtbar sein, damit
// sie nicht neben einem noch vorhandenen Ersatz beobachtet oder gezeichnet werden.
let ezBereit = false;
export function istEzProbeBereit(): boolean { return ezBereit; }

// Die zwei Farb-/Tiefenpasses erhalten exakt dieselbe Verschiebung. Der eigene
// EZ-Shader ersetzt project_vertex und unterstuetzt keine Instanzmatrix.
const WIND = /* glsl */ `
  float phase = 0.0;
  #ifdef USE_INSTANCING
    phase = dot(instanceMatrix[3].xz, vec2(0.07, 0.11));
  #endif
  transformed.xz += vec2(0.11, 0.07) * uv.y * sin(uEzZeit * 0.8 + phase + position.y * 0.12);
`;

function windEinbauen(material: THREE.Material, zeit: { value: number }): void {
  material.onBeforeCompile = shader => {
    shader.uniforms.uEzZeit = zeit;
    shader.vertexShader = 'uniform float uEzZeit;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + WIND);
  };
  material.customProgramCacheKey = () => 'brachland-ezprobe-wind-v1';
  material.needsUpdate = true;
}

/** Eigene Instanzattribute, aber gemeinsame unveraenderliche Vertex- und Indexdaten. */
function mitBlende(quelle: THREE.BufferGeometry, kapazitaet: number): { geo: THREE.BufferGeometry; blende: THREE.InstancedBufferAttribute; intervall: THREE.InstancedBufferAttribute } {
  const geo = new THREE.BufferGeometry();
  geo.setIndex(quelle.getIndex());
  for (const [name, attribut] of Object.entries(quelle.attributes)) geo.setAttribute(name, attribut);
  geo.boundingSphere = quelle.boundingSphere?.clone() ?? null;
  geo.boundingBox = quelle.boundingBox?.clone() ?? null;
  const blende = new THREE.InstancedBufferAttribute(new Float32Array(kapazitaet), 1);
  blende.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aEzBlende', blende);
  const intervall = new THREE.InstancedBufferAttribute(new Float32Array(kapazitaet * 4), 4);
  intervall.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aEzIntervall', intervall);
  return { geo, blende, intervall };
}

/** Nur den eigenen Instanzpuffer freigeben; Stamm-/Blattdaten gehoeren dem Baumsatz. */
function entsorgeInstanzGeo(geo: THREE.BufferGeometry): void {
  for (const name of Object.keys(geo.attributes)) if (name !== 'aEzBlende' && name !== 'aEzIntervall') geo.deleteAttribute(name);
  geo.setIndex(null);
  geo.dispose();
}

/** Dieselbe zeitliche Ueberblendung fuer Farbe und Schattentiefe. */
function blendeEinbauen(material: THREE.Material, zeit: { value: number }): void {
  const vorher = material.onBeforeCompile;
  const schluessel = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    vorher.call(material, shader, renderer);
    shader.uniforms.uEzZeit = zeit;
    if (!shader.vertexShader.includes('uniform float uEzZeit;')) shader.vertexShader = 'uniform float uEzZeit;\n' + shader.vertexShader;
    shader.vertexShader = `attribute float aEzBlende; attribute vec4 aEzIntervall; varying vec2 vEzIntervall;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float ezFortschritt = clamp((uEzZeit - abs(aEzBlende) + 1.0) / ${EZ_BLEND_DAUER.toFixed(1)}, 0.0, 1.0);
      vEzIntervall = aEzBlende == 0.0 ? vec2(0.0, 1.0) : mix(aEzIntervall.xy, aEzIntervall.zw, ezFortschritt);`);
    shader.fragmentShader = `varying vec2 vEzIntervall;\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
      if (vEzIntervall.x > 0.0 || vEzIntervall.y < 1.0) {
        float ezMuster = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (ezMuster < vEzIntervall.x || ezMuster >= vEzIntervall.y) discard;
      }`);
  };
  material.customProgramCacheKey = () => schluessel() + ':ez-blende-v2';
  material.needsUpdate = true;
}

/** Ganze Doppelkreuzkarten aus derselben Krone auswaehlen, nie einzelne Dreiecke. */
function laubStufe(quelle: THREE.BufferGeometry, anteil: number): THREE.BufferGeometry {
  const index = quelle.getIndex();
  if (!index || index.count % 12 !== 0) throw new Error('EZ-Tree: erwartete doppelte Blattkarten fehlen');
  const zahlen: number[] = [];
  for (let k = 0; k < index.count / 12; k++) {
    // Verschachtelte Mengen: jede Fernkarte ist auch in Mittel und Nah enthalten.
    const h = Math.imul(k ^ (k >>> 16), 0x45d9f3b) >>> 0;
    if (h / 0x100000000 >= anteil) continue;
    for (let j = 0; j < 12; j++) zahlen.push(index.getX(k * 12 + j));
  }
  const kopie = quelle.clone();
  kopie.setIndex(zahlen);
  return kopie;
}

type Vereinfacher = typeof import('meshoptimizer/simplifier').MeshoptSimplifier;

/** Positionen bleiben erhalten; nur Indizes aendern sich, UV und Normalen bleiben zugeordnet. */
function stammStufe(quelle: THREE.BufferGeometry, anteil: number, vereinfacher: Vereinfacher): THREE.BufferGeometry {
  const index = quelle.getIndex(), position = quelle.getAttribute('position');
  if (!index || !(position.array instanceof Float32Array)) throw new Error('EZ-Tree: Stamm ohne indizierte Positionen');
  const eingang = Uint32Array.from(index.array);
  const ziel = Math.max(3, Math.floor(eingang.length * anteil / 3) * 3);
  const [indices] = vereinfacher.simplify(eingang, position.array, 3, ziel, 0.02);
  const kopie = quelle.clone();
  kopie.setIndex(new THREE.BufferAttribute(indices, 1));
  return kopie;
}

export function EzBaumProbe({ ziel }: { ziel: React.RefObject<THREE.Object3D | null> }) {
  const { scene, camera } = useThree();
  const saetze = useRef<Map<string, BaumSatz> | null>(null);
  const paare = useRef(new Map<THREE.InstancedMesh, Ersatz>());
  const vorherige = useRef(new Map<string, Eintrag>());
  const wartende = useRef(new Map<string, WartenderBaum>());
  const wartendeMeshes = useRef(new Map<string, UebergangsMesh>());
  const ausblendungen = useRef(new Map<string, Ausblendung>());
  const uebergaenge = useRef(new Map<string, UebergangsMesh>());
  const windZeit = useMemo(() => ({ value: 0 }), []);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const skalierung = useMemo(() => new THREE.Matrix4(), []);
  const farbe = useMemo(() => new THREE.Color(), []);
  const blickfeld = useMemo(() => new THREE.Frustum(), []);
  const blickmatrix = useMemo(() => new THREE.Matrix4(), []);
  const kameraWelt = useMemo(() => new THREE.Vector3(), []);
  const baumKugel = useMemo(() => new THREE.Sphere(new THREE.Vector3(), BAUM_SICHTRADIUS), []);
  const aktiv = typeof location !== 'undefined' && new URLSearchParams(location.search).get('ezbaum') === '1';
  const diagnose = useMemo<Diagnose | null>(() => typeof location !== 'undefined' && new URLSearchParams(location.search).get('ezdiagnose') === '1'
    ? { ereignisse: [], naechster: 0, gesamt: 0 } : null, []);
  const diagnoseBild = useRef(0);
  const diagnoseEntfernt = useRef(new Map<string, DiagnoseEreignis>());

  useEffect(() => {
    if (!aktiv) return;
    // Messsonden bestimmen Abstand und Blickfeld in Weltkoordinaten.
    scene.userData.ezKamera = camera;
    if (diagnose) scene.userData.ezDiagnose = diagnose;
    let beendet = false;
    void Promise.all([import('@dgreenheck/ez-tree'), import('meshoptimizer/simplifier')]).then(async ([ez, meshopt]) => {
      await meshopt.MeshoptSimplifier.ready;
      if (beendet) return;
      const alle = new Map<string, BaumSatz>();
      for (const art of ['nadelbaum', 'laubbaum'] as const) for (let variante = 0; variante < 4; variante++) {
        const baum = new ez.Tree();
        baum.loadPreset(art === 'nadelbaum' ? 'Pine Medium' : 'Oak Medium');
        if (variante) { baum.options.seed += variante * 137; baum.generate(); }
        const material = baum.leavesMesh.material;
        if (Array.isArray(material)) throw new Error('EZ-Baumprobe erwartet ein Laubmaterial.');
        const laub = material as THREE.MeshPhongMaterial;
        const tiefe = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking,
          map: laub.map, alphaTest: laub.alphaTest, side: laub.side });
        windEinbauen(laub, windZeit); windEinbauen(tiefe, windZeit);
        blendeEinbauen(laub, windZeit); blendeEinbauen(tiefe, windZeit);
        ergaenzeEzLaublicht(laub);
        const stammMaterial = baum.branchesMesh.material;
        if (Array.isArray(stammMaterial)) throw new Error('EZ-Baumprobe erwartet ein Stammmaterial.');
        blendeEinbauen(stammMaterial, windZeit);
        const stammTiefe = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
        blendeEinbauen(stammTiefe, windZeit);
        const box = new THREE.Box3().setFromObject(baum);
        const nah = { stamm: baum.branchesMesh.geometry, laub: baum.leavesMesh.geometry };
        const mittel = { stamm: stammStufe(nah.stamm, 0.30, meshopt.MeshoptSimplifier), laub: laubStufe(nah.laub, 0.50) };
        const fern = { stamm: stammStufe(nah.stamm, 0.025, meshopt.MeshoptSimplifier), laub: laubStufe(nah.laub, 0.05) };
        alle.set(`${art}:${variante}`, { baum, hoehe: box.max.y - box.min.y, tiefe, stammTiefe, stufen: { nah, mittel, fern } });
      }
      if (!beendet) { saetze.current = alle; ezBereit = true; }
    }).catch(fehler => console.error('EZ-Baumprobe:', fehler));
    return () => {
      beendet = true;
      ezBereit = false;
      if (scene.userData.ezKamera === camera) delete scene.userData.ezKamera;
      if (diagnose && scene.userData.ezDiagnose === diagnose) delete scene.userData.ezDiagnose;
      diagnoseEntfernt.current.clear();
      for (const p of paare.current.values()) { p.original.visible = true; scene.remove(p.stamm, p.laub); entsorgeInstanzGeo(p.stamm.geometry); entsorgeInstanzGeo(p.laub.geometry); p.stamm.dispose(); p.laub.dispose(); }
      for (const p of uebergaenge.current.values()) { scene.remove(p.stamm, p.laub); entsorgeInstanzGeo(p.stamm.geometry); entsorgeInstanzGeo(p.laub.geometry); p.stamm.dispose(); p.laub.dispose(); }
      for (const p of wartendeMeshes.current.values()) { scene.remove(p.stamm, p.laub); entsorgeInstanzGeo(p.stamm.geometry); entsorgeInstanzGeo(p.laub.geometry); p.stamm.dispose(); p.laub.dispose(); }
      wartendeMeshes.current.clear();
      uebergaenge.current.clear(); vorherige.current.clear(); wartende.current.clear(); ausblendungen.current.clear();
      paare.current.clear();
      if (saetze.current) for (const { baum, tiefe, stammTiefe, stufen } of saetze.current.values()) {
        for (const stufe of Object.values(stufen)) { stufe.stamm.dispose(); stufe.laub.dispose(); }
        tiefe.dispose(); stammTiefe.dispose();
        for (const m of [baum.branchesMesh.material, baum.leavesMesh.material]) {
          if (Array.isArray(m)) m.forEach(x => x.dispose()); else m.dispose();
        }
      }
      saetze.current = null;
    };
  }, [aktiv, camera, diagnose, scene, windZeit]);

  useFrame((_, dt) => {
    if (!aktiv || !saetze.current || !ziel.current) return;
    if (diagnose) diagnoseBild.current++;
    windZeit.value += dt;
    let wartungGeaendert = false;
    for (const [id, w] of wartende.current) if (w.bis <= windZeit.value) {
      wartende.current.delete(id); wartungGeaendert = true;
    }
    const kandidaten: { original: THREE.InstancedMesh; art: BaumArt; variante: number; stufe: Stufe; satz: BaumSatz }[] = [];
    scene.traverse(o => {
      if (!(o instanceof THREE.InstancedMesh) || !o.name.startsWith('baum:') || !o.count || !o.instanceColor) return;
      const [, rohArt, rohVariante, rohStufe] = o.name.split(':');
      if ((rohArt !== 'nadelbaum' && rohArt !== 'laubbaum') ||
          (rohStufe !== 'nah' && rohStufe !== 'mittel' && rohStufe !== 'fern')) return;
      const variante = Number(rohVariante);
      const satz = saetze.current?.get(`${rohArt}:${variante}`);
      if (satz) kandidaten.push({ original: o, art: rohArt, variante, stufe: rohStufe, satz });
    });
    let geaendert = false;
    const entfernteIds = new Set<string>();
    const diagnoseGrund = diagnose ? new Map<string, string>() : null;
    const geaendertePaare = new Set<Ersatz>();
    const behalten = new Set(kandidaten.map(k => k.original));
    for (const [o, p] of paare.current) if (!behalten.has(o)) {
      for (const e of p.eintraege) { entfernteIds.add(e.id); diagnoseGrund?.set(e.id, 'gruppe-entfernt'); }
      o.visible = true; scene.remove(p.stamm, p.laub); entsorgeInstanzGeo(p.stamm.geometry); entsorgeInstanzGeo(p.laub.geometry); p.stamm.dispose(); p.laub.dispose(); paare.current.delete(o); geaendert = true;
    }
    for (const { original: o, art, variante, stufe, satz } of kandidaten) {
      let p = paare.current.get(o);
      const kapazitaet = o.instanceMatrix.count;
      if (!p) {
        const geo = satz.stufen[stufe];
        const stammGeo = mitBlende(geo.stamm, kapazitaet), laubGeo = mitBlende(geo.laub, kapazitaet);
        // Wind verschiebt Blattvertices lokal um maximal ca. 0,13 Einheiten;
        // diese Reserve wird mit jeder Instanz mitskaliert und verhindert, dass
        // eine bewegte Krone am Frustum- oder Schattenrand abgeschnitten wird.
        if (o.frustumCulled) {
          if (!laubGeo.geo.boundingSphere) laubGeo.geo.computeBoundingSphere();
          if (laubGeo.geo.boundingSphere) laubGeo.geo.boundingSphere.radius += 0.2;
        }
        // Beide Geometrien teilen denselben Instanzpuffer.
        laubGeo.geo.setAttribute('aEzBlende', stammGeo.blende);
        laubGeo.geo.setAttribute('aEzIntervall', stammGeo.intervall);
        const stamm = new THREE.InstancedMesh(stammGeo.geo, satz.baum.branchesMesh.material, kapazitaet);
        const laub = new THREE.InstancedMesh(laubGeo.geo, satz.baum.leavesMesh.material, kapazitaet);
        stamm.count = 0; laub.count = 0;
        stamm.name = `ezbaum:${art}:${variante}:${stufe}`;
        laub.name = `ezlaub:${art}:${variante}:${stufe}`;
        stamm.userData.ezQuelle = o.name;
        laub.customDepthMaterial = satz.tiefe; stamm.customDepthMaterial = satz.stammTiefe;
        stamm.castShadow = o.castShadow; laub.castShadow = o.castShadow;
        stamm.receiveShadow = o.receiveShadow; laub.receiveShadow = o.receiveShadow;
        stamm.frustumCulled = o.frustumCulled; laub.frustumCulled = o.frustumCulled;
        p = { original: o, stamm, laub, version: -1, farbversion: -1, anzahl: -1, welt: new THREE.Matrix4(), blende: stammGeo.blende, intervall: stammGeo.intervall, eintraege: [] };
        paare.current.set(o, p);
      }
      o.updateWorldMatrix(true, false);
      if (p.version !== o.instanceMatrix.version || p.farbversion !== o.instanceColor?.version ||
          p.anzahl !== o.count || !p.welt.equals(o.matrixWorld)) {
        // Die registrierte Nahhoehe ist fuer alle drei Stufen gleich, daher springt
        // die Groesse beim Stufenwechsel nicht mit der Bounding-Box der Attrappe.
        const meta = blenderBaum(art === 'nadelbaum' ? 'fichte' : 'buche', variante, 'nah');
        const faktor = meta && satz.hoehe > 0 ? meta.hoehe / satz.hoehe : 1;
        skalierung.makeScale(faktor, faktor, faktor);
        for (const e of p.eintraege) { entfernteIds.add(e.id); diagnoseGrund?.set(e.id, 'gruppe-neubefuellt'); }
        p.eintraege = []; geaendert = true; geaendertePaare.add(p);
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, matrix); matrix.premultiply(o.matrixWorld).multiply(skalierung);
          p.stamm.setMatrixAt(i, matrix); p.laub.setMatrixAt(i, matrix);
          if (o.instanceColor) { o.getColorAt(i, farbe); p.stamm.setColorAt(i, farbe); p.laub.setColorAt(i, farbe); }
          const e = matrix.elements, mm = (v: number) => Math.round(v * 1000);
          const id = `${art}:${variante}:${mm(e[12])},${mm(e[13])},${mm(e[14])}`;
          p.eintraege.push({ id, art, variante, stufe, satz, matrix: matrix.clone(), farbe: farbe.clone(), blendenbeginn: 0, blendIntervall: [0, 1, 0, 1],
            schatten: o.castShadow, empfaengt: o.receiveShadow, index: i, paar: p });
        }
        p.stamm.count = o.count; p.laub.count = o.count;
        p.stamm.instanceMatrix.needsUpdate = true; p.laub.instanceMatrix.needsUpdate = true;
        if (p.stamm.instanceColor) p.stamm.instanceColor.needsUpdate = true;
        if (p.laub.instanceColor) p.laub.instanceColor.needsUpdate = true;
        if (p.stamm.frustumCulled) { p.stamm.computeBoundingSphere(); p.laub.computeBoundingSphere(); }
        p.version = o.instanceMatrix.version; p.farbversion = o.instanceColor?.version ?? -1;
        p.anzahl = o.count; p.welt.copy(o.matrixWorld);
      }
      if (!p.stamm.parent) scene.add(p.stamm, p.laub);
      o.visible = false;
    }
    let uebergaengeGeaendert = false;
    if (geaendert) {
      camera.updateMatrixWorld();
      camera.getWorldPosition(kameraWelt);
      blickfeld.setFromProjectionMatrix(blickmatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const protokolliere = (art: DiagnoseEreignis['art'], e: Historie, vorher: Stufe | null, nachher: Stufe | null, grund: string): DiagnoseEreignis | null => {
        if (!diagnose) return null;
        baumKugel.center.setFromMatrixPosition(e.matrix);
        baumKugel.center.y += BAUM_SICHTRADIUS * 0.5;
        const abstand = kameraWelt.distanceTo(baumKugel.center);
        if (abstand > BLEND_WEITE + BAUM_SICHTRADIUS) return null;
        const zeile: DiagnoseEreignis = { art, id: e.id, ms: performance.now(), bild: diagnoseBild.current,
          vorher, nachher, grund, abstand, sichtbar: blickfeld.intersectsSphere(baumKugel) };
        if (diagnose.ereignisse.length < 5000) diagnose.ereignisse.push(zeile);
        else diagnose.ereignisse[diagnose.naechster] = zeile;
        diagnose.naechster = (diagnose.naechster + 1) % 5000;
        diagnose.gesamt++;
        return zeile;
      };
      // Nur ersetzte Gruppen verarbeiten. Der alte Stand bleibt bis nach der
      // gesamten Sammlung erhalten, damit ein Baum auch dann seinen Wechsel
      // findet, wenn die alte Gruppe vor der neuen entfernt wurde.
      const neu = new Map<string, Eintrag>();
      for (const p of geaendertePaare) for (const e of p.eintraege) neu.set(e.id, e);
      for (const [id, e] of neu) {
        const lebend = vorherige.current.get(id);
        const gepuffert = wartende.current.get(id);
        const alt = lebend ?? gepuffert?.eintrag;
        if (gepuffert) { wartende.current.delete(id); wartungGeaendert = true; }
        if (alt && alt.stufe !== e.stufe) {
          baumKugel.center.setFromMatrixPosition(e.matrix);
          baumKugel.center.y += BAUM_SICHTRADIUS * 0.5;
          const sichtbar = kameraWelt.distanceToSquared(baumKugel.center) <= BLEND_WEITE * BLEND_WEITE && blickfeld.intersectsSphere(baumKugel);
          protokolliere('wechsel', e, alt.stufe, e.stufe, sichtbar ? 'geblendet' : 'ausserhalb');
          if (sichtbar) {
            const bisher = ausblendungen.current.get(id);
            const verlauf = ezWechsel(alt.stufe, e.stufe, windZeit.value, bisher?.verlauf);
            const historien = { ...bisher?.historien, [alt.stufe]: baumHistorie(alt) };
            // Eine Stufe ohne Anteil muss keine alte Gruppe im Speicher halten.
            for (const stufe of EZ_STUFEN) if (verlauf.start[EZ_STUFEN.indexOf(stufe)] === 0) delete historien[stufe];
            ausblendungen.current.set(id, { verlauf, historien });
            e.blendenbeginn = verlauf.beginn + 1;
            e.blendIntervall = ezIntervall(verlauf, e.stufe);
            uebergaengeGeaendert = true;
          } else if (ausblendungen.current.delete(id)) uebergaengeGeaendert = true;
        } else if (alt) { e.blendenbeginn = alt.blendenbeginn; e.blendIntervall = alt.blendIntervall; }
        if (diagnose && !lebend) {
          const entfernt = diagnoseEntfernt.current.get(id);
          if (entfernt && performance.now() - entfernt.ms < 5000) {
            protokolliere('neu', e, entfernt.vorher, e.stufe, gepuffert ? 'gepuffert' : entfernt.grund);
            diagnoseEntfernt.current.delete(id);
          }
        }
        // Das Attribut speichert Float32; ein Vergleich mit ungerundetem JS-
        // Float markiert es sonst bei jeder spaeteren Neubewertung als geaendert.
        const wert = Math.fround(e.blendenbeginn);
        if (e.paar.blende.getX(e.index) !== wert) {
          e.paar.blende.setX(e.index, wert); e.paar.blende.needsUpdate = true;
        }
        const iv = e.blendIntervall.map(Math.fround) as unknown as EzIntervall;
        if (e.paar.intervall.getX(e.index) !== iv[0] || e.paar.intervall.getY(e.index) !== iv[1] ||
            e.paar.intervall.getZ(e.index) !== iv[2] || e.paar.intervall.getW(e.index) !== iv[3]) {
          e.paar.intervall.setXYZW(e.index, ...iv); e.paar.intervall.needsUpdate = true;
        }
      }
      // Erst nach dem Vergleich austragen: ein Baum kann gleichzeitig die alte
      // Gruppe verlassen und in einer neuen Gruppe desselben Frames auftauchen.
      for (const id of entfernteIds) if (!neu.has(id)) {
        const entfernt = vorherige.current.get(id);
        if (entfernt) {
          baumKugel.center.setFromMatrixPosition(entfernt.matrix);
          baumKugel.center.y += BAUM_SICHTRADIUS * 0.5;
          if (kameraWelt.distanceToSquared(baumKugel.center) <= BLEND_WEITE * BLEND_WEITE) {
            wartende.current.set(id, { eintrag: baumHistorie(entfernt), bis: windZeit.value + REGISTERPUFFER });
            wartungGeaendert = true;
          }
        }
        if (diagnose) {
          if (entfernt) {
            const zeile = protokolliere('entfernt', entfernt, entfernt.stufe, null, diagnoseGrund?.get(id) ?? 'unbekannt');
            if (zeile) diagnoseEntfernt.current.set(id, zeile);
          }
        }
        vorherige.current.delete(id);
        // Eine laufende Blende bleibt zusammen mit dem Fallback bestehen. Wird
        // nichts gepuffert, darf ihr alter Teil nicht allein stehen bleiben.
        if (!wartende.current.has(id) && ausblendungen.current.delete(id)) uebergaengeGeaendert = true;
      }
      for (const [id, e] of neu) vorherige.current.set(id, e);
      if (diagnose) while (diagnoseEntfernt.current.size > 5000) {
        const erster = diagnoseEntfernt.current.keys().next().value;
        if (erster === undefined) break;
        diagnoseEntfernt.current.delete(erster);
      }
    }
    // Ueberbrueckt nur die kurze, durch asynchrones Montieren entstehende
    // Gruppenluecke. Die fruehere Stufe bleibt maximal eine Sekunde erhalten;
    // bei Rueckkehr wird sie im selben Frame entfernt bzw. ueberblendet.
    if (wartungGeaendert) {
      const gruppen = new Map<string, Historie[]>();
      for (const w of wartende.current.values()) {
        const e = w.eintrag, id = `${e.art}:${e.variante}:${e.stufe}:${+e.schatten}:${+e.empfaengt}`;
        const gruppe = gruppen.get(id) ?? []; gruppe.push(e); gruppen.set(id, gruppe);
      }
      for (const [id, p] of wartendeMeshes.current) if (!gruppen.has(id)) { p.stamm.count = 0; p.laub.count = 0; }
      for (const [id, gruppe] of gruppen) {
        const e = gruppe[0];
        let p = wartendeMeshes.current.get(id);
        if (!p || p.kapazitaet < gruppe.length) {
          if (p) { scene.remove(p.stamm, p.laub); entsorgeInstanzGeo(p.stamm.geometry); entsorgeInstanzGeo(p.laub.geometry); p.stamm.dispose(); p.laub.dispose(); }
          const kapazitaet = Math.max(16, Math.ceil(gruppe.length * 1.5));
          const stammGeo = mitBlende(e.satz.stufen[e.stufe].stamm, kapazitaet), laubGeo = mitBlende(e.satz.stufen[e.stufe].laub, kapazitaet);
          if (!laubGeo.geo.boundingSphere) laubGeo.geo.computeBoundingSphere();
          if (laubGeo.geo.boundingSphere) laubGeo.geo.boundingSphere.radius += 0.2;
          const stamm = new THREE.InstancedMesh(stammGeo.geo, e.satz.baum.branchesMesh.material, kapazitaet);
          const laub = new THREE.InstancedMesh(laubGeo.geo, e.satz.baum.leavesMesh.material, kapazitaet);
          stamm.name = `ezwarten:${id}`; laub.name = `ezwartenlaub:${id}`;
          stamm.userData.ezWarten = true; laub.userData.ezWarten = true;
          stamm.frustumCulled = true; laub.frustumCulled = true;
          stamm.castShadow = e.schatten; laub.castShadow = e.schatten;
          stamm.receiveShadow = e.empfaengt; laub.receiveShadow = e.empfaengt;
          laub.customDepthMaterial = e.satz.tiefe; stamm.customDepthMaterial = e.satz.stammTiefe;
          p = { stamm, laub, kapazitaet, stammBlende: stammGeo.blende, laubBlende: laubGeo.blende,
            stammIntervall: stammGeo.intervall, laubIntervall: laubGeo.intervall };
          wartendeMeshes.current.set(id, p); scene.add(stamm, laub);
        }
        gruppe.forEach((e, i) => {
          p!.stamm.setMatrixAt(i, e.matrix); p!.laub.setMatrixAt(i, e.matrix);
          p!.stamm.setColorAt(i, e.farbe); p!.laub.setColorAt(i, e.farbe);
          p!.stammBlende.setX(i, e.blendenbeginn); p!.laubBlende.setX(i, e.blendenbeginn);
          p!.stammIntervall.setXYZW(i, ...e.blendIntervall); p!.laubIntervall.setXYZW(i, ...e.blendIntervall);
        });
        p.stamm.count = gruppe.length; p.laub.count = gruppe.length;
        p.stamm.instanceMatrix.needsUpdate = true; p.laub.instanceMatrix.needsUpdate = true;
        if (p.stamm.instanceColor) p.stamm.instanceColor.needsUpdate = true;
        if (p.laub.instanceColor) p.laub.instanceColor.needsUpdate = true;
        p.stammBlende.needsUpdate = true; p.laubBlende.needsUpdate = true;
        p.stammIntervall.needsUpdate = true; p.laubIntervall.needsUpdate = true;
        p.stamm.computeBoundingSphere(); p.laub.computeBoundingSphere();
      }
    }
    const gruppen = new Map<string, BlendInstanz[]>();
    for (const [id, a] of ausblendungen.current) {
      if (windZeit.value - a.verlauf.beginn >= EZ_BLEND_DAUER) { ausblendungen.current.delete(id); uebergaengeGeaendert = true; continue; }
      for (const stufe of EZ_STUFEN) {
        if (stufe === a.verlauf.ziel || a.verlauf.start[EZ_STUFEN.indexOf(stufe)] <= 0) continue;
        const e = a.historien[stufe];
        if (!e) throw new Error(`EZ-LOD: Historie fuer ${stufe} fehlt`);
        const idGruppe = `${e.art}:${e.variante}:${e.stufe}:${+e.schatten}:${+e.empfaengt}`;
        const gruppe = gruppen.get(idGruppe) ?? [];
        gruppe.push({ eintrag: e, beginn: a.verlauf.beginn + 1, intervall: ezIntervall(a.verlauf, stufe) });
        gruppen.set(idGruppe, gruppe);
      }
    }
    // Matrizen und Farben sind waehrend der Blende konstant. Die GPU-Puffer
    // nur bei Zu-/Abgaengen hochladen; der Shader aktualisiert die Zeit selbst.
    if (!uebergaengeGeaendert) return;
    for (const [id, p] of uebergaenge.current) if (!gruppen.has(id)) { p.stamm.count = 0; p.laub.count = 0; }
    for (const [id, gruppe] of gruppen) {
      const e = gruppe[0].eintrag;
      let p = uebergaenge.current.get(id);
      if (!p || p.kapazitaet < gruppe.length) {
        if (p) { scene.remove(p.stamm, p.laub); entsorgeInstanzGeo(p.stamm.geometry); entsorgeInstanzGeo(p.laub.geometry); p.stamm.dispose(); p.laub.dispose(); }
        const kapazitaet = Math.max(16, Math.ceil(gruppe.length * 1.5));
        const stammGeo = mitBlende(e.satz.stufen[e.stufe].stamm, kapazitaet), laubGeo = mitBlende(e.satz.stufen[e.stufe].laub, kapazitaet);
        const stamm = new THREE.InstancedMesh(stammGeo.geo, e.satz.baum.branchesMesh.material, kapazitaet);
        const laub = new THREE.InstancedMesh(laubGeo.geo, e.satz.baum.leavesMesh.material, kapazitaet);
        stamm.name = `ezblend:${id}`; laub.name = `ezblendlaub:${id}`;
        stamm.userData.ezUebergang = true; laub.userData.ezUebergang = true;
        stamm.frustumCulled = false; laub.frustumCulled = false;
        stamm.castShadow = e.schatten; laub.castShadow = e.schatten;
        stamm.receiveShadow = e.empfaengt; laub.receiveShadow = e.empfaengt;
        laub.customDepthMaterial = e.satz.tiefe; stamm.customDepthMaterial = e.satz.stammTiefe;
        p = { stamm, laub, kapazitaet, stammBlende: stammGeo.blende, laubBlende: laubGeo.blende,
            stammIntervall: stammGeo.intervall, laubIntervall: laubGeo.intervall };
        uebergaenge.current.set(id, p); scene.add(stamm, laub);
      }
      gruppe.forEach((a, i) => {
        p!.stamm.setMatrixAt(i, a.eintrag.matrix); p!.laub.setMatrixAt(i, a.eintrag.matrix);
        p!.stamm.setColorAt(i, a.eintrag.farbe); p!.laub.setColorAt(i, a.eintrag.farbe);
        p!.stammBlende.setX(i, -a.beginn); p!.laubBlende.setX(i, -a.beginn);
        p!.stammIntervall.setXYZW(i, ...a.intervall); p!.laubIntervall.setXYZW(i, ...a.intervall);
      });
      p.stamm.count = gruppe.length; p.laub.count = gruppe.length;
      p.stamm.instanceMatrix.needsUpdate = true; p.laub.instanceMatrix.needsUpdate = true;
      if (p.stamm.instanceColor) p.stamm.instanceColor.needsUpdate = true;
      if (p.laub.instanceColor) p.laub.instanceColor.needsUpdate = true;
      p.stammBlende.needsUpdate = true; p.laubBlende.needsUpdate = true;
      p.stammIntervall.needsUpdate = true; p.laubIntervall.needsUpdate = true;
    }
  });
  return null;
}
