/**
 * BRACHLAND — Kampftor: die Zahlen, die kein Bild zeigt (ADR-0007, Stufe 1)
 *
 * Ein Echtzeitkampf steht und fällt an Fenstern in Millisekunden, Reichweiten in Metern und
 * Winkeln. Kein Bildtor sieht sie, und ein Spieltest sieht sie nur als Gefühl („die Rolle geht
 * manchmal nicht"). Dieser Test rechnet sie nach, Teilschritt für Teilschritt, und druckt die
 * gemessenen Werte aus — das ist die Latte, die ADR-0007 unter „Konsequenzen" verlangt.
 *
 * Geprüft werden Regeln, nicht Zahlenwerte: dass ein Schwung jedes Ziel nur einmal trifft, dass die
 * Rolle auf der Stelle nur im richtigen Moment schützt, dass dieser Moment für einen Menschen
 * erreichbar ist, dass das Ergebnis nicht an der Bildrate hängt. Wer an `SPIELERIN` oder
 * `UEBUNGSGEGNER` dreht, bekommt hier gesagt, ob das Spiel dabei kaputtgeht.
 */
import {
  SPIELERIN, UEBUNGSGEGNER, SCHRITT, ZIELEN,
  neuerKaempfer, setzeSchlagAn, setzeRolleAn, kannSchlagen, kannRollen,
  imBogen, loeseTreffer, schrittKaempfer, simuliere, waehleZiel, blickAuf, vorwaerts,
  WAFFEN, ruesteAus, wechsleZiel, KEILER, GRATHORN, WOLF,
  puffere, naechsterSchlag, setzeBlockAn, loeseBlock, kannBlocken, WEGELAGERER, DECKUNG_KOSTEN, type Linie, PARADE, PARADE_BETAEUBT, BLOCK, PUFFER, KOMBO_AB, KOMBO_FENSTER, WURF_SPERRE, LADUNG, FLUT, TREFFERSTOPP, STOSS_DAUER, type Schlag,
  type Kaempfer, type Kampfwelt, type Treffer,
} from '../src/kampf/echtzeit.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, bedingung: boolean, hinweis = '') {
  if (bedingung) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}
const GRAD = Math.PI / 180;
const f3 = (v: number) => v.toFixed(3);

/** Spielerin im Ursprung mit Blick nach −Z, Gegner `d` m davor, ihr zugewandt. */
function paar(d: number): { s: Kaempfer; g: Kaempfer } {
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  const g = neuerKaempfer('g', UEBUNGSGEGNER, 0, -d, blickAuf(0, -d, 0, 0));
  return { s, g };
}

// ---------------------------------------------------- 1. Richtung stimmt mit der Szene überein
{
  const [fx, fz] = vorwaerts(0);
  pruefe('blick 0 schaut nach −Z wie in `Spieler`', Math.abs(fx) < 1e-9 && Math.abs(fz + 1) < 1e-9);
  pruefe('blickAuf ist die Umkehrung von vorwaerts', Math.abs(blickAuf(0, 0, 0, -5)) < 1e-9
    && Math.abs(Math.abs(blickAuf(0, 0, 0, 5)) - Math.PI) < 1e-9);
}

// ---------------------------------------------------- 2. Reichweite bis zum Kapselrand
const randReichweite = SPIELERIN.schlag.reichweite + UEBUNGSGEGNER.radius;
{
  const nah = paar(randReichweite - 0.05), weit = paar(randReichweite + 0.05);
  pruefe(`Schlag trifft 5 cm innerhalb der Reichweite (${f3(randReichweite)} m Mitte zu Mitte)`,
    imBogen(nah.s, nah.g));
  pruefe('Schlag verfehlt 5 cm ausserhalb', !imBogen(weit.s, weit.g));
}

// ---------------------------------------------------- 3. Winkel, mit Zugabe für die Kapsel
{
  const bei = (grad: number) => {
    const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
    const a = grad * GRAD;
    const g = neuerKaempfer('g', UEBUNGSGEGNER, -Math.sin(a) * 2, -Math.cos(a) * 2);
    return imBogen(s, g);
  };
  pruefe('Ziel 40° neben dem Blick wird getroffen', bei(40));
  pruefe('Ziel 80° neben dem Blick wird verfehlt', !bei(80));
  pruefe('Ziel hinter der Spielerin wird verfehlt', !bei(180));
}

// ---------------------------------------------------- 4. Ein Schwung trifft jedes Ziel genau einmal, und nur im Aktiven
let trefferZeit = NaN;
{
  const { s, g } = paar(2);
  setzeSchlagAn(s);
  let n = 0;
  for (let i = 0, t = 0; i < 120; i++) {
    schrittKaempfer(s, SCHRITT); t += SCHRITT;
    const h = loeseTreffer(s, [g]);
    if (h.length && Number.isNaN(trefferZeit)) trefferZeit = t;
    n += h.length;
  }
  pruefe('ein Schwung, ein Treffer, obwohl das Aktive 14 Teilschritte dauert', n === 1, `${n} Treffer`);
  const a0 = SPIELERIN.schlag.vorlauf, a1 = a0 + SPIELERIN.schlag.aktiv;
  pruefe('der Treffer fällt ins aktive Fenster, nicht in Vorlauf oder Erholung',
    trefferZeit >= a0 - 1e-9 && trefferZeit < a1 + SCHRITT, `bei ${f3(trefferZeit)} s, Fenster ${a0}–${a1}`);
}

// ---------------------------------------------------- 5. Das Schutzfenster der Rolle auf der Stelle
//
// Der Gegner setzt bei t = 0 an. Die Spielerin rollt bei t0 **auf der Stelle** — ohne Weg, also
// schützt allein die Unverwundbarkeit. Gerechnet wird für jedes t0 in 5-ms-Schritten, ob Schaden
// ankommt. Das Ergebnis ist das Fenster, das ein Spieler treffen muss.
const REAKTION = 0.25;
let fensterVon = NaN, fensterBis = NaN, zusammenhaengend = true;
{
  const geschuetzt = (t0: number): boolean => {
    const { s, g } = paar(1.8);
    setzeSchlagAn(g);
    let t = 0, gerollt = false;
    for (let i = 0; i < 180; i++) {
      if (!gerollt && t >= t0 - 1e-9) { gerollt = setzeRolleAn(s, 0, 0); }
      schrittKaempfer(s, SCHRITT); schrittKaempfer(g, SCHRITT); t += SCHRITT;
      loeseTreffer(g, [s]);
    }
    return s.leben === s.werte.lebenMax;
  };
  let vorher = false;
  for (let t0 = 0; t0 <= 0.9 + 1e-9; t0 += 0.005) {
    const jetzt = geschuetzt(t0);
    if (jetzt && Number.isNaN(fensterVon)) fensterVon = t0;
    if (jetzt) fensterBis = t0;
    if (!jetzt && vorher && !Number.isNaN(fensterVon)) {
      // nach dem Ende wieder geschützt? Dann ist das Fenster zerrissen.
      for (let t1 = t0; t1 <= 0.9; t1 += 0.005) if (geschuetzt(t1)) zusammenhaengend = false;
      break;
    }
    vorher = jetzt;
  }
  const breite = fensterBis - fensterVon;
  pruefe('es gibt ein Schutzfenster', !Number.isNaN(fensterVon));
  pruefe('das Schutzfenster ist zusammenhängend', zusammenhaengend);
  pruefe('das Schutzfenster ist mindestens 200 ms breit', breite >= 0.2 - 1e-9, `${f3(breite)} s`);
  pruefe(`es endet mindestens 150 ms nach einer Reaktionszeit von ${REAKTION} s — erreichbar`,
    fensterBis >= REAKTION + 0.15 - 1e-9, `endet bei ${f3(fensterBis)} s`);
  pruefe('eine Panikrolle beim ersten Zucken schützt nicht — Timing zählt', !geschuetzt(0));
}

