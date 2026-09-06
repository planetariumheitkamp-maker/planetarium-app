/**
 * Raw-WebGL equidistant angular fisheye (dome-master) renderer.
 * No three.js — a fullscreen quad + custom fragment shader (design.md §8/§10).
 *
 * Output is always square (dome-master standard). The shader samples the
 * source texture with an equidistant polar mapping:
 *   theta = r * fov/2   (angle from dome axis, linear in screen radius)
 *   phi   = atan(y, x) + azimuth
 * and supports tilt (zenith/nadir shift), zoom, center offset, an unwarped
 * "compare" passthrough, and a safe-horizon dim mask.
 */
import type { FisheyeParams } from './types';

/* --------------------------------- shaders --------------------------------- */

const VERT_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2  u_texRes;       // source pixel dimensions
uniform float u_hasTex;       // 1 when a texture is bound
uniform float u_fov;          // degrees 30–220
uniform float u_azimuth;      // degrees 0–360
uniform float u_tilt;         // degrees -90–90
uniform float u_zoom;         // 0.25–3
uniform vec2  u_offset;       // -1..1
uniform float u_compare;      // 1 = unwarped passthrough
uniform float u_horizonMask;  // 1 = dim below horizon

const float PI = 3.141592653589793;

vec2 mirrorRepeat(vec2 uv) {
  return abs(mod(uv, 2.0) - 1.0);
}

void main() {
  vec2 ndc = v_uv * 2.0 - 1.0;
  float mn = min(u_texRes.x, u_texRes.y);
  float mx = max(u_texRes.x, u_texRes.y);
  vec2 warpScale = vec2(mn) / u_texRes;  // isotropic sampling
  vec2 fitScale  = vec2(mx) / u_texRes;  // contain-fit for compare

  vec4 color;
  if (u_compare > 0.5) {
    vec2 uv = ndc * 0.5 * fitScale + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      color = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
      color = texture2D(u_tex, uv);
    }
  } else {
    float r = length(ndc);
    if (r > 1.0) {
      // outside the projected dome circle
      color = vec4(0.012, 0.008, 0.03, 1.0);
    } else {
      float halfFov = radians(u_fov) * 0.5;
      float theta = r * halfFov;
      float phi = atan(ndc.y, ndc.x) + radians(u_azimuth);
      // equidistant: source radius linear in theta; fov 180 at zoom 1
      // spans half the source's short edge
      float sr = (theta / (PI * 0.5)) * 0.5 / max(u_zoom, 0.0001);
      vec2 dir = vec2(cos(phi), sin(phi));
      vec2 center = vec2(0.5) + u_offset * 0.25;
      center.y += u_tilt / 180.0;
      vec2 uv = center + dir * sr * warpScale;
      color = texture2D(u_tex, mirrorRepeat(uv));
      if (u_horizonMask > 0.5 && ndc.y < 0.0) color.rgb *= 0.9;
    }
  }
  if (u_hasTex < 0.5) color = vec4(0.0, 0.0, 0.0, 1.0);
  gl_FragColor = color;
}
`;

/* ------------------------------- param helpers ------------------------------ */

export const DEFAULT_PARAMS: FisheyeParams = {
  fov: 180,
  azimuth: 0,
  tilt: 0,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  wireframe: true,
};

export interface FisheyePreset {
  id: string;
  label: string;
  params: Partial<FisheyeParams>;
}

export const FISHEYE_PRESETS: FisheyePreset[] = [
  { id: 'dome180', label: 'DOME 180°', params: { ...DEFAULT_PARAMS } },
  { id: 'dome220', label: 'DOME 220° FISHEYE', params: { ...DEFAULT_PARAMS, fov: 220 } },
  { id: 'zenith', label: 'ZENITH PUSH', params: { ...DEFAULT_PARAMS, tilt: 30, zoom: 1.3 } },
  { id: 'horizon', label: 'HORIZON SWEEP', params: { ...DEFAULT_PARAMS, tilt: -20, azimuth: 90 } },
  { id: 'planet', label: 'PLANET CLOSE-UP', params: { ...DEFAULT_PARAMS, zoom: 2, fov: 150 } },
];

export function paramsEqual(a: FisheyeParams, b: FisheyeParams): boolean {
  return (
    a.fov === b.fov &&
    a.azimuth === b.azimuth &&
    a.tilt === b.tilt &&
    a.zoom === b.zoom &&
    a.offsetX === b.offsetX &&
    a.offsetY === b.offsetY &&
    a.wireframe === b.wireframe
  );
}

/** Expo-out eased parameter tween (editor.md: 0.5s, expo-out). */
export function tweenParams(
  from: FisheyeParams,
  to: FisheyeParams,
  durationMs: number,
  onUpdate: (p: FisheyeParams) => void,
  onDone?: () => void,
): () => void {
  const start = performance.now();
  let raf = 0;
  const keys = ['fov', 'azimuth', 'tilt', 'zoom', 'offsetX', 'offsetY'] as const;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    const out: FisheyeParams = { ...to };
    for (const k of keys) out[k] = from[k] + (to[k] - from[k]) * e;
    onUpdate(out);
    if (t < 1) raf = requestAnimationFrame(step);
    else onDone?.();
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/* ------------------------------ HUD formatting ------------------------------ */

const pad = (n: number, len: number) => String(n).padStart(len, '0');
const signed = (v: number, decimals = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(decimals)}`;

/** `FOV 180° · AZ 042° · TILT +15° · Z 1.25× · OFF +0.10/-0.05` */
export function formatHudReadout(p: FisheyeParams): string {
  return (
    `FOV ${pad(Math.round(p.fov), 3)}° · AZ ${pad(Math.round(((p.azimuth % 360) + 360) % 360), 3)}° · ` +
    `TILT ${signed(p.tilt, 0)}° · Z ${p.zoom.toFixed(2)}× · ` +
    `OFF ${signed(p.offsetX)}/${signed(p.offsetY)}`
  );
}

