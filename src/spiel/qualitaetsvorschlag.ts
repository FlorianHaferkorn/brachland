/**
 * BRACHLAND — Qualitätsstufe vorschlagen (D415, Doc §6.1 „Automatik“)
 *
 * Zwei Schritte, beide als reine Entscheidung aus **übergebenen** Kennwerten:
 *
 * 1. `schlageStufeVor` — beim Laden aus Renderer-Name (`WEBGL_debug_renderer_info`), WebGPU-Pfad,
 *    Kernzahl und Zeigerart eine Startstufe.
 * 2. `passeNachBildzeit` — nach dem Vorwärmen mit dem p95 der Bildzeit (`spiel/bildrate.ts`) eine Stufe
 *    hoch oder runter. Nie mitten im Kampf (das entscheidet der Aufrufer).
 *
 * Die Regeln stehen in `content/einstellungen.json` `automatik` und sind **Arbeitswerte ohne Messlauf**:
 * Welche Schalter in welche Stufe gehören und ob der M1 „Hoch“ wirklich hält, misst erst ein Lauf am M1
 * in Bewegung (ADR-0005). Bis dahin ist das ein Vorschlag, den die Bildzeit korrigiert.
 *
 * `leseGeraet()` ist die Browser-Seite (untestbar ohne Browser); sie liest nur, sie entscheidet nichts.
 */
import { QUALITAETSSTUFEN, type QualitaetsAutomatik } from '../data/schema.js';
import { EINSTELLUNGS_DATEN, type Stufe } from './einstellungen.js';

export interface Geraet {
  /** Renderer-Name, z. B. „ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)“; `null` = nicht lesbar. */
  renderer: string | null;
  /** Trägt der WebGPU-Pfad das Spiel? Heute nie (ADR-0015: nur die Stauwehr-Probe). */
  webgpuSpielpfad: boolean;
  /** `navigator.hardwareConcurrency`; `null` = unbekannt. */
  kerne: number | null;
  /** Grober Zeiger (Finger) als einziges Eingabegerät — Handy oder Tablet. */
  mobil: boolean;
}

export interface Vorschlag { stufe: Stufe; gruende: string[] }

const rang = (s: Stufe) => QUALITAETSSTUFEN.indexOf(s);
const kleinere = (a: Stufe, b: Stufe): Stufe => (rang(a) <= rang(b) ? a : b);

export function schlageStufeVor(g: Geraet, regeln: QualitaetsAutomatik = EINSTELLUNGS_DATEN.automatik!): Vorschlag {
  const gruende: string[] = [];
  let stufe: Stufe = regeln.ohneTreffer;
  const treffer = g.renderer ? regeln.regeln.find(r => new RegExp(r.muster, 'i').test(g.renderer!)) : undefined;
  if (treffer) { stufe = treffer.stufe; gruende.push(treffer.warum); }
  else gruende.push(g.renderer ? `Grafik „${g.renderer}“ nicht in der Liste` : 'Grafikname nicht lesbar');
  if (stufe === 'ultra' && regeln.ultraBrauchtWebgpu && !g.webgpuSpielpfad) {
    stufe = 'hoch'; gruende.push('Ultra setzt den WebGPU-Pfad voraus, der das Spiel noch nicht trägt');
  }
  if (g.kerne !== null && g.kerne <= regeln.wenigKerneHoechstens.kerne) {
    const neu = kleinere(stufe, regeln.wenigKerneHoechstens.stufe);
    if (neu !== stufe) { stufe = neu; gruende.push(`nur ${g.kerne} Kerne`); }
  }
  if (g.mobil) {
    const neu = kleinere(stufe, regeln.mobilHoechstens);
    if (neu !== stufe) { stufe = neu; gruende.push('Handy oder Tablet'); }
  }
  return { stufe, gruende };
}

/**
 * Eine Stufe hoch oder runter nach dem p95 der Bildzeit beim Vorwärmen. Nie über Hoch ohne WebGPU-Pfad
 * (dieselbe Regel wie beim Vorschlag), nie unter Niedrig.
 */
export function passeNachBildzeit(stufe: Stufe, p95Ms: number, webgpuSpielpfad = false,
  regeln: QualitaetsAutomatik = EINSTELLUNGS_DATEN.automatik!): Vorschlag {
  const ziel = regeln.zielBildzeitMs[stufe] ?? 16.7;
  const i = rang(stufe);
  if (p95Ms > ziel * regeln.runterAbAnteil && i > 0) {
    return { stufe: QUALITAETSSTUFEN[i - 1], gruende: [`p95 ${p95Ms.toFixed(1)} ms über ${ziel} ms`] };
  }
  const deckel: Stufe = regeln.ultraBrauchtWebgpu && !webgpuSpielpfad ? 'hoch' : 'ultra';
  if (p95Ms < ziel * regeln.hochUnterAnteil && rang(stufe) < rang(deckel)) {
    const hoeher = QUALITAETSSTUFEN[i + 1];
    const zielHoeher = regeln.zielBildzeitMs[hoeher] ?? 16.7;
    // Nur hoch, wenn die höhere Stufe ihr eigenes Ziel mit Reserve hält (Niedrig → Mittel heisst 33 → 16,7 ms).
    if (p95Ms < zielHoeher * regeln.hochUnterAnteil) {
      return { stufe: hoeher, gruende: [`p95 ${p95Ms.toFixed(1)} ms weit unter ${zielHoeher} ms`] };
    }
  }
  return { stufe, gruende: [] };
}

/** Kennwerte im Browser lesen. Legt dafür kurz einen eigenen WebGL-Kontext an und gibt ihn wieder frei. */
export function leseGeraet(webgpuSpielpfad = false): Geraet {
  let renderer: string | null = null;
  try {
    const gl = document.createElement('canvas').getContext('webgl2') as WebGL2RenderingContext | null;
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    renderer = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* kein WebGL */ }
  const grob = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
    && !matchMedia('(any-pointer: fine)').matches;
  return { renderer, webgpuSpielpfad, kerne: navigator.hardwareConcurrency ?? null, mobil: grob };
}
