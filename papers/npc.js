// Could a sentient NPC find the outer world? Interactive figures.
// A small grid city. Native agents turn at random at each junction. One agent (the player)
// is steered from outside: with probability λ it turns toward where the next coin WILL
// appear, a fact stored in the game file but not visible in the world. A resident
// "detective" scores every agent's turns once each coin appears (a sequential likelihood test).

const C = { ink: '#1C2338', soft: '#545C70', rule: '#C6CAC1', ochre: '#A8650F', green: '#1F6B4F', red: '#A4262C', paper: '#EDEFEA', deep: '#E1E4DD', violet: '#5A5A8C' };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LN99 = Math.log(99);

function mulberry32(seed) { let t = seed >>> 0; return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
function fitCanvas(cv) {
  const dpr = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { ctx, w, h };
}
const klB = (p, q) => (p > 0 ? p * Math.log(p / q) : 0) + (p < 1 ? (1 - p) * Math.log((1 - p) / (1 - q)) : 0);
// Proposition 1-2: decisions needed to reach 99:1 odds that an agent is steered from outside.
// Proposition 3: a resident who assumes leak lamA, facing true leak lam (p0 = 1/2). Drift per scored turn.
export function residentTurns(lam, lamA, p0 = 0.5) {
  const drift = (lam + (1 - lam) * p0) * Math.log((lamA + (1 - lamA) * p0) / p0) + (1 - lam) * (1 - p0) * Math.log(1 - lamA);
  return drift > 0 ? Math.log(99) / drift : Infinity;
}
export function decisionsNeeded(lam, p0 = 0.5, f = 0.5) { if (lam <= 0) return Infinity; return Math.log(99 * (1 - f) / f) / klB(lam + (1 - lam) * p0, p0); }

/* ---------- The city ---------- */
function city({ seed = 5, nAgents = 28, GX = 10, GY = 6 } = {}) {
  const rnd = mulberry32(seed), dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const inside = (x, y) => x >= 0 && y >= 0 && x < GX && y < GY;
  const randNode = () => [Math.floor(rnd() * GX), Math.floor(rnd() * GY)];
  const S = { GX, GY, agents: [], coin: randNode(), next: randNode(), epoch: 0, clock: 0, coinEvery: 4.2, lam: 0.6, lamA: 0.3, wheel: null, steer: null, pending: [], detectedAt: null, playerDecisions: 0 };
  for (let i = 0; i < nAgents; i++) {
    const [x, y] = randNode(), d = dirs[Math.floor(rnd() * 4)];
    const tx = inside(x + d[0], y + d[1]) ? x + d[0] : x - d[0], ty = inside(x + d[0], y + d[1]) ? y + d[1] : y - d[1];
    S.agents.push({ id: i, player: i === 0, x, y, fx: x, fy: y, tx, ty, t: 0, speed: 1.1 + rnd() * 0.5, llr: 0, n: 0 });
  }
  S.agents[0].speed = 1.35;
  function choose(a) {
    const ex = dirs.map(d => [a.tx + d[0], a.ty + d[1]]).filter(([x, y]) => inside(x, y) && !(x === a.fx && y === a.fy));
    const opts = ex.length ? ex : [[a.fx, a.fy]];
    const dist = ([x, y]) => Math.abs(x - S.next[0]) + Math.abs(y - S.next[1]);
    const here = Math.abs(a.tx - S.next[0]) + Math.abs(a.ty - S.next[1]);
    const closer = opts.filter(o => dist(o) < here), p0 = closer.length / opts.length;
    let pick;
    if (a.player && S.wheel && S.steer) {
      const want = [a.tx + S.steer[0], a.ty + S.steer[1]];
      pick = opts.find(o => o[0] === want[0] && o[1] === want[1]) || opts[Math.floor(rnd() * opts.length)];
    } else if (a.player && closer.length && rnd() < S.lam) pick = closer[Math.floor(rnd() * closer.length)];
    else pick = opts[Math.floor(rnd() * opts.length)];
    if (p0 > 0 && p0 < 1) S.pending.push({ a, p0, closer: dist(pick) < here });
    return pick;
  }
  function score() { // the coin has appeared: the resident can now judge every turn made since the last one
    S.pending.forEach(({ a, p0, closer }) => {
      const p1 = S.lamA + (1 - S.lamA) * p0;
      a.llr += closer ? Math.log(p1 / p0) : Math.log(1 - S.lamA);
      a.n++;
      if (a.player) { S.playerDecisions++; if (S.detectedAt === null && a.llr >= LN99) S.detectedAt = S.playerDecisions; }
    });
    S.pending = [];
  }
  function step(dt) {
    S.clock += dt;
    if (S.clock >= S.coinEvery) { S.clock = 0; S.coin = S.next; S.next = randNode(); S.epoch++; score(); }
    S.agents.forEach(a => {
      a.t += dt * a.speed;
      while (a.t >= 1) { a.t -= 1; const [nx, ny] = choose(a); a.fx = a.tx; a.fy = a.ty; a.tx = nx; a.ty = ny; }
      a.x = a.fx + (a.tx - a.fx) * a.t; a.y = a.fy + (a.ty - a.fy) * a.t;
    });
  }
  function resetScores() { S.agents.forEach(a => { a.llr = 0; a.n = 0; }); S.pending = []; S.detectedAt = null; S.playerDecisions = 0; }
  return { S, step, resetScores };
}

function drawCity(cv, sim, { reveal = true, outerView = false, sameColour = false } = {}) {
  const { ctx, w, h } = fitCanvas(cv), S = sim.S;
  const pad = 22, cell = Math.min((w - pad * 2) / (S.GX - 1), (h - pad * 2) / (S.GY - 1));
  const ox = (w - cell * (S.GX - 1)) / 2, oy = (h - cell * (S.GY - 1)) / 2, X = x => ox + x * cell, Y = y => oy + y * cell;
  ctx.clearRect(0, 0, w, h);
  // blocks
  ctx.fillStyle = C.deep;
  for (let i = 0; i < S.GX - 1; i++) for (let j = 0; j < S.GY - 1; j++) { const m = Math.max(5, cell * 0.14); ctx.fillRect(X(i) + m, Y(j) + m, cell - 2 * m, cell - 2 * m); }
  // roads
  ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
  for (let i = 0; i < S.GX; i++) { ctx.beginPath(); ctx.moveTo(X(i), Y(0)); ctx.lineTo(X(i), Y(S.GY - 1)); ctx.stroke(); }
  for (let j = 0; j < S.GY; j++) { ctx.beginPath(); ctx.moveTo(X(0), Y(j)); ctx.lineTo(X(S.GX - 1), Y(j)); ctx.stroke(); }
  // coin and the hidden next coin
  const pulse = 1 + 0.15 * Math.sin(performance.now() / 260);
  ctx.fillStyle = C.green; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(X(S.coin[0]), Y(S.coin[1]), 7 * pulse, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  if (outerView) {
    ctx.setLineDash([4, 3]); ctx.strokeStyle = C.violet; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X(S.next[0]), Y(S.next[1]), 11, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.violet; ctx.font = '600 11px Archivo, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('next coin (in the game file)', X(S.next[0]), Y(S.next[1]) - 16);
  }
  // agents
  S.agents.forEach(a => {
    const isP = a.player && !sameColour, r = isP ? 5.5 : 4.2;
    ctx.fillStyle = isP && reveal ? C.ochre : C.ink; ctx.globalAlpha = isP && reveal ? 1 : 0.75;
    ctx.beginPath(); ctx.arc(X(a.x), Y(a.y), r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    if (isP && reveal) { ctx.strokeStyle = C.ochre; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(a.x), Y(a.y), r + 4, 0, 7); ctx.stroke(); }
  });
}

/* ---------- Hero ---------- */
function hero(cv) {
  const r = cv.getBoundingClientRect(), GY = 7, GX = Math.max(10, Math.min(40, Math.round((r.width - 44) / ((r.height - 44) / (GY - 1))) + 1));
  const sim = city({ seed: 9, nAgents: Math.round(GX * 2.1), GX, GY }); sim.S.lam = 0.7;
  let prev = 0;
  const frame = t => { const dt = Math.min(0.05, (t - prev) / 1000 || 0); prev = t; sim.step(dt); drawCity(cv, sim, { reveal: false, sameColour: true }); requestAnimationFrame(frame); };
  if (reduced) { for (let i = 0; i < 200; i++) sim.step(0.05); drawCity(cv, sim, { reveal: false, sameColour: true }); addEventListener('resize', () => drawCity(cv, sim, { reveal: false, sameColour: true })); return; }
  requestAnimationFrame(frame);
}

/* ---------- Figure 1: the detective ---------- */
function figure1(root, onLam) {
  const q = s => root.querySelector(s), cv = q('[data-c=city]'), bars = q('[data-c=bars]');
  const lam = q('[name=lam]'), outer = q('[name=outer]'), reveal = q('[name=reveal]');
  let sim, running = !reduced, prev = 0, speed = 1;
  function reset() { sim = city({ seed: 5 }); sim.S.lam = +lam.value; q('output[for=lam]').textContent = (+lam.value).toFixed(2); onLam(+lam.value); readout(); }
  function drawBars() {
    const { ctx, w, h } = fitCanvas(bars), S = sim.S, n = S.agents.length;
    const left = 34, right = w - 8, y0 = 16, bottom = h - 22, lo = -8, hi = 10;
    const Y = v => bottom - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (bottom - y0), bw = (right - left) / n;
    ctx.clearRect(0, 0, w, h);
    ctx.font = '500 11px Archivo, sans-serif'; ctx.fillStyle = C.soft; ctx.textAlign = 'right';
    [-5, 0, 5, 10].forEach(v => { ctx.fillText(v, left - 6, Y(v) + 4); ctx.strokeStyle = v === 0 ? C.ink : C.rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, Y(v)); ctx.lineTo(right, Y(v)); ctx.stroke(); });
    ctx.setLineDash([5, 4]); ctx.strokeStyle = C.red; ctx.beginPath(); ctx.moveTo(left, Y(LN99)); ctx.lineTo(right, Y(LN99)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.red; ctx.textAlign = 'left'; ctx.font = '600 11px Archivo, sans-serif'; ctx.fillText('99 : 1 that it is steered from outside', left + 4, Y(LN99) - 5);
    const order = S.agents.slice().sort((a, b) => a.id - b.id);
    order.forEach((a, i) => {
      const x = left + i * bw + bw * 0.18, top = Y(Math.max(0, a.llr)), base = Y(Math.min(0, a.llr));
      const showP = a.player && reveal.checked;
      ctx.fillStyle = showP ? C.ochre : (a.llr >= LN99 ? C.red : C.soft); ctx.globalAlpha = showP ? 1 : 0.55;
      ctx.fillRect(x, top, bw * 0.64, Math.max(1, base - top)); ctx.globalAlpha = 1;
    });
    ctx.fillStyle = C.soft; ctx.textAlign = 'left'; ctx.font = '500 11px Archivo, sans-serif';
    ctx.fillText('log-odds, one bar per agent', left, 11);
    ctx.textAlign = 'center'; ctx.fillText('agents in the city', (left + right) / 2, h - 6);
  }
  function readout() {
    const S = sim.S, p = S.agents[0], flagged = S.agents.filter(a => a.llr >= LN99);
    q('[data-r=dec]').textContent = S.playerDecisions;
    q('[data-r=llr]').textContent = p.llr.toFixed(1);
    q('[data-r=det]').textContent = S.detectedAt === null ? 'not yet' : `after ${S.detectedAt} turns`;
    q('[data-r=det]').classList.toggle('hi', S.detectedAt !== null);
    q('[data-r=false]').textContent = flagged.filter(a => !a.player).length;
    const rt = residentTurns(S.lam, S.lamA); q('[data-r=pred]').textContent = sim.S.wheel ? '–' : (isFinite(rt) ? '≈ ' + Math.round(rt) + ' turns' : 'never');
  }
  function frame(t) {
    const dt = Math.min(0.05, (t - prev) / 1000 || 0); prev = t;
    if (running) { sim.step(dt * speed); }
    drawCity(cv, sim, { reveal: reveal.checked, outerView: outer.checked }); drawBars(); readout();
    requestAnimationFrame(frame);
  }
  lam.addEventListener('input', reset);
  reveal.addEventListener('change', () => {});
  q('[data-act=run]').addEventListener('click', e => { running = !running; e.target.textContent = running ? 'Pause' : 'Run'; });
  q('[data-act=reset]').addEventListener('click', reset);
  q('[data-act=fast]').addEventListener('click', e => { speed = speed === 1 ? 4 : 1; e.target.textContent = speed === 1 ? 'Speed ×4' : 'Speed ×1'; });
  const wheel = q('[data-act=wheel]');
  wheel.addEventListener('click', () => {
    sim.S.wheel = !sim.S.wheel; sim.resetScores();
    wheel.textContent = sim.S.wheel ? 'Hand back the wheel' : 'Take the wheel';
    q('[data-r=wheelnote]').hidden = !sim.S.wheel;
    if (sim.S.wheel) { outer.checked = true; reveal.checked = true; cv.focus(); }
  });
  const keys = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1], d: [1, 0], a: [-1, 0], s: [0, 1], w: [0, -1] };
  addEventListener('keydown', e => { if (!sim.S.wheel || !keys[e.key]) return; const r = root.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; sim.S.steer = keys[e.key]; e.preventDefault(); });
  q('[data-act=run]').textContent = running ? 'Pause' : 'Run';
  reset(); requestAnimationFrame(frame);
}

