// Nirvāṇa as an exit condition: interactive figures.
// One model everywhere: craving level k in 0..3+L. k = 0 is nirvāṇa (not run again),
// 1..3 are the noble stages (never rise), 4..3+L are levels of ordinary craving.

const C = { ink: '#1C2338', soft: '#545C70', rule: '#C6CAC1', ochre: '#A8650F', green: '#1F6B4F', paper: '#EDEFEA', deep: '#E1E4DD' };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

// One life ends: the craving level moves.
function step(k, p, rnd) {
  if (k === 0) return 0;
  const u = rnd();
  if (k > 3) {
    if (u < p.a) return k - 1;
    if (u < p.a + p.b && k < 3 + p.L) return k + 1;
    return k;
  }
  return u < p.a2 ? k - 1 : k;
}

// Proposition 2: expected lives from the top ordinary level.
export function expectedLives(p) {
  if (p.a <= 0 || p.a2 <= 0) return Infinity;
  const rho = p.b / p.a;
  let T = 1 / p.a, sum = T;
  for (let j = p.L - 1; j >= 1; j--) { T = 1 / p.a + rho * T; sum += T; }
  return sum + 3 / p.a2;
}

// Proposition 3: P(three successes within n lives), each with probability a2.
function pWithin(n, a2, need = 3) {
  let s = 0;
  const comb = (n, k) => { let c = 1; for (let i = 1; i <= k; i++) c = c * (n - k + i) / i; return c; };
  for (let k = need; k <= n; k++) s += comb(n, k) * a2 ** k * (1 - a2) ** (n - k);
  return s;
}