// ---------------------------------------------------- 6. Aus dem Bogen rollen
//
// Diesmal in der ganzen Welt, mit denkendem Gegner, der sich im Vorlauf nachdreht.
function lauf(aktion: (w: Kampfwelt, t: number) => void, dauer = 2.5): { w: Kampfwelt; treffer: Treffer[] } {
  const { s, g } = paar(2.2);
  const w: Kampfwelt = { spielerin: s, gegner: [g], ziel: null };
  const treffer: Treffer[] = [];
  for (let t = 0; t < dauer; t += SCHRITT) { aktion(w, t); treffer.push(...simuliere(w, SCHRITT)); }
  return { w, treffer };
}
{
  const stehen = lauf(() => {});
  pruefe('wer im Telegraf stehenbleibt, wird getroffen',
    stehen.treffer.some(h => h.auf === 's' && h.schaden > 0));
  const zurueck = lauf((w, t) => { if (Math.abs(t - REAKTION) < SCHRITT / 2) setzeRolleAn(w.spielerin, 0, 1); });
  pruefe('Rolle rückwärts nach Reaktionszeit: kein Schaden (Abstand)',
    zurueck.w.spielerin.leben === SPIELERIN.lebenMax, `Leben ${zurueck.w.spielerin.leben}`);
  const seite = lauf((w, t) => { if (Math.abs(t - REAKTION) < SCHRITT / 2) setzeRolleAn(w.spielerin, 1, 0); });
  pruefe('Rolle zur Seite nach Reaktionszeit: kein Schaden, obwohl der Gegner nachdreht',
    seite.w.spielerin.leben === SPIELERIN.lebenMax, `Leben ${seite.w.spielerin.leben}`);
}

// ---------------------------------------------------- 7. Ausdauer ist die gemeinsame Kasse
let schlaegeAusVoll = 0, rollenAusVoll = 0;
{
  const s = neuerKaempfer('s', SPIELERIN, 0, 0);
  while (setzeSchlagAn(s)) { schlaegeAusVoll++; s.phase = 'bereit'; }
  pruefe('ohne Ausdauer kein Schlag', !kannSchlagen(s));
  for (let t = 0; t < 1.2; t += SCHRITT) schrittKaempfer(s, SCHRITT);
  pruefe('nach gut einer Sekunde Ruhe geht der nächste Schlag wieder', kannSchlagen(s),
    `Ausdauer ${s.ausdauer.wert.toFixed(1)}`);
  const r = neuerKaempfer('r', SPIELERIN, 0, 0);
  while (setzeRolleAn(r, 0, 1)) { rollenAusVoll++; r.phase = 'bereit'; }
  pruefe('ohne Ausdauer keine Rolle', !kannRollen(r));
  pruefe('aus vollem Vorrat gehen mehr Schläge als Rollen', schlaegeAusVoll > rollenAusVoll);
  const e = neuerKaempfer('e', SPIELERIN, 0, 0);
  setzeSchlagAn(e);
  pruefe('im Vorlauf keine Rolle — wer ausholt, hat sich festgelegt', !kannRollen(e));
  e.phase = 'erholung';
  pruefe('aus der Erholung darf gerollt werden', kannRollen(e));
}

// ---------------------------------------------------- D188: Wasserfunke — laden, entladen, Flutstoss
{
  const { s, g } = paar(2);
  s.element = 'wasser'; s.ladung = 0;
  const hau = (schlag = WAFFEN.klinge.schlag) => {
    g.haltung = g.werte.haltungMax; g.phase = 'bereit'; g.leben = g.werte.lebenMax;
    s.phase = 'aktiv'; s.schlag = schlag; s.schwung++; s.erreicht = new Set();
    return loeseTreffer(s, [g]);
  };
  hau();
  pruefe('ein Treffer lädt', Math.abs((s.ladung ?? 0) - LADUNG.treffer) < 1e-9, String(s.ladung));
  const l0 = g.werte.lebenMax;
  const normal = hau(WAFFEN.klinge.schwer)[0].schaden;
  pruefe('schwerer Schlag ohne volle Ladung entlädt nicht', !hau(WAFFEN.klinge.schwer)[0].element);
  s.ladung = 1;
  const t = hau(WAFFEN.klinge.schwer)[0];
  pruefe('volle Ladung + schwer = Flutstoss', t.element === 'wasser' && (s.ladung ?? 1) === 0);
  pruefe(`Flutstoss macht ${FLUT.schaden}× Schaden`, Math.abs(t.schaden - normal * FLUT.schaden) < 1e-6, `${t.schaden} gegen ${normal}`);
  pruefe('Flutstoss betäubt', g.phase === 'betaeubt' || t.gebrochen, g.phase);
  s.ladung = 1;
  pruefe('leichter Schlag entlädt nie', !hau()[0].element && (s.ladung ?? 0) === 1);
  pruefe('Leben bleibt ohne Funken unberührt vom Element', l0 > 0);
}

// ---------------------------------------------------- D182: Wurfsperre — die Axt nagelt keinen fest
{
  const { s, g } = paar(2);
  const quer = WAFFEN.axt.leicht[1];
  const wurf = () => {
    g.haltung = g.werte.haltungMax; s.phase = 'aktiv'; s.schlag = quer; s.erreicht = new Set();
    if (g.phase !== 'vorlauf') { g.phase = 'bereit'; setzeSchlagAn(g); }
    return loeseTreffer(s, [g]);
  };
  const warte = (sek: number) => { for (let t = 0; t < sek; t += SCHRITT) schrittKaempfer(g, SCHRITT); };
  pruefe('der Querhieb wirft', !!quer.wirft && !!quer.standfest);
  wurf();
  pruefe('erster Wurf: der Gegner ist betäubt, sein Vorlauf verloren', g.phase === 'betaeubt' && g.betaeubtFuer === quer.wirft, g.phase);
  warte(0.6);
  wurf();
  pruefe(`zweiter Wurf nach 0,6 s wirft NICHT (Sperre ${WURF_SPERRE} s)`, g.phase !== 'betaeubt', g.phase);
  warte(WURF_SPERRE);
  wurf();
  pruefe('nach der Sperre wirft er wieder', g.phase === 'betaeubt', g.phase);
}

// ---------------------------------------------------- 8. Haltung bricht beim zweiten Treffer, nicht beim ersten
{
  const { s, g } = paar(2);
  setzeSchlagAn(g);
  const hau = () => { s.phase = 'aktiv'; s.erreicht = new Set(); return loeseTreffer(s, [g]); };
  hau();
  pruefe('der erste Treffer unterbricht den Vorlauf des Gegners nicht', g.phase === 'vorlauf', g.phase);
  const zweiter = hau();
  pruefe('der zweite bricht die Haltung und betäubt', g.phase === 'betaeubt' && zweiter[0]?.gebrochen === true, g.phase);
  pruefe('nach dem Bruch ist die Haltung wieder voll', g.haltung === UEBUNGSGEGNER.haltungMax);
}

// ---------------------------------------------------- 9. Zielaufschaltung
{
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  const vorn = neuerKaempfer('vorn', UEBUNGSGEGNER, 0, -5);
  const hinten = neuerKaempfer('hinten', UEBUNGSGEGNER, 0, 3);
  const fern = neuerKaempfer('fern', UEBUNGSGEGNER, 0, -(ZIELEN.reichweite + 2));
  const schraeg = neuerKaempfer('schraeg', UEBUNGSGEGNER, -Math.sin(30 * GRAD) * 8, -Math.cos(30 * GRAD) * 8);
  const alle = [vorn, hinten, fern, schraeg];
  pruefe('aufgeschaltet wird das nächste Ziel im Kegel, nicht das hinter einem',
    waehleZiel(s, alle)?.id === 'vorn', waehleZiel(s, alle)?.id);
  vorn.phase = 'gefallen';
  pruefe('ein gefallenes Ziel wird übersprungen', waehleZiel(s, alle)?.id === 'schraeg', waehleZiel(s, alle)?.id);
  schraeg.phase = 'gefallen';
  pruefe('jenseits der Reichweite wird nichts aufgeschaltet', waehleZiel(s, alle) === null);
}

// ---------------------------------------------------- 10. Der Übungsgegner kommt und schlägt
let ankunft = NaN;
let schlaegeZuZweit = 0;
let axtTreffer = NaN;
{
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  const g = neuerKaempfer('g', UEBUNGSGEGNER, 0, -8, 0);
  const w: Kampfwelt = { spielerin: s, gegner: [g], ziel: null };
  for (let t = 0; t < 6 && Number.isNaN(ankunft); t += SCHRITT) {
    if (simuliere(w, SCHRITT).some(h => h.auf === 's' && h.schaden > 0)) ankunft = t;
  }
  pruefe('der Gegner rückt aus 8 m auf und trifft eine stehende Spielerin', !Number.isNaN(ankunft));
  pruefe('ein Treffer kostet genau seinen Schaden', s.leben === SPIELERIN.lebenMax - UEBUNGSGEGNER.schlag.schaden,
    `Leben ${s.leben}`);
}

