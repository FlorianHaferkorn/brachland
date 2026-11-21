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
import { BAUWELT_AN, HAUS_ECHT, HAUSFRONT_AN, HOF_AN, HAUS_SHADER_SPAR_AN, HOF_BODEN_AN, HOF_VERFALL_AN, HOF_ZIEL_AN, HOF_DACHBRUCH_AN, HOF_LICHT_AN, HOF_ZIELTREUE_AN, HOF_VERFALLVERLAUF_AN, HOF_ORTSALTERUNG_AN, WESTVERFALL_AN, WESTDETAIL_AN, WESTFASSADE_AN, WESTANSCHLUSS_AN } from './echt.js';
import { bueschelTextur } from './laubkarten.js';
import { HAUSFRONT_PARS, HAUSFRONT_FARBE } from './hausfront.js';
import { hofTextur, hofUniforms, HOF_HAUS_PARS, HOF_HAUS_FARBE, HOF_HAUS_NORMAL } from './hofmaterial.js';
import { MILBINGERDETAIL_AN, MILBINGERSUBSTANZ_AN, POM_AN } from './echt.js';
import { pomPars, pomWahl, POM_FUGE } from './hauspom.js';
import { OBERFLAECHEN_GLSL } from './oberflaechen.js';
import type { Wiesenbereich } from './wiesenbereich.js';
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
  return { farbe: lade('/material/haus-scans.webp'), normal: lade('/material/haus-scans-nor.webp'),
    // D365: Höhe für POM (`hauspom.ts`, `tools/hoehenkarten.py`), dasselbe Atlaslayout in halber Auflösung.
    hoehe: POM_AN ? lade('/material/haus-scans-hoehe.webp') : null };
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
  float vStufe = ${HOF_ORTSALTERUNG_AN ? 'floor(mod(vZustand.x,4.0))' : HOF_ZIEL_AN ? 'vZustand.x - 4.0 * zielHaus' : 'vZustand.x'}, vHoehe = vZustand.y;
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
      ${WESTVERFALL_AN ? /* glsl */ `
      bool westRanken = vZustand.x >= 56.0 && scanR < 1.5;
      if (westRanken) {
        float wurzel = 1.0 - smoothstep(1.0 + 2.6*n1, 2.5 + 3.0*n1, vHoehe);
        mass = wurzel * smoothstep(.29,.70,n1*.89 + n2*.34);
      }
      ` : ''}
      if (mass > 0.01${HOF_ZIEL_AN ? ' && zielHaus < .5' : ''}${HOF_ORTSALTERUNG_AN
        ? WESTVERFALL_AN ? ' && (vZustand.x < 8.0 || westRanken)' : ' && vZustand.x < 8.0' : ''}) {
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
  ${HOF_VERFALLVERLAUF_AN ? /* glsl */ `
  float freigelegt = 0.0;
  float verfallFeuchte = 0.0;
  vec2 bruchsteinUv = vec2(0.0);
  if (zielHaus > .5 && vRolle < 6.5 && scanR < 4.5) {
    // Koordinaten der gebrochenen Traufwand. Dieselbe Spur läuft über Putz, Holz und Einfassung.
    vec2 ecke = vHausPos.xz - vec2(1425.846,408.901);
    vec2 wand = vec2(dot(ecke,vec2(.468,.884)),dot(ecke,vec2(.884,-.468)));
    vec2 p = vec2(wand.x + wand.y * .67,vHausPos.y);
    float fleck = verfallRauschen(p * vec2(1.33,1.58));
    float schlieren = verfallRauschen(p * vec2(5.4,.63));
    float bruch = (1.0 - smoothstep(1.55,3.68,abs(wand.x - 3.18)))
      * (1.0 - smoothstep(.52,1.92,abs(wand.y)));
    float spuelfront = 1.3 + .84 * fleck + .55 * schlieren;
    float regen = bruch * smoothstep(spuelfront - .33,spuelfront + .52,vHoehe);
    float kapillar = 1.0 - smoothstep(.15,.84 + .91 * schlieren,vHoehe);
    float rankenspur = (1.0 - smoothstep(.28,1.48 + .55 * fleck,length(ecke))) * (.37 + .63 * fleck);
    verfallFeuchte = max(regen * (.35 + .65 * schlieren),max(kapillar * (.40 + .60 * fleck),rankenspur));
    freigelegt = smoothstep(.69,1.03, .58 * fleck + .32 * schlieren + .52 * verfallFeuchte);
    vec3 lokal = vHausPos - vec3(uHofMitte.x,0.0,uHofMitte.y);
    bruchsteinUv = vec2(dot(lokal,hofT),dot(lokal,hofB)) * zielMassstab(3.0) / uHofMeter.w;
  }
  ` : ''}
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
      ${HOF_ZIELTREUE_AN ? /* glsl */ `
      // Unregelmäßige Feuchte folgt Fugen, Verfärbung und Holzfasern derselben Flächen.
      float ruecksprung = verfallRauschen(ort * vec2(1.7,3.5));
      if (scanR < .5) {
        float laeufer = verfallRauschen(ort * vec2(14.0,0.42));
        float feuchteRand = 1.0 - smoothstep(.19,1.13,vHoehe + (ruecksprung - .5) * .71);
        float schollen = smoothstep(.51,.76,ruecksprung + .31 * laeufer);
        farbe = mix(farbe * .80, vec3(.145,.124,.094), .26);
        vec3 bodenmoos = farbe * vec3(.60,.72,.51);
        farbe = mix(farbe,bodenmoos,feuchteRand * schollen * .86);
        farbe *= 1.0 - .17 * schollen;
      } else if (scanR < 1.5 && abs(hofN.y) < .48) {
        float leiste = verfallRauschen(vec2(ort.x * 10.6, ort.y * .39));
        farbe *= .67 + .55 * leiste + .12 * ruecksprung;
      } else if (scanR > 1.5 && scanR < 2.5 && hofN.y > .35) {
        float moos = smoothstep(.48,.78,ruecksprung);
        float grau = dot(farbe,vec3(.2126,.7152,.0722));
        farbe = mix(farbe * .62, vec3(grau) * mix(vec3(.72,.71,.65),vec3(.75,.80,.51),moos), .64);
      } else if (scanR > 2.5) {
        farbe *= .65 + .48 * ruecksprung;
      }
      ` : ''}
      ${HOF_VERFALLVERLAUF_AN ? /* glsl */ `
      if (scanR < .5) {
        // Abgeplatzter Kalk legt dasselbe Bruchsteinmaterial wie am Sockel frei.
        vec3 stein = hofLies(uHofZielFarbe,bruchsteinUv,3.0).rgb;
        float steinHell = dot(stein,vec3(.2126,.7152,.0722));
        vec3 schale = mix(stein,vec3(steinHell) * vec3(.90,.96,.79),.48) * .82;
        float rissRand = smoothstep(.10,.52,freigelegt) * (1.0 - smoothstep(.51,.84,freigelegt));
        farbe = mix(farbe * (1.0 - .20 * rissRand),schale,freigelegt * .90);
      }
      vec3 feuchtFarbe = farbe * vec3(.62,.69,.51);
      farbe = mix(farbe,feuchtFarbe,verfallFeuchte * .57);
      ` : ''}
      diffuseColor.rgb = farbe;
    }
  }
  if ((zielHaus > .5${WESTDETAIL_AN ? ' || vZustand.x >= 24.0' : ''}) && vRolle > 5.5 && vRolle < 6.5) {
    // Maserung und ausgewaschene Farbe auf Rahmen und Fensterläden.
    vec3 n = abs(normalize(vHausNormal));
    float u = mix(vHausPos.x, vHausPos.z, step(n.z, n.x));
    float korn = verfallRauschen(vec2(u * 42.0, vHausPos.y * 1.45));
    float regen = verfallRauschen(vec2(u * 12.2, vHausPos.y * .45));
    float grau = dot(diffuseColor.rgb, vec3(.2126,.7152,.0722));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(grau) * vec3(1.04,.98,.88), .52);
    diffuseColor.rgb *= (.89 + .16 * korn) * (.70 + .40 * regen);
    ${HOF_ZIELTREUE_AN ? /* glsl */ `
    // Verbleibende Farbe bricht in Inseln auf und gibt dunkleres Holz frei.
    float faser = verfallRauschen(vec2(u * 158.0, vHausPos.y * 3.2));
    float abplatzer = smoothstep(.51,.75,regen * .62 + korn * .28 + faser * .37)
      ${WESTDETAIL_AN ? '* (vZustand.x >= 24.0 ? (.28 + .36*vStufe) : 1.0)' : ''};
    vec3 altHolz = vec3(.119,.099,.074) * (.53 + .63 * faser);
    vec3 farbanstrich = diffuseColor.rgb * (.73 + .28 * faser);
    diffuseColor.rgb = mix(farbanstrich, altHolz, abplatzer * .79);
    ` : ''}
  }
  if (vRolle > 6.5) {
    ${HOF_ZIELTREUE_AN ? /* glsl */ `
    // Die Blattkontur ist Geometrie. Die Farbkarte liefert Pigment und feine Adern.
    vec2 blattUv = clamp(vRaumUv.xy * vec2(.81,.76) + vec2(.5,.394), .028, .972);
    vec3 blattFarbe = texture2D(uHofEfeuFarbe, blattUv).rgb;
    float samenhell = dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
    float reife = smoothstep(.027,.13,samenhell);
    vec3 altersTon = mix(vec3(.70,.87,.83),vec3(.99,1.02,.80),reife);
    diffuseColor.rgb = mix(diffuseColor.rgb, blattFarbe * altersTon * (.38 + 6.1 * samenhell),.79);
    ${WESTVERFALL_AN ? 'if (vZustand.x >= 56.0) diffuseColor.rgb *= vec3(1.27,1.38,1.18);' : ''}
    ${HOF_ORTSALTERUNG_AN ? /* glsl */ `
    float blattHell = dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
    vec3 matt = vec3(blattHell) * mix(vec3(.76,.94,.76),vec3(1.06,1.04,.76),reife);
    diffuseColor.rgb = mix(diffuseColor.rgb,matt,.42);
    ` : ''}
    ` : /* glsl */ `
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
    `}
  }
  ${HOF_VERFALLVERLAUF_AN ? /* glsl */ `
  if (zielHaus > .5 && vRolle > 3.5 && vRolle < 6.5 && (scanR < 4.5 || vRolle > 5.5)) {
    diffuseColor.rgb *= mix(vec3(1.0),vec3(.66,.70,.59),verfallFeuchte * .60);
  }
  ` : ''}