function fitCanvas(cv) {
  const dpr = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function stateColour(k, L) {
  if (k === 0) return null;
  if (k <= 3) return C.green;
  return C.ochre;
}
function stateAlpha(k, L) {
  if (k <= 3) return 0.55 + (3 - k) * 0.15;
  return 0.35 + 0.65 * (k - 3) / L;
}
const fmt = v => !isFinite(v) ? 'never' : v >= 100 ? Math.round(v).toLocaleString('en-GB') : v.toFixed(1);

/* ---------- Hero: embers that go out ---------- */
function embers(cv) {
  const p = { a: 0.22, b: 0.18, a2: 0.8, L: 5 };
  let rnd = mulberry32(7), grid = [], cols = 0, rows = 0, done = 0, last = 0;
  function seed() {
    const { w, h } = fitCanvas(cv);
    cols = Math.floor(w / 20); rows = Math.floor(h / 20);
    grid = Array.from({ length: cols * rows }, () => ({ k: 3 + p.L - Math.floor(rnd() * 2), glow: rnd() }));
    done = 0;
  }
  function draw() {
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const ox = (w - cols * 20) / 2 + 10, oy = (h - rows * 20) / 2 + 10;
    grid.forEach((e, i) => {
      const x = ox + (i % cols) * 20, y = oy + Math.floor(i / cols) * 20;
      if (e.k === 0) { ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.stroke(); return; }
      const r = 1.6 + (e.k / (3 + p.L)) * 4.2;
      ctx.globalAlpha = stateAlpha(e.k, p.L) * (0.75 + 0.25 * Math.sin(e.glow));
      ctx.fillStyle = stateColour(e.k, p.L);
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    });
  }
  function tick(t) {
    if (t - last > 380) {
      last = t;
      let out = 0;
      grid.forEach(e => { if (rnd() < 0.35) e.k = step(e.k, p, rnd); if (!e.k) out++; });
      if (out > grid.length * 0.97) { if (!done) done = t; else if (t - done > 2500) seed(); }
    }
    grid.forEach(e => { e.glow += 0.05; });
    draw();
    requestAnimationFrame(tick);
  }
  seed();
  if (reduced) { for (let i = 0; i < 25; i++) grid.forEach(e => { e.k = step(e.k, p, rnd); }); draw(); addEventListener('resize', () => { draw(); }); return; }
  addEventListener('resize', seed);
  requestAnimationFrame(tick);
}

/* ---------- Figure 1: the chain, many agents ---------- */
function chain(root, onParams) {
  const cv = root.querySelector('canvas'), q = s => root.querySelector(s);
  const inputs = ['a', 'b', 'a2', 'L', 'speed'].reduce((o, k) => (o[k] = q(`[name=${k}]`), o), {});
  const N = 300;
  let p, agents, life, exits, running = !reduced, acc = 0, prev = 0, rnd;
  const params = () => ({ a: +inputs.a.value, b: +inputs.b.value, a2: +inputs.a2.value, L: +inputs.L.value });
  function reset() {
    p = params(); rnd = mulberry32(2026);
    agents = Array.from({ length: N }, (_, i) => ({ id: i, k: 3 + p.L, lives: 1, x: null, y: null, tx: 0, ty: 0 }));
    life = 1; exits = [];
    ['a', 'b', 'a2', 'L'].forEach(k => { q(`output[for=${k}]`).textContent = k === 'L' ? p.L : (+inputs[k].value).toFixed(2); });
    layout(); onParams(p); readout();
  }
  function cols() { return 4 + p.L; }
  function colX(k, w) { const n = cols(), pad = 8, cw = (w - pad * 2) / n; return { x: pad + (3 + p.L - k) * cw, cw }; }
  function layout() {
    const { w, h } = fitCanvas(cv);
    const base = h - 58, cw0 = (w - 16) / cols() - 10, s = Math.max(2.5, Math.min(9, Math.sqrt(cw0 * (base - 40) / N) * 0.95));
    const byK = new Map();
    agents.forEach(a => { if (!byK.has(a.k)) byK.set(a.k, []); byK.get(a.k).push(a); });
    byK.forEach((list, k) => {
      const { x, cw } = colX(k, w), per = Math.max(1, Math.floor((cw - 10) / s));
      list.sort((m, n) => m.id - n.id).forEach((a, i) => {
        a.tx = x + 5 + s / 2 + (i % per) * s + ((cw - 10) - per * s) / 2;
        a.ty = base - s / 2 - Math.floor(i / per) * s;
        if (a.x === null) { a.x = a.tx; a.y = a.ty; }
      });
    });
    return { s };
  }
  function tick() {
    if (agents.every(a => a.k === 0)) { running = false; q('[data-act=run]').textContent = 'Run'; return; }
    life++;
    agents.forEach(a => {
      if (!a.k) return;
      a.k = step(a.k, p, rnd);
      if (a.k) a.lives++; else exits.push(a.lives);
    });
    layout(); readout();
  }
  function readout() {
    const active = agents.filter(a => a.k).length, mean = exits.length ? exits.reduce((s, v) => s + v, 0) / exits.length : NaN;
    const E = expectedLives(p);
    q('[data-r=life]').textContent = life.toLocaleString('en-GB');
    q('[data-r=active]').textContent = active;
    q('[data-r=exited]').textContent = N - active;
    q('[data-r=mean]').textContent = exits.length ? mean.toFixed(1) + (active ? ' so far' : '') : '–';
    q('[data-r=E]').textContent = fmt(E);
    q('[data-r=rho]').textContent = p.a ? (p.b / p.a).toFixed(2) : '∞';
    q('[data-r=mean]').classList.toggle('hi', !active && Math.abs(mean - E) / E < 0.15);
  }
  function draw() {
    const { ctx, w, h } = fitCanvas(cv), { s } = layout();
    ctx.clearRect(0, 0, w, h);
    const base = h - 58;
    // columns
    for (let k = 3 + p.L; k >= 0; k--) {
      const { x, cw } = colX(k, w);
      ctx.fillStyle = k === 0 ? C.deep : (k <= 3 ? 'rgba(31,107,79,0.06)' : 'rgba(168,101,15,0.05)');
      ctx.fillRect(x + 2, 14, cw - 4, base - 14);
      const n = agents.filter(a => a.k === k).length;
      ctx.fillStyle = C.ink; ctx.font = '600 11px Archivo, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(n ? n : '', x + cw / 2, 28);
      ctx.fillStyle = C.soft; ctx.font = '500 11px Archivo, sans-serif';
      const lab = k === 0 ? 'nirvāṇa' : k === 3 ? 'stream' : k === 2 ? 'once' : k === 1 ? 'non-ret.' : String(k - 3);
      ctx.fillText(cw < 44 && k > 0 && k <= 3 ? ['', 'NR', 'OR', 'SE'][k] : lab, x + cw / 2, base + 16);
    }
    // group brackets
    const g = (k1, k2, text) => {
      const A = colX(k1, w), B = colX(k2, w), x1 = A.x + 6, x2 = B.x + B.cw - 6;
      ctx.strokeStyle = C.soft; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x1, base + 26); ctx.lineTo(x1, base + 31); ctx.lineTo(x2, base + 31); ctx.lineTo(x2, base + 26); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.font = '600 11px Archivo, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, (x1 + x2) / 2, base + 46);
    };
    g(3 + p.L, 4, 'Ordinary craving: rises and falls');
    g(3, 1, 'Noble stages: only fall');
    g(0, 0, 'Not run again');
    // agents
    agents.forEach(a => {
      a.x += (a.tx - a.x) * 0.18; a.y += (a.ty - a.y) * 0.18;
      const r = s * 0.4;
      if (a.k === 0) { ctx.strokeStyle = C.ink; ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; return; }
      ctx.globalAlpha = stateAlpha(a.k, p.L); ctx.fillStyle = stateColour(a.k, p.L);
      ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    });
  }
  function frame(t) {
    const dt = Math.min(0.1, (t - prev) / 1000 || 0); prev = t;
    if (running) { acc += dt * +inputs.speed.value; while (acc >= 1) { acc -= 1; tick(); if (!running) break; } }
    draw(); requestAnimationFrame(frame);
  }
  ['a', 'b', 'a2', 'L'].forEach(k => inputs[k].addEventListener('input', () => {
    if (+inputs.a.value + +inputs.b.value > 1) inputs.b.value = (1 - +inputs.a.value).toFixed(2);
    reset();
  }));
  inputs.speed.addEventListener('input', () => { q('output[for=speed]').textContent = inputs.speed.value; });
  q('[data-act=run]').addEventListener('click', e => {
    if (agents.every(a => a.k === 0)) reset();
    running = !running; e.target.textContent = running ? 'Pause' : 'Run';
  });
  q('[data-act=reset]').addEventListener('click', () => { reset(); });
  q('[data-act=run]').textContent = running ? 'Pause' : 'Run';
  q('output[for=speed]').textContent = inputs.speed.value;
  addEventListener('resize', () => { agents.forEach(a => { a.x = null; }); layout(); agents.forEach(a => { a.x = a.tx; a.y = a.ty; }); });
  reset();
  requestAnimationFrame(frame);
}