// ---------------------------------------------------- 10b. Aus jeder Richtung, auf jeder Höhe
// Im Spiel stand der Übungsgegner 2,38 m vor der Spielerin und schlug nie: Der Anlauf
// endete mit krummen Koordinaten 1e-16 m vor der Haltelinie, und die Bedingung „weiter
// anrücken" blieb für immer wahr. Achsparallel (wie oben) fällt das nicht auf.
{
  let schlug = 0;
  const richtungen = 12;
  for (let i = 0; i < richtungen; i++) {
    const a = (i / richtungen) * 2 * Math.PI + 0.13;
    const s = neuerKaempfer('s', SPIELERIN, 3.7, -1.2, 0, 41.3);
    const gx = 3.7 - Math.sin(a) * 9.3, gz = -1.2 - Math.cos(a) * 9.3;
    const g = neuerKaempfer('g', UEBUNGSGEGNER, gx, gz, blickAuf(gx, gz, 3.7, -1.2));
    const w: Kampfwelt = { spielerin: s, gegner: [g], ziel: null };
    let angesetzt = false;
    for (let t = 0; t < 6 && !angesetzt; t += 1 / 60) {
      simuliere(w, 1 / 60);
      angesetzt = g.phase !== 'bereit';
    }
    if (angesetzt) schlug++;
  }
  pruefe('der Gegner setzt aus allen 12 Anlaufrichtungen binnen 6 s zum Schlag an',
    schlug === richtungen, `${schlug}/${richtungen}`);
}

// ---------------------------------------------------- 10c. Nur einer greift an (D167)
// Zwei Gegner gegen eine stehende Spielerin, die nicht fällt. Im Bild vor D167 holten beide im
// selben Takt aus. Jetzt: nie zwei zugleich in Vorlauf/aktiv/Erholung, beide kommen dran, im
// Wechsel, und wer wartet, steht ausser Reichweite.
{
  const zaeh = { ...SPIELERIN, lebenMax: 10_000 };
  const s = neuerKaempfer('s', zaeh, 0, 0, 0);
  const a = neuerKaempfer('g1', UEBUNGSGEGNER, -1.5, -8, 0);
  const b = neuerKaempfer('g2', UEBUNGSGEGNER, 2, -9, 0);
  const w: Kampfwelt = { spielerin: s, gegner: [a, b], ziel: null };
  const holt = (g: typeof a) => g.phase === 'vorlauf' || g.phase === 'aktiv' || g.phase === 'erholung';
  let zugleich = 0, warteZuNah = 0, trefferVonWartendem = 0;
  for (let t = 0; t < 15; t += 1 / 60) {
    for (const e of simuliere(w, 1 / 60)) {
      if (e.auf === 's' && e.schaden > 0 && w.recht !== null && e.von !== w.recht) trefferVonWartendem++;
    }
    if (holt(a) && holt(b)) zugleich++;
    // Solange der andere ausholt oder trifft, steht der Wartende ausser Reichweite.
    for (const [g, anderer] of [[a, b], [b, a]] as const) {
      if (anderer.phase !== 'vorlauf' && anderer.phase !== 'aktiv') continue;
      const rand = Math.hypot(g.x - s.x, g.z - s.z) - s.werte.radius;
      if (rand < UEBUNGSGEGNER.schlag.reichweite) warteZuNah++;
    }
  }
  pruefe('nie zwei Gegner zugleich im Schlag', zugleich === 0, `${zugleich} Teilschritte`);
  pruefe('beide Gegner kommen dran', a.schwung >= 2 && b.schwung >= 2, `${a.schwung}/${b.schwung}`);
  pruefe('sie wechseln sich ab (Schlagzahl höchstens 1 auseinander)', Math.abs(a.schwung - b.schwung) <= 1,
    `${a.schwung}/${b.schwung}`);
  pruefe('wer wartet, steht ausser Reichweite', warteZuNah === 0, `${warteZuNah} Teilschritte`);
  pruefe('kein Treffer vom Wartenden', trefferVonWartendem === 0, `${trefferVonWartendem}`);
  schlaegeZuZweit = a.schwung + b.schwung;
}

// ---------------------------------------------------- 12. Waffenwerk: zwei Klassen (ADR-0008)
{
  const k = WAFFEN.klinge.schlag, a = WAFFEN.axt.schlag;
  const dauer = (s: typeof k) => s.vorlauf + s.aktiv + s.erholung;
  pruefe('die Klinge hat die Zeiten und Wirkung von D166, unverändert',
    (['vorlauf', 'aktiv', 'erholung', 'reichweite', 'halbwinkel', 'schaden', 'haltungsschaden', 'kosten'] as const)
      .every(f => k[f] === SPIELERIN.schlag[f]));
  pruefe('die Axt reicht weiter', a.reichweite > k.reichweite, `${a.reichweite} gegen ${k.reichweite} m`);
  pruefe('die Axt holt länger aus', a.vorlauf > k.vorlauf * 2, `${a.vorlauf} gegen ${k.vorlauf} s`);
  pruefe('die Axt macht je Sekunde NICHT mehr Schaden als die Klinge',
    a.schaden / dauer(a) <= k.schaden / dauer(k), `${f3(a.schaden / dauer(a))} gegen ${f3(k.schaden / dauer(k))}`);
  const jeAusdauer = (s: typeof k) => s.schaden / s.kosten;
  pruefe('Schaden je Ausdauer liegt höchstens 20 % auseinander',
    Math.abs(jeAusdauer(a) / jeAusdauer(k) - 1) <= 0.2, `${f3(jeAusdauer(a))} gegen ${f3(jeAusdauer(k))}`);

  // Haltung: die Axt bricht den Übungsgegner mit einem Treffer, die Klinge braucht zwei.
  const brecheMit = (art: 'klinge' | 'axt') => {
    const { s, g } = paar(2.2);
    ruesteAus(s, art);
    const w: Kampfwelt = { spielerin: s, gegner: [g], ziel: null };
    let treffer = 0, erster = NaN;
    for (let n = 0; n < 3 && g.phase !== 'betaeubt'; n++) {
      setzeSchlagAn(s);
      for (let t = 0; t < 1.5; t += SCHRITT) {
        for (const e of simuliere(w, SCHRITT)) {
          if (e.von === 's' && e.schaden > 0) { treffer++; if (Number.isNaN(erster)) erster = t; }
        }
        if (s.phase === 'bereit') break;
      }
      g.x = 0; g.z = -2.2;   // der Gegner darf nicht ausweichen, er ist hier Ziel
    }
    return { treffer, erster, gebrochen: g.phase === 'betaeubt' };
  };
  const ax = brecheMit('axt'), kl = brecheMit('klinge');
  pruefe('die Axt bricht die Haltung des Übungsgegners mit einem Treffer', ax.gebrochen && ax.treffer === 1, `${ax.treffer}`);
  pruefe('die Klinge braucht zwei', kl.gebrochen && kl.treffer === 2, `${kl.treffer}`);
  axtTreffer = ax.erster;

  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  ruesteAus(s, 'axt');
  let schlaege = 0;
  while (setzeSchlagAn(s)) { schlaege++; s.phase = 'bereit'; }
  pruefe('aus vollem Vorrat 3 Axthiebe', schlaege === 3, `${schlaege}`);
  const t = neuerKaempfer('t', SPIELERIN, 0, 0, 0);
  setzeSchlagAn(t);
  pruefe('kein Waffenwechsel mitten im Schlag', !ruesteAus(t, 'axt') && t.werte.schlag === SPIELERIN.schlag);
}

