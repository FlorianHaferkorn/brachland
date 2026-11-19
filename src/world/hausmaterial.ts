/**
 * BRACHLAND — Hausmaterial mit Fensterglut (D134)
 *
 * Ein Material für alle Häuser einer Kachel: Wand, Holz, Fenster, Sockel, Tür
 * stecken als Vertexfarben in der Geometrie. Nachts fehlte dem Dorf das eine,
 * woran man ein bewohntes Haus erkennt — Licht hinter den Fenstern. Der
 * billigste Weg dahin ist derselbe wie beim Wasser (`bandmaterial.ts`): kein
 * zweites Material, keine zweite Geometrie, kein zweiter Draw Call, sondern ein
 * Attribut je Ecke (`glut`, 1 an brennenden Scheiben, sonst 0) und eine Zeile
 * Emissiv im Fragment-Shader, skaliert mit einem Uniform je Stimmung.
 *
 * Die Glutfarbe ist warm und liegt als Strahldichte **vor** der Belichtung:
 * Bei `nacht` (Belichtung 2,6) kommt eine Scheibe damit auf rund 0,7 linear —
 * hell, aber nicht ausgebrannt, und der Rahmen daneben bleibt, was er ist.
 */
import * as THREE from 'three';
import { BAUWELT_AN, HAUS_ECHT, HAUSFRONT_AN, HOF_AN, HAUS_SHADER_SPAR_AN, HOF_BODEN_AN, HOF_VERFALL_AN, HOF_ZIEL_AN, HOF_DACHBRUCH_AN, HOF_LICHT_AN } from './echt.js';
import { bueschelTextur } from './laubkarten.js';
import { HAUSFRONT_PARS, HAUSFRONT_FARBE } from './hausfront.js';
import { hofTextur, hofUniforms, HOF_HAUS_PARS, HOF_HAUS_FARBE, HOF_HAUS_NORMAL } from './hofmaterial.js';
import HOF_SCANS from '../../public/material/hof-scans.json';
import SCANS from '../../public/material/haus-scans.json';

/**
 * D284: Hausscans als 2 × 2-Atlas (`tools/hausscans.py`): Putz, Schalung, Dach, Sockel. Farbe ist Modulation
 * (Mittel 0,5 → ×2), der Ton bleibt die Palette. Normale OpenGL. Kantenlänge je Kachel in Metern aus der JSON.
 */
const SCAN_TEXTUREN = (() => {
  if (!HAUS_ECHT || typeof document === 'undefined') return null;
  const lade = (pfad: string) => {
    const t = new THREE.TextureLoader().load(pfad);
    t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8;
    return t;
  };
  return { farbe: lade('/material/haus-scans.webp'), normal: lade('/material/haus-scans-nor.webp') };
})();
const SCAN_METER = new THREE.Vector4(...(SCANS as { rollen: { meter: number }[] }).rollen.map(r => r.meter) as [number, number, number, number]);

/**
 * Projektion in der Flächenebene: u waagerecht entlang der Fläche, v die Fallinie hinauf. So laufen Bretter an
 * jeder Wand senkrecht und Ziegelreihen an jedem Dach parallel zur Traufe, egal wie das Haus gedreht ist —
 * eine dreiachsige Projektion hätte die Ziegelreihen an der Hälfte der Dächer quer gelegt.
 */
/**
 * D289 Verfall (Bauwelt D287): Moos auf der Dachhaut, Feuchte und Algen am Sockel, Efeu von unten die Wände hinauf —
 * Stärke nach der Verfallsstufe je Haus (Attribut `zustand.x`: 0 bewohnt, 1 verlassen, 2 verfallen), Höhe über dem
 * Sockel aus `zustand.y`. Efeu nimmt Farbe und Deckung aus dem Laub-Büschelatlas (D282), in der Wandebene gelesen.
 */