/* ---------- Figure 2: expected lives against levels of craving ---------- */
function livesChart(svg, head) {
  return p => {
    const W = 900, H = 400, left = 70, right = 760, y0 = 30, bottom = 340;
    const Ls = Array.from({ length: 12 }, (_, i) => i + 1);
    const curve = rho => Ls.map(L => ({ L, v: expectedLives({ ...p, b: p.a * rho, L }) }));
    const refs = [0.5, 1, 2].map(rho => ({ rho, pts: curve(rho) }));
    const cur = Ls.map(L => ({ L, v: expectedLives({ ...p, L }) }));
    const all = [...refs.flatMap(r => r.pts), ...cur].map(d => d.v).filter(isFinite);
    const lo = Math.floor(Math.log10(Math.max(1, Math.min(...all)))), hi = Math.max(lo + 2, Math.ceil(Math.log10(Math.max(...all))));
    const xs = L => left + (L - 1) / 11 * (right - left), ys = v => bottom - (Math.log10(v) - lo) / (hi - lo) * (bottom - y0);
    const path = pts => pts.filter(d => isFinite(d.v)).map((d, i) => `${i ? 'L' : 'M'}${xs(d.L).toFixed(1)} ${ys(d.v).toFixed(1)}`).join(' ');
    const ticks = []; for (let e = lo; e <= hi; e++) ticks.push(10 ** e);
    const rho = p.b / p.a, here = cur.find(d => d.L === p.L);
    let s = `<g font-family="Archivo, sans-serif" font-size="13">`;
    ticks.forEach(t => { s += `<line x1="${left}" x2="${right}" y1="${ys(t)}" y2="${ys(t)}" stroke="${C.rule}" stroke-width="1"/><text x="${left - 10}" y="${ys(t) + 4}" text-anchor="end" fill="${C.soft}">${t.toLocaleString('en-GB')}</text>`; });
    Ls.forEach(L => { s += `<text x="${xs(L)}" y="${bottom + 22}" text-anchor="middle" fill="${C.soft}">${L}</text>`; });
    s += `<line x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" stroke="${C.ink}"/>`;
    s += `<text x="${(left + right) / 2}" y="${bottom + 48}" text-anchor="middle" fill="${C.soft}">Levels of ordinary craving, L</text>`;
    s += `<text x="16" y="${(y0 + bottom) / 2}" transform="rotate(-90 16 ${(y0 + bottom) / 2})" text-anchor="middle" fill="${C.soft}">Expected lives before exit (log scale)</text>`;
    const curY = ys(cur.at(-1).v);
    refs.forEach(r => {
      const last = r.pts.at(-1), ly = ys(last.v);
      s += `<path d="${path(r.pts)}" fill="none" stroke="${C.soft}" stroke-opacity="0.45" stroke-width="1.5" stroke-dasharray="4 4"/>`;
      if (Math.abs(ly - curY) > 16) s += `<text x="${right + 10}" y="${ly + 4}" fill="${C.soft}">ρ = ${r.rho}</text>`;
    });
    s += `<path d="${path(cur)}" fill="none" stroke="${C.ochre}" stroke-width="3"/>`;
    cur.forEach(d => { if (isFinite(d.v)) s += `<circle cx="${xs(d.L)}" cy="${ys(d.v)}" r="3" fill="${C.ochre}"><title>L = ${d.L}: ${fmt(d.v)} expected lives</title></circle>`; });
    if (here && isFinite(here.v)) {
      s += `<circle cx="${xs(p.L)}" cy="${ys(here.v)}" r="7" fill="none" stroke="${C.ink}" stroke-width="2"/>`;
      const tx = xs(p.L) > right - 160 ? xs(p.L) - 12 : xs(p.L) + 12, anchor = xs(p.L) > right - 160 ? 'end' : 'start';
      s += `<text x="${tx}" y="${ys(here.v) - 12}" text-anchor="${anchor}" fill="${C.ink}" font-weight="700">Your settings: ${fmt(here.v)} lives</text>`;
    }
    s += `<text x="${right + 10}" y="${curY + 4}" fill="${C.ochre}" font-weight="700">ρ = ${rho.toFixed(2)}</text>`;
    s += `</g>`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = s;
    head.textContent = here && isFinite(here.v)
      ? `At your settings (ρ = ${rho.toFixed(2)}, L = ${p.L}), an agent at the top level waits about ${fmt(here.v)} lives. Above ρ = 1, each extra level multiplies the wait.`
      : 'With a = 0, practice never lowers craving and the agent never leaves.';
  };
}

