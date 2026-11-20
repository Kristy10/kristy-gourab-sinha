/* ==========================================================================
   Kristy Gourab Sinha — Minimal Portfolio Interactions
   ========================================================================== */

(function () {
  'use strict';

  // 1. Theme Toggle (Light / Dark)
  const themeToggle = document.getElementById('theme-toggle');
  const root = document.documentElement;

  const savedTheme = localStorage.getItem('kgs-theme');
  if (savedTheme === 'dark' || savedTheme === 'light') {
    root.setAttribute('data-theme', savedTheme);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('kgs-theme', next);
      // sync icon
      const icon = document.getElementById('theme-icon');
      if (icon) icon.textContent = next === 'dark' ? '☀️' : '🌙';
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

  function initCrystalAnimation() {
    if (typeof THREE === 'undefined') {
      console.warn('Three.js not loaded yet, retrying...');
      setTimeout(initCrystalAnimation, 200);
      return;
    }

    const canvas = document.getElementById('crystal-canvas');
    const stage = document.getElementById('crystal-stage');
    if (!canvas || !stage) return;

    // Realtime Screen Coordinates for Crystal Bridge
    function updateCrystalScreenPosition() {
      const rect = stage.getBoundingClientRect();
      crystalBridge.center.x = rect.left + rect.width / 2;
      crystalBridge.center.y = rect.top + rect.height / 2;
      crystalBridge.radius = Math.min(rect.width, rect.height) * 0.42;
    }
    updateCrystalScreenPosition();
    window.addEventListener('resize', updateCrystalScreenPosition);
    window.addEventListener('scroll', updateCrystalScreenPosition, { passive: true });

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, stage.clientWidth / stage.clientHeight, 0.1, 100);
    camera.position.z = 6.2;

    // High performance WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(stage.clientWidth, stage.clientHeight);

    // Master Group
    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    // Primary Faceted Crystal (Icosahedron - 20 Facets)
    const icosaGeometry = new THREE.IcosahedronGeometry(1.85, 0);

    const facetMaterial = new THREE.MeshPhysicalMaterial({
      flatShading: true,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.65,
      ior: 1.52,
      transparent: true,
      opacity: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1
    });

    const crystalMesh = new THREE.Mesh(icosaGeometry, facetMaterial);
    masterGroup.add(crystalMesh);

    // Wireframe Crystallography Lattice Lines
    const wireGeometry = new THREE.WireframeGeometry(icosaGeometry);
    const wireMaterial = new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 0.55,
      linewidth: 1
    });
    const wireMesh = new THREE.LineSegments(wireGeometry, wireMaterial);
    masterGroup.add(wireMesh);

    // Vertex Nodes (Atomic Sites in Lattice)
    const nodeGeometry = new THREE.SphereGeometry(0.065, 16, 16);
    const nodeMaterial = new THREE.MeshBasicMaterial();
    const nodeGroup = new THREE.Group();

    const posAttr = icosaGeometry.attributes.position;
    const vertexSet = [];
    for (let i = 0; i < posAttr.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
      const exists = vertexSet.some(function(existing) { return existing.distanceTo(v) < 0.05; });
      if (!exists) {
        vertexSet.push(v);
        const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
        node.position.copy(v);
        nodeGroup.add(node);
      }
    }
    masterGroup.add(nodeGroup);

    // Inner Concentric Unit Cell (Octahedron Core)
    const coreGeometry = new THREE.OctahedronGeometry(0.95, 0);
    const coreMaterial = new THREE.MeshStandardMaterial({
      flatShading: true,
      roughness: 0.3,
      metalness: 0.8,
      transparent: true,
      opacity: 0.68
    });
    const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    const coreWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(coreGeometry),
      new THREE.LineBasicMaterial({ transparent: true, opacity: 0.7 })
    );
    coreMesh.add(coreWire);
    masterGroup.add(coreMesh);

    // Ambient Quantum Particle Field
    const particleCount = 42;
    const particleGroup = new THREE.Group();
    const particleGeom = new THREE.SphereGeometry(0.028, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial();
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      const pMesh = new THREE.Mesh(particleGeom, particleMaterial);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const radius = 2.4 + Math.random() * 0.9;
      const speed = 0.4 + Math.random() * 0.8;
      const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();

      pMesh.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );

      particleGroup.add(pMesh);
      particles.push({ mesh: pMesh, radius: radius, theta: theta, speed: speed, axis: axis });
    }
    masterGroup.add(particleGroup);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x5ce1b6, 2.5, 25);
    pointLight1.position.set(3, 4, 4);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x10b981, 1.8, 25);
    pointLight2.position.set(-4, -3, -2);
    scene.add(pointLight2);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.45);
    dirLight.position.set(0, 5, 3);
    scene.add(dirLight);

    // Dynamic Theme Color Synchronization
    function updateColors() {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        facetMaterial.color.set(0x0e1715);
        facetMaterial.emissive.set(0x052019);
        facetMaterial.emissiveIntensity = 0.42;
        wireMaterial.color.set(0x4eeda8);
        wireMaterial.opacity = 0.65;
        nodeMaterial.color.set(0x4eeda8);
        coreMaterial.color.set(0x132822);
        coreMaterial.emissive.set(0x4eeda8);
        coreMaterial.emissiveIntensity = 0.28;
        coreWire.material.color.set(0x4eeda8);
        particleMaterial.color.set(0x4eeda8);
        pointLight1.color.set(0x4eeda8);
        pointLight2.color.set(0x38bdf8);
      } else {
        facetMaterial.color.set(0xe0f2fe);
        facetMaterial.emissive.set(0x059669);
        facetMaterial.emissiveIntensity = 0.12;
        wireMaterial.color.set(0x059669);
        wireMaterial.opacity = 0.45;
        nodeMaterial.color.set(0x059669);
        coreMaterial.color.set(0xd1fae5);
        coreMaterial.emissive.set(0x059669);
        coreMaterial.emissiveIntensity = 0.15;
        coreWire.material.color.set(0x059669);
        particleMaterial.color.set(0x059669);
        pointLight1.color.set(0x059669);
        pointLight2.color.set(0x0284c7);
      }
    }
    updateColors();

    const themeObserver = new MutationObserver(updateColors);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // User Interaction (Drag / Tilt / Pulse)
    let isDragging = false;
    let prevPointer = { x: 0, y: 0 };
    let dragStart = { x: 0, y: 0 };
    const rotVelocity = { x: 0, y: 0 };
    const mouseNorm = { x: 0, y: 0 };

    let pulseScale = 1;
    const targetScale = 1;
    let lightFlash = 0;

    function triggerPulse() {
      pulseScale = 1.28;
      lightFlash = 2.8;
      rotVelocity.y += (Math.random() - 0.5) * 0.14;
      rotVelocity.x += (Math.random() - 0.5) * 0.14;

      // Trigger quantum burst into background particle flow
      if (typeof crystalBridge.emitBurst === 'function') {
        updateCrystalScreenPosition();
        crystalBridge.emitBurst(crystalBridge.center.x, crystalBridge.center.y, 22, 3.8);
      }
    }

    stage.addEventListener('pointerdown', function(e) {
      isDragging = true;
      prevPointer = { x: e.clientX, y: e.clientY };
      dragStart = { x: e.clientX, y: e.clientY };
      if (stage.setPointerCapture) stage.setPointerCapture(e.pointerId);
    });

    window.addEventListener('pointermove', function(e) {
      const rect = stage.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / (rect.width || 1);
      const relY = (e.clientY - rect.top) / (rect.height || 1);
      mouseNorm.x = (relX - 0.5) * 2;
      mouseNorm.y = (relY - 0.5) * 2;

      if (isDragging) {
        const dx = e.clientX - prevPointer.x;
        const dy = e.clientY - prevPointer.y;
        rotVelocity.y += dx * 0.005;
        rotVelocity.x += dy * 0.005;
        prevPointer = { x: e.clientX, y: e.clientY };
      }
    });

    function endDrag(e) {
      if (!isDragging) return;
      isDragging = false;
      const dist = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
      if (dist < 6) {
        triggerPulse();
      }
    }

    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    // Responsive Canvas Resize
    function onResize() {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      updateCrystalScreenPosition();
    }
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();

    // 60FPS Animation Loop
    function animate() {
      requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();

      // Inertia & Continuous gentle ambient rotation
      masterGroup.rotation.y += rotVelocity.y + 0.0045;
      masterGroup.rotation.x += rotVelocity.x + 0.002;

      const spinSpeed = Math.hypot(rotVelocity.x, rotVelocity.y);
      crystalBridge.spinIntensity = spinSpeed;
      crystalBridge.isInteracting = isDragging;

      // When crystal rotates, emit synchronized radiant quantum sparks from crystal perimeter
      if ((isDragging || spinSpeed > 0.006) && typeof crystalBridge.emitStream === 'function') {
        const angle = masterGroup.rotation.y + (Math.random() - 0.5) * 1.8;
        const rad = crystalBridge.radius * (0.65 + Math.random() * 0.35);
        const sx = crystalBridge.center.x + Math.cos(angle) * rad;
        const sy = crystalBridge.center.y + Math.sin(angle) * rad;
        const speed = 2.0 + spinSpeed * 65;
        const vx = Math.cos(angle) * speed + (rotVelocity.y * 120);
        const vy = Math.sin(angle) * speed - (rotVelocity.x * 120);
        crystalBridge.emitStream(sx, sy, vx, vy, isDragging ? 1.0 : 0.7);
      }

      rotVelocity.x *= 0.94;
      rotVelocity.y *= 0.94;

      // Inner Core Counter-Rotation
      coreMesh.rotation.y -= 0.012;
      coreMesh.rotation.z += 0.008;

      // Subtle parallax tilt towards cursor
      const targetTiltX = mouseNorm.y * 0.22;
      const targetTiltY = mouseNorm.x * 0.28;
      masterGroup.position.x += (targetTiltY - masterGroup.position.x) * 0.05;

      // Harmonic floating oscillation
      masterGroup.position.y = Math.sin(elapsed * 1.5) * 0.12 - (targetTiltX * 0.4);

      // Light highlight follower
      pointLight1.position.x = 3 + mouseNorm.x * 2.5;
      pointLight1.position.y = 4 - mouseNorm.y * 2.5;

      // Elastic Spring Pulse on Click
      pulseScale += (targetScale - pulseScale) * 0.08;
      masterGroup.scale.set(pulseScale, pulseScale, pulseScale);

      // Light flash and spin-reactive glow
      if (lightFlash > 0) {
        pointLight1.intensity = 2.5 + lightFlash;
        lightFlash *= 0.9;
        if (lightFlash < 0.02) lightFlash = 0;
      } else if (spinSpeed > 0.008) {
        pointLight1.intensity = 2.5 + Math.min(spinSpeed * 40, 2.0);
      }

      // Orbital Particle Swarm
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.mesh.position.applyAxisAngle(p.axis, p.speed * 0.008);
      }

      renderer.render(scene, camera);
    }

    animate();
  }

  // Initialize Crystal Animation
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initCrystalAnimation);
  } else {
    initCrystalAnimation();
  }

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