const VERFALL_PARS = /* glsl */ `
uniform sampler2D uEfeu;
varying vec2 vZustand;
float verfallHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float verfallRauschen(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(verfallHash(i), verfallHash(i + vec2(1.0, 0.0)), f.x), mix(verfallHash(i + vec2(0.0, 1.0)), verfallHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;
const VERFALL_FARBE = /* glsl */ `
  float vStufe = ${HOF_ZIEL_AN ? 'vZustand.x - 4.0 * zielHaus' : 'vZustand.x'}, vHoehe = vZustand.y;
  // Bauwelt D287: Das Erdgeschoss ist weiss gekalkt (Denkmalliste: verputztes Nagelfluh-/Feldsteinmauerwerk). Der Paletten-
  // putz las mit dem Scan als grauer Granit — aufhellen; verlassene Häuser vergrauen etwas.
  if (scanR < 0.5) diffuseColor.rgb *= mix(vec3(1.5, 1.48, 1.42), vec3(1.25, 1.24, 1.2), vStufe * 0.5);
  // D292: Holz altert. Ungestrichenes Lärchen-/Fichtenholz wird an der Sonne dunkelbraun, im Wetter silbergrau — nach
  // 40–60 Jahren ohne Pflege (D287) erst recht; das Palettenholz las mit dem Scan als frisches Orange. Bewohnt
  // dunkler und gedämpft, verlassen und verfallen zunehmend grau.
  if (scanR > 0.5 && scanR < 1.5) {
    float holzL = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 vergraut = vec3(holzL) * vec3(1.02, 0.98, 0.92);
    diffuseColor.rgb = mix(diffuseColor.rgb, vergraut, 0.38 + vStufe * 0.2) * (0.86 - vStufe * 0.04);
  }
  float efeuDeckung = 0.0;
  vec3 efeuFarbe = vec3(0.0);
  if (scanR < 3.5) {
    vec2 wp = vec2(dot(vHausPos, scanT), vHausPos.y);
    float n1 = verfallRauschen(wp * 0.35 + vHausPos.xz * 0.05), n2 = verfallRauschen(wp * 1.7 + 13.0);
    if (scanR > 1.5 && scanR < 2.5) {
      // Moos und Gras auf der Dachhaut: Flecken, an der Traufe und in Kehlen dichter; bewohnt nur ein Hauch.
      float moos = smoothstep(0.55 - vStufe * 0.22, 0.85 - vStufe * 0.2, n1 * 0.7 + n2 * 0.3);
      vec3 moosFarbe = mix(vec3(0.16, 0.19, 0.07), vec3(0.30, 0.31, 0.12), n2);
      diffuseColor.rgb = mix(diffuseColor.rgb, moosFarbe, moos * (0.25 + vStufe * 0.35));
    } else {
      // Feuchte und Algen am Sockel, Schmutzläufer von oben — mit der Stufe stärker.
      float feucht = (1.0 - smoothstep(0.0, 0.6 + vStufe * 0.5, vHoehe)) * (0.25 + vStufe * 0.2);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.62, 0.5), feucht);
      // Efeu: von unten nach oben, verlassen bis ~3 m, verfallen bis unters Dach; bewohnte Häuser frei.
      float reicht = vStufe < 0.5 ? -1.0 : vStufe < 1.5 ? 3.2 : 7.5;
      float mass = smoothstep(reicht, reicht - 1.8, vHoehe + (n1 - 0.5) * 3.0) * smoothstep(0.35, 0.6, n1 + n2 * 0.25);
      if (mass > 0.01${HOF_ZIEL_AN ? ' && zielHaus < .5' : ''}) {
        vec2 ep = wp / 0.9;
        vec2 ez = floor(ep);
        float ek = floor(verfallHash(ez) * 16.0);
        vec2 euv = (fract(ep) + vec2(mod(ek, 4.0), floor(ek / 4.0))) * 0.25;
        vec4 blatt = textureGrad(uEfeu, euv, dFdx(ep) * 0.25, dFdy(ep) * 0.25);
        efeuDeckung = mass * smoothstep(0.2, 0.5, blatt.a + mass * 0.35);
        efeuFarbe = blatt.rgb * 0.9;
        diffuseColor.rgb = mix(diffuseColor.rgb, efeuFarbe, efeuDeckung);
      }
    }
  }