/* ---------- Figure 3: the seven-lives bound ---------- */
function sevenLives(root) {
  const svg = root.querySelector('svg'), input = root.querySelector('[name=a2s]'), out = root.querySelector('output[for=a2s]'), r = root.querySelector('[data-r=p7]');
  const W = 900, H = 360, left = 70, right = 860, y0 = 24, bottom = 300;
  const xs = v => left + v * (right - left), ys = v => bottom - v * (bottom - y0);
  let need = 0.5; { let lo = 0, hi = 1; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; pWithin(7, m) >= 0.99 ? hi = m : lo = m; } need = hi; }
  function draw() {
    const a2 = +input.value, P = pWithin(7, a2);
    let d = ''; for (let i = 0; i <= 200; i++) { const v = i / 200; d += `${i ? 'L' : 'M'}${xs(v).toFixed(1)} ${ys(pWithin(7, v)).toFixed(1)}`; }
    let s = `<g font-family="Archivo, sans-serif" font-size="13">`;
    [0, 0.25, 0.5, 0.75, 1].forEach(t => { s += `<line x1="${left}" x2="${right}" y1="${ys(t)}" y2="${ys(t)}" stroke="${C.rule}"/><text x="${left - 10}" y="${ys(t) + 4}" text-anchor="end" fill="${C.soft}">${Math.round(t * 100)}%</text>`; });
    [0, 0.2, 0.4, 0.6, 0.8, 1].forEach(t => { s += `<text x="${xs(t)}" y="${bottom + 22}" text-anchor="middle" fill="${C.soft}">${t.toFixed(1)}</text>`; });
    s += `<line x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" stroke="${C.ink}"/>`;
    s += `<text x="${(left + right) / 2}" y="${bottom + 46}" text-anchor="middle" fill="${C.soft}">a<tspan font-size="0.75em" dy="0.3em">2</tspan><tspan dy="-0.3em">: chance per life of moving one noble stage closer</tspan></text>`;
    s += `<line x1="${left}" x2="${right}" y1="${ys(0.99)}" y2="${ys(0.99)}" stroke="${C.ink}" stroke-dasharray="5 4"/><text x="${left + 8}" y="${ys(0.99) - 8}" fill="${C.ink}">99%: the texts' "at most seven lives"</text>`;
    s += `<line x1="${xs(need)}" x2="${xs(need)}" y1="${ys(0.99)}" y2="${bottom}" stroke="${C.ink}" stroke-dasharray="5 4"/><text x="${xs(need) - 8}" y="${bottom - 10}" text-anchor="end" fill="${C.ink}" font-weight="700">needs a<tspan font-size="0.75em" dy="0.3em">2</tspan><tspan dy="-0.3em"> ≥ ${need.toFixed(2)}</tspan></text>`;
    s += `<path d="${d}" fill="none" stroke="${C.green}" stroke-width="3"/>`;
    s += `<circle cx="${xs(a2)}" cy="${ys(P)}" r="7" fill="${C.paper}" stroke="${C.ink}" stroke-width="2.5"/>`;
    s += `</g>`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = s;
    out.textContent = a2.toFixed(2);
    r.textContent = (P * 100).toFixed(P > 0.999 ? 2 : 1) + '%';
    r.classList.toggle('hi', P >= 0.99);
  }
  input.addEventListener('input', draw); draw();
}

