// Two explanatory scenes for the landing page.
// 1. simScene: a terrain that only resolves where you point (three.js, WebGL).
// 2. fwScene:  Schurger-style leaky accumulators; back-averaging makes a "readiness potential".
import * as THREE from 'three';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const INK = '#1C2338', INK_SOFT = '#545C70', RULE = '#C6CAC1', WOUNDED = '#A8650F';

function whenVisible(el, onChange) {
  new IntersectionObserver(([e]) => onChange(e.isIntersecting), { rootMargin: '100px' }).observe(el);
}

/* ---------- 1a. Block world: rises on load, resolves into a surveyed surface where you look ---------- */
const PAPER = '#EDEFEA', OCHRE = '#A8650F';
export function simScene(canvas, hoverEl) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch { canvas.hidden = true; return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  const LOOK_AT = new THREE.Vector3(0.6, -1, -3);
  const STEP = 1.25, GX = 56, GZ = 40;
  const u = {
    uTime: { value: 0 }, uIntro: { value: reduced ? 1 : 0 },
    uLook: { value: new THREE.Vector2(4, -3) }, uRadius: { value: 7.0 }, uStep: { value: STEP },
    uInk: { value: new THREE.Color(INK) }, uPaper: { value: new THREE.Color(PAPER) },
    uTop: { value: new THREE.Color('#F8F9F6') }, uOchre: { value: new THREE.Color(OCHRE) },
    uFogNear: { value: 22 }, uFogFar: { value: 52 },
  };
  const COMMON = /* glsl */`
    uniform float uTime, uRadius, uStep, uIntro;
    uniform vec2 uLook;
    float h(vec2 p) {
      return sin(p.x * 0.2 + uTime * 0.12) * cos(p.y * 0.19) * 1.9
           + sin(p.x * 0.5 + p.y * 0.37 - uTime * 0.08) * 0.6
           + cos(p.y * 0.8 + p.x * 0.3) * 0.2;
    }
    float observed(vec2 p) { return smoothstep(uRadius, uRadius - 3.0, distance(p, uLook)); }
    float rise(vec2 p) {                       // load-in wave from the centre outwards
      float delay = length(p) / 40.0;
      float t = clamp((uIntro * 1.7 - delay) / 0.45, 0.0, 1.0);
      return t * t * (3.0 - 2.0 * t);
    }
  `;
  const FOG = /* glsl */`uniform vec3 uPaper; uniform float uFogNear, uFogFar;
    vec3 fog(vec3 c, float d) { return mix(c, uPaper, smoothstep(uFogNear, uFogFar, d)); }`;

  // Coarse blocks
  const inst = new THREE.InstancedBufferGeometry().copy(new THREE.BoxGeometry(1, 1, 1));
  inst.instanceCount = GX * GZ;
  const cells = new Float32Array(GX * GZ * 2);
  for (let i = 0, z = 0; z < GZ; z++) for (let x = 0; x < GX; x++) {
    cells[i++] = (x - (GX - 1) / 2) * STEP; cells[i++] = (z - (GZ - 1) / 2) * STEP;
  }
  inst.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
  const blocks = new THREE.Mesh(inst, new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: COMMON + /* glsl */`
      attribute vec2 aCell;
      varying vec3 vN; varying float vDepth, vUp;
      void main() {
        float hq = floor(h(aCell) / 0.5 + 0.5) * 0.5;
        float sink = observed(aCell);
        float top = mix(-4.0, hq, rise(aCell));
        top = mix(top, -4.0, floor(smoothstep(0.0, 0.5, sink) * 4.0 + 0.5) / 4.0);   // sink in terraced steps
        vec3 p = vec3(aCell.x + position.x * uStep * 0.985, mix(-4.0, top, position.y + 0.5), aCell.y + position.z * uStep * 0.985);
        vN = normal; vUp = position.y + 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: FOG + /* glsl */`
      uniform vec3 uInk, uTop;
      varying vec3 vN; varying float vDepth, vUp;
      void main() {
        float l = dot(normalize(vN), normalize(vec3(-0.45, 1.0, 0.55)));
        vec3 side = mix(uInk, uPaper, 0.35 + 0.45 * clamp(l + 0.3, 0.0, 1.0));
        side = mix(side * 0.84, side, vUp);
        vec3 col = vN.y > 0.5 ? uTop : side;
        gl_FragColor = vec4(fog(col, vDepth), 1.0);
      }`,
  }));
  blocks.frustumCulled = false;
  scene.add(blocks);

  // Smooth surveyed surface, shown only where observed
  const plane = new THREE.PlaneGeometry(GX * STEP, GZ * STEP, 280, 200);
  plane.rotateX(-Math.PI / 2);
  const surface = new THREE.Mesh(plane, new THREE.ShaderMaterial({
    uniforms: u, extensions: { derivatives: true },
    vertexShader: COMMON + /* glsl */`
      varying float vObs, vH, vDepth; varying vec3 vN;
      void main() {
        vec2 xz = position.xz;
        float y = h(xz), e = 0.08;
        vN = normalize(vec3(h(xz - vec2(e, 0.0)) - h(xz + vec2(e, 0.0)), 2.0 * e, h(xz - vec2(0.0, e)) - h(xz + vec2(0.0, e))));
        vObs = observed(xz); vH = y;
        vec4 mv = modelViewMatrix * vec4(xz.x, y, xz.y, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: FOG + /* glsl */`
      uniform vec3 uInk, uTop, uOchre;
      varying float vObs, vH, vDepth; varying vec3 vN;
      void main() {
        if (vObs < 0.5) discard;
        float l = clamp(dot(normalize(vN), normalize(vec3(-0.45, 1.0, 0.55))), 0.0, 1.0);
        vec3 col = mix(uPaper * 0.86, uTop, l);
        float k = vH * 3.5;                                   // contour lines every ~0.29 units
        float line = 1.0 - min(abs(fract(k - 0.5) - 0.5) / fwidth(k), 1.0);
        col = mix(col, uInk, line * 0.45);
        float rim = 1.0 - smoothstep(0.5, 0.56, vObs);       // a thin survey line at the edge
        col = mix(col, uOchre, rim);
        gl_FragColor = vec4(fog(col, vDepth), 1.0);
      }`,
  }));
  surface.frustumCulled = false;
  scene.add(surface);

  // Pointer → ground
  const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const target = new THREE.Vector2(4, -3), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  let lastPointer = -1e9;
  (hoverEl || canvas).addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(ground, hit)) { target.set(hit.x, hit.z); lastPointer = performance.now(); }
  });

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const narrow = width < 700;
    camera.position.set(0.6, narrow ? 22 : 15, narrow ? 30 : 23);
    camera.lookAt(LOOK_AT);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas); resize();

  let running = false; const t0 = performance.now();
  function frame(now) {
    if (!running) return;
    const t = (now - t0) / 1000;
    u.uTime.value = t;
    u.uIntro.value = Math.min(1, t / 2.6);
    if (now - lastPointer > 2500) target.set(Math.sin(t * 0.19) * 12 + 4, Math.sin(t * 0.31) * 5 - 3);
    u.uLook.value.lerp(target, 0.06);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  if (reduced) { renderer.render(scene, camera); return; }
  whenVisible(canvas, v => { if (v && !running) { running = true; requestAnimationFrame(frame); } else if (!v) running = false; });
}