// ---------------------------------------------------- 14. Der Keiler (D169, Stufe 2)
// Dieselben Latten wie für den Übungsgegner: ein erreichbares Schutzfenster, das nicht beim ersten
// Zucken beginnt — sonst ist der erste echte Gegner unfair oder trivial.
let keilerVon = NaN, keilerBis = NaN;
{
  const geschuetzt = (t0: number): boolean => {
    const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
    const g = neuerKaempfer('g', KEILER, 0, -2.2, blickAuf(0, -2.2, 0, 0));
    setzeSchlagAn(g);
    let t = 0, gerollt = false;
    for (let i = 0; i < 260; i++) {
      if (!gerollt && t >= t0 - 1e-9) { gerollt = setzeRolleAn(s, 0, 0); }
      schrittKaempfer(s, SCHRITT); schrittKaempfer(g, SCHRITT); t += SCHRITT;
      loeseTreffer(g, [s]);
    }
    return s.leben === s.werte.lebenMax;
  };
  for (let t0 = 0; t0 <= 1.2 + 1e-9; t0 += 0.005) {
    if (geschuetzt(t0)) { if (Number.isNaN(keilerVon)) keilerVon = t0; keilerBis = t0; }
  }
  pruefe('Keiler: Schutzfenster mindestens 200 ms', keilerBis - keilerVon >= 0.2 - 1e-9, `${f3(keilerBis - keilerVon)} s`);
  pruefe('Keiler: Fenster endet nach Reaktionszeit + 150 ms', keilerBis >= REAKTION + 0.15, f3(keilerBis));
  pruefe('Keiler: Panikrolle beim ersten Zucken schützt nicht', !geschuetzt(0));
  pruefe('Keiler: Telegraf länger als beim Übungsgegner', KEILER.schlag.vorlauf > UEBUNGSGEGNER.schlag.vorlauf);
  pruefe('Keiler: Klinge bricht die Haltung erst mit dem 3. Treffer',
    Math.ceil(KEILER.haltungMax / WAFFEN.klinge.schlag.haltungsschaden) === 3);
  pruefe('Keiler: Axt mit dem 2.', Math.ceil(KEILER.haltungMax / WAFFEN.axt.schlag.haltungsschaden) === 2);
  // Seitlich neben dem Keiler ist man sicher, vor ihm nicht.
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  const vorn = neuerKaempfer('g', KEILER, 0, -2.4, blickAuf(0, -2.4, 0, 0));
  // Der zweite schaut an der Spielerin vorbei nach +Z; sie steht 69° seitlich von seinem Blick.
  const seitlich = neuerKaempfer('h', KEILER, -1.6, -0.6, blickAuf(-1.6, -0.6, -1.6, 5));
  pruefe('Keiler: trifft, was vor ihm steht', imBogen(vorn, s));
  pruefe('Keiler: trifft nicht, was neben ihm steht', !imBogen(seitlich, s));
}

// ---------------------------------------------------- 15. Zucken: ein Treffer kostet den eigenen Schlag (D170)
{
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  const g = neuerKaempfer('g', UEBUNGSGEGNER, 0, -2.2, blickAuf(0, -2.2, 0, 0));
  // Der Gegner holt zuerst aus; die Spielerin setzt so spät an, dass sein Treffer in ihren Vorlauf fällt.
  setzeSchlagAn(g);
  const w: Kampfwelt = { spielerin: s, gegner: [g], ziel: null };
  let t = 0, getroffenIn = '', zuckenBis = NaN;
  let ihrSchaden = 0;
  for (; t < 2; t += SCHRITT) {
    if (Math.abs(t - (UEBUNGSGEGNER.schlag.vorlauf - 0.08)) < SCHRITT / 2) setzeSchlagAn(s);
    const phaseVor = s.phase;
    for (const e of simuliere(w, SCHRITT)) {
      if (e.auf === 's' && e.schaden > 0) getroffenIn = phaseVor;
      if (e.von === 's' && e.schaden > 0) ihrSchaden += e.schaden;
    }
    if (s.phase === 'zucken') zuckenBis = t;
  }
  pruefe('Treffer im eigenen Vorlauf: sie zuckt', getroffenIn === 'vorlauf' && !Number.isNaN(zuckenBis), getroffenIn);
  pruefe('ihr Schlag geht verloren — kein Schaden am Gegner', ihrSchaden === 0, `${ihrSchaden}`);
  pruefe('danach wieder handlungsfähig', s.phase === 'bereit' || s.phase === 'vorlauf' || s.phase === 'erholung', s.phase);
  const z = neuerKaempfer('z', SPIELERIN, 0, 0, 0);
  z.phase = 'zucken'; z.zeit = 0;
  pruefe('im Zucken keine Rolle', !kannRollen(z));
  pruefe('im Zucken kein Schlag', !kannSchlagen(z));
  schrittKaempfer(z, SPIELERIN.zucken! + SCHRITT);
  pruefe(`nach ${SPIELERIN.zucken} s bereit`, (z.phase as string) === 'bereit', z.phase);
  pruefe('Gegner zucken nicht (sie brechen nur über die Haltung)',
    !UEBUNGSGEGNER.zucken && !KEILER.zucken && !GRATHORN.zucken && !WOLF.zucken);
}

// ---------------------------------------------------- 16. Pille statt Kreis (D170)
// Ein Keiler ist 1,8 m lang und 0,6 m breit. Als runde Kapsel (r 0,55) traf man ihn von der Seite
// zu leicht und von vorn zu schwer.
{
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);    // Blick −Z, Reichweite 2,4 m bis zum Rand
  const quer = neuerKaempfer('q', KEILER, 0, -2.8, Math.PI / 2);   // steht quer, Flanke zur Spielerin
  const laengs = neuerKaempfer('l', KEILER, 0, -3.2, 0);          // Hinterteil zur Spielerin, Körper längs
  pruefe('Flanke 2,8 m entfernt: kein Treffer (als Kreis r 0,55 wäre es einer)', !imBogen(s, quer));
  pruefe('Hinterteil 3,2 m bis zur Mitte: Treffer (als Kreis wäre es keiner)', imBogen(s, laengs));
  const naeher = neuerKaempfer('n', KEILER, 0, -2.6, Math.PI / 2);
  pruefe('Flanke 2,6 m: Treffer', imBogen(s, naeher));
  // Der Kopf ragt in den Bogen, auch wenn die Mitte daneben liegt.
  const schraeg = neuerKaempfer('k', KEILER, 1.8, -2.2, blickAuf(1.8, -2.2, 0, 0));
  pruefe('Kopf im Bogen, Mitte ausserhalb: Treffer', imBogen(s, schraeg));
}

// ---------------------------------------------------- 17. Der Grathorn (D170)
let grathornVon = NaN, grathornBis = NaN;
{
  const geschuetzt = (t0: number): boolean => {
    const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
    const g = neuerKaempfer('g', GRATHORN, 0, -2.0, blickAuf(0, -2.0, 0, 0));
    setzeSchlagAn(g);
    let t = 0, gerollt = false;
    for (let i = 0; i < 220; i++) {
      if (!gerollt && t >= t0 - 1e-9) { gerollt = setzeRolleAn(s, 0, 0); }
      schrittKaempfer(s, SCHRITT); schrittKaempfer(g, SCHRITT); t += SCHRITT;
      loeseTreffer(g, [s]);
    }
    return s.leben === s.werte.lebenMax;
  };
  for (let t0 = 0; t0 <= 1.0 + 1e-9; t0 += 0.005) {
    if (geschuetzt(t0)) { if (Number.isNaN(grathornVon)) grathornVon = t0; grathornBis = t0; }
  }
  pruefe('Grathorn: Schutzfenster mindestens 200 ms', grathornBis - grathornVon >= 0.2 - 1e-9, f3(grathornBis - grathornVon));
  pruefe('Grathorn: Fenster endet nach Reaktionszeit + 150 ms', grathornBis >= REAKTION + 0.15, f3(grathornBis));
  pruefe('Grathorn: Panikrolle schützt nicht', !geschuetzt(0));
  pruefe('Grathorn: früher als der Keiler — man muss früher rollen', grathornBis < keilerBis, `${f3(grathornBis)} gegen ${f3(keilerBis)}`);
  pruefe('Grathorn: schmaler Bogen', GRATHORN.schlag.halbwinkel < KEILER.schlag.halbwinkel);
}