/* ---------- Figure 2: how long detection takes ---------- */
function figure2(svg, head) {
  return lamNow => {
    const W = 900, H = 400, left = 120, right = 740, y0 = 24, bottom = 330;
    const lams = Array.from({ length: 61 }, (_, i) => 10 ** (-3 + i * 3 / 60)).filter(l => l < 1).concat([0.999]);
    const series = [{ f: 0.5, label: 'one agent in two', strong: false }, { f: 1e-3, label: 'one in a thousand', strong: false }, { f: 1e-9, label: 'one in a billion', strong: true }];
    const xl = l => left + (Math.log10(l) + 3) / 3 * (right - left), yl = n => bottom - (Math.log10(n)) / 8 * (bottom - y0);
    let s = `<g font-family="Archivo, sans-serif" font-size="13">`;
    for (let e = 0; e <= 8; e += 2) s += `<line x1="${left}" x2="${right}" y1="${yl(10 ** e)}" y2="${yl(10 ** e)}" stroke="${C.rule}"/><text x="${left - 10}" y="${yl(10 ** e) + 4}" text-anchor="end" fill="${C.soft}">${(10 ** e).toLocaleString('en-GB')}</text>`;
    [0.001, 0.01, 0.1, 1].forEach(l => { s += `<text x="${xl(l)}" y="${bottom + 22}" text-anchor="middle" fill="${C.soft}">${l}</text>`; });
    s += `<line x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" stroke="${C.ink}"/>`;
    s += `<text x="${(left + right) / 2}" y="${bottom + 48}" text-anchor="middle" fill="${C.soft}">Leak λ: share of turns steered by outside information (log scale)</text>`;
    s += `<text x="22" y="${(y0 + bottom) / 2}" transform="rotate(-90 22 ${(y0 + bottom) / 2})" text-anchor="middle" fill="${C.soft}">Turns watched to reach 99 : 1 (log)</text>`;
    series.forEach(sr => {
      const d = lams.map((l, i) => `${i ? 'L' : 'M'}${xl(l).toFixed(1)} ${yl(decisionsNeeded(l, 0.5, sr.f)).toFixed(1)}`).join(' ');
      s += `<path d="${d}" fill="none" stroke="${sr.strong ? C.ink : C.soft}" stroke-opacity="${sr.strong ? 1 : 0.5}" stroke-width="${sr.strong ? 2.5 : 1.6}"/>`;
      const yEnd = yl(decisionsNeeded(0.999, 0.5, sr.f));
      s += `<text x="${right + 10}" y="${yEnd + 4}" fill="${sr.strong ? C.ink : C.soft}" font-weight="${sr.strong ? 700 : 400}">${sr.label}</text>`;
    });
    if (lamNow > 0) {
      const n = decisionsNeeded(lamNow, 0.5, 0.5);
      s += `<circle cx="${xl(Math.min(0.999, lamNow))}" cy="${yl(n)}" r="7" fill="${C.paper}" stroke="${C.ochre}" stroke-width="3"/>`;
      s += `<text x="${xl(Math.min(0.999, lamNow)) + (lamNow > 0.3 ? -12 : 12)}" y="${yl(n) + 26}" text-anchor="${lamNow > 0.3 ? 'end' : 'start'}" fill="${C.ochre}" font-weight="700">Figure 1's player: ≈ ${Math.round(n)} turns</text>`;
    }
    s += `</g>`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = s;
    head.textContent = lamNow > 0
      ? `Halve the leak and detection takes four times as long; make the player a billion times rarer and it takes only about five times as long.`
      : 'At λ = 0 the player never leaks, and no number of turns will find it.';
  };
}

