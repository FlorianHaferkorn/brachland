/**
 * D348: Werkspuren und Schäden im vermessenen Querschnitt. Brocken am Rand
 * entstehen im Bewuchs-Batch, der Straßenkörper trägt die Alterung im Material.
 */
export const STRASSENALTERUNG_GLSL = /* glsl */ `
  float fahrbahnRelief = 0.0;
  float stehendesWasser = 0.0;
  float ablaufMetall = 0.0;
  float farbRest = 0.0;
  float fahrbahnPixel = min(.24, max(length(dFdx(welt)),length(dFdy(welt))));
  if (asphalt > 0.5) {
    vec2 fahrOrt = vec2(station,querMeter);
    float verwaschen = substratKorn(fahrOrt,fahrbahnPixel,.54);
    float verwittert = smoothstep(.25,.74, .64*verwaschen + .36*fleck);
    float befahrung = min(1.0,.83*spur + .17*verwaschen);
    vec3 blank = diffuseColor.rgb;
    vec3 stumpf = blank * mix(vec3(.69,.72,.71),vec3(1.32,1.30,1.17),verwittert);
    diffuseColor.rgb = mix(stumpf,blank*.86,befahrung*.66);

    // Ein frostanfälliger Rand nimmt Feinteile auf. Abschnitte zwischen Einfahrten
    // brechen zuerst. Links am Bord sammelt sich Wasser in der engeren Rinne.
    float offen = step(0.0,querMeter);
    float randtiefe = mix(.30,.56 + .32*randBoden,offen);
    float ausfaserung = (1.0 - smoothstep(.038,randtiefe,rand))
      * smoothstep(.25,.73,.69*fleck + .31*randKorn);
    vec3 abriebErde = mix(vec3(.056,.055,.045),vec3(.101,.082,.055),offen);
    diffuseColor.rgb = mix(diffuseColor.rgb,abriebErde*(.64 + .78*randKorn),ausfaserung*.86);
    float rinntasche = smoothstep(.39,.76,.61*fleck + .39*verwaschen);
    stehendesWasser = (1.0-offen)*(1.0-smoothstep(.04,.31,rand))*rinntasche*.51;

    // Längsnähte der früheren Belagsreparatur und unregelmäßig quer auslaufende Risse.
    float schnitt = .84 + (substratRauschen(vec2(station*.74,4.6))-.5)*.20;
    float naht = 1.0-smoothstep(.009,.026 + .58*fahrbahnPixel,abs(querMeter-schnitt));
    float erneuert = smoothstep(.31,.68,substratRauschen(vec2(station*.33,11.5)));
    float flicken = smoothstep(schnitt,schnitt+.06,querMeter)*erneuert;
    diffuseColor.rgb *= (1.0 - .25*flicken - .37*naht*erneuert);
    float rissfeld = substratKorn(fahrOrt * vec2(.77,1.36),fahrbahnPixel,3.25);
    float rissnetz = (1.0-smoothstep(.009,.028+fahrbahnPixel*.32,abs(rissfeld-.438)))
      * (1.0-smoothstep(.035,.18,fahrbahnPixel));
    rissnetz *= smoothstep(.46,.76, .46*verwaschen + .32*befahrung + .46*ausfaserung);
    diffuseColor.rgb *= 1.0 - rissnetz*(.32 + .15*randKorn);
    fahrbahnRelief -= .009*rissnetz + .009*naht*erneuert;

    float frostloch = 0.0;
    float frischeKante = 0.0;
    #if SCHLAGLOECHER > 0
    for (int i=0; i<SCHLAGLOECHER; ++i) {
      vec4 loch = uSchlagloch[i];
      vec2 normiert = (fahrOrt - loch.xy) / loch.zw;
      if (max(abs(normiert.x),abs(normiert.y)) < 1.48) {
        vec2 ausbruchform = vec2(normiert.x + .24*normiert.y, normiert.y);
        float sprengung = max(abs(ausbruchform.x),abs(ausbruchform.y))*.30 + length(ausbruchform)*.70
          + .55*(substratRauschen(fahrOrt*7.0)-.5) + .16*(substratRauschen(fahrOrt*19.0)-.5);
        frostloch = max(frostloch,1.0-smoothstep(.66,1.06,sprengung));
        frischeKante = max(frischeKante,smoothstep(.67,.91,sprengung)*(1.0-smoothstep(1.02,1.25,sprengung)));
      }
    }
    #endif
    float gerollt = substratKorn(fahrOrt,fahrbahnPixel,15.0);
    vec3 lochFarbe = mix(vec3(.019,.020,.018),vec3(.080,.072,.053),gerollt);
    diffuseColor.rgb = mix(diffuseColor.rgb,lochFarbe,frostloch*.92);
    diffuseColor.rgb += vec3(.066,.058,.047)*frischeKante*(.18+.82*gerollt);
    stehendesWasser = max(stehendesWasser,frostloch*rinntasche*.77);
    fahrbahnRelief += .011*frischeKante - .044*frostloch;

    // Fünf verblasste Streifen der früheren lokalen Arbeitsstelle.
    #if FARBRESTE > 0
    for (int i=0; i<FARBRESTE; ++i) {
      vec4 streifen = uFarbrest[i];
      float ende = min(station-streifen.x,streifen.y-station);
      float seite = abs(querMeter-streifen.z);
      if (ende > -.12 && seite < streifen.w*.9 + fahrbahnPixel) {
        float flocke = substratKorn(fahrOrt,fahrbahnPixel,37.0);
        float ausbleichung = substratRauschen(fahrOrt * vec2(3.7,17.0));
        float sil = (1.0-smoothstep(streifen.w*.32,streifen.w*.52+fahrbahnPixel*.50,seite+.024*(flocke-.45)))
          * smoothstep(-.04,.16,ende + .12*(ausbleichung-.48));
        float offenAlt = smoothstep(.28,.70,.62*ausbleichung + .38*flocke);
        farbRest = max(farbRest,sil*offenAlt*(1.0-.86*max(frostloch,rissnetz))
          * (.54+.39*(1.0-befahrung)));
      }
    }
    #endif
    diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.42,.335,.172),farbRest);

    // Rostiger Rinnenrost, mit Schlitzen, dunklem Rahmen und abgelagertem Schmutz.
    #if RINNENROSTE > 0
    for (int i=0; i<RINNENROSTE; ++i) {
      vec2 ro = uRinnenrost[i];
      float querRand = ro.y < 0.0 ? vQuerprofil.y : -vQuerprofil.z;
      vec2 ort = vec2(station-ro.x,querRand-.19);
      if (abs(ort.x)<.36 && abs(ort.y)<.22) {
        float mass = max(abs(ort.x)/.27,abs(ort.y)/.156);
        float rahmen = 1.0-smoothstep(.94,1.04,mass);
        float schlitz = (1.0-smoothstep(.16,.32+fahrbahnPixel*7.0,abs(fract(ort.x*23.0)-.5)))
          * (1.0-smoothstep(.071,.092+fahrbahnPixel,abs(ort.y))) * (1.0-smoothstep(.020,.085,fahrbahnPixel));
        float randEisen = smoothstep(.76,.98,mass);
        vec3 rost = mix(vec3(.036,.035,.030),vec3(.126,.061,.030),gerollt);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(rost*(1.0-.67*schlitz),
          vec3(.024,.023,.020),randEisen),rahmen);
        ablaufMetall = max(ablaufMetall,rahmen*(1.0-schlitz)*.64);
        fahrbahnRelief += (.008*randEisen-.013*schlitz)*rahmen;
      }
    }
    #endif
    #ifdef SCHACHTDECKEL
    vec2 deckel = fahrOrt-uSchachtdeckel.xy;
    float radius = length(deckel);
    float deckelKante = .009 + .41*fahrbahnPixel;
    float deckelUmriss = 1.0-smoothstep(uSchachtdeckel.z-.013,uSchachtdeckel.z+deckelKante,radius);
    if (deckelUmriss > 0.0) {
      float ringkante = 1.0-smoothstep(.007,.016+deckelKante,abs(radius-uSchachtdeckel.z*.91));
      vec2 muster = abs(fract((mat2(.707,-.707,.707,.707)*deckel)*29.0)-.5);
      float rauten = (1.0-smoothstep(.16,.33,muster.x+muster.y))*substratDetail(fahrbahnPixel,29.0);
      vec3 eisen = mix(vec3(.038,.035,.031),vec3(.103,.069,.046),gerollt);
      eisen *= 1.0 - .64*ringkante + .36*rauten;
      diffuseColor.rgb = mix(diffuseColor.rgb,eisen,deckelUmriss);
      ablaufMetall = max(ablaufMetall,deckelUmriss*.64*(1.0-ringkante));
      fahrbahnRelief += (.003*rauten - .008*ringkante)*deckelUmriss;
    }
    #endif
    diffuseColor.rgb *= 1.0 - stehendesWasser*.37;
  }
`;
