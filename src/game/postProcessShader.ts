/**
 * 16-Bit Ordered Bayer Dithering Post-Processing Shader
 * Applies a retro 4x4 Bayer stipple pattern across projected shadow transitions
 * inside the bus canvas using WebGL, with a safe 2D Canvas fallback.
 */

const VERTEX_SHADER_SRC = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER_SRC = `
  precision mediump float;

  uniform sampler2D u_texture;
  uniform vec2 u_resolution;
  uniform float u_pixelScale;
  uniform float u_flicker;
  uniform float u_time;

  varying vec2 v_uv;

  // Classic 4x4 Bayer ordered dithering threshold in [0.0, 15.0/16.0]
  float bayer4x4(vec2 cell) {
    int x = int(mod(cell.x, 4.0));
    int y = int(mod(cell.y, 4.0));
    int idx = x + y * 4;

    if (idx == 0)  return  0.0 / 16.0;
    if (idx == 1)  return  8.0 / 16.0;
    if (idx == 2)  return  2.0 / 16.0;
    if (idx == 3)  return 10.0 / 16.0;
    if (idx == 4)  return 12.0 / 16.0;
    if (idx == 5)  return  4.0 / 16.0;
    if (idx == 6)  return 14.0 / 16.0;
    if (idx == 7)  return  6.0 / 16.0;
    if (idx == 8)  return  3.0 / 16.0;
    if (idx == 9)  return 11.0 / 16.0;
    if (idx == 10) return  1.0 / 16.0;
    if (idx == 11) return  9.0 / 16.0;
    if (idx == 12) return 15.0 / 16.0;
    if (idx == 13) return  7.0 / 16.0;
    if (idx == 14) return 13.0 / 16.0;
    return  5.0 / 16.0;
  }

  float luminance(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    // Snap UVs onto crisp 16-bit virtual pixel grid (480x270) so edges & limbs look genuinely pixelated
    vec2 virtualRes = max(vec2(1.0), u_resolution / max(1.0, u_pixelScale));
    vec2 pixelCoord = floor(v_uv * virtualRes);
    vec2 snappedUv = (pixelCoord + 0.5) / virtualRes;

    vec4 tex = texture2D(u_texture, snappedUv);
    vec3 color = tex.rgb;
    float luma = luminance(color);

    float threshold = bayer4x4(pixelCoord);

    // Detect soft/projected shadow transitions via local luminance gradient on the virtual pixel grid
    vec2 texel = 1.0 / virtualRes;
    float lL = luminance(texture2D(u_texture, snappedUv - vec2(texel.x, 0.0)).rgb);
    float lR = luminance(texture2D(u_texture, snappedUv + vec2(texel.x, 0.0)).rgb);
    float lU = luminance(texture2D(u_texture, snappedUv + vec2(0.0, texel.y)).rgb);
    float lD = luminance(texture2D(u_texture, snappedUv - vec2(0.0, texel.y)).rgb);

    // Smooth transitions (modest gradient) vs crisp hard sprite outlines (huge delta)
    float grad = max(abs(lL - lR), abs(lU - lD));
    float softEdgeMask = smoothstep(0.014, 0.075, grad) * (1.0 - smoothstep(0.16, 0.34, grad));

    // Target shadow & mid-dark cabin transitions (v_uv.y: 0=bottom, 1=top)
    float shadowBand = smoothstep(0.04, 0.16, luma) * (1.0 - smoothstep(0.32, 0.58, luma));

    // Emphasize interior bus regions where ceiling lights & seat/floor shadows fall
    float interiorRegion = smoothstep(0.04, 0.12, v_uv.y) * (1.0 - smoothstep(0.92, 0.99, v_uv.y));
    float flickerBoost = 1.0 + u_flicker * (0.28 + 0.18 * sin(u_time * 42.0));

    // Combine shadow transition mask & quantize color channels using 16-bit Bayer ordered dithering
    float ditherStrength = clamp((shadowBand * 0.68 + softEdgeMask * 0.88) * interiorRegion * flickerBoost, 0.0, 1.0);

    // Authentic 16-bit RGB555 palette quantization everywhere + stronger Bayer stipple in shadow falloffs
    float levels = mix(26.0, 10.0, ditherStrength);
    vec3 dithered = floor(color * levels + (threshold - 0.5) * (0.95 * ditherStrength + 0.28)) / levels;

    // Punch crisp shadow stipple step along projected shadow falloff edges
    float stippleDarken = (1.0 - step(threshold, shadowBand * 0.74 + softEdgeMask * 0.38)) * ditherStrength * 0.15;
    vec3 finalColor = clamp(mix(color, dithered, max(0.38, ditherStrength * 0.92)) * (1.0 - stippleDarken), 0.0, 1.0);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export class DitherPostProcessor {
  private sceneCanvas: HTMLCanvasElement;
  private sceneCtx: CanvasRenderingContext2D;

  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private vbo: WebGLBuffer | null = null;
  private uTextureLoc: WebGLUniformLocation | null = null;
  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uPixelScaleLoc: WebGLUniformLocation | null = null;
  private uFlickerLoc: WebGLUniformLocation | null = null;
  private uTimeLoc: WebGLUniformLocation | null = null;

  private fallbackCtx: CanvasRenderingContext2D | null = null;
  private fallbackDitherPattern: CanvasPattern | null = null;
  private pixelScale: number;

  constructor(
    displayCanvas: HTMLCanvasElement,
    internalWidth: number,
    internalHeight: number,
    renderScale: number
  ) {
    this.pixelScale = renderScale;
    const w = internalWidth * renderScale;
    const h = internalHeight * renderScale;

    displayCanvas.width = w;
    displayCanvas.height = h;

    this.sceneCanvas = document.createElement('canvas');
    this.sceneCanvas.width = w;
    this.sceneCanvas.height = h;
    const sctx = this.sceneCanvas.getContext('2d');
    if (!sctx) {
      throw new Error('Could not acquire offscreen 2D scene context');
    }
    sctx.imageSmoothingEnabled = false;
    this.sceneCtx = sctx;

    if (!this.initWebGL(displayCanvas, w, h)) {
      const fctx = displayCanvas.getContext('2d');
      if (!fctx) {
        throw new Error('Could not acquire display canvas context');
      }
      fctx.imageSmoothingEnabled = false;
      this.fallbackCtx = fctx;
      this.fallbackDitherPattern = this.createFallbackPattern(fctx, renderScale);
    }
  }

  private initWebGL(canvas: HTMLCanvasElement, width: number, height: number): boolean {
    const opts: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    };
    const gl =
      (canvas.getContext('webgl2', opts) as WebGLRenderingContext | null) ||
      (canvas.getContext('webgl', opts) as WebGLRenderingContext | null);
    if (!gl) return false;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return false;
    }

    const prog = gl.createProgram();
    if (!prog) return false;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.deleteProgram(prog);
      return false;
    }

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.viewport(0, 0, width, height);
    gl.useProgram(prog);

    this.gl = gl;
    this.program = prog;
    this.texture = tex;
    this.vbo = vbo;
    this.uTextureLoc = gl.getUniformLocation(prog, 'u_texture');
    this.uResolutionLoc = gl.getUniformLocation(prog, 'u_resolution');
    this.uPixelScaleLoc = gl.getUniformLocation(prog, 'u_pixelScale');
    this.uFlickerLoc = gl.getUniformLocation(prog, 'u_flicker');
    this.uTimeLoc = gl.getUniformLocation(prog, 'u_time');

    if (this.uTextureLoc) gl.uniform1i(this.uTextureLoc, 0);
    if (this.uResolutionLoc) gl.uniform2f(this.uResolutionLoc, width, height);
    if (this.uPixelScaleLoc) gl.uniform1f(this.uPixelScaleLoc, this.pixelScale);

    return true;
  }

  private createFallbackPattern(
    ctx: CanvasRenderingContext2D,
    scale: number
  ): CanvasPattern | null {
    const s = Math.max(2, scale * 2);
    const off = document.createElement('canvas');
    off.width = s;
    off.height = s;
    const octx = off.getContext('2d');
    if (!octx) return null;
    octx.fillStyle = 'rgba(6, 10, 22, 0.22)';
    const half = s / 2;
    octx.fillRect(0, 0, half, half);
    octx.fillRect(half, half, half, half);
    return ctx.createPattern(off, 'repeat');
  }

  public getSceneContext(): CanvasRenderingContext2D {
    return this.sceneCtx;
  }

  public present(time: number, flicker: number) {
    if (this.gl && this.program && this.texture) {
      const gl = this.gl;
      gl.useProgram(this.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.sceneCanvas
      );

      if (this.uFlickerLoc) gl.uniform1f(this.uFlickerLoc, flicker);
      if (this.uTimeLoc) gl.uniform1f(this.uTimeLoc, time);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return;
    }

    if (this.fallbackCtx) {
      const fctx = this.fallbackCtx;
      fctx.clearRect(0, 0, this.sceneCanvas.width, this.sceneCanvas.height);
      fctx.drawImage(this.sceneCanvas, 0, 0);
      if (this.fallbackDitherPattern) {
        fctx.save();
        fctx.fillStyle = this.fallbackDitherPattern;
        fctx.fillRect(0, 0, this.sceneCanvas.width, this.sceneCanvas.height);
        fctx.restore();
      }
    }
  }

  public destroy() {
    if (this.gl) {
      if (this.texture) this.gl.deleteTexture(this.texture);
      if (this.vbo) this.gl.deleteBuffer(this.vbo);
      if (this.program) this.gl.deleteProgram(this.program);
      this.gl = null;
      this.program = null;
      this.texture = null;
      this.vbo = null;
    }
  }
}
