// Звукореактивная графика. Два режима в одном шейдере WebGL2:
// живой — «капля» текущего звука и срезы-эхо истории справа;
// портрет — огибающая всей записи, уникальная «обложка» поста.

export type Palette = {
  bgTop: string;
  bgBot: string;
  edge: string;
  mid: string;
  core: string;
};

export type Level = { level: number; tone: number };
export type LevelSource = () => Level | null;

export const N = 40; // число срезов истории и портрета
const PUSH_MS = 70; // как часто новый срез уходит в историю

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
#define N ${N}
uniform vec2 uRes;
uniform float uTime;
uniform float uShift;
uniform float uMix;   // 0 — живой звук, 1 — портрет записи
uniform float uProg;  // позиция воспроизведения в портрете
uniform float uA[N];
uniform float uT[N];
uniform float uP[N];
uniform vec3 uBgTop, uBgBot, uEdge, uMid, uCore;
out vec4 o;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// градиент от ядра к краю, как в тепловой карте
vec3 heat(float d) {
  vec3 col = mix(uCore, uMid, smoothstep(0.05, 0.62, d));
  return mix(col, uEdge, smoothstep(0.55, 0.98, d));
}

vec3 paint(vec3 bg, float d, float fade, float u) {
  vec3 col = heat(d) * mix(0.9, 1.0, smoothstep(0.0, 0.18, u)); // тень у края среза — «рёбра»
  float body = 1.0 - smoothstep(0.86, 1.32, d);
  float halo = exp(-d * d * 1.4) * 0.22;
  vec3 c = mix(bg, col, body * fade);
  return mix(c, uEdge, halo * fade * (1.0 - body));
}

// Живой режим: капля текущего звука и уходящие вправо срезы-эхо
vec3 live(vec2 uv, vec3 bg) {
  float asp = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float ox = 0.26 * asp;
  float sw = 0.052 * asp;
  float xs = (p.x - ox) / sw + uShift;
  float k = p.x < ox ? 0.0 : floor(xs);
  if (k >= float(N)) return bg;
  int ki = int(k);

  float R = (0.07 + uA[ki] * 0.3) * (1.0 + k * 0.012);
  float start = k < 1.0 ? ox : ox + (k - uShift) * sw;
  float cx = k < 1.0 ? ox : start - R * 0.32;
  vec2 r = vec2(R * 0.95, R * (1.0 + uT[ki] * 0.35));
  float d = length(vec2(p.x - cx, p.y - 0.5) / r);

  float fade = k < 1.0 ? 1.0 : 0.92 * exp(-k * 0.05);
  return paint(bg, d, fade, k < 1.0 ? 1.0 : fract(xs));
}