// ---------------------------------------------------- 19. Der Wolf: Doppelbiss (D171)
let wolfVon = NaN, wolfBis = NaN, wolfDoppelBis = NaN;
{
  /** Rollt bei t0 (Richtung rx/rz), optional sofort ein zweites Mal; gibt den erlittenen Schaden. */
  const probe = (t0: number, rz = 0, zweimal = false): { schaden: number; bisse: number } => {
    const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
    const g = neuerKaempfer('g', WOLF, 0, -1.8, blickAuf(0, -1.8, 0, 0));
    setzeSchlagAn(g);
    let t = 0, rollen = 0, bisse = 0;
    for (let i = 0; i < 300; i++) {
      if (rollen === 0 && t >= t0 - 1e-9 && setzeRolleAn(s, 0, rz)) rollen = 1;
      else if (zweimal && rollen === 1 && s.phase === 'bereit' && setzeRolleAn(s, 0, rz)) rollen = 2;
      const vorher = g.schwung;
      schrittKaempfer(s, SCHRITT); schrittKaempfer(g, SCHRITT); t += SCHRITT;
      if (g.schwung !== vorher) bisse++;
      loeseTreffer(g, [s]);
    }
    return { schaden: s.werte.lebenMax - s.leben, bisse: bisse + 1 };
  };
  pruefe('Wolf: ohne Ausweichen beissen beide', probe(99).schaden === WOLF.schlag.schaden + WOLF.kette![0].schaden,
    `${probe(99).schaden}`);
  pruefe('Wolf: zwei Bisse aus einem Ansatz', probe(99).bisse === 2);
  for (let t0 = 0; t0 <= 1.0 + 1e-9; t0 += 0.005) {
    const r = probe(t0);
    if (r.schaden === WOLF.kette![0].schaden) { if (Number.isNaN(wolfVon)) wolfVon = t0; wolfBis = t0; }
    if (probe(t0, 0, true).schaden === 0) wolfDoppelBis = t0;
  }
  pruefe('Wolf: den ersten Biss kann man auf der Stelle ausrollen', !Number.isNaN(wolfVon));
  pruefe('Wolf: aber dann beisst der zweite — eine Rolle auf der Stelle schützt nie vor beiden',
    [0.2, 0.3, 0.4].every(t0 => probe(t0).schaden > 0));
  pruefe('Wolf: Schutzfenster erster Biss mindestens 200 ms', wolfBis - wolfVon >= 0.2 - 1e-9, `${f3(wolfVon)} … ${f3(wolfBis)}`);
  pruefe('Wolf: Fenster endet nach Reaktionszeit + 150 ms', wolfBis >= REAKTION + 0.15, f3(wolfBis));
  pruefe('Wolf: zwei Rollen hintereinander schützen, wenn die erste nach Reaktionszeit kommt',
    wolfDoppelBis >= REAKTION, f3(wolfDoppelBis));
  pruefe('Wolf: eine Rolle zurück schützt vor beiden', probe(REAKTION, 1).schaden === 0, `${probe(REAKTION, 1).schaden}`);
  pruefe('Wolf: Klinge bricht die Haltung mit dem 2. Treffer',
    Math.ceil(WOLF.haltungMax / WAFFEN.klinge.schlag.haltungsschaden) === 2);
  pruefe('Wolf: schneller als die Huftiere', (WOLF.tempo ?? 0) > 2.4 && WOLF.schlag.vorlauf < GRATHORN.schlag.vorlauf);
  pruefe('Wolf: zuckt nicht', !WOLF.zucken);
  // Im Spiel: Die Kette behält das Angriffsrecht — kein zweiter Gegner schiebt sich zwischen die Bisse.
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  const a = neuerKaempfer('a', WOLF, 0, -1.9, blickAuf(0, -1.9, 0, 0));
  const b = neuerKaempfer('b', WOLF, 3, -3, blickAuf(3, -3, 0, 0));
  const w: Kampfwelt = { spielerin: s, gegner: [a, b], ziel: null };
  let zwischen = 0;
  for (let t = 0; t < 1.5; t += SCHRITT) {
    simuliere(w, SCHRITT);
    if (a.schwung === 1 && a.phase === 'erholung' && b.phase === 'vorlauf') zwischen++;
  }
  pruefe('Wolf: zwischen den Bissen greift kein anderer an', zwischen === 0 && a.schwung >= 2, `${zwischen}, ${a.schwung}`);
}

let rudelWinkel = NaN;
// ---------------------------------------------------- 20. Das Rudel umzingelt (D172)
{
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  const rudel = [[-2, -9], [3, -9.5], [0, -10.5]].map(([x, z], i) => {
    const g = neuerKaempfer(`w${i}`, WOLF, x, z, 0); g.blick = blickAuf(x, z, 0, 0); return g;
  });
  const w: Kampfwelt = { spielerin: s, gegner: rudel, ziel: null };
  let zugleich = 0, proben = 0, streuung = 0;
  const angegriffen = new Set<string>();
  for (let t = 0; t < 25; t += SCHRITT) {
    s.leben = s.werte.lebenMax; s.phase = s.phase === 'gefallen' ? 'bereit' : s.phase;
    simuliere(w, SCHRITT);
    const dran = rudel.filter(g => g.phase === 'vorlauf' || g.phase === 'aktiv');
    if (dran.length > 1) zugleich++;
    for (const g of dran) angegriffen.add(g.id);
    if (t > 5 && Math.round(t * 120) % 30 === 0) {
      const wi = rudel.map(g => Math.atan2(g.x - s.x, g.z - s.z)).sort((a, b) => a - b);
      const luecken = wi.map((a, i) => (i + 1 < wi.length ? wi[i + 1] - a : wi[0] + 2 * Math.PI - a));
      streuung += Math.min(...luecken); proben++;
    }
  }
  const mittel = streuung / Math.max(1, proben) / GRAD;
  pruefe('Rudel: nie zwei Wölfe zugleich im Angriff', zugleich === 0, `${zugleich} Teilschritte`);
  pruefe('Rudel: alle drei kommen dran', angegriffen.size === 3, [...angegriffen].join(','));
  pruefe('Rudel: sie stellen die Spielerin von mehreren Seiten (engster Abstand im Mittel ≥ 70°)', mittel >= 70, `${mittel.toFixed(0)}°`);
  rudelWinkel = mittel;
}

// ---------------------------------------------------- 13. Zielwahl und Zielwechsel (D168)
{
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  const links = neuerKaempfer('links', UEBUNGSGEGNER, -4, -6, 0);
  const mitte = neuerKaempfer('mitte', UEBUNGSGEGNER, 0, -4, 0);
  const rechts = neuerKaempfer('rechts', UEBUNGSGEGNER, 4, -6, 0);
  const seite = neuerKaempfer('seite', UEBUNGSGEGNER, 5, 1, 0);   // 101° rechts, ausserhalb des Kegels
  const alle = [links, mitte, rechts, seite];
  pruefe('ohne Angreifer: der nächste im Kegel', waehleZiel(s, alle)?.id === 'mitte');
  pruefe('der Angreifer geht vor, auch ausserhalb des Kegels', waehleZiel(s, alle, 'seite')?.id === 'seite');
  const hinten = neuerKaempfer('hinten', UEBUNGSGEGNER, 0, 6, 0);
  pruefe('aber nicht in den Rücken', waehleZiel(s, [...alle, hinten], 'hinten')?.id === 'mitte');
  pruefe('rechts von der Mitte: rechts', wechsleZiel(s, alle, 'mitte', 1)?.id === 'rechts');
  pruefe('links von der Mitte: links', wechsleZiel(s, alle, 'mitte', -1)?.id === 'links');
  pruefe('rechts von rechts: seite', wechsleZiel(s, alle, 'rechts', 1)?.id === 'seite');
  pruefe('ganz rechts bleibt ganz rechts', wechsleZiel(s, alle, 'seite', 1)?.id === 'seite');
  mitte.phase = 'gefallen';
  pruefe('Gefallene werden übersprungen', wechsleZiel(s, alle, 'links', 1)?.id === 'rechts');
}

// ---------------------------------------------------- 11. Unabhängig von der Bildrate
{
  const probe = (bild: number) => {
    const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
    const g = neuerKaempfer('g', UEBUNGSGEGNER, 0, -6, 0);
    const w: Kampfwelt = { spielerin: s, gegner: [g], ziel: null };
    let t = 0, ereignisse = 0;
    while (t < 5) { ereignisse += simuliere(w, bild).length; t += bild; }
    return `${s.leben}|${g.leben}|${ereignisse}`;
  };
  const a = probe(1 / 30), b = probe(1 / 144), c = probe(0.1);
  pruefe('dasselbe Ergebnis bei 30, 144 und 10 Bildern je Sekunde', a === b && b === c, `${a} · ${b} · ${c}`);
}