`;

const SCAN_PARS = /* glsl */ `
uniform sampler2D uScanFarbe;
uniform sampler2D uScanNormal;
uniform vec4 uScanMeter;
varying float vRolle;
varying vec3 vHausPos;
vec3 scanT, scanB, scanN;
vec2 scanUv(float r) {
  scanN = normalize(cross(dFdx(vHausPos), dFdy(vHausPos)));
  vec3 hoch = vec3(0.0, 1.0, 0.0);
  scanT = abs(scanN.y) > 0.97 ? vec3(1.0, 0.0, 0.0) : normalize(cross(hoch, scanN));
  scanB = cross(scanN, scanT);
  float m = r < 0.5 ? uScanMeter.x : r < 1.5 ? uScanMeter.y : r < 2.5 ? uScanMeter.z : uScanMeter.w;
  return vec2(dot(vHausPos, scanT), dot(vHausPos, scanB)) / m;
}
vec4 scanLiesGrad(sampler2D t, vec2 p, float r, vec2 gradX, vec2 gradY) {
  vec2 off = vec2(mod(r, 2.0), 1.0 - floor(r / 2.0)) * 0.5;
  return textureGrad(t, off + (fract(p) * 0.996 + 0.002) * 0.5, gradX * 0.5, gradY * 0.5);
}
vec4 scanLies(sampler2D t, vec2 p, float r) {
  // Kachel im 2 × 2-Atlas (Zeile 0 oben im Bild = oben in UV); textureGrad gegen Mip-Sprünge an der Wiederholung.
  vec2 off = vec2(mod(r, 2.0), 1.0 - floor(r / 2.0)) * 0.5;
  vec2 uv = off + (fract(p) * 0.996 + 0.002) * 0.5;
  return textureGrad(t, uv, dFdx(p) * 0.5, dFdy(p) * 0.5);
}
`;

// Nach dem Hofscan, damit dessen Originalalbedo die Alterung nicht mehr übermalt.
const HOF_VERFALL_FARBE = /* glsl */ `
  float hofSchaden = step(0.5, vStufe) * hofHausAnteil;
  if (hofSchaden > 0.0) {
    float schwer = step(1.5, vStufe);
    if (scanR < 3.5) {
      vec3 nn = normalize(vHausNormal);
      vec3 entlang = abs(nn.y) > 0.97 ? vec3(1,0,0) : normalize(cross(nn,vec3(0,1,0)));
      vec2 pVerfall = vec2(dot(vHausPos,entlang),vHausPos.y);
      float flecken = verfallRauschen(pVerfall * vec2(.78,.91));
      float rand = verfallRauschen(pVerfall * 5.2);
      float laeufer = verfallRauschen(pVerfall * vec2(2.3,.22));
      vec3 alt = diffuseColor.rgb;
      if (scanR < 0.5) {
        // Ausbrüche folgen größeren Feuchtstellen, kleine Kanten fransen aus.
        float blank = smoothstep(.56 - schwer*.13,.73 - schwer*.13,flecken + rand*.21);
        vec3 stein = vec3(.105,.092,.072) * (.55 + rand*.95);
        alt = mix(alt * mix(.69,.97,laeufer), stein, blank * .84);
      } else if (scanR < 1.5) {
        float hell = dot(alt,vec3(.2126,.7152,.0722));
        alt = mix(alt,vec3(hell) * vec3(.91,.95,.89),.72) * (.54 + .35*laeufer);
      } else if (scanR < 2.5) {
        float moos = smoothstep(.44-schwer*.07,.79-schwer*.08,flecken + rand*.14);
        alt = mix(alt*.76,vec3(.09,.115,.045) * (.65+rand*.72),moos*.76);
      }
      if (scanR < 1.5 || (scanR > 2.5 && abs(nn.y)<.7)) {
        float unten = 1.0 - smoothstep(.12,1.2 + schwer*.8,vHoehe);
        alt *= mix(vec3(1.0),vec3(.4,.48,.33),unten * (.35 + .52*flecken));
        alt = mix(alt,efeuFarbe,efeuDeckung * mix(.34,.84,schwer));
      }
      diffuseColor.rgb = mix(diffuseColor.rgb,alt,hofSchaden);
    } else if (scanR > 4.5) {
      // Blinde Scheiben bzw. dunkle Öffnung, ohne sichtbaren Vorhang.
      float staub = verfallRauschen(vRaumUv.xy * vec2(7,5) + vRaumUv.z * 41.0);
      vec3 glas = mix(vec3(.013,.015,.012),vec3(.064,.066,.056),staub*.65);
      diffuseColor.rgb = mix(diffuseColor.rgb,glas,hofSchaden);
    }
  }
