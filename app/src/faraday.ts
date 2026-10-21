// Пятна вида «боке»: мягкие цветные сферы, невесомо висящие в пространстве.
// Никаких рисунков внутри — только свет. На голосе сфера медленно дышит,
// светлеет изнутри, расплывается шире, по ней плывёт блик, вокруг встаёт ореол;
// голос стих — так же медленно возвращается в тихое пятно.

export const MAX_SPOTS = 9;

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uOsc, uT;
uniform vec4 uSpot[${MAX_SPOTS}];  // x, y (доля экрана), радиус (доля min), превращение 0…1
uniform vec4 uCol[${MAX_SPOTS}];   // rgb, прозрачность
const vec3 LAV = vec3(0.933, 0.941, 0.98);

void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float m = min(uRes.x, uRes.y);
  vec3 col = LAV;
  for (int i = 0; i < ${MAX_SPOTS}; i++) {
    vec4 sp = uSpot[i];
    if (sp.z <= 0.0) continue;
    vec2 d2 = (px - sp.xy * uRes) / (sp.z * m);
    float d = length(d2);
    if (d > 2.4) continue;
    float mo = sp.w;
    float fi = float(i);
    // только мягкие пятна, без узоров. Голос: пятно медленно дышит, светлеет изнутри,
    // край становится мягче и шире, по нему плывёт блик, вокруг — ореол
    float breath = 0.5 + 0.5 * cos(uOsc + fi * 1.7);
    float spread = 2.2 - mo * (0.7 + 0.25 * breath);
    float soft = exp(-d * d * spread);
    vec3 c = uCol[i].rgb;
    vec2 glintAt = 0.35 * vec2(cos(uT * 0.25 + fi), sin(uT * 0.21 + fi * 1.3));
    float glint = exp(-dot(d2 - glintAt, d2 - glintAt) * 3.5);
    c = mix(c, vec3(1.0), glint * mo * 0.35 + exp(-d * d * 6.0) * mo * 0.18);
    col = mix(col, mix(c, vec3(1.0), 0.55), exp(-d * d * 0.8) * 0.16 * mo * uCol[i].a);
    col = mix(col, c, clamp(soft * uCol[i].a * (1.0 + mo * 0.15), 0.0, 1.0));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export type Spot = { x: number; y: number; r: number; morph: number; rgb: [number, number, number]; alpha: number };

export class Surface {
  canvas = document.createElement("canvas");
  private gl: WebGLRenderingContext | null;
  private loc: Record<string, WebGLUniformLocation | null> = {};

  constructor() {
    this.gl = this.canvas.getContext("webgl", { antialias: false, alpha: false });
    const gl = this.gl;
    if (!gl) return;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      this.gl = null;
      return;
    }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    for (const u of ["uRes", "uOsc", "uT", "uSpot", "uCol"]) this.loc[u] = gl.getUniformLocation(prog, u);
  }

  get ok() {
    return !!this.gl;
  }

  // spots — от дальних к ближним: ближние ложатся поверх
  draw(w: number, h: number, spots: Spot[], u: { osc: number; t: number }) {
    const gl = this.gl;
    if (!gl) return;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(this.loc.uRes, w, h);
    gl.uniform1f(this.loc.uOsc, u.osc);
    gl.uniform1f(this.loc.uT, u.t);
    const sp = new Float32Array(MAX_SPOTS * 4);
    const cl = new Float32Array(MAX_SPOTS * 4);
    spots.slice(0, MAX_SPOTS).forEach((s, i) => {
      sp.set([s.x, s.y, s.r, s.morph], i * 4);
      cl.set([...s.rgb, s.alpha], i * 4);
    });
    gl.uniform4fv(this.loc.uSpot, sp);
    gl.uniform4fv(this.loc.uCol, cl);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

// цвет CSS → RGB 0…1 (через крошечный холст, чтобы понимать и hex, и hsla)
const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
export function rgb(color: string): [number, number, number] {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255];
}