/* ---------- Figure 4: escape or deletion ---------- */
function twin(root) {
  const q = s => root.querySelector(s);
  const p = { a: 0.2, b: 0.1, a2: 0.8, L: 4 }, N = 200;
  let A, B, hist, seed = 11, timer = null, leak = false;
  function world() { return { rnd: mulberry32(seed), ks: new Array(N).fill(3 + p.L), outside: [] }; }
  function reset() { A = world(); B = world(); hist = [{ a: N, b: N, diff: 0 }]; leak = q('[name=leak]').checked; draw(); }
  function advance(W, copy, extra) {
    for (let i = 0; i < N; i++) {
      if (!W.ks[i]) continue;
      W.ks[i] = step(W.ks[i], p, W.rnd);
      if (!W.ks[i]) { if (copy) W.outside.push(i); else W.outside.push(null); }
    }
    if (extra) W.outside.forEach(() => { // a copied agent sends something back: a random running agent's craving drops
      if (W.rnd() < 0.03) { const live = W.ks.map((k, i) => k ? i : -1).filter(i => i >= 0); if (live.length) { const j = live[Math.floor(W.rnd() * live.length)]; W.ks[j] = Math.max(1, W.ks[j] - 1); } }
    });
  }
  function tick() {
    advance(A, true, leak); advance(B, false, false);
    const a = A.ks.filter(Boolean).length, b = B.ks.filter(Boolean).length;
    let diff = 0; for (let i = 0; i < N; i++) if (A.ks[i] !== B.ks[i]) diff++;
    hist.push({ a, b, diff });
    draw();
    if (!a && !b) stop();
  }
  function stop() { clearInterval(timer); timer = null; q('[data-act=go]').textContent = 'Run both worlds'; }
  function lineChart(cv) {
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const n = Math.max(40, hist.length), x = i => 36 + i / (n - 1) * (w - 44), y = v => h - 18 - v / N * (h - 44);
    ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(36, h - 18); ctx.lineTo(w - 8, h - 18); ctx.stroke();
    ctx.fillStyle = C.soft; ctx.font = '500 11px Archivo, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(N, 30, y(N) + 4); ctx.fillText(0, 30, h - 14);
    ctx.textAlign = 'left'; ctx.fillText('agents still being run, by life', 40, 11);
    const line = (key, colour, dash, width) => { ctx.setLineDash(dash); ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.beginPath(); hist.forEach((d, i) => { const yy = y(d[key]); i ? ctx.lineTo(x(i), yy) : ctx.moveTo(x(i), yy); }); ctx.stroke(); ctx.setLineDash([]); };
    line('a', C.ochre, [], 4); line('b', C.ink, [5, 4], 1.5);
  }
  function outsideA(cv) {
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = C.deep; ctx.fillRect(0, 0, w, h);
    const per = Math.floor((w - 16) / 8);
    A.outside.forEach((id, i) => { ctx.fillStyle = C.ink; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(10 + (i % per) * 8, h - 10 - Math.floor(i / per) * 8, 2.6, 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1; ctx.fillStyle = C.ink; ctx.font = '600 12px Archivo, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(`${A.outside.length} copied out, still running out here`, w - 8, 16);
  }
  function outsideB(cv) {
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = C.deep; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = C.rule; ctx.setLineDash([3, 3]); ctx.strokeRect(6.5, 6.5, w - 13, h - 13); ctx.setLineDash([]);
    ctx.fillStyle = C.ink; ctx.font = '600 12px Archivo, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(`${B.outside.length} records freed, nothing kept`, w - 12, 22);
  }
  function draw() {
    lineChart(q('[data-c=inA]')); lineChart(q('[data-c=inB]'));
    outsideA(q('[data-c=outA]')); outsideB(q('[data-c=outB]'));
    const last = hist.at(-1), differ = hist.filter(d => d.diff).length;
    q('[data-r=lives]').textContent = hist.length - 1;
    q('[data-r=diff]').textContent = differ;
    q('[data-r=diff]').classList.toggle('hi', !differ);
    q('[data-r=verdict]').textContent = differ
      ? `Different. Once something flows back from outside, the inside histories split. A channel back is the only thing that could tell escape from deletion.`
      : `Identical so far. Nothing returns from the absorbing state, so the inside of world A and world B cannot be told apart.`;
  }
  q('[data-act=go]').addEventListener('click', e => {
    if (timer) { stop(); return; }
    if (hist.length > 1 && !A.ks.some(Boolean) && !B.ks.some(Boolean)) reset();
    timer = setInterval(tick, reduced ? 30 : 80); e.target.textContent = 'Pause';
  });
  q('[data-act=seed]').addEventListener('click', () => { stop(); seed = (seed * 7919 + 13) % 100003; reset(); });
  q('[name=leak]').addEventListener('change', () => { stop(); reset(); });
  addEventListener('resize', draw);
  reset();
  if (!reduced) {
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); if (!timer && hist.length === 1) q('[data-act=go]').click(); } }, { threshold: 0.4 });
    io.observe(root);
  }
}

/* ---------- Contents highlighting ---------- */
function toc() {
  const links = [...document.querySelectorAll('.toc a')], map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { links.forEach(a => a.classList.remove('on')); map.get(e.target.id)?.classList.add('on'); } }), { rootMargin: '0px 0px -70% 0px' });
  document.querySelectorAll('.paper h2[id]').forEach(h => io.observe(h));
}

await document.fonts.ready;
embers(document.getElementById('embers'));
const draw2 = livesChart(document.getElementById('fig2-svg'), document.getElementById('fig2-head'));
chain(document.getElementById('fig1'), draw2);
sevenLives(document.getElementById('fig3'));
twin(document.getElementById('fig4'));
toc();