`;

const HOF_ZIEL_FARBE = /* glsl */ `
  if (zielHaus > .5 && scanR < 3.5 && hofHausAnteil > 0.0) {
    // Die horizontale Trittplatte behält ihre eigene Oberfläche.
    if (scanR < 2.5 || hofN.y < .7) {
      vec3 farbe = hofLies(uHofZielFarbe, hofScanP * zielMassstab(scanR), scanR).rgb;
      vec2 ort = vec2(dot(vHausPos,hofT),vHausPos.y);
      float wasser = verfallRauschen(ort * vec2(3.2,.22));
      float nass = (1.0 - smoothstep(.15,1.42,vHoehe)) * (.32 + .68 * wasser);
      float grau = dot(farbe, vec3(.2126,.7152,.0722));
      if (scanR < .5) {
        // Ausbrüche konzentrieren sich am feuchten Mauerfuß und unter den Tropfkanten.
        float scholle = verfallRauschen(ort * vec2(1.1,1.54)) + .32 * verfallRauschen(ort * 5.5);
        float alt = smoothstep(.53,.95,scholle + .53 * nass);
        vec3 kalk = mix(farbe, vec3(grau), .69) * vec3(.91,.89,.84);
        farbe = mix(kalk, kalk * vec3(.43,.47,.43), alt);
      } else if (scanR < 1.5) {
        farbe = mix(farbe, vec3(grau), .80) * vec3(.65,.63,.59) * (.72 + .31 * wasser);
      } else if (scanR < 2.5) {
        farbe = mix(farbe, vec3(grau), .68) * vec3(.84,.83,.80);
      } else farbe *= (1.0 - nass * .35);
      ${HOF_DACHBRUCH_AN ? /* glsl */ `
      if (scanR < .5 || scanR > 2.5) {
        // Feuchte und Moos steigen in ungleichen Flecken aus den Sockelfugen.
        float feuchte = 1.0 - smoothstep(.22,1.34,vHoehe + (wasser - .44) * .85);
        float fleck = verfallRauschen(ort * vec2(5.0,6.1)) * .62 + wasser * .66;
        float moos = smoothstep(.46,.83,fleck) * feuchte;
        if (scanR > 2.5) farbe = mix(farbe,vec3(grau) * vec3(.88,.89,.84),.70);
        farbe = mix(farbe, farbe * vec3(.54,.69,.37), moos * .86);
      } else if (scanR > 1.5 && hofN.y > .50) {
        float fugen = verfallRauschen(ort * vec2(3.7,13.2));
        float moos = smoothstep(.54,.82,wasser * .69 + fugen * .53);
        farbe = mix(farbe, mix(farbe,vec3(.085,.09,.044),.78), moos * .63);
      }
      ` : ''}
      diffuseColor.rgb = farbe;
    }
  }
  if (zielHaus > .5 && vRolle > 5.5 && vRolle < 6.5) {
    // Maserung und ausgewaschene Farbe auf Rahmen und Fensterläden.
    vec3 n = abs(normalize(vHausNormal));
    float u = mix(vHausPos.x, vHausPos.z, step(n.z, n.x));
    float korn = verfallRauschen(vec2(u * 42.0, vHausPos.y * 1.45));
    float regen = verfallRauschen(vec2(u * 12.2, vHausPos.y * .45));
    float grau = dot(diffuseColor.rgb, vec3(.2126,.7152,.0722));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(grau) * vec3(1.04,.98,.88), .52);
    diffuseColor.rgb *= (.89 + .16 * korn) * (.70 + .40 * regen);
  }
  if (vRolle > 6.5) {
    // Blattadern laufen in der Ebene vom Stiel in die drei Blattspitzen.
    vec2 p = vRaumUv.xy;
    float y = p.y + .43;
    float seitennerv = abs(abs(p.x) - y * .89) * .75;
    float nerv = min(abs(p.x), max(seitennerv, y - .63));
    float breite = max(.006, fwidth(nerv));
    float ader = (1.0 - smoothstep(.005,.015 + breite,nerv)) * (.8 - .40 * y);
    float korn = verfallRauschen(p * 19.0);
    float saft = smoothstep(0.12,.52,length(p * vec2(1.03,.71)));
    diffuseColor.rgb *= (.87 + .22 * korn - .27 * saft);
    diffuseColor.rgb += ${HOF_DACHBRUCH_AN ? 'vec3(.035,.037,.021)' : 'vec3(.048,.046,.023)'} * ader;
  }