// Портрет: вся запись целиком, как временной ряд из вертикальных полос
vec3 portrait(vec2 uv, vec3 bg) {
  float m = 0.07;
  float x = (uv.x - m) / (1.0 - 2.0 * m) * float(N);
  if (x < 0.0 || x >= float(N)) return bg;
  int i = int(floor(x));
  float u = fract(x);
  float a = mix(uP[i], uP[min(i + 1, N - 1)], smoothstep(0.75, 1.0, u));
  float h = (0.02 + a * 0.26) * (1.0 + 0.035 * sin(uTime * 1.3 + float(i) * 0.45));
  float d = abs(uv.y - 0.5) / h;
  float played = uProg > 0.0 && float(i) / float(N) > uProg ? 0.45 : 1.0;
  return paint(bg, d * 0.92, played, u);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 bg = mix(uBgBot, uBgTop, smoothstep(0.0, 1.0, uv.y));

  vec3 c = uMix < 0.01 ? live(uv, bg)
         : uMix > 0.99 ? portrait(uv, bg)
         : mix(live(uv, bg), portrait(uv, bg), smoothstep(0.0, 1.0, uMix));

  float g = hash(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5; // зерно
  o = vec4(c + g * 0.045, 1.0);
}`;

function hex(h: string): [number, number, number] {
  const v = parseInt(h.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

const KEYS = ["bgTop", "bgBot", "edge", "mid", "core"] as const;

export class Visual {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private amp = new Float32Array(N);
  private tone = new Float32Array(N);
  private env = 0;
  private envTone = 0;
  private lastPush = 0;
  private colors: Record<string, number[]> = {};
  private target: Record<string, number[]> = {};
  private source: LevelSource | null = null;
  private portrait = new Float32Array(N);
  private hasPortrait = false;
  private mix = 0;
  private progress = 0;

  constructor(private canvas: HTMLCanvasElement, palette: Palette) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!gl) throw new Error("WebGL2 недоступен");
    this.gl = gl;
    this.prog = this.link(VERT, FRAG);
    gl.useProgram(this.prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(this.prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    for (const n of ["uRes", "uTime", "uShift", "uMix", "uProg", "uA", "uT", "uP", "uBgTop", "uBgBot", "uEdge", "uMid", "uCore"]) {
      this.loc[n] = gl.getUniformLocation(this.prog, n);
    }

    this.setPalette(palette, true);
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    requestAnimationFrame(this.frame);
  }

  setSource(src: LevelSource | null) {
    this.source = src;
  }

  // огибающая записи из N значений 0..1; null — портрета нет
  setPortrait(env: ArrayLike<number> | null) {
    this.hasPortrait = !!env;
    this.portrait.fill(0);
    if (env) this.portrait.set(Array.from(env).slice(0, N));
  }

  setProgress(p: number) {
    this.progress = p;
  }

  setPalette(p: Palette, instant = false) {
    for (const k of KEYS) {
      this.target[k] = hex(p[k]);
      if (instant || !this.colors[k]) this.colors[k] = [...this.target[k]];
    }
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private frame = (now: number) => {
    const gl = this.gl;
    const s = this.source?.() ?? null;

    // в тишине капля «дышит», чтобы экран не был мёртвым
    const idle = 0.06 + 0.025 * Math.sin(now / 900);
    const target = s ? Math.max(s.level, 0.02) : idle;
    this.env += (target - this.env) * (target > this.env ? 0.45 : 0.1);
    this.envTone += ((s?.tone ?? 0.3) - this.envTone) * 0.1;

    if (now - this.lastPush > PUSH_MS) {
      this.amp.copyWithin(1, 0);
      this.tone.copyWithin(1, 0);
      this.lastPush = now;
    }
    this.amp[0] = this.env;
    this.tone[0] = this.envTone;

    const toMix = !s && this.hasPortrait ? 1 : 0;
    this.mix += (toMix - this.mix) * 0.12;

    for (const k of KEYS) {
      const c = this.colors[k];
      const t = this.target[k];
      for (let i = 0; i < 3; i++) c[i] += (t[i] - c[i]) * 0.06;
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.loc.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.loc.uTime, now / 1000);
    gl.uniform1f(this.loc.uShift, Math.min((now - this.lastPush) / PUSH_MS, 1));
    gl.uniform1fv(this.loc.uA, this.amp);
    gl.uniform1fv(this.loc.uT, this.tone);
    gl.uniform1fv(this.loc.uP, this.portrait);
    gl.uniform1f(this.loc.uMix, this.mix);
    gl.uniform1f(this.loc.uProg, this.progress);
    gl.uniform3fv(this.loc.uBgTop, this.colors.bgTop);
    gl.uniform3fv(this.loc.uBgBot, this.colors.bgBot);
    gl.uniform3fv(this.loc.uEdge, this.colors.edge);
    gl.uniform3fv(this.loc.uMid, this.colors.mid);
    gl.uniform3fv(this.loc.uCore, this.colors.core);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    requestAnimationFrame(this.frame);
  };

  private link(vs: string, fs: string) {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader");
      return sh;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
    return p;
  }
}

export const PALETTES: Palette[] = [
  // бумага: жёлтый → красный → синий
  { bgTop: "#F4F2ED", bgBot: "#ECE9E2", edge: "#E9C84A", mid: "#EC4B3B", core: "#2D5BDB" },
  // мята → фиолет
  { bgTop: "#9ED2C3", bgBot: "#7A55D8", edge: "#F3A23A", mid: "#E3502B", core: "#283EA6" },
  // красный с кислотным
  { bgTop: "#3A0B10", bgBot: "#B5222C", edge: "#B9F24C", mid: "#63DB7C", core: "#2C77D2" },
  // ночь: розовый → индиго
  { bgTop: "#1D1424", bgBot: "#2B1631", edge: "#FF7C4F", mid: "#FF5EB3", core: "#6E5CFF" },
  // слива: перламутр
  { bgTop: "#1A1220", bgBot: "#24122A", edge: "#FF8A5C", mid: "#2EA59B", core: "#E9EFF0" },
];
