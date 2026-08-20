/**
 * BRACHLAND — Menü: Karte, Beutel, Team, Verzeichnis
 *
 * ## Warum vier Reiter in **einer** Datei
 *
 * Bis heute gab es keine Oberfläche ausserhalb des Kampfes: kein Menü, keine
 * Karte, keinen Beutel in der Welt, keine Teamordnung, kein Verzeichnis (G-101).
 * Vier Dinge, die man einzeln bauen könnte — und dann hätte man vier
 * Oberflächen, die sich in Rahmen, Eingabe und Spielstandanbindung unterscheiden.
 * Sie teilen hier bewusst einen Rahmen, eine Schliessgeste und einen Zustand.
 *
 * ## Was hier **nicht** hineingehört
 *
 * Schnellreise. Bei 4 km Kantenlänge ist der Weg der Inhalt der Region; ein
 * Sprung dorthin nähme ihr das Einzige, was sie hat.
 *
 * ## Bedienung
 *
 * Ein Knopf oben links, zusätzlich `Escape` auf der Tastatur. Der Knopf ist
 * absichtlich gross (44 px): Die linke Bildhälfte ist der virtuelle Stick
 * (`steuerung.ts`), und ein Menüknopf, den man beim Loslaufen trifft, wäre
 * schlimmer als keiner. Er sitzt deshalb oben, wo der Daumen nicht wischt.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Weltdaten } from '../world/osm.js';
import type { Kaempfer } from '../engine/battle.js';
import type { Gegenstand, NarbenArt } from '../data/schema.js';
import { KREATUREN, GEGENSTAENDE, FRAGMENTE, ORTE, ausKaempferId, nachMetern }
  from '../data/inhalte.js';
import { wendeAn, wirktAuf } from '../spiel/gegenstaende.js';
import { verschiebe } from '../spiel/team.js';
import { zeichneKarte, zeichneMarken, type Kartenmarke } from './karte.js';

export type Reiter = 'karte' | 'beutel' | 'team' | 'verzeichnis';

export interface MenueProps {
  welt: Weltdaten;
  team: Kaempfer[];
  beutel: Record<string, number>;
  /** Gelesene Fundstücke — die Leseliste. */
  fragmente: string[];
  /** Gesehene Kreaturen-IDs (Art, nicht Vorkommen). */
  gesehen: string[];
  /** Gefangene Vorkommen-IDs. Die Art steht vor dem ersten `#`. */
  gefangen: string[];
  besuchteOrte: string[];
  /** Weltposition des Spielers. */
  spieler: [number, number];
  /** Verfolgtes Auftragsziel, falls eines gesetzt ist. */
  ziel?: { x: number; z: number; name: string };
  narbeFuer?: (kaempferId: string) => { art: NarbenArt; wert: number } | undefined;
  onTeam: (neu: Kaempfer[], vertauscht: [number, number]) => void;
  onVerbraucht: (gegenstandId: string) => void;
  /** Nach einer Gegenstandswirkung — der Aufrufer muss die KP sichern. */
  onGeaendert: () => void;
  onSchliessen: () => void;
}

const FARBE = {
  // Vollständig deckend, nicht `f2`. Bei 95 % schienen die Team-Zeilen, der
  // Beuteltext und der Steuerungshinweis der Welt durch — auf einem Bildschirmfoto
  // gut sichtbar, und in Bewegung noch schlechter, weil sich darunter etwas rührt.
  grund: '#0d1210',
  feld: '#131c19',
  rand: '#2a3632',
  akzent: '#3fd9a0',
  text: '#9fb0a8',
  matt: '#6f8079',
  aus: '#5c6b64',
};

const REITER: [Reiter, string][] = [
  ['karte', 'Karte'],
  ['beutel', 'Beutel'],
  ['team', 'Team'],
  ['verzeichnis', 'Verzeichnis'],
];