`;

/** Strahldichte einer brennenden Scheibe bei Glut 1, linear. Warmes Lampenlicht. */
const GLUT_FARBE = new THREE.Vector3(0.30, 0.21, 0.11);

export function baueHausMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.88, flatShading: true,
  });
  const glut = { value: 0 };
  material.userData.glut = glut;

  // Vollständig überlagerte Albedo-/Normalwerte werden später nicht mehr gelesen.
  // Die Scan-Basis und Verfallsdeckung bleiben für die Rauheit nötig. Gradienten
  // vor den räumlichen Zweig ziehen, damit der 38–48m-Übergang definiert bleibt.
  const anteilZeile = HOF_HAUS_FARBE.split('\n').find(z => z.includes('hofHausAnteil ='))!;
  const frontPass = HAUS_SHADER_SPAR_AN ? /* glsl */ `
    vec3 sparFrontN = normalize(vHausNormal);
    vec3 sparFrontT = abs(sparFrontN.y) > 0.97 ? vec3(1,0,0) : normalize(cross(sparFrontN, vec3(0,1,0)));
    float sparFrontPixel = max(fwidth(dot(vHausPos, sparFrontT) / 0.22), 0.001);
    if (!hofVoll) {
      ${HAUSFRONT_FARBE.replace('max(fwidth(brett), 0.001)', 'sparFrontPixel')}
    }` : HAUSFRONT_FARBE;
  const hofPass = HAUS_SHADER_SPAR_AN ? HOF_HAUS_FARBE.replace(anteilZeile, '') : HOF_HAUS_FARBE;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlut = glut;
    if (SCAN_TEXTUREN) {
      shader.uniforms.uScanFarbe = { value: SCAN_TEXTUREN.farbe };
      shader.uniforms.uScanNormal = { value: SCAN_TEXTUREN.normal };
      shader.uniforms.uScanMeter = { value: SCAN_METER };
      if (HOF_AN) Object.assign(shader.uniforms, hofUniforms(), {
        uHofFarbe: { value: hofTextur('scans', true) },
        uHofNormal: { value: hofTextur('scans-nor') },
        uHofArm: { value: hofTextur('scans-arm') },
        uHofMeter: { value: new THREE.Vector4(...HOF_SCANS.rollen.map(r => r.meter) as [number, number, number, number]) },
      });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float rolle;\nvarying float vRolle;\nvarying vec3 vHausPos;' + (BAUWELT_AN ? '\nattribute vec2 zustand;\nvarying vec2 vZustand;' : '') + (HAUSFRONT_AN ? '\nattribute vec3 raumUv;\nvarying vec3 vRaumUv;\nvarying vec3 vHausNormal;' : ''))
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vRolle = rolle;\n  vHausPos = (modelMatrix * vec4(transformed, 1.0)).xyz;' + (BAUWELT_AN ? '\n  vZustand = zustand;' : '') + (HAUSFRONT_AN ? '\n  vRaumUv = raumUv; vHausNormal = normalize(mat3(modelMatrix) * objectNormal);' : ''));
      if (BAUWELT_AN) shader.uniforms.uEfeu = { value: bueschelTextur('laub') };
      if (HOF_ZIEL_AN) Object.assign(shader.uniforms, {
        uHofZielFarbe: { value: hofTextur('ziel-farbe', true) },
        uHofZielNormal: { value: hofTextur('ziel-normal') },
      });
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + SCAN_PARS + (BAUWELT_AN ? VERFALL_PARS : '') + (HAUSFRONT_AN ? HAUSFRONT_PARS : '') + (HOF_AN ? HOF_HAUS_PARS : '')
          + (HOF_ZIEL_AN ? /* glsl */ `
