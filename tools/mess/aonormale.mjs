/** D301: Die tatsächlich verwendete AO-Normalenfunktion auf der GPU prüfen.
 * node tools/mess/aonormale.mjs
 * Synthetische 5×5-Tiefenfelder; kein Spielstart und keine Performanceaussage.
 */
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
import { playwright } from './pw.mjs';

const { AO_NORMAL_GLSL } = await tsImport('../../src/world/aonormale.ts', import.meta.url);
const { chromium } = await playwright();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const seite = await browser.newPage();
try {
  const ergebnisse = await seite.evaluate(helfer => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 5;
    const gl = canvas.getContext('webgl2', { antialias: false });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw Error('WebGL2-Float-Ziel fehlt.');
    const shader = (typ, quelle) => {
      const s = gl.createShader(typ); gl.shaderSource(s, quelle); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
      return s;
    };
    const vs = shader(gl.VERTEX_SHADER, `#version 300 es
      in vec2 position; out vec2 vUv;
      void main(){ vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`);
    const fs = shader(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      uniform sampler2D tTiefe; uniform float uMassstab;
      in vec2 vUv; out vec4 farbe;
      vec3 sicht(vec2 uv) {
        float z = texture(tTiefe, uv).r;
        return vec3((uv * 2.0 - 1.0) * uMassstab * z, -z);
      }
      ${helfer}
      void main(){ farbe = aoFlaeche(vUv, sicht(vUv), vec2(0.2)); }`);
    const programm = gl.createProgram(); gl.attachShader(programm, vs); gl.attachShader(programm, fs); gl.linkProgram(programm);
    if (!gl.getProgramParameter(programm, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(programm));
    gl.useProgram(programm);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const puffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, puffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const ort = gl.getAttribLocation(programm, 'position'); gl.enableVertexAttribArray(ort); gl.vertexAttribPointer(ort, 2, gl.FLOAT, false, 0, 0);
    const textur = () => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const ausgabe = textur(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 5, 5, 0, gl.RGBA, gl.FLOAT, null);
    const framebuffer = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ausgabe, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw Error('Float-Ziel unvollständig.');
    const eingabe = textur(); gl.uniform1i(gl.getUniformLocation(programm, 'tTiefe'), 0); gl.viewport(0, 0, 5, 5);
    const faelle = [
      { name: 'Ebene', tiefe: () => 10, massstab: 0.05, deckung: 1 },
      { name: 'Sehr kleine gültige Fläche', tiefe: () => 0.0001, massstab: 0.05, deckung: 1 },
      { name: 'Sprung links', tiefe: x => x < 2 ? 100 : 10, massstab: 0.05, deckung: 1 },
      { name: 'Sprung rechts', tiefe: x => x > 2 ? 100 : 10, massstab: 0.05, deckung: 1 },
      { name: 'Sprung unten', tiefe: (_, y) => y < 2 ? 100 : 10, massstab: 0.05, deckung: 1 },
      { name: 'Sprung oben', tiefe: (_, y) => y > 2 ? 100 : 10, massstab: 0.05, deckung: 1 },
      { name: 'Isoliertes Nahpixel', tiefe: (x, y) => x === 2 && y === 2 ? 10 : 100, massstab: 0.05, deckung: 0 },
      { name: 'Zusammengefallene Fläche', tiefe: () => 10, massstab: 0, deckung: 0 },
      { name: 'Gleiche Position überall', tiefe: () => 0, massstab: 0.05, deckung: 0 },
    ];
    const ergebnisse = [];
    for (const fall of faelle) {
      const daten = new Float32Array(25);
      for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) daten[y * 5 + x] = fall.tiefe(x, y);
      gl.bindTexture(gl.TEXTURE_2D, eingabe); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 5, 5, 0, gl.RED, gl.FLOAT, daten);
      gl.uniform1f(gl.getUniformLocation(programm, 'uMassstab'), fall.massstab);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const pixel = new Float32Array(4); gl.readPixels(2, 2, 1, 1, gl.RGBA, gl.FLOAT, pixel);
      ergebnisse.push({ name: fall.name, sollDeckung: fall.deckung, pixel: Array.from(pixel), fehler: gl.getError() });
    }
    gl.deleteTexture(eingabe); gl.deleteTexture(ausgabe); gl.deleteFramebuffer(framebuffer);
    gl.deleteBuffer(puffer); gl.deleteVertexArray(vao); gl.deleteProgram(programm); gl.deleteShader(vs); gl.deleteShader(fs);
    return ergebnisse;
  }, AO_NORMAL_GLSL);
  for (const fall of ergebnisse) {
    assert.equal(fall.fehler, 0, `${fall.name}: WebGL-Fehler`);
    assert.ok(fall.pixel.every(Number.isFinite), `${fall.name}: nicht endliche GPU-Ausgabe ${fall.pixel}`);
    assert.ok(Math.abs(fall.pixel[3] - fall.sollDeckung) < 1e-5, `${fall.name}: Deckung ${fall.pixel[3]} statt ${fall.sollDeckung}`);
    if (fall.sollDeckung === 1) {
      assert.ok(Math.abs(fall.pixel[0]) < 1e-5 && Math.abs(fall.pixel[1]) < 1e-5 && Math.abs(fall.pixel[2] - 1) < 1e-5,
        `${fall.name}: Normale muss nach +Z zeigen, war ${fall.pixel.slice(0, 3)}`);
    }
  }
  console.log(JSON.stringify({ gpuPruefungen: ergebnisse.length, ergebnisse }, null, 2));
} finally { await browser.close(); }