/* ---------- 2. Noise that looks like a decision ---------- */
// Leaky stochastic accumulator (Schurger, Sitt & Dehaene 2012): dx = (I - k x) dt + c dW
export function fwScene(canvas, countEl) {
  const ctx = canvas.getContext('2d');
  const I = 0.1, k = 0.5, c = 0.1, TH = 0.3, DT = 0.001;
  const SAMPLE = 10;           // keep every 10 ms
  const LIVE_S = 6, PRE_S = 2; // seconds shown live / averaged before crossing
  const PRE_N = PRE_S * 1000 / SAMPLE;
  const N = 22;
  const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  const fresh = () => ({ x: Math.min(0.2 + 0.1 * gauss(), 0.27), pts: [], step: 0 });
  const traces = Array.from({ length: N }, fresh);
  traces.forEach(tr => { tr.pts.push(tr.x); });
  const epochs = [], flashes = [];

  function advance(ms) {
    for (const tr of traces) {
      for (let s = 0; s < ms; s++) {
        tr.x += (I - k * tr.x) * DT + c * Math.sqrt(DT) * gauss();
        tr.step++;
        if (tr.step % SAMPLE === 0) tr.pts.push(tr.x);
        if (tr.x >= TH) {
          if (tr.pts.length >= PRE_N) {
            epochs.push(tr.pts.slice(-PRE_N));
            if (epochs.length > 400) epochs.shift();
            flashes.push({ t: tr.pts.length * SAMPLE / 1000, life: 1 });
          }
          Object.assign(tr, fresh()); tr.pts = [tr.x]; break;
        }
        if (tr.pts.length * SAMPLE / 1000 > LIVE_S) { Object.assign(tr, fresh()); tr.pts = [tr.x]; break; }
      }
    }
  }

  let W = 0, H = 0, dpr = 1;
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio, 2); W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduced) draw();
  }
  new ResizeObserver(resize).observe(canvas);

  const Y0 = -0.12, Y1 = 0.36;
  function panel(x, y, w, h, title, sub) {
    ctx.fillStyle = INK; ctx.font = '600 15px Archivo, sans-serif'; ctx.fillText(title, x, y - 30);
    ctx.fillStyle = INK_SOFT; ctx.font = '400 13px Archivo, sans-serif'; ctx.fillText(sub, x, y - 12);
    const ty = y + h * (1 - (TH - Y0) / (Y1 - Y0));
    ctx.strokeStyle = WOUNDED; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(x, ty); ctx.lineTo(x + w, ty); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = RULE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke();
    return v => y + h * (1 - (v - Y0) / (Y1 - Y0));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const stack = W < 640, gap = 40, top = 52;
    const lw = stack ? W : W * 0.58, lh = stack ? (H - top * 2 - gap) / 2 : H - top - 34;
    const rx = stack ? 0 : lw + gap, ry = stack ? top + lh + gap + top : top;
    const rw = stack ? W : W - lw - gap, rh = lh;

    // Live panel
    const ly = panel(0, top, lw, lh, 'Pure noise, drifting', 'Each line crosses the dashed threshold by chance');
    const lx = t => (t / LIVE_S) * lw;
    ctx.lineWidth = 1.1;
    for (const tr of traces) {
      ctx.strokeStyle = 'rgba(28,35,56,0.28)'; ctx.beginPath();
      tr.pts.forEach((v, i) => { const px = lx(i * SAMPLE / 1000), py = ly(v); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.stroke();
    }
    for (const f of flashes) {
      ctx.fillStyle = `rgba(168,101,15,${f.life})`;
      ctx.beginPath(); ctx.arc(lx(f.t), ly(TH), 3 + 5 * (1 - f.life), 0, Math.PI * 2); ctx.fill();
    }

    // Back-averaged panel
    const ay = panel(rx, ry, rw, rh, 'Averaged backwards from each crossing', 'The last 2 seconds before the line was crossed');
    const ax = i => rx + (i / (PRE_N - 1)) * rw;
    ctx.strokeStyle = 'rgba(28,35,56,0.06)'; ctx.lineWidth = 1;
    for (const e of epochs.slice(-60)) {
      ctx.beginPath(); e.forEach((v, i) => i ? ctx.lineTo(ax(i), ay(v)) : ctx.moveTo(ax(i), ay(v))); ctx.stroke();
    }
    if (epochs.length) {
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i < PRE_N; i++) {
        let s = 0; for (const e of epochs) s += e[i];
        const v = s / epochs.length; i ? ctx.lineTo(ax(i), ay(v)) : ctx.moveTo(ax(i), ay(v));
      }
      ctx.stroke();
    }
    ctx.fillStyle = INK_SOFT; ctx.font = '400 12px Archivo, sans-serif';
    ctx.fillText('−2 s', rx, ry + rh + 16);
    ctx.textAlign = 'right'; ctx.fillText('crossing', rx + rw, ry + rh + 16); ctx.textAlign = 'left';
    if (countEl) countEl.textContent = epochs.length;
  }

  if (reduced) { for (let i = 0; i < 120; i++) advance(1000); flashes.length = 0; resize(); return; }

  for (let i = 0; i < 90; i++) advance(1000); // pre-run so the average starts smooth
  flashes.length = 0;
  let running = false, last = 0;
  function frame(now) {
    if (!running) return;
    const ms = Math.min(50, now - (last || now)); last = now;
    advance(Math.round(ms));
    flashes.forEach(f => f.life -= ms / 900);
    while (flashes.length && flashes[0].life <= 0) flashes.shift();
    draw();
    requestAnimationFrame(frame);
  }
  whenVisible(canvas, v => { if (v && !running) { running = true; last = 0; requestAnimationFrame(frame); } else if (!v) running = false; });
}
