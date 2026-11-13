"use client";

import * as React from "react";
import { useEffect, useRef } from "react";

type FluidTitleProps = {
  hostRef: React.RefObject<HTMLHeadingElement | null>;
  images: [string, string];
  color?: string;
};

type RGB = { r: number; g: number; b: number };

type FluidFBO = {
  texture: WebGLTexture | null;
  fbo: WebGLFramebuffer | null;
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  attach: (id: number) => number;
};

type FluidDoubleFBO = {
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  read: FluidFBO;
  write: FluidFBO;
  swap: () => void;
};

const PALETTE = ["#dfeaf2", "#8fa9b8", "#46664f", "#a9b884", "#dccda6"];
const SPLAT_RADIUS = 8;
const SPLAT_FORCE = 10;
const CURL = 50;
const DENSITY_DISSIPATION = 1.1;
const COLOR_SPEED = 0.125;
const VELOCITY_DISSIPATION = 2;
const PRESSURE = 1 / 20;
const SIM_RESOLUTION = 128;
const DYE_RESOLUTION = 1024;
const PRESSURE_ITERATIONS = 16;
const IMAGE_FITS: [{ sx: number; sy: number; sw: number; sh: number }, { sx: number; sy: number; sw: number; sh: number }] = [
  { sx: 0.25, sy: 0.34, sw: 0.7, sh: 0.56 },
  { sx: 0.197, sy: 0.575, sw: 0.637, sh: 0.26 },
];

function parseColor(input: string, multiplier: number): RGB {
  const black = { r: 0, g: 0, b: 0 };
  if (typeof input !== "string" || !input) return black;
  const str = input.trim();
  const rgb = str.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (rgb) {
    return {
      r: (parseFloat(rgb[1]) / 255) * multiplier,
      g: (parseFloat(rgb[2]) / 255) * multiplier,
      b: (parseFloat(rgb[3]) / 255) * multiplier,
    };
  }
  let val = str.replace("#", "");
  if (val.length === 3 || val.length === 4) {
    val = val.slice(0, 3).split("").map((c) => c + c).join("");
  }
  const n = parseInt(val.slice(0, 6), 16);
  if (!Number.isFinite(n)) return black;
  return {
    r: (((n >> 16) & 255) / 255) * multiplier,
    g: (((n >> 8) & 255) / 255) * multiplier,
    b: ((n & 255) / 255) * multiplier,
  };
}

function parseRGBA(color: string): [number, number, number, number] {
  const s = String(color || "").trim();
  const m = s.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)[\s,]*([\d.]*)/i);
  if (m) {
    const a = m[4] === "" || m[4] === undefined ? 1 : parseFloat(m[4]);
    return [
      parseFloat(m[1]) / 255,
      parseFloat(m[2]) / 255,
      parseFloat(m[3]) / 255,
      Number.isFinite(a) ? a : 1,
    ];
  }
  const c = parseColor(s, 1);
  return [c.r, c.g, c.b, 1];
}

const BASE_VERTEX_SHADER = `
    precision highp float;
    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform vec2 texelSize;

    void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
`;

const COPY_SHADER = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    uniform sampler2D uTexture;

    void main () {
        gl_FragColor = texture2D(uTexture, vUv);
    }
`;

const CLEAR_SHADER = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    uniform float value;

    void main () {
        gl_FragColor = value * texture2D(uTexture, vUv);
    }
`;

const DISPLAY_SHADER = `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uTexture;
    uniform sampler2D uMask;
    uniform sampler2D uImage;
    uniform vec2 texelSize;
    uniform vec4 uBase;
    uniform float uReveal;

    void main () {
        float mask = texture2D(uMask, vUv).a;
        if (mask <= 0.001) discard;

        float maskL = texture2D(uMask, vL).a;
        float maskR = texture2D(uMask, vR).a;
        float maskT = texture2D(uMask, vT).a;
        float maskB = texture2D(uMask, vB).a;
        float rim = clamp(mask - min(min(maskL, maskR), min(maskT, maskB)), 0.0, 1.0);

        vec3 c = texture2D(uTexture, vUv).rgb;
        vec3 lc = texture2D(uTexture, vL).rgb;
        vec3 rc = texture2D(uTexture, vR).rgb;
        vec3 tc = texture2D(uTexture, vT).rgb;
        vec3 bc = texture2D(uTexture, vB).rgb;

        float d = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
        float dx = length(rc) - length(lc);
        float dy = length(tc) - length(bc);

        vec2 warp = clamp(vec2(dx, dy) * 0.25, vec2(-0.03), vec2(0.03));
        vec3 img = texture2D(uImage, clamp(vUv + warp, vec2(0.002), vec2(0.998))).rgb;

        float reveal = clamp(uReveal + smoothstep(0.01, 0.28, d), 0.0, 1.0);
        vec3 color = mix(uBase.rgb * uBase.a, img, reveal);

        vec3 n = normalize(vec3(dx, dy, 0.28));
        float sheen = clamp(dot(n, normalize(vec3(-0.35, 0.5, 0.8))) * 0.5 + 0.5, 0.0, 1.0);
        float ink = 1.0 - reveal * 0.85;
        color *= mix(1.0, 0.78 + 0.44 * sheen, d * 0.6 * ink);
        color = mix(color, clamp(c * 2.0, 0.0, 1.0), d * 0.15 * ink);
        color *= 1.0 - rim * 0.18;
        color = mix(color, uBase.rgb * uBase.a, rim * 0.5);

        gl_FragColor = vec4(color, mask);
    }
`;