uniform sampler2D uHofZielFarbe, uHofZielNormal;
float zielMassstab(float r) { return r < .5 ? 1.0 : r < 1.5 ? .92 : r < 2.5 ? 1.18 : .82; }
` : ''))
        .replace('#include <color_fragment>', `#include <color_fragment>
  float scanR = floor(vRolle + 0.5);
  ${HOF_ZIEL_AN ? 'float zielHaus = step(4.0, vZustand.x); if (scanR >= 6.0) scanR = 4.0;' : ''}
  vec2 scanP = vec2(0.0);
  ${HAUS_SHADER_SPAR_AN ? `${anteilZeile}\n  bool hofVoll = scanR < 3.5 && hofHausAnteil == 1.0;` : ''}
  if (scanR < 3.5) {
    scanP = scanUv(scanR);
    ${HAUS_SHADER_SPAR_AN ? '' : 'diffuseColor.rgb *= scanLies(uScanFarbe, scanP, scanR).rgb * 2.0;'}
  }
  ${HAUS_SHADER_SPAR_AN ? `vec2 scanGradX = dFdx(scanP), scanGradY = dFdy(scanP);
  if (scanR < 3.5 && !hofVoll) diffuseColor.rgb *= scanLiesGrad(uScanFarbe, scanP, scanR, scanGradX, scanGradY).rgb * 2.0;` : ''}
${BAUWELT_AN ? VERFALL_FARBE : ''}
${HAUSFRONT_AN ? frontPass : ''}
${HOF_AN ? hofPass.replace('vZustand.y', BAUWELT_AN ? 'vZustand.y' : '1.0') : ''}
${HOF_VERFALL_AN ? HOF_VERFALL_FARBE : ''}
${HOF_ZIEL_AN ? HOF_ZIEL_FARBE : ''}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (scanR < 3.5${HAUS_SHADER_SPAR_AN ? ' && !hofVoll' : ''}) {
    vec3 sn = ${HAUS_SHADER_SPAR_AN ? 'scanLiesGrad(uScanNormal, scanP, scanR, scanGradX, scanGradY)' : 'scanLies(uScanNormal, scanP, scanR)'}.xyz * 2.0 - 1.0;
    sn.xy *= 0.8${BAUWELT_AN ? ' * (1.0 - efeuDeckung)' : ''};
    vec3 nw = normalize(scanT * sn.x + scanB * sn.y + scanN * sn.z);
    normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
  }
