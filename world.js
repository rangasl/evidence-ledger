// "The rerun": a deterministic little world. Every choice follows from state + seed,
// so the future can be read in advance and a rewind replays the same life exactly.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = {
  paper: '#EDEFEA', tile: '#F4F5F1', tileEdge: '#D5D9D0', ink: '#1C2338', soft: '#545C70',
  water: '#C9D2DA', waterEdge: '#AEB9C4', leaf: '#1F6B4F', leafDark: '#174F3B', fruit: '#A8650F',
  bench: '#8A5A1E', house: '#FAFBF8', houseSide: '#D9DDD4', houseSide2: '#C4C9BF', apple: '#A4262C',
};
const W = 14, H = 10, TPS = 12;           // grid size, simulation ticks per second
const STEP_TICKS = 5;                     // ticks to cross one tile

/* ---------- deterministic randomness ---------- */
function rand(s) { // mulberry32 on a state object, so it can be cloned
  s.r = (s.r + 0x6D2B79F5) | 0;
  let t = Math.imul(s.r ^ (s.r >>> 15), 1 | s.r);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/* ---------- the world ---------- */
const POND = []; for (let x = 9; x <= 11; x++) for (let y = 1; y <= 3; y++) POND.push([x, y]);
const TREES = [[0, 0], [1, 0], [0, 1], [13, 0], [6, 0], [13, 9], [12, 9], [7, 9], [4, 4], [8, 6]];
const HOUSES = [[1, 8], [12, 5]];
const BENCHES = [[7, 2], [3, 6]];
const VIEWS = [[8, 2], [10, 4]];

function newWorld(seed) {
  const st = { r: seed | 0 };
  return {
    seed, tick: 0, rng: st, decisions: 0,
    bushes: [{ x: 2, y: 2, fruit: 3, regrow: 0 }, { x: 5, y: 8, fruit: 3, regrow: 0 }, { x: 11, y: 7, fruit: 3, regrow: 0 }],
    apples: [],
    agent: {
      x: 6, y: 4, px: 6, py: 4, path: [], moveT: 0,
      hunger: 0.3 + rand(st) * 0.4, fatigue: 0.2 + rand(st) * 0.4, boredom: 0.3 + rand(st) * 0.4,
      action: null, doing: 0,
    },
    last: null, // most recent decision
  };
}
const key = (x, y) => x + ',' + y;
const BLOCKED = new Set([...POND, ...TREES, ...HOUSES].map(([x, y]) => key(x, y)));
function walkable(w, x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  if (BLOCKED.has(key(x, y))) return false;
  return !w.bushes.some(b => b.x === x && b.y === y);
}
function bfs(w, sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [];
  const prev = new Map([[key(sx, sy), null]]), q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || !walkable(w, nx, ny)) continue;
      prev.set(k, [x, y]);
      if (nx === tx && ny === ty) {
        const path = []; let c = [nx, ny];
        while (c && !(c[0] === sx && c[1] === sy)) { path.unshift(c); c = prev.get(key(...c)); }
        return path;
      }
      q.push([nx, ny]);
    }
  }
  return null;
}
function besideBush(w, b) {
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) if (walkable(w, b.x + dx, b.y + dy)) return [b.x + dx, b.y + dy];
  return null;
}

