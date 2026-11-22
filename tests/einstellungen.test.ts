/**
 * Einstellungs-Speicher und Qualitätsvorschlag (D415).
 *
 * Festgehalten wird die **Rangfolge** (Adresse › gespeichert › Stufe › Standard), dass Ungültiges und
 * Unbekanntes beim Laden wegfällt statt den Rest mitzureissen, dass Änderungen gemeldet werden (auch die,
 * die eine Qualitätsstufe mitzieht), und die Entscheidung der Automatik aus übergebenen Geräte-Kennwerten.
 * Die Stufenregeln selbst sind Arbeitswerte ohne Messlauf — getestet ist die Logik, nicht ihre Richtigkeit
 * am Gerät.
 */
import { EINSTELLUNGS_DATEN, EINSTELLUNGS_SCHLUESSEL, erzeugeSpeicher, wertAusAdresse, type Speicher } from '../src/spiel/einstellungen.js';
import { passeNachBildzeit, schlageStufeVor } from '../src/spiel/qualitaetsvorschlag.js';
import { einstellungsWertGueltig } from '../src/data/schema.js';

let bestanden = 0, fehlgeschlagen = 0;
function pruefe(name: string, bedingung: boolean, zusatz = '') {
  if (bedingung) { bestanden++; console.log(`  ✓ ${name.padEnd(62)} ${zusatz}`); }
  else { fehlgeschlagen++; console.log(`  ✗ ${name.padEnd(62)} ${zusatz}`); }
}
const speicher = (start: Record<string, string> = {}): Speicher & { m: Map<string, string> } => {
  const m = new Map(Object.entries(start));
  return { m, getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
};

console.log('Einstellungen — Speicher, Rangfolge, Qualitätsvorschlag\n');

// ---- Daten
const ids = EINSTELLUNGS_DATEN.einstellungen.map(e => e.id);
pruefe('Daten laden, alle Standards gültig', EINSTELLUNGS_DATEN.einstellungen.every(e => einstellungsWertGueltig(e, e.standard)), `${ids.length} Einstellungen`);
pruefe('Neu (D415): blocken-modus, Totzonen links/rechts', ['blocken-modus', 'gamepad-totzone-links', 'gamepad-totzone-rechts'].every(i => ids.includes(i)));
pruefe('URL-Schalter nur, wo sie dasselbe meinen (nur sichtweite → weite)',
  EINSTELLUNGS_DATEN.einstellungen.filter(e => e.url).map(e => e.id).join() === 'sichtweite');

// ---- Standard, ohne Speicher
const leer = erzeugeSpeicher();
pruefe('Ohne alles: Standardwert, Quelle standard', leer.wert('mausempfindlichkeit') === 1 && leer.quelle('mausempfindlichkeit') === 'standard');
pruefe('Automatik ohne Vorschlag: Grafik auf Standard', leer.wert('schatten') === '2048' && leer.wirksameStufe() === null);
let wurfFehler = false; try { leer.wert('gibt-es-nicht'); } catch { wurfFehler = true; }
pruefe('Unbekannte id beim Lesen ist ein Fehler (Tippfehler fallen auf)', wurfFehler);

// ---- Setzen, sichern, wieder laden
const sp = speicher();
const a = erzeugeSpeicher({ speicher: sp });
const meldungen: string[] = [];
a.abonniere('*', (id, w) => meldungen.push(`${id}=${w}`));
let nurMaus = 0; const ab = a.abonniere('mausempfindlichkeit', () => nurMaus++);
pruefe('Gültiger Wert wird gesetzt', a.setze('mausempfindlichkeit', 1.5) && a.wert('mausempfindlichkeit') === 1.5 && a.quelle('mausempfindlichkeit') === 'gespeichert');
pruefe('… und gemeldet (je id und an *)', nurMaus === 1 && meldungen.includes('mausempfindlichkeit=1.5'));
pruefe('Ungültiger Wert (ausserhalb, falscher Schritt, falscher Typ) wird abgelehnt',
  !a.setze('mausempfindlichkeit', 9) && !a.setze('mausempfindlichkeit', 1.55) && !a.setze('rennen-modus', 'fliegen') && !a.setze('vollbild', 'ja' as never)
  && a.wert('mausempfindlichkeit') === 1.5);
pruefe('Unbekannte id wird abgelehnt', !a.setze('gibt-es-nicht', 1));
ab(); a.setze('mausempfindlichkeit', 2);
pruefe('Abmelden wirkt', nurMaus === 1);
const gesichert = JSON.parse(sp.m.get(EINSTELLUNGS_SCHLUESSEL) ?? '{}');
pruefe('Gesichert unter brachland.einstellungen mit Version', gesichert.version === EINSTELLUNGS_DATEN.version && gesichert.werte.mausempfindlichkeit === 2);
const b = erzeugeSpeicher({ speicher: sp });
pruefe('Neuer Speicher liest den gesicherten Wert', b.wert('mausempfindlichkeit') === 2);

// ---- Laden: Ungültiges und Unbekanntes fällt weg
const verdorben = speicher({ [EINSTELLUNGS_SCHLUESSEL]: JSON.stringify({ version: 1, werte: {
  mausempfindlichkeit: 99, 'rennen-modus': 'umschalten', entfallen: true, 'blick-y-umkehren': 'ja' } }) });
const c = erzeugeSpeicher({ speicher: verdorben });
pruefe('Ungültig → Standard, Gültiges bleibt, Unbekanntes ignoriert',
  c.wert('mausempfindlichkeit') === 1 && c.wert('rennen-modus') === 'umschalten' && c.wert('blick-y-umkehren') === false);
pruefe('Unlesbarer Speicher → Standardwerte', erzeugeSpeicher({ speicher: speicher({ [EINSTELLUNGS_SCHLUESSEL]: '{kaputt' }) }).wert('rennen-modus') === 'halten');
const wirft: Speicher = { getItem: () => { throw new Error('gesperrt'); }, setItem: () => { throw new Error('gesperrt'); } };
const d = erzeugeSpeicher({ speicher: wirft });
pruefe('Gesperrter Speicher (privater Modus): läuft, setzt für die Sitzung', d.setze('rennen-modus', 'umschalten') && d.wert('rennen-modus') === 'umschalten');

// ---- Qualitätsstufe und Rangfolge
const q = erzeugeSpeicher({ speicher: speicher() });
q.setze('qualitaetsstufe', 'niedrig');
pruefe('Stufe niedrig: Stufenwerte gelten', q.wert('schatten') === 'aus' && q.wert('aufloesungsskala') === 1 && q.quelle('schatten') === 'stufe');
const gezogen: string[] = []; q.abonniere('*', id => gezogen.push(id));
q.setze('qualitaetsstufe', 'ultra');
pruefe('Stufenwechsel meldet die mitgezogenen Grafikwerte', ['schatten', 'aufloesungsskala', 'vegetationsdichte', 'sichtweite'].every(i => gezogen.includes(i)), gezogen.join(','));
q.setze('schatten', '2048');
pruefe('Einzelwert schlägt Stufe', q.wert('schatten') === '2048' && q.quelle('schatten') === 'gespeichert' && q.wert('sichtweite') === 'sehr-weit');
pruefe('Nicht-Grafik bleibt von der Stufe unberührt', q.wert('lautstaerke-gesamt') === 80 && q.quelle('lautstaerke-gesamt') === 'standard');
const au = erzeugeSpeicher();
au.setzeVorschlag('mittel');
pruefe('Automatik: Vorschlag gilt als Stufe', au.wirksameStufe() === 'mittel' && au.wert('aufloesungsskala') === 1.5);
q.setzeVorschlag('niedrig');
pruefe('Vorschlag wirkt nicht, wenn eine Stufe gewählt ist', q.wirksameStufe() === 'ultra');
q.zuruecksetzen({ gruppe: 'grafik' });
pruefe('Zurücksetzen der Gruppe Grafik', q.wert('qualitaetsstufe') === 'automatisch' && q.wirksameStufe() === 'niedrig' && q.wert('schatten') === 'aus');

// ---- Adresse gewinnt, wird nie gespeichert
const spA = speicher();
const u = erzeugeSpeicher({ speicher: spA, adresse: new URLSearchParams('weite=2') });
u.setze('sichtweite', 'nah');
pruefe('Adresse schlägt gespeicherten Wert', u.wert('sichtweite') === 'sehr-weit' && u.quelle('sichtweite') === 'adresse');
pruefe('… gespeichert ist trotzdem die Wahl des Spielers', JSON.parse(spA.m.get(EINSTELLUNGS_SCHLUESSEL)!).werte.sichtweite === 'nah');
pruefe('Ohne Adresse gilt danach die Wahl', erzeugeSpeicher({ speicher: spA }).wert('sichtweite') === 'nah');
const sw = EINSTELLUNGS_DATEN.einstellungen.find(e => e.id === 'sichtweite')!;
pruefe('urlWerte: 1 → nah, 1.6 → weit, 7 → nichts', wertAusAdresse(sw, '1') === 'nah' && wertAusAdresse(sw, '1.6') === 'weit' && wertAusAdresse(sw, '7') === undefined);
pruefe('Ungültige Adresse übersteuert nicht', erzeugeSpeicher({ adresse: new URLSearchParams('weite=7') }).quelle('sichtweite') !== 'adresse');
const persoenlich = erzeugeSpeicher().persoenlich();
pruefe('Persönliche Werte für den Export: nur wirkt=spieler', 'signalfarbe' in persoenlich && !('schatten' in persoenlich) && !('mausempfindlichkeit' in persoenlich));

// ---- Qualitätsvorschlag
const m1 = { renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)', webgpuSpielpfad: false, kerne: 8, mobil: false };
pruefe('M1 → Hoch (Mess-Referenz)', schlageStufeVor(m1).stufe === 'hoch');
pruefe('SwiftShader → Niedrig', schlageStufeVor({ ...m1, renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)' }).stufe === 'niedrig');
const rtx = { ...m1, renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)', kerne: 16 };
pruefe('RTX ohne WebGPU-Pfad → Hoch, mit → Ultra', schlageStufeVor(rtx).stufe === 'hoch' && schlageStufeVor({ ...rtx, webgpuSpielpfad: true }).stufe === 'ultra');
pruefe('Unbekannte Grafik → Mittel, mit Grund', (() => { const v = schlageStufeVor({ ...m1, renderer: 'Irgendwas 3000' }); return v.stufe === 'mittel' && v.gruende.length > 0; })());
pruefe('Name nicht lesbar → Mittel', schlageStufeVor({ ...m1, renderer: null }).stufe === 'mittel');
pruefe('Handy höchstens Mittel', schlageStufeVor({ ...m1, mobil: true }).stufe === 'mittel');
pruefe('4 Kerne höchstens Mittel', schlageStufeVor({ ...rtx, webgpuSpielpfad: true, kerne: 4 }).stufe === 'mittel');
pruefe('Bildzeit: Hoch mit p95 25 ms → Mittel', passeNachBildzeit('hoch', 25).stufe === 'mittel');
pruefe('Bildzeit: Hoch mit p95 8 ms bleibt Hoch (Ultra braucht WebGPU)', passeNachBildzeit('hoch', 8).stufe === 'hoch');
pruefe('Bildzeit: Mittel mit p95 8 ms → Hoch', passeNachBildzeit('mittel', 8).stufe === 'hoch');
pruefe('Bildzeit: Niedrig mit p95 15 ms bleibt (Mittel bräuchte < 10 ms)', passeNachBildzeit('niedrig', 15).stufe === 'niedrig');
pruefe('Bildzeit: Niedrig fällt nie tiefer', passeNachBildzeit('niedrig', 200).stufe === 'niedrig');
pruefe('Bildzeit: im Ziel → keine Änderung', passeNachBildzeit('hoch', 16).stufe === 'hoch');

console.log(`\n${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
if (fehlgeschlagen > 0) process.exit(1);