`;

const ORTSALTERUNG_FARBE = /* glsl */ `
  if (vZustand.x >= 8.0 && zielHaus < .5 && scanR < 4.5) {
    float werte = floor(fract(vZustand.x) * 4096.0 + .5);
    float feuchte = floor(werte / 64.0) / 63.0;
    float abnutzung = mod(werte,64.0) / 63.0;
    vec3 wandNormal = normalize(vHausNormal);
    float wandAnteil = 1.0 - smoothstep(.46,.73,abs(wandNormal.y));
    float kuehl = .72 - .24 * wandNormal.z;
    vec2 ort = vHausPos.xz - uHofMitte;
    vec2 wand = vec2(dot(ort,vec2(-wandNormal.z,wandNormal.x)), vHausPos.y);
    float laeufer = verfallRauschen(wand * vec2(1.65,.21));
    float fleck = verfallRauschen(wand * vec2(1.93,1.37) + ort * .12);
    float bodennaesse = 1.0 - smoothstep(.18,.35 + 1.92*feuchte*kuehl,vHoehe + (fleck-.45)*.83);
    float bewittert = abnutzung * (.38 + .62 * fleck);
    float nass = feuchte * kuehl * max(wandAnteil * bodennaesse,laeufer * (.38 + .36 * abnutzung));
    vec3 farbe = diffuseColor.rgb;
    if (scanR < .5 && wandAnteil > .5) {
      // Unter dem ausgewaschenen Putz kommt körniges, dunkleres Mauerwerk zum Vorschein.
      float ausbruch = smoothstep(.67,.97,fleck*.56 + laeufer*.24 + bewittert*.47 + nass*.55);
      float korn = verfallRauschen(wand * 5.4);
      vec3 stein = vec3(.123,.109,.089) * (.62 + .48*korn + .41*fleck);
      ${WESTVERFALL_AN ? /* glsl */ `
      // Sockel und Ablaufspuren bestimmen, wo die Schicht großflächig abgeplatzt ist.
      if (vZustand.x >= 24.0) {
        float pflege = clamp(vStufe * .54,0.0,1.0);
        float riss = smoothstep(.48,.79,fleck*.42 + laeufer*.32 + nass*.63 + korn*.08);
        ausbruch = max(ausbruch, riss * pflege);
        farbe *= 1.0 - pflege * (.11 + .36 * nass);
      }
      ` : ''}
      farbe = mix(farbe * (1.0 - .26*bewittert),stein,ausbruch*.73);
    } else if (scanR > 1.5 && scanR < 2.5 && wandNormal.y > .32) {
      float schollen = smoothstep(.52,.84,laeufer*.54 + fleck*.30 + feuchte*.39);
      farbe = mix(farbe,farbe * vec3(.66,.72,.49),schollen * abnutzung);
    }
    // Die waagerechte Trittfläche bleibt lesbar, auch bei nassen Fugen darunter.
    if (scanR < 2.5 || wandAnteil > .25) {
      float hell = dot(farbe,vec3(.2126,.7152,.0722));
      farbe = mix(farbe,vec3(hell) * vec3(1.07,1.0,.88),bewittert*.53);
      diffuseColor.rgb = farbe * mix(vec3(1.0),vec3(.57,.64,.46),nass*.84);
    }
  }