/* ---------- the "choice" ---------- */
const THOUGHTS = {
  eat: 'I’m hungry. I’ll get some berries.',
  apple: 'Is that an apple? I’ll have it.',
  rest: 'I’m tired. I’ll sit down.',
  watch: 'I want to look at the water.',
  wander: 'I’ll walk around a bit.',
};
const LABELS = {
  eat: 'eats berries', apple: 'eats your apple', rest: 'sits on a bench', watch: 'watches the pond', wander: 'wanders',
};
function decide(w) {
  const a = w.agent, opts = [];
  const dist = (x, y) => { const p = bfs(w, a.x, a.y, x, y); return p ? p.length : null; };
  for (const b of w.bushes) if (b.fruit > 0) {
    const t = besideBush(w, b), d = t && dist(...t);
    if (d != null) opts.push({ kind: 'eat', target: t, ref: b, score: a.hunger * 1.25 - d * 0.03 });
  }
  for (const ap of w.apples) {
    const d = dist(ap.x, ap.y);
    if (d != null) opts.push({ kind: 'apple', target: [ap.x, ap.y], ref: ap, score: a.hunger * 1.4 + 0.1 - d * 0.03 });
  }
  for (const [x, y] of BENCHES) { const d = dist(x, y); if (d != null) opts.push({ kind: 'rest', target: [x, y], score: a.fatigue * 1.1 - d * 0.03 }); }
  for (const [x, y] of VIEWS) { const d = dist(x, y); if (d != null) opts.push({ kind: 'watch', target: [x, y], score: a.boredom * 1.0 - d * 0.03 }); }
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(rand(w.rng) * W), y = Math.floor(rand(w.rng) * H);
    if (walkable(w, x, y) && dist(x, y) != null) { opts.push({ kind: 'wander', target: [x, y], score: 0.12 + a.boredom * 0.1 }); break; }
  }
  for (const o of opts) o.score += rand(w.rng) * 0.2; // "randomness" — still fixed by the seed
  opts.sort((p, q) => q.score - p.score);
  const pick = opts[0];
  a.action = pick; a.path = bfs(w, a.x, a.y, ...pick.target) || []; a.doing = 0; a.moveT = 0;
  w.decisions++;
  w.last = { n: w.decisions, tick: w.tick, kind: pick.kind, at: pick.target.join(',') };
  return w.last;
}

const DURATION = { eat: 26, apple: 16, rest: 44, watch: 36, wander: 4 };
function step(w) {
  w.tick++;
  const a = w.agent;
  a.hunger = Math.min(1, a.hunger + 0.0017);
  a.fatigue = Math.min(1, a.fatigue + 0.0011 + (a.path.length ? 0.0008 : 0));
  a.boredom = Math.min(1, a.boredom + 0.0016);
  for (const b of w.bushes) if (b.fruit < 3 && --b.regrow <= 0) { b.fruit++; b.regrow = 260; }
  let decided = null;
  if (!a.action) decided = decide(w);
  if (a.path.length) {
    if (++a.moveT >= STEP_TICKS) { a.px = a.x; a.py = a.y; [a.x, a.y] = a.path.shift(); a.moveT = 0; }
  } else if (++a.doing >= DURATION[a.action.kind]) {
    const k = a.action.kind;
    if (k === 'eat') { a.hunger = Math.max(0, a.hunger - 0.6); const b = a.action.ref; b.fruit--; b.regrow = 260; }
    if (k === 'apple') { a.hunger = Math.max(0, a.hunger - 0.55); w.apples = w.apples.filter(p => !(p.x === a.action.ref.x && p.y === a.action.ref.y)); }
    if (k === 'rest') a.fatigue = Math.max(0, a.fatigue - 0.7);
    if (k === 'watch') a.boredom = Math.max(0, a.boredom - 0.65);
    if (k === 'wander') a.boredom = Math.max(0, a.boredom - 0.05);
    a.action = null; a.px = a.x; a.py = a.y;
  }
  return decided;
}
// The future is computable: copy the world and run it forward.
function clone(w) {
  const c = structuredClone({ ...w, agent: { ...w.agent, action: null } });
  if (w.agent.action) {
    const act = w.agent.action, ref = act.kind === 'eat' ? c.bushes[w.bushes.indexOf(act.ref)]
      : act.kind === 'apple' ? c.apples[w.apples.indexOf(act.ref)] : undefined;
    c.agent.action = { ...act, ref };
  }
  return c;
}
function readScript(w, n = 6) {
  const f = clone(w), out = [];
  for (let i = 0; i < 6000 && out.length < n; i++) { const d = step(f); if (d) out.push(d); }
  return out;
}

