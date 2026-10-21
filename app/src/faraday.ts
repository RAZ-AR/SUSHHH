// Пятна вида «боке»: в тишине — мягкие цветные сферы, невесомо висящие в пространстве;
// на голосе каждая превращается в свою чашку с волнами Фарадея. Если тонкий слой
// жидкости трясти, на поверхности встаёт стоячая волна — решётка из квадратов,
// шестиугольников или квазикристаллов (8- и 12-кратная симметрия); ниже порога
// поверхность гладкая, выше — узор включается и дышит на половине частоты.
// Здесь: мягкий край сферы собирается в чёткий диск с мениском, внутри встаёт
// решётка; громкость — глубина узора, высота голоса — мелкость ячеек, симметрия —
// у каждого автора своя. Голос стих — решётка тает обратно в мягкую сферу.

export const MAX_SPOTS = 9;

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uK, uSym, uOsc, uRot;
uniform vec4 uSpot[${MAX_SPOTS}];  // x, y (доля экрана), радиус (доля min), превращение 0…1
uniform vec4 uCol[${MAX_SPOTS}];   // rgb, прозрачность
const vec3 LAV = vec3(0.933, 0.941, 0.98);

// стоячая волна по uSym направлениям; p — в радиусах сферы
float surf(vec2 p, float rot){
  float h = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= uSym) break;
    float a = rot + 3.14159265 * float(i) / uSym;
    h += cos(uK * dot(vec2(cos(a), sin(a)), p));
  }
  return h / uSym;
}

void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float m = min(uRes.x, uRes.y);
  vec3 col = LAV;
  for (int i = 0; i < ${MAX_SPOTS}; i++) {
    vec4 sp = uSpot[i];
    if (sp.z <= 0.0) continue;
    vec2 d2 = (px - sp.xy * uRes) / (sp.z * m);
    float d = length(d2);
    if (d > 1.6) continue;
    float mo = sp.w;
    // тишина: мягкая сфера с размытым краем
    float soft = exp(-d * d * 2.2);
    // голос: чёткий диск-чашка, внутри — стоячая волна, дышит на субгармонике
    float fi = float(i);
    float osc = cos(uOsc + fi * 0.9);
    float h = surf(d2, uRot + fi * 0.7) * osc;
    float disc = smoothstep(1.0, 0.94, d);
    float lattice = disc * clamp(0.42 + 0.9 * h, 0.0, 1.0);
    float a = mix(soft, lattice, mo) * uCol[i].a;
    vec3 c = uCol[i].rgb;
    // гребни светлее, впадины гуще
    c = mix(c, c * c * 1.1, clamp(-h, 0.0, 1.0) * 0.6 * mo);
    c += vec3(1.0) * pow(max(h, 0.0), 5.0) * 0.45 * mo * disc;
    col = mix(col, c, clamp(a, 0.0, 1.0));
    // мениск: тонкое светлое кольцо по краю чашки
    float rim = smoothstep(0.9, 0.99, d) * smoothstep(1.06, 0.99, d);
    col = mix(col, vec3(1.0), rim * mo * 0.55 * uCol[i].a);
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
    for (const u of ["uRes", "uK", "uSym", "uOsc", "uRot", "uSpot", "uCol"]) this.loc[u] = gl.getUniformLocation(prog, u);
  }

  get ok() {
    return !!this.gl;
  }

  // spots — от дальних к ближним: ближние ложатся поверх
  draw(w: number, h: number, spots: Spot[], u: { k: number; sym: number; osc: number; rot: number }) {
    const gl = this.gl;
    if (!gl) return;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(this.loc.uRes, w, h);
    gl.uniform1f(this.loc.uK, u.k);
    gl.uniform1f(this.loc.uSym, u.sym);
    gl.uniform1f(this.loc.uOsc, u.osc);
    gl.uniform1f(this.loc.uRot, u.rot);
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