${HOF_AN ? (HOF_ZIEL_AN ? HOF_HAUS_NORMAL.replace('hofLies(uHofNormal, hofScanP, scanR)',
  '((zielHaus > .5 && (scanR < 2.5 || hofN.y < .7)) ? hofLies(uHofZielNormal, hofScanP * zielMassstab(scanR), scanR) : hofLies(uHofNormal, hofScanP, scanR))') : HOF_HAUS_NORMAL) : ''}`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  if (scanR > 1.5 && scanR < 2.5) roughnessFactor = 0.72;
${HOF_AN ? 'if (scanR < 3.5) roughnessFactor = mix(roughnessFactor, clamp(hofArm.g, 0.5, 1.0), hofHausAnteil);' : ''}${BAUWELT_AN ? '\n  roughnessFactor = mix(roughnessFactor, 0.65, efeuDeckung);' : ''}
  // D285: Glas — glatt, spiegelt die Umgebungskarte (Himmelslicht \`?umlicht=1\`); dahinter dunkler Raum.
  // Leichte Welligkeit je Scheibe (alte Fenster), damit nicht jede Scheibe ein perfekter Spiegel ist.
  if (scanR > 4.5) roughnessFactor = 0.05 + 0.08 * fract(sin(dot(floor(vHausPos.xz * 1.3), vec2(12.9898, 78.233))) * 43758.5453);
  ${HOF_VERFALL_AN ? 'if (scanR > 4.5) roughnessFactor = mix(roughnessFactor, 0.9, hofSchaden);' : ''}`)
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>
${HOF_AN ? 'reflectedLight.indirectDiffuse *= mix(1.0, hofArm.r, hofHausAnteil * 0.55);' : ''}`)
        .replace('#include <lights_fragment_end>', `
  // D295: Vor RE_IndirectSpecular skalieren; danach wird radiance nicht mehr gelesen.
  if (scanR > 4.5) radiance *= ${HOF_VERFALL_AN ? 'mix(1.6, 0.18, hofSchaden)' : '1.6'};
  ${HOF_LICHT_AN ? /* glsl */ `
  // Näherung für vom Hofboden zurückgeworfenes Licht. Die Haus-AO greift danach.
  if (zielHaus > .5 && hofHausAnteil > 0.0 && scanR < 4.5) {
    vec3 nWand = normalize(vHausNormal);
    float ruecklicht = max(0.0, dot(nWand, vec3(.439,-.704,-.558)));
    float ecke = 1.0 - smoothstep(0.9,3.0,abs(vHoehe - 4.72));
    float laub = vRolle > 6.5 ? .69 : 1.0;
    irradiance += vec3(.84,.72,.55) * (.04 + .92 * ruecklicht) * (0.46 + 0.54 * ecke) * laub * hofHausAnteil;
  }
  ` : ''}
  #include <lights_fragment_end>`);
    }
    shader.uniforms.uGlutFarbe = { value: GLUT_FARBE };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float glut;\nvarying float vGlut;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlut = glut;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlut;\nuniform vec3 uGlutFarbe;\nvarying float vGlut;')
      .replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
  totalEmissiveRadiance += uGlutFarbe * (vGlut * uGlut);
`);
  };
  material.customProgramCacheKey = () => 'brachland-haus-glut-v2' + (SCAN_TEXTUREN ? '-scans' : '') + (BAUWELT_AN ? '-verfall' : '') + (HAUSFRONT_AN ? '-hausfront' : '') + (HOF_AN ? '-scanhof' : '') + (HAUS_SHADER_SPAR_AN ? '-spar' : '') + (HOF_BODEN_AN ? '-hofboden' : '') + (HOF_VERFALL_AN ? '-hofverfall' : '') + (HOF_ZIEL_AN ? '-hofziel' : '') + (HOF_DACHBRUCH_AN ? '-hofdachbruch' : '') + (HOF_LICHT_AN ? '-hoflicht' : '');
  return material;
}