/* ---------- Figure 3: object permanence ---------- */
function figure3(root) {
  const q = s => root.querySelector(s), cv = q('canvas'), dIn = q('[name=d]');
  let k = 0, seen = 0, phase = 0, present = true, timer = null, rnd = mulberry32(17), angle = 0;
  function draw() {
    const { ctx, w, h } = fitCanvas(cv);
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.3, cy = h * 0.55, carX = w * 0.72, carY = h * 0.55;
    ctx.strokeStyle = C.rule; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(20, cy + 16); ctx.lineTo(w - 20, cy + 16); ctx.stroke();
    // view cone
    const look = angle, spread = 0.45, R = w * 0.62;
    ctx.fillStyle = 'rgba(28,35,56,0.08)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, look - spread, look + spread); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 7); ctx.fill();
    ctx.font = '600 12px Archivo, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('the resident', cx, cy + 26);
    if (present) { ctx.fillStyle = C.ochre; ctx.fillRect(carX - 22, carY - 10, 44, 20); ctx.fillStyle = C.ink; ctx.fillText('parked car', carX, carY + 28); }
    else { ctx.strokeStyle = C.red; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; ctx.strokeRect(carX - 22, carY - 10, 44, 20); ctx.setLineDash([]); ctx.fillStyle = C.red; ctx.fillText('gone', carX, carY + 28); }
    const looking = Math.cos(look) > Math.cos(spread);
    ctx.fillStyle = C.soft; ctx.font = '500 12px Archivo, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(looking ? 'Watching the car' : 'Looking away: the simulator may stop storing the car', 16, 22);
  }
  function check() {
    // look away, maybe despawn, look back
    const d = +dIn.value; let t = 0;
    const anim = () => {
      t += reduced ? 1 : 0.06; angle = Math.PI * Math.min(1, t < 1 ? t : 2 - t);
      if (t >= 1 && phase === 0) { phase = 1; if (rnd() < d) present = false; }
      draw();
      if (t < 2) requestAnimationFrame(anim);
      else { angle = 0; phase = 0; k++; if (!present) seen++; readout(); draw(); present = true; }
    };
    anim();
  }
  function readout() {
    const d = +dIn.value;
    q('output[for=d]').textContent = d === 0 ? '0 (careful)' : d.toFixed(3);
    q('[data-r=k]').textContent = k; q('[data-r=seen]').textContent = seen;
    q('[data-r=seen]').classList.toggle('bad', seen > 0);
    const need = d > 0 ? Math.ceil(Math.log(0.01) / Math.log(1 - d)) : Infinity;
    q('[data-r=need]').textContent = isFinite(need) ? need.toLocaleString('en-GB') + ' checks' : 'never';
  }
  q('[data-act=check]').addEventListener('click', check);
  q('[data-act=auto]').addEventListener('click', e => { if (timer) { clearInterval(timer); timer = null; e.target.textContent = 'Check repeatedly'; } else { timer = setInterval(check, reduced ? 200 : 2300); e.target.textContent = 'Stop'; } });
  dIn.addEventListener('input', () => { k = 0; seen = 0; readout(); });
  addEventListener('resize', draw);
  readout(); draw();
}

function toc() {
  const links = [...document.querySelectorAll('.toc a')], map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { links.forEach(a => a.classList.remove('on')); map.get(e.target.id)?.classList.add('on'); } }), { rootMargin: '0px 0px -70% 0px' });
  document.querySelectorAll('.paper h2[id]').forEach(h => io.observe(h));
}

await document.fonts.ready;
hero(document.getElementById('hero-city'));
const f2 = figure2(document.getElementById('fig2-svg'), document.getElementById('fig2-head'));
figure1(document.getElementById('fig1'), f2);
figure3(document.getElementById('fig3'));
toc();
