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
  // Hero visual: schematic DFT (CASTEP-style) surface workflow, looped
  //   0 SC cell   – simple cubic unit cell pops in
  //   1 Supercell – cell is repeated into a 2×2×2 supercell
  //   2 Slab      – (001) slab is cleaved and a vacuum gap opens
  //   3 Relax ✓   – BFGS relaxation until |F|max converges (check)
  //   4 Adsorb    – AIMD: gas atoms land in 4-fold hollows, Δρ lobes
  // Live PDOS and planar-averaged potential (work function) panels follow
  // each stage. Drag to rotate · tap to advance / dose gas · click a step.
  // ═══════════════════════════════════════════════════════════════════
  function initCrystalAnimation() {
    const canvas = document.getElementById('crystal-canvas');
    const stage = document.getElementById('crystal-stage');
    if (!canvas || !stage || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const $ = id => document.getElementById(id);
    const wrap = stage.closest('.crystal-hero-wrapper') || stage;
    const thetaEl = $('crystal-theta'), phiEl = $('dft-phi'), infoEl = $('dft-info');
    const scfN = $('dft-scf-n'), scfDE = $('dft-scf-de'), scfDot = $('dft-scf-dot');
    const tempEl = $('dft-temp'), timeEl = $('dft-time'), barEl = $('dft-step-bar');
    const stepEls = Array.from(wrap.querySelectorAll('.dft-step'));
    const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const TAU = Math.PI * 2;
    const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
    const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
    const ease = u => u * u * (3 - 2 * u);
    const easeBack = u => { const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
    const lerp = (a, b, t) => a + (b - a) * t;
    const rnd = (a, b) => a + Math.random() * (b - a);

    // ── Canvas sizing ──
    let W = 1, H = 1, A = 40;
    function fit(cv, c2) {
      const r = cv.getBoundingClientRect();
      const w = Math.max(1, r.width), h = Math.max(1, r.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      return [w, h];
    }
    function resize() { [W, H] = fit(canvas, ctx); A = Math.max(18, Math.min((W - 30) / 3.9, (H - 96) / 4.9)); }
    resize();
    const plots = [$('dft-dos'), $('dft-wf')].filter(Boolean).map(cv => ({ cv, c: cv.getContext('2d'), w: 1, h: 1 }));
    plots.forEach(p => { [p.w, p.h] = fit(p.cv, p.c); });
    if ('ResizeObserver' in window) {
      new ResizeObserver(resize).observe(stage);
      plots.forEach(p => new ResizeObserver(() => { [p.w, p.h] = fit(p.cv, p.c); }).observe(p.cv));
    } else window.addEventListener('resize', () => { resize(); plots.forEach(p => { [p.w, p.h] = fit(p.cv, p.c); }); });

    // ── Geometry: simple cubic, 3×3×3 lattice points (2×2×2 cells) ──
    const N = 3, HALF = 1, TOP = 1, H_ADS = 0.4;
    const atoms = [], edges = [], sites = [];
    const aIdx = (i, j, k) => (j * N + i) * N + k;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++)
        for (let k = 0; k < N; k++) {
          const unit = i < 2 && j < 2 && k < 2;
          const ui = Math.min(i, 1), uj = Math.min(j, 1), uk = Math.min(k, 1);
          atoms.push({
            tx: i - HALF, ty: TOP - j, tz: k - HALF,                  // lattice position in the slab
            sx: ui - 0.5, sy: 0.5 - uj, sz: uk - 0.5,                 // position inside the lone unit cell
            unit, top: j === 0, pop: (ui + uj * 2 + uk * 4) * 0.13,   // pop-in order of the 8 corners
            delay: (Math.abs(i - 0.5) + Math.abs(j - 0.5) + Math.abs(k - 0.5) - 1.5) * 0.3,
            p1: rnd(0, TAU), p2: rnd(0, TAU), p3: rnd(0, TAU), w: rnd(5, 8), kick: 9,
            x: 0, y: 0, z: 0, s: 0
          });
        }
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++)
        for (let k = 0; k < N; k++) {
          if (i < N - 1) edges.push([aIdx(i, j, k), aIdx(i + 1, j, k)]);
          if (k < N - 1) edges.push([aIdx(i, j, k), aIdx(i, j, k + 1)]);
          if (j < N - 1) edges.push([aIdx(i, j, k), aIdx(i, j + 1, k)]);
        }
    for (let i = 0; i < N - 1; i++)
      for (let k = 0; k < N - 1; k++)
        sites.push({ i, k, x: i - HALF + 0.5, y: TOP + H_ADS, z: k - HALF + 0.5, occ: null, res: null,
          nb: [aIdx(i, 0, k), aIdx(i + 1, 0, k), aIdx(i, 0, k + 1), aIdx(i + 1, 0, k + 1)] });

    // ── Workflow phases ──
    const PH = [
      { d: 3.4, info: 'Pm-3m · a = 3.35 Å' },
      { d: 3.0, info: '2×2×2 supercell · 27 atoms' },
      { d: 3.0, info: '(001) slab · 15 Å vacuum' },
      { d: 5.0, info: 'BFGS relaxation…' },
      { d: 24,  info: 'dosing gas…' }
    ];
    let ph = 0, pt = 0, fadeOut = 0;
    let zoom = 1.5, TY = 0, yaw = 0.62, pitch = 0.5, yawVel = 0;
    let boxA = 0, boxTop = 1.3, vac = 0, surfMix = 0, relaxDy = 0, fmax = 1, thetaS = 0, phiSettle = 0;
    let simT = 0, clock = 0, eads = null;
    const AUTO = reduceMotion ? 0.06 : 0.24;
    const BX = 1.5, BOT = -1.3, TOPV = 2.95;
    let mobiles = [], flashes = [], sparks = [];

    function setInfo(t, ok) { if (infoEl) { infoEl.textContent = t; infoEl.classList.toggle('ok', !!ok); } }
    function resetAll() {
      sites.forEach(s => { s.occ = null; s.res = null; });
      mobiles = []; flashes = []; sparks = []; thetaS = 0; eads = null; fadeOut = 0;
      boxA = 0; boxTop = 1.3; vac = 0; surfMix = 0; relaxDy = 0; fmax = 1; simT = 0;
    }
    function setPhase(n) {
      ph = n; pt = 0;
      setInfo(PH[n].info);
      if (n === 0) resetAll();
      if (n === 4) {
        mobiles = Array.from({ length: 5 }, () => makeGas(true));
      }
      startSCF();
      stepEls.forEach((el, i) => { el.classList.toggle('on', i === n); el.classList.toggle('done', i < n); });
    }

    // ── SCF bookkeeping ──
    const scf = { n: 0, target: 14, t: 0, run: false, de: 0 };
    function startSCF() {
      scf.run = true; scf.n = 0; scf.t = 0; scf.target = 10 + Math.floor(Math.random() * 8);
      if (scfDot) scfDot.classList.add('run');
    }
    function stepSCF(dt) {
      if (!scf.run) return;
      scf.t += dt;
      while (scf.t > 0.07 && scf.n < scf.target) {
        scf.t -= 0.07; scf.n++;
        scf.de = Math.pow(10, -(0.3 + scf.n * 0.43)) * rnd(0.6, 1.6);
      }
      if (scf.n >= scf.target) {
        scf.run = false;
        if (scfDot) scfDot.classList.remove('run');
        if (ph === 4 && eads !== null) setInfo('E_ads = −' + Math.abs(eads).toFixed(2) + ' eV');
      }
      if (scfN) scfN.textContent = scf.n;
      if (scfDE) scfDE.textContent = scf.n ? scf.de.toExponential(1) : '—';
    }

    // ── Adsorbates ──
    const GAS = { x: 1.0, yMin: 1.95, yMax: 2.6 };
    function makeGas(fresh) {
      return {
        x: rnd(-GAS.x, GAS.x), y: rnd(GAS.yMin, GAS.yMax), z: rnd(-GAS.x, GAS.x),
        vx: rnd(-0.6, 0.6), vy: rnd(-0.2, 0.2), vz: rnd(-0.6, 0.6),
        state: 'gas', timer: fresh ? rnd(0.5, 2.6) : rnd(1.5, 4), mix: 0, site: null, t: 0, dur: 1, from: null,
        bond: 0, ph: rnd(0, TAU), born: 0, trail: []
      };
    }
    const freeSites = () => sites.filter(s => !s.occ && !s.res);
    const coverage = () => sites.filter(s => s.occ).length / sites.length;
    function startMove(m, site, state, dur) { m.state = state; m.site = site; m.t = 0; m.dur = dur; m.from = { x: m.x, y: m.y, z: m.z }; site.res = m; }
    function land(m, big) {
      const s = m.site; s.res = null; s.occ = m;
      m.state = 'ads'; m.x = s.x; m.y = s.y; m.z = s.z; m.timer = rnd(4, 9);
      flashes.push({ x: s.x, z: s.z, t: 0, big });
      if (big) {
        s.nb.forEach(ix => { atoms[ix].kick = 0; });
        for (let n = 0; n < 12; n++) {
          const a = n / 12 * TAU + rnd(-0.2, 0.2), sp = rnd(0.6, 1.3);
          sparks.push({ x: s.x, y: s.y, z: s.z, vx: Math.cos(a) * sp, vy: rnd(0.6, 1.4), vz: Math.sin(a) * sp, life: 1 });
        }
        eads = -1.62 + 0.36 * coverage() + rnd(-0.05, 0.05);
        startSCF();
      }
    }
    function seek(m) {
      const fs = freeSites(); if (!fs.length) { m.timer = rnd(0.6, 1.5); return; }
      fs.sort((a, b) => ((a.x - m.x) ** 2 + (a.z - m.z) ** 2) - ((b.x - m.x) ** 2 + (b.z - m.z) ** 2));
      startMove(m, fs[Math.random() < 0.7 ? 0 : Math.floor(Math.random() * fs.length)], 'approach', rnd(0.8, 1.2));
    }
    function updateMobile(m, dt) {
      m.born = Math.min(1, m.born + dt * 2.5);
      m.mix += (((m.state === 'ads' || m.state === 'hop') ? 1 : 0) - m.mix) * Math.min(1, dt * 5);
      m.bond += ((m.state === 'ads' ? 1 : 0) - m.bond) * Math.min(1, dt * 6);
      m.ph += dt * 9;
      if (m.state === 'gas') {
        m.vx += rnd(-1, 1) * dt * 1.8; m.vy += rnd(-1, 1) * dt * 1.0; m.vz += rnd(-1, 1) * dt * 1.8;
        const sp = Math.hypot(m.vx, m.vy, m.vz), max = 0.85;
        if (sp > max) { m.vx *= max / sp; m.vy *= max / sp; m.vz *= max / sp; }
        m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
        if (Math.abs(m.x) > GAS.x) { m.x = Math.sign(m.x) * GAS.x; m.vx *= -1; }
        if (Math.abs(m.z) > GAS.x) { m.z = Math.sign(m.z) * GAS.x; m.vz *= -1; }
        if (m.y > GAS.yMax) { m.y = GAS.yMax; m.vy = -Math.abs(m.vy); }
        if (m.y < GAS.yMin) m.vy += dt * 3;
        if ((m.timer -= dt) <= 0) seek(m);
      } else if (m.state === 'approach' || m.state === 'hop') {
        m.t += dt / m.dur;
        const u = Math.min(1, m.t), s = m.site, f = m.from;
        if (m.state === 'approach') {
          const e = Math.pow(u, 1.8), c = { x: s.x, y: Math.max(f.y, s.y + 0.9), z: s.z };
          const a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, d = e * e;
          m.x = a * f.x + b * c.x + d * s.x; m.y = a * f.y + b * c.y + d * s.y; m.z = a * f.z + b * c.z + d * s.z;
        } else {
          const e = ease(u);
          m.x = f.x + (s.x - f.x) * e; m.z = f.z + (s.z - f.z) * e; m.y = s.y + Math.sin(Math.PI * e) * 0.34;
        }
        if (u >= 1) land(m, m.state === 'approach');
      } else if (m.state === 'ads') {
        m.y = m.site.y + relaxDy + Math.sin(m.ph) * 0.024;
        if ((m.timer -= dt) <= 0) {
          m.site.occ = null; m.site = null;
          m.state = 'gas'; m.vy = rnd(1.0, 1.4); m.vx = rnd(-0.4, 0.4); m.vz = rnd(-0.4, 0.4); m.timer = rnd(2, 4.5);
        } else if (Math.random() < dt * 0.12) {
          const nbs = sites.filter(s => !s.occ && !s.res && Math.abs(s.i - m.site.i) + Math.abs(s.k - m.site.k) === 1);
          if (nbs.length) { const to = nbs[Math.floor(Math.random() * nbs.length)]; m.site.occ = null; startMove(m, to, 'hop', 0.55); }
        }
      }
      m.trail.push({ x: m.x, y: m.y, z: m.z });
      if (m.trail.length > 12) m.trail.shift();
    }
    function dose() { mobiles.forEach(m => { if (m.state === 'gas') m.timer = rnd(0, 0.3); }); }

    // ── Per-frame physics of the build/relax stages ──
    function stepWorld(dt) {
      pt += dt;
      const d = PH[ph].d, u = clamp(pt / d);
      const zT = [1.55, 1.02, 0.94, 0.94, 0.94][ph];
      const tyT = ph < 2 ? 0 : (BOT + TOPV) / 2;
      zoom += (zT - zoom) * Math.min(1, dt * 2.2);
      TY += (tyT - TY) * Math.min(1, dt * 2.2);
      if (ph === 1) boxA = ease(clamp(u * 1.6 - 0.4));
      if (ph >= 2) boxA = 1;
      if (ph === 2) { vac = ease(clamp(u * 1.25)); boxTop = lerp(1.3, TOPV, vac); surfMix = vac; }
      if (ph >= 3) { vac = 1; boxTop = TOPV; surfMix = 1; }
      if (ph === 3) {
        const t = pt;
        relaxDy = -0.07 * (1 - Math.exp(-2.4 * t)) + 0.06 * Math.exp(-1.8 * t) * Math.sin(8 * t);
        fmax = 0.85 * Math.exp(-1.3 * t) + 0.012;
        phiSettle = 0.7 * Math.exp(-1.3 * t) * Math.cos(6 * t);
        const step = Math.min(18, 1 + Math.floor(t / 0.24));
        if (fmax > 0.03) setInfo('BFGS ' + step + ' · |F|max ' + fmax.toFixed(3) + ' eV/Å');
        else setInfo('✓ converged · |F|max ' + fmax.toFixed(3), true);
      } else if (ph < 3) { relaxDy = 0; phiSettle = 0; }
      else { phiSettle = 0; relaxDy = -0.07; }
      if (ph === 4) {
        mobiles.forEach(m => updateMobile(m, dt));
        thetaS += (coverage() - thetaS) * Math.min(1, dt * 2.4);
      }
      for (let n = flashes.length - 1; n >= 0; n--) { flashes[n].t += dt / 0.8; if (flashes[n].t >= 1) flashes.splice(n, 1); }
      for (let n = sparks.length - 1; n >= 0; n--) {
        const s = sparks[n]; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vy -= dt * 3; s.life -= dt / 0.75;
        if (s.life <= 0) sparks.splice(n, 1);
      }
      atoms.forEach(a => { a.kick += dt; });
      // atom positions for this frame
      const amp = reduceMotion ? 0.01 : [0.012, 0.014, 0.018, 0.024, 0.036][ph];
      atoms.forEach(a => {
        let x, y, z, s;
        if (ph === 0) {
          x = a.sx; y = a.sy; z = a.sz;
          s = a.unit ? easeBack(clamp((pt - a.pop) / 0.45)) : 0;
        } else if (ph === 1) {
          const v = clamp(u * 1.75 - a.delay), e = ease(v);
          x = lerp(a.sx, a.tx, e); y = lerp(a.sy, a.ty, e); z = lerp(a.sz, a.tz, e);
          s = a.unit ? 1 : clamp(v * 3);
        } else { x = a.tx; y = a.ty; z = a.tz; s = 1; }
        if (a.top && ph >= 3) y += relaxDy;
        if (a.kick < 1.5) y -= 0.09 * Math.exp(-4 * a.kick) * Math.cos(16 * a.kick);
        x += amp * Math.sin(clock * a.w + a.p1);
        y += amp * 0.8 * Math.sin(clock * a.w * 1.13 + a.p2);
        z += amp * Math.sin(clock * a.w * 0.91 + a.p3);
        a.x = x; a.y = y; a.z = z; a.s = s;
      });
      if (pt >= d) {
        if (ph < 4) setPhase(ph + 1);
        else if (fadeOut === 0) fadeOut = 0.0001;
      }
      if (fadeOut > 0) { fadeOut += dt / 0.9; if (fadeOut >= 1) { fadeOut = 0; setPhase(0); } }
    }

    // ── Camera ──
    function project(x, y, z) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
      const yy = y - TY;
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const y2 = yy * cp + z1 * sp, z2 = -yy * sp + z1 * cp;
      const F = 10, s = A * zoom * F / (F + z2);
      return { sx: W / 2 + x1 * s, sy: H / 2 + 4 - y2 * s, z: z2, s };
    }

    // ── Palette ──
    function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    function mixc(a, b, t) { return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')'; }
    const PAL = {
      light: {
        host: ['#3b6fe0', '#eaf1ff', '#16348f'], surf: ['#7c4ddb', '#f3ecff', '#3b1a8f'],
        gas: ['#f59e0b', '#fff6dc', '#b45309'], ads: ['#e11d48', '#ffe4ea', '#881337'],
        edge: '59,92,190', edgeA: 0.42, box: '124,58,237', site: '5,150,105', shadow: '15,23,42', glow: '225,29,72',
        rhoP: '234,179,8', rhoM: '6,182,212', text: '#64748b', ok: '#059669', bg: '#f6f8fb'
      },
      dark: {
        host: ['#6d8ff7', '#f0f4ff', '#26409e'], surf: ['#a78bfa', '#faf5ff', '#5b21b6'],
        gas: ['#fbbf24', '#fff8e3', '#b45309'], ads: ['#fb7185', '#fff1f2', '#9f1239'],
        edge: '165,180,252', edgeA: 0.34, box: '196,181,253', site: '52,211,153', shadow: '0,0,0', glow: '251,113,133',
        rhoP: '250,204,21', rhoM: '34,211,238', text: '#94a3b8', ok: '#34d399', bg: '#0e1016'
      }
    };
    for (const k in PAL) ['host', 'surf', 'gas', 'ads'].forEach(n => { PAL[k][n + 'RGB'] = PAL[k][n].map(hex); });

    // ── Drawing helpers ──
    function sphere(p, rU, pal, alpha) {
      const r = rU * p.s; if (r < 0.5) return;
      const g = ctx.createRadialGradient(p.sx - r * 0.38, p.sy - r * 0.42, r * 0.06, p.sx, p.sy, r);
      g.addColorStop(0, pal[1]); g.addColorStop(0.42, pal[0]); g.addColorStop(1, pal[2]);
      ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
    }
    function blob(p, rU, rgb, a) {
      const r = rU * p.s; if (r < 0.5 || a <= 0) return;
      const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r);
      g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(0.6, 'rgba(' + rgb + ',' + (a * 0.45) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, TAU); ctx.fill();
    }
    function ring(x, y, z, R, stroke, lw, dash) {
      ctx.beginPath();
      for (let n = 0; n <= 24; n++) { const t = n / 24 * TAU, q = project(x + Math.cos(t) * R, y, z + Math.sin(t) * R); n ? ctx.lineTo(q.sx, q.sy) : ctx.moveTo(q.sx, q.sy); }
      ctx.setLineDash(dash || []); ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); ctx.setLineDash([]);
    }
    const fade = z => Math.max(0.45, Math.min(1, 0.76 - z * 0.2));
    function line(p, q, style, lw, alpha, dash) {
      ctx.globalAlpha = alpha; ctx.setLineDash(dash || []); ctx.strokeStyle = style; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(q.sx, q.sy); ctx.stroke(); ctx.setLineDash([]);
    }

    // ── Render: 3D ──
    let lastTheta = -1;
    function render3D(P) {
      ctx.clearRect(0, 0, W, H);
      const master = fadeOut > 0 ? 1 - fadeOut : 1;
      const pa = atoms.map(a => project(a.x, a.y, a.z));
      const list = [];

      // periodic supercell box, growing a vacuum gap during the slab stage
      if (boxA > 0.01) {
        const by = [BOT, boxTop], c4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        const pb = []; by.forEach(y => c4.forEach(([a, b]) => pb.push(project(a * BX, y, b * BX))));
        [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([u, v]) => {
          const p = pb[u], q = pb[v];
          list.push({ z: (p.z + q.z) / 2 + 0.6, d: () => line(p, q, 'rgba(' + P.box + ',0.7)', 1, 0.8 * boxA * master, [4, 4]) });
        });
        if (vac > 0.05) {
          // shaded vacuum region + label
          const c1 = project(-BX, 1.35, BX), c2 = project(-BX, boxTop, BX);
          list.push({ z: -98, d: () => {
            ctx.globalAlpha = vac * master; ctx.fillStyle = P.text; ctx.font = '500 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'left'; ctx.fillText('vacuum 15 Å', c2.sx + 5, c2.sy + 12);
            ctx.strokeStyle = 'rgba(' + P.box + ',0.9)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(c1.sx - 4, c1.sy); ctx.lineTo(c2.sx - 4, c2.sy); ctx.stroke();
            [[c1.sy, -1], [c2.sy, 1]].forEach(([y, d]) => { ctx.beginPath(); ctx.moveTo(c1.sx - 7, y); ctx.lineTo(c1.sx - 1, y); ctx.stroke(); });
          } });
        }
      }

      edges.forEach(([u, v]) => {
        const a = atoms[u], b = atoms[v], s = Math.min(a.s, b.s);
        if (s < 0.05) return;
        if (ph === 0 && !(a.unit && b.unit)) return;
        const p = pa[u], q = pa[v];
        list.push({ z: (p.z + q.z) / 2, d: () => line(p, q, 'rgba(' + P.edge + ',' + P.edgeA + ')', Math.max(1, 0.05 * (p.s + q.s) / 2), fade((p.z + q.z) / 2) * clamp(s) * master) });
      });
      atoms.forEach((a, i) => {
        if (a.s < 0.02) return;
        const p = pa[i], pal = a.top ? [0, 1, 2].map(n => mixc(P.hostRGB[n], P.surfRGB[n], surfMix)) : P.host;
        list.push({ z: p.z, d: () => sphere(p, 0.2 * Math.max(0, a.s), pal, fade(p.z) * master) });
      });

      if (ph === 4) {
        sites.forEach(s => {
          if (s.occ) return;
          const c = project(s.x, TOP + relaxDy + 0.02, s.z), hot = !!s.res;
          list.push({ z: c.z + 0.05, d: () => { ctx.globalAlpha = fade(c.z) * master; ring(s.x, TOP + relaxDy + 0.02, s.z, 0.22, 'rgba(' + P.site + ',' + (hot ? 0.95 : 0.45) + ')', hot ? 1.6 : 1, hot ? [] : [3, 3]); } });
        });
        flashes.forEach(f => {
          const c = project(f.x, TOP + 0.02, f.z);
          list.push({ z: c.z + 0.04, d: () => { ctx.globalAlpha = (1 - f.t) * 0.9 * master; ring(f.x, TOP + relaxDy + 0.02, f.z, 0.15 + f.t * (f.big ? 0.75 : 0.4), 'rgba(' + P.glow + ',1)', 2, []); } });
        });
        sparks.forEach(s => {
          const p = project(s.x, s.y, s.z);
          list.push({ z: p.z - 0.02, d: () => { ctx.globalAlpha = Math.max(0, s.life) * master; ctx.fillStyle = 'rgb(' + P.rhoP + ')'; ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(1, 0.035 * p.s), 0, TAU); ctx.fill(); } });
        });
        mobiles.forEach(m => {
          const p = project(m.x, m.y, m.z);
          const col = [0, 1, 2].map(n => mixc(P.gasRGB[n], P.adsRGB[n], m.mix));
          if (m.state !== 'ads' && m.trail.length > 2) {
            const tp = m.trail.map(q => project(q.x, q.y, q.z));
            list.push({ z: p.z + 0.2, d: () => {
              for (let n = 1; n < tp.length; n++) line(tp[n - 1], tp[n], 'rgba(' + (m.state === 'approach' ? P.glow : P.rhoP) + ',1)', Math.max(1, 0.05 * p.s * n / tp.length), (n / tp.length) * 0.5 * master);
            } });
          }
          if (m.state !== 'ads') {
            const h = Math.max(0, m.y - TOP), c = project(m.x, TOP + 0.01, m.z);
            list.push({ z: c.z + 0.03, d: () => {
              ctx.globalAlpha = Math.max(0, 0.3 - h * 0.1) * master; ctx.beginPath();
              ctx.ellipse(c.sx, c.sy, 0.16 * c.s, 0.16 * c.s * Math.max(0.25, Math.sin(pitch)), 0, 0, TAU);
              ctx.fillStyle = 'rgb(' + P.shadow + ')'; ctx.fill();
            } });
          }
          if (m.bond > 0.02 && m.site) {
            const acc = project(m.x, m.y - 0.22, m.z), dep = project(m.x, m.y + 0.22, m.z);
            const pulse = 0.85 + 0.15 * Math.sin(clock * 3.5 + m.ph * 0.1);
            list.push({ z: acc.z + 0.02, d: () => blob(acc, 0.46 * pulse, P.rhoP, 0.5 * m.bond * master) });
            list.push({ z: dep.z - 0.02, d: () => blob(dep, 0.32 * pulse, P.rhoM, 0.45 * m.bond * master) });
            m.site.nb.forEach(ix => {
              const q = pa[ix];
              list.push({ z: (p.z + q.z) / 2 - 0.02, d: () => line(p, q, 'rgba(' + P.rhoP + ',0.95)', Math.max(1, 0.045 * p.s), m.bond * 0.85 * master) });
            });
          }
          list.push({ z: p.z - 0.01, d: () => {
            if (m.mix > 0.5) blob(p, 0.4, P.glow, 0.3 * m.mix * master);
            sphere(p, 0.15 * easeBack(m.born), col, Math.max(0.85, fade(p.z)) * master);
          } });
        });
      }

      list.sort((a, b) => b.z - a.z);
      for (let n = 0; n < list.length; n++) list[n].d();
      ctx.globalAlpha = 1;

      // stage captions drawn on the canvas
      const caps = ['Simple cubic unit cell', 'Build supercell', 'Cleave (001) slab', '', ''];
      if (caps[ph]) {
        const a = clamp(Math.min(pt / 0.3, (PH[ph].d - pt) / 0.3)) * master;
        ctx.globalAlpha = a; ctx.font = '700 11px "Plus Jakarta Sans", system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = P.bg; ctx.strokeText(caps[ph], W / 2, 64);
        ctx.fillStyle = P.text; ctx.fillText(caps[ph], W / 2, 64);
      }
      if (ph === 3 && fmax <= 0.03) {
        const a = clamp((PH[3].d - pt) / 0.3) * master, r = 15 + 2 * Math.sin(clock * 6);
        ctx.globalAlpha = a; ctx.fillStyle = P.ok; ctx.beginPath(); ctx.arc(W / 2, H / 2 - 64, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
        ctx.moveTo(W / 2 - 7, H / 2 - 64); ctx.lineTo(W / 2 - 2, H / 2 - 58); ctx.lineTo(W / 2 + 8, H / 2 - 70); ctx.stroke(); ctx.lineCap = 'butt';
        ctx.font = '700 11px "Plus Jakarta Sans", system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = P.bg; ctx.strokeText('Geometry converged', W / 2, H / 2 - 38);
        ctx.fillStyle = P.ok; ctx.fillText('Geometry converged', W / 2, H / 2 - 38);
      }
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }

    // ── Plots ──
    const gss = (x, m, s) => Math.exp(-((x - m) * (x - m)) / (2 * s * s));
    const PLOT = {
      light: { axis: 'rgba(100,116,139,.5)', grid: 'rgba(100,116,139,.12)', text: '#64748b', tot: '#4f46e5', totF: 'rgba(99,102,241,', ads: '#e11d48', adsF: 'rgba(244,63,94,', surf: '#7c3aed', ef: '#059669', wf: '#7c3aed', vac: 'rgba(20,184,166,.10)', slab: 'rgba(99,102,241,.08)', dot: '#f59e0b' },
      dark:  { axis: 'rgba(148,163,184,.45)', grid: 'rgba(148,163,184,.10)', text: '#94a3b8', tot: '#a5b4fc', totF: 'rgba(129,140,248,', ads: '#fb7185', adsF: 'rgba(251,113,133,', surf: '#c4b5fd', ef: '#34d399', wf: '#c4b5fd', vac: 'rgba(45,212,191,.10)', slab: 'rgba(129,140,248,.10)', dot: '#fbbf24' }
    };
    function grid(c, L, R, T, B, Q) {
      c.strokeStyle = Q.grid; c.lineWidth = 1;
      for (let i = 1; i < 4; i++) { const y = Math.round(T + (B - T) * i / 4) + 0.5; c.beginPath(); c.moveTo(L, y); c.lineTo(R, y); c.stroke(); }
    }
    function drawDOS(p, Q) {
      const c = p.c, w = p.w, h = p.h, L = 4, R = w - 4, T = 4, B = h - 13;
      const E0 = -9, E1 = 3, X = e => L + (e - E0) / (E1 - E0) * (R - L);
      c.clearRect(0, 0, w, h); grid(c, L, R, T, B, Q);
      const th = thetaS;
      const reveal = ph === 0 ? clamp(pt / PH[0].d) * 0.55 : ph === 1 ? 0.55 + 0.45 * clamp(pt / PH[1].d) : 1;
      const noise = ph === 3 ? 0.22 * Math.exp(-1.2 * pt) : 0;
      const breathe = reduceMotion ? 0 : 0.05;
      const dS = -0.3 * th, sf = surfMix;
      const tot = e => {
        let v = 0.1 + 0.9 * gss(e, -3.4 + dS, 0.6) + (1 + breathe * Math.sin(clock * 2.1)) * gss(e, -2.1 + dS, 0.5)
          + 0.85 * gss(e, -0.9 + dS, 0.45) + 0.5 * gss(e, 0.8, 0.55) + sf * 0.5 * gss(e, -0.35, 0.28) + 0.35 * th * gss(e, -6.2, 0.5);
        return v * (1 + noise * Math.sin(e * 3.3 + clock * 14));
      };
      const ads = e => th * ((1.3 + breathe * Math.sin(clock * 2.7)) * gss(e, -6.2, 0.42) + 0.35 * gss(e, -4.6, 0.5) + 0.32 * gss(e, 1.3, 0.4));
      const max = 1.5, Y = v => B - Math.min(1, v / max) * (B - T), eMax = E0 + (E1 - E0) * reveal;
      function curve(f, stroke, fill) {
        const pts = [];
        for (let i = 0; i <= 100; i++) { const e = E0 + (E1 - E0) * i / 100; if (e > eMax) break; pts.push([X(e), Y(f(e)), e]); }
        if (pts.length < 2) return;
        c.beginPath(); c.moveTo(X(E0), B);
        pts.forEach(([x, y, e]) => { if (e <= 0) c.lineTo(x, y); });
        const eCut = Math.min(0, eMax); c.lineTo(X(eCut), Y(f(eCut))); c.lineTo(X(eCut), B); c.closePath();
        const gr = c.createLinearGradient(0, T, 0, B); gr.addColorStop(0, fill + '.55)'); gr.addColorStop(1, fill + '.05)');
        c.fillStyle = gr; c.fill();
        c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
        c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke();
      }
      c.strokeStyle = Q.axis; c.lineWidth = 1; c.beginPath(); c.moveTo(L, B + 0.5); c.lineTo(R, B + 0.5); c.stroke();
      c.fillStyle = Q.text; c.font = '500 8px "JetBrains Mono", monospace'; c.textAlign = 'center';
      [-8, -4, 0].forEach(e => { c.fillText(String(e).replace('-', '−'), X(e), h - 3); c.fillRect(X(e), B, 1, 3); });
      curve(tot, Q.tot, Q.totF);
      if (th > 0.005) curve(ads, Q.ads, Q.adsF);
      if (reveal < 1) { // k-point sweep cursor
        c.globalAlpha = 0.9; c.fillStyle = Q.dot; c.fillRect(X(eMax) - 1, T, 2, B - T);
        c.globalAlpha = 0.18; c.fillRect(X(eMax) - 7, T, 7, B - T); c.globalAlpha = 1;
      }
      c.setLineDash([3, 3]); c.strokeStyle = Q.ef; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(X(0) + 0.5, T); c.lineTo(X(0) + 0.5, B); c.stroke(); c.setLineDash([]);
      c.textAlign = 'left'; c.fillStyle = Q.ef; c.fillText('EF', X(0) + 3, T + 7);
      c.fillStyle = Q.tot; c.fillText(ph < 2 ? 'bulk' : 'd', L + 2, T + 7);
      if (sf > 0.3 && th < 0.005) { c.fillStyle = Q.surf; c.fillText('surf', L + 26, T + 7); }
      if (th > 0.005) { c.fillStyle = Q.ads; c.fillText('ads-p', L + 12, T + 7); }
    }
    const PHI0 = 4.55;
    function phiNow() {
      if (ph < 2) return null;
      if (ph === 2) return PHI0 * vac;
      return PHI0 + phiSettle + 0.95 * thetaS;
    }
    function drawWF(p, Q) {
      const c = p.c, w = p.w, h = p.h, L = 4, R = w - 4, T = 6, B = h - 13;
      const Z1 = 20, V0 = -15, V1 = 8, X = z => L + z / Z1 * (R - L), Y = v => B - (v - V0) / (V1 - V0) * (B - T);
      c.clearRect(0, 0, w, h); grid(c, L, R, T, B, Q);
      const phi = phiNow(), ph2 = phi === null ? 0 : phi;
      const zs = lerp(21.5, 8.7, vac);                  // surface plane moves in as the vacuum opens
      const wob = reduceMotion ? 0 : 0.3;
      if (vac > 0.02) { c.fillStyle = Q.slab; c.fillRect(X(0), T, X(Math.min(Z1, zs)) - X(0), B - T); c.fillStyle = Q.vac; c.fillRect(X(Math.min(Z1, zs)), T, R - X(Math.min(Z1, zs)), B - T); }
      const V = z => {
        let v = -6 + (ph2 + 6) * 0.5 * (1 + Math.tanh((z - zs) / 0.55));
        for (let k = 0; k < 14; k++) {
          const zk = 1.6 + 1.45 * k; if (zk > zs - 0.6) break;
          v -= (8.5 + wob * Math.sin(clock * 6 + k)) * gss(z, zk, 0.255);
        }
        v -= 4.5 * thetaS * gss(z, 9.35, 0.25);
        return Math.max(V0, v);
      };
      c.setLineDash([3, 3]); c.strokeStyle = Q.ef; c.lineWidth = 1.1;
      c.beginPath(); c.moveTo(L, Y(0) + 0.5); c.lineTo(R, Y(0) + 0.5); c.stroke(); c.setLineDash([]);
      const pts = [];
      for (let i = 0; i <= 160; i++) { const z = Z1 * i / 160; pts.push([X(z), Y(V(z))]); }
      c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
      const st = c.createLinearGradient(L, 0, R, 0); st.addColorStop(0, Q.tot); st.addColorStop(1, Q.wf);
      c.strokeStyle = st; c.lineWidth = 1.6; c.stroke();
      // an electron tracer running along V(z)
      if (!reduceMotion) {
        const u = (clock * 0.22) % 1, idx = Math.floor(u * 160), [ex, ey] = pts[idx];
        c.globalAlpha = 0.25; c.fillStyle = Q.dot; c.beginPath(); c.arc(ex, ey, 5, 0, TAU); c.fill();
        c.globalAlpha = 1; c.beginPath(); c.arc(ex, ey, 2.2, 0, TAU); c.fill();
      }
      c.font = '500 8px "JetBrains Mono", monospace';
      if (phi === null || vac < 0.35) {
        c.fillStyle = Q.text; c.textAlign = 'center'; c.fillText('bulk · no vacuum', (L + R) / 2, T + 9);
      }
      if (phi !== null && vac > 0.35) {
        const ax = X(15.6);
        c.globalAlpha = clamp((vac - 0.35) / 0.4); c.strokeStyle = Q.ads; c.fillStyle = Q.ads; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(ax, Y(0)); c.lineTo(ax, Y(phi)); c.stroke();
        [[Y(phi), 1], [Y(0), -1]].forEach(([y, d]) => { c.beginPath(); c.moveTo(ax, y); c.lineTo(ax - 3, y + 4 * d); c.lineTo(ax + 3, y + 4 * d); c.closePath(); c.fill(); });
        c.font = '600 9px "JetBrains Mono", monospace'; c.textAlign = 'left';
        c.fillText('Φ', ax + 4, (Y(0) + Y(phi)) / 2 + 3);
        if (ph === 4 && thetaS > 0.02) {
          c.font = '500 8px "JetBrains Mono", monospace'; c.textAlign = 'right';
          c.fillText('ΔΦ +' + (0.95 * thetaS).toFixed(2), R - 2, Y(phi) - 4);
        }
        c.globalAlpha = 1;
      }
      c.fillStyle = Q.ef; c.font = '500 8px "JetBrains Mono", monospace'; c.textAlign = 'left'; c.fillText('EF', R - 13, Y(0) + 9);
      c.fillStyle = Q.text; c.textAlign = 'center';
      if (vac > 0.35) { c.fillText('slab', X(Math.min(zs, Z1) / 2), h - 3); c.fillText('vacuum z→', X(14.5), h - 3); }
      else c.fillText('z →', (L + R) / 2, h - 3);
      c.strokeStyle = Q.axis; c.beginPath(); c.moveTo(L, B + 0.5); c.lineTo(R, B + 0.5); c.stroke();
      if (phiEl) phiEl.textContent = phi === null ? '—' : phi.toFixed(2);
    }

    function render() {
      const dark = isDark();
      render3D(PAL[dark ? 'dark' : 'light']);
      const Q = PLOT[dark ? 'dark' : 'light'];
      if (plots[0]) drawDOS(plots[0], Q);
      if (plots[1]) drawWF(plots[1], Q);
      const occ = ph === 4 ? sites.filter(s => s.occ).length : 0;
      if (thetaEl && occ !== lastTheta) { lastTheta = occ; thetaEl.textContent = (occ / sites.length).toFixed(2); }
      if (tempEl) tempEl.textContent = Math.round(300 + 6 * Math.sin(clock * 1.7) + 4 * Math.sin(clock * 3.1 + 1));
      if (timeEl) timeEl.textContent = simT.toFixed(2);
      if (barEl) {
        let done = 0, total = 0; PH.forEach((q, i) => { total += q.d; if (i < ph) done += q.d; });
        barEl.style.width = (100 * Math.min(1, (done + Math.min(pt, PH[ph].d)) / total)).toFixed(1) + '%';
      }
    }

    // ── Interaction: drag to rotate · tap to advance / dose · click a step ──
    let dragging = false, moved = 0, lx = 0, ly = 0;
    stage.addEventListener('pointerdown', e => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; try { stage.setPointerCapture(e.pointerId); } catch (err) {} });
    stage.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      yaw += dx * 0.01; yawVel = dx * 0.6; pitch = Math.max(0.15, Math.min(1.05, pitch + dy * 0.006));
    });
    function endDrag() {
      if (dragging && moved < 6) { if (ph < 4) setPhase(ph + 1); else dose(); kick(); }
      dragging = false;
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', () => { dragging = false; });
    stepEls.forEach(el => el.addEventListener('click', () => {
      const n = +el.getAttribute('data-i');
      resetAll(); setPhase(n); if (n === 4) dose(); kick();
    }));

    // ── Loop (paused when off-screen or tab hidden) ──
    let visible = true, last = 0, raf = 0;
    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
      clock += dt; simT += dt * 0.25; if (simT >= 50) simT = 0;
      if (!dragging) { yawVel += (AUTO - yawVel) * Math.min(1, dt * 1.5); yaw += yawVel * dt; pitch += (0.5 + 0.06 * Math.sin(clock * 0.35) - pitch) * Math.min(1, dt * 0.6); }
      stepWorld(dt); stepSCF(dt); render();
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
    function inView() { const r = wrap.getBoundingClientRect(); return r.bottom > 0 && r.top < (window.innerHeight || 800); }
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; kick(); }).observe(wrap);
    // fallback: some mobile browsers deliver IntersectionObserver late, so re-check on scroll/resize
    let chk = 0;
    const recheck = () => { if (chk) return; chk = setTimeout(() => { chk = 0; const v = inView(); if (v !== visible) { visible = v; kick(); } }, 120); };
    window.addEventListener('scroll', recheck, { passive: true });
    window.addEventListener('resize', recheck);
    document.addEventListener('visibilitychange', kick);
    visible = inView();
    setPhase(0);
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
