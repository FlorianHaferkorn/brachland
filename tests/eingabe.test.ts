/**
 * Eingabeschicht (D415): Aktionen statt fester Tasten.
 *
 * Festgehalten wird:
 *
 * 1. **Das Spielgefühl bleibt.** Jede Taste, die bis D415 fest im Code stand (`steuerung.ts`,
 *    `Kampfplatz.tsx`, `RegionsSzene.tsx`, `Menue.tsx`), liegt in der Standardbelegung auf derselben
 *    Handlung — ausser bei den zwei aufgelösten Kollisionen (Blick heben/senken R/F → T/G).
 * 2. **Keine ungeduldete Kollision** in der Standardbelegung. Q/E (Drehen/Zielwechsel) und F
 *    (Reinigen/Ansprechen) teilen sich die Taste in getrennten Spielzuständen; die vier Pfeile sind
 *    Bestand (D174) und stehen mit Begründung in `geteilt`.
 * 3. **Freie Belegung** meldet Kollisionen, statt still zu überschreiben, und hält Sperrliste und feste
 *    Aktionen ein.
 * 4. **Gamepad:** Totzone, Knopfcodes, Tippen/Halten auf B, Stickruck.
 */
import {
  BELEGUNG_DATEN, BELEGUNG_SCHLUESSEL, aktiv, aktionenVon, belege, giltIn, halteZustand, karteMit, kollisionen,
  ladeFreieBelegung, setzeBelegung, standardKarte, tastenVon,
} from '../src/spieler/eingabe.js';
import { Doppelknopf, knopfCodes, ruck, totzone } from '../src/spieler/gamepad.js';

let bestanden = 0, fehlgeschlagen = 0;
function pruefe(name: string, bedingung: boolean, zusatz = '') {
  if (bedingung) { bestanden++; console.log(`  ✓ ${name.padEnd(62)} ${zusatz}`); }
  else { fehlgeschlagen++; console.log(`  ✗ ${name.padEnd(62)} ${zusatz}`); }
}

console.log('Eingabe — Aktionen, Standardbelegung, Kollisionen, Gamepad\n');

const karte = standardKarte();
const hat = (aktion: string, ...codes: string[]) => codes.every(c => karte[aktion]?.includes(c));

// ---- 1. Bestand: dieselben Tasten wie vor D415
const BESTAND: [string, string[], string][] = [
  ['vor', ['KeyW', 'ArrowUp'], 'steuerung.ts'], ['zurueck', ['KeyS', 'ArrowDown'], 'steuerung.ts'],
  ['links', ['KeyA'], 'steuerung.ts'], ['rechts', ['KeyD'], 'steuerung.ts'],
  ['drehen_links', ['KeyQ', 'ArrowLeft'], 'steuerung.ts'], ['drehen_rechts', ['KeyE', 'ArrowRight'], 'steuerung.ts'],
  ['rennen', ['ShiftLeft', 'ShiftRight'], 'steuerung.ts'], ['springen', ['Space'], 'steuerung.ts'],
  ['rolle', ['KeyK'], 'Kampfplatz.tsx, D413'], ['angriff_leicht', ['KeyJ'], 'Kampfplatz.tsx'],
  ['angriff_schwer', ['KeyI'], 'Kampfplatz.tsx'], ['block', ['KeyU', 'Maus2'], 'Kampfplatz.tsx'],
  ['zielen', ['KeyL'], 'Kampfplatz.tsx'], ['zielwechsel_links', ['KeyQ'], 'Kampfplatz.tsx'],
  ['zielwechsel_rechts', ['KeyE'], 'Kampfplatz.tsx'], ['linie_oben', ['ArrowUp'], 'Kampfplatz.tsx'],
  ['linie_unten', ['ArrowDown'], 'Kampfplatz.tsx'], ['linie_links', ['ArrowLeft'], 'Kampfplatz.tsx'],
  ['linie_rechts', ['ArrowRight'], 'Kampfplatz.tsx'], ['waffe_klinge', ['Digit1'], 'Kampfplatz.tsx'],
  ['waffe_axt', ['Digit2'], 'Kampfplatz.tsx'], ['waffe_speer', ['Digit3'], 'Kampfplatz.tsx'],
  ['waffe_tausch', ['Tab'], 'Kampfplatz.tsx'], ['umschau', ['KeyC'], 'RegionsSzene.tsx'],
  ['ansicht', ['KeyV'], 'RegionsSzene.tsx'], ['menue', ['Escape'], 'Menue.tsx'],
];
const fehlend = BESTAND.filter(([a, c]) => !hat(a, ...c)).map(([a]) => a);
pruefe('Jede Bestandstaste auf derselben Handlung', fehlend.length === 0, fehlend.join(', ') || `${BESTAND.length} Aktionen`);
pruefe('Rolle bleibt K (D413)', karte.rolle[0] === 'KeyK');
pruefe('Kollision 1: Blick heben/senken von R/F auf T/G', hat('blick_heben', 'KeyT') && hat('blick_senken', 'KeyG')
  && !karte.blick_heben.includes('KeyR') && !karte.blick_senken.includes('KeyF'));
