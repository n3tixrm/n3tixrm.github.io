// The hero "field": a procedural network of identities and devices rendered in
// a single fragment shader. Nodes wander inside grid cells, edges connect
// neighbours, pulses travel along the edges, and the cursor pushes the graph
// around. Two layers at different scales give depth; scroll parallaxes them.
//
// Exports start(canvas, options) -> controller { setScroll, setMotion, destroy }.

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;     // aspect-corrected, same space as p
uniform float uScroll;   // 0 at top of hero, 1 when scrolled past
uniform float uIntro;    // 0..1 reveal
uniform float uDensity;  // cells per unit height for layer 1

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float hash1(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 23421.631); }

vec2 nodePos(vec2 cell, float t, vec2 mouse, float push) {
  vec2 h = hash2(cell);
  vec2 o = 0.5 + 0.36 * sin(t * (0.25 + 0.35 * h) + 6.2831 * h + vec2(0.0, 1.9));
  vec2 p = cell + o;
  vec2 d = p - mouse;
  float r = length(d);
  p += (d / max(r, 0.001)) * push * smoothstep(2.2, 0.0, r) * 0.9;
  return p;
}

float segment(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a, ba = b - a;
  h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Returns (edges, pulses, nodes) intensities for one layer.
vec3 layer(vec2 p, float scale, float t, vec2 mouse, float push, float seed, float px) {
  vec2 q = p * scale + seed;
  vec2 mq = mouse * scale + seed;
  vec2 cell = floor(q);
  vec2 pts[9];
  for (int j = 0; j < 3; j++) {
    for (int i = 0; i < 3; i++) {
      pts[j * 3 + i] = nodePos(cell + vec2(float(i) - 1.0, float(j) - 1.0), t, mq, push);
    }
  }
  float edges = 0.0, pulses = 0.0, nodes = 0.0;
  float wLine = px * scale * 1.1;
  for (int i = 0; i < 9; i++) {
    vec2 a = pts[i];
    float d = length(q - a);
    nodes += smoothstep(px * scale * 3.2, 0.0, d);
    nodes += 0.006 / (d * d + 0.012);
    for (int j = 0; j < 9; j++) {
      if (j <= i) continue;
      vec2 b = pts[j];
      float len = length(b - a);
      if (len > 1.35) continue;
      float h;
      float sd = segment(q, a, b, h);
      float fade = 1.0 - smoothstep(0.55, 1.35, len);
      float a0 = smoothstep(wLine, 0.0, sd) * fade;
      edges += a0;
      float ph = fract(h - t * (0.18 + 0.12 * hash1(a + b)) + hash1(a * 1.7 + b));
      pulses += smoothstep(wLine * 2.2, 0.0, sd) * fade * smoothstep(0.09, 0.0, abs(ph - 0.5)) * 1.6;
    }
  }
  return vec3(edges, pulses, nodes);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float px = 1.0 / uRes.y;

  // Scroll parallax: layers drift at different speeds as the hero leaves.
  float t = uTime;
  vec2 m = uMouse;
  vec3 back = layer(p + vec2(0.0, uScroll * 0.35), uDensity * 1.9, t * 0.6, m, 0.25, 17.0, px);
  vec3 front = layer(p + vec2(0.0, uScroll * 0.8), uDensity, t, m, 0.6, 3.0, px);

  vec3 lime = vec3(0.776, 1.0, 0.29);
  vec3 blue = vec3(0.435, 0.66, 1.0);
  vec3 lineCol = vec3(0.55, 0.62, 0.78);

  vec3 col = vec3(0.0);
  col += lineCol * 0.10 * clamp(back.x, 0.0, 1.0);
  col += blue * 0.35 * back.y;
  col += mix(lineCol, blue, 0.5) * 0.35 * back.z;

  col += lineCol * 0.26 * clamp(front.x, 0.0, 1.0);
  col += lime * 0.95 * front.y;
  col += mix(vec3(1.0), lime, 0.55) * 0.75 * front.z;

  // Cursor halo.
  float md = length(p - m);
  col += lime * 0.10 * smoothstep(0.45, 0.0, md);
  col += vec3(1.0) * 0.08 * smoothstep(0.06, 0.0, abs(md - 0.18 - 0.02 * sin(t * 2.0))) * smoothstep(0.5, 0.0, md);

  // Horizontal scan band that drifts down slowly.
  float scan = fract(uv.y * 1.0 + t * 0.03);
  col += lineCol * 0.03 * smoothstep(0.0, 0.02, scan) * smoothstep(0.05, 0.02, scan);

  // Vignette and intro reveal (wipe from the centre outwards).
  float vig = smoothstep(1.25, 0.25, length(p * vec2(0.8, 1.15)));
  col *= vig;
  float reveal = smoothstep(uIntro * 1.6 + 0.001, uIntro * 1.6 - 0.35, length(p));
  col *= reveal;
  col *= 1.0 - uScroll * 0.85;

  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return sh;
}

export function start(canvas, { motion = true } = {}) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: false })
    || canvas.getContext("experimental-webgl");
  if (!gl) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = {};
  for (const name of ["uRes", "uTime", "uMouse", "uScroll", "uIntro", "uDensity"]) u[name] = gl.getUniformLocation(prog, name);

  const state = {
    motion,
    scroll: 0,
    intro: motion ? 0 : 1,
    introStart: performance.now(),
    mouse: { x: 9, y: 9 },      // off-screen until the pointer arrives
    target: { x: 9, y: 9 },
    visible: true,
    raf: 0,
    last: performance.now(),
    time: 0,
    dirty: true,
    w: 0, h: 0, dpr: 1,
    quality: 1,        // resolution scale, lowered on slow devices
    frames: 0,
    avgDt: 1 / 60,
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const narrow = rect.width < 720;
    state.dpr = Math.min(window.devicePixelRatio || 1, narrow ? 1.25 : 1.5) * state.quality;
    const w = Math.max(1, Math.round(rect.width * state.dpr));
    const h = Math.max(1, Math.round(rect.height * state.dpr));
    if (w !== state.w || h !== state.h) {
      state.w = w; state.h = h;
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.uRes, w, h);
      gl.uniform1f(u.uDensity, narrow ? 4.2 : 5.6);
      state.dirty = true;
    }
  }

  function draw(now) {
    state.raf = 0;
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    if (state.motion) {
      // Adaptive quality: if frames are consistently slow, render at a lower
      // resolution; if still slow, settle on a static frame.
      state.avgDt += (dt - state.avgDt) * 0.1;
      if (++state.frames % 45 === 0 && state.avgDt > 1 / 30) {
        if (state.quality > 0.5) { state.quality = Math.max(0.5, state.quality - 0.25); state.w = 0; resize(); }
        else { state.motion = false; state.intro = 1; }
      }
      state.time += dt;
      state.mouse.x += (state.target.x - state.mouse.x) * Math.min(1, dt * 6);
      state.mouse.y += (state.target.y - state.mouse.y) * Math.min(1, dt * 6);
      if (state.intro < 1) state.intro = Math.min(1, (now - state.introStart) / 2200);
    }
    gl.uniform1f(u.uTime, state.time);
    gl.uniform2f(u.uMouse, state.mouse.x, state.mouse.y);
    gl.uniform1f(u.uScroll, state.scroll);
    gl.uniform1f(u.uIntro, state.intro);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    state.dirty = false;
    schedule();
  }

  function schedule() {
    if (state.raf || !state.visible || document.hidden) return;
    if (!state.motion && !state.dirty) return;
    if (state.scroll >= 1) return; // fully scrolled past: nothing visible, stop drawing
    state.raf = requestAnimationFrame(draw);
  }

  function onPointer(e) {
    const rect = canvas.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    state.target.x = ((e.clientX - rect.left) / rect.width - 0.5) * aspect;
    state.target.y = 0.5 - (e.clientY - rect.top) / rect.height;
    if (!state.motion) { state.mouse.x = state.target.x; state.mouse.y = state.target.y; state.dirty = true; schedule(); }
  }
  function onLeave() { state.target.x = 9; state.target.y = 9; }

  const io = new IntersectionObserver(([entry]) => {
    state.visible = entry.isIntersecting;
    if (state.visible) { state.last = performance.now(); schedule(); }
  });
  io.observe(canvas);
  const ro = new ResizeObserver(() => { resize(); schedule(); });
  ro.observe(canvas);
  const onVis = () => { if (!document.hidden) { state.last = performance.now(); schedule(); } };
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointerleave", onLeave);
  window.addEventListener("blur", onLeave);

  resize();
  schedule();

  return {
    setScroll(v) {
      const next = Math.min(1, Math.max(0, v));
      if (next !== state.scroll) { state.scroll = next; state.dirty = true; schedule(); }
    },
    setMotion(on) {
      state.motion = on;
      if (!on) state.intro = 1;
      state.last = performance.now();
      state.dirty = true;
      schedule();
    },
    destroy() {
      cancelAnimationFrame(state.raf);
      io.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
