/** D301: Flächennormale und Verlässlichkeit der tiefenbasierten Verdeckung.
 * `sicht(uv)` liefert Sichtraumpositionen, `texel` den Abstand der Tiefenproben.
 * +X/+Y-Differenzen gleich orientieren; eine frontale Ebene zeigt nach +Z.
 * Kleinere Tiefenänderungen vermeiden eine Fläche zwischen Blatt und Hintergrund.
 */
export const AO_NORMAL_GLSL = /* glsl */ `
  vec4 aoFlaeche(vec2 uv, vec3 p, vec2 texel) {
    vec3 links = p - sicht(uv - vec2(texel.x, 0.0));
    vec3 rechts = sicht(uv + vec2(texel.x, 0.0)) - p;
    vec3 unten = p - sicht(uv - vec2(0.0, texel.y));
    vec3 oben = sicht(uv + vec2(0.0, texel.y)) - p;
    vec3 dx = abs(links.z) < abs(rechts.z) ? links : rechts;
    vec3 dy = abs(unten.z) < abs(oben.z) ? unten : oben;
    vec3 n = cross(dx, dy);
    float laenge2 = dot(n, n);
    // Die Bereichsprüfung fängt auch NaN (Vergleich falsch) und Unendlich ab.
    float massstab2 = dot(dx, dx) * dot(dy, dy);
    if (!(laenge2 > max(massstab2 * 0.00000001, 1.0e-35)) || laenge2 > 1.0e30)
      return vec4(0.0, 0.0, 1.0, 0.0);
    float fussabdruck = max(length(dx.xy), length(dy.xy));
    float sprung = max(abs(dx.z), abs(dy.z));
    float verlaesslich = 1.0 - smoothstep(fussabdruck * 2.0, fussabdruck * 4.0, sprung);
    return vec4(n * inversesqrt(laenge2), verlaesslich);
  }
`;
