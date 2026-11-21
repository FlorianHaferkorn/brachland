/** D305: redundante Hof-Shaderarbeit sparen, ohne Fenster/Verfall oder Gradienten zu verlieren. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

if (process.argv[2] === 'shaderkind') {
  Object.defineProperty(globalThis, 'location', { value: { search: process.argv[3] }, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: {}, configurable: true });
  const laden = THREE.TextureLoader.prototype.load;
  THREE.TextureLoader.prototype.load = () => new THREE.Texture();
  try {
    const { baueHausMaterial } = await import('../src/world/hausmaterial.js');
    const { HAUS_KOMPAKT_AN, HAUS_SHADER_SPAR_AN } = await import('../src/world/echt.js');
    const material = baueHausMaterial();
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader } as Parameters<THREE.Material['onBeforeCompile']>[0];
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    console.log(JSON.stringify({ kompakt: HAUS_KOMPAKT_AN, spar: HAUS_SHADER_SPAR_AN,
      schluessel: material.customProgramCacheKey(), fragment: shader.fragmentShader, vertex: shader.vertexShader, uniforms: Object.keys(shader.uniforms) }));
    material.dispose();
  } finally { THREE.TextureLoader.prototype.load = laden; }
} else {
  type Probe = { kompakt: boolean; spar: boolean; schluessel: string; fragment: string; vertex: string; uniforms: string[] };
  const basis = '?hofgruen=1&hofhaeuser=1&mips=0&laub=0';
  const capture = (extra: string): Probe => JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', fileURLToPath(import.meta.url), 'shaderkind', basis + extra], { encoding: 'utf8' }));
  const alt = capture('&hauskompakt=0'), neu = capture('&hauskompakt=1'), nurIndex = capture('&hauskompakt=1&hausshader=0');
  let anzahl = 0;
  const pruefe = (name: string, gut: boolean) => { assert.ok(gut, name); anzahl++; console.log(`  ✓ ${name}`); };
  pruefe('Kompakt0 zeigt bisherigen Shaderpfad', !alt.kompakt && !alt.spar);
  pruefe('Kompakt1 aktiviert Shaderersparnis', neu.kompakt && neu.spar);
  pruefe('Shader0 lässt Indexprobe aktiv und deaktiviert Shaderersparnis', nurIndex.kompakt && !nurIndex.spar);
  pruefe('Shader0 und bisheriger Shader sind vollständig identisch', alt.fragment === nurIndex.fragment && alt.vertex === nurIndex.vertex && alt.schluessel === nurIndex.schluessel);
  pruefe('Getrennte Programmschlüssel für Shadervergleich', neu.schluessel !== alt.schluessel && neu.schluessel.endsWith('-spar'));
  for (const [name, probe] of [['vorher', alt], ['nachher', neu], ['nur Index', nurIndex]] as const) {
    const f = probe.fragment;
    pruefe(`${name}: Verfallsdeckung für Rauheit erhalten`, f.includes('float efeuDeckung = 0.0;') && f.includes('roughnessFactor = mix(roughnessFactor, 0.65, efeuDeckung);'));
    pruefe(`${name}: Hof-ARM-Rauheit und AO erhalten`, f.includes('clamp(hofArm.g, 0.5, 1.0)') && f.includes('hofArm.r, hofHausAnteil * 0.55'));
    pruefe(`${name}: Fensterraum und Himmelsglanz erhalten`, f.includes('hausFensterraum(clamp(vRaumUv.xy') && f.includes('if (scanR > 4.5) radiance *= 1.6;'));
    pruefe(`${name}: Glut unverändert im Emissionspass`, f.includes('totalEmissiveRadiance += uGlutFarbe * (vGlut * uGlut);') && probe.vertex.includes('vGlut = glut;'));
    pruefe(`${name}: Original- und Hof-Texturen sowie Verfalluniforms vorhanden`, ['uScanFarbe', 'uScanNormal', 'uHofFarbe', 'uHofNormal', 'uHofArm', 'uEfeu', 'uGlut'].every(u => probe.uniforms.includes(u)));
    pruefe(`${name}: Hofnormal weiter aktiv`, f.includes('normal = normalize(mix(normal, (viewMatrix * vec4(hnW, 0.0)).xyz, hofHausAnteil));'));
  }
  const f = neu.fragment;
  const grad = f.indexOf('vec2 scanGradX = dFdx(scanP), scanGradY = dFdy(scanP);');
  const farbGate = f.indexOf('if (scanR < 3.5 && !hofVoll) diffuseColor.rgb');
  const frontGrad = f.indexOf('float sparFrontPixel = max(fwidth(dot(vHausPos, sparFrontT) / 0.22), 0.001);');
  const frontGate = f.indexOf('if (!hofVoll) {');
  const normalGate = f.indexOf('if (scanR < 3.5 && !hofVoll) {');
  pruefe('Vollhof-Gate gilt ausschließlich für volle Deckung und Rollen0–3', f.includes('bool hofVoll = scanR < 3.5 && hofHausAnteil == 1.0;'));
  pruefe('Scan-Basis bleibt vor dem Farbgate berechnet', f.indexOf('scanP = scanUv(scanR);') < grad && grad >= 0);
  pruefe('Scan-Gradienten liegen vor räumlichem Farb- und Normalgate', grad < farbGate && farbGate >= 0 && grad < normalGate && normalGate >= 0);
  pruefe('Hausfront-Ableitung liegt vor räumlichem Gate', frontGrad >= 0 && frontGrad < frontGate);
  pruefe('Fugenfilter verwendet vorab berechneten Wert statt Ableitung im Zweig', f.includes('float pixel = sparFrontPixel;') && !f.includes('max(fwidth(brett), 0.001)'));
  const helper = f.match(/vec4 scanLiesGrad\([^]*?\) \{([^]*?)\n\}/)?.[1] ?? '';
  pruefe('TextureGrad-Helfer berechnet keine Ableitungen im räumlichen Zweig', helper.includes('gradX * 0.5, gradY * 0.5') && !/dFdx|dFdy/.test(helper));
  pruefe('Farbsampling verwendet vorab berechnete Gradienten', f.includes('scanLiesGrad(uScanFarbe, scanP, scanR, scanGradX, scanGradY)'));
  pruefe('Normalsampling verwendet dieselben vorab berechneten Gradienten', f.includes('scanLiesGrad(uScanNormal, scanP, scanR, scanGradX, scanGradY)'));
  pruefe('Verfallsdeklaration liegt außerhalb des Hausfrontgates', f.indexOf('float efeuDeckung = 0.0;') < frontGate);
  pruefe('Hofanteil wird genau einmal vor Gradient/Gates berechnet', (f.match(/hofHausAnteil = uHofBereit/g) ?? []).length === 1 && f.indexOf('hofHausAnteil = uHofBereit') < grad);
  console.log(`\n${anzahl} Shaderprüfungen bestanden. Quellprüfung, kein GPU-/Bildvergleich.`);
}