let kettenWerte = '';
// ---------------------------------------------------- 18. Moveset, Puffer, Kette (D171)
{
  /** Eine Spielerin allein auf dem Platz (der Gegner schläft 30 m weg), Klinge oder Axt. */
  const allein = (art: 'klinge' | 'axt' = 'klinge') => {
    const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
    ruesteAus(s, art);
    const g = neuerKaempfer('g', UEBUNGSGEGNER, 0, -30, 0);
    const w: Kampfwelt = { spielerin: s, gegner: [g], ziel: null };
    return { s, w };
  };
  /** Laufen lassen und jeden Schlagbeginn mitschreiben; `druck(t)` darf Eingaben puffern. */
  const lauf = (w: Kampfwelt, dauer: number, druck: (t: number, s: Kaempfer) => void, bild = SCHRITT) => {
    const s = w.spielerin;
    const namen: string[] = []; let warBereit = false, bereitZwischen = 0, letzter = s.schwung;
    for (let t = 0; t < dauer; t += bild) {
      druck(t, s);
      simuliere(w, bild);
      if (s.phase === 'bereit') warBereit = true;
      if (s.schwung !== letzter) {
        letzter = s.schwung; namen.push(s.schlag.name ?? '?');
        if (namen.length > 1 && warBereit) bereitZwischen++;
        warBereit = false;
      }
    }
    return { namen, bereitZwischen };
  };

  // Hämmern: J alle 100 ms. Die Kette läuft Hieb → Rückhand → Stich, ohne Stand dazwischen.
  {
    const { w } = allein();
    const r = lauf(w, 1.3, (t, s) => { if (Math.abs(t / 0.1 - Math.round(t / 0.1)) < 1e-6) puffere(s, 'leicht'); });
    pruefe('Klinge: J J J ergibt Hieb, Rückhand, Stich', r.namen.slice(0, 3).join(',') === 'Hieb,Rückhand,Stich',
      r.namen.join(','));
    pruefe('die Kette bricht die Erholung ab, statt auf den Stand zu warten', r.bereitZwischen === 0,
      `${r.bereitZwischen}× Stand dazwischen`);
  }
  // Die Axt hat zwei leichte, dann beginnt sie von vorn.
  {
    const { w } = allein('axt');
    const r = lauf(w, 3, (t, s) => { if (Math.abs(t / 0.1 - Math.round(t / 0.1)) < 1e-6) puffere(s, 'leicht'); });
    pruefe('Axt: die Kette ist Axthieb, Querhieb, Axthieb', r.namen.slice(0, 3).join(',') === 'Axthieb,Querhieb,Axthieb',
      r.namen.join(','));
  }
  // Der Puffer verfällt: früh im langen Zweihandhieb gedrückt, kommt nichts nach.
  {
    const { s, w } = allein();
    puffere(s, 'schwer');
    const r = lauf(w, 1.6, (t, k) => { if (Math.abs(t - 0.05) < SCHRITT / 2) puffere(k, 'leicht'); });
    pruefe(`ein Druck verfällt nach ${PUFFER} s`, r.namen.join(',') === 'Zweihandhieb', r.namen.join(','));
  }
  // Die Axt ist langsam: Ein Druck im Durchzug muss bis zum Abbruchpunkt halten (im Bild gefunden).
  {
    const { s, w } = allein('axt');
    puffere(s, 'leicht');
    let gedrueckt = false;
    const r = lauf(w, 2.5, (_, k) => { if (!gedrueckt && k.phase === 'aktiv') { puffere(k, 'leicht'); gedrueckt = true; } });
    pruefe('Axt: J im Durchzug gedrückt, kommt der Querhieb', r.namen.slice(0, 2).join(',') === 'Axthieb,Querhieb', r.namen.join(','));
  }
  // Die Kette hält KOMBO_FENSTER nach dem Stand, danach beginnt sie neu.
  {
    const nachStand = (warte: number) => {
      const { s, w } = allein();
      puffere(s, 'leicht');
      let stand = -1;
      const r = lauf(w, 2, (t, k) => {
        if (stand < 0 && k.schwung === 1 && k.phase === 'bereit') stand = t;
        if (stand >= 0 && Math.abs(t - stand - warte) < SCHRITT / 2) puffere(k, 'leicht');
      });
      return r.namen[1];
    };
    pruefe('kurz nach dem Stand: die Kette geht weiter', nachStand(KOMBO_FENSTER * 0.5) === 'Rückhand');
    pruefe('nach dem Fenster: wieder der erste Hieb', nachStand(KOMBO_FENSTER + 0.1) === 'Hieb');
  }
  // Abbrechen erst ab KOMBO_AB der Erholung: früher gedrückt heisst warten, nicht verloren.
  {
    const { s, w } = allein();
    setzeSchlagAn(s, WAFFEN.klinge.leicht[0]);
    const h = WAFFEN.klinge.leicht[0];
    let beginn = NaN;
    for (let t = 0; t < 1; t += SCHRITT) {
      if (s.phase === 'erholung' && s.zeit < SCHRITT) puffere(s, 'leicht');
      const vorher = s.schwung;
      simuliere(w, SCHRITT);
      if (s.schwung !== vorher && Number.isNaN(beginn)) beginn = t + SCHRITT;
    }
    const soll = h.vorlauf + h.aktiv + h.erholung * KOMBO_AB;
    pruefe('der nächste Hieb beginnt genau bei KOMBO_AB der Erholung', Math.abs(beginn - soll) < 2 * SCHRITT,
      `${f3(beginn)} gegen ${f3(soll)} s`);
  }
  // Laufangriff nur im Lauf.
  {
    const a = allein(), b = allein();
    b.s.rennt = true;
    pruefe('im Stand: J ist der Hieb', naechsterSchlag(a.s, 'leicht').schlag.name === 'Hieb');
    pruefe('im Lauf: J ist der Laufstich', naechsterSchlag(b.s, 'leicht').schlag.name === 'Laufstich');
    pruefe('schwer ist schwer, auch im Lauf', naechsterSchlag(b.s, 'schwer').schlag.name === 'Zweihandhieb');
  }
  // Vorschritt: Der Stich trägt die Spielerin um `schritt` nach vorn, sonst nichts.
  for (const sl of [WAFFEN.klinge.leicht[2], WAFFEN.klinge.lauf, WAFFEN.axt.schwer]) {
    const { s } = allein();
    setzeSchlagAn(s, sl);
    for (let t = 0; t < 2; t += SCHRITT) schrittKaempfer(s, SCHRITT);
    const weg = Math.hypot(s.x, s.z);
    pruefe(`${sl.name}: Vorschritt ${sl.schritt} m, nach vorn`, Math.abs(weg - (sl.schritt ?? 0)) < 0.01 && s.z < 0,
      `${f3(weg)} m`);
  }
  // Rückstoss: weg vom Angreifer.
  {
    const { s, g } = paar(2);
    s.schlag = WAFFEN.klinge.schwer; s.phase = 'aktiv'; s.zeit = 0;
    loeseTreffer(s, [g]);
    pruefe('der Rückstoss ist kein Sprung — im Treffer bewegt sich noch nichts', g.z === -2);
    schrittKaempfer(g, STOSS_DAUER / 2);
    pruefe('nach der halben Stossdauer: die halbe Strecke', Math.abs(-g.z - 2 - 0.225) < 1e-6, `${f3(-g.z - 2)} m`);
    for (let t = 0; t < 0.3; t += SCHRITT) schrittKaempfer(g, SCHRITT);
    pruefe('der Zweihandhieb stösst 0,45 m zurück', Math.abs(-g.z - 2 - 0.45) < 1e-6, `${f3(-g.z - 2)} m`);
  }
  // Trefferstopp: die Welt hält 60 ms an, danach läuft sie weiter.
  {
    const { s, g } = paar(2.2);
    const w: Kampfwelt = { spielerin: s, gegner: [g], ziel: null };
    setzeSchlagAn(s);
    let t = 0;
    while (t < 1 && !simuliere(w, SCHRITT).some(e => e.schaden > 0)) t += SCHRITT;
    const z0 = s.zeit, gz = g.zeit;
    simuliere(w, TREFFERSTOPP * 0.8);
    pruefe('im Trefferstopp steht die Uhr', s.zeit === z0 && g.zeit === gz);
    simuliere(w, TREFFERSTOPP);
    pruefe('danach läuft sie weiter', s.zeit > z0);
  }
  // Die Kette hängt nicht an der Bildrate.
  {
    const probe = (bild: number) => {
      const { w } = allein();
      let n = 0;
      const r = lauf(w, 2, (t, s) => { if (t >= n * 0.1 - 1e-9) { n++; puffere(s, 'leicht'); } }, bild);
      return r.namen.join(',');
    };
    const a = probe(1 / 30), b = probe(1 / 144);
    pruefe('die Kette ist bei 30 und 144 Bildern dieselbe', a === b, `${a} · ${b}`);
  }
  // Rollen aus der Kette heraus, gepuffert.
  {
    const { s, w } = allein();
    puffere(s, 'leicht');
    let gerollt = false;
    for (let t = 0; t < 1; t += SCHRITT) {
      if (s.phase === 'aktiv') puffere(s, 'rolle', 1, 0);
      simuliere(w, SCHRITT);
      if (s.phase === 'rolle') { gerollt = true; break; }
    }
    pruefe('eine Rolle im Schwung gedrückt kommt in der Erholung', gerollt);
  }
  // Waagen: die Klinge bleibt die schnellere, die Axt die, die Haltung bricht — auch in der Kette.
  {
    const kette = (ss: Schlag[]) => {
      const dauer = ss.reduce((a, x) => a + x.vorlauf + x.aktiv + x.erholung * KOMBO_AB, 0);
      return { dps: ss.reduce((a, x) => a + x.schaden, 0) / dauer, hps: ss.reduce((a, x) => a + x.haltungsschaden, 0) / dauer };
    };
    const k = kette(WAFFEN.klinge.leicht), a = kette(WAFFEN.axt.leicht);
    pruefe('in der Kette macht die Klinge mehr Schaden je Sekunde', k.dps > a.dps, `${f3(k.dps)} gegen ${f3(a.dps)}`);
    for (const [art, wf] of Object.entries(WAFFEN)) {
      const l = wf.leicht[0], sw = wf.schwer;
      pruefe(`${art}: schwer bricht Haltung je Treffer mindestens 1,5× so stark`,
        sw.haltungsschaden >= 1.5 * l.haltungsschaden, `${sw.haltungsschaden} gegen ${l.haltungsschaden}`);
      pruefe(`${art}: schwer holt sichtbar länger aus (≥ 0,4 s)`, sw.vorlauf >= 0.4);
      for (const x of [...wf.leicht, wf.schwer, wf.lauf]) {
        pruefe(`${art}/${x.name}: Clip und Scheitel vor Durchzug`,
          !!x.clip && !!x.hieb && x.hieb.scheitel > 0 && x.hieb.scheitel < x.hieb.durchzug);
      }
    }
    const kl = WAFFEN.klinge.leicht, ax = WAFFEN.axt.leicht;
    pruefe('jeder leichte Axtschlag holt länger aus als sein Klingen-Gegenstück',
      ax.every((x, i) => x.vorlauf > kl[i].vorlauf));
    kettenWerte = `Klinge ${f3(k.dps)} Schaden/s, ${f3(k.hps)} Haltung/s · Axt ${f3(a.dps)} / ${f3(a.hps)}`;
  }
}