const SPLAT_SHADER = `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec3 color;
    uniform vec2 point;
    uniform float radius;

    void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius) * color;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
    }
`;

const ADVECTION_SHADER = `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform vec2 dyeTexelSize;
    uniform float dt;
    uniform float dissipation;

    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
        vec2 st = uv / tsize - 0.5;
        vec2 iuv = floor(st);
        vec2 fuv = fract(st);

        vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
        vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
        vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
        vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);

        return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
    }

    void main () {
        #ifdef MANUAL_FILTERING
            vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
            vec4 result = bilerp(uSource, coord, dyeTexelSize);
        #else
            vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
            vec4 result = texture2D(uSource, coord);
        #endif
        float decay = 1.0 + dissipation * dt;
        gl_FragColor = result / decay;
    }
`;

const DIVERGENCE_SHADER = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;

    void main () {
        float L = texture2D(uVelocity, vL).x;
        float R = texture2D(uVelocity, vR).x;
        float T = texture2D(uVelocity, vT).y;
        float B = texture2D(uVelocity, vB).y;

        vec2 C = texture2D(uVelocity, vUv).xy;
        if (vL.x < 0.0) { L = -C.x; }
        if (vR.x > 1.0) { R = -C.x; }
        if (vT.y > 1.0) { T = -C.y; }
        if (vB.y < 0.0) { B = -C.y; }

        float div = 0.5 * (R - L + T - B);
        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
    }
`;

const CURL_SHADER = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;

    void main () {
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        float vorticity = R - L - T + B;
        gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
    }
`;

const VORTICITY_SHADER = `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform float curl;
    uniform float dt;

    void main () {
        float L = texture2D(uCurl, vL).x;
        float R = texture2D(uCurl, vR).x;
        float T = texture2D(uCurl, vT).x;
        float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;

        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001;
        force *= curl * C;
        force.y *= -1.0;

        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity += force * dt;
        velocity = min(max(velocity, -1000.0), 1000.0);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
`;

const PRESSURE_SHADER = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;

    void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        float divergence = texture2D(uDivergence, vUv).x;
        float pressure = (L + R + B + T - divergence) * 0.25;
        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
    }
`;

const GRADIENT_SUBTRACT_SHADER = `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;

    void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity.xy -= vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
