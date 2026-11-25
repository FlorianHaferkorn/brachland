/** D301: Exportierte Tiefenmaske im echten WebGL2-Fragmentshader prüfen.
 * node tools/mess/taamaske.mjs — kleine Uniformfelder, kein Spiel- oder Performance-Lauf.
 */
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
import { playwright } from './pw.mjs';

const { TAA_MASKE_GLSL } = await tsImport('../../src/world/taamaske.ts', import.meta.url);
const { chromium } = await playwright();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const seite = await browser.newPage();
try {
  const ergebnisse = await seite.evaluate(helfer => {
    const gl = document.createElement('canvas').getContext('webgl2', { antialias: false });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw Error('WebGL2-Float-Ziel fehlt.');
    const shader = (typ, quelle) => {
      const s = gl.createShader(typ); gl.shaderSource(s, quelle); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
      return s;
    };
    const vs = shader(gl.VERTEX_SHADER, `#version 300 es
      in vec2 position; void main(){ gl_Position = vec4(position, 0.0, 1.0); }`);
    const fs = shader(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float; uniform float uZ; uniform vec4 uNachbarn; uniform vec4 uEcken; uniform bool uUmfeld; out vec4 farbe;
      ${helfer}
      void main(){ float m = uUmfeld
        ? taaKantenUmfeld(uZ, uNachbarn.x, uNachbarn.y, uNachbarn.z, uNachbarn.w, uEcken.x, uEcken.y, uEcken.z, uEcken.w)
        : taaFeinTiefe(uZ, uNachbarn.x, uNachbarn.y, uNachbarn.z, uNachbarn.w);
        farbe = vec4(m, 0.0, 0.0, 1.0); }`);
    const programm = gl.createProgram(); gl.attachShader(programm, vs); gl.attachShader(programm, fs); gl.linkProgram(programm);
    if (!gl.getProgramParameter(programm, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(programm));
    gl.useProgram(programm);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const puffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, puffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const ort = gl.getAttribLocation(programm, 'position'); gl.enableVertexAttribArray(ort); gl.vertexAttribPointer(ort, 2, gl.FLOAT, false, 0, 0);
    const textur = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, textur);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, 1, 0, gl.RGBA, gl.FLOAT, null);
    const framebuffer = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textur, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw Error('Float-Ziel unvollständig.');
    gl.viewport(0, 0, 1, 1);
    const zOrt = gl.getUniformLocation(programm, 'uZ'), nachbarnOrt = gl.getUniformLocation(programm, 'uNachbarn');
    const eckenOrt = gl.getUniformLocation(programm, 'uEcken'), umfeldOrt = gl.getUniformLocation(programm, 'uUmfeld');
    const faelle = [
      { name: 'Konstante Fläche', z: 10, nachbarn: [10, 10, 10, 10], soll: 0 },
      { name: 'Stark geneigte Ebene', z: 10, nachbarn: [9, 11, 8, 12], soll: 0 },
      { name: 'Isoliertes Nahpixel', z: 10, nachbarn: [100, 100, 100, 100], soll: 1 },
      { name: 'Einseitige Kante nur X', z: 10, nachbarn: [10, 100, 10, 10], soll: 0 },
      { name: 'Moderate Krümmung', z: 10, nachbarn: [10.1, 10.1, 10.08, 10.08], soll: 'zwischen' },
      { name: 'Nulltiefe', z: 0, nachbarn: [0, 0, 0, 0], soll: 0 },
      { name: 'Umfeld: konstant', z: 10, nachbarn: [10, 10, 10, 10], ecken: [10, 10, 10, 10], umfeld: true, soll: 0 },
      { name: 'Umfeld: geneigte lineare Tiefe', z: 10, nachbarn: [9, 11, 8, 12], ecken: [7, 9, 11, 13], umfeld: true, soll: 0 },
      { name: 'Umfeld: gerade Kante', z: 10, nachbarn: [10, 100, 10, 10], ecken: [10, 100, 10, 100], umfeld: true, soll: 1 },
      { name: 'Umfeld: isoliertes Nahpixel', z: 10, nachbarn: [100, 100, 100, 100], ecken: [100, 100, 100, 100], umfeld: true, soll: 1 },
      { name: 'Umfeld: Tiefenloch', z: 100, nachbarn: [10, 10, 10, 10], ecken: [10, 10, 10, 10], umfeld: true, soll: 1 },
      { name: 'Umfeld: Mitte linear, Nachbarreihe gekrümmt', z: 10, nachbarn: [9, 11, 8, 12], ecken: [100, 100, 11, 13], umfeld: true, soll: 1 },
      { name: 'Umfeld: Nulltiefe', z: 0, nachbarn: [0, 0, 0, 0], ecken: [0, 0, 0, 0], umfeld: true, soll: 0 },
    ];
    const ergebnisse = [];
    for (const fall of faelle) {
      gl.uniform1f(zOrt, fall.z); gl.uniform4fv(nachbarnOrt, new Float32Array(fall.nachbarn));
      gl.uniform1i(umfeldOrt, fall.umfeld ? 1 : 0); gl.uniform4fv(eckenOrt, new Float32Array(fall.ecken ?? [0, 0, 0, 0]));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const pixel = new Float32Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pixel);
      ergebnisse.push({ name: fall.name, soll: fall.soll, maske: pixel[0], endlich: Array.from(pixel).every(Number.isFinite), fehler: gl.getError() });
    }
    gl.deleteTexture(textur); gl.deleteFramebuffer(framebuffer); gl.deleteBuffer(puffer); gl.deleteVertexArray(vao);
    gl.deleteProgram(programm); gl.deleteShader(vs); gl.deleteShader(fs);
    return ergebnisse;
  }, TAA_MASKE_GLSL);
  console.log(JSON.stringify({ gpuPruefungen: ergebnisse.length, ergebnisse }, null, 2));
  for (const fall of ergebnisse) {
    assert.equal(fall.fehler, 0, `${fall.name}: WebGL-Fehler`); assert.ok(fall.endlich, `${fall.name}: nicht endliche GPU-Ausgabe`);
    if (fall.soll === 'zwischen') assert.ok(fall.maske > 0 && fall.maske < 1, `${fall.name}: stetiger Übergang erwartet`);
    else assert.ok(Math.abs(fall.maske - fall.soll) < 1e-5, `${fall.name}: Maske ${fall.maske} statt ${fall.soll}`);
  }
} finally { await browser.close(); }