`;

const HOF_ZIEL_NORMAL = HOF_HAUS_NORMAL.replace('hofLies(uHofNormal, hofScanP, scanR)', /* glsl */ `
    ((zielHaus > .5 && (scanR < 2.5 || hofN.y < .7))
      ? hofLies(uHofZielNormal, hofScanP * zielMassstab(scanR), scanR)
      : hofLies(uHofNormal, hofScanP, scanR))`);
const HOF_VERLAUF_NORMAL = HOF_ZIEL_NORMAL.replace('    hn.xy *=', /* glsl */ `
    if (scanR < .5 && zielHaus > .5) {
      vec3 steinNormal = hofLies(uHofZielNormal,bruchsteinUv,3.0).xyz * 2.0 - 1.0;
      hn = normalize(mix(hn,steinNormal,freigelegt * .90));
    }
    hn.xy *=`);

// Derselbe Detailatlas wie am Hof. Die Flächenbasis folgt jedem Brett und Sparren.
const WESTDETAIL_FARBE = /* glsl */ `
  vec3 detailN = normalize(vHausNormal);
  bool westMaterial = vZustand.x >= 24.0 && scanR < 3.5 && vRolle < 5.5
    && (scanR < 2.5 || detailN.y < .75);
  vec2 detailUv = vec2(0.0), detailStein = vec2(0.0);
  vec3 detailT = vec3(1.0,0.0,0.0), detailB = vec3(0.0,1.0,0.0);
  float detailAusbruch = 0.0, detailNass = 0.0;
  if (westMaterial) {
    detailT = abs(detailN.y) > .97 ? vec3(1,0,0) : normalize(cross(vec3(0,1,0),detailN));
    detailB = cross(detailN,detailT);
    vec3 lokal = vHausPos - vec3(uHofMitte.x,0,uHofMitte.y);
    vec2 p = vec2(dot(lokal,detailT),dot(lokal,detailB));
    float meter = scanR < .5 ? uHofMeter.x : scanR < 1.5 ? uHofMeter.y : scanR < 2.5 ? uHofMeter.z : uHofMeter.w;
    detailUv = p * zielMassstab(scanR) / meter;
    detailStein = p * zielMassstab(3.0) / uHofMeter.w;
    float feuchte = floor(floor(fract(vZustand.x)*4096.0+.5)/64.0)/63.0;
    float schaden = vStufe*.5;
    float wolke = verfallRauschen(p*vec2(1.2,1.85));
    float lauf = verfallRauschen(p*vec2(7.6,.43));
    float rand = verfallRauschen(p*8.7);
    float sockel = 1.0 - smoothstep(.07, .8 + feuchte*(.76+lauf*.7), vHoehe+rand*.39);
    detailNass = feuchte * (.64 + .32*max(0.0,-detailN.z))
      * max(sockel*.92, schaden*lauf*wolke*.76);
    ${WESTFASSADE_AN ? /* glsl */ `
    if (scanR < .5 && ${WESTANSCHLUSS_AN ? 'mod(vRaumUv.z, 2.0)' : 'vRaumUv.z'} > .5) {
      // Aus dem Bruchrand läuft Wasser über die erhaltene Mauer.
      float spur = 1.0 - smoothstep(.05, .43, abs(vRaumUv.x + .21*(lauf-.5)));
      float ablauf = 1.0 - smoothstep(.14, 2.45, max(0.0, -vRaumUv.y + wolke*.39));
      detailNass = max(detailNass, spur*ablauf*(.37 + .48*rand));
    }
    ` : ''}
    ${WESTANSCHLUSS_AN ? /* glsl */ `
    float spritzwasser = 0.0;
    if (vRaumUv.z >= 2.0) {
      float randhoehe = .17 + schaden*.30 + wolke*.24 + lauf*.29;
      float flecken = smoothstep(.30,.70,wolke*.50 + lauf*.29 + rand*.21);
      spritzwasser = (1.0 - smoothstep(.04,randhoehe,vHoehe)) * flecken;
      detailNass = max(detailNass, spritzwasser * (.23 + schaden*.52 + feuchte*.19));
    }
    ` : ''}
    vec3 farbe = hofLies(uHofZielFarbe,detailUv,scanR).rgb;
    float grau = dot(farbe,vec3(.2126,.7152,.0722));
    if (scanR < .5) {
      detailAusbruch = smoothstep(.56 + .28*(1.0-schaden), .88 + .20*(1.0-schaden),
        wolke*.56 + lauf*.27 + rand*.17 + detailNass*.59);
      ${WESTANSCHLUSS_AN ? 'detailAusbruch = max(detailAusbruch, spritzwasser * (.23 + schaden*.71));' : ''}
      vec3 stein = hofLies(uHofZielFarbe,detailStein,3.0).rgb;
      vec3 kalk = mix(farbe,vec3(grau)*vec3(1.01,.99,.93),.66);
      if (vStufe < .5) {
        // An der gepflegten Fassade trägt die ausgebesserte Kalkschicht nur am Sockel Altspuren.
        vec3 neu = hofLies(uHofFarbe,detailUv,0.0).rgb;
        kalk = mix(kalk,neu*vec3(.94,.93,.86),.73-sockel*.37);
      }
      farbe = mix(kalk*.95, stein*vec3(.89,.88,.80), detailAusbruch*.97);
    } else if (scanR < 1.5) {
      farbe = mix(farbe,vec3(grau)*vec3(.95,.90,.80),.44 + .38*schaden) * (.89 - .20*schaden + .21*lauf);
    } else if (scanR < 2.5) {
      float moos = smoothstep(.46,.84,wolke*.56 + lauf*.28 + .31*feuchte);
      farbe = mix(farbe*.81,farbe*vec3(.65,.74,.42),moos*feuchte);
    }${WESTANSCHLUSS_AN ? ' else if (vRaumUv.z >= 2.0) { farbe *= mix(vec3(1.0), vec3(.76,.77,.63), spritzwasser); }' : ''}
    farbe *= mix(vec3(1.0),vec3(.56,.63,.45),detailNass);
    if (scanR < 1.5) farbe = mix(farbe,efeuFarbe,efeuDeckung*.78);
    diffuseColor.rgb = mix(diffuseColor.rgb,farbe,.93);
  }