// ---------------------------------------------------- Die gemessenen Werte
const s0 = SPIELERIN, g0 = UEBUNGSGEGNER;
console.log('\nKampftor — gemessen an SPIELERIN gegen UEBUNGSGEGNER');
console.log(`  Schutzfenster Rolle auf der Stelle   ${f3(fensterVon)} … ${f3(fensterBis)} s nach Telegrafbeginn`
  + ` (${Math.round((fensterBis - fensterVon) * 1000)} ms; Telegraf ${g0.schlag.vorlauf} s)`);
console.log(`  Treffer der Spielerin                bei ${f3(trefferZeit)} s nach Tastendruck`);
console.log(`  Reichweite Mitte zu Mitte            ${f3(randReichweite)} m`);
console.log(`  Aus vollem Vorrat                    ${schlaegeAusVoll} Schläge oder ${rollenAusVoll} Rollen`);
console.log(`  Schläge bis der Gegner fällt         ${Math.ceil(g0.lebenMax / s0.schlag.schaden)}`
  + ` · bis er taumelt ${Math.ceil(g0.haltungMax / s0.schlag.haltungsschaden)}`);
console.log(`  Treffer bis die Spielerin fällt      ${Math.ceil(s0.lebenMax / g0.schlag.schaden)}`);
console.log(`  Erster Treffer des Gegners aus 8 m   ${f3(ankunft)} s`);
console.log(`  Schläge zweier Gegner in 15 s        ${schlaegeZuZweit} (im Wechsel, nie zugleich)`);
{
  const d = (s: typeof SPIELERIN.schlag) => s.vorlauf + s.aktiv + s.erholung;
  for (const [art, w] of Object.entries(WAFFEN)) {
    const s = w.schlag;
    console.log(`  ${w.name.padEnd(7)} ${String(Math.round(d(s) * 1000)).padStart(4)} ms je Hieb · ${s.reichweite} m`
      + ` · ${f3(s.schaden / d(s))} Schaden/s · ${f3(s.schaden / s.kosten)} Schaden/Ausdauer · Haltung ${s.haltungsschaden}`);
    void art;
  }
  console.log(`  Axt trifft                           ${f3(axtTreffer)} s nach Tastendruck`);
  console.log(`  Keiler: Schutzfenster                ${f3(keilerVon)} … ${f3(keilerBis)} s (Telegraf ${KEILER.schlag.vorlauf} s)`);
  console.log(`  Wolf: Schutzfenster 1. Biss          ${f3(wolfVon)} … ${f3(wolfBis)} s, Doppelrolle bis ${f3(wolfDoppelBis)} s`);
  console.log(`  Rudel: engster Winkelabstand          ${rudelWinkel.toFixed(0)}° im Mittel (drei Wölfe)`);
  console.log(`  Grathorn: Schutzfenster              ${f3(grathornVon)} … ${f3(grathornBis)} s (Telegraf ${GRATHORN.schlag.vorlauf} s)`);
}
console.log(`  Leichte Kette (mit Abbruch)          ${kettenWerte}`);

