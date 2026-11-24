import * as THREE from 'three';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = v => v.charAt(0) + v.slice(1).toLowerCase();

/* ---------- Act 1: a planet that comes apart as you scroll ---------- */
function world() {
  const canvas = document.getElementById('world');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch { canvas.hidden = true; return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);

  // Fibonacci sphere
  const N = 70000, pos = new Float32Array(N * 3), rnd = new Float32Array(N);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i;
    pos.set([Math.cos(th) * r, y, Math.sin(th) * r], i * 3); rnd[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));

  const u = {
    uP: { value: 0 }, uTime: { value: 0 }, uDpr: { value: renderer.getPixelRatio() },
    uScale: { value: 1 }, uOffset: { value: new THREE.Vector2(0, 0) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    vertexShader: /* glsl */`
      uniform float uP, uTime, uDpr, uScale;
      uniform vec2 uOffset;
      attribute float aRnd;
      varying float vA; varying float vSquare;
      const float PI = 3.14159265;
      float landF(vec3 p) {
        return sin(p.x * 2.6 + sin(p.y * 3.1)) * cos(p.z * 2.8 + sin(p.x * 2.2))
             + 0.55 * sin(p.y * 5.3 + p.z * 4.1) * cos(p.x * 4.7)
             + 0.25 * sin(p.x * 9.0 + p.z * 7.3) * cos(p.y * 8.1);
      }
      void main() {
        vec3 p = normalize(position);
        float land = smoothstep(0.18, 0.3, landF(p));
        float lat = asin(clamp(p.y, -1.0, 1.0));
        float lon = atan(p.z, p.x) + uTime * 0.12;
        float r = 1.0 + land * 0.025;
        vec3 sphere = r * vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
        float wl = mod(lon + PI, 2.0 * PI) - PI;
        vec3 flat_ = vec3(wl / PI * 2.0, lat / (PI * 0.5) * 1.0, 0.0);

        float pixel = smoothstep(0.18, 0.5, uP);          // stage 2: quantise
        float unfold = smoothstep(0.62, 0.88, uP);        // stage 4: flatten to a table
        float s = mix(0.0001, 0.085, pixel);
        vec3 q = mix(sphere, floor(sphere / s + 0.5) * s, pixel);
        vec3 fq = floor(flat_ / 0.07 + 0.5) * 0.07;
        vec3 world = mix(q, fq, unfold);

        // ocean is sparse; land is dense
        float keep = mix(step(aRnd, 0.18), 1.0, land);
        vA = keep * mix(0.35, 0.95, land) * mix(1.0, mix(0.12, 1.0, land), unfold);
        vSquare = pixel;
        vec2 off = mix(uOffset, vec2(uOffset.x * 0.35, 0.42), unfold);
        vec4 mv = modelViewMatrix * vec4(world * uScale * mix(1.0, 0.82, unfold) + vec3(off, 0.0), 1.0);
        gl_Position = projectionMatrix * mv;
        float base = mix(1.7, 7.0, pixel * (1.0 - unfold * 0.55));
        gl_PointSize = keep * base * uDpr * (3.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */`
      varying float vA; varying float vSquare;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        if (vSquare < 0.5 && length(c) > 0.5) discard;
        if (vA < 0.01) discard;
        // square "voxels" get a faint outline so they read as blocks
        float edge = max(abs(c.x), abs(c.y));
        float a = vA * mix(1.0, (edge > 0.38 ? 1.0 : 0.55), vSquare);
        gl_FragColor = vec4(0.918, 0.941, 1.0, a);
      }`,
  });
  scene.add(new THREE.Points(geo, mat));

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.set(0, 0, 3.6);
    const wide = width > 860;
    u.uScale.value = wide ? 1.0 : 0.8;
    u.uOffset.value.set(wide ? 0.85 : 0, wide ? 0.05 : 0.45);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas); resize();

  // Scroll progress → stage
  const story = document.getElementById('story');
  const steps = [...document.querySelectorAll('.step')];
  const bars = [...document.querySelectorAll('.progress span')];
  let target = 0;
  function onScroll() {
    const r = story.getBoundingClientRect();
    target = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
    const idx = Math.min(steps.length - 1, Math.floor(target * steps.length * 0.999));
    steps.forEach((s, i) => s.classList.toggle('on', i === idx));
    bars.forEach((b, i) => b.classList.toggle('on', i <= idx));
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  let running = true, t0 = performance.now();
  new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running) requestAnimationFrame(frame); }).observe(canvas);
  function frame(now) {
    if (!running) return;
    u.uP.value += (target - u.uP.value) * (reduced ? 1 : 0.08);
    if (!reduced) u.uTime.value = (now - t0) / 1000;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------- Act 2: the prediction game (Aaronson-style oracle) ---------- */
function oracle() {
  const ORDER = 5, table = new Map(), seq = [];
  let guess = null, hits = 0, total = 0;
  const said = document.getElementById('said'), score = document.getElementById('score'),
        sub = document.getElementById('score-sub'), bar = document.getElementById('bar'),
        hist = document.getElementById('history');

  function predict() {
    for (let n = Math.min(ORDER, seq.length); n >= 1; n--) {
      const c = table.get(seq.slice(-n).join(''));
      if (c && c.L !== c.R) return c.L > c.R ? 'L' : 'R';
    }
    return Math.random() < 0.5 ? 'L' : 'R';
  }
  function learn(k) {
    for (let n = 1; n <= Math.min(ORDER, seq.length); n++) {
      const key = seq.slice(-n).join('');
      const c = table.get(key) || { L: 0, R: 0 };
      c[k]++; table.set(key, c);
    }
    seq.push(k);
  }
  function press(k) {
    const hit = guess === k; total++; if (hit) hits++;
    const name = x => (x === 'L' ? 'left' : 'right');
    said.innerHTML = hit
      ? `<span class="hit">Guessed it.</span> We wrote down ${name(guess)} before you pressed.`
      : `Missed. We wrote down ${name(guess)}, you pressed ${name(k)}.`;
    const pct = Math.round((hits / total) * 100);
    score.textContent = pct + '%';
    sub.textContent = `of ${total} guesses correct. Pure chance would be 50%.` + (total < 20 ? ' Keep going: it needs about 20 presses to learn you.' : '');
    bar.style.width = pct + '%';
    const sq = document.createElement('span'); if (hit) sq.className = 'hit'; hist.append(sq);
    if (hist.children.length > 60) hist.firstChild.remove();
    learn(k);
    guess = predict(); // locked before the next press
  }
  guess = predict();
  document.querySelectorAll('.choices button').forEach(b => b.addEventListener('click', () => press(b.dataset.k)));
  addEventListener('keydown', e => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'f' || e.key === 'F') press('L');
    if (e.key === 'j' || e.key === 'J') press('R');
  });
}

/* ---------- Act 3: ledger ---------- */
async function ledger() {
  const { days } = await (await fetch('ledger.json')).json();
  const url = d => `entry.html?day=${encodeURIComponent(d.date)}`;
  for (const t of ['SIM', 'FW']) {
    const mine = days.filter(d => d.track === t);
    document.getElementById('cells-' + t).innerHTML = mine.map(d =>
      `<li><a href="${url(d)}" data-v="${d.verdict}" aria-label="Day ${d.day}: ${esc(d.title)}, ${label(d.verdict)}" title="Day ${d.day}: ${esc(d.title)}"></a></li>`).join('');
    const n = v => mine.filter(d => d.verdict === v).length;
    document.getElementById('sum-' + t).textContent = mine.length
      ? `${mine.length} tested: ${n('SURVIVES')} survive, ${n('WOUNDED')} wounded, ${n('DEAD')} dead, ${n('UNFALSIFIABLE')} unfalsifiable.`
      : 'No claims tested yet. First up: Bostrom’s simulation argument.';
  }
  const simN = days.filter(d => d.track === 'SIM').length;
  document.getElementById('sim-count').textContent = simN ? `${simN} simulation claims tested so far` : 'Simulation track starts soon';

  const last = days[days.length - 1];
  if (last) document.getElementById('latest').innerHTML = `
    <p class="meta">Latest verdict. Day ${last.day}, ${last.track === 'FW' ? 'free will' : 'simulation'} track. ${esc(last.source)}</p>
    <h3>${esc(last.title)}</h3>
    <span class="stamp" data-v="${last.verdict}">${label(last.verdict)}</span>
    <p class="sum">${esc(last.summary)}</p>
    <a href="${url(last)}">Read the full entry and sources</a>`;

  const md = await (await fetch('BACKLOG.md')).text();
  document.getElementById('next').innerHTML = md.split('\n').filter(l => /\|\s*QUEUED\s*\|\s*$/.test(l)).slice(0, 5)
    .map(l => l.split('|').map(s => s.trim())).map(c => `<li><span class="id">${esc(c[1])}</span><span>${esc(c[2])}</span></li>`).join('');
}

world(); oracle(); ledger().catch(console.error);