`;

const WESTDETAIL_NORMAL = /* glsl */ `
  if (westMaterial) {
    vec3 n = hofLies(uHofZielNormal,detailUv,scanR).xyz*2.0-1.0;
    if (scanR < .5 && detailAusbruch > .015) {
      vec3 stein = hofLies(uHofZielNormal,detailStein,3.0).xyz*2.0-1.0;
      n = mix(n,stein,detailAusbruch);
    }
    n.xy *= mix(.91,1.22,detailAusbruch)*(1.0-.75*efeuDeckung);
    vec3 welt = normalize(detailT*n.x+detailB*n.y+detailN*n.z);
    normal = normalize((viewMatrix*vec4(welt,0.0)).xyz);
  }
`;

const MILBINGER_HAUS_PARS = /* glsl */ `
uniform vec4 uWiesenbereich;
float milbingerHausGewicht(vec2 ort) {
  // Gebäudegrundrisse reichen über die Wiesenmaske am Straßenrand hinaus.
  vec2 aussen = max(uWiesenbereich.xy - ort, ort - uWiesenbereich.zw);
  return 1.0 - smoothstep(5.0, 16.0, max(aussen.x, aussen.y));
}
`;

const milbingerFarbe = (substrat: boolean) => /* glsl */ `
  float milbingerAnteil = milbingerHausGewicht(vHausPos.xz)
    * (1.0 - smoothstep(55.0, 88.0, length(vViewPosition))) * (1.0 - zielHaus);
  if (vZustand.x >= 24.0 || vRolle >= 5.5) milbingerAnteil = 0.0;
  vec3 altN = normalize(vHausNormal);
  vec3 altT = abs(altN.y) > .97 ? vec3(1,0,0) : normalize(cross(vec3(0,1,0), altN));
  vec3 altB = cross(altN, altT);
  vec3 altLokal = vHausPos - vec3(uWiesenbereich.x, 0.0, uWiesenbereich.y);
  vec2 altOrt = vec2(dot(altLokal, altT), dot(altLokal, altB));
  vec2 altDx = dFdx(altOrt), altDy = dFdy(altOrt);
  float altMeter = scanR < .5 ? uHofMeter.x : scanR < 1.5 ? uHofMeter.y : scanR < 2.5 ? uHofMeter.z : uHofMeter.w;
  vec3 altArm = vec3(1.0,.84,0.0);
  float altFeucht = 0.0, altBruch = 0.0;
  ${substrat ? 'float fassadenRelief = 0.0;' : ''}
  if (milbingerAnteil > 0.0) {
    float alter = clamp(.54 + .22 * vStufe, .52, .98);
    float wetter = .74 + .22 * max(0.0, -altN.z);
    float putzfleck = verfallRauschen(altOrt * vec2(.66,1.01));
    float laeufer = verfallRauschen(altOrt * vec2(4.8,.38));
    float korn = verfallRauschen(altOrt * 7.5);
    float sockel = (1.0 - smoothstep(.08, 1.42 + 1.05 * putzfleck, vHoehe))
      * smoothstep(.24,.76, .71 * putzfleck + .29 * laeufer);
    float auswaschung = smoothstep(.46,.83, laeufer * .71 + putzfleck * .29);
    altFeucht = alter * wetter * max(sockel, auswaschung * .48);
    vec3 farbe = diffuseColor.rgb;
    if (scanR < 3.5) {
      vec2 p = altOrt / altMeter;
      vec3 scan = hofLiesGrad(uHofFarbe, p, scanR, altDx / altMeter, altDy / altMeter).rgb;
      altArm = hofLiesGrad(uHofArm, p, scanR, altDx / altMeter, altDy / altMeter).rgb;
      float kontakt = mix(.61,1.0,smoothstep(.03, .62, vHoehe));
      if (scanR < .5) {
        // Spritzwasser, lange Ablaufspuren und dünne Putzränder an freiliegendem Feldstein.
        float abtrag = (putzfleck*.48 + laeufer*.28 + korn*.12 + sockel*.48) * alter;
        altBruch = smoothstep(.43,.67,abtrag);
        float kante = smoothstep(.39,.48,abtrag) * (1.0 - smoothstep(.52,.60,abtrag));
        float steinMeter = uHofMeter.w * .80;
        vec3 stein = hofLiesGrad(uHofFarbe, altOrt / steinMeter, 3.0, altDx / steinMeter, altDy / steinMeter).rgb;
        vec3 kalk = mix(farbe * .72, scan * vec3(1.09,1.04,.93), .74);
        kalk *= mix(vec3(.64,.66,.58), vec3(1.0), .54 + .44 * putzfleck);
        farbe = mix(kalk * (1.0 + .17 * kante), stein * vec3(.77,.71,.61), altBruch);
        farbe *= mix(vec3(1),vec3(.52,.56,.41),altFeucht * .79) * kontakt;
        farbe = mix(farbe,efeuFarbe,efeuDeckung*.66);
      } else if (scanR < 1.5) {
        float t = dot(scan,vec3(.2126,.7152,.0722));
        farbe = mix(scan * vec3(.73,.65,.55), vec3(t) * vec3(.91,.87,.77), .58 + .26 * alter)
          * mix(.64,1.13,putzfleck);
        farbe = mix(farbe,efeuFarbe,efeuDeckung*.75) * (1.0 - .34 * altFeucht);
      } else if (scanR < 2.5) {
        // Die Dachfarbe aus dem Luftbild bleibt als Tönung im Scan erhalten.
        float ton = max(.02, dot(farbe,vec3(.2126,.7152,.0722)));
        vec3 dach = scan * mix(vec3(1),clamp(farbe/ton,.52,1.7),.62);
        float moos = smoothstep(.44,.78,.61*putzfleck + .23*laeufer + .14*korn + .12*wetter) * alter
          * smoothstep(.12,.48,altN.y);
        farbe = mix(dach * (.68 + .25 * putzfleck), dach * vec3(.62,.83,.35) + vec3(.015,.02,.008), moos);
        altFeucht = moos * .65;
      } else {
        farbe = mix(farbe,scan*vec3(.74,.70,.60),.84) * kontakt * (1.0 - .60 * altFeucht);
      }
      ${substrat ? /* glsl */ `
      float altPixel = max(length(altDx),length(altDy));
      float zuschlag = substratKorn(altOrt,altPixel,31.0) - .5;
      float mineralisch = 1.0 - step(.5,scanR) + step(2.5,scanR);
      float fugenprofil = .012*(altArm.r-.63) - .019*altBruch;
      float putzKorn = .0064*zuschlag*(.34 + .88*altBruch);
      fassadenRelief = (fugenprofil + putzKorn)*mineralisch*milbingerAnteil*(1.0-.72*efeuDeckung);
      farbe *= 1.0 + mineralisch*(zuschlag*.46 - .20*(1.0-altArm.r));
      ` : ''}
    } else {
      // Lack und Glas brechen den hellen Himmelsreflex an verlassenen Häusern fleckig auf.
      farbe *= mix(.53,.92,.56 * laeufer + .44 * putzfleck);
      if (scanR < 4.5 && farbe.g > 1.18 * max(farbe.r, farbe.b)) {
        float m = uHofMeter.y * .44;
        vec3 holz = hofLiesGrad(uHofFarbe,altOrt/m,1.0,altDx/m,altDy/m).rgb;
        float lack = smoothstep(.44,.79, .5*laeufer + .3*putzfleck + .2*korn) * alter;
        farbe = mix(farbe * (.66 + 1.22*holz.r), holz*vec3(.69,.66,.56), lack*.73);
      }
    }
    diffuseColor.rgb = mix(diffuseColor.rgb,farbe,milbingerAnteil);
  }