pruefe('Kollision 2: F = Reinigen (Kampf) und Ansprechen (Welt)', hat('reinigen', 'KeyF') && hat('interagieren', 'KeyF'));
pruefe('Alle Aktionen aus dem Auftrag vorhanden',
  ['angriff_leicht', 'angriff_schwer', 'rolle', 'block', 'zielen', 'reinigen', 'rennen', 'springen', 'interagieren', 'menue', 'geraet']
    .every(a => a in karte));
pruefe('Noch nicht verdrahtet: reinigen, interagieren, geraet',
  BELEGUNG_DATEN.aktionen.filter(a => !a.verdrahtet).map(a => a.id).sort().join() === 'geraet,interagieren,reinigen');

// ---- 2. Kollisionen
const k = kollisionen(karte);
const offen = k.filter(x => !x.geduldet);
pruefe('Standardbelegung: keine ungeduldete Kollision', offen.length === 0, offen.map(x => `${x.taste}:${x.aktionen.join('/')}`).join(' ') || `${k.length} geduldet`);
pruefe('Geduldet sind genau die vier Pfeile (Bestand D174)', k.map(x => x.taste).sort().join() === 'ArrowDown,ArrowLeft,ArrowRight,ArrowUp');
pruefe('Q: Drehen (frei) und Zielwechsel (ziel) nie gleichzeitig', giltIn('drehen_links', 'kampf_frei') && !giltIn('drehen_links', 'kampf_ziel')
  && giltIn('zielwechsel_links', 'kampf_ziel') && !giltIn('zielwechsel_links', 'welt'));
pruefe('F: Reinigen nur im Kampf, Ansprechen nur in der Welt', giltIn('reinigen', 'kampf_ziel') && !giltIn('reinigen', 'welt')
  && giltIn('interagieren', 'welt') && !giltIn('interagieren', 'kampf_frei'));
const altQE = { ...karte, drehen_links: ['KeyQ'], zielwechsel_links: ['KeyQ'] };
pruefe('Gegenprobe: alte Lage F = Blick senken + Reinigen wäre Kollision',
  kollisionen({ ...karte, blick_senken: ['KeyF'] }).some(x => x.taste === 'KeyF' && !x.geduldet));
pruefe('Gegenprobe: Q Drehen + Zielwechsel ist keine Kollision', !kollisionen(altQE).some(x => x.taste === 'KeyQ'));
pruefe('Gamepad-Grundbelegung ohne Kollision', !k.some(x => x.taste.startsWith('Pad:')));

// ---- 3. Freie Belegung
const r1 = belege({}, 'angriff_leicht', 0, 'KeyU');
pruefe('Taste eines anderen Kampf-Befehls: Kollision, nichts geändert', !r1.ok && r1.grund === 'kollision' && r1.mit?.includes('block') === true);
const r2 = belege({}, 'angriff_leicht', 0, 'KeyU', true);
pruefe('Mit Tauschen: Block verliert U, behält die rechte Maustaste', r2.ok && r2.frei.angriff_leicht[0] === 'KeyU'
  && !r2.frei.block.includes('KeyU') && r2.frei.block.includes('Maus2') && r2.verdraengt.join() === 'block');
const r3 = belege({}, 'interagieren', 0, 'KeyJ');
pruefe('Taste aus getrenntem Zustand (Welt vs. Kampf) ist frei', r3.ok && r3.verdraengt.length === 0);
pruefe('Gesperrte Browsertaste (F5) abgelehnt', (() => { const r = belege({}, 'springen', 0, 'F5'); return !r.ok && r.grund === 'gesperrt'; })());
pruefe('Menü (Esc) ist fest', (() => { const r = belege({}, 'menue', 0, 'KeyP'); return !r.ok && r.grund === 'fest'; })());
pruefe('Esc lässt sich keiner anderen Aktion geben', (() => { const r = belege({}, 'springen', 0, 'Escape', true); return !r.ok && r.grund === 'fest'; })());
pruefe('Gamepad bleibt fest (A-29 (5))', (() => { const r = belege({}, 'springen', 0, 'Pad:B'); return !r.ok && r.grund === 'gesperrt'; })());
pruefe('Unbekannte Aktion abgelehnt', !belege({}, 'fliegen', 0, 'KeyP').ok);
const r4 = belege({}, 'springen', 1, 'KeyP');
pruefe('Zweite Taste kommt dazu', r4.ok && r4.frei.springen.join() === 'Space,KeyP');
const k2 = karteMit(r4.ok ? r4.frei : {});
pruefe('Karte mit freier Belegung behält das Gamepad', k2.springen.includes('Pad:A') && k2.springen.includes('KeyP'));