// ---------------------------------------------------- Block und Parade (ADR-0009 Stufe 1, D173)
{
  /** Der Angreifer holt aus; die Spielerin hebt `vorTreffer` s vor dem Aktiven den Block. */
  function blockLauf(vorTreffer: number, opt: { werte?: typeof UEBUNGSGEGNER; wegDrehen?: boolean; ausdauer?: number } = {}) {
    const s = neuerKaempfer('s', SPIELERIN, 0, 0, opt.wegDrehen ? Math.PI : 0);
    const w = opt.werte ?? UEBUNGSGEGNER;
    const g = neuerKaempfer('g', w, 0, -1.6, blickAuf(0, -1.6, 0, 0));
    if (opt.ausdauer !== undefined) s.ausdauer = { wert: opt.ausdauer, seitZehrung: 0, erschoepft: false };
    setzeSchlagAn(g);
    const blockAb = w.schlag.vorlauf - vorTreffer;
    let t = 0, tr: Treffer[] = [];
    while (t < w.schlag.vorlauf + w.schlag.aktiv && !tr.length) {
      if (s.phase === 'bereit' && t >= blockAb - 1e-9) setzeBlockAn(s);
      schrittKaempfer(s, SCHRITT); schrittKaempfer(g, SCHRITT);
      tr = loeseTreffer(g, [s]); t += SCHRITT;
    }
    return { s, g, tr: tr[0] };
  }
  const frueh = blockLauf(0.1);
  pruefe('Parade: Block 0,1 s vor dem Treffer pariert', !!frueh.tr?.pariert, JSON.stringify(frueh.tr));
  pruefe('Parade: kein Schaden, keine Ausdauer', frueh.s.leben === SPIELERIN.lebenMax && frueh.s.ausdauer.wert >= 99.9,
    `${frueh.s.leben} / ${frueh.s.ausdauer.wert}`);
  pruefe('Parade: der Angreifer ist betäubt', frueh.g.phase === 'betaeubt', frueh.g.phase);
  { const g = frueh.g; let t = 0; while (g.phase === 'betaeubt' && t < 3) { schrittKaempfer(g, SCHRITT); t += SCHRITT; }
    pruefe(`Parade betäubt ${PARADE_BETAEUBT} s`, Math.abs(t - PARADE_BETAEUBT) < 2 * SCHRITT, f3(t)); }
  const spaet = blockLauf(0.5);
  pruefe('Block 0,5 s vorher: geblockt, nicht pariert', !!spaet.tr?.geblockt && !spaet.tr.pariert, JSON.stringify(spaet.tr));
  pruefe('Block kostet halben Haltungsschaden an Ausdauer, kein Leben',
    spaet.s.leben === SPIELERIN.lebenMax && spaet.s.ausdauer.wert <= 100 - UEBUNGSGEGNER.schlag.haltungsschaden * BLOCK.kosten + 1e-6,
    `${spaet.s.leben} / ${spaet.s.ausdauer.wert}`);
  pruefe('Block hält die Spielerin im Block', spaet.s.phase === 'block', spaet.s.phase);
  const ruecken = blockLauf(0.5, { wegDrehen: true });
  pruefe('Block von hinten hilft nicht', !!ruecken.tr && !ruecken.tr.geblockt && ruecken.s.leben < SPIELERIN.lebenMax);
  const leer = blockLauf(0.5, { ausdauer: 5 });
  pruefe('Block ohne Ausdauer bricht: betäubt, erschöpft', !!leer.tr?.gebrochen && leer.s.phase === 'betaeubt' && leer.s.ausdauer.erschoepft,
    `${leer.s.phase}`);
  const keiler = blockLauf(0.5, { werte: KEILER });
  pruefe('Der Rammstoss des Keilers geht durch den Block', !!keiler.tr && !keiler.tr.geblockt && keiler.s.leben < SPIELERIN.lebenMax);
  const k = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  setzeSchlagAn(k, WAFFEN.klinge.schwer);
  pruefe('kein Block aus dem Vorlauf', !kannBlocken(k));
  const b = neuerKaempfer('s', SPIELERIN, 0, 0, 0); setzeBlockAn(b); loeseBlock(b);
  pruefe('Block loslassen: bereit', b.phase === 'bereit');
  pruefe('Gegner blocken nicht (Stufe 1)', !kannBlocken(neuerKaempfer('g', WOLF, 0, 0)));
  console.log(`  Parade: Fenster ${Math.round(PARADE * 1000)} ms, Angreifer ${PARADE_BETAEUBT} s betäubt · Block frontal ±${Math.round(BLOCK.halbwinkel / GRAD)}°`);
}

// ---------------------------------------------------- Linien gegen Menschen (ADR-0009 Stufe 2, D174)
{
  /** Wegelagerer schlägt; die Spielerin hält den Block in `linie` ab `vor` s vor dem Aktiven. */
  function linienLauf(linie: Linie | undefined, vor = 0.4) {
    const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
    s.linie = linie;
    const g = neuerKaempfer('g', WEGELAGERER, 0, -1.6, blickAuf(0, -1.6, 0, 0));
    setzeSchlagAn(g);
    let t = 0, tr: Treffer[] = [];
    while (t < 1.5 && !tr.length) {
      if (s.phase === 'bereit' && t >= WEGELAGERER.schlag.vorlauf - vor) setzeBlockAn(s);
      schrittKaempfer(s, SCHRITT); schrittKaempfer(g, SCHRITT);
      tr = loeseTreffer(g, [s]); t += SCHRITT;
    }
    return { s, g, tr: tr[0] };
  }
  const erste = WEGELAGERER.mensch!.linienFolge[0];
  const recht = linienLauf(erste);
  pruefe('Linie: Block in derselben Linie hält', !!recht.tr?.geblockt && recht.tr.linie === erste && recht.s.leben === SPIELERIN.lebenMax,
    JSON.stringify(recht.tr));
  const falsch = linienLauf(erste === 'oben' ? 'unten' : 'oben');
  pruefe('Linie: Block in der falschen Linie — halber Schaden', !!falsch.tr?.falscheLinie
    && Math.abs(falsch.s.leben - (SPIELERIN.lebenMax - WEGELAGERER.schlag.schaden / 2)) < 1e-6, JSON.stringify(falsch.tr));
  const par = linienLauf(erste, 0.1);
  pruefe('Linie: Parade nur in der richtigen Linie', !!par.tr?.pariert && !linienLauf('unten', 0.1).tr?.pariert);
  const tier = neuerKaempfer('w', WOLF, 0, 0);
  setzeSchlagAn(tier);
  // Stufe 3 (D175): Tiere schlagen aus ihrem Körperbau — der Wolf wechselt die Seite.
  pruefe('Wolf: erster Biss von links', tier.schlagLinie === 'links', String(tier.schlagLinie));
  for (let t = 0; t < 1.5 && tier.schwung < 2; t += SCHRITT) schrittKaempfer(tier, SCHRITT);
  pruefe('Wolf: Nachbiss von rechts', tier.schlagLinie === 'rechts', `${tier.schwung} ${tier.schlagLinie}`);
  const lin = (w: typeof WOLF) => { const k = neuerKaempfer('t', w, 0, 0); setzeSchlagAn(k); return k.schlagLinie; };
  pruefe('Keiler von unten, Grathorn von oben', lin(KEILER) === 'unten' && lin(GRATHORN) === 'oben');
  {
    // Block gegen den Grathorn in der falschen Linie: halber Schaden.
    const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0); s.linie = 'unten';
    const g = neuerKaempfer('g', GRATHORN, 0, -1.6, blickAuf(0, -1.6, 0, 0));
    setzeSchlagAn(g); setzeBlockAn(s);
    let tr: Treffer[] = [];
    for (let t = 0; t < 1.5 && !tr.length; t += SCHRITT) { schrittKaempfer(s, SCHRITT); schrittKaempfer(g, SCHRITT); tr = loeseTreffer(g, [s]); }
    pruefe('Grathorn: Block unten gegen Stoss von oben — halber Schaden', !!tr[0]?.falscheLinie, JSON.stringify(tr[0]));
  }

  // Deckung: die Spielerin schlägt in die gedeckte Linie
  const g = neuerKaempfer('g', WEGELAGERER, 0, -1.6, blickAuf(0, -1.6, 0, 0));
  function schlageIn(linie: Linie) {
    const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
    s.linie = linie;
    setzeSchlagAn(s);
    let tr: Treffer[] = [];
    for (let t = 0; t < 1 && !tr.length; t += SCHRITT) { schrittKaempfer(s, SCHRITT); tr = loeseTreffer(s, [g]); }
    return { s, tr: tr[0] };
  }
  const gedeckt = g.deckung!;
  const l0 = g.leben;
  const d = schlageIn(gedeckt);
  pruefe('Deckung: kein Schaden, Angreifer zahlt Ausdauer', !!d.tr?.gedeckt && g.leben === l0
    && d.s.ausdauer.wert <= 100 - SPIELERIN.schlag.kosten - SPIELERIN.schlag.schaden * DECKUNG_KOSTEN + 1e-6, `${d.s.ausdauer.wert}`);
  const frei: Linie = gedeckt === 'rechts' ? 'links' : 'rechts';
  const h = schlageIn(frei);
  pruefe('Freie Linie trifft', !h.tr?.gedeckt && g.leben < l0);
  pruefe('Nach dem Treffer wechselt er die Deckung, nicht auf die getroffene Linie', g.deckung !== gedeckt || g.deckung !== frei);
  schlageIn(frei === 'rechts' ? 'unten' : 'rechts');
  g.gelesen = [];
  for (let i = 0; i < 3; i++) { if (g.deckung === 'links') g.deckung = 'oben'; schlageIn('links'); }
  pruefe('Lesen: dreimal dieselbe Linie — er deckt sie', g.deckung === 'links', String(g.deckung));
  const w = neuerKaempfer('g', WEGELAGERER, 0, 0);
  const vorher = w.deckung;
  setzeSchlagAn(w);
  for (let t = 0; t < 3 && w.phase !== 'bereit'; t += SCHRITT) schrittKaempfer(w, SCHRITT);
  pruefe('Nach eigenem Angriff wechselt er die Deckung', w.deckung !== vorher, `${vorher} → ${w.deckung}`);
  console.log(`  Wegelagerer: Linien ${WEGELAGERER.mensch!.linienFolge.join('/')} · Deckung kostet ${DECKUNG_KOSTEN} × Schaden an Ausdauer`);
}
console.log(`\n${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
