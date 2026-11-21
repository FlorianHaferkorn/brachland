/** D301: Tiefenkanten für den lokalen TAA-Vorfilter erkennen, keine Laubklassifizierung.
 * Zweite Differenzen lassen lineare Tiefenneigungen unverändert; Schwellen sind relativ zur Tiefe.
 * `taaFeinTiefe` prüft die bisherige Mittelpunktmaske, `taaKantenUmfeld` das ganze 3×3-Umfeld.
 * Letztere erfasst auch gerade Silhouettenkanten und benachbarte Krümmung bei linearem Mittelpunkt.
 * Nenner bleiben auch bei leerer Tiefe endlich.
 */
export const TAA_MASKE_GLSL = /* glsl */ `
  float taaFeinTiefe(float z, float zl, float zr, float zu, float zo) {
    float x = abs(zl + zr - 2.0 * z);
    float y = abs(zu + zo - 2.0 * z);
    return smoothstep(0.004, 0.03, min(x, y) / max(z, 0.001));
  }
  float taaKantenUmfeld(float z, float l, float r, float u, float o, float lu, float ru, float lo, float ro) {
    float mitteX = abs(l + r - 2.0 * z) / max(z, 0.001);
    float mitteY = abs(u + o - 2.0 * z) / max(z, 0.001);
    float obenX = abs(lu + ru - 2.0 * u) / max(u, 0.001);
    float untenX = abs(lo + ro - 2.0 * o) / max(o, 0.001);
    float linksY = abs(lu + lo - 2.0 * l) / max(l, 0.001);
    float rechtsY = abs(ru + ro - 2.0 * r) / max(r, 0.001);
    float kante = max(max(mitteX, mitteY), max(max(obenX, untenX), max(linksY, rechtsY)));
    return smoothstep(0.004, 0.03, kante);
  }
`;
