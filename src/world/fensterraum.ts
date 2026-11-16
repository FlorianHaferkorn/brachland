/**
 * D297 — prozeduraler Parallaxenraum hinter einer opaken Fensterscheibe.
 *
 * `hausFensterraum(uv, blickLokal, seed)` liefert eine lineare diffuse Farbe,
 * keine Emission. UV laufen von links/unten (0/0) nach rechts/oben (1/1).
 * Die lokale Blickrichtung zeigt von der Scheibe zur Kamera: x nach rechts,
 * y nach oben, z nach aussen. Der Seed bleibt je ganzem Fenster konstant.
 *
 * Der Raum ist eine optische Materialprobe, keine belegte reale Einrichtung
 * und kein begehbarer Innenraum. Ein Raumquader und zwei einfache Möbelkörper
 * werden analytisch geschnitten; weitere Geometrie oder Bilder entfallen.
 */
export const FENSTERRAUM_GLSL = /* glsl */ `
// Eine sichere inverse Richtung hält auch achsparallele Strahlen endlich.
vec3 hausRaumKehrwert(vec3 richtung) {
  vec3 vorzeichen = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), richtung));
  return vorzeichen / max(abs(richtung), vec3(0.0001));
}

// Normalen und Abstand zum ersten Treffer eines Möbelquaders; w=10000 bei Fehlwurf.
vec4 hausRaumKasten(vec3 ursprung, vec3 kehrwert, vec3 unten, vec3 oben) {
  vec3 a = (unten - ursprung) * kehrwert;
  vec3 b = (oben - ursprung) * kehrwert;
  vec3 nah = min(a, b), fern = max(a, b);
  float anfang = max(max(nah.x, nah.y), nah.z);
  float ende = min(min(fern.x, fern.y), fern.z);
  if (anfang <= 0.0 || ende < anfang) return vec4(0.0, 0.0, 0.0, 10000.0);
  vec3 achse = step(vec3(anfang - 0.0001), nah);
  vec3 normale = -sign(kehrwert) * normalize(achse);
  return vec4(normale, anfang);
}

vec3 hausFensterraum(vec2 uv, vec3 blickLokal, float seed) {
  // Fenster 0,90 x 1,15 m, Boden rund einen Meter unter der Scheibenmitte.
  vec3 ursprung = vec3((uv - 0.5) * vec2(0.9, 1.15), 0.0);
  vec3 richtung = normalize(vec3(-blickLokal.xy, -max(abs(blickLokal.z), 0.015)));
  vec3 kehrwert = hausRaumKehrwert(richtung);
  vec3 unten = vec3(-1.65, -1.10, -2.50);
  vec3 oben = vec3(1.65, 1.55, 0.02);
  // Der Strahl startet im Raumquader: gesucht ist sein nächster Austritt.
  vec3 grenzen = mix(unten, oben, step(vec3(0.0), richtung));
  vec3 abstaende = (grenzen - ursprung) * kehrwert;
  float distanz = min(min(abstaende.x, abstaende.y), abstaende.z);
  vec3 ort = ursprung + richtung * distanz;
  float wahl = fract(seed * 7.13 + 0.29);
  vec3 putz = mix(vec3(0.22, 0.175, 0.12), vec3(0.17, 0.195, 0.16), wahl);
  vec3 farbe;
  if (abstaende.y < abstaende.x && abstaende.y < abstaende.z) {
    if (richtung.y < 0.0) {
      // Breite, ruhige Dielen; die Flucht folgt dem Raum statt der Scheibenebene.
      float fuge = 1.0 - smoothstep(0.012, 0.035, abs(fract(ort.x * 3.0) - 0.5));
      float holz = 0.86 + 0.14 * sin(ort.x * 69.0 + sin(ort.z * 3.0) * 0.7);
      farbe = vec3(0.115, 0.075, 0.038) * holz * mix(1.0, 0.58, fuge);
    } else {
      farbe = vec3(0.21, 0.205, 0.18);
    }
  } else if (abstaende.x < abstaende.z) {
    farbe = putz * 0.70;
  } else {
    farbe = putz;
    // Ein gerahmtes, gedämpftes Bild an der Rückwand gibt einen festen Tiefenanker.
    vec2 bildOrt = ort.xy - vec2(mix(-0.32, 0.28, wahl), 0.35);
    vec2 bildRand = abs(bildOrt) - vec2(0.37, 0.27);
    float rahmen = 1.0 - smoothstep(-0.005, 0.01, max(bildRand.x, bildRand.y));
    float bild = 1.0 - smoothstep(-0.04, -0.025, max(bildRand.x, bildRand.y));
    vec3 motiv = mix(vec3(0.095, 0.115, 0.10), vec3(0.23, 0.24, 0.205),
      smoothstep(-0.08, 0.12, bildOrt.y + sin(bildOrt.x * 6.0 + seed) * 0.06));
    farbe = mix(farbe, vec3(0.065, 0.045, 0.025), rahmen);
    farbe = mix(farbe, motiv, bild);
  }
  // Seitliches Möbel und Tischplatte: sichtbare Ober-/Seitenflächen wandern mit dem Blick.
  float versatz = mix(-0.38, 0.28, wahl);
  vec4 schrank = hausRaumKasten(ursprung, kehrwert,
    vec3(-1.40, -1.10, -2.38), vec3(-0.72, 0.10, -1.90));
  vec4 tisch = hausRaumKasten(ursprung, kehrwert,
    vec3(-0.55 + versatz, -0.40, -1.85), vec3(0.55 + versatz, -0.30, -0.95));
  vec4 moebel = schrank.w < tisch.w ? schrank : tisch;
  if (moebel.w < distanz) {
    distanz = moebel.w;
    ort = ursprung + richtung * distanz;
    float licht = 0.58 + 0.32 * max(moebel.y, 0.0) + 0.10 * max(moebel.z, 0.0);
    farbe = vec3(0.12, 0.075, 0.035) * licht;
  }
  // Ruhige Kontaktabdunklung und Lichtabfall hinter der Öffnung, keine Selbstleuchtung.
  float ecke = smoothstep(0.0, 0.24, min(ort.y - unten.y, oben.y - ort.y));
  farbe *= mix(0.58, 1.0, ecke) * mix(0.95, 0.62, clamp(-ort.z / 2.5, 0.0, 1.0));

  // Leinenvorhänge dicht hinter der Scheibe, nicht auf die Rückwand gemalt.
  float stoffDistanz = -0.09 * kehrwert.z;
  vec2 stoffOrt = (ursprung + richtung * stoffDistanz).xy;
  float falte = sin(stoffOrt.y * 6.0 + seed * 5.0) * 0.025;
  float links = 1.0 - smoothstep(-0.31 + falte, -0.295 + falte, stoffOrt.x);
  float rechts = smoothstep(0.30 - falte, 0.315 - falte, stoffOrt.x);
  // Nicht jede Scheibe trägt denselben Vorhang: einige bleiben offen,
  // andere sind einseitig zugezogen. Die Variation ist pro Fenster ortsfest.
  float deckung = max(links * step(0.38, seed), rechts * step(0.62, fract(seed * 3.71)));
  float rillen = 0.80 + 0.20 * cos(stoffOrt.x * 115.0 + sin(stoffOrt.y * 4.0));
  vec3 leinen = vec3(0.34, 0.305, 0.235) * rillen;
  return max(vec3(0.0), mix(farbe, leinen, deckung));
}
`;