// ---- Laufzeit-Abfrage
setzeBelegung({});
pruefe('aktionenVon(KeyQ) = Drehen und Zielwechsel', [...aktionenVon('KeyQ')].sort().join() === 'drehen_links,zielwechsel_links');
pruefe('aktiv: Shift rechts = rennen', aktiv('rennen', new Set(['ShiftRight'])) && !aktiv('rennen', new Set(['KeyW'])));
pruefe('aktiv mit Ausnahme (Linien-Pfeile aus der Rollrichtung)', !aktiv('vor', new Set(['ArrowUp']), new Set(tastenVon('linie_oben'))));
setzeBelegung({ springen: ['KeyP'] });
pruefe('Neu belegt: P springt, Leertaste nicht mehr', aktionenVon('KeyP').includes('springen') && !aktionenVon('Space').includes('springen'));
setzeBelegung({});

const sp = (v: string | null) => ({ getItem: () => v, setItem: () => {} });
pruefe('Gesicherte Belegung: Unbekanntes, Gesperrtes, Festes fällt weg', (() => {
  const f = ladeFreieBelegung(sp(JSON.stringify({ version: 1, frei: { springen: ['KeyP', 'F5'], menue: ['KeyX'], fliegen: ['KeyY'] } })));
  return f.springen?.join() === 'KeyP' && !('menue' in f) && !('fliegen' in f);
})());
pruefe('Unlesbare Belegung → Standard', Object.keys(ladeFreieBelegung(sp('{kaputt'))).length === 0 && BELEGUNG_SCHLUESSEL === 'brachland.belegung');

// ---- Halten / Umschalten
pruefe('Halten: an, solange gedrückt', halteZustand('halten', false, true, true) && !halteZustand('halten', true, false, false));
pruefe('Umschalten: Druck kehrt um, Loslassen nicht', halteZustand('umschalten', false, true, true) === true
  && halteZustand('umschalten', true, false, false) === true && halteZustand('umschalten', true, true, true) === false);

// ---- 4. Gamepad
pruefe('Totzone: unter 15 % null', totzone(0.1, 0.05, 0.15).every(v => v === 0));
const [tx] = totzone(1, 0, 0.15);
pruefe('Totzone: voller Ausschlag bleibt 1', Math.abs(tx - 1) < 1e-9);
const [hx] = totzone(0.575, 0, 0.15);
pruefe('Totzone: neu skaliert, kein Sprung an der Kante', Math.abs(hx - 0.5) < 1e-9 && totzone(0.151, 0, 0.15)[0] < 0.01, hx.toFixed(3));
pruefe('Totzone radial: Diagonale behält die Richtung', (() => { const [x, y] = totzone(0.5, 0.5, 0.15); return Math.abs(x - y) < 1e-12 && x > 0; })());
const knoepfe = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
knoepfe[0] = { pressed: true, value: 1 }; knoepfe[7] = { pressed: true, value: 0.3 }; knoepfe[6] = { pressed: false, value: 0.8 };
pruefe('Knopfcodes: A gedrückt, LT über Schwelle, RT darunter nicht', (() => { const c = knopfCodes(knoepfe); return c.has('Pad:A') && c.has('Pad:LT') && !c.has('Pad:RT'); })());
const b = new Doppelknopf('Pad:B:tippen', 'Pad:B:halten', 0.3);
b.schritt(true, 0); const kurz = b.schritt(false, 0.1);
pruefe('B kurz getippt → Rolle beim Loslassen', kurz.runter.join() === 'Pad:B:tippen' && kurz.hoch.join() === 'Pad:B:tippen');
b.schritt(true, 1); const lang = b.schritt(true, 1.35); const los = b.schritt(false, 2);
pruefe('B gehalten → Rennen ab 0,3 s, endet beim Loslassen, keine Rolle', lang.runter.join() === 'Pad:B:halten' && los.hoch.join() === 'Pad:B:halten' && los.runter.length === 0);
pruefe('Rolle auf B tippen, Rennen auf B halten und L3', hat('rolle', 'Pad:B:tippen') && hat('rennen', 'Pad:B:halten', 'Pad:L3'));
let z = ruck(0.9, true);
pruefe('Stickruck rechts meldet einmal', z.richtung === 1 && !z.bereit);
z = ruck(0.9, z.bereit);
pruefe('… und nicht wieder, solange der Stick draussen bleibt', z.richtung === 0);
z = ruck(0.1, z.bereit); z = ruck(-0.95, z.bereit);
pruefe('Nach Rückkehr in die Ruhe: Ruck links', z.richtung === -1);

console.log(`\n${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
if (fehlgeschlagen > 0) process.exit(1);