/* ---------- page ---------- */
export function mountWorld(root) {
  const canvas = root.querySelector('canvas'), ctx = canvas.getContext('2d');
  const scriptEl = root.querySelector('#script'), scriptBtn = root.querySelector('#read-script');
  const statusEl = root.querySelector('#status'), livesEl = root.querySelector('#lives');
  let seed = 20261124, w = newWorld(seed), script = readScript(w), revealed = false;
  let checked = 0, correct = 0, lives = 1, previousLife = [], thisLife = [], disturbed = false;
  let thought = null, flash = 0;

  function renderScript() {
    if (!revealed) { scriptEl.hidden = true; return; }
    scriptEl.hidden = false;
    scriptEl.innerHTML = script.slice(0, 6).map((d, i) => {
      const secs = Math.max(0, (d.tick - w.tick) / TPS);
      const prev = previousLife[d.n - 1];
      const same = !disturbed && lives > 1 && prev ? (prev === d.kind + '@' + d.at ? '<span class="same">same as last life</span>' : '<span class="diff">different</span>') : '';
      return `<li class="${i === 0 ? 'next' : ''}"><span class="when">${secs < 0.1 ? 'now' : 'in ' + secs.toFixed(1) + ' s'}</span><span>Decision ${d.n}: ${LABELS[d.kind]}</span>${same}</li>`;
    }).join('');
  }
  function renderStatus() {
    statusEl.textContent = checked
      ? `The script has been right ${correct} of ${checked} times.`
      : 'The script is written before each decision is made.';
    livesEl.textContent = lives > 1
      ? (disturbed ? `Life ${lives}. You changed the world, so this life can differ from the last.` : `Life ${lives}. Same seed, same world, so far the same choices.`)
      : 'Life 1.';
  }

  function onDecision(d) {
    const predicted = script.shift();
    checked++;
    if (predicted && predicted.n === d.n && predicted.kind === d.kind && predicted.at === d.at) correct++;
    thisLife.push(d.kind + '@' + d.at);
    thought = { text: THOUGHTS[d.kind], showAt: w.tick + 4, until: w.tick + 40 }; // the thought arrives after the decision
    if (script.length < 4) script = readScript(w);
    renderStatus();
  }

  root.querySelector('#rewind').addEventListener('click', () => {
    previousLife = disturbed ? [] : thisLife; thisLife = []; disturbed = false;
    w = newWorld(seed); script = readScript(w); lives++; checked = correct = 0; thought = null;
    renderStatus(); renderScript();
  });
  root.querySelector('#new-life').addEventListener('click', () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    w = newWorld(seed); script = readScript(w); lives = 1; previousLife = []; thisLife = []; disturbed = false;
    checked = correct = 0; thought = null; renderStatus(); renderScript();
  });
  scriptBtn.addEventListener('click', () => {
    revealed = !revealed; scriptBtn.textContent = revealed ? 'Hide the script' : 'Read the script';
    scriptBtn.setAttribute('aria-expanded', revealed); renderScript();
  });

  /* ----- isometric drawing ----- */
  let TW = 56, TH = 28, ox = 0, oy = 0, dpr = 1, CW = 0, CH = 0;
  const iso = (x, y) => [ox + (x - y) * TW / 2, oy + (x + y) * TH / 2];
  function resize() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(devicePixelRatio, 2);
    CW = r.width; CH = r.height; canvas.width = CW * dpr; canvas.height = CH * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    TW = Math.min(CW / (W + H) * 2 * 0.96, 76); TH = TW / 2;
    ox = CW / 2 - (W - H) * TW / 4; oy = (CH - (W + H) * TH / 2) / 2 + TH * 0.6;
  }
  new ResizeObserver(resize).observe(canvas); resize();

  canvas.addEventListener('click', e => {
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const a = (mx - ox) / (TW / 2), b = (my - oy) / (TH / 2);
    const x = Math.round((a + b) / 2), y = Math.round((b - a) / 2);
    if (!walkable(w, x, y) || w.apples.some(p => p.x === x && p.y === y) || w.apples.length >= 3) return;
    w.apples.push({ x, y }); disturbed = true; script = readScript(w); flash = 1;
    renderStatus(); renderScript();
  });

  function diamond(x, y, fill, stroke, lift = 0) {
    const [sx, sy] = iso(x, y);
    ctx.beginPath(); ctx.moveTo(sx, sy - TH / 2 - lift); ctx.lineTo(sx + TW / 2, sy - lift); ctx.lineTo(sx, sy + TH / 2 - lift); ctx.lineTo(sx - TW / 2, sy - lift); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function box(x, y, hgt, top, left, right) {
    const [sx, sy] = iso(x, y), hw = TW / 2 * 0.86, hh = TH / 2 * 0.86;
    ctx.fillStyle = left; ctx.beginPath(); ctx.moveTo(sx - hw, sy); ctx.lineTo(sx, sy + hh); ctx.lineTo(sx, sy + hh - hgt); ctx.lineTo(sx - hw, sy - hgt); ctx.fill();
    ctx.fillStyle = right; ctx.beginPath(); ctx.moveTo(sx + hw, sy); ctx.lineTo(sx, sy + hh); ctx.lineTo(sx, sy + hh - hgt); ctx.lineTo(sx + hw, sy - hgt); ctx.fill();
    ctx.fillStyle = top; ctx.beginPath(); ctx.moveTo(sx, sy - hh - hgt); ctx.lineTo(sx + hw, sy - hgt); ctx.lineTo(sx, sy + hh - hgt); ctx.lineTo(sx - hw, sy - hgt); ctx.fill();
  }
  function tree(x, y) {
    const [sx, sy] = iso(x, y), s = TW / 56;
    ctx.fillStyle = 'rgba(28,35,56,0.12)'; ctx.beginPath(); ctx.ellipse(sx, sy, 14 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.ink; ctx.fillRect(sx - 1.5 * s, sy - 16 * s, 3 * s, 16 * s);
    ctx.fillStyle = C.leafDark; ctx.beginPath(); ctx.arc(sx, sy - 24 * s, 13 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.leaf; ctx.beginPath(); ctx.arc(sx - 3 * s, sy - 27 * s, 9 * s, 0, Math.PI * 2); ctx.fill();
  }
  function bush(b) {
    const [sx, sy] = iso(b.x, b.y), s = TW / 56;
    ctx.fillStyle = C.leafDark; ctx.beginPath(); ctx.ellipse(sx, sy - 7 * s, 15 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.leaf; ctx.beginPath(); ctx.ellipse(sx - 3 * s, sy - 10 * s, 10 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.fruit;
    [[-7, -8], [5, -12], [8, -5]].slice(0, b.fruit).forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(sx + dx * s, sy + dy * s, 2.6 * s, 0, Math.PI * 2); ctx.fill(); });
  }
  function bench(x, y) {
    const [sx, sy] = iso(x, y), s = TW / 56;
    ctx.strokeStyle = C.bench; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx - 12 * s, sy - 2 * s); ctx.lineTo(sx + 12 * s, sy - 8 * s); ctx.stroke();
    ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(sx - 10 * s, sy - 2 * s); ctx.lineTo(sx - 10 * s, sy + 3 * s); ctx.moveTo(sx + 10 * s, sy - 7 * s); ctx.lineTo(sx + 10 * s, sy - 2 * s); ctx.stroke();
  }
  function apple(p) {
    const [sx, sy] = iso(p.x, p.y), s = TW / 56;
    ctx.fillStyle = C.apple; ctx.beginPath(); ctx.arc(sx, sy - 4 * s, 4.5 * s, 0, Math.PI * 2); ctx.fill();
  }
  function person(fx, fy, sitting) {
    const [sx, sy] = iso(fx, fy), s = TW / 56, bob = sitting ? 4 * s : 0;
    ctx.fillStyle = 'rgba(28,35,56,0.15)'; ctx.beginPath(); ctx.ellipse(sx, sy, 8 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.beginPath(); ctx.roundRect(sx - 5 * s, sy - 22 * s + bob, 10 * s, 18 * s - bob, 5 * s); ctx.fill();
    ctx.beginPath(); ctx.arc(sx, sy - 27 * s + bob, 5 * s, 0, Math.PI * 2); ctx.fill();
    return [sx, sy - 34 * s + bob];
  }
  function bubble(x, y, text) {
    ctx.font = '500 13px Archivo, sans-serif';
    const pad = 9, tw = ctx.measureText(text).width, bw = tw + pad * 2, bh = 28;
    const bx = Math.min(Math.max(x - bw / 2, 6), CW - bw - 6), by = y - bh - 10;
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 5, by + bh); ctx.lineTo(x, by + bh + 7); ctx.lineTo(x + 5, by + bh); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.fillText(text, bx + pad, by + 18);
  }

  function draw(frac) {
    ctx.clearRect(0, 0, CW, CH);
    const pond = new Set(POND.map(([x, y]) => key(x, y)));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      pond.has(key(x, y)) ? diamond(x, y, C.water, C.waterEdge) : diamond(x, y, C.tile, C.tileEdge);
    // planned path
    const a = w.agent;
    if (a.path.length) {
      ctx.strokeStyle = C.fruit; ctx.lineWidth = 2; ctx.setLineDash([3, 5]); ctx.beginPath();
      const start = iso(a.x, a.y); ctx.moveTo(...start);
      for (const [x, y] of a.path) ctx.lineTo(...iso(x, y));
      ctx.stroke(); ctx.setLineDash([]);
      const [tx, ty] = iso(...a.path[a.path.length - 1]);
      ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI * 2); ctx.fillStyle = C.fruit; ctx.fill();
    }
    // sprites sorted by depth
    const t = a.path.length || a.moveT ? Math.min(1, (a.moveT + frac) / STEP_TICKS) : 1;
    const nxt = a.path[0];
    const fx = nxt ? a.x + (nxt[0] - a.x) * t : a.x, fy = nxt ? a.y + (nxt[1] - a.y) * t : a.y;
    const items = [
      ...TREES.map(([x, y]) => ({ d: x + y, f: () => tree(x, y) })),
      ...HOUSES.map(([x, y]) => ({ d: x + y, f: () => box(x, y, TH * 1.3, C.house, C.houseSide, C.houseSide2) })),
      ...BENCHES.map(([x, y]) => ({ d: x + y - 0.1, f: () => bench(x, y) })),
      ...w.bushes.map(b => ({ d: b.x + b.y, f: () => bush(b) })),
      ...w.apples.map(p => ({ d: p.x + p.y - 0.05, f: () => apple(p) })),
    ];
    let head = null;
    items.push({ d: fx + fy + 0.01, f: () => { head = person(fx, fy, a.action && a.action.kind === 'rest' && !a.path.length); } });
    items.sort((p, q) => p.d - q.d).forEach(i => i.f());
    if (thought && w.tick >= thought.showAt && w.tick < thought.until && head) bubble(head[0], head[1], thought.text);
    if (flash > 0) { ctx.fillStyle = `rgba(168,101,15,${flash * 0.08})`; ctx.fillRect(0, 0, CW, CH); flash -= 0.04; }
  }

  let acc = 0, last = performance.now(), lastScript = 0, running = false;
  function frame(now) {
    if (!running) return;
    acc += Math.min(250, now - last) / 1000 * TPS; last = now;
    while (acc >= 1) { acc -= 1; const d = step(w); if (d) onDecision(d); }
    draw(acc);
    if (now - lastScript > 200) { renderScript(); lastScript = now; }
    requestAnimationFrame(frame);
  }
  renderStatus(); renderScript();
  if (reduced) { for (let i = 0; i < 40; i++) { const d = step(w); if (d) onDecision(d); } draw(0); }
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running && !reduced) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    else if (!e.isIntersecting) running = false;
  }).observe(canvas);
}