/* --------------------------------- renderer --------------------------------- */

export interface RenderState extends FisheyeParams {
  compare: boolean;
  horizonMask: boolean;
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('Failed to create shader');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compile failed: ${log ?? 'unknown'}`);
  }
  return sh;
}

export class FisheyeRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private texW = 1;
  private texH = 1;
  private hasTex = false;
  private lost = false;
  private disposed = false;
  private canvas: HTMLCanvasElement;
  private onContextLost?: () => void;

  constructor(canvas: HTMLCanvasElement, onContextLost?: () => void) {
    this.canvas = canvas;
    this.onContextLost = onContextLost;
    const attrs: WebGLContextAttributes = {
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    };
    const gl =
      (canvas.getContext('webgl', attrs) as WebGLRenderingContext | null) ??
      (canvas.getContext('experimental-webgl', attrs) as WebGLRenderingContext | null);
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;

    canvas.addEventListener('webglcontextlost', this.handleLost, false);
    canvas.addEventListener('webglcontextrestored', this.handleRestored, false);

    this.setup();
  }

  private setup() {
    const gl = this.gl!;
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(program) ?? 'unknown'}`);
    }
    this.program = program;
    gl.useProgram(program);

    // fullscreen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    for (const name of [
      'u_tex', 'u_texRes', 'u_hasTex', 'u_fov', 'u_azimuth', 'u_tilt',
      'u_zoom', 'u_offset', 'u_compare', 'u_horizonMask',
    ]) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
    gl.uniform1i(this.uniforms.u_tex, 0);

    // placeholder 1×1 texture (NPOT-safe params)
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([6, 3, 15, 255]),
    );
  }

  private handleLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    this.onContextLost?.();
  };

  private handleRestored = () => {
    this.lost = false;
    try {
      this.setup();
      this.hasTex = false;
    } catch {
      /* stays lost */
    }
  };

  get isLost(): boolean {
    return this.lost;
  }

  /** Upload a new source (image / video frame / canvas). */
  uploadSource(source: TexImageSource, width: number, height: number): void {
    const gl = this.gl;
    if (!gl || this.lost) return;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      this.texW = width;
      this.texH = height;
      this.hasTex = true;
    } catch {
      this.hasTex = false;
    } finally {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    }
  }

  /** Re-upload a live source (video per frame). No-op dims update. */
  updateLiveFrame(source: TexImageSource): void {
    const gl = this.gl;
    if (!gl || this.lost || !this.hasTex) return;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch {
      /* frame not ready */
    } finally {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    }
  }

  clearTexture(): void {
    this.hasTex = false;
  }

  render(p: RenderState): void {
    const gl = this.gl;
    if (!gl || this.lost || !this.program) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Displayed canvases size from CSS box × dpr; offscreen export canvases
    // keep their explicit width/height exactly.
    const cssW = this.canvas.clientWidth;
    const cssH = this.canvas.clientHeight;
    const w = cssW > 0 ? Math.max(1, Math.round(cssW * dpr)) : this.canvas.width;
    const h = cssH > 0 ? Math.max(1, Math.round(cssH * dpr)) : this.canvas.height;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.program);
    gl.uniform2f(this.uniforms.u_texRes, this.texW, this.texH);
    gl.uniform1f(this.uniforms.u_hasTex, this.hasTex ? 1 : 0);
    gl.uniform1f(this.uniforms.u_fov, p.fov);
    gl.uniform1f(this.uniforms.u_azimuth, p.azimuth);
    gl.uniform1f(this.uniforms.u_tilt, p.tilt);
    gl.uniform1f(this.uniforms.u_zoom, p.zoom);
    gl.uniform2f(this.uniforms.u_offset, p.offsetX, p.offsetY);
    gl.uniform1f(this.uniforms.u_compare, p.compare ? 1 : 0);
    gl.uniform1f(this.uniforms.u_horizonMask, p.horizonMask ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.handleLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleRestored);
    const gl = this.gl;
    if (gl) {
      if (this.texture) gl.deleteTexture(this.texture);
      if (this.program) gl.deleteProgram(this.program);
      const ext = gl.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    }
    this.gl = null;
    this.program = null;
    this.texture = null;
  }
}

/* --------------------------- offscreen PNG export --------------------------- */

/**
 * Render one frame at an exact square export resolution (up to 2048) on a
 * temporary canvas + context, and return a PNG blob.
 */
export async function renderPngBlob(
  source: TexImageSource,
  srcW: number,
  srcH: number,
  size: number,
  params: RenderState,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const renderer = new FisheyeRenderer(canvas);
  try {
    renderer.uploadSource(source, srcW, srcH);
    renderer.render({ ...params, compare: false });
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png'),
    );
    if (!blob) throw new Error('PNG encode failed');
    return blob;
  } finally {
    renderer.dispose();
  }
}

/* ------------------------------- thumbnails -------------------------------- */

/** Downscale any image source into a small square-cropped JPEG thumbnail. */
export async function makeThumbnailBlob(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  srcW: number,
  srcH: number,
  maxSize = 320,
): Promise<Blob | undefined> {
  try {
    const scale = maxSize / Math.max(srcW, srcH);
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(source, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8),
    );
    return blob ?? undefined;
  } catch {
    return undefined;
  }
}

/* ------------------------------ WebM recording ----------------------------- */

export function pickRecorderMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  if (typeof MediaRecorder === 'undefined') return '';
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}