export function Menue(p: MenueProps) {
  const [reiter, setReiter] = useState<Reiter>('karte');
  const [meldung, setMeldung] = useState<string | null>(null);
  /** Gegenstand, für den gerade ein Ziel gewählt wird. */
  const [wartetAufZiel, setWartetAufZiel] = useState<Gegenstand | null>(null);

  useEffect(() => {
    const auf = (e: KeyboardEvent) => { if (e.key === 'Escape') p.onSchliessen(); };
    window.addEventListener('keydown', auf);
    return () => window.removeEventListener('keydown', auf);
  }, [p.onSchliessen]);

  const benutze = useCallback((g: Gegenstand, ziel: Kaempfer, platz: number) => {
    const w = wendeAn(g, ziel, p.narbeFuer?.(ziel.id));
    setMeldung(w.meldung);
    if (!w.gewirkt) return;
    p.onVerbraucht(g.id);
    p.onGeaendert();
    setWartetAufZiel(null);
    void platz;
  }, [p]);

  return (
    <div style={{
      // z-60, nicht 40: Die Bildratenanzeige in `main.tsx` liegt auf **50** (sie
      // muss im Kampf über der Gegnerkarte stehen) und lag damit quer über der
      // Reiterzeile. Der Kampfbildschirm liegt auf 40 — das Menü darf ihn nicht
      // verdecken, tut es aber auch nicht: Im Kampf gibt es keinen Menüknopf.
      position: 'fixed', inset: 0, zIndex: 60, background: FARBE.grund,
      display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {/* Kopfzeile: Reiter links, Schliessen rechts. Schliessen ist immer an
          derselben Stelle — in einem Menü, das man mitten im Gelände aufmacht,
          ist der schnelle Rückweg die wichtigste Taste. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px',
        borderBottom: `1px solid ${FARBE.rand}`, flexWrap: 'wrap',
      }}>
        {REITER.map(([id, text]) => (
          <button key={id} onClick={() => { setReiter(id); setWartetAufZiel(null); setMeldung(null); }}
            style={{
              minHeight: 34, padding: '4px 11px', borderRadius: 7, fontSize: 12,
              background: reiter === id ? '#1f2b27' : 'transparent',
              border: `1px solid ${reiter === id ? FARBE.rand : 'transparent'}`,
              color: reiter === id ? FARBE.akzent : FARBE.matt,
            }}>{text}</button>
        ))}
        <button onClick={p.onSchliessen} style={{
          marginLeft: 'auto', minHeight: 34, minWidth: 44, borderRadius: 7,
          background: 'transparent', border: `1px solid ${FARBE.rand}`,
          color: FARBE.text, fontSize: 15,
        }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {reiter === 'karte' && <KartenReiter {...p} />}
        {reiter === 'beutel' && (
          <BeutelReiter {...p} wartetAufZiel={wartetAufZiel}
            onWaehle={setWartetAufZiel} onBenutze={benutze} />
        )}
        {reiter === 'team' && <TeamReiter {...p} />}
        {reiter === 'verzeichnis' && <VerzeichnisReiter {...p} />}
      </div>

      {meldung && (
        <div onClick={() => setMeldung(null)} style={{
          padding: '8px 12px', borderTop: `1px solid ${FARBE.rand}`,
          color: FARBE.akzent, fontSize: 12,
        }}>{meldung}</div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Karte

function KartenReiter(p: MenueProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [kante, setKante] = useState(320);

  const marken = useMemo<Kartenmarke[]>(() => {
    const m: Kartenmarke[] = [];
    // Nur **besuchte** Orte und **gelesene** Fundstücke. Eine Karte, die alles
    // verrät, ersetzt das Suchen; eine, die nichts zeigt, ersetzt gar nichts.
    for (const id of p.besuchteOrte) {
      const o = ORTE.get(id);
      if (!o) continue;
      const [x, z] = nachMetern(o.ort, p.welt.bbox);
      m.push({ x, z, art: o.art === 'zuflucht' ? 'zuflucht' : 'ort', name: o.name });
    }
    for (const id of p.fragmente) {
      const f = FRAGMENTE.get(id);
      if (!f) continue;
      const [x, z] = nachMetern(f.ort, p.welt.bbox);
      m.push({ x, z, art: 'fund', name: f.titel });
    }
    if (p.ziel) m.push({ x: p.ziel.x, z: p.ziel.z, art: 'ziel', name: p.ziel.name });
    m.push({ x: p.spieler[0], z: p.spieler[1], art: 'spieler' });
    return m;
  }, [p.besuchteOrte, p.fragmente, p.ziel, p.spieler, p.welt.bbox]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.round(kante * dpr);
    c.width = px; c.height = px;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const { breiteMeter, tiefeMeter } = zeichneKarte(ctx, p.welt, px);
    zeichneMarken(ctx, marken, px, breiteMeter, tiefeMeter);
  }, [p.welt, marken, kante]);

  useEffect(() => {
    const messe = () => setKante(Math.min(window.innerWidth - 28, window.innerHeight - 150, 460));
    messe();
    window.addEventListener('resize', messe);
    return () => window.removeEventListener('resize', messe);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <canvas ref={canvas} style={{
        width: kante, height: kante, borderRadius: 8, border: `1px solid ${FARBE.rand}`,
      }} />
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center',
        fontSize: 11, color: FARBE.matt,
      }}>
        <Legende farbe="#3fd9a0" text="du" />
        <Legende farbe="#7fc8a0" text="Zuflucht" />
        <Legende farbe="#c8a86b" text="Ort" />
        <Legende farbe="#8a93c8" text={`Fundstück (${p.fragmente.length} von ${FRAGMENTE.size})`} />
        {p.ziel && <Legende farbe="#e0743f" text={p.ziel.name} />}
      </div>
      <div style={{ fontSize: 11, color: FARBE.aus, textAlign: 'center', maxWidth: 380 }}>
        Eingezeichnet ist nur, was du selbst gefunden hast. Kein Schnellreisen —
        der Weg ist die Region.
      </div>
    </div>
  );
}

const Legende = ({ farbe, text }: { farbe: string; text: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
    <span style={{ width: 8, height: 8, borderRadius: 4, background: farbe }} />{text}
  </span>
);

// ----------------------------------------------------------------- Beutel

interface BeutelProps extends MenueProps {
  wartetAufZiel: Gegenstand | null;
  onWaehle: (g: Gegenstand | null) => void;
  onBenutze: (g: Gegenstand, ziel: Kaempfer, platz: number) => void;
}

function BeutelReiter(p: BeutelProps) {
  const vorrat = Object.entries(p.beutel).filter(([, n]) => n > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Abschnitt titel="Gegenstände">
        {vorrat.length === 0 && <Leer text="Der Beutel ist leer." />}
        {vorrat.map(([id, n]) => {
          const g = GEGENSTAENDE.get(id);
          if (!g) return null;
          const gewaehlt = p.wartetAufZiel?.id === id;
          return (
            <div key={id} style={{
              border: `1px solid ${gewaehlt ? FARBE.akzent : FARBE.rand}`,
              borderRadius: 8, padding: 9, background: FARBE.feld,
            }}>
              <button onClick={() => p.onWaehle(gewaehlt ? null : g)} style={{
                width: '100%', textAlign: 'left', background: 'transparent',
                border: 'none', color: FARBE.text, padding: 0, minHeight: 34,
              }}>
                <div style={{ fontSize: 13 }}>
                  {g.name} <span style={{ color: FARBE.matt }}>×{n}</span>
                </div>
                <div style={{ fontSize: 11, color: FARBE.matt, marginTop: 2 }}>{g.beschreibung}</div>
              </button>
              {/* Ziel wählen erst nach dem Antippen: Ein Sud, der beim ersten
                  Tippen auf Platz 1 geht, ist im Zweifel am falschen Tier. */}
              {gewaehlt && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {p.team.length === 0 && <Leer text="Kein Team." />}
                  {p.team.map((k, i) => {
                    const geht = wirktAuf(g, k);
                    return (
                      <button key={i} disabled={!geht}
                        onClick={() => p.onBenutze(g, k, i)}
                        style={{
                          minHeight: 36, borderRadius: 7, padding: '4px 9px', fontSize: 12,
                          textAlign: 'left', background: geht ? '#1f2b27' : 'transparent',
                          border: `1px solid ${FARBE.rand}`,
                          color: geht ? FARBE.akzent : FARBE.aus,
                        }}>
                        {k.name} — {Math.max(0, k.kp)}/{k.maxKp} KP
                        {!geht && <span style={{ color: FARBE.aus }}> · wirkt hier nicht</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </Abschnitt>

      {/* Die Leseliste. `main.tsx` und `spielstand.ts` versprechen sie seit
          Wochen im Kommentar („Leseliste im Beutel") — es gab sie nie, und ein
          weggetipptes Fundstück war endgültig weg (G-101). */}
      <Abschnitt titel={`Fundstücke — ${p.fragmente.length} von ${FRAGMENTE.size}`}>
        {p.fragmente.length === 0 && <Leer text="Noch nichts gefunden." />}
        {p.fragmente.map(id => {
          const f = FRAGMENTE.get(id);
          if (!f) return null;
          return (
            <details key={id} style={{
              border: `1px solid ${FARBE.rand}`, borderRadius: 8,
              padding: '7px 9px', background: FARBE.feld,
            }}>
              <summary style={{ fontSize: 12, color: FARBE.text, cursor: 'pointer', minHeight: 24 }}>
                {f.titel}
              </summary>
              <div style={{ fontSize: 12, color: FARBE.matt, marginTop: 6, lineHeight: 1.5 }}>
                {f.text}
              </div>
            </details>
          );
        })}
      </Abschnitt>
    </div>
  );
}

// ------------------------------------------------------------------- Team

function TeamReiter(p: MenueProps) {
  // Warum die Reihenfolge zählt, steht im Text und nicht nur im Code: Platz 1
  // zieht zuerst ein, und ein Wechsel kostet den Zug.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, color: FARBE.aus, marginBottom: 2 }}>
        Platz 1 zieht in jeden Kampf zuerst ein. Ein Wechsel im Kampf kostet den Zug —
        die Reihenfolge hier spart ihn.
      </div>
      {p.team.length === 0 && <Leer text="Kein Team." />}
      {p.team.map((k, i) => {
        const a = ausKaempferId(k.id);
        const kr = KREATUREN.get(a.kreatur);
        const anteil = k.maxKp > 0 ? Math.max(0, k.kp) / k.maxKp : 0;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: `1px solid ${FARBE.rand}`, borderRadius: 8,
            padding: 8, background: FARBE.feld,
          }}>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: FARBE.aus, width: 16 }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: k.kp > 0 ? FARBE.text : '#6b5450' }}>
                {k.name} <span style={{ color: FARBE.matt, fontSize: 11 }}>Stufe {a.stufe}</span>
                {k.zustand !== 'rein' && (
                  <span style={{ color: '#c8a86b', fontSize: 11 }}> · {k.zustand}</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: FARBE.matt }}>
                {Math.max(0, k.kp)}/{k.maxKp} KP
                {kr && <span style={{ color: FARBE.aus }}> · {kr.elemente.join(', ')}</span>}
              </div>
              <div style={{
                height: 3, borderRadius: 2, marginTop: 4, background: '#26302c',
              }}>
                <div style={{
                  width: `${anteil * 100}%`, height: '100%', borderRadius: 2,
                  background: anteil > 0.5 ? FARBE.akzent : anteil > 0.2 ? '#c8a86b' : '#d98b6b',
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Pfeil an={i > 0} text="▲"
                onClick={() => p.onTeam(verschiebe(p.team, i, i - 1), [i, i - 1])} />
              <Pfeil an={i < p.team.length - 1} text="▼"
                onClick={() => p.onTeam(verschiebe(p.team, i, i + 1), [i, i + 1])} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const Pfeil = ({ an, text, onClick }: { an: boolean; text: string; onClick: () => void }) => (
  <button disabled={!an} onClick={onClick} style={{
    minWidth: 38, minHeight: 26, borderRadius: 6, fontSize: 11,
    background: an ? '#1f2b27' : 'transparent',
    border: `1px solid ${an ? FARBE.rand : '#1a221f'}`,
    color: an ? FARBE.akzent : '#333d39',
  }}>{text}</button>
);

// ------------------------------------------------------------ Verzeichnis

function VerzeichnisReiter(p: MenueProps) {
  // `gefangen` trägt Vorkommen-IDs, nicht Arten. Die Art steht davor — dieselbe
  // Zerlegung wie in `vorkommen.ts`.
  const gefangeneArten = useMemo(
    () => new Set(p.gefangen.map(id => id.split('#')[0])),
    [p.gefangen],
  );
  const gesehen = useMemo(() => new Set(p.gesehen), [p.gesehen]);
  const alle = useMemo(() => [...KREATUREN.values()], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ fontSize: 11, color: FARBE.aus, marginBottom: 2 }}>
        {gefangeneArten.size} gefangen · {gesehen.size} gesehen · {alle.length} in dieser Region
      </div>
      {alle.map(k => {
        const hat = gefangeneArten.has(k.id);
        const sah = gesehen.has(k.id);
        return (
          <div key={k.id} style={{
            display: 'flex', alignItems: 'baseline', gap: 8,
            border: `1px solid ${FARBE.rand}`, borderRadius: 7,
            padding: '6px 9px', background: FARBE.feld,
            opacity: sah || hat ? 1 : 0.42,
          }}>
            <span style={{ fontSize: 13, color: hat ? FARBE.akzent : sah ? FARBE.text : FARBE.aus }}>
              {sah || hat ? k.stufen[0].name : '— — —'}
            </span>
            {(sah || hat) && (
              <span style={{ fontSize: 11, color: FARBE.matt }}>
                {k.elemente.join(', ')} · {k.merkmal}
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 10, color: FARBE.aus }}>
              {hat ? 'gefangen' : sah ? 'gesehen' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------- Bausteine

const Abschnitt = ({ titel, children }: { titel: string; children: React.ReactNode }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <h2 style={{
      margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: 0.4,
      textTransform: 'uppercase', color: FARBE.aus,
    }}>{titel}</h2>
    {children}
  </section>
);

const Leer = ({ text }: { text: string }) => (
  <div style={{ fontSize: 12, color: FARBE.aus, padding: '4px 0' }}>{text}</div>
);
