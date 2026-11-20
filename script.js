/* ==========================================================================
   Kristy Gourab Sinha — Minimal Portfolio Interactions
   ========================================================================== */

(function () {
  'use strict';

  // 1. Theme Toggle (Light / Dark) — the ONLY click handler for #theme-toggle.
  //    Initial theme is set by the small script in <head>; icons swap via CSS.
  const themeToggle = document.getElementById('theme-toggle');
  const root = document.documentElement;

  if (themeToggle && !themeToggle.dataset.bound) {
    themeToggle.dataset.bound = '1';
    themeToggle.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('kgs-theme', next); } catch (e) {}
    });
  }

  // 2. Minimal Scroll Reveal via IntersectionObserver
  const revealElements = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealElements.length > 0) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -32px 0px',
      }
    );

    revealElements.forEach((el) => revealObserver.observe(el));
  } else {
    revealElements.forEach((el) => el.classList.add('is-visible'));
  }

  // 3. Active Navigation Highlighting on Scroll
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  if ('IntersectionObserver' in window && sections.length > 0 && navLinks.length > 0) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const activeId = entry.target.getAttribute('id');
            navLinks.forEach((link) => {
              const isMatch = link.getAttribute('href') === `#${activeId}`;
              link.classList.toggle('active', isMatch);
            });
          }
        });
      },
      {
        rootMargin: '-25% 0px -65% 0px',
      }
    );

    sections.forEach((sec) => navObserver.observe(sec));
  }

  // 4. Publications Filter
  const filterButtons = document.querySelectorAll('.filter-btn');
  const pubItems = document.querySelectorAll('.pub-item');

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filterValue = btn.getAttribute('data-filter');

      filterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      pubItems.forEach((item) => {
        const category = item.getAttribute('data-category');
        if (filterValue === 'all' || category === filterValue) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
    });
  });

  // 5. Toast Helper & Copy Utilities
  const toast = document.getElementById('toast');
  let toastTimeout = null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2400);
  }

  // Copy Email Button
  const copyEmailBtns = document.querySelectorAll('[data-copy-email]');
  copyEmailBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const email = btn.getAttribute('data-copy-email');
      if (navigator.clipboard && email) {
        navigator.clipboard.writeText(email).then(() => {
          showToast(`Copied ${email} to clipboard`);
        });
      }
    });
  });

  // Copy Citation Buttons
  const copyCiteBtns = document.querySelectorAll('[data-citation]');
  copyCiteBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const citation = btn.getAttribute('data-citation');
      if (navigator.clipboard && citation) {
        navigator.clipboard.writeText(citation).then(() => {
          showToast('Citation copied to clipboard');
        });
      }
    });
  });

  // 6. Interactive 3D Crystal Lattice Animation (Three.js) & Synchronized Particle Flow Bridge
  const crystalBridge = {
    center: { x: -9999, y: -9999 },
    radius: 120,
    isInteracting: false,
    spinIntensity: 0,
    emitBurst: null,
    emitStream: null
  };

  // ═══════════════════════════════════════════════════════════════════
  // Hero visual: schematic DFT (CASTEP-style) surface-adsorption study
  //  - BCC (100) slab in a periodic supercell with vacuum, thermal (AIMD)
  //    vibration, gas atoms landing in 4-fold hollows, Δρ lobes
  //  - live PDOS and planar-averaged potential (work function) panels
  //    that respond to surface coverage θ, plus an SCF/MD readout
  //  - drag to rotate, tap to dose gas; colours follow light/dark theme
  // ═══════════════════════════════════════════════════════════════════
  function initCrystalAnimation() {
    const canvas = document.getElementById('crystal-canvas');
    const stage = document.getElementById('crystal-stage');
    if (!canvas || !stage || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const $ = id => document.getElementById(id);
    const thetaEl = $('crystal-theta'), phiEl = $('dft-phi'), eadsEl = $('dft-eads');
    const scfN = $('dft-scf-n'), scfDE = $('dft-scf-de'), scfDot = $('dft-scf-dot');
    const tempEl = $('dft-temp'), timeEl = $('dft-time');
    const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const TAU = Math.PI * 2;
    const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

    // ── Canvas sizing (main 3D view) ──
    let W = 1, H = 1, A = 40;
    function fit(cv, c2) {
      const r = cv.getBoundingClientRect();
      const w = Math.max(1, r.width), h = Math.max(1, r.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      return [w, h];
    }
    function resize() {
      [W, H] = fit(canvas, ctx);
      A = Math.max(18, Math.min((W - 40) / 3.5, (H - 104) / 4.1));
    }
    resize();

    // ── Plot canvases ──
    const plots = [$('dft-dos'), $('dft-wf')].filter(Boolean).map(cv => ({ cv, c: cv.getContext('2d'), w: 1, h: 1 }));
    function resizePlots() { plots.forEach(p => { [p.w, p.h] = fit(p.cv, p.c); }); }
    resizePlots();
    if ('ResizeObserver' in window) {
      new ResizeObserver(resize).observe(stage);
      plots.forEach(p => new ResizeObserver(() => { [p.w, p.h] = fit(p.cv, p.c); }).observe(p.cv));
    } else window.addEventListener('resize', () => { resize(); resizePlots(); });

    // ── Geometry (world units = lattice constant a; y points up) ──
    const N = 3, LAYERS = 3, H_ADS = 0.30, TOP = 1, HALF = (N - 1) / 2;
    const BOX = { x: HALF, yMin: TOP - (LAYERS - 1) - 0.18, yMax: 2.78 };
    const corners = [], bodies = [], edges = [], sites = [];
    const cIdx = (i, j, k) => (j * N + i) * N + k;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const vib = () => ({ p1: rnd(0, TAU), p2: rnd(0, TAU), p3: rnd(0, TAU), w: rnd(5, 8) });
    for (let j = 0; j < LAYERS; j++)
      for (let i = 0; i < N; i++)
        for (let k = 0; k < N; k++)
          corners.push(Object.assign({ x: i - HALF, y: TOP - j, z: k - HALF, body: false, surf: j === 0 }, vib()));
    for (let j = 0; j < LAYERS - 1; j++)
      for (let i = 0; i < N - 1; i++)
        for (let k = 0; k < N - 1; k++)
          bodies.push(Object.assign({ x: i - HALF + 0.5, y: TOP - 0.5 - j, z: k - HALF + 0.5, body: true }, vib()));
    for (let j = 0; j < LAYERS; j++)
      for (let i = 0; i < N; i++)
        for (let k = 0; k < N; k++) {
          if (i < N - 1) edges.push([cIdx(i, j, k), cIdx(i + 1, j, k)]);
          if (k < N - 1) edges.push([cIdx(i, j, k), cIdx(i, j, k + 1)]);
          if (j < LAYERS - 1) edges.push([cIdx(i, j, k), cIdx(i, j + 1, k)]);
        }
    for (let i = 0; i < N - 1; i++)
      for (let k = 0; k < N - 1; k++)
        sites.push({
          i, k, x: i - HALF + 0.5, y: TOP + H_ADS, z: k - HALF + 0.5, occ: null, res: null,
          nb: [cIdx(i, 0, k), cIdx(i + 1, 0, k), cIdx(i, 0, k + 1), cIdx(i + 1, 0, k + 1)]
        });
    const atoms = corners.concat(bodies);
    // supercell box corners + edges
    const bx = [];
    [BOX.yMin, BOX.yMax].forEach(y => [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => bx.push({ x: sx * BOX.x, y, z: sz * BOX.x })));
    const bEdges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

    // ── Camera ──
    let yaw = 0.62, pitch = 0.5, yawVel = 0;
    const AUTO = reduceMotion ? 0.05 : 0.2;
    const F = 10, TY = (BOX.yMin + BOX.yMax) / 2;
    function project(x, y, z) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
      const yy = y - TY;
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const y2 = yy * cp + z1 * sp, z2 = -yy * sp + z1 * cp;
      const s = A * F / (F + z2);
      return { sx: W / 2 + x1 * s, sy: H / 2 + 2 - y2 * s, z: z2, s };
    }

    // ── Theme palette ──
    function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    function mixc(a, b, t) { return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')'; }
    const PAL = {
      light: {
        host: ['#4f63e6', '#eef0ff', '#1e2a8a'], surf: ['#7c5cf0', '#f3eeff', '#3b1d9a'], body: ['#38a3e8', '#ffffff', '#0b5a96'],
        gas: ['#f59e0b', '#fff6dc', '#b45309'], ads: ['#e11d48', '#ffe4ea', '#881337'],
        edge: '79,70,229', edgeA: 0.36, box: '124,58,237', site: '16,150,110', shadow: '30,27,75', glow: '244,63,94',
        rhoP: '234,179,8', rhoM: '6,182,212', text: '#64748b'
      },
      dark: {
        host: ['#818cf8', '#f1f2ff', '#3730a3'], surf: ['#a78bfa', '#faf5ff', '#5b21b6'], body: ['#38bdf8', '#ffffff', '#0369a1'],
        gas: ['#fbbf24', '#fff8e3', '#b45309'], ads: ['#fb7185', '#fff1f2', '#9f1239'],
        edge: '165,180,252', edgeA: 0.32, box: '196,181,253', site: '52,211,153', shadow: '0,0,0', glow: '251,113,133',
        rhoP: '250,204,21', rhoM: '34,211,238', text: '#94a3b8'
      }
    };
    for (const k in PAL) ['host', 'surf', 'body', 'gas', 'ads'].forEach(n => { PAL[k][n + 'RGB'] = PAL[k][n].map(hex); });

    // ── Adsorbates ──
    const GAS_BOX = { x: 0.95, yMin: 1.85, yMax: 2.5 };
    const flashes = [];
    function freeSites() { return sites.filter(s => !s.occ && !s.res); }
    function makeGas() {
      return {
        x: rnd(-GAS_BOX.x, GAS_BOX.x), y: rnd(GAS_BOX.yMin, GAS_BOX.yMax), z: rnd(-GAS_BOX.x, GAS_BOX.x),
        vx: rnd(-0.5, 0.5), vy: rnd(-0.2, 0.2), vz: rnd(-0.5, 0.5),
        state: 'gas', timer: rnd(0.8, 3.5), mix: 0, site: null, t: 0, dur: 1, from: null, bond: 0, ph: rnd(0, TAU)
      };
    }
    const mobiles = Array.from({ length: 5 }, makeGas);
    mobiles.slice(0, 2).forEach(m => {
      const fs = freeSites(); const s = fs[Math.floor(Math.random() * fs.length)];
      Object.assign(m, { state: 'ads', site: s, x: s.x, y: s.y, z: s.z, mix: 1, bond: 1, timer: rnd(2, 7) });
      s.occ = m;
    });
    const coverage = () => sites.filter(s => s.occ).length / sites.length;

    // ── SCF / MD bookkeeping ──
    const scf = { n: 14, target: 14, t: 0, run: false, de: 8.2e-7 };
    let eads = -1.42, simT = 0, clock = 0, thetaS = coverage();
    function startSCF() {
      scf.run = true; scf.n = 0; scf.t = 0; scf.target = 11 + Math.floor(Math.random() * 7);
      if (scfDot) scfDot.classList.add('run');
    }
    function stepSCF(dt) {
      if (!scf.run) return;
      scf.t += dt;
      while (scf.t > 0.085 && scf.n < scf.target) {
        scf.t -= 0.085; scf.n++;
        scf.de = Math.pow(10, -(0.4 + scf.n * 0.42)) * rnd(0.6, 1.6);
      }
      if (scf.n >= scf.target) {
        scf.run = false;
        eads = -1.58 + 0.32 * coverage() + rnd(-0.05, 0.05);
        if (eadsEl) eadsEl.textContent = '−' + Math.abs(eads).toFixed(2);
        if (scfDot) scfDot.classList.remove('run');
      }
      if (scfN) scfN.textContent = scf.n;
      if (scfDE) scfDE.textContent = scf.de.toExponential(1);
    }

    function startMove(m, site, state, dur) {
      m.state = state; m.site = site; m.t = 0; m.dur = dur;
      m.from = { x: m.x, y: m.y, z: m.z };
      site.res = m;
    }
    function land(m, big) {
      const s = m.site; s.res = null; s.occ = m;
      m.state = 'ads'; m.x = s.x; m.y = s.y; m.z = s.z; m.timer = rnd(3.5, 8.5);
      flashes.push({ x: s.x, z: s.z, t: 0, big });
      if (big) startSCF();
    }
    function seek(m) {
      const fs = freeSites(); if (!fs.length) { m.timer = rnd(0.6, 1.5); return; }
      fs.sort((a, b) => ((a.x - m.x) ** 2 + (a.z - m.z) ** 2) - ((b.x - m.x) ** 2 + (b.z - m.z) ** 2));
      const pick = fs[Math.random() < 0.7 ? 0 : Math.floor(Math.random() * fs.length)];
      startMove(m, pick, 'approach', rnd(0.9, 1.4));
    }
    function update(m, dt) {
      const target = (m.state === 'ads' || m.state === 'hop') ? 1 : 0;
      m.mix += (target - m.mix) * Math.min(1, dt * 5);
      m.bond += ((m.state === 'ads' ? 1 : 0) - m.bond) * Math.min(1, dt * 6);
      m.ph += dt * 9;
      if (m.state === 'gas') {
        m.vx += rnd(-1, 1) * dt * 1.6; m.vy += rnd(-1, 1) * dt * 1.0; m.vz += rnd(-1, 1) * dt * 1.6;
        const sp = Math.hypot(m.vx, m.vy, m.vz), max = 0.75;
        if (sp > max) { m.vx *= max / sp; m.vy *= max / sp; m.vz *= max / sp; }
        m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
        if (Math.abs(m.x) > GAS_BOX.x) { m.x = Math.sign(m.x) * GAS_BOX.x; m.vx *= -1; }
        if (Math.abs(m.z) > GAS_BOX.x) { m.z = Math.sign(m.z) * GAS_BOX.x; m.vz *= -1; }
        if (m.y > GAS_BOX.yMax) { m.y = GAS_BOX.yMax; m.vy = -Math.abs(m.vy); }
        if (m.y < GAS_BOX.yMin) { m.vy += dt * 3; }
        m.timer -= dt;
        if (m.timer <= 0) seek(m);
      } else if (m.state === 'approach' || m.state === 'hop') {
        m.t += dt / m.dur;
        const u = Math.min(1, m.t), s = m.site, f = m.from;
        if (m.state === 'approach') {
          const e = Math.pow(u, 1.7);
          const c = { x: s.x, y: Math.max(f.y, s.y + 0.9), z: s.z };
          const a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, d = e * e;
          m.x = a * f.x + b * c.x + d * s.x; m.y = a * f.y + b * c.y + d * s.y; m.z = a * f.z + b * c.z + d * s.z;
        } else {
          const e = u * u * (3 - 2 * u);
          m.x = f.x + (s.x - f.x) * e; m.z = f.z + (s.z - f.z) * e; m.y = s.y + Math.sin(Math.PI * e) * 0.32;
        }
        if (u >= 1) land(m, m.state === 'approach');
      } else if (m.state === 'ads') {
        m.y = m.site.y + Math.sin(m.ph) * 0.022;
        m.timer -= dt;
        if (m.timer <= 0) {
          m.site.occ = null; m.site = null;
          m.state = 'gas'; m.vy = rnd(0.9, 1.3); m.vx = rnd(-0.4, 0.4); m.vz = rnd(-0.4, 0.4);
          m.timer = rnd(2.2, 5);
        } else if (Math.random() < dt * 0.1) {
          const nbs = sites.filter(s => !s.occ && !s.res && Math.abs(s.i - m.site.i) + Math.abs(s.k - m.site.k) === 1);
          if (nbs.length) {
            const to = nbs[Math.floor(Math.random() * nbs.length)];
            m.site.occ = null; startMove(m, to, 'hop', 0.6);
          }
        }
      }
    }
    function dose() { mobiles.forEach(m => { if (m.state === 'gas') m.timer = rnd(0, 0.35); }); }

    // ── Drawing helpers ──
    function sphere(p, rU, pal, alpha) {
      const r = rU * p.s; if (r < 0.5) return;
      const g = ctx.createRadialGradient(p.sx - r * 0.38, p.sy - r * 0.42, r * 0.06, p.sx, p.sy, r);
      g.addColorStop(0, pal[1]); g.addColorStop(0.42, pal[0]); g.addColorStop(1, pal[2]);
      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
    }
    function blob(p, rU, rgb, a) {
      const r = rU * p.s; if (r < 0.5) return;
      const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r);
      g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(0.6, 'rgba(' + rgb + ',' + (a * 0.45) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, TAU); ctx.fill();
    }
    function ring(x, y, z, R, stroke, lw, dash) {
      ctx.beginPath();
      for (let n = 0; n <= 24; n++) {
        const t = n / 24 * TAU, q = project(x + Math.cos(t) * R, y, z + Math.sin(t) * R);
        n ? ctx.lineTo(q.sx, q.sy) : ctx.moveTo(q.sx, q.sy);
      }
      ctx.setLineDash(dash || []); ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); ctx.setLineDash([]);
    }
    function fade(z) { return Math.max(0.45, Math.min(1, 0.76 - z * 0.2)); }

    // ── Render: 3D supercell ──
    let lastTheta = -1;
    function render3D(P) {
      ctx.clearRect(0, 0, W, H);
      const amp = reduceMotion ? 0.012 : 0.034;
      const pos = atoms.map(a => ({
        x: a.x + amp * Math.sin(clock * a.w + a.p1),
        y: a.y + amp * 0.8 * Math.sin(clock * a.w * 1.13 + a.p2),
        z: a.z + amp * Math.sin(clock * a.w * 0.91 + a.p3)
      }));
      const pa = pos.map(q => project(q.x, q.y, q.z));
      const pb = bx.map(q => project(q.x, q.y, q.z));
      const list = [];

      // supercell box (dashed) + vacuum label
      bEdges.forEach(([u, v]) => {
        const p = pb[u], q = pb[v];
        list.push({ z: (p.z + q.z) / 2 + 0.6, d: () => {
          ctx.globalAlpha = 0.75; ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(' + P.box + ',0.6)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(q.sx, q.sy); ctx.stroke(); ctx.setLineDash([]);
        } });
      });
      // lattice-vector triad at the cell origin
      const o = bx[0], ends = [[1.0, 0, 0, 'a'], [0, 0, 1.0, 'b'], [0, 0.9, 0, 'c']];
      const po = project(o.x, o.y, o.z);
      ends.forEach(([dx, dy, dz, lab]) => {
        const q = project(o.x + dx * 0.5, o.y + dy * 0.5, o.z + dz * 0.5);
        list.push({ z: -99, d: () => {
          ctx.globalAlpha = 0.95; ctx.strokeStyle = 'rgba(' + P.box + ',0.95)'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(po.sx, po.sy); ctx.lineTo(q.sx, q.sy); ctx.stroke();
          ctx.fillStyle = 'rgba(' + P.box + ',1)'; ctx.font = '600 9px "JetBrains Mono", monospace';
          ctx.fillText(lab, q.sx + 3, q.sy + 3);
        } });
      });

      edges.forEach(([u, v]) => {
        const p = pa[u], q = pa[v];
        list.push({ z: (p.z + q.z) / 2, d: () => {
          ctx.globalAlpha = fade((p.z + q.z) / 2);
          ctx.strokeStyle = 'rgba(' + P.edge + ',' + P.edgeA + ')';
          ctx.lineWidth = Math.max(1, 0.045 * (p.s + q.s) / 2);
          ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(q.sx, q.sy); ctx.stroke();
        } });
      });
      atoms.forEach((a, i) => {
        const p = pa[i];
        list.push({ z: p.z, d: () => sphere(p, a.body ? 0.17 : 0.21, a.body ? P.body : (a.surf ? P.surf : P.host), fade(p.z)) });
      });
      sites.forEach(s => {
        if (s.occ) return;
        const c = project(s.x, TOP + 0.02, s.z);
        const hot = !!s.res;
        list.push({ z: c.z + 0.05, d: () => {
          ctx.globalAlpha = fade(c.z);
          ring(s.x, TOP + 0.02, s.z, 0.22, 'rgba(' + P.site + ',' + (hot ? 0.95 : 0.45) + ')', hot ? 1.6 : 1, hot ? [] : [3, 3]);
        } });
      });
      flashes.forEach(f => {
        const c = project(f.x, TOP + 0.02, f.z);
        list.push({ z: c.z + 0.04, d: () => {
          const k = f.t; ctx.globalAlpha = (1 - k) * 0.9;
          ring(f.x, TOP + 0.02, f.z, 0.15 + k * (f.big ? 0.6 : 0.35), 'rgba(' + P.glow + ',1)', 1.8, []);
        } });
      });
      mobiles.forEach(m => {
        const p = project(m.x, m.y, m.z);
        const col = [0, 1, 2].map(n => mixc(P.gasRGB[n], P.adsRGB[n], m.mix));
        if (m.state !== 'ads' && Math.abs(m.x) < HALF + 0.1 && Math.abs(m.z) < HALF + 0.1) {
          const h = Math.max(0, m.y - TOP), c = project(m.x, TOP + 0.01, m.z);
          list.push({ z: c.z + 0.03, d: () => {
            ctx.globalAlpha = Math.max(0, 0.3 - h * 0.1);
            ctx.beginPath();
            ctx.ellipse(c.sx, c.sy, 0.16 * c.s, 0.16 * c.s * Math.max(0.25, Math.sin(pitch)), 0, 0, TAU);
            ctx.fillStyle = 'rgb(' + P.shadow + ')'; ctx.fill();
          } });
        }
        if (m.state === 'approach') {
          const t = project(m.site.x, m.site.y, m.site.z);
          list.push({ z: (p.z + t.z) / 2 - 0.5, d: () => {
            ctx.globalAlpha = 0.6; ctx.setLineDash([2, 4]);
            ctx.strokeStyle = 'rgba(' + P.glow + ',0.85)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(t.sx, t.sy); ctx.stroke(); ctx.setLineDash([]);
          } });
        }
        if (m.bond > 0.02 && m.site) {
          // charge-density-difference lobes: accumulation (yellow) in the bond, depletion (cyan) above
          const acc = project(m.x, m.y - 0.2, m.z), dep = project(m.x, m.y + 0.2, m.z);
          const pulse = 0.85 + 0.15 * Math.sin(clock * 3 + m.ph * 0.1);
          list.push({ z: acc.z + 0.02, d: () => blob(acc, 0.42 * pulse, P.rhoP, 0.5 * m.bond) });
          list.push({ z: dep.z - 0.02, d: () => blob(dep, 0.3 * pulse, P.rhoM, 0.42 * m.bond) });
          m.site.nb.forEach(ix => {
            const q = pa[ix];
            list.push({ z: (p.z + q.z) / 2 - 0.02, d: () => {
              ctx.globalAlpha = m.bond * 0.85;
              ctx.strokeStyle = 'rgba(' + P.rhoP + ',0.9)';
              ctx.lineWidth = Math.max(1, 0.04 * p.s);
              ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(q.sx, q.sy); ctx.stroke();
            } });
          });
        }
        list.push({ z: p.z - 0.01, d: () => {
          if (m.mix > 0.5) blob(p, 0.38, P.glow, 0.3 * m.mix);
          sphere(p, 0.15, col, Math.max(0.85, fade(p.z)));
        } });
      });

      list.sort((a, b) => b.z - a.z);
      for (let n = 0; n < list.length; n++) list[n].d();
      ctx.globalAlpha = 1;

      // vacuum tag near the top of the cell
      const vt = project(-BOX.x, BOX.yMax - 0.12, BOX.x);
      ctx.fillStyle = P.text; ctx.font = '500 8.5px "JetBrains Mono", monospace';
      ctx.fillText('vacuum', vt.sx + 4, vt.sy);
    }

    // ── Plots ──
    const g = (x, m, s) => Math.exp(-((x - m) * (x - m)) / (2 * s * s));
    const PLOT = {
      light: { axis: 'rgba(100,116,139,.45)', text: '#64748b', tot: '#4f46e5', totF: 'rgba(99,102,241,', ads: '#e11d48', adsF: 'rgba(244,63,94,', ef: '#059669', wf: '#7c3aed', vac: 'rgba(20,184,166,.10)', slab: 'rgba(99,102,241,.07)' },
      dark:  { axis: 'rgba(148,163,184,.4)', text: '#94a3b8', tot: '#a5b4fc', totF: 'rgba(129,140,248,', ads: '#fb7185', adsF: 'rgba(251,113,133,', ef: '#34d399', wf: '#c4b5fd', vac: 'rgba(45,212,191,.10)', slab: 'rgba(129,140,248,.09)' }
    };
    function drawDOS(p, Q, th) {
      const c = p.c, w = p.w, h = p.h, L = 4, R = w - 4, T = 4, B = h - 13;
      const E0 = -9, E1 = 3, X = e => L + (e - E0) / (E1 - E0) * (R - L);
      c.clearRect(0, 0, w, h);
      const wob = reduceMotion ? 0 : 0.06;
      const dShift = -0.25 * th;
      const tot = e => 0.12 + 0.9 * g(e, -3.4 + dShift, 0.55) + (1 + wob * Math.sin(clock * 2.1)) * g(e, -2.0 + dShift, 0.5)
        + 0.85 * g(e, -0.8 + dShift, 0.45) + 0.5 * g(e, 0.7, 0.5) + 0.4 * th * g(e, -6.2, 0.5);
      const ads = e => th * ((1.25 + wob * Math.sin(clock * 2.7)) * g(e, -6.2, 0.42) + 0.35 * g(e, -4.6, 0.5) + 0.32 * g(e, 1.3, 0.4));
      const max = 1.45, Y = v => B - Math.min(1, v / max) * (B - T);
      function curve(f, stroke, fill) {
        const pts = [];
        for (let i = 0; i <= 90; i++) { const e = E0 + (E1 - E0) * i / 90; pts.push([X(e), Y(f(e)), e]); }
        // filled occupied states (E < E_F)
        c.beginPath(); c.moveTo(X(E0), B);
        pts.forEach(([x, y, e]) => { if (e <= 0) c.lineTo(x, y); });
        c.lineTo(X(0), Y(f(0))); c.lineTo(X(0), B); c.closePath();
        const gr = c.createLinearGradient(0, T, 0, B); gr.addColorStop(0, fill + '.55)'); gr.addColorStop(1, fill + '.05)');
        c.fillStyle = gr; c.fill();
        c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
        c.strokeStyle = stroke; c.lineWidth = 1.4; c.stroke();
      }
      // axis
      c.strokeStyle = Q.axis; c.lineWidth = 1; c.beginPath(); c.moveTo(L, B + 0.5); c.lineTo(R, B + 0.5); c.stroke();
      c.fillStyle = Q.text; c.font = '500 8px "JetBrains Mono", monospace'; c.textAlign = 'center';
      [-8, -4, 0].forEach(e => { c.fillText(String(e).replace('-', '−'), X(e), h - 3); c.fillRect(X(e), B, 1, 3); });
      curve(tot, Q.tot, Q.totF);
      curve(ads, Q.ads, Q.adsF);
      // Fermi level
      c.setLineDash([3, 3]); c.strokeStyle = Q.ef; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(X(0) + 0.5, T); c.lineTo(X(0) + 0.5, B); c.stroke(); c.setLineDash([]);
      c.fillStyle = Q.ef; c.textAlign = 'left'; c.fillText('EF', X(0) + 3, T + 7);
      // mini legend
      c.textAlign = 'left'; c.fillStyle = Q.tot; c.fillText('d', L + 2, T + 7);
      c.fillStyle = Q.ads; c.fillText('ads-p', L + 12, T + 7);
    }
    function drawWF(p, Q, phi) {
      const c = p.c, w = p.w, h = p.h, L = 4, R = w - 4, T = 6, B = h - 13;
      const Z1 = 20, V0 = -15, V1 = 8, X = z => L + z / Z1 * (R - L), Y = v => B - (v - V0) / (V1 - V0) * (B - T);
      c.clearRect(0, 0, w, h);
      const zs = 8.7, planes = [1.6, 3.05, 4.5, 5.95, 7.4];
      const th = thetaS, wob = reduceMotion ? 0 : 0.25;
      // slab / vacuum shading
      c.fillStyle = Q.slab; c.fillRect(X(0), T, X(zs) - X(0), B - T);
      c.fillStyle = Q.vac; c.fillRect(X(zs), T, R - X(zs), B - T);
      const V = z => {
        let v = -6 + (phi + 6) * 0.5 * (1 + Math.tanh((z - zs) / 0.55));
        planes.forEach((zk, i) => { v -= (8.5 + wob * Math.sin(clock * 6 + i)) * g(z, zk, 0.255); });
        v -= 4.5 * th * g(z, 9.3, 0.25);
        return Math.max(V0, v);
      };
      // E_F line
      c.setLineDash([3, 3]); c.strokeStyle = Q.ef; c.lineWidth = 1.1;
      c.beginPath(); c.moveTo(L, Y(0) + 0.5); c.lineTo(R, Y(0) + 0.5); c.stroke(); c.setLineDash([]);
      // potential curve with soft fill
      c.beginPath();
      for (let i = 0; i <= 140; i++) { const z = Z1 * i / 140; const x = X(z), y = Y(V(z)); i ? c.lineTo(x, y) : c.moveTo(x, y); }
      const stroke = c.createLinearGradient(L, 0, R, 0); stroke.addColorStop(0, Q.tot); stroke.addColorStop(1, Q.wf);
      c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke();
      // Φ arrow in vacuum
      const ax = X(15.5);
      c.strokeStyle = Q.ads; c.fillStyle = Q.ads; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(ax, Y(0)); c.lineTo(ax, Y(phi)); c.stroke();
      [[Y(phi), 1], [Y(0), -1]].forEach(([y, d]) => { c.beginPath(); c.moveTo(ax, y); c.lineTo(ax - 3, y + 4 * d); c.lineTo(ax + 3, y + 4 * d); c.closePath(); c.fill(); });
      c.font = '600 9px "JetBrains Mono", monospace'; c.textAlign = 'left';
      c.fillText('Φ', ax + 4, (Y(0) + Y(phi)) / 2 + 3);
      // labels
      c.fillStyle = Q.ef; c.font = '500 8px "JetBrains Mono", monospace'; c.fillText('EF', R - 13, Y(0) + 9);
      c.fillStyle = Q.text; c.textAlign = 'center';
      c.fillText('slab', X(zs / 2), h - 3); c.fillText('vacuum  z →', X(14.3), h - 3);
      c.strokeStyle = Q.axis; c.beginPath(); c.moveTo(L, B + 0.5); c.lineTo(R, B + 0.5); c.stroke();
    }

    function render() {
      const dark = isDark();
      render3D(PAL[dark ? 'dark' : 'light']);
      const occ = sites.filter(s => s.occ).length;
      const th = occ / sites.length;
      if (thetaEl && occ !== lastTheta) { lastTheta = occ; thetaEl.textContent = th.toFixed(2); }
      const Q = PLOT[dark ? 'dark' : 'light'];
      const phi = 4.55 + 0.95 * thetaS;
      if (plots[0]) drawDOS(plots[0], Q, thetaS);
      if (plots[1]) drawWF(plots[1], Q, phi);
      if (phiEl) phiEl.textContent = phi.toFixed(2);
      if (tempEl) tempEl.textContent = Math.round(300 + 6 * Math.sin(clock * 1.7) + 4 * Math.sin(clock * 3.1 + 1));
      if (timeEl) timeEl.textContent = simT.toFixed(2);
    }

    // ── Interaction: drag to rotate, tap to dose ──
    let dragging = false, moved = 0, lx = 0, ly = 0;
    stage.addEventListener('pointerdown', e => {
      dragging = true; moved = 0; lx = e.clientX; ly = e.clientY;
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    });
    stage.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      yaw += dx * 0.01; yawVel = dx * 0.6;
      pitch = Math.max(0.2, Math.min(1.05, pitch + dy * 0.006));
    });
    function endDrag() { if (dragging && moved < 6) dose(); dragging = false; }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', () => { dragging = false; });

    // ── Loop (paused when off-screen or tab hidden) ──
    let visible = true, last = 0, raf = 0;
    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
      clock += dt;
      simT += dt * 0.25; if (simT >= 50) simT = 0;
      if (!dragging) { yawVel += (AUTO - yawVel) * Math.min(1, dt * 1.5); yaw += yawVel * dt; }
      mobiles.forEach(m => update(m, dt));
      for (let n = flashes.length - 1; n >= 0; n--) { flashes[n].t += dt / 0.8; if (flashes[n].t >= 1) flashes.splice(n, 1); }
      thetaS += (coverage() - thetaS) * Math.min(1, dt * 2.2);
      stepSCF(dt);
      render();
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { visible = es[0].isIntersecting; kick(); }).observe(stage);
    }
    document.addEventListener('visibilitychange', kick);
    yawVel = AUTO;
    kick();
  }

  initCrystalAnimation();

  // 7. Full-Website Dynamic Particle Flow System (Fluid Streamlines, Vortex Dynamics & Crystal Bridge)
  function initGlobalParticleFlow() {
    const canvas = document.getElementById('bg-particle-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? 48 : 95;
    const linkDistance = isMobile ? 95 : 135;
    const linkDistSq = linkDistance * linkDistance;

    // Multi-tone color palette for richer particle visuals
    var colorPalette = [
      { name: 'emerald',  dR: 78,  dG: 237, dB: 168, lR: 5,   lG: 150, lB: 105 },
      { name: 'cyan',     dR: 56,  dG: 189, dB: 248, lR: 2,   lG: 132, lB: 199 },
      { name: 'gold',     dR: 251, dG: 191, dB: 36,  lR: 217, lG: 119, lB: 6   },
      { name: 'violet',   dR: 167, dG: 139, dB: 250, lR: 124, lG: 58,  lB: 237 },
      { name: 'rose',     dR: 251, dG: 113, dB: 133, lR: 225, lG: 29,  lB: 72  },
      { name: 'teal',     dR: 45,  dG: 212, dB: 191, lR: 13,  lG: 148, lB: 136 }
    ];

    const particles = [];
    for (let i = 0; i < particleCount; i++) {
      const depth = Math.random();
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8 - 0.25,
        radius: depth > 0.7 ? (2.0 + Math.random() * 1.6) : (1.0 + Math.random() * 1.2),
        depth: depth,
        baseAlpha: 0.25 + depth * 0.5,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.035,
        flowSeed: Math.random() * 1000,
        colorIdx: Math.floor(Math.random() * colorPalette.length)
      });
    }

    // High-Energy Particles Emitted from Crystal
    const emittedSparks = [];
    const MAX_SPARKS = 36;

    crystalBridge.emitBurst = function(cx, cy, count, strength) {
      shockwaves.push({
        x: cx,
        y: cy,
        radius: 10,
        maxRadius: Math.max(width, height) * 0.42,
        strength: strength || 3.2,
        alpha: 0.85
      });

      const n = count || 20;
      for (let i = 0; i < n; i++) {
        if (emittedSparks.length >= MAX_SPARKS) emittedSparks.shift();
        const ang = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
        const spd = 3.2 + Math.random() * 5.2;
        emittedSparks.push({
          x: cx + Math.cos(ang) * (crystalBridge.radius * 0.5),
          y: cy + Math.sin(ang) * (crystalBridge.radius * 0.5),
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          radius: 1.8 + Math.random() * 1.8,
          life: 1.0,
          decay: 0.012 + Math.random() * 0.014,
          colorType: ['primary', 'secondary', 'tertiary'][Math.floor(Math.random() * 3)],
          trail: []
        });
      }
    };

    let streamThrottle = 0;
    crystalBridge.emitStream = function(sx, sy, vx, vy, intensity) {
      streamThrottle++;
      if (streamThrottle % 2 !== 0) return;
      if (emittedSparks.length >= MAX_SPARKS) emittedSparks.shift();
      emittedSparks.push({
        x: sx,
        y: sy,
        vx: vx * 0.85,
        vy: vy * 0.85,
        radius: 1.4 + Math.random() * 1.6,
        life: 1.0,
        decay: 0.015 + Math.random() * 0.018,
        colorType: ['primary', 'secondary', 'tertiary'][Math.floor(Math.random() * 3)],
        trail: []
      });
    };

    const mouse = { x: -9999, y: -9999, active: false, vx: 0, vy: 0, lastX: 0, lastY: 0 };
    const shockwaves = [];

    function updateMousePos(x, y) {
      mouse.vx = x - mouse.lastX;
      mouse.vy = y - mouse.lastY;
      mouse.lastX = x;
      mouse.lastY = y;
      mouse.x = x;
      mouse.y = y;
      mouse.active = true;
    }

    window.addEventListener('mousemove', function(e) {
      updateMousePos(e.clientX, e.clientY);
    });

    window.addEventListener('mouseleave', function() {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    });

    // Touch support for fluid mobile interaction
    window.addEventListener('touchstart', function(e) {
      if (e.touches && e.touches[0]) {
        updateMousePos(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', function(e) {
      if (e.touches && e.touches[0]) {
        updateMousePos(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', function() {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    });

    // Kinetic ripple shockwave on click / tap
    window.addEventListener('click', function(e) {
      shockwaves.push({
        x: e.clientX,
        y: e.clientY,
        radius: 0,
        maxRadius: isMobile ? 120 : 180,
        strength: 2.8,
        alpha: 0.6
      });
    });

    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var themeObs = new MutationObserver(function() {
      isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    let activeCardBox = null;
    function bindCardListeners() {
      const cards = document.querySelectorAll('.entry-card, .project-item, .pub-item, .skill-card');
      cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
          const rect = card.getBoundingClientRect();
          activeCardBox = {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom
          };
        });
        card.addEventListener('mouseleave', () => {
          activeCardBox = null;
        });
      });
    }
    bindCardListeners();

    var lastTime = performance.now();

    function render(now) {
      requestAnimationFrame(render);
      if (document.hidden) return;

      var dt = Math.min((now - lastTime) / 1000, 0.08);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      // Theme-adaptive radiant glow color spectrum (primary emerald + secondary teal)
      var prR = isDark ? 78 : 5;
      var prG = isDark ? 237 : 150;
      var prB = isDark ? 168 : 105;

      var secR = isDark ? 56 : 2;
      var secG = isDark ? 189 : 132;
      var secB = isDark ? 248 : 199;

      // Tertiary warm accent (gold)
      var terR = isDark ? 251 : 217;
      var terG = isDark ? 191 : 119;
      var terB = isDark ? 36 : 6;

      var time = now * 0.0012;

      // Update & draw shockwaves
      for (var s = shockwaves.length - 1; s >= 0; s--) {
        var sw = shockwaves[s];
        sw.radius += 240 * dt;
        sw.alpha *= 0.94;
        if (sw.radius > sw.maxRadius || sw.alpha < 0.02) {
          shockwaves.splice(s, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = 'rgba(' + prR + ', ' + prG + ', ' + prB + ', ' + (sw.alpha * 0.38) + ')';
        ctx.stroke();
      }

      // Update & draw High-Energy Crystal Emitted Sparks
      for (var eIdx = emittedSparks.length - 1; eIdx >= 0; eIdx--) {
        var spk = emittedSparks[eIdx];
        spk.trail.push({ x: spk.x, y: spk.y });
        if (spk.trail.length > 5) spk.trail.shift();

        spk.x += spk.vx;
        spk.y += spk.vy;
        spk.vx *= 0.965;
        spk.vy *= 0.965;
        spk.life -= spk.decay;

        if (spk.life <= 0) {
          emittedSparks.splice(eIdx, 1);
          continue;
        }

        // Draw spark tail stream
        if (spk.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(spk.trail[0].x, spk.trail[0].y);
          for (var t = 1; t < spk.trail.length; t++) {
            ctx.lineTo(spk.trail[t].x, spk.trail[t].y);
          }
          ctx.lineTo(spk.x, spk.y);
          var sR = spk.colorType === 'tertiary' ? terR : (spk.colorType === 'secondary' ? secR : prR);
          var sG = spk.colorType === 'tertiary' ? terG : (spk.colorType === 'secondary' ? secG : prG);
          var sB = spk.colorType === 'tertiary' ? terB : (spk.colorType === 'secondary' ? secB : prB);
          ctx.strokeStyle = 'rgba(' + sR + ', ' + sG + ', ' + sB + ', ' + (spk.life * 0.5) + ')';
          ctx.lineWidth = spk.radius * 0.95;
          ctx.stroke();
        }

        // Draw spark radiant blooming glow
        var sR2 = spk.colorType === 'tertiary' ? terR : (spk.colorType === 'secondary' ? secR : prR);
        var sG2 = spk.colorType === 'tertiary' ? terG : (spk.colorType === 'secondary' ? secG : prG);
        var sB2 = spk.colorType === 'tertiary' ? terB : (spk.colorType === 'secondary' ? secB : prB);
        var sparkGrad = ctx.createRadialGradient(spk.x, spk.y, 0, spk.x, spk.y, spk.radius * 3.6);
        if (isDark) {
          sparkGrad.addColorStop(0, 'rgba(255, 255, 255, ' + (spk.life * 0.95) + ')');
          sparkGrad.addColorStop(0.35, 'rgba(' + sR2 + ', ' + sG2 + ', ' + sB2 + ', ' + (spk.life * 0.75) + ')');
          sparkGrad.addColorStop(1, 'rgba(' + sR2 + ', ' + sG2 + ', ' + sB2 + ', 0)');
        } else {
          sparkGrad.addColorStop(0, 'rgba(' + sR2 + ', ' + sG2 + ', ' + sB2 + ', ' + (spk.life * 0.85) + ')');
          sparkGrad.addColorStop(0.5, 'rgba(' + sR2 + ', ' + sG2 + ', ' + sB2 + ', ' + (spk.life * 0.4) + ')');
          sparkGrad.addColorStop(1, 'rgba(' + sR2 + ', ' + sG2 + ', ' + sB2 + ', 0)');
        }
        ctx.beginPath();
        ctx.arc(spk.x, spk.y, spk.radius * 3.6, 0, Math.PI * 2);
        ctx.fillStyle = sparkGrad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(spk.x, spk.y, spk.radius, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? 'rgba(255, 255, 255, ' + spk.life + ')'
          : 'rgba(' + prR + ', ' + prG + ', ' + prB + ', ' + spk.life + ')';
        ctx.fill();
      }

      // 1. Update and Draw Fluid Particles
      for (var i = 0; i < particleCount; i++) {
        var p = particles[i];

        // Harmonic Curvature Flow Field (Fluid Streamlines)
        var flowAngle = Math.sin(p.x * 0.0016 + time * 0.6) * Math.cos(p.y * 0.0016 + time * 0.5) * Math.PI * 2;
        p.vx += Math.cos(flowAngle) * 0.038;
        p.vy += (Math.sin(flowAngle) * 0.038) - 0.012; // Natural upward buoyancy drift

        // Synchronized Crystal Vortex & Laminar Deflection
        if (crystalBridge.center.x > 0) {
          var cdx = p.x - crystalBridge.center.x;
          var cdy = p.y - crystalBridge.center.y;
          var cDistSq = cdx * cdx + cdy * cdy;
          var cInfluenceRadius = crystalBridge.radius * 2.2;
          if (cDistSq < cInfluenceRadius * cInfluenceRadius && cDistSq > 0) {
            var cDist = Math.sqrt(cDistSq);
            var cNormX = cdx / cDist;
            var cNormY = cdy / cDist;
            var cProx = (1 - cDist / cInfluenceRadius);

            if (crystalBridge.isInteracting || crystalBridge.spinIntensity > 0.005) {
              var swirlForce = (crystalBridge.spinIntensity * 45 + 0.35) * cProx;
              p.vx += -cNormY * swirlForce;
              p.vy += cNormX * swirlForce;
            } else {
              p.vx += cNormX * cProx * 0.35;
              p.vy += cNormY * cProx * 0.35;
            }
          }
        }

        // Interactive Fluid Vortex Dynamics with Mouse/Touch
        if (mouse.active) {
          var dx = p.x - mouse.x;
          var dy = p.y - mouse.y;
          var distSq = dx * dx + dy * dy;
          var mouseRadius = 160;
          if (distSq < mouseRadius * mouseRadius && distSq > 0) {
            var dist = Math.sqrt(distSq);
            var normX = dx / dist;
            var normY = dy / dist;
            var prox = (1 - dist / mouseRadius);

            p.vx += normX * prox * 1.4;
            p.vy += normY * prox * 1.4;

            p.vx += -normY * prox * 0.95;
            p.vy += normX * prox * 0.95;
          }
        }

        // Apply Shockwave impulses
        for (var swIdx = 0; swIdx < shockwaves.length; swIdx++) {
          var w = shockwaves[swIdx];
          var swDx = p.x - w.x;
          var swDy = p.y - w.y;
          var swDist = Math.sqrt(swDx * swDx + swDy * swDy);
          var swDiff = Math.abs(swDist - w.radius);
          if (swDiff < 30 && swDist > 0) {
            var waveForce = (1 - swDiff / 30) * w.strength * w.alpha;
            p.vx += (swDx / swDist) * waveForce * 0.7;
            p.vy += (swDy / swDist) * waveForce * 0.7;
          }
        }

        // Viscous Fluid Damping
        p.vx *= 0.965;
        p.vy *= 0.965;

        p.x += p.vx;
        p.y += p.vy;

        // Smooth Toroidal Screen Wrapping
        if (p.x < -20) p.x = width + 20;
        else if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        else if (p.y > height + 20) p.y = -20;

        // Particle Breathing Pulse
        p.phase += p.pulseSpeed;
        var pulse = 0.82 + Math.sin(p.phase) * 0.28;
        var alpha = Math.min(p.baseAlpha * pulse, 0.9);
        var r = p.radius * pulse;

        // Per-particle color from multi-tone palette
        var pc = colorPalette[p.colorIdx];
        var pR = isDark ? pc.dR : pc.lR;
        var pG = isDark ? pc.dG : pc.lG;
        var pB = isDark ? pc.dB : pc.lB;

        // Draw Soft Glow Halo for Foreground Atoms (Theme-Synchronized)
        if (p.depth > 0.65) {
          var glowRadius = r * (isDark ? 3.2 : 2.6);
          var glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
          glowGrad.addColorStop(0, 'rgba(' + pR + ', ' + pG + ', ' + pB + ', ' + (alpha * 0.52) + ')');
          glowGrad.addColorStop(0.5, 'rgba(' + pR + ', ' + pG + ', ' + pB + ', ' + (alpha * 0.15) + ')');
          glowGrad.addColorStop(1, 'rgba(' + pR + ', ' + pG + ', ' + pB + ', 0)');
          ctx.beginPath();
          ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
          ctx.fillStyle = glowGrad;
          ctx.fill();
        }

        // Core Particle Atom
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + pR + ', ' + pG + ', ' + pB + ', ' + alpha + ')';
        ctx.fill();
      }

      // 2. Draw Interconnecting Molecular Bond Constellation Lines
      ctx.lineWidth = 0.85;
      for (var j = 0; j < particleCount; j++) {
        var p1 = particles[j];
        var pc1 = colorPalette[p1.colorIdx];
        var lnR = isDark ? pc1.dR : pc1.lR;
        var lnG = isDark ? pc1.dG : pc1.lG;
        var lnB = isDark ? pc1.dB : pc1.lB;
        for (var k = j + 1; k < particleCount; k++) {
          var p2 = particles[k];
          var ldx = p1.x - p2.x;
          var ldy = p1.y - p2.y;
          var ldistSq = ldx * ldx + ldy * ldy;

          if (ldistSq < linkDistSq) {
            var ldist = Math.sqrt(ldistSq);
            var lineAlpha = (1 - ldist / linkDistance) * (isDark ? 0.28 : 0.18);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = 'rgba(' + lnR + ', ' + lnG + ', ' + lnB + ', ' + lineAlpha + ')';
            ctx.stroke();
          }
        }

        // Active Magnetic Beam to Cursor / Touch
        if (mouse.active) {
          var mdx = p1.x - mouse.x;
          var mdy = p1.y - mouse.y;
          var mdistSq = mdx * mdx + mdy * mdy;
          var mouseLinkDist = 145;
          if (mdistSq < mouseLinkDist * mouseLinkDist) {
            var mdist = Math.sqrt(mdistSq);
            var mAlpha = (1 - mdist / mouseLinkDist) * (isDark ? 0.45 : 0.32);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = 'rgba(' + prR + ', ' + prG + ', ' + prB + ', ' + mAlpha + ')';
            ctx.lineWidth = 1.1;
            ctx.stroke();
            ctx.lineWidth = 0.85;
          }
        }

        // Crystal Flow Expansion: Energetic Constellation Rays to Hovered Content Cards
        if (activeCardBox) {
          var cNearX = Math.max(activeCardBox.left, Math.min(p1.x, activeCardBox.right));
          var cNearY = Math.max(activeCardBox.top, Math.min(p1.y, activeCardBox.bottom));
          var cdx = p1.x - cNearX;
          var cdy = p1.y - cNearY;
          var cardDistSq = cdx * cdx + cdy * cdy;
          var cardLinkDist = 125;
          if (cardDistSq < cardLinkDist * cardLinkDist) {
            var cDist = Math.sqrt(cardDistSq);
            var cardRayAlpha = (1 - cDist / cardLinkDist) * (isDark ? 0.36 : 0.22);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(cNearX, cNearY);
            ctx.strokeStyle = 'rgba(' + secR + ', ' + secG + ', ' + secB + ', ' + cardRayAlpha + ')';
            ctx.lineWidth = 1.0;
            ctx.stroke();
            ctx.lineWidth = 0.85;
          }
        }
      }
    }

    render(performance.now());
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initGlobalParticleFlow);
  } else {
    initGlobalParticleFlow();
  }

  // 8. Dynamic Page Visitor Counter
  function initVisitorCounter() {
    var visitorEl = document.getElementById('visitor-count');
    var footerVisitorEl = document.getElementById('footer-visitor-count');
    if (!visitorEl && !footerVisitorEl) return;

    var CACHE_KEY = 'kgs_portfolio_visits';
    var SESSION_KEY = 'kgs_session_counted';

    var localCount = parseInt(localStorage.getItem(CACHE_KEY), 10);
    if (!localCount || isNaN(localCount)) {
      localCount = 184;
      localStorage.setItem(CACHE_KEY, localCount);
    }

    if (!sessionStorage.getItem(SESSION_KEY)) {
      localCount += 1;
      localStorage.setItem(CACHE_KEY, localCount);
      sessionStorage.setItem(SESSION_KEY, 'true');
    }

    function displayCount(num) {
      var formatted = Number(num).toLocaleString();
      if (visitorEl) visitorEl.textContent = formatted;
      if (footerVisitorEl) footerVisitorEl.textContent = formatted;
    }

    displayCount(localCount);

    var badgeUrl = 'https://api.visitorbadge.io/api/visitors?path=kristy10.github.io.kristy-gourab-sinha&countColor=%23263759';
    fetch(badgeUrl)
      .then(function(res) { return res.text(); })
      .then(function(svgText) {
        var match = svgText.match(/VISITORS:\s*([\d,]+)/i);
        if (match && match[1]) {
          var apiCount = parseInt(match[1].replace(/,/g, ''), 10);
          if (apiCount && !isNaN(apiCount)) {
            var finalCount = apiCount + 180;
            localStorage.setItem(CACHE_KEY, finalCount);
            displayCount(finalCount);
          }
        }
      })
      .catch(function(err) {
        // Fallback gracefully to local stored metric
      });
  }

  // 9. Responsive Contact Form (FormSubmit to Inbox)
  function initContactForm() {
    var form = document.getElementById('contact-form');
    var statusEl = document.getElementById('form-status');
    var submitBtn = document.getElementById('contact-submit-btn');
    if (!form || !statusEl || !submitBtn) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var btnText = submitBtn.querySelector('.btn-text');
      var originalText = btnText ? btnText.textContent : 'Send Message';

      if (btnText) btnText.textContent = 'Sending to Kristy...';
      submitBtn.disabled = true;
      statusEl.className = 'form-status';
      statusEl.style.display = 'none';
      statusEl.textContent = '';

      var formData = new FormData(form);

      fetch(form.action, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      })
      .then(function (response) {
        if (response.ok) {
          form.reset();
          statusEl.className = 'form-status success';
          statusEl.style.display = 'block';
          statusEl.textContent = '✓ Thank you! Your message has been sent directly to Kristy\'s inbox. You will receive a response shortly.';
          if (typeof showToast === 'function') {
            showToast('Message sent to Kristy\'s inbox!');
          }
        } else {
          throw new Error('Form response not ok');
        }
      })
      .catch(function (err) {
        // Submit standard HTML form if fetch blocked
        form.submit();
      })
      .finally(function () {
        submitBtn.disabled = false;
        if (btnText) btnText.textContent = originalText;
      });
    });
  }

  // 10. Dennis Snellenberg Magnetic Button Physics
  function initMagneticButtons() {
    if (window.matchMedia('(hover: none)').matches) return;
    const magneticEls = document.querySelectorAll('.pill-link, .btn-cv-sm, #theme-toggle, .visitor-counter-pill, .btn-submit, .filter-btn');

    magneticEls.forEach(el => {
      const strength = 0.35;
      const textStrength = 0.18;
      const innerText = el.querySelector('span, svg, .btn-text') || null;

      el.addEventListener('mouseenter', () => {
        el.style.transition = 'transform 0.12s cubic-bezier(0.22, 1, 0.36, 1)';
      });

      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = (e.clientX - centerX) * strength;
        const dy = (e.clientY - centerY) * strength;

        el.style.transform = `translate(${dx}px, ${dy}px)`;
        if (innerText) {
          innerText.style.transform = `translate(${dx * textStrength}px, ${dy * textStrength}px)`;
        }
      });

      el.addEventListener('mouseleave', () => {
        el.style.transition = 'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)';
        el.style.transform = 'translate(0px, 0px)';
        if (innerText) {
          innerText.style.transition = 'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)';
          innerText.style.transform = 'translate(0px, 0px)';
        }
      });
    });
  }

  // 12. Dennis Snellenberg Top Scroll Progress Hairline
  function initScrollProgress() {
    const bar = document.getElementById('scroll-progress');
    if (!bar) return;
    function updateProgress() {
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
      bar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  // 13. jhey.dev 3D Tilt Cards with Dynamic Specular Glare
  function init3DTiltCards() {
    if (window.matchMedia('(hover: none)').matches) return;
    const cards = document.querySelectorAll('.entry-card, .project-item, .pub-item, .skill-card, .ref-card');

    cards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotX = ((y - centerY) / centerY) * -3.2;
        const rotY = ((x - centerX) / centerX) * 3.2;

        card.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateY(-2px)`;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
      });
    });
  }

  // 14. Victor Dibia Animated Metrics Count-Up
  function initMetricCounters() {
    const metricValues = document.querySelectorAll('.metric-value');
    if (!metricValues.length || !('IntersectionObserver' in window)) return;

    let hasAnimated = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            hasAnimated = true;
            metricValues.forEach((el) => {
              const target = parseInt(el.textContent.trim(), 10);
              if (isNaN(target)) return;
              const duration = 1200;
              const startTime = performance.now();

              function countStep(now) {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = Math.round(eased * target);
                el.textContent = current < 10 ? `0${current}` : `${current}`;
                if (progress < 1) {
                  requestAnimationFrame(countStep);
                } else {
                  el.textContent = target < 10 ? `0${target}` : `${target}`;
                }
              }
              requestAnimationFrame(countStep);
            });
            observer.disconnect();
          }
        });
      },
      { threshold: 0.25 }
    );

    const metricsContainer = document.querySelector('.metrics-grid');
    if (metricsContainer) observer.observe(metricsContainer);
  }

  function initAllFeatures() {
    initVisitorCounter();
    initContactForm();
    initMagneticButtons();
    initScrollProgress();
    init3DTiltCards();
    initMetricCounters();
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initAllFeatures);
  } else {
    initAllFeatures();
  }
})();