`;

export function ReviewFluidTitle({ hostRef, images, color = "#27352f" }: FluidTitleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [glEpoch, setGlEpoch] = React.useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const glParams: WebGLContextAttributes = {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: false,
    };
    let isWebGL2 = true;
    let gl = canvas.getContext("webgl2", glParams) as
      | WebGL2RenderingContext
      | WebGLRenderingContext
      | null;
    if (!gl) {
      isWebGL2 = false;
      gl = (canvas.getContext("webgl", glParams) ||
        canvas.getContext("experimental-webgl", glParams)) as WebGLRenderingContext | null;
    }
    if (!gl) return;
    // WebGL1 回退路径共用下面这些调用；WebGL2 专属的格式常量只在 isWebGL2 分支读取。
    const g = gl as WebGL2RenderingContext;

    const onLost = (event: Event) => {
      event.preventDefault();
      host.classList.remove("is-fluid-ready");
    };
    const onRestored = () => setGlEpoch((n) => n + 1);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    let halfFloat: OES_texture_half_float | null = null;
    let supportLinearFiltering: OES_texture_float_linear | OES_texture_half_float_linear | null = null;
    if (isWebGL2) {
      g.getExtension("EXT_color_buffer_float");
      supportLinearFiltering = g.getExtension("OES_texture_float_linear");
    } else {
      halfFloat = g.getExtension("OES_texture_half_float");
      supportLinearFiltering = g.getExtension("OES_texture_half_float_linear");
    }
    g.clearColor(0, 0, 0, 0);
    const halfFloatTexType: number = isWebGL2 ? g.HALF_FLOAT : (halfFloat?.HALF_FLOAT_OES as number);

    const supportRenderTextureFormat = (internalFormat: number, format: number, type: number) => {
      const texture = g.createTexture();
      g.bindTexture(g.TEXTURE_2D, texture);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      g.texImage2D(g.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
      const fbo = g.createFramebuffer();
      g.bindFramebuffer(g.FRAMEBUFFER, fbo);
      g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, texture, 0);
      const ok = g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE;
      g.deleteFramebuffer(fbo);
      g.deleteTexture(texture);
      return ok;
    };

    const getSupportedFormat = (
      internalFormat: number,
      format: number,
      type: number
    ): { internalFormat: number; format: number } | null => {
      if (!supportRenderTextureFormat(internalFormat, format, type)) {
        switch (internalFormat) {
          case g.R16F:
            return getSupportedFormat(g.RG16F, g.RG, type);
          case g.RG16F:
            return getSupportedFormat(g.RGBA16F, g.RGBA, type);
          default:
            return null;
        }
      }
      return { internalFormat, format };
    };

    const formatRGBA = isWebGL2
      ? getSupportedFormat(g.RGBA16F, g.RGBA, halfFloatTexType)
      : getSupportedFormat(g.RGBA, g.RGBA, halfFloatTexType);
    const formatRG = isWebGL2
      ? getSupportedFormat(g.RG16F, g.RG, halfFloatTexType)
      : getSupportedFormat(g.RGBA, g.RGBA, halfFloatTexType);
    const formatR = isWebGL2
      ? getSupportedFormat(g.R16F, g.RED, halfFloatTexType)
      : getSupportedFormat(g.RGBA, g.RGBA, halfFloatTexType);
    if (!formatRGBA || !formatRG || !formatR) {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      return;
    }

    const effectiveDyeRes = () =>
      supportLinearFiltering ? DYE_RESOLUTION : Math.min(DYE_RESOLUTION, 256);

    const compileShader = (type: number, source: string, keywords?: string[]) => {
      const withDefines = keywords
        ? keywords.map((k) => `#define ${k}\n`).join("") + source
        : source;
      const shader = g.createShader(type);
      if (!shader) return null;
      g.shaderSource(shader, withDefines);
      g.compileShader(shader);
      if (!g.getShaderParameter(shader, g.COMPILE_STATUS)) {
        console.warn("Fluid title shader:", g.getShaderInfoLog(shader));
      }
      return shader;
    };

    const createProgram = (vs: WebGLShader | null, fs: WebGLShader | null) => {
      const program = g.createProgram();
      if (!program || !vs || !fs) return null;
      g.attachShader(program, vs);
      g.attachShader(program, fs);
      g.linkProgram(program);
      if (!g.getProgramParameter(program, g.LINK_STATUS)) {
        console.warn("Fluid title link:", g.getProgramInfoLog(program));
      }
      return program;
    };

    const getUniforms = (program: WebGLProgram | null) => {
      const uniforms: Record<string, WebGLUniformLocation | null> = {};
      if (!program) return uniforms;
      const count = g.getProgramParameter(program, g.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) {
        const info = g.getActiveUniform(program, i);
        if (!info) continue;
        uniforms[info.name] = g.getUniformLocation(program, info.name);
      }
      return uniforms;
    };

    class Program {
      program: WebGLProgram | null;
      uniforms: Record<string, WebGLUniformLocation | null>;
      constructor(vs: WebGLShader | null, fs: WebGLShader | null) {
        this.program = createProgram(vs, fs);
        this.uniforms = getUniforms(this.program);
      }
      bind() {
        g.useProgram(this.program);
      }
    }

    const baseVertexShader = compileShader(g.VERTEX_SHADER, BASE_VERTEX_SHADER);
    const copyProgram = new Program(baseVertexShader, compileShader(g.FRAGMENT_SHADER, COPY_SHADER));
    const clearProgram = new Program(baseVertexShader, compileShader(g.FRAGMENT_SHADER, CLEAR_SHADER));
    const splatProgram = new Program(baseVertexShader, compileShader(g.FRAGMENT_SHADER, SPLAT_SHADER));
    const advectionProgram = new Program(
      baseVertexShader,
      compileShader(
        g.FRAGMENT_SHADER,
        ADVECTION_SHADER,
        supportLinearFiltering ? undefined : ["MANUAL_FILTERING"]
      )
    );
    const divergenceProgram = new Program(
      baseVertexShader,
      compileShader(g.FRAGMENT_SHADER, DIVERGENCE_SHADER)
    );
    const curlProgram = new Program(baseVertexShader, compileShader(g.FRAGMENT_SHADER, CURL_SHADER));
    const vorticityProgram = new Program(
      baseVertexShader,
      compileShader(g.FRAGMENT_SHADER, VORTICITY_SHADER)
    );
    const pressureProgram = new Program(
      baseVertexShader,
      compileShader(g.FRAGMENT_SHADER, PRESSURE_SHADER)
    );
    const gradientSubtractProgram = new Program(
      baseVertexShader,
      compileShader(g.FRAGMENT_SHADER, GRADIENT_SUBTRACT_SHADER)
    );
    const displayProgram = new Program(
      baseVertexShader,
      compileShader(g.FRAGMENT_SHADER, DISPLAY_SHADER)
    );

    const quadBuffer = g.createBuffer();
    const quadIndices = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, quadBuffer);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), g.STATIC_DRAW);
    g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, quadIndices);
    g.bufferData(g.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), g.STATIC_DRAW);
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
    g.enableVertexAttribArray(0);

    const blit = (target: FluidFBO | null, clear = false) => {
      if (target == null) {
        g.viewport(0, 0, g.drawingBufferWidth, g.drawingBufferHeight);
        g.bindFramebuffer(g.FRAMEBUFFER, null);
      } else {
        g.viewport(0, 0, target.width, target.height);
        g.bindFramebuffer(g.FRAMEBUFFER, target.fbo);
      }
      if (clear) {
        g.clearColor(0, 0, 0, target == null ? 0 : 1);
        g.clear(g.COLOR_BUFFER_BIT);
      }
      g.drawElements(g.TRIANGLES, 6, g.UNSIGNED_SHORT, 0);
    };

    const createFBO = (
      w: number,
      h: number,
      internalFormat: number,
      format: number,
      type: number,
      param: number
    ): FluidFBO => {
      g.activeTexture(g.TEXTURE0);
      const texture = g.createTexture();
      g.bindTexture(g.TEXTURE_2D, texture);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, param);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, param);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      g.texImage2D(g.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
      const fbo = g.createFramebuffer();
      g.bindFramebuffer(g.FRAMEBUFFER, fbo);
      g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, texture, 0);
      g.viewport(0, 0, w, h);
      g.clear(g.COLOR_BUFFER_BIT);
      return {
        texture,
        fbo,
        width: w,
        height: h,
        texelSizeX: 1 / w,
        texelSizeY: 1 / h,
        attach(id: number) {
          g.activeTexture(g.TEXTURE0 + id);
          g.bindTexture(g.TEXTURE_2D, texture);
          return id;
        },
      };
    };

    const destroyFBO = (target: FluidFBO | null | undefined) => {
      if (!target) return;
      g.deleteFramebuffer(target.fbo);
      g.deleteTexture(target.texture);
    };
    const destroyDoubleFBO = (target: FluidDoubleFBO | null | undefined) => {
      if (!target) return;
      destroyFBO(target.read);
      destroyFBO(target.write);
    };

    const createDoubleFBO = (
      w: number,
      h: number,
      internalFormat: number,
      format: number,
      type: number,
      param: number
    ): FluidDoubleFBO => {
      let fbo1 = createFBO(w, h, internalFormat, format, type, param);
      let fbo2 = createFBO(w, h, internalFormat, format, type, param);
      return {
        width: w,
        height: h,
        texelSizeX: fbo1.texelSizeX,
        texelSizeY: fbo1.texelSizeY,
        get read() {
          return fbo1;
        },
        set read(v) {
          fbo1 = v;
        },
        get write() {
          return fbo2;
        },
        set write(v) {
          fbo2 = v;
        },
        swap() {
          const t = fbo1;
          fbo1 = fbo2;
          fbo2 = t;
        },
      };
    };

    const resizeFBO = (
      target: FluidFBO,
      w: number,
      h: number,
      internalFormat: number,
      format: number,
      type: number,
      param: number
    ) => {
      const next = createFBO(w, h, internalFormat, format, type, param);
      copyProgram.bind();
      g.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
      blit(next);
      destroyFBO(target);
      return next;
    };

    const resizeDoubleFBO = (
      target: FluidDoubleFBO,
      w: number,
      h: number,
      internalFormat: number,
      format: number,
      type: number,
      param: number
    ) => {
      if (target.width === w && target.height === h) return target;
      target.read = resizeFBO(target.read, w, h, internalFormat, format, type, param);
      destroyFBO(target.write);
      target.write = createFBO(w, h, internalFormat, format, type, param);
      target.width = w;
      target.height = h;
      target.texelSizeX = 1 / w;
      target.texelSizeY = 1 / h;
      return target;
    };

    const getResolution = (resolution: number) => {
      let aspectRatio = g.drawingBufferWidth / g.drawingBufferHeight;
      if (aspectRatio < 1) aspectRatio = 1 / aspectRatio;
      const min = Math.round(resolution);
      const max = Math.round(resolution * aspectRatio);
      return g.drawingBufferWidth > g.drawingBufferHeight
        ? { width: max, height: min }
        : { width: min, height: max };
    };

    let dye!: FluidDoubleFBO;
    let velocity!: FluidDoubleFBO;
    let divergence!: FluidFBO;
    let curlFBO!: FluidFBO;
    let pressureFBO!: FluidDoubleFBO;

    const initFramebuffers = () => {
      const simRes = getResolution(SIM_RESOLUTION);
      const dyeRes = getResolution(effectiveDyeRes());
      const texType = halfFloatTexType;
      const filtering = supportLinearFiltering ? g.LINEAR : g.NEAREST;
      g.disable(g.BLEND);

      dye = dye
        ? resizeDoubleFBO(
            dye,
            dyeRes.width,
            dyeRes.height,
            formatRGBA.internalFormat,
            formatRGBA.format,
            texType,
            filtering
          )
        : createDoubleFBO(
            dyeRes.width,
            dyeRes.height,
            formatRGBA.internalFormat,
            formatRGBA.format,
            texType,
            filtering
          );
      velocity = velocity
        ? resizeDoubleFBO(
            velocity,
            simRes.width,
            simRes.height,
            formatRG.internalFormat,
            formatRG.format,
            texType,
            filtering
          )
        : createDoubleFBO(
            simRes.width,
            simRes.height,
            formatRG.internalFormat,
            formatRG.format,
            texType,
            filtering
          );

      if (divergence && divergence.width === simRes.width && divergence.height === simRes.height) {
        return;
      }

      destroyFBO(divergence);
      destroyFBO(curlFBO);
      destroyDoubleFBO(pressureFBO);
      divergence = createFBO(
        simRes.width,
        simRes.height,
        formatR.internalFormat,
        formatR.format,
        texType,
        g.NEAREST
      );
      curlFBO = createFBO(
        simRes.width,
        simRes.height,
        formatR.internalFormat,
        formatR.format,
        texType,
        g.NEAREST
      );
      pressureFBO = createDoubleFBO(
        simRes.width,
        simRes.height,
        formatR.internalFormat,
        formatR.format,
        texType,
        g.NEAREST
      );
    };

    initFramebuffers();

    const MASK_UNIT = 8;
    const IMAGE_UNIT = 9;
    const maskCanvas = document.createElement("canvas");
    const imageCanvas = document.createElement("canvas");
    const maskTexture = g.createTexture();
    g.activeTexture(g.TEXTURE0 + MASK_UNIT);
    g.bindTexture(g.TEXTURE_2D, maskTexture);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);

    const imageTexture = g.createTexture();
    g.activeTexture(g.TEXTURE0 + IMAGE_UNIT);
    g.bindTexture(g.TEXTURE_2D, imageTexture);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.texImage2D(
      g.TEXTURE_2D,
      0,
      g.RGBA,
      2,
      1,
      0,
      g.RGBA,
      g.UNSIGNED_BYTE,
      new Uint8Array([96, 124, 148, 255, 116, 142, 92, 255])
    );

    const imageA = new Image();
    const imageB = new Image();
    let imagesReady = false;
    let imagesSettled = 0;
    let maskDirty = true;
    let imageDirty = true;
    let maskPainted = false;
    let readyAnnounced = false;
    let canReveal = false;
    const settleImage = () => {
      imagesSettled += 1;
      if (imagesSettled >= 2) {
        imagesReady = true;
        imageDirty = true;
      }
    };
    imageA.onload = settleImage;
    imageA.onerror = settleImage;
    imageB.onload = settleImage;
    imageB.onerror = settleImage;

    const paintImageTexture = (split: number) => {
      if (!imagesReady || !canvas.width || !canvas.height) return;
      const w = canvas.width;
      const h = canvas.height;
      imageCanvas.width = w;
      imageCanvas.height = h;
      const ctx = imageCanvas.getContext("2d");
      if (!ctx) return;
      const splitY = Math.max(1, Math.min(h - 1, Math.round(h * split)));

      const drawBand = (
        img: HTMLImageElement,
        bandY: number,
        bandH: number,
        crop: { sx: number; sy: number; sw: number; sh: number }
      ) => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        ctx.drawImage(
          img,
          crop.sx * img.naturalWidth,
          crop.sy * img.naturalHeight,
          crop.sw * img.naturalWidth,
          crop.sh * img.naturalHeight,
          0,
          bandY,
          w,
          bandH
        );
      };

      ctx.clearRect(0, 0, w, h);
      ctx.filter = "saturate(1.18) contrast(1.08)";
      drawBand(imageA, 0, splitY, IMAGE_FITS[0]);
      drawBand(imageB, splitY, h - splitY, IMAGE_FITS[1]);
      ctx.filter = "none";

      g.activeTexture(g.TEXTURE0 + IMAGE_UNIT);
      g.bindTexture(g.TEXTURE_2D, imageTexture);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, imageCanvas);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
      imageDirty = false;
    };

    const measureTitle = () => {
      const hostRect = host.getBoundingClientRect();
      if (hostRect.width < 2 || hostRect.height < 2) return null;
      const spans = Array.from(host.querySelectorAll<HTMLElement>(".review-title-line"));
      if (!spans.length) return null;
      const cs = window.getComputedStyle(host);
      const lines = spans.map((span) => {
        const range = document.createRange();
        range.selectNodeContents(span);
        const box = range.getBoundingClientRect();
        return {
          text: (span.textContent || "").trim(),
          x: box.left - hostRect.left,
          y: box.top - hostRect.top + box.height / 2,
        };
      });
      const first = lines[0];
      const last = lines[lines.length - 1];
      return {
        width: hostRect.width,
        height: hostRect.height,
        fontSize: parseFloat(cs.fontSize) || 48,
        fontFamily: cs.fontFamily || '"GuanGe Kai", serif',
        fontWeight: cs.fontWeight || "700",
        letterSpacing: cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing,
        lines,
        split: lines.length > 1 ? (first.y + last.y) / 2 / hostRect.height : 0.5,
      };
    };

    let maskKey = "";

    const paintMask = () => {
      const info = measureTitle();
      if (!info || !canvas.width || !canvas.height) return;
      const dpr = window.devicePixelRatio || 1;
      const key = [
        canvas.width,
        canvas.height,
        dpr,
        info.fontSize,
        info.fontFamily,
        info.fontWeight,
        info.letterSpacing,
        ...info.lines.map((line) => `${line.text}:${line.x.toFixed(2)}:${line.y.toFixed(2)}`),
      ].join("|");
      if (key === maskKey) return;
      maskKey = key;

      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      const ctx = maskCanvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, info.width, info.height);
      ctx.font = `${info.fontWeight} ${info.fontSize}px ${info.fontFamily}`;
      try {
        ctx.letterSpacing = info.letterSpacing;
      } catch {}
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#fff";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(0.8, info.fontSize * 0.02);
      for (const line of info.lines) {
        ctx.strokeText(line.text, line.x, line.y);
        ctx.fillText(line.text, line.x, line.y);
      }

      g.activeTexture(g.TEXTURE0 + MASK_UNIT);
      g.bindTexture(g.TEXTURE_2D, maskTexture);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, maskCanvas);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
      maskPainted = true;
      imageDirty = true;
      paintImageTexture(info.split);
    };

    imageA.src = images[0];
    imageB.src = images[1];
    if (imageA.complete && imageB.complete && imageA.naturalWidth && imageB.naturalWidth) {
      imagesReady = true;
      imagesSettled = 2;
    }

    const onFontsDone = () => {
      maskKey = "";
      maskDirty = true;
      canReveal = true;
    };
    document.fonts?.addEventListener?.("loadingdone", onFontsDone);
    document.fonts?.ready?.then(onFontsDone);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const restReveal = 0.03;

    let colorPhase = Math.random();
    const paletteAt = (phase: number): RGB => {
      const list = PALETTE;
      const t = 0.65;
      if (list.length === 1) return parseColor(list[0], t);
      const scaled = phase * list.length;
      const i = Math.floor(scaled) % list.length;
      const a = parseColor(list[i], t);
      const b = parseColor(list[(i + 1) % list.length], t);
      const f = scaled - Math.floor(scaled);
      return {
        r: a.r + (b.r - a.r) * f,
        g: a.g + (b.g - a.g) * f,
        b: a.b + (b.b - a.b) * f,
      };
    };

    const pointer = {
      texcoordX: 0,
      texcoordY: 0,
      prevTexcoordX: 0,
      prevTexcoordY: 0,
      deltaX: 0,
      deltaY: 0,
      moved: false,
      color: paletteAt(colorPhase),
      clientX: 0,
      clientY: 0,
    };

    let inside = false;

    const hostRect = () => host.getBoundingClientRect();

    const correctRadius = (radius: number) => {
      const aspectRatio = canvas.width / canvas.height;
      return aspectRatio > 1 ? radius * aspectRatio : radius;
    };

    const splat = (x: number, y: number, dx: number, dy: number, c: RGB) => {
      g.disable(g.BLEND);
      splatProgram.bind();
      g.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
      g.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
      g.uniform2f(splatProgram.uniforms.point, x, y);
      g.uniform3f(splatProgram.uniforms.color, dx, dy, 0);
      g.uniform1f(
        splatProgram.uniforms.radius,
        correctRadius(SPLAT_RADIUS / 20 / 100)
      );
      blit(velocity.write);
      velocity.swap();

      g.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
      g.uniform3f(splatProgram.uniforms.color, c.r, c.g, c.b);
      blit(dye.write);
      dye.swap();
    };

    const splatPointer = () => {
      splat(pointer.texcoordX, pointer.texcoordY, pointer.deltaX * SPLAT_FORCE * 1000, pointer.deltaY * SPLAT_FORCE * 1000, pointer.color);
    };

    const clickSplat = () => {
      const c = paletteAt(colorPhase);
      splat(pointer.texcoordX, pointer.texcoordY, 10 * (Math.random() - 0.5), 30 * (Math.random() - 0.5), {
        r: c.r * 10,
        g: c.g * 10,
        b: c.b * 10,
      });
    };

    const isInside = (clientX: number, clientY: number) => {
      const rect = hostRect();
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    };

    const texcoords = (clientX: number, clientY: number) => {
      const rect = hostRect();
      return {
        x: rect.width > 0 ? (clientX - rect.left) / rect.width : 0,
        y: rect.height > 0 ? 1 - (clientY - rect.top) / rect.height : 0,
      };
    };

    const correctDeltaX = (delta: number) => {
      const aspectRatio = canvas.width / canvas.height;
      return aspectRatio < 1 ? delta * aspectRatio : delta;
    };
    const correctDeltaY = (delta: number) => {
      const aspectRatio = canvas.width / canvas.height;
      return aspectRatio > 1 ? delta / aspectRatio : delta;
    };

    const leave = () => {
      if (!inside) return;
      inside = false;
      pointer.moved = false;
    };

    const enter = (tc: { x: number; y: number }) => {
      inside = true;
      pointer.prevTexcoordX = tc.x;
      pointer.prevTexcoordY = tc.y;
      pointer.deltaX = 0;
      pointer.deltaY = 0;
      pointer.moved = false;
      pointer.color = paletteAt(colorPhase);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isInside(e.clientX, e.clientY)) {
        leave();
        return;
      }
      const tc = texcoords(e.clientX, e.clientY);
      pointer.clientX = e.clientX;
      pointer.clientY = e.clientY;
      if (!inside) {
        enter(tc);
        pointer.texcoordX = tc.x;
        pointer.texcoordY = tc.y;
        return;
      }
      pointer.prevTexcoordX = pointer.texcoordX;
      pointer.prevTexcoordY = pointer.texcoordY;
      pointer.texcoordX = tc.x;
      pointer.texcoordY = tc.y;
      pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
      pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
      pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!isInside(e.clientX, e.clientY)) {
        leave();
        return;
      }
      const tc = texcoords(e.clientX, e.clientY);
      pointer.clientX = e.clientX;
      pointer.clientY = e.clientY;
      pointer.texcoordX = tc.x;
      pointer.texcoordY = tc.y;
      enter(tc);
      clickSplat();
    };

    const onWindowLeave = () => leave();
    const onScroll = () => {
      if (inside && !isInside(pointer.clientX, pointer.clientY)) leave();
    };

    if (!reducedMotion) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerdown", onPointerDown, { passive: true });
      document.addEventListener("pointerleave", onWindowLeave);
      window.addEventListener("blur", onWindowLeave);
      window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    }

    const applyInputs = () => {
      if (!pointer.moved) return;
      pointer.moved = false;
      if (inside) splatPointer();
    };

    const step = (dt: number) => {
      g.disable(g.BLEND);

      curlProgram.bind();
      g.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      g.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(curlFBO);

      vorticityProgram.bind();
      g.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      g.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
      g.uniform1i(vorticityProgram.uniforms.uCurl, curlFBO.attach(1));
      g.uniform1f(vorticityProgram.uniforms.curl, CURL);
      g.uniform1f(vorticityProgram.uniforms.dt, dt);
      blit(velocity.write);
      velocity.swap();

      divergenceProgram.bind();
      g.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      g.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(divergence);

      clearProgram.bind();
      g.uniform1i(clearProgram.uniforms.uTexture, pressureFBO.read.attach(0));
      g.uniform1f(clearProgram.uniforms.value, PRESSURE);
      blit(pressureFBO.write);
      pressureFBO.swap();

      pressureProgram.bind();
      g.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      g.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
      for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
        g.uniform1i(pressureProgram.uniforms.uPressure, pressureFBO.read.attach(1));
        blit(pressureFBO.write);
        pressureFBO.swap();
      }

      gradientSubtractProgram.bind();
      g.uniform2f(gradientSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      g.uniform1i(gradientSubtractProgram.uniforms.uPressure, pressureFBO.read.attach(0));
      g.uniform1i(gradientSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
      blit(velocity.write);
      velocity.swap();

      advectionProgram.bind();
      g.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      if (!supportLinearFiltering) {
        g.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
      }
      const velocityId = velocity.read.attach(0);
      g.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
      g.uniform1i(advectionProgram.uniforms.uSource, velocityId);
      g.uniform1f(advectionProgram.uniforms.dt, dt);
      g.uniform1f(advectionProgram.uniforms.dissipation, VELOCITY_DISSIPATION);
      blit(velocity.write);
      velocity.swap();

      if (!supportLinearFiltering) {
        g.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
      }
      g.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
      g.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
      g.uniform1f(advectionProgram.uniforms.dissipation, DENSITY_DISSIPATION);
      blit(dye.write);
      dye.swap();
    };

    const render = () => {
      g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
      g.enable(g.BLEND);
      displayProgram.bind();
      g.uniform2f(displayProgram.uniforms.texelSize, 1 / g.drawingBufferWidth, 1 / g.drawingBufferHeight);
      g.uniform1i(displayProgram.uniforms.uTexture, dye.read.attach(0));
      g.activeTexture(g.TEXTURE0 + MASK_UNIT);
      g.bindTexture(g.TEXTURE_2D, maskTexture);
      g.uniform1i(displayProgram.uniforms.uMask, MASK_UNIT);
      g.activeTexture(g.TEXTURE0 + IMAGE_UNIT);
      g.bindTexture(g.TEXTURE_2D, imageTexture);
      g.uniform1i(displayProgram.uniforms.uImage, IMAGE_UNIT);
      const base = parseRGBA(color);
      g.uniform4f(displayProgram.uniforms.uBase, base[0], base[1], base[2], base[3]);
      g.uniform1f(displayProgram.uniforms.uReveal, restReveal);
      blit(null, true);
    };

    let lastUpdateTime = performance.now();
    let needsResize = true;
    let raf = 0;

    const frame = () => {
      if (g.isContextLost()) {
        raf = 0;
        return;
      }
      const now = performance.now();
      const dt = Math.min((now - lastUpdateTime) / 1000, 0.016666);
      lastUpdateTime = now;

      if (needsResize) {
        needsResize = false;
        const w = Math.floor(canvas.clientWidth * (window.devicePixelRatio || 1));
        const h = Math.floor(canvas.clientHeight * (window.devicePixelRatio || 1));
        if (w < 2 || h < 2) {
          needsResize = true;
          raf = requestAnimationFrame(frame);
          return;
        }
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          initFramebuffers();
          maskDirty = true;
        }
      }

      if (maskDirty) {
        maskDirty = false;
        paintMask();
      }
      if (imageDirty && imagesReady) {
        imageDirty = false;
        paintImageTexture(measureTitle()?.split ?? 0.5);
      }

      colorPhase = (colorPhase + dt * COLOR_SPEED) % 1;
      pointer.color = paletteAt(colorPhase);

      if (!reducedMotion) applyInputs();
      step(dt);
      render();

      if (!readyAnnounced && maskPainted && canReveal) {
        readyAnnounced = true;
        host.classList.add("is-fluid-ready");
      }

      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf) return;
      lastUpdateTime = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const ro = new ResizeObserver(() => {
      needsResize = true;
    });
    ro.observe(canvas);

    let onScreen = true;
    const sync = () => {
      if (onScreen && !document.hidden) start();
      else stop();
    };
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0]?.isIntersecting ?? true;
        sync();
      },
      { threshold: 0 }
    );
    io.observe(canvas);
    const onVisibility = sync;
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerleave", onWindowLeave);
      window.removeEventListener("blur", onWindowLeave);
      window.removeEventListener("scroll", onScroll, { capture: true });
      document.fonts?.removeEventListener?.("loadingdone", onFontsDone);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      host.classList.remove("is-fluid-ready");
      destroyDoubleFBO(dye);
      destroyDoubleFBO(velocity);
      destroyDoubleFBO(pressureFBO);
      destroyFBO(divergence);
      destroyFBO(curlFBO);
      g.deleteTexture(maskTexture);
      g.deleteTexture(imageTexture);
      g.deleteBuffer(quadBuffer);
      g.deleteBuffer(quadIndices);
    };
  }, [glEpoch, hostRef, images, color]);

  return <canvas ref={canvasRef} className="review-fluid-canvas" aria-hidden="true" />;
}