`;

const MILBINGER_NORMAL = /* glsl */ `
  if (milbingerAnteil > 0.0 && scanR < 3.5) {
    vec3 n = hofLiesGrad(uHofNormal, altOrt / altMeter, scanR, altDx / altMeter, altDy / altMeter).xyz * 2.0 - 1.0;
    if (altBruch > .01) {
      float m = uHofMeter.w * .80;
      vec3 stein = hofLiesGrad(uHofNormal, altOrt / m, 3.0, altDx / m, altDy / m).xyz * 2.0 - 1.0;
      n = normalize(mix(n,stein,altBruch));
    }
    n.xy *= mix(.69,1.16,altBruch) * (1.0 - .65*efeuDeckung);
    vec3 welt = normalize(altT*n.x + altB*n.y + altN*n.z);
    normal = normalize(mix(normal,(viewMatrix*vec4(welt,0.0)).xyz,milbingerAnteil));
  }
`;

/** Strahldichte einer brennenden Scheibe bei Glut 1, linear. Warmes Lampenlicht. */
const GLUT_FARBE = new THREE.Vector3(0.30, 0.21, 0.11);

export function baueHausMaterial(wiesenbereich?: Wiesenbereich): THREE.MeshStandardMaterial {
  const milbinger = MILBINGERDETAIL_AN && wiesenbereich;
  const substrat = MILBINGERSUBSTANZ_AN && !!milbinger;
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
  const hofNormal = HOF_VERFALLVERLAUF_AN ? HOF_VERLAUF_NORMAL : HOF_ZIEL_AN ? HOF_ZIEL_NORMAL : HOF_HAUS_NORMAL;
  const verfall = milbinger ? VERFALL_FARBE.replace('      if (mass > 0.01', /* glsl */ `
      // An den Milbinger Putzwänden bilden die räumlichen Ranken die Blattdeckung.
      if (vZustand.x < 24.0 && zielHaus < .5) mass *= 1.0 - milbingerHausGewicht(vHausPos.xz);
      if (mass > 0.01`) : VERFALL_FARBE;
  // D365: POM verschiebt die Weltlage in der Wandebene; die flache Normale bleibt aus der unverschobenen Lage.
  const scanPars = POM_AN ? SCAN_PARS.replace('varying vec3 vHausPos;', 'varying vec3 vHausPos;' + pomPars(HOF_AN, HOF_ZIEL_AN))
    .replace('cross(dFdx(vHausPos), dFdy(vHausPos))', 'cross(dFdx(hausPosRoh()), dFdy(hausPosRoh()))') : SCAN_PARS;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlut = glut;
    if (SCAN_TEXTUREN) {
      shader.uniforms.uScanFarbe = { value: SCAN_TEXTUREN.farbe };
      shader.uniforms.uScanNormal = { value: SCAN_TEXTUREN.normal };
      shader.uniforms.uScanMeter = { value: SCAN_METER };
      if (milbinger) shader.uniforms.uWiesenbereich = { value: milbinger.rahmen };
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
      if (HOF_ZIELTREUE_AN) shader.uniforms.uHofEfeuFarbe = { value: hofTextur('efeu-farbe', true) };
      if (POM_AN) {
        shader.uniforms.uPomHaus = { value: SCAN_TEXTUREN.hoehe };
        if (HOF_AN) shader.uniforms.uPomHof = { value: hofTextur('scans-hoehe') };
        if (HOF_ZIEL_AN) shader.uniforms.uPomZiel = { value: hofTextur('ziel-hoehe') };
      }
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + scanPars + (BAUWELT_AN ? VERFALL_PARS : '') + (HAUSFRONT_AN ? HAUSFRONT_PARS : '') + (HOF_AN ? HOF_HAUS_PARS : '')
          + (HOF_ZIEL_AN ? /* glsl */ `
uniform sampler2D uHofZielFarbe, uHofZielNormal;
float zielMassstab(float r) { return r < .5 ? 1.0 : r < 1.5 ? .92 : r < 2.5 ? 1.18 : .82; }
` : '') + (HOF_ZIELTREUE_AN ? '\nuniform sampler2D uHofEfeuFarbe;\n' : '') + (milbinger ? MILBINGER_HAUS_PARS : '')
          + (substrat ? OBERFLAECHEN_GLSL : ''))
        .replace('#include <color_fragment>', `#include <color_fragment>
  float scanR = floor(vRolle + 0.5);
  ${HOF_ZIEL_AN ? `float zielHaus = step(4.0, ${HOF_ORTSALTERUNG_AN ? 'mod(vZustand.x,8.0)' : 'vZustand.x'}); if (scanR >= 6.0) scanR = 4.0;` : ''}
  ${POM_AN ? pomWahl({ hof: HOF_AN, ziel: HOF_ZIEL_AN, west: WESTDETAIL_AN, milbinger: !!milbinger, normale: HAUSFRONT_AN }) : ''}
  vec2 scanP = vec2(0.0);
  ${HAUS_SHADER_SPAR_AN ? `${anteilZeile}\n  bool hofVoll = scanR < 3.5 && hofHausAnteil == 1.0;` : ''}
  if (scanR < 3.5) {
    scanP = scanUv(scanR);
    ${HAUS_SHADER_SPAR_AN ? '' : 'diffuseColor.rgb *= scanLies(uScanFarbe, scanP, scanR).rgb * 2.0;'}
  }
  ${HAUS_SHADER_SPAR_AN ? `vec2 scanGradX = dFdx(scanP), scanGradY = dFdy(scanP);
  if (scanR < 3.5 && !hofVoll) diffuseColor.rgb *= scanLiesGrad(uScanFarbe, scanP, scanR, scanGradX, scanGradY).rgb * 2.0;` : ''}
${BAUWELT_AN ? verfall : ''}
${HAUSFRONT_AN ? frontPass : ''}
${HOF_AN ? hofPass.replace('vZustand.y', BAUWELT_AN ? 'vZustand.y' : '1.0') : ''}
${HOF_VERFALL_AN ? HOF_VERFALL_FARBE : ''}
${HOF_ZIEL_AN ? HOF_ZIEL_FARBE : ''}
${HOF_ORTSALTERUNG_AN ? ORTSALTERUNG_FARBE : ''}
${WESTVERFALL_AN ? 'if (vZustand.x >= 24.0 && vStufe > 1.5 && scanR > 4.5) diffuseColor.rgb *= .51;' : ''}
${WESTDETAIL_AN ? WESTDETAIL_FARBE : ''}
${milbinger ? milbingerFarbe(substrat) : ''}
${POM_AN ? POM_FUGE : ''}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (scanR < 3.5${HAUS_SHADER_SPAR_AN ? ' && !hofVoll' : ''}${WESTDETAIL_AN ? ' && !westMaterial' : ''}) {
    vec3 sn = ${HAUS_SHADER_SPAR_AN ? 'scanLiesGrad(uScanNormal, scanP, scanR, scanGradX, scanGradY)' : 'scanLies(uScanNormal, scanP, scanR)'}.xyz * 2.0 - 1.0;
    sn.xy *= 0.8${BAUWELT_AN ? ' * (1.0 - efeuDeckung)' : ''};
    vec3 nw = normalize(scanT * sn.x + scanB * sn.y + scanN * sn.z);
    normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
  }
${HOF_AN ? hofNormal : ''}
${WESTDETAIL_AN ? WESTDETAIL_NORMAL : ''}
${milbinger ? MILBINGER_NORMAL : ''}
${substrat ? 'normal = substratNormale(normal, vViewPosition, fassadenRelief * (1.0 - smoothstep(9.0,32.0,length(vViewPosition))), faceDirection);' : ''}`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  if (scanR > 1.5 && scanR < 2.5) roughnessFactor = 0.72;
${HOF_AN ? 'if (scanR < 3.5) roughnessFactor = mix(roughnessFactor, clamp(hofArm.g, 0.5, 1.0), hofHausAnteil);' : ''}${BAUWELT_AN ? '\n  roughnessFactor = mix(roughnessFactor, 0.65, efeuDeckung);' : ''}
  // D285: Glas — glatt, spiegelt die Umgebungskarte (Himmelslicht \`?umlicht=1\`); dahinter dunkler Raum.
  // Leichte Welligkeit je Scheibe (alte Fenster), damit nicht jede Scheibe ein perfekter Spiegel ist.
  if (scanR > 4.5) roughnessFactor = 0.05 + 0.08 * fract(sin(dot(floor(vHausPos.xz * 1.3), vec2(12.9898, 78.233))) * 43758.5453);
  ${HOF_VERFALL_AN ? 'if (scanR > 4.5) roughnessFactor = mix(roughnessFactor, 0.9, hofSchaden);' : ''}
  ${WESTVERFALL_AN ? 'if (vZustand.x >= 24.0 && vStufe > 1.5 && scanR > 4.5) roughnessFactor = .78;' : ''}
  ${WESTDETAIL_AN ? 'if (westMaterial) roughnessFactor = mix(.91,.60,detailNass);' : ''}
  ${milbinger ? 'roughnessFactor = mix(roughnessFactor, scanR > 4.5 ? mix(.29,.58,vStufe * .5) : mix(clamp(altArm.g,.52,.94),.49,altFeucht),milbingerAnteil);' : ''}`)
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>
${HOF_AN ? 'reflectedLight.indirectDiffuse *= mix(1.0, hofArm.r, hofHausAnteil * 0.55);' : ''}
${milbinger ? 'reflectedLight.indirectDiffuse *= mix(1.0, mix(.59,1.0,altArm.r), milbingerAnteil);' : ''}
${HOF_ZIELTREUE_AN ? /* glsl */ `
  // Der Efeu liegt in verschiedenen Lagen dicht vor der Hausecke.
  if (zielHaus > .5 && scanR < 1.5 && vRolle < 2.0) {
    float ueberdeckt = 1.0 - smoothstep(.22,1.34,distance(vHausPos.xz,vec2(1425.85,408.90)));
    float blattSaum = smoothstep(.46,1.53,vHoehe);
    reflectedLight.indirectDiffuse *= 1.0 - .42 * ueberdeckt * blattSaum;
  }
` : ''}`)
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
  material.customProgramCacheKey = () => 'brachland-haus-glut-v2' + (SCAN_TEXTUREN ? '-scans' : '') + (POM_AN && SCAN_TEXTUREN ? '-pom' : '') + (BAUWELT_AN ? '-verfall' : '') + (HAUSFRONT_AN ? '-hausfront' : '') + (HOF_AN ? '-scanhof' : '') + (HAUS_SHADER_SPAR_AN ? '-spar' : '') + (HOF_BODEN_AN ? '-hofboden' : '') + (HOF_VERFALL_AN ? '-hofverfall' : '') + (HOF_ZIEL_AN ? '-hofziel' : '') + (HOF_DACHBRUCH_AN ? '-hofdachbruch' : '') + (HOF_LICHT_AN ? '-hoflicht' : '') + (HOF_ZIELTREUE_AN ? '-zieltreue' : '') + (HOF_VERFALLVERLAUF_AN ? '-verfallverlauf' : '') + (HOF_ORTSALTERUNG_AN ? '-ortsalterung' : '') + (WESTVERFALL_AN ? '-westverfall' : '') + (WESTDETAIL_AN ? '-westdetail' : '') + (WESTFASSADE_AN ? '-westfassade' : '') + (WESTANSCHLUSS_AN ? '-westanschluss' : '');
  if (milbinger) {
    const basis = material.customProgramCacheKey;
    material.customProgramCacheKey = () => basis() + '-milbingerdetail' + (substrat ? '-substrat' : '');
  }
  return material;
}
